import { describe, expect, it, jest } from '@jest/globals';
import type { DeviceConnectionConfigDTO } from '../../src/modules/device-connections/device-connections.types';
import { connectionRequestsRepository } from '../../src/modules/connection-requests/connection-requests.repository';
import { connectionRequestsService } from '../../src/modules/connection-requests/connection-requests.service';
import type { ConnectionRequestDTO } from '../../src/modules/connection-requests/connection-requests.types';
import { deviceConnectionsService } from '../../src/modules/device-connections/device-connections.service';

jest.mock('../../src/modules/connection-requests/connection-requests.repository', () => ({
  connectionRequestsRepository: { findByIdForReadAccess: jest.fn() },
}));
jest.mock('../../src/modules/device-connections/device-connections.service', () => ({
  deviceConnectionsService: { listByRequestId: jest.fn() },
}));

const request = {
  id: 10195,
  requestNo: 'CEMS-0121/2569',
  measurementPoints: [{ pointCode: 'S2014', pointName: 'Stack', parameters: ['CO (ppm)'] }],
} as ConnectionRequestDTO;

function config(overrides: Partial<DeviceConnectionConfigDTO> = {}): DeviceConnectionConfigDTO {
  return {
    id: 274,
    requestId: 10195,
    stationId: 'S2014',
    deviceCode: 'S2014/01',
    protocol: 'MSSQL',
    settings: {},
    channels: [{ dataType: 'CO (ppm)', addressId: 3, offset: 0 }],
    statusManagement: null,
    createdBy: 1,
    createdAt: '2026-10-21T15:38:34.000Z',
    updatedAt: '2026-10-21T15:38:34.000Z',
    ...overrides,
  };
}

async function form(
  configs: DeviceConnectionConfigDTO[],
  requestOverrides: Partial<ConnectionRequestDTO> = {},
) {
  jest
    .mocked(connectionRequestsRepository.findByIdForReadAccess)
    .mockResolvedValue({ ...request, ...requestOverrides });
  jest.mocked(deviceConnectionsService.listByRequestId).mockResolvedValue(configs);
  return connectionRequestsService.getDeviceConfigFormDetail(10195, 'S2014', 1, 'ALL');
}

describe('duplicate device config form recovery', () => {
  it('does not prefer a conflicting duplicate because it has a retired test flag', async () => {
    const result = await form([
      config({
        channels: [
          { dataType: 'CO (ppm)', addressId: 3, offset: 0, status: 'Normal' },
          { dataType: 'CO (ppm)', addressId: 3, offset: 0, status: 'Calibration', testMode: true },
        ],
      }),
    ]);

    expect(result.parameterMappings).toEqual([
      expect.objectContaining({ parameter: 'CO (ppm)', status: 'Normal', testMode: false }),
    ]);
  });

  it('keeps a populated case variant when request instrument parameters constrain the form', async () => {
    const result = await form(
      [
        config({
          channels: [
            { dataType: 'CO (ppm)', addressId: null, offset: null },
            { dataType: ' co (PPM) ', addressId: 3, offset: 0 },
            { dataType: 'CO (%)', addressId: 4, offset: 0 },
          ],
        }),
      ],
      {
        measurementPoints: [
          {
            ...request.measurementPoints[0],
            measurementInstruments: {
              parameters: [{ parameter: 'CO (ppm)' }],
            },
          },
        ],
      },
    );
    expect(result.parameterMappings).toEqual([
      expect.objectContaining({ parameter: 'CO (ppm)', addressId: '3' }),
    ]);
    expect(result.rawConfigs.channels).toHaveLength(1);
    expect(result.rawConfigs.channels[0]).toMatchObject({ dataType: 'CO (ppm)', addressId: 3 });
  });

  it.each(['CO  (ppm)', 'ＣＯ (ｐｐｍ)', ' ＣＯ  (ｐｐｍ) '])(
    'matches canonical request instrument labels before deduplicating %s',
    async (dataType) => {
      const result = await form(
        [
          config({
            channels: [
              { dataType: 'CO (ppm)', addressId: null, offset: null },
              { dataType, addressId: 3, offset: 0 },
              { dataType: 'CO (%)', addressId: 4, offset: 0 },
            ],
          }),
        ],
        {
          measurementPoints: [
            {
              ...request.measurementPoints[0],
              measurementInstruments: { parameters: [{ parameter: 'CO (ppm)' }] },
            },
          ],
        },
      );

      expect(result.rawConfigs.channels).toEqual([
        expect.objectContaining({ dataType: 'CO (ppm)', addressId: 3 }),
      ]);
      expect(result.parameterMappings).toEqual([
        expect.objectContaining({ parameter: 'CO (ppm)', addressId: '3' }),
      ]);
    },
  );

  it.each(['CO  (ppm)', 'ＣＯ (ｐｐｍ)', ' ＣＯ  (ｐｐｍ) '])(
    'deduplicates canonical legacy channels while retaining different units (%s)',
    async (dataType) => {
      const result = await form([
        config({
          channels: [
            { dataType: 'CO (ppm)', addressId: null, offset: null },
            { dataType, addressId: 3, offset: 0 },
            { dataType: 'CO (%)', addressId: 4, offset: 0 },
          ],
        }),
      ]);

      expect(result.rawConfigs.channels).toEqual([
        expect.objectContaining({ dataType, addressId: 3 }),
        expect.objectContaining({ dataType: 'CO (%)', addressId: 4 }),
      ]);
      expect(result.parameterMappings).toHaveLength(2);
    },
  );

  it.each([false, true])(
    'selects the latest named device across protocols (reverse=%s)',
    async (reverse) => {
      const older = config({ id: 266, protocol: 'MYSQL', updatedAt: '2026-10-21T15:24:49.000Z' });
      const latest = config({
        channels: [
          { dataType: 'CO (ppm)', addressId: null, offset: null },
          { dataType: 'CO (ppm)', addressId: 3, offset: 0, testMode: true, status: 'Calibration' },
          { dataType: 'CO (ppm)', addressId: null, offset: null },
        ],
      });
      const configs = reverse ? [latest, older] : [older, latest];
      const original = JSON.stringify(configs);
      const result = await form(configs);
      expect(result.connectionForms.map((row) => row.configId)).toEqual([274]);
      expect(result.deviceCodeOptions).toEqual(['S2014/01']);
      expect(result.parameterMappings).toEqual([
        expect.objectContaining({
          configId: 274,
          parameter: 'CO (ppm)',
          addressId: '3',
          testMode: false,
          status: 'Calibration',
        }),
      ]);
      expect(result.rawConfigs.device).toHaveLength(1);
      expect(result.rawConfigs.channels).toEqual([
        expect.objectContaining({
          dataType: 'CO (ppm)',
          addressId: 3,
          offset: 0,
          testMode: false,
        }),
      ]);
      expect(JSON.stringify(configs)).toBe(original);
    },
  );

  it('uses config id to break equal timestamps without falling back to older channels', async () => {
    const result = await form([config({ id: 275, channels: [] }), config()]);
    expect(result.connectionForms.map((row) => row.configId)).toEqual([275]);
    expect(result.rawConfigs.channels).toEqual([]);
  });

  it('keeps different devices, units, and unnamed legacy protocols separate', async () => {
    const result = await form([
      config({
        channels: [
          { dataType: 'CO (ppm)', addressId: 3, offset: 0 },
          { dataType: 'CO (%)', addressId: 3, offset: 0 },
        ],
      }),
      config({ id: 276, deviceCode: 'S2014/02' }),
      config({ id: 277, deviceCode: null, protocol: 'MYSQL' }),
      config({ id: 278, deviceCode: null, protocol: 'MSSQL' }),
      config({ id: 279, stationId: 'S2015' }),
    ]);
    expect(result.connectionForms).toHaveLength(4);
    expect(result.parameterMappings).toHaveLength(5);
    expect(result.rawConfigs.channels).toHaveLength(5);
  });

  it('prefers populated fields, retains zero, and never combines conflicting rows', async () => {
    const result = await form([
      config({
        channels: [
          { dataType: 'CO (ppm)', addressId: null, offset: null },
          {
            dataType: ' co (PPM) ',
            addressId: 0,
            offset: 0,
            alertHigh: 0,
            valueRange: { min: 0, max: null },
          },
          {
            dataType: 'CO (ppm)',
            addressId: 9,
            offset: 5,
            alertHigh: 6,
            valueRange: { min: 3, max: null },
          },
        ],
      }),
    ]);
    expect(result.rawConfigs.channels).toHaveLength(1);
    expect(result.rawConfigs.channels[0]).toMatchObject({
      addressId: 0,
      offset: 0,
      alertHigh: 0,
      valueRange: { min: 0, max: null },
    });
  });
});
