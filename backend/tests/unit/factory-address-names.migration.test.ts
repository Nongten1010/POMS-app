import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import knex, { type Knex } from 'knex';

const mockSourceDb = jest.fn();
jest.mock('../../src/config/env', () => ({ env: { FACTORY_DB_SCHEMA: 'dbo' } }));
jest.mock('../../src/config/logger', () => ({ logger: { warn: jest.fn() } }));
jest.mock('../../src/config/factory-source-database', () => ({
  factorySourceDb: mockSourceDb,
  factorySourceTableName: () => 'dbo.fac_import',
}));

import { up, down } from '../../src/db/migrations/0150_repair_factory_address_names';
import { ADDRESS_NAMES_REPAIR_BACKUP } from '../../src/db/migrations/0149_create_factory_address_names_repair_backup';

const address = '7/507 หมู่ 6 ตำบล5 อำเภอ6 จังหวัดระยอง 21140 (ประตู 2)';
const resolved = '7/507 หมู่ 6 ตำบลมาบยางพร อำเภอปลวกแดง จังหวัดระยอง 21140 (ประตู 2)';
const tables = [
  'eligible_factories',
  'factory_profiles',
  'cems_wpms_connected_measurement_points',
  'factory_monitoring_point_forms',
  'cems_wpms_connection_requests',
];

describe('legacy numeric factory address data repair', () => {
  let sqlDb: Knex;
  let queries: Knex.Sql[];
  let rows: Map<string, Array<Record<string, unknown>>>;
  let conflictTable: string | null;
  let database: Knex;
  const transaction = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    queries = [];
    conflictTable = null;
    rows = new Map(
      tables.map((table, index) => [
        table,
        [
          {
            id: index + 1,
            eligibleFactoryId: 1,
            address,
            sourceFactoryId: 'TEST',
            factoryRegistrationNoNew: 'TEST',
            provinceName: 'ระยอง',
            ...(table === 'factory_profiles'
              ? { revision: '3', factory_name: 'Reviewed name' }
              : {}),
          },
        ],
      ]),
    );
    sqlDb = knex({ client: 'mssql' });
    jest.spyOn(sqlDb.client, 'runner').mockImplementation(
      (builder: unknown) =>
        ({
          run: async () => {
            const compiled = (builder as Knex.QueryBuilder).toSQL();
            queries.push(compiled);
            if (compiled.method === 'first') return undefined;
            if (compiled.method === 'select') {
              const table = /from \[([^\]]+)\]/u.exec(compiled.sql)?.[1] ?? '';
              return rows.get(table) ?? [];
            }
            if (compiled.method === 'update')
              return compiled.sql.startsWith(`update [${conflictTable}]`) ? 0 : 1;
            return [];
          },
        }) as never,
    );
    transaction.mockImplementation(async (callback) =>
      (callback as (trx: Knex) => Promise<void>)(sqlDb),
    );
    database = Object.assign((table: string) => sqlDb(table), { transaction }) as unknown as Knex;
    mockSourceDb.mockImplementation((table) => ({
      where() {
        return this;
      },
      whereIn() {
        return this;
      },
      timeout() {
        return this;
      },
      async select() {
        return table === 'dbo.TUMBOL'
          ? [{ PROV: 21, AMP: 6, TUMBOL: 5, TUMNAME: 'มาบยางพร', AMPNAME: 'ปลวกแดง' }]
          : [{ FID: 'TEST', PROV: 21, AMP: 6, TUMBOL: 5 }];
      },
    }));
  });

  afterEach(async () => {
    await sqlDb.destroy();
  });

  it('repairs all five base tables atomically per factory and backs up exact old values', async () => {
    await up(database);
    const updates = queries.filter((query) => query.method === 'update');
    expect(updates).toHaveLength(5);
    expect(transaction).toHaveBeenCalledTimes(1);
    expect(updates.map((query) => query.sql.split(' set ')[0])).toEqual(
      tables.map((table) => `update [${table}]`),
    );
    for (const update of updates) {
      expect(update.bindings).toContain(address);
      expect(update.bindings).toContain(resolved);
      expect(update.sql).toMatch(/where \[id\] = \? and \[(address|factory_address)\] = \?/u);
      if (!update.sql.startsWith('update [factory_profiles]')) {
        expect(update.sql).toContain('[deleted_at] is null');
        expect(update.sql).not.toContain('[updated_at]');
      }
    }
    const backups = queries.filter((query) =>
      query.sql.startsWith(`insert into [${ADDRESS_NAMES_REPAIR_BACKUP}]`),
    );
    expect(backups).toHaveLength(5);
    expect(
      backups.every(
        (query) => query.bindings.includes(address) && query.bindings.includes(resolved),
      ),
    ).toBe(true);
    expect(queries.some((query) => /\[factories\]/u.test(query.sql))).toBe(false);
  });

  it('increments canonical revision and records a full before/after event', async () => {
    await up(database);
    const update = queries.find((query) => query.sql.startsWith('update [factory_profiles]'));
    if (!update) throw new Error('Expected a profile repair');
    expect(update.sql).toContain('and [revision] = ?');
    expect(update.bindings).toEqual(expect.arrayContaining(['3', '4']));
    const event = queries.find((query) =>
      query.sql.startsWith('insert into [factory_profile_events]'),
    );
    if (!event) throw new Error('Expected a profile event');
    expect(event.bindings).toContain('address-area-names-backfill-0150');
    const snapshots = event.bindings
      .filter((value): value is string => typeof value === 'string' && value.startsWith('{'))
      .map((value) => JSON.parse(value));
    expect(snapshots).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ factory_name: 'Reviewed name', address }),
        expect.objectContaining({ factory_name: 'Reviewed name', address: resolved }),
      ]),
    );
  });

  it('makes no writes for readable addresses on a rerun', async () => {
    rows.forEach((items) =>
      items.forEach((row) => {
        row.address = resolved;
      }),
    );
    await up(database);
    expect(transaction).not.toHaveBeenCalled();
    expect(mockSourceDb).not.toHaveBeenCalled();
  });

  it('fails before any local writes when names cannot be verified', async () => {
    mockSourceDb.mockImplementation(() => {
      throw new Error('source unavailable');
    });
    await expect(up(database)).rejects.toThrow('source unavailable');
    expect(transaction).not.toHaveBeenCalled();
  });

  it('does not persist the display fallback when the TUMBOL master has no matching names', async () => {
    mockSourceDb.mockImplementation((table) => ({
      where() {
        return this;
      },
      whereIn() {
        return this;
      },
      timeout() {
        return this;
      },
      async select() {
        return table === 'dbo.TUMBOL' ? [] : [{ FID: 'TEST', PROV: 21, AMP: 6, TUMBOL: 5 }];
      },
    }));
    await expect(up(database)).rejects.toThrow('Cannot safely resolve');
    expect(transaction).not.toHaveBeenCalled();
  });

  it('aborts the factory transaction when an address changed concurrently', async () => {
    conflictTable = 'eligible_factories';
    await expect(up(database)).rejects.toThrow('Address changed during repair');
    expect(queries.filter((query) => query.method === 'insert')).toHaveLength(0);
  });

  it('requires a reviewed forward migration instead of reintroducing numeric names', async () => {
    await expect(down()).rejects.toThrow('irreversible');
  });
});
