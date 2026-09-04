import { beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('../../src/config/database', () => ({
  db: Object.assign(jest.fn(), {
    transaction: jest.fn(),
  }),
}));

import { db } from '../../src/config/database';
import { pomsFactoriesRepository } from '../../src/modules/poms-factories/poms-factories.repository';
import { POMS_FACTORY_EDIT_REQUEST_STATUS } from '../../src/modules/poms-factories/poms-factories.types';

const mockedDb = db as unknown as jest.Mock<(...args: unknown[]) => unknown> & {
  transaction: jest.Mock<(...args: unknown[]) => Promise<unknown>>;
};

describe('pomsFactoriesRepository.cancelEditRequest', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('locks, rechecks, closes, audits, and snapshots the cancellation in one transaction', async () => {
    const harness = cancellationHarness(POMS_FACTORY_EDIT_REQUEST_STATUS.REVISION_REQUESTED);
    mockedDb.transaction.mockImplementationOnce(harness.runTransaction);

    const result = await pomsFactoriesRepository.cancelEditRequest(11, 42);

    expect(result).toEqual(
      expect.objectContaining({
        id: 11,
        status: POMS_FACTORY_EDIT_REQUEST_STATUS.CANCELLED,
        statusLabel: 'ยกเลิก',
        isOpen: false,
      }),
    );
    expect(harness.lockedRequest.forUpdate).toHaveBeenCalledTimes(1);
    expect(harness.requestUpdate).toHaveBeenCalledWith({
      status: POMS_FACTORY_EDIT_REQUEST_STATUS.CANCELLED,
      is_open: false,
      updated_by: 42,
      updated_at: 'db-now',
    });
    expect(harness.eventInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        request_id: 11,
        action: 'CANCEL',
        from_status: POMS_FACTORY_EDIT_REQUEST_STATUS.REVISION_REQUESTED,
        to_status: POMS_FACTORY_EDIT_REQUEST_STATUS.CANCELLED,
        event_note: null,
        actor_user_id: 42,
        created_by: 42,
        updated_by: 42,
      }),
    );
    const insertedEvent = harness.eventInsert.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(JSON.parse(String(insertedEvent.factory_snapshot_json))).toEqual(
      expect.objectContaining({
        eligibleFactoryId: 7,
        factoryId: 'factory-001',
        factoryName: 'บริษัท ทดสอบ จำกัด (ใหม่)',
      }),
    );
    expect(result.events).toEqual([
      expect.objectContaining({
        action: 'CANCEL',
        fromStatus: POMS_FACTORY_EDIT_REQUEST_STATUS.REVISION_REQUESTED,
        toStatus: POMS_FACTORY_EDIT_REQUEST_STATUS.CANCELLED,
        actorUserId: 42,
      }),
    ]);
  });

  it('rechecks the owner after locking and rejects a concurrent non-owner write', async () => {
    const harness = cancellationHarness(POMS_FACTORY_EDIT_REQUEST_STATUS.PENDING_REVIEW, 99);
    mockedDb.transaction.mockImplementationOnce(harness.runTransaction);

    await expect(pomsFactoriesRepository.cancelEditRequest(11, 42)).rejects.toMatchObject({
      statusCode: 403,
      code: 'FORBIDDEN',
      message: 'Only the request owner can perform this action',
    });

    expect(harness.requestUpdate).not.toHaveBeenCalled();
    expect(harness.eventInsert).not.toHaveBeenCalled();
  });

  it.each([
    POMS_FACTORY_EDIT_REQUEST_STATUS.CANCELLED,
    POMS_FACTORY_EDIT_REQUEST_STATUS.APPROVED,
    POMS_FACTORY_EDIT_REQUEST_STATUS.REJECTED,
  ])('rejects a locked terminal request in %s without another event', async (status) => {
    const harness = cancellationHarness(status);
    mockedDb.transaction.mockImplementationOnce(harness.runTransaction);

    await expect(pomsFactoriesRepository.cancelEditRequest(11, 42)).rejects.toMatchObject({
      statusCode: 409,
      code: 'INVALID_STATUS_TRANSITION',
      message: 'ไม่สามารถยกเลิกคำขอในสถานะปัจจุบันได้',
      details: { id: 11, status },
    });

    expect(harness.requestUpdate).not.toHaveBeenCalled();
    expect(harness.eventInsert).not.toHaveBeenCalled();
  });
});

function cancellationHarness(status: string, createdBy = 42) {
  const lockedRow = requestRow({ status, created_by: createdBy });
  const cancelledRow = requestRow({
    status: POMS_FACTORY_EDIT_REQUEST_STATUS.CANCELLED,
    is_open: 0,
    updated_at: '2026-09-04T01:00:00.000Z',
  });
  const lockedRequest = makeChain({ firstResult: lockedRow });
  const requestUpdate = jest.fn(async (_values: Record<string, unknown>) => 1);
  const reloadRequest = makeChain({ firstResult: cancelledRow });
  const eventInsert = jest.fn(async (_values: Record<string, unknown>) => 1);
  const eventList = makeChain({
    awaitedResult: [
      {
        id: 2,
        request_id: 11,
        action: 'CANCEL',
        from_status: status,
        to_status: POMS_FACTORY_EDIT_REQUEST_STATUS.CANCELLED,
        event_note: null,
        actor_user_id: 42,
        created_at: '2026-09-04T01:00:00.000Z',
      },
    ],
  });
  const queues = new Map<string, unknown[]>([
    [
      'poms_factory_edit_requests',
      [lockedRequest, makeChain({ update: requestUpdate }), reloadRequest],
    ],
    ['poms_factory_edit_request_events', [makeChain({ insert: eventInsert }), eventList]],
  ]);
  const trx = Object.assign(
    jest.fn((tableName: string) => {
      const builder = queues.get(tableName)?.shift();
      if (!builder) throw new Error(`Unexpected query for ${tableName}`);
      return builder;
    }),
    { fn: { now: jest.fn(() => 'db-now') } },
  );

  return {
    lockedRequest,
    requestUpdate,
    eventInsert,
    runTransaction: async (...args: unknown[]) => {
      const callback = args[0] as (transaction: typeof trx) => Promise<unknown>;
      return callback(trx);
    },
  };
}

function makeChain(options: {
  firstResult?: unknown;
  awaitedResult?: unknown;
  update?: (values: Record<string, unknown>) => Promise<unknown>;
  insert?: (values: Record<string, unknown>) => Promise<unknown>;
}) {
  const chain: Record<string, unknown> = {};
  Object.assign(chain, {
    where: jest.fn(() => chain),
    whereNull: jest.fn(() => chain),
    whereIn: jest.fn(() => chain),
    forUpdate: jest.fn(() => chain),
    first: jest.fn(async () => options.firstResult),
    orderBy: jest.fn(() => chain),
    update: jest.fn(options.update ?? (async () => 1)),
    insert: jest.fn(options.insert ?? (async () => 1)),
    then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) =>
      Promise.resolve(options.awaitedResult).then(resolve, reject),
  });
  return chain;
}

function requestRow(overrides: Record<string, unknown> = {}) {
  const currentProfile = {
    eligibleFactoryId: 7,
    factoryId: 'factory-001',
    factoryRegistrationNo: '3-106-33/50สบ',
    factoryName: 'บริษัท ทดสอบ จำกัด',
    factoryAddress: '99 หมู่ 1',
    updatedAt: '2026-09-04T00:00:00.000Z',
  };
  const proposedProfile = {
    ...currentProfile,
    factoryName: 'บริษัท ทดสอบ จำกัด (ใหม่)',
  };

  return {
    id: 11,
    request_no: 'PFE-20260904-ABC12345',
    eligible_factory_id: 7,
    factory_id: 'factory-001',
    factory_registration_no: '3-106-33/50สบ',
    factory_name: proposedProfile.factoryName,
    form_type: 'BASIC_INFO',
    status: POMS_FACTORY_EDIT_REQUEST_STATUS.PENDING_REVIEW,
    revision_no: 0,
    is_open: 1,
    current_factory_json: JSON.stringify(currentProfile),
    proposed_factory_json: JSON.stringify(proposedProfile),
    current_measurement_points_json: null,
    proposed_measurement_points_json: null,
    source_profile_updated_at: '2026-09-04T00:00:00.000Z',
    request_note: null,
    revision_reason: null,
    officer_note: null,
    submitted_by: 42,
    reviewed_by: null,
    submitted_at: '2026-09-04T00:00:00.000Z',
    reviewed_at: null,
    approved_at: null,
    created_by: 42,
    created_at: '2026-09-04T00:00:00.000Z',
    updated_at: '2026-09-04T00:00:00.000Z',
    ...overrides,
  };
}
