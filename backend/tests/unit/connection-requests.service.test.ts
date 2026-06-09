import { beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('../../src/modules/connection-requests/connection-requests.repository', () => ({
  connectionRequestsRepository: {
    create: jest.fn(),
    findById: jest.fn(),
    findFactorySummariesForRequests: jest.fn(),
    replaceForm: jest.fn(),
    syncConnectedMeasurementPoints: jest.fn(),
    updateStatus: jest.fn(),
    list: jest.fn(),
    listFactoriesForAccess: jest.fn(),
    findFactoryGeneral: jest.fn(),
    listConnectedMeasurementPointsForFactories: jest.fn(),
    listFavoriteFactoryIds: jest.fn(),
    listRequestsForFactories: jest.fn(),
    setFactoryFavorite: jest.fn(),
  },
}));

jest.mock('../../src/modules/device-connections/device-connections.service', () => ({
  deviceConnectionsService: {
    create: jest.fn(),
    createMany: jest.fn(),
    createForRequest: jest.fn(),
    createManyForRequest: jest.fn(),
    listActiveSettings: jest.fn(),
    listByRequestId: jest.fn(),
  },
}));

jest.mock('../../src/modules/parameter-values/parameter-values.service', () => ({
  parameterValuesService: {
    calendarStatus: jest.fn(),
    latestHourly: jest.fn(),
  },
}));

jest.mock('../../src/config/logger', () => ({
  logger: {
    warn: jest.fn(),
  },
}));

import { deviceConnectionsService } from '../../src/modules/device-connections/device-connections.service';
import type { DeviceConnectionConfigDTO } from '../../src/modules/device-connections/device-connections.types';
import { parameterValuesService } from '../../src/modules/parameter-values/parameter-values.service';
import { logger } from '../../src/config/logger';
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
const mockedParameterValuesService = jest.mocked(parameterValuesService);
const mockedLogger = jest.mocked(logger);

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
    mockedRepository.listFavoriteFactoryIds.mockResolvedValue([]);
    mockedRepository.listConnectedMeasurementPointsForFactories.mockResolvedValue([]);
    mockedDeviceConnectionsService.listActiveSettings.mockResolvedValue([]);
    mockedDeviceConnectionsService.listByRequestId.mockResolvedValue([]);
    mockedDeviceConnectionsService.create.mockResolvedValue(deviceConnectionConfig());
    mockedDeviceConnectionsService.createMany.mockResolvedValue([deviceConnectionConfig()]);
    mockedParameterValuesService.latestHourly.mockResolvedValue({
      data: [],
      meta: {
        stationId: 'S0001',
        interval: '60m',
        schemaName: 'ingest',
        tableName: 'S0001_data_60m',
        count: 0,
        registeredParameters: [],
        returnedColumns: [],
      },
    });
    mockedParameterValuesService.calendarStatus.mockResolvedValue({
      data: {
        metadata: {
          description: 'DateCalendar และตารางสรุปสถานะรายเดือนของโรงงาน',
          month: '2026-06',
          valueDefinitions: {},
        },
        calendar: {
          year: 2026,
          month: 6,
          days: [],
        },
        monthlySummary: [],
      },
      meta: {
        stationId: 'S0001',
        interval: '60m',
        schemaName: 'ingest',
        tableName: 'S0001_data_60m',
        month: '2026-06',
        count: 0,
        registeredParameters: [],
      },
    });
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

  it('passes stationId filters through request table rows for selected monitoring point history', async () => {
    mockedRepository.list.mockResolvedValue({ rows: [], total: 0 });
    mockedRepository.findFactorySummariesForRequests.mockResolvedValue(new Map());

    await connectionRequestsService.listTableRows({ stationId: 'STACK-A' }, actorUserId, 'ALL');

    expect(mockedRepository.list).toHaveBeenCalledWith(
      { stationId: 'STACK-A' },
      { actorUserId, scope: 'ALL' },
    );
  });

  it('returns request details for selected monitoring point history', async () => {
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
    mockedRepository.list.mockResolvedValue({ rows: [request], total: 1 });
    mockedRepository.findFactorySummariesForRequests.mockResolvedValue(
      new Map([[request.factoryId, factorySummary()]]),
    );
    mockedDeviceConnectionsService.listByRequestId.mockResolvedValue([
      deviceConnectionConfig({
        requestId: request.id,
        stationId: 'STACK-A',
        deviceCode: 'STACK-A/01',
      }),
    ]);

    const result = await connectionRequestsService.listDetails(
      { stationId: 'STACK-A' },
      actorUserId,
      'ALL',
    );

    expect(mockedRepository.list).toHaveBeenCalledWith(
      { stationId: 'STACK-A' },
      { actorUserId, scope: 'ALL' },
    );
    expect(result.data[0]).toMatchObject({
      id: 1,
      requestNo: 'CEMS-69-00001',
      factory: {
        factoryId: 'factory-001',
      },
      measurementPoints: [{ pointCode: 'STACK-A' }],
      deviceConfigs: [
        {
          stationId: 'STACK-A',
          device: [{ deviceCode: 'STACK-A/01' }],
        },
      ],
    });
    expect(result.meta.total).toBe(1);
  });

  it('returns operator factories in the original table response shape', async () => {
    mockedRepository.listFactoriesForAccess.mockResolvedValue([factorySummary()]);
    mockedRepository.listRequestsForFactories.mockResolvedValue([
      requestDto({
        status: CONNECTION_REQUEST_STATUS.CONNECTED,
        measurementPoints: [
          {
            id: 1,
            pointName: 'ปล่องระบาย A',
            pointCode: 'S0001',
            pointType: 'STACK',
            latitude: 13.7563,
            longitude: 100.5018,
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
    expect(mockedRepository.listRequestsForFactories).toHaveBeenCalledWith(['factory-001']);
    expect(mockedRepository.listFavoriteFactoryIds).not.toHaveBeenCalled();
    expect(mockedRepository.listConnectedMeasurementPointsForFactories).not.toHaveBeenCalled();
    expect(mockedParameterValuesService.latestHourly).not.toHaveBeenCalled();
    expect(result.data[0]).toEqual({
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
      monitoringPointCount: 1,
      requestStatusCode: CONNECTION_REQUEST_STATUS.CONNECTED,
      status: 'แสดง',
    });
    expect(result.data[0]).not.toHaveProperty('measurementPoints');
    expect(result.data[0]).not.toHaveProperty('monitoringPointCountBySystem');
  });

  it('returns only visible operator factories in the dashboard response shape', async () => {
    mockedRepository.listFactoriesForAccess.mockResolvedValue([factorySummary()]);
    mockedRepository.listFavoriteFactoryIds.mockResolvedValue(['factory-001']);
    mockedParameterValuesService.latestHourly.mockResolvedValueOnce({
      data: [
        {
          station_id: 'NB-C21',
          cdate: '2026-02-25',
          ctime: '22.00-22.59 น.',
          co_value: 0.05,
          nox_value: 10.54,
          temp_value: 93.35,
          o2_value: 12.58,
          flow_value: 1981710,
        },
      ],
      meta: {
        stationId: 'S0001',
        interval: '60m',
        schemaName: 'ingest',
        tableName: 'S0001_data_60m',
        count: 1,
        registeredParameters: ['CO', 'NOx', 'Temp', 'O2', 'Flow'],
        returnedColumns: [
          'station_id',
          'cdate',
          'ctime',
          'co_value',
          'nox_value',
          'temp_value',
          'o2_value',
          'flow_value',
        ],
      },
    });
    mockedRepository.listConnectedMeasurementPointsForFactories.mockResolvedValue([
      {
        factoryId: 'factory-001',
        stationId: 'S0001',
        pointName: 'ปล่องระบาย A',
        pointCode: 'S0001',
        systemType: 'CEMS',
        parameters: ['CO', 'NOx', 'Temp', 'O2', 'Flow'],
        data: [],
      },
    ]);

    const result = await connectionRequestsService.listOperatorFactoryDashboard(
      actorUserId,
      'OWN_FACTORY',
    );

    expect(mockedRepository.listFactoriesForAccess).toHaveBeenCalledWith({
      actorUserId,
      scope: 'OWN_FACTORY',
    });
    expect(mockedRepository.listConnectedMeasurementPointsForFactories).toHaveBeenCalledWith(
      expect.arrayContaining(['factory-001', '3-106-33/50สบ']),
    );
    expect(mockedRepository.listRequestsForFactories).not.toHaveBeenCalled();
    expect(result.data[0]).toMatchObject({
      id: 1,
      factoryId: 'factory-001',
      factoryName: 'บริษัท ทดสอบ จำกัด',
      newRegistrationNo: '3-106-33/50สบ',
      province: 'สระบุรี',
      address: '99 หมู่ 1',
      latitude: '13.7563',
      longitude: '100.5018',
      isFavorite: true,
      monitoringPointCountBySystem: [
        { systemType: 'CEMS', count: 1 },
        { systemType: 'WPMS', count: 0 },
      ],
      status: 'แสดง',
      measurementPoints: [
        {
          stationId: 'S0001',
          pointName: 'ปล่องระบาย A',
          pointCode: 'S0001',
          systemType: 'CEMS',
          parameters: ['CO (ppm)', 'NOx (ppm)', 'Temp. (°C)', 'O2 (%)', 'Flow (m3/hr)'],
          data: [
            {
              station_id: 'NB-C21',
              cdate: '2026-02-25',
              ctime: '22.00-22.59 น.',
              'CO (ppm)': 0.05,
              'NOx (ppm)': 10.54,
              'Temp. (°C)': 93.35,
              'O2 (%)': 12.58,
              'Flow (m3/hr)': 1981710,
            },
          ],
        },
      ],
    });
    expect(mockedParameterValuesService.latestHourly).toHaveBeenCalledWith('S0001', {
      actorUserId,
      scope: 'OWN_FACTORY',
    });
    expect(result.data[0]).not.toHaveProperty('requestStatus');
    expect(result.data[0]).not.toHaveProperty('requestStatusCode');
    expect(result.data[0]).not.toHaveProperty('systemTypes');
    expect(result.data[0].measurementPoints[0]).not.toHaveProperty('requestId');
    expect(result.data[0].measurementPoints[0]).not.toHaveProperty('latestHourlyMeasurement');
  });

  it('filters operator factories by requested CEMS or WPMS system type', async () => {
    mockedRepository.listFactoriesForAccess.mockResolvedValue([
      factorySummary({ factoryId: 'factory-cems', factoryName: 'โรงงาน CEMS' }),
      factorySummary({ factoryId: 'factory-wpms', factoryName: 'โรงงาน WPMS' }),
    ]);
    mockedRepository.listConnectedMeasurementPointsForFactories.mockResolvedValue([
      {
        factoryId: 'factory-cems',
        stationId: 'S0001',
        pointName: 'ปล่อง A',
        pointCode: 'S0001',
        systemType: 'CEMS',
        parameters: ['NOx'],
        data: [],
      },
      {
        factoryId: 'factory-wpms',
        stationId: 'P0001',
        pointName: 'น้ำทิ้ง A',
        pointCode: 'P0001',
        systemType: 'WPMS',
        parameters: ['BOD'],
        data: [],
      },
    ]);

    const result = await connectionRequestsService.listOperatorFactoryDashboard(
      actorUserId,
      'OWN_FACTORY',
      { systemType: 'WPMS' },
    );

    expect(result.data).toHaveLength(1);
    expect(result.data[0]).toMatchObject({
      factoryId: 'factory-wpms',
      status: 'แสดง',
      measurementPoints: [{ stationId: 'P0001', systemType: 'WPMS' }],
    });
  });

  it('matches connected measurement points by factory registration aliases', async () => {
    mockedRepository.listFactoriesForAccess.mockResolvedValue([
      factorySummary({
        factoryId: 'factory-001',
        newRegistrationNo: 'REG-001',
        oldRegistrationNo: 'OLD-001',
      }),
    ]);
    mockedRepository.listConnectedMeasurementPointsForFactories.mockResolvedValue([
      {
        factoryId: 'REG-001',
        stationId: 'S0001',
        pointName: 'ปล่อง A',
        pointCode: 'S0001',
        systemType: 'CEMS',
        parameters: ['NOx'],
        data: [],
      },
    ]);

    const result = await connectionRequestsService.listOperatorFactoryDashboard(
      actorUserId,
      'OWN_FACTORY',
    );

    expect(mockedRepository.listConnectedMeasurementPointsForFactories).toHaveBeenCalledWith([
      'factory-001',
      'REG-001',
      'OLD-001',
    ]);
    expect(result.data).toHaveLength(1);
    expect(result.data[0]).toMatchObject({
      factoryId: 'factory-001',
      newRegistrationNo: 'REG-001',
      measurementPoints: [{ stationId: 'S0001' }],
    });
  });

  it('keeps factory rows loadable when latest hourly parameter values fail', async () => {
    mockedRepository.listFactoriesForAccess.mockResolvedValue([factorySummary()]);
    mockedRepository.listConnectedMeasurementPointsForFactories.mockResolvedValue([
      {
        factoryId: 'factory-001',
        stationId: 'S0001',
        pointName: 'ปล่องระบาย A',
        pointCode: 'S0001',
        systemType: 'CEMS',
        parameters: ['NOx'],
        data: [],
      },
    ]);
    mockedParameterValuesService.latestHourly.mockRejectedValueOnce(
      new Error('parameter source database unavailable'),
    );

    const result = await connectionRequestsService.listOperatorFactoryDashboard(
      actorUserId,
      'OWN_FACTORY',
    );

    expect(result.data[0]?.measurementPoints[0]).toMatchObject({
      stationId: 'S0001',
      data: [],
    });
    expect(mockedLogger.warn).toHaveBeenCalledWith(
      '[operator-factories] Failed to load latest hourly measurement values',
      expect.objectContaining({
        stationId: 'S0001',
        reason: 'parameter source database unavailable',
      }),
    );
  });

  it('excludes factories whose display status is hidden', async () => {
    mockedRepository.listFactoriesForAccess.mockResolvedValue([
      factorySummary({ factoryId: 'factory-visible', factoryName: 'โรงงานแสดง', isActive: true }),
      factorySummary({ factoryId: 'factory-hidden', factoryName: 'โรงงานซ่อน', isActive: false }),
    ]);
    mockedRepository.listConnectedMeasurementPointsForFactories.mockResolvedValue([
      {
        factoryId: 'factory-visible',
        stationId: 'S0001',
        pointName: 'ปล่อง A',
        pointCode: 'S0001',
        systemType: 'CEMS',
        parameters: ['NOx'],
        data: [],
      },
      {
        factoryId: 'factory-hidden',
        stationId: 'S0002',
        pointName: 'ปล่อง B',
        pointCode: 'S0002',
        systemType: 'CEMS',
        parameters: ['NOx'],
        data: [],
      },
    ]);

    const result = await connectionRequestsService.listOperatorFactoryDashboard(
      actorUserId,
      'OWN_FACTORY',
    );

    expect(result.data).toHaveLength(1);
    expect(result.data[0]).toMatchObject({
      factoryId: 'factory-visible',
      status: 'แสดง',
    });
  });

  it('keeps eligible visible factories without connected measurement points by default', async () => {
    mockedRepository.listFactoriesForAccess.mockResolvedValue([
      factorySummary({ factoryId: 'factory-connected', factoryName: 'โรงงานมีจุดตรวจวัด' }),
      factorySummary({ factoryId: 'factory-without-point', factoryName: 'โรงงานไม่มีจุดตรวจวัด' }),
    ]);
    mockedRepository.listConnectedMeasurementPointsForFactories.mockResolvedValue([
      {
        factoryId: 'factory-connected',
        stationId: 'S0001',
        pointName: 'ปล่อง A',
        pointCode: 'S0001',
        systemType: 'CEMS',
        parameters: ['NOx'],
        data: [],
      },
    ]);

    const result = await connectionRequestsService.listOperatorFactoryDashboard(
      actorUserId,
      'OWN_FACTORY',
    );

    expect(result.data).toHaveLength(2);
    expect(result.data[0]).toMatchObject({
      factoryId: 'factory-connected',
      measurementPoints: [{ stationId: 'S0001' }],
    });
    expect(result.data[1]).toMatchObject({
      factoryId: 'factory-without-point',
      measurementPoints: [],
    });
  });

  it('excludes factories without connected measurement points when connectedOnly is requested', async () => {
    mockedRepository.listFactoriesForAccess.mockResolvedValue([
      factorySummary({ factoryId: 'factory-connected', factoryName: 'โรงงานมีจุดตรวจวัด' }),
      factorySummary({ factoryId: 'factory-without-point', factoryName: 'โรงงานไม่มีจุดตรวจวัด' }),
    ]);
    mockedRepository.listConnectedMeasurementPointsForFactories.mockResolvedValue([
      {
        factoryId: 'factory-connected',
        stationId: 'S0001',
        pointName: 'ปล่อง A',
        pointCode: 'S0001',
        systemType: 'CEMS',
        parameters: ['NOx'],
        data: [],
      },
    ]);

    const result = await connectionRequestsService.listOperatorFactoryDashboard(
      actorUserId,
      'OWN_FACTORY',
      { connectedOnly: true },
    );

    expect(result.data).toHaveLength(1);
    expect(result.data[0]).toMatchObject({
      factoryId: 'factory-connected',
      measurementPoints: [{ stationId: 'S0001' }],
    });
  });

  it('excludes factories that are not selected as eligible before displaying operator factories', async () => {
    mockedRepository.listFactoriesForAccess.mockResolvedValue([
      factorySummary({ factoryId: 'factory-eligible', factoryName: 'โรงงานเข้าข่าย' }),
      factorySummary({
        factoryId: 'factory-ineligible',
        factoryName: 'โรงงานไม่เข้าข่าย',
        isEligible: false,
        eligibilityStatus: 'ไม่เข้าข่าย',
      }),
    ]);
    mockedRepository.listConnectedMeasurementPointsForFactories.mockResolvedValue([
      {
        factoryId: 'factory-eligible',
        stationId: 'S0001',
        pointName: 'ปล่อง A',
        pointCode: 'S0001',
        systemType: 'CEMS',
        parameters: ['NOx'],
        data: [],
      },
    ]);

    const result = await connectionRequestsService.listOperatorFactoryDashboard(
      actorUserId,
      'OWN_FACTORY',
    );

    expect(mockedRepository.listConnectedMeasurementPointsForFactories).toHaveBeenCalledWith(
      expect.arrayContaining(['factory-eligible', '3-106-33/50สบ']),
    );
    expect(result.data).toHaveLength(1);
    expect(result.data[0]).toMatchObject({
      factoryId: 'factory-eligible',
      status: 'แสดง',
    });
  });

  it('toggles factory favorites only after resolving the factory through the actor access scope', async () => {
    mockedRepository.findFactoryGeneral.mockResolvedValue(factoryGeneral());
    mockedRepository.setFactoryFavorite.mockResolvedValue({
      factoryId: 'factory-001',
      isFavorite: true,
    });

    const result = await connectionRequestsService.setOperatorFactoryFavorite(
      'factory-001',
      true,
      actorUserId,
      'OWN_FACTORY',
    );

    expect(mockedRepository.findFactoryGeneral).toHaveBeenCalledWith('factory-001', {
      actorUserId,
      scope: 'OWN_FACTORY',
    });
    expect(mockedRepository.setFactoryFavorite).toHaveBeenCalledWith(
      actorUserId,
      'factory-001',
      true,
    );
    expect(result).toEqual({ factoryId: 'factory-001', isFavorite: true });
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
    expect(result.deviceConfigs[0]).toMatchObject({
      stationId: 'STACK-A',
      device: [
        {
          protocol: 'MODBUS_TCP',
          settings: { hostIp: '192.168.1.10', slaveId: 1, port: 502 },
        },
      ],
      channels: [],
    });
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
            dataType: 'NOx (ppm)',
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
      parameterOptions: ['NOx', 'NOx (ppm)'],
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
          parameter: 'NOx (ppm)',
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
    expect(Object.keys(result.rawConfigs)).toEqual([
      'stationId',
      'device',
      'channels',
      'statusManagement',
    ]);
    expect(result.rawConfigs.device[0]).toMatchObject({
      deviceCode: 'STACK-A/RTU-01',
      protocol: 'MODBUS_RTU',
      settings: {
        comPort: 1,
        slaveId: 1,
      },
    });
    expect(result.rawConfigs.channels[0]).toMatchObject({
      deviceCode: 'STACK-A/RTU-01',
      addressId: 40001,
      dataType: 'NOx (ppm)',
    });
    expect(result.rawConfigs.channels[0]).not.toHaveProperty('unit');
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

  it('returns add parameter form defaults from latest connected request for selected station', async () => {
    const request = requestDto({
      status: CONNECTION_REQUEST_STATUS.CONNECTED,
      statusLabel: 'เชื่อมต่อแล้ว',
      createdBy: actorUserId,
      measurementPoints: [
        {
          id: 1,
          pointName: 'ปล่องระบาย A',
          pointCode: 'STACK-A',
          pointType: 'STACK',
          latitude: 13.7563,
          longitude: 100.5018,
          parameters: ['NOx', 'SO2'],
          description: 'จุดเดิม',
          details: { stackShape: 'วงกลม' },
          documentsAndImages: [{ title: 'ภาพปล่อง' }],
          measurementInstruments: {
            converterBrand: 'ACME',
            converterModel: 'CEMS-1',
            parameters: [{ parameter: 'NOx' }],
          },
        },
      ],
    });
    mockedRepository.list.mockResolvedValue({ rows: [request], total: 1 });

    const result = await connectionRequestsService.getAddParameterFormDetail(
      'STACK-A',
      actorUserId,
      'OWN_FACTORY',
    );

    expect(mockedRepository.list).toHaveBeenCalledWith(
      { stationId: 'STACK-A', status: CONNECTION_REQUEST_STATUS.CONNECTED },
      { actorUserId, scope: 'OWN_FACTORY' },
    );
    expect(result).toMatchObject({
      requestType: CONNECTION_REQUEST_TYPE.ADD_PARAMETER,
      sourceRequestId: 1,
      sourceRequestNo: 'CEMS-69-00001',
      stationId: 'STACK-A',
      formDefaults: {
        requestType: CONNECTION_REQUEST_TYPE.ADD_PARAMETER,
        factoryId: 'factory-001',
        systemType: 'CEMS',
        measurementPoints: [
          {
            pointCode: 'STACK-A',
            pointName: 'ปล่องระบาย A',
            parameters: ['NOx', 'SO2'],
            details: { stackShape: 'วงกลม' },
            measurementInstruments: {
              converterBrand: 'ACME',
            },
          },
        ],
      },
    });
  });

  it('returns current device config form detail from active settings for selected station', async () => {
    const request = requestDto({
      createdBy: actorUserId,
      status: CONNECTION_REQUEST_STATUS.CONNECTED,
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
    mockedDeviceConnectionsService.listActiveSettings.mockResolvedValue([
      deviceConnectionConfig({
        id: 20,
        stationId: 'STACK-A',
        deviceCode: 'STACK-A/TCP-01',
        channels: [{ addressId: 40001, dataType: 'NOx', offset: 0 }],
      }),
    ]);

    const result = await connectionRequestsService.getCurrentDeviceConfigFormDetail(
      'STACK-A',
      actorUserId,
      'ALL',
    );

    expect(mockedDeviceConnectionsService.listActiveSettings).toHaveBeenCalledWith({
      stationId: 'STACK-A',
    });
    expect(result).toMatchObject({
      requestId: 1,
      stationId: 'STACK-A',
      connectionForms: [{ configId: 20, deviceCode: 'STACK-A/TCP-01' }],
      rawConfigs: {
        stationId: 'STACK-A',
        device: [{ deviceCode: 'STACK-A/TCP-01', protocol: 'MODBUS_TCP' }],
      },
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
    expect(mockedDeviceConnectionsService.listActiveSettings).toHaveBeenCalledWith({
      stationId: 'STACK-A',
    });
    expect(result.data[0]).toMatchObject({
      requestNo: 'CEMS-69-00001',
      connectedAt: '2026-05-29T10:00:00.000Z',
      point: { pointCode: 'STACK-A' },
    });
  });

  it('filters connected measurement point details by stationId', async () => {
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
        {
          id: 2,
          pointName: 'ปล่องระบาย B',
          pointCode: 'STACK-B',
          pointType: 'STACK',
          latitude: null,
          longitude: null,
          parameters: ['SO2'],
          description: null,
        },
      ],
    });
    mockedRepository.list.mockResolvedValue({ rows: [request], total: 1 });
    mockedRepository.findFactorySummariesForRequests.mockResolvedValue(
      new Map([[request.factoryId, factorySummary()]]),
    );

    const result = await connectionRequestsService.listConnectedMeasurementPoints(
      { factoryId: 'factory-001', stationId: 'STACK-B' },
      actorUserId,
      'ALL',
    );

    expect(mockedRepository.list).toHaveBeenCalledWith(
      { factoryId: 'factory-001', status: CONNECTION_REQUEST_STATUS.CONNECTED },
      { actorUserId, scope: 'ALL' },
    );
    expect(mockedDeviceConnectionsService.listActiveSettings).toHaveBeenCalledTimes(1);
    expect(mockedDeviceConnectionsService.listActiveSettings).toHaveBeenCalledWith({
      stationId: 'STACK-B',
    });
    expect(result).toMatchObject({
      data: [{ point: { pointCode: 'STACK-B' } }],
      meta: { total: 1 },
    });
  });

  it('passes measurement criteria and device channel health to connected calendar status', async () => {
    const standardCriteria = {
      enabled: false,
      standardValue: null,
      rows: [
        { level: 'normal', min: 0, max: null },
        { level: 'warning', min: 80, max: null },
        { level: 'critical', min: 100, max: null },
      ],
    };
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
          parameters: ['CO (ppm)', 'NOx (ppm)'],
          description: null,
          measurementInstruments: {
            converterBrand: null,
            converterModel: null,
            parameters: [
              {
                parameter: 'CO (ppm)',
                technique: null,
                range: null,
                brand: null,
                supplier: null,
                eiaStandard: null,
                standardCondition: null,
                dryBasis: null,
                oxygenOrExcessAir: null,
                standardCriteria,
                eiaCriteria: null,
              },
              {
                parameter: 'NOx (ppm)',
                technique: null,
                range: null,
                brand: null,
                supplier: null,
                eiaStandard: null,
                standardCondition: null,
                dryBasis: null,
                oxygenOrExcessAir: null,
                standardCriteria: null,
                eiaCriteria: null,
              },
            ],
          },
        },
      ],
    });
    mockedRepository.list.mockResolvedValue({ rows: [request], total: 1 });
    mockedRepository.findFactorySummariesForRequests.mockResolvedValue(
      new Map([[request.factoryId, factorySummary()]]),
    );
    mockedDeviceConnectionsService.listActiveSettings.mockResolvedValue([
      deviceConnectionConfig({
        stationId: 'STACK-A',
        channels: [
          {
            addressId: 40001,
            dataType: 'CO (ppm)',
            valueRange: { min: 0, max: 200 },
            valueFormat: 'MEASUREMENT_VALUE',
            offset: 0,
            encoding: 'UNSIGNED16_BIG_ENDIAN',
            status: 'Normal',
          },
          {
            addressId: 40002,
            dataType: 'NOx (ppm)',
            valueRange: { min: 0, max: 200 },
            valueFormat: 'MEASUREMENT_VALUE',
            offset: 0,
            encoding: 'UNSIGNED16_BIG_ENDIAN',
            status: 'Maintenance',
          },
        ],
      }),
    ]);

    const result = await connectionRequestsService.getCalendarStatus(
      'STACK-A',
      { month: '2026-06' },
      actorUserId,
      'ALL',
    );

    expect(mockedParameterValuesService.calendarStatus).toHaveBeenCalledWith(
      { stationId: 'STACK-A', month: '2026-06' },
      { actorUserId, scope: 'ALL' },
      {
        parameterEvaluations: [
          {
            parameter: 'CO (ppm)',
            standardCriteria,
            eiaCriteria: null,
            channelStatus: 'Normal',
          },
          {
            parameter: 'NOx (ppm)',
            standardCriteria: null,
            eiaCriteria: null,
            channelStatus: 'Maintenance',
          },
        ],
      },
    );
    expect(result.data.factory).toEqual({
      factoryId: 'factory-001',
      factoryName: 'บริษัท ทดสอบ จำกัด',
      systemType: 'CEMS',
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
    const addParameterPayload = {
      ...payload,
      requestType: CONNECTION_REQUEST_TYPE.ADD_PARAMETER,
      measurementPoints: [
        {
          ...payload.measurementPoints[0],
          parameters: ['CO'],
          details: {
            stackShape: 'วงกลม',
            stackDiameter: 1.2,
            connectionDevice: 'POMS Box (กรอ.)',
          },
          documentsAndImages: [
            {
              title: 'ภาพถ่ายปล่อง',
              fileName: 'stack.png',
              fileUrl: 'https://example.com/files/stack.png',
              fileType: 'image/png',
              fileSize: 1024,
            },
          ],
          measurementInstruments: {
            converterBrand: 'Converter Brand',
            converterModel: 'CV-100',
            parameters: [{ parameter: 'CO', technique: 'NDIR' }],
          },
        },
      ],
    };
    mockedRepository.create.mockResolvedValue(
      requestDto({
        requestType: CONNECTION_REQUEST_TYPE.ADD_PARAMETER,
        requestTypeLabel: 'เพิ่มพารามิเตอร์',
        createdBy: actorUserId,
      }),
    );

    await connectionRequestsService.createParameterRequest(addParameterPayload, actorUserId);

    expect(mockedRepository.create).toHaveBeenCalledWith(
      addParameterPayload,
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

    const result = await connectionRequestsService.createDeviceConfig(1, deviceConfig, actorUserId);

    expect(mockedDeviceConnectionsService.createForRequest).toHaveBeenCalledWith(
      deviceConfig,
      actorUserId,
      1,
    );
    expect(result).toMatchObject({
      stationId: 'STACK-A',
      device: [
        {
          protocol: 'MODBUS_TCP',
          settings: { hostIp: '192.168.1.10', slaveId: 1, port: 502 },
        },
      ],
      channels: [
        {
          deviceCode: 'STACK-A/01',
          addressId: 40001,
          dataType: 'NOx',
        },
      ],
    });
  });

  it('stores multiple device configs in one request when every station belongs to the owner request', async () => {
    const firstConfig = {
      stationId: 'STACK-A',
      deviceCode: 'STACK-A/01',
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
    const secondConfig = {
      ...firstConfig,
      deviceCode: 'STACK-A/02',
      channels: [{ ...firstConfig.channels[0], addressId: 40002 }],
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
    mockedDeviceConnectionsService.createManyForRequest.mockResolvedValue([
      {
        id: 10,
        requestId: 1,
        ...firstConfig,
        settings: firstConfig.settings,
        statusManagement: null,
        createdBy: actorUserId,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      },
      {
        id: 11,
        requestId: 1,
        ...secondConfig,
        settings: secondConfig.settings,
        statusManagement: null,
        createdBy: actorUserId,
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
      },
    ]);

    const result = await connectionRequestsService.createDeviceConfigs(
      1,
      { configs: [firstConfig, secondConfig] },
      actorUserId,
    );

    expect(mockedDeviceConnectionsService.createManyForRequest).toHaveBeenCalledWith(
      [firstConfig, secondConfig],
      actorUserId,
      1,
    );
    expect(result).toMatchObject({
      stationId: 'STACK-A',
      device: [
        { deviceCode: 'STACK-A/01', protocol: 'MODBUS_TCP' },
        { deviceCode: 'STACK-A/02', protocol: 'MODBUS_TCP' },
      ],
      channels: [
        { deviceCode: 'STACK-A/01', addressId: 40001, dataType: 'NOx' },
        { deviceCode: 'STACK-A/02', addressId: 40002, dataType: 'NOx' },
      ],
    });
  });

  it('saves current device configs for a selected connected monitoring point', async () => {
    const config = {
      stationId: 'STACK-A',
      deviceCode: 'STACK-A/01',
      protocol: 'MODBUS_TCP' as const,
      settings: { hostIp: '192.168.1.10', slaveId: 1, port: 502 },
      channels: [{ addressId: 40001, dataType: 'NOx', offset: 0 }],
    };
    mockedRepository.list.mockResolvedValue({
      rows: [
        requestDto({
          status: CONNECTION_REQUEST_STATUS.CONNECTED,
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
        }),
      ],
      total: 1,
    });
    mockedDeviceConnectionsService.createMany.mockResolvedValue([
      deviceConnectionConfig({
        ...config,
        id: 20,
        requestId: null,
      }),
    ]);

    const result = await connectionRequestsService.saveCurrentDeviceConfigs(
      'STACK-A',
      { configs: [config] },
      actorUserId,
      'OWN_FACTORY',
    );

    expect(mockedRepository.list).toHaveBeenCalledWith(
      { stationId: 'STACK-A', status: CONNECTION_REQUEST_STATUS.CONNECTED },
      { actorUserId, scope: 'OWN_FACTORY' },
    );
    expect(mockedDeviceConnectionsService.createMany).toHaveBeenCalledWith([config], actorUserId);
    expect(result).toMatchObject({
      stationId: 'STACK-A',
      device: [{ deviceCode: 'STACK-A/01', protocol: 'MODBUS_TCP' }],
    });
  });

  it('rejects current device config saves when payload stationId does not match route stationId', async () => {
    mockedRepository.list.mockResolvedValue({
      rows: [
        requestDto({
          status: CONNECTION_REQUEST_STATUS.CONNECTED,
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
        }),
      ],
      total: 1,
    });

    await expect(
      connectionRequestsService.saveCurrentDeviceConfig(
        'STACK-A',
        {
          stationId: 'STACK-B',
          protocol: 'MODBUS_TCP',
          settings: { hostIp: '192.168.1.10', slaveId: 1, port: 502 },
          channels: [{ addressId: 40001, dataType: 'NOx', offset: 0 }],
        },
        actorUserId,
        'OWN_FACTORY',
      ),
    ).rejects.toMatchObject({
      code: 'BAD_REQUEST',
    });
    expect(mockedDeviceConnectionsService.create).not.toHaveBeenCalled();
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
          details: {
            stackShape: 'วงกลม',
            stackDiameter: 1.2,
            connectionDevice: 'POMS Box (กรอ.)',
          },
          documentsAndImages: [
            {
              title: 'ภาพถ่ายปล่อง',
              fileName: 'stack.png',
              fileUrl: 'https://example.com/files/stack.png',
              fileType: 'image/png',
              fileSize: 1024,
            },
          ],
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
    expect(mockedRepository.syncConnectedMeasurementPoints).toHaveBeenCalledWith(
      expect.objectContaining({
        status: CONNECTION_REQUEST_STATUS.CONNECTED,
        address: '99 หมู่ 1 ตำบลทดสอบ อำเภอเมือง จังหวัดสระบุรี',
      }),
      7,
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

function deviceConnectionConfig(
  overrides: Partial<DeviceConnectionConfigDTO> = {},
): DeviceConnectionConfigDTO {
  return {
    id: 10,
    requestId: null,
    stationId: 'STACK-A',
    protocol: 'MODBUS_TCP',
    settings: { hostIp: '192.168.1.10', slaveId: 1, port: 502 },
    channels: [],
    statusManagement: null,
    createdBy: 42,
    createdAt: '2026-05-27T10:00:00.000Z',
    updatedAt: '2026-05-27T10:00:00.000Z',
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
