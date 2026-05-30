import { beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('../../src/modules/connection-requests/connection-requests.repository', () => ({
  connectionRequestsRepository: {
    create: jest.fn(),
    findById: jest.fn(),
    findFactorySummariesForRequests: jest.fn(),
    replaceForm: jest.fn(),
    updateStatus: jest.fn(),
    list: jest.fn(),
    listFactoriesForAccess: jest.fn(),
    findFactoryGeneral: jest.fn(),
    listRequestsForFactories: jest.fn(),
  },
}));

jest.mock('../../src/modules/device-connections/device-connections.service', () => ({
  deviceConnectionsService: {
    createForRequest: jest.fn(),
    listByRequestId: jest.fn(),
  },
}));

import { deviceConnectionsService } from '../../src/modules/device-connections/device-connections.service';
import { connectionRequestsRepository } from '../../src/modules/connection-requests/connection-requests.repository';
import { connectionRequestsService } from '../../src/modules/connection-requests/connection-requests.service';
import {
  CONNECTION_REQUEST_STATUS,
  CONNECTION_REQUEST_TYPE,
  type ConnectionRequestDTO,
  type CreateConnectionRequestInput,
  type FactoryGeneralDTO,
  type FactorySummaryDTO,
} from '../../src/modules/connection-requests/connection-requests.types';

const mockedRepository = jest.mocked(connectionRequestsRepository);
const mockedDeviceConnectionsService = jest.mocked(deviceConnectionsService);

describe('connectionRequestsService', () => {
  const actorUserId = 42;
  const now = new Date('2026-05-27T10:00:00.000Z');
  const dueAt = new Date('2026-06-26T10:00:00.000Z').toISOString();
  const payload: CreateConnectionRequestInput = {
    factoryId: 'factory-001',
    factoryName: 'บริษัท ทดสอบ จำกัด',
    factoryRegistrationNo: '3-106-33/50สบ',
    industryMainOrder: '106',
    industrySubOrder: '33',
    businessActivity: 'ผลิตเคมีภัณฑ์',
    eia: 'มี',
    hasEia: true,
    projectName: 'โครงการทดสอบ CEMS',
    address: '99 หมู่ 1 ตำบลทดสอบ อำเภอเมือง จังหวัดสระบุรี',
    latitude: 13.7563,
    longitude: 100.5018,
    systemType: 'CEMS',
    contactName: 'สมชาย ใจดี',
    contactPhone: '0812345678',
    contactEmail: 'ops@example.com',
    contactPersons: [
      {
        name: 'สมชาย ใจดี',
        phone: '0812345678',
        email: 'ops@example.com',
        position: 'ผู้จัดการสิ่งแวดล้อม',
      },
      {
        name: 'สมหญิง ใจดี',
        phone: '0899999999',
        email: 'ops2@example.com',
        position: 'วิศวกร',
      },
    ],
    notificationEmails: ['ops@example.com', 'ops2@example.com'],
    officerNotificationEmails: ['officer@example.com'],
    measurementPoints: [
      {
        pointName: 'ปล่องระบาย A',
        pointCode: 'STACK-A',
        pointType: 'STACK',
      },
    ],
    remarks: null,
  };
  const payloadWithoutPointCodes: CreateConnectionRequestInput = {
    ...payload,
    measurementPoints: payload.measurementPoints.map((point) => ({
      ...point,
      pointCode: null,
    })),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    connectionRequestsService.setClockForTests(() => now);
  });

  it('returns request table rows formatted for officer/operator grids', async () => {
    const request = requestDto({
      status: CONNECTION_REQUEST_STATUS.WAITING_CONNECTION,
      statusLabel: 'รอเชื่อมต่อ',
      requestType: CONNECTION_REQUEST_TYPE.ADD_MEASUREMENT_POINT,
      requestTypeLabel: 'เพิ่มจุดตรวจวัด',
      measurementPoints: [
        {
          id: 1,
          pointName: 'ปล่องระบาย A',
          pointCode: 'STACK-A',
          pointType: 'STACK',
          latitude: null,
          longitude: null,
          parameters: ['NOx'],
          description: null,
        },
      ],
      statusHistory: [
        {
          id: 1,
          status: CONNECTION_REQUEST_STATUS.WAITING_CONNECTION,
          statusLabel: 'รอเชื่อมต่อ',
          note: null,
          changedBy: 7,
          changedAt: '2026-05-28T10:00:00.000Z',
        },
      ],
    });
    mockedRepository.list.mockResolvedValue({ rows: [request], total: 1 });
    mockedRepository.findFactorySummariesForRequests.mockResolvedValue(
      new Map([[request.factoryId, factorySummary()]]),
    );

    const result = await connectionRequestsService.listTableRows({}, actorUserId, 'ALL');

    expect(mockedRepository.list).toHaveBeenCalledWith({}, { actorUserId, scope: 'ALL' });
    expect(result.data[0]).toMatchObject({
      factoryName: 'บริษัท ทดสอบ จำกัด',
      industryType: 'ผลิตเคมีภัณฑ์',
      province: 'สระบุรี',
      monitoringPointCode: 'STACK-A',
      codeIssuedDate: '28/05/2569',
      form: 'เพิ่มจุดตรวจวัด',
      status: 'รอเชื่อมต่อ',
    });
  });

  it('returns operator factories with latest request status code and connected point count', async () => {
    mockedRepository.listFactoriesForAccess.mockResolvedValue([factorySummary()]);
    mockedRepository.listRequestsForFactories.mockResolvedValue([
      requestDto({
        status: CONNECTION_REQUEST_STATUS.CONNECTED,
        statusLabel: 'เชื่อมต่อแล้ว',
        measurementPoints: [
          {
            id: 1,
            pointName: 'ปล่องระบาย A',
            pointCode: 'STACK-A',
            pointType: 'STACK',
            latitude: null,
            longitude: null,
            parameters: ['NOx'],
            description: null,
          },
        ],
      }),
    ]);

    const result = await connectionRequestsService.listOperatorFactories(
      actorUserId,
      'OWN_FACTORY',
    );

    expect(mockedRepository.listFactoriesForAccess).toHaveBeenCalledWith({
      actorUserId,
      scope: 'OWN_FACTORY',
    });
    expect(result.data[0]).toMatchObject({
      factoryName: 'บริษัท ทดสอบ จำกัด',
      industryMainOrder: '106',
      industrySubOrder: '33',
      businessActivity: 'ผลิตเคมีภัณฑ์',
      eia: 'มี',
      address: '99 หมู่ 1',
      latitude: '13.7563',
      longitude: '100.5018',
      isEligible: true,
      eligibilityStatus: 'เข้าข่าย',
      monitoringPointCount: 1,
      requestStatusCode: CONNECTION_REQUEST_STATUS.CONNECTED,
    });
    expect(result.data[0]).not.toHaveProperty('requestStatus');
  });

  it('returns factory general data for add measurement point form prefill', async () => {
    const factory = factoryGeneral();
    mockedRepository.findFactoryGeneral.mockResolvedValue(factory);

    const result = await connectionRequestsService.getFactoryGeneral(
      'factory-001',
      actorUserId,
      'OWN_FACTORY',
    );

    expect(mockedRepository.findFactoryGeneral).toHaveBeenCalledWith('factory-001', {
      actorUserId,
      scope: 'OWN_FACTORY',
    });
    expect(result.formDefaults).toEqual({
      factoryId: 'factory-001',
      factoryName: 'บริษัท ทดสอบ จำกัด',
      factoryRegistrationNo: '3-106-33/50สบ',
    });
  });

  it('returns request detail with factory summary and device configs for PDF/prefill', async () => {
    const request = requestDto({ createdBy: actorUserId });
    mockedRepository.findById.mockResolvedValue(request);
    mockedRepository.findFactorySummariesForRequests.mockResolvedValue(
      new Map([[request.factoryId, factorySummary({ businessActivity: null })]]),
    );
    mockedDeviceConnectionsService.listByRequestId.mockResolvedValue([
      {
        id: 10,
        requestId: 1,
        stationId: 'STACK-A',
        protocol: 'MODBUS_TCP',
        settings: { hostIp: '192.168.1.10', slaveId: 1, port: 502 },
        channels: [],
        statusManagement: null,
        createdBy: actorUserId,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      },
    ]);

    const result = await connectionRequestsService.getDetail(1, actorUserId, 'OWN_FACTORY');

    expect(result.factory?.province).toBe('สระบุรี');
    expect(result.factory?.businessActivity).toBe('ผลิตเคมีภัณฑ์');
    expect(result.deviceConfigs).toHaveLength(1);
  });

  it('returns device config form detail mapped to frontend field names', async () => {
    const request = requestDto({
      createdBy: actorUserId,
      measurementPoints: [
        {
          id: 1,
          pointName: 'ปล่องระบาย A',
          pointCode: 'STACK-A',
          pointType: 'STACK',
          latitude: null,
          longitude: null,
          parameters: ['NOx'],
          description: null,
        },
      ],
    });
    mockedRepository.findById.mockResolvedValue(request);
    mockedDeviceConnectionsService.listByRequestId.mockResolvedValue([
      {
        id: 10,
        requestId: 1,
        stationId: 'STACK-A',
        deviceCode: 'STACK-A/RTU-01',
        protocol: 'MODBUS_RTU',
        settings: {
          comPort: 1,
          slaveId: 1,
          baudRate: 9600,
          parity: 'NONE',
          stopBits: 1,
          dataBits: 8,
          quantity: 1,
          valueRange: { min: 0, max: 200 },
        },
        channels: [
          {
            addressId: 40001,
            dataType: 'NOx',
            unit: 'ppm',
            valueRange: { min: 0, max: 200 },
            valueFormat: 'MEASUREMENT_VALUE',
            offset: 0,
            encoding: 'UNSIGNED16_BIG_ENDIAN',
            status: 'Maintenance',
          },
        ],
        statusManagement: {
          selectedParameters: ['NOx'],
          startAt: '2026-05-30T10:00',
          endAt: '2026-05-30T11:00',
          status: 'Maintenance',
          schedules: [],
        },
        createdBy: actorUserId,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      },
    ]);

    const result = await connectionRequestsService.getDeviceConfigFormDetail(
      1,
      'STACK-A',
      actorUserId,
      'OWN_FACTORY',
    );

    expect(result).toMatchObject({
      requestId: 1,
      stationId: 'STACK-A',
      parameterOptions: ['NOx'],
      deviceCodeOptions: ['STACK-A/RTU-01'],
      connectionForms: [
        {
          configId: 10,
          type: 'Modbus RTU',
          deviceCode: 'STACK-A/RTU-01',
          values: {
            comport: '1',
            slaveId: '1',
            baudRate: '9600',
            parity: 'None',
            measureMin: '0',
            measureMax: '200',
          },
        },
      ],
      parameterMappings: [
        {
          deviceCode: 'STACK-A/RTU-01',
          addressId: '40001',
          parameter: 'NOx',
          valueFormat: 'ค่าข้อมูลตรวจวัด',
          encodingData: 'Unsigned16 - Big Endian',
          status: 'Maintenance',
        },
      ],
      statusManagement: {
        selectedParameters: ['NOx'],
        startAt: '2026-05-30T10:00',
        endAt: '2026-05-30T11:00',
        status: 'Maintenance',
      },
    });
  });

  it('matches device config form detail by monitoring point code or name aliases', async () => {
    const request = requestDto({
      createdBy: actorUserId,
      measurementPoints: [
        {
          id: 1,
          pointName: 'ปล่องระบาย A',
          pointCode: 'STACK-A',
          pointType: 'STACK',
          latitude: null,
          longitude: null,
          parameters: ['NOx'],
          description: null,
        },
      ],
    });
    mockedRepository.findById.mockResolvedValue(request);
    mockedDeviceConnectionsService.listByRequestId.mockResolvedValue([
      {
        id: 10,
        requestId: 1,
        stationId: 'ปล่องระบาย A',
        protocol: 'MODBUS_TCP',
        settings: { hostIp: '192.168.1.10', slaveId: 1, port: 502 },
        channels: [],
        statusManagement: null,
        createdBy: actorUserId,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      },
    ]);

    const result = await connectionRequestsService.getDeviceConfigFormDetail(
      1,
      'STACK-A',
      actorUserId,
      'OWN_FACTORY',
    );

    expect(result.connectionForms).toHaveLength(1);
    expect(result.connectionForms[0]).toMatchObject({
      configId: 10,
      deviceCode: 'STACK-A/01',
      type: 'Modbus TCP',
    });
  });

  it('returns one device config form detail by config id and rejects missing config', async () => {
    const request = requestDto({ createdBy: actorUserId });
    mockedRepository.findById.mockResolvedValue(request);
    mockedDeviceConnectionsService.listByRequestId.mockResolvedValue([
      {
        id: 10,
        requestId: 1,
        stationId: 'STACK-A',
        protocol: 'MODBUS_TCP',
        settings: { hostIp: '192.168.1.10', slaveId: 1, port: 502 },
        channels: [],
        statusManagement: null,
        createdBy: actorUserId,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      },
    ]);

    const result = await connectionRequestsService.getSingleDeviceConfigFormDetail(
      1,
      10,
      actorUserId,
      'OWN_FACTORY',
    );

    expect(result.connectionForms[0]).toMatchObject({
      configId: 10,
      type: 'Modbus TCP',
      values: { hostIp: '192.168.1.10', slaveId: '1', port: '502' },
    });

    await expect(
      connectionRequestsService.getSingleDeviceConfigFormDetail(1, 99, actorUserId, 'OWN_FACTORY'),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('returns connected measurement point details only from connected requests', async () => {
    const request = requestDto({
      status: CONNECTION_REQUEST_STATUS.CONNECTED,
      statusLabel: 'เชื่อมต่อแล้ว',
      verifiedAt: '2026-05-29T10:00:00.000Z',
      measurementPoints: [
        {
          id: 1,
          pointName: 'ปล่องระบาย A',
          pointCode: 'STACK-A',
          pointType: 'STACK',
          latitude: null,
          longitude: null,
          parameters: ['NOx'],
          description: null,
        },
      ],
    });
    mockedRepository.list.mockResolvedValue({ rows: [request], total: 1 });
    mockedRepository.findFactorySummariesForRequests.mockResolvedValue(
      new Map([[request.factoryId, factorySummary()]]),
    );
    mockedDeviceConnectionsService.listByRequestId.mockResolvedValue([
      {
        id: 10,
        requestId: 1,
        stationId: 'STACK-A',
        protocol: 'MODBUS_TCP',
        settings: {},
        channels: [],
        statusManagement: null,
        createdBy: actorUserId,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      },
    ]);

    const result = await connectionRequestsService.listConnectedMeasurementPoints(
      {},
      actorUserId,
      'ALL',
    );

    expect(mockedRepository.list).toHaveBeenCalledWith(
      { status: CONNECTION_REQUEST_STATUS.CONNECTED },
      { actorUserId, scope: 'ALL' },
    );
    expect(result.data[0]).toMatchObject({
      requestNo: 'CEMS-69-00001',
      connectedAt: '2026-05-29T10:00:00.000Z',
      point: { pointCode: 'STACK-A' },
    });
  });

  it('creates a request in pending design review status', async () => {
    mockedRepository.create.mockResolvedValue(
      requestDto({
        status: CONNECTION_REQUEST_STATUS.PENDING_DESIGN_REVIEW,
        connectionDueAt: null,
        createdBy: actorUserId,
      }),
    );

    const result = await connectionRequestsService.create(payload, actorUserId);

    expect(mockedRepository.create).toHaveBeenCalledWith(
      payloadWithoutPointCodes,
      actorUserId,
      CONNECTION_REQUEST_STATUS.PENDING_DESIGN_REVIEW,
    );
    expect(result.statusLabel).toBe('รอพิจารณาแบบ');
  });

  it('creates an add measurement point request with the specific request type', async () => {
    mockedRepository.create.mockResolvedValue(
      requestDto({
        requestType: CONNECTION_REQUEST_TYPE.ADD_MEASUREMENT_POINT,
        requestTypeLabel: 'เพิ่มจุดตรวจวัด',
        status: CONNECTION_REQUEST_STATUS.PENDING_DESIGN_REVIEW,
        createdBy: actorUserId,
      }),
    );

    await connectionRequestsService.createMeasurementPointRequest(
      { ...payload, requestType: CONNECTION_REQUEST_TYPE.ADD_MEASUREMENT_POINT },
      actorUserId,
    );

    expect(mockedRepository.create).toHaveBeenCalledWith(
      {
        ...payloadWithoutPointCodes,
        requestType: CONNECTION_REQUEST_TYPE.ADD_MEASUREMENT_POINT,
      },
      actorUserId,
      CONNECTION_REQUEST_STATUS.PENDING_DESIGN_REVIEW,
    );
  });

  it('creates an add parameter request for exactly one measurement point', async () => {
    mockedRepository.create.mockResolvedValue(
      requestDto({
        requestType: CONNECTION_REQUEST_TYPE.ADD_PARAMETER,
        requestTypeLabel: 'เพิ่มพารามิเตอร์',
        createdBy: actorUserId,
      }),
    );

    await connectionRequestsService.createParameterRequest(
      { ...payload, requestType: CONNECTION_REQUEST_TYPE.ADD_PARAMETER },
      actorUserId,
    );

    expect(mockedRepository.create).toHaveBeenCalledWith(
      { ...payload, requestType: CONNECTION_REQUEST_TYPE.ADD_PARAMETER },
      actorUserId,
      CONNECTION_REQUEST_STATUS.PENDING_DESIGN_REVIEW,
    );
  });

  it('moves an approved design to waiting connection with a 30 day due date', async () => {
    mockedRepository.findById.mockResolvedValue(
      requestDto({
        status: CONNECTION_REQUEST_STATUS.PENDING_DESIGN_REVIEW,
        createdBy: actorUserId,
      }),
    );
    mockedRepository.updateStatus.mockResolvedValue(
      requestDto({
        status: CONNECTION_REQUEST_STATUS.WAITING_CONNECTION,
        connectionDueAt: dueAt,
        createdBy: actorUserId,
      }),
    );

    await connectionRequestsService.review(1, { decision: 'APPROVE_DESIGN' }, 7);

    expect(mockedRepository.updateStatus).toHaveBeenCalledWith(
      1,
      CONNECTION_REQUEST_STATUS.WAITING_CONNECTION,
      7,
      {
        officerNote: null,
        revisionReason: null,
        connectionDueAt: dueAt,
      },
    );
  });

  it('moves a request back to factory revision when officer requests changes', async () => {
    mockedRepository.findById.mockResolvedValue(
      requestDto({
        status: CONNECTION_REQUEST_STATUS.PENDING_DESIGN_REVIEW,
        createdBy: actorUserId,
      }),
    );
    mockedRepository.updateStatus.mockResolvedValue(
      requestDto({
        status: CONNECTION_REQUEST_STATUS.WAITING_FACTORY_REVISION,
        createdBy: actorUserId,
      }),
    );

    await connectionRequestsService.review(
      1,
      { decision: 'REQUEST_REVISION', revisionReason: 'เพิ่มรายละเอียดจุดตรวจวัด' },
      7,
    );

    expect(mockedRepository.updateStatus).toHaveBeenCalledWith(
      1,
      CONNECTION_REQUEST_STATUS.WAITING_FACTORY_REVISION,
      7,
      {
        officerNote: null,
        revisionReason: 'เพิ่มรายละเอียดจุดตรวจวัด',
      },
    );
  });

  it('changes status through the form status endpoint action shape', async () => {
    mockedRepository.findById.mockResolvedValue(
      requestDto({
        status: CONNECTION_REQUEST_STATUS.PENDING_DESIGN_REVIEW,
        createdBy: actorUserId,
      }),
    );
    mockedRepository.updateStatus.mockResolvedValue(
      requestDto({
        status: CONNECTION_REQUEST_STATUS.WAITING_CONNECTION,
        connectionDueAt: dueAt,
        createdBy: actorUserId,
      }),
    );

    await connectionRequestsService.changeStatus(1, { action: 'APPROVE_FORM' }, 7);

    expect(mockedRepository.updateStatus).toHaveBeenCalledWith(
      1,
      CONNECTION_REQUEST_STATUS.WAITING_CONNECTION,
      7,
      {
        officerNote: null,
        revisionReason: null,
        connectionDueAt: dueAt,
      },
    );
  });

  it('stores device config only when station belongs to an approved owner request', async () => {
    const deviceConfig = {
      stationId: 'STACK-A',
      protocol: 'MODBUS_TCP' as const,
      settings: { hostIp: '192.168.1.10', slaveId: 1, port: 502 },
      channels: [
        {
          addressId: 40001,
          dataType: 'NOx',
          unit: 'ppm',
          valueRange: { min: 0, max: 200 },
          valueFormat: 'MEASUREMENT_VALUE' as const,
          offset: 0,
          encoding: 'UNSIGNED16_BIG_ENDIAN' as const,
        },
      ],
    };
    mockedRepository.findById.mockResolvedValue(
      requestDto({
        status: CONNECTION_REQUEST_STATUS.WAITING_CONNECTION,
        createdBy: actorUserId,
        measurementPoints: [
          {
            id: 1,
            pointName: 'ปล่องระบาย A',
            pointCode: 'STACK-A',
            pointType: 'STACK',
            latitude: 13.7563,
            longitude: 100.5018,
            parameters: ['NOx'],
            description: null,
          },
        ],
      }),
    );
    mockedDeviceConnectionsService.createForRequest.mockResolvedValue({
      id: 10,
      requestId: 1,
      ...deviceConfig,
      settings: { hostIp: '192.168.1.10', slaveId: 1, port: 502 },
      statusManagement: null,
      createdBy: actorUserId,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    });

    await connectionRequestsService.createDeviceConfig(1, deviceConfig, actorUserId);

    expect(mockedDeviceConnectionsService.createForRequest).toHaveBeenCalledWith(
      deviceConfig,
      actorUserId,
      1,
    );
  });

  it('allows the owner to resubmit a revised form', async () => {
    mockedRepository.findById.mockResolvedValue(
      requestDto({
        status: CONNECTION_REQUEST_STATUS.WAITING_FACTORY_REVISION,
        createdBy: actorUserId,
      }),
    );
    mockedRepository.replaceForm.mockResolvedValue(
      requestDto({
        status: CONNECTION_REQUEST_STATUS.REVISED_PENDING_DESIGN_REVIEW,
        createdBy: actorUserId,
      }),
    );

    await connectionRequestsService.resubmit(1, payload, actorUserId);

    expect(mockedRepository.replaceForm).toHaveBeenCalledWith(
      1,
      { ...payloadWithoutPointCodes, requestType: CONNECTION_REQUEST_TYPE.NEW_CONNECTION },
      actorUserId,
      CONNECTION_REQUEST_STATUS.REVISED_PENDING_DESIGN_REVIEW,
    );
  });

  it('preserves the original request type when resubmitting an add parameter form', async () => {
    const revisedPayload = {
      ...payload,
      measurementPoints: [
        {
          ...payload.measurementPoints[0],
          parameters: ['CO'],
          measurementInstruments: {
            converterBrand: 'Converter Brand',
            converterModel: 'CV-100',
            parameters: [{ parameter: 'CO', technique: 'NDIR' }],
          },
        },
      ],
    };
    mockedRepository.findById.mockResolvedValue(
      requestDto({
        requestType: CONNECTION_REQUEST_TYPE.ADD_PARAMETER,
        status: CONNECTION_REQUEST_STATUS.WAITING_FACTORY_REVISION,
        createdBy: actorUserId,
      }),
    );
    mockedRepository.replaceForm.mockResolvedValue(
      requestDto({
        requestType: CONNECTION_REQUEST_TYPE.ADD_PARAMETER,
        status: CONNECTION_REQUEST_STATUS.REVISED_PENDING_DESIGN_REVIEW,
        createdBy: actorUserId,
      }),
    );

    await connectionRequestsService.resubmit(1, revisedPayload, actorUserId);

    expect(mockedRepository.replaceForm).toHaveBeenCalledWith(
      1,
      { ...revisedPayload, requestType: CONNECTION_REQUEST_TYPE.ADD_PARAMETER },
      actorUserId,
      CONNECTION_REQUEST_STATUS.REVISED_PENDING_DESIGN_REVIEW,
    );
  });

  it('rejects resubmitting an add parameter form without measurement instruments', async () => {
    mockedRepository.findById.mockResolvedValue(
      requestDto({
        requestType: CONNECTION_REQUEST_TYPE.ADD_PARAMETER,
        status: CONNECTION_REQUEST_STATUS.WAITING_FACTORY_REVISION,
        createdBy: actorUserId,
      }),
    );

    await expect(connectionRequestsService.resubmit(1, payload, actorUserId)).rejects.toMatchObject(
      {
        code: 'BAD_REQUEST',
      },
    );
  });

  it('rejects connection confirmation after the 30 day due date', async () => {
    mockedRepository.findById.mockResolvedValue(
      requestDto({
        status: CONNECTION_REQUEST_STATUS.WAITING_CONNECTION,
        connectionDueAt: '2026-05-01T00:00:00.000Z',
        createdBy: actorUserId,
      }),
    );

    await expect(
      connectionRequestsService.confirmConnection(
        1,
        { confirmedAt: now.toISOString() },
        actorUserId,
      ),
    ).rejects.toMatchObject({ code: 'BAD_REQUEST' });
  });

  it('saves connection confirmation progress without changing to confirmed status', async () => {
    mockedRepository.findById.mockResolvedValue(
      requestDto({
        status: CONNECTION_REQUEST_STATUS.WAITING_CONNECTION,
        connectionDueAt: '2026-06-30T00:00:00.000Z',
        createdBy: actorUserId,
      }),
    );
    mockedRepository.updateStatus.mockResolvedValue(
      requestDto({
        status: CONNECTION_REQUEST_STATUS.WAITING_CONNECTION,
        createdBy: actorUserId,
      }),
    );

    await connectionRequestsService.confirmConnection(
      1,
      { action: 'SAVE', note: 'บันทึก config ชั่วคราว' },
      actorUserId,
    );

    expect(mockedRepository.updateStatus).toHaveBeenCalledWith(
      1,
      CONNECTION_REQUEST_STATUS.WAITING_CONNECTION,
      actorUserId,
      {
        officerNote: 'บันทึก config ชั่วคราว',
      },
    );
  });

  it('confirms connection when operator submits confirm action', async () => {
    mockedRepository.findById.mockResolvedValue(
      requestDto({
        status: CONNECTION_REQUEST_STATUS.WAITING_CONNECTION,
        connectionDueAt: '2026-06-30T00:00:00.000Z',
        createdBy: actorUserId,
      }),
    );
    mockedRepository.updateStatus.mockResolvedValue(
      requestDto({
        status: CONNECTION_REQUEST_STATUS.CONNECTION_CONFIRMED,
        createdBy: actorUserId,
      }),
    );

    await connectionRequestsService.confirmConnection(
      1,
      { action: 'CONFIRM', confirmedAt: now.toISOString(), note: 'ยืนยันแล้ว' },
      actorUserId,
    );

    expect(mockedRepository.updateStatus).toHaveBeenCalledWith(
      1,
      CONNECTION_REQUEST_STATUS.CONNECTION_CONFIRMED,
      actorUserId,
      {
        confirmedAt: now.toISOString(),
        officerNote: 'ยืนยันแล้ว',
      },
    );
  });

  it('moves confirmed requests to connected after officer verification', async () => {
    mockedRepository.findById.mockResolvedValue(
      requestDto({
        status: CONNECTION_REQUEST_STATUS.CONNECTION_CONFIRMED,
        createdBy: actorUserId,
      }),
    );
    mockedRepository.updateStatus.mockResolvedValue(
      requestDto({
        status: CONNECTION_REQUEST_STATUS.CONNECTED,
        createdBy: actorUserId,
      }),
    );

    await connectionRequestsService.verifyConnection(
      1,
      { verifiedAt: '2026-05-27T11:00:00.000Z' },
      7,
    );

    expect(mockedRepository.updateStatus).toHaveBeenCalledWith(
      1,
      CONNECTION_REQUEST_STATUS.CONNECTED,
      7,
      {
        verifiedAt: '2026-05-27T11:00:00.000Z',
        officerNote: null,
      },
    );
  });
});

function requestDto(overrides: Partial<ConnectionRequestDTO> = {}): ConnectionRequestDTO {
  return {
    id: 1,
    requestNo: 'CEMS-69-00001',
    requestType: CONNECTION_REQUEST_TYPE.NEW_CONNECTION,
    requestTypeLabel: 'ขอเชื่อมต่อใหม่',
    factoryId: 'factory-001',
    factoryName: 'บริษัท ทดสอบ จำกัด',
    factoryRegistrationNo: '3-106-33/50สบ',
    industryMainOrder: '106',
    industrySubOrder: '33',
    businessActivity: 'ผลิตเคมีภัณฑ์',
    eia: 'มี',
    hasEia: true,
    projectName: 'โครงการทดสอบ CEMS',
    address: '99 หมู่ 1 ตำบลทดสอบ อำเภอเมือง จังหวัดสระบุรี',
    latitude: 13.7563,
    longitude: 100.5018,
    systemType: 'CEMS',
    status: CONNECTION_REQUEST_STATUS.PENDING_DESIGN_REVIEW,
    statusLabel: 'รอพิจารณาแบบ',
    contactName: 'สมชาย ใจดี',
    contactPhone: '0812345678',
    contactEmail: 'ops@example.com',
    contactPersons: [
      {
        name: 'สมชาย ใจดี',
        phone: '0812345678',
        email: 'ops@example.com',
        position: 'ผู้จัดการสิ่งแวดล้อม',
      },
    ],
    notificationEmails: ['ops@example.com'],
    officerNotificationEmails: ['officer@example.com'],
    remarks: null,
    revisionReason: null,
    officerNote: null,
    connectionDueAt: null,
    confirmedAt: null,
    verifiedAt: null,
    measurementPoints: [],
    statusHistory: [],
    createdBy: 42,
    createdAt: '2026-05-27T10:00:00.000Z',
    updatedAt: '2026-05-27T10:00:00.000Z',
    ...overrides,
  };
}

function factorySummary(overrides: Partial<FactorySummaryDTO> = {}): FactorySummaryDTO {
  return {
    id: 1,
    factoryId: 'factory-001',
    factoryName: 'บริษัท ทดสอบ จำกัด',
    newRegistrationNo: '3-106-33/50สบ',
    oldRegistrationNo: null,
    industryType: 'ผลิตเคมีภัณฑ์',
    industryMainOrder: '106',
    industrySubOrder: '33',
    businessActivity: 'ผลิตเคมีภัณฑ์',
    eia: 'มี',
    projectName: null,
    address: '99 หมู่ 1',
    latitude: '13.7563',
    longitude: '100.5018',
    province: 'สระบุรี',
    isEligible: true,
    eligibilityStatus: 'เข้าข่าย',
    ...overrides,
  };
}

function factoryGeneral(overrides: Partial<FactoryGeneralDTO> = {}): FactoryGeneralDTO {
  return {
    ...factorySummary(),
    juristicId: '0105556125804',
    juristicName: 'บริษัท ทดสอบ จำกัด',
    industrialEstateName: null,
    systemId: 12,
    systemDetail: 'ผลิตเคมีภัณฑ์',
    verifyStatus: 1,
    authorizeStart: '2026-01-01',
    authorizeEnd: '2026-12-31',
    operationStatus: 'ประกอบกิจการ',
    capitalAmount: 1000000,
    machineryHorsepower: 250,
    productionCapacity: '10 ตัน/วัน',
    wastewaterDischargeInfo: 'ระบายน้ำทิ้งหลังบำบัด',
    boilerCount: 1,
    boilerSizeEach: '10 ตันไอน้ำ/ชั่วโมง',
    fuelUsed: 'ก๊าซธรรมชาติ',
    hasEia: true,
    formDefaults: {
      factoryId: 'factory-001',
      factoryName: 'บริษัท ทดสอบ จำกัด',
      factoryRegistrationNo: '3-106-33/50สบ',
    },
    ...overrides,
  };
}
