import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { createApp } from '../../src/app';
import { createDeviceConfigApiFixture } from '../helpers/device-config-api-fixture';
import { signTestAccessToken } from '../helpers/live-authorization-fixture';

const contexts = [
  { name: 'request', path: '/api/v1/cems-wpms-requests/101/device-configs', stationId: 'S2001' },
  {
    name: 'connected point',
    path: '/api/v1/connected-measurement-points/S2002/device-configs',
    stationId: 'S2002',
  },
];

describe.each(contexts)('Scale/Gain and TCP Quantity for $name', ({ name, path, stationId }) => {
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

  const deviceCode = `${stationId}/01`;
  const config = (channel: Record<string, unknown>, settings: Record<string, unknown> = {}) => ({
    stationId,
    deviceCode,
    protocol: 'MODBUS_TCP',
    settings,
    channels: [{ dataType: 'CO (ppm)', addressId: 0, offset: 0, ...channel }],
  });
  const payload = (channel: Record<string, unknown>, settings: Record<string, unknown> = {}) => {
    const input = config(channel, settings);
    return name === 'request'
      ? input
      : {
          config: {
            stationId,
            device: [{ deviceCode, protocol: input.protocol, settings }],
            channels: input.channels.map((row) => ({ deviceCode, ...row })),
          },
        };
  };

  it('preserves decimals, negatives and zero, then clears null and omitted values on save', async () => {
    const app = createApp();
    const cases = [
      { valueFormat: '16bit', scaleMin: -1.5, scaleMax: 100, gain: 0.25, quantity: 4 },
      { valueFormat: 'CURRENT', scaleMin: 0, scaleMax: 0, gain: 0, quantity: 0 },
      { valueFormat: 'VOLTAGE', scaleMin: null, scaleMax: null, gain: null, quantity: null },
      {
        valueFormat: 'MEASUREMENT_VALUE',
        scaleMin: -2.25,
        scaleMax: 50.5,
        gain: -0.5,
        quantity: 2,
      },
      { valueFormat: '16bit' },
    ];
    for (const { quantity, ...channel } of cases) {
      const settings = quantity === undefined ? {} : { quantity };
      const saved = await request(app)
        .post(path)
        .auth(token, { type: 'bearer' })
        .send(payload(channel, settings));
      expect({ status: saved.status, body: saved.body }).toMatchObject({
        status: 201,
        body: { success: true },
      });
      const expected = {
        deviceCode,
        valueFormat: channel.valueFormat,
        scaleMin: channel.scaleMin ?? null,
        scaleMax: channel.scaleMax ?? null,
        gain: channel.gain ?? null,
      };
      expect(saved.body.data.channels).toEqual([expect.objectContaining(expected)]);

      const loaded = await request(app)
        .get(path)
        .query({ stationId })
        .auth(token, { type: 'bearer' });
      expect(loaded.status).toBe(200);
      expect(loaded.body.data.rawConfigs.channels).toEqual([expect.objectContaining(expected)]);
      expect(loaded.body.data.parameterMappings).toEqual([
        expect.objectContaining({
          deviceCode,
          scaleMin: expected.scaleMin == null ? '' : String(expected.scaleMin),
          scaleMax: expected.scaleMax == null ? '' : String(expected.scaleMax),
          gain: expected.gain == null ? '' : String(expected.gain),
          offset: '0',
          ...(channel.valueFormat === '16bit' ? { valueFormat: '16bit' } : {}),
        }),
      ]);
      expect(loaded.body.data.connectionForms).toEqual([
        expect.objectContaining({
          values: expect.objectContaining({ quantity: quantity == null ? '' : String(quantity) }),
        }),
      ]);
      expect(loaded.body.data.rawConfigs.device[0].settings).toEqual(settings);
    }
  });

  it('keeps settings and channels associated with their devices in the form wrapper', async () => {
    const app = createApp();
    const devices = [
      { deviceCode, protocol: 'MODBUS_TCP', settings: { quantity: 4 } },
      { deviceCode: `${stationId}/02`, protocol: 'MODBUS_RTU', settings: { quantity: 2 } },
    ];
    const channels = [
      {
        deviceCode,
        dataType: 'CO (ppm)',
        valueFormat: '16bit',
        scaleMin: -1.5,
        scaleMax: 100,
        gain: 0.25,
      },
      {
        deviceCode: `${stationId}/02`,
        dataType: 'CO (ppm)',
        valueFormat: 'CURRENT',
        scaleMin: 0,
        scaleMax: 20,
        gain: 0,
      },
    ];
    const saved = await request(app)
      .post(path)
      .auth(token, { type: 'bearer' })
      .send({ config: { stationId, device: devices, channels } });
    expect({ status: saved.status, body: saved.body }).toMatchObject({ status: 201 });
    const loaded = await request(app)
      .get(path)
      .query({ stationId })
      .auth(token, { type: 'bearer' });
    expect(loaded.status).toBe(200);
    expect(loaded.body.data.rawConfigs.channels).toHaveLength(channels.length);
    expect(loaded.body.data.rawConfigs.channels).toEqual(
      expect.arrayContaining(channels.map((channel) => expect.objectContaining(channel))),
    );
    expect(loaded.body.data.rawConfigs.device).toHaveLength(devices.length);
    expect(loaded.body.data.rawConfigs.device).toEqual(expect.arrayContaining(devices));
  });

  it('rejects invalid channel and TCP quantity values before replacing stored configuration', async () => {
    const app = createApp();
    const saved = await request(app)
      .post(path)
      .auth(token, { type: 'bearer' })
      .send(
        payload(
          { valueFormat: '16bit', scaleMin: -1.5, scaleMax: 100, gain: 0.25 },
          { quantity: 4 },
        ),
      );
    expect(saved.status).toBe(201);
    const read = () => request(app).get(path).query({ stationId }).auth(token, { type: 'bearer' });
    const before = await read();
    for (const field of ['scaleMin', 'scaleMax', 'gain', 'quantity']) {
      for (const value of ['', '4', true, {}, []]) {
        const invalid =
          field === 'quantity' ? payload({}, { quantity: value }) : payload({ [field]: value });
        const response = await request(app)
          .post(path)
          .auth(token, { type: 'bearer' })
          .send(invalid);
        expect({
          field,
          value,
          status: response.status,
          code: response.body.error?.code,
        }).toMatchObject({
          status: 400,
          code: 'VALIDATION_ERROR',
        });
      }
    }
    const after = await read();
    expect(after.status).toBe(200);
    expect(after.body.data).toEqual(before.body.data);
  });

  it('preserves scaling in the configs[] batch form', async () => {
    const app = createApp();
    const saved = await request(app)
      .post(path)
      .auth(token, { type: 'bearer' })
      .send({
        configs: [
          config(
            { valueFormat: '16bit', scaleMin: 0, scaleMax: 100, gain: -0.25 },
            { quantity: 0 },
          ),
        ],
      });
    expect({ status: saved.status, body: saved.body }).toMatchObject({ status: 201 });
    const loaded = await request(app)
      .get(path)
      .query({ stationId })
      .auth(token, { type: 'bearer' });
    expect(loaded.status).toBe(200);
    expect(loaded.body.data.rawConfigs.channels[0]).toMatchObject({
      valueFormat: '16bit',
      scaleMin: 0,
      scaleMax: 100,
      gain: -0.25,
    });
  });
});
