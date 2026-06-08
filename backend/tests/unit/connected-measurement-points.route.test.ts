import request from 'supertest';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { signAccessToken } from '../../src/shared/utils/jwt';

jest.mock('../../src/modules/connection-requests/connection-requests.service', () => ({
  connectionRequestsService: {
    getAddParameterFormDetail: jest.fn(),
    getCurrentDeviceConfigFormDetail: jest.fn(),
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
          requestType: 'ADD_PARAMETER',
          requestTypeLabel: 'เพิ่มพารามิเตอร์',
          factoryId: 'factory-001',
          factoryName: 'บริษัท ทดสอบ จำกัด',
          factoryRegistrationNo: '3-106-33/50สบ',
          industryMainOrder: null,
          industrySubOrder: null,
          businessActivity: null,
          eia: null,
          hasEia: null,
          projectName: null,
          address: null,
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
          createdBy: 42,
          createdAt: '2026-06-08T00:00:00.000Z',
          updatedAt: '2026-06-08T00:00:00.000Z',
          factory: null,
          deviceConfigs: [],
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
      'ALL',
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
      'ALL',
    );
    expect(response.body.data[0]).toMatchObject({
      id: 10,
      requestNo: 'CEMS6900001',
      measurementPoints: [{ pointCode: 'S0001' }],
      deviceConfigs: [],
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
      'ALL',
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
      'ALL',
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
});

function accessToken(): string {
  return signAccessToken({
    sub: '42',
    userType: 'officer',
    roles: ['officer'],
    scopes: {
      'cems_wpms_requests:view': 'ALL',
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
