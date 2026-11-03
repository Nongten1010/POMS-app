import type { AlertEventDTO } from '../alert-events/alert-events.types';
import { isAlertEventExceedance } from '../alert-events/alert-event-exceedance';
import type { AlertEmailJob } from './alert-email-outbox.repository';
import type { ActiveAlertEmailPolicy } from './alert-email-policy';
import type { AlertEmailPoint } from './alert-email-source.repository';
import { alertEmailPointRecipients, pointMatchesAlertEmailEvent } from './alert-email-engine';
import { ABNORMAL_MINIMUM_HOURS, ABNORMAL_MINIMUM_READINGS } from './alert-email-abnormal-detector';

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
    now?: Date;
  },
): Promise<boolean> {
  if (job.eventIds.length === 0) return false;
  const exceedance = job.alertType === 'STANDARD_EXCEEDED' || job.alertType === 'EIA_EXCEEDED';
  const abnormal = job.alertType === 'ABNORMAL_VALUE';
  const hourly = exceedance || abnormal;
  const daily =
    job.alertType === 'DAILY_COMPLETENESS_LOW' || job.alertType === 'CONSECUTIVE_NO_REPORT';
  if (
    (hourly && job.cadence !== 'HOURLY') ||
    (daily && job.cadence !== 'DAILY') ||
    (!hourly && !daily)
  )
    return false;
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
    if (exceedance) {
      const expectedThreshold = event.alertType === 'STANDARD_EXCEEDED' ? 'STANDARD' : 'EIA';
      if (
        event.thresholdType !== expectedThreshold ||
        !isAlertEventExceedance(event.measuredValue, event.thresholdValue)
      )
        return false;
    }
    if (abnormal) {
      const first = Date.parse(event.firstAbnormalAt ?? '');
      const confirmed = Date.parse(event.confirmedAbnormalAt ?? '');
      const ended = Date.parse(event.endedAt ?? '');
      if (
        !evidence ||
        evidence.abnormalMode !== 'HOURLY' ||
        evidence.abnormalHours !== ABNORMAL_MINIMUM_HOURS ||
        evidence.abnormalReadings !== ABNORMAL_MINIMUM_READINGS ||
        evidence.notificationDate !== event.eventDate ||
        !['ZERO', 'NEGATIVE', 'CONSTANT'].includes(event.abnormalType ?? '') ||
        (event.abnormalStreakCount ?? 0) < ABNORMAL_MINIMUM_READINGS ||
        !Number.isFinite(first) ||
        !Number.isFinite(confirmed) ||
        !Number.isFinite(ended) ||
        confirmed - first < ABNORMAL_MINIMUM_HOURS * 3_600_000 ||
        ended < confirmed
      )
        return false;
      if (dependencies.now) {
        const today = new Date(dependencies.now.getTime() + 7 * 3_600_000)
          .toISOString()
          .slice(0, 10);
        if (event.eventDate !== today || ended > dependencies.now.getTime()) return false;
      }
    }
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
        evidence.exemptDayPolicy !== policy.exemptDayPolicy)
    )
      return false;
    if (!(await dependencies.hasActiveParameter(event))) return false;
  }
  return true;
}
