import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockDb = jest.fn();
const mockFactorySourceDb = jest.fn();

jest.mock('../../src/config/database', () => ({
  db: mockDb,
}));

jest.mock('../../src/config/env', () => ({
  env: {
    FACTORY_DB_SCHEMA: 'dbo',
  },
}));

jest.mock('../../src/config/factory-source-database', () => ({
  factorySourceDb: mockFactorySourceDb,
  factorySourceTableName: jest.fn(() => 'dbo.fac_import'),
}));

import { eligibleFactoriesRepository } from '../../src/modules/eligible-factories/eligible-factories.repository';
import { resolveEligibleFactoryAddressForStorage } from '../../src/modules/eligible-factories/eligible-factory-source-hydration';

describe('eligibleFactoriesRepository.list', () => {
  const selectedFactoryRow = {
    id: 795,
    source_system: 'monitoring_point_forms',
    source_factory_id: '10180000125417',
    monitoring_point_form_id: null,
    factory_registration_no_new: '10180000125417',
    factory_registration_no_old: null,
    factory_name: 'โรงงานทดสอบ',
    factory_type_sequence: '02203',
    address: '197 หมู่ 5 ตำบล7 อำเภอ4 17150',
    province_name: 'ชัยนาท',
    industrial_estate_name: null,
    latitude: null,
    longitude: null,
    business_activity: null,
    operation_status: 'แจ้งประกอบแล้ว',
    capital_amount: null,
    machinery_horsepower: 10,
    production_capacity: null,
    wastewater_discharge_info: null,
    boiler_count: null,
    boiler_size_each: null,
    fuel_used: null,
    eia_assessment: null as string | null,
    eia_other: null as string | null,
    project_name: null as string | null,
    has_eia: null as boolean | null,
    selected_reason: null,
    selected_by: 1,
    selected_at: '2026-07-13T00:00:00.000Z',
    created_at: '2026-07-13T00:00:00.000Z',
    updated_at: '2026-07-13T00:00:00.000Z',
  };
  let selectedRowForTest = { ...selectedFactoryRow };

  beforeEach(() => {
    jest.clearAllMocks();
    selectedRowForTest = { ...selectedFactoryRow };

    const countQuery = {
      clearSelect: jest.fn().mockReturnThis(),
      clearOrder: jest.fn().mockReturnThis(),
      count: jest.fn().mockReturnThis(),
      first: jest.fn<() => Promise<{ total: number }>>().mockResolvedValue({ total: 1 }),
    };
    const rowsQuery = {
      orderBy: jest.fn().mockReturnThis(),
      then: jest.fn((resolve: (rows: (typeof selectedFactoryRow)[]) => unknown) =>
        Promise.resolve(resolve([selectedRowForTest])),
      ),
    };
    const baseQuery = {
      whereNull: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      clone: jest.fn().mockReturnValueOnce(countQuery).mockReturnValueOnce(rowsQuery),
    };

    mockDb.mockImplementation((tableName: unknown) => {
      if (tableName === 'eligible_factories') return baseQuery;
      throw new Error(`Unexpected local table: ${String(tableName)}`);
    });

    const sourceWhereBuilder = {
      whereIn: jest.fn().mockReturnThis(),
      orWhereIn: jest.fn().mockReturnThis(),
    };
    const facImportQuery = {
      where: jest.fn((callback: (builder: typeof sourceWhereBuilder) => void) => {
        callback(sourceWhereBuilder);
        return facImportQuery;
      }),
      timeout: jest.fn().mockReturnThis(),
      select: jest
        .fn<(...columns: string[]) => Promise<Array<Record<string, unknown>>>>()
        .mockResolvedValue([
          {
            FID: '10180000125417',
            FACREG: '10180000125417',
            DISPFACREG: '3-22(3)-1/41ชน',
            FADDR: '197',
            FMOO: '5',
            SOI: null,
            ROAD: null,
            PROV: 18,
            AMP: 4,
            TUMBOL: 7,
            ZIPCODE: '17150',
          },
        ]),
    };
    const administrativeAreaQuery = {
      whereIn: jest.fn().mockReturnThis(),
      timeout: jest.fn().mockReturnThis(),
      select: jest
        .fn<(...columns: string[]) => Promise<Array<Record<string, unknown>>>>()
        .mockResolvedValue([
          {
            PROV: 18,
            AMP: 4,
            TUMBOL: 7,
            TUMNAME: 'หาดอาษา',
            AMPNAME: 'สรรพยา',
          },
        ]),
    };

    mockFactorySourceDb.mockImplementation((tableName: unknown) => {
      if (tableName === 'dbo.fac_import') return facImportQuery;
      if (tableName === 'dbo.TUMBOL') return administrativeAreaQuery;
      throw new Error(`Unexpected factory-source table: ${String(tableName)}`);
    });
  });

  it('resolves selected-factory address names from FAC_IMPORT and TUMBOL', async () => {
    const result = await eligibleFactoriesRepository.list({});

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]?.address).toBe('197 หมู่ 5 ตำบลหาดอาษา อำเภอสรรพยา 17150');
  });

  it('returns the synchronized EIA assessment and project name from eligible factory data', async () => {
    selectedRowForTest = {
      ...selectedFactoryRow,
      eia_assessment: 'มี EHIA',
      eia_other: null,
      project_name: 'โครงการขยายกำลังผลิต',
      has_eia: true,
    };

    const result = await eligibleFactoriesRepository.list({});

    expect(result.rows[0]).toMatchObject({
      eia: 'มี EHIA',
      eiaOther: null,
      hasEia: true,
      projectName: 'โครงการขยายกำลังผลิต',
    });
  });

  it('preserves a readable address entered in the monitoring-point form', async () => {
    selectedRowForTest = {
      ...selectedFactoryRow,
      address: '197 หมู่ 5 ตำบลหาดอาษา อำเภอสรรพยา 17150 (ประตู 2)',
    };

    const result = await eligibleFactoriesRepository.list({});

    expect(result.rows[0]?.address).toBe('197 หมู่ 5 ตำบลหาดอาษา อำเภอสรรพยา 17150 (ประตู 2)');
  });

  it('omits numeric area codes when the TUMBOL master lookup is unavailable', async () => {
    mockFactorySourceDb.mockImplementation((tableName: unknown) => {
      if (tableName === 'dbo.fac_import') {
        const sourceWhereBuilder = {
          whereIn: jest.fn().mockReturnThis(),
          orWhereIn: jest.fn().mockReturnThis(),
        };
        const facImportQuery = {
          where: jest.fn((callback: (builder: typeof sourceWhereBuilder) => void) => {
            callback(sourceWhereBuilder);
            return facImportQuery;
          }),
          timeout: jest.fn().mockReturnThis(),
          select: jest
            .fn<(...columns: string[]) => Promise<Array<Record<string, unknown>>>>()
            .mockResolvedValue([
              {
                FID: '10180000125417',
                FACREG: '10180000125417',
                DISPFACREG: '3-22(3)-1/41ชน',
                FADDR: '197',
                FMOO: '5',
                SOI: null,
                ROAD: null,
                PROV: 18,
                AMP: 4,
                TUMBOL: 7,
                ZIPCODE: '17150',
              },
            ]),
        };
        return facImportQuery;
      }
      throw new Error('TUMBOL is unavailable');
    });

    const result = await eligibleFactoriesRepository.list({});

    expect(result.rows[0]?.address).toBe('197 หมู่ 5 17150');
    expect(result.rows[0]?.address).not.toContain('ตำบล7');
    expect(result.rows[0]?.address).not.toContain('อำเภอ4');
  });

  it('falls back to the stored row when FAC_IMPORT cannot be queried', async () => {
    mockFactorySourceDb.mockImplementation(() => {
      throw new Error('FAC_IMPORT is unavailable');
    });

    const result = await eligibleFactoriesRepository.list({});

    expect(result.rows[0]?.address).toBe('197 หมู่ 5 ตำบล7 อำเภอ4 17150');
  });

  it('resolves legacy numeric labels before persisting a form address', async () => {
    await expect(
      resolveEligibleFactoryAddressForStorage({
        sourceFactoryId: '10180000125417',
        factoryRegistrationNoNew: '10180000125417',
        address: '197 หมู่ 5 ตำบล7 อำเภอ4 17150 (ประตู 2)',
      }),
    ).resolves.toBe('197 หมู่ 5 ตำบลหาดอาษา อำเภอสรรพยา 17150 (ประตู 2)');
  });

  it('returns undefined instead of persisting numeric labels when names cannot be resolved', async () => {
    mockFactorySourceDb.mockImplementation((tableName: unknown) => {
      if (tableName === 'dbo.fac_import') {
        const sourceWhereBuilder = {
          whereIn: jest.fn().mockReturnThis(),
          orWhereIn: jest.fn().mockReturnThis(),
        };
        const query = {
          where: jest.fn((callback: (builder: typeof sourceWhereBuilder) => void) => {
            callback(sourceWhereBuilder);
            return query;
          }),
          timeout: jest.fn().mockReturnThis(),
          select: jest.fn().mockResolvedValue([
            {
              FID: '10180000125417',
              FACREG: '10180000125417',
              DISPFACREG: null,
              FADDR: '197',
              FMOO: '5',
              SOI: null,
              ROAD: null,
              PROV: 18,
              AMP: 4,
              TUMBOL: 7,
              ZIPCODE: '17150',
            },
          ] as never),
        };
        return query;
      }
      throw new Error('TUMBOL is unavailable');
    });

    await expect(
      resolveEligibleFactoryAddressForStorage({
        sourceFactoryId: '10180000125417',
        factoryRegistrationNoNew: '10180000125417',
        address: '197 หมู่ 5 ตำบล7 อำเภอ4 17150',
      }),
    ).resolves.toBeUndefined();
  });
});
