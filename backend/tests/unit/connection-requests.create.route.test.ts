import request from 'supertest';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { ZodError } from 'zod';
import { signAccessToken } from '../../src/shared/utils/jwt';

jest.mock('../../src/modules/connection-requests/connection-requests.service', () => ({
  connectionRequestsService: {
    createMeasurementPointRequest: jest.fn(),
    createParameterRequest: jest.fn(),
    createDeviceConfig: jest.fn(),
    createDeviceConfigs: jest.fn(),
    resubmit: jest.fn(),
  },
}));

import { createApp } from '../../src/app';
import { connectionRequestsService } from '../../src/modules/connection-requests/connection-requests.service';

const mockedService = jest.mocked(connectionRequestsService);

describe('create measurement-point request route', () => {
  const serviceResponse = {
    id: 17,
    requestNo: 'WPMS-0017/2569',
    requestType: 'ADD_MEASUREMENT_POINT',
    eia: 'มี EIA',
    eiaOther: null,
    hasEia: true,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockedService.createMeasurementPointRequest.mockResolvedValue(serviceResponse as never);
    mockedService.createDeviceConfigs.mockResolvedValue({
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

  it('returns 201, Location, and the standard success envelope', async () => {
    const response = await request(createApp())
      .post('/api/v1/cems-wpms-requests/measurement-points')
      .set('Authorization', `Bearer ${accessToken()}`)
      .send(validWpmsPayload());

    expect(response.status).toBe(201);
    expect(response.headers.location).toBe('/api/v1/cems-wpms-requests/17');
    expect(response.body).toEqual({ success: true, data: serviceResponse });
    expect(mockedService.createMeasurementPointRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        requestType: 'ADD_MEASUREMENT_POINT',
        eia: 'มี EIA',
        eiaOther: null,
        hasEia: true,
        measurementPoints: [
          expect.objectContaining({
            parameters: ['BOD (mg/l)'],
            documentsAndImages: [],
          }),
        ],
      }),
      expect.objectContaining({
        actorUserId: 42,
        userType: 'operator',
        roles: ['factory_operator'],
        editScope: { scope: 'OWN_FACTORY' },
        directConnectScope: undefined,
      }),
    );
  });

  it('passes the frontend CEMS clause and nullable fuel-percent contract to the service', async () => {
    const payload = validCemsAddParameterPayload();
    const point = payload.measurementPoints[0];
    const response = await request(createApp())
      .post('/api/v1/cems-wpms-requests/measurement-points')
      .set('Authorization', `Bearer ${accessToken()}`)
      .send({
        ...payload,
        measurementPoints: [
          {
            ...point,
            pointCode: null,
            details: {
              ...point.details,
              primaryFuel: null,
              primaryFuelPercent: null,
              secondaryFuel: null,
              secondaryFuelPercent: null,
              exemptedParameterRegulationClauses: 'อื่นๆ',
              exemptedParameterRegulationClauseOther: 'ข้อ 15 ตามประกาศเฉพาะ',
            },
            documentsAndImages: [
              {
                title: 'ภาพถ่ายปล่อง',
                fileUrl: 'https://example.com/stack.jpg',
              },
            ],
          },
        ],
      });

    expect(response.status).toBe(201);
    expect(mockedService.createMeasurementPointRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        measurementPoints: [
          expect.objectContaining({
            details: expect.objectContaining({
              primaryFuelPercent: null,
              secondaryFuelPercent: null,
              exemptedParameterRegulationClauses: 'อื่นๆ',
              exemptedParameterRegulationClauseOther: 'ข้อ 15 ตามประกาศเฉพาะ',
            }),
          }),
        ],
      }),
      expect.objectContaining({
        actorUserId: 42,
        userType: 'operator',
        roles: ['factory_operator'],
        editScope: { scope: 'OWN_FACTORY' },
        directConnectScope: undefined,
      }),
    );
  });

  it('passes officer workflow context and submissionAction when the form asks to connect immediately', async () => {
    const response = await request(createApp())
      .post('/api/v1/cems-wpms-requests/measurement-points')
      .set('Authorization', `Bearer ${officerMeasurementPointToken()}`)
      .send({
        ...validWpmsPayload(),
        submissionAction: 'CONNECT',
        officerNote: 'เชื่อมต่อแล้วจากหน้าฟอร์ม',
        measurementPoints: [
          {
            ...validWpmsPayload().measurementPoints[0],
            pointCode: ' S2201 ',
          },
        ],
      });

    expect(response.status).toBe(201);
    expect(mockedService.createMeasurementPointRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        submissionAction: 'CONNECT',
        officerNote: 'เชื่อมต่อแล้วจากหน้าฟอร์ม',
        measurementPoints: [expect.objectContaining({ pointCode: 'S2201' })],
      }),
      expect.objectContaining({
        actorUserId: 52,
        userType: 'officer',
        roles: ['monitoring_kpm'],
        editScope: { scope: 'ALL' },
        directConnectScope: { scope: 'ALL' },
      }),
    );
  });

  it('accepts a dedicated CEMS add-parameter request without documents', async () => {
    const parameterResponse = {
      ...serviceResponse,
      requestType: 'ADD_PARAMETER',
    };
    mockedService.createParameterRequest.mockResolvedValueOnce(parameterResponse as never);

    const response = await request(createApp())
      .post('/api/v1/cems-wpms-requests/parameters')
      .set('Authorization', `Bearer ${accessToken()}`)
      .send(validCemsAddParameterPayload());

    expect(response.status).toBe(201);
    expect(response.headers.location).toBe('/api/v1/cems-wpms-requests/17');
    expect(response.body).toEqual({ success: true, data: parameterResponse });
    expect(mockedService.createParameterRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        requestType: 'ADD_PARAMETER',
        measurementPoints: [
          expect.objectContaining({
            pointCode: 'S0001',
            documentsAndImages: [],
          }),
        ],
      }),
      42,
    );
  });

  it('accepts a CEMS add-parameter resubmit payload without documents', async () => {
    const revisedResponse = {
      ...serviceResponse,
      requestType: 'ADD_PARAMETER',
    };
    mockedService.resubmit.mockResolvedValueOnce(revisedResponse as never);

    const response = await request(createApp())
      .put('/api/v1/cems-wpms-requests/17/form')
      .set('Authorization', `Bearer ${accessToken()}`)
      .send(validCemsAddParameterPayload());

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ success: true, data: revisedResponse });
    expect(mockedService.resubmit).toHaveBeenCalledWith(
      17,
      expect.objectContaining({
        measurementPoints: [
          expect.objectContaining({
            pointCode: 'S0001',
            documentsAndImages: [],
          }),
        ],
      }),
      42,
    );
  });

  it('accepts request-bound database config payloads with nullable fields and table names', async () => {
    const response = await request(createApp())
      .post('/api/v1/cems-wpms-requests/17/device-configs')
      .set('Authorization', `Bearer ${accessToken()}`)
      .send({
        config: {
          stationId: 'S0001',
          device: [
            {
              deviceCode: 'S0001/DB-01',
              protocol: 'MSSQL',
              settings: {
                hostIp: null,
                port: null,
                dbUser: null,
                dbPass: null,
                dbName: null,
                minuteTableName: 'measurements_1m',
                fiveMinuteTableName: 'measurements_5m',
                hourlyTableName: 'measurements_1h',
                valueRange: null,
              },
            },
          ],
          channels: [],
          statusManagement: null,
        },
      });

    expect(response.status).toBe(201);
    expect(mockedService.createDeviceConfigs).toHaveBeenCalledWith(
      17,
      {
        configs: [
          expect.objectContaining({
            stationId: 'S0001',
            deviceCode: 'S0001/DB-01',
            protocol: 'MSSQL',
            settings: expect.objectContaining({
              hostIp: null,
              minuteTableName: 'measurements_1m',
              fiveMinuteTableName: 'measurements_5m',
              hourlyTableName: 'measurements_1h',
            }),
            channels: [],
            statusManagement: null,
          }),
        ],
      },
      42,
    );
  });

  it('accepts multiple status schedules without requiring legacy top-level status fields', async () => {
    const schedules = [
      {
        selectedParameters: ['CO (ppm)'],
        startAt: '2026-08-05 08:00:00',
        endAt: '2026-08-05 10:00:00',
        status: 'Maintenance',
      },
      {
        selectedParameters: ['NOx (ppm)'],
        startAt: '2026-08-05 13:00:00',
        endAt: '2026-08-05 15:00:00',
        status: 'Calibration',
      },
    ];

    const response = await request(createApp())
      .post('/api/v1/cems-wpms-requests/17/device-configs')
      .set('Authorization', `Bearer ${accessToken()}`)
      .send({
        config: {
          stationId: 'S0001',
          device: [
            {
              deviceCode: 'S0001/01',
              protocol: 'MODBUS_TCP',
              settings: {},
            },
          ],
          channels: [],
          statusManagement: { schedules },
        },
      });

    expect(response.status).toBe(201);
    expect(mockedService.createDeviceConfigs).toHaveBeenCalledWith(
      17,
      {
        configs: [
          expect.objectContaining({
            stationId: 'S0001',
            statusManagement: {
              ...schedules[0],
              schedules,
            },
          }),
        ],
      },
      42,
    );
  });

  it('uses schedules as the source of truth when stale legacy fields are also submitted', async () => {
    const legacySchedule = {
      selectedParameters: ['CO (ppm)'],
      startAt: '2026-08-05T08:00:00+07:00',
      endAt: '2026-08-05T10:00:00+07:00',
      status: 'Maintenance',
    };
    const normalizedSchedule = {
      ...legacySchedule,
      startAt: '2026-08-05 08:00:00',
      endAt: '2026-08-05 10:00:00',
    };

    const response = await request(createApp())
      .post('/api/v1/cems-wpms-requests/17/device-configs')
      .set('Authorization', `Bearer ${accessToken()}`)
      .send({
        config: {
          stationId: 'S0001',
          device: [
            {
              deviceCode: 'S0001/01',
              protocol: 'MODBUS_TCP',
              settings: {},
            },
          ],
          channels: [],
          statusManagement: {
            selectedParameters: ['stale'],
            startAt: 'not-a-date',
            endAt: 'also-not-a-date',
            status: 'Legacy status',
            schedules: [legacySchedule],
          },
        },
      });

    expect(response.status).toBe(201);
    expect(mockedService.createDeviceConfigs).toHaveBeenCalledWith(
      17,
      {
        configs: [
          expect.objectContaining({
            statusManagement: {
              ...normalizedSchedule,
              schedules: [normalizedSchedule],
            },
          }),
        ],
      },
      42,
    );
  });

  it('normalizes a legacy top-level status window into one schedule', async () => {
    const legacySchedule = {
      selectedParameters: ['CO (ppm)'],
      startAt: '2026-08-05T08:00:00+07:00',
      endAt: '2026-08-05T10:00:00+07:00',
      status: 'Maintenance',
    };
    const normalizedSchedule = {
      ...legacySchedule,
      startAt: '2026-08-05 08:00:00',
      endAt: '2026-08-05 10:00:00',
    };

    const response = await request(createApp())
      .post('/api/v1/cems-wpms-requests/17/device-configs')
      .set('Authorization', `Bearer ${accessToken()}`)
      .send({
        config: {
          stationId: 'S0001',
          device: [
            {
              deviceCode: 'S0001/01',
              protocol: 'MODBUS_TCP',
              settings: {},
            },
          ],
          channels: [],
          statusManagement: legacySchedule,
        },
      });

    expect(response.status).toBe(201);
    expect(mockedService.createDeviceConfigs).toHaveBeenCalledWith(
      17,
      {
        configs: [
          expect.objectContaining({
            statusManagement: {
              ...normalizedSchedule,
              schedules: [normalizedSchedule],
            },
          }),
        ],
      },
      42,
    );
  });

  it('normalizes legacy datetime-local timestamps to the canonical local format', async () => {
    const response = await request(createApp())
      .post('/api/v1/cems-wpms-requests/17/device-configs')
      .set('Authorization', `Bearer ${accessToken()}`)
      .send({
        config: {
          stationId: 'S0001',
          device: [
            {
              deviceCode: 'S0001/01',
              protocol: 'MODBUS_TCP',
              settings: {},
            },
          ],
          channels: [],
          statusManagement: {
            selectedParameters: ['CO (ppm)'],
            startAt: '2026-08-05T08:00',
            endAt: '2026-08-05T10:00',
            status: 'Maintenance',
          },
        },
      });

    const normalizedSchedule = {
      selectedParameters: ['CO (ppm)'],
      startAt: '2026-08-05 08:00:00',
      endAt: '2026-08-05 10:00:00',
      status: 'Maintenance',
    };

    expect(response.status).toBe(201);
    expect(mockedService.createDeviceConfigs).toHaveBeenCalledWith(
      17,
      {
        configs: [
          expect.objectContaining({
            statusManagement: {
              ...normalizedSchedule,
              schedules: [normalizedSchedule],
            },
          }),
        ],
      },
      42,
    );
  });

  it('rejects an invalid legacy top-level status time window', async () => {
    const response = await request(createApp())
      .post('/api/v1/cems-wpms-requests/17/device-configs')
      .set('Authorization', `Bearer ${accessToken()}`)
      .send({
        config: {
          stationId: 'S0001',
          device: [
            {
              deviceCode: 'S0001/01',
              protocol: 'MODBUS_TCP',
              settings: {},
            },
          ],
          channels: [],
          statusManagement: {
            selectedParameters: ['CO (ppm)'],
            startAt: '2026-08-05T10:00:00+07:00',
            endAt: '2026-08-05T08:00:00+07:00',
            status: 'Maintenance',
          },
        },
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toMatchObject({ code: 'VALIDATION_ERROR' });
    expect(mockedService.createDeviceConfigs).not.toHaveBeenCalled();
  });

  it('rejects status schedules whose status is outside the supported whitelist', async () => {
    const response = await request(createApp())
      .post('/api/v1/cems-wpms-requests/17/device-configs')
      .set('Authorization', `Bearer ${accessToken()}`)
      .send({
        config: {
          stationId: 'S0001',
          device: [
            {
              deviceCode: 'S0001/01',
              protocol: 'MODBUS_TCP',
              settings: {},
            },
          ],
          channels: [],
          statusManagement: {
            schedules: [
              {
                selectedParameters: ['CO (ppm)'],
                startAt: '2026-08-05T08:00:00+07:00',
                endAt: '2026-08-05T10:00:00+07:00',
                status: 'Unknown status',
              },
            ],
          },
        },
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toMatchObject({ code: 'VALIDATION_ERROR' });
    expect(mockedService.createDeviceConfigs).not.toHaveBeenCalled();
  });

  it('normalizes legacy schedule timestamps that omit an explicit timezone', async () => {
    const response = await request(createApp())
      .post('/api/v1/cems-wpms-requests/17/device-configs')
      .set('Authorization', `Bearer ${accessToken()}`)
      .send({
        config: {
          stationId: 'S0001',
          device: [
            {
              deviceCode: 'S0001/01',
              protocol: 'MODBUS_TCP',
              settings: {},
            },
          ],
          channels: [],
          statusManagement: {
            schedules: [
              {
                selectedParameters: ['CO (ppm)'],
                startAt: '2026-08-05T08:00:00',
                endAt: '2026-08-05T10:00:00+07:00',
                status: 'Maintenance',
              },
            ],
          },
        },
      });

    expect(response.status).toBe(201);
    expect(mockedService.createDeviceConfigs).toHaveBeenCalledWith(
      17,
      {
        configs: [
          expect.objectContaining({
            statusManagement: {
              selectedParameters: ['CO (ppm)'],
              startAt: '2026-08-05 08:00:00',
              endAt: '2026-08-05 10:00:00',
              status: 'Maintenance',
              schedules: [
                {
                  selectedParameters: ['CO (ppm)'],
                  startAt: '2026-08-05 08:00:00',
                  endAt: '2026-08-05 10:00:00',
                  status: 'Maintenance',
                },
              ],
            },
          }),
        ],
      },
      42,
    );
  });

  it('rejects status schedules whose end time is not after the start time', async () => {
    const response = await request(createApp())
      .post('/api/v1/cems-wpms-requests/17/device-configs')
      .set('Authorization', `Bearer ${accessToken()}`)
      .send({
        config: {
          stationId: 'S0001',
          device: [
            {
              deviceCode: 'S0001/01',
              protocol: 'MODBUS_TCP',
              settings: {},
            },
          ],
          channels: [],
          statusManagement: {
            schedules: [
              {
                selectedParameters: ['CO (ppm)'],
                startAt: '2026-08-05T10:00:00+07:00',
                endAt: '2026-08-05T08:00:00+07:00',
                status: 'Maintenance',
              },
            ],
          },
        },
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toMatchObject({ code: 'VALIDATION_ERROR' });
    expect(mockedService.createDeviceConfigs).not.toHaveBeenCalled();
  });

  it('rejects status schedules that do not target any parameters', async () => {
    const response = await request(createApp())
      .post('/api/v1/cems-wpms-requests/17/device-configs')
      .set('Authorization', `Bearer ${accessToken()}`)
      .send({
        config: {
          stationId: 'S0001',
          device: [
            {
              deviceCode: 'S0001/01',
              protocol: 'MODBUS_TCP',
              settings: {},
            },
          ],
          channels: [],
          statusManagement: {
            schedules: [
              {
                selectedParameters: [],
                startAt: '2026-08-05T08:00:00+07:00',
                endAt: '2026-08-05T10:00:00+07:00',
                status: 'Maintenance',
              },
            ],
          },
        },
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toMatchObject({ code: 'VALIDATION_ERROR' });
    expect(mockedService.createDeviceConfigs).not.toHaveBeenCalled();
  });

  it('limits the number of status schedules in one device config payload', async () => {
    const schedules = Array.from({ length: 101 }, (_, index) => ({
      selectedParameters: ['CO (ppm)'],
      startAt: new Date(Date.UTC(2026, 7, 5, index * 2)).toISOString(),
      endAt: new Date(Date.UTC(2026, 7, 5, index * 2 + 1)).toISOString(),
      status: 'Maintenance',
    }));

    const response = await request(createApp())
      .post('/api/v1/cems-wpms-requests/17/device-configs')
      .set('Authorization', `Bearer ${accessToken()}`)
      .send({
        config: {
          stationId: 'S0001',
          device: [
            {
              deviceCode: 'S0001/01',
              protocol: 'MODBUS_TCP',
              settings: {},
            },
          ],
          channels: [],
          statusManagement: { schedules },
        },
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toMatchObject({ code: 'VALIDATION_ERROR' });
    expect(mockedService.createDeviceConfigs).not.toHaveBeenCalled();
  });

  it('rejects overlapping status schedules for the same parameter', async () => {
    const response = await request(createApp())
      .post('/api/v1/cems-wpms-requests/17/device-configs')
      .set('Authorization', `Bearer ${accessToken()}`)
      .send({
        config: {
          stationId: 'S0001',
          device: [
            {
              deviceCode: 'S0001/01',
              protocol: 'MODBUS_TCP',
              settings: {},
            },
          ],
          channels: [],
          statusManagement: {
            schedules: [
              {
                selectedParameters: ['CO (ppm)'],
                startAt: '2026-08-05T08:00:00+07:00',
                endAt: '2026-08-05T10:00:00+07:00',
                status: 'Maintenance',
              },
              {
                selectedParameters: ['CO (ppm)'],
                startAt: '2026-08-05T09:30:00+07:00',
                endAt: '2026-08-05T11:00:00+07:00',
                status: 'Calibration',
              },
            ],
          },
        },
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toMatchObject({ code: 'VALIDATION_ERROR' });
    expect(mockedService.createDeviceConfigs).not.toHaveBeenCalled();
  });

  it('returns field and full-path issues without calling the service for invalid EIA Other', async () => {
    const response = await request(createApp())
      .post('/api/v1/cems-wpms-requests/measurement-points')
      .set('Authorization', `Bearer ${accessToken()}`)
      .send({
        ...validWpmsPayload(),
        eia: 'อื่นๆ',
        eiaOther: null,
        hasEia: false,
      });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        details: {
          eiaOther: ['eiaOther is required when eia is อื่นๆ'],
        },
        issues: [
          {
            code: 'custom',
            path: ['eiaOther'],
            pathString: 'eiaOther',
            message: 'eiaOther is required when eia is อื่นๆ',
          },
        ],
      },
    });
    expect(mockedService.createMeasurementPointRequest).not.toHaveBeenCalled();
  });

  it('keeps the validation error contract for request-type-specific resubmit failures', async () => {
    mockedService.resubmit.mockRejectedValueOnce(
      new ZodError([
        {
          code: 'custom',
          path: ['measurementPoints', 0, 'details', 'legalAnnexNo'],
          message: 'legalAnnexNo must contain only 1-13',
        },
      ]),
    );

    const response = await request(createApp())
      .put('/api/v1/cems-wpms-requests/17/form')
      .set('Authorization', `Bearer ${accessToken()}`)
      .send(validWpmsPayload());

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        issues: [
          {
            path: ['measurementPoints', 0, 'details', 'legalAnnexNo'],
            pathString: 'measurementPoints.0.details.legalAnnexNo',
          },
        ],
      },
    });
  });
});

function validWpmsPayload() {
  return {
    factoryId: 'factory-001',
    factoryName: 'บริษัท ทดสอบ จำกัด',
    factoryRegistrationNo: '3-106-33/50สบ',
    eia: 'มี EIA',
    eiaOther: null,
    hasEia: true,
    systemType: 'WPMS',
    contactPersons: [
      {
        name: 'สมชาย ใจดี',
        phone: '0812345678',
        email: 'operator@example.com',
      },
    ],
    measurementPoints: [
      {
        pointName: 'จุดระบายน้ำทิ้ง A',
        pointType: 'WASTEWATER',
        details: {
          monitoringPointKind: 'WPMS',
          eligibleParameters: ['BOD (mg/l)'],
          exemptedParameters: ['ไม่มี'],
          connectedParameters: ['ไม่มี'],
          pendingParameters: ['BOD (mg/l)'],
          requestedParameters: ['BOD (mg/l)'],
          hasTreatmentSystem: 'มี',
          treatmentSystem: ['Activated Sludge'],
          maxTreatmentCapacity: 100,
          connectionDevice: 'D-POMS Client (ใหม่)',
        },
        documentsAndImages: [],
        measurementInstruments: {
          converterBrand: null,
          converterModel: null,
          parameters: [],
        },
      },
    ],
  };
}

function validCemsAddParameterPayload() {
  const payload = validWpmsPayload();

  return {
    ...payload,
    systemType: 'CEMS',
    measurementPoints: [
      {
        ...payload.measurementPoints[0],
        pointName: 'ปล่องระบาย A',
        pointCode: 'S0001',
        pointType: 'STACK',
        details: {
          monitoringPointKind: 'CEMS',
          eligibleParameters: ['CO (ppm)'],
          exemptedParameters: ['ไม่มี'],
          connectedParameters: ['ไม่มี'],
          pendingParameters: ['CO (ppm)'],
          requestedParameters: ['CO (ppm)'],
          stackShape: 'วงกลม',
          stackDiameter: 1.2,
          primaryFuel: 'ก๊าซธรรมชาติ',
          secondaryFuel: 'ไม่มี',
          combustionControlSystem: 'ระบบปิด',
          hasTreatmentSystem: 'ไม่มี',
          treatmentSystem: [],
          connectionDevice: 'D-POMS Client (ใหม่)',
        },
        documentsAndImages: [],
        measurementInstruments: {
          converterBrand: null,
          converterModel: null,
          parameters: [{ parameter: 'CO (ppm)', technique: 'NDIR' }],
        },
      },
    ],
  };
}

function accessToken(): string {
  return signAccessToken({
    sub: '42',
    userType: 'operator',
    roles: ['factory_operator'],
    scopes: {
      'cems_wpms_requests:edit': 'OWN_FACTORY',
    },
  });
}

function officerMeasurementPointToken(): string {
  return signAccessToken({
    sub: '52',
    userType: 'officer',
    roles: ['monitoring_kpm'],
    scopes: {
      'cems_wpms_requests:edit': 'ALL',
      'cems_wpms_requests:direct_connect': 'ALL',
    },
    scopeDetails: {
      'cems_wpms_requests:edit': { scope: 'ALL' },
      'cems_wpms_requests:direct_connect': { scope: 'ALL' },
    },
  });
}
