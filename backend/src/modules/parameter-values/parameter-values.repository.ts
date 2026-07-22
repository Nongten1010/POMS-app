import { env } from '../../config/env';
import { db } from '../../config/database';
import { parameterSourceDb } from '../../config/parameter-source-database';
import type { Knex } from 'knex';
import { applyAssignedFactoryAccessFilter } from '../../shared/utils/factory-access-query';
import {
  type LatestParameterValueQuery,
  type ListParameterValuesQuery,
  type ParameterValueAccessContext,
  type ParameterValueInterval,
  type ParameterValuesTableDTO,
} from './parameter-values.types';

interface TableSummaryRow {
  schema_name: string;
  table_name: string;
  column_count: number | string;
  row_count: number | string;
}

interface StationAccessRow {
  station_id: string | null;
}

interface RegisteredParameterRow {
  parameters_json: string | null;
  instruments_json?: string | null;
}

interface LatestTimestampRow {
  cdate: unknown;
  ctime: unknown;
}

type TimestampPredicateValue = string | number | boolean | null;

export const parameterValuesRepository = {
  tableName(stationId: string, interval: ParameterValueInterval): string {
    return `${stationId}_data_${interval}`;
  },

  async tableExists(tableName: string): Promise<boolean> {
    const row = await parameterSourceDb('sys.tables as t')
      .join('sys.schemas as s', 't.schema_id', 's.schema_id')
      .where('s.name', env.PARAMETER_DB_SCHEMA)
      .where('t.name', tableName)
      .select('t.object_id')
      .first();
    return Boolean(row);
  },

  async listTables(): Promise<ParameterValuesTableDTO[]> {
    const rows = await parameterSourceDb<TableSummaryRow>('sys.tables as t')
      .with('column_counts', (builder) => {
        builder
          .select('object_id')
          .count<{ column_count: number }[]>({ column_count: '*' })
          .from('sys.columns')
          .groupBy('object_id');
      })
      .with('row_counts', (builder) => {
        builder
          .select('object_id')
          .sum<{ row_count: number }[]>({ row_count: 'rows' })
          .from('sys.partitions')
          .whereIn('index_id', [0, 1])
          .groupBy('object_id');
      })
      .join('sys.schemas as s', 't.schema_id', 's.schema_id')
      .join('column_counts as cc', 't.object_id', 'cc.object_id')
      .leftJoin('row_counts as rc', 't.object_id', 'rc.object_id')
      .where('s.name', env.PARAMETER_DB_SCHEMA)
      .select({
        schema_name: 's.name',
        table_name: 't.name',
        column_count: 'cc.column_count',
        row_count: parameterSourceDb.raw('COALESCE(rc.row_count, 0)'),
      })
      .orderBy('t.name', 'asc');

    return rows.map((row) => ({
      schemaName: row.schema_name,
      tableName: row.table_name,
      columnCount: Number(row.column_count),
      rowCount: Number(row.row_count),
    }));
  },

  async listAccessibleStationIds(access: ParameterValueAccessContext): Promise<string[]> {
    const rows = await buildStationAccessQuery(access)
      .whereNotNull('p.point_code')
      .distinct<StationAccessRow[]>({ station_id: 'p.point_code' })
      .orderBy('p.point_code', 'asc');

    return rows
      .map((row) => row.station_id)
      .filter((stationId): stationId is string => Boolean(stationId));
  },

  async canAccessStation(stationId: string, access: ParameterValueAccessContext): Promise<boolean> {
    const row = await buildStationAccessQuery(access)
      .where((builder) => {
        builder.where('p.point_code', stationId).orWhere('p.point_name', stationId);
      })
      .select('p.id')
      .first();

    return Boolean(row);
  },

  async canAccessStationForConnectionTest(
    stationId: string,
    access: ParameterValueAccessContext,
  ): Promise<boolean> {
    const connected = await this.canAccessStation(stationId, access);
    if (connected) return true;

    const row = await buildWaitingConnectionStationAccessQuery(access)
      .where((builder) => {
        builder.where('p.point_code', stationId).orWhere('p.point_name', stationId);
      })
      .select('p.id')
      .first();

    return Boolean(row);
  },

  async listRegisteredParameters(
    stationId: string,
    access: ParameterValueAccessContext,
  ): Promise<string[]> {
    const rows = await buildStationAccessQuery(access)
      .where((builder) => {
        builder.where('p.point_code', stationId).orWhere('p.point_name', stationId);
      })
      .select<RegisteredParameterRow[]>('p.parameters_json', 'p.instruments_json');

    return uniqueRegisteredParameters(rows.flatMap((row) => parseRegisteredParametersFromRow(row)));
  },

  async listRegisteredParametersForConnectionTest(
    stationId: string,
    access: ParameterValueAccessContext,
  ): Promise<string[]> {
    const connectedRows = await buildStationAccessQuery(access)
      .where((builder) => {
        builder.where('p.point_code', stationId).orWhere('p.point_name', stationId);
      })
      .select<RegisteredParameterRow[]>('p.parameters_json', 'p.instruments_json');

    const waitingRows = await buildWaitingConnectionStationAccessQuery(access)
      .where((builder) => {
        builder.where('p.point_code', stationId).orWhere('p.point_name', stationId);
      })
      .select<RegisteredParameterRow[]>('p.parameters_json', 'p.instruments_json');

    return uniqueRegisteredParameters(
      [...connectedRows, ...waitingRows].flatMap((row) => parseRegisteredParametersFromRow(row)),
    );
  },

  async listRows(
    query: ListParameterValuesQuery,
  ): Promise<{ rows: Record<string, unknown>[]; tableName: string }> {
    const tableName = this.tableName(query.stationId, query.interval);
    const rows = await parameterSourceDb
      .withSchema(env.PARAMETER_DB_SCHEMA)
      .from<Record<string, unknown>>(tableName)
      .select('*')
      .where('cdate', '>=', query.startDate)
      .where('cdate', '<=', query.endDate)
      .orderBy('cdate', 'desc')
      .orderBy('ctime', 'desc');

    return {
      tableName,
      rows: rows.map(serializeRow),
    };
  },

  async latestRow(
    query: LatestParameterValueQuery,
  ): Promise<{ row: Record<string, unknown> | null; tableName: string }> {
    const tableName = this.tableName(query.stationId, query.interval);
    const row = await parameterSourceDb
      .withSchema(env.PARAMETER_DB_SCHEMA)
      .from<Record<string, unknown>>(tableName)
      .select('*')
      .orderBy('cdate', 'desc')
      .orderBy('ctime', 'desc')
      .first();

    return {
      tableName,
      row: row ? serializeRow(row) : null,
    };
  },

  async latestRows(
    query: LatestParameterValueQuery,
    limit: number,
  ): Promise<{ rows: Record<string, unknown>[]; tableName: string }> {
    const tableName = this.tableName(query.stationId, query.interval);
    const rows = await parameterSourceDb
      .withSchema(env.PARAMETER_DB_SCHEMA)
      .from<Record<string, unknown>>(tableName)
      .select('*')
      .orderBy('cdate', 'desc')
      .orderBy('ctime', 'desc')
      .limit(limit);

    return {
      tableName,
      rows: rows.map(serializeRow),
    };
  },

  async latestRowsAtLatestTimestamp(
    query: LatestParameterValueQuery,
  ): Promise<{ rows: Record<string, unknown>[]; tableName: string }> {
    const tableName = this.tableName(query.stationId, query.interval);
    const latestTimestamp = await parameterSourceDb
      .withSchema(env.PARAMETER_DB_SCHEMA)
      .from<LatestTimestampRow>(tableName)
      .select('cdate', 'ctime')
      .orderBy('cdate', 'desc')
      .orderBy('ctime', 'desc')
      .first();

    if (!latestTimestamp) return { tableName, rows: [] };

    const timestampPredicate = serializeLatestTimestamp(latestTimestamp);
    const rows = await parameterSourceDb
      .withSchema(env.PARAMETER_DB_SCHEMA)
      .from<Record<string, unknown>>(tableName)
      .select('*')
      .where('cdate', timestampPredicate.cdate)
      .where('ctime', timestampPredicate.ctime)
      .orderBy('station_id', 'asc');

    return {
      tableName,
      rows: rows.map(serializeRow),
    };
  },
};

function parseRegisteredParametersFromRow(row: RegisteredParameterRow): string[] {
  const instrumentParameters = parseInstrumentParameters(row.instruments_json);
  if (instrumentParameters.length > 0) return instrumentParameters;
  return parseRegisteredParameters(row.parameters_json);
}

function parseInstrumentParameters(value: string | null | undefined): string[] {
  if (!value) return [];

  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return [];
    const parameters = (parsed as Record<string, unknown>).parameters;
    if (!Array.isArray(parameters)) return [];

    return parseParameterList(parameters);
  } catch {
    return [];
  }
}

function parseRegisteredParameters(value: string | null): string[] {
  if (!value) return [];

  try {
    const parsed: unknown = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parseParameterList(parsed);
  } catch {
    return [];
  }
}

function parseParameterList(parameters: unknown[]): string[] {
  return parameters.flatMap((item) => {
    if (typeof item === 'string') return [item];
    if (!item || typeof item !== 'object') return [];

    const parameter = item as Record<string, unknown>;
    return [parameter.parameter, parameter.code, parameter.name].filter(
      (value): value is string => typeof value === 'string',
    );
  });
}

function uniqueRegisteredParameters(parameters: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const parameter of parameters) {
    const value = parameter.trim();
    const key = value.toLowerCase();
    if (!value || seen.has(key)) continue;
    seen.add(key);
    result.push(value);
  }

  return result;
}

function buildStationAccessQuery(access: ParameterValueAccessContext) {
  const query = db('cems_wpms_connected_measurement_points as p').whereNull('p.deleted_at');

  const scopeValue = getAccessScopeValue(access.scope);
  if (scopeValue === 'ALL') return query;

  const scopedQuery = query
    .leftJoin('eligible_factories as ef', function joinEligibleFactory() {
      this.on('ef.id', '=', 'p.eligible_factory_id').andOnNull('ef.deleted_at');
    })
    .leftJoin('factories as f', function joinFactory() {
      this.on(function joinFactoryKeys() {
        this.on('f.fid', '=', 'p.factory_id')
          .orOn('f.code', '=', 'p.factory_id')
          .orOn('f.fid', '=', 'ef.source_factory_id')
          .orOn('f.code', '=', 'ef.factory_registration_no_new')
          .orOn('f.fid', '=', 'ef.factory_registration_no_new')
          .orOn('f.code', '=', 'ef.source_factory_id');
      }).andOnNull('f.deleted_at');
    })
    .leftJoin('provinces as pr', 'pr.name_th', 'ef.province_name');

  if (applyStationLocationFilter(scopedQuery, access.scope)) return scopedQuery;

  return scopedQuery.where((builder) => {
    builder.where('p.created_by', access.actorUserId).orWhere((factoryAccessBuilder) => {
      applyAssignedFactoryAccessFilter(factoryAccessBuilder, access.actorUserId);
    });
  });
}

function buildWaitingConnectionStationAccessQuery(access: ParameterValueAccessContext) {
  const query = db('cems_wpms_measurement_points as p')
    .join('cems_wpms_connection_requests as r', 'r.id', 'p.request_id')
    .whereNull('p.deleted_at')
    .whereNull('r.deleted_at')
    .where('r.status', 'WAITING_CONNECTION');

  const scopeValue = getAccessScopeValue(access.scope);
  if (scopeValue === 'ALL') return query;

  const scopedQuery = query
    .leftJoin('factories as f', function joinFactory() {
      this.on('f.fid', '=', 'r.factory_id').andOnNull('f.deleted_at');
    })
    .leftJoin('provinces as pr', 'pr.id', 'f.province_id');

  if (applyStationLocationFilter(scopedQuery, access.scope)) return scopedQuery;

  return scopedQuery.where((builder) => {
    builder.where('r.created_by', access.actorUserId).orWhere((factoryAccessBuilder) => {
      applyAssignedFactoryAccessFilter(factoryAccessBuilder, access.actorUserId);
    });
  });
}

export function buildStationAccessQueryForTests(access: ParameterValueAccessContext) {
  return buildStationAccessQuery(access);
}

export function buildWaitingConnectionStationAccessQueryForTests(
  access: ParameterValueAccessContext,
) {
  return buildWaitingConnectionStationAccessQuery(access);
}

export function parseRegisteredParametersFromRowForTests(row: RegisteredParameterRow): string[] {
  return uniqueRegisteredParameters(parseRegisteredParametersFromRow(row));
}

function serializeRow(row: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [key, serializeValue(key, value)]),
  );
}

function getAccessScopeValue(
  scope: ParameterValueAccessContext['scope'],
): string | null | undefined {
  return scope && typeof scope === 'object' ? scope.scope : scope;
}

function applyStationLocationFilter(
  query: Knex.QueryBuilder,
  scope: ParameterValueAccessContext['scope'],
): boolean {
  if (!scope || typeof scope !== 'object') return false;
  const region = normalizeLocationValue(scope.region);
  const province = normalizeLocationValue(scope.province);

  if (scope.scope === 'IN_REGION' && region) {
    query.where('pr.region', region);
    return true;
  }

  if (scope.scope === 'IN_PROVINCE' && province) {
    query.where('pr.name_th', province);
    return true;
  }

  return false;
}

function normalizeLocationValue(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const trimmed = value.trim();
  return trimmed && trimmed.toLowerCase() !== 'all' ? trimmed : null;
}

function serializeValue(key: string, value: unknown): unknown {
  if (!(value instanceof Date)) return value;

  if (key === 'cdate' || key === 'udate') {
    return value.toISOString().slice(0, 10);
  }

  if (key === 'ctime' || key === 'utime') {
    return value.toISOString().slice(11, 19);
  }

  return value.toISOString();
}

function serializeLatestTimestamp(row: LatestTimestampRow): {
  cdate: TimestampPredicateValue;
  ctime: TimestampPredicateValue;
} {
  return {
    cdate: serializeTimestampPredicateValue('cdate', row.cdate),
    ctime: serializeTimestampPredicateValue('ctime', row.ctime),
  };
}

function serializeTimestampPredicateValue(
  key: 'cdate' | 'ctime',
  value: unknown,
): TimestampPredicateValue {
  const serialized = serializeValue(key, value);
  if (serialized === null || serialized === undefined) return null;
  if (
    typeof serialized === 'string' ||
    typeof serialized === 'number' ||
    typeof serialized === 'boolean'
  ) {
    return serialized;
  }

  return String(serialized);
}
