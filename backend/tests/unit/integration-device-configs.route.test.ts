import request from 'supertest';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('../../src/modules/integrations/integration-device-configs.service', () => ({
  integrationDeviceConfigsService: {
    getByStationId: jest.fn(),
  },
}));

import { createApp } from '../../src/app';
import { integrationDeviceConfigsService } from '../../src/modules/integrations/integration-device-configs.service';

const mockedIntegrationDeviceConfigsService = jest.mocked(integrationDeviceConfigsService);

describe('integration device configs route', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.INTEGRATION_API_KEYS = 'test-integration-key';
    process.env.DEVICE_CONFIG_API_KEYS = '';
    process.env.ALERT_EVENT_API_KEYS = '';
    mockedIntegrationDeviceConfigsService.getByStationId.mockResolvedValue({
      stationId: 'S0002',
      deviceConfigs: [
        {
          deviceCode: 'S0002/01',
          protocol: 'MODBUS_TCP',
          hostIp: '127.0.0.1',
          port: 1,
          slaveId: 1,
          comPort: null,
          baudRate: null,
          parity: null,
          stopBits: null,
          dataBits: null,
          quantity: null,
          dbUser: null,
          dbPass: null,
          dbName: null,
          deviceValueRangeMin: null,
          deviceValueRangeMax: null,
        },
      ],
      parameterConfigs: [
        {
          deviceCode: 'S0002/01',
          addressId: 40001,
          parameter: 'NOx (ppm)',
          parameterName: 'NOx',
          parameterUnit: 'ppm',
          valueRange: { min: 0, max: 200 },
          valueFormat: 'MEASUREMENT_VALUE',
          offset: 0,
          encoding: 'UNSIGNED16_BIG_ENDIAN',
          standardCriteria: 120,
          eiaCriteria: null,
          status: 'Normal',
        },
      ],
      statusSchedules: [
        {
          parameter: 'NOx (ppm)',
          startAt: '2026-06-13T00:00:00+07:00',
          endAt: '2026-06-13T06:00:00+07:00',
          status: 'Calibration',
        },
      ],
    });
  });

  it('returns flat integration device config groups with a valid API key', async () => {
    const app = createApp();

    const response = await request(app)
      .get('/api/v1/integrations/device-configs/S0002')
      .set('X-API-Key', 'test-integration-key');

    expect(response.status).toBe(200);
    expect(mockedIntegrationDeviceConfigsService.getByStationId).toHaveBeenCalledWith('S0002');
    expect(response.body).toMatchObject({
      success: true,
      data: {
        stationId: 'S0002',
        deviceConfigs: [{ deviceCode: 'S0002/01', protocol: 'MODBUS_TCP' }],
        parameterConfigs: [
          {
            parameter: 'NOx (ppm)',
            parameterName: 'NOx',
            parameterUnit: 'ppm',
            standardCriteria: 120,
          },
        ],
        statusSchedules: [{ parameter: 'NOx (ppm)', status: 'Calibration' }],
      },
    });
  });

  it('rejects missing API keys', async () => {
    const app = createApp();

    const response = await request(app).get('/api/v1/integrations/device-configs/S0002');

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe('UNAUTHORIZED');
    expect(mockedIntegrationDeviceConfigsService.getByStationId).not.toHaveBeenCalled();
  });

  it('rejects invalid API keys', async () => {
    const app = createApp();

    const response = await request(app)
      .get('/api/v1/integrations/device-configs/S0002')
      .set('X-API-Key', 'wrong-key');

    expect(response.status).toBe(401);
    expect(mockedIntegrationDeviceConfigsService.getByStationId).not.toHaveBeenCalled();
  });

  it('accepts device config scoped API keys', async () => {
    process.env.INTEGRATION_API_KEYS = '';
    process.env.DEVICE_CONFIG_API_KEYS = 'device-config-key';
    process.env.ALERT_EVENT_API_KEYS = 'alert-event-key';
    const app = createApp();

    const response = await request(app)
      .get('/api/v1/integrations/device-configs/S0002')
      .set('X-API-Key', 'device-config-key');

    expect(response.status).toBe(200);
    expect(mockedIntegrationDeviceConfigsService.getByStationId).toHaveBeenCalledWith('S0002');
  });

  it('rejects alert event scoped API keys for device config endpoints', async () => {
    process.env.INTEGRATION_API_KEYS = '';
    process.env.DEVICE_CONFIG_API_KEYS = 'device-config-key';
    process.env.ALERT_EVENT_API_KEYS = 'alert-event-key';
    const app = createApp();

    const response = await request(app)
      .get('/api/v1/integrations/device-configs/S0002')
      .set('X-API-Key', 'alert-event-key');

    expect(response.status).toBe(401);
    expect(mockedIntegrationDeviceConfigsService.getByStationId).not.toHaveBeenCalled();
  });

  it('rejects unsafe station ids', async () => {
    const app = createApp();

    const response = await request(app)
      .get('/api/v1/integrations/device-configs/S0002%3Bdrop')
      .set('X-API-Key', 'test-integration-key');

    expect(response.status).toBe(400);
    expect(mockedIntegrationDeviceConfigsService.getByStationId).not.toHaveBeenCalled();
  });
});
