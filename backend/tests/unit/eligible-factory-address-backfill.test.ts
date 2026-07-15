import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { Knex } from 'knex';

const mockFactorySourceDb = jest.fn();

jest.mock('../../src/config/env', () => ({
  env: { FACTORY_DB_SCHEMA: 'dbo' },
}));

jest.mock('../../src/config/factory-source-database', () => ({
  factorySourceDb: mockFactorySourceDb,
  factorySourceTableName: jest.fn(() => 'dbo.fac_import'),
}));

import {
  buildAdministrativeAreaKey,
  down,
  findMatchingFactorySourceRow,
  resolveEligibleFactoryAddress,
  up,
} from '../../src/db/migrations/0070_backfill_eligible_factory_address_names';

describe('eligible factory address backfill', () => {
  const legacyFactory = {
    address: '4 หมู่ 6 ซอยทางเข้าโรงไฟฟ้า ถนนบางนา-ตราด ตำบล10 อำเภอ4 24130',
    source: {
      FADDR: '4',
      FMOO: '6',
      SOI: 'ทางเข้าโรงไฟฟ้า',
      ROAD: 'บางนา-ตราด',
      PROV: 24,
      AMP: 4,
      TUMBOL: 10,
      ZIPCODE: '24130',
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('replaces legacy DIW area codes with the matching Thai names', () => {
    expect(
      resolveEligibleFactoryAddress(
        legacyFactory.address,
        legacyFactory.source,
        new Map([
          [
            '24:4:10',
            {
              subdistrictName: 'ท่าข้าม',
              districtName: 'บางปะกง',
            },
          ],
        ]),
      ),
    ).toBe('4 หมู่ 6 ซอยทางเข้าโรงไฟฟ้า ถนนบางนา-ตราด ตำบลท่าข้าม อำเภอบางปะกง 24130');
  });

  it('does not overwrite an address that already contains readable names', () => {
    expect(
      resolveEligibleFactoryAddress(
        '4 หมู่ 6 ตำบลท่าข้าม อำเภอบางปะกง 24130 (ประตู 2)',
        legacyFactory.source,
        new Map([['24:4:10', { subdistrictName: 'ท่าข้าม', districtName: 'บางปะกง' }]]),
      ),
    ).toBeNull();
  });

  it('preserves additional stored address details while replacing numeric area labels', () => {
    expect(
      resolveEligibleFactoryAddress(
        `${legacyFactory.address} (ประตู 2)`,
        legacyFactory.source,
        new Map([['24:4:10', { subdistrictName: 'ท่าข้าม', districtName: 'บางปะกง' }]]),
      ),
    ).toBe('4 หมู่ 6 ซอยทางเข้าโรงไฟฟ้า ถนนบางนา-ตราด ตำบลท่าข้าม อำเภอบางปะกง 24130 (ประตู 2)');
  });

  it('skips the update when the administrative master cannot resolve both names', () => {
    expect(
      resolveEligibleFactoryAddress(legacyFactory.address, legacyFactory.source, new Map()),
    ).toBeNull();
  });

  it('uses province, district, and subdistrict together as the lookup key', () => {
    expect(buildAdministrativeAreaKey(24, 4, 10)).toBe('24:4:10');
    expect(buildAdministrativeAreaKey('024', '04', '010')).toBe('24:4:10');
    expect(buildAdministrativeAreaKey(18, 4, 10)).toBe('18:4:10');
    expect(buildAdministrativeAreaKey(null, 4, 10)).toBeNull();
  });

  it('matches source identifiers with explicit priority when values collide', () => {
    const intended = {
      FID: 'SOURCE-1',
      FACREG: 'REG-1',
      DISPFACREG: 'DISPLAY-1',
      ...legacyFactory.source,
    };
    const colliding = {
      FID: 'OTHER',
      FACREG: 'SOURCE-1',
      DISPFACREG: 'REG-1',
      ...legacyFactory.source,
      AMP: 99,
      TUMBOL: 99,
    };

    expect(
      findMatchingFactorySourceRow(
        {
          source_factory_id: 'SOURCE-1',
          factory_registration_no_new: 'REG-1',
        },
        [intended, colliding],
      ),
    ).toBe(intended);
  });

  it('backs up and persists resolved addresses for active legacy rows', async () => {
    const localRows = [
      {
        id: 795,
        source_factory_id: '10240000325407',
        factory_registration_no_new: '10240000325407',
        address: legacyFactory.address,
      },
    ];
    const backupInsert = jest.fn().mockResolvedValue(undefined as never);
    const update = jest.fn().mockResolvedValue(1 as never);
    const backupQuery = {
      where: jest.fn().mockReturnThis(),
      first: jest.fn().mockResolvedValue(undefined as never),
      insert: backupInsert,
    };
    const updateQuery = {
      where: jest.fn().mockReturnThis(),
      whereNull: jest.fn().mockReturnThis(),
      update,
    };
    const transactionDb = Object.assign(
      jest.fn((tableName: unknown) => {
        if (tableName === 'eligible_factory_address_cleanup_0070') return backupQuery;
        if (tableName === 'eligible_factories') return updateQuery;
        throw new Error(`Unexpected transaction table: ${String(tableName)}`);
      }),
      { fn: { now: jest.fn(() => 'NOW') } },
    );
    const eligibleQuery = {
      whereNull: jest.fn().mockReturnThis(),
      select: jest.fn().mockResolvedValue(localRows as never),
    };
    const knex = createKnexMock({
      hasBackupTable: false,
      eligibleQuery,
      transactionDb,
    });

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
              FID: '10240000325407',
              FACREG: '10240000325407',
              DISPFACREG: '3-88(2)-3/40ฉช',
              ...legacyFactory.source,
            },
          ] as never),
        };
        return query;
      }
      if (tableName === 'dbo.TUMBOL') {
        return {
          whereIn: jest.fn().mockReturnThis(),
          timeout: jest.fn().mockReturnThis(),
          select: jest.fn().mockResolvedValue([
            {
              PROV: 24,
              AMP: 4,
              TUMBOL: 10,
              TUMNAME: 'ท่าข้าม',
              AMPNAME: 'บางปะกง',
            },
          ] as never),
        };
      }
      throw new Error(`Unexpected source table: ${String(tableName)}`);
    });

    await up(knex);

    expect(eligibleQuery.whereNull).toHaveBeenCalledWith('deleted_at');
    expect(backupInsert).toHaveBeenCalledWith({
      eligible_factory_id: 795,
      original_address: legacyFactory.address,
      normalized_address:
        '4 หมู่ 6 ซอยทางเข้าโรงไฟฟ้า ถนนบางนา-ตราด ตำบลท่าข้าม อำเภอบางปะกง 24130',
    });
    expect(update).toHaveBeenCalledWith({
      address: '4 หมู่ 6 ซอยทางเข้าโรงไฟฟ้า ถนนบางนา-ตราด ตำบลท่าข้าม อำเภอบางปะกง 24130',
      updated_at: 'NOW',
    });
    expect(updateQuery.where.mock.calls).toEqual([
      ['id', 795],
      ['address', legacyFactory.address],
    ]);
  });

  it('does not back up or overwrite a concurrently edited address', async () => {
    const localRows = [
      {
        id: 795,
        source_factory_id: '10240000325407',
        factory_registration_no_new: '10240000325407',
        address: legacyFactory.address,
      },
    ];
    const backupInsert = jest.fn().mockResolvedValue(undefined as never);
    const backupQuery = {
      where: jest.fn().mockReturnThis(),
      first: jest.fn().mockResolvedValue(undefined as never),
      insert: backupInsert,
    };
    const update = jest.fn().mockResolvedValue(0 as never);
    const updateQuery = {
      where: jest.fn().mockReturnThis(),
      whereNull: jest.fn().mockReturnThis(),
      update,
    };
    const transactionDb = Object.assign(
      jest.fn((tableName: unknown) =>
        tableName === 'eligible_factory_address_cleanup_0070' ? backupQuery : updateQuery,
      ),
      { fn: { now: jest.fn(() => 'NOW') } },
    );
    const eligibleQuery = {
      whereNull: jest.fn().mockReturnThis(),
      select: jest.fn().mockResolvedValue(localRows as never),
    };
    const knex = createKnexMock({ hasBackupTable: true, eligibleQuery, transactionDb });
    mockFactorySourceDb.mockImplementation((tableName: unknown) => {
      if (tableName === 'dbo.fac_import') {
        const builder = {
          whereIn: jest.fn().mockReturnThis(),
          orWhereIn: jest.fn().mockReturnThis(),
        };
        const query = {
          where: jest.fn((callback: (value: typeof builder) => void) => {
            callback(builder);
            return query;
          }),
          timeout: jest.fn().mockReturnThis(),
          select: jest.fn().mockResolvedValue([
            {
              FID: '10240000325407',
              FACREG: '10240000325407',
              DISPFACREG: null,
              ...legacyFactory.source,
            },
          ] as never),
        };
        return query;
      }
      return {
        whereIn: jest.fn().mockReturnThis(),
        timeout: jest.fn().mockReturnThis(),
        select: jest.fn().mockResolvedValue([
          {
            PROV: 24,
            AMP: 4,
            TUMBOL: 10,
            TUMNAME: 'ท่าข้าม',
            AMPNAME: 'บางปะกง',
          },
        ] as never),
      };
    });

    await up(knex);

    expect(updateQuery.where.mock.calls).toEqual([
      ['id', 795],
      ['address', legacyFactory.address],
    ]);
    expect(backupInsert).not.toHaveBeenCalled();
  });

  it('rolls back only rows that still contain the value written by the migration', async () => {
    const normalizedAddress =
      '4 หมู่ 6 ซอยทางเข้าโรงไฟฟ้า ถนนบางนา-ตราด ตำบลท่าข้าม อำเภอบางปะกง 24130';
    const backupQuery = {
      select: jest.fn().mockResolvedValue([
        {
          eligible_factory_id: 795,
          original_address: legacyFactory.address,
          normalized_address: normalizedAddress,
        },
      ] as never),
    };
    const update = jest.fn().mockResolvedValue(1 as never);
    const updateQuery = {
      where: jest.fn().mockReturnThis(),
      update,
    };
    const transactionDb = Object.assign(
      jest.fn((tableName: unknown) => {
        if (tableName === 'eligible_factory_address_cleanup_0070') return backupQuery;
        if (tableName === 'eligible_factories') return updateQuery;
        throw new Error(`Unexpected transaction table: ${String(tableName)}`);
      }),
      { fn: { now: jest.fn(() => 'NOW') } },
    );
    const knex = createKnexMock({
      hasBackupTable: true,
      eligibleQuery: null,
      transactionDb,
    });

    await down(knex);

    expect(updateQuery.where.mock.calls).toEqual([
      ['id', 795],
      ['address', normalizedAddress],
    ]);
    expect(update).toHaveBeenCalledWith({
      address: legacyFactory.address,
      updated_at: 'NOW',
    });
    expect(knex.schema.dropTable).toHaveBeenCalledWith('eligible_factory_address_cleanup_0070');
  });
});

function createKnexMock(args: {
  hasBackupTable: boolean;
  eligibleQuery: Record<string, unknown> | null;
  transactionDb: unknown;
}): Knex {
  const columnBuilder = {
    primary: jest.fn().mockReturnThis(),
  };
  const tableBuilder = {
    bigIncrements: jest.fn(() => columnBuilder),
    specificType: jest.fn().mockReturnThis(),
    unique: jest.fn().mockReturnThis(),
  };
  const schema = {
    hasTable: jest.fn().mockResolvedValue(args.hasBackupTable as never),
    createTable: jest.fn((_tableName: string, callback: (table: typeof tableBuilder) => void) =>
      callback(tableBuilder),
    ),
    dropTable: jest.fn().mockResolvedValue(undefined as never),
  };
  const knex = Object.assign(
    jest.fn((tableName: unknown) => {
      if (tableName === 'eligible_factories' && args.eligibleQuery) return args.eligibleQuery;
      throw new Error(`Unexpected local table: ${String(tableName)}`);
    }),
    {
      schema,
      transaction: jest.fn(async (callback: (trx: unknown) => Promise<void>) =>
        callback(args.transactionDb),
      ),
    },
  );
  return knex as unknown as Knex;
}
