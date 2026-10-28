import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { createApp } from '../../src/app';
import { createDeviceConfigApiFixture } from '../helpers/device-config-api-fixture';
import { signTestAccessToken } from '../helpers/live-authorization-fixture';

const remainingDevice = {
  stationId: 'P0002',
  deviceCode: 'P0002/01',
  protocol: 'DCON_ASCII',
  settings: {
    comPort: 'COM3',
    slaveId: 1,
    baudRate: 9600,
    parity: 'NONE',
    stopBits: 1,
    dataBits: 8,
    quantity: 4,
    valueRange: null,
  },
  channels: [
    {
      deviceCode: 'P0002/01',
      addressId: 1,
      dataType: 'COD (mg/l)',
      valueRange: { min: 0, max: 180 },
      alertLow: 0,
      alertHigh: 60,
      testMode: false,
      valueFormat: 'CURRENT',
      offset: null,
      encoding: null,
      status: 'Normal',
    },
    {
      deviceCode: 'P0002/01',
      addressId: 4,
      dataType: 'BOD (mg/l)',
      valueRange: { min: 0, max: 30 },
      alertLow: 0,
      alertHigh: 7,
      testMode: false,
      valueFormat: 'CURRENT',
      offset: null,
      encoding: null,
      status: 'Normal',
    },
    {
      deviceCode: 'P0002/01',
      addressId: 2,
      dataType: 'Flow rate (m3/hr)',
      valueRange: { min: 0, max: 400 },
      alertLow: 0,
      alertHigh: null,
      testMode: false,
      valueFormat: 'CURRENT',
      offset: null,
      encoding: null,
      status: 'Normal',
    },
    {
      deviceCode: 'P0002/01',
      addressId: 3,
      dataType: 'Watt (kW/hr)',
      valueRange: { min: 0, max: 900 },
      alertLow: 0,
      alertHigh: null,
      testMode: false,
      valueFormat: 'CURRENT',
      offset: null,
      encoding: null,
      status: 'Normal',
    },
  ],
  statusManagement: { schedules: [] },
};
const omittedDevice = {
  stationId: 'P0002',
  deviceCode: 'P0002/02',
  protocol: 'DCON_ASCII',
  settings: {},
  channels: [],
};
const endpoint = '/api/v1/cems-wpms-requests/10093/device-configs';

describe('request device configuration replaces each submitted station', () => {
  let fixture: Awaited<ReturnType<typeof createDeviceConfigApiFixture>>;
  let app: ReturnType<typeof createApp>;
  let token: string;
  const originalDeviceConfigKeys = process.env.DEVICE_CONFIG_API_KEYS;

  beforeEach(async () => {
    fixture = await createDeviceConfigApiFixture();
    fixture.execute(
      'UPDATE cems_wpms_connection_requests SET id = 10093, system_type = ? WHERE id = 101',
      ['WPMS'],
    );
    fixture.execute(
      'UPDATE cems_wpms_measurement_points SET request_id = 10093, point_code = ?, point_type = ?, parameters_json = ? WHERE request_id = 101',
      [
        'P0002',
        'WASTEWATER',
        JSON.stringify(['COD (mg/l)', 'BOD (mg/l)', 'Flow rate (m3/hr)', 'Watt (kW/hr)']),
      ],
    );
    token = signTestAccessToken({
      sub: '42',
      userType: 'officer',
      roles: ['monitoring_kpm'],
      scopes: { 'cems_wpms_requests:view': 'ALL', 'cems_wpms_requests:edit': 'ALL' },
    });
    app = createApp();
    process.env.DEVICE_CONFIG_API_KEYS = 'device-replacement-fixture-key';
  });

  afterEach(() => {
    fixture?.close();
    jest.restoreAllMocks();
    if (originalDeviceConfigKeys === undefined) delete process.env.DEVICE_CONFIG_API_KEYS;
    else process.env.DEVICE_CONFIG_API_KEYS = originalDeviceConfigKeys;
  });

  async function save(body: object): Promise<void> {
    const saved = await request(app).post(endpoint).auth(token, { type: 'bearer' }).send(body);
    expect({ status: saved.status, body: saved.body }).toMatchObject({
      status: 201,
      body: { success: true },
    });
  }

  async function load(stationId = 'P0002', requestId = 10093) {
    const loaded = await request(app)
      .get(`/api/v1/cems-wpms-requests/${requestId}/device-configs`)
      .query({ stationId })
      .auth(token, { type: 'bearer' });
    expect(loaded.status).toBe(200);
    return loaded.body.data;
  }

  it.each(['single', 'batch', 'form'])(
    'removes P0002/02 when the %s payload retains only P0002/01',
    async (format) => {
      await save({ configs: [omittedDevice, remainingDevice] });
      expect((await load()).connectionForms).toHaveLength(2);

      const body =
        format === 'single'
          ? remainingDevice
          : format === 'batch'
            ? { configs: [remainingDevice] }
            : {
                config: {
                  stationId: 'P0002',
                  device: [
                    {
                      deviceCode: 'P0002/01',
                      protocol: 'DCON_ASCII',
                      settings: remainingDevice.settings,
                    },
                  ],
                  channels: remainingDevice.channels,
                  statusManagement: remainingDevice.statusManagement,
                },
              };
      await save(body);

      const loaded = await load();
      expect(loaded.connectionForms).toEqual([
        expect.objectContaining({ deviceCode: 'P0002/01', protocol: 'DCON_ASCII' }),
      ]);
      expect(loaded.rawConfigs.device).toEqual([
        expect.objectContaining({ deviceCode: 'P0002/01', settings: remainingDevice.settings }),
      ]);
      expect(loaded.rawConfigs.channels).toEqual(
        remainingDevice.channels.map((channel) => expect.objectContaining(channel)),
      );
    },
  );

  it('removes the device, channels and schedules from Worker responses without reviving history', async () => {
    await save({
      configs: [
        {
          ...omittedDevice,
          channels: [{ dataType: 'COD (mg/l)', addressId: 99, status: 'Maintenance' }],
          statusManagement: {
            schedules: [
              {
                selectedParameters: ['COD (mg/l)'],
                startAt: '2026-10-28 08:00:00',
                endAt: '2026-10-28 10:00:00',
                status: 'Maintenance',
              },
            ],
          },
        },
        remainingDevice,
      ],
    });
    const readWorker = () =>
      request(app)
        .get('/api/v1/integrations/device-configs/P0002')
        .set('X-API-Key', 'device-replacement-fixture-key');
    const before = await readWorker();
    expect(before.status).toBe(200);
    expect(before.body.data.deviceConfigs).toHaveLength(2);
    expect(before.body.data.parameterConfigs).toContainEqual(
      expect.objectContaining({ deviceCode: 'P0002/02', addressId: 99 }),
    );

    for (let attempt = 0; attempt < 2; attempt += 1) {
      await save(remainingDevice);
      const after = await readWorker();
      expect(after.status).toBe(200);
      expect(after.body.data.deviceConfigs).toEqual([
        expect.objectContaining({ deviceCode: 'P0002/01', protocol: 'DCON_ASCII' }),
      ]);
      expect(after.body.data.parameterConfigs).toEqual([
        expect.objectContaining({ deviceCode: 'P0002/01', parameter: 'COD (mg/l)', addressId: 1 }),
        expect.objectContaining({ deviceCode: 'P0002/01', parameter: 'BOD (mg/l)', addressId: 4 }),
        expect.objectContaining({
          deviceCode: 'P0002/01',
          parameter: 'Flow rate (m3/hr)',
          addressId: 2,
        }),
        expect.objectContaining({
          deviceCode: 'P0002/01',
          parameter: 'Watt (kW/hr)',
          addressId: 3,
        }),
      ]);
      expect(after.body.data.statusSchedules).toEqual([]);
    }
  });

  it('preserves another station in this request and another request for the same station', async () => {
    fixture.execute(
      'INSERT INTO cems_wpms_measurement_points (id, request_id, point_code, point_name, point_type, parameters_json) VALUES (?, ?, ?, ?, ?, ?)',
      [203, 10093, 'P0003', 'จุดอื่นในคำขอ', 'WASTEWATER', '[]'],
    );
    await save({
      configs: [
        omittedDevice,
        remainingDevice,
        { ...omittedDevice, stationId: 'P0003', deviceCode: 'P0003/01' },
      ],
    });
    // A prior request owns a separate snapshot for the same station.
    fixture.execute(
      'UPDATE cems_wpms_measurement_points SET point_code = ? WHERE request_id = 102',
      ['P0002'],
    );
    fixture.execute(
      'INSERT INTO device_connection_configs (request_id, source_request_id, station_id, device_code, protocol, settings_json) VALUES (?, ?, ?, ?, ?, ?)',
      [102, 102, 'P0002', 'P0002/03', 'DCON_ASCII', '{}'],
    );

    await save(remainingDevice);

    expect((await load()).rawConfigs.device).toEqual([
      expect.objectContaining({ deviceCode: 'P0002/01' }),
    ]);
    expect((await load('P0003')).rawConfigs.device).toEqual([
      expect.objectContaining({ deviceCode: 'P0003/01' }),
    ]);
    expect((await load('P0002', 102)).rawConfigs.device).toEqual([
      expect.objectContaining({ deviceCode: 'P0002/03' }),
    ]);
    const otherStation = await request(app)
      .get('/api/v1/integrations/device-configs/P0003')
      .set('X-API-Key', 'device-replacement-fixture-key');
    expect(otherStation.status).toBe(200);
    expect(otherStation.body.data.deviceConfigs).toEqual([
      expect.objectContaining({ deviceCode: 'P0003/01' }),
    ]);
  });

  it.each([
    ['invalid station', { configs: [remainingDevice, { ...omittedDevice, stationId: 'P9999' }] }],
    ['duplicate identity', { configs: [remainingDevice, remainingDevice] }],
    ['empty batch', { configs: [] }],
    ['empty form', { config: { stationId: 'P0002', device: [], channels: [] } }],
    ['invalid protocol', { ...remainingDevice, protocol: 'UNKNOWN' }],
  ])('rejects %s without removing any saved device', async (_name, body) => {
    await save({ configs: [omittedDevice, remainingDevice] });
    const before = await load();
    const rejected = await request(app).post(endpoint).auth(token, { type: 'bearer' }).send(body);
    expect(rejected.status).toBe(400);
    expect((await load()).rawConfigs).toEqual(before.rawConfigs);
  });

  it('replaces both submitted stations in one batch without dropping the retained devices', async () => {
    fixture.execute(
      'INSERT INTO cems_wpms_measurement_points (id, request_id, point_code, point_name, point_type, parameters_json) VALUES (?, ?, ?, ?, ?, ?)',
      [203, 10093, 'P0003', 'จุดอื่นในคำขอ', 'WASTEWATER', '[]'],
    );
    const otherDevices = ['P0003/01', 'P0003/02'].map((deviceCode) => ({
      ...omittedDevice,
      stationId: 'P0003',
      deviceCode,
    }));
    await save({ configs: [omittedDevice, remainingDevice, ...otherDevices] });

    await save({ configs: [remainingDevice, otherDevices[1]] });

    expect((await load()).rawConfigs.device).toEqual([
      expect.objectContaining({ deviceCode: 'P0002/01' }),
    ]);
    expect((await load('P0003')).rawConfigs.device).toEqual([
      expect.objectContaining({ deviceCode: 'P0003/02' }),
    ]);
  });

  it('rolls back removal when saving the current copy fails after the request snapshot was inserted', async () => {
    await save({ configs: [omittedDevice, remainingDevice] });
    const before = await load();
    fixture.execute(`
      CREATE TRIGGER reject_current_config BEFORE INSERT ON device_connection_configs
      WHEN NEW.request_id IS NULL
      BEGIN
        SELECT RAISE(ABORT, 'Simulated current-config write failure');
      END;
    `);

    const rejected = await request(app)
      .post(endpoint)
      .auth(token, { type: 'bearer' })
      .send(remainingDevice);

    expect(rejected.status).toBe(500);
    expect((await load()).rawConfigs).toEqual(before.rawConfigs);
    const worker = await request(app)
      .get('/api/v1/integrations/device-configs/P0002')
      .set('X-API-Key', 'device-replacement-fixture-key');
    expect(worker.status).toBe(200);
    expect(
      worker.body.data.deviceConfigs.map((device: { deviceCode: string }) => device.deviceCode),
    ).toEqual(expect.arrayContaining(['P0002/01', 'P0002/02']));
    expect(worker.body.data.deviceConfigs).toHaveLength(2);
  });

  it('requires authentication, edit scope and WAITING_CONNECTION before replacing devices', async () => {
    await save({ configs: [omittedDevice, remainingDevice] });
    const before = await load();
    expect((await request(app).post(endpoint).send(remainingDevice)).status).toBe(401);
    const viewOnly = signTestAccessToken({
      sub: '42',
      userType: 'officer',
      roles: ['monitoring_kpm'],
      scopes: { 'cems_wpms_requests:view': 'ALL' },
    });
    expect(
      (await request(app).post(endpoint).auth(viewOnly, { type: 'bearer' }).send(remainingDevice))
        .status,
    ).toBe(403);
    const outside = signTestAccessToken({
      sub: '43',
      userType: 'officer',
      roles: ['monitoring_kpm'],
      scopes: { 'cems_wpms_requests:edit': 'IN_PROVINCE' },
      scopeDetails: {
        'cems_wpms_requests:edit': { scope: 'IN_PROVINCE', province: 'เชียงใหม่' },
      },
    });
    expect(
      (await request(app).post(endpoint).auth(outside, { type: 'bearer' }).send(remainingDevice))
        .status,
    ).toBe(403);
    fixture.execute('UPDATE cems_wpms_connection_requests SET status = ? WHERE id = 10093', [
      'CONNECTION_CONFIRMED',
    ]);
    expect(
      (await request(app).post(endpoint).auth(token, { type: 'bearer' }).send(remainingDevice))
        .status,
    ).toBe(400);
    expect((await load()).rawConfigs).toEqual(before.rawConfigs);
  });
});
