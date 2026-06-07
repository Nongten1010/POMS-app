import { env } from '../../config/env';
import { ForbiddenError, NotFoundError } from '../../shared/errors/AppError';
import { parameterValuesRepository } from './parameter-values.repository';
import {
  type ConnectionTestQuery,
  type ConnectionTestResultDTO,
  type LatestParameterValueQuery,
  type LatestParameterValueResultDTO,
  type ListParameterValuesQuery,
  PARAMETER_VALUE_INTERVALS,
  type ParameterValueAccessContext,
  type ParameterValuesResultDTO,
  type ParameterValuesTableDTO,
} from './parameter-values.types';

export const parameterValuesService = {
  async listTables(access: ParameterValueAccessContext): Promise<ParameterValuesTableDTO[]> {
    const [tables, accessibleStationIds] = await Promise.all([
      parameterValuesRepository.listTables(),
      parameterValuesRepository.listAccessibleStationIds(access),
    ]);

    const accessible = new Set(accessibleStationIds);
    return tables.filter((table) => {
      const stationId = getStationIdFromTableName(table.tableName);
      return stationId ? accessible.has(stationId) : false;
    });
  },

  async list(
    query: ListParameterValuesQuery,
    access: ParameterValueAccessContext,
  ): Promise<ParameterValuesResultDTO> {
    await ensureStationAccess(query.stationId, access);

    const tableName = parameterValuesRepository.tableName(query.stationId, query.interval);
    const exists = await parameterValuesRepository.tableExists(tableName);
    if (!exists) {
      throw new NotFoundError(
        `Parameter value table ${env.PARAMETER_DB_SCHEMA}.${tableName} not found`,
      );
    }

    const result = await parameterValuesRepository.listRows(query);
    const registeredParameters = await parameterValuesRepository.listRegisteredParameters(
      query.stationId,
      access,
    );
    const filtered = filterRowsByRegisteredParameters(result.rows, registeredParameters);

    return {
      data: filtered.rows,
      meta: {
        stationId: query.stationId,
        interval: query.interval,
        schemaName: env.PARAMETER_DB_SCHEMA,
        tableName: result.tableName,
        startDate: query.startDate,
        endDate: query.endDate,
        count: filtered.rows.length,
        registeredParameters,
        returnedColumns: filtered.returnedColumns,
      },
    };
  },

  async latest(
    query: LatestParameterValueQuery,
    access: ParameterValueAccessContext,
  ): Promise<LatestParameterValueResultDTO> {
    await ensureStationAccess(query.stationId, access);

    const tableName = parameterValuesRepository.tableName(query.stationId, query.interval);
    const exists = await parameterValuesRepository.tableExists(tableName);
    if (!exists) {
      throw new NotFoundError(
        `Parameter value table ${env.PARAMETER_DB_SCHEMA}.${tableName} not found`,
      );
    }

    const result = await parameterValuesRepository.latestRow(query);
    const registeredParameters = await parameterValuesRepository.listRegisteredParameters(
      query.stationId,
      access,
    );
    const filtered = filterRowsByRegisteredParameters(
      result.row ? [result.row] : [],
      registeredParameters,
    );

    return {
      data: filtered.rows[0] ?? null,
      meta: {
        stationId: query.stationId,
        interval: query.interval,
        schemaName: env.PARAMETER_DB_SCHEMA,
        tableName: result.tableName,
        count: filtered.rows.length,
        registeredParameters,
        returnedColumns: filtered.returnedColumns,
      },
    };
  },

  async connectionTest(
    query: ConnectionTestQuery,
    access: ParameterValueAccessContext,
  ): Promise<ConnectionTestResultDTO> {
    await ensureStationAccess(query.stationId, access);

    const interval = 'test';
    const tableName = parameterValuesRepository.tableName(query.stationId, interval);
    const exists = await parameterValuesRepository.tableExists(tableName);
    if (!exists) {
      throw new NotFoundError(
        `Parameter value table ${env.PARAMETER_DB_SCHEMA}.${tableName} not found`,
      );
    }

    const result = await parameterValuesRepository.latestRows(
      {
        stationId: query.stationId,
        interval,
      },
      5,
    );
    const registeredParameters = await parameterValuesRepository.listRegisteredParameters(
      query.stationId,
      access,
    );
    const filtered = filterRowsByRegisteredParameters(result.rows, registeredParameters);

    return {
      data: filtered.rows.map((row) =>
        buildConnectionTestData(query.stationId, row, registeredParameters),
      ),
      meta: {
        stationId: query.stationId,
        interval,
        schemaName: env.PARAMETER_DB_SCHEMA,
        tableName: result.tableName,
        count: filtered.rows.length,
        registeredParameters,
      },
    };
  },
};

const BASE_PARAMETER_VALUE_COLUMNS = new Set(['station_id', 'cdate', 'ctime', 'udate', 'utime']);
const IGNORED_PARAMETER_TOKENS = new Set([
  'mg',
  'mgl',
  'mgm3',
  'mgm',
  'ppm',
  'ppb',
  'percent',
  'pct',
  'unit',
  'units',
]);

function filterRowsByRegisteredParameters(
  rows: Record<string, unknown>[],
  registeredParameters: string[],
): { rows: Record<string, unknown>[]; returnedColumns: string[] } {
  const allowedColumns = getAllowedColumns(rows, registeredParameters);

  return {
    rows: rows.map((row) =>
      Object.fromEntries(Object.entries(row).filter(([key]) => allowedColumns.has(key))),
    ),
    returnedColumns: [...allowedColumns],
  };
}

function getAllowedColumns(
  rows: Record<string, unknown>[],
  registeredParameters: string[],
): Set<string> {
  const prefixes = new Set(registeredParameters.flatMap(toParameterColumnPrefixes));
  const allowedColumns = new Set<string>();

  for (const row of rows) {
    for (const key of Object.keys(row)) {
      const lowerKey = key.toLowerCase();
      if (BASE_PARAMETER_VALUE_COLUMNS.has(lowerKey) || hasRegisteredPrefix(lowerKey, prefixes)) {
        allowedColumns.add(key);
      }
    }
  }

  return allowedColumns;
}

function hasRegisteredPrefix(key: string, prefixes: Set<string>): boolean {
  for (const prefix of prefixes) {
    if (key.startsWith(`${prefix}_`)) return true;
  }

  return false;
}

function toParameterColumnPrefixes(parameter: string): string[] {
  const candidates = new Set<string>();
  const trimmed = parameter.trim();
  const beforeParenthesis = trimmed.split('(')[0] ?? trimmed;
  const beforeAtSign = beforeParenthesis.split('@')[0] ?? beforeParenthesis;

  addParameterCandidate(candidates, beforeAtSign);

  for (const match of trimmed.matchAll(/\(([^)]+)\)/g)) {
    addParameterCandidate(candidates, match[1]);
  }

  if (!trimmed.includes('(')) {
    addParameterCandidate(candidates, trimmed);
  }

  return [...candidates].filter((candidate) => !IGNORED_PARAMETER_TOKENS.has(candidate));
}

function addParameterCandidate(candidates: Set<string>, value: string | undefined): void {
  const candidate = normalizeParameterName(value ?? '');
  if (candidate) candidates.add(candidate);
}

function normalizeParameterName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function buildConnectionTestData(
  stationId: string,
  row: Record<string, unknown>,
  registeredParameters: string[],
): ConnectionTestResultDTO['data'][number] {
  const entries = registeredParameters.map((parameter) => ({
    parameter,
    columns: findParameterColumns(row, parameter),
  }));

  return {
    stationId,
    timestamp: buildTimestamp(row),
    values: Object.fromEntries(
      entries.map(({ parameter, columns }) => [
        parameter,
        columns.valueColumn ? row[columns.valueColumn] : null,
      ]),
    ),
    statuses: Object.fromEntries(
      entries.map(({ parameter, columns }) => [
        parameter,
        columns.statusColumn ? row[columns.statusColumn] : null,
      ]),
    ),
  };
}

function findParameterColumns(
  row: Record<string, unknown>,
  parameter: string,
): { valueColumn: string | null; statusColumn: string | null } {
  const keysByLower = new Map(Object.keys(row).map((key) => [key.toLowerCase(), key]));
  const prefixes = toParameterColumnPrefixes(parameter);

  return {
    valueColumn: findColumn(keysByLower, prefixes, 'value'),
    statusColumn: findColumn(keysByLower, prefixes, 'status'),
  };
}

function findColumn(
  keysByLower: Map<string, string>,
  prefixes: string[],
  suffix: string,
): string | null {
  for (const prefix of prefixes) {
    const key = keysByLower.get(`${prefix}_${suffix}`);
    if (key) return key;
  }

  return null;
}

function buildTimestamp(row: Record<string, unknown>): string | null {
  const cdate = typeof row.cdate === 'string' ? row.cdate : null;
  const ctime = typeof row.ctime === 'string' ? row.ctime : null;
  if (cdate && ctime) return `${cdate} ${ctime}`;
  if (cdate) return cdate;

  const udate = typeof row.udate === 'string' ? row.udate : null;
  const utime = typeof row.utime === 'string' ? row.utime : null;
  if (udate && utime) return `${udate} ${utime}`;
  if (udate) return udate;

  return null;
}

async function ensureStationAccess(
  stationId: string,
  access: ParameterValueAccessContext,
): Promise<void> {
  const hasAccess = await parameterValuesRepository.canAccessStation(stationId, access);
  if (!hasAccess) {
    throw new ForbiddenError(`Station ${stationId} is not available for this user`);
  }
}

function getStationIdFromTableName(tableName: string): string | null {
  for (const interval of PARAMETER_VALUE_INTERVALS) {
    const suffix = `_data_${interval}`;
    if (tableName.endsWith(suffix)) {
      return tableName.slice(0, -suffix.length);
    }
  }

  return null;
}
