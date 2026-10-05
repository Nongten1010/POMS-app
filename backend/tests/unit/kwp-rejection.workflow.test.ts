import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';
import type { Knex } from 'knex';

jest.mock('../../src/config/database', () => ({
  db: Object.assign(jest.fn(), { transaction: jest.fn(), raw: jest.fn() }),
}));

import { db } from '../../src/config/database';
import { kwpFormSubmissionsRoutes } from '../../src/modules/kwp-form-submissions/kwp-form-submissions.routes';
import { errorHandler } from '../../src/shared/middlewares/errorHandler';
import { signAccessToken } from '../../src/shared/utils/jwt';

type Row = Record<string, unknown>;
type TransactionCallback = (trx: Knex.Transaction) => Promise<unknown>;
let tables: Map<string, Row[]>;
let loseStatusRace: boolean;

beforeEach(() => {
  loseStatusRace = false;
  tables = new Map([
    [
      'kwp_form_submissions',
      [
        {
          id: 12,
          submission_no: 'F01-04-0012/2569',
          form_type: 'KWP01',
          status: 'APPROVED',
          officer_note: 'previous review',
          reviewed_by: 21,
          reviewed_at: new Date('2026-09-01T00:00:00Z'),
          submission_region_name: 'ภาคกลาง',
        },
      ],
    ],
    ['kwp_form_status_history', []],
  ]);
  (db as unknown as jest.Mock).mockImplementation((table) => query(String(table)));
  (
    db.transaction as unknown as jest.Mock<(callback: TransactionCallback) => Promise<unknown>>
  ).mockImplementation(async (callback) => {
    const snapshot = structuredClone(tables);
    try {
      return await callback(db as unknown as Knex.Transaction);
    } catch (error) {
      tables = snapshot;
      throw error;
    }
  });
});

describe('KWP rejection through HTTP and the real workflow', () => {
  it('lets an approver reject an approved form without supplying a reason', async () => {
    const app = workflowApp();
    const response = await request(app)
      .post('/api/v1/kwp-form-submissions/12/workflow-actions')
      .set('Authorization', `Bearer ${approverToken()}`)
      .send({ action: 'REJECT' });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      data: { status: 'REJECTED', officerNote: null, allowedActions: ['REJECT'] },
    });
    const read = await request(app)
      .get('/api/v1/kwp-form-submissions/12/workflow')
      .set('Authorization', `Bearer ${approverToken()}`);
    expect(read.body.data).toMatchObject({ status: 'REJECTED', officerNote: null });
  });

  it('stores both maximum-length optional rejection notes without truncation', async () => {
    const revisionReason = 'ก'.repeat(1000);
    const officerNote = 'ข'.repeat(1000);
    const response = await request(workflowApp())
      .post('/api/v1/kwp-form-submissions/12/workflow-actions')
      .set('Authorization', `Bearer ${approverToken()}`)
      .send({ action: 'REJECT', revisionReason, officerNote });
    expect(response.status).toBe(200);
    expect(tables.get('kwp_form_status_history')?.[0].note).toBe(
      `${revisionReason}\n${officerNote}`,
    );
    expect(response.body.data.officerNote).toBe(officerNote);
  });

  it('keeps an optional rejection reason when the approver supplies one', async () => {
    const response = await request(workflowApp())
      .post('/api/v1/kwp-form-submissions/12/workflow-actions')
      .set('Authorization', `Bearer ${approverToken()}`)
      .send({ action: 'REJECT', revisionReason: ' ข้อมูลไม่ถูกต้อง ' });

    expect(response.status).toBe(200);
    expect(response.body.data.officerNote).toBe('ข้อมูลไม่ถูกต้อง');
    expect(tables.get('kwp_form_status_history')).toEqual([
      expect.objectContaining({ status: 'REJECTED', note: 'ข้อมูลไม่ถูกต้อง', changed_by: 77 }),
    ]);
  });

  const statuses = [
    'DRAFT',
    'SUBMITTED',
    'UNDER_REVIEW',
    'APPROVED',
    'REJECTED',
    'REVISION_REQUESTED',
    'CANCELLED',
  ];
  const forms = ['KWP01', 'KWP02', 'KWP03', 'KWP04', 'KWP05'];
  it.each(forms.flatMap((form) => statuses.map((status) => [form, status])))(
    'advertises and performs rejection for %s in %s',
    async (form, status) => {
      const row = tables.get('kwp_form_submissions')?.[0];
      if (!row) throw new Error('Expected seeded submission');
      Object.assign(row, { form_type: form, status });
      const app = workflowApp();
      const token = approverToken();
      const workflow = await request(app)
        .get('/api/v1/kwp-form-submissions/12/workflow')
        .set('Authorization', `Bearer ${token}`);
      expect(workflow.status).toBe(200);
      expect(workflow.body.data.allowedActions).toContain('REJECT');

      const rejected = await request(app)
        .post('/api/v1/kwp-form-submissions/12/workflow-actions')
        .set('Authorization', `Bearer ${token}`)
        .send({ action: 'REJECT' });
      expect(rejected.status).toBe(200);
      expect(rejected.body.data).toMatchObject({ formType: form, status: 'REJECTED' });
      expect(row).toMatchObject({
        status: 'REJECTED',
        reviewed_by: 77,
        reviewed_at: expect.any(Date),
        updated_by: 77,
      });
      expect(tables.get('kwp_form_status_history')).toEqual([
        expect.objectContaining({ status: 'REJECTED', changed_by: 77, note: null }),
      ]);
    },
  );

  it.each([null, '', '   '])('rejects without a reason when notes are %p', async (reason) => {
    const response = await request(workflowApp())
      .post('/api/v1/kwp-form-submissions/12/workflow-actions')
      .set('Authorization', `Bearer ${approverToken()}`)
      .send({ action: 'REJECT', revisionReason: reason, officerNote: reason });
    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({ status: 'REJECTED', officerNote: null });
  });

  it.each(['monitoring_kpm', 'monitoring_5_centers', 'admin'])(
    'allows the existing approver role %s to reject',
    async (role) => {
      const response = await request(workflowApp())
        .post('/api/v1/kwp-form-submissions/12/workflow-actions')
        .set('Authorization', `Bearer ${approverToken(role)}`)
        .send({ action: 'REJECT' });
      expect(response.status).toBe(200);
    },
  );

  it('does not let an unrelated officer role reject even with an approve permission', async () => {
    const response = await request(workflowApp())
      .post('/api/v1/kwp-form-submissions/12/workflow-actions')
      .set('Authorization', `Bearer ${approverToken('center_director')}`)
      .send({ action: 'REJECT' });
    expect(response.status).toBe(403);
    expect(tables.get('kwp_form_status_history')).toHaveLength(0);
  });

  it.each(['officer', 'operator'] as const)(
    'does not advertise or allow rejection for a view-only %s',
    async (userType) => {
      const token = signAccessToken({
        sub: '42',
        userType,
        roles: userType === 'operator' ? ['factory_operator'] : ['monitoring_kpm'],
        scopes: { 'kwp_forms:view': 'ALL' },
      });
      const app = workflowApp();
      const workflow = await request(app)
        .get('/api/v1/kwp-form-submissions/12/workflow')
        .set('Authorization', `Bearer ${token}`);
      expect(workflow.status).toBe(200);
      expect(workflow.body.data.allowedActions).not.toContain('REJECT');
      const rejection = await request(app)
        .post('/api/v1/kwp-form-submissions/12/workflow-actions')
        .set('Authorization', `Bearer ${token}`)
        .send({ action: 'REJECT' });
      expect(rejection.status).toBe(403);
    },
  );

  it('does not allow operator edit permission to authorize rejection', async () => {
    const token = signAccessToken({
      sub: '42',
      userType: 'operator',
      roles: ['factory_operator'],
      scopes: { 'kwp_forms:edit': 'OWN_FACTORY' },
    });
    const response = await request(workflowApp())
      .post('/api/v1/kwp-form-submissions/12/workflow-actions')
      .set('Authorization', `Bearer ${token}`)
      .send({ action: 'REJECT' });
    expect(response.status).toBe(403);
  });

  it('keeps regional data scope when rejecting a form', async () => {
    const token = signAccessToken({
      sub: '77',
      userType: 'officer',
      roles: ['monitoring_5_centers'],
      scopes: { 'kwp_forms:approve': 'IN_REGION' },
      regionalAccess: { regions: ['ภาคใต้'] },
    });
    const response = await request(workflowApp())
      .post('/api/v1/kwp-form-submissions/12/workflow-actions')
      .set('Authorization', `Bearer ${token}`)
      .send({ action: 'REJECT' });
    expect(response.status).toBe(404);
    expect(tables.get('kwp_form_status_history')).toHaveLength(0);
  });

  it.each(['APPROVED', 'SUBMITTED', 'REVISION_REQUESTED'])(
    'does not advertise rejection outside the approval scope with broad view access in %s',
    async (status) => {
      const row = tables.get('kwp_form_submissions')?.[0];
      if (!row) throw new Error('Expected seeded submission');
      row.status = status;
      const token = signAccessToken({
        sub: '77',
        userType: 'officer',
        roles: ['monitoring_5_centers'],
        scopes: { 'kwp_forms:view': 'ALL', 'kwp_forms:approve': 'IN_REGION' },
        regionalAccess: { regions: ['ภาคใต้'] },
      });
      const app = workflowApp();
      const workflow = await request(app)
        .get('/api/v1/kwp-form-submissions/12/workflow')
        .set('Authorization', `Bearer ${token}`);
      expect(workflow.status).toBe(200);
      expect(workflow.body.data.allowedActions).toEqual([]);

      const rejection = await request(app)
        .post('/api/v1/kwp-form-submissions/12/workflow-actions')
        .set('Authorization', `Bearer ${token}`)
        .send({ action: 'REJECT' });
      expect(rejection.status).toBe(404);
    },
  );

  it('advertises rejection when the resource is inside the separate approval scope', async () => {
    const token = signAccessToken({
      sub: '77',
      userType: 'officer',
      roles: ['monitoring_5_centers'],
      scopes: { 'kwp_forms:view': 'ALL', 'kwp_forms:approve': 'IN_REGION' },
      regionalAccess: { regions: ['ภาคกลาง'] },
    });
    const app = workflowApp();
    const workflow = await request(app)
      .get('/api/v1/kwp-form-submissions/12/workflow')
      .set('Authorization', `Bearer ${token}`);
    expect(workflow.status).toBe(200);
    expect(workflow.body.data.allowedActions).toEqual(['REJECT']);
    const rejection = await request(app)
      .post('/api/v1/kwp-form-submissions/12/workflow-actions')
      .set('Authorization', `Bearer ${token}`)
      .send({ action: 'REJECT' });
    expect(rejection.status).toBe(200);
  });

  it('rolls back rejection and its history when a concurrent status change wins', async () => {
    loseStatusRace = true;
    const response = await request(workflowApp())
      .post('/api/v1/kwp-form-submissions/12/workflow-actions')
      .set('Authorization', `Bearer ${approverToken()}`)
      .send({ action: 'REJECT' });
    expect(response.status).toBe(409);
    expect(tables.get('kwp_form_status_history')).toHaveLength(0);
    expect(tables.get('kwp_form_submissions')?.[0].status).toBe('APPROVED');
  });

  it('keeps the existing state restriction for approval', async () => {
    const response = await request(workflowApp())
      .post('/api/v1/kwp-form-submissions/12/workflow-actions')
      .set('Authorization', `Bearer ${approverToken()}`)
      .send({ action: 'APPROVE' });
    expect(response.status).toBe(403);
    expect(tables.get('kwp_form_status_history')).toHaveLength(0);
  });
});

function workflowApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/kwp-form-submissions', kwpFormSubmissionsRoutes);
  app.use(errorHandler);
  return app;
}

function approverToken(role = 'monitoring_kpm'): string {
  return signAccessToken({
    sub: '77',
    userType: 'officer',
    roles: [role],
    scopes: { 'kwp_forms:view': 'ALL', 'kwp_forms:approve': 'ALL' },
  });
}

// Database boundary adapter keeps the HTTP/controller/service/repository path real.
function query(name: string): Knex.QueryBuilder {
  const table = name.split(' as ')[0];
  const filters: Array<(row: Row) => boolean> = [];
  const key = (column: string) => column.slice(column.lastIndexOf('.') + 1);
  const rows = () =>
    (tables.get(table) ?? []).filter((row) => filters.every((filter) => filter(row)));
  const chain: Record<string, unknown> = {};
  for (const method of ['leftJoin', 'modify', 'orderBy', 'select']) chain[method] = () => chain;
  chain.where = (column: string, value: unknown) => {
    filters.push((row) => row[key(column)] === value);
    return chain;
  };
  chain.whereNull = (column: string) => {
    filters.push((row) => row[key(column)] == null);
    return chain;
  };
  chain.whereRaw = (sql: string, bindings: unknown[] = []) => {
    if (sql === '1 = ?') filters.push(() => bindings[0] === 1);
    else if (sql.startsWith('COALESCE(??, ??) IN (')) {
      filters.push((row) => bindings.slice(2).includes(row.submission_region_name));
    } else throw new Error(`Unsupported SQL filter in test database adapter: ${sql}`);
    return chain;
  };
  chain.first = async () => rows()[0];
  chain.then = (resolve: (value: Row[]) => unknown, reject?: (error: unknown) => unknown) =>
    Promise.resolve(rows()).then(resolve, reject);
  chain.update = async (values: Row) => {
    if (loseStatusRace && table === 'kwp_form_submissions') return 0;
    const found = rows();
    found.forEach((row) => Object.assign(row, values));
    return found.length;
  };
  chain.insert = async (value: Row) => {
    const all = tables.get(table) ?? [];
    tables.set(table, [...all, { id: all.length + 1, ...value }]);
    return 1;
  };
  return chain as unknown as Knex.QueryBuilder;
}
