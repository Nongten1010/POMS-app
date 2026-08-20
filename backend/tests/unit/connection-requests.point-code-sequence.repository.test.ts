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

    expect(updated.measurementPoints.map((point) => point.pointCode)).toEqual(['S2001', 'S2002']);
    expect(harness.sequenceUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ last_sequence: 2002 }),
    );
  });

  it('issues P2003 for the next WPMS point regardless of Buddhist year', async () => {
    jest.setSystemTime(new Date('2028-07-24T00:00:00.000Z'));
    const harness = pointCodeHarness('WPMS', { initialSequence: 2002, pointIds: [201] });
    mockedDb.transaction.mockImplementationOnce(harness.runTransaction);

    const updated = await connectionRequestsRepository.updateStatus(
      101,
      CONNECTION_REQUEST_STATUS.WAITING_CONNECTION,
      42,
      { connectionDueAt: '2026-08-20T00:00:00.000Z' },
    );

    expect(updated.measurementPoints.map((point) => point.pointCode)).toEqual(['P2003']);
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

    expect(updated.measurementPoints.map((point) => point.pointCode)).toEqual(['S2051', 'S2052']);
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

    expect(updated.measurementPoints.map((point) => point.pointCode)).toEqual(['S2003', 'S2004']);
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

  it('preserves imported legacy codes and assigns new codes only to missing points', async () => {
    const harness = pointCodeHarness('CEMS', {
      initialSequence: 2000,
      pointRows: [
        { id: 201, pointCode: 'S0001', assignmentMode: 'LEGACY_IMPORTED' },
        { id: 202, pointCode: null },
        { id: 203, pointCode: 'S0100', assignmentMode: 'LEGACY_IMPORTED' },
      ],
    });
    mockedDb.transaction.mockImplementationOnce(harness.runTransaction);

    const updated = await connectionRequestsRepository.updateStatus(
      101,
      CONNECTION_REQUEST_STATUS.WAITING_CONNECTION,
      42,
      { connectionDueAt: '2026-08-20T00:00:00.000Z' },
    );

    expect(updated.measurementPoints.map((point) => point.pointCode)).toEqual([
      'S0001',
      'S2001',
      'S0100',
    ]);
    expect(harness.sequenceUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ last_sequence: 2001 }),
    );
  });

  it('applies a MANUAL_LEGACY code and an AUTO code in the same approval', async () => {
    const harness = pointCodeHarness('CEMS', {
      pointIds: [201, 202],
      pointCodeAssignments: [
        {
          measurementPointId: 201,
          assignmentMode: 'MANUAL_LEGACY',
          pointCode: ' s1000 ',
          reason: 'ใช้รหัสเดิมของจุดตรวจวัดเก่า',
        },
        { measurementPointId: 202, assignmentMode: 'AUTO' },
      ],
    });
    mockedDb.transaction.mockImplementationOnce(harness.runTransaction);

    const updated = await connectionRequestsRepository.updateStatus(
      101,
      CONNECTION_REQUEST_STATUS.WAITING_CONNECTION,
      42,
      { connectionDueAt: '2026-08-20T00:00:00.000Z' },
      { pointCodeAssignments: harness.pointCodeAssignments },
    );

    expect(updated.measurementPoints).toEqual([
      expect.objectContaining({
        id: 201,
        pointCode: 'S1000',
        pointCodeAssignmentMode: 'MANUAL_LEGACY',
      }),
      expect.objectContaining({
        id: 202,
        pointCode: 'S2001',
        pointCodeAssignmentMode: 'AUTO',
      }),
    ]);
    expect(harness.registryInsert).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        normalized_point_code: 'S1000',
        assignment_mode: 'MANUAL_LEGACY',
        reason: 'ใช้รหัสเดิมของจุดตรวจวัดเก่า',
      }),
    );
    expect(harness.registryInsert).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        normalized_point_code: 'S2001',
        assignment_mode: 'AUTO',
        reason: null,
      }),
    );
  });

  it('rejects a manual code whose prefix does not match the request system', async () => {
    const harness = pointCodeHarness('CEMS', {
      pointIds: [201],
      pointCodeAssignments: [
        {
          measurementPointId: 201,
          assignmentMode: 'MANUAL_LEGACY',
          pointCode: 'P1000',
          reason: 'ใช้รหัสเดิมของจุดตรวจวัดเก่า',
        },
      ],
    });
    mockedDb.transaction.mockImplementationOnce(harness.runTransaction);

    await expect(
      connectionRequestsRepository.updateStatus(
        101,
        CONNECTION_REQUEST_STATUS.WAITING_CONNECTION,
        42,
        { connectionDueAt: '2026-08-20T00:00:00.000Z' },
        { pointCodeAssignments: harness.pointCodeAssignments },
      ),
    ).rejects.toMatchObject({
      statusCode: 400,
      code: 'BAD_REQUEST',
      details: {
        path: 'pointCodeAssignments.0.pointCode',
        reason: 'INVALID_MANUAL_LEGACY_POINT_CODE',
        pointCode: 'P1000',
        systemType: 'CEMS',
      },
    });
    expect(harness.registryInsert).not.toHaveBeenCalled();
  });

  it('requires assignments to cover every unassigned point exactly once', async () => {
    const harness = pointCodeHarness('WPMS', {
      pointIds: [201, 202],
      pointCodeAssignments: [{ measurementPointId: 201, assignmentMode: 'AUTO' }],
    });
    mockedDb.transaction.mockImplementationOnce(harness.runTransaction);

    await expect(
      connectionRequestsRepository.updateStatus(
        101,
        CONNECTION_REQUEST_STATUS.WAITING_CONNECTION,
        42,
        { connectionDueAt: '2026-08-20T00:00:00.000Z' },
        { pointCodeAssignments: harness.pointCodeAssignments },
      ),
    ).rejects.toMatchObject({
      statusCode: 400,
      code: 'BAD_REQUEST',
      details: {
        path: 'pointCodeAssignments',
        reason: 'POINT_CODE_ASSIGNMENTS_MISMATCH',
        expectedMeasurementPointIds: [201, 202],
        receivedMeasurementPointIds: [201],
      },
    });
  });

  it('maps a registry uniqueness failure to the conflicting manual assignment', async () => {
    const harness = pointCodeHarness('WPMS', {
      pointIds: [201],
      pointCodeAssignments: [
        {
          measurementPointId: 201,
          assignmentMode: 'MANUAL_LEGACY',
          pointCode: 'P1000',
          reason: 'ใช้รหัสเดิมของจุดตรวจวัดเก่า',
        },
      ],
      registryConflictPointCode: 'P1000',
    });
    mockedDb.transaction.mockImplementationOnce(harness.runTransaction);

    await expect(
      connectionRequestsRepository.updateStatus(
        101,
        CONNECTION_REQUEST_STATUS.WAITING_CONNECTION,
        42,
        { connectionDueAt: '2026-08-20T00:00:00.000Z' },
        { pointCodeAssignments: harness.pointCodeAssignments },
      ),
    ).rejects.toMatchObject({
      statusCode: 409,
      code: 'CONFLICT',
      details: {
        path: 'pointCodeAssignments.0.pointCode',
        reason: 'POINT_CODE_ALREADY_ASSIGNED',
        pointCode: 'P1000',
      },
    });
  });

  it('accepts the same finalized assignments again without reserving codes twice', async () => {
    const harness = pointCodeHarness('CEMS', {
      pointRows: [
        { id: 201, pointCode: 'S1000', assignmentMode: 'MANUAL_LEGACY' },
        { id: 202, pointCode: 'S2001', assignmentMode: 'AUTO' },
      ],
      pointCodeAssignments: [
        {
          measurementPointId: 201,
          assignmentMode: 'MANUAL_LEGACY',
          pointCode: 'S1000',
          reason: 'ใช้รหัสเดิมของจุดตรวจวัดเก่า',
        },
        { measurementPointId: 202, assignmentMode: 'AUTO' },
      ],
    });
    mockedDb.transaction.mockImplementationOnce(harness.runTransaction);

    const updated = await connectionRequestsRepository.updateStatus(
      101,
      CONNECTION_REQUEST_STATUS.WAITING_CONNECTION,
      42,
      { connectionDueAt: '2026-08-20T00:00:00.000Z' },
      { pointCodeAssignments: harness.pointCodeAssignments },
    );

    expect(updated.measurementPoints.map((point) => point.pointCode)).toEqual(['S1000', 'S2001']);
    expect(harness.registryInsert).not.toHaveBeenCalled();
    expect(harness.sequenceUpdate).not.toHaveBeenCalled();
  });

  it('uses the highest P point code and ignores historical or unrelated point-code shapes', async () => {
    const harness = pointCodeHarness('WPMS', {
      existingPointCodes: ['W9999', 'P2005', 'WEMS-0099/2568'],
    });
    mockedDb.transaction.mockImplementationOnce(harness.runTransaction);

    const updated = await connectionRequestsRepository.updateStatus(
      101,
      CONNECTION_REQUEST_STATUS.WAITING_CONNECTION,
      42,
      { connectionDueAt: '2026-08-20T00:00:00.000Z' },
    );

    expect(updated.measurementPoints.map((point) => point.pointCode)).toEqual(['P2006', 'P2007']);
  });

  it('issues automatic codes only once when the same request is approved concurrently', async () => {
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

    expect(first.measurementPoints.map((point) => point.pointCode)).toEqual(['S2001', 'S2002']);
    expect(second.measurementPoints.map((point) => point.pointCode)).toEqual(['S2001', 'S2002']);
    expect(harness.lastSequence()).toBe(2002);
    expect(harness.registryInsert).toHaveBeenCalledTimes(2);
  });
});

type PointCodeAssignmentMode = 'AUTO' | 'MANUAL_LEGACY' | 'LEGACY_IMPORTED';

type ManualPointCodeAssignment = {
  measurementPointId: number;
  assignmentMode: 'MANUAL_LEGACY';
  pointCode: string;
  reason: string;
};

type PointCodeAssignment =
  | ManualPointCodeAssignment
  | { measurementPointId: number; assignmentMode: 'AUTO' };

type PointCodeState = {
  id: number;
  pointCode: string | null;
  assignmentMode: PointCodeAssignmentMode | null;
  assignmentReason: string | null;
};

function pointCodeHarness(
  systemType: 'CEMS' | 'WPMS',
  options: {
    existingPointCodes?: string[];
    initialSequence?: number;
    pointIds?: number[];
    pointRows?: Array<{
      id: number;
      pointCode: string | null;
      assignmentMode?: PointCodeAssignmentMode;
    }>;
    pointCodeAssignments?: PointCodeAssignment[];
    registryConflictPointCode?: string;
  } = {},
) {
  const pointRows: PointCodeState[] = (
    options.pointRows ?? (options.pointIds ?? [201, 202]).map((id) => ({ id, pointCode: null }))
  ).map((point) => ({
    ...point,
    assignmentMode: 'assignmentMode' in point ? (point.assignmentMode ?? null) : null,
    assignmentReason: null,
  }));
  const pointState = new Map<number, PointCodeState>(pointRows.map((point) => [point.id, point]));
  const pointCodeAssignments = options.pointCodeAssignments;
  const initiallyUnassignedIds = pointRows
    .filter((point) => !point.pointCode?.trim())
    .map((point) => point.id);
  const assignmentCoverageMatches =
    pointCodeAssignments !== undefined &&
    pointCodeAssignments.length === initiallyUnassignedIds.length &&
    new Set(pointCodeAssignments.map((assignment) => assignment.measurementPointId)).size ===
      pointCodeAssignments.length &&
    initiallyUnassignedIds.every((id) =>
      pointCodeAssignments.some((assignment) => assignment.measurementPointId === id),
    );
  const manualAssignments =
    initiallyUnassignedIds.length > 0 && assignmentCoverageMatches
      ? (pointCodeAssignments ?? []).filter(
          (assignment): assignment is ManualPointCodeAssignment =>
            assignment.assignmentMode === 'MANUAL_LEGACY',
        )
      : [];
  const autoPointIds = pointCodeAssignments
    ? assignmentCoverageMatches
      ? pointCodeAssignments
          .filter((assignment) => assignment.assignmentMode === 'AUTO')
          .map((assignment) => assignment.measurementPointId)
      : []
    : initiallyUnassignedIds;
  const sequenceUpdate = jest.fn(async (_values: Record<string, unknown>) => 1);
  const pointUpdate = (pointId: number) =>
    makeChain({
      update: async (values: Record<string, unknown>) => {
        const current = pointState.get(pointId);
        if (!current) throw new Error(`Unknown measurement point ${pointId}`);
        current.pointCode = String(values.point_code);
        current.assignmentMode = (values.point_code_assignment_mode ??
          null) as PointCodeAssignmentMode | null;
        current.assignmentReason = (values.point_code_assignment_reason ?? null) as string | null;
        return 1;
      },
    });
  const registryRows = (options.existingPointCodes ?? []).map((pointCode) => ({
    point_code: pointCode,
    normalized_point_code: pointCode.trim().toUpperCase(),
  }));
  const registryInsert = jest.fn(async (values: Record<string, unknown>) => {
    const normalizedPointCode = String(values.normalized_point_code);
    if (normalizedPointCode === options.registryConflictPointCode?.trim().toUpperCase()) {
      throw {
        number: 2627,
        message: "Violation of UNIQUE KEY constraint 'uq_cems_wpms_point_code_registry_normalized'",
      };
    }
    registryRows.push({
      point_code: String(values.point_code),
      normalized_point_code: normalizedPointCode,
    });
    return 1;
  });
  const requestStatusUpdate = makeChain({ update: async () => 1 });
  const historyInsert = jest.fn(async () => 1);

  const measurementPointBuilders: unknown[] = [];
  if (pointCodeAssignments) {
    measurementPointBuilders.push(
      makeChain({
        select: async () =>
          [...pointState.values()].map((point) => ({
            id: point.id,
            point_code: point.pointCode,
            point_code_assignment_mode: point.assignmentMode,
          })),
      }),
    );
    measurementPointBuilders.push(
      ...manualAssignments.map((item) => pointUpdate(item.measurementPointId)),
    );
  }
  measurementPointBuilders.push(
    makeChain({
      select: async () =>
        [...pointState.values()]
          .filter((point) => !point.pointCode?.trim())
          .map((point) => ({ id: point.id })),
    }),
    ...autoPointIds.map((pointId) => pointUpdate(pointId)),
    makeChain({
      terminalOrderBy: async () =>
        [...pointState.values()].map((point) => measurementPointRow(point)),
    }),
  );

  const registryBuilders: unknown[] = [];
  registryBuilders.push(...manualAssignments.map(() => makeChain({ insert: registryInsert })));
  if (autoPointIds.length > 0) {
    registryBuilders.push(
      makeChain({ select: async () => registryRows.map(({ point_code }) => ({ point_code })) }),
      ...autoPointIds.map(() => makeChain({ insert: registryInsert })),
    );
  }

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
    ['cems_wpms_measurement_points', measurementPointBuilders],
    [
      'cems_wpms_point_code_sequences',
      autoPointIds.length > 0
        ? [
            makeChain({
              first: async () => ({
                system_type: systemType,
                prefix: systemType === 'CEMS' ? 'S' : 'P',
                last_sequence: options.initialSequence ?? 2000,
              }),
            }),
            makeChain({ update: sequenceUpdate }),
          ]
        : [],
    ],
    ['cems_wpms_point_code_registry', registryBuilders],
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
    pointCodeAssignments,
    registryInsert,
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
  insert?: (values: Record<string, unknown>) => Promise<unknown>;
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
    insert: jest.fn(options.insert ?? (async () => 1)),
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
    request_no: `${systemType}-0001/2569`,
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

function measurementPointRow(point: PointCodeState) {
  return {
    id: point.id,
    request_id: 101,
    point_name: `จุดตรวจวัด ${point.id}`,
    point_code: point.pointCode,
    point_code_assignment_mode: point.assignmentMode,
    point_code_assignment_reason: point.assignmentReason,
    point_code_assigned_by: point.assignmentMode ? 42 : null,
    point_code_assigned_at: point.assignmentMode ? '2026-07-24T00:00:00.000Z' : null,
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
  const prefix = systemType === 'CEMS' ? 'S' : 'P';
  const pointState = new Map<number, PointCodeState>([
    [201, { id: 201, pointCode: null, assignmentMode: null, assignmentReason: null }],
    [202, { id: 202, pointCode: null, assignmentMode: null, assignmentReason: null }],
  ]);
  const registryRows: Array<{ point_code: string }> = [];
  const registryInsert = jest.fn(async (values: Record<string, unknown>) => {
    registryRows.push({ point_code: String(values.point_code) });
    return 1;
  });
  const requestLock = new AsyncMutex();
  const sequenceLock = new AsyncMutex();
  let lastSequence = 2000;

  const runTransaction = async (...args: unknown[]) => {
    const releases: Array<() => void> = [];
    const state = {
      requestCalls: 0,
      pointCalls: 0,
      registryCalls: 0,
      sequenceCalls: 0,
      historyCalls: 0,
      missingIds: [] as number[],
    };
    const trx = Object.assign(
      jest.fn((tableName: string) => {
        if (tableName === 'cems_wpms_connection_requests') {
          state.requestCalls += 1;
          if (state.requestCalls === 1) {
            return lockingFirstBuilder(async () => {
              releases.push(await requestLock.acquire());
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
                state.missingIds = [...pointState.values()]
                  .filter((point) => !point.pointCode)
                  .map((point) => point.id);
                return state.missingIds.map((id) => ({ id }));
              },
            });
          }

          const updateIndex = state.pointCalls - 2;
          if (updateIndex < state.missingIds.length) {
            const pointId = state.missingIds[updateIndex];
            return makeChain({
              update: async (values) => {
                const point = pointState.get(pointId);
                if (!point) throw new Error(`Unknown measurement point ${pointId}`);
                point.pointCode = String(values.point_code);
                point.assignmentMode = 'AUTO';
                return 1;
              },
            });
          }

          return makeChain({
            terminalOrderBy: async () =>
              [...pointState.values()].map((point) => measurementPointRow(point)),
          });
        }

        if (tableName === 'cems_wpms_point_code_registry') {
          state.registryCalls += 1;
          if (state.registryCalls === 1) {
            return makeChain({ select: async () => [...registryRows] });
          }
          return makeChain({ insert: registryInsert });
        }

        if (tableName === 'cems_wpms_point_code_sequences') {
          state.sequenceCalls += 1;
          if (state.sequenceCalls === 1) {
            return lockingFirstBuilder(async () => {
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

  return { runTransaction, lastSequence: () => lastSequence, registryInsert };
}

function lockingFirstBuilder(load: () => Promise<unknown>) {
  const chain: Record<string, unknown> = {};
  const returnChain = jest.fn(() => chain);
  Object.assign(chain, {
    where: returnChain,
    whereNull: returnChain,
    forUpdate: returnChain,
    first: jest.fn(load),
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
