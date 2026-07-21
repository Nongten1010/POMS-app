import { beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('../../src/config/database', () => ({
  db: Object.assign(jest.fn(), {
    transaction: jest.fn(),
  }),
}));

import { db } from '../../src/config/database';
import { connectionRequestsRepository } from '../../src/modules/connection-requests/connection-requests.repository';
import {
  CONNECTION_REQUEST_STATUS,
  CONNECTION_REQUEST_SUBMISSION_SOURCE,
  type ConnectionRequestDTO,
} from '../../src/modules/connection-requests/connection-requests.types';

const mockedDb = db as unknown as jest.Mock<(...args: unknown[]) => unknown> & {
  transaction: jest.Mock<(...args: unknown[]) => Promise<unknown>>;
};

describe('connectionRequestsRepository.cancelOperatorRequest', () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  it('locks the request and writes status plus history in one transaction', async () => {
    const harness = cancellationHarness(CONNECTION_REQUEST_STATUS.WAITING_CONNECTION);
    const canceled = requestDto();
    mockedDb.transaction.mockImplementationOnce(harness.runTransaction);
    jest.spyOn(connectionRequestsRepository, 'findById').mockResolvedValue(canceled);

    await expect(
      connectionRequestsRepository.cancelOperatorRequest(1, 42, 'ยุติโครงการ'),
    ).resolves.toBe(canceled);

    expect(harness.selectBuilder.forUpdate).toHaveBeenCalledTimes(1);
    expect(harness.requestUpdate).toHaveBeenCalledWith({
      status: CONNECTION_REQUEST_STATUS.CANCELED,
      revision_reason: 'ยุติโครงการ',
      officer_note: null,
      updated_by: 42,
      updated_at: 'db-now',
    });
    expect(harness.historyInsert).toHaveBeenCalledWith({
      request_id: 1,
      status: CONNECTION_REQUEST_STATUS.CANCELED,
      note: 'ยุติโครงการ',
      changed_by: 42,
    });
  });

  it('does not write status or history when a locked request is already canceled', async () => {
    const harness = cancellationHarness(CONNECTION_REQUEST_STATUS.CANCELED);
    const canceled = requestDto();
    mockedDb.transaction.mockImplementationOnce(harness.runTransaction);
    jest.spyOn(connectionRequestsRepository, 'findById').mockResolvedValue(canceled);

    await expect(
      connectionRequestsRepository.cancelOperatorRequest(1, 42, 'เหตุผลใหม่'),
    ).resolves.toBe(canceled);

    expect(harness.selectBuilder.forUpdate).toHaveBeenCalledTimes(1);
    expect(harness.requestUpdate).not.toHaveBeenCalled();
    expect(harness.historyInsert).not.toHaveBeenCalled();
  });

  it('rejects when a concurrent action has already connected the request', async () => {
    const harness = cancellationHarness(CONNECTION_REQUEST_STATUS.CONNECTED);
    mockedDb.transaction.mockImplementationOnce(harness.runTransaction);

    await expect(
      connectionRequestsRepository.cancelOperatorRequest(1, 42, null),
    ).rejects.toMatchObject({
      code: 'CONFLICT',
      details: { currentStatus: CONNECTION_REQUEST_STATUS.CONNECTED },
    });

    expect(harness.requestUpdate).not.toHaveBeenCalled();
    expect(harness.historyInsert).not.toHaveBeenCalled();
  });
});

function cancellationHarness(status: string) {
  const selectBuilder = makeChain({
    first: async () => ({
      id: 1,
      status,
      submission_source: CONNECTION_REQUEST_SUBMISSION_SOURCE.OPERATOR_FORM,
      created_by: 42,
    }),
  });
  const requestUpdate = jest.fn(async (_values: Record<string, unknown>) => 1);
  const historyInsert = jest.fn(async (_values: Record<string, unknown>) => 1);
  const queues = new Map<string, unknown[]>([
    ['cems_wpms_connection_requests', [selectBuilder, makeChain({ update: requestUpdate })]],
    ['cems_wpms_request_status_history', [makeChain({ insert: historyInsert })]],
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
    selectBuilder,
    requestUpdate,
    historyInsert,
    runTransaction: async (...args: unknown[]) => {
      const callback = args[0] as (transaction: typeof trx) => Promise<unknown>;
      return callback(trx);
    },
  };
}

function makeChain(options: {
  first?: () => Promise<unknown>;
  update?: (values: Record<string, unknown>) => Promise<unknown>;
  insert?: (values: Record<string, unknown>) => Promise<unknown>;
}) {
  const chain: Record<string, unknown> = {};
  Object.assign(chain, {
    where: jest.fn(() => chain),
    whereNull: jest.fn(() => chain),
    forUpdate: jest.fn(() => chain),
    first: jest.fn(options.first ?? (async () => undefined)),
    update: jest.fn(options.update ?? (async () => 1)),
    insert: jest.fn(options.insert ?? (async () => 1)),
  });
  return chain;
}

function requestDto(): ConnectionRequestDTO {
  return {
    id: 1,
    status: CONNECTION_REQUEST_STATUS.CANCELED,
  } as ConnectionRequestDTO;
}
