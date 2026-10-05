import nodemailer from 'nodemailer';
import { z } from 'zod';
import { db } from '../../config/database';
import { logger } from '../../config/logger';
import { buildSmtpTransportOptions, getDefaultMailFrom } from '../../config/smtp';
import { toAlertEventDTO } from '../alert-events/alert-events.repository';
import type { AlertEventDTO, AlertEventRow } from '../alert-events/alert-events.types';
import { deviceConnectionsService } from '../device-connections/device-connections.service';
import type { DeviceConnectionConfigDTO } from '../device-connections/device-connections.types';
import { buildDailyAlertCandidates } from './alert-email-daily-detector';
import { alertEmailDailyRepository } from './alert-email-daily.repository';
import { dispatchNextAlertEmail } from './alert-email-dispatch';
import { createAlertEmailEngine } from './alert-email-engine';
import { isAlertEmailJobEligible } from './alert-email-eligibility';
import { loadAlertEmailParameters } from './alert-email-measurements';
import { alertEmailOutboxRepository } from './alert-email-outbox.repository';
import type { AlertEmailJob } from './alert-email-outbox.repository';
import { readAlertEmailPolicy } from './alert-email-policy';
import type { ActiveAlertEmailPolicy } from './alert-email-policy';
import { alertEmailSourceRepository } from './alert-email-source.repository';
import { renderAlertEmail } from './alert-email-template';
import { createAlertEmailWorker } from './alert-email.worker';

const timestampSchema = z.iso.datetime({ offset: true });

export function startAlertEmailWorker(
  settings: NodeJS.ProcessEnv = process.env,
): ReturnType<typeof createAlertEmailWorker> {
  const policy = readAlertEmailPolicy(settings);
  if (!policy.enabled) {
    return createAlertEmailWorker(policy, {
      prepare: async () => undefined,
      dispatch: async () => ({ claimed: false }),
      reportError: () => undefined,
    });
  }

  let options: ReturnType<typeof buildSmtpTransportOptions>;
  let from: string | undefined;
  try {
    options = buildSmtpTransportOptions();
    from = getDefaultMailFrom();
  } catch {
    throw new Error('Alert email SMTP is not configured');
  }
  if (!options || !from) throw new Error('Alert email SMTP is not configured');
  const transporter = nodemailer.createTransport({
    ...options,
    connectionTimeout: 30_000,
    greetingTimeout: 15_000,
    socketTimeout: 60_000,
  });
  const engine = createAlertEmailEngine({
    source: alertEmailSourceRepository,
    outbox: alertEmailOutboxRepository,
    render: renderAlertEmail,
    async prepareDaily(point, date, activePolicy, now) {
      const parameters = await loadAlertEmailParameters(point, date, activePolicy);
      const candidates = buildDailyAlertCandidates({
        point,
        parameters,
        date,
        detectedAt: now.toISOString(),
        completenessPolicy: activePolicy.completenessPolicy,
        exemptDayPolicy: activePolicy.exemptDayPolicy,
        abnormalReadings: activePolicy.abnormalReadings,
      });
      const eventIds: number[] = [];
      for (const candidate of candidates) {
        const event = await alertEmailDailyRepository.create(candidate);
        eventIds.push(event.id);
      }
      return eventIds;
    },
  });
  const worker = createAlertEmailWorker(policy, {
    async prepare(now, activePolicy) {
      const result = await engine.run(now, activePolicy);
      if (result.errors > 0)
        logger.warn('[alert-email] PREPARATION_FAILED', { count: result.errors });
      return result;
    },
    async dispatch() {
      const result = await dispatchNextAlertEmail({
        repository: alertEmailOutboxRepository,
        transport: {
          async send(input) {
            const info = await transporter.sendMail({
              from,
              ...input,
              encoding: 'utf-8',
              textEncoding: 'base64',
            });
            return {
              messageId: info.messageId,
              accepted: mailAddresses(info.accepted),
              rejected: mailAddresses(info.rejected),
            };
          },
        },
        isRecipientEligible: (job) => checkCurrentEligibility(job, policy),
      });
      if (result.status === 'UNKNOWN' || result.status === 'FAILED') {
        logger.warn(`[alert-email] ${result.status}`, { deliveryId: result.deliveryId });
      }
      return result;
    },
    reportError(code) {
      logger.warn(`[alert-email] ${code}`);
    },
  });
  void worker.runOnce();
  return {
    runOnce: worker.runOnce,
    async stop() {
      await worker.stop();
      transporter.close();
    },
  };
}

async function checkCurrentEligibility(
  job: AlertEmailJob,
  policy: ActiveAlertEmailPolicy,
): Promise<boolean> {
  const rows: AlertEventRow[] = [];
  const ids = [...new Set(job.eventIds)];
  for (let offset = 0; offset < ids.length; offset += 1000) {
    const chunk = await db<AlertEventRow>('alert_events')
      .whereIn('id', ids.slice(offset, offset + 1000))
      .whereNull('deleted_at')
      .select('*');
    rows.push(...chunk);
  }
  const events = rows.map((row) => ({
    event: toAlertEventDTO(row),
    evidence: parseEvidence(row.evidence_json),
  }));
  const points = await alertEmailSourceRepository.listPoints();
  const stationConfigurations = new Map<string, Promise<DeviceConnectionConfigDTO[]>>();
  return isAlertEmailJobEligible(job, policy, {
    events,
    points,
    async hasActiveParameter(event: AlertEventDTO) {
      if (!event.unit?.trim()) return false;
      // Hourly legacy DATETIME2 offsets can be lost; this UTC period was reconstructed
      // from the original validated Bangkok payload when the batch was enqueued.
      const startAt = job.cadence === 'HOURLY' ? job.periodStart : event.startedAt;
      if (!startAt || !timestampSchema.safeParse(startAt).success) return false;
      let configurations = stationConfigurations.get(event.stationId);
      if (!configurations) {
        configurations = deviceConnectionsService.listActiveSettingsForIntegration({
          stationId: event.stationId,
        });
        stationConfigurations.set(event.stationId, configurations);
      }
      const candidates = await configurations;
      return candidates.some((config) => {
        if (
          !timestampSchema.safeParse(config.updatedAt).success ||
          Date.parse(config.updatedAt) > Date.parse(startAt)
        )
          return false;
        return config.channels.some((channel) => {
          if (channel.testMode) return false;
          const parameter = parseRegisteredParameter(channel.dataType);
          return (
            parameter !== null &&
            parameter.code === canonicalCode(event.parameterCode) &&
            parameter.unit === normalizedUnit(event.unit ?? '')
          );
        });
      });
    },
  });
}

function parseRegisteredParameter(value: string): { code: string; unit: string } | null {
  const normalized = value.normalize('NFKC').trim();
  const match = /^(.*?)\s*\(([^()]+)\)\s*$/.exec(normalized);
  if (!match) return null;
  const code = canonicalCode(match[1]);
  const unit = normalizedUnit(match[2]);
  return code && unit ? { code, unit } : null;
}

function canonicalCode(value: string): string {
  return value
    .normalize('NFKC')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '');
}

function normalizedUnit(value: string): string {
  return value.normalize('NFKC').trim().toLowerCase().replace(/\s+/g, ' ');
}

function parseEvidence(value: string | null): Record<string, unknown> | null {
  if (!value) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    return parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function mailAddresses(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item: unknown) => {
    if (typeof item === 'string') return [item];
    if (item && typeof item === 'object' && 'address' in item && typeof item.address === 'string')
      return [item.address];
    return [];
  });
}
