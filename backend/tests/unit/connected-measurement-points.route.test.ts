import request from 'supertest';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { signAccessToken } from '../../src/shared/utils/jwt';

jest.mock('../../src/modules/connection-requests/connection-requests.service', () => ({
  connectionRequestsService: {
    getAddParameterFormDetail: jest.fn(),
    getCalendarStatus: jest.fn(),
    getConnectedMeasurementPointDetailsByFactory: jest.fn(),
    getCurrentDeviceConfigFormDetail: jest.fn(),
    getMeasurementStatistics: jest.fn(),
    listConnectedMeasurementPoints: jest.fn(),
    listDetails: jest.fn(),
    listTableRows: jest.fn(),
    saveCurrentDeviceConfig: jest.fn(),
    saveCurrentDeviceConfigs: jest.fn(),
  },
}));

import { createApp } from '../../src/app';
import { connectionRequestsService } from '../../src/modules/connection-requests/connection-requests.service';

const mockedConnectionRequestsService = jest.mocked(connectionRequestsService);

describe('connected measurement points route', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedConnectionRequestsService.listConnectedMeasurementPoints.mockResolvedValue({
      data: [
        {
          id: 1,
          requestId: 10,
          requestNo: 'CEMS6900001',
          factory: null,
          type: 'CEMS',
          status: 'เชื่อมต่อแล้ว',
          statusCode: 'CONNECTED',
          connectedAt: '2026-06-08T00:00:00.000Z',
          point: {
            id: 1,
            pointName: 'S0001',
            pointCode: 'S0001',
            pointType: 'STACK',
            latitude: null,
            longitude: null,
            parameters: ['NOx'],
            description: null,
          },
          deviceConfigs: [],
        },
      ],
      meta: {
        total: 1,
      },
    });
    mockedConnectionRequestsService.listTableRows.mockResolvedValue({
      data: [
        {
          id: 10,
          factoryId: 'factory-001',
          factoryName: 'บริษัท ทดสอบ จำกัด',
          industryType: null,
          province: null,
          type: 'CEMS',
          requestNo: 'CEMS6900001',
          submittedAt: '2026-06-08T00:00:00.000Z',
          submittedDate: '08/06/2569',
          monitoringPointCode: 'S0001',
          codeIssuedAt: null,
          codeIssuedDate: null,
          connectionDueAt: null,
          waitingConnectionDaysRemaining: null,
          waitingConnectionText: null,
          form: 'เพิ่มพารามิเตอร์',
          status: 'เชื่อมต่อแล้ว',
          statusCode: 'CONNECTED',
          requestType: 'ADD_PARAMETER',
        },
      ],
      meta: { total: 1 },
    });
    mockedConnectionRequestsService.listDetails.mockResolvedValue({
      data: [
        {
          id: 10,
          requestNo: 'CEMS6900001',
          submissionSource: 'OPERATOR_FORM',
          requestType: 'ADD_PARAMETER',
          requestTypeLabel: 'เพิ่มพารามิเตอร์',
          factoryId: 'factory-001',
          factoryName: 'บริษัท ทดสอบ จำกัด',
          factoryRegistrationNo: '3-106-33/50สบ',
          industryMainOrder: null,
          industryMainOrderLabel: null,
          industrySubOrder: null,
          businessActivity: null,
          eia: null,
          eiaOther: null,
          hasEia: null,
          projectName: null,
          address: null,
          regionCode: null,
          regionName: null,
          provinceCode: null,
          provinceName: null,
          districtCode: null,
          districtName: null,
          subdistrictCode: null,
          subdistrictName: null,
          industrialEstateCode: null,
          industrialEstateName: null,
          latitude: null,
          longitude: null,
          systemType: 'CEMS',
          status: 'CONNECTED',
          statusLabel: 'เชื่อมต่อแล้ว',
          contactName: 'สมชาย ใจดี',
          contactPhone: '0812345678',
          contactEmail: null,
          contactPersons: [],
          notificationEmails: [],
          officerNotificationEmails: [],
          informationProviderName: null,
          informationProviderPosition: null,
          remarks: null,
          revisionReason: null,
          officerNote: null,
          connectionDueAt: null,
          confirmedAt: null,
          verifiedAt: '2026-06-08T00:00:00.000Z',
          measurementPoints: [
            {
              id: 1,
              pointName: 'ปล่อง A',
              pointCode: 'S0001',
              pointType: 'STACK',
              latitude: null,
              longitude: null,
              parameters: ['NOx'],
              description: null,
            },
          ],
          statusHistory: [],
          statusDurationSummary: {
            startedAt: null,
            startDate: null,
            startStatus: null,
            startStatusLabel: null,
            endedAt: null,
            endDate: null,
            endStatus: null,
            endStatusLabel: null,
            isTerminal: false,
            terminalStatuses: ['CONNECTED', 'CANCELED'],
            totalDurationDays: null,
            totalDurationText: null,
          },
          createdBy: 42,
          createdAt: '2026-06-08T00:00:00.000Z',
          updatedAt: '2026-06-08T00:00:00.000Z',
          factory: null,
          deviceConfigs: [],
        },
      ],
      meta: { total: 1 },
    });
    mockedConnectionRequestsService.getConnectedMeasurementPointDetailsByFactory.mockResolvedValue({
      data: [
        {
          pointCode: 'P0001',
          pointName: 'จุดระบายน้ำทิ้ง A',
          pointType: 'WPMS',
          parameterDetails: ['BOD (mg/l)', 'COD (mg/l)'],
          primaryFuel: null,
          secondaryFuel: null,
          instruments: ['ค่าบีโอดี (BOD) และ ค่าซีโอดี (COD)'],
          measurementTimes: ['Real Time', '15 นาที'],
          wastewaterSource: 'ระบบบำบัดน้ำเสียส่วนกลาง',
          receivingSource: 'คลองสาธารณะ',
          treatmentSystemType: 'ระบบตะกอนเร่ง',
          dischargePoint: '13.7563, 100.5018',
          averageDischarge: 120.5,
          minimumDischarge: 95,
          maximumDischarge: 160,
        },
      ],
      meta: { total: 1 },
    });
    mockedConnectionRequestsService.getAddParameterFormDetail.mockResolvedValue({
      requestType: 'ADD_PARAMETER',
      sourceRequestId: 10,
      sourceRequestNo: 'CEMS6900001',
      stationId: 'S0001',
      formDefaults: {
        requestType: 'ADD_PARAMETER',
        factoryId: 'factory-001',
        factoryName: 'บริษัท ทดสอบ จำกัด',
        factoryRegistrationNo: '3-106-33/50สบ',
        systemType: 'CEMS',
        contactName: 'สมชาย ใจดี',
        contactPhone: '0812345678',
        measurementPoints: [
          {
            pointName: 'ปล่อง A',
            pointCode: 'S0001',
            pointType: 'STACK',
          },
        ],
      },
    });
    mockedConnectionRequestsService.getCurrentDeviceConfigFormDetail.mockResolvedValue({
      requestId: 10,
      requestNo: 'CEMS6900001',
      stationId: 'S0001',
      monitoringPoint: null,
      parameterOptions: [],
      deviceCodeOptions: ['S0001/01'],
      connectionForms: [],
      statusManagement: {
        selectedParameters: ['ทั้งหมด'],
        startAt: null,
        endAt: null,
        status: 'Normal',
        schedules: [],
      },
      parameterMappings: [],
      testResults: [],
      rawConfigs: {
        stationId: 'S0001',
        device: [],
        channels: [],
        statusManagement: {
          selectedParameters: ['ทั้งหมด'],
          startAt: null,
          endAt: null,
          status: 'Normal',
          schedules: [],
        },
      },
    });
    mockedConnectionRequestsService.saveCurrentDeviceConfigs.mockResolvedValue({
      stationId: 'S0001',
      device: [],
      channels: [],
      statusManagement: {
        selectedParameters: ['ทั้งหมด'],
        startAt: null,
        endAt: null,
        status: 'Normal',
        schedules: [],
      },
    });
    mockedConnectionRequestsService.getMeasurementStatistics.mockResolvedValue({
      data: {
        metadata: {
          description: 'สถิติรายชั่วโมงสำหรับตารางสถิติข้อมูลและกราฟแนวโน้มสถานการณ์มลพิษ',
          date: '2026-06-09',
          valueDefinitions: {},
        },
        factory: {
          factoryId: 'factory-001',
          factoryName: 'บริษัท ทดสอบ จำกัด',
          systemType: 'CEMS',
        },
        thresholds: [],
        measurementPoints: [
          {
            pointCode: 'S0001',
            stationId: 'S0001',
            pointName: 'ปล่องระบาย S0001',
            latitude: 13.7563,
            longitude: 100.5018,
            date: '2026-06-09',
            rows: [],
          },
        ],
      },
      meta: {
        stationId: 'S0001',
        interval: '60m',
        schemaName: 'ingest',
        tableName: 'S0001_data_60m',
        date: '2026-06-09',
        count: 0,
        registeredParameters: [],
      },
    });
    mockedConnectionRequestsService.getCalendarStatus.mockResolvedValue({
      data: {
        metadata: {
          description: 'DateCalendar และตารางสรุปสถานะรายเดือนของโรงงาน',
          month: '2026-06',
          valueDefinitions: {},
        },
        factory: {
          factoryId: 'factory-001',
          factoryName: 'บริษัท ทดสอบ จำกัด',
          systemType: 'CEMS',
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
  });

  it('exposes current connected measurement points outside the request route namespace', async () => {
    const app = createApp();

    const response = await request(app)
      .get('/api/v1/connected-measurement-points?stationId=S0001')
      .set('Authorization', `Bearer ${accessToken()}`);

    expect(response.status).toBe(200);
    expect(mockedConnectionRequestsService.listConnectedMeasurementPoints).toHaveBeenCalledWith(
      { stationId: 'S0001', factoryId: undefined },
      42,
      { scope: 'ALL' },
    );
    expect(response.body).toMatchObject({
      success: true,
      data: [
        {
          point: {
            pointCode: 'S0001',
          },
          deviceConfigs: [],
        },
      ],
      meta: {
        total: 1,
      },
    });
  });

  it('exposes request details for a selected connected measurement point', async () => {
    const app = createApp();

    const response = await request(app)
      .get('/api/v1/connected-measurement-points/S0001/requests')
      .set('Authorization', `Bearer ${accessToken()}`);

    expect(response.status).toBe(200);
    expect(mockedConnectionRequestsService.listDetails).toHaveBeenCalledWith(
      { stationId: 'S0001' },
      42,
      { scope: 'ALL' },
    );
    expect(response.body.data[0]).toMatchObject({
      id: 10,
      requestNo: 'CEMS6900001',
      measurementPoints: [{ pointCode: 'S0001' }],
      deviceConfigs: [],
    });
  });

  it('exposes only modal detail fields for a factory connected measurement points', async () => {
    const app = createApp();

    const response = await request(app)
      .get('/api/v1/connected-measurement-points/factories/factory-001')
      .set('Authorization', `Bearer ${accessToken()}`);

    expect(response.status).toBe(200);
    expect(
      mockedConnectionRequestsService.getConnectedMeasurementPointDetailsByFactory,
    ).toHaveBeenCalledWith('factory-001', 42, { scope: 'ALL' });
    expect(response.body).toEqual({
      success: true,
      data: [
        {
          pointCode: 'P0001',
          pointName: 'จุดระบายน้ำทิ้ง A',
          pointType: 'WPMS',
          parameterDetails: ['BOD (mg/l)', 'COD (mg/l)'],
          primaryFuel: null,
          secondaryFuel: null,
          instruments: ['ค่าบีโอดี (BOD) และ ค่าซีโอดี (COD)'],
          measurementTimes: ['Real Time', '15 นาที'],
          wastewaterSource: 'ระบบบำบัดน้ำเสียส่วนกลาง',
          receivingSource: 'คลองสาธารณะ',
          treatmentSystemType: 'ระบบตะกอนเร่ง',
          dischargePoint: '13.7563, 100.5018',
          averageDischarge: 120.5,
          minimumDischarge: 95,
          maximumDischarge: 160,
        },
      ],
      meta: { total: 1 },
    });
  });

  it('exposes add-parameter form defaults for a selected connected measurement point', async () => {
    const app = createApp();

    const response = await request(app)
      .get('/api/v1/connected-measurement-points/S0001/parameter-form')
      .set('Authorization', `Bearer ${accessToken()}`);

    expect(response.status).toBe(200);
    expect(mockedConnectionRequestsService.getAddParameterFormDetail).toHaveBeenCalledWith(
      'S0001',
      42,
      { scope: 'ALL' },
    );
    expect(response.body.data.formDefaults.measurementPoints[0]).toMatchObject({
      pointCode: 'S0001',
    });
  });

  it('exposes and saves current device configs for a selected connected measurement point', async () => {
    const app = createApp();

    const getResponse = await request(app)
      .get('/api/v1/connected-measurement-points/S0001/device-configs')
      .set('Authorization', `Bearer ${accessToken()}`);

    expect(getResponse.status).toBe(200);
    expect(mockedConnectionRequestsService.getCurrentDeviceConfigFormDetail).toHaveBeenCalledWith(
      'S0001',
      42,
      { scope: 'ALL' },
    );

    const postResponse = await request(app)
      .post('/api/v1/connected-measurement-points/S0001/device-configs')
      .set('Authorization', `Bearer ${editAccessToken()}`)
      .send({
        configs: [
          {
            stationId: 'S0001',
            protocol: 'MODBUS_TCP',
            settings: { hostIp: '192.168.1.10', slaveId: 1, port: 502 },
            channels: [
              {
                addressId: 40001,
                dataType: 'NOx',
                valueRange: { min: 0, max: 200 },
                valueFormat: 'MEASUREMENT_VALUE',
                offset: 0,
                encoding: 'UNSIGNED16_BIG_ENDIAN',
              },
            ],
          },
        ],
      });

    expect(postResponse.status).toBe(201);
    expect(mockedConnectionRequestsService.saveCurrentDeviceConfigs).toHaveBeenCalledWith(
      'S0001',
      expect.objectContaining({
        configs: [expect.objectContaining({ stationId: 'S0001' })],
      }),
      42,
      'ALL',
    );
  });

  it('accepts current MSSQL device configs with measurement range fields', async () => {
    const app = createApp();

    mockedConnectionRequestsService.saveCurrentDeviceConfig.mockResolvedValue({
      stationId: 'S0001',
      device: [],
      channels: [],
      statusManagement: {
        selectedParameters: ['ทั้งหมด'],
        startAt: null,
        endAt: null,
        status: 'Normal',
        schedules: [],
      },
    });

    const response = await request(app)
      .post('/api/v1/connected-measurement-points/S0001/device-configs')
      .set('Authorization', `Bearer ${editAccessToken()}`)
      .send({
        stationId: 'S0001',
        deviceCode: 'S0001/01',
        protocol: 'MSSQL',
        settings: {
          hostIp: '127.0.0.1',
          port: 433,
          dbUser: 'user',
          dbPass: 'P@ssw0rd',
          dbName: 'db',
        },
        channels: [
          {
            addressId: 40001,
            dataType: 'CO (ppm)',
            valueRange: { min: 0, max: 500 },
            valueFormat: 'MEASUREMENT_VALUE',
            offset: 1,
            encoding: 'UNSIGNED16_BIG_ENDIAN',
            status: 'Normal',
          },
        ],
        statusManagement: {
          selectedParameters: ['ทั้งหมด'],
          startAt: null,
          endAt: null,
          status: 'Normal',
          schedules: [],
        },
      });

    expect(response.status).toBe(201);
    expect(mockedConnectionRequestsService.saveCurrentDeviceConfig).toHaveBeenCalledWith(
      'S0001',
      expect.objectContaining({
        protocol: 'MSSQL',
        channels: [
          expect.objectContaining({
            dataType: 'CO (ppm)',
            valueRange: { min: 0, max: 500 },
            valueFormat: 'MEASUREMENT_VALUE',
            encoding: 'UNSIGNED16_BIG_ENDIAN',
          }),
        ],
      }),
      42,
      'ALL',
    );
  });

  it('exposes measurement statistics for the selected connected measurement point', async () => {
    const app = createApp();

    const response = await request(app)
      .get('/api/v1/connected-measurement-points/S0001/measurement-statistics?date=2026-06-09')
      .set('Authorization', `Bearer ${accessToken()}`);

    expect(response.status).toBe(200);
    expect(mockedConnectionRequestsService.getMeasurementStatistics).toHaveBeenCalledWith(
      'S0001',
      { date: '2026-06-09' },
      42,
      { scope: 'ALL' },
    );
    expect(response.body).toMatchObject({
      success: true,
      data: {
        factory: {
          factoryId: 'factory-001',
        },
        measurementPoints: [
          {
            pointCode: 'S0001',
            stationId: 'S0001',
            pointName: 'ปล่องระบาย S0001',
            latitude: 13.7563,
            longitude: 100.5018,
          },
        ],
      },
      meta: {
        stationId: 'S0001',
        date: '2026-06-09',
      },
    });
  });

  it('exposes monthly calendar status for the selected connected measurement point', async () => {
    const app = createApp();

    const response = await request(app)
      .get('/api/v1/connected-measurement-points/S0001/calendar-status?month=2026-06')
      .set('Authorization', `Bearer ${accessToken()}`);

    expect(response.status).toBe(200);
    expect(mockedConnectionRequestsService.getCalendarStatus).toHaveBeenCalledWith(
      'S0001',
      { month: '2026-06' },
      42,
      { scope: 'ALL' },
    );
    expect(response.body).toMatchObject({
      success: true,
      data: {
        calendar: {
          year: 2026,
          month: 6,
        },
      },
      meta: {
        stationId: 'S0001',
        month: '2026-06',
      },
    });
  });

  it('rejects measurement statistics when the user only has request-view permission', async () => {
    const app = createApp();

    const response = await request(app)
      .get('/api/v1/connected-measurement-points/S0001/measurement-statistics?date=2026-06-09')
      .set('Authorization', `Bearer ${requestViewOnlyAccessToken()}`);

    expect(response.status).toBe(403);
    expect(mockedConnectionRequestsService.getMeasurementStatistics).not.toHaveBeenCalled();
  });

  it('rejects unsafe station ids before querying measurement statistics tables', async () => {
    const app = createApp();

    const response = await request(app)
      .get(
        '/api/v1/connected-measurement-points/S0001%3Bdrop/measurement-statistics?date=2026-06-09',
      )
      .set('Authorization', `Bearer ${accessToken()}`);

    expect(response.status).toBe(400);
    expect(mockedConnectionRequestsService.getMeasurementStatistics).not.toHaveBeenCalled();
  });
});

function accessToken(): string {
  return signAccessToken({
    sub: '42',
    userType: 'officer',
    roles: ['officer'],
    scopes: {
      'cems_wpms_requests:view': 'ALL',
      'dashboard.stats:view': 'ALL',
    },
  });
}

function requestViewOnlyAccessToken(): string {
  return signAccessToken({
    sub: '42',
    userType: 'operator',
    roles: ['factory_operator'],
    scopes: {
      'cems_wpms_requests:view': 'OWN_FACTORY',
    },
  });
}

function editAccessToken(): string {
  return signAccessToken({
    sub: '42',
    userType: 'officer',
    roles: ['officer'],
    scopes: {
      'cems_wpms_requests:view': 'ALL',
      'cems_wpms_requests:edit': 'ALL',
    },
  });
}
