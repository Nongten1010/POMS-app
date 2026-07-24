import request from 'supertest';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { ConflictError } from '../../src/shared/errors/AppError';
import { signAccessToken } from '../../src/shared/utils/jwt';

jest.mock('../../src/modules/connection-requests/connection-requests.service', () => ({
  connectionRequestsService: {
    createDirectConnection: jest.fn(),
  },
}));

import { createApp } from '../../src/app';
import { connectionRequestsService } from '../../src/modules/connection-requests/connection-requests.service';

const mockedService = connectionRequestsService as unknown as {
  createDirectConnection: jest.Mock<(...args: unknown[]) => Promise<unknown>>;
};

describe('POST /api/v1/cems-wpms-requests/direct-connections', () => {
  const serviceResponse = {
    id: 91,
    requestNo: 'WEMS-0001/2569',
    requestType: 'ADD_MEASUREMENT_POINT',
    status: 'CONNECTED',
    statusLabel: 'เชื่อมต่อแล้ว',
    submissionSource: 'OFFICER_DIRECT_API',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockedService.createDirectConnection.mockResolvedValue(serviceResponse);
  });

  it('returns 201 and Location, and passes normalized officer input to the service', async () => {
    const response = await request(createApp())
      .post('/api/v1/cems-wpms-requests/direct-connections')
      .set('Authorization', `Bearer ${officerToken()}`)
      .send(validPayload());

    expect(response.status).toBe(201);
    expect(response.headers.location).toBe('/api/v1/cems-wpms-requests/91');
    expect(response.body).toEqual({ success: true, data: serviceResponse });
    expect(mockedService.createDirectConnection).toHaveBeenCalledWith(
      expect.objectContaining({
        requestType: 'ADD_MEASUREMENT_POINT',
        measurementPoints: [expect.objectContaining({ pointCode: 'manual/code-01' })],
      }),
      expect.objectContaining({
        actorUserId: 42,
        userType: 'officer',
        roles: ['monitoring_kpm'],
        scope: { scope: 'ALL' },
      }),
    );
  });

  it('allows an admin with the dedicated direct-connection permission', async () => {
    const response = await request(createApp())
      .post('/api/v1/cems-wpms-requests/direct-connections')
      .set('Authorization', `Bearer ${adminToken()}`)
      .send(validPayload());

    expect(response.status).toBe(201);
    expect(mockedService.createDirectConnection).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        actorUserId: 7,
        userType: 'admin',
        roles: ['admin'],
        scope: { scope: 'ALL' },
      }),
    );
  });

  it('rejects a request containing more than one measurement point', async () => {
    const payload = validPayload();
    const response = await request(createApp())
      .post('/api/v1/cems-wpms-requests/direct-connections')
      .set('Authorization', `Bearer ${officerToken()}`)
      .send({
        ...payload,
        measurementPoints: [payload.measurementPoints[0], payload.measurementPoints[0]],
      });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      success: false,
      error: { code: 'VALIDATION_ERROR' },
    });
    expect(response.body.error.issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ pathString: 'measurementPoints' })]),
    );
    expect(mockedService.createDirectConnection).not.toHaveBeenCalled();
  });

  it('requires a non-empty officer-supplied point code', async () => {
    const payload = validPayload();
    const response = await request(createApp())
      .post('/api/v1/cems-wpms-requests/direct-connections')
      .set('Authorization', `Bearer ${officerToken()}`)
      .send({
        ...payload,
        measurementPoints: [{ ...payload.measurementPoints[0], pointCode: '   ' }],
      });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        issues: [expect.objectContaining({ pathString: 'measurementPoints.0.pointCode' })],
      },
    });
    expect(mockedService.createDirectConnection).not.toHaveBeenCalled();
  });

  it('rejects server-owned workflow fields', async () => {
    const response = await request(createApp())
      .post('/api/v1/cems-wpms-requests/direct-connections')
      .set('Authorization', `Bearer ${officerToken()}`)
      .send({ ...validPayload(), status: 'PENDING_DESIGN_REVIEW' });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      success: false,
      error: { code: 'VALIDATION_ERROR' },
    });
    expect(mockedService.createDirectConnection).not.toHaveBeenCalled();
  });

  it('requires the dedicated direct-connection permission', async () => {
    const response = await request(createApp())
      .post('/api/v1/cems-wpms-requests/direct-connections')
      .set('Authorization', `Bearer ${officerToken({ permission: false })}`)
      .send(validPayload());

    expect(response.status).toBe(403);
    expect(response.body).toMatchObject({
      success: false,
      error: { code: 'FORBIDDEN' },
    });
    expect(mockedService.createDirectConnection).not.toHaveBeenCalled();
  });

  it('does not allow an operator even if a token is manually given the permission', async () => {
    const response = await request(createApp())
      .post('/api/v1/cems-wpms-requests/direct-connections')
      .set('Authorization', `Bearer ${operatorTokenWithDirectPermission()}`)
      .send(validPayload());

    expect(response.status).toBe(403);
    expect(response.body).toMatchObject({
      success: false,
      error: { code: 'FORBIDDEN' },
    });
    expect(mockedService.createDirectConnection).not.toHaveBeenCalled();
  });

  it('preserves a duplicate active point-code conflict', async () => {
    mockedService.createDirectConnection.mockRejectedValueOnce(
      new ConflictError('Measurement point code is already connected', {
        path: 'measurementPoints.0.pointCode',
        pointCode: 'manual/code-01',
      }),
    );

    const response = await request(createApp())
      .post('/api/v1/cems-wpms-requests/direct-connections')
      .set('Authorization', `Bearer ${officerToken()}`)
      .send(validPayload());

    expect(response.status).toBe(409);
    expect(response.body).toMatchObject({
      success: false,
      error: {
        code: 'CONFLICT',
        details: {
          path: 'measurementPoints.0.pointCode',
          pointCode: 'manual/code-01',
        },
      },
    });
  });
});

function validPayload() {
  return {
    factoryId: 'factory-001',
    factoryName: 'ชื่อจากหน้าจอ',
    factoryRegistrationNo: 'REG-INPUT',
    eia: 'มี EIA',
    eiaOther: null,
    hasEia: true,
    systemType: 'WPMS',
    contactPersons: [
      {
        name: 'สมชาย ใจดี',
        phone: '0812345678',
        email: 'officer@example.com',
      },
    ],
    measurementPoints: [
      {
        pointName: 'จุดระบายน้ำทิ้ง A',
        pointCode: '  manual/code-01  ',
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

function officerToken(options: { permission?: boolean } = {}): string {
  const hasPermission = options.permission ?? true;
  return signAccessToken({
    sub: '42',
    userType: 'officer',
    roles: ['monitoring_kpm'],
    scopes: hasPermission
      ? { 'cems_wpms_requests:direct_connect': 'ALL' }
      : { 'cems_wpms_requests:view': 'ALL' },
  });
}

function operatorTokenWithDirectPermission(): string {
  return signAccessToken({
    sub: '42',
    userType: 'operator',
    roles: ['factory_operator'],
    scopes: { 'cems_wpms_requests:direct_connect': 'ALL' },
  });
}

function adminToken(): string {
  return signAccessToken({
    sub: '7',
    userType: 'admin',
    roles: ['admin'],
    scopes: { 'cems_wpms_requests:direct_connect': 'ALL' },
  });
}
