function parameterValues(values) {
  return [...new Set((Array.isArray(values) ? values : [])
    .filter((value) => typeof value === 'string')
    .map((value) => value.trim())
    .filter((value) => value && value !== 'ไม่มี'))]
}

export function getAddParameterGroups(details = {}) {
  const connectedParameters = parameterValues(details?.connectedParameters)
  const connected = new Set(connectedParameters)
  return {
    connectedParameters,
    pendingParameters: parameterValues(details?.eligibleParameters).filter((value) => !connected.has(value)),
    requestedParameters: [],
  }
}
