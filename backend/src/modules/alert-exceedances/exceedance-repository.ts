import type { Knex } from 'knex';
import { randomUUID } from 'node:crypto';
import {
  buildAlertEventIdempotencyKey,
  buildLegacyAlertEventIdempotencyKey,
  normalizeAlertEventUnit,
} from '../alert-events/alert-event-identity';
import { toAlertEventInsertPayload } from '../alert-events/alert-event-persistence';
import type { AlertEventRow } from '../alert-events/alert-events.types';
import { resolveMeasurementParameterFamilies } from '../parameter-values/measurement-parameter-columns';
import {
  buildExceedanceSnapshot,
  type ExceedanceActivationRow,
  type ExceedanceChannelRow,
  type ExceedancePointRow,
  type ExceedanceSnapshot,
} from './exceedance-metadata';
import {
  ceilHour,
  HOUR_MS,
  isSourceHour,
  sourceHourLabel,
  type ExceedanceEvaluation,
} from './exceedance-detector';
import type { ActiveExceedancePolicy } from './exceedance-policy';

const LEASE_KEY = 'hourly-exceedance';
const LEASE_SECONDS = 90;
const POINTS = 'alert_exceedance_points';
const HOURS = 'alert_exceedance_hours';
const LEASE = 'alert_exceedance_lease';

export interface ExceedanceLease {
  owner: string;
  fence: number;
  scanAfter: number;
}
export interface ExceedanceState {
  nextHour: Date;
  validFrom: Date;
  backlogFull?: boolean;
}
export interface ExceedanceCommit {
  created: number;
  duplicate: number;
  issues: string[];
}
interface StateRow {
  next_hour: Date;
  valid_from: Date;
  fingerprint: string;
}

export function buildExceedanceSourceQuery(
  source: Knex,
  schema: string,
  stationId: string,
  hour: Date,
  hourLabel: 'START' | 'END',
  columns: string[],
) {
  const label = sourceHourLabel(hour, hourLabel);
  return source
    .withSchema(schema)
    .from(`${stationId}_data_60m`)
    .select(columns)
    .where('cdate', label.date)
    .where('ctime', '>=', label.time)
    .where('ctime', '<', label.time.slice(0, 3) + '01')
    .limit(101);
}

/** Two independent pools: read-only source queries and small POMS transactions. */
export function createExceedanceRepository(
  db: Knex,
  source: Knex,
  schema: string,
  policy: ActiveExceedancePolicy,
) {
  const key = (point: ExceedanceSnapshot) => ({
    mode: policy.mode,
    system_type: point.systemType,
    station_id: point.stationId,
  });
  async function assertLease(trx: Knex.Transaction, lease: ExceedanceLease) {
    const row = await trx(LEASE)
      .where({ lease_key: LEASE_KEY, owner: lease.owner, fence: lease.fence })
      .whereRaw('expires_at > SYSUTCDATETIME()')
      .forUpdate()
      .first('lease_key');
    if (!row) throw new Error('EXCEEDANCE_LEASE_LOST');
  }
  async function loadRows(
    executor: Knex | Knex.Transaction,
    ids: number[] | null,
    after: number,
    lock = false,
  ) {
    const query = executor<ExceedancePointRow>('cems_wpms_connected_measurement_points as cp')
      .whereNull('cp.deleted_at')
      .whereNotNull('cp.connected_at')
      .whereIn('cp.system_type', ['CEMS', 'WPMS'])
      .whereIn('cp.point_code', policy.stations)
      .whereNotExists(function canceledOrigin() {
        this.select(executor.raw('1'))
          .from('cems_wpms_connection_requests as r')
          .whereRaw('?? = ??', ['r.id', 'cp.source_request_id'])
          .where((builder) => builder.where('r.status', 'CANCELED').orWhereNotNull('r.deleted_at'));
      })
      .orderBy('cp.id')
      .limit(policy.batchSize);
    if (ids) query.whereIn('cp.id', ids);
    else query.where('cp.id', '>', after);
    if (lock) query.forUpdate();
    const rows = await query.select(
      'cp.id',
      'cp.point_code',
      'cp.point_name',
      'cp.system_type',
      'cp.point_type',
      'cp.connected_at',
      'cp.updated_at',
      'cp.instruments_json',
      'cp.factory_id',
      'cp.factory_name',
      'cp.factory_registration_no',
    );
    if (rows.length === 0) return { rows, channels: [], activations: [] };
    const configs = executor('device_connection_configs as dc')
      .join('device_measurement_channels as ch', 'ch.config_id', 'dc.id')
      .whereIn(
        'dc.station_id',
        rows.map((row) => row.point_code),
      )
      .whereNull('dc.request_id')
      .whereNull('dc.deleted_at')
      .whereNull('ch.deleted_at')
      .orderBy('dc.id')
      .orderBy('ch.id')
      .limit(5001);
    if (lock) configs.forUpdate();
    const channels = await configs.select<ExceedanceChannelRow[]>('dc.station_id', 'ch.data_type', {
      config_updated_at: 'dc.updated_at',
    });
    const activationQuery = executor<ExceedanceActivationRow>('alert_parameter_activations')
      .whereIn(
        'connected_point_id',
        rows.map((row) => row.id),
      )
      .whereNull('deactivated_at')
      .orderBy('id')
      .limit(5001);
    if (lock) activationQuery.forUpdate();
    const activations = await activationQuery.select(
      'connected_point_id',
      'parameter_code',
      'unit',
      'activated_at',
    );
    if (channels.length > 5000 || activations.length > 5000)
      throw new Error('EXCEEDANCE_METADATA_LIMIT');
    return { rows, channels, activations };
  }
  return {
    async acquire(): Promise<ExceedanceLease | null> {
      const owner = randomUUID();
      // A duplicate is possible only during the very first concurrent startup.
      if (!(await db(LEASE).where('lease_key', LEASE_KEY).first('lease_key'))) {
        try {
          await db(LEASE).insert({
            lease_key: LEASE_KEY,
            owner: null,
            fence: 0,
            expires_at: new Date(0),
            scan_after_id: 0,
          });
        } catch (error) {
          if (!isRetryableWrite(error, false)) throw error;
        }
      }
      const rows = await db(LEASE)
        .where('lease_key', LEASE_KEY)
        .whereRaw('expires_at <= SYSUTCDATETIME()')
        .update({
          owner,
          fence: db.raw('fence + 1'),
          expires_at: db.raw('DATEADD(second, ?, SYSUTCDATETIME())', [LEASE_SECONDS]),
        })
        .returning(['fence', 'scan_after_id']);
      return rows.length
        ? { owner, fence: Number(rows[0].fence), scanAfter: Number(rows[0].scan_after_id) }
        : null;
    },
    async renew(lease: ExceedanceLease): Promise<boolean> {
      const changed = await db(LEASE)
        .where({ lease_key: LEASE_KEY, owner: lease.owner, fence: lease.fence })
        .whereRaw('expires_at > SYSUTCDATETIME()')
        .update({ expires_at: db.raw('DATEADD(second, ?, SYSUTCDATETIME())', [LEASE_SECONDS]) });
      return changed === 1;
    },
    async release(lease: ExceedanceLease, scanAfter: number): Promise<void> {
      await db(LEASE)
        .where({ lease_key: LEASE_KEY, owner: lease.owner, fence: lease.fence })
        .update({ owner: null, expires_at: db.raw('SYSUTCDATETIME()'), scan_after_id: scanAfter });
    },
    async listPoints(after: number) {
      const batch = await loadRows(db, null, after);
      const points: ExceedanceSnapshot[] = [];
      let invalid = 0;
      for (const row of batch.rows) {
        try {
          points.push(buildExceedanceSnapshot(row, batch.channels, batch.activations));
        } catch {
          invalid += 1;
        }
      }
      return { points, invalid, lastId: Number(batch.rows.at(-1)?.id ?? 0) };
    },
    async state(
      lease: ExceedanceLease,
      point: ExceedanceSnapshot,
      now: Date,
    ): Promise<ExceedanceState> {
      return db.transaction(async (trx) => {
        await assertLease(trx, lease);
        const existing = await trx<StateRow>(POINTS).where(key(point)).forUpdate().first();
        const outstanding = await trx(HOURS)
          .where(key(point))
          .whereNot('status', 'COMPLETE')
          .limit(48)
          .select('hour_at');
        const backlogFull = outstanding.length >= 48;
        if (existing?.fingerprint === point.fingerprint) {
          return {
            nextHour: new Date(existing.next_hour),
            validFrom: new Date(existing.valid_from),
            backlogFull,
          };
        }
        // A current config is proven only from its first observation; never apply it to older hours.
        const validFrom = ceilHour(
          new Date(
            Math.max(
              now.getTime(),
              policy.cutover.getTime(),
              new Date(point.row.connected_at).getTime(),
            ),
          ),
        );
        const value = {
          fingerprint: point.fingerprint,
          valid_from: validFrom,
          next_hour: validFrom,
        };
        if (existing) await trx(POINTS).where(key(point)).update(value);
        else await trx(POINTS).insert({ ...key(point), ...value });
        return { nextHour: validFrom, validFrom, backlogFull };
      });
    },
    async retryHour(point: ExceedanceSnapshot, now: Date): Promise<Date | null> {
      const row = await db(HOURS)
        .where(key(point))
        .where('next_retry_at', '<=', now)
        .where((builder) =>
          builder
            .whereNot('status', 'COMPLETE')
            .orWhere('hour_at', '>=', new Date(now.getTime() - policy.recheckHours * HOUR_MS)),
        )
        .orderBy('hour_at', 'desc')
        .first('hour_at');
      return row ? new Date(row.hour_at) : null;
    },
    async readRows(point: ExceedanceSnapshot, hour: Date): Promise<Record<string, unknown>[]> {
      const table = `${point.stationId}_data_60m`;
      const info = await source('sys.columns as c')
        .join('sys.tables as t', 't.object_id', 'c.object_id')
        .join('sys.schemas as s', 's.schema_id', 't.schema_id')
        .where('s.name', schema)
        .where('t.name', table)
        .select<{ name: string }[]>('c.name')
        .limit(1025);
      if (info.length === 0 || info.length > 1024) throw new Error('EXCEEDANCE_SOURCE_SCHEMA');
      const names = info.map((column) => column.name);
      if (!names.includes('cdate') || !names.includes('ctime'))
        throw new Error('EXCEEDANCE_SOURCE_SCHEMA');
      const columns = new Set(['cdate', 'ctime']);
      for (const parameter of point.parameters) {
        if (parameter.standardEnabled === false && parameter.eiaEnabled === false) continue;
        for (const family of resolveMeasurementParameterFamilies(names, parameter.label)) {
          for (const column of [family.valueColumn, family.unitsColumn, family.statusColumn])
            if (column) columns.add(column);
        }
      }
      const rows: Record<string, unknown>[] = await buildExceedanceSourceQuery(
        source,
        schema,
        point.stationId,
        hour,
        policy.hourLabel,
        [...columns],
      );
      const expected = sourceHourLabel(hour, policy.hourLabel);
      if (rows.length > 100 || rows.some((row) => !isSourceHour(row, expected)))
        throw new Error('EXCEEDANCE_SOURCE_AMBIGUOUS');
      return rows;
    },
    async commit(
      lease: ExceedanceLease,
      point: ExceedanceSnapshot,
      hour: Date,
      evaluation: ExceedanceEvaluation,
      now: Date,
    ): Promise<ExceedanceCommit> {
      const persist = () =>
        db.transaction(
          async (trx) => {
            await assertLease(trx, lease);
            const metadata = await loadRows(trx, [point.id], 0, true);
            const row = metadata.rows[0];
            if (
              !row ||
              buildExceedanceSnapshot(row, metadata.channels, metadata.activations).fingerprint !==
                point.fingerprint
            ) {
              throw new Error('EXCEEDANCE_CONFIG_CHANGED');
            }
            const state = await trx<StateRow>(POINTS).where(key(point)).forUpdate().first();
            if (!state) throw new Error('EXCEEDANCE_STATE_MISSING');
            const jobKey = { ...key(point), hour_at: hour };
            const old = await trx(HOURS).where(jobKey).first('attempts', 'summary_json');
            const previous = old
              ? (JSON.parse(old.summary_json) as {
                  eventIds?: number[];
                  sourceFingerprint?: string;
                  finalized?: boolean;
                })
              : {};
            const issues = [...evaluation.issues];
            const anchored = previous.finalized === true || (previous.eventIds?.length ?? 0) > 0;
            const revised =
              anchored &&
              previous.sourceFingerprint &&
              evaluation.sourceFingerprint &&
              previous.sourceFingerprint !== evaluation.sourceFingerprint;
            if (revised) issues.push('SOURCE_REVISED');
            let created = 0;
            let duplicate = 0;
            const eventIds: number[] = [...(previous.eventIds ?? [])];
            if (policy.mode === 'active' && evaluation.events.length > 0 && !revised) {
              if (hour < new Date(state.valid_from)) throw new Error('EXCEEDANCE_CONFIG_HISTORY');
              if (evaluation.events.length > 200) throw new Error('EXCEEDANCE_EVENT_LIMIT');
              const identities = evaluation.events.flatMap((event) => [
                event.idempotencyKey,
                buildLegacyAlertEventIdempotencyKey(event),
              ]);
              const stored = await trx<AlertEventRow>('alert_events')
                .whereNull('deleted_at')
                .whereIn('idempotency_key', identities)
                .select('id', 'idempotency_key', 'unit', 'measured_value', 'threshold_value');
              const byKey = new Map(stored.map((event) => [event.idempotency_key, event]));
              const pending = [];
              for (const event of evaluation.events) {
                if (
                  event.stationId !== point.stationId ||
                  event.systemType !== point.systemType ||
                  event.idempotencyKey !== buildAlertEventIdempotencyKey(event)
                )
                  throw new Error('EXCEEDANCE_EVENT_SCOPE');
                const legacy = buildLegacyAlertEventIdempotencyKey(event);
                const candidate = byKey.get(event.idempotencyKey) ?? byKey.get(legacy);
                const existing =
                  candidate?.unit &&
                  normalizeAlertEventUnit(candidate.unit) === normalizeAlertEventUnit(event.unit)
                    ? candidate
                    : null;
                if (existing) {
                  duplicate += 1;
                  if (!eventIds.includes(Number(existing.id))) eventIds.push(Number(existing.id));
                  if (
                    Number(existing.measured_value) !== Number(event.measuredValue.toFixed(6)) ||
                    Number(existing.threshold_value) !== Number(event.thresholdValue.toFixed(6))
                  )
                    issues.push('PRODUCER_DISCREPANCY');
                  continue;
                }
                pending.push({
                  ...toAlertEventInsertPayload({
                    ...event,
                    connectedMeasurementPointId: point.id,
                    factoryId: row.factory_id,
                    factoryName: row.factory_name,
                    factoryRegistrationNo: row.factory_registration_no,
                    pointName: row.point_name,
                    pointType:
                      row.point_type === 'STACK' || row.point_type === 'WASTEWATER'
                        ? row.point_type
                        : 'OTHER',
                  }),
                  started_at: new Date(event.startedAt),
                  ended_at: new Date(event.endedAt),
                  source_table: `${point.stationId}_data_60m`,
                  evidence_json: JSON.stringify({
                    producer: 'POMS_HOURLY_DETECTOR',
                    configFingerprint: point.fingerprint,
                    sourceHourLabel: policy.hourLabel,
                    measuredAt: hour.toISOString(),
                  }),
                });
              }
              // 40 rows stay comfortably below SQL Server's 2,100 bound-parameter limit.
              for (let index = 0; index < pending.length; index += 40) {
                const inserted = await trx('alert_events')
                  .insert(pending.slice(index, index + 40))
                  .returning('id');
                eventIds.push(...inserted.map((event) => Number(event.id)));
                created += inserted.length;
              }
            }
            const attempts = Number(old?.attempts ?? 0) + 1;
            const expired = now.getTime() - hour.getTime() >= policy.lateHours * HOUR_MS;
            const review =
              issues.some((issue) =>
                ['CONFIG_HISTORY_UNAVAILABLE', 'SOURCE_REVISED', 'PRODUCER_DISCREPANCY'].includes(
                  issue,
                ),
              ) ||
              (issues.length > 0 && expired);
            const status = review ? 'REVIEW_REQUIRED' : issues.length > 0 ? 'PENDING' : 'COMPLETE';
            const retryAt = review
              ? null
              : issues.length > 0
                ? new Date(now.getTime() + Math.min(2 ** Math.min(attempts, 6) * 60_000, HOUR_MS))
                : hour.getTime() >= now.getTime() - policy.recheckHours * HOUR_MS
                  ? new Date(now.getTime() + HOUR_MS)
                  : null;
            const values = {
              fingerprint: point.fingerprint,
              status,
              attempts,
              next_retry_at: retryAt,
              checked_at: now,
              summary_json: JSON.stringify({
                created,
                duplicate,
                eventIds,
                issues: [...new Set(issues)],
                sourceFingerprint: revised
                  ? previous.sourceFingerprint
                  : (evaluation.sourceFingerprint ?? previous.sourceFingerprint),
                finalized: anchored || issues.length === 0,
                candidates: evaluation.events.length,
                samples:
                  policy.mode === 'shadow'
                    ? evaluation.events.slice(0, 10).map((event) => ({
                        parameter: event.parameterLabel,
                        thresholdType: event.thresholdType,
                        measuredValue: event.measuredValue,
                        thresholdValue: event.thresholdValue,
                      }))
                    : [],
              }),
            };
            if (old) await trx(HOURS).where(jobKey).update(values);
            else await trx(HOURS).insert({ ...jobKey, ...values });
            // next_hour enumerates work; unresolved hours remain durable in HOURS, never treated as complete.
            await trx(POINTS)
              .where(key(point))
              .where('next_hour', '<=', hour)
              .update({ next_hour: new Date(hour.getTime() + HOUR_MS) });
            return { created, duplicate, issues: [...new Set(issues)] };
          },
          { isolationLevel: 'serializable' },
        );
      try {
        return await persist();
      } catch (error) {
        if (!isRetryableWrite(error, true)) throw error;
        return persist();
      }
    },
    async cleanup(now: Date): Promise<void> {
      const cutoff = new Date(now.getTime() - (policy.mode === 'shadow' ? 7 : 30) * 24 * HOUR_MS);
      // Bound cleanup writes; unresolved hours are retained for an explicit reconciliation decision.
      await db.raw('DELETE TOP (100) FROM ?? WHERE mode = ? AND status = ? AND checked_at < ?', [
        HOURS,
        policy.mode,
        'COMPLETE',
        cutoff,
      ]);
    },
  };
}

function isRetryableWrite(error: unknown, includeDeadlock: boolean): boolean {
  if (!error || typeof error !== 'object') return false;
  const item = error as Record<string, unknown>;
  if (item.number === 2601 || item.number === 2627 || (includeDeadlock && item.number === 1205))
    return true;
  return (
    isRetryableWrite(item.originalError, includeDeadlock) ||
    isRetryableWrite(item.info, includeDeadlock)
  );
}
