import { env } from '../../config/env';
import { parameterSourceDb } from '../../config/parameter-source-database';
import {
  type LatestParameterValueQuery,
  type ListParameterValuesQuery,
  type ParameterValueInterval,
  type ParameterValuesTableDTO,
} from './parameter-values.types';

interface TableSummaryRow {
  schema_name: string;
  table_name: string;
  column_count: number | string;
  row_count: number | string;
}

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
};

function serializeRow(row: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [key, serializeValue(key, value)]),
  );
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
