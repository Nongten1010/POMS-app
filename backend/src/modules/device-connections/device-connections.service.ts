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

  listActiveSettingsForIntegration(
    query: ListDeviceConnectionConfigsQuery,
  ): Promise<DeviceConnectionConfigDTO[]> {
    return deviceConnectionsRepository.listActiveForIntegration(query);
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
    return deviceConnectionsRepository.replaceActive(input, actorUserId);
  },

  async createMany(
    inputs: CreateDeviceConnectionConfigInput[],
    actorUserId: number,
  ): Promise<DeviceConnectionConfigDTO[]> {
    ensureBatchDeviceKeysAreUnique(inputs);
    return deviceConnectionsRepository.replaceManyActive(inputs, actorUserId);
  },

  async replaceCurrentStation(
    stationId: string,
    inputs: CreateDeviceConnectionConfigInput[],
    actorUserId: number,
  ): Promise<DeviceConnectionConfigDTO[]> {
    ensureBatchDeviceKeysAreUnique(inputs);
    return deviceConnectionsRepository.replaceManyActiveForStation(stationId, inputs, actorUserId);
  },

  async createForRequest(
    input: CreateDeviceConnectionConfigInput,
    actorUserId: number,
    requestId: number,
  ): Promise<DeviceConnectionConfigDTO> {
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
    return deviceConnectionsRepository.replaceManyForRequestAndActiveSettings(
      inputs,
      actorUserId,
      requestId,
    );
  },

  async testConnection(input: TestDeviceConnectionInput): Promise<DeviceConnectionTestResultDTO> {
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
  if (input.protocol === DEVICE_CONNECTION_PROTOCOL.POMS_BOX) {
    return `POMS_BOX:${settingToText(input.deviceCode ?? input.stationId)}`;
  }

  if (input.protocol === DEVICE_CONNECTION_PROTOCOL.MODBUS_RTU) {
    const settings = input.settings;
    return `COM${settingToText(settings.comPort)}:slave-${settingToText(settings.slaveId)}`;
  }

  if (input.protocol === DEVICE_CONNECTION_PROTOCOL.MODBUS_TCP) {
    const settings = input.settings;
    return `${settingToText(settings.hostIp)}:${settingToText(settings.port)}:slave-${settingToText(
      settings.slaveId,
    )}`;
  }

  const settings = input.settings;
  return `${settingToText(settings.hostIp)}:${settingToText(settings.port)}/${settingToText(
    settings.dbName,
  )}`;
}

function settingToText(value: unknown): string {
  return value === null || value === undefined ? '' : String(value);
}
