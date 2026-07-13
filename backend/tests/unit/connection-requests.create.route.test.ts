import request from 'supertest';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { ZodError } from 'zod';
import { signAccessToken } from '../../src/shared/utils/jwt';

jest.mock('../../src/modules/connection-requests/connection-requests.service', () => ({
  connectionRequestsService: {
    createMeasurementPointRequest: jest.fn(),
    createParameterRequest: jest.fn(),
    resubmit: jest.fn(),
  },
}));

import { createApp } from '../../src/app';
import { connectionRequestsService } from '../../src/modules/connection-requests/connection-requests.service';

const mockedService = jest.mocked(connectionRequestsService);

describe('create measurement-point request route', () => {
  const serviceResponse = {
    id: 17,
    requestNo: 'WPMS-69-00017',
    requestType: 'ADD_MEASUREMENT_POINT',
    eia: 'มี EIA',
    eiaOther: null,
    hasEia: true,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockedService.createMeasurementPointRequest.mockResolvedValue(serviceResponse as never);
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
      42,
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
