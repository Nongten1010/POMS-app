import { createHash } from 'node:crypto';
import { z } from 'zod';
import type { AlertEventDTO } from '../alert-events/alert-events.types';
import { MANDATORY_EMAIL_CC } from '../../shared/services/email-policy';
import type { ActiveAlertEmailPolicy, AlertEmailPolicy } from './alert-email-policy';
import type { AlertEmailPoint } from './alert-email-source.repository';
import type { AlertEmailOutboxRepository } from './alert-email-outbox.repository';
import {
  isAlertEmailHourlyRoundDue,
  latestAlertEmailPeriods,
  type AlertEmailPeriod,
} from './alert-email-rules';
import type { RenderAlertEmailInput, AlertEmailRenderContext } from './alert-email-template';
import { normalizeAlertActivationStationIdentity } from './alert-parameter-activations';
import { ABNORMAL_MINIMUM_HOURS } from './alert-email-abnormal-detector';

const timestampSchema = z.iso.datetime({ offset: true });

export interface AlertEmailEngineDependencies {
  source: {
    loadRenderContext?(events: AlertEventDTO[]): Promise<Record<number, AlertEmailRenderContext>>;
    listPoints(): Promise<AlertEmailPoint[]>;
    listEvents(input: {
      cadence: 'HOURLY' | 'DAILY';
      startAt: string;
      endAt: string;
    }): Promise<AlertEventDTO[]>;
  };
  outbox: Pick<AlertEmailOutboxRepository, 'listBatchedEventIds' | 'enqueue'>;
  render(input: RenderAlertEmailInput): {
    subject: string;
    text: string;
    html: string;
  };
  prepareDaily(
    point: AlertEmailPoint,
    date: string,
    policy: ActiveAlertEmailPolicy,
    now: Date,
  ): Promise<number[]>;
  prepareAbnormal(
    point: AlertEmailPoint,
    policy: ActiveAlertEmailPolicy,
    now: Date,
  ): Promise<number[]>;
}

export function alertEmailPointRecipients(
  point: AlertEmailPoint,
  policy: ActiveAlertEmailPolicy,
): string[] {
  return [
    ...new Set(
      [
        ...point.officerEmails,
        ...(policy.recipientMode === 'POINT_OFFICERS_AND_FACTORY' ? point.factoryEmails : []),
      ].map((email) => email.trim().toLowerCase()),
    ),
  ];
}

export function pointMatchesAlertEmailEvent(point: AlertEmailPoint, event: AlertEventDTO): boolean {
  return (
    point.systemType === event.systemType &&
    normalizeAlertActivationStationIdentity(point.stationId) ===
      normalizeAlertActivationStationIdentity(event.stationId) &&
    Boolean(event.factoryId) &&
    point.factoryId === event.factoryId
  );
}

/** Persistent event/recipient mappings prevent duplicates, including after process restarts. */
export function createAlertEmailEngine(dependencies: AlertEmailEngineDependencies) {
  const prepared = new Map<string, number[]>();
  return {
    async run(
      now: Date,
      policy: AlertEmailPolicy,
    ): Promise<{ queued: number; skipped: number; errors: number }> {
      const result = { queued: 0, skipped: 0, errors: 0 };
      if (!policy.enabled) return result;
      const periods = latestAlertEmailPeriods(now, policy.hourlyDelayMinutes);
      const points = await dependencies.source.listPoints();
      const date = new Date(Date.parse(periods.daily.startAt) + 7 * 3_600_000)
        .toISOString()
        .slice(0, 10);
      // Only retain today's preparation markers. A restart safely recomputes persisted identities.
      for (const key of prepared.keys()) if (!key.startsWith(`${date}:`)) prepared.delete(key);
      const dailyEventIds = new Set<number>();
      const abnormalEventIds = new Set<number>();
      for (const point of points) {
        // An empty result may be followed by a late hourly aggregate in this same clock hour.
        try {
          const ids = await dependencies.prepareAbnormal(point, policy, now);
          ids.forEach((id) => abnormalEventIds.add(id));
        } catch {
          result.errors += 1;
        }
        const key = `${date}:${point.id}:${policy.completenessPolicy}:${policy.exemptDayPolicy}:${policy.abnormalReadings}`;
        if (prepared.has(key)) {
          prepared.get(key)?.forEach((id) => dailyEventIds.add(id));
          continue;
        }
        try {
          const ids = await dependencies.prepareDaily(point, date, policy, now);
          prepared.set(key, ids);
          ids.forEach((id) => dailyEventIds.add(id));
        } catch {
          result.errors += 1;
        }
      }
      for (const cadence of ['HOURLY', 'DAILY'] as const) {
        // Only abnormal alerts bypass the configured exceedance clock-hour round.
        if (
          cadence === 'HOURLY' &&
          abnormalEventIds.size === 0 &&
          !isAlertEmailHourlyRoundDue(now, policy.hourlyDelayMinutes)
        )
          continue;
        const period = cadence === 'HOURLY' ? periods.hourly : periods.daily;
        const startAt =
          cadence === 'HOURLY'
            ? new Date(Date.parse(period.startAt) - 23 * 3_600_000).toISOString()
            : period.startAt;
        const events = await dependencies.source.listEvents({
          cadence,
          startAt,
          endAt:
            cadence === 'HOURLY' && abnormalEventIds.size > 0
              ? new Date(now.getTime() + 1).toISOString()
              : period.endAt,
        });
        const groups = new Map<
          string,
          { recipient: string; events: AlertEventDTO[]; period: AlertEmailPeriod }
        >();
        for (const event of events) {
          const abnormal = event.alertType === 'ABNORMAL_VALUE';
          const daily = ['DAILY_COMPLETENESS_LOW', 'CONSECUTIVE_NO_REPORT'].includes(
            event.alertType,
          );
          if (daily !== (cadence === 'DAILY')) continue;
          if (event.notificationStatus === 'DISMISSED' || (daily && !dailyEventIds.has(event.id)))
            continue;
          if (abnormal && !abnormalEventIds.has(event.id)) continue;
          if (
            !abnormal &&
            cadence === 'HOURLY' &&
            !isAlertEmailHourlyRoundDue(now, policy.hourlyDelayMinutes)
          )
            continue;
          const point = points.find((item) => pointMatchesAlertEmailEvent(item, event));
          if (!point) {
            result.skipped += 1;
            continue;
          }
          let eventPeriod = period;
          if (abnormal) {
            const first = Date.parse(event.firstAbnormalAt ?? '');
            const confirmed = Date.parse(event.confirmedAbnormalAt ?? '');
            const end = Date.parse(event.endedAt ?? '');
            const today = new Date(now.getTime() + 7 * 3_600_000).toISOString().slice(0, 10);
            if (
              event.eventDate !== today ||
              !Number.isFinite(first) ||
              !Number.isFinite(confirmed) ||
              !Number.isFinite(end) ||
              confirmed - first < ABNORMAL_MINIMUM_HOURS * 3_600_000 ||
              confirmed > end ||
              end > now.getTime()
            )
              continue;
            const hour = Math.floor(now.getTime() / 3_600_000) * 3_600_000;
            eventPeriod = {
              startAt: new Date(hour).toISOString(),
              endAt: new Date(hour + 3_600_000).toISOString(),
              scheduledAt: now.toISOString(),
            };
          } else if (cadence === 'HOURLY') {
            const detection = timestampSchema.safeParse(event.detectedAt);
            const detectedAt = detection.success ? Date.parse(detection.data) : NaN;
            const start = event.startedAt ? Date.parse(event.startedAt) : NaN;
            const end = start + 3_600_000;
            const measuredEnd = event.endedAt ? Date.parse(event.endedAt) : NaN;
            if (
              !Number.isFinite(detectedAt) ||
              detectedAt > Date.parse(period.scheduledAt) ||
              !Number.isFinite(start) ||
              !Number.isFinite(measuredEnd) ||
              start < Date.parse(startAt) ||
              measuredEnd >= end ||
              measuredEnd < start ||
              end > Date.parse(period.endAt)
            )
              continue;
            eventPeriod = {
              startAt: new Date(start).toISOString(),
              endAt: new Date(end).toISOString(),
              scheduledAt: period.scheduledAt,
            };
          } else if (
            event.eventDate !== date ||
            (event.endedAt && Date.parse(event.endedAt) > now.getTime())
          )
            continue;
          const recipients = alertEmailPointRecipients(point, policy);
          if (recipients.length === 0) result.skipped += 1;
          for (const recipient of recipients) {
            const systemType =
              event.alertType === 'CONSECUTIVE_NO_REPORT' ? event.systemType : null;
            const key = JSON.stringify([
              recipient,
              event.alertType,
              systemType,
              eventPeriod.startAt,
            ]);
            const group = groups.get(key) ?? { recipient, events: [], period: eventPeriod };
            if (!group.events.some((item) => item.id === event.id)) group.events.push(event);
            groups.set(key, group);
          }
        }
        for (const group of groups.values()) {
          try {
            // Chunking also keeps SQL Server's 2,100 parameter limit below the bound.
            for (let index = 0; index < group.events.length; index += 1000) {
              const chunk = group.events.slice(index, index + 1000).sort((a, b) => a.id - b.id);
              const existing = new Set(
                await dependencies.outbox.listBatchedEventIds(
                  group.recipient,
                  cadence,
                  chunk.map((event) => event.id),
                ),
              );
              const pending = chunk.filter((event) => !existing.has(event.id));
              if (pending.length === 0) continue;
              const first = pending[0];
              const eventIds = pending.map((event) => event.id);
              const identity = JSON.stringify([
                cadence,
                group.recipient,
                first.alertType,
                group.period.startAt,
                eventIds,
              ]);
              const contextByEventId = dependencies.source.loadRenderContext
                ? await dependencies.source.loadRenderContext(pending)
                : undefined;
              const content = dependencies.render({
                events: pending,
                scheduledAt: group.period.scheduledAt,
                ...(contextByEventId ? { contextByEventId } : {}),
              });
              const batch = await dependencies.outbox.enqueue({
                deduplicationKey: `email:v1:${createHash('sha256').update(identity).digest('hex')}`,
                cadence,
                alertType: first.alertType,
                systemType: first.alertType === 'CONSECUTIVE_NO_REPORT' ? first.systemType : null,
                recipient: group.recipient,
                cc: [MANDATORY_EMAIL_CC],
                ...content,
                eventIds,
                scheduledAt: group.period.scheduledAt,
                periodStart: group.period.startAt,
                periodEnd: group.period.endAt,
              });
              if (batch.created) result.queued += 1;
            }
          } catch {
            result.errors += 1;
          }
        }
      }
      return result;
    },
  };
}
