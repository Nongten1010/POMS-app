import { afterEach, describe, expect, it, jest } from '@jest/globals';
import type { Knex } from 'knex';
jest.mock('../../src/config/database', () => ({ db: jest.fn() }));
import { up, down, config } from '../../src/db/migrations/0112_repair_approved_p0260_parameters';

const originalEnv = process.env.NODE_ENV;
afterEach(() => {
  process.env.NODE_ENV = originalEnv;
});
const parameters = ['BOD (mg/l)', 'Watt (kW/hr)', 'Flow rate (m3/hr)'];

function fixture(
  options: {
    later?: boolean;
    liveChanged?: boolean;
    failWrite?: boolean;
    wrongProposal?: boolean;
  } = {},
) {
  const before = {
    connectedPointId: 15,
    eligibleFactoryId: 7,
    factoryId: '10100000125241',
    factoryName: 'Test factory',
    sourceMeasurementPointId: 2,
    systemType: 'WPMS',
    pointCode: 'P0260',
    pointName: '1',
    pointType: 'WASTEWATER',
    parameters: ['BOD (mg/l)', 'COD (mg/l)', 'Watt (kW/hr)'],
    monitoringPointStatus: null,
    details: null,
    documentsAndImages: [],
    measurementInstruments: null,
    updatedAt: '2026-09-06T00:00:00.000Z',
  };
  const proposal = {
    ...before,
    details: { requestedParameters: options.wrongProposal ? ['BOD (mg/l)'] : parameters },
  };
  const request = {
    id: 11,
    factory_id: before.factoryId,
    eligible_factory_id: 7,
    request_no: 'point-00001/2569',
    status: 'APPROVED',
    form_type: 'MEASUREMENT_POINTS',
    approved_at: '2026-09-07T00:00:00.002Z',
    reviewed_by: 77,
    current_measurement_points_json: JSON.stringify([before]),
    proposed_measurement_points_json: JSON.stringify([proposal]),
  };
  const live: Record<string, unknown> = {
    id: 15,
    eligible_factory_id: 7,
    point_code: 'P0260',
    point_name: '1',
    parameters_json: JSON.stringify(before.parameters),
    details_json: JSON.stringify(proposal.details),
    monitoring_point_status: null,
    documents_json: null,
    instruments_json: null,
    updated_at: options.liveChanged ? '2026-09-08T00:00:00Z' : '2026-09-07T00:00:00.001Z',
  };
  const channels = [
    { id: 1, config_id: 9, data_type: 'BOD (mg/l)', address_id: 1, deleted_at: null },
    { id: 2, config_id: 9, data_type: 'COD (mg/l)', address_id: 2, deleted_at: null },
    { id: 3, config_id: 9, data_type: 'Watt (kW/hr)', address_id: 3, deleted_at: null },
  ];
  const writes: Array<{ table: string; values: Record<string, unknown> }> = [];
  let requestQueries = 0;
  const fake = Object.assign(
    (table: string) => {
      const requestQuery = table === 'poms_factory_edit_requests' ? ++requestQueries : 0;
      let ids: number[] | undefined;
      const chain: Record<string, unknown> = {};
      for (const name of ['where', 'whereNull', 'forUpdate', 'select', 'orderBy'])
        chain[name] = () => chain;
      chain.whereIn = (column: string, values: number[]) => {
        if (column === 'id') ids = values;
        return chain;
      };
      const result = () =>
        table === 'poms_factory_edit_requests'
          ? requestQuery === 1
            ? [request]
            : options.later
              ? [{ id: 12 }]
              : []
          : table === 'cems_wpms_connected_measurement_points'
            ? [live]
            : table === 'device_connection_configs'
              ? [{ id: 9, station_id: 'P0260', status_management_json: null }]
              : table === 'device_measurement_channels'
                ? channels.filter((c) => !c.deleted_at)
                : table === 'users'
                  ? [{ id: 77 }]
                  : [];
      chain.first = async () => result()[0];
      chain.then = (resolve: (v: unknown) => unknown) => Promise.resolve(result()).then(resolve);
      chain.insert = async (values: Record<string, unknown>) => {
        writes.push({ table, values });
        return [1];
      };
      chain.update = async (values: Record<string, unknown>) => {
        if (options.failWrite && table === 'cems_wpms_connected_measurement_points') return 0;
        writes.push({ table, values });
        if (table === 'cems_wpms_connected_measurement_points') Object.assign(live, values);
        if (table === 'device_measurement_channels')
          channels.filter((c) => ids?.includes(c.id)).forEach((c) => Object.assign(c, values));
        return 1;
      };
      return chain;
    },
    {
      fn: { now: () => '2026-09-09T00:00:00Z' },
      schema: { hasTable: async () => false, createTable: async () => undefined },
    },
  );
  return { knex: fake as unknown as Knex, live, channels, writes, request };
}

describe('targeted P0260 production repair migration', () => {
  it('backs up before writing approved POMS parameters and retiring only COD', async () => {
    process.env.NODE_ENV = 'production';
    const f = fixture();
    await up(f.knex);
    expect(config.transaction).toBe(true);
    expect(JSON.parse(String(f.live.parameters_json))).toEqual(parameters);
    expect(f.channels.filter((c) => !c.deleted_at).map((c) => [c.data_type, c.address_id])).toEqual(
      [
        ['BOD (mg/l)', 1],
        ['Watt (kW/hr)', 3],
      ],
    );
    expect(f.writes[0].table).toBe('poms_p0260_parameter_repair_backup_20260909');
    const backup = JSON.parse(String(f.writes[0].values.snapshot_json));
    expect(JSON.parse(backup.live.parameters_json)).toContain('COD (mg/l)');
    expect(backup.channels).toHaveLength(3);
    expect(f.writes.some((w) => w.table === 'poms_factory_edit_requests')).toBe(false);
  });
  it.each([{ later: true }, { liveChanged: true }, { wrongProposal: true }])(
    'refuses changed state before any write: %j',
    async (options) => {
      process.env.NODE_ENV = 'production';
      const f = fixture(options);
      await expect(up(f.knex)).rejects.toThrow();
      expect(f.writes).toEqual([]);
    },
  );
  it('fails if the exact connected-point update does not affect one row', async () => {
    process.env.NODE_ENV = 'production';
    const f = fixture({ failWrite: true });
    await expect(up(f.knex)).rejects.toThrow();
    expect(f.channels.every((c) => !c.deleted_at)).toBe(true);
  });
  it('does not access non-production databases', async () => {
    process.env.NODE_ENV = 'test';
    await up((() => {
      throw new Error('Unexpected DB access');
    }) as unknown as Knex);
  });
  it('does not automatically roll back approved business data', async () => {
    await expect(down()).rejects.toThrow('forward-only');
  });
});
