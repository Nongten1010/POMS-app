import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { Knex } from 'knex';
import type { ConnectionRequestDTO } from '../../src/modules/connection-requests/connection-requests.types';

jest.mock('../../src/config/database', () => ({
  db: Object.assign(jest.fn(), { transaction: jest.fn() }),
}));
jest.mock('../../src/modules/factory-profiles/factory-profiles.repository', () => ({
  lockFactoryProfileInTransaction: jest.fn(async () => null),
  updateFactoryProfileInTransaction: jest.fn(async () => undefined),
}));
jest.mock('../../src/modules/alert-emails/alert-parameter-activations.repository', () => ({
  lockAlertActivationPoints: jest.fn(async () => []),
  syncAlertParameterActivations: jest.fn(async () => undefined),
  retireAlertParameterActivations: jest.fn(async () => undefined),
}));

import { db } from '../../src/config/database';
import { connectionRequestsRepository } from '../../src/modules/connection-requests/connection-requests.repository';
import {
  retireAlertParameterActivations,
  syncAlertParameterActivations,
} from '../../src/modules/alert-emails/alert-parameter-activations.repository';

type Row = Record<string, unknown>;
const mockedDb = db as unknown as {
  transaction: jest.Mock<
    (callback: (trx: Knex.Transaction) => Promise<unknown>) => Promise<unknown>
  >;
};
const existingPoint = {
  id: 9,
  factory_id: 'F1',
  eligible_factory_id: 17,
  system_type: 'CEMS',
  point_code: 'S1',
  point_name: 'Station 1',
  parameters_json: '["CO (ppm)"]',
  instruments_json: null,
};

function harness(existing: Row | null = existingPoint) {
  const inserted: Row[] = [];
  const operations: string[] = [];
  const trx = Object.assign(
    (table: string) => {
      const predicates: Array<(row: Row) => boolean> = [];
      let selected: string[] = [];
      const rows = () =>
        (table === 'eligible_factories' ? [{ id: 17 }] : existing ? [existing] : []).filter((row) =>
          predicates.every((predicate) => predicate(row)),
        );
      const project = (row: Row) =>
        selected.length === 0
          ? { ...row }
          : Object.fromEntries(selected.map((column) => [column, row[column]]));
      const chain: Record<string, unknown> = {};
      chain.where = (column: string, value: unknown) => {
        predicates.push((row) => row[column] === value);
        return chain;
      };
      chain.whereNull = (column: string) => {
        predicates.push((row) => row[column] == null);
        return chain;
      };
      chain.whereRaw = (sql: string, bindings: unknown[]) => {
        if (sql !== 'UPPER(LTRIM(RTRIM(point_code))) = ?')
          throw new Error('Unexpected ownership query');
        predicates.push(
          (row) =>
            String(row.point_code ?? '')
              .trim()
              .toUpperCase() === bindings[0],
        );
        return chain;
      };
      chain.select = (...columns: string[]) => {
        selected = columns;
        return chain;
      };
      chain.forUpdate = () => {
        operations.push(`lock:${table}`);
        return chain;
      };
      chain.first = async () => {
        const row = rows()[0];
        return row ? project(row) : undefined;
      };
      chain.then = (resolve: (values: Row[]) => unknown) =>
        Promise.resolve(rows().map(project)).then(resolve);
      chain.update = async () => {
        operations.push(`update:${table}`);
        return 1;
      };
      chain.insert = (row: Row) => {
        inserted.push(row);
        operations.push(`insert:${table}`);
        return chain;
      };
      chain.returning = async () => [{ id: 88 }];
      return chain;
    },
    { fn: { now: () => 'db-now' } },
  ) as unknown as Knex.Transaction;
  mockedDb.transaction.mockImplementation(async (callback) => callback(trx));
  return { trx, inserted, operations };
}

function request(type = 'ADD_PARAMETER') {
  return {
    id: 51,
    factoryId: 'F1',
    eligibleFactoryId: 17,
    systemType: 'CEMS',
    requestType: type,
    verifiedAt: '2026-10-05T02:00:00Z',
    factoryName: 'Factory',
    factoryRegistrationNo: 'F1',
    measurementPoints: [
      {
        id: 52,
        pointCode: 'S1',
        pointName: 'Station 1',
        pointType: 'STACK',
        parameters: ['NOx (ppm)'],
      },
    ],
  } as unknown as ConnectionRequestDTO;
}

describe('activation hooks at live point approval', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('carries baselines only for an approved ADD_PARAMETER of the same current station and factory', async () => {
    const h = harness();
    jest.mocked(syncAlertParameterActivations).mockImplementationOnce(async () => {
      expect(h.operations.at(-1)).toBe('insert:cems_wpms_connected_measurement_points');
    });
    await connectionRequestsRepository.syncConnectedMeasurementPoints(request(), 3);
    expect(syncAlertParameterActivations).toHaveBeenCalledWith(h.trx, ['S1'], {
      carryFromPointId: 9,
    });
    expect(h.inserted[0].parameters_json).toBe('["CO (ppm)","NOx (ppm)"]');
  });

  it('does not carry across a changed factory identity even with the same eligible owner', async () => {
    const h = harness({ ...existingPoint, factory_id: 'different' });
    await connectionRequestsRepository.syncConnectedMeasurementPoints(request(), 3);
    expect(syncAlertParameterActivations).toHaveBeenCalledWith(h.trx, ['S1']);
    expect(retireAlertParameterActivations).toHaveBeenCalledWith(h.trx, [9]);
  });

  it.each([{ system_type: 'WPMS' }, { point_code: 'other' }, { eligible_factory_id: 18 }])(
    'rejects an ADD_PARAMETER with changed ownership before writing %j',
    async (patch) => {
      const h = harness({ ...existingPoint, ...patch });
      await expect(
        connectionRequestsRepository.syncConnectedMeasurementPoints(request(), 3),
      ).rejects.toMatchObject({
        code: 'CONFLICT',
        details: { reason: 'ADD_PARAMETER_POINT_OWNERSHIP_INVALID' },
      });
      expect(h.inserted).toEqual([]);
      expect(syncAlertParameterActivations).not.toHaveBeenCalled();
      expect(retireAlertParameterActivations).not.toHaveBeenCalled();
    },
  );

  it('carries a case-only station spelling change accepted by SQL Server', async () => {
    const h = harness();
    const lower = request();
    lower.measurementPoints[0].pointCode = 's1';
    await connectionRequestsRepository.syncConnectedMeasurementPoints(lower, 3);
    expect(syncAlertParameterActivations).toHaveBeenCalledWith(h.trx, ['s1'], {
      carryFromPointId: 9,
    });
  });

  it('rejects an empty-code legacy ADD_PARAMETER without guessing station ownership', async () => {
    const h = harness({ ...existingPoint, point_code: '', point_name: 's1' });
    const legacy = request();
    legacy.measurementPoints[0].pointCode = '';
    legacy.measurementPoints[0].pointName = 'S1';
    await expect(
      connectionRequestsRepository.syncConnectedMeasurementPoints(legacy, 3),
    ).rejects.toMatchObject({
      code: 'CONFLICT',
      details: { reason: 'ADD_PARAMETER_POINT_OWNERSHIP_INVALID' },
    });
    expect(h.inserted).toEqual([]);
    expect(syncAlertParameterActivations).not.toHaveBeenCalled();
  });

  it('never carries a reconnect or a canceled/missing previous live point', async () => {
    const h = harness();
    await connectionRequestsRepository.syncConnectedMeasurementPoints(
      request('ADD_MEASUREMENT_POINT'),
      3,
    );
    expect(syncAlertParameterActivations).toHaveBeenCalledWith(h.trx, ['S1']);
    jest.clearAllMocks();
    const fresh = harness(null);
    await expect(
      connectionRequestsRepository.syncConnectedMeasurementPoints(request(), 3),
    ).rejects.toMatchObject({
      code: 'CONFLICT',
      details: { reason: 'ADD_PARAMETER_POINT_OWNERSHIP_INVALID' },
    });
    expect(fresh.inserted).toEqual([]);
    expect(syncAlertParameterActivations).not.toHaveBeenCalled();
    expect(retireAlertParameterActivations).not.toHaveBeenCalled();
  });
});
