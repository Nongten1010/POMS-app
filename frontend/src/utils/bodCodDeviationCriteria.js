import deviationCriteria from '../option/bodCodDeviationCriteria.json'

function toFiniteNumber(value) {
  if (value === null || value === undefined || String(value).trim() === '') return null

  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function getParameterCriteria(parameter) {
  return deviationCriteria[String(parameter ?? '').trim().toUpperCase()] ?? null
}

export function getBodCodStandardDeviation(parameter, labValue) {
  const criteria = getParameterCriteria(parameter)
  const value = toFiniteNumber(labValue)
  if (!criteria || value === null || value < 0) return null

  const range = criteria.ranges.find(({ minExclusive, maxInclusive }) => (
    (minExclusive === null || value > minExclusive) && value <= maxInclusive
  ))

  return range?.deviation ?? null
}

export function formatBodCodStandardDeviation(parameter, labValue) {
  const criteria = getParameterCriteria(parameter)
  const deviation = getBodCodStandardDeviation(parameter, labValue)
  if (!criteria || deviation === null) return ''

  return `± ${deviation.toFixed(criteria.deviationDecimalPlaces)}`
}

export function calculateBodCodErrorValue(parameter, deviceValue, labValue) {
  const criteria = getParameterCriteria(parameter)
  const deviceNumber = toFiniteNumber(deviceValue)
  const labNumber = toFiniteNumber(labValue)
  if (!criteria || deviceNumber === null || labNumber === null) return ''

  return (deviceNumber - labNumber).toFixed(criteria.errorDecimalPlaces)
}
