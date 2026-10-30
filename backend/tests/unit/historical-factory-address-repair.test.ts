import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import knex, { type Knex } from 'knex';

const mockEnv = { FACTORY_DB_SCHEMA: 'dbo', FACTORY_PROFILE_MODE: 'legacy' };
const mockSourceDb = jest.fn();
jest.mock('../../src/config/env', () => ({ env: mockEnv }));
jest.mock('../../src/config/factory-source-database', () => ({ factorySourceDb: mockSourceDb }));

import {
  HISTORICAL_ADDRESS_REPAIRS,
  up,
  down,
} from '../../src/db/migrations/0152_repair_historical_factory_address_names';
import { HISTORICAL_ADDRESS_BACKUP } from '../../src/db/migrations/0151_create_historical_address_repair_backup';

describe.each(['legacy', 'canonical'])('historical factory address repair in %s mode', (mode) => {
  let sqlDb: Knex;
  let database: Knex;
  let queries: Array<Knex.Sql & { transaction: number }>;
  let rows: Map<string, Record<string, unknown>>;
  let masters: Array<Record<string, unknown>>;
  let failUpdate: boolean;
  let transactionNo: number;

  beforeEach(() => {
    jest.clearAllMocks();
    mockEnv.FACTORY_PROFILE_MODE = mode;
    queries = [];
    failUpdate = false;
    transactionNo = 0;
    rows = new Map(
      HISTORICAL_ADDRESS_REPAIRS.map((repair) => [
        `${repair.table}:${repair.id}`,
        {
          address: repair.originalAddress,
          registration: repair.registration,
          province_name: repair.provinceName,
          status: repair.status,
          deleted_at: repair.deleted ? '2026-10-06T00:00:00.1234567' : null,
        },
      ]),
    );
    masters = HISTORICAL_ADDRESS_REPAIRS.map((repair) => ({
      PROV: repair.provinceCode,
      AMP: repair.districtCode,
      TUMBOL: repair.subdistrictCode,
      TUMNAME: repair.subdistrictName,
      AMPNAME: repair.districtName,
    }));
    mockSourceDb.mockImplementation(() => ({
      whereIn: jest.fn().mockReturnThis(),
      timeout: jest.fn().mockReturnThis(),
      select: jest.fn(async () => masters),
    }));
    sqlDb = knex({ client: 'mssql' });
    jest.spyOn(sqlDb.client, 'runner').mockImplementation(
      (builder: unknown) =>
        ({
          run: async () => {
            const query = (builder as Knex.QueryBuilder).toSQL();
            queries.push({ ...query, transaction: transactionNo });
            if (query.method === 'first') {
              const table = /from \[([^\]]+)\]/u.exec(query.sql)?.[1];
              return table === HISTORICAL_ADDRESS_BACKUP
                ? undefined
                : rows.get(`${table}:${query.bindings.at(-1)}`);
            }
            return query.method === 'update' ? (failUpdate ? 0 : 1) : [];
          },
        }) as never,
    );
    database = Object.assign((table: string) => sqlDb(table), {
      raw: sqlDb.raw.bind(sqlDb),
      transaction: async (callback: (trx: Knex) => Promise<void>) => {
        transactionNo++;
        return callback(sqlDb);
      },
    }) as unknown as Knex;
  });

  afterEach(async () => {
    await sqlDb.destroy();
  });

  it('repairs exactly the reviewed 18 rows and preserves deleted/canceled state and timestamps', async () => {
    await up(database);
    const updates = queries.filter((query) => query.method === 'update');
    const backups = queries.filter((query) =>
      query.sql.startsWith(`insert into [${HISTORICAL_ADDRESS_BACKUP}]`),
    );
    expect(updates).toHaveLength(18);
    expect(backups).toHaveLength(18);
    for (const repair of HISTORICAL_ADDRESS_REPAIRS) {
      const update = updates.find(
        (query) =>
          query.sql.startsWith(`update [${repair.table}]`) && query.bindings[1] === repair.id,
      );
      if (!update) throw new Error(`Missing repair ${repair.table}:${repair.id}`);
      expect(update.sql.split(' where ')[0]).toBe(`update [${repair.table}] set [address] = ?`);
      expect(update.bindings).toEqual(
        expect.arrayContaining([
          repair.resolvedAddress,
          repair.originalAddress,
          repair.registration,
        ]),
      );
      expect(update.sql).toContain(repair.deleted ? '[deleted_at] = ?' : '[deleted_at] is null');
      if (repair.deleted) expect(update.bindings).toContain('2026-10-06T00:00:00.1234567');
      if (repair.table === 'cems_wpms_connection_requests') {
        expect(update.sql).toContain('[status] = ?');
        expect(update.bindings).toContain('CANCELED');
      } else {
        expect(update.sql).toContain('[province_name] = ?');
        expect(update.bindings).toContain(repair.provinceName);
      }
      const backup = backups.find(
        (query) => query.bindings.includes(repair.table) && query.bindings.includes(repair.id),
      );
      expect(backup?.bindings).toEqual(
        expect.arrayContaining([repair.originalAddress, repair.resolvedAddress]),
      );
      if (repair.deleted) expect(backup?.bindings).toContain('2026-10-06T00:00:00.1234567');
    }
    const factory = updates.find(
      (query) => query.sql.startsWith('update [eligible_factories]') && query.bindings[1] === '17',
    );
    const form = updates.find(
      (query) =>
        query.sql.startsWith('update [factory_monitoring_point_forms]') &&
        query.bindings[1] === '14',
    );
    expect(factory?.transaction).toBe(form?.transaction);
    expect(
      updates.some((query) =>
        /\[(?:factories|factory_profiles|factory_profile_events)\]/u.test(query.sql),
      ),
    ).toBe(false);
    const reads = queries.filter(
      (query) => query.method === 'first' && !query.sql.includes(`[${HISTORICAL_ADDRESS_BACKUP}]`),
    );
    expect(reads).toHaveLength(18);
    expect(
      reads.every((query) => query.sql.includes('CONVERT(VARCHAR(33), [deleted_at], 126)')),
    ).toBe(true);
  });

  it('rejects master names that no longer match the reviewed historical location before writing', async () => {
    masters[0] = { ...masters[0], TUMNAME: 'ชื่อที่ยังไม่ตรวจยืนยัน' };
    await expect(up(database)).rejects.toThrow(/Ambiguous historical|Cannot verify historical/u);
    expect(queries.some((query) => query.method === 'update')).toBe(false);
  });

  it('does not overwrite a historical address changed since the audit', async () => {
    const first = HISTORICAL_ADDRESS_REPAIRS[0];
    rows.set(`${first.table}:${first.id}`, {
      ...rows.get(`${first.table}:${first.id}`),
      address: 'Updated by owner',
    });
    await expect(up(database)).rejects.toThrow('Historical address changed');
    expect(queries.some((query) => query.method === 'update')).toBe(false);
  });

  it('does not modify a factory that was restored after the audit', async () => {
    const first = HISTORICAL_ADDRESS_REPAIRS[0];
    rows.set(`${first.table}:${first.id}`, {
      ...rows.get(`${first.table}:${first.id}`),
      deleted_at: null,
    });
    await expect(up(database)).rejects.toThrow('Historical address changed');
    expect(queries.some((query) => query.method === 'update')).toBe(false);
  });

  it('does not modify a canceled request that was reopened after the audit', async () => {
    const request = HISTORICAL_ADDRESS_REPAIRS.find(
      (repair) => repair.table === 'cems_wpms_connection_requests',
    );
    if (!request) throw new Error('Missing canceled request fixture');
    rows.set(`${request.table}:${request.id}`, {
      ...rows.get(`${request.table}:${request.id}`),
      status: 'PENDING_REVIEW',
    });
    await expect(up(database)).rejects.toThrow('Historical address changed');
    expect(queries.some((query) => query.method === 'update')).toBe(false);
  });

  it('makes no updates or backup duplicates when all reviewed addresses are already repaired', async () => {
    for (const repair of HISTORICAL_ADDRESS_REPAIRS) {
      rows.set(`${repair.table}:${repair.id}`, {
        ...rows.get(`${repair.table}:${repair.id}`),
        address: repair.resolvedAddress,
      });
    }
    await up(database);
    expect(queries.some((query) => query.method === 'update' || query.method === 'insert')).toBe(
      false,
    );
  });

  it('rejects an update race before recording a backup for a change that did not happen', async () => {
    failUpdate = true;
    await expect(up(database)).rejects.toThrow('Historical address changed');
    expect(queries.some((query) => query.method === 'insert')).toBe(false);
  });

  it('requires forward recovery instead of reverting addresses to codes', async () => {
    await expect(down()).rejects.toThrow('irreversible');
  });
});
