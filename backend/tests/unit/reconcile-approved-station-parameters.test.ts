import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { Knex } from 'knex';
jest.mock('../../src/modules/alert-emails/alert-parameter-activations.repository', () => ({
  lockAlertActivationPoints: jest.fn(async () => []),
  syncAlertParameterActivations: jest.fn(async () => undefined),
}));
import { reconcileApprovedStationParameters } from '../../src/modules/device-connections/reconcile-approved-station-parameters';
import {
  lockAlertActivationPoints,
  syncAlertParameterActivations,
} from '../../src/modules/alert-emails/alert-parameter-activations.repository';

function harness(failWrite = false) {
  const reads: Array<{ table: string; filters: unknown[][] }> = [];
  const writes: Array<{ table: string; filters: unknown[][]; values: Record<string, unknown> }> =
    [];
  const trx = Object.assign(
    (table: string) => {
      const filters: unknown[][] = [];
      const chain: Record<string, unknown> = {};
      for (const method of ['where', 'whereNull', 'whereIn', 'forUpdate'])
        chain[method] = (...args: unknown[]) => {
          filters.push([method, ...args]);
          return chain;
        };
      chain.select = async () => {
        reads.push({ table, filters });
        return table === 'device_connection_configs'
          ? [
              {
                id: 10,
                status_management_json: JSON.stringify({
                  schedules: [
                    { selectedParameters: ['COD (mg/l)'], status: 'Maintenance' },
                    { selectedParameters: ['BOD (mg/l)', 'COD (mg/l)'], status: 'Calibration' },
                  ],
                }),
              },
            ]
          : [
              { id: 1, data_type: 'BOD (mg/l)' },
              { id: 2, data_type: 'COD (mg/l)' },
              { id: 3, data_type: 'Watt (kW/hr)' },
            ];
      };
      chain.update = async (values: Record<string, unknown>) => {
        if (failWrite) throw new Error('write failed');
        writes.push({ table, filters, values });
        return 1;
      };
      return chain;
    },
    { fn: { now: () => 'db-now' } },
  );
  return { trx: trx as unknown as Knex.Transaction, reads, writes };
}

describe('approved station parameter reconciliation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  it('retires only COD and its schedules from active configs without assigning Flow an address', async () => {
    const h = harness();
    await reconcileApprovedStationParameters(
      h.trx,
      'P0260',
      ['BOD (mg/l)', 'Watt (kW/hr)', 'Flow rate (m3/hr)'],
      77,
    );
    expect(h.reads[0].filters).toEqual(
      expect.arrayContaining([
        ['where', 'station_id', 'P0260'],
        ['whereNull', 'request_id'],
        ['whereNull', 'deleted_at'],
        ['forUpdate'],
      ]),
    );
    expect(h.writes[0]).toEqual({
      table: 'device_measurement_channels',
      filters: [
        ['where', 'config_id', 10],
        ['whereIn', 'id', [2]],
        ['whereNull', 'deleted_at'],
      ],
      values: { deleted_at: 'db-now', updated_at: 'db-now', updated_by: 77 },
    });
    expect(h.writes).toHaveLength(2);
    expect(lockAlertActivationPoints).toHaveBeenCalledWith(h.trx, ['P0260']);
    expect(syncAlertParameterActivations).toHaveBeenCalledWith(h.trx, ['P0260']);
    expect(h.writes[1].filters).toContainEqual(['whereNull', 'request_id']);
    expect(JSON.parse(String(h.writes[1].values.status_management_json))).toEqual({
      schedules: [{ selectedParameters: ['BOD (mg/l)'], status: 'Calibration' }],
    });
    for (const write of h.writes) {
      expect(write.values).not.toHaveProperty('address_id');
      expect(write.values).not.toHaveProperty('data_type');
    }
  });

  it('propagates channel-write failure to abort the surrounding approval transaction', async () => {
    const h = harness(true);
    await expect(
      reconcileApprovedStationParameters(h.trx, 'P0260', ['BOD (mg/l)'], 77),
    ).rejects.toThrow('write failed');
    expect(syncAlertParameterActivations).not.toHaveBeenCalled();
  });

  it('preserves the historical repair without touching the later activation dependency when explicitly disabled', async () => {
    const h = harness();
    await reconcileApprovedStationParameters(
      h.trx,
      'P0260',
      ['BOD (mg/l)', 'Watt (kW/hr)', 'Flow rate (m3/hr)'],
      77,
      { syncAlertActivations: false },
    );
    expect(lockAlertActivationPoints).not.toHaveBeenCalled();
    expect(syncAlertParameterActivations).not.toHaveBeenCalled();
    expect(h.writes).toHaveLength(2);
    expect(h.writes[0].filters).toContainEqual(['whereIn', 'id', [2]]);
    expect(h.writes[0].values).toEqual({
      deleted_at: 'db-now',
      updated_at: 'db-now',
      updated_by: 77,
    });
  });
});
