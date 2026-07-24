import { describe, expect, it, jest } from '@jest/globals';
import type { Knex } from 'knex';
import {
  buildBodCodNumberingFactoryQueryForTests,
  reserveBodCodDeviationReportNumberForTests,
  resolveBodCodCreateNumberingContext,
} from '../../src/modules/bod-cod-deviations/bod-cod-deviation-report-numbering.repository';

describe('BOD/COD deviation report numbering repository', () => {
  it('resolves the authoritative province and region with the existing factory access query', () => {
    const compiled = buildBodCodNumberingFactoryQueryForTests(
      { factoryId: 'FID-001', factoryRegistrationNo: 'REG-001' },
      { actorUserId: 42, scope: 'ALL' },
    ).toSQL();
    const sql = compiled.sql.toLowerCase();

    expect(sql).toContain('from [factories] as [f]');
    expect(sql).toContain('left join [provinces] as [p]');
    expect(sql).toContain('[f].[id] as [factory_internal_id]');
    expect(sql).toContain('[p].[name_th] as [province_name]');
    expect(sql).toContain('[p].[region] as [region_name]');
    expect(compiled.bindings).toEqual(expect.arrayContaining(['FID-001', 'REG-001']));
  });

  it('locks and increments a sequence scoped by region and report year', async () => {
    const harness = sequenceTransaction(4);

    const reserved = await reserveBodCodDeviationReportNumberForTests(harness.trx, '02', 2569);

    expect(reserved).toEqual({
      reportNo: 'Error-02-0005/2569',
      regionCode: '02',
      reportYear: 2569,
      sequence: 5,
    });
    expect(harness.raw).toHaveBeenCalledWith(expect.stringContaining('WITH (UPDLOCK, HOLDLOCK)'), [
      '02',
      2569,
      '02',
      2569,
    ]);
    expect(harness.selectWhere).toHaveBeenCalledWith({ region_code: '02', report_year: 2569 });
    expect(harness.forUpdate).toHaveBeenCalledTimes(1);
    expect(harness.update).toHaveBeenCalledWith({
      last_sequence: 5,
      updated_at: 'db-now',
    });
  });

  it('uses the matched factory province and region as the numbering authority', async () => {
    const context = await resolveBodCodCreateNumberingContext(
      {
        factoryId: 'FID-001',
        factoryRegistrationNo: 'REG-001',
        provinceName: 'ราชบุรี',
      },
      { actorUserId: 42, scope: 'ALL' },
      factoryTransaction({
        factory_internal_id: 9,
        province_name: 'ราชบุรี',
        region_name: 'ภาคตะวันตก',
      }),
    );

    expect(context).toEqual({
      factoryInternalId: 9,
      provinceName: 'ราชบุรี',
      regionCode: '02',
    });
  });

  it('rejects a payload province that differs from the matched factory province', async () => {
    await expect(
      resolveBodCodCreateNumberingContext(
        {
          factoryId: 'FID-001',
          factoryRegistrationNo: 'REG-001',
          provinceName: 'ชลบุรี',
        },
        { actorUserId: 42, scope: 'ALL' },
        factoryTransaction({
          factory_internal_id: 9,
          province_name: 'ราชบุรี',
          region_name: 'ภาคตะวันตก',
        }),
      ),
    ).rejects.toThrow('Factory province does not match BOD/COD report province');
  });

  it('rejects numbering when no authoritative factory is found', async () => {
    await expect(
      resolveBodCodCreateNumberingContext(
        {
          factoryId: 'UNKNOWN',
          factoryRegistrationNo: 'UNKNOWN',
          provinceName: 'ราชบุรี',
        },
        { actorUserId: 42, scope: 'ALL' },
        factoryTransaction(undefined),
      ),
    ).rejects.toThrow('Factory is unavailable for BOD/COD report numbering');
  });

  it('rejects sequence overflow without updating the sequence row', async () => {
    const harness = sequenceTransaction(9_999);

    await expect(
      reserveBodCodDeviationReportNumberForTests(harness.trx, '07', 2569),
    ).rejects.toThrow('BOD/COD deviation report sequence has reached 9999');

    expect(harness.update).not.toHaveBeenCalled();
  });
});

function factoryTransaction(value: unknown): Knex.Transaction {
  const chain: Record<string, unknown> = {};
  const returnChain = jest.fn((argument?: unknown) => {
    if (typeof argument === 'function') {
      const predicate: Record<string, unknown> = {};
      const returnPredicate = jest.fn(() => predicate);
      Object.assign(predicate, { orWhere: returnPredicate, where: returnPredicate });
      argument(predicate);
    }
    return chain;
  });
  Object.assign(chain, {
    leftJoin: returnChain,
    select: returnChain,
    first: returnChain,
    where: returnChain,
    then: (resolve: (resolved: unknown) => unknown, reject: (reason: unknown) => unknown) =>
      Promise.resolve(value).then(resolve, reject),
  });
  return jest.fn(() => chain) as unknown as Knex.Transaction;
}

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

  const queue = [selectBuilder, updateBuilder];
  const trx = Object.assign(
    jest.fn((_tableName: string) => {
      const builder = queue.shift();
      if (!builder) throw new Error('Unexpected sequence query');
      return builder;
    }),
    {
      raw,
      fn: { now: jest.fn(() => 'db-now') },
    },
  ) as unknown as Knex.Transaction;

  return { trx, raw, selectWhere, forUpdate, update };
}
