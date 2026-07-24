import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('../../src/config/database', () => ({
  db: Object.assign(jest.fn(), {
    transaction: jest.fn(),
  }),
}));

import { db } from '../../src/config/database';
import { connectionRequestsRepository } from '../../src/modules/connection-requests/connection-requests.repository';

const mockedDb = db as unknown as jest.Mock<(...args: unknown[]) => unknown> & {
  transaction: jest.Mock<(...args: unknown[]) => Promise<unknown>>;
};

describe('connectionRequestsRepository.createDirectConnection happy path', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-07-21T03:04:05.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('rejects without writing when the linked eligible factory is no longer active', async () => {
    const eligibleLookup = makeChain({ first: async () => undefined });
    const trx = Object.assign(
      jest.fn((tableName: string) => {
        if (tableName === 'eligible_factories') return eligibleLookup;
        throw new Error(`Unexpected write or query for ${tableName}`);
      }),
      { fn: { now: jest.fn(() => 'db-now') } },
    );
    mockedDb.transaction.mockImplementationOnce(async (...args: unknown[]) => {
      const callback = args[0] as (transaction: typeof trx) => Promise<unknown>;
      return callback(trx);
    });

    await expect(
      connectionRequestsRepository.createDirectConnection(directInput() as never, 42),
    ).rejects.toMatchObject({
      statusCode: 409,
      details: { eligibleFactoryId: 17 },
    });

    expect(trx).toHaveBeenCalledTimes(1);
    expect(eligibleLookup.first).toHaveBeenCalledWith(
      'id',
      'latitude',
      'longitude',
      'eia_assessment',
      'eia_other',
      'has_eia',
      'project_name',
    );
  });

  it('persists eligible-factory location when no factory master row exists', async () => {
    const fixedNow = new Date('2026-07-21T03:04:05.000Z');
    const requestInsert = jest.fn((_: unknown) => ({
      returning: jest.fn(async () => [{ id: 101 }]),
    }));
    const snapshotInsert = jest.fn(async (_: unknown) => 1);
    const pointInsert = jest.fn((_: unknown) => ({
      returning: jest.fn(async () => [{ id: 202 }]),
    }));
    const historyInsert = jest.fn(async (_: unknown) => 1);
    const connectedPointInsert = jest.fn(async (_: unknown) => 1);

    const eligibleLookup = makeChain({ first: async () => ({ id: 17 }) });
    const duplicateLookup = makeChain({ first: async () => undefined });
    const existingProfileLookup = makeChain({ first: async () => undefined });
    const requestNumberLookup = makeChain({ first: async () => ({ total: 0 }) });
    const eligibleFactorySource = makeChain({
      first: async () => ({
        province_id: '10',
        province_name: 'กรุงเทพมหานคร',
        province_region: 'ภาคกลาง',
        industrial_estate_code: 'IE-01',
        industrial_estate_name: 'นิคมทดสอบ',
      }),
    });
    const snapshotSoftDelete = makeChain({ update: async () => 1 });
    const requestRead = makeChain({ first: async () => requestRow(fixedNow) });
    const pointRead = makeChain({ terminalOrderBy: async () => [measurementPointRow()] });
    const historyRead = makeChain({
      terminalOrderBy: async () => [statusHistoryRow(fixedNow)],
      terminalOrderByAfter: 2,
    });
    const snapshotRead = makeChain({ first: async () => factorySnapshotRow() });

    const queues = new Map<string, unknown[]>([
      ['eligible_factories', [eligibleLookup]],
      [
        'cems_wpms_connected_measurement_points',
        [duplicateLookup, existingProfileLookup, { insert: connectedPointInsert }],
      ],
      [
        'cems_wpms_connection_requests',
        [requestNumberLookup, { insert: requestInsert }, requestRead],
      ],
      ['eligible_factories as ef', [eligibleFactorySource]],
      [
        'cems_wpms_request_factory_snapshots',
        [snapshotSoftDelete, { insert: snapshotInsert }, snapshotRead],
      ],
      ['cems_wpms_measurement_points', [{ insert: pointInsert }, pointRead]],
      ['cems_wpms_request_status_history', [{ insert: historyInsert }, historyRead]],
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

    const created = await connectionRequestsRepository.createDirectConnection(
      directInput() as never,
      42,
    );

    expect(mockedDb.transaction).toHaveBeenCalledTimes(1);
    expect(requestInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        request_no: 'CEMS-69-00001',
        eligible_factory_id: 17,
        request_type: 'ADD_MEASUREMENT_POINT',
        submission_source: 'OFFICER_DIRECT_API',
        status: 'CONNECTED',
        verified_at: fixedNow,
        created_by: 42,
        updated_by: 42,
      }),
    );
    expect(snapshotInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        request_id: 101,
        region_code: 'ภาคกลาง',
        region_name: 'ภาคกลาง',
        province_code: '10',
        province_name: 'กรุงเทพมหานคร',
        industrial_estate_code: 'IE-01',
        industrial_estate_name: 'นิคมทดสอบ',
        created_by: 42,
      }),
    );
    expect(pointInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        request_id: 101,
        point_code: 'free form / จุด-01',
        point_name: 'ปล่องทดสอบ 1',
        created_by: 42,
      }),
    );
    expect(historyInsert).toHaveBeenCalledWith({
      request_id: 101,
      status: 'CONNECTED',
      note: 'เจ้าหน้าที่เพิ่มจุดตรวจวัดและเชื่อมต่อโดยตรงผ่าน API',
      changed_by: 42,
    });
    expect(connectedPointInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        source_request_id: 101,
        source_measurement_point_id: 202,
        eligible_factory_id: 17,
        factory_id: 'factory-001',
        system_type: 'CEMS',
        point_code: 'free form / จุด-01',
        connected_at: fixedNow,
        created_by: 42,
      }),
    );
    expect(created).toMatchObject({
      id: 101,
      requestNo: 'CEMS-69-00001',
      requestType: 'ADD_MEASUREMENT_POINT',
      submissionSource: 'OFFICER_DIRECT_API',
      status: 'CONNECTED',
      verifiedAt: fixedNow.toISOString(),
      regionName: 'ภาคกลาง',
      measurementPoints: [expect.objectContaining({ id: 202, pointCode: 'free form / จุด-01' })],
      statusHistory: [expect.objectContaining({ status: 'CONNECTED', changedById: 42 })],
    });
    expect([...queues.values()].every((queue) => queue.length === 0)).toBe(true);
    expect(requestNumberLookup.where).toHaveBeenCalledWith(
      'request_no',
      'like',
      'CEMS-69-%',
    );
    expect(requestNumberLookup.count).toHaveBeenCalledWith('id as total');
  });

  it('preserves OFFICER_DIRECT_API when rows are read back through list()', async () => {
    const countBuilder = {
      clearSelect: jest.fn().mockReturnThis(),
      clearOrder: jest.fn().mockReturnThis(),
      count: jest.fn().mockReturnThis(),
      first: jest.fn(async () => ({ total: 1 })),
    };
    const listedRow = requestRow(new Date('2026-07-21T03:04:05.000Z'));
    let orderByCalls = 0;
    const rowsBuilder = {
      orderBy: jest.fn(() => {
        orderByCalls += 1;
        return orderByCalls >= 2 ? Promise.resolve([listedRow]) : rowsBuilder;
      }),
    };
    let pointOrderByCalls = 0;
    const pointRowsBuilder = {
      whereIn: jest.fn().mockReturnThis(),
      whereNull: jest.fn().mockReturnThis(),
      orderBy: jest.fn(() => {
        pointOrderByCalls += 1;
        return pointOrderByCalls >= 2 ? Promise.resolve([]) : pointRowsBuilder;
      }),
    };
    let historyOrderByCalls = 0;
    const historyRowsBuilder = {
      leftJoin: jest.fn().mockReturnThis(),
      whereIn: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      orderBy: jest.fn(() => {
        historyOrderByCalls += 1;
        return historyOrderByCalls >= 3 ? Promise.resolve([]) : historyRowsBuilder;
      }),
    };
    const snapshotRowsBuilder = {
      whereIn: jest.fn().mockReturnThis(),
      whereNull: jest.fn(async () => []),
    };
    const baseBuilder = {
      whereNull: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      whereExists: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      clone: jest.fn().mockReturnValueOnce(countBuilder).mockReturnValueOnce(rowsBuilder),
    };
    mockedDb
      .mockReturnValueOnce(baseBuilder)
      .mockReturnValueOnce(pointRowsBuilder)
      .mockReturnValueOnce(historyRowsBuilder)
      .mockReturnValueOnce(snapshotRowsBuilder);

    const result = await connectionRequestsRepository.list(
      {} as never,
      { actorUserId: 42, scope: { scope: 'ALL' }, regionalAccess: null } as never,
    );

    expect(baseBuilder.select.mock.calls[0]).toEqual(
      expect.arrayContaining(['request_no', 'submission_source', 'request_type']),
    );
    expect(result).toMatchObject({
      total: 1,
      rows: [
        expect.objectContaining({
          requestNo: 'CEMS-69-00001',
          submissionSource: 'OFFICER_DIRECT_API',
        }),
      ],
    });
  });
});

function makeChain(options: {
  first?: () => Promise<unknown>;
  update?: () => Promise<unknown>;
  terminalOrderBy?: () => Promise<unknown>;
  terminalOrderByAfter?: number;
}) {
  let orderByCalls = 0;
  const chain: Record<string, unknown> = {};
  const returnChain = jest.fn(() => chain);
  Object.assign(chain, {
    where: returnChain,
    whereNull: returnChain,
    whereRaw: returnChain,
    count: returnChain,
    forUpdate: returnChain,
    leftJoin: returnChain,
    select: returnChain,
    first: jest.fn(options.first ?? (async () => undefined)),
    update: jest.fn(options.update ?? (async () => 1)),
    orderBy: jest.fn(() => {
      orderByCalls += 1;
      if (options.terminalOrderBy && orderByCalls >= (options.terminalOrderByAfter ?? 1)) {
        return options.terminalOrderBy();
      }
      return chain;
    }),
  });
  return chain;
}

function directInput() {
  return {
    eligibleFactoryId: 17,
    requestType: 'ADD_MEASUREMENT_POINT',
    factoryId: 'factory-001',
    factoryName: 'โรงงานทดสอบ',
    factoryRegistrationNo: 'REG-001',
    systemType: 'CEMS',
    contactName: 'ผู้ประสานงาน',
    contactPhone: '0812345678',
    measurementPoints: [
      {
        pointName: 'ปล่องทดสอบ 1',
        pointCode: '  free form / จุด-01  ',
        pointType: 'STACK',
        parameters: ['CO2 (ppm)'],
      },
    ],
  };
}

function requestRow(now: Date) {
  return {
    id: 101,
    eligible_factory_id: 17,
    request_no: 'CEMS-69-00001',
    submission_source: 'OFFICER_DIRECT_API',
    request_type: 'ADD_MEASUREMENT_POINT',
    factory_id: 'factory-001',
    factory_name: 'โรงงานทดสอบ',
    factory_registration_no: 'REG-001',
    industry_main_order: null,
    industry_sub_order: null,
    business_activity: null,
    eia_assessment: null,
    eia_other: null,
    has_eia: null,
    project_name: null,
    address: null,
    latitude: null,
    longitude: null,
    system_type: 'CEMS',
    status: 'CONNECTED',
    contact_name: 'ผู้ประสานงาน',
    contact_phone: '0812345678',
    contact_email: null,
    contact_persons_json: null,
    notification_emails_json: null,
    officer_notification_emails_json: null,
    information_provider_name: null,
    information_provider_position: null,
    remarks: null,
    revision_reason: null,
    officer_note: null,
    connection_due_at: null,
    confirmed_at: null,
    verified_at: now,
    created_by: 42,
    updated_by: 42,
    created_at: now,
    updated_at: now,
  };
}

function measurementPointRow() {
  return {
    id: 202,
    request_id: 101,
    point_name: 'ปล่องทดสอบ 1',
    point_code: 'free form / จุด-01',
    point_type: 'STACK',
    latitude: null,
    longitude: null,
    parameters_json: JSON.stringify(['CO2 (ppm)']),
    description: null,
    details_json: null,
    documents_json: null,
    instruments_json: null,
  };
}

function statusHistoryRow(now: Date) {
  return {
    id: 303,
    request_id: 101,
    status: 'CONNECTED',
    note: 'เจ้าหน้าที่เพิ่มจุดตรวจวัดและเชื่อมต่อโดยตรงผ่าน API',
    changed_by: 42,
    changed_by_username: 'officer',
    changed_by_prename_th: null,
    changed_by_first_name: 'เจ้าหน้าที่',
    changed_by_last_name: 'ทดสอบ',
    changed_at: now,
  };
}

function factorySnapshotRow() {
  return {
    request_id: 101,
    region_code: 'ภาคกลาง',
    region_name: 'ภาคกลาง',
    province_code: '10',
    province_name: 'กรุงเทพมหานคร',
    district_code: null,
    district_name: null,
    subdistrict_code: null,
    subdistrict_name: null,
    industrial_estate_code: 'IE-01',
    industrial_estate_name: 'นิคมทดสอบ',
    factory_main_type_code: null,
    factory_main_type_label: null,
  };
}
