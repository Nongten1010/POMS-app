import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { createHash } from 'node:crypto';
import knex, { type Knex } from 'knex';

const mockEnv = { FACTORY_DB_SCHEMA: 'dbo', FACTORY_PROFILE_MODE: 'legacy' };
const mockSource = jest.fn();
jest.mock('../../src/config/env', () => ({ env: mockEnv }));
jest.mock('../../src/config/factory-source-database', () => ({ factorySourceDb: mockSource }));
import { up, down } from '../../src/db/migrations/0154_repair_missing_factory_area_names';
import {
  up as createBackup,
  down as dropBackup,
  FACTORY_AREA_NAMES_BACKUP,
} from '../../src/db/migrations/0153_create_factory_area_names_repair_backup';
import {
  resolveMissingFactoryAreaNames0154 as resolve,
  localProvinceCodes0154,
  type AreaMaster0154,
} from '../../src/db/data-repairs/factory-area-names-0154';

const SNAPSHOTS = 'cems_wpms_request_factory_snapshots';
const REQUESTS = 'cems_wpms_connection_requests';
const NAME_FIELDS = ['province_name', 'district_name', 'subdistrict_name'] as const;
const masters: AreaMaster0154[] = [
  { PROV: 21, AMP: 6, TUMBOL: 5, AMPNAME: 'ปลวกแดง', TUMNAME: 'มาบยางพร' },
  { PROV: 21, AMP: 1, TUMBOL: 3, AMPNAME: 'เมืองระยอง', TUMNAME: 'ตะพง' },
  { PROV: 25, AMP: 2, TUMBOL: 11, AMPNAME: 'กบินทร์บุรี', TUMNAME: 'หนองกี่' },
  { PROV: 24, AMP: 1, TUMBOL: 10, AMPNAME: 'เมืองฉะเชิงเทรา', TUMNAME: 'คลองนครเนื่องเขต' },
  { PROV: 31, AMP: 23, TUMBOL: 3, AMPNAME: 'เฉลิมพระเกียรติ', TUMNAME: 'อีสานเขต' },
];
const local = localProvinceCodes0154([{ id: 777, name_th: 'ระยอง' }]);
const rayongAddress = '7/507 หมู่ 6 ตำบลมาบยางพร อำเภอปลวกแดง จังหวัดระยอง 21140';

function snapshot(overrides: Record<string, unknown> = {}) {
  return {
    id: '100',
    request_id: '10376',
    province_name: 'ระยอง',
    district_name: null,
    subdistrict_name: null,
    province_code: null,
    district_code: null,
    subdistrict_code: null,
    created_at: '2026-10-30T15:16:59.1234567',
    updated_at: '2026-10-30T15:16:59.1234567',
    deleted_at: null,
    ...overrides,
  };
}

describe('frozen 0154 recorded area resolver', () => {
  it.each([
    [
      '140/6 หมู่ 4 ซอยเขตประกอบการฯ ทีพีไอ ถนนสุขุมวิท ตำบลตะพง อำเภอเมืองระยอง จังหวัดระยอง 21000',
      'ระยอง',
      'เมืองระยอง',
      'ตะพง',
    ],
    [
      '444(เขตอุตสาหกรรมกบินทร์บุรี) หมู่ 9 ตำบลหนองกี่ อำเภอกบินทร์บุรี จังหวัดปราจีนบุรี 25110',
      'ปราจีนบุรี',
      'กบินทร์บุรี',
      'หนองกี่',
    ],
    [
      '99 หมู่ 17 ตำบลคลองนครเนื่องเขต อำเภอเมืองฉะเชิงเทรา จังหวัดฉะเชิงเทรา 24000',
      'ฉะเชิงเทรา',
      'เมืองฉะเชิงเทรา',
      'คลองนครเนื่องเขต',
    ],
    [
      '1 ตำบลอีสานเขต อำเภอเฉลิมพระเกียรติ จังหวัดบุรีรัมย์ 31110',
      'บุรีรัมย์',
      'เฉลิมพระเกียรติ',
      'อีสานเขต',
    ],
    ['7/507 หมู่ 6 ตำบลมาบยางพร อำเภอปลวกแดง จังหวัดระยอง21140', 'ระยอง', 'ปลวกแดง', 'มาบยางพร'],
  ])(
    'ignores estate เขต and preserves actual names in %s',
    (address, province, district, subdistrict) => {
      const result = resolve(
        {
          ...snapshot({ province_name: province }),
          table: SNAPSHOTS,
          deleted_at_exact: null,
          request_address: address,
        },
        NAME_FIELDS,
        masters,
        local,
      );
      expect(result.conflicts).toEqual([]);
      expect(result.patch).toEqual({ district_name: district, subdistrict_name: subdistrict });
    },
  );
  it('does not borrow current request location for a deleted province-only snapshot', () => {
    const result = resolve(
      {
        ...snapshot(),
        table: SNAPSHOTS,
        deleted_at_exact: '2026-09-01T12:00:00.1234567',
        request_address: rayongAddress,
      },
      NAME_FIELDS,
      [masters[0]],
      local,
    );
    expect(result.addressEvidenceAllowed).toBe(false);
    expect(result.addressEvidence).toBeNull();
    expect(result.patch).toEqual({});
  });
  it('can resolve deleted history from its own recorded codes without replacing its address', () => {
    const result = resolve(
      {
        ...snapshot({ province_code: '777', district_code: '6', subdistrict_code: '5' }),
        table: SNAPSHOTS,
        deleted_at_exact: '2026-09-01',
        request_address: 'ตำบลหนองกี่ อำเภอกบินทร์บุรี จังหวัดปราจีนบุรี',
      },
      NAME_FIELDS,
      masters,
      local,
    );
    expect(result.patch).toEqual({ district_name: 'ปลวกแดง', subdistrict_name: 'มาบยางพร' });
    expect(result.provinceCodes).toEqual(['21']);
  });
  it('leaves intentionally empty test forms unknown when they contain no recorded geography', () => {
    expect(
      resolve(
        { table: 'factory_monitoring_point_forms', id: '4', province_name: null, address: null },
        ['province_name'],
        masters,
        local,
      ).patch,
    ).toEqual({});
  });
  it('rejects recorded province/code conflicts rather than filling another name', () => {
    const result = resolve(
      {
        ...snapshot({ province_code: '24', district_code: '6', subdistrict_code: '5' }),
        table: SNAPSHOTS,
        deleted_at_exact: null,
      },
      NAME_FIELDS,
      masters,
      local,
    );
    expect(result.conflicts).toContain('PROVINCE_CONTEXT_CONFLICT');
    expect(result.patch).toEqual({});
  });
  it('fills only the unique name when subdistrict remains ambiguous', () => {
    const alternatives = [masters[0], { ...masters[0], TUMBOL: 6, TUMNAME: 'แม่น้ำคู้' }];
    const result = resolve(
      {
        ...snapshot({ province_name: null, province_code: '21', district_code: '6' }),
        table: SNAPSHOTS,
        deleted_at_exact: null,
      },
      NAME_FIELDS,
      alternatives,
      local,
    );
    expect(result.patch).toEqual({ province_name: 'ระยอง', district_name: 'ปลวกแดง' });
  });
});

describe.each(['legacy', 'canonical'])('0154 data repair in %s mode', (mode) => {
  let sql: Knex, database: Knex;
  let queries: Array<Knex.Sql & { transaction: number }>;
  let records: Map<string, Array<Record<string, unknown>>>;
  let backups: Array<Record<string, unknown>>;
  let transactionNo: number, inTransaction: boolean;
  let failCas: boolean,
    driftRow: boolean,
    driftParent: boolean,
    corruptAfter: boolean,
    corruptExistingName: boolean;
  const columns: Record<string, string[]> = {
    [SNAPSHOTS]: Object.keys(snapshot()),
    [REQUESTS]: [
      'id',
      'address',
      'factory_id',
      'request_no',
      'status',
      'created_at',
      'updated_at',
      'deleted_at',
    ],
    factory_monitoring_point_forms: ['id', 'province_name', 'address', 'updated_at', 'deleted_at'],
  };
  function evidence(row: Record<string, unknown>, table: string) {
    const all = Object.fromEntries(columns[table].map((field) => [field, row[field] ?? null]));
    const unchanged = Object.fromEntries(
      Object.entries(all).filter(([field]) => !NAME_FIELDS.some((name) => name === field)),
    );
    const hash = (value: unknown) =>
      createHash('sha256').update(JSON.stringify(value), 'utf16le').digest('hex').toUpperCase();
    return {
      ...row,
      repair_row_json: JSON.stringify(all),
      repair_row_hash: hash(all),
      repair_unchanged_hash: hash(unchanged),
      deleted_at_exact: row.deleted_at,
      created_at_exact: row.created_at,
      updated_at_exact: row.updated_at,
    };
  }
  beforeEach(() => {
    jest.clearAllMocks();
    mockEnv.FACTORY_PROFILE_MODE = mode;
    queries = [];
    backups = [];
    transactionNo = 0;
    inTransaction = false;
    failCas = false;
    driftRow = false;
    driftParent = false;
    corruptAfter = false;
    corruptExistingName = false;
    records = new Map([
      [SNAPSHOTS, [snapshot(), snapshot({ id: '101', deleted_at: '2026-09-01T00:00:00.1234567' })]],
      [
        REQUESTS,
        [
          {
            id: '10376',
            address: rayongAddress,
            factory_id: '82250600225587',
            request_no: 'CEMS-0254/2569',
            status: 'WAITING_CONNECTION',
            created_at: '2026-10-30T12:00:00.1234567',
            updated_at: '2026-10-30T12:00:00.1234567',
            deleted_at: null,
          },
        ],
      ],
      [
        'factory_monitoring_point_forms',
        [
          {
            id: '4',
            province_name: null,
            address: null,
            updated_at: '2026-01-01T00:00:00.1234567',
            deleted_at: null,
          },
        ],
      ],
    ]);
    mockSource.mockImplementation(() => ({
      select: jest.fn().mockReturnThis(),
      timeout: jest.fn(async () => {
        if (inTransaction) throw new Error('External lookup inside write transaction');
        return masters;
      }),
    }));
    sql = knex({ client: 'mssql' });
    jest.spyOn(sql.client, 'runner').mockImplementation(
      (builder: unknown) =>
        ({
          run: async () => {
            const compiled = (builder as Knex.QueryBuilder).toSQL();
            const statements = Array.isArray(compiled) ? compiled : [compiled];
            let result: unknown = [];
            for (const query of statements) {
              queries.push({ ...query, transaction: inTransaction ? transactionNo : 0 });
              if (query.sql.includes('[INFORMATION_SCHEMA].[COLUMNS]'))
                return Object.entries(columns).flatMap(([table, fields]) =>
                  fields.map((field, index) => ({
                    TABLE_NAME: table,
                    COLUMN_NAME: field,
                    ORDINAL_POSITION: index + 1,
                  })),
                );
              if (query.sql.includes('from [provinces]')) return [{ id: 777, name_th: 'ระยอง' }];
              const table = /\bfrom \[([^\]]+)\]/u.exec(query.sql)?.[1];
              if (table === REQUESTS) {
                const rows = (records.get(REQUESTS) || []).filter(
                  (row) =>
                    !query.bindings.length || String(row.id) === String(query.bindings.at(-1)),
                );
                return rows.map((row) => ({
                  ...row,
                  repair_context_json: JSON.stringify({
                    ...row,
                    ...(driftParent && inTransaction
                      ? { address: 'Changed by another writer' }
                      : {}),
                  }),
                }));
              }
              if (query.sql.startsWith(`insert into [${FACTORY_AREA_NAMES_BACKUP}]`)) {
                const fields =
                  /\(([^)]+)\)/u
                    .exec(query.sql)?.[1]
                    .match(/\[([^\]]+)\]/gu)
                    ?.map((field) => field.slice(1, -1)) || [];
                backups.push(
                  Object.fromEntries(fields.map((field, index) => [field, query.bindings[index]])),
                );
                return [];
              }
              if (query.method === 'update') {
                if (failCas) return 0;
                const target = /^update \[([^\]]+)\]/u.exec(query.sql)?.[1] || '';
                const set = query.sql.split(' set ')[1].split(' where ')[0];
                const fields = [...set.matchAll(/\[([^\]]+)\] = \?/gu)].map((match) => match[1]);
                const id = query.bindings[fields.length];
                const row = records.get(target)?.find((item) => String(item.id) === String(id));
                if (!row) return 0;
                for (const [index, field] of fields.entries()) row[field] = query.bindings[index];
                if (corruptAfter) row.updated_at = '2026-10-31T00:00:00.0000001';
                if (corruptExistingName) row.province_name = 'ปราจีนบุรี';
                return 1;
              }
              if (table === FACTORY_AREA_NAMES_BACKUP) return backups[0];
              if (table && records.has(table)) {
                const rows = (records.get(table) || []).filter(
                  (row) =>
                    query.method !== 'first' || String(row.id) === String(query.bindings.at(-1)),
                );
                const values = rows.map((row) =>
                  evidence(
                    {
                      ...row,
                      ...(driftRow && inTransaction
                        ? { updated_at: 'Concurrent modification' }
                        : {}),
                    },
                    table,
                  ),
                );
                return query.method === 'first' ? values[0] : values;
              }
              if (query.sql.includes('IF EXISTS') && backups.length)
                throw new Error('Backups must be retained');
            }
            return result;
          },
        }) as never,
    );
    database = Object.assign((table: string) => sql(table), {
      raw: sql.raw.bind(sql),
      transaction: async (callback: (trx: Knex) => Promise<void>) => {
        const before = structuredClone(records),
          saved = structuredClone(backups);
        transactionNo++;
        inTransaction = true;
        try {
          await callback(sql);
        } catch (error) {
          records = before;
          backups = saved;
          throw error;
        } finally {
          inTransaction = false;
        }
      },
    }) as unknown as Knex;
    Object.defineProperty(database, 'schema', { get: () => sql.schema });
  });
  afterEach(async () => {
    await sql.destroy();
  });
  it('backs up exact full rows before filling only verified name columns under parent locks and CAS', async () => {
    const before = structuredClone(records);
    await up(database);
    expect(backups).toHaveLength(1);
    expect(backups[0].original_row_json).toContain('2026-10-30T15:16:59.1234567');
    expect(backups[0].original_context_json).toContain('21:6:5');
    expect(backups[0].resolved_names_json).toBe(
      JSON.stringify({ district_name: 'ปลวกแดง', subdistrict_name: 'มาบยางพร' }),
    );
    const insertIndex = queries.findIndex((query) =>
      query.sql.startsWith(`insert into [${FACTORY_AREA_NAMES_BACKUP}]`),
    );
    const updateIndex = queries.findIndex((query) => query.method === 'update');
    expect(insertIndex).toBeLessThan(updateIndex);
    const update = queries[updateIndex];
    expect(update.sql.split(' where ')[0]).toBe(
      `update [${SNAPSHOTS}] set [district_name] = ?, [subdistrict_name] = ?`,
    );
    expect(update.sql).toContain("HASHBYTES('SHA2_256'");
    expect(update.sql).toContain('INCLUDE_NULL_VALUES, WITHOUT_ARRAY_WRAPPER');
    expect(update.sql).toContain('[updated_at]');
    expect(
      queries.some(
        (query) =>
          query.sql.includes(`[${REQUESTS}] AS [request] WITH (UPDLOCK, ROWLOCK)`) &&
          query.transaction === 1,
      ),
    ).toBe(true);
    expect(records.get(SNAPSHOTS)?.[1]).toEqual(before.get(SNAPSHOTS)?.[1]);
    expect(records.get('factory_monitoring_point_forms')).toEqual(
      before.get('factory_monitoring_point_forms'),
    );
    const changed = records.get(SNAPSHOTS)?.[0];
    expect(changed).toEqual({
      ...before.get(SNAPSHOTS)?.[0],
      district_name: 'ปลวกแดง',
      subdistrict_name: 'มาบยางพร',
    });
  });
  it.each(['\t', '\n', '\u00a0'])(
    'repairs the exact whitespace blank %p without altering timestamps',
    async (blank) => {
      const row = records.get(SNAPSHOTS)?.[0];
      if (!row) throw new Error('Missing fixture');
      row.district_name = blank;
      row.subdistrict_name = blank;
      await up(database);
      expect(backups).toHaveLength(1);
      expect(backups[0].original_row_json).toContain(JSON.stringify(blank));
      expect(records.get(SNAPSHOTS)?.[0].district_name).toBe('ปลวกแดง');
    },
  );
  it('is idempotent and retains the existing backup on rerun', async () => {
    await up(database);
    const original = structuredClone(backups);
    queries = [];
    await up(database);
    expect(backups).toEqual(original);
    expect(queries.some((query) => query.method === 'update' || query.method === 'insert')).toBe(
      false,
    );
  });
  it('rejects a target row changed after candidate planning before backup or update', async () => {
    driftRow = true;
    await expect(up(database)).rejects.toThrow('FACTORY_AREA_REPAIR_ROW_CHANGED');
    expect(backups).toEqual([]);
    expect(queries.some((query) => query.method === 'update')).toBe(false);
  });
  it('rejects a changed parent address under its row lock before any target write', async () => {
    driftParent = true;
    await expect(up(database)).rejects.toThrow('FACTORY_AREA_REPAIR_REQUEST_CONTEXT_CHANGED');
    expect(backups).toEqual([]);
  });
  it('rolls back a newly inserted backup if exact hash compare-and-set fails', async () => {
    failCas = true;
    await expect(up(database)).rejects.toThrow('FACTORY_AREA_REPAIR_COMPARE_AND_SET_FAILED');
    expect(backups).toEqual([]);
  });
  it('rolls back if any unrelated column was modified by a trigger or concurrent change', async () => {
    corruptAfter = true;
    const before = structuredClone(records);
    await expect(up(database)).rejects.toThrow('FACTORY_AREA_REPAIR_UNRELATED_COLUMNS_CHANGED');
    expect(backups).toEqual([]);
    expect(records).toEqual(before);
  });
  it('also preserves existing nonblank name columns excluded from the non-name hash', async () => {
    corruptExistingName = true;
    await expect(up(database)).rejects.toThrow('FACTORY_AREA_REPAIR_UNRELATED_COLUMNS_CHANGED');
    expect(backups).toEqual([]);
    expect(records.get(SNAPSHOTS)?.[0].province_name).toBe('ระยอง');
  });
  it('retains an earlier backup rather than overwriting its original evidence', async () => {
    backups.push({ entity_id: '100', original_row_json: 'retained-before-value' });
    await expect(up(database)).rejects.toThrow('FACTORY_AREA_REPAIR_BACKUP_ALREADY_EXISTS');
    expect(backups).toEqual([{ entity_id: '100', original_row_json: 'retained-before-value' }]);
    expect(queries.some((query) => query.method === 'update')).toBe(false);
  });
  it('creates the separate full-row backup schema and refuses dropping populated evidence', async () => {
    await createBackup(database);
    const ddl = queries.map((query) => query.sql).join('\n');
    for (const field of [
      'original_row_json',
      'original_context_json',
      'resolved_names_json',
      'original_row_hash',
      'unchanged_columns_hash',
    ])
      expect(ddl).toContain(field);
    backups.push({ entity_id: '100' });
    queries = [];
    await expect(dropBackup(database)).rejects.toThrow('retained');
    expect(queries.some((query) => query.sql.includes('THROW 51530'))).toBe(true);
    expect(queries.some((query) => query.sql.startsWith('DROP TABLE'))).toBe(false);
    await expect(down()).rejects.toThrow('forward migration');
  });
});
