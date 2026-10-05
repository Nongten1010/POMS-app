import { createHash } from 'node:crypto';

interface HourlyAlertEventIdentity {
  systemType: string;
  stationId: string;
  parameterCode: string;
  alertType: string;
  startedAt: string;
  unit: string;
}

/** Comparison only: keep the original unit spelling for the human-readable label. */
export function normalizeAlertEventUnit(unit: string): string {
  return unit.trim().toLowerCase();
}

/** The unit is part of the identity; ppm and percent must never share an event. */
export function buildAlertEventIdempotencyKey(input: HourlyAlertEventIdentity): string {
  const identity = JSON.stringify([
    input.systemType,
    input.stationId,
    input.parameterCode.toLowerCase(),
    normalizeAlertEventUnit(input.unit),
    input.alertType,
    input.startedAt,
  ]);

  return `v2:${createHash('sha256').update(identity).digest('hex')}`;
}

/** Used only to locate pre-v2 rows, whose stored unit must be checked separately. */
export function buildLegacyAlertEventIdempotencyKey(input: HourlyAlertEventIdentity): string {
  return [
    input.systemType,
    input.stationId,
    input.parameterCode.toLowerCase(),
    input.alertType,
    input.startedAt,
  ].join(':');
}
