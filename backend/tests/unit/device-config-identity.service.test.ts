import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { deviceConnectionsRepository } from '../../src/modules/device-connections/device-connections.repository';
import { deviceConnectionsService } from '../../src/modules/device-connections/device-connections.service';
import type { CreateDeviceConnectionConfigInput } from '../../src/modules/device-connections/device-connections.types';

jest.mock('../../src/modules/device-connections/device-connections.repository', () => ({
  deviceConnectionsRepository: {
    replaceManyActive: jest.fn(),
    replaceManyActiveForStation: jest.fn(),
    replaceManyForRequestAndActiveSettings: jest.fn(),
    listActiveForIntegration: jest.fn(),
  },
}));

const input: CreateDeviceConnectionConfigInput = {
  stationId: 'S2014',
  deviceCode: 'S2014/01',
  protocol: 'MSSQL',
  settings: {},
  channels: [],
};
const saves = [
  (inputs: CreateDeviceConnectionConfigInput[]) => deviceConnectionsService.createMany(inputs, 1),
  (inputs: CreateDeviceConnectionConfigInput[]) =>
    deviceConnectionsService.createManyForRequest(inputs, 1, 10195),
  (inputs: CreateDeviceConnectionConfigInput[]) =>
    deviceConnectionsService.replaceCurrentStation('S2014', inputs, 1),
];

describe('named device identity validation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it.each(saves)('rejects one named device with two protocols before saving (%#)', async (save) => {
    await expect(save([input, { ...input, protocol: 'MYSQL' }])).rejects.toMatchObject({
      code: 'BAD_REQUEST',
      statusCode: 400,
    });
    expect(deviceConnectionsRepository.replaceManyActive).not.toHaveBeenCalled();
    expect(deviceConnectionsRepository.replaceManyActiveForStation).not.toHaveBeenCalled();
    expect(
      deviceConnectionsRepository.replaceManyForRequestAndActiveSettings,
    ).not.toHaveBeenCalled();
  });

  it.each(saves)(
    'preserves distinct named devices and unnamed legacy protocols (%#)',
    async (save) => {
      await save([
        input,
        { ...input, deviceCode: 'S2014/02', protocol: 'MYSQL' },
        { ...input, deviceCode: null },
        { ...input, deviceCode: null, protocol: 'MYSQL' },
      ]);
    },
  );

  it('does not reuse a masked password from another protocol', async () => {
    jest.mocked(deviceConnectionsRepository.listActiveForIntegration).mockResolvedValue([
      {
        ...input,
        id: 266,
        requestId: null,
        protocol: 'MYSQL',
        settings: { dbPass: 'stored-test-password' },
        statusManagement: null,
        createdBy: 1,
        createdAt: '',
        updatedAt: '',
      },
    ]);
    await expect(
      deviceConnectionsService.createMany([{ ...input, settings: { dbPass: '********' } }], 1),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
    expect(deviceConnectionsRepository.replaceManyActive).not.toHaveBeenCalled();
  });
});
