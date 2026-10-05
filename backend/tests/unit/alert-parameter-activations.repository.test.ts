import { afterAll, beforeEach, describe, expect, it, jest } from '@jest/globals';
import knex, { type Knex } from 'knex';

jest.mock('../../src/config/database', () => ({ db: jest.fn() }));
import { db } from '../../src/config/database';
import {
  listActiveAlertParameterActivations,
  retireAlertParameterActivations,
  syncAlertParameterActivations,
} from '../../src/modules/alert-emails/alert-parameter-activations.repository';

type Row = Record<string, unknown>;
const now = new Date('2026-10-05T02:00:00.000Z');
const before = new Date('2026-09-01T00:00:00.000Z');
const mockedDb = db as unknown as jest.Mock<(table: string) => unknown>;
const mssql = knex({ client: 'mssql' });
afterAll(async () => mssql.destroy());

function memoryDatabase(initial: Record<string, Row[]>) {
  const tables = initial;
  const operations: string[] = [];
  const inserts: Array<{ table: string; values: Row[] }> = [];
  const query = (table: string) => {
    const equal = (left: unknown, right: unknown) =>
      typeof left === 'string' && typeof right === 'string'
        ? left.toLowerCase() === right.toLowerCase()
        : left === right;
    let predicates: Array<(row: Row) => boolean> = [];
    let selectedColumns: string[] | undefined;
    const matches = (row: Row) => predicates.every((predicate) => predicate(row));
    const builder = {
      where(column: string | ((sub: unknown) => void), value?: unknown) {
        if (typeof column === 'function') {
          const alternatives: Array<(row: Row) => boolean> = [];
          const sub = {
            whereIn(field: string, values: unknown[]) {
              alternatives.push((row) => values.some((value) => equal(row[field], value)));
              return sub;
            },
            orWhereIn(field: string, values: unknown[]) {
              return sub.whereIn(field, values);
            },
          };
          column(sub);
          predicates.push((row) => alternatives.some((predicate) => predicate(row)));
        } else predicates.push((row) => equal(row[column], value));
        return builder;
      },
      whereNull(column: string) {
        predicates.push((row) => row[column] == null);
        return builder;
      },
      whereIn(column: string, values: unknown[]) {
        predicates.push((row) => values.some((value) => equal(row[column], value)));
        return builder;
      },
      orderBy() {
        return builder;
      },
      forUpdate() {
        operations.push(`lock:${table}`);
        return builder;
      },
      select(...columns: string[]) {
        selectedColumns = columns;
        return builder;
      },
      then(resolve: (value: Row[]) => unknown, reject?: (error: unknown) => unknown) {
        if (!tables[table])
          return Promise.reject(new Error(`Missing table ${table}`)).then(resolve, reject);
        const rows = tables[table]
          .filter(matches)
          .map((row) =>
            selectedColumns
              ? Object.fromEntries(selectedColumns.map((column) => [column, row[column]]))
              : row,
          );
        return Promise.resolve(rows).then(resolve, reject);
      },
      async update(value: Row) {
        operations.push(`update:${table}`);
        const rows = tables[table].filter(matches);
        for (const row of rows) Object.assign(row, value);
        return rows.length;
      },
      async insert(value: Row | Row[]) {
        operations.push(`insert:${table}`);
        inserts.push({ table, values: Array.isArray(value) ? value : [value] });
        for (const row of Array.isArray(value) ? value : [value]) {
          tables[table].push({ id: tables[table].length + 1, ...row });
        }
      },
    };
    return builder;
  };
  return { trx: query as unknown as Knex.Transaction, query, tables, operations, inserts };
}

function fixture() {
  return memoryDatabase({
    cems_wpms_connected_measurement_points: [
      { id: 7, point_code: 'S1', point_name: 'Station 1', connected_at: before },
    ],
    device_connection_configs: [{ id: 11, station_id: 'S1', request_id: null }],
    device_measurement_channels: [{ config_id: 11, data_type: 'CO (ppm)', test_mode: false }],
    alert_parameter_activations: [],
  });
}

describe('alert parameter activation persistence', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('persists a new registration with UTC Date bindings and keeps the baseline on the next revision', async () => {
    const memory = fixture();
    await syncAlertParameterActivations(memory.trx, ['S1'], { now });
    expect(memory.tables.alert_parameter_activations).toEqual([
      expect.objectContaining({
        connected_point_id: 7,
        parameter_code: 'co',
        unit: 'ppm',
        activated_at: now,
      }),
    ]);
    await syncAlertParameterActivations(memory.trx, ['S1'], {
      now: new Date('2026-10-06T02:00:00Z'),
    });
    expect(memory.tables.alert_parameter_activations).toHaveLength(1);
    expect(memory.tables.alert_parameter_activations[0].activated_at).toEqual(now);
  });

  it('never activates a new parameter before a future verified point connection time', async () => {
    const memory = fixture();
    const connectedAt = new Date('2026-10-06T02:00:00Z');
    memory.tables.cems_wpms_connected_measurement_points[0].connected_at = connectedAt;
    await syncAlertParameterActivations(memory.trx, ['S1'], { now });
    expect(memory.tables.alert_parameter_activations[0].activated_at).toEqual(connectedAt);
  });

  it('keeps a proven carry baseline when the replacement point has a future connection timestamp', async () => {
    const memory = fixture();
    memory.tables.cems_wpms_connected_measurement_points[0].connected_at = new Date(
      '2026-10-06T02:00:00Z',
    );
    memory.tables.alert_parameter_activations.push({
      id: 1,
      connected_point_id: 6,
      parameter_code: 'co',
      unit: 'ppm',
      activated_at: before,
    });
    await syncAlertParameterActivations(memory.trx, ['S1'], { now, carryFromPointId: 6 });
    expect(memory.tables.alert_parameter_activations[1].activated_at).toEqual(before);
  });

  it('fails before registry writes when the connected point timestamp is invalid', async () => {
    const memory = fixture();
    memory.tables.cems_wpms_connected_measurement_points[0].connected_at = 'invalid';
    await expect(syncAlertParameterActivations(memory.trx, ['S1'], { now })).rejects.toThrow(
      'Invalid connected point timestamp',
    );
    expect(memory.tables.alert_parameter_activations).toEqual([]);
  });

  it('does not invent an activation date for a legacy point with no verified connection time', async () => {
    const memory = fixture();
    memory.tables.cems_wpms_connected_measurement_points[0].connected_at = null;
    await syncAlertParameterActivations(memory.trx, ['S1'], { now });
    expect(memory.tables.alert_parameter_activations).toEqual([]);
  });

  it('persists 600 distinct registrations without any insert reaching the SQL Server parameter limit', async () => {
    const memory = fixture();
    memory.tables.device_connection_configs = Array.from({ length: 3 }, (_, index) => ({
      id: 11 + index,
      station_id: 'S1',
      request_id: null,
    }));
    memory.tables.device_measurement_channels = Array.from({ length: 600 }, (_, index) => ({
      config_id: 11 + Math.floor(index / 200),
      data_type: `P${index} (ppm)`,
      test_mode: false,
    }));
    await syncAlertParameterActivations(memory.trx, ['S1'], { now });
    expect(memory.tables.alert_parameter_activations).toHaveLength(600);
    for (const insert of memory.inserts) {
      const compiled = mssql(insert.table).insert(insert.values).toSQL();
      expect(compiled.bindings.length).toBeLessThan(2100);
    }
    expect(
      new Set(memory.tables.alert_parameter_activations.map((row) => row.parameter_code)).size,
    ).toBe(600);
  });

  it('ends test-only episodes and starts a fresh baseline when reporting resumes', async () => {
    const memory = fixture();
    memory.tables.alert_parameter_activations.push({
      id: 1,
      connected_point_id: 7,
      parameter_code: 'co',
      unit: 'ppm',
      activated_at: before,
    });
    memory.tables.device_measurement_channels[0].test_mode = true;
    await syncAlertParameterActivations(memory.trx, ['S1'], { now });
    expect(memory.tables.alert_parameter_activations[0].deactivated_at).toEqual(now);
    memory.tables.device_measurement_channels[0].test_mode = false;
    await syncAlertParameterActivations(memory.trx, ['S1'], { now });
    expect(memory.tables.alert_parameter_activations[1].activated_at).toEqual(now);
  });

  it('retains the episode when another normal device still measures the same unit', async () => {
    const memory = fixture();
    memory.tables.alert_parameter_activations.push({
      id: 1,
      connected_point_id: 7,
      parameter_code: 'co',
      unit: 'ppm',
      activated_at: before,
    });
    memory.tables.device_measurement_channels.push({
      config_id: 11,
      data_type: 'CO (ppm)',
      test_mode: false,
    });
    memory.tables.device_measurement_channels[0].test_mode = true;
    await syncAlertParameterActivations(memory.trx, ['S1'], { now });
    expect(memory.tables.alert_parameter_activations[0].deactivated_at).toBeUndefined();
    expect(memory.tables.alert_parameter_activations).toHaveLength(1);
  });

  it('matches a lowercase request to the uppercase station selected by case-insensitive SQL', async () => {
    const memory = fixture();
    await syncAlertParameterActivations(memory.trx, ['s1'], { now });
    expect(memory.tables.alert_parameter_activations).toHaveLength(1);
  });

  it('uses the legacy point name when point_code is an empty string', async () => {
    const memory = fixture();
    memory.tables.cems_wpms_connected_measurement_points[0].point_code = '';
    memory.tables.cems_wpms_connected_measurement_points[0].point_name = 'S1';
    await syncAlertParameterActivations(memory.trx, ['s1'], { now });
    expect(memory.tables.alert_parameter_activations).toHaveLength(1);
  });

  it('retains conservative future backfill bounds and clamps retirement to a nonnegative episode', async () => {
    const memory = fixture();
    const future = new Date('2026-10-05T09:00:00Z');
    memory.tables.alert_parameter_activations.push({
      id: 1,
      connected_point_id: 7,
      parameter_code: 'co',
      unit: 'ppm',
      activated_at: future,
    });
    await syncAlertParameterActivations(memory.trx, ['S1'], { now });
    expect(memory.tables.alert_parameter_activations[0].activated_at).toEqual(future);
    memory.tables.device_measurement_channels[0].test_mode = true;
    await syncAlertParameterActivations(memory.trx, ['S1'], { now });
    expect(memory.tables.alert_parameter_activations[0].deactivated_at).toEqual(future);
  });

  it('clamps an explicitly retired previous point episode with a future conservative baseline', async () => {
    const memory = fixture();
    const future = new Date('2026-10-05T09:00:00Z');
    memory.tables.alert_parameter_activations.push({
      id: 1,
      connected_point_id: 6,
      parameter_code: 'co',
      unit: 'ppm',
      activated_at: future,
    });
    await retireAlertParameterActivations(memory.trx, [6], now);
    expect(memory.tables.alert_parameter_activations[0].deactivated_at).toEqual(future);
  });

  it('ignores request snapshots, deleted channels, unknown units, and stations without a live point', async () => {
    const memory = fixture();
    memory.tables.device_connection_configs[0].request_id = 2;
    await syncAlertParameterActivations(memory.trx, ['S1'], { now });
    expect(memory.tables.alert_parameter_activations).toEqual([]);
    memory.tables.device_connection_configs[0].request_id = null;
    memory.tables.device_measurement_channels[0].deleted_at = now;
    await syncAlertParameterActivations(memory.trx, ['S1'], { now });
    memory.tables.device_measurement_channels[0].deleted_at = null;
    memory.tables.device_measurement_channels[0].data_type = 'CO';
    await syncAlertParameterActivations(memory.trx, ['S1', 'unknown'], { now });
    expect(memory.tables.alert_parameter_activations).toEqual([]);
  });

  it('carries an explicitly approved continuous point baseline, then closes the old point episode', async () => {
    const memory = fixture();
    memory.tables.alert_parameter_activations.push({
      id: 1,
      connected_point_id: 6,
      parameter_code: 'co',
      unit: 'ppm',
      activated_at: before,
    });
    await syncAlertParameterActivations(memory.trx, ['S1'], { now, carryFromPointId: 6 });
    expect(memory.tables.alert_parameter_activations[1].activated_at).toEqual(before);
    expect(memory.tables.alert_parameter_activations[0].deactivated_at).toEqual(now);
  });

  it('locks the live point before device configurations and activation rows', async () => {
    const memory = fixture();
    await syncAlertParameterActivations(memory.trx, ['S1'], { now });
    expect(memory.operations.slice(0, 3)).toEqual([
      'lock:cems_wpms_connected_measurement_points',
      'lock:device_connection_configs',
      'lock:alert_parameter_activations',
    ]);
  });

  it('exposes only active parameter identities and fails if the registry is missing', async () => {
    const memory = fixture();
    memory.tables.alert_parameter_activations.push(
      { id: 1, connected_point_id: 7, parameter_code: 'co', unit: 'ppm', activated_at: before },
      {
        id: 2,
        connected_point_id: 7,
        parameter_code: 'co',
        unit: '%',
        activated_at: before,
        deactivated_at: now,
      },
    );
    mockedDb.mockImplementation(memory.query);
    expect(await listActiveAlertParameterActivations(7)).toEqual([
      { parameterCode: 'co', unit: 'ppm', activatedAt: before.toISOString() },
    ]);
    delete memory.tables.alert_parameter_activations;
    await expect(listActiveAlertParameterActivations(7)).rejects.toThrow('Missing table');
  });
});
