import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { createApp } from '../../src/app';
import { createDeviceConfigApiFixture } from '../helpers/device-config-api-fixture';
import { signTestAccessToken } from '../helpers/live-authorization-fixture';

const contexts = [
  { path: '/api/v1/cems-wpms-requests/101/device-configs', stationId: 'S2001' },
  { path: '/api/v1/connected-measurement-points/S2002/device-configs', stationId: 'S2002' },
];
const protocols = [
  {
    protocol: 'MODBUS_TCP',
    settings: { quantity: 0, readFunction: 'READ_HOLDING' },
    readFunction: 'READ_HOLDING',
    comPort: null,
  },
  {
    protocol: 'MODBUS_RTU',
    settings: { comPort: 'COM3', quantity: 2, readFunction: 'READ_INPUT' },
    readFunction: 'READ_INPUT',
    comPort: 'COM3',
  },
  { protocol: 'DCON_ASCII', settings: { comPort: 0, quantity: 2 }, readFunction: null, comPort: 0 },
  {
    protocol: 'SERIAL_ASCII',
    settings: { comPort: 'COM7', quantity: 2, slaveId: 7 },
    readFunction: null,
    comPort: 'COM7',
  },
];

describe('saved device settings exposed to the external Worker', () => {
  let fixture: Awaited<ReturnType<typeof createDeviceConfigApiFixture>>;
  let token: string;
  const previousKey = process.env.DEVICE_CONFIG_API_KEYS;

  beforeEach(async () => {
    fixture = await createDeviceConfigApiFixture();
    process.env.DEVICE_CONFIG_API_KEYS = 'fixture-worker-key';
    token = signTestAccessToken({
      sub: '42',
      userType: 'officer',
      roles: ['monitoring_kpm'],
      scopes: { 'cems_wpms_requests:view': 'ALL', 'cems_wpms_requests:edit': 'ALL' },
    });
  });

  afterEach(() => {
    fixture?.close();
    if (previousKey === undefined) delete process.env.DEVICE_CONFIG_API_KEYS;
    else process.env.DEVICE_CONFIG_API_KEYS = previousKey;
    jest.restoreAllMocks();
  });

  it.each(contexts)(
    'roundtrips all transport settings and scaling from $path',
    async ({ path, stationId }) => {
      const app = createApp();
      for (const { protocol, settings, readFunction, comPort } of protocols) {
        const channel = {
          dataType: 'CO (ppm)',
          valueFormat: '16bit',
          addressId: 0,
          scaleMin: -1.5,
          scaleMax: 100,
          gain: 0,
          offset: 0,
          testMode: true,
        };
        const saved = await request(app)
          .post(path)
          .auth(token, { type: 'bearer' })
          .send({
            stationId,
            deviceCode: `${stationId}/01`,
            protocol,
            settings,
            channels: [channel],
          });
        expect({ status: saved.status, body: saved.body }).toMatchObject({ status: 201 });
        const response = await request(app)
          .get(`/api/v1/integrations/device-configs/${stationId}`)
          .set('X-API-Key', 'fixture-worker-key');
        expect({ status: response.status, body: response.body }).toMatchObject({
          status: 200,
          body: {
            success: true,
            data: {
              stationId,
              deviceConfigs: [
                {
                  deviceCode: `${stationId}/01`,
                  protocol,
                  quantity: settings.quantity,
                  readFunction,
                  comPort,
                },
              ],
              parameterConfigs: [
                {
                  deviceCode: `${stationId}/01`,
                  parameter: 'CO (ppm)',
                  valueFormat: '16bit',
                  scaleMin: -1.5,
                  scaleMax: 100,
                  gain: 0,
                  testMode: false,
                  offset: 0,
                },
              ],
            },
          },
        });
        expect(response.headers['cache-control']).toBe('no-store');
      }
    },
  );

  it('returns nulls for legacy omitted fields and preserves decimals on every value format', async () => {
    const app = createApp();
    for (const valueFormat of ['MEASUREMENT_VALUE', 'CURRENT', 'VOLTAGE', '16bit']) {
      for (const scaling of [{}, { scaleMin: 0, scaleMax: 50.5, gain: -0.25 }]) {
        const saved = await request(app)
          .post(contexts[0].path)
          .auth(token, { type: 'bearer' })
          .send({
            stationId: 'S2001',
            deviceCode: 'S2001/01',
            protocol: 'MODBUS_TCP',
            channels: [{ dataType: 'CO (ppm)', valueFormat, ...scaling }],
          });
        expect(saved.status).toBe(201);
        const response = await request(app)
          .get('/api/v1/integrations/device-configs/S2001')
          .set('X-API-Key', 'fixture-worker-key');
        expect(response.status).toBe(200);
        expect(response.body.data.deviceConfigs[0]).toMatchObject({
          quantity: null,
          readFunction: null,
        });
        expect(response.body.data.parameterConfigs[0]).toMatchObject({
          valueFormat,
          scaleMin: scaling.scaleMin ?? null,
          scaleMax: scaling.scaleMax ?? null,
          gain: scaling.gain ?? null,
        });
      }
    }
  });
});
