import { afterAll, beforeAll, describe, expect, it, jest } from '@jest/globals';
import { randomUUID } from 'node:crypto';
import express from 'express';
import knex, { type Knex } from 'knex';
import request from 'supertest';
import {
  buildChatSqlServerTestConfig,
  assertChatSqlTestDatabaseIdentity,
  createChatSqlServerFixtures,
  createChatSqlFixture,
} from '../helpers/chat-sql-fixture';

const settings = {
  POMS_SQL_TEST_HOST: 'fixture.invalid',
  POMS_SQL_TEST_DATABASE: 'poms_chat_test',
  POMS_SQL_TEST_USER: 'fixture',
  POMS_SQL_TEST_PASSWORD: 'synthetic-only',
};

describe('Chat SQL Server verification target', () => {
  it('refuses application credentials without an explicitly named synthetic chat database', () => {
    expect(() =>
      buildChatSqlServerTestConfig({
        DB_HOST: 'production.invalid',
        DB_NAME: 'poms',
        DB_USER: 'example',
        DB_PASSWORD: 'example',
      }),
    ).toThrow('Explicit POMS_SQL_TEST settings for poms_chat_test are required');
  });
  it('refuses a database with an absent or incorrect synthetic-purpose marker', () => {
    expect(() =>
      assertChatSqlTestDatabaseIdentity({ databaseName: 'poms_chat_test', purpose: 'production' }),
    ).toThrow('Dedicated synthetic chat test database required');
  });
  it('rejects malformed connection ports and TLS flags before connecting', () => {
    expect(() =>
      buildChatSqlServerTestConfig({ ...settings, POMS_SQL_TEST_PORT: '1433;SELECT 1' }),
    ).toThrow('Invalid chat test SQL port');
    expect(() =>
      buildChatSqlServerTestConfig({ ...settings, POMS_SQL_TEST_ENCRYPT: 'yes' }),
    ).toThrow('Invalid chat test SQL encryption setting');
  });
});

describe('Chat SQL fixture transaction boundary', () => {
  it('exposes transaction state inside callbacks and restores it after commit or rollback', async () => {
    const database = knex({ client: 'mssql' });
    const fixture = await createChatSqlFixture(database);
    const before = database.isTransaction;
    try {
      await database.transaction(async (trx) => {
        expect(trx.isTransaction).toBe(true);
      });
      expect(database.isTransaction).toBe(before);
      await expect(
        database.transaction(async (trx) => {
          expect(trx.isTransaction).toBe(true);
          throw new Error('synthetic rollback');
        }),
      ).rejects.toThrow('synthetic rollback');
      expect(database.isTransaction).toBe(before);
    } finally {
      fixture.close();
      await database.destroy();
    }
  });
});

const enabledSetting = process.env.CHAT_SQL_TEST_ENABLED;
if (enabledSetting !== undefined && !['true', 'false'].includes(enabledSetting)) {
  throw new Error('CHAT_SQL_TEST_ENABLED must be true or false');
}
const sqlDescribe = enabledSetting === 'true' ? describe : describe.skip;

/**
 * Opt-in only. No .env/application database credentials are read by this suite.
 * Keep the synthetic database after the run for investigation; a new run needs an
 * empty database marked with PomsTestPurpose=chat-integration-synthetic-only.
 */
sqlDescribe('Chat HTTP API on a real isolated SQL Server', () => {
  let database: Knex;
  let app: express.Express;
  let token: string;
  const endpoint = '/api/v1/chat/tickets';
  const payload = {
    eligibleFactoryId: 10,
    measurementPoint: null,
    topicCode: 'connection_data',
    message: 'ข้อความสมมติสำหรับตรวจ SQL Server',
  };

  beforeAll(async () => {
    database = knex(buildChatSqlServerTestConfig(process.env));
    await createChatSqlServerFixtures(database);
    const migration = await import('../../src/db/migrations/0141_create_chat_tickets');
    await migration.up(database);
    jest.doMock('../../src/config/database', () => ({ db: database }));
    jest.doMock('../../src/config/env', () => ({
      env: {
        NODE_ENV: 'test',
        API_PREFIX: '/api/v1',
        FACTORY_PROFILE_MODE: 'legacy',
        JWT_SECRET: 'chat-synthetic-sql-test-secret-only',
        JWT_EXPIRES_IN: '15m',
        LOG_LEVEL: 'error',
      },
    }));
    const { createChatRoutes } = await import('../../src/modules/chat/chat.routes');
    const { errorHandler } = await import('../../src/shared/middlewares/errorHandler');
    const { signAccessToken } = await import('../../src/shared/utils/jwt');
    app = express();
    app.use(express.json());
    app.use('/api/v1/chat', createChatRoutes());
    app.use(errorHandler);
    token = signAccessToken({ sub: '101', userType: 'operator', roles: [], scopes: {} });
  }, 60_000);

  afterAll(async () => {
    if (database) await database.destroy();
    jest.dontMock('../../src/config/database');
    jest.dontMock('../../src/config/env');
  });

  function createTicket(key: string) {
    return request(app)
      .post(endpoint)
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', key)
      .send(payload);
  }

  function readTicket(id: number) {
    return request(app).get(`${endpoint}/${id}`).set('Authorization', `Bearer ${token}`);
  }

  it('assigns distinct numbers to concurrent ticket opens and one ticket to duplicate retries', async () => {
    const concurrent = await Promise.all(
      Array.from({ length: 6 }, () => createTicket(randomUUID())),
    );
    for (const response of concurrent) expect(response.status).toBe(201);
    const ticketNumbers = concurrent.map((response) => response.body.data.ticket.ticketNo);
    expect(new Set(ticketNumbers).size).toBe(6);

    const retryKey = randomUUID();
    const repeated = await Promise.all(Array.from({ length: 4 }, () => createTicket(retryKey)));
    for (const response of repeated) expect([200, 201]).toContain(response.status);
    expect(new Set(repeated.map((response) => response.body.data.ticket.id)).size).toBe(1);
    const ticket = repeated[0].body.data.ticket;
    const history = await request(app)
      .get(`${endpoint}/${ticket.id}/messages`)
      .set('Authorization', `Bearer ${token}`);
    expect(history.status).toBe(200);
    expect(history.body.data.messages).toHaveLength(1);
    expect(history.body.data.ticket.events).toHaveLength(1);
  }, 60_000);

  it('makes concurrent message retries one message and rejects all new messages after close', async () => {
    const opened = await createTicket(randomUUID());
    expect(opened.status).toBe(201);
    const id = opened.body.data.ticket.id as number;
    const messageKey = randomUUID();
    const send = (key: string, message: string) =>
      request(app)
        .post(`${endpoint}/${id}/messages`)
        .set('Authorization', `Bearer ${token}`)
        .set('Idempotency-Key', key)
        .send({ message });
    const repeated = await Promise.all(
      Array.from({ length: 4 }, () => send(messageKey, 'ข้อความซ้ำ')),
    );
    for (const response of repeated) expect([200, 201]).toContain(response.status);
    expect(new Set(repeated.map((response) => response.body.data.message.id)).size).toBe(1);

    const [racingSend, close] = await Promise.all([
      send(randomUUID(), 'ข้อความแข่งกับการปิด'),
      request(app).post(`${endpoint}/${id}/close`).set('Authorization', `Bearer ${token}`).send({}),
    ]);
    expect(close.status).toBe(200);
    expect([201, 409]).toContain(racingSend.status);
    const afterClose = await send(randomUUID(), 'ต้องถูกปฏิเสธหลังปิด');
    expect(afterClose.status).toBe(409);
    expect(afterClose.body.error.code).toBe('CHAT_TICKET_CLOSED');
    const oldRetry = await send(messageKey, 'ข้อความซ้ำ');
    expect([200, 201]).toContain(oldRetry.status);
    expect(oldRetry.body.data.message.id).toBe(repeated[0].body.data.message.id);

    const detail = await readTicket(id);
    expect(detail.status).toBe(200);
    expect(detail.body.data.status).toBe('closed');
    expect(detail.body.data.events.map((event: { type: string }) => event.type)).toEqual([
      'opened',
      'closed',
    ]);
    const history = await request(app)
      .get(`${endpoint}/${id}/messages`)
      .set('Authorization', `Bearer ${token}`);
    expect(history.status).toBe(200);
    expect(
      history.body.data.messages.map((message: { text: string }) => message.text),
    ).not.toContain('ต้องถูกปฏิเสธหลังปิด');
    expect(history.body.data.messages).toHaveLength(racingSend.status === 201 ? 3 : 2);
  }, 60_000);

  it('preserves maximum-length Thai source names in ticket and message snapshots', async () => {
    await database('eligible_factories')
      .where('id', 10)
      .update({
        factory_name: 'ก'.repeat(500),
        province_name: 'จ'.repeat(128),
      });
    await database('users')
      .where('id', 101)
      .update({
        first_name: 'ผ'.repeat(128),
        last_name: 'ส'.repeat(128),
      });
    try {
      const created = await createTicket(randomUUID());
      expect(created.status).toBe(201);
      const persisted = await readTicket(created.body.data.ticket.id);
      expect(persisted.status).toBe(200);
      expect(persisted.body.data.factory.name).toHaveLength(500);
      expect(persisted.body.data.factory.provinceName).toHaveLength(128);
      expect(persisted.body.data.openedBy.name).toHaveLength(257);
      expect(created.body.data.firstMessage.sender.name).toHaveLength(257);
    } finally {
      await database('eligible_factories').where('id', 10).update({
        factory_name: 'โรงงานสมมติ 10',
        province_name: 'ระยอง',
      });
      await database('users').where('id', 101).update({
        first_name: 'ผู้ใช้สมมติ operator',
        last_name: 'ทดสอบ',
      });
    }
  }, 60_000);

  it('rolls back the entire ticket when SQL Server rejects its first message', async () => {
    const list = () => request(app).get(endpoint).set('Authorization', `Bearer ${token}`);
    const before = await list();
    expect(before.status).toBe(200);
    const key = randomUUID();
    await database.raw(
      'ALTER TABLE chat_messages WITH NOCHECK ADD CONSTRAINT ck_chat_test_reject_message CHECK (1 = 0)',
    );
    try {
      const rejected = await createTicket(key);
      expect(rejected.status).toBe(500);
      const after = await list();
      expect(after.status).toBe(200);
      expect(after.body.pagination.total).toBe(before.body.pagination.total);
    } finally {
      await database.raw('ALTER TABLE chat_messages DROP CONSTRAINT ck_chat_test_reject_message');
    }
    const retry = await createTicket(key);
    expect(retry.status).toBe(201);
    const persisted = await readTicket(retry.body.data.ticket.id);
    expect(persisted.status).toBe(200);
  }, 60_000);
});
