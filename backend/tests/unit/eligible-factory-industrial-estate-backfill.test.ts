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
  buildIndustrialEstateBatchUpdateForTests,
  buildIndustrialEstateBackfillPlan,
  down,
  up,
} from '../../src/db/migrations/0090_backfill_eligible_factory_industrial_estates';

describe('eligible factory industrial-estate backfill', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('plans named estates while distinguishing factories that are legitimately outside estates', () => {
    const plan = buildIndustrialEstateBackfillPlan({
      eligibleRows: [
        eligibleRow(1, 'FID-1', 'REG-1', null),
        eligibleRow(2, null, 'REG-2', '   '),
        eligibleRow(3, 'FID-3', 'REG-3', null),
      ],
      sourceRows: [
        sourceRow('FID-1', 'REG-1', 'DISPLAY-1', 'IE-01'),
        sourceRow('FID-2', 'REG-2', 'DISPLAY-2', 'IE-02'),
        sourceRow('FID-3', 'REG-3', 'DISPLAY-3', null),
      ],
      industrialEstateNamesByCode: new Map([
        ['IE-01', 'นิคมอุตสาหกรรมมาบตาพุด'],
        ['IE-02', 'นิคมอุตสาหกรรมบางปู'],
      ]),
      connectedEligibleFactoryIds: new Set(['1', '3']),
    });

    expect(plan.updates).toEqual([
      {
        eligibleFactoryId: 1,
        originalIndustrialEstateName: null,
        industrialEstateCode: 'IE-01',
        industrialEstateName: 'นิคมอุตสาหกรรมมาบตาพุด',
        isConnectedPomsFactory: true,
      },
      {
        eligibleFactoryId: 2,
        originalIndustrialEstateName: '   ',
        industrialEstateCode: 'IE-02',
        industrialEstateName: 'นิคมอุตสาหกรรมบางปู',
        isConnectedPomsFactory: false,
      },
    ]);
    expect(plan.noIndustrialEstateEligibleFactoryIds).toEqual([3]);
    expect(plan.unresolved).toEqual([]);
  });

  it('reports source and estate-description gaps before writing any data', () => {
    const plan = buildIndustrialEstateBackfillPlan({
      eligibleRows: [
        eligibleRow(10, 'MISSING', 'REG-10', null),
        eligibleRow(11, 'FID-11', 'REG-11', null),
      ],
      sourceRows: [sourceRow('FID-11', 'REG-11', null, 'UNKNOWN-ESTATE')],
      industrialEstateNamesByCode: new Map(),
      connectedEligibleFactoryIds: new Set(['10', '11']),
    });

    expect(plan.updates).toEqual([]);
    expect(plan.unresolved).toEqual([
      {
        eligibleFactoryId: 10,
        reason: 'source_factory_not_found',
        isConnectedPomsFactory: true,
      },
      {
        eligibleFactoryId: 11,
        reason: 'industrial_estate_description_not_found',
        isConnectedPomsFactory: true,
      },
    ]);
  });

  it('reports conflicting source rows and oversized estate descriptions during preflight', () => {
    const plan = buildIndustrialEstateBackfillPlan({
      eligibleRows: [
        eligibleRow(20, 'FID-CONFLICT', 'REG-20', null),
        eligibleRow(21, 'FID-LONG', 'REG-21', null),
      ],
      sourceRows: [
        sourceRow('FID-CONFLICT', 'REG-20', null, 'IE-20-A'),
        sourceRow('FID-CONFLICT', 'REG-20', null, 'IE-20-B'),
        sourceRow('FID-LONG', 'REG-21', null, 'IE-21'),
      ],
      industrialEstateNamesByCode: new Map([['IE-21', 'น'.repeat(256)]]),
      connectedEligibleFactoryIds: new Set(['20', '21']),
    });

    expect(plan.updates).toEqual([]);
    expect(plan.unresolved).toEqual([
      {
        eligibleFactoryId: 20,
        reason: 'source_factory_conflict',
        isConnectedPomsFactory: true,
      },
      {
        eligibleFactoryId: 21,
        reason: 'industrial_estate_name_too_long',
        isConnectedPomsFactory: true,
      },
    ]);
  });

  it('reports a conflict when source ID and registration point to different estates', () => {
    const plan = buildIndustrialEstateBackfillPlan({
      eligibleRows: [eligibleRow(22, 'FID-STALE', 'DISPLAY-22', null)],
      sourceRows: [
        sourceRow('FID-STALE', 'FACREG-A', 'DISPLAY-A', 'IE-A'),
        sourceRow('FID-CURRENT', 'FACREG-B', 'DISPLAY-22', 'IE-B'),
      ],
      industrialEstateNamesByCode: new Map([
        ['IE-A', 'นิคมอุตสาหกรรม ก'],
        ['IE-B', 'นิคมอุตสาหกรรม ข'],
      ]),
      connectedEligibleFactoryIds: new Set(['22']),
    });

    expect(plan.updates).toEqual([]);
    expect(plan.unresolved).toEqual([
      {
        eligibleFactoryId: 22,
        reason: 'source_factory_conflict',
        isConnectedPomsFactory: true,
      },
    ]);
  });

  it('backs up and updates matched active eligible factories in one transaction', async () => {
    const localRows = [eligibleRow(88, 'FID-88', 'REG-88', null)];
    const raw = jest.fn().mockResolvedValue(undefined as never);
    const knex = createKnexMock({
      eligibleRows: localRows,
      connectedEligibleFactoryIds: [88],
      hasBackupTable: false,
      transactionDb: { raw },
    });
    mockFactorySourceDb.mockImplementation(
      createFactorySourceMock({
        sourceRows: [sourceRow('FID-88', 'REG-88', null, 'IE-88')],
        estateRows: [estateRow('IE-88', 'นิคมอุตสาหกรรมมาบตาพุด')],
      }),
    );

    await up(knex);

    const [sql, bindings] = raw.mock.calls[0] as unknown as [string, unknown[]];
    expect(sql).toContain('OUTPUT INSERTED.id');
    expect(sql).toContain('DELETED.industrial_estate_name');
    expect(sql).toContain("NULLIF(LTRIM(RTRIM(target.industrial_estate_name)), N'') IS NULL");
    expect(sql).toContain('NOT EXISTS');
    expect(bindings).toEqual([88, 'นิคมอุตสาหกรรมมาบตาพุด', 'IE-88']);
    expect(knex.schema.createTable).toHaveBeenCalledWith(
      'eligible_factory_industrial_estate_cleanup_0090',
      expect.any(Function),
    );
  });

  it('aborts during preflight when a connected POMS factory cannot be resolved', async () => {
    const knex = createKnexMock({
      eligibleRows: [eligibleRow(99, 'MISSING', 'REG-99', null)],
      connectedEligibleFactoryIds: [99],
      hasBackupTable: false,
      transactionDb: jest.fn(),
    });
    mockFactorySourceDb.mockImplementation(
      createFactorySourceMock({
        sourceRows: [],
        estateRows: [],
      }),
    );

    await expect(up(knex)).rejects.toThrow('ELIGIBLE_FACTORY_INDUSTRIAL_ESTATE_BACKFILL_FAILED');
    expect(knex.schema.createTable).not.toHaveBeenCalled();
    expect(knex.transaction).not.toHaveBeenCalled();
  });

  it('does not let an unresolved non-POMS row block resolvable factories', async () => {
    const raw = jest.fn().mockResolvedValue(undefined as never);
    const knex = createKnexMock({
      eligibleRows: [
        eligibleRow(100, 'MISSING', 'REG-100', null),
        eligibleRow(101, 'FID-101', 'REG-101', null),
      ],
      connectedEligibleFactoryIds: [101],
      hasBackupTable: false,
      transactionDb: { raw },
    });
    mockFactorySourceDb.mockImplementation(
      createFactorySourceMock({
        sourceRows: [sourceRow('FID-101', 'REG-101', null, 'IE-101')],
        estateRows: [estateRow('IE-101', 'นิคมอุตสาหกรรมบางปู')],
      }),
    );

    await expect(up(knex)).resolves.toBeUndefined();

    expect(raw).toHaveBeenCalledTimes(1);
    expect(raw.mock.calls[0]?.[1]).toEqual([101, 'นิคมอุตสาหกรรมบางปู', 'IE-101']);
  });

  it('builds guarded update batches below the MSSQL parameter limit', () => {
    const updates = Array.from({ length: 500 }, (_, index) => ({
      eligibleFactoryId: index + 1,
      originalIndustrialEstateName: null,
      industrialEstateCode: `IE-${index + 1}`,
      industrialEstateName: `นิคม ${index + 1}`,
      isConnectedPomsFactory: false,
    }));

    const { sql, bindings } = buildIndustrialEstateBatchUpdateForTests(updates);

    expect(sql.match(/\(\?, \?, \?\)/gu)).toHaveLength(500);
    expect(bindings).toHaveLength(1500);
    expect(bindings.length).toBeLessThan(2100);
    expect(sql).toContain('target.deleted_at IS NULL');
    expect(sql).toContain('NOT EXISTS');
    expect(sql).toContain('source_industrial_estate_code');
  });

  it('restores only values that still equal the migration backfill value', async () => {
    const backupRows = [
      {
        eligible_factory_id: 88,
        original_industrial_estate_name: null,
        backfilled_industrial_estate_name: 'นิคมอุตสาหกรรมมาบตาพุด',
      },
    ];
    const deleteBackup = jest.fn().mockResolvedValue(1 as never);
    const backupQuery = {
      select: jest.fn().mockResolvedValue(backupRows as never),
      where: jest.fn().mockReturnThis(),
      del: deleteBackup,
    };
    const update = jest.fn().mockResolvedValue(1 as never);
    const updateQuery = {
      where: jest.fn().mockReturnThis(),
      update,
    };
    const raw = jest.fn().mockResolvedValue(undefined as never);
    const transactionDb = Object.assign(
      jest.fn((tableName: unknown) => {
        if (tableName === 'eligible_factory_industrial_estate_cleanup_0090') return backupQuery;
        if (tableName === 'eligible_factories') return updateQuery;
        throw new Error(`Unexpected transaction table: ${String(tableName)}`);
      }),
      { fn: { now: jest.fn(() => 'NOW') }, raw },
    );
    const knex = createKnexMock({
      eligibleRows: [],
      connectedEligibleFactoryIds: [],
      hasBackupTable: true,
      transactionDb,
    });

    await down(knex);

    expect(updateQuery.where.mock.calls).toEqual([
      ['id', 88],
      ['industrial_estate_name', 'นิคมอุตสาหกรรมมาบตาพุด'],
    ]);
    expect(update).toHaveBeenCalledWith({
      industrial_estate_name: null,
      updated_at: 'NOW',
    });
    expect(backupQuery.where).toHaveBeenCalledWith('eligible_factory_id', 88);
    expect(deleteBackup).toHaveBeenCalledTimes(1);
    expect(raw).toHaveBeenCalledWith(
      expect.stringContaining(
        'IF NOT EXISTS (SELECT 1 FROM [eligible_factory_industrial_estate_cleanup_0090])',
      ),
    );
  });

  it('keeps rollback backup rows when a later manual estate edit must be preserved', async () => {
    const backupRows = [
      {
        eligible_factory_id: 89,
        original_industrial_estate_name: null,
        backfilled_industrial_estate_name: 'นิคมอุตสาหกรรมบางปู',
      },
    ];
    const deleteBackup = jest.fn().mockResolvedValue(1 as never);
    const backupQuery = {
      select: jest.fn().mockResolvedValue(backupRows as never),
      where: jest.fn().mockReturnThis(),
      del: deleteBackup,
    };
    const update = jest.fn().mockResolvedValue(0 as never);
    const updateQuery = {
      where: jest.fn().mockReturnThis(),
      update,
    };
    const raw = jest.fn().mockResolvedValue(undefined as never);
    const transactionDb = Object.assign(
      jest.fn((tableName: unknown) => {
        if (tableName === 'eligible_factory_industrial_estate_cleanup_0090') return backupQuery;
        if (tableName === 'eligible_factories') return updateQuery;
        throw new Error(`Unexpected transaction table: ${String(tableName)}`);
      }),
      { fn: { now: jest.fn(() => 'NOW') }, raw },
    );
    const knex = createKnexMock({
      eligibleRows: [],
      connectedEligibleFactoryIds: [],
      hasBackupTable: true,
      transactionDb,
    });

    await down(knex);

    expect(deleteBackup).not.toHaveBeenCalled();
    expect(raw).toHaveBeenCalledTimes(1);
  });
});

function eligibleRow(
  id: number,
  sourceFactoryId: string | null,
  registrationNo: string,
  industrialEstateName: string | null,
) {
  return {
    id,
    source_factory_id: sourceFactoryId,
    factory_registration_no_new: registrationNo,
    industrial_estate_name: industrialEstateName,
  };
}

function sourceRow(
  fid: string,
  facreg: string,
  displayFacreg: string | null,
  industrialEstateCode: string | null,
) {
  return {
    FID: fid,
    FACREG: facreg,
    DISPFACREG: displayFacreg,
    COLONY_INDUST_CODE: industrialEstateCode,
  };
}

function estateRow(code: string, name: string) {
  return {
    COLONY_INDUST_CODE: code,
    COLONY_INDUST_DESC: name,
  };
}

function createFactorySourceMock(args: {
  sourceRows: ReturnType<typeof sourceRow>[];
  estateRows: ReturnType<typeof estateRow>[];
}) {
  return (tableName: unknown) => {
    if (tableName === 'dbo.fac_import') {
      const identifiersBuilder = {
        whereIn: jest.fn().mockReturnThis(),
        orWhereIn: jest.fn().mockReturnThis(),
      };
      const query = {
        where: jest.fn((callback: (builder: typeof identifiersBuilder) => void) => {
          callback(identifiersBuilder);
          return query;
        }),
        timeout: jest.fn().mockReturnThis(),
        select: jest.fn().mockResolvedValue(args.sourceRows as never),
      };
      return query;
    }
    if (tableName === 'dbo.FAC_COLONY_INDUST') {
      return {
        whereIn: jest.fn().mockReturnThis(),
        timeout: jest.fn().mockReturnThis(),
        select: jest.fn().mockResolvedValue(args.estateRows as never),
      };
    }
    throw new Error(`Unexpected source table: ${String(tableName)}`);
  };
}

function createKnexMock(args: {
  eligibleRows: ReturnType<typeof eligibleRow>[];
  connectedEligibleFactoryIds: number[];
  hasBackupTable: boolean;
  transactionDb: unknown;
}): Knex {
  const blankEstateBuilder = {
    whereNull: jest.fn().mockReturnThis(),
    orWhereRaw: jest.fn().mockReturnThis(),
  };
  const eligibleQuery = {
    whereNull: jest.fn().mockReturnThis(),
    where: jest.fn((callback: (builder: typeof blankEstateBuilder) => void) => {
      callback(blankEstateBuilder);
      return eligibleQuery;
    }),
    select: jest.fn().mockResolvedValue(args.eligibleRows as never),
  };
  const connectedQuery = {
    whereNull: jest.fn().mockReturnThis(),
    whereIn: jest.fn().mockReturnThis(),
    distinct: jest.fn().mockResolvedValue(
      args.connectedEligibleFactoryIds.map((eligibleFactoryId) => ({
        eligible_factory_id: eligibleFactoryId,
      })) as never,
    ),
  };
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
      if (tableName === 'eligible_factories') return eligibleQuery;
      if (tableName === 'cems_wpms_connected_measurement_points') return connectedQuery;
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
