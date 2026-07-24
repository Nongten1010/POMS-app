import { describe, expect, it, jest } from '@jest/globals';
import type { Knex } from 'knex';
import {
  buildKwpSubmissionRegionQueryForTests,
  reserveKwpSubmissionNumberForTests,
} from '../../src/modules/kwp-form-submissions/kwp-form-submissions.repository';

describe('KWP form submission sequence repository', () => {
  it('resolves the region from server-owned factory and province data', () => {
    const compiled = buildKwpSubmissionRegionQueryForTests('FID-001').toSQL();
    const sql = compiled.sql.toLowerCase();

    expect(sql).toContain('from [factories] as [f]');
    expect(sql).toContain('inner join [provinces] as [p]');
    expect(sql).toContain('[f].[fid] = ?');
    expect(sql).toContain('[f].[code] = ?');
    expect(sql).toContain('[f].[deleted_at] is null');
    expect(sql).toContain('[p].[region] as [region_name]');
    expect(compiled.bindings).toEqual(expect.arrayContaining(['FID-001']));
  });

  it('locks and increments a sequence scoped by form, region, and Buddhist year', async () => {
    const harness = sequenceTransaction(4);

    const reserved = await reserveKwpSubmissionNumberForTests(
      harness.trx,
      'KWP02',
      '05',
      'ภาคใต้',
      new Date('2027-01-01T00:00:00.000Z'),
    );

    expect(reserved).toEqual({
      submissionNo: 'F02-05-0005/2570',
      regionCode: '05',
      regionName: 'ภาคใต้',
      buddhistYear: '2570',
      sequence: 5,
    });
    expect(harness.raw).toHaveBeenCalledWith(expect.stringContaining('WITH (UPDLOCK, HOLDLOCK)'), [
      'KWP02',
      '05',
      '2570',
      'KWP02',
      '05',
      '2570',
    ]);
    expect(harness.selectWhere).toHaveBeenCalledWith({
      form_type: 'KWP02',
      region_code: '05',
      buddhist_year: '2570',
    });
    expect(harness.forUpdate).toHaveBeenCalledTimes(1);
    expect(harness.update).toHaveBeenCalledWith({
      last_sequence: 5,
      updated_at: 'db-now',
    });
  });

  it('rejects sequence overflow without updating the sequence row', async () => {
    const harness = sequenceTransaction(9_999);

    await expect(
      reserveKwpSubmissionNumberForTests(
        harness.trx,
        'KWP01',
        '04',
        'ภาคเหนือ',
        new Date('2026-07-24T00:00:00.000Z'),
      ),
    ).rejects.toThrow('KWP submission sequence has reached 9999');

    expect(harness.update).not.toHaveBeenCalled();
  });
});

function sequenceTransaction(initialSequence: number) {
  const raw = jest.fn<(statement: string, bindings: unknown[]) => Promise<void>>(
    async () => undefined,
  );
  const selectWhere = jest.fn<(criteria: Record<string, unknown>) => unknown>();
  const forUpdate = jest.fn<() => unknown>();
  const update = jest.fn<(values: Record<string, unknown>) => Promise<number>>(async () => 1);
  const updateWhere = jest.fn<(criteria: Record<string, unknown>) => unknown>();

  const selectBuilder: Record<string, jest.Mock> = {};
  selectWhere.mockImplementation(() => selectBuilder);
  forUpdate.mockImplementation(() => selectBuilder);
  Object.assign(selectBuilder, {
    where: selectWhere,
    forUpdate,
    first: jest.fn(async () => ({ last_sequence: initialSequence })),
  });

  const updateBuilder: Record<string, jest.Mock> = {};
  updateWhere.mockImplementation(() => updateBuilder);
  Object.assign(updateBuilder, {
    where: updateWhere,
    update,
  });

  let sequenceCalls = 0;
  const trx = Object.assign(
    jest.fn((tableName: string) => {
      if (tableName !== 'kwp_form_submission_sequences') {
        throw new Error(`Unexpected table: ${tableName}`);
      }
      sequenceCalls += 1;
      return sequenceCalls === 1 ? selectBuilder : updateBuilder;
    }),
    {
      raw,
      fn: { now: jest.fn(() => 'db-now') },
    },
  ) as unknown as Knex.Transaction;

  return { trx, raw, selectWhere, forUpdate, update };
}
