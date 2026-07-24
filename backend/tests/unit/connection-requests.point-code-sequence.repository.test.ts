import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('../../src/config/database', () => ({
  db: Object.assign(jest.fn(), {
    transaction: jest.fn(),
  }),
}));

import { db } from '../../src/config/database';
import { connectionRequestsRepository } from '../../src/modules/connection-requests/connection-requests.repository';
import { CONNECTION_REQUEST_STATUS } from '../../src/modules/connection-requests/connection-requests.types';

const mockedDb = db as unknown as jest.Mock<(...args: unknown[]) => unknown> & {
  transaction: jest.Mock<(...args: unknown[]) => Promise<unknown>>;
};

describe('normal operator connection point-code sequence', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-07-24T00:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('issues S2001 and S2002 for the first CEMS points', async () => {
    const harness = pointCodeHarness('CEMS');
    mockedDb.transaction.mockImplementationOnce(harness.runTransaction);

    const updated = await connectionRequestsRepository.updateStatus(
      101,
      CONNECTION_REQUEST_STATUS.WAITING_CONNECTION,
      42,
      { connectionDueAt: '2026-08-20T00:00:00.000Z' },
    );

    expect(updated.measurementPoints.map((point) => point.pointCode)).toEqual([
      'S2001',
      'S2002',
    ]);
    expect(harness.sequenceUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ last_sequence: 2002 }),
    );
  });

  it('issues W2003 for the next WPMS point regardless of Buddhist year', async () => {
    jest.setSystemTime(new Date('2028-07-24T00:00:00.000Z'));
    const harness = pointCodeHarness('WPMS', { initialSequence: 2002, pointIds: [201] });
    mockedDb.transaction.mockImplementationOnce(harness.runTransaction);

    const updated = await connectionRequestsRepository.updateStatus(
      101,
      CONNECTION_REQUEST_STATUS.WAITING_CONNECTION,
      42,
      { connectionDueAt: '2026-08-20T00:00:00.000Z' },
    );

    expect(updated.measurementPoints.map((point) => point.pointCode)).toEqual(['W2003']);
    expect(harness.sequenceUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ last_sequence: 2003 }),
    );
  });

  it('continues after the highest existing legacy point code', async () => {
    const harness = pointCodeHarness('CEMS', {
      existingPointCodes: ['CEMS-0099/2568', 'S2050'],
    });
    mockedDb.transaction.mockImplementationOnce(harness.runTransaction);

    const updated = await connectionRequestsRepository.updateStatus(
      101,
      CONNECTION_REQUEST_STATUS.WAITING_CONNECTION,
      42,
      { connectionDueAt: '2026-08-20T00:00:00.000Z' },
    );

    expect(updated.measurementPoints.map((point) => point.pointCode)).toEqual([
      'S2051',
      'S2052',
    ]);
  });

  it('continues the next request from the persisted point-code sequence', async () => {
    const harness = pointCodeHarness('CEMS', { initialSequence: 2002 });
    mockedDb.transaction.mockImplementationOnce(harness.runTransaction);

    const updated = await connectionRequestsRepository.updateStatus(
      101,
      CONNECTION_REQUEST_STATUS.WAITING_CONNECTION,
      42,
      { connectionDueAt: '2026-08-20T00:00:00.000Z' },
    );

    expect(updated.measurementPoints.map((point) => point.pointCode)).toEqual([
      'S2003',
      'S2004',
    ]);
  });

  it('does not reset the point-code sequence when the Buddhist year changes', async () => {
    jest.setSystemTime(new Date('2027-07-24T00:00:00.000Z'));
    const harness = pointCodeHarness('CEMS', {
      initialSequence: 2002,
      existingPointCodes: ['CEMS-9999/2569'],
      pointIds: [201],
    });
    mockedDb.transaction.mockImplementationOnce(harness.runTransaction);

    const updated = await connectionRequestsRepository.updateStatus(
      101,
      CONNECTION_REQUEST_STATUS.WAITING_CONNECTION,
      42,
      { connectionDueAt: '2027-08-20T00:00:00.000Z' },
    );

    expect(updated.measurementPoints.map((point) => point.pointCode)).toEqual(['S2003']);
  });

  it('uses the highest W point code and ignores other point-code shapes', async () => {
    const harness = pointCodeHarness('WPMS', {
      existingPointCodes: ['P9999', 'W2005', 'WEMS-0099/2568'],
    });
    mockedDb.transaction.mockImplementationOnce(harness.runTransaction);

    const updated = await connectionRequestsRepository.updateStatus(
      101,
      CONNECTION_REQUEST_STATUS.WAITING_CONNECTION,
      42,
      { connectionDueAt: '2026-08-20T00:00:00.000Z' },
    );

    expect(updated.measurementPoints.map((point) => point.pointCode)).toEqual([
      'W2006',
      'W2007',
    ]);
  });

  it('issues point codes only once when the same request is approved concurrently', async () => {
    const harness = concurrentApprovalHarness('CEMS');
    mockedDb.transaction.mockImplementation(harness.runTransaction);

    const approve = () =>
      connectionRequestsRepository.updateStatus(
        101,
        CONNECTION_REQUEST_STATUS.WAITING_CONNECTION,
        42,
        { connectionDueAt: '2026-08-20T00:00:00.000Z' },
      );
    const [first, second] = await Promise.all([approve(), approve()]);

    expect(first.measurementPoints.map((point) => point.pointCode)).toEqual([
      'S2001',
      'S2002',
    ]);
    expect(second.measurementPoints.map((point) => point.pointCode)).toEqual([
      'S2001',
      'S2002',
    ]);
    expect(harness.lastSequence()).toBe(2002);
  });
});

function pointCodeHarness(
  systemType: 'CEMS' | 'WPMS',
  options: {
    existingPointCodes?: string[];
    initialSequence?: number;
    pointIds?: number[];
  } = {},
) {
  const pointIds = options.pointIds ?? [201, 202];
  const assignedCodes = new Map<number, string>();
  const sequenceUpdate = jest.fn(async (_values: Record<string, unknown>) => 1);
  const pointUpdate = (pointId: number) =>
    makeChain({
      update: async (values: Record<string, unknown>) => {
        assignedCodes.set(pointId, String(values.point_code));
        return 1;
      },
    });
  const requestStatusUpdate = makeChain({ update: async () => 1 });
  const historyInsert = jest.fn(async () => 1);

  const queues = new Map<string, unknown[]>([
    [
      'cems_wpms_connection_requests',
      [
        makeChain({
          first: async () => ({ system_type: systemType, request_type: 'NEW_CONNECTION' }),
        }),
        requestStatusUpdate,
        makeChain({ first: async () => requestRow(systemType) }),
      ],
    ],
    [
      'cems_wpms_measurement_points',
      [
        makeChain({ select: async () => pointIds.map((id) => ({ id })) }),
        makeChain({
          select: async () =>
            (options.existingPointCodes ?? []).map((pointCode) => ({ point_code: pointCode })),
        }),
        ...pointIds.map(pointUpdate),
        makeChain({
          terminalOrderBy: async () =>
            pointIds.map((id) => measurementPointRow(id, assignedCodes.get(id) ?? null)),
        }),
      ],
    ],
    [
      'cems_wpms_point_code_sequences',
      [
        makeChain({
          first: async () => ({
            system_type: systemType,
            prefix: systemType === 'CEMS' ? 'S' : 'W',
            last_sequence: options.initialSequence ?? 2000,
          }),
        }),
        makeChain({ update: sequenceUpdate }),
      ],
    ],
    ['cems_wpms_request_status_history', [{ insert: historyInsert }, historyRowsBuilder()]],
    ['cems_wpms_request_factory_snapshots', [makeChain({ first: async () => undefined })]],
  ]);

  const trx = Object.assign(
    jest.fn((tableName: string) => {
      const builder = queues.get(tableName)?.shift();
      if (!builder) throw new Error(`Unexpected query for ${tableName}`);
      return builder;
    }),
    {
      raw: jest.fn(async () => undefined),
      fn: { now: jest.fn(() => 'db-now') },
    },
  );

  return {
    sequenceUpdate,
    runTransaction: async (...args: unknown[]) => {
      const callback = args[0] as (transaction: typeof trx) => Promise<unknown>;
      const result = await callback(trx);
      expect([...queues.values()].every((queue) => queue.length === 0)).toBe(true);
      return result;
    },
  };
}

function makeChain(options: {
  first?: () => Promise<unknown>;
  select?: () => Promise<unknown>;
  update?: (values: Record<string, unknown>) => Promise<unknown>;
  terminalOrderBy?: () => Promise<unknown>;
  terminalOrderByAfter?: number;
}) {
  let orderByCalls = 0;
  const chain: Record<string, unknown> = {};
  const returnChain = jest.fn(() => chain);
  Object.assign(chain, {
    where: returnChain,
    whereNull: returnChain,
    orWhere: returnChain,
    forUpdate: returnChain,
    leftJoin: returnChain,
    first: jest.fn(options.first ?? (async () => undefined)),
    select: jest.fn(options.select ?? returnChain),
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

function historyRowsBuilder() {
  return makeChain({
    terminalOrderByAfter: 2,
    terminalOrderBy: async () => [
      {
        id: 301,
        request_id: 101,
        status: CONNECTION_REQUEST_STATUS.WAITING_CONNECTION,
        note: null,
        changed_by: 42,
        changed_by_username: 'officer',
        changed_by_prename_th: null,
        changed_by_first_name: null,
        changed_by_last_name: null,
        changed_at: '2026-07-21T00:00:00.000Z',
      },
    ],
  });
}

function requestRow(systemType: 'CEMS' | 'WPMS') {
  return {
    id: 101,
    request_no: `${systemType === 'CEMS' ? 'CEMS' : 'WEMS'}-0001/2569`,
    submission_source: 'OPERATOR_FORM',
    request_type: 'NEW_CONNECTION',
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
    system_type: systemType,
    status: CONNECTION_REQUEST_STATUS.WAITING_CONNECTION,
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
    connection_due_at: '2026-08-20T00:00:00.000Z',
    confirmed_at: null,
    verified_at: null,
    created_by: 7,
    updated_by: 42,
    created_at: '2026-07-21T00:00:00.000Z',
    updated_at: '2026-07-21T00:00:00.000Z',
  };
}

function measurementPointRow(id: number, pointCode: string | null) {
  return {
    id,
    request_id: 101,
    point_name: `จุดตรวจวัด ${id}`,
    point_code: pointCode,
    point_type: 'STACK',
    latitude: null,
    longitude: null,
    parameters_json: '[]',
    description: null,
    details_json: null,
    documents_json: null,
    instruments_json: null,
  };
}

function concurrentApprovalHarness(systemType: 'CEMS' | 'WPMS') {
  const prefix = systemType === 'CEMS' ? 'S' : 'W';
  const assignedCodes = new Map<number, string | null>([
    [201, null],
    [202, null],
  ]);
  const requestLock = new AsyncMutex();
  const sequenceLock = new AsyncMutex();
  const unlockedRequestReads = new AsyncBarrier(2);
  let lastSequence = 2000;

  const runTransaction = async (...args: unknown[]) => {
    const releases: Array<() => void> = [];
    const state = {
      requestCalls: 0,
      pointCalls: 0,
      sequenceCalls: 0,
      historyCalls: 0,
      missingIds: [] as Array<{ id: number }>,
    };
    const trx = Object.assign(
      jest.fn((tableName: string) => {
        if (tableName === 'cems_wpms_connection_requests') {
          state.requestCalls += 1;
          if (state.requestCalls === 1) {
            return lockingFirstBuilder(async (locked) => {
              if (locked) releases.push(await requestLock.acquire());
              else await unlockedRequestReads.wait();
              return { system_type: systemType, request_type: 'NEW_CONNECTION' };
            });
          }
          if (state.requestCalls === 2) return makeChain({ update: async () => 1 });
          return makeChain({ first: async () => requestRow(systemType) });
        }

        if (tableName === 'cems_wpms_measurement_points') {
          state.pointCalls += 1;
          if (state.pointCalls === 1) {
            return makeChain({
              select: async () => {
                state.missingIds = [...assignedCodes.entries()]
                  .filter(([, code]) => code === null)
                  .map(([id]) => ({ id }));
                return state.missingIds;
              },
            });
          }
          if (state.pointCalls === 2 && state.missingIds.length > 0) {
            return makeChain({
              select: async () =>
                [...assignedCodes.values()]
                  .filter((code): code is string => code !== null)
                  .map((pointCode) => ({ point_code: pointCode })),
            });
          }

          const pointUpdateIndex = state.pointCalls - 3;
          if (pointUpdateIndex >= 0 && pointUpdateIndex < state.missingIds.length) {
            const pointId = state.missingIds[pointUpdateIndex].id;
            return makeChain({
              update: async (values) => {
                assignedCodes.set(pointId, String(values.point_code));
                return 1;
              },
            });
          }

          return makeChain({
            terminalOrderBy: async () =>
              [...assignedCodes.entries()].map(([id, code]) => measurementPointRow(id, code)),
          });
        }

        if (tableName === 'cems_wpms_point_code_sequences') {
          if (state.missingIds.length === 0) {
            throw new Error(
              'Sequence must not be reserved when all request points already have codes',
            );
          }
          state.sequenceCalls += 1;
          if (state.sequenceCalls === 1) {
            return lockingFirstBuilder(async (locked) => {
              if (!locked) throw new Error('Sequence row was not locked');
              releases.push(await sequenceLock.acquire());
              return { system_type: systemType, prefix, last_sequence: lastSequence };
            });
          }
          return makeChain({
            update: async (values) => {
              lastSequence = Number(values.last_sequence);
              return 1;
            },
          });
        }

        if (tableName === 'cems_wpms_request_status_history') {
          state.historyCalls += 1;
          if (state.historyCalls === 1) return { insert: jest.fn(async () => 1) };
          return historyRowsBuilder();
        }

        if (tableName === 'cems_wpms_request_factory_snapshots') {
          return makeChain({ first: async () => undefined });
        }

        throw new Error(`Unexpected query for ${tableName}`);
      }),
      {
        raw: jest.fn(async () => undefined),
        fn: { now: jest.fn(() => 'db-now') },
      },
    );

    try {
      const callback = args[0] as (transaction: typeof trx) => Promise<unknown>;
      return await callback(trx);
    } finally {
      releases.reverse().forEach((release) => release());
    }
  };

  return { runTransaction, lastSequence: () => lastSequence };
}

function lockingFirstBuilder(load: (locked: boolean) => Promise<unknown>) {
  let locked = false;
  const chain: Record<string, unknown> = {};
  const returnChain = jest.fn(() => chain);
  Object.assign(chain, {
    where: returnChain,
    whereNull: returnChain,
    forUpdate: jest.fn(() => {
      locked = true;
      return chain;
    }),
    first: jest.fn(() => load(locked)),
  });
  return chain;
}

class AsyncMutex {
  private tail = Promise.resolve();

  async acquire(): Promise<() => void> {
    let release: () => void = () => {};
    const current = new Promise<void>((resolve) => {
      release = resolve;
    });
    const previous = this.tail;
    this.tail = previous.then(() => current);
    await previous;
    return release;
  }
}

class AsyncBarrier {
  private arrivals = 0;
  private readonly ready: Promise<void>;
  private release: () => void = () => {};

  constructor(private readonly target: number) {
    this.ready = new Promise<void>((resolve) => {
      this.release = resolve;
    });
  }

  async wait(): Promise<void> {
    this.arrivals += 1;
    if (this.arrivals >= this.target) this.release();
    await this.ready;
  }
}
