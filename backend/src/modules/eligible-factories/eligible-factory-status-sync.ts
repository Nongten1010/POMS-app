import { randomUUID } from 'node:crypto';
import type { Knex } from 'knex';
import { db } from '../../config/database';
import { env } from '../../config/env';
import { factorySourceDb, factorySourceTableName } from '../../config/factory-source-database';
import { logger } from '../../config/logger';
import { ConflictError, NotFoundError } from '../../shared/errors/AppError';

export const FACTORY_STATUS_LABELS: Record<string, string> = {
  '0': 'ยังไม่แจ้งประกอบ',
  '1': 'แจ้งประกอบแล้ว',
  '2': 'จำหน่ายทะเบียน',
  '3': 'หยุดชั่วคราว',
};
export interface SourceStatus {
  flag: string | null;
  verified_fid?: string | null;
  last_success_at: Date | string | null;
  last_attempt_at?: Date | string | null;
  error_code?: string | null;
  daily_success_key?: string | null;
}
export function isFresh(status: SourceStatus | undefined, now = new Date()): boolean {
  if (!status?.last_success_at) return false;
  const age = now.getTime() - new Date(status.last_success_at).getTime();
  return age >= 0 && age < env.FACTORY_STATUS_MAX_AGE_SECONDS * 1000;
}
export function sourceFlag(rows: Array<{ FID: unknown; FFLAG: unknown }>, fid: string): string {
  const exact = rows.filter((row) => String(row.FID).trim() === fid);
  if (exact.length !== 1) throw new Error(exact.length ? 'SOURCE_AMBIGUOUS' : 'SOURCE_NOT_FOUND');
  const flag = String(exact[0].FFLAG).trim();
  if (!Object.hasOwn(FACTORY_STATUS_LABELS, flag)) throw new Error('SOURCE_STATUS_UNKNOWN');
  return flag;
}
export async function lockEligibleFactory(trx: Knex.Transaction, id: number) {
  const row = await trx('eligible_factories')
    .from(trx.raw('eligible_factories WITH (UPDLOCK, HOLDLOCK)'))
    .where('id', id)
    .whereNull('deleted_at')
    .first();
  if (!row) throw new NotFoundError('Eligible factory not found');
  return row;
}
export async function accessEvent(
  trx: Knex.Transaction,
  grantId: number,
  action: string,
  actor: number | null,
  reason: string | null,
) {
  await trx('eligible_operator_access_events').insert({
    grant_id: grantId,
    action,
    actor_user_id: actor,
    reason,
    occurred_at: trx.raw('SYSUTCDATETIME()'),
  });
}

export const eligibleFactoryStatusSync = {
  async refresh(
    id: number,
    force = false,
    batch?: {
      fid: string;
      rows: Array<{ FID: unknown; FFLAG: unknown }> | null;
      attemptedAt: Date;
      runKey: string;
    },
  ): Promise<SourceStatus | undefined> {
    const state: SourceStatus | undefined = await db('eligible_factory_source_status')
      .where('eligible_factory_id', id)
      .first();
    const factory = await db('eligible_factories').where('id', id).whereNull('deleted_at').first();
    if (!factory) throw new NotFoundError('Eligible factory not found');
    // FID is the canonical new registration. Never fall back to an old display number.
    const fid = String(factory.factory_registration_no_new).trim();
    if (!force && isFresh(state) && !state?.error_code && state?.verified_fid === fid) return state;
    const attemptedAt = batch?.attemptedAt ?? new Date();
    let flag: string | null = null;
    let errorCode: string | null = null;
    try {
      if (batch && (batch.fid !== fid || batch.rows === null))
        throw new Error('SOURCE_UNAVAILABLE');
      const rows = batch
        ? (batch.rows ?? [])
        : await factorySourceDb(factorySourceTableName())
            .where('FID', fid)
            .select('FID', 'FFLAG')
            .limit(2)
            .timeout(10_000);
      flag = sourceFlag(rows, fid);
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      errorCode = ['SOURCE_AMBIGUOUS', 'SOURCE_NOT_FOUND', 'SOURCE_STATUS_UNKNOWN'].includes(
        message,
      )
        ? message
        : 'SOURCE_UNAVAILABLE';
    }
    return db.transaction(async (trx) => {
      const currentFactory = await lockEligibleFactory(trx, id);
      if (String(currentFactory.factory_registration_no_new).trim() !== fid) {
        throw new ConflictError('Factory identity changed; retry status verification');
      }
      const previous: SourceStatus | undefined = await trx('eligible_factory_source_status')
        .where('eligible_factory_id', id)
        .first();
      if (previous?.last_attempt_at && new Date(previous.last_attempt_at) > attemptedAt)
        return previous;
      const next = {
        flag: flag ?? previous?.flag ?? null,
        verified_fid: flag !== null ? fid : (previous?.verified_fid ?? null),
        last_success_at: flag !== null ? attemptedAt : (previous?.last_success_at ?? null),
        last_attempt_at: attemptedAt,
        error_code: errorCode,
        daily_success_key:
          flag !== null && batch ? batch.runKey : (previous?.daily_success_key ?? null),
      };
      if (previous)
        await trx('eligible_factory_source_status').where('eligible_factory_id', id).update(next);
      else await trx('eligible_factory_source_status').insert({ eligible_factory_id: id, ...next });
      if (flag !== null) {
        if (previous?.flag !== flag) {
          await trx('eligible_factory_status_events').insert({
            eligible_factory_id: id,
            before_flag: previous?.flag ?? null,
            after_flag: flag,
            observed_at: attemptedAt,
          });
        }
        if (currentFactory.operation_status !== FACTORY_STATUS_LABELS[flag]) {
          await trx('eligible_factories').where('id', id).update({
            operation_status: FACTORY_STATUS_LABELS[flag],
            updated_at: trx.fn.now(),
          });
        }
      }
      const grants = await trx('user_eligible_factory_access')
        .where('eligible_factory_id', id)
        .whereNull('ended_at')
        .select('id', 'status', 'factory_fid');
      for (const grant of grants) {
        const status =
          grant.factory_fid !== fid || (flag !== null && flag !== '0')
            ? 'expired'
            : flag === '0'
              ? 'active'
              : isFresh(next)
                ? grant.status
                : 'suspended';
        if (status === grant.status) continue;
        await trx('user_eligible_factory_access')
          .where('id', grant.id)
          .update({ status, ended_at: status === 'expired' ? trx.raw('SYSUTCDATETIME()') : null });
        await accessEvent(
          trx,
          Number(grant.id),
          status === 'active' ? 'granted' : status,
          null,
          grant.factory_fid !== fid
            ? 'FACTORY_IDENTITY_CHANGED'
            : flag !== null
              ? `Fac60k: ${FACTORY_STATUS_LABELS[flag]}`
              : errorCode,
        );
      }
      return next;
    });
  },

  async refreshForUser(userId: number): Promise<void> {
    if (!env.ELIGIBLE_OPERATOR_ACCESS_ENABLED) return;
    const rows = await db('user_eligible_factory_access as g')
      .join('eligible_factories as ef', 'ef.id', 'g.eligible_factory_id')
      .where('g.user_id', userId)
      .whereNull('g.ended_at')
      .whereNull('ef.deleted_at')
      .distinct('g.eligible_factory_id');
    for (const row of rows) {
      try {
        await this.refresh(Number(row.eligible_factory_id));
      } catch (error) {
        if (!(error instanceof NotFoundError) && !(error instanceof ConflictError)) throw error;
      }
    }
  },

  async runDaily(now = new Date()): Promise<boolean> {
    if (!env.ELIGIBLE_OPERATOR_ACCESS_ENABLED || !env.FACTORY_STATUS_SYNC_ENABLED) return false;
    const bangkok = new Date(now.getTime() + 7 * 3600_000);
    if (bangkok.getUTCHours() < env.FACTORY_STATUS_SYNC_HOUR) return false;
    const key = bangkok.toISOString().slice(0, 10);
    const token = randomUUID();
    const claimed = await db.transaction(async (trx) => {
      const lock = await trx.raw(`DECLARE @r INT; EXEC @r = sp_getapplock
        @Resource = 'eligible-factory-daily-status', @LockMode = 'Exclusive',
        @LockOwner = 'Transaction', @LockTimeout = 0; SELECT @r AS result;`);
      if (Number(lock[0]?.result ?? -1) < 0) return false;
      const run = await trx('eligible_factory_status_runs').where('run_key', key).first();
      if (run && (run.status === 'complete' || new Date(run.lease_until) > now)) return false;
      const values = {
        run_token: token,
        status: 'running',
        lease_until: new Date(now.getTime() + 300_000),
        finished_at: null,
      };
      if (run) await trx('eligible_factory_status_runs').where('run_key', key).update(values);
      else await trx('eligible_factory_status_runs').insert({ run_key: key, ...values });
      return true;
    });
    if (!claimed) return false;
    let checked = 0;
    let failed = 0;
    let cursor = 0;
    try {
      while (true) {
        const batch = await db('eligible_factories as ef')
          .leftJoin('eligible_factory_source_status as ss', 'ss.eligible_factory_id', 'ef.id')
          .whereNull('ef.deleted_at')
          .where('ef.id', '>', cursor)
          .where((query) =>
            query.whereNull('ss.daily_success_key').orWhere('ss.daily_success_key', '<>', key),
          )
          .orderBy('ef.id')
          .limit(100)
          .select('ef.id', 'ef.factory_registration_no_new');
        if (!batch.length) break;
        const attemptedAt = new Date();
        let sourceRows: Array<{ FID: unknown; FFLAG: unknown }> | null = null;
        try {
          sourceRows = await factorySourceDb(factorySourceTableName())
            .whereIn(
              'FID',
              batch.map((row) => String(row.factory_registration_no_new).trim()),
            )
            .select('FID', 'FFLAG')
            .timeout(10_000);
        } catch {
          /* Each target records SOURCE_UNAVAILABLE without changing confirmed status. */
        }
        for (const row of batch) {
          // Renew on every item; a killed worker can be retried after lease expiry.
          const renewed = await db('eligible_factory_status_runs')
            .where({ run_key: key, run_token: token })
            .update({
              lease_until: new Date(Date.now() + 300_000),
            });
          if (renewed !== 1) throw new Error('Daily status lease was lost');
          try {
            const fid = String(row.factory_registration_no_new).trim();
            const result = await this.refresh(Number(row.id), true, {
              fid,
              rows: sourceRows?.filter((r) => String(r.FID).trim() === fid) ?? null,
              attemptedAt,
              runKey: key,
            });
            if (result?.error_code) failed++;
          } catch {
            failed++;
          }
          checked++;
          cursor = Number(row.id);
        }
      }
    } catch (error) {
      failed++;
      throw error;
    } finally {
      await db('eligible_factory_status_runs')
        .where({ run_key: key, run_token: token })
        .update({
          status: failed ? 'failed' : 'complete',
          checked_count: checked,
          failed_count: failed,
          finished_at: new Date(),
          lease_until: new Date(),
        });
    }
    logger.info('[factory-status-sync] Daily status verification finished', { checked, failed });
    return true;
  },
};

export function startFactoryStatusSyncWorker(): ReturnType<typeof setInterval> {
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      await eligibleFactoryStatusSync.runDaily();
    } catch {
      logger.error('[factory-status-sync] Daily verification failed');
    } finally {
      running = false;
    }
  };
  const timer = setInterval(() => void tick(), 60_000);
  timer.unref();
  void tick();
  return timer;
}
