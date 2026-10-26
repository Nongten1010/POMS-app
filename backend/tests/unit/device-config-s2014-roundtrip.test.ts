import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { db } from '../../src/config/database';
import { connectionRequestsRepository } from '../../src/modules/connection-requests/connection-requests.repository';
import { connectionRequestsService } from '../../src/modules/connection-requests/connection-requests.service';
import type {
  ConnectionRequestDTO,
  CurrentFactoryMeasurementPointDTO,
  DeviceConfigFormDetailDTO,
} from '../../src/modules/connection-requests/connection-requests.types';
import { deviceConnectionsService } from '../../src/modules/device-connections/device-connections.service';
import { createDeviceConnectionConfigRequestSchema } from '../../src/modules/device-connections/device-connections.validator';
import { createKnexSqliteFixture, type KnexSqliteFixture } from '../helpers/knex-sqlite-fixture';

jest.mock('../../src/modules/connection-requests/connection-requests.repository', () => ({
  connectionRequestsRepository: {
    findByIdForReadAccess: jest.fn(),
    list: jest.fn(),
    listConnectedMeasurementPointsForFactories: jest.fn(),
  },
}));
jest.mock('../../src/modules/alert-emails/alert-parameter-activations.repository', () => ({
  lockAlertActivationPoints: jest.fn(async () => []),
  syncAlertParameterActivations: jest.fn(async () => undefined),
}));

const parameters = ['CO (ppm)', 'NOx (ppm)', 'O2 (%)', 'Temp. (C°)', 'Flow Rate (m3/hr)'];
const addresses = [3, 2, 1, 5, 4];
const configs = [
  { id: 266, requestId: 10195, protocol: 'MYSQL', copies: 1 },
  { id: 267, requestId: null, protocol: 'MYSQL', copies: 1 },
  { id: 274, requestId: 10195, protocol: 'MSSQL', copies: 3 },
  { id: 275, requestId: null, protocol: 'MSSQL', copies: 3 },
];

describe('S2014 device configuration read-save roundtrip', () => {
  let fixture: KnexSqliteFixture;

  beforeEach(async () => {
    jest.mocked(connectionRequestsRepository.findByIdForReadAccess).mockResolvedValue({
      id: 10195,
      requestNo: 'CEMS-0121/2569',
      factoryId: 'fixture-factory',
      measurementPoints: [
        {
          id: 501,
          pointCode: 'S2014',
          pointName: 'S2014',
          parameters,
          measurementInstruments: null,
        },
      ],
    } as unknown as ConnectionRequestDTO);

    let channelId = 0;
    fixture = await createKnexSqliteFixture(db, {
      device_connection_configs: configs.map((config) => ({
        id: config.id,
        request_id: config.requestId,
        source_request_id: config.requestId,
        source_recorded: 1,
        station_id: 'S2014',
        device_code: 'S2014/01',
        protocol: config.protocol,
        settings_json: JSON.stringify({ hostIp: '192.0.2.1', dbName: 'fixture' }),
        status_management_json: null,
        created_by: 1,
        updated_by: 1,
        created_at: config.protocol === 'MYSQL' ? '2026-10-21T15:24:49Z' : '2026-10-21T15:38:34Z',
        updated_at: config.protocol === 'MYSQL' ? '2026-10-21T15:24:49Z' : '2026-10-21T15:38:34Z',
        deleted_at: null,
      })),
      device_measurement_channels: configs.flatMap((config) =>
        Array.from({ length: config.copies }, (_, copy) =>
          parameters.map((parameter, index) => ({
            id: ++channelId,
            config_id: config.id,
            data_type: parameter,
            address_id: copy === 0 ? addresses[index] : null,
            test_mode: 0,
            value_range_json: null,
            alert_low: null,
            alert_high: null,
            value_format: null,
            offset_value: copy === 0 ? 0 : null,
            encoding: null,
            parameter_status: null,
            created_by: 1,
            updated_by: 1,
            created_at: '2026-10-21T15:38:34Z',
            updated_at: '2026-10-21T15:38:34Z',
            deleted_at: null,
          })),
        ).flat(),
      ),
    });
    fixture.execute(`
      CREATE TRIGGER config_audit_defaults AFTER INSERT ON device_connection_configs
      BEGIN
        UPDATE device_connection_configs
        SET created_at = COALESCE(NEW.created_at, CURRENT_TIMESTAMP),
            updated_at = COALESCE(NEW.updated_at, CURRENT_TIMESTAMP)
        WHERE id = NEW.id;
      END;
    `);
  });

  afterEach(() => fixture?.close());

  const readForm = () =>
    connectionRequestsService.getDeviceConfigFormDetail(10195, 'S2014', 42, 'ALL');

  function expectSingleDeviceAndFiveParameters(form: DeviceConfigFormDetailDTO): void {
    expect(form.parameterMappings).toHaveLength(5);
    expect(form.parameterMappings.map((mapping) => mapping.parameter)).toEqual(parameters);
    expect(form.parameterMappings.map((mapping) => mapping.addressId)).toEqual(
      addresses.map(String),
    );
    expect(form.parameterOptions).toEqual(parameters);
    expect(form.deviceCodeOptions).toEqual(['S2014/01']);
    expect(form.connectionForms).toEqual([
      expect.objectContaining({ protocol: 'MSSQL', deviceCode: 'S2014/01' }),
    ]);
    expect(form.rawConfigs.device).toEqual([
      expect.objectContaining({ protocol: 'MSSQL', deviceCode: 'S2014/01' }),
    ]);
    expect(form.rawConfigs.channels.map((channel) => channel.dataType)).toEqual(parameters);
    expect(form.rawConfigs.channels.map((channel) => channel.addressId)).toEqual(addresses);
  }

  it('reads the observed 20-row incident as five mappings while retaining configured addresses', async () => {
    expectSingleDeviceAndFiveParameters(await readForm());
    // GET corrects the response without silently mutating historical stored rows.
    expect(await db('device_measurement_channels').whereNull('deleted_at')).toHaveLength(40);
  });

  it('applies the same recovery to current settings after resolving the live approved parameters', async () => {
    const request = await connectionRequestsRepository.findByIdForReadAccess(10195, {
      actorUserId: 42,
      scope: 'ALL',
    });
    jest.mocked(connectionRequestsRepository.list).mockResolvedValue({
      rows: [request!],
      total: 1,
    });
    jest
      .mocked(connectionRequestsRepository.listConnectedMeasurementPointsForFactories)
      .mockResolvedValue([
        {
          sourceRequestId: 10195,
          sourceMeasurementPointId: 501,
          pointCode: 'S2014',
          pointName: 'S2014',
          parameters,
          measurementInstruments: null,
        } as CurrentFactoryMeasurementPointDTO,
      ]);
    // Simulate a later connected point; the incident itself was only confirmed.
    fixture.execute(
      "UPDATE device_measurement_channels SET data_type = ' co (PPM) ' WHERE config_id = 275 AND data_type = 'CO (ppm)'",
    );

    const form = await connectionRequestsService.getCurrentDeviceConfigFormDetail(
      'S2014',
      42,
      'ALL',
    );
    expectSingleDeviceAndFiveParameters(form);
    expect(form.connectionForms[0].configId).toBe(275);
    expect(await db('device_measurement_channels').whereNull('deleted_at')).toHaveLength(40);
  });

  it('roundtrips the raw form through validation and three saves without multiplying channels', async () => {
    for (let save = 0; save < 3; save += 1) {
      const form = await readForm();
      expectSingleDeviceAndFiveParameters(form);
      const parsed = createDeviceConnectionConfigRequestSchema.parse({ config: form.rawConfigs });
      expect('configs' in parsed).toBe(true);
      await deviceConnectionsService.createManyForRequest(
        'configs' in parsed ? parsed.configs : [parsed],
        42,
        10195,
      );

      const active = await db('device_connection_configs').whereNull('deleted_at').orderBy('id');
      expect(active.map((config) => [config.request_id, config.protocol])).toEqual([
        [10195, 'MSSQL'],
        [null, 'MSSQL'],
      ]);
      for (const config of active) {
        const channels = await db('device_measurement_channels')
          .where('config_id', config.id)
          .whereNull('deleted_at')
          .orderBy('id');
        expect(channels.map((channel) => channel.data_type)).toEqual(parameters);
        expect(channels.map((channel) => Number(channel.address_id))).toEqual(addresses);
      }
    }
    expectSingleDeviceAndFiveParameters(await readForm());
  });
});
