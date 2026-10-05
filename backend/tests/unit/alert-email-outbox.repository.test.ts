import { afterAll, describe, expect, it, jest } from '@jest/globals';
import knex, { type Knex } from 'knex';
import { createHash } from 'node:crypto';
import type { AlertEmailBatchInput } from '../../src/modules/alert-emails/alert-email-outbox.repository';

jest.mock('../../src/config/database', () => ({ db: {} }));

const connection = knex({ client: 'mssql' });
afterAll(async () => connection.destroy());

const batch: AlertEmailBatchInput = {
  deduplicationKey: 'daily:2026-10-04:officer:3',
  cadence: 'DAILY',
  alertType: 'LOW_COMPLETENESS',
  systemType: 'CEMS',
  scheduledAt: '2026-10-05T09:00:00+07:00',
  periodStart: '2026-10-04T00:00:00+07:00',
  periodEnd: '2026-10-05T00:00:00+07:00',
  recipient: 'officer@example.com',
  cc: ['diw.iemc@gmail.com'],
  subject: 'รายงานไม่ครบ',
  text: 'โรงงานตัวอย่าง',
  html: '<p>โรงงานตัวอย่าง</p>',
  eventIds: [1, 2, 2],
};

type Query = { sql: string; bindings: readonly unknown[] };
function executor(responses: unknown[]) {
  const { createAlertEmailOutboxRepository } = jest.requireActual<
    typeof import('../../src/modules/alert-emails/alert-email-outbox.repository')
  >('../../src/modules/alert-emails/alert-email-outbox.repository');
  const queries: Query[] = [];
  const runner = jest.spyOn(connection.client, 'runner').mockImplementation(
    (builder: unknown) =>
      ({
        run: async () => {
          const query = (builder as Knex.QueryBuilder).toSQL();
          queries.push({ sql: query.sql, bindings: query.bindings });
          const response = responses.shift();
          if (response instanceof Error) throw response;
          if (typeof response === 'function') return response(queries);
          return response;
        },
      }) as never,
  );
  const database = Object.assign((table: string) => connection(table), {
    raw: connection.raw.bind(connection),
    transaction: jest.fn(async (callback: (trx: Knex) => unknown) =>
      callback(database as unknown as Knex),
    ),
  }) as unknown as Knex;
  const repository = createAlertEmailOutboxRepository(database);
  return {
    repository,
    queries,
    restore: () => {
      runner.mockRestore();
    },
  };
}

describe('alert email outbox', () => {
  it('inserts a frozen batch, unique event map and one delivery in a single transaction', async () => {
    const test = executor([[{ id: 7 }], [1, 2], [{ id: 11 }]]);
    try {
      expect(await test.repository.enqueue(batch)).toEqual({
        batchId: 7,
        deliveryId: 11,
        created: true,
      });
      expect(test.queries).toHaveLength(3);
      expect(test.queries[0].sql).toContain('insert into [alert_email_batches]');
      expect(test.queries[0].bindings).toContain(batch.html);
      expect(test.queries[0].bindings).toContain('["diw.iemc@gmail.com"]');
      const recipientKey = createHash('sha256').update('DAILY:officer@example.com').digest('hex');
      expect(test.queries[1].bindings).toEqual([1, 7, recipientKey, 2, 7, recipientKey]);
      expect(test.queries[2].bindings).toContain('QUEUED');
      expect(test.queries[2].bindings).toContainEqual(new Date('2026-10-05T02:00:00.000Z'));
    } finally {
      test.restore();
    }
  });

  it('returns the existing delivery after a concurrent unique-key violation', async () => {
    const duplicate = Object.assign(new Error('duplicate'), { number: 2601 });
    const test = executor([duplicate, { batch_id: 7, id: 11 }]);
    try {
      expect(await test.repository.enqueue(batch)).toEqual({
        batchId: 7,
        deliveryId: 11,
        created: false,
      });
      expect(test.queries[1].bindings).toContain(batch.deduplicationKey);
    } finally {
      test.restore();
    }
  });

  it('does not swallow a transaction error unrelated to duplicate keys', async () => {
    const test = executor([new Error('permission denied')]);
    try {
      await expect(test.repository.enqueue(batch)).rejects.toThrow('permission denied');
    } finally {
      test.restore();
    }
  });

  it('detects previously queued events for the normalized recipient and cadence so late events form a new batch', async () => {
    const test = executor([[{ alert_event_id: 1 }]]);
    try {
      expect(
        await test.repository.listBatchedEventIds(' Officer@Example.com ', 'DAILY', [1, 2]),
      ).toEqual([1]);
      expect(test.queries[0].bindings).toContain(
        createHash('sha256').update('DAILY:officer@example.com').digest('hex'),
      );
      expect(test.queries[0].sql).toContain('[alert_event_id] in (?, ?)');
    } finally {
      test.restore();
    }
  });

  it('raises a controlled overlap conflict when another batch already claimed one of the same recipient events', async () => {
    const duplicate = Object.assign(new Error('duplicate'), { number: 2627 });
    const test = executor([[{ id: 7 }], duplicate, undefined]);
    try {
      await expect(test.repository.enqueue(batch)).rejects.toMatchObject({
        statusCode: 409,
        code: 'ALERT_EMAIL_EVENT_ALREADY_BATCHED',
      });
      expect(test.queries).toHaveLength(3);
    } finally {
      test.restore();
    }
  });

  it('chunks a large event mapping inside one transaction to stay below the SQL Server parameter limit', async () => {
    const test = executor([
      [{ id: 7 }],
      [],
      (queries: Query[]) =>
        queries.at(-1)?.sql.includes('insert into [alert_email_deliveries]') ? [{ id: 11 }] : [],
      [{ id: 11 }],
    ]);
    try {
      await test.repository.enqueue({
        ...batch,
        eventIds: Array.from({ length: 701 }, (_, index) => index + 1),
      });
      const mappings = test.queries.filter((query) =>
        query.sql.includes('insert into [alert_email_batch_events]'),
      );
      expect(mappings).toHaveLength(2);
      expect(mappings.every((query) => query.bindings.length <= 2100)).toBe(true);
    } finally {
      test.restore();
    }
  });

  it.each([
    { ...batch, recipient: 'attacker@example.com\r\nBcc:victim@example.com' },
    { ...batch, subject: 'injected\r\nheader' },
    { ...batch, periodStart: '2026-10-04 00:00:00' },
    { ...batch, periodStart: batch.periodEnd },
    { ...batch, eventIds: [] },
  ])('rejects an invalid email envelope or ambiguous time before querying', async (invalid) => {
    const test = executor([]);
    try {
      await expect(test.repository.enqueue(invalid)).rejects.toThrow();
      expect(test.queries).toHaveLength(0);
    } finally {
      test.restore();
    }
  });

  it('marks expired PROCESSING leases UNKNOWN without making them claimable again', async () => {
    const test = executor([2]);
    try {
      expect(await test.repository.expireLeases(new Date('2026-10-05T02:00:00Z'))).toBe(2);
      expect(test.queries[0].sql).toContain('[leased_until] <= ?');
      expect(test.queries[0].bindings).toContain('UNKNOWN');
      expect(test.queries[0].bindings).toContain('PROCESSING');
      expect(test.queries[0].bindings).not.toContain('QUEUED');
    } finally {
      test.restore();
    }
  });

  it('claims with an atomic state and due-time comparison so competing workers cannot both own the item', async () => {
    const now = new Date('2026-10-05T02:00:00Z');
    const jobRow = {
      id: 11,
      batch_id: 7,
      attempts: 1,
      lease_token: 'claim-token',
      status: 'PROCESSING',
      deduplication_key: batch.deduplicationKey,
      cadence: batch.cadence,
      alert_type: batch.alertType,
      system_type: batch.systemType,
      scheduled_at: now,
      period_start: new Date(batch.periodStart),
      period_end: new Date(batch.periodEnd),
      recipient: batch.recipient,
      cc_json: JSON.stringify(batch.cc),
      subject: batch.subject,
      text_body: batch.text,
      html_body: batch.html,
    };
    const test = executor([
      0,
      { id: 11, status: 'QUEUED' },
      1,
      (queries: Query[]) => ({
        ...jobRow,
        lease_token: queries[2].bindings.find(
          (value) => typeof value === 'string' && /^[0-9a-f-]{36}$/.test(value),
        ),
      }),
      [{ alert_event_id: 1 }, { alert_event_id: 2 }],
    ]);
    try {
      const job = await test.repository.claim(now);
      expect(job).toEqual(
        expect.objectContaining({ id: 11, batchId: 7, eventIds: [1, 2], attempts: 1 }),
      );
      expect(test.queries[2].sql).toContain('[status] = ?');
      expect(test.queries[2].sql).toContain('[next_attempt_at] <= ?');
      expect(test.queries[2].sql).toContain('[attempts] + 1');
      expect(test.queries[2].bindings).toContain('QUEUED');
      expect(test.queries[2].bindings).toContain('PROCESSING');
    } finally {
      test.restore();
    }
  });

  it('returns no job after losing the compare-and-update race', async () => {
    const test = executor([0, { id: 11, status: 'QUEUED' }, 0]);
    try {
      expect(await test.repository.claim(new Date('2026-10-05T02:00:00Z'))).toBeNull();
      expect(test.queries).toHaveLength(3);
    } finally {
      test.restore();
    }
  });

  it('returns no job when the queue has no due item', async () => {
    const test = executor([0, undefined]);
    try {
      expect(await test.repository.claim(new Date('2026-10-05T02:00:00Z'))).toBeNull();
      expect(test.queries).toHaveLength(2);
    } finally {
      test.restore();
    }
  });

  it('denies all history rows for an explicitly empty access scope', async () => {
    const test = executor([[]]);
    try {
      expect(
        await test.repository.listDeliveries({ page: 1, pageSize: 20 }, { allowedEventIds: [] }),
      ).toEqual([]);
      expect(test.queries[0].sql).toContain('1 = 0');
    } finally {
      test.restore();
    }
  });

  it('keeps all delivery filters parameterized including email text that resembles SQL', async () => {
    const test = executor([[]]);
    try {
      await test.repository.listDeliveries({
        page: 2,
        pageSize: 10,
        cadence: 'DAILY',
        alertType: 'LOW_COMPLETENESS',
        status: 'FAILED',
        recipient: "x' or 1=1 --",
      });
      expect(test.queries[0].sql).not.toContain("x' or 1=1");
      expect(test.queries[0].bindings).toContain("x' or 1=1 --");
      expect(test.queries[0].bindings).toContain('LOW_COMPLETENESS');
      expect(test.queries[0].bindings).toContain('FAILED');
    } finally {
      test.restore();
    }
  });

  it.each([
    { page: 0, pageSize: 20 },
    { page: 1, pageSize: 101 },
  ])('rejects invalid pagination before querying', async (query) => {
    const test = executor([]);
    try {
      await expect(test.repository.listDeliveries(query)).rejects.toThrow(
        'Invalid delivery pagination',
      );
      expect(test.queries).toHaveLength(0);
    } finally {
      test.restore();
    }
  });

  it('does not renew a lease that has expired or has changed owner', async () => {
    const test = executor([0]);
    try {
      expect(await test.repository.renewLease(11, 'stale', new Date('2026-10-05T02:00:00Z'))).toBe(
        false,
      );
      expect(test.queries[0].sql).toContain('[leased_until] > ?');
      expect(test.queries[0].bindings).toContain('stale');
    } finally {
      test.restore();
    }
  });

  it('rejects an unbounded claim lease before any query', async () => {
    const test = executor([]);
    try {
      await expect(test.repository.claim(new Date(), 99999)).rejects.toThrow(
        'Invalid lease duration',
      );
      expect(test.queries).toHaveLength(0);
    } finally {
      test.restore();
    }
  });

  it('returns no mapping and no query for an empty candidate event set', async () => {
    const test = executor([]);
    try {
      expect(await test.repository.listBatchedEventIds(batch.recipient, 'DAILY', [])).toEqual([]);
      expect(test.queries).toHaveLength(0);
    } finally {
      test.restore();
    }
  });

  it('returns no delivery for a missing or out-of-scope ID', async () => {
    const test = executor([undefined]);
    try {
      expect(await test.repository.findDelivery(999, { allowedEventIds: [1] })).toBeNull();
    } finally {
      test.restore();
    }
  });

  it('only completes a PROCESSING delivery with the current lease token and clears that lease', async () => {
    const test = executor([1]);
    try {
      expect(
        await test.repository.complete(11, 'token', {
          status: 'SMTP_ACCEPTED',
          completedAt: '2026-10-05T02:00:01.000Z',
          messageId: 'message-id',
          acceptedRecipients: [batch.recipient],
          rejectedRecipients: [],
          nextAttemptAt: null,
          errorCode: null,
        }),
      ).toBe(true);
      expect(test.queries[0].bindings).toContain('PROCESSING');
      expect(test.queries[0].bindings).toContain('token');
      expect(test.queries[0].sql).toContain('[lease_token] = ?');
    } finally {
      test.restore();
    }
  });

  it('limits scoped reads to batches whose every event is inside the allowed event set', async () => {
    const test = executor([[]]);
    try {
      await test.repository.listDeliveries({ page: 1, pageSize: 20 }, { allowedEventIds: [1, 2] });
      const sql = test.queries[0].sql.toLowerCase();
      expect(sql).toContain('where exists');
      expect(sql).toContain('not exists');
      expect(sql).toContain('not in');
      expect(test.queries[0].bindings).toContain(1);
    } finally {
      test.restore();
    }
  });
});
