/** Use the live connected point consistently in both factory and parameter forms. */
export function deriveCurrentParameterDetails(point: {
  parameters: string[];
  details?: Record<string, unknown> | null;
}): Record<string, unknown> {
  const details = point.details ?? {};
  const eligibleParameters = Array.isArray(details.eligibleParameters)
    ? details.eligibleParameters.filter(
        (parameter): parameter is string => typeof parameter === 'string',
      )
    : [];
  const connectedParameters = [...point.parameters];
  const connectedParameterKeys = new Set(connectedParameters.map(normalizeParameterKey));

  return {
    ...details,
    eligibleParameters,
    connectedParameters,
    pendingParameters: eligibleParameters.filter(
      (parameter) => !connectedParameterKeys.has(normalizeParameterKey(parameter)),
    ),
    requestedParameters: [...connectedParameters],
  };
}

function normalizeParameterKey(parameter: string): string {
  return parameter.normalize('NFKC').trim().toLocaleLowerCase('en-US').replace(/\s+/gu, ' ');
}
