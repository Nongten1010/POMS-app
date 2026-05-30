import { BadRequestError, ForbiddenError, NotFoundError } from '../../shared/errors/AppError';
import { deviceConnectionsService } from '../device-connections/device-connections.service';
import type {
  CreateDeviceConnectionConfigInput,
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
  type CreateConnectionRequestInput,
  type DeviceConfigFormConnectionDTO,
  type DeviceConfigFormDetailDTO,
  type DeviceConfigFormParameterMappingDTO,
  type FactorySummaryDTO,
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
          requestStatus: latestRequest?.statusLabel ?? 'ยังไม่มีจุดตรวจวัด',
          requestStatusCode: latestRequest?.status ?? null,
          status: 'แสดง',
        };
      }),
      meta: { total: factories.length },
    };
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
      deviceConfigs,
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
    query: Pick<ListConnectionRequestsQuery, 'factoryId'>,
    actorUserId: number,
    viewScope: string | null | undefined,
  ): Promise<PaginatedTableRowsDTO<ConnectedMeasurementPointDetailDTO>> {
    const { rows } = await connectionRequestsRepository.list(
      {
        ...query,
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
        request.measurementPoints.map(async (point) => {
          const requestDeviceConfigs = await deviceConnectionsService.listByRequestId(request.id);
          const pointDeviceConfigs = requestDeviceConfigs.filter(
            (config) =>
              config.stationId === point.pointCode || config.stationId === point.pointName,
          );
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
            deviceConfigs: pointDeviceConfigs,
          };
        }),
      ),
    );

    return { data: details, meta: { total: details.length } };
  },

  create(input: CreateConnectionRequestInput, actorUserId: number): Promise<ConnectionRequestDTO> {
    return connectionRequestsRepository.create(
      input,
      actorUserId,
      CONNECTION_REQUEST_STATUS.PENDING_DESIGN_REVIEW,
    );
  },

  createMeasurementPointRequest(
    input: AddMeasurementPointRequestInput,
    actorUserId: number,
  ): Promise<ConnectionRequestDTO> {
    return connectionRequestsRepository.create(
      { ...input, requestType: CONNECTION_REQUEST_TYPE.ADD_MEASUREMENT_POINT },
      actorUserId,
      CONNECTION_REQUEST_STATUS.PENDING_DESIGN_REVIEW,
    );
  },

  createParameterRequest(
    input: AddParameterRequestInput,
    actorUserId: number,
  ): Promise<ConnectionRequestDTO> {
    ensureSingleMeasurementPoint(input);
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

    return connectionRequestsRepository.replaceForm(
      id,
      input,
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
  ): Promise<DeviceConnectionConfigDTO> {
    const request = await loadRequest(id);
    ensureOwner(request, actorUserId);
    ensureStatus(request, [CONNECTION_REQUEST_STATUS.WAITING_CONNECTION]);
    ensureStationBelongsToRequest(request, input.stationId);

    return deviceConnectionsService.createForRequest(input, actorUserId, id);
  },

  async confirmConnection(
    id: number,
    input: ConfirmConnectionInput,
    actorUserId: number,
  ): Promise<ConnectionRequestDTO> {
    const request = await loadRequest(id);
    ensureOwner(request, actorUserId);
    ensureStatus(request, [CONNECTION_REQUEST_STATUS.WAITING_CONNECTION]);

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

    return connectionRequestsRepository.updateStatus(
      id,
      CONNECTION_REQUEST_STATUS.CONNECTED,
      actorUserId,
      {
        verifiedAt: input.verifiedAt ?? nowProvider().toISOString(),
        officerNote: input.note ?? null,
      },
    );
  },
};

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

function toDeviceConfigFormDetail(
  request: ConnectionRequestDTO,
  configs: ConnectionRequestDetailDTO['deviceConfigs'],
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

  return {
    requestId: request.id,
    requestNo: request.requestNo,
    stationId,
    monitoringPoint,
    parameterOptions,
    deviceCodeOptions,
    connectionForms,
    statusManagement: savedStatusManagement ?? {
      selectedParameters: ['ทั้งหมด'],
      startAt: null,
      endAt: null,
      status: 'Normal',
      schedules: [],
    },
    parameterMappings: stationConfigs.flatMap((config, configIndex) =>
      config.channels.map((channel) =>
        toDeviceConfigParameterMapping(config.id, toDeviceCode(stationId, configIndex), channel),
      ),
    ),
    testResults: [],
    rawConfigs: stationConfigs,
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
  config: ConnectionRequestDetailDTO['deviceConfigs'][number],
  stationId: string,
  index: number,
): DeviceConfigFormConnectionDTO {
  return {
    id: config.id,
    configId: config.id,
    type: protocolToConnectionType(config.protocol),
    protocol: config.protocol,
    deviceCode: toDeviceCode(stationId, index),
    values: settingsToFormValues(config.protocol, config.settings),
  };
}

function toDeviceConfigParameterMapping(
  configId: number,
  deviceCode: string,
  channel: ConnectionRequestDetailDTO['deviceConfigs'][number]['channels'][number],
): DeviceConfigFormParameterMappingDTO {
  return {
    configId,
    deviceCode,
    addressId: String(channel.addressId),
    parameter: channel.dataType,
    unit: channel.unit,
    min: channel.valueRange ? String(channel.valueRange.min) : '',
    max: channel.valueRange ? String(channel.valueRange.max) : '',
    valueFormat: valueFormatToThai(channel.valueFormat ?? 'MEASUREMENT_VALUE'),
    offset: String(channel.offset),
    encodingData: encodingToFormLabel(channel.encoding ?? null),
    status: 'Normal',
  };
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
  return (
    factoryMap.get(request.factoryId) ??
    factoryMap.get(request.factoryRegistrationNo) ?? {
      id: null,
      factoryId: request.factoryId,
      factoryName: request.factoryName,
      newRegistrationNo: request.factoryRegistrationNo,
      oldRegistrationNo: null,
      industryType: null,
      industryMainOrder: null,
      industrySubOrder: null,
      businessActivity: null,
      eia: null,
      projectName: null,
      address: null,
      latitude: null,
      longitude: null,
      province: null,
    }
  );
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
