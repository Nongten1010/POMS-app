import { createHash } from 'node:crypto';
import type { Knex } from 'knex';
import { env } from '../../config/env';
import { parameterSourceDb } from '../../config/parameter-source-database';
import { logger } from '../../config/logger';
import { AppError } from '../../shared/errors/AppError';
import {
  cleanupSqlIdentifier,
  MEASUREMENT_CLEANUP_RECEIPTS_TABLE,
} from './connection-measurement-cleanup-schema';
import type { ConnectionRequestType } from './connection-requests.types';

export const CONNECTION_CLEANUP_INTERVALS = ['real', '1m', '5m', '60m', '1day', 'test'] as const;

interface CleanupPoint {
  pointCode?: string | null;
}

interface CleanupInput {
  requestId: number;
  requestType: ConnectionRequestType;
  measurementPoints: CleanupPoint[];
  actorUserId: number;
}

interface TableResult {
  tableName: string;
  rowCount: number;
  skippedMissing: boolean;
}

function cleanupFailure(): AppError {
  return new AppError(
    'Unable to clear test measurements; connection was not completed',
    503,
    'MEASUREMENT_CLEANUP_FAILED',
    { retryable: true },
  );
}

/** Called only by transitions that activate a point, never by maintenance syncs. */
export async function clearNewConnectionMeasurements(
  primary: Knex.Transaction,
  input: CleanupInput,
  source: Knex = parameterSourceDb,
): Promise<void> {
  if (!['NEW_CONNECTION', 'ADD_MEASUREMENT_POINT'].includes(input.requestType)) return;
  try {
    const stationIds = [
      ...new Set(input.measurementPoints.map((point) => point.pointCode?.trim())),
    ];
    if (
      stationIds.length === 0 ||
      stationIds.some((id) => !id || id.length > 64 || id.includes('\0'))
    ) {
      throw new Error('New connection requires valid point codes before cleanup');
    }
    const newStationIds: string[] = [];
    for (const stationId of stationIds as string[]) {
      // Include retired rows: a previously connected station must never be
      // cleared by a reconnect, a delayed request, or a maintenance operation.
      const existing = await primary('cems_wpms_connected_measurement_points')
        .whereRaw("COALESCE(NULLIF(LTRIM(RTRIM(??)), ''), ??) = ?", [
          'point_code',
          'point_name',
          stationId,
        ])
        .first('id');
      if (!existing) newStationIds.push(stationId);
    }
    if (newStationIds.length === 0) return;

    // Stable across rolled-back direct creations (which consume identity IDs).
    // Namespace receipts when multiple POMS databases share one parameter DB.
    const sourceKey = createHash('sha256')
      .update(JSON.stringify([env.DB_HOST.toLowerCase(), env.DB_PORT, env.DB_NAME.toLowerCase()]))
      .digest('hex');
    const schema = env.PARAMETER_DB_SCHEMA;
    const receipts = `${cleanupSqlIdentifier(schema)}.${cleanupSqlIdentifier(MEASUREMENT_CLEANUP_RECEIPTS_TABLE)}`;
    await source.transaction(async (trx) => {
      await trx.raw(
        `DECLARE @result int;
         EXEC @result = sys.sp_getapplock @Resource = ?,
           @LockMode = 'Exclusive', @LockOwner = 'Transaction', @LockTimeout = 15000;
         IF @result < 0 THROW 51000, 'Measurement cleanup lock unavailable', 1;`,
        [`poms-measurement-cleanup:${sourceKey}`],
      );
      const pending: string[] = [];
      for (const stationId of newStationIds) {
        const [receipt] = await trx.raw(
          `SELECT station_id FROM ${receipts} WHERE source_key = ? AND station_id = ?`,
          [sourceKey, stationId],
        );
        if (!receipt) pending.push(stationId);
      }
      if (pending.length === 0) return;

      // Without metadata visibility a hidden table looks missing. Fail closed
      // rather than treating an inaccessible source as an empty station.
      const [permission] = await trx.raw(
        "SELECT HAS_PERMS_BY_NAME(?, 'SCHEMA', 'VIEW DEFINITION') AS can_inspect",
        [schema],
      );
      if (Number(permission?.can_inspect) !== 1) throw new Error('Source metadata unavailable');

      const tableResults = new Map<string, TableResult[]>();
      const existingTables: string[] = [];
      // Hold every table lock before the first DELETE. Rows present at the last
      // lock are the cutoff; concurrent inserts wait and survive the commit.
      for (const stationId of pending.sort()) {
        const results: TableResult[] = [];
        tableResults.set(stationId, results);
        for (const interval of CONNECTION_CLEANUP_INTERVALS) {
          const tableName = `${stationId}_data_${interval}`;
          const [table] = await trx.raw(
            `SELECT t.object_id FROM sys.tables AS t
             INNER JOIN sys.schemas AS s ON s.schema_id = t.schema_id
             WHERE s.name = ? AND t.name = ?`,
            [schema, tableName],
          );
          if (!table) {
            results.push({ tableName, rowCount: 0, skippedMissing: true });
            continue;
          }
          const qualified = `${cleanupSqlIdentifier(schema)}.${cleanupSqlIdentifier(tableName)}`;
          // Bind the entire statement so punctuation in a quoted point code
          // (notably ?) cannot be interpreted as a Knex value placeholder.
          const [count] = await trx.raw('EXEC sys.sp_executesql ?', [
            `SELECT COUNT_BIG(*) AS row_count FROM ${qualified} WITH (TABLOCKX, HOLDLOCK)`,
          ]);
          const rowCount = Number(count?.row_count);
          if (!Number.isSafeInteger(rowCount) || rowCount < 0) throw new Error('Invalid row count');
          results.push({ tableName, rowCount, skippedMissing: false });
          existingTables.push(qualified);
        }
      }
      const [clock] = await trx.raw('SELECT SYSUTCDATETIME() AS cleared_at');
      for (const table of existingTables) {
        await trx.raw('EXEC sys.sp_executesql ?', [`DELETE FROM ${table}`]);
        const [remaining] = await trx.raw('EXEC sys.sp_executesql ?', [
          `SELECT COUNT_BIG(*) AS row_count FROM ${table} WITH (TABLOCKX, HOLDLOCK)`,
        ]);
        if (Number(remaining?.row_count) !== 0) throw new Error('Measurements were not cleared');
      }
      for (const stationId of pending) {
        await trx.raw(
          `INSERT INTO ${receipts}
           (source_key, station_id, request_id, actor_user_id, cleared_at, table_results_json)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            sourceKey,
            stationId,
            input.requestId,
            input.actorUserId,
            clock.cleared_at,
            JSON.stringify(tableResults.get(stationId)),
          ],
        );
      }
    });
  } catch {
    logger.error('[connection-measurement-cleanup] Cleanup could not be confirmed', {
      requestId: input.requestId,
    });
    // A lost commit acknowledgement is also a failure. A retry reads the durable
    // receipt first, so it does not erase measurements received after that commit.
    throw cleanupFailure();
  }
}
