import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { createApp } from '../../src/app';
import { createDeviceConfigApiFixture } from '../helpers/device-config-api-fixture';
import { signTestAccessToken } from '../helpers/live-authorization-fixture';

const serialSettings = {
  comPort: 'COM1',
  slaveId: 1,
  baudRate: 9600,
  parity: 'NONE',
  stopBits: 1,
  dataBits: 8,
  quantity: 2,
  valueRange: { min: 0, max: null },
};
const contexts = [
  { name: 'request', path: '/api/v1/cems-wpms-requests/101/device-configs', stationId: 'S2001' },
  {
    name: 'connected point',
    path: '/api/v1/connected-measurement-points/S2002/device-configs',
    stationId: 'S2002',
  },
];

describe('device protocol settings through POST and GET', () => {
  let fixture: Awaited<ReturnType<typeof createDeviceConfigApiFixture>>;
  let token: string;

  beforeEach(async () => {
    fixture = await createDeviceConfigApiFixture();
    token = signTestAccessToken({
      sub: '42',
      userType: 'officer',
      roles: ['monitoring_kpm'],
      scopes: { 'cems_wpms_requests:view': 'ALL', 'cems_wpms_requests:edit': 'ALL' },
    });
  });
  afterEach(() => {
    fixture?.close();
    jest.restoreAllMocks();
  });

  it.each(contexts)('roundtrips Serial ASCII settings for $name', async ({ path, stationId }) => {
    const app = createApp();
    const saved = await request(app)
      .post(path)
      .auth(token, { type: 'bearer' })
      .send({
        stationId,
        deviceCode: `${stationId}/01`,
        protocol: 'SERIAL_ASCII',
        settings: serialSettings,
        channels: [{ dataType: 'CO (ppm)', addressId: 0, offset: 0 }],
      });
    expect({ status: saved.status, body: saved.body }).toMatchObject({
      status: 201,
      body: { success: true },
    });

    const loaded = await request(app)
      .get(path)
      .query({ stationId })
      .auth(token, { type: 'bearer' });
    expect(loaded.status).toBe(200);
    expect(loaded.body.data.connectionForms).toEqual([
      expect.objectContaining({
        type: 'Serial ASCII',
        protocol: 'SERIAL_ASCII',
        deviceCode: `${stationId}/01`,
        values: expect.objectContaining({
          comport: 'COM1',
          slaveId: '1',
          quantity: '2',
          measureMin: '0',
          measureMax: '',
        }),
      }),
    ]);
    expect(loaded.body.data.rawConfigs.device).toEqual([
      expect.objectContaining({ protocol: 'SERIAL_ASCII', settings: serialSettings }),
    ]);
    expect(loaded.body.data.parameterMappings).toEqual([
      expect.objectContaining({ parameter: 'CO (ppm)', addressId: '0', offset: '0' }),
    ]);
  });

  describe.each(['MODBUS_RTU', 'MODBUS_TCP'])('%s read functions', (protocol) => {
    it.each(contexts)('roundtrips both read functions for $name', async ({ path, stationId }) => {
      const app = createApp();
      for (const readFunction of ['READ_INPUT', 'READ_HOLDING']) {
        const settings = {
          ...(protocol === 'MODBUS_RTU'
            ? serialSettings
            : { hostIp: '192.0.2.1', slaveId: 1, port: 502 }),
          readFunction,
        };
        const saved = await request(app)
          .post(path)
          .auth(token, { type: 'bearer' })
          .send({
            config: {
              stationId,
              device: [{ deviceCode: `${stationId}/01`, protocol, settings }],
              channels: [],
            },
          });
        expect({ status: saved.status, body: saved.body }).toMatchObject({
          status: 201,
          body: { success: true },
        });
        const loaded = await request(app)
          .get(path)
          .query({ stationId })
          .auth(token, { type: 'bearer' });
        expect(loaded.status).toBe(200);
        expect(loaded.body.data.connectionForms).toEqual([
          expect.objectContaining({ protocol, values: expect.objectContaining({ readFunction }) }),
        ]);
        expect(loaded.body.data.rawConfigs.device).toEqual([
          expect.objectContaining({ protocol, settings }),
        ]);
      }
    });

    it.each(contexts)(
      'rejects invalid read functions without replacing saved settings for $name',
      async ({ path, stationId }) => {
        const app = createApp();
        const valid = {
          stationId,
          deviceCode: `${stationId}/01`,
          protocol,
          settings: { readFunction: 'READ_INPUT' },
          channels: [],
        };
        const saved = await request(app).post(path).auth(token, { type: 'bearer' }).send(valid);
        expect(saved.status).toBe(201);

        for (const readFunction of ['READ_COILS', '', null, 1, {}, ['READ_INPUT']]) {
          const rejected = await request(app)
            .post(path)
            .auth(token, { type: 'bearer' })
            .send({
              ...valid,
              settings: { readFunction },
            });
          expect({ status: rejected.status, body: rejected.body }).toMatchObject({
            status: 400,
            body: { success: false, error: { code: 'VALIDATION_ERROR' } },
          });
        }
        const loaded = await request(app)
          .get(path)
          .query({ stationId })
          .auth(token, { type: 'bearer' });
        expect(loaded.body.data.rawConfigs.device).toEqual([
          expect.objectContaining({ settings: { readFunction: 'READ_INPUT' } }),
        ]);
      },
    );

    it.each(contexts)(
      'keeps an omitted function absent, including when clearing an old selection for $name',
      async ({ path, stationId }) => {
        const app = createApp();
        for (const settings of [{}, { readFunction: 'READ_HOLDING' }, {}]) {
          const saved = await request(app)
            .post(path)
            .auth(token, { type: 'bearer' })
            .send({
              stationId,
              deviceCode: `${stationId}/01`,
              protocol,
              settings,
              channels: [],
            });
          expect(saved.status).toBe(201);
          const loaded = await request(app)
            .get(path)
            .query({ stationId })
            .auth(token, { type: 'bearer' });
          expect(loaded.status).toBe(200);
          expect(loaded.body.data.rawConfigs.device[0].settings).toEqual(settings);
          if (!('readFunction' in settings)) {
            expect(loaded.body.data.connectionForms[0].values).not.toHaveProperty('readFunction');
          }
        }
      },
    );
  });

  it.each(contexts)(
    'roundtrips mixed protocols in batch and form wrapper for $name',
    async ({ path, stationId }) => {
      const app = createApp();
      const devices = [
        { deviceCode: `${stationId}/01`, protocol: 'SERIAL_ASCII', settings: serialSettings },
        {
          deviceCode: `${stationId}/02`,
          protocol: 'DCON_ASCII',
          settings: { comPort: 0, slaveId: null },
        },
        {
          deviceCode: `${stationId}/03`,
          protocol: 'MODBUS_RTU',
          settings: { readFunction: 'READ_INPUT' },
        },
        {
          deviceCode: `${stationId}/04`,
          protocol: 'MODBUS_TCP',
          settings: { readFunction: 'READ_HOLDING' },
        },
      ];
      for (const body of [
        { configs: devices.map((device) => ({ ...device, stationId, channels: [] })) },
        { config: { stationId, device: devices, channels: [] } },
      ]) {
        const saved = await request(app).post(path).auth(token, { type: 'bearer' }).send(body);
        expect(saved.status).toBe(201);
        const loaded = await request(app)
          .get(path)
          .query({ stationId })
          .auth(token, { type: 'bearer' });
        expect(loaded.status).toBe(200);
        expect(loaded.body.data.rawConfigs.device).toHaveLength(4);
        expect(loaded.body.data.rawConfigs.device).toEqual(expect.arrayContaining(devices));
        expect(loaded.body.data.connectionForms.map((form: { type: string }) => form.type)).toEqual(
          expect.arrayContaining(['Serial ASCII', 'DCON', 'Modbus RTU', 'Modbus TCP']),
        );
        for (const form of loaded.body.data.connectionForms.filter((form: { protocol: string }) =>
          ['DCON_ASCII', 'SERIAL_ASCII'].includes(form.protocol),
        )) {
          expect(form.values).not.toHaveProperty('readFunction');
        }
      }
    },
  );

  it.each(contexts)(
    'accepts empty Serial ASCII settings and preserves unrelated settings for $name',
    async ({ path, stationId }) => {
      const app = createApp();
      for (const settings of [
        undefined,
        null,
        { comPort: 0, slaveId: 0, valueRange: null, extension: 'legacy-compatible' },
      ]) {
        const saved = await request(app).post(path).auth(token, { type: 'bearer' }).send({
          stationId,
          protocol: 'SERIAL_ASCII',
          settings,
        });
        expect(saved.status).toBe(201);
        const loaded = await request(app)
          .get(path)
          .query({ stationId })
          .auth(token, { type: 'bearer' });
        expect(loaded.body.data.rawConfigs.device[0].settings).toEqual(settings ?? {});
      }
    },
  );

  it.each(contexts)(
    'requires authentication and edit permission for $name',
    async ({ path, stationId }) => {
      const app = createApp();
      const body = { stationId, protocol: 'SERIAL_ASCII', settings: serialSettings };
      expect((await request(app).post(path).send(body)).status).toBe(401);
      expect((await request(app).get(path)).status).toBe(401);
      const viewOnly = signTestAccessToken({
        sub: '42',
        userType: 'officer',
        roles: ['monitoring_kpm'],
        scopes: { 'cems_wpms_requests:view': 'ALL' },
      });
      expect(
        (await request(app).post(path).auth(viewOnly, { type: 'bearer' }).send(body)).status,
      ).toBe(403);
      const loaded = await request(app)
        .get(path)
        .query({ stationId })
        .auth(viewOnly, { type: 'bearer' });
      expect(loaded.status).toBe(200);
      expect(loaded.body.data.rawConfigs.device).toEqual([]);
    },
  );

  it.each(contexts)(
    'rejects malformed serial settings and unknown protocols for $name',
    async ({ path, stationId }) => {
      const app = createApp();
      for (const body of [
        { protocol: 'Serial ASCII', settings: serialSettings },
        { protocol: 'SERIAL_ASCII', settings: { slaveId: 'not-a-number' } },
        { protocol: 'SERIAL_ASCII', settings: { valueRange: { min: 'invalid' } } },
        {
          configs: [
            { stationId, protocol: 'SERIAL_ASCII', settings: serialSettings },
            { stationId, protocol: 'MODBUS_TCP', settings: { readFunction: 'invalid' } },
          ],
        },
        {
          config: {
            stationId,
            device: [{ protocol: 'MODBUS_RTU', settings: { readFunction: null } }],
          },
        },
      ]) {
        const rejected = await request(app)
          .post(path)
          .auth(token, { type: 'bearer' })
          .send('configs' in body || 'config' in body ? body : { stationId, ...body });
        expect(rejected.status).toBe(400);
        expect(rejected.body.error.code).toBe('VALIDATION_ERROR');
      }
      const loaded = await request(app)
        .get(path)
        .query({ stationId })
        .auth(token, { type: 'bearer' });
      expect(loaded.body.data.rawConfigs.device).toEqual([]);
    },
  );

  it.each(contexts)(
    'keeps station and location access checks for the new protocol for $name',
    async ({ path, stationId, name }) => {
      const app = createApp();
      const body = { stationId, protocol: 'SERIAL_ASCII', settings: serialSettings };
      const wrongStation = await request(app)
        .post(path)
        .auth(token, { type: 'bearer' })
        .send({ ...body, stationId: 'S9999' });
      expect(wrongStation.status).toBe(400);
      const outside = signTestAccessToken({
        sub: '43',
        userType: 'officer',
        roles: ['monitoring_kpm'],
        scopes: { 'cems_wpms_requests:edit': 'IN_PROVINCE' },
        scopeDetails: {
          'cems_wpms_requests:edit': { scope: 'IN_PROVINCE', province: 'เชียงใหม่' },
        },
      });
      const denied = await request(app).post(path).auth(outside, { type: 'bearer' }).send(body);
      expect(denied.status).toBe(name === 'request' ? 403 : 404);
      const loaded = await request(app)
        .get(path)
        .query({ stationId })
        .auth(token, { type: 'bearer' });
      expect(loaded.status).toBe(200);
      expect(loaded.body.data.rawConfigs.device).toEqual([]);
    },
  );

  it('preserves the request status restriction when saving Serial ASCII', async () => {
    fixture.execute(
      "UPDATE cems_wpms_connection_requests SET status = 'PENDING_DESIGN_REVIEW' WHERE id = 101",
    );
    const app = createApp();
    const rejected = await request(app)
      .post(contexts[0].path)
      .auth(token, { type: 'bearer' })
      .send({
        stationId: 'S2001',
        protocol: 'SERIAL_ASCII',
        settings: serialSettings,
      });
    expect(rejected.status).toBe(400);
    expect(rejected.body.error.code).toBe('BAD_REQUEST');
    const loaded = await request(app).get(contexts[0].path).auth(token, { type: 'bearer' });
    expect(loaded.body.data.rawConfigs.device).toEqual([]);
  });
});
