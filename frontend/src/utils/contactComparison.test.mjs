import assert from 'node:assert/strict'
import test from 'node:test'
import { getContactComparison, getMeasurementPointComparisonPair } from './contactComparison.mjs'

const person = { name: 'ผู้ติดต่อเดิม', phone: '0812345678', position: 'วิศวกร', email: null }
const snapshot = (overrides = {}) => ({
  systemType: 'CEMS',
  contactPersons: [person],
  notificationEmails: ['old@example.com'],
  officerNotificationEmails: ['officer@example.com'],
  ...overrides,
})

test('comparison reads each contact snapshot instead of root or live factory values', () => {
  const raw = {
    currentContacts: snapshot(),
    proposedContacts: snapshot({ contactPersons: [{ ...person, phone: '0899999999' }], notificationEmails: ['new@example.com'] }),
    contactPersons: [{ name: 'wrong root' }],
    notificationEmails: ['wrong@example.com'],
  }
  const before = getContactComparison(raw, 'before')
  const after = getContactComparison(raw, 'after')
  assert.equal(before.values.contactPersons[0].phone, '0812345678')
  assert.equal(after.values.contactPersons[0].phone, '0899999999')
  assert.deepEqual(before.values.notificationEmails, ['old@example.com'])
  assert.deepEqual(after.values.notificationEmails, ['new@example.com'])
  for (const side of [before, after]) {
    assert.deepEqual(side.highlightedFieldNames, ['contactPhone-0', 'notificationEmail-0'])
    assert.deepEqual(side.unavailableFields, [])
  }
})

test('explicit empty contact snapshots clear every list without restoring root values', () => {
  const raw = {
    currentContacts: snapshot(),
    proposedContacts: snapshot({ contactPersons: [], notificationEmails: [], officerNotificationEmails: [] }),
    contactPersons: [person], notificationEmails: ['stale@example.com'], officerNotificationEmails: ['stale@example.com'],
  }
  const after = getContactComparison(raw)
  assert.deepEqual(after.values, { contactPersons: [], notificationEmails: [], officerNotificationEmails: [] })
  assert.deepEqual(after.highlightedFieldNames, ['contactPersons', 'notificationEmails', 'officerNotificationEmails'])
  assert.ok(getContactComparison(raw, 'before').highlightedFieldNames.includes('contactName-0'))
})

test('legacy null snapshots remain unavailable, not empty historical evidence', () => {
  const raw = { currentContacts: null, proposedContacts: null, contactPersons: [person], notificationEmails: ['context@example.com'] }
  for (const side of ['before', 'after']) {
    const result = getContactComparison(raw, side)
    assert.equal(result.unavailableFields.length, 3)
    assert.deepEqual(result.highlightedFieldNames, [])
    assert.deepEqual(result.values.contactPersons, [person])
  }
})

test('one missing snapshot cannot produce a false contact difference', () => {
  const result = getContactComparison({ currentContacts: null, proposedContacts: snapshot() })
  assert.equal(result.unavailableFields.length, 3)
  assert.deepEqual(result.highlightedFieldNames, [])
})

test('officer emails are paired by connectedPointId, not array position or root aggregate', () => {
  const raw = {
    currentContacts: snapshot(), proposedContacts: snapshot(),
    currentMeasurementPoints: [
      { connectedPointId: 2, systemType: 'CEMS', officerNotificationEmails: ['unrelated@example.com'] },
      { connectedPointId: 1, systemType: 'CEMS', officerNotificationEmails: ['old-point@example.com'] },
    ],
    proposedMeasurementPoints: [
      { connectedPointId: '1', systemType: 'CEMS', officerNotificationEmails: [] },
      { connectedPointId: 2, systemType: 'CEMS', officerNotificationEmails: ['unrelated@example.com'] },
    ],
  }
  assert.equal(getMeasurementPointComparisonPair(raw).before.connectedPointId, 1)
  assert.deepEqual(getContactComparison(raw, 'before').values.officerNotificationEmails, ['old-point@example.com'])
  assert.deepEqual(getContactComparison(raw).values.officerNotificationEmails, [])
  assert.deepEqual(getContactComparison(raw).highlightedFieldNames, ['officerNotificationEmails'])
})

test('point officer emails can be compared even without contact snapshots', () => {
  const raw = {
    currentContacts: null, proposedContacts: null,
    currentMeasurementPoints: [{ connectedPointId: 5, officerNotificationEmails: ['before@example.com'] }],
    proposedMeasurementPoints: [{ connectedPointId: 5, officerNotificationEmails: ['after@example.com'] }],
  }
  const result = getContactComparison(raw)
  assert.deepEqual(result.unavailableFields, ['contactPersons', 'notificationEmails'])
  assert.deepEqual(result.highlightedFieldNames, ['officerNotificationEmail-0'])
})

test('missing point history does not fall back to another point or compare an aggregate with a point', () => {
  const raw = {
    currentContacts: snapshot(), proposedContacts: snapshot(),
    currentMeasurementPoints: [{ connectedPointId: 2, officerNotificationEmails: ['another@example.com'] }],
    proposedMeasurementPoints: [{ connectedPointId: 1, officerNotificationEmails: ['new@example.com'] }],
  }
  assert.equal(getMeasurementPointComparisonPair(raw).before, undefined)
  assert.ok(getContactComparison(raw).unavailableFields.includes('officerNotificationEmails'))
  assert.deepEqual(getContactComparison(raw).highlightedFieldNames, [])
})

test('inserting and reordering contacts does not highlight unchanged rows', () => {
  const added = { name: 'ผู้ติดต่อใหม่', phone: '0822222222' }
  const raw = { currentContacts: snapshot(), proposedContacts: snapshot({ contactPersons: [added, person] }) }
  assert.deepEqual(getContactComparison(raw, 'before').highlightedFieldNames, [])
  assert.deepEqual(getContactComparison(raw).highlightedFieldNames, ['contactName-0', 'contactPosition-0', 'contactPhone-0', 'contactEmail-0'])
  raw.currentContacts.contactPersons = [person, added]
  assert.deepEqual(getContactComparison(raw).highlightedFieldNames, [])
})

test('contact row changes after reordering highlight only the changed property', () => {
  const other = { name: 'ผู้ติดต่อสอง', phone: '0822222222' }
  const raw = {
    currentContacts: snapshot({ contactPersons: [person, other] }),
    proposedContacts: snapshot({ contactPersons: [other, { ...person, position: 'ผู้จัดการ' }] }),
  }
  assert.deepEqual(getContactComparison(raw).highlightedFieldNames, ['contactPosition-1'])
  assert.deepEqual(getContactComparison(raw, 'before').highlightedFieldNames, ['contactPosition-0'])
})

test('email comparison ignores case, whitespace, duplicates, and order but marks additions and removals', () => {
  const raw = {
    currentContacts: snapshot({ notificationEmails: [' A@example.com ', 'b@example.com'] }),
    proposedContacts: snapshot({ notificationEmails: ['B@example.com', 'a@example.com', 'a@example.com'] }),
  }
  assert.deepEqual(getContactComparison(raw).highlightedFieldNames, [])
  raw.proposedContacts.notificationEmails = ['b@example.com', 'c@example.com']
  assert.deepEqual(getContactComparison(raw).highlightedFieldNames, ['notificationEmail-1'])
  assert.deepEqual(getContactComparison(raw, 'before').highlightedFieldNames, ['notificationEmail-0'])
})

test('a snapshot for a different system is not used as contact comparison evidence', () => {
  const raw = {
    currentContacts: snapshot(), proposedContacts: snapshot(),
    currentMeasurementPoints: [{ connectedPointId: 1, systemType: 'WPMS' }],
    proposedMeasurementPoints: [{ connectedPointId: 1, systemType: 'WPMS' }],
  }
  assert.equal(getContactComparison(raw).unavailableFields.length, 3)
  raw.currentContacts.systemType = null
  raw.proposedContacts.systemType = null
  assert.equal(getContactComparison(raw).unavailableFields.length, 0)
})
