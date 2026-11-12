import express from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { db } from '../../src/config/database';
import { connectionRequestsRoutes } from '../../src/modules/connection-requests/connection-requests.routes';
import { connectionRequestsService } from '../../src/modules/connection-requests/connection-requests.service';
import { errorHandler } from '../../src/shared/middlewares/errorHandler';
import { createConnectionRequestApprovalApiFixture } from '../helpers/connection-request-approval-api-fixture';
import { signTestAccessToken } from '../helpers/live-authorization-fixture';

const requests = 'cems_wpms_connection_requests';
const points = 'cems_wpms_measurement_points';
const registry = 'cems_wpms_point_code_registry';
const configs = 'device_connection_configs';
const channels = 'device_measurement_channels';
const now = '2026-11-12T12:30:00.000Z';

describe('canceled point-code reuse through the approval API', () => {
  let fixture: Awaited<ReturnType<typeof createConnectionRequestApprovalApiFixture>>;

  beforeEach(async () => {
    fixture = await createConnectionRequestApprovalApiFixture();
    connectionRequestsService.setClockForTests(() => new Date(now));
    // Model SQL Server's unique constraint error at the SQL execution boundary.
    const run = jest.mocked(db.client.runner).getMockImplementation();
    if (!run) throw new Error('SQL fixture runner is unavailable');
    jest.mocked(db.client.runner).mockImplementation((builder: unknown) => ({
      run: async () => {
        try {
          return await run(builder).run();
        } catch (error) {
          if (
            error instanceof Error &&
            error.message.includes(
              'UNIQUE constraint failed: cems_wpms_point_code_registry.normalized_point_code',
            )
          ) {
            throw Object.assign(new Error('uq_cems_wpms_point_code_registry_normalized'), {
              number: 2627,
            });
          }
          throw error;
        }
      },
    }));
    await seedCanceledRequest();
  });

  afterEach(() => {
    fixture?.close();
    connectionRequestsService.setClockForTests(() => new Date());
    jest.restoreAllMocks();
  });

  it.each(['status', 'review'] as const)(
    'reuses P0212 with stranded configs from an old cancellation via %s',
    async (route) => {
      const oldRequest = await db(requests).where('id', 101).first();
      const oldPoint = await db(points).where('id', 201).first();
      const response = await approve(route);

      expect(response.body.error).toBeUndefined();
      expect(response.status).toBe(200);
      expect(response.body.data).toMatchObject({
        status: 'WAITING_CONNECTION',
        measurementPoints: [{ pointCode: 'P0212' }],
      });
      expect(await db(configs)).toHaveLength(2);
      expect(await db(channels)).toHaveLength(8);
      expect(await db(configs).whereNull('deleted_at')).toHaveLength(0);
      expect(await db(channels).whereNull('deleted_at')).toHaveLength(0);
      expect((await db(configs)).every((row) => Number(row.updated_by) === 7)).toBe(true);
      expect(await db(requests).where('id', 101).first()).toEqual(oldRequest);
      expect(await db(points).where('id', 201).first()).toEqual(oldPoint);
      expect(await db(registry).first()).toMatchObject({
        normalized_point_code: 'P0212',
        source_request_id: 103,
        source_measurement_point_id: 203,
      });
    },
  );

  it.each(['operator', 'officer', 'timeout'] as const)(
    'retires configs during %s cancellation before the code is reused',
    async (action) => {
      await db(requests)
        .where('id', 101)
        .update({
          status: action === 'officer' ? 'CONNECTION_CONFIRMED' : 'WAITING_CONNECTION',
          connection_due_at: '2026-11-01T00:00:00.000Z',
        });
      if (action === 'timeout') {
        expect(await connectionRequestsService.autoCancelExpiredWaitingConnections()).toBe(1);
      } else {
        const response = await request(app())
          .post(`/api/v1/cems-wpms-requests/101/${action === 'operator' ? 'cancel' : 'status'}`)
          .set('Authorization', `Bearer ${token(action)}`)
          .send(
            action === 'operator'
              ? {}
              : {
                  action: 'RETURN_TO_WAITING_CONNECTION',
                  revisionReason: 'หมดกำหนดเชื่อมต่อ',
                },
          );
        expect(response.body.error).toBeUndefined();
        expect(response.status).toBe(200);
        expect(response.body.data.status).toBe('CANCELED');
      }
      expect(await db(configs).whereNull('deleted_at')).toHaveLength(0);
      expect(await db(channels).whereNull('deleted_at')).toHaveLength(0);
      expect((await approve()).status).toBe(200);
    },
  );

  it.each([null, 999])('keeps a live current config owned by %s protected', async (source) => {
    await db(configs).where('id', 2768).update({ source_request_id: source });
    const before = await db(configs).orderBy('id');
    const response = await approve();
    expect(response.status).toBe(409);
    expect(response.body.error).toMatchObject({
      code: 'CONFLICT',
      message: 'Measurement point code is already assigned',
      details: { reason: 'POINT_CODE_ALREADY_ASSIGNED', pointCode: 'P0212' },
    });
    expect(await db(configs).orderBy('id')).toEqual(before);
    expect(await db(channels).whereNull('deleted_at')).toHaveLength(8);
  });

  it.each([null, '2026-11-01T00:00:00.000Z'])(
    'keeps a code that has connected history protected (deleted_at: %s)',
    async (deletedAt) => {
      fixture.execute(
        `INSERT INTO cems_wpms_connected_measurement_points
          (id, point_code, source_request_id, source_measurement_point_id, deleted_at)
          VALUES (301, 'P0212', 101, 201, ?)`,
        [deletedAt],
      );
      const response = await approve();
      expect(response.status).toBe(409);
      expect(await db(configs).whereNull('deleted_at')).toHaveLength(2);
      expect(await db(channels).whereNull('deleted_at')).toHaveLength(8);
    },
  );

  it("does not retire configs to reuse another factory's code", async () => {
    await db(requests).where('id', 103).update({ eligible_factory_id: 18 });
    expect((await approve()).status).toBe(409);
    expect(await db(configs).whereNull('deleted_at')).toHaveLength(2);
    expect(await db(channels).whereNull('deleted_at')).toHaveLength(8);
  });

  it('rolls back config retirement and reservation replacement when approval fails', async () => {
    fixture.execute(`CREATE TRIGGER reject_replacement BEFORE INSERT ON ${registry}
      BEGIN SELECT RAISE(ABORT, 'replacement failed'); END;`);
    expect((await approve()).status).toBe(500);
    expect(await db(configs).whereNull('deleted_at')).toHaveLength(2);
    expect(await db(channels).whereNull('deleted_at')).toHaveLength(8);
    expect(await db(registry).first()).toMatchObject({ source_request_id: 101 });
    expect(await db(requests).where('id', 103).first()).toMatchObject({
      status: 'PENDING_DESIGN_REVIEW',
    });
  });

  it('rolls back when stranded channels cannot be retired', async () => {
    fixture.execute(`CREATE TRIGGER reject_retirement BEFORE UPDATE ON ${channels}
      BEGIN SELECT RAISE(ABORT, 'retirement failed'); END;`);
    expect((await approve()).status).toBe(500);
    expect(await db(configs).whereNull('deleted_at')).toHaveLength(2);
    expect(await db(channels).whereNull('deleted_at')).toHaveLength(8);
    expect(await db(registry).first()).toMatchObject({ source_request_id: 101 });
  });

  it.each(['anonymous', 'operator'] as const)(
    'does not clean up configs for an approval attempted by %s',
    async (actor) => {
      const response = await approve('status', actor === 'anonymous' ? null : token('operator'));
      expect(response.status).toBe(actor === 'anonymous' ? 401 : 403);
      expect(await db(configs).whereNull('deleted_at')).toHaveLength(2);
      expect(await db(channels).whereNull('deleted_at')).toHaveLength(8);
      expect(await db(registry).first()).toMatchObject({ source_request_id: 101 });
    },
  );

  async function seedCanceledRequest() {
    await db(requests).where('id', 101).update({ status: 'CANCELED', system_type: 'WPMS' });
    await db(points).where('id', 201).update({
      point_code: 'P0212',
      point_code_assignment_mode: 'MANUAL_LEGACY',
      point_type: 'WASTEWATER',
      parameters_json: '["BOD (mg/l)"]',
      details_json: '{"requestedParameters":["BOD (mg/l)"]}',
      monitoring_point_status: null,
    });
    const oldRequest = await db(requests).where('id', 101).first();
    await db(requests).insert({
      ...oldRequest,
      id: 103,
      request_no: 'WPMS-0190/2569',
      status: 'PENDING_DESIGN_REVIEW',
    });
    const oldPoint = await db(points).where('id', 201).first();
    await db(points).insert({
      ...oldPoint,
      id: 203,
      request_id: 103,
      point_code: null,
      point_code_assignment_mode: null,
    });
    fixture.execute(`INSERT INTO ${registry}
      (point_code, normalized_point_code, source_request_id, source_measurement_point_id)
      VALUES ('P0212', 'P0212', 101, 201)`);
    fixture.execute(`INSERT INTO ${configs}
      (id, request_id, source_request_id, station_id, settings_json, deleted_at)
      VALUES (2767, 101, 101, 'P0212', '{}', NULL), (2768, NULL, 101, 'P0212', '{}', NULL)`);
    for (let index = 0; index < 8; index++) {
      fixture.execute(`INSERT INTO ${channels} (id, config_id, deleted_at) VALUES (?, ?, NULL)`, [
        9000 + index,
        index < 4 ? 2767 : 2768,
      ]);
    }
  }
});

function approve(
  route: 'status' | 'review' = 'status',
  accessToken: string | null = token('officer'),
) {
  const action = request(app()).post(`/api/v1/cems-wpms-requests/103/${route}`);
  if (accessToken) action.set('Authorization', `Bearer ${accessToken}`);
  return action.send({
    ...(route === 'status' ? { action: 'APPROVE_FORM' } : { decision: 'APPROVE_DESIGN' }),
    pointCodeAssignments: [
      {
        measurementPointId: 203,
        assignmentMode: 'MANUAL_LEGACY',
        pointCode: 'P0212',
        reason: 'ใช้รหัสเดิมหลังยกเลิกคำขอ',
      },
    ],
  });
}

function token(actor: 'operator' | 'officer') {
  return signTestAccessToken({
    sub: actor === 'operator' ? '42' : '7',
    userType: actor,
    roles: [actor === 'operator' ? 'factory_operator' : 'officer'],
    scopes: {
      ...(actor === 'officer' ? { 'cems_wpms_requests:approve': 'ALL' as const } : {}),
      'cems_wpms_requests:edit': 'ALL',
      'cems_wpms_requests:view': 'ALL',
    },
  });
}

function app() {
  const application = express();
  application.use(express.json());
  application.use('/api/v1/cems-wpms-requests', connectionRequestsRoutes);
  application.use(errorHandler);
  return application;
}
