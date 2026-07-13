function multiplyWithoutFloatingPointNoise(value, multiplier) {
  return Number((value * multiplier).toPrecision(15))
}

function toFinitePositiveNumber(value) {
  if (typeof value === 'string' && value.trim() === '') return null

  if (
    typeof value === 'string'
    && !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(value.trim())
  ) {
    return null
  }

  const numericValue = Number(value)
  if (!Number.isFinite(numericValue) || numericValue <= 0) return null

  const warningValue = multiplyWithoutFloatingPointNoise(numericValue, 0.8)
  return warningValue > 0 && warningValue < numericValue ? numericValue : null
}

export function deriveCriteriaRows(standardValue) {
  const numericValue = toFinitePositiveNumber(standardValue)
  if (numericValue === null) return null

  const warningValue = multiplyWithoutFloatingPointNoise(numericValue, 0.8)
  const standard = String(numericValue)
  const warning = String(warningValue)

  return [
    { level: 'normal', min: '0', max: warning },
    { level: 'warning', min: warning, max: standard },
    { level: 'critical', min: standard, max: '' },
  ]
}

export function isCriteriaInputValid(criteria) {
  if (!criteria?.enabled) return true
  return deriveCriteriaRows(criteria.standardValue) !== null
}
