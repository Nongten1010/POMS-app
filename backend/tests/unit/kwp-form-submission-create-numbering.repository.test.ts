import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('../../src/config/database', () => ({
  db: Object.assign(jest.fn(), {
    transaction: jest.fn(),
  }),
}));

import { db } from '../../src/config/database';
import { kwpFormSubmissionsRepository } from '../../src/modules/kwp-form-submissions/kwp-form-submissions.repository';

const mockedDb = db as unknown as {
  transaction: jest.Mock<(callback: (trx: unknown) => Promise<unknown>) => Promise<unknown>>;
};

describe('KWP form create numbering', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-07-24T00:00:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('creates KWP01 with a server-derived region and scoped annual sequence', async () => {
    const harness = createKwp01Harness();
    mockedDb.transaction.mockImplementationOnce(harness.runTransaction);

    const result = await kwpFormSubmissionsRepository.createKwp01(
      {
        factoryId: 'FID-001',
        factoryName: 'บริษัท ทดสอบ จำกัด',
        issueReason: 'เครื่องมือหรือเครื่องอุปกรณ์พิเศษขัดข้อง',
        unreportedParameters: [],
      },
      {
        actorUserId: 42,
        scope: 'ALL',
      },
    );

    expect(result).toMatchObject({
      id: 101,
      requestNo: 'F01-04-0001/2569',
      form: 'กวภ.01',
      formType: 'KWP01',
      status: 'SUBMITTED',
    });
    expect(harness.submissionInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        submission_no: 'F01-04-0001/2569',
        submission_region_code: '04',
        submission_region_name: 'ภาคเหนือ',
        submission_buddhist_year: '2569',
        submission_sequence: 1,
        form_type: 'KWP01',
      }),
    );
  });
});

function createKwp01Harness() {
  const raw = jest.fn(async () => undefined);
  const submissionInsert = jest.fn();
  const issueReportInsert = jest.fn(async () => 1);
  const historyInsert = jest.fn(async () => 1);
  const sequenceUpdate = jest.fn(async () => 1);

  const regionBuilder = regionFirstBuilder({ region_name: 'ภาคเหนือ' });
  const sequenceSelectBuilder = firstBuilder({ last_sequence: 0 });
  const sequenceUpdateBuilder = whereUpdateBuilder(sequenceUpdate);
  const submissionBuilder = {
    insert: jest.fn((values: Record<string, unknown>) => {
      submissionInsert(values);
      return {
        returning: jest.fn(async () => [{ id: 101 }]),
      };
    }),
  };

  const queues = new Map<string, unknown[]>([
    ['factories as f', [regionBuilder]],
    ['kwp_form_submission_sequences', [sequenceSelectBuilder, sequenceUpdateBuilder]],
    ['kwp_form_submissions', [submissionBuilder]],
    ['kwp01_issue_reports', [{ insert: issueReportInsert }]],
    ['kwp_form_status_history', [{ insert: historyInsert }]],
  ]);

  const trx = Object.assign(
    jest.fn((tableName: string) => {
      const builder = queues.get(tableName)?.shift();
      if (!builder) throw new Error(`Unexpected query for ${tableName}`);
      return builder;
    }),
    {
      raw,
      fn: { now: jest.fn(() => 'db-now') },
    },
  );

  return {
    submissionInsert,
    runTransaction: async (callback: (transaction: typeof trx) => Promise<unknown>) => {
      const result = await callback(trx);
      expect([...queues.values()].every((queue) => queue.length === 0)).toBe(true);
      return result;
    },
  };
}

function regionFirstBuilder(value: unknown) {
  const chain: Record<string, unknown> = {};
  const returnChain = jest.fn((argument?: unknown) => {
    if (typeof argument === 'function') {
      const predicate: Record<string, unknown> = {};
      const returnPredicate = jest.fn(() => predicate);
      Object.assign(predicate, { where: returnPredicate, orWhere: returnPredicate });
      argument(predicate);
    }
    return chain;
  });
  Object.assign(chain, {
    join: returnChain,
    whereNull: returnChain,
    where: returnChain,
    select: returnChain,
    first: jest.fn(async () => value),
  });
  return chain;
}

function firstBuilder(value: unknown) {
  const chain: Record<string, unknown> = {};
  const returnChain = jest.fn(() => chain);
  Object.assign(chain, {
    where: returnChain,
    forUpdate: returnChain,
    first: jest.fn(async () => value),
  });
  return chain;
}

function whereUpdateBuilder(
  update: jest.Mock<(values: Record<string, unknown>) => Promise<number>>,
) {
  const chain: Record<string, unknown> = {};
  Object.assign(chain, {
    where: jest.fn(() => chain),
    update,
  });
  return chain;
}
