import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { Knex } from 'knex';
import type { CreateDeviceConnectionConfigInput } from '../../src/modules/device-connections/device-connections.types';

jest.mock('../../src/config/database', () => ({
  db: Object.assign(jest.fn(), { transaction: jest.fn() }),
}));
jest.mock('../../src/modules/alert-emails/alert-parameter-activations.repository', () => ({
  lockAlertActivationPoints: jest.fn(async () => []),
  syncAlertParameterActivations: jest.fn(async () => undefined),
}));

import { db } from '../../src/config/database';
import { deviceConnectionsRepository } from '../../src/modules/device-connections/device-connections.repository';
import {
  lockAlertActivationPoints,
  syncAlertParameterActivations,
} from '../../src/modules/alert-emails/alert-parameter-activations.repository';

const input: CreateDeviceConnectionConfigInput = {
  stationId: 'S1',
  deviceCode: 'D1',
  protocol: 'MSSQL',
  settings: {},
  channels: [{ dataType: 'CO (ppm)', offset: 0, addressId: null }],
};
const mockedDb = db as unknown as {
  transaction: jest.Mock<
    (callback: (trx: Knex.Transaction) => Promise<unknown>) => Promise<unknown>
  >;
};

function harness() {
  const operations: string[] = [];
  let row: Record<string, unknown> = {};
  const trx = Object.assign(
    (table: string) => {
      const chain: Record<string, unknown> = {};
      for (const method of ['where', 'whereNull', 'whereIn', 'orderBy', 'forUpdate'])
        chain[method] = () => chain;
      chain.modify = (callback: (builder: unknown) => void) => {
        callback(chain);
        return chain;
      };
      chain.select = async () =>
        table === 'cems_wpms_connected_measurement_points'
          ? [{ parameters_json: '["CO (ppm)"]' }]
          : [];
      chain.insert = (values: Record<string, unknown>) => {
        operations.push(`insert:${table}:${String(values.request_id)}`);
        if (table === 'device_connection_configs')
          row = {
            id: 99,
            created_at: '2026-10-01T00:00:00Z',
            updated_at: '2026-10-01T00:00:00Z',
            ...values,
          };
        return chain;
      };
      chain.returning = async () => [{ id: 99 }];
      chain.first = async () => row;
      chain.then = (resolve: (rows: unknown[]) => unknown) => Promise.resolve([]).then(resolve);
      return chain;
    },
    { fn: { now: () => 'db-now' } },
  ) as unknown as Knex.Transaction;
  mockedDb.transaction.mockImplementation(async (callback) => callback(trx));
  jest.mocked(lockAlertActivationPoints).mockImplementation(async () => {
    operations.push('lock');
    return [];
  });
  jest.mocked(syncAlertParameterActivations).mockImplementation(async () => {
    operations.push('sync');
  });
  return { trx, operations };
}

describe('activation hooks in every device config writer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it.each(['create', 'replace', 'station', 'request-and-active'] as const)(
    'synchronizes %s after its final active insert in the same transaction and locks before writing',
    async (method) => {
      const h = harness();
      if (method === 'create') await deviceConnectionsRepository.createMany([input], 3);
      if (method === 'replace') await deviceConnectionsRepository.replaceManyActive([input], 3);
      if (method === 'station')
        await deviceConnectionsRepository.replaceManyActiveForStation('S1', [input], 3);
      if (method === 'request-and-active')
        await deviceConnectionsRepository.replaceManyForRequestAndActiveSettings([input], 3, 17);
      expect(lockAlertActivationPoints).toHaveBeenCalledWith(h.trx, ['S1']);
      expect(syncAlertParameterActivations).toHaveBeenCalledTimes(1);
      expect(syncAlertParameterActivations).toHaveBeenCalledWith(h.trx, ['S1']);
      expect(h.operations[0]).toBe('lock');
      expect(h.operations.at(-1)).toBe('sync');
      const lastActiveInsert = h.operations.lastIndexOf('insert:device_connection_configs:null');
      expect(lastActiveInsert).toBeGreaterThan(0);
      expect(h.operations.indexOf('sync')).toBeGreaterThan(lastActiveInsert);
    },
  );

  it.each(['create-snapshot', 'replace-snapshot'] as const)(
    'does not register %s as live reporting',
    async (method) => {
      const h = harness();
      if (method === 'create-snapshot')
        await deviceConnectionsRepository.createMany([input], 3, 17);
      else await deviceConnectionsRepository.replaceManyForRequest([input], 3, 17);
      expect(syncAlertParameterActivations).not.toHaveBeenCalled();
      expect(lockAlertActivationPoints).not.toHaveBeenCalled();
      expect(h.operations).toContain('insert:device_connection_configs:17');
    },
  );

  it('propagates a registry write failure to abort the surrounding config transaction', async () => {
    harness();
    jest
      .mocked(syncAlertParameterActivations)
      .mockRejectedValueOnce(new Error('registry write failed'));
    await expect(deviceConnectionsRepository.replaceManyActive([input], 3)).rejects.toThrow(
      'registry write failed',
    );
  });
});
