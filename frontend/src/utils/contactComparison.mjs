const contactFields = {
  name: 'contactName',
  position: 'contactPosition',
  phone: 'contactPhone',
  email: 'contactEmail',
}

const normalizedText = (value) => String(value ?? '').trim()
const normalizedEmail = (value) => normalizedText(value).toLowerCase()
const contactValue = (contact, field) => field === 'email'
  ? normalizedEmail(contact?.[field])
  : normalizedText(contact?.[field])

export function getMeasurementPointComparisonPair(raw = {}) {
  const before = Array.isArray(raw.currentMeasurementPoints) ? raw.currentMeasurementPoints : []
  const after = Array.isArray(raw.proposedMeasurementPoints) ? raw.proposedMeasurementPoints : []
  const selected = after[0] ?? before[0]
  const findSelected = (points) => selected?.connectedPointId != null
    ? points.find((point) => String(point.connectedPointId) === String(selected.connectedPointId))
    : points[0]
  return { before: findSelected(before), after: findSelected(after) }
}

function getContactFieldChanges(before, after, variant) {
  const fields = Object.keys(contactFields)
  const remainingBefore = new Set(before.map((_, index) => index))
  const remainingAfter = new Set(after.map((_, index) => index))
  const pairs = []
  const match = (predicate) => {
    for (const afterIndex of remainingAfter) {
      const beforeIndex = [...remainingBefore].find((index) => predicate(before[index], after[afterIndex]))
      if (beforeIndex !== undefined) {
        pairs.push([beforeIndex, afterIndex])
        remainingBefore.delete(beforeIndex)
        remainingAfter.delete(afterIndex)
      }
    }
  }
  // Match unchanged contacts first so insertion or reordering does not mark every row.
  match((left, right) => fields.every((field) => contactValue(left, field) === contactValue(right, field)))
  match((left, right) => ['name', 'phone'].some((field) => contactValue(left, field)
    && contactValue(left, field) === contactValue(right, field)))
  const unmatchedBefore = [...remainingBefore]
  const unmatchedAfter = [...remainingAfter]
  for (let index = 0; index < Math.max(unmatchedBefore.length, unmatchedAfter.length); index += 1) {
    pairs.push([unmatchedBefore[index], unmatchedAfter[index]])
  }
  return pairs.flatMap(([beforeIndex, afterIndex]) => {
    const displayedIndex = variant === 'before' ? beforeIndex : afterIndex
    if (displayedIndex === undefined) return []
    return fields.filter((field) => beforeIndex === undefined || afterIndex === undefined
      || contactValue(before[beforeIndex], field) !== contactValue(after[afterIndex], field))
      .map((field) => `${contactFields[field]}-${displayedIndex}`)
  })
}

export function getContactComparison(raw = {}, variant = 'after') {
  const points = getMeasurementPointComparisonPair(raw)
  const systemType = points.after?.systemType ?? points.before?.systemType
  const snapshotFor = (side) => {
    const snapshot = side === 'before' ? raw.currentContacts : raw.proposedContacts
    return snapshot && (!systemType || snapshot.systemType == null || snapshot.systemType === systemType)
      ? snapshot
      : null
  }
  const snapshotValues = (side, field) => {
    // Point-specific emails must not be replaced by the system-wide aggregate.
    if (field === 'officerNotificationEmails' && (Object.hasOwn(points.before ?? {}, field)
      || Object.hasOwn(points.after ?? {}, field))) {
      return points[side]?.[field]
    }
    return snapshotFor(side)?.[field]
  }
  const values = {}
  const unavailableFields = []
  const highlightedFieldNames = []
  for (const [field, inputName] of Object.entries({
    contactPersons: 'contactPersons',
    notificationEmails: 'notificationEmail',
    officerNotificationEmails: 'officerNotificationEmail',
  })) {
    const before = snapshotValues('before', field)
    const after = snapshotValues('after', field)
    const displayed = variant === 'before' ? before : after
    values[field] = Array.isArray(displayed) ? displayed : Array.isArray(raw[field]) ? raw[field] : []
    if (!Array.isArray(before) || !Array.isArray(after)) {
      unavailableFields.push(field)
      continue
    }
    if (field === 'contactPersons') {
      highlightedFieldNames.push(...getContactFieldChanges(before, after, variant))
      if (displayed.length === 0 && (before.length || after.length)) highlightedFieldNames.push(field)
    } else {
      const other = new Set((variant === 'before' ? after : before).map(normalizedEmail))
      displayed.forEach((email, index) => {
        if (!other.has(normalizedEmail(email))) highlightedFieldNames.push(`${inputName}-${index}`)
      })
      if (displayed.length === 0 && other.size) highlightedFieldNames.push(field)
    }
  }
  return { values, unavailableFields, highlightedFieldNames }
}
