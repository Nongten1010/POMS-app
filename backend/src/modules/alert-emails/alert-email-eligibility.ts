import type { AlertEventDTO } from '../alert-events/alert-events.types';
import type { AlertEmailJob } from './alert-email-outbox.repository';
import type { ActiveAlertEmailPolicy } from './alert-email-policy';
import type { AlertEmailPoint } from './alert-email-source.repository';
import { alertEmailPointRecipients, pointMatchesAlertEmailEvent } from './alert-email-engine';

export interface CurrentAlertEmailEvent {
  event: AlertEventDTO;
  evidence: Record<string, unknown> | null;
}

export async function isAlertEmailJobEligible(
  job: AlertEmailJob,
  policy: ActiveAlertEmailPolicy,
  dependencies: {
    events: CurrentAlertEmailEvent[];
    points: AlertEmailPoint[];
    hasActiveParameter(event: AlertEventDTO): Promise<boolean>;
  },
): Promise<boolean> {
  if (job.eventIds.length === 0) return false;
  const byId = new Map(dependencies.events.map((item) => [item.event.id, item]));
  for (const id of job.eventIds) {
    const current = byId.get(id);
    if (!current) return false;
    const { event, evidence } = current;
    if (
      event.notificationStatus === 'DISMISSED' ||
      event.alertType !== job.alertType ||
      (job.systemType && event.systemType !== job.systemType)
    )
      return false;
    const point = dependencies.points.find((item) => pointMatchesAlertEmailEvent(item, event));
    if (
      !point ||
      !alertEmailPointRecipients(point, policy).includes(job.recipient.trim().toLowerCase())
    )
      return false;
    if (
      job.cadence === 'DAILY' &&
      (!evidence ||
        evidence.completenessPolicy !== policy.completenessPolicy ||
        evidence.exemptDayPolicy !== policy.exemptDayPolicy ||
        (event.alertType === 'ABNORMAL_VALUE' &&
          evidence.abnormalReadings !== policy.abnormalReadings))
    )
      return false;
    if (!(await dependencies.hasActiveParameter(event))) return false;
  }
  return true;
}
