import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { connectionRequestsRoutes } from '../../src/modules/connection-requests/connection-requests.routes';
import type {
  ConnectionRequestType,
  ConnectionSystemType,
} from '../../src/modules/connection-requests/connection-requests.types';
import { errorHandler } from '../../src/shared/middlewares/errorHandler';
import { signTestAccessToken } from '../helpers/live-authorization-fixture';

jest.mock('../../src/modules/connection-requests/connection-requests.repository', () => ({
  connectionRequestsRepository: {
    findById: jest.fn(),
    canEditRequest: jest.fn(),
    findActiveEligibleFactoryReference: jest.fn(),
    replaceForm: jest.fn(),
  },
}));

type RepositoryMethod =
  | 'findById'
  | 'canEditRequest'
  | 'findActiveEligibleFactoryReference'
  | 'replaceForm';
const { connectionRequestsRepository: repository } = jest.requireMock<{
  connectionRequestsRepository: Record<
    RepositoryMethod,
    jest.Mock<(...args: unknown[]) => Promise<unknown>>
  >;
}>('../../src/modules/connection-requests/connection-requests.repository');

const systems: ConnectionSystemType[] = ['CEMS', 'WPMS'];
const requestTypes: ConnectionRequestType[] = ['NEW_CONNECTION', 'ADD_MEASUREMENT_POINT'];
const emptyPointCases = systems.flatMap((systemType) =>
  requestTypes.flatMap((requestType) =>
    ['ได้รับการยกเว้นทั้งหมด', 'อยู่ระหว่างขยายเวลา'].map((monitoringPointStatus) => ({
      systemType,
      requestType,
      monitoringPointStatus,
    })),
  ),
);

describe('PUT form validation through the real controller and service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    repository.canEditRequest.mockResolvedValue(true);
    repository.findActiveEligibleFactoryReference.mockResolvedValue({
      id: 17,
      factoryRegistrationNoNew: 'AUDIT-001',
      factoryRegistrationNoOld: null,
    });
    repository.replaceForm.mockResolvedValue({
      id: 10304,
      status: 'REVISED_PENDING_DESIGN_REVIEW',
    });
  });

  it.each(emptyPointCases)(
    'saves changed coordinates for $systemType $requestType $monitoringPointStatus',
    async ({ systemType, requestType, monitoringPointStatus }) => {
      const body = formBody(systemType);
      body.measurementPoints[0].monitoringPointStatus = monitoringPointStatus;
      const response = await submit(body, requestType);

      expect(response.body.error).toBeUndefined();
      expect(response.status).toBe(200);
      expect(repository.replaceForm).toHaveBeenCalledWith(
        10304,
        expect.objectContaining({
          requestType,
          latitude: 13.6418985,
          longitude: 100.5840096,
          measurementPoints: [
            expect.objectContaining({
              monitoringPointStatus,
              parameters: [],
              details: expect.objectContaining({
                requestedParameters: [],
                ...(systemType === 'CEMS'
                  ? { stackLatitude: 13.643351, stackLongitude: 100.584545 }
                  : { instrumentLatitude: 13.643351, instrumentLongitude: 100.584545 }),
              }),
              measurementInstruments: expect.objectContaining({ parameters: [] }),
            }),
          ],
        }),
        42,
        'REVISED_PENDING_DESIGN_REVIEW',
        expect.objectContaining({ actorUserId: 42, scope: { scope: 'OWN_FACTORY' } }),
      );
    },
  );

  it.each(systems)('keeps real parameters when an empty point shares a %s form', async (system) => {
    const parameter = system === 'CEMS' ? 'CO (ppm)' : 'BOD (mg/l)';
    const body = formBody(system, [parameter]);
    body.measurementPoints.push({
      ...formBody(system).measurementPoints[0],
      pointName: 'จุดยกเว้น',
    });
    const response = await submit(body, 'ADD_MEASUREMENT_POINT');

    expect(response.body.error).toBeUndefined();
    expect(response.status).toBe(200);
    expect(repository.replaceForm).toHaveBeenCalledWith(
      10304,
      expect.objectContaining({
        measurementPoints: [
          expect.objectContaining({ parameters: [parameter] }),
          expect.objectContaining({ parameters: [] }),
        ],
      }),
      42,
      'REVISED_PENDING_DESIGN_REVIEW',
      expect.anything(),
    );
  });

  it('accepts explicit empty parameters and the unchanged request type', async () => {
    const body = formBody('CEMS');
    const response = await submit(
      {
        ...body,
        requestType: 'ADD_MEASUREMENT_POINT',
        measurementPoints: [{ ...body.measurementPoints[0], parameters: [] }],
      },
      'ADD_MEASUREMENT_POINT',
    );
    expect(response.body.error).toBeUndefined();
    expect(response.status).toBe(200);
    expect(repository.replaceForm).toHaveBeenCalledTimes(1);
  });

  it.each([64, 65, 128])(
    'resubmits an instrument-derived parameter with %i characters',
    async (length) => {
      const parameter = `${'P'.repeat(length - 8)} (mg/m3)`;
      const body = instrumentOnlyBody([parameter]);
      const response = await submit(body);

      expect(response.body.error).toBeUndefined();
      expect(response.status).toBe(200);
      expect(repository.replaceForm).toHaveBeenCalledWith(
        10304,
        expect.objectContaining({
          measurementPoints: [expect.objectContaining({ parameters: [parameter] })],
        }),
        42,
        'REVISED_PENDING_DESIGN_REVIEW',
        expect.anything(),
      );
    },
  );

  it.each([50, 51, 100])('resubmits %i instrument-derived parameters', async (count) => {
    const parameters = Array.from({ length: count }, (_, i) => `P${i} (ppm)`);
    const response = await submit(instrumentOnlyBody(parameters));

    expect(response.body.error).toBeUndefined();
    expect(response.status).toBe(200);
    expect(repository.replaceForm).toHaveBeenCalledWith(
      10304,
      expect.objectContaining({
        measurementPoints: [expect.objectContaining({ parameters })],
      }),
      42,
      'REVISED_PENDING_DESIGN_REVIEW',
      expect.anything(),
    );
  });

  it.each([
    {
      parameters: [`${'P'.repeat(121)} (mg/m3)`],
      field: 'measurementPoints.0.measurementInstruments.parameters.0.parameter',
    },
    {
      parameters: Array.from({ length: 101 }, (_, i) => `P${i} (ppm)`),
      field: 'measurementPoints.0.measurementInstruments.parameters',
    },
  ])(
    'rejects instrument data outside the shared limits at $field',
    async ({ parameters, field }) => {
      const response = await submit(instrumentOnlyBody(parameters));

      expect(response.status).toBe(400);
      expect(response.body.error.issues).toEqual(
        expect.arrayContaining([expect.objectContaining({ code: 'too_big', pathString: field })]),
      );
      expect(repository.replaceForm).not.toHaveBeenCalled();
    },
  );
  it('still rejects editing a factory outside the assigned scope', async () => {
    repository.canEditRequest.mockResolvedValue(false);
    const response = await submit(formBody('CEMS'));
    expect(response.status).toBe(403);
    expect(repository.replaceForm).not.toHaveBeenCalled();
  });

  it.each([
    { name: 'wrong workflow status', stored: { status: 'CONNECTED' }, status: 400 },
    { name: 'different factory', stored: { factoryId: 'other-factory' }, status: 400 },
    { name: 'stale form', stored: { updatedAt: '2026-11-02T01:00:00.000Z' }, status: 409 },
  ])('still rejects $name before writing', async ({ stored, status }) => {
    const response = await submit(
      {
        ...formBody('CEMS'),
        expectedUpdatedAt: '2026-11-02T00:00:00.000Z',
      },
      'NEW_CONNECTION',
      stored,
    );
    expect(response.status).toBe(status);
    expect(repository.replaceForm).not.toHaveBeenCalled();
  });

  it('still rejects changing the original request type', async () => {
    const response = await submit({ ...formBody('CEMS'), requestType: 'ADD_MEASUREMENT_POINT' });
    expect(response.status).toBe(400);
    expect(repository.replaceForm).not.toHaveBeenCalled();
  });

  it('still rejects invalid coordinates', async () => {
    const response = await submit({ ...formBody('CEMS'), latitude: 91 });
    expect(response.status).toBe(400);
    expect(response.body.error.issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ pathString: 'latitude' })]),
    );
    expect(repository.replaceForm).not.toHaveBeenCalled();
  });
});

function formBody(systemType: ConnectionSystemType, parameters: string[] = []) {
  return {
    factoryId: 'audit-factory',
    factoryName: 'โรงงานทดสอบ',
    factoryRegistrationNo: 'AUDIT-001',
    systemType,
    latitude: 13.6418985,
    longitude: 100.5840096,
    contactPersons: [{ name: 'ผู้ติดต่อ', phone: '0812345678' }],
    measurementPoints: [
      {
        pointName: 'จุดตรวจวัด',
        pointCode: '',
        pointType: systemType === 'CEMS' ? 'STACK' : 'WASTEWATER',
        monitoringPointStatus: parameters.length > 0 ? null : 'ได้รับการยกเว้นทั้งหมด',
        details: {
          monitoringPointKind: systemType,
          requestedParameters: parameters,
          ...(systemType === 'CEMS'
            ? {
                stackShape: 'วงกลม',
                stackDiameter: 1.2,
                stackLatitude: 13.643351,
                stackLongitude: 100.584545,
              }
            : { instrumentLatitude: 13.643351, instrumentLongitude: 100.584545 }),
        },
        documentsAndImages:
          systemType === 'CEMS'
            ? [{ title: 'ภาพถ่ายปล่อง', fileUrl: 'https://example.com/stack.jpg' }]
            : [],
        measurementInstruments: { parameters: parameters.map((parameter) => ({ parameter })) },
      },
    ],
  };
}

function instrumentOnlyBody(parameters: string[]) {
  const body = formBody('CEMS', parameters);
  const { requestedParameters: _requested, ...details } = body.measurementPoints[0].details;
  return {
    ...body,
    measurementPoints: [{ ...body.measurementPoints[0], monitoringPointStatus: null, details }],
  };
}

async function submit<
  T extends { factoryId: string; factoryRegistrationNo: string; systemType: string },
>(
  body: T,
  requestType: ConnectionRequestType = 'NEW_CONNECTION',
  storedFields: Record<string, unknown> = {},
) {
  repository.findById.mockResolvedValue({
    ...body,
    id: 10304,
    requestType,
    status: 'WAITING_FACTORY_REVISION',
    updatedAt: '2026-11-02T00:00:00.000Z',
    ...storedFields,
  });
  const app = express();
  app.use(express.json());
  app.use('/api/v1/cems-wpms-requests', connectionRequestsRoutes);
  app.use(errorHandler);
  const token = signTestAccessToken({
    sub: '42',
    userType: 'operator',
    roles: ['factory_operator'],
    scopes: { 'cems_wpms_requests:edit': 'OWN_FACTORY' },
  });
  return request(app)
    .put('/api/v1/cems-wpms-requests/10304/form')
    .set('Authorization', `Bearer ${token}`)
    .send(body);
}
