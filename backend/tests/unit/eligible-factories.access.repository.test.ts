import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockDb = jest.fn();
const applyAssignedFactoryAccessFilter = jest.fn();

jest.mock('../../src/config/database', () => ({
  db: mockDb,
}));

jest.mock('../../src/config/factory-source-database', () => ({
  factorySourceDb: jest.fn(),
  factorySourceTableName: jest.fn(() => 'dbo.fac_import'),
}));

jest.mock('../../src/shared/utils/factory-access-query', () => ({
  applyAssignedFactoryAccessFilter,
}));

jest.mock('../../src/modules/eligible-factories/eligible-factory-source-hydration', () => ({
  hydrateEligibleFactoriesFromSource: jest.fn(async (rows: unknown[]) => rows),
}));

import { eligibleFactoriesRepository } from '../../src/modules/eligible-factories/eligible-factories.repository';

describe('eligibleFactoriesRepository access filtering', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  function mockEligibleFactoriesQueries() {
    const countQuery = {
      clearSelect: jest.fn().mockReturnThis(),
      clearOrder: jest.fn().mockReturnThis(),
      count: jest.fn().mockReturnThis(),
      first: jest.fn<() => Promise<{ total: number }>>().mockResolvedValue({ total: 0 }),
    };
    const rowsQuery = {
      orderBy: jest.fn().mockReturnThis(),
      then: jest.fn((resolve: (rows: unknown[]) => unknown) => Promise.resolve(resolve([]))),
    };
    const baseQuery = {
      leftJoin: jest.fn().mockReturnThis(),
      whereNull: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      whereIn: jest.fn().mockReturnThis(),
      whereExists: jest.fn().mockReturnThis(),
      whereRaw: jest.fn().mockReturnThis(),
      clone: jest.fn().mockReturnValueOnce(countQuery).mockReturnValueOnce(rowsQuery),
    };
    const monitoringPointQuery = {
      whereIn: jest.fn().mockReturnThis(),
      whereNull: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      then: jest.fn((resolve: (rows: unknown[]) => unknown) => Promise.resolve(resolve([]))),
    };

    mockDb.mockImplementation((tableName: unknown) => {
      if (tableName === 'eligible_factories as ef') return baseQuery;
      if (tableName === 'factory_monitoring_points') return monitoringPointQuery;
      if (tableName === 'industrial_estates') {
        return {
          modify: jest.fn().mockReturnValue({
            select: jest
              .fn<() => Promise<Array<{ id: number; code: string; name_th: string }>>>()
              .mockResolvedValue([{ id: 1, code: 'MTP', name_th: 'นิคมอุตสาหกรรมมาบตาพุด' }]),
          }),
        };
      }
      throw new Error(`Unexpected table ${String(tableName)}`);
    });

    return { baseQuery };
  }

  it('filters selected eligible factories by province for list/count queries', async () => {
    const { baseQuery } = mockEligibleFactoriesQueries();

    await eligibleFactoriesRepository.list({}, {
      actorUserId: 42,
      scope: { scope: 'IN_PROVINCE', province: 'ระยอง', region: null },
    });

    expect(baseQuery.leftJoin).toHaveBeenCalledWith('provinces as p', 'p.name_th', 'ef.province_name');
    expect(baseQuery.where).toHaveBeenCalledWith('ef.province_name', 'ระยอง');
  });

  it('fails closed for province-scoped selected factory reads without a province detail', async () => {
    const { baseQuery } = mockEligibleFactoriesQueries();

    await eligibleFactoriesRepository.list({}, {
      actorUserId: 42,
      scope: { scope: 'IN_PROVINCE', province: null, region: null },
    });

    expect(baseQuery.whereRaw).toHaveBeenCalledWith('1 = 0');
  });

  it('fails closed when explicit scope.region conflicts with regionalAccess', async () => {
    const { baseQuery } = mockEligibleFactoriesQueries();

    await eligibleFactoriesRepository.list({}, {
      actorUserId: 42,
      scope: { scope: 'IN_REGION', region: 'ภาคกลาง' },
      regionalAccess: { regions: ['ภาคตะวันออก'] },
    });

    expect(baseQuery.whereRaw).toHaveBeenCalledWith('1 = 0');
    expect(baseQuery.whereIn).not.toHaveBeenCalledWith('p.region', expect.anything());
  });

  it('fails closed when selected eligible factories have no assigned IN_REGION profile', async () => {
    const { baseQuery } = mockEligibleFactoriesQueries();

    await eligibleFactoriesRepository.list({}, {
      actorUserId: 42,
      scope: { scope: 'IN_REGION', region: 'ภาคกลาง' },
      regionalAccess: null,
    });

    expect(baseQuery.whereRaw).toHaveBeenCalledWith('1 = 0');
    expect(baseQuery.whereIn).not.toHaveBeenCalledWith('p.region', expect.anything());
  });

  it('filters selected eligible factories by authoritative estate code when provided', async () => {
    const { baseQuery } = mockEligibleFactoriesQueries();

    await eligibleFactoriesRepository.list({}, {
      actorUserId: 42,
      scope: { scope: 'IN_ESTATE', estateCode: 'MTP' } as never,
    });

    expect(baseQuery.leftJoin).toHaveBeenCalledWith(
      'industrial_estates as ie',
      'ie.name_th',
      'ef.industrial_estate_name',
    );
    expect(baseQuery.where).toHaveBeenCalledWith('ie.code', 'MTP');
  });

  it('accepts the legacy estate qualifier as a fallback for estate-scoped selected reads', async () => {
    const { baseQuery } = mockEligibleFactoriesQueries();

    await eligibleFactoriesRepository.list({}, {
      actorUserId: 42,
      scope: { scope: 'IN_ESTATE', estate: 'MTP' } as never,
    });

    expect(baseQuery.where).toHaveBeenCalledWith('ie.code', 'MTP');
  });

  it('fails closed for estate-scoped selected factory reads without an authoritative assignment', async () => {
    const { baseQuery } = mockEligibleFactoriesQueries();

    await eligibleFactoriesRepository.list({}, {
      actorUserId: 42,
      scope: { scope: 'IN_ESTATE' } as never,
    });

    expect(baseQuery.whereRaw).toHaveBeenCalledWith('1 = 0');
  });

  it('applies assigned factory access for own-factory selected reads', async () => {
    const { baseQuery } = mockEligibleFactoriesQueries();

    await eligibleFactoriesRepository.list({}, {
      actorUserId: 42,
      scope: { scope: 'OWN_FACTORY' },
    });

    expect(baseQuery.whereExists).toHaveBeenCalledWith(expect.any(Function));
    expect(applyAssignedFactoryAccessFilter).not.toHaveBeenCalledWith(baseQuery, 42, 'f');
    expect(baseQuery.leftJoin).not.toHaveBeenCalledWith('factories as f', expect.any(Function));
  });

  it('does not narrow ALL selected-factory reads with regionalAccess', async () => {
    const { baseQuery } = mockEligibleFactoriesQueries();

    await eligibleFactoriesRepository.list({}, {
      actorUserId: 42,
      scope: { scope: 'ALL' },
      regionalAccess: { regions: ['ภาคตะวันออก'] },
    });

    expect(baseQuery.whereIn).not.toHaveBeenCalledWith('p.region', ['ภาคตะวันออก']);
  });

  it('applies the factory-type-88 category filter to selected eligible factories', async () => {
    const { baseQuery } = mockEligibleFactoriesQueries();

    await eligibleFactoriesRepository.list({}, {
      actorUserId: 42,
      scope: { scope: 'FACTORY_TYPE_88' },
    });

    expect(baseQuery.where).toHaveBeenCalledWith(expect.any(Function));
    expect(baseQuery.whereExists).not.toHaveBeenCalled();
  });
});
