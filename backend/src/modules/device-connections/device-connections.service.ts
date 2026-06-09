import { BadRequestError, NotFoundError } from '../../shared/errors/AppError';
import {
  findMockDeviceConnectionConfig,
  getMockDeviceConnectionConfigs,
} from './device-connections.mock-source';
import { deviceConnectionsRepository } from './device-connections.repository';
import {
  DEVICE_CONNECTION_PROTOCOL,
  type CreateDeviceConnectionConfigInput,
  type DeviceConnectionConfigDTO,
  type DeviceConnectionTestResultDTO,
  type ListDeviceConnectionConfigsQuery,
  type TestDeviceConnectionInput,
} from './device-connections.types';

let nowProvider = () => new Date();

export const deviceConnectionsService = {
  setClockForTests(provider: () => Date): void {
    nowProvider = provider;
  },

  async list(query: ListDeviceConnectionConfigsQuery): Promise<DeviceConnectionConfigDTO[]> {
    const configs = await deviceConnectionsRepository.list(query);
    if (configs.length > 0) return configs;

    const mockConfigs = getMockDeviceConnectionConfigs(query.stationId ?? '');
    return query.protocol
      ? mockConfigs.filter((config) => config.protocol === query.protocol)
      : mockConfigs;
  },

  listActiveSettings(
    query: ListDeviceConnectionConfigsQuery,
  ): Promise<DeviceConnectionConfigDTO[]> {
    return deviceConnectionsRepository.list(query);
  },

  async getById(id: number): Promise<DeviceConnectionConfigDTO> {
    const config = await deviceConnectionsRepository.findById(id);
    if (config) return config;

    const mockConfig = findMockDeviceConnectionConfig(id);
    if (mockConfig) return mockConfig;

    throw new NotFoundError('Device connection config not found');
  },

  listByRequestId(requestId: number): Promise<DeviceConnectionConfigDTO[]> {
    return deviceConnectionsRepository.listByRequestId(requestId);
  },

  async create(
    input: CreateDeviceConnectionConfigInput,
    actorUserId: number,
  ): Promise<DeviceConnectionConfigDTO> {
    ensureChannelAddressesAreUnique(input);
    return deviceConnectionsRepository.replaceActive(input, actorUserId);
  },

  async createMany(
    inputs: CreateDeviceConnectionConfigInput[],
    actorUserId: number,
  ): Promise<DeviceConnectionConfigDTO[]> {
    ensureBatchDeviceKeysAreUnique(inputs);
    for (const input of inputs) {
      ensureChannelAddressesAreUnique(input);
    }
    return deviceConnectionsRepository.replaceManyActive(inputs, actorUserId);
  },

  async replaceCurrentStation(
    stationId: string,
    inputs: CreateDeviceConnectionConfigInput[],
    actorUserId: number,
  ): Promise<DeviceConnectionConfigDTO[]> {
    ensureBatchDeviceKeysAreUnique(inputs);
    for (const input of inputs) {
      ensureChannelAddressesAreUnique(input);
    }
    return deviceConnectionsRepository.replaceManyActiveForStation(stationId, inputs, actorUserId);
  },

  async createForRequest(
    input: CreateDeviceConnectionConfigInput,
    actorUserId: number,
    requestId: number,
  ): Promise<DeviceConnectionConfigDTO> {
    ensureChannelAddressesAreUnique(input);
    const [saved] = await deviceConnectionsRepository.replaceManyForRequestAndActiveSettings(
      [input],
      actorUserId,
      requestId,
    );
    return saved;
  },

  async createManyForRequest(
    inputs: CreateDeviceConnectionConfigInput[],
    actorUserId: number,
    requestId: number,
  ): Promise<DeviceConnectionConfigDTO[]> {
    ensureBatchDeviceKeysAreUnique(inputs);
    for (const input of inputs) {
      ensureChannelAddressesAreUnique(input);
    }
    return deviceConnectionsRepository.replaceManyForRequestAndActiveSettings(
      inputs,
      actorUserId,
      requestId,
    );
  },

  async testConnection(input: TestDeviceConnectionInput): Promise<DeviceConnectionTestResultDTO> {
    ensureChannelAddressesAreUnique(input);
    return {
      success: true,
      mode: 'MOCK',
      protocol: input.protocol,
      stationId: input.stationId,
      message: 'Mock connection succeeded',
      checkedAt: nowProvider().toISOString(),
      details: {
        endpoint: describeEndpoint(input),
        channelCount: input.channels.length,
      },
    };
  },
};

function ensureChannelAddressesAreUnique(input: TestDeviceConnectionInput): void {
  const seen = new Set<number>();
  const duplicates = input.channels
    .map((channel) => channel.addressId)
    .filter((addressId) => {
      if (seen.has(addressId)) return true;
      seen.add(addressId);
      return false;
    });

  if (duplicates.length > 0) {
    throw new BadRequestError('Channel addressId must be unique per connection config', {
      addressIds: Array.from(new Set(duplicates)),
    });
  }
}

function ensureBatchDeviceKeysAreUnique(inputs: CreateDeviceConnectionConfigInput[]): void {
  const seen = new Set<string>();
  const duplicates: Array<{
    stationId: string;
    protocol: string;
    deviceCode: string | null;
  }> = [];

  for (const input of inputs) {
    const deviceCode = input.deviceCode ?? null;
    const key = `${input.stationId}\u0000${input.protocol}\u0000${deviceCode ?? ''}`;
    if (seen.has(key)) {
      duplicates.push({
        stationId: input.stationId,
        protocol: input.protocol,
        deviceCode,
      });
    }
    seen.add(key);
  }

  if (duplicates.length > 0) {
    throw new BadRequestError(
      'Device connection configs in the same request must have unique stationId, protocol, and deviceCode',
      { duplicates },
    );
  }
}

function describeEndpoint(input: TestDeviceConnectionInput): string {
  if (input.protocol === DEVICE_CONNECTION_PROTOCOL.MODBUS_RTU) {
    const settings = input.settings;
    return `COM${settings.comPort}:slave-${settings.slaveId}`;
  }

  if (input.protocol === DEVICE_CONNECTION_PROTOCOL.MODBUS_TCP) {
    const settings = input.settings;
    return `${settings.hostIp}:${settings.port}:slave-${settings.slaveId}`;
  }

  const settings = input.settings;
  return `${settings.hostIp}:${settings.port}/${settings.dbName}`;
}
