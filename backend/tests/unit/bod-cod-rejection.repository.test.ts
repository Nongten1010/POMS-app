import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';

jest.mock('../../src/config/database', () => ({
  db: Object.assign(jest.fn(), { transaction: jest.fn(), raw: jest.fn() }),
}));

import { db } from '../../src/config/database';
import { bodCodDeviationReportsRepository as repository } from '../../src/modules/bod-cod-deviations/bod-cod-deviation-reports.repository';
import type { BodCodDeviationReportStatus } from '../../src/modules/bod-cod-deviations/bod-cod-deviation-reports.types';
import { changeBodCodWorkflowStatusSchema } from '../../src/modules/bod-cod-deviations/bod-cod-deviation-reports.validator';
import { bodCodDeviationReportsRoutes } from '../../src/modules/bod-cod-deviations/bod-cod-deviation-reports.routes';
import { errorHandler } from '../../src/shared/middlewares/errorHandler';
import { signAccessToken } from '../../src/shared/utils/jwt';

const officer = { actorUserId: 77, scope: 'ALL', roles: ['monitoring_kpm'] };

describe('BOD/COD rejection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('rejects an approved report without a current step or reason and preserves its numbers', async () => {
    harness('APPROVED');
    await expect(
      repository.changeWorkflowStatus(9, { action: 'REJECT' }, officer),
    ).resolves.toMatchObject({
      statusCode: 'REJECTED',
      reportNo: 'E-02-0001/2569',
      reportSequenceNo: 3,
      currentStep: null,
      allowedActions: ['REJECT'],
    });
  });

  it('retains completed approvals and exposes the appended rejection in report history', async () => {
    const h = harness('APPROVED');
    h.steps.push({
      id: 1,
      step_no: 1,
      role_code: 'INSPECTOR',
      role_label: 'ผู้ตรวจสอบ',
      status: 'APPROVED',
      actor_user_id: 42,
      decision: 'APPROVED',
      comment: 'ข้อมูลครบถ้วน',
      is_current: true,
    });
    Object.assign(h.row, {
      current_step_id: 1,
      current_step_no: 1,
      current_step_role_code: 'INSPECTOR',
      current_step_status: 'APPROVED',
    });
    h.events.push({
      id: 1,
      report_id: 9,
      action: 'APPROVE',
      actor_user_id: 42,
      note: 'ข้อมูลครบถ้วน',
      created_at: '2026-01-02T00:00:00Z',
    });

    await repository.changeWorkflowStatus(9, { action: 'REJECT' }, officer);
    const detail = await repository.getReportById(9, { ...officer, approveScope: 'ALL' });
    expect(detail.steps).toEqual([
      expect.objectContaining({
        status: 'APPROVED',
        actorUserId: 42,
        comment: 'ข้อมูลครบถ้วน',
        isCurrent: false,
      }),
    ]);
    expect(detail.statusHistory).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ status: 'APPROVED', changedById: 42, note: 'ข้อมูลครบถ้วน' }),
        expect.objectContaining({ status: 'REJECTED', changedById: 77, note: null }),
      ]),
    );
    expect(detail.currentStep).toBeNull();
  });

  it.each([
    'DRAFT',
    'SUBMITTED',
    'REVISED_PENDING_REVIEW',
    'WAITING_RESULT_NOTICE',
    'WAITING_REVIEW',
    'WAITING_APPROVAL',
    'APPROVED',
    'REJECTED',
    'REVISION_REQUESTED',
    'CANCELLED',
  ] as const)('offers rejection and rejects %s without a current step', async (status) => {
    harness(status);
    const before = await repository.getReportById(9, { ...officer, approveScope: 'ALL' });
    expect(before.allowedActions).toContain('REJECT');
    const result = await repository.changeWorkflowStatus(9, { action: 'REJECT' }, officer);
    expect(result).toMatchObject({ statusCode: 'REJECTED', currentStep: null });
    const after = await repository.getReportById(9, { ...officer, approveScope: 'ALL' });
    expect(after).toMatchObject({
      statusCode: 'REJECTED',
      reportNo: 'E-02-0001/2569',
      reportSequenceNo: 3,
    });
    expect(after.statusHistory).toContainEqual(
      expect.objectContaining({ status: 'REJECTED', note: null }),
    );
  });

  it.each([undefined, null, '', '   '])(
    'accepts optional rejection note %p',
    async (officerNote) => {
      harness('CANCELLED');
      const app = api();
      const response = await request(app)
        .post('/api/v1/bod-cod-deviation-reports/9/workflow-actions')
        .set('Authorization', `Bearer ${token()}`)
        .send({ action: 'REJECT', officerNote });
      expect(response.status).toBe(200);
      expect(response.body.data.statusCode).toBe('REJECTED');
      const detail = await request(app)
        .get('/api/v1/bod-cod-deviation-reports/9')
        .set('Authorization', `Bearer ${token()}`);
      expect(detail.status).toBe(200);
      expect(detail.body.data.statusHistory).toContainEqual(
        expect.objectContaining({ status: 'REJECTED', note: null }),
      );
    },
  );

  it('keeps a supplied rejection note in the audit history', async () => {
    harness('DRAFT');
    const input = changeBodCodWorkflowStatusSchema.parse({
      action: 'REJECT',
      officerNote: '  ไม่ผ่าน  ',
    });
    await repository.changeWorkflowStatus(9, input, officer);
    const detail = await repository.getReportById(9, { ...officer, approveScope: 'ALL' });
    expect(detail.statusHistory).toContainEqual(
      expect.objectContaining({ status: 'REJECTED', note: 'ไม่ผ่าน' }),
    );
  });

  it.each([
    'monitoring_kpm',
    'monitoring_5_centers',
    'admin',
    'kpm_director',
    'center_director',
    'kwp_director',
  ])('allows %s to reject independently of current-step assignment', async (role) => {
    const h = harness('WAITING_REVIEW');
    Object.assign(h.row, {
      current_step_id: 1,
      current_step_no: 3,
      current_step_role_code: 'REVIEWER',
      current_step_status: 'WAITING',
    });
    await expect(
      repository.changeWorkflowStatus(9, { action: 'REJECT' }, { ...officer, roles: [role] }),
    ).resolves.toMatchObject({ statusCode: 'REJECTED' });
  });

  it('does not advertise rejection to view-only users or operators', async () => {
    harness('REJECTED');
    expect((await repository.getReportById(9, officer)).allowedActions).toEqual([]);
    const operator = {
      actorUserId: 42,
      scope: 'OWN_FACTORY',
      editScope: 'OWN_FACTORY',
      roles: ['factory_operator'],
    };
    expect((await repository.getReportById(9, operator)).allowedActions).toEqual(['CANCEL']);
    await expect(
      repository.changeWorkflowStatus(9, { action: 'REJECT' }, operator),
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it('rejects out-of-scope reports and users without workflow authority without writing', async () => {
    const hidden = harness('APPROVED', false);
    await expect(
      repository.changeWorkflowStatus(9, { action: 'REJECT' }, officer),
    ).rejects.toMatchObject({ statusCode: 404 });
    expect(hidden.writes).toEqual([]);
    const visible = harness('APPROVED');
    await expect(
      repository.changeWorkflowStatus(
        9,
        { action: 'REJECT' },
        { ...officer, roles: ['provincial_industry'] },
      ),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(visible.writes).toEqual([]);
  });

  it.each(['view', 'approve'])(
    'requires %s permission to reject through the API',
    async (missing) => {
      const h = harness('APPROVED');
      const response = await request(api())
        .post('/api/v1/bod-cod-deviation-reports/9/workflow-actions')
        .set('Authorization', `Bearer ${token(missing)}`)
        .send({ action: 'REJECT' });
      expect(response.status).toBe(403);
      expect(h.writes).toEqual([]);
    },
  );
});

function api() {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/bod-cod-deviation-reports', bodCodDeviationReportsRoutes);
  app.use(errorHandler);
  return app;
}

function token(missing?: string) {
  const scopes: Record<string, string> = {
    'bod_cod_errors:view': 'ALL',
    'bod_cod_errors:approve': 'ALL',
  };
  if (missing) delete scopes[`bod_cod_errors:${missing}`];
  return signAccessToken({ sub: '77', userType: 'officer', roles: officer.roles, scopes });
}

function harness(status: BodCodDeviationReportStatus, visible = true) {
  const row: Record<string, unknown> = {
    id: 9,
    report_no: 'E-02-0001/2569',
    report_sequence_no: 3,
    report_round: 1,
    report_year: 2569,
    factory_registration_no: 'REG',
    factory_name: 'Factory',
    province_name: 'ราชบุรี',
    submitted_at: '2026-01-01T00:00:00Z',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    selected_parameter_code: 'BOD',
    approval_track: 'REGIONAL',
    status,
    current_step_id: null,
    current_step_no: null,
    current_step_role_code: null,
    current_step_status: null,
  };
  const steps: Record<string, unknown>[] = [];
  const events: Record<string, unknown>[] = [];
  const writes: { table: string; values: Record<string, unknown> }[] = [];
  const trx = Object.assign(
    jest.fn((table: string) => {
      const chain: Record<string, unknown> = {};
      const next = () => chain;
      const conditions: Record<string, unknown> = {};
      Object.assign(chain, {
        leftJoin: next,
        where: (column: string, value: unknown) => {
          conditions[column] = value;
          return chain;
        },
        whereNull: next,
        whereIn: next,
        whereExists: next,
        whereRaw: next,
        select: next,
        orderBy: next,
        count: next,
        groupBy: next,
        as: next,
        first: async () =>
          table === 'bod_cod_deviation_reports as r' && visible ? row : undefined,
        update: async (values: Record<string, unknown>) => {
          writes.push({ table, values });
          if (table === 'bod_cod_deviation_reports') Object.assign(row, values);
          if (table === 'bod_cod_approval_steps') {
            for (const step of steps) {
              if (conditions.id === undefined || conditions.id === step.id)
                Object.assign(step, values);
            }
          }
          return 1;
        },
        insert: async (values: Record<string, unknown>) => {
          writes.push({ table, values });
          if (table === 'bod_cod_approval_events')
            events.push({ id: events.length + 1, ...values });
          return 1;
        },
        then: (resolve: (value: unknown[]) => unknown) =>
          Promise.resolve(
            table === 'bod_cod_approval_steps as s'
              ? steps
              : table === 'bod_cod_approval_events as e'
                ? events
                : [],
          ).then(resolve),
      });
      return chain;
    }),
    { raw: jest.fn(async () => undefined) },
  );
  (db.transaction as jest.Mock).mockImplementation((callback: unknown) =>
    (callback as (transaction: unknown) => Promise<unknown>)(trx),
  );
  (db as unknown as jest.Mock).mockImplementation((table: unknown) => trx(String(table)));
  return { row, writes, steps, events };
}
