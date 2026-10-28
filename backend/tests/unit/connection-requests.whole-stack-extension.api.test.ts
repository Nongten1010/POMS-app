import express from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { connectionRequestsRoutes } from '../../src/modules/connection-requests/connection-requests.routes';
import { connectionRequestsService } from '../../src/modules/connection-requests/connection-requests.service';
import { errorHandler, notFoundHandler } from '../../src/shared/middlewares/errorHandler';
import { createConnectionRequestApprovalApiFixture } from '../helpers/connection-request-approval-api-fixture';
import { signTestAccessToken } from '../helpers/live-authorization-fixture';

const now = '2026-10-28T03:00:00.000Z';

describe('whole-stack extension approval API', () => {
  let fixture: Awaited<ReturnType<typeof createConnectionRequestApprovalApiFixture>>;
  beforeEach(async () => {
    fixture = await createConnectionRequestApprovalApiFixture();
    connectionRequestsService.setClockForTests(() => new Date(now));
  });
  afterEach(() => {
    fixture?.close();
    connectionRequestsService.setClockForTests(() => new Date());
    jest.restoreAllMocks();
  });

  it('approves a whole-stack extension without device setup or a 30-day deadline', async () => {
    const response = await request(app())
      .post('/api/v1/cems-wpms-requests/101/review')
      .set('Authorization', `Bearer ${officerToken()}`)
      .send({ decision: 'APPROVE_DESIGN' });

    expect(response.body.error).toBeUndefined();
    expect({ status: response.status, body: response.body }).toMatchObject({
      status: 200,
      body: {
        success: true,
        data: {
          status: 'CONNECTED',
          connectionDueAt: null,
          confirmedAt: null,
          verifiedAt: now,
          measurementPoints: [
            {
              pointCode: 'S2001',
              monitoringPointStatus: 'อยู่ระหว่างขยายเวลา',
              parameters: [],
              measurementInstruments: { parameters: [] },
            },
          ],
        },
      },
    });
  });

  it.each(['อยู่ระหว่างขยายเวลา', 'ได้รับการยกเว้นทั้งหมด'])(
    'supports APPROVE_FORM with the same approval flow for %s',
    async (status) => {
      fixture.execute('UPDATE cems_wpms_measurement_points SET monitoring_point_status = ?', [
        status,
      ]);
      const response = await request(app())
        .post('/api/v1/cems-wpms-requests/101/status')
        .set('Authorization', `Bearer ${officerToken()}`)
        .send({ action: 'APPROVE_FORM' });
      expect(response.body.error).toBeUndefined();
      expect(response.status).toBe(200);
      expect(response.body.data).toMatchObject({
        status: 'CONNECTED',
        connectionDueAt: null,
        verifiedAt: now,
        measurementPoints: [{ pointCode: 'S2001', monitoringPointStatus: status, parameters: [] }],
      });
      const stored = await request(app())
        .get('/api/v1/cems-wpms-requests/101')
        .set('Authorization', `Bearer ${officerToken()}`);
      expect(stored.status).toBe(200);
      expect(stored.body.data).toMatchObject({
        status: 'CONNECTED',
        statusHistory: [{ status: 'CONNECTED' }],
        measurementPoints: [{ pointCode: 'S2001', monitoringPointStatus: status, parameters: [] }],
      });
    },
  );

  it('keeps device setup for an extension request containing real measurement parameters', async () => {
    fixture.execute(`UPDATE cems_wpms_measurement_points SET parameters_json = '["CO (ppm)"]',
      details_json = '{"requestedParameters":["CO (ppm)"]}',
      instruments_json = '{"parameters":[{"parameter":"CO (ppm)"}]}'`);
    const response = await request(app())
      .post('/api/v1/cems-wpms-requests/101/review')
      .set('Authorization', `Bearer ${officerToken()}`)
      .send({ decision: 'APPROVE_DESIGN' });
    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      status: 'WAITING_CONNECTION',
      verifiedAt: null,
      connectionDueAt: '2026-11-27T03:00:00.000Z',
      measurementPoints: [{ parameters: ['CO (ppm)'] }],
    });
  });

  it('does not bypass device setup for ADD_PARAMETER requests', async () => {
    fixture.execute("UPDATE cems_wpms_connection_requests SET request_type = 'ADD_PARAMETER'");
    fixture.execute("UPDATE cems_wpms_measurement_points SET point_code = 'S2001'");
    fixture.execute(`INSERT INTO cems_wpms_connected_measurement_points
      (id, source_measurement_point_id, source_request_id, eligible_factory_id, factory_id,
        point_code, point_name, point_type, system_type, parameters_json)
      VALUES (301, 200, 100, 17, 'fixture-factory', 'S2001', 'ปล่องเดิม', 'STACK', 'CEMS', '[]')`);
    const response = await request(app())
      .post('/api/v1/cems-wpms-requests/101/status')
      .set('Authorization', `Bearer ${officerToken()}`)
      .send({ action: 'APPROVE_FORM' });
    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({ status: 'WAITING_CONNECTION', verifiedAt: null });
  });

  it.each(['anonymous', 'operator', 'outside-province'] as const)(
    'does not activate a point when approval is attempted by %s',
    async (actor) => {
      let action = request(app()).post('/api/v1/cems-wpms-requests/101/review');
      if (actor !== 'anonymous') {
        const token =
          actor === 'operator'
            ? signTestAccessToken({
                sub: '42',
                userType: 'operator',
                roles: ['factory_operator'],
                scopes: {},
              })
            : signTestAccessToken({
                sub: '8',
                userType: 'officer',
                roles: ['officer'],
                scopes: { 'cems_wpms_requests:approve': 'IN_PROVINCE' },
                scopeDetails: {
                  'cems_wpms_requests:approve': { scope: 'IN_PROVINCE', province: 'เชียงใหม่' },
                },
              });
        action = action.set('Authorization', `Bearer ${token}`);
      }
      const response = await action.send({ decision: 'APPROVE_DESIGN' });
      expect(response.status).toBe(actor === 'anonymous' ? 401 : actor === 'operator' ? 403 : 404);
      const stored = await request(app())
        .get('/api/v1/cems-wpms-requests/101')
        .set('Authorization', `Bearer ${officerToken()}`);
      expect(stored.status).toBe(200);
      expect(stored.body.data).toMatchObject({
        status: 'PENDING_DESIGN_REVIEW',
        verifiedAt: null,
        measurementPoints: [{ pointCode: null }],
        statusHistory: [],
      });
    },
  );

  it('accepts the frontend payload before approval and preserves its point status', async () => {
    const response = await request(app())
      .post('/api/v1/cems-wpms-requests/measurement-points')
      .set(
        'Authorization',
        `Bearer ${signTestAccessToken({
          sub: '42',
          userType: 'operator',
          roles: ['factory_operator'],
          scopes: { 'cems_wpms_requests:edit': 'OWN_FACTORY' },
        })}`,
      )
      .send(wholeStackPayload());
    expect(response.body.error).toBeUndefined();
    expect(response.status).toBe(201);
    expect(response.body.data).toMatchObject({
      requestType: 'ADD_MEASUREMENT_POINT',
      status: 'PENDING_DESIGN_REVIEW',
      verifiedAt: null,
      measurementPoints: [
        { monitoringPointStatus: 'อยู่ระหว่างขยายเวลา', parameters: [], pointCode: null },
      ],
    });
    const approved = await request(app())
      .post(`/api/v1/cems-wpms-requests/${response.body.data.id}/review`)
      .set('Authorization', `Bearer ${officerToken()}`)
      .send({ decision: 'APPROVE_DESIGN' });
    expect(approved.body.error).toBeUndefined();
    expect(approved.status).toBe(200);
    expect(approved.body.data).toMatchObject({
      status: 'CONNECTED',
      connectionDueAt: null,
      measurementPoints: [
        { pointCode: 'S2001', monitoringPointStatus: 'อยู่ระหว่างขยายเวลา', parameters: [] },
      ],
    });
    const live = await request(app())
      .get('/api/v1/cems-wpms-requests/connected-measurement-points?factoryId=fixture-factory')
      .set('Authorization', `Bearer ${officerToken()}`);
    expect(live.body.error).toBeUndefined();
    expect(live.status).toBe(200);
    expect(live.body.data).toEqual([
      expect.objectContaining({
        requestId: response.body.data.id,
        statusCode: 'CONNECTED',
        point: expect.objectContaining({
          pointCode: 'S2001',
          monitoringPointStatus: 'อยู่ระหว่างขยายเวลา',
          parameters: [],
        }),
        deviceConfigs: expect.any(Object),
      }),
    ]);
  });

  it('rolls back a failed activation and can retry without losing the point code', async () => {
    fixture.cleanupState.denyMetadata = true;
    const failed = await request(app())
      .post('/api/v1/cems-wpms-requests/101/review')
      .set('Authorization', `Bearer ${officerToken()}`)
      .send({ decision: 'APPROVE_DESIGN' });
    expect(failed.status).toBe(503);
    expect(failed.body).toMatchObject({
      success: false,
      error: { code: 'MEASUREMENT_CLEANUP_FAILED', details: { retryable: true } },
    });
    const stored = await request(app())
      .get('/api/v1/cems-wpms-requests/101')
      .set('Authorization', `Bearer ${officerToken()}`);
    expect(stored.status).toBe(200);
    expect(stored.body.data).toMatchObject({
      status: 'PENDING_DESIGN_REVIEW',
      verifiedAt: null,
      statusHistory: [],
      measurementPoints: [{ pointCode: null }],
    });
    fixture.cleanupState.denyMetadata = false;
    const retried = await request(app())
      .post('/api/v1/cems-wpms-requests/101/review')
      .set('Authorization', `Bearer ${officerToken()}`)
      .send({ decision: 'APPROVE_DESIGN' });
    expect(retried.status).toBe(200);
    expect(retried.body.data).toMatchObject({
      status: 'CONNECTED',
      measurementPoints: [{ pointCode: 'S2001' }],
    });
  });

  it.each([
    ['ได้รับการยกเว้นทั้งหมด', '[]', 'CONNECTED'],
    ['อยู่ระหว่างเชื่อมต่อ', '["CO (ppm)"]', 'WAITING_CONNECTION'],
  ])(
    'requires every point to qualify when the second point is %s',
    async (status, parameters, expected) => {
      fixture.execute(
        `INSERT INTO cems_wpms_measurement_points
      (id, request_id, point_name, point_type, parameters_json, monitoring_point_status,
        details_json, instruments_json)
      VALUES (202, 101, 'ปล่องที่สอง', 'STACK', ?, ?, ?, '{"parameters":[]}')`,
        [parameters, status, JSON.stringify({ requestedParameters: JSON.parse(parameters) })],
      );
      const response = await request(app())
        .post('/api/v1/cems-wpms-requests/101/status')
        .set('Authorization', `Bearer ${officerToken()}`)
        .send({ action: 'APPROVE_FORM' });
      expect(response.body.error).toBeUndefined();
      expect(response.status).toBe(200);
      expect(response.body.data).toMatchObject({
        status: expected,
        measurementPoints: [
          { pointCode: 'S2001', monitoringPointStatus: 'อยู่ระหว่างขยายเวลา' },
          { pointCode: 'S2002', monitoringPointStatus: status },
        ],
      });
    },
  );

  it('requires the existing API enum rather than the frontend display label', async () => {
    const payload = wholeStackPayload();
    payload.measurementPoints[0].monitoringPointStatus = 'อยู่ระหว่างขยายระยะเวลาทั้งปล่อง';
    const response = await request(app())
      .post('/api/v1/cems-wpms-requests/measurement-points')
      .set(
        'Authorization',
        `Bearer ${signTestAccessToken({
          sub: '42',
          userType: 'operator',
          roles: ['factory_operator'],
          scopes: { 'cems_wpms_requests:edit': 'OWN_FACTORY' },
        })}`,
      )
      .send(payload);
    expect(response.status).toBe(400);
    expect(response.body.error).toMatchObject({
      code: 'VALIDATION_ERROR',
      issues: expect.arrayContaining([
        expect.objectContaining({
          pathString: 'measurementPoints.0.monitoringPointStatus',
        }),
      ]),
    });
  });
});

function wholeStackPayload() {
  return {
    factoryId: 'fixture-factory',
    factoryName: 'โรงงานทดสอบ',
    factoryRegistrationNo: 'TEST-001',
    systemType: 'CEMS',
    contactPersons: [{ name: 'ผู้ทดสอบ', phone: '0800000000' }],
    measurementPoints: [
      {
        pointName: 'ปล่องขยายเวลา',
        pointType: 'STACK',
        monitoringPointStatus: 'อยู่ระหว่างขยายเวลา',
        details: { requestedParameters: [], stackShape: 'วงกลม', stackDiameter: 1.2 },
        documentsAndImages: [
          {
            title: 'ภาพถ่ายปล่อง',
            fileUrl: 'https://example.com/stack.jpg',
            fileName: 'stack.jpg',
            fileType: 'image/jpeg',
            fileSize: 2048,
          },
        ],
        measurementInstruments: { parameters: [] },
      },
    ],
  };
}

function officerToken() {
  return signTestAccessToken({
    sub: '7',
    userType: 'officer',
    roles: ['officer'],
    scopes: { 'cems_wpms_requests:approve': 'ALL', 'cems_wpms_requests:view': 'ALL' },
  });
}

function app() {
  const application = express();
  application.use(express.json());
  application.use('/api/v1/cems-wpms-requests', connectionRequestsRoutes);
  application.use(notFoundHandler);
  application.use(errorHandler);
  return application;
}
