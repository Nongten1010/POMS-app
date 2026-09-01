import { beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('../../src/config/database', () => ({
  db: Object.assign(jest.fn(), { transaction: jest.fn() }),
}));

import { db } from '../../src/config/database';
import { eligibleFactoriesRepository } from '../../src/modules/eligible-factories/eligible-factories.repository';

const mockedDb = db as unknown as jest.Mock<(...args: unknown[]) => unknown> & {
  transaction: jest.Mock<(...args: unknown[]) => Promise<unknown>>;
};

describe('eligibleFactoriesRepository add-request contract regressions', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    mockedDb.mockReset();
    mockedDb.transaction.mockReset();
  });

  it('lists every status without applying legacy status or pagination while preserving stable order', async () => {
    const rows = [
      addRequestRow({ id: 6, status: 'APPROVED' }),
      addRequestRow({ id: 5, status: 'REJECTED' }),
      addRequestRow({ id: 4, status: 'PENDING_REVIEW' }),
    ];
    const baseQuery = {
      leftJoin: jest.fn(),
      whereNull: jest.fn(),
      where: jest.fn(),
      whereIn: jest.fn(),
      whereRaw: jest.fn(),
      select: jest.fn(),
      orderBy: jest.fn(),
      offset: jest.fn(),
      limit: jest.fn(),
      clone: jest.fn(),
      then: jest.fn((resolve: (value: unknown[]) => unknown) => Promise.resolve(resolve(rows))),
    };
    baseQuery.leftJoin.mockReturnValue(baseQuery);
    baseQuery.whereNull.mockReturnValue(baseQuery);
    baseQuery.where.mockReturnValue(baseQuery);
    baseQuery.whereIn.mockReturnValue(baseQuery);
    baseQuery.whereRaw.mockReturnValue(baseQuery);
    baseQuery.select.mockReturnValue(baseQuery);
    baseQuery.orderBy.mockReturnValue(baseQuery);
    baseQuery.offset.mockReturnValue(baseQuery);
    baseQuery.limit.mockReturnValue(baseQuery);
    mockedDb.mockImplementation((tableName: unknown) => {
      if (tableName === 'eligible_factory_add_requests as ef') return baseQuery;
      throw new Error(`Unexpected query for ${String(tableName)}`);
    });

    const result = await eligibleFactoriesRepository.listAddRequests({});

    expect(result.rows.map((row) => row.status)).toEqual([
      'APPROVED',
      'REJECTED',
      'PENDING_REVIEW',
    ]);
    expect(result.total).toBe(3);
    expect(baseQuery.where).not.toHaveBeenCalled();
    expect(baseQuery.whereIn).not.toHaveBeenCalled();
    expect(baseQuery.whereRaw).not.toHaveBeenCalled();
    expect(baseQuery.offset).not.toHaveBeenCalled();
    expect(baseQuery.limit).not.toHaveBeenCalled();
    expect(baseQuery.clone).not.toHaveBeenCalled();
    expect(baseQuery.orderBy.mock.calls).toEqual([
      ['ef.submitted_at', 'desc'],
      ['ef.id', 'desc'],
    ]);
  });

  it('approves by updating only the request status and keeps eligible_factory_id null', async () => {
    const pendingRow = addRequestRow({ id: 4, status: 'PENDING_REVIEW', is_open: true });
    const approvedRow = addRequestRow({
      id: 4,
      status: 'APPROVED',
      is_open: false,
      eligible_factory_id: null,
      reviewed_by: 99,
      reviewed_at: '2026-09-01T03:00:00.000Z',
    });
    const visibleQuery = makeChain({ first: async () => ({ id: 4 }) });
    const lockedQuery = makeChain({ first: async () => pendingRow });
    const requestUpdate = jest.fn(async (_values: Record<string, unknown>) => 1);
    const updateQuery = makeChain({ update: requestUpdate });
    const updatedQuery = makeChain({ first: async () => approvedRow });
    const legacyFactoryLookup = makeChain({ first: async () => ({ id: 81 }) });
    const queues = new Map<string, unknown[]>([
      ['eligible_factory_add_requests as ef', [visibleQuery, updatedQuery]],
      ['eligible_factory_add_requests', [lockedQuery, updateQuery]],
      ['factories', [legacyFactoryLookup]],
    ]);
    const trx = Object.assign(
      jest.fn((tableName: string) => {
        const builder = queues.get(tableName)?.shift();
        if (!builder) throw new Error(`Unexpected query for ${tableName}`);
        return builder;
      }),
      { fn: { now: jest.fn(() => 'db-now') } },
    );
    mockedDb.transaction.mockImplementationOnce(async (...args: unknown[]) => {
      const callback = args[0] as (transaction: typeof trx) => Promise<unknown>;
      return callback(trx);
    });
    const findExistingEligible = jest
      .spyOn(eligibleFactoriesRepository, 'findByRegistrationNoNew')
      .mockResolvedValue({
        id: 812,
        factoryRegistrationNoNew: 'FAC-0004',
        monitoringPointFormId: null,
      });
    const createEligible = jest
      .spyOn(eligibleFactoriesRepository, 'create')
      .mockResolvedValue({ id: 812 } as never);

    await expect(
      eligibleFactoriesRepository.reviewAddRequest(4, { decision: 'APPROVE' }, 99, []),
    ).resolves.toMatchObject({
      id: 4,
      status: 'APPROVED',
      eligibleFactoryId: null,
    });

    expect(requestUpdate).toHaveBeenCalledWith({
      status: 'APPROVED',
      is_open: false,
      eligible_factory_id: null,
      reviewed_by: 99,
      reviewed_at: 'db-now',
      officer_note: null,
      updated_by: 99,
      updated_at: 'db-now',
    });
    expect(trx.mock.calls.map(([tableName]) => tableName)).toEqual([
      'eligible_factory_add_requests as ef',
      'eligible_factory_add_requests',
      'eligible_factory_add_requests',
      'eligible_factory_add_requests as ef',
    ]);
    expect(
      trx.mock.calls
        .map(([tableName]) => tableName)
        .filter((tableName) => tableName === 'factories' || tableName === 'eligible_factories'),
    ).toEqual([]);
    expect(findExistingEligible).not.toHaveBeenCalled();
    expect(createEligible).not.toHaveBeenCalled();
  });

  it('rejects by updating only the request status and preserves the officer note', async () => {
    const pendingRow = addRequestRow({ id: 4, status: 'PENDING_REVIEW', is_open: true });
    const rejectedRow = addRequestRow({
      id: 4,
      status: 'REJECTED',
      is_open: false,
      eligible_factory_id: null,
      reviewed_by: 99,
      reviewed_at: '2026-09-01T03:00:00.000Z',
      officer_note: 'ข้อมูลโรงงานไม่ครบถ้วน',
    });
    const visibleQuery = makeChain({ first: async () => ({ id: 4 }) });
    const lockedQuery = makeChain({ first: async () => pendingRow });
    const requestUpdate = jest.fn(async (_values: Record<string, unknown>) => 1);
    const updateQuery = makeChain({ update: requestUpdate });
    const updatedQuery = makeChain({ first: async () => rejectedRow });
    const queues = new Map<string, unknown[]>([
      ['eligible_factory_add_requests as ef', [visibleQuery, updatedQuery]],
      ['eligible_factory_add_requests', [lockedQuery, updateQuery]],
    ]);
    const trx = Object.assign(
      jest.fn((tableName: string) => {
        const builder = queues.get(tableName)?.shift();
        if (!builder) throw new Error(`Unexpected query for ${tableName}`);
        return builder;
      }),
      { fn: { now: jest.fn(() => 'db-now') } },
    );
    mockedDb.transaction.mockImplementationOnce(async (...args: unknown[]) => {
      const callback = args[0] as (transaction: typeof trx) => Promise<unknown>;
      return callback(trx);
    });
    const findExistingEligible = jest.spyOn(eligibleFactoriesRepository, 'findByRegistrationNoNew');
    const createEligible = jest.spyOn(eligibleFactoriesRepository, 'create');

    await expect(
      eligibleFactoriesRepository.reviewAddRequest(
        4,
        { decision: 'REJECT', officerNote: 'ข้อมูลโรงงานไม่ครบถ้วน' },
        99,
        [],
      ),
    ).resolves.toMatchObject({
      id: 4,
      status: 'REJECTED',
      eligibleFactoryId: null,
      reviewNote: 'ข้อมูลโรงงานไม่ครบถ้วน',
    });

    expect(requestUpdate).toHaveBeenCalledWith({
      status: 'REJECTED',
      is_open: false,
      eligible_factory_id: null,
      reviewed_by: 99,
      reviewed_at: 'db-now',
      officer_note: 'ข้อมูลโรงงานไม่ครบถ้วน',
      updated_by: 99,
      updated_at: 'db-now',
    });
    expect(trx.mock.calls.map(([tableName]) => tableName)).toEqual([
      'eligible_factory_add_requests as ef',
      'eligible_factory_add_requests',
      'eligible_factory_add_requests',
      'eligible_factory_add_requests as ef',
    ]);
    expect(
      trx.mock.calls
        .map(([tableName]) => tableName)
        .filter((tableName) => tableName === 'factories' || tableName === 'eligible_factories'),
    ).toEqual([]);
    expect(findExistingEligible).not.toHaveBeenCalled();
    expect(createEligible).not.toHaveBeenCalled();
  });
});

function makeChain(options: {
  first?: () => Promise<unknown>;
  update?: (values: Record<string, unknown>) => Promise<unknown>;
}) {
  const chain: Record<string, unknown> = {};
  Object.assign(chain, {
    leftJoin: jest.fn(() => chain),
    where: jest.fn(() => chain),
    whereNull: jest.fn(() => chain),
    select: jest.fn(() => chain),
    clearSelect: jest.fn(() => chain),
    forUpdate: jest.fn(() => chain),
    first: jest.fn(options.first ?? (async () => undefined)),
    update: jest.fn(options.update ?? (async () => 1)),
  });
  return chain;
}

function addRequestRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 4,
    factory_master_id: 81,
    source_factory_id: 'FAC-0004',
    factory_registration_no: 'FAC-0004',
    factory_registration_no_old: null,
    factory_name: 'โรงงานทดสอบ',
    factory_type_sequence: '08801',
    address: 'ระยอง',
    province_name: 'ระยอง',
    industrial_estate_name: null,
    latitude: null,
    longitude: null,
    business_activity: null,
    operation_status: 'แจ้งประกอบแล้ว',
    capital_amount: null,
    machinery_horsepower: null,
    production_capacity: null,
    wastewater_discharge_info: null,
    boiler_count: null,
    boiler_size_each: null,
    fuel_used: null,
    eia_assessment: null,
    eia_other: null,
    has_eia: null,
    project_name: null,
    reason: 'ขอเพิ่มโรงงานเข้าข่าย',
    status: 'PENDING_REVIEW',
    is_open: true,
    factory_snapshot_json: JSON.stringify({
      sourceFactoryId: 'FAC-0004',
      factoryName: 'โรงงานทดสอบ',
      factoryRegistrationNoNew: 'FAC-0004',
      provinceName: 'ระยอง',
      operationStatus: 'แจ้งประกอบแล้ว',
    }),
    submitted_by: 42,
    reviewed_by: null,
    submitted_at: '2026-09-01T02:00:00.000Z',
    reviewed_at: null,
    officer_note: null,
    eligible_factory_id: null,
    created_at: '2026-09-01T02:00:00.000Z',
    updated_at: '2026-09-01T02:00:00.000Z',
    ...overrides,
  };
}
