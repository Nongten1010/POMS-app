import { createHash, randomUUID } from 'node:crypto';
import type { Knex } from 'knex';
import { z } from 'zod';
import { db } from '../../config/database';
import { includeMandatoryEmailCc } from '../../shared/services/email.service';
import { AppError } from '../../shared/errors/AppError';

export type AlertEmailDeliveryStatus =
  | 'QUEUED'
  | 'PROCESSING'
  | 'SMTP_ACCEPTED'
  | 'RETRY_PENDING'
  | 'FAILED'
  | 'UNKNOWN'
  | 'SKIPPED';

export interface AlertEmailBatchInput {
  deduplicationKey: string;
  cadence: 'HOURLY' | 'DAILY';
  alertType: string;
  systemType: string | null;
  scheduledAt: string;
  periodStart: string;
  periodEnd: string;
  recipient: string;
  cc: string[];
  subject: string;
  text: string;
  html: string;
  eventIds: number[];
}

export interface AlertEmailDelivery extends AlertEmailBatchInput {
  id: number;
  batchId: number;
  status: AlertEmailDeliveryStatus;
  attempts: number;
  leaseToken: string | null;
  leasedUntil: string | null;
  nextAttemptAt: string | null;
  messageId: string | null;
  errorCode: string | null;
  acceptedRecipients: string[];
  rejectedRecipients: string[];
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

export interface AlertEmailJob extends AlertEmailDelivery {
  status: 'PROCESSING';
  leaseToken: string;
}

export interface AlertEmailCompletion {
  status: Exclude<AlertEmailDeliveryStatus, 'QUEUED' | 'PROCESSING'>;
  completedAt: string;
  nextAttemptAt: string | null;
  messageId: string | null;
  acceptedRecipients: string[];
  rejectedRecipients: string[];
  errorCode: string | null;
}

export interface AlertEmailDeliveryQuery {
  page: number;
  pageSize: number;
  cadence?: 'HOURLY' | 'DAILY';
  alertType?: string;
  status?: AlertEmailDeliveryStatus;
  recipient?: string;
}

// Omitting access is reserved for the internal worker. API callers must pass their resolved scope.
export interface AlertEmailOutboxAccess {
  allowedEventIds: number[];
}

interface DeliveryRow {
  id: number | string;
  batch_id: number | string;
  deduplication_key: string;
  cadence: 'HOURLY' | 'DAILY';
  alert_type: string;
  system_type: string | null;
  scheduled_at: Date | string;
  period_start: Date | string;
  period_end: Date | string;
  recipient: string;
  cc_json: string;
  subject: string;
  text_body: string;
  html_body: string;
  status: AlertEmailDeliveryStatus;
  attempts: number;
  lease_token: string | null;
  leased_until: Date | string | null;
  next_attempt_at: Date | string | null;
  message_id: string | null;
  error_code: string | null;
  accepted_recipients_json: string | null;
  rejected_recipients_json: string | null;
  created_at: Date | string;
  updated_at: Date | string;
  completed_at: Date | string | null;
}

const explicitTime = z
  .string()
  .regex(/T.*(?:Z|[+-]\d{2}:\d{2})$/)
  .refine((value) => Number.isFinite(Date.parse(value)));
const address = z.string().trim().toLowerCase().email().max(255);
const batchSchema = z
  .object({
    deduplicationKey: z.string().min(1).max(220),
    cadence: z.enum(['HOURLY', 'DAILY']),
    alertType: z.string().min(1).max(64),
    systemType: z.string().min(1).max(16).nullable(),
    scheduledAt: explicitTime,
    periodStart: explicitTime,
    periodEnd: explicitTime,
    recipient: address,
    cc: z.array(address).max(50),
    subject: z
      .string()
      .min(1)
      .max(500)
      .regex(/^[^\r\n]*$/),
    text: z.string().min(1),
    html: z.string().min(1),
    eventIds: z.array(z.number().int().positive().safe()).min(1).max(2000),
  })
  .refine((value) => Date.parse(value.periodEnd) > Date.parse(value.periodStart), {
    message: 'Invalid observation period',
  });

export function createAlertEmailOutboxRepository(connection: Knex) {
  function deliveryQuery(access?: AlertEmailOutboxAccess) {
    const builder = connection('alert_email_deliveries as d')
      .join('alert_email_batches as b', 'b.id', 'd.batch_id')
      .select(
        'd.*',
        'b.deduplication_key',
        'b.cadence',
        'b.alert_type',
        'b.system_type',
        'b.scheduled_at',
        'b.period_start',
        'b.period_end',
        'b.recipient',
        'b.cc_json',
        'b.subject',
        'b.text_body',
        'b.html_body',
      );
    if (access) {
      const eventIds = [...new Set(access.allowedEventIds)];
      if (eventIds.length === 0) return builder.whereRaw('1 = 0');
      builder
        .whereExists(function hasEvents() {
          this.select(connection.raw('1'))
            .from('alert_email_batch_events as ae')
            .whereRaw('?? = ??', ['ae.batch_id', 'd.batch_id']);
        })
        .whereNotExists(function noUnauthorizedEvent() {
          this.select(connection.raw('1'))
            .from('alert_email_batch_events as ae')
            .whereRaw('?? = ??', ['ae.batch_id', 'd.batch_id'])
            .whereNotIn('ae.alert_event_id', eventIds);
        });
    }
    return builder;
  }

  async function eventIdsForBatch(batchId: number): Promise<number[]> {
    const rows = await connection('alert_email_batch_events')
      .where({ batch_id: batchId })
      .orderBy('alert_event_id', 'asc')
      .select('alert_event_id');
    return rows.map((row: { alert_event_id: number | string }) => Number(row.alert_event_id));
  }

  const repository = {
    async enqueue(
      input: AlertEmailBatchInput,
    ): Promise<{ batchId: number; deliveryId: number; created: boolean }> {
      const parsed = batchSchema.parse(input);
      parsed.cc = [
        ...new Set(includeMandatoryEmailCc(parsed.cc).map((value) => value.trim().toLowerCase())),
      ];
      const eventIds = [...new Set(parsed.eventIds)];
      try {
        return await connection.transaction(async (trx) => {
          const inserted = await trx('alert_email_batches')
            .insert({
              deduplication_key: parsed.deduplicationKey,
              cadence: parsed.cadence,
              alert_type: parsed.alertType,
              system_type: parsed.systemType,
              scheduled_at: new Date(parsed.scheduledAt),
              period_start: new Date(parsed.periodStart),
              period_end: new Date(parsed.periodEnd),
              recipient: parsed.recipient,
              cc_json: JSON.stringify(parsed.cc),
              subject: parsed.subject,
              text_body: parsed.text,
              html_body: parsed.html,
            })
            .returning('id');
          const batchId = insertedId(inserted);
          const recipientKey = recipientEventKey(parsed.recipient, parsed.cadence);
          // Three bindings per row; SQL Server allows at most 2,100 per statement.
          for (let offset = 0; offset < eventIds.length; offset += 500) {
            await trx('alert_email_batch_events').insert(
              eventIds.slice(offset, offset + 500).map((id) => ({
                batch_id: batchId,
                alert_event_id: id,
                recipient_key: recipientKey,
              })),
            );
          }
          const deliveries = await trx('alert_email_deliveries')
            .insert({
              batch_id: batchId,
              status: 'QUEUED',
              attempts: 0,
              next_attempt_at: new Date(parsed.scheduledAt),
            })
            .returning('id');
          return { batchId, deliveryId: insertedId(deliveries), created: true };
        });
      } catch (error) {
        if (!isUniqueViolation(error)) throw error;
        const existing = await deliveryQuery()
          .where('b.deduplication_key', parsed.deduplicationKey)
          .first('d.id', 'd.batch_id');
        if (!existing)
          throw new AppError(
            'Events are already queued for this recipient; reload the event mapping before retrying',
            409,
            'ALERT_EMAIL_EVENT_ALREADY_BATCHED',
          );
        return {
          batchId: Number(existing.batch_id),
          deliveryId: Number(existing.id),
          created: false,
        };
      }
    },

    async listBatchedEventIds(
      recipient: string,
      cadence: 'HOURLY' | 'DAILY',
      eventIds: number[],
    ): Promise<number[]> {
      if (eventIds.length === 0) return [];
      const validated = z.array(z.number().int().positive().safe()).max(2000).parse(eventIds);
      const rows = await connection('alert_email_batch_events')
        .where('recipient_key', recipientEventKey(address.parse(recipient), cadence))
        .whereIn('alert_event_id', [...new Set(validated)])
        .select('alert_event_id');
      return rows.map((row: { alert_event_id: number | string }) => Number(row.alert_event_id));
    },

    async expireLeases(now: Date): Promise<number> {
      return connection('alert_email_deliveries')
        .where({ status: 'PROCESSING' })
        .where('leased_until', '<=', now)
        .update({
          status: 'UNKNOWN',
          error_code: 'LEASE_EXPIRED',
          lease_token: null,
          leased_until: null,
          next_attempt_at: null,
          completed_at: now,
          updated_at: now,
        });
    },

    async claim(now: Date, leaseSeconds = 120): Promise<AlertEmailJob | null> {
      assertLeaseDuration(leaseSeconds);
      await repository.expireLeases(now);
      const candidate = await connection('alert_email_deliveries')
        .whereIn('status', ['QUEUED', 'RETRY_PENDING'])
        .where('attempts', '<', 5)
        .where('next_attempt_at', '<=', now)
        .orderBy('next_attempt_at', 'asc')
        .orderBy('id', 'asc')
        .first('id', 'status');
      if (!candidate) return null;
      const leaseToken = randomUUID();
      // This comparison-and-update is atomic. A worker that loses the race must not send.
      const claimed = await connection('alert_email_deliveries')
        .where({ id: candidate.id, status: candidate.status })
        .where('attempts', '<', 5)
        .where('next_attempt_at', '<=', now)
        .update({
          status: 'PROCESSING',
          lease_token: leaseToken,
          leased_until: new Date(now.getTime() + leaseSeconds * 1000),
          attempts: connection.raw('[attempts] + 1'),
          updated_at: now,
        });
      if (claimed !== 1) return null;
      const delivery = await repository.findDelivery(Number(candidate.id));
      if (!delivery || delivery.status !== 'PROCESSING' || delivery.leaseToken !== leaseToken)
        return null;
      return delivery as AlertEmailJob;
    },

    async renewLease(
      id: number,
      leaseToken: string,
      now: Date,
      leaseSeconds = 120,
    ): Promise<boolean> {
      assertLeaseDuration(leaseSeconds);
      const updated = await connection('alert_email_deliveries')
        .where({ id, status: 'PROCESSING', lease_token: leaseToken })
        .where('leased_until', '>', now)
        .update({
          leased_until: new Date(now.getTime() + leaseSeconds * 1000),
          updated_at: now,
        });
      return updated === 1;
    },

    async complete(
      id: number,
      leaseToken: string,
      outcome: AlertEmailCompletion,
    ): Promise<boolean> {
      const completedAt = new Date(outcome.completedAt);
      if (!Number.isFinite(completedAt.getTime())) throw new Error('Invalid completion time');
      const updated = await connection('alert_email_deliveries')
        .where({ id, status: 'PROCESSING', lease_token: leaseToken })
        .where('leased_until', '>', completedAt)
        .update({
          status: outcome.status,
          next_attempt_at: outcome.nextAttemptAt ? new Date(outcome.nextAttemptAt) : null,
          message_id: outcome.messageId,
          accepted_recipients_json: JSON.stringify(outcome.acceptedRecipients),
          rejected_recipients_json: JSON.stringify(outcome.rejectedRecipients),
          error_code: outcome.errorCode,
          completed_at: outcome.status === 'RETRY_PENDING' ? null : completedAt,
          lease_token: null,
          leased_until: null,
          updated_at: completedAt,
        });
      return updated === 1;
    },

    async findDelivery(
      id: number,
      access?: AlertEmailOutboxAccess,
    ): Promise<AlertEmailDelivery | null> {
      const row: DeliveryRow | undefined = await deliveryQuery(access).where('d.id', id).first();
      return row ? toDelivery(row, await eventIdsForBatch(Number(row.batch_id))) : null;
    },

    async listDeliveries(
      query: AlertEmailDeliveryQuery,
      access?: AlertEmailOutboxAccess,
    ): Promise<AlertEmailDelivery[]> {
      if (
        !Number.isInteger(query.page) ||
        query.page < 1 ||
        !Number.isInteger(query.pageSize) ||
        query.pageSize < 1 ||
        query.pageSize > 100
      ) {
        throw new Error('Invalid delivery pagination');
      }
      const builder = deliveryQuery(access);
      if (query.cadence) builder.where('b.cadence', query.cadence);
      if (query.alertType) builder.where('b.alert_type', query.alertType);
      if (query.status) builder.where('d.status', query.status);
      if (query.recipient) builder.where('b.recipient', query.recipient.trim().toLowerCase());
      const rows: DeliveryRow[] = await builder
        .orderBy('d.id', 'desc')
        .limit(query.pageSize)
        .offset((query.page - 1) * query.pageSize);
      return Promise.all(
        rows.map(async (row) => toDelivery(row, await eventIdsForBatch(Number(row.batch_id)))),
      );
    },
  };
  return repository;
}

export const alertEmailOutboxRepository = createAlertEmailOutboxRepository(db);
export type AlertEmailOutboxRepository = ReturnType<typeof createAlertEmailOutboxRepository>;

function insertedId(rows: unknown): number {
  const first = Array.isArray(rows) ? rows[0] : rows;
  const value = first && typeof first === 'object' ? (first as { id: unknown }).id : first;
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id < 1) throw new Error('Outbox insert did not return an ID');
  return id;
}

function recipientEventKey(recipient: string, cadence: 'HOURLY' | 'DAILY'): string {
  return createHash('sha256').update(`${cadence}:${recipient.trim().toLowerCase()}`).digest('hex');
}

function isUniqueViolation(error: unknown, depth = 0): boolean {
  if (!error || typeof error !== 'object' || depth > 3) return false;
  const record = error as Record<string, unknown>;
  return (
    record.number === 2601 ||
    record.number === 2627 ||
    ['originalError', 'info', 'cause'].some((key) => isUniqueViolation(record[key], depth + 1))
  );
}

function assertLeaseDuration(seconds: number): void {
  if (!Number.isInteger(seconds) || seconds < 30 || seconds > 3600)
    throw new Error('Invalid lease duration');
}

function utcIso(value: Date | string | null | undefined): string | null {
  if (value == null) return null;
  if (value instanceof Date) return value.toISOString();
  const normalized = /(?:Z|[+-]\d{2}:\d{2})$/.test(value) ? value : `${value.replace(' ', 'T')}Z`;
  return new Date(normalized).toISOString();
}

function addresses(json: string | null | undefined): string[] {
  if (!json) return [];
  const parsed: unknown = JSON.parse(json);
  return z.array(address).parse(parsed);
}

function toDelivery(row: DeliveryRow, eventIds: number[]): AlertEmailDelivery {
  return {
    id: Number(row.id),
    batchId: Number(row.batch_id),
    deduplicationKey: row.deduplication_key,
    cadence: row.cadence,
    alertType: row.alert_type,
    systemType: row.system_type,
    scheduledAt: utcIso(row.scheduled_at) as string,
    periodStart: utcIso(row.period_start) as string,
    periodEnd: utcIso(row.period_end) as string,
    recipient: row.recipient,
    cc: addresses(row.cc_json),
    subject: row.subject,
    text: row.text_body,
    html: row.html_body,
    eventIds,
    status: row.status,
    attempts: Number(row.attempts),
    leaseToken: row.lease_token,
    leasedUntil: utcIso(row.leased_until),
    nextAttemptAt: utcIso(row.next_attempt_at),
    messageId: row.message_id,
    errorCode: row.error_code,
    acceptedRecipients: addresses(row.accepted_recipients_json),
    rejectedRecipients: addresses(row.rejected_recipients_json),
    createdAt: utcIso(row.created_at) as string,
    updatedAt: utcIso(row.updated_at) as string,
    completedAt: utcIso(row.completed_at),
  };
}
