export const ALERT_EVENT_EXCEEDANCE_MESSAGE = 'measuredValue must be greater than thresholdValue';

export function isAlertEventExceedance(measuredValue: unknown, thresholdValue: unknown): boolean {
  return (
    typeof measuredValue === 'number' &&
    typeof thresholdValue === 'number' &&
    Number.isFinite(measuredValue) &&
    Number.isFinite(thresholdValue) &&
    measuredValue > thresholdValue
  );
}
