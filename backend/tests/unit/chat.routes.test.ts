import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { createApp } from '../../src/app';
import { db } from '../../src/config/database';
import { signAccessToken } from '../../src/shared/utils/jwt';
import { createChatSqlFixture, type ChatSqlFixture } from '../helpers/chat-sql-fixture';
import { randomUUID } from 'node:crypto';
import { logger } from '../../src/config/logger';
import { inspect } from 'node:util';

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

describe('Chat ticket HTTP API', () => {
  let fixture: ChatSqlFixture;
  beforeEach(async () => {
    fixture = await createChatSqlFixture(db);
  });
  afterEach(() => {
    fixture.close();
    jest.restoreAllMocks();
  });
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
    expect(response.body.pagination).toEqual({ page: 1, pageSize: 25, total: 2, totalPages: 1 });
  });
  it('returns typed point identities and hides points outside the operator factory', async () => {
    const app = createApp();
    const response = await request(app)
      .get('/api/v1/chat/factories/10/measurement-points')
      .auth(operatorToken(), { type: 'bearer' });
    expect(response.status).toBe(200);
    expect(response.body.data).toEqual([
      {
        kind: 'eligible',
        id: 1000,
        systemType: 'CEMS',
        pointCode: 'E10',
        pointName: 'จุดเข้าข่าย 10',
      },
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
      capabilities: { canReply: true, canClose: true },
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
    const token = signAccessToken({ sub: '102', userType: 'operator', roles: [], scopes: {} });
    const close = () =>
      request(app)
        .post(`/api/v1/chat/tickets/${id}/close`)
        .auth(token, { type: 'bearer' })
        .send({});
    const first = await close();
    expect(first.status).toBe(200);
    expect(first.body.data).toMatchObject({
      status: 'closed',
      closedBy: { userId: 102 },
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
  it('permits creation only by operators and requires an officer answer grant for writes', async () => {
    const app = createApp();
    const opened = await openTicket(app);
    const token = signAccessToken({ sub: '201', userType: 'officer', roles: [], scopes: {} });
    const create = await request(app)
      .post('/api/v1/chat/tickets')
      .auth(token, { type: 'bearer' })
      .set('Idempotency-Key', randomUUID())
      .send(createInput);
    expect(create.status).toBe(403);
    fixture.execute('DELETE FROM role_permissions WHERE role_id = 2 AND permission_id = 3');
    const detail = await request(app)
      .get(`/api/v1/chat/tickets/${opened.body.data.ticket.id}`)
      .auth(token, { type: 'bearer' });
    expect(detail.status).toBe(200);
    expect(detail.body.data.capabilities).toEqual({ canReply: false, canClose: false });
    const reply = await request(app)
      .post(`/api/v1/chat/tickets/${opened.body.data.ticket.id}/messages`)
      .auth(token, { type: 'bearer' })
      .set('Idempotency-Key', randomUUID())
      .send({ message: 'คำตอบ' });
    expect(reply.status).toBe(403);
  });
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
