import { BadRequestError, ForbiddenError, NotFoundError } from '../../shared/errors/AppError';
import { deviceConnectionsService } from '../device-connections/device-connections.service';
import type {
  CreateDeviceConnectionConfigInput,
  CreateDeviceConnectionConfigsInput,
  DeviceConnectionConfigDTO,
} from '../device-connections/device-connections.types';
import { connectionRequestsRepository } from './connection-requests.repository';
import {
  CONNECTION_REQUEST_STATUS,
  CONNECTION_REQUEST_TYPE,
  type AddMeasurementPointRequestInput,
  type AddParameterRequestInput,
  type ChangeConnectionRequestStatusInput,
  type ConnectedMeasurementPointDetailDTO,
  type ConfirmConnectionInput,
  type ConnectionRequestDTO,
  type ConnectionRequestDetailDTO,
  type ConnectionRequestStatus,
  type ConnectionRequestTableRowDTO,
  type ConnectionRequestType,
  type CreateConnectionRequestInput,
  type DeviceConfigFormConnectionDTO,
  type DeviceConfigFormDetailDTO,
  type DeviceConfigFormParameterMappingDTO,
  type DeviceConfigPayloadResponseDTO,
  type FactoryGeneralDTO,
  type FactorySummaryDTO,
  type ListConnectedMeasurementPointsQuery,
  type ListConnectionRequestsQuery,
  type MeasurementPointDTO,
  type OperatorFactoryTableRowDTO,
  type PaginatedConnectionRequestsDTO,
  type PaginatedTableRowsDTO,
  type ResubmitConnectionRequestInput,
  type ReviewConnectionRequestInput,
  type VerifyConnectionInput,
} from './connection-requests.types';

const DESIGN_REVIEW_STATUSES: ConnectionRequestStatus[] = [
  CONNECTION_REQUEST_STATUS.PENDING_DESIGN_REVIEW,
  CONNECTION_REQUEST_STATUS.REVISED_PENDING_DESIGN_REVIEW,
];

let nowProvider = () => new Date();

export const connectionRequestsService = {
  setClockForTests(provider: () => Date): void {
    nowProvider = provider;
  },

  async list(
    query: ListConnectionRequestsQuery,
    actorUserId: number,
    viewScope: string | null | undefined,
  ): Promise<PaginatedConnectionRequestsDTO> {
    const { rows, total } = await connectionRequestsRepository.list(query, {
      actorUserId,
      scope: viewScope,
    });
    return { data: rows, meta: { total } };
  },

  async listTableRows(
    query: ListConnectionRequestsQuery,
    actorUserId: number,
    viewScope: string | null | undefined,
  ): Promise<PaginatedTableRowsDTO<ConnectionRequestTableRowDTO>> {
    const { rows, total } = await connectionRequestsRepository.list(query, {
      actorUserId,
      scope: viewScope,
    });
    const factoryMap = await connectionRequestsRepository.findFactorySummariesForRequests(rows);
    return {
      data: rows.map((request) =>
        toRequestTableRow(request, findFactorySummary(request, factoryMap)),
      ),
      meta: { total },
    };
  },

  async listOperatorFactories(
    actorUserId: number,
    factoryViewScope: string | null | undefined,
  ): Promise<PaginatedTableRowsDTO<OperatorFactoryTableRowDTO>> {
    const factories = await connectionRequestsRepository.listFactoriesForAccess({
      actorUserId,
      scope: factoryViewScope,
    });
    const requests = await connectionRequestsRepository.listRequestsForFactories(
      factories.map((factory) => factory.factoryId),
    );
    const latestRequestByFactory = new Map<string, ConnectionRequestDTO>();
    const connectedPointCountByFactory = new Map<string, number>();

    requests.forEach((request) => {
      if (!latestRequestByFactory.has(request.factoryId)) {
        latestRequestByFactory.set(request.factoryId, request);
      }
      if (request.status === CONNECTION_REQUEST_STATUS.CONNECTED) {
        connectedPointCountByFactory.set(
          request.factoryId,
          (connectedPointCountByFactory.get(request.factoryId) ?? 0) +
            request.measurementPoints.length,
        );
      }
    });

    return {
      data: factories.map((factory) => {
        const latestRequest = latestRequestByFactory.get(factory.factoryId);
        return {
          ...factory,
          monitoringPointCount: connectedPointCountByFactory.get(factory.factoryId) ?? 0,
          requestStatusCode: latestRequest?.status ?? null,
          status: 'แสดง',
          isEligible: factory.isEligible ?? false,
          eligibilityStatus: factory.isEligible ? 'เข้าข่าย' : 'ไม่เข้าข่าย',
        };
      }),
      meta: { total: factories.length },
    };
  },

  async getFactoryGeneral(
    factoryId: string,
    actorUserId: number,
    factoryViewScope: string | null | undefined,
  ): Promise<FactoryGeneralDTO> {
    const factory = await connectionRequestsRepository.findFactoryGeneral(factoryId, {
      actorUserId,
      scope: factoryViewScope,
    });
    if (!factory) throw new NotFoundError('Factory general information not found');
    return factory;
  },

  async getById(
    id: number,
    actorUserId: number,
    viewScope: string | null | undefined,
  ): Promise<ConnectionRequestDTO> {
    const request = await loadRequest(id);
    ensureCanRead(request, actorUserId, viewScope);
    return request;
  },

  async getDetail(
    id: number,
    actorUserId: number,
    viewScope: string | null | undefined,
  ): Promise<ConnectionRequestDetailDTO> {
    const request = await this.getById(id, actorUserId, viewScope);
    const factoryMap = await connectionRequestsRepository.findFactorySummariesForRequests([
      request,
    ]);
    const deviceConfigs = await deviceConnectionsService.listByRequestId(id);

    return {
      ...request,
      factory: findFactorySummary(request, factoryMap),
      deviceConfigs: toDeviceConfigPayloadGroups(deviceConfigs),
    };
  },

  async getDeviceConfigFormDetail(
    id: number,
    stationId: string | undefined,
    actorUserId: number,
    viewScope: string | null | undefined,
  ): Promise<DeviceConfigFormDetailDTO> {
    const request = await this.getById(id, actorUserId, viewScope);
    const configs = await deviceConnectionsService.listByRequestId(id);
    return toDeviceConfigFormDetail(request, configs, stationId);
  },

  async getSingleDeviceConfigFormDetail(
    id: number,
    configId: number,
    actorUserId: number,
    viewScope: string | null | undefined,
  ): Promise<DeviceConfigFormDetailDTO> {
    const request = await this.getById(id, actorUserId, viewScope);
    const configs = await deviceConnectionsService.listByRequestId(id);
    const config = configs.find((item) => item.id === configId);
    if (!config) throw new NotFoundError('Device connection config not found for request');
    return toDeviceConfigFormDetail(request, [config], config.stationId);
  },

  async listConnectedMeasurementPoints(
    query: ListConnectedMeasurementPointsQuery,
    actorUserId: number,
    viewScope: string | null | undefined,
  ): Promise<PaginatedTableRowsDTO<ConnectedMeasurementPointDetailDTO>> {
    const { rows } = await connectionRequestsRepository.list(
      {
        factoryId: query.factoryId,
        status: CONNECTION_REQUEST_STATUS.CONNECTED,
      },
      {
        actorUserId,
        scope: viewScope,
      },
    );
    const factoryMap = await connectionRequestsRepository.findFactorySummariesForRequests(rows);
    const details = await Promise.all(
      rows.flatMap((request) =>
        request.measurementPoints
          .filter((point) => stationMatchesMeasurementPoint(point, query.stationId))
          .map(async (point) => {
            const pointDeviceConfigs = await listActiveDeviceConfigsForPoint(point, query.stationId);
            return {
              id: point.id,
              requestId: request.id,
              requestNo: request.requestNo,
              factory: findFactorySummary(request, factoryMap),
              type: request.systemType,
              status: request.statusLabel,
              statusCode: request.status,
              connectedAt: request.verifiedAt,
              point,
              deviceConfigs: toDeviceConfigPayloadGroups(pointDeviceConfigs),
            };
          }),
      ),
    );

    return { data: details, meta: { total: details.length } };
  },

  create(input: CreateConnectionRequestInput, actorUserId: number): Promise<ConnectionRequestDTO> {
    return connectionRequestsRepository.create(
      clearPendingPointCodes(input),
      actorUserId,
      CONNECTION_REQUEST_STATUS.PENDING_DESIGN_REVIEW,
    );
  },

  createMeasurementPointRequest(
    input: AddMeasurementPointRequestInput,
    actorUserId: number,
  ): Promise<ConnectionRequestDTO> {
    return connectionRequestsRepository.create(
      clearPendingPointCodes({
        ...input,
        requestType: CONNECTION_REQUEST_TYPE.ADD_MEASUREMENT_POINT,
      }),
      actorUserId,
      CONNECTION_REQUEST_STATUS.PENDING_DESIGN_REVIEW,
    );
  },

  createParameterRequest(
    input: AddParameterRequestInput,
    actorUserId: number,
  ): Promise<ConnectionRequestDTO> {
    ensureRequestFormSections(input, CONNECTION_REQUEST_TYPE.ADD_PARAMETER);
    return connectionRequestsRepository.create(
      { ...input, requestType: CONNECTION_REQUEST_TYPE.ADD_PARAMETER },
      actorUserId,
      CONNECTION_REQUEST_STATUS.PENDING_DESIGN_REVIEW,
    );
  },

  async resubmit(
    id: number,
    input: ResubmitConnectionRequestInput,
    actorUserId: number,
  ): Promise<ConnectionRequestDTO> {
    const request = await loadRequest(id);
    ensureOwner(request, actorUserId);
    ensureStatus(request, [CONNECTION_REQUEST_STATUS.WAITING_FACTORY_REVISION]);
    const effectiveInput = {
      ...input,
      requestType: input.requestType ?? request.requestType,
    };
    ensureRequestFormSections(effectiveInput, effectiveInput.requestType);
    const formInput =
      effectiveInput.requestType === CONNECTION_REQUEST_TYPE.ADD_PARAMETER
        ? effectiveInput
        : clearPendingPointCodes(effectiveInput);

    return connectionRequestsRepository.replaceForm(
      id,
      formInput,
      actorUserId,
      CONNECTION_REQUEST_STATUS.REVISED_PENDING_DESIGN_REVIEW,
    );
  },

  async review(
    id: number,
    input: ReviewConnectionRequestInput,
    actorUserId: number,
  ): Promise<ConnectionRequestDTO> {
    const request = await loadRequest(id);
    ensureStatus(request, DESIGN_REVIEW_STATUSES);

    if (input.decision === 'REQUEST_REVISION') {
      return connectionRequestsRepository.updateStatus(
        id,
        CONNECTION_REQUEST_STATUS.WAITING_FACTORY_REVISION,
        actorUserId,
        {
          officerNote: input.officerNote ?? null,
          revisionReason: input.revisionReason,
        },
      );
    }

    return connectionRequestsRepository.updateStatus(
      id,
      CONNECTION_REQUEST_STATUS.WAITING_CONNECTION,
      actorUserId,
      {
        officerNote: input.officerNote ?? null,
        revisionReason: null,
        connectionDueAt: addDays(nowProvider(), 30).toISOString(),
      },
    );
  },

  changeStatus(
    id: number,
    input: ChangeConnectionRequestStatusInput,
    actorUserId: number,
  ): Promise<ConnectionRequestDTO> {
    if (input.action === 'REQUEST_REVISION') {
      return this.review(
        id,
        {
          decision: 'REQUEST_REVISION',
          revisionReason: input.revisionReason,
          officerNote: input.officerNote,
        },
        actorUserId,
      );
    }

    return this.review(
      id,
      {
        decision: 'APPROVE_DESIGN',
        officerNote: input.officerNote,
      },
      actorUserId,
    );
  },

  async createDeviceConfig(
    id: number,
    input: CreateDeviceConnectionConfigInput,
    actorUserId: number,
  ): Promise<DeviceConfigPayloadResponseDTO> {
    const request = await loadRequest(id);
    ensureOwner(request, actorUserId);
    ensureStatus(request, [CONNECTION_REQUEST_STATUS.WAITING_CONNECTION]);
    ensureStationBelongsToRequest(request, input.stationId);

    const created = await deviceConnectionsService.createForRequest(input, actorUserId, id);
    return toDeviceConfigPayloadResponse([created]);
  },

  async createDeviceConfigs(
    id: number,
    input: CreateDeviceConnectionConfigsInput,
    actorUserId: number,
  ): Promise<DeviceConfigPayloadResponseDTO> {
    const request = await loadRequest(id);
    ensureOwner(request, actorUserId);
    ensureStatus(request, [CONNECTION_REQUEST_STATUS.WAITING_CONNECTION]);
    for (const config of input.configs) {
      ensureStationBelongsToRequest(request, config.stationId);
    }

    const created = await deviceConnectionsService.createManyForRequest(
      input.configs,
      actorUserId,
      id,
    );
    return toDeviceConfigPayloadResponse(created);
  },

  async confirmConnection(
    id: number,
    input: ConfirmConnectionInput,
    actorUserId: number,
  ): Promise<ConnectionRequestDTO> {
    const request = await loadRequest(id);
    ensureOwner(request, actorUserId);
    ensureStatus(request, [CONNECTION_REQUEST_STATUS.WAITING_CONNECTION]);

    if ((input.action ?? 'CONFIRM') === 'SAVE') {
      return connectionRequestsRepository.updateStatus(
        id,
        CONNECTION_REQUEST_STATUS.WAITING_CONNECTION,
        actorUserId,
        {
          officerNote: input.note ?? null,
        },
      );
    }

    if (!request.connectionDueAt) {
      throw new BadRequestError('Connection due date is not set');
    }

    const confirmedAt = input.confirmedAt ?? nowProvider().toISOString();
    if (new Date(confirmedAt).getTime() > new Date(request.connectionDueAt).getTime()) {
      throw new BadRequestError('Connection confirmation must be submitted within 30 days');
    }

    return connectionRequestsRepository.updateStatus(
      id,
      CONNECTION_REQUEST_STATUS.CONNECTION_CONFIRMED,
      actorUserId,
      {
        confirmedAt,
        officerNote: input.note ?? null,
      },
    );
  },

  async verifyConnection(
    id: number,
    input: VerifyConnectionInput,
    actorUserId: number,
  ): Promise<ConnectionRequestDTO> {
    const request = await loadRequest(id);
    ensureStatus(request, [CONNECTION_REQUEST_STATUS.CONNECTION_CONFIRMED]);

    const connected = await connectionRequestsRepository.updateStatus(
      id,
      CONNECTION_REQUEST_STATUS.CONNECTED,
      actorUserId,
      {
        verifiedAt: input.verifiedAt ?? nowProvider().toISOString(),
        officerNote: input.note ?? null,
      },
    );
    await connectionRequestsRepository.syncConnectedMeasurementPoints(connected, actorUserId);
    return connected;
  },
};

function stationMatchesMeasurementPoint(point: MeasurementPointDTO, stationId?: string): boolean {
  if (!stationId) return true;
  return point.pointCode === stationId || point.pointName === stationId;
}

function toRequestTableRow(
  request: ConnectionRequestDTO,
  factory: FactorySummaryDTO | null,
): ConnectionRequestTableRowDTO {
  const firstPoint = request.measurementPoints[0] ?? null;
  const codeIssuedAt = findCodeIssuedAt(request);
  return {
    id: request.id,
    factoryId: request.factoryId,
    factoryName: factory?.factoryName ?? request.factoryName,
    industryType: factory?.industryType ?? null,
    province: factory?.province ?? null,
    type: request.systemType,
    requestNo: request.requestNo,
    submittedAt: request.createdAt,
    submittedDate: formatThaiDate(request.createdAt),
    monitoringPointCode: firstPoint?.pointCode ?? null,
    codeIssuedAt,
    codeIssuedDate: codeIssuedAt ? formatThaiDate(codeIssuedAt) : null,
    form: request.requestTypeLabel,
    status: request.statusLabel,
    statusCode: request.status,
    requestType: request.requestType,
  };
}

async function listActiveDeviceConfigsForPoint(
  point: MeasurementPointDTO,
  stationId?: string,
): Promise<DeviceConnectionConfigDTO[]> {
  const stationIds = stationId
    ? [stationId]
    : [point.pointCode, point.pointName].filter((value): value is string => Boolean(value));

  for (const stationId of stationIds) {
    const configs = await deviceConnectionsService.listActiveSettings({ stationId });
    if (configs.length > 0) return configs;
  }

  return [];
}

function toDeviceConfigFormDetail(
  request: ConnectionRequestDTO,
  configs: DeviceConnectionConfigDTO[],
  requestedStationId?: string,
): DeviceConfigFormDetailDTO {
  const monitoringPoint = findMonitoringPoint(request, requestedStationId);
  const stationId =
    requestedStationId ??
    monitoringPoint?.pointCode ??
    monitoringPoint?.pointName ??
    request.measurementPoints[0]?.pointCode ??
    request.measurementPoints[0]?.pointName ??
    '';
  const stationAliases = new Set(
    [stationId, monitoringPoint?.pointCode, monitoringPoint?.pointName].filter(Boolean),
  );
  const stationConfigs = configs.filter((config) => stationAliases.has(config.stationId));
  const parameterOptions = [
    ...new Set([
      ...(monitoringPoint?.parameters ?? []),
      ...stationConfigs.flatMap((config) => config.channels.map((channel) => channel.dataType)),
    ]),
  ];
  const connectionForms = stationConfigs.map((config, index) =>
    toDeviceConfigFormConnection(config, stationId, index),
  );
  const deviceCodeOptions =
    connectionForms.length > 0
      ? connectionForms.map((connection) => connection.deviceCode)
      : [toDeviceCode(stationId, 0)];
  const savedStatusManagement = stationConfigs.find(
    (config) => config.statusManagement,
  )?.statusManagement;
  const statusManagement = savedStatusManagement ?? {
    selectedParameters: ['ทั้งหมด'],
    startAt: null,
    endAt: null,
    status: 'Normal',
    schedules: [],
  };

  return {
    requestId: request.id,
    requestNo: request.requestNo,
    stationId,
    monitoringPoint,
    parameterOptions,
    deviceCodeOptions,
    connectionForms,
    statusManagement,
    parameterMappings: stationConfigs.flatMap((config, configIndex) =>
      config.channels.map((channel) =>
        toDeviceConfigParameterMapping(
          config.id,
          getDeviceCode(config, stationId, configIndex),
          channel,
        ),
      ),
    ),
    testResults: [],
    rawConfigs: toDeviceConfigRawConfig(stationId, stationConfigs, statusManagement),
  };
}

function findMonitoringPoint(
  request: ConnectionRequestDTO,
  stationId?: string,
): MeasurementPointDTO | null {
  if (!stationId) return request.measurementPoints[0] ?? null;
  return (
    request.measurementPoints.find(
      (point) => point.pointCode === stationId || point.pointName === stationId,
    ) ?? null
  );
}

function toDeviceConfigFormConnection(
  config: DeviceConnectionConfigDTO,
  stationId: string,
  index: number,
): DeviceConfigFormConnectionDTO {
  return {
    id: config.id,
    configId: config.id,
    type: protocolToConnectionType(config.protocol),
    protocol: config.protocol,
    deviceCode: getDeviceCode(config, stationId, index),
    values: settingsToFormValues(config.protocol, config.settings),
  };
}

function toDeviceConfigParameterMapping(
  configId: number,
  deviceCode: string,
  channel: DeviceConnectionConfigDTO['channels'][number],
): DeviceConfigFormParameterMappingDTO {
  return {
    configId,
    deviceCode,
    addressId: String(channel.addressId),
    parameter: channel.dataType,
    min: channel.valueRange ? String(channel.valueRange.min) : '',
    max: channel.valueRange ? String(channel.valueRange.max) : '',
    valueFormat: valueFormatToThai(channel.valueFormat ?? 'MEASUREMENT_VALUE'),
    offset: String(channel.offset),
    encodingData: encodingToFormLabel(channel.encoding ?? null),
    status: channel.status ?? 'Normal',
  };
}

function toDeviceConfigRawConfig(
  stationId: string,
  configs: DeviceConnectionConfigDTO[],
  statusManagement: DeviceConfigFormDetailDTO['statusManagement'],
): DeviceConfigFormDetailDTO['rawConfigs'] {
  return {
    stationId,
    device: configs.map((config, index) => ({
      deviceCode: getDeviceCode(config, stationId, index),
      protocol: config.protocol,
      settings: config.settings,
    })),
    channels: configs.flatMap((config, configIndex) =>
      config.channels.map((channel) => ({
        deviceCode: getDeviceCode(config, stationId, configIndex),
        addressId: channel.addressId,
        dataType: channel.dataType,
        valueRange: channel.valueRange ?? null,
        valueFormat: channel.valueFormat ?? null,
        offset: channel.offset,
        encoding: channel.encoding ?? null,
        status: channel.status ?? 'Normal',
      })),
    ),
    statusManagement,
  };
}

function toDeviceConfigPayloadGroups(
  configs: DeviceConnectionConfigDTO[],
): DeviceConfigFormDetailDTO['rawConfigs'][] {
  const groups = new Map<string, DeviceConnectionConfigDTO[]>();
  for (const config of configs) {
    const group = groups.get(config.stationId) ?? [];
    group.push(config);
    groups.set(config.stationId, group);
  }

  return Array.from(groups.entries()).map(([stationId, stationConfigs]) =>
    toDeviceConfigRawConfig(stationId, stationConfigs, toStatusManagement(stationConfigs)),
  );
}

function toDeviceConfigPayloadResponse(
  configs: DeviceConnectionConfigDTO[],
): DeviceConfigPayloadResponseDTO {
  const groups = toDeviceConfigPayloadGroups(configs);
  return groups.length === 1 ? groups[0] : groups;
}

function toStatusManagement(
  configs: DeviceConnectionConfigDTO[],
): DeviceConfigFormDetailDTO['statusManagement'] {
  return (
    configs.find((config) => config.statusManagement)?.statusManagement ?? {
      selectedParameters: ['ทั้งหมด'],
      startAt: null,
      endAt: null,
      status: 'Normal',
      schedules: [],
    }
  );
}

function getDeviceCode(
  config: Pick<DeviceConnectionConfigDTO, 'deviceCode'>,
  stationId: string,
  index: number,
): string {
  return config.deviceCode || toDeviceCode(stationId, index);
}

function protocolToConnectionType(protocol: string): DeviceConfigFormConnectionDTO['type'] {
  if (protocol === 'MODBUS_RTU') return 'Modbus RTU';
  if (protocol === 'MODBUS_TCP') return 'Modbus TCP';
  if (protocol === 'MSSQL') return 'Microsoft SQL';
  return 'MySQL';
}

function settingsToFormValues(
  protocol: string,
  settings: Record<string, unknown>,
): Record<string, string> {
  if (protocol === 'MODBUS_RTU') {
    const range = readRange(settings.valueRange);
    return {
      comport: valueToString(settings.comPort),
      slaveId: valueToString(settings.slaveId),
      baudRate: valueToString(settings.baudRate),
      parity: parityToFormLabel(settings.parity),
      stopBits: valueToString(settings.stopBits),
      dataBits: valueToString(settings.dataBits),
      measureMin: range.min,
      measureMax: range.max,
      quantity: valueToString(settings.quantity),
    };
  }

  if (protocol === 'MODBUS_TCP') {
    return {
      slaveId: valueToString(settings.slaveId),
      hostIp: valueToString(settings.hostIp),
      port: valueToString(settings.port),
    };
  }

  return {
    hostIp: valueToString(settings.hostIp),
    port: valueToString(settings.port),
    dbUser: valueToString(settings.dbUser),
    dbPass: valueToString(settings.dbPass),
    dbName: valueToString(settings.dbName),
  };
}

function readRange(value: unknown): { min: string; max: string } {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { min: '', max: '' };
  }
  const range = value as { min?: unknown; max?: unknown };
  return {
    min: valueToString(range.min),
    max: valueToString(range.max),
  };
}

function parityToFormLabel(value: unknown): string {
  if (value === 'EVEN') return 'Even';
  if (value === 'ODD') return 'Odd';
  return 'None';
}

function valueFormatToThai(value: string): string {
  if (value === 'CURRENT') return 'ค่ากระแสไฟฟ้า';
  if (value === 'VOLTAGE') return 'ค่าแรงดันไฟฟ้า';
  return 'ค่าข้อมูลตรวจวัด';
}

function encodingToFormLabel(value: string | null): string {
  if (!value) return 'Unsigned16 - Big Endian';
  const known: Record<string, string> = {
    SIGNED: 'Signed',
    UNSIGNED: 'Unsigned',
    BIG_ENDIAN: 'Big Endian',
    LITTLE_ENDIAN: 'Little Endian',
    SIGNED16_BIG_ENDIAN: 'Signed16 - Big Endian',
    SIGNED16_LITTLE_ENDIAN: 'Signed16 - Little Endian',
    UNSIGNED16_BIG_ENDIAN: 'Unsigned16 - Big Endian',
    UNSIGNED16_LITTLE_ENDIAN: 'Unsigned16 - Little Endian',
    SIGNED32_BIG_ENDIAN: 'Signed32 - Big Endian',
    SIGNED32_LITTLE_ENDIAN: 'Signed32 - Little Endian',
    UNSIGNED32_BIG_ENDIAN: 'Unsigned32 - Big Endian',
    UNSIGNED32_LITTLE_ENDIAN: 'Unsigned32 - Little Endian',
    FLOAT32_BIG_ENDIAN: 'Float32 - Big Endian',
    FLOAT32_LITTLE_ENDIAN: 'Float32 - Little Endian',
    FLOAT64_BIG_ENDIAN: 'Float64 - Big Endian',
    FLOAT64_LITTLE_ENDIAN: 'Float64 - Little Endian',
  };
  return known[value] ?? value;
}

function toDeviceCode(stationId: string, index: number): string {
  return `${stationId || 'STATION'}/${String(index + 1).padStart(2, '0')}`;
}

function valueToString(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value);
}

function findFactorySummary(
  request: ConnectionRequestDTO,
  factoryMap: Map<string, FactorySummaryDTO>,
): FactorySummaryDTO | null {
  const summary =
    factoryMap.get(request.factoryId) ?? factoryMap.get(request.factoryRegistrationNo);
  if (summary) {
    return {
      ...summary,
      industryMainOrder: summary.industryMainOrder ?? request.industryMainOrder,
      industrySubOrder: summary.industrySubOrder ?? request.industrySubOrder,
      businessActivity: summary.businessActivity ?? request.businessActivity,
      eia: summary.eia ?? request.eia,
      projectName: summary.projectName ?? request.projectName,
      address: summary.address ?? request.address,
      latitude: summary.latitude ?? (request.latitude === null ? null : String(request.latitude)),
      longitude:
        summary.longitude ?? (request.longitude === null ? null : String(request.longitude)),
    };
  }

  return {
    id: null,
    factoryId: request.factoryId,
    factoryName: request.factoryName,
    newRegistrationNo: request.factoryRegistrationNo,
    oldRegistrationNo: null,
    industryType: null,
    industryMainOrder: request.industryMainOrder,
    industrySubOrder: request.industrySubOrder,
    businessActivity: request.businessActivity,
    eia: request.eia,
    projectName: request.projectName,
    address: request.address,
    latitude: request.latitude === null ? null : String(request.latitude),
    longitude: request.longitude === null ? null : String(request.longitude),
    province: null,
  };
}

function findCodeIssuedAt(request: ConnectionRequestDTO): string | null {
  const history = request.statusHistory.find(
    (item) => item.status === CONNECTION_REQUEST_STATUS.WAITING_CONNECTION,
  );
  return history?.changedAt ?? request.connectionDueAt ?? null;
}

function formatThaiDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${day}/${month}/${date.getFullYear() + 543}`;
}

function ensureSingleMeasurementPoint(input: CreateConnectionRequestInput): void {
  if (input.measurementPoints.length !== 1) {
    throw new BadRequestError('Add parameter request must reference exactly one measurement point');
  }
}

function ensureRequestFormSections(
  input: CreateConnectionRequestInput,
  requestType: ConnectionRequestType,
): void {
  if (requestType === CONNECTION_REQUEST_TYPE.ADD_PARAMETER) {
    ensureSingleMeasurementPoint(input);
  }

  input.measurementPoints.forEach((point, index) => {
    if (requestType === CONNECTION_REQUEST_TYPE.ADD_PARAMETER && !point.pointCode) {
      throw new BadRequestError(
        'Existing measurement point code is required for add parameter request',
        {
          path: `measurementPoints.${index}.pointCode`,
        },
      );
    }

    if (
      requestType === CONNECTION_REQUEST_TYPE.ADD_MEASUREMENT_POINT ||
      requestType === CONNECTION_REQUEST_TYPE.ADD_PARAMETER
    ) {
      if (!point.details || Object.keys(point.details).length === 0) {
        throw new BadRequestError('Measurement point detail section is required', {
          path: `measurementPoints.${index}.details`,
        });
      }
      if (
        input.systemType === 'CEMS' &&
        (!point.documentsAndImages || point.documentsAndImages.length === 0)
      ) {
        throw new BadRequestError('Documents and images section is required for CEMS', {
          path: `measurementPoints.${index}.documentsAndImages`,
        });
      }
    }

    if (
      requestType === CONNECTION_REQUEST_TYPE.ADD_MEASUREMENT_POINT ||
      requestType === CONNECTION_REQUEST_TYPE.ADD_PARAMETER
    ) {
      if (!point.measurementInstruments) {
        throw new BadRequestError('Measurement instruments section is required', {
          path: `measurementPoints.${index}.measurementInstruments`,
        });
      }
    }
  });
}

function clearPendingPointCodes(input: CreateConnectionRequestInput): CreateConnectionRequestInput {
  return {
    ...input,
    measurementPoints: input.measurementPoints.map((point) => ({
      ...point,
      pointCode: null,
    })),
  };
}

async function loadRequest(id: number): Promise<ConnectionRequestDTO> {
  const request = await connectionRequestsRepository.findById(id);
  if (!request) throw new NotFoundError('Connection request not found');
  return request;
}

function ensureCanRead(
  request: ConnectionRequestDTO,
  actorUserId: number,
  viewScope: string | null | undefined,
): void {
  if (viewScope === 'ALL') return;
  if (request.createdBy === actorUserId) return;
  throw new ForbiddenError('Cannot access another operator connection request');
}

function ensureOwner(request: ConnectionRequestDTO, actorUserId: number): void {
  if (request.createdBy !== actorUserId) {
    throw new ForbiddenError('Only the request owner can perform this action');
  }
}

function ensureStatus(
  request: ConnectionRequestDTO,
  allowedStatuses: ConnectionRequestStatus[],
): void {
  if (!allowedStatuses.includes(request.status)) {
    throw new BadRequestError('Invalid connection request status for this action', {
      currentStatus: request.status,
      allowedStatuses,
    });
  }
}

function ensureStationBelongsToRequest(request: ConnectionRequestDTO, stationId: string): void {
  const matched = request.measurementPoints.some(
    (point) => point.pointCode === stationId || point.pointName === stationId,
  );
  if (!matched) {
    throw new BadRequestError('Device config stationId must match a measurement point in request', {
      stationId,
      measurementPoints: request.measurementPoints.map((point) => ({
        pointCode: point.pointCode,
        pointName: point.pointName,
      })),
    });
  }
}

function addDays(value: Date, days: number): Date {
  const next = new Date(value);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}
