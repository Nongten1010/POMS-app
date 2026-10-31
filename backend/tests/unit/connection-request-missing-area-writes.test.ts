import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import knex, { type Knex } from 'knex';

const mockEnv = { FACTORY_DB_SCHEMA: 'dbo', FACTORY_PROFILE_MODE: 'legacy' };
const mockTransaction =
  jest.fn<(callback: (trx: Knex.Transaction) => Promise<unknown>) => Promise<unknown>>();
const mockSource = jest.fn();
jest.mock('../../src/config/env', () => ({ env: mockEnv }));
jest.mock('../../src/config/database', () => ({ db: { transaction: mockTransaction } }));
jest.mock('../../src/config/logger', () => ({ logger: { warn: jest.fn(), error: jest.fn() } }));
jest.mock('../../src/config/factory-source-database', () => ({
  factorySourceDb: mockSource,
  factorySourceTableName: () => 'dbo.Fac60k',
}));
jest.mock('../../src/config/parameter-source-database', () => ({ parameterSourceDb: jest.fn() }));
jest.mock('../../src/modules/factory-profiles/factory-profiles.repository', () => ({
  lockFactoryProfileInTransaction: jest.fn(async () => ({ revision: 1 })),
}));

import { connectionRequestsRepository } from '../../src/modules/connection-requests/connection-requests.repository';
import {
  CONNECTION_REQUEST_STATUS,
  type CreateConnectionRequestInput,
} from '../../src/modules/connection-requests/connection-requests.types';

const readableAddress = '7/507 หมู่ 6 ตำบลมาบยางพร อำเภอปลวกแดง จังหวัดระยอง 21140 (ประตู 2)';
const master = { PROV: 21, AMP: 6, TUMBOL: 5, AMPNAME: 'ปลวกแดง', TUMNAME: 'มาบยางพร' };

function insertedRow(query: Knex.Sql): Record<string, unknown> {
  const columns = /insert into \[[^\]]+\] \(([^)]+)\)/u
    .exec(query.sql)?.[1]
    .split(',')
    .map((column) => column.trim().replace(/^\[|\]$/gu, ''));
  if (!columns || columns.length !== query.bindings.length) {
    throw new Error('Unexpected insert shape in request fixture');
  }
  return Object.fromEntries(columns.map((column, index) => [column, query.bindings[index]]));
}

describe.each(['legacy', 'canonical'])('missing request area names in %s writes', (mode) => {
  let compiler: Knex;
  let writes: Array<{ table: string; row: Record<string, unknown> }>;

  beforeEach(() => {
    jest.clearAllMocks();
    mockEnv.FACTORY_PROFILE_MODE = mode;
    writes = [];
    compiler = knex({ client: 'mssql' });
    jest.spyOn(compiler.client, 'runner').mockImplementation(
      (builder: unknown) =>
        ({
          run: async () => {
            const query = (builder as Knex.QueryBuilder).toSQL();
            if (query.method === 'insert') {
              const table = /insert into \[([^\]]+)\]/u.exec(query.sql)?.[1];
              if (!table) throw new Error('Missing insert table');
              writes.push({ table, row: insertedRow(query) });
              if (table === 'cems_wpms_request_factory_snapshots')
                throw new Error('SNAPSHOT_CAPTURED');
              return [{ id: 1700 }];
            }
            if (query.method === 'first') {
              if (query.sql.includes('[last_sequence]')) return { last_sequence: 3 };
              // Supporting master geography intentionally disagrees with recorded request address.
              // Once address names are resolved, this source must not override the Rayong snapshot.
              return {
                id: 430,
                province_id: 1010,
                province_name: 'กรุงเทพมหานคร',
                province_region: 'ภาคกลาง',
              };
            }
            return query.method === 'update' ? 1 : [];
          },
        }) as never,
    );
    mockTransaction.mockImplementation(async (callback) => callback(compiler as Knex.Transaction));
    mockSource.mockImplementation((table) => ({
      where: jest.fn().mockReturnThis(),
      whereIn: jest.fn().mockReturnThis(),
      timeout: jest.fn().mockReturnThis(),
      select: jest.fn(async () => (table === 'dbo.TUMBOL' ? [master] : [])),
    }));
  });

  afterEach(async () => {
    await compiler.destroy();
  });

  it.each(
    [null, '   ', undefined].flatMap((blank) =>
      ['1021', undefined].map((provinceCode) => ({ blank, provinceCode })),
    ),
  )(
    'persists names from recorded address for split names $blank and province code $provinceCode',
    async ({ blank, provinceCode }) => {
      const input: CreateConnectionRequestInput = {
        factoryId: '82250600225587',
        factoryName: 'โรงงานทดสอบ',
        factoryRegistrationNo: '82250600225587',
        eligibleFactoryId: 430,
        ...(provinceCode === undefined ? {} : { provinceCode }),
        districtCode: null,
        subdistrictCode: null,
        ...(blank === undefined
          ? {}
          : { provinceName: blank, districtName: blank, subdistrictName: blank }),
        address: readableAddress,
        systemType: 'CEMS',
        contactName: 'ผู้ทดสอบ',
        contactPhone: '020000000',
        measurementPoints: [],
      };
      await expect(
        connectionRequestsRepository.create(
          input,
          42,
          CONNECTION_REQUEST_STATUS.PENDING_DESIGN_REVIEW,
        ),
      ).rejects.toThrow('SNAPSHOT_CAPTURED');
      expect(writes).toHaveLength(2);
      expect(writes[0]).toMatchObject({
        table: 'cems_wpms_connection_requests',
        row: { address: readableAddress, eligible_factory_id: 430 },
      });
      expect(writes[1]).toMatchObject({
        table: 'cems_wpms_request_factory_snapshots',
        row: {
          province_code: provinceCode ?? null,
          province_name: 'ระยอง',
          district_code: null,
          district_name: 'ปลวกแดง',
          subdistrict_code: null,
          subdistrict_name: 'มาบยางพร',
        },
      });
      expect(input.provinceName).toBe(blank);
      expect(input.districtName).toBe(blank);
      expect(input.address).toBe(readableAddress);
      if (provinceCode === undefined) expect(input).not.toHaveProperty('provinceCode');
      if (blank === undefined) {
        expect(input).not.toHaveProperty('provinceName');
        expect(input).not.toHaveProperty('districtName');
        expect(input).not.toHaveProperty('subdistrictName');
      }
    },
  );

  it('does not fall back to current-source province when the recorded address cannot be verified', async () => {
    const address = '7/507 หมู่ 6 ตำบลไม่มีในทะเบียน อำเภอปลวกแดง จังหวัดระยอง 21140';
    await expect(
      connectionRequestsRepository.create(
        {
          factoryId: '82250600225587',
          factoryName: 'โรงงานทดสอบ',
          factoryRegistrationNo: '82250600225587',
          eligibleFactoryId: 430,
          address,
          provinceName: null,
          districtName: null,
          subdistrictName: null,
          systemType: 'CEMS',
          contactName: 'ผู้ทดสอบ',
          contactPhone: '020000000',
          measurementPoints: [],
        },
        42,
        CONNECTION_REQUEST_STATUS.PENDING_DESIGN_REVIEW,
      ),
    ).rejects.toThrow('SNAPSHOT_CAPTURED');
    expect(writes[0].row.address).toBe(address);
    expect(writes[1].row).toMatchObject({
      province_name: null,
      province_code: null,
      district_name: null,
      subdistrict_name: null,
      region_name: null,
    });
  });

  it('keeps the supporting source fallback for requests with no recorded administrative geography', async () => {
    await expect(
      connectionRequestsRepository.create(
        {
          factoryId: '82250600225587',
          factoryName: 'โรงงานทดสอบ',
          factoryRegistrationNo: '82250600225587',
          eligibleFactoryId: 430,
          address: '7/507 หมู่ 6 ถนนโรงงาน 21140',
          systemType: 'CEMS',
          contactName: 'ผู้ทดสอบ',
          contactPhone: '020000000',
          measurementPoints: [],
        },
        42,
        CONNECTION_REQUEST_STATUS.PENDING_DESIGN_REVIEW,
      ),
    ).rejects.toThrow('SNAPSHOT_CAPTURED');
    expect(writes[1].row).toMatchObject({
      province_name: 'กรุงเทพมหานคร',
      province_code: 1010,
      region_name: 'ภาคกลาง',
    });
    expect(mockSource).not.toHaveBeenCalled();
  });

  it('rejects a full recorded address lookup outage before writing a request or snapshot', async () => {
    mockSource.mockImplementation(() => {
      throw new Error('Synthetic source outage');
    });
    await expect(
      connectionRequestsRepository.create(
        {
          factoryId: '82250600225587',
          factoryName: 'โรงงานทดสอบ',
          factoryRegistrationNo: '82250600225587',
          eligibleFactoryId: 430,
          address: readableAddress,
          systemType: 'CEMS',
          contactName: 'ผู้ทดสอบ',
          contactPhone: '020000000',
          measurementPoints: [],
        },
        42,
        CONNECTION_REQUEST_STATUS.PENDING_DESIGN_REVIEW,
      ),
    ).rejects.toMatchObject({
      statusCode: 503,
      code: 'FACTORY_AREA_LOOKUP_UNAVAILABLE',
    });
    expect(mockTransaction).not.toHaveBeenCalled();
    expect(writes).toEqual([]);
  });
});
