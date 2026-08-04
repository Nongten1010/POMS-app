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
const MASKED_DATABASE_PASSWORD = '********';

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
    const [preparedInput] = await preserveStoredDatabasePasswords([input]);
    return deviceConnectionsRepository.replaceActive(preparedInput, actorUserId);
  },

  async createMany(
    inputs: CreateDeviceConnectionConfigInput[],
    actorUserId: number,
  ): Promise<DeviceConnectionConfigDTO[]> {
    ensureBatchDeviceKeysAreUnique(inputs);
    const preparedInputs = await preserveStoredDatabasePasswords(inputs);
    return deviceConnectionsRepository.replaceManyActive(preparedInputs, actorUserId);
  },

  async replaceCurrentStation(
    stationId: string,
    inputs: CreateDeviceConnectionConfigInput[],
    actorUserId: number,
  ): Promise<DeviceConnectionConfigDTO[]> {
    ensureBatchDeviceKeysAreUnique(inputs);
    const preparedInputs = await preserveStoredDatabasePasswords(inputs);
    return deviceConnectionsRepository.replaceManyActiveForStation(
      stationId,
      preparedInputs,
      actorUserId,
    );
  },

  async createForRequest(
    input: CreateDeviceConnectionConfigInput,
    actorUserId: number,
    requestId: number,
  ): Promise<DeviceConnectionConfigDTO> {
    const [preparedInput] = await preserveStoredDatabasePasswords([input]);
    const [saved] = await deviceConnectionsRepository.replaceManyForRequestAndActiveSettings(
      [preparedInput],
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
    const preparedInputs = await preserveStoredDatabasePasswords(inputs);
    return deviceConnectionsRepository.replaceManyForRequestAndActiveSettings(
      preparedInputs,
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

async function preserveStoredDatabasePasswords(
  inputs: CreateDeviceConnectionConfigInput[],
): Promise<CreateDeviceConnectionConfigInput[]> {
  const maskedInputs = inputs.filter(hasMaskedDatabasePassword);
  if (maskedInputs.length === 0) return inputs;

  const stationIds = [...new Set(maskedInputs.map((input) => input.stationId))];
  const existingConfigs = (
    await Promise.all(
      stationIds.map((stationId) =>
        deviceConnectionsRepository.listActiveForIntegration({ stationId }),
      ),
    )
  ).flat();
  const existingByDeviceKey = new Map(
    existingConfigs.map((config) => [toDeviceKey(config), config]),
  );

  return inputs.map((input) => {
    if (!hasMaskedDatabasePassword(input)) return input;

    const existingConfig = existingByDeviceKey.get(toDeviceKey(input));
    const storedPassword = existingConfig?.settings.dbPass;
    if (
      typeof storedPassword !== 'string' ||
      storedPassword.length === 0 ||
      storedPassword === MASKED_DATABASE_PASSWORD
    ) {
      throw new BadRequestError(
        'Database password must be entered again because no real stored password is available',
        {
          stationId: input.stationId,
          protocol: input.protocol,
          deviceCode: input.deviceCode ?? null,
        },
      );
    }

    return {
      ...input,
      settings: {
        ...input.settings,
        dbPass: storedPassword,
      },
    };
  });
}

function hasMaskedDatabasePassword(input: CreateDeviceConnectionConfigInput): boolean {
  return input.settings.dbPass === MASKED_DATABASE_PASSWORD;
}

function toDeviceKey(
  config: Pick<
    CreateDeviceConnectionConfigInput,
    'stationId' | 'protocol' | 'deviceCode'
  >,
): string {
  return `${config.stationId}\u0000${config.protocol}\u0000${config.deviceCode ?? ''}`;
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
