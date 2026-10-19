import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { createApp } from '../../src/app';
import { db } from '../../src/config/database';
import { signAccessToken } from '../../src/shared/utils/jwt';
import { createChatSqlFixture, type ChatSqlFixture } from '../helpers/chat-sql-fixture';
import { randomUUID } from 'node:crypto';
import { logger } from '../../src/config/logger';
import { inspect } from 'node:util';

const officerToken = () =>
  signAccessToken({ sub: '201', userType: 'officer', roles: [], scopes: {} });
const operatorToken = () =>
  signAccessToken({ sub: '101', userType: 'operator', roles: [], scopes: {} });
const createInput = {
  eligibleFactoryId: 10,
  measurementPoint: null,
  topicCode: 'other',
  message: '  สอบถามการใช้งาน  ',
};
const openTicket = (app: ReturnType<typeof createApp>, key = randomUUID()) =>
  request(app)
    .post('/api/v1/chat/tickets')
    .auth(operatorToken(), { type: 'bearer' })
    .set('Idempotency-Key', key)
    .send(createInput);

const answeringPersonas = [
  { role: 'diw_central', scope: 'ALL', userId: 201, userType: 'officer', factoryId: 10 },
  {
    role: 'provincial_office',
    scope: 'IN_PROVINCE',
    userId: 201,
    userType: 'officer',
    factoryId: 10,
  },
  {
    role: 'industrial_estate',
    scope: 'IN_ESTATE',
    userId: 201,
    userType: 'officer',
    factoryId: 10,
  },
  { role: 'monitoring_kpm', scope: 'IN_REGION', userId: 201, userType: 'officer', factoryId: 20 },
  {
    role: 'monitoring_5_centers',
    scope: 'IN_REGION',
    userId: 201,
    userType: 'officer',
    factoryId: 10,
  },
  { role: 'center_director', scope: 'IN_REGION', userId: 201, userType: 'officer', factoryId: 10 },
  { role: 'kpm_director', scope: 'IN_REGION', userId: 201, userType: 'officer', factoryId: 20 },
  { role: 'kwp_director', scope: 'ALL', userId: 201, userType: 'officer', factoryId: 10 },
  { role: 'admin', scope: 'ALL', userId: 204, userType: 'admin', factoryId: 10 },
  {
    role: 'custom-view-only',
    scope: 'IN_PROVINCE',
    userId: 203,
    userType: 'officer',
    factoryId: 10,
  },
] as const;

describe('Chat ticket HTTP API', () => {
  let fixture: ChatSqlFixture;
  beforeEach(async () => {
    fixture = await createChatSqlFixture(db);
  });
  afterEach(() => {
    fixture.close();
    jest.restoreAllMocks();
  });
  function configureOfficerPermissions(
    grants: Array<{ id: number; scope: string | null; provinceId?: string }>,
  ) {
    fixture.execute("UPDATE users SET permission_mode = 'custom' WHERE id = 201");
    fixture.execute('DELETE FROM user_permissions WHERE user_id = 201');
    for (const grant of grants) {
      fixture.execute(
        'INSERT INTO user_permissions (user_id, permission_id, effect, scope, province_id) VALUES (?, ?, ?, ?, ?)',
        [201, grant.id, 'allow', grant.scope, grant.provinceId ?? null],
      );
    }
  }
  it.each([
    { userId: 201, userType: 'officer' as const },
    { userId: 204, userType: 'admin' as const },
  ])(
    'reports the latest message sender side for $userType replies',
    async ({ userId, userType }) => {
      const app = createApp();
      const opened = await openTicket(app);
      expect(opened.status).toBe(201);
      const id = opened.body.data.ticket.id;
      const list = () =>
        request(app).get('/api/v1/chat/tickets').auth(operatorToken(), { type: 'bearer' });

      const initial = await list();
      expect(initial.status).toBe(200);
      expect(initial.body.data).toEqual([
        expect.objectContaining({ id, lastMessageSenderType: 'operator' }),
      ]);

      const reply = await request(app)
        .post(`/api/v1/chat/tickets/${id}/messages`)
        .auth(signAccessToken({ sub: String(userId), userType, roles: [], scopes: {} }), {
          type: 'bearer',
        })
        .set('Idempotency-Key', randomUUID())
        .send({ message: 'เจ้าหน้าที่ตอบกลับ' });
      expect(reply.status).toBe(201);

      const answered = await list();
      expect(answered.status).toBe(200);
      expect(answered.body.data).toEqual([
        expect.objectContaining({ id, lastMessageSenderType: 'officer' }),
      ]);

      const followup = await request(app)
        .post(`/api/v1/chat/tickets/${id}/messages`)
        .auth(operatorToken(), { type: 'bearer' })
        .set('Idempotency-Key', randomUUID())
        .send({ message: 'ผู้ประกอบการสอบถามเพิ่มเติม' });
      expect(followup.status).toBe(201);
      const latest = await list();
      expect(latest.status).toBe(200);
      expect(latest.body.data).toEqual([
        expect.objectContaining({ id, lastMessageSenderType: 'operator' }),
      ]);
    },
  );
  it('requires authentication before exposing chat options', async () => {
    const response = await request(createApp()).get('/api/v1/chat/options');
    expect(response.status).toBe(401);
    expect(response.body).toMatchObject({ success: false, error: { code: 'UNAUTHORIZED' } });
  });
  it('denies chat when its view permission is revoked after token issuance', async () => {
    const token = operatorToken();
    fixture.execute('DELETE FROM role_permissions WHERE role_id = 1 AND permission_id = 1');
    const response = await request(createApp())
      .get('/api/v1/chat/options')
      .auth(token, { type: 'bearer' });
    expect(response.status).toBe(403);
    expect(response.body).toMatchObject({ success: false, error: { code: 'FORBIDDEN' } });
  });
  it('returns the signed-in account, six topics and server capabilities', async () => {
    const response = await request(createApp())
      .get('/api/v1/chat/options')
      .auth(operatorToken(), { type: 'bearer' });
    expect(response.status).toBe(200);
    expect(response.headers['cache-control']).toBe('private, no-store');
    expect(response.body.data).toMatchObject({
      viewer: { userId: 101, name: 'ผู้ใช้สมมติ operator ทดสอบ', roleCode: 'factory_operator' },
      limits: { messageMaxLength: 2000 },
      canCreate: true,
    });
    expect(response.body.data.topics).toHaveLength(6);
  });
  it('keeps chat:view read-only and denies creation, replies and closure after write grants are revoked', async () => {
    const app = createApp();
    const opened = await openTicket(app);
    expect(opened.status).toBe(201);
    const id = opened.body.data.ticket.id;
    fixture.execute('DELETE FROM role_permissions WHERE role_id = 1 AND permission_id IN (2, 3)');
    const options = await request(app)
      .get('/api/v1/chat/options')
      .auth(operatorToken(), { type: 'bearer' });
    expect(options.status).toBe(200);
    expect(options.body.data.canCreate).toBe(false);
    expect((await openTicket(app)).status).toBe(403);
    for (const path of [`/tickets/${id}`, `/tickets/${id}/messages`]) {
      const response = await request(app)
        .get(`/api/v1/chat${path}`)
        .auth(operatorToken(), { type: 'bearer' });
      expect(response.status).toBe(200);
      const ticket = path.endsWith('/messages') ? response.body.data.ticket : response.body.data;
      expect(ticket.capabilities).toEqual({ canReply: false, canClose: false });
    }
    const listed = await request(app)
      .get('/api/v1/chat/tickets')
      .auth(operatorToken(), { type: 'bearer' });
    expect(listed.body.data[0].capabilities).toEqual({ canReply: false, canClose: false });
    const reply = await request(app)
      .post(`/api/v1/chat/tickets/${id}/messages`)
      .auth(operatorToken(), { type: 'bearer' })
      .set('Idempotency-Key', randomUUID())
      .send({ message: 'ไม่มีสิทธิ์ตอบ' });
    expect(reply.status).toBe(403);
    const closed = await request(app)
      .post(`/api/v1/chat/tickets/${id}/close`)
      .auth(operatorToken(), { type: 'bearer' })
      .send({});
    expect(closed.status).toBe(403);
    expect(await db('chat_tickets').where('id', id).first('status')).toEqual({ status: 'open' });
    expect(await db('chat_messages').where('ticket_id', id).select('id')).toHaveLength(1);
  });
  it('rejects an empty first message without creating a ticket', async () => {
    const response = await request(createApp())
      .post('/api/v1/chat/tickets')
      .auth(operatorToken(), { type: 'bearer' })
      .set('Idempotency-Key', '8fe23705-ad07-417a-a667-dae995f10001')
      .send({
        eligibleFactoryId: 10,
        measurementPoint: null,
        topicCode: 'other',
        message: '  \n ',
      });
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });
  it('lets an operator select assigned factories including a factory with no points', async () => {
    const response = await request(createApp())
      .get('/api/v1/chat/factories')
      .auth(operatorToken(), { type: 'bearer' });
    expect(response.status).toBe(200);
    expect(response.body.data.map((factory: { id: number }) => factory.id)).toEqual([10, 30]);
    expect(response.body.pagination).toEqual({ page: 1, pageSize: 2, total: 2, totalPages: 1 });
  });
  it('opens a factory-level ticket for an assigned eligible factory with no connected or eligible point', async () => {
    const app = createApp();
    const points = await request(app)
      .get('/api/v1/chat/factories/30/measurement-points')
      .auth(operatorToken(), { type: 'bearer' });
    expect(points.status).toBe(200);
    expect(points.body.data).toEqual([]);
    const opened = await request(app)
      .post('/api/v1/chat/tickets')
      .auth(operatorToken(), { type: 'bearer' })
      .set('Idempotency-Key', randomUUID())
      .send({ ...createInput, eligibleFactoryId: 30 });
    expect(opened.status).toBe(201);
    expect(opened.body.data.ticket).toMatchObject({
      factory: { id: 30 },
      measurementPoint: null,
      status: 'open',
    });
    const stored = await db('chat_tickets').where('id', opened.body.data.ticket.id).first();
    expect(stored).toMatchObject({
      eligible_factory_id: 30,
      eligible_point_id: null,
      connected_point_id: null,
    });
  });
  it('returns all assigned eligible factories by default and paginates only when requested', async () => {
    for (let id = 100; id < 128; id += 1) {
      fixture.execute(
        'INSERT INTO factories (id, fid, code, juristic_id, name, province_id, is_active, deleted_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [id, `FIXTURE-${id}`, `REG-${id}`, id, `โรงงานเพิ่ม ${id}`, '2100', 1, null],
      );
      fixture.execute(
        'INSERT INTO eligible_factories (id, source_factory_id, factory_registration_no_new, factory_name, province_name, factory_type_sequence, deleted_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [id, `FIXTURE-${id}`, `REG-${id}`, `โรงงานเพิ่ม ${id}`, 'ระยอง', '00088', null],
      );
      fixture.execute(
        'INSERT INTO user_factory_access (user_id, factory_id, revoked_at) VALUES (?, ?, ?)',
        [101, id, null],
      );
    }
    const app = createApp();
    const all = await request(app)
      .get('/api/v1/chat/factories')
      .auth(operatorToken(), { type: 'bearer' });
    expect(all.status).toBe(200);
    expect(all.body.data).toHaveLength(30);
    expect(all.body.pagination).toEqual({ page: 1, pageSize: 30, total: 30, totalPages: 1 });
    const searched = await request(app)
      .get('/api/v1/chat/factories')
      .query({ q: 'REG-12' })
      .auth(operatorToken(), { type: 'bearer' });
    expect(searched.status).toBe(200);
    expect(searched.body.data).toHaveLength(8);
    expect(searched.body.pagination).toEqual({ page: 1, pageSize: 8, total: 8, totalPages: 1 });
    const bySize = await request(app)
      .get('/api/v1/chat/factories')
      .query({ pageSize: 50 })
      .auth(operatorToken(), { type: 'bearer' });
    expect(bySize.status).toBe(200);
    expect(bySize.body.data).toHaveLength(30);
    expect(bySize.body.pagination).toEqual({ page: 1, pageSize: 50, total: 30, totalPages: 1 });
    const first = await request(app)
      .get('/api/v1/chat/factories')
      .query({ page: 1, pageSize: 25 })
      .auth(operatorToken(), { type: 'bearer' });
    const second = await request(app)
      .get('/api/v1/chat/factories')
      .query({ page: 2 })
      .auth(operatorToken(), { type: 'bearer' });
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(first.body.pagination).toEqual({ page: 1, pageSize: 25, total: 30, totalPages: 2 });
    expect(second.body.pagination).toEqual({ page: 2, pageSize: 25, total: 30, totalPages: 2 });
    expect(first.body.data).toHaveLength(25);
    expect(second.body.data).toHaveLength(5);
    const ids = [...first.body.data, ...second.body.data].map(
      (factory: { id: number }) => factory.id,
    );
    expect(new Set(ids).size).toBe(30);
    expect([...ids].sort((a, b) => a - b)).toEqual([
      10,
      30,
      ...Array.from({ length: 28 }, (_, index) => index + 100),
    ]);
    expect(all.body.data.map((factory: { id: number }) => factory.id)).toEqual(ids);
    fixture.execute(
      'UPDATE user_factory_access SET revoked_at = ? WHERE user_id = ? AND factory_id = ?',
      ['2026-10-18', 101, ids[25]],
    );
    const refreshed = await request(app)
      .get('/api/v1/chat/factories')
      .query({ page: 2 })
      .auth(operatorToken(), { type: 'bearer' });
    expect(refreshed.status).toBe(200);
    expect(refreshed.body.pagination).toMatchObject({ total: 29, totalPages: 2 });
    expect(refreshed.body.data.map((factory: { id: number }) => factory.id)).not.toContain(ids[25]);
  });
  it('returns an empty unpaginated factory list when no eligible factory is authorized', async () => {
    fixture.execute('UPDATE user_factory_access SET revoked_at = ? WHERE user_id = ?', [
      '2026-10-19',
      101,
    ]);
    const response = await request(createApp())
      .get('/api/v1/chat/factories')
      .auth(operatorToken(), { type: 'bearer' });
    expect(response.status).toBe(200);
    expect(response.body.data).toEqual([]);
    expect(response.body.pagination).toEqual({ page: 1, pageSize: 0, total: 0, totalPages: 0 });
  });
  it('returns connected point identities and hides eligible points and points outside the operator factory', async () => {
    const app = createApp();
    const response = await request(app)
      .get('/api/v1/chat/factories/10/measurement-points')
      .auth(operatorToken(), { type: 'bearer' });
    expect(response.status).toBe(200);
    expect(response.body.data).toEqual([
      {
        kind: 'connected',
        id: 2000,
        systemType: 'CEMS',
        pointCode: 'C10',
        pointName: 'จุดเชื่อมต่อสมมติ',
      },
    ]);
    const outside = await request(app)
      .get('/api/v1/chat/factories/20/measurement-points')
      .auth(operatorToken(), { type: 'bearer' });
    expect(outside.status).toBe(404);
  });
  it('creates the first message atomically and exposes ticket history to a factory coworker', async () => {
    const app = createApp();
    const opened = await openTicket(app);
    expect(opened.status).toBe(201);
    expect(opened.body.data).toMatchObject({
      replayed: false,
      firstMessage: { text: 'สอบถามการใช้งาน', sender: { userId: 101 } },
      ticket: {
        status: 'open',
        measurementPoint: null,
        events: [{ type: 'opened', actor: { userId: 101 } }],
      },
    });
    const id = opened.body.data.ticket.id;
    expect(opened.headers.location).toBe(`/api/v1/chat/tickets/${id}`);
    const token = signAccessToken({ sub: '102', userType: 'operator', roles: [], scopes: {} });
    const detail = await request(app)
      .get(`/api/v1/chat/tickets/${id}`)
      .auth(token, { type: 'bearer' });
    expect(detail.status).toBe(200);
    expect(detail.body.data).toMatchObject({
      id,
      capabilities: { canReply: false, canClose: false },
    });
  });
  it('allows an authorized officer to answer with server-derived identity and replay a send', async () => {
    const app = createApp();
    const opened = await openTicket(app);
    const id = opened.body.data.ticket.id;
    const token = signAccessToken({
      sub: '201',
      userType: 'officer',
      roles: ['admin'],
      scopes: {},
    });
    const key = randomUUID();
    const send = () =>
      request(app)
        .post(`/api/v1/chat/tickets/${id}/messages`)
        .auth(token, { type: 'bearer' })
        .set('Idempotency-Key', key)
        .send({ message: '  คำตอบจากเจ้าหน้าที่  ' });
    const first = await send();
    expect(first.status).toBe(201);
    expect(first.body.data.message).toMatchObject({
      ticketId: id,
      text: 'คำตอบจากเจ้าหน้าที่',
      sender: { userId: 201, roleCode: 'diw_central' },
    });
    const replay = await send();
    expect(replay.status).toBe(200);
    expect(replay.body.data).toMatchObject({ replayed: true, message: first.body.data.message });
  });
  it('closes a ticket once, preserves last message time and denies a new message', async () => {
    const app = createApp();
    const opened = await openTicket(app);
    const { id, lastMessageAt } = opened.body.data.ticket;
    const token = operatorToken();
    const close = () =>
      request(app)
        .post(`/api/v1/chat/tickets/${id}/close`)
        .auth(token, { type: 'bearer' })
        .send({});
    const first = await close();
    expect(first.status).toBe(200);
    expect(first.body.data).toMatchObject({
      status: 'closed',
      closedBy: { userId: 101 },
      lastMessageAt,
      capabilities: { canReply: false, canClose: false },
    });
    const again = await close();
    expect(again.body.data.events).toEqual(first.body.data.events);
    expect(again.body.data.events.map((event: { type: string }) => event.type)).toEqual([
      'opened',
      'closed',
    ]);
    const denied = await request(app)
      .post(`/api/v1/chat/tickets/${id}/messages`)
      .auth(operatorToken(), { type: 'bearer' })
      .set('Idempotency-Key', randomUUID())
      .send({ message: 'หลังปิด' });
    expect(denied.status).toBe(409);
    expect(denied.body.error.code).toBe('CHAT_TICKET_CLOSED');
  });
  it('lists only accessible ticket summaries and accepts the UI filters', async () => {
    const app = createApp();
    const opened = await openTicket(app);
    const response = await request(app)
      .get('/api/v1/chat/tickets')
      .query({
        pageSize: 25,
        q: 'โรงงานสมมติ',
        status: 'open',
        topicCode: 'other',
        sort: 'ticketNo',
        order: 'asc',
      })
      .auth(operatorToken(), { type: 'bearer' });
    expect(response.status).toBe(200);
    expect(response.body.data).toHaveLength(1);
    expect(response.body.data[0]).toMatchObject({ id: opened.body.data.ticket.id });
    expect(response.body.data[0]).not.toHaveProperty('events');
    expect(response.body.data[0]).not.toHaveProperty('messages');
    const outsider = signAccessToken({ sub: '103', userType: 'operator', roles: [], scopes: {} });
    const hidden = await request(app)
      .get('/api/v1/chat/tickets')
      .auth(outsider, { type: 'bearer' });
    expect(hidden.body).toMatchObject({ success: true, data: [], pagination: { total: 0 } });
  });
  it('loads history and refreshes status even when no new messages arrive', async () => {
    const app = createApp();
    const opened = await openTicket(app);
    const id = opened.body.data.ticket.id;
    const history = await request(app)
      .get(`/api/v1/chat/tickets/${id}/messages`)
      .auth(operatorToken(), { type: 'bearer' });
    expect(history.status).toBe(200);
    expect(history.body.data.messages).toEqual([opened.body.data.firstMessage]);
    await request(app)
      .post(`/api/v1/chat/tickets/${id}/close`)
      .auth(operatorToken(), { type: 'bearer' })
      .send({});
    const refreshed = await request(app)
      .get(`/api/v1/chat/tickets/${id}/messages`)
      .query({ afterMessageId: opened.body.data.firstMessage.id })
      .auth(operatorToken(), { type: 'bearer' });
    expect(refreshed.body.data).toMatchObject({
      ticket: { status: 'closed' },
      messages: [],
      pagination: { hasMore: false },
    });
  });
  it('does not expose SQL, message text or keys in responses or logs after a database failure', async () => {
    const privateText = 'synthetic-private-message-must-not-be-logged';
    const key = randomUUID();
    fixture.execute(
      `CREATE TRIGGER chat_insert_fault BEFORE INSERT ON chat_messages BEGIN SELECT RAISE(FAIL, '${privateText}'); END`,
    );
    const output = jest.spyOn(logger, 'error').mockImplementation(() => logger);
    const response = await request(createApp())
      .post('/api/v1/chat/tickets')
      .auth(operatorToken(), { type: 'bearer' })
      .set('Idempotency-Key', key)
      .send({ ...createInput, message: privateText });
    expect(response.status).toBe(500);
    expect(response.body.error.code).toBe('INTERNAL_ERROR');
    expect(inspect(response.body)).not.toContain(privateText);
    expect(output).toHaveBeenCalled();
    expect(inspect(output.mock.calls)).not.toContain(privateText);
    expect(inspect(output.mock.calls)).not.toContain(key);
  });
  it('returns a safe bad-request response without logging malformed JSON text', async () => {
    const privateText = 'synthetic-private-malformed-json';
    const output = jest.spyOn(logger, 'error').mockImplementation(() => logger);
    const response = await request(createApp())
      .post('/api/v1/chat/tickets')
      .auth(operatorToken(), { type: 'bearer' })
      .set('Content-Type', 'application/json')
      .send(`{"message":"${privateText}"`);
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('BAD_REQUEST');
    expect(inspect(response.body)).not.toContain(privateText);
    expect(inspect(output.mock.calls)).not.toContain(privateText);
  });
  it('limits writes per authenticated account without blocking reading or another account', async () => {
    const app = createApp();
    for (let attempt = 0; attempt < 30; attempt += 1) {
      const invalid = await request(app)
        .post('/api/v1/chat/tickets')
        .auth(operatorToken(), { type: 'bearer' })
        .send({});
      expect(invalid.status).toBe(400);
    }
    const limited = await request(app)
      .post('/api/v1/chat/tickets')
      .auth(operatorToken(), { type: 'bearer' })
      .send({});
    expect(limited.status).toBe(429);
    expect(limited.body.error.code).toBe('RATE_LIMIT_EXCEEDED');
    expect(limited.headers['retry-after']).toBeDefined();
    const read = await request(app)
      .get('/api/v1/chat/options')
      .auth(operatorToken(), { type: 'bearer' });
    expect(read.status).toBe(200);
    const coworker = signAccessToken({ sub: '102', userType: 'operator', roles: [], scopes: {} });
    const other = await request(app)
      .post('/api/v1/chat/tickets')
      .auth(coworker, { type: 'bearer' })
      .send({});
    expect(other.status).toBe(400);
  });
  it.each([
    { ...createInput, message: 'x'.repeat(2001) },
    { ...createInput, senderId: 204 },
    { ...createInput, status: 'closed' },
    { ...createInput, openedAt: '2000-01-01T00:00:00Z' },
    { ...createInput, eligibleFactoryId: '10' },
    { ...createInput, topicCode: 'not-a-topic' },
    { ...createInput, measurementPoint: { kind: 'manual', id: 1000 } },
  ])('rejects invalid or server-owned creation fields: %j', async (input) => {
    const response = await request(createApp())
      .post('/api/v1/chat/tickets')
      .auth(operatorToken(), { type: 'bearer' })
      .set('Idempotency-Key', randomUUID())
      .send(input);
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });
  it('requires a valid idempotency key and rejects reused keys with another payload', async () => {
    const app = createApp();
    const missing = await request(app)
      .post('/api/v1/chat/tickets')
      .auth(operatorToken(), { type: 'bearer' })
      .send(createInput);
    expect(missing.status).toBe(400);
    const key = randomUUID();
    const first = await openTicket(app, key);
    const replay = await openTicket(app, key);
    expect(replay.status).toBe(200);
    expect(replay.body.data).toMatchObject({
      replayed: true,
      ticket: { id: first.body.data.ticket.id },
    });
    const conflict = await request(app)
      .post('/api/v1/chat/tickets')
      .auth(operatorToken(), { type: 'bearer' })
      .set('Idempotency-Key', key)
      .send({ ...createInput, message: 'เปลี่ยนข้อความ' });
    expect(conflict.status).toBe(409);
    expect(conflict.body.error.code).toBe('IDEMPOTENCY_KEY_CONFLICT');
  });
  it.each([false, true])(
    'keeps the saved Chat use checkbox read-only when write grants are absent or explicitly denied=%s',
    async (denyWriteGrants) => {
      fixture.execute('DELETE FROM user_permissions WHERE user_id = 203 AND permission_id = 3');
      if (denyWriteGrants) {
        fixture.execute(
          "INSERT INTO user_permissions (user_id, permission_id, effect, scope) VALUES (203, 2, 'deny', NULL), (203, 3, 'deny', NULL)",
        );
      }
      const app = createApp();
      const token = signAccessToken({ sub: '203', userType: 'officer', roles: [], scopes: {} });
      const options = await request(app)
        .get('/api/v1/chat/options')
        .auth(token, { type: 'bearer' });
      expect(options.status).toBe(200);
      expect(options.body.data.canCreate).toBe(false);
      const opened = await openTicket(app);
      expect(opened.status).toBe(201);
      const id = opened.body.data.ticket.id;
      const detail = await request(app)
        .get(`/api/v1/chat/tickets/${id}`)
        .auth(token, { type: 'bearer' });
      expect(detail.status).toBe(200);
      expect(detail.body.data.capabilities).toEqual({ canReply: false, canClose: false });
      const create = await request(app)
        .post('/api/v1/chat/tickets')
        .auth(token, { type: 'bearer' })
        .set('Idempotency-Key', randomUUID())
        .send(createInput);
      expect(create.status).toBe(403);
      const reply = await request(app)
        .post(`/api/v1/chat/tickets/${id}/messages`)
        .auth(token, { type: 'bearer' })
        .set('Idempotency-Key', randomUUID())
        .send({ message: 'ไม่มีสิทธิ์ตอบ' });
      expect(reply.status).toBe(403);
      const close = await request(app)
        .post(`/api/v1/chat/tickets/${id}/close`)
        .auth(token, { type: 'bearer' })
        .send({});
      expect(close.status).toBe(403);
      expect(await db('chat_messages').where('ticket_id', id).select('id')).toHaveLength(1);
      expect(await db('chat_tickets').where('id', id).first('status')).toEqual({ status: 'open' });
    },
  );
  it('uses the saved Chat use checkbox and its explicit scope without expanding the officer factory scope', async () => {
    fixture.execute('DELETE FROM user_permissions WHERE user_id = 203 AND permission_id IN (1, 3)');
    const app = createApp();
    const token = signAccessToken({ sub: '203', userType: 'officer', roles: [], scopes: {} });
    const opened = await openTicket(app);
    expect(opened.status).toBe(201);
    const outside = await request(app)
      .post('/api/v1/chat/tickets')
      .auth(signAccessToken({ sub: '103', userType: 'operator', roles: [], scopes: {} }), {
        type: 'bearer',
      })
      .set('Idempotency-Key', randomUUID())
      .send({ ...createInput, eligibleFactoryId: 20 });
    expect(outside.status).toBe(201);
    const id = opened.body.data.ticket.id;
    const outsideId = outside.body.data.ticket.id;
    const create = (eligibleFactoryId: number) =>
      request(app)
        .post('/api/v1/chat/tickets')
        .auth(token, { type: 'bearer' })
        .set('Idempotency-Key', randomUUID())
        .send({ ...createInput, eligibleFactoryId });
    const detail = (ticketId: number) =>
      request(app).get(`/api/v1/chat/tickets/${ticketId}`).auth(token, { type: 'bearer' });
    const reply = (ticketId: number) =>
      request(app)
        .post(`/api/v1/chat/tickets/${ticketId}/messages`)
        .auth(token, { type: 'bearer' })
        .set('Idempotency-Key', randomUUID())
        .send({ message: 'คำตอบในขอบเขต Chat' });
    const close = (ticketId: number) =>
      request(app)
        .post(`/api/v1/chat/tickets/${ticketId}/close`)
        .auth(token, { type: 'bearer' })
        .send({});
    expect((await create(10)).status).toBe(403);
    expect((await detail(id)).status).toBe(403);
    expect((await reply(id)).status).toBe(403);
    fixture.execute(
      "INSERT INTO user_permissions (user_id, permission_id, effect, scope) VALUES (203, 1, 'allow', NULL)",
    );
    expect(
      (await request(app).get('/api/v1/chat/options').auth(token, { type: 'bearer' })).status,
    ).toBe(403);
    expect((await detail(id)).status).toBe(403);
    fixture.execute(
      "UPDATE user_permissions SET scope = 'IN_PROVINCE', province_id = '2100' WHERE user_id = 203 AND permission_id = 1",
    );
    fixture.execute('DELETE FROM user_permissions WHERE user_id = 203 AND permission_id = 4');
    const options = await request(app).get('/api/v1/chat/options').auth(token, { type: 'bearer' });
    expect(options.status).toBe(200);
    expect(options.body.data.canCreate).toBe(false);
    expect((await create(10)).status).toBe(403);
    expect((await create(20)).status).toBe(403);
    const readable = await detail(id);
    expect(readable.status).toBe(200);
    expect(readable.body.data.capabilities).toEqual({ canReply: false, canClose: false });
    expect((await detail(outsideId)).status).toBe(404);
    expect((await reply(id)).status).toBe(403);
    expect((await close(id)).status).toBe(403);
    fixture.execute(
      "INSERT INTO user_permissions (user_id, permission_id, effect, scope, province_id) VALUES (203, 3, 'allow', 'IN_PROVINCE', '2100')",
    );
    expect((await detail(id)).body.data.capabilities).toEqual({ canReply: true, canClose: true });
    expect((await reply(id)).status).toBe(201);
    expect((await reply(outsideId)).status).toBe(404);
    expect((await close(outsideId)).status).toBe(404);
    expect((await close(id)).status).toBe(200);
  });
  it('requires the Chat use checkbox for an admin even when ask and answer grants remain', async () => {
    const app = createApp();
    const token = signAccessToken({ sub: '204', userType: 'admin', roles: [], scopes: {} });
    const opened = await openTicket(app);
    expect(opened.status).toBe(201);
    const id = opened.body.data.ticket.id;
    const create = () =>
      request(app)
        .post('/api/v1/chat/tickets')
        .auth(token, { type: 'bearer' })
        .set('Idempotency-Key', randomUUID())
        .send(createInput);
    const detail = () =>
      request(app).get(`/api/v1/chat/tickets/${id}`).auth(token, { type: 'bearer' });
    const reply = () =>
      request(app)
        .post(`/api/v1/chat/tickets/${id}/messages`)
        .auth(token, { type: 'bearer' })
        .set('Idempotency-Key', randomUUID())
        .send({ message: 'คำตอบจากผู้ดูแลระบบ' });
    expect((await create()).status).toBe(201);
    expect((await detail()).status).toBe(200);
    expect((await reply()).status).toBe(201);
    fixture.execute('DELETE FROM role_permissions WHERE role_id = 4 AND permission_id = 1');
    expect((await create()).status).toBe(403);
    expect((await detail()).status).toBe(403);
    expect((await reply()).status).toBe(403);
    const closed = await request(app)
      .post(`/api/v1/chat/tickets/${id}/close`)
      .auth(token, { type: 'bearer' })
      .send({});
    expect(closed.status).toBe(403);
  });
  it.each(answeringPersonas)(
    'lets $role open tickets with chat:ask and answer others with scoped chat:answer',
    async ({ role, scope, userId, userType, factoryId }) => {
      if (role === 'custom-view-only') {
        fixture.execute(
          'INSERT INTO user_permissions (user_id, permission_id, effect, scope, province_id) VALUES (?, ?, ?, ?, ?)',
          [userId, 2, 'allow', 'IN_PROVINCE', '2100'],
        );
      } else {
        fixture.execute('INSERT INTO roles (id, code, deleted_at) VALUES (?, ?, ?)', [
          100,
          role,
          null,
        ]);
        fixture.execute('UPDATE user_roles SET role_id = ? WHERE user_id = ?', [100, userId]);
        for (const permissionId of [1, 2, 3, 4]) {
          fixture.execute(
            'INSERT INTO role_permissions (role_id, permission_id, scope) VALUES (?, ?, ?)',
            [100, permissionId, scope],
          );
        }
        fixture.execute(
          'UPDATE officer_profiles SET province_id = ?, estate_code = ?, regional_access_json = ? WHERE user_id = ?',
          ['2100', 'IE-TEST', JSON.stringify({ regions: ['ภาคตะวันออก'] }), userId],
        );
      }
      const token = signAccessToken({
        sub: String(userId),
        userType,
        roles: ['factory_operator'],
        scopes: {},
      });
      const app = createApp();
      const options = await request(app)
        .get('/api/v1/chat/options')
        .auth(token, { type: 'bearer' });
      expect(options.status).toBe(200);
      expect(options.body.data.canCreate).toBe(true);
      const own = await request(app)
        .post('/api/v1/chat/tickets')
        .auth(token, { type: 'bearer' })
        .set('Idempotency-Key', randomUUID())
        .send({ ...createInput, eligibleFactoryId: factoryId });
      expect(own.status).toBe(201);
      expect(own.body.data.ticket.openedBy.userId).toBe(userId);
      expect(own.body.data.ticket.lastMessageSenderType).toBe('officer');
      expect(own.body.data.ticket.capabilities).toEqual({ canReply: true, canClose: true });
      const ownId = own.body.data.ticket.id;

      const creatorToken =
        factoryId === 20
          ? signAccessToken({ sub: '103', userType: 'operator', roles: [], scopes: {} })
          : operatorToken();
      const opened = await request(app)
        .post('/api/v1/chat/tickets')
        .auth(creatorToken, { type: 'bearer' })
        .set('Idempotency-Key', randomUUID())
        .send({ ...createInput, eligibleFactoryId: factoryId });
      expect(opened.status).toBe(201);
      const id = opened.body.data.ticket.id;
      if (role === 'custom-view-only') {
        fixture.execute('DELETE FROM user_permissions WHERE user_id = ? AND permission_id = 2', [
          userId,
        ]);
      } else {
        fixture.execute('DELETE FROM role_permissions WHERE role_id = 100 AND permission_id = 2');
      }
      const answerOnlyOptions = await request(app)
        .get('/api/v1/chat/options')
        .auth(token, { type: 'bearer' });
      expect(answerOnlyOptions.body.data.canCreate).toBe(false);
      const cannotOpen = await request(app)
        .post('/api/v1/chat/tickets')
        .auth(token, { type: 'bearer' })
        .set('Idempotency-Key', randomUUID())
        .send({ ...createInput, eligibleFactoryId: factoryId });
      expect(cannotOpen.status).toBe(403);
      const listed = await request(app).get('/api/v1/chat/tickets').auth(token, { type: 'bearer' });
      expect(listed.status).toBe(200);
      expect(listed.body.data.map((ticket: { id: number }) => ticket.id)).toContain(id);
      const detail = await request(app)
        .get(`/api/v1/chat/tickets/${id}`)
        .auth(token, { type: 'bearer' });
      expect(detail.status).toBe(200);
      expect(detail.body.data.capabilities).toEqual({ canReply: true, canClose: true });
      const history = await request(app)
        .get(`/api/v1/chat/tickets/${id}/messages`)
        .auth(token, { type: 'bearer' });
      expect(history.status).toBe(200);
      expect(history.body.data.messages).toEqual([opened.body.data.firstMessage]);
      const reply = await request(app)
        .post(`/api/v1/chat/tickets/${id}/messages`)
        .auth(token, { type: 'bearer' })
        .set('Idempotency-Key', randomUUID())
        .send({ message: 'คำตอบตามสิทธิ์ตอบ Chat' });
      expect(reply.status).toBe(201);
      expect(reply.body.data.message.sender.userId).toBe(userId);
      const closed = await request(app)
        .post(`/api/v1/chat/tickets/${id}/close`)
        .auth(token, { type: 'bearer' })
        .send({});
      expect(closed.status).toBe(200);
      expect(closed.body.data).toMatchObject({ status: 'closed', closedBy: { userId } });
      if (scope !== 'ALL') {
        const outsideFactoryId = factoryId === 10 ? 20 : 10;
        const outsideCreator =
          outsideFactoryId === 20
            ? signAccessToken({ sub: '103', userType: 'operator', roles: [], scopes: {} })
            : operatorToken();
        const outside = await request(app)
          .post('/api/v1/chat/tickets')
          .auth(outsideCreator, { type: 'bearer' })
          .set('Idempotency-Key', randomUUID())
          .send({ ...createInput, eligibleFactoryId: outsideFactoryId });
        expect(outside.status).toBe(201);
        const outsideId = outside.body.data.ticket.id;
        const scopedList = await request(app)
          .get('/api/v1/chat/tickets')
          .auth(token, { type: 'bearer' });
        expect(
          scopedList.body.data
            .map((ticket: { id: number }) => ticket.id)
            .sort((a: number, b: number) => a - b),
        ).toEqual([ownId, id].sort((a, b) => a - b));
        for (const path of [
          `/factories/${outsideFactoryId}/measurement-points`,
          `/tickets/${outsideId}`,
          `/tickets/${outsideId}/messages`,
        ]) {
          expect(
            (await request(app).get(`/api/v1/chat${path}`).auth(token, { type: 'bearer' })).status,
          ).toBe(404);
        }
        const outsideReply = await request(app)
          .post(`/api/v1/chat/tickets/${outsideId}/messages`)
          .auth(token, { type: 'bearer' })
          .set('Idempotency-Key', randomUUID())
          .send({ message: 'ข้ามขอบเขตโรงงาน' });
        expect(outsideReply.status).toBe(404);
        const outsideClose = await request(app)
          .post(`/api/v1/chat/tickets/${outsideId}/close`)
          .auth(token, { type: 'bearer' })
          .send({});
        expect(outsideClose.status).toBe(404);
        expect(await db('chat_tickets').where('id', outsideId).first('status')).toEqual({
          status: 'open',
        });
        expect(await db('chat_messages').where('ticket_id', outsideId).select('id')).toHaveLength(
          1,
        );
      }
    },
  );
  it('lets an ask-only officer follow and close their own ticket while keeping other tickets read-only', async () => {
    configureOfficerPermissions([
      { id: 1, scope: 'ALL' },
      { id: 2, scope: 'ALL' },
    ]);
    const app = createApp();
    const other = await openTicket(app);
    const own = await request(app)
      .post('/api/v1/chat/tickets')
      .auth(officerToken(), { type: 'bearer' })
      .set('Idempotency-Key', randomUUID())
      .send(createInput);
    expect(own.status).toBe(201);
    const ownId = own.body.data.ticket.id;
    const otherId = other.body.data.ticket.id;
    const listed = await request(app)
      .get('/api/v1/chat/tickets')
      .auth(officerToken(), { type: 'bearer' });
    expect(listed.body.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: ownId, capabilities: { canReply: true, canClose: true } }),
        expect.objectContaining({
          id: otherId,
          capabilities: { canReply: false, canClose: false },
        }),
      ]),
    );
    const send = (id: number) =>
      request(app)
        .post(`/api/v1/chat/tickets/${id}/messages`)
        .auth(officerToken(), { type: 'bearer' })
        .set('Idempotency-Key', randomUUID())
        .send({ message: 'ข้อมูลเพิ่มเติมจากผู้เปิดเรื่อง' });
    const close = (id: number) =>
      request(app)
        .post(`/api/v1/chat/tickets/${id}/close`)
        .auth(officerToken(), { type: 'bearer' })
        .send({});
    expect((await send(otherId)).status).toBe(404);
    expect((await close(otherId)).status).toBe(404);
    expect((await send(ownId)).status).toBe(201);
    expect((await close(ownId)).status).toBe(200);
  });
  it('uses Chat scope independently of absent or conflicting eligible-factory permissions and intersects broad action scopes', async () => {
    configureOfficerPermissions([
      { id: 1, scope: 'ALL' },
      { id: 2, scope: 'ALL' },
      { id: 3, scope: 'ALL' },
    ]);
    const app = createApp();
    const factories = () =>
      request(app).get('/api/v1/chat/factories').auth(officerToken(), { type: 'bearer' });
    const first = await factories();
    expect(first.status).toBe(200);
    expect(first.body.data.map((factory: { id: number }) => factory.id)).toEqual([10, 20, 30]);
    const outsiderToken = signAccessToken({
      sub: '103',
      userType: 'operator',
      roles: [],
      scopes: {},
    });
    const outsideTicket = await request(app)
      .post('/api/v1/chat/tickets')
      .auth(outsiderToken, { type: 'bearer' })
      .set('Idempotency-Key', randomUUID())
      .send({ ...createInput, eligibleFactoryId: 20 });
    expect(outsideTicket.status).toBe(201);
    configureOfficerPermissions([
      { id: 1, scope: 'IN_PROVINCE', provinceId: '2100' },
      { id: 2, scope: 'ALL' },
      { id: 3, scope: 'ALL' },
      { id: 4, scope: 'IN_PROVINCE', provinceId: '1000' },
    ]);
    expect((await factories()).body.data.map((factory: { id: number }) => factory.id)).toEqual([
      10, 30,
    ]);
    const outside = await request(app)
      .get('/api/v1/chat/factories/20/measurement-points')
      .auth(officerToken(), { type: 'bearer' });
    expect(outside.status).toBe(404);
    const cannotCreateOutsideView = await request(app)
      .post('/api/v1/chat/tickets')
      .auth(officerToken(), { type: 'bearer' })
      .set('Idempotency-Key', randomUUID())
      .send({ ...createInput, eligibleFactoryId: 20 });
    expect(cannotCreateOutsideView.status).toBe(404);
    const outsideId = outsideTicket.body.data.ticket.id;
    const reply = await request(app)
      .post(`/api/v1/chat/tickets/${outsideId}/messages`)
      .auth(officerToken(), { type: 'bearer' })
      .set('Idempotency-Key', randomUUID())
      .send({ message: 'นอกพื้นที่อ่าน' });
    expect(reply.status).toBe(404);
    const close = await request(app)
      .post(`/api/v1/chat/tickets/${outsideId}/close`)
      .auth(officerToken(), { type: 'bearer' })
      .send({});
    expect(close.status).toBe(404);
  });
  it('intersects narrower ask and answer scopes with view scope for writes and every ticket capability', async () => {
    configureOfficerPermissions([
      { id: 1, scope: 'ALL' },
      { id: 2, scope: 'IN_PROVINCE', provinceId: '1000' },
      { id: 3, scope: 'IN_PROVINCE', provinceId: '1000' },
    ]);
    const app = createApp();
    const east = await openTicket(app);
    const eastId = east.body.data.ticket.id;
    const deniedCreate = await request(app)
      .post('/api/v1/chat/tickets')
      .auth(officerToken(), { type: 'bearer' })
      .set('Idempotency-Key', randomUUID())
      .send(createInput);
    expect(deniedCreate.status).toBe(404);
    const central = await request(app)
      .post('/api/v1/chat/tickets')
      .auth(officerToken(), { type: 'bearer' })
      .set('Idempotency-Key', randomUUID())
      .send({ ...createInput, eligibleFactoryId: 20 });
    expect(central.status).toBe(201);
    expect(central.body.data.ticket.capabilities).toEqual({ canReply: true, canClose: true });
    const listed = await request(app)
      .get('/api/v1/chat/tickets')
      .auth(officerToken(), { type: 'bearer' });
    expect(listed.body.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: eastId, capabilities: { canReply: false, canClose: false } }),
        expect.objectContaining({
          id: central.body.data.ticket.id,
          capabilities: { canReply: true, canClose: true },
        }),
      ]),
    );
    for (const suffix of ['', '/messages']) {
      const read = await request(app)
        .get(`/api/v1/chat/tickets/${eastId}${suffix}`)
        .auth(officerToken(), { type: 'bearer' });
      expect(read.status).toBe(200);
      expect((suffix ? read.body.data.ticket : read.body.data).capabilities).toEqual({
        canReply: false,
        canClose: false,
      });
    }
    const deniedReply = await request(app)
      .post(`/api/v1/chat/tickets/${eastId}/messages`)
      .auth(officerToken(), { type: 'bearer' })
      .set('Idempotency-Key', randomUUID())
      .send({ message: 'นอกพื้นที่ตอบ' });
    expect(deniedReply.status).toBe(404);
    const deniedClose = await request(app)
      .post(`/api/v1/chat/tickets/${eastId}/close`)
      .auth(officerToken(), { type: 'bearer' })
      .send({});
    expect(deniedClose.status).toBe(404);
  });
  it.each([
    { actionId: 2, own: true },
    { actionId: 3, own: false },
  ])(
    'blocks successful write retries when action permission $actionId is revoked without changing view',
    async ({ actionId, own }) => {
      configureOfficerPermissions([
        { id: 1, scope: 'ALL' },
        { id: actionId, scope: 'ALL' },
      ]);
      const app = createApp();
      const createKey = randomUUID();
      const create = () =>
        request(app)
          .post('/api/v1/chat/tickets')
          .auth(officerToken(), { type: 'bearer' })
          .set('Idempotency-Key', createKey)
          .send(createInput);
      const opened = own ? await create() : await openTicket(app);
      expect(opened.status).toBe(201);
      const id = opened.body.data.ticket.id;
      const messageKey = randomUUID();
      const send = () =>
        request(app)
          .post(`/api/v1/chat/tickets/${id}/messages`)
          .auth(officerToken(), { type: 'bearer' })
          .set('Idempotency-Key', messageKey)
          .send({ message: 'ข้อความก่อนถอนสิทธิ์การกระทำ' });
      const close = () =>
        request(app)
          .post(`/api/v1/chat/tickets/${id}/close`)
          .auth(officerToken(), { type: 'bearer' })
          .send({});
      expect((await send()).status).toBe(201);
      expect((await close()).status).toBe(200);
      const beforeMessages = await db('chat_messages').select('*');
      const beforeEvents = await db('chat_ticket_events').select('*');
      fixture.execute('DELETE FROM user_permissions WHERE user_id = ? AND permission_id = ?', [
        201,
        actionId,
      ]);
      const detail = await request(app)
        .get(`/api/v1/chat/tickets/${id}`)
        .auth(officerToken(), { type: 'bearer' });
      expect(detail.status).toBe(200);
      expect(detail.body.data.capabilities).toEqual({ canReply: false, canClose: false });
      expect((await send()).status).toBe(403);
      expect((await close()).status).toBe(403);
      if (own) expect((await create()).status).toBe(403);
      expect(await db('chat_messages').select('*')).toEqual(beforeMessages);
      expect(await db('chat_ticket_events').select('*')).toEqual(beforeEvents);
    },
  );
  it('blocks a successful answer retry after the answer scope narrows even while the ticket stays visible', async () => {
    configureOfficerPermissions([
      { id: 1, scope: 'ALL' },
      { id: 3, scope: 'ALL' },
    ]);
    const app = createApp();
    const opened = await openTicket(app);
    const id = opened.body.data.ticket.id;
    const key = randomUUID();
    const send = () =>
      request(app)
        .post(`/api/v1/chat/tickets/${id}/messages`)
        .auth(officerToken(), { type: 'bearer' })
        .set('Idempotency-Key', key)
        .send({ message: 'คำตอบก่อนเปลี่ยนพื้นที่' });
    expect((await send()).status).toBe(201);
    fixture.execute(
      'UPDATE user_permissions SET scope = ?, province_id = ? WHERE user_id = ? AND permission_id = ?',
      ['IN_PROVINCE', '1000', 201, 3],
    );
    const detail = await request(app)
      .get(`/api/v1/chat/tickets/${id}`)
      .auth(officerToken(), { type: 'bearer' });
    expect(detail.status).toBe(200);
    expect(detail.body.data.capabilities).toEqual({ canReply: false, canClose: false });
    expect((await send()).status).toBe(404);
    const close = await request(app)
      .post(`/api/v1/chat/tickets/${id}/close`)
      .auth(officerToken(), { type: 'bearer' })
      .send({});
    expect(close.status).toBe(404);
  });
  it('rechecks current factory location before successful creation and message retries', async () => {
    configureOfficerPermissions([
      { id: 1, scope: 'ALL' },
      { id: 2, scope: 'IN_PROVINCE', provinceId: '2100' },
    ]);
    const app = createApp();
    const createKey = randomUUID();
    const create = () =>
      request(app)
        .post('/api/v1/chat/tickets')
        .auth(officerToken(), { type: 'bearer' })
        .set('Idempotency-Key', createKey)
        .send(createInput);
    const opened = await create();
    expect(opened.status).toBe(201);
    const id = opened.body.data.ticket.id;
    const messageKey = randomUUID();
    const send = () =>
      request(app)
        .post(`/api/v1/chat/tickets/${id}/messages`)
        .auth(officerToken(), { type: 'bearer' })
        .set('Idempotency-Key', messageKey)
        .send({ message: 'ข้อมูลก่อนเปลี่ยนจังหวัดโรงงาน' });
    expect((await send()).status).toBe(201);
    fixture.execute('UPDATE eligible_factories SET province_name = ? WHERE id = ?', [
      'กรุงเทพมหานคร',
      10,
    ]);
    const detail = await request(app)
      .get(`/api/v1/chat/tickets/${id}`)
      .auth(officerToken(), { type: 'bearer' });
    expect(detail.status).toBe(200);
    expect(detail.body.data.capabilities).toEqual({ canReply: false, canClose: false });
    expect((await send()).status).toBe(404);
    expect((await create()).status).toBe(404);
    const close = await request(app)
      .post(`/api/v1/chat/tickets/${id}/close`)
      .auth(officerToken(), { type: 'bearer' })
      .send({});
    expect(close.status).toBe(404);
    expect(await db('chat_tickets').select('id')).toHaveLength(1);
    expect(await db('chat_messages').where('ticket_id', id).select('id')).toHaveLength(2);
  });
  it('keeps operator ALL Chat grants restricted to current factory assignments', async () => {
    fixture.execute("UPDATE role_permissions SET scope = 'ALL' WHERE role_id = 1");
    const app = createApp();
    const factories = await request(app)
      .get('/api/v1/chat/factories')
      .auth(operatorToken(), { type: 'bearer' });
    expect(factories.body.data.map((factory: { id: number }) => factory.id)).toEqual([10, 30]);
    const denied = await request(app)
      .post('/api/v1/chat/tickets')
      .auth(operatorToken(), { type: 'bearer' })
      .set('Idempotency-Key', randomUUID())
      .send({ ...createInput, eligibleFactoryId: 20 });
    expect(denied.status).toBe(404);
    expect((await openTicket(app)).status).toBe(201);
  });
  it('denies citizen creation despite chat:view and both write grants', async () => {
    fixture.execute(
      'INSERT INTO role_permissions (role_id, permission_id, scope) VALUES (?, ?, ?)',
      [5, 3, 'ALL'],
    );
    const app = createApp();
    const token = signAccessToken({
      sub: '301',
      userType: 'citizen',
      roles: ['factory_operator'],
      scopes: {},
    });
    const options = await request(app).get('/api/v1/chat/options').auth(token, { type: 'bearer' });
    expect(options.status).toBe(200);
    expect(options.body.data.canCreate).toBe(false);
    const denied = await request(app)
      .post('/api/v1/chat/tickets')
      .auth(token, { type: 'bearer' })
      .set('Idempotency-Key', randomUUID())
      .send(createInput);
    expect(denied.status).toBe(403);
    expect(denied.body.error.code).toBe('FORBIDDEN');
    for (const table of [
      'chat_tickets',
      'chat_messages',
      'chat_ticket_events',
      'chat_ticket_sequences',
    ]) {
      expect(await db(table).select('*')).toEqual([]);
    }
  });
  it.each([
    { userId: 101, userType: 'operator', roleId: 1 },
    { userId: 201, userType: 'officer', roleId: 2 },
    { userId: 204, userType: 'admin', roleId: 4 },
    { userId: 203, userType: 'officer', roleId: null },
  ] as const)(
    'blocks all reads, writes and successful retries after chat:view is revoked for $userType $userId',
    async ({ userId, userType, roleId }) => {
      const app = createApp();
      const createKey = randomUUID();
      const opened = await openTicket(app, createKey);
      expect(opened.status).toBe(201);
      const id = opened.body.data.ticket.id;
      const token = signAccessToken({ sub: String(userId), userType, roles: [], scopes: {} });
      const replyKey = randomUUID();
      const send = () =>
        request(app)
          .post(`/api/v1/chat/tickets/${id}/messages`)
          .auth(token, { type: 'bearer' })
          .set('Idempotency-Key', replyKey)
          .send({ message: 'ข้อความก่อนถอนสิทธิ์' });
      expect((await send()).status).toBe(201);
      const closeTicket = () =>
        request(app)
          .post(`/api/v1/chat/tickets/${id}/close`)
          .auth(token, { type: 'bearer' })
          .send({});
      expect((await closeTicket()).status).toBe(200);
      const before = await db('chat_messages').select('*');
      const beforeTicket = await db('chat_tickets').where('id', id).first();
      const beforeEvents = await db('chat_ticket_events').where('ticket_id', id).select('*');
      if (roleId === null) {
        fixture.execute('DELETE FROM user_permissions WHERE user_id = ? AND permission_id = 1', [
          userId,
        ]);
      } else {
        fixture.execute('DELETE FROM role_permissions WHERE role_id = ? AND permission_id = 1', [
          roleId,
        ]);
      }
      for (const path of [
        '/options',
        '/factories',
        '/factories/10/measurement-points',
        '/tickets',
        `/tickets/${id}`,
        `/tickets/${id}/messages`,
      ]) {
        const response = await request(app)
          .get(`/api/v1/chat${path}`)
          .auth(token, { type: 'bearer' });
        expect(response.status).toBe(403);
        expect(response.body.error.code).toBe('FORBIDDEN');
      }
      const create = await request(app)
        .post('/api/v1/chat/tickets')
        .auth(token, { type: 'bearer' })
        .set('Idempotency-Key', createKey)
        .send(createInput);
      expect(create.status).toBe(403);
      expect((await send()).status).toBe(403);
      expect((await closeTicket()).status).toBe(403);
      expect(await db('chat_messages').select('*')).toEqual(before);
      expect(await db('chat_tickets').where('id', id).first()).toEqual(beforeTicket);
      expect(await db('chat_ticket_events').where('ticket_id', id).select('*')).toEqual(
        beforeEvents,
      );
    },
  );
  it('uses current factory membership for history, writes and successful-create retries', async () => {
    const app = createApp();
    const key = randomUUID();
    const opened = await openTicket(app, key);
    const id = opened.body.data.ticket.id;
    fixture.execute("UPDATE user_factory_access SET revoked_at = '2026-10-17' WHERE user_id = 101");
    expect((await openTicket(app, key)).status).toBe(404);
    for (const suffix of ['', '/messages']) {
      const response = await request(app)
        .get(`/api/v1/chat/tickets/${id}${suffix}`)
        .auth(operatorToken(), { type: 'bearer' });
      expect(response.status).toBe(404);
    }
    const close = await request(app)
      .post(`/api/v1/chat/tickets/${id}/close`)
      .auth(operatorToken(), { type: 'bearer' })
      .send({});
    expect(close.status).toBe(404);
    const send = await request(app)
      .post(`/api/v1/chat/tickets/${id}/messages`)
      .auth(operatorToken(), { type: 'bearer' })
      .set('Idempotency-Key', randomUUID())
      .send({ message: 'ไม่มีสิทธิ์แล้ว' });
    expect(send.status).toBe(404);
  });
  it.each([
    '/factories?page=0',
    '/factories?pageSize=500',
    '/factories?unknown=value',
    '/tickets?sort=body;DROP%20TABLE%20users',
    '/tickets?pageSize=500',
    '/tickets?from=2026-02-30T00:00:00Z',
    '/tickets?from=2026-10-20T00:00:00Z&to=2026-10-19T00:00:00Z',
    '/tickets/1/messages?olderCursor=abc&afterMessageId=1',
    '/tickets/1/messages?limit=1000',
    '/tickets/-1',
  ])('rejects invalid filters and history cursors at %s', async (path) => {
    const response = await request(createApp())
      .get(`/api/v1/chat${path}`)
      .auth(operatorToken(), { type: 'bearer' });
    expect(response.status).toBe(400);
  });
});
