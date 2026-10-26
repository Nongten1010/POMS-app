import { createHash } from 'node:crypto';
import type { Knex } from 'knex';
import { env } from '../../config/env';
import { parameterSourceDb } from '../../config/parameter-source-database';
import { AppError } from '../../shared/errors/AppError';
import { CONNECTION_CLEANUP_INTERVALS } from './connection-measurement-cleanup';
import { cleanupSqlIdentifier } from './connection-measurement-cleanup-schema';
import { PARAMETER_CLEANUP_RECEIPTS_TABLE } from './parameter-measurement-cleanup-schema';
import {
  measurementParameterUnitMatches,
  parseMeasurementParameter,
  resolveMeasurementParameterFamilies,
  sameMeasurementParameter,
} from '../parameter-values/measurement-parameter-columns';

interface ParameterCleanupPoint {
  stationId: string;
  requestedParameters: string[];
  connectedParametersJson: string;
}

interface ParameterCleanupInput {
  requestId: number;
  actorUserId: number;
  points: ParameterCleanupPoint[];
}

interface SourceColumn {
  name: string;
  is_nullable: boolean | number;
}
interface TableResult {
  tableName: string;
  skippedMissing: boolean;
}

function parameterIdentity(label: string): string {
  const match = label.trim().match(/^(.*?)\s*\(([^()]*)\)\s*$/u);
  return match
    ? JSON.stringify([parameterNameKey(match[1]), unitKey(match[2])])
    : JSON.stringify([parameterNameKey(label), null]);
}

function parameterNameKey(name: string): string {
  const key = name
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
  return key === 'flowrate' ? 'flow' : key;
}

function unitKey(unit: string): string {
  return unit.normalize('NFKC').toLowerCase().replace(/\s+/gu, '');
}

/** Called by final ADD_PARAMETER activation only; it never removes measurement rows. */
export async function clearAddedParameterMeasurements(
  input: ParameterCleanupInput,
  source: Knex = parameterSourceDb,
): Promise<void> {
  try {
    const points = input.points
      .map((point) => {
        const connected: unknown = JSON.parse(point.connectedParametersJson);
        if (
          !Array.isArray(connected) ||
          !connected.every(
            (value): value is string => typeof value === 'string' && value.trim().length > 0,
          )
        )
          throw new Error('Connected parameter baseline is unavailable');
        return {
          ...point,
          connectedParameters: connected,
          parameters: [...new Set(point.requestedParameters)].filter(
            (label) => !connected.some((existing) => sameMeasurementParameter(existing, label)),
          ),
        };
      })
      .filter((point) => point.parameters.length > 0);
    if (points.length === 0) return;
    await source.transaction(async (trx) => {
      const sourceKey = createHash('sha256')
        .update(JSON.stringify([env.DB_HOST.toLowerCase(), env.DB_PORT, env.DB_NAME.toLowerCase()]))
        .digest('hex');
      const receipts = `${cleanupSqlIdentifier(env.PARAMETER_DB_SCHEMA)}.${cleanupSqlIdentifier(PARAMETER_CLEANUP_RECEIPTS_TABLE)}`;
      await trx.raw(
        `DECLARE @result int;
        EXEC @result = sys.sp_getapplock @Resource = ?,
          @LockMode = 'Exclusive', @LockOwner = 'Transaction', @LockTimeout = 15000;
        IF @result < 0 THROW 51000, 'Parameter cleanup lock unavailable', 1;`,
        [`poms-measurement-cleanup:${sourceKey}`],
      );
      const pending = [];
      for (const point of points.sort((a, b) => a.stationId.localeCompare(b.stationId))) {
        const parameters = [];
        for (const [identity, label] of new Map(
          point.parameters.map((label) => [parameterIdentity(label), label]),
        )) {
          const parameterKey = createHash('sha256').update(identity).digest('hex');
          const existing = await trx.raw(
            `SELECT parameter_key FROM ${receipts}
            WHERE source_key = ? AND request_id = ? AND station_id = ? AND parameter_key = ?`,
            [sourceKey, input.requestId, point.stationId, parameterKey],
          );
          if (existing.length === 0)
            parameters.push({ label, parameterKey, results: [] as TableResult[] });
        }
        if (parameters.length > 0) pending.push({ ...point, parameters });
      }
      if (pending.length === 0) return;
      const [permission] = await trx.raw(
        "SELECT HAS_PERMS_BY_NAME(?, 'SCHEMA', 'VIEW DEFINITION') AS can_inspect",
        [env.PARAMETER_DB_SCHEMA],
      );
      if (Number(permission?.can_inspect) !== 1) throw new Error('Source metadata unavailable');
      const updates: Array<{ sql: string; verify: string; unit?: string }> = [];
      for (const point of pending) {
        for (const interval of CONNECTION_CLEANUP_INTERVALS) {
          const tableName = `${point.stationId}_data_${interval}`;
          const tables = await trx.raw(
            `SELECT t.object_id FROM sys.tables AS t
            INNER JOIN sys.schemas AS s ON s.schema_id = t.schema_id
            WHERE s.name = ? AND t.name = ?`,
            [env.PARAMETER_DB_SCHEMA, tableName],
          );
          for (const parameter of point.parameters)
            parameter.results.push({ tableName, skippedMissing: tables.length === 0 });
          if (tables.length === 0) continue;
          const columns: SourceColumn[] = await trx.raw(
            `SELECT c.name, c.is_nullable FROM sys.columns AS c
            INNER JOIN sys.tables AS t ON t.object_id = c.object_id
            INNER JOIN sys.schemas AS s ON s.schema_id = t.schema_id
            WHERE s.name = ? AND t.name = ?`,
            [env.PARAMETER_DB_SCHEMA, tableName],
          );
          const qualified = `${cleanupSqlIdentifier(env.PARAMETER_DB_SCHEMA)}.${cleanupSqlIdentifier(tableName)}`;
          await trx.raw('EXEC sys.sp_executesql ?', [
            `SELECT COUNT_BIG(*) AS row_count FROM ${qualified} WITH (TABLOCKX, HOLDLOCK)`,
          ]);
          for (const { label } of point.parameters) {
            const parameter = parseMeasurementParameter(label);
            if (!parameter.nameKey || (!parameter.unitKey && !parameter.dimensionless))
              throw new Error('Parameter unit is required');
            if (
              point.connectedParameters.some((existing) => {
                const protectedParameter = parseMeasurementParameter(existing);
                return (
                  !protectedParameter.dimensionless &&
                  !protectedParameter.unitKey &&
                  protectedParameter.nameKey === parameter.nameKey
                );
              })
            )
              throw new Error('Existing parameter unit is ambiguous');
            const families = resolveMeasurementParameterFamilies(
              columns.map((column) => column.name),
              label,
            );
            if (families.length === 0) throw new Error('Parameter columns unavailable');
            for (const family of families) {
              const value = columns.find((column) => column.name === family.valueColumn);
              const status = columns.find((column) => column.name === family.statusColumn);
              if (
                !value ||
                !status ||
                Number(value.is_nullable) !== 1 ||
                Number(status.is_nullable) !== 1
              )
                throw new Error('Parameter columns unavailable');
              const ownsWholeFamily = family.unitSpecific || parameter.dimensionless;
              const unitsColumn = family.unitsColumn;
              if (!unitsColumn && !ownsWholeFamily) throw new Error('Source unit is unavailable');
              for (const existing of point.connectedParameters) {
                const protectedParameter = parseMeasurementParameter(existing);
                const sharesColumns = resolveMeasurementParameterFamilies(
                  columns.map((column) => column.name),
                  existing,
                ).some(
                  (protectedFamily) =>
                    protectedFamily.valueColumn === family.valueColumn ||
                    protectedFamily.statusColumn === family.statusColumn,
                );
                if (
                  sharesColumns &&
                  !sameMeasurementParameter(existing, label) &&
                  (ownsWholeFamily ||
                    protectedParameter.nameKey !== parameter.nameKey ||
                    !protectedParameter.unitKey)
                )
                  throw new Error('Source columns belong to an existing parameter');
              }
              const hasData = `(${cleanupSqlIdentifier(value.name)} IS NOT NULL OR ${cleanupSqlIdentifier(status.name)} IS NOT NULL)`;
              const sourceUnits: Array<{ parameter_unit: unknown }> = unitsColumn
                ? await trx.raw('EXEC sys.sp_executesql ?', [
                    `SELECT DISTINCT ${cleanupSqlIdentifier(unitsColumn)} AS parameter_unit FROM ${qualified} WHERE ${hasData}`,
                  ])
                : [];
              if (ownsWholeFamily) {
                for (const { parameter_unit: sourceUnit } of sourceUnits) {
                  if (
                    sourceUnit === null ||
                    sourceUnit === undefined ||
                    (typeof sourceUnit === 'string' && unitKey(sourceUnit) === '')
                  )
                    continue;
                  if (!measurementParameterUnitMatches(parameter, sourceUnit))
                    throw new Error('Source unit contradicts its parameter family');
                }
                updates.push({
                  sql: `UPDATE ${qualified} SET ${cleanupSqlIdentifier(value.name)} = NULL, ${cleanupSqlIdentifier(status.name)} = NULL`,
                  verify: `SELECT COUNT_BIG(*) AS remaining_count FROM ${qualified} WHERE ${hasData}`,
                });
              } else {
                if (!unitsColumn) throw new Error('Source unit is unavailable');
                for (const { parameter_unit: sourceUnit } of sourceUnits) {
                  if (
                    typeof sourceUnit !== 'string' ||
                    !unitKey(sourceUnit) ||
                    sourceUnit.length > 255
                  )
                    throw new Error('Source unit is ambiguous');
                  if (!measurementParameterUnitMatches(parameter, sourceUnit)) continue;
                  updates.push({
                    sql: `UPDATE ${qualified} SET ${cleanupSqlIdentifier(value.name)} = NULL, ${cleanupSqlIdentifier(status.name)} = NULL WHERE ${cleanupSqlIdentifier(unitsColumn)} = @unit`,
                    verify: `SELECT COUNT_BIG(*) AS remaining_count FROM ${qualified} WHERE ${cleanupSqlIdentifier(unitsColumn)} = @unit AND ${hasData}`,
                    unit: sourceUnit,
                  });
                }
              }
            }
          }
        }
      }
      const [clock] = await trx.raw('SELECT SYSUTCDATETIME() AS cleared_at');
      for (const update of updates) {
        const execute = (statement: string) =>
          update.unit === undefined
            ? trx.raw('EXEC sys.sp_executesql ?', [statement])
            : trx.raw("EXEC sys.sp_executesql ?, N'@unit nvarchar(255)', ?", [
                statement,
                update.unit,
              ]);
        await execute(update.sql);
        const [remaining] = await execute(update.verify);
        if (Number(remaining?.remaining_count) !== 0)
          throw new Error('Parameter measurements were not cleared');
      }
      for (const point of pending)
        for (const parameter of point.parameters)
          await trx.raw(
            `INSERT INTO ${receipts}
            (source_key, request_id, station_id, parameter_key, parameter_label, actor_user_id, cleared_at, table_results_json)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              sourceKey,
              input.requestId,
              point.stationId,
              parameter.parameterKey,
              parameter.label,
              input.actorUserId,
              clock.cleared_at,
              JSON.stringify(parameter.results),
            ],
          );
    });
  } catch {
    throw new AppError(
      'Unable to clear added parameter measurements; connection was not completed',
      503,
      'MEASUREMENT_CLEANUP_FAILED',
      { retryable: true },
    );
  }
}
