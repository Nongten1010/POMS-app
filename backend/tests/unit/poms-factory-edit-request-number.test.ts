import { afterAll, describe, expect, it, jest } from '@jest/globals';
import knex, { type Knex } from 'knex';
import { allocatePomsFactoryEditRequestNo } from '../../src/modules/poms-factories/poms-factory-edit-request-number';

const mssql = knex({ client: 'mssql' });
const date = new Date('2026-09-05T00:00:00.000Z');

afterAll(async () => {
  await mssql.destroy();
});

function transaction(lastSequence: number | string | null) {
  let query: Knex.QueryBuilder;
  const trx = Object.assign(
    jest.fn((table: Knex.Raw) => {
      query = mssql(table);
      jest.spyOn(query, 'first').mockResolvedValue({ last_sequence: lastSequence });
      return query;
    }),
    { raw: mssql.raw.bind(mssql) },
  );
  return {
    trx: trx as unknown as Knex.Transaction,
    sql: () => query.toSQL(),
  };
}

describe('POMS factory edit request numbers', () => {
  it.each([
    ['BASIC_INFO', 'base-00001/2569'],
    ['MEASUREMENT_POINTS', 'point-00001/2569'],
  ] as const)(
    'starts %s with its own prefix and five-digit sequence',
    async (formType, expected) => {
      const harness = transaction(null);
      await expect(allocatePomsFactoryEditRequestNo(harness.trx, formType, date)).resolves.toBe(
        expected,
      );
    },
  );

  it.each([
    [1, 'base-00002/2569'],
    ['42', 'base-00043/2569'],
    [99998, 'base-99999/2569'],
  ] as const)(
    'continues after maximum allocated sequence %s, including gaps',
    async (last, expected) => {
      const harness = transaction(last);
      await expect(allocatePomsFactoryEditRequestNo(harness.trx, 'BASIC_INFO', date)).resolves.toBe(
        expected,
      );
    },
  );

  it.each([
    ['BASIC_INFO', 'base', 6],
    ['MEASUREMENT_POINTS', 'point', 7],
  ] as const)(
    'locks the %s annual number range and retains cancelled/deleted numbers',
    async (formType, prefix, start) => {
      const harness = transaction(7);
      await allocatePomsFactoryEditRequestNo(harness.trx, formType, date);
      const compiled = harness.sql();
      expect(compiled.sql).toContain('from [poms_factory_edit_requests] WITH (UPDLOCK, HOLDLOCK)');
      expect(compiled.sql).toContain('MAX(TRY_CONVERT(INT, SUBSTRING([request_no], ?, 5)))');
      expect(compiled.sql).toContain('where [request_no] like ?');
      expect(compiled.bindings).toEqual([start, `${prefix}-[0-9][0-9][0-9][0-9][0-9]/2569`]);
      expect(compiled.sql).not.toMatch(/deleted_at|status|is_open|eligible_factory_id/);
    },
  );

  it.each([
    ['2026-12-31T16:59:59.999Z', '2569'],
    ['2026-12-31T17:00:00.000Z', '2570'],
  ])('uses the Bangkok calendar year at %s', async (timestamp, year) => {
    const harness = transaction(null);
    await expect(
      allocatePomsFactoryEditRequestNo(harness.trx, 'MEASUREMENT_POINTS', new Date(timestamp)),
    ).resolves.toBe(`point-00001/${year}`);
    expect(harness.sql().bindings).toContain(`point-[0-9][0-9][0-9][0-9][0-9]/${year}`);
  });

  it('rejects exhaustion instead of issuing six digits or reusing an existing number', async () => {
    const harness = transaction(99999);
    await expect(
      allocatePomsFactoryEditRequestNo(harness.trx, 'BASIC_INFO', date),
    ).rejects.toMatchObject({
      statusCode: 409,
      code: 'CONFLICT',
      message: 'POMS edit request sequence is exhausted for this form type and year',
    });
  });
});
