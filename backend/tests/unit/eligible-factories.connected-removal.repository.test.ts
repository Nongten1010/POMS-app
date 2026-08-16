import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import knex from 'knex';

jest.mock('../../src/config/database', () => ({
  db: Object.assign(jest.fn(), { transaction: jest.fn() }),
}));

import { db } from '../../src/config/database';
import {
  buildConnectedPointLookupQueryForTests,
  eligibleFactoriesRepository,
} from '../../src/modules/eligible-factories/eligible-factories.repository';

const mockedDb = db as unknown as {
  transaction: jest.Mock<(...args: unknown[]) => Promise<unknown>>;
};

describe('eligibleFactoriesRepository connected-point query', () => {
  it('keeps the MSSQL update lock on the connected-point table for form-linked lookups', () => {
    const mssql = knex({ client: 'mssql' });
    const sql = buildConnectedPointLookupQueryForTests(mssql, 17, 278).toSQL().sql.toLowerCase();

    expect(sql).toContain('from [cems_wpms_connected_measurement_points] with (updlock)');
    expect(sql).toContain(
      '[cems_wpms_connected_measurement_points].[eligible_factory_id] in (select [id] from [eligible_factories] where [monitoring_point_form_id] = ?)',
    );
    expect(sql).not.toContain('inner join');
  });
});

describe('eligibleFactoriesRepository.softDelete', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 409 and keeps eligibility active while the factory has active POMS rows', async () => {
    const eligibleLookup = makeChain(async () => ({ id: 17, monitoring_point_form_id: 278 }));
    const linkedEligibleIds = makeChain(async () => undefined);
    const connectedLookup = makeChain(async () => ({ id: 55 }));
    const queues = new Map<string, unknown[]>([
      ['eligible_factories', [eligibleLookup, linkedEligibleIds]],
      ['cems_wpms_connected_measurement_points', [connectedLookup]],
    ]);
    const trx = Object.assign(
      jest.fn((tableName: string) => {
        const builder = queues.get(tableName)?.shift();
        if (!builder) throw new Error(`Unexpected mutation or query for ${tableName}`);
        return builder;
      }),
      { fn: { now: jest.fn(() => 'db-now') } },
    );
    mockedDb.transaction.mockImplementationOnce(async (...args: unknown[]) => {
      const callback = args[0] as (transaction: typeof trx) => Promise<unknown>;
      return callback(trx);
    });

    await expect(eligibleFactoriesRepository.softDelete(17, 42)).rejects.toMatchObject({
      statusCode: 409,
      details: { eligibleFactoryId: 17 },
    });
    expect(trx).toHaveBeenCalledTimes(3);
  });

  it('returns 409 when a historical eligible row sharing the form has an active POMS row', async () => {
    const eligibleLookup = makeChain(async () => ({ id: 17, monitoring_point_form_id: 278 }));
    const linkedEligibleIds = makeChain(async () => undefined);
    const connectedLookup = makeChain(async () => ({ id: 55 }));
    const queues = new Map<string, unknown[]>([
      ['eligible_factories', [eligibleLookup, linkedEligibleIds]],
      ['cems_wpms_connected_measurement_points', [connectedLookup]],
    ]);
    const trx = Object.assign(
      jest.fn((tableName: string) => {
        const builder = queues.get(tableName)?.shift();
        if (!builder) throw new Error(`Unexpected mutation or query for ${tableName}`);
        return builder;
      }),
      { fn: { now: jest.fn(() => 'db-now') } },
    );
    mockedDb.transaction.mockImplementationOnce(async (...args: unknown[]) => {
      const callback = args[0] as (transaction: typeof trx) => Promise<unknown>;
      return callback(trx);
    });

    await expect(eligibleFactoriesRepository.softDelete(17, 42)).rejects.toMatchObject({
      statusCode: 409,
      details: { eligibleFactoryId: 17 },
    });
    expect(linkedEligibleIds.select).toHaveBeenCalledWith('id');
    expect(linkedEligibleIds.where).toHaveBeenCalledWith('monitoring_point_form_id', 278);
    expect(connectedLookup.whereIn).toHaveBeenCalledWith(
      'cems_wpms_connected_measurement_points.eligible_factory_id',
      linkedEligibleIds,
    );
    expect(trx).toHaveBeenCalledTimes(3);
  });

  it('soft-deletes the linked monitoring form and its points with the eligible factory', async () => {
    const eligibleLookup = makeChain(async () => ({ id: 17, monitoring_point_form_id: 278 }));
    const linkedEligibleIds = makeChain(async () => undefined);
    const connectedLookup = makeChain(async () => undefined);
    const eligibleUpdate = makeUpdateChain(1);
    const formUpdate = makeUpdateChain(1);
    const pointsUpdate = makeUpdateChain(2);
    const queues = new Map<string, unknown[]>([
      ['eligible_factories', [eligibleLookup, linkedEligibleIds, eligibleUpdate.chain]],
      ['cems_wpms_connected_measurement_points', [connectedLookup]],
      ['factory_monitoring_points', [pointsUpdate.chain]],
      ['factory_monitoring_point_forms', [formUpdate.chain]],
    ]);
    const trx = Object.assign(
      jest.fn((tableName: string) => {
        const builder = queues.get(tableName)?.shift();
        if (!builder) throw new Error(`Unexpected mutation or query for ${tableName}`);
        return builder;
      }),
      { fn: { now: jest.fn(() => 'db-now') } },
    );
    mockedDb.transaction.mockImplementationOnce(async (...args: unknown[]) => {
      const callback = args[0] as (transaction: typeof trx) => Promise<unknown>;
      return callback(trx);
    });

    await expect(eligibleFactoriesRepository.softDelete(17, 42)).resolves.toBe(true);

    expect(pointsUpdate.where).toHaveBeenCalledWith('form_id', 278);
    expect(pointsUpdate.whereNull).toHaveBeenCalledWith('deleted_at');
    expect(pointsUpdate.update).toHaveBeenCalledWith({
      deleted_at: 'db-now',
      updated_at: 'db-now',
      updated_by: 42,
    });
    expect(formUpdate.where).toHaveBeenCalledWith('id', 278);
    expect(formUpdate.whereNull).toHaveBeenCalledWith('deleted_at');
    expect(formUpdate.update).toHaveBeenCalledWith({
      deleted_at: 'db-now',
      updated_at: 'db-now',
      updated_by: 42,
    });
    expect(eligibleUpdate.where).toHaveBeenCalledWith('id', 17);
    expect(eligibleUpdate.whereNull).toHaveBeenCalledWith('deleted_at');
    expect(eligibleUpdate.update).toHaveBeenCalledWith({
      deleted_at: 'db-now',
      updated_at: 'db-now',
      updated_by: 42,
    });
  });

  it('soft-deletes only the eligible factory when no monitoring form is linked', async () => {
    const eligibleLookup = makeChain(async () => ({ id: 17, monitoring_point_form_id: null }));
    const connectedLookup = makeChain(async () => undefined);
    const eligibleUpdate = makeUpdateChain(1);
    const queues = new Map<string, unknown[]>([
      ['eligible_factories', [eligibleLookup, eligibleUpdate.chain]],
      ['cems_wpms_connected_measurement_points', [connectedLookup]],
    ]);
    const trx = Object.assign(
      jest.fn((tableName: string) => {
        const builder = queues.get(tableName)?.shift();
        if (!builder) throw new Error(`Unexpected mutation or query for ${tableName}`);
        return builder;
      }),
      { fn: { now: jest.fn(() => 'db-now') } },
    );
    mockedDb.transaction.mockImplementationOnce(async (...args: unknown[]) => {
      const callback = args[0] as (transaction: typeof trx) => Promise<unknown>;
      return callback(trx);
    });

    await expect(eligibleFactoriesRepository.softDelete(17, 42)).resolves.toBe(true);

    expect(trx).toHaveBeenCalledTimes(3);
    expect(eligibleUpdate.update).toHaveBeenCalledWith({
      deleted_at: 'db-now',
      updated_at: 'db-now',
      updated_by: 42,
    });
  });
});

function makeChain(first: () => Promise<unknown>) {
  const chain: Record<string, unknown> = {};
  const returnChain = jest.fn(() => chain);
  Object.assign(chain, {
    innerJoin: returnChain,
    select: returnChain,
    where: returnChain,
    whereIn: returnChain,
    whereNull: returnChain,
    forUpdate: returnChain,
    first: jest.fn(first),
  });
  return chain;
}

function makeUpdateChain(result: number) {
  const chain: Record<string, unknown> = {};
  const where = jest.fn((..._args: unknown[]) => chain);
  const whereNull = jest.fn((..._args: unknown[]) => chain);
  const update = jest.fn(async (..._args: unknown[]) => result);
  Object.assign(chain, { where, whereNull, update });
  return { chain, where, whereNull, update };
}
