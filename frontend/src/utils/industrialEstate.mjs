const industrialEstateFields = [
  'industrialEstateCode',
  'industrialEstateName',
  'industrialAreaType',
  'industrialAreaTypeLabel',
]

function hasOwn(source, field) {
  return Boolean(source && typeof source === 'object' && Object.prototype.hasOwnProperty.call(source, field))
}

function hasValue(value) {
  return value !== null && value !== undefined && String(value).trim() !== ''
}

export function hasIndustrialEstateFields(source) {
  return industrialEstateFields.some((field) => hasOwn(source, field))
}

export function getIndustrialEstateInfo(...sources) {
  const source = sources.find((item) => (
    hasOwn(item, 'industrialEstateCode') || hasOwn(item, 'industrialEstateName')
  )) ?? sources.find(hasIndustrialEstateFields)
  if (!source) return null

  const industrialEstateCode = hasOwn(source, 'industrialEstateCode') ? source.industrialEstateCode : null
  const industrialEstateName = hasOwn(source, 'industrialEstateName') ? source.industrialEstateName : null
  const isInside = hasValue(industrialEstateCode) || hasValue(industrialEstateName)

  return {
    industrialEstateCode,
    industrialEstateName,
    industrialAreaType: isInside ? 'INDUSTRIAL_ESTATE' : 'OUTSIDE_INDUSTRIAL_ESTATE',
    industrialAreaTypeLabel: isInside ? 'ในนิคมอุตสาหกรรม' : 'นอกนิคมอุตสาหกรรม',
  }
}

export function formatIndustrialEstate(info, fallback = '-') {
  const name = hasValue(info?.industrialEstateName) ? String(info.industrialEstateName).trim() : ''
  const code = hasValue(info?.industrialEstateCode) ? String(info.industrialEstateCode).trim() : ''

  if (name && code) return `${name} (${code})`
  return name || code || fallback
}
