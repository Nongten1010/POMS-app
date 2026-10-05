import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('../../src/config/database', () => ({
  db: Object.assign(jest.fn(), { transaction: jest.fn(), fn: { now: () => new Date() } }),
}));

import { db } from '../../src/config/database';
import { connectionRequestsRoutes } from '../../src/modules/connection-requests/connection-requests.routes';
import { connectionRequestsRepository } from '../../src/modules/connection-requests/connection-requests.repository';
import { errorHandler } from '../../src/shared/middlewares/errorHandler';
import { signAccessToken } from '../../src/shared/utils/jwt';
import type { PermissionScopeDetails } from '../../src/modules/auth/permissions';

describe('connection request rejection through HTTP and persistence', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it.each(
    [
      'PENDING_DESIGN_REVIEW',
      'WAITING_CONNECTION',
      'WAITING_FACTORY_REVISION',
      'REVISED_PENDING_DESIGN_REVIEW',
      'CONNECTION_CONFIRMED',
      'CONNECTED',
      'CANCELED',
      'REJECTED',
    ].flatMap((status) => ['status', 'review'].map((endpoint) => ({ status, endpoint }))),
  )('rejects $status through $endpoint without a reason', async ({ status, endpoint }) => {
    database(status);
    const response = await request(createApp())
      .post(`/api/v1/cems-wpms-requests/1/${endpoint}`)
      .set('Authorization', `Bearer ${token()}`)
      .send(endpoint === 'status' ? { action: 'REJECT' } : { decision: 'REJECT' });

    expect(response.status).toBe(200);
    expect(response.body.data).toMatchObject({
      status: 'REJECTED',
      statusLabel: 'ไม่อนุมัติ',
      officerNote: null,
      revisionReason: null,
      statusHistory: [
        expect.objectContaining({
          status: 'REJECTED',
          note: null,
          changedById: 7,
          isTerminal: true,
        }),
      ],
    });
    expect(await connectionRequestsRepository.findById(1)).toMatchObject({ status: 'REJECTED' });
  });

  it.each(['status', 'review'])(
    'keeps %s rejection inside approval data scope',
    async (endpoint) => {
      const state = database('CONNECTED');
      const response = await request(createApp())
        .post(`/api/v1/cems-wpms-requests/1/${endpoint}`)
        .set(
          'Authorization',
          `Bearer ${token({ 'cems_wpms_requests:approve': { scope: 'IN_PROVINCE', province: 'สระบุรี' } })}`,
        )
        .send(endpoint === 'status' ? { action: 'REJECT' } : { decision: 'REJECT' });
      expect(response.status).toBe(404);
      expect(state.row.status).toBe('CONNECTED');
      expect(state.history).toEqual([]);
    },
  );

  it.each(['status', 'review'])('requires approval permission through %s', async (endpoint) => {
    const state = database('CONNECTED');
    const response = await request(createApp())
      .post(`/api/v1/cems-wpms-requests/1/${endpoint}`)
      .set('Authorization', `Bearer ${token({ 'cems_wpms_requests:edit': 'OWN_FACTORY' })}`)
      .send(endpoint === 'status' ? { action: 'REJECT' } : { decision: 'REJECT' });
    expect(response.status).toBe(403);
    expect(state.row.status).toBe('CONNECTED');
    expect(state.history).toEqual([]);
  });

  it('rechecks approval scope after a concurrent form change', async () => {
    const state = database('PENDING_DESIGN_REVIEW');
    state.snapshot.province_name = 'สระบุรี';
    state.loseAccessOnTransaction = true;
    const response = await request(createApp())
      .post('/api/v1/cems-wpms-requests/1/status')
      .set(
        'Authorization',
        `Bearer ${token({ 'cems_wpms_requests:approve': { scope: 'IN_PROVINCE', province: 'สระบุรี' } })}`,
      )
      .send({ action: 'REJECT' });
    expect(response.status).toBe(404);
    expect(state.row.status).toBe('PENDING_DESIGN_REVIEW');
    expect(state.history).toEqual([]);
  });

  it('does not let a delayed revision request overwrite a concurrent rejection', async () => {
    const state = database('PENDING_DESIGN_REVIEW');
    state.rejectOnTransaction = true;
    const response = await request(createApp())
      .post('/api/v1/cems-wpms-requests/1/status')
      .set('Authorization', `Bearer ${token()}`)
      .send({ action: 'REQUEST_REVISION', revisionReason: 'แก้ไขแบบ' });
    expect(response.status).toBe(409);
    expect(state.row.status).toBe('REJECTED');
    expect(state.history).toMatchObject([{ status: 'REJECTED' }]);
    expect(state.history).toHaveLength(1);
  });

  it('stores both maximum-length optional rejection notes without truncation', async () => {
    const state = database('CONNECTED');
    const revisionReason = 'ก'.repeat(1000);
    const officerNote = 'ข'.repeat(1000);
    const response = await request(createApp())
      .post('/api/v1/cems-wpms-requests/1/status')
      .set('Authorization', `Bearer ${token()}`)
      .send({ action: 'REJECT', revisionReason, officerNote });
    expect(response.status).toBe(200);
    expect(state.history[0]?.note).toBe(`${revisionReason}\n${officerNote}`);
    expect(response.body.data.statusHistory[0].note).toHaveLength(2001);
  });

  it.each([
    { officerNote: null, expectedNote: null },
    { officerNote: '', expectedNote: null },
    { officerNote: '  ', expectedNote: null },
    { officerNote: 'ปฏิเสธคำขอ', expectedNote: 'ปฏิเสธคำขอ' },
  ])(
    'stores an optional rejection note %j without changing connection timestamps',
    async ({ officerNote, expectedNote }) => {
      const state = database('CONNECTED');
      state.row.verified_at = '2026-10-04T00:00:00.000Z';
      const response = await request(createApp())
        .post('/api/v1/cems-wpms-requests/1/status')
        .set('Authorization', `Bearer ${token()}`)
        .send({ action: 'REJECT', officerNote });
      expect(response.status).toBe(200);
      expect(response.body.data).toMatchObject({
        status: 'REJECTED',
        officerNote: expectedNote,
        verifiedAt: '2026-10-04T00:00:00.000Z',
      });
    },
  );
});

function createApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/v1/cems-wpms-requests', connectionRequestsRoutes);
  app.use(errorHandler);
  return app;
}

function token(scopes: Record<string, unknown> = { 'cems_wpms_requests:approve': 'ALL' }) {
  const values: Record<string, string | null> = {};
  const scopeDetails: Record<string, PermissionScopeDetails> = {};
  for (const [permission, value] of Object.entries(scopes)) {
    if (value && typeof value === 'object') {
      const detail = value as PermissionScopeDetails;
      values[permission] = detail.scope;
      scopeDetails[permission] = detail;
    } else {
      values[permission] = value as string | null;
    }
  }
  return signAccessToken({
    sub: '7',
    userType: 'officer',
    roles: ['officer'],
    scopes: values,
    scopeDetails,
  });
}

function database(status: string) {
  const row: Record<string, unknown> = {
    id: 1,
    request_no: 'REQ-001',
    factory_id: 'factory-001',
    factory_name: 'Factory',
    factory_registration_no: 'REG-001',
    system_type: 'CEMS',
    status,
    contact_name: 'Contact',
    contact_phone: '0800000000',
    created_by: 42,
    connection_due_at: null,
    confirmed_at: null,
    verified_at: null,
    created_at: '2026-10-05T00:00:00.000Z',
    updated_at: '2026-10-05T00:00:00.000Z',
  };
  const history: Record<string, unknown>[] = [];
  const state = {
    row,
    history,
    snapshot: { province_name: null as string | null },
    loseAccessOnTransaction: false,
    rejectOnTransaction: false,
    approvalVisible: true,
  };
  const query = (table: string) => {
    const chain: Record<string, unknown> = {};
    let scoped = false;
    for (const method of [
      'where',
      'whereNull',
      'leftJoin',
      'select',
      'orderBy',
      'forUpdate',
      'whereRaw',
      'whereIn',
    ]) {
      chain[method] = () => chain;
    }
    chain.whereExists = () => {
      scoped = true;
      return chain;
    };
    chain.first = async () => {
      if (table === 'cems_wpms_connection_requests')
        return scoped && !state.approvalVisible ? undefined : row;
      if (table === 'cems_wpms_request_factory_snapshots') return state.snapshot;
      return undefined;
    };
    chain.update = async (values: Record<string, unknown>) => {
      if (table !== 'cems_wpms_connection_requests') throw new Error(`Unexpected write ${table}`);
      Object.assign(row, values);
      return 1;
    };
    chain.insert = async (values: Record<string, unknown>) => {
      if (table !== 'cems_wpms_request_status_history')
        throw new Error(`Unexpected write ${table}`);
      history.push({ ...values, id: history.length + 1, changed_at: '2026-10-05T01:00:00.000Z' });
      return 1;
    };
    chain.then = (resolve: (value: unknown) => unknown) =>
      Promise.resolve(table === 'cems_wpms_request_status_history' ? history : []).then(resolve);
    return chain;
  };
  (db as unknown as jest.Mock).mockImplementation((table: unknown) => query(String(table)));
  (db.transaction as jest.Mock).mockImplementation((callback: unknown) => {
    if (state.rejectOnTransaction) {
      row.status = 'REJECTED';
      history.push({
        id: 1,
        status: 'REJECTED',
        changed_at: '2026-10-05T00:30:00.000Z',
        changed_by: 8,
        note: null,
      });
    }
    if (state.loseAccessOnTransaction) {
      state.snapshot.province_name = 'นนทบุรี';
      state.approvalVisible = false;
    }
    return (callback as (transaction: unknown) => Promise<unknown>)(db);
  });
  return state;
}
