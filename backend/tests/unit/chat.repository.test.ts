import { afterEach, describe, expect, it, jest } from '@jest/globals';
import type { Knex } from 'knex';
import { db } from '../../src/config/database';
import { chatRepository } from '../../src/modules/chat/chat.repository';
import type { ChatAccess } from '../../src/modules/chat/chat.types';
import { createChatSqlFixture, type ChatSqlFixture } from '../helpers/chat-sql-fixture';

const operator: ChatAccess = {
  actorUserId: 101,
  userType: 'operator',
  roles: ['factory_operator'],
  factoryScope: { scope: 'OWN_FACTORY' },
  regionalAccess: null,
  canCreateTicket: true,
  canWrite: true,
};
let fixture: ChatSqlFixture | undefined;
afterEach(() => {
  fixture?.close();
  fixture = undefined;
  jest.useRealTimers();
});

describe('Chat persistence public interface', () => {
  it('treats equivalent creation payloads as the same retry regardless of property order', async () => {
    fixture = await createChatSqlFixture(db);
    const created = await chatRepository.createTicket(
      operator,
      {
        eligibleFactoryId: 10,
        measurementPoint: { kind: 'eligible', id: 1000 },
        topicCode: 'other',
        message: 'คำถาม',
      },
      'canonical-payload',
    );
    const replayed = await chatRepository.createTicket(
      operator,
      {
        message: 'คำถาม',
        topicCode: 'other',
        measurementPoint: { id: 1000, kind: 'eligible' },
        eligibleFactoryId: 10,
      },
      'canonical-payload',
    );
    expect(replayed).toMatchObject({ ticket: { id: created.ticket.id }, replayed: true });
  });
  it('identifies message senders by their account and current display name', async () => {
    fixture = await createChatSqlFixture(db);
    expect(await chatRepository.getActor(operator)).toMatchObject({
      userId: 101,
      name: 'ผู้ใช้สมมติ operator ทดสอบ',
      roleCode: 'factory_operator',
    });
  });
  it('opens a ticket together with its first message and preserves it for a coworker', async () => {
    fixture = await createChatSqlFixture(db);
    const created = await chatRepository.createTicket(
      operator,
      {
        eligibleFactoryId: 10,
        measurementPoint: null,
        topicCode: 'other',
        message: 'ต้องการสอบถามข้อมูล',
      },
      'create-1',
    );
    const coworker = { ...operator, actorUserId: 102 };
    const history = await chatRepository.getMessages(coworker, created.ticket.id, { limit: 25 });
    expect(history.ticket).toMatchObject({
      status: 'open',
      factory: { id: 10 },
      measurementPoint: null,
      events: [{ type: 'opened', actor: { userId: 101 } }],
    });
    expect(history.messages).toMatchObject([
      { text: 'ต้องการสอบถามข้อมูล', sender: { userId: 101 } },
    ]);
    expect(created.ticket.ticketNo).toMatch(/^TK-\d{2}-00001$/);
  });
  it('replays successful creation after its selected point retires but rejects another payload or revoked access', async () => {
    fixture = await createChatSqlFixture(db);
    const input = {
      eligibleFactoryId: 10,
      measurementPoint: { kind: 'eligible' as const, id: 1000 },
      topicCode: 'other' as const,
      message: 'ข้อความแรก',
    };
    const created = await chatRepository.createTicket(operator, input, 'same-create');
    fixture.execute(
      "UPDATE factory_monitoring_points SET deleted_at = '2026-10-17' WHERE id = 1000",
    );
    const replay = await chatRepository.createTicket(operator, input, 'same-create');
    expect(replay).toMatchObject({
      ticket: { id: created.ticket.id },
      firstMessage: { id: created.firstMessage.id },
      replayed: true,
    });
    await expect(
      chatRepository.createTicket(operator, { ...input, message: 'เปลี่ยนข้อความ' }, 'same-create'),
    ).rejects.toMatchObject({ statusCode: 409, code: 'IDEMPOTENCY_KEY_CONFLICT' });
    fixture.execute("UPDATE user_factory_access SET revoked_at = '2026-10-17' WHERE user_id = 101");
    await expect(chatRepository.createTicket(operator, input, 'same-create')).rejects.toMatchObject(
      { statusCode: 404 },
    );
  });
  it('lets a coworker reply and close once while allowing successful send retries after closure', async () => {
    fixture = await createChatSqlFixture(db);
    const { ticket } = await chatRepository.createTicket(
      operator,
      { eligibleFactoryId: 10, measurementPoint: null, topicCode: 'other', message: 'คำถาม' },
      'question',
    );
    const coworker = { ...operator, actorUserId: 102 };
    const reply = await chatRepository.sendMessage(coworker, ticket.id, 'ตอบแล้ว', 'reply');
    const closed = await chatRepository.closeTicket(coworker, ticket.id);
    const closedAgain = await chatRepository.closeTicket(operator, ticket.id);
    expect(closedAgain).toEqual(closed);
    expect(closed).toMatchObject({
      status: 'closed',
      closedBy: { userId: 102 },
      lastMessageAt: reply.message.createdAt,
      capabilities: { canReply: false, canClose: false },
      events: [{ type: 'opened' }, { type: 'closed' }],
    });
    expect(await chatRepository.sendMessage(coworker, ticket.id, 'ตอบแล้ว', 'reply')).toMatchObject(
      { message: { id: reply.message.id }, replayed: true },
    );
    await expect(
      chatRepository.sendMessage(coworker, ticket.id, 'ข้อความใหม่', 'new'),
    ).rejects.toMatchObject({ statusCode: 409, code: 'CHAT_TICKET_CLOSED' });
    await expect(
      chatRepository.sendMessage(coworker, ticket.id, 'เปลี่ยนข้อความ', 'reply'),
    ).rejects.toMatchObject({ statusCode: 409, code: 'IDEMPOTENCY_KEY_CONFLICT' });
    await expect(
      chatRepository.sendMessage({ ...coworker, canWrite: false }, ticket.id, 'ตอบแล้ว', 'reply'),
    ).rejects.toMatchObject({ statusCode: 403 });
  });
  it('lists only visible ticket summaries with stable ordering and intersecting filters', async () => {
    fixture = await createChatSqlFixture(db);
    const first = await chatRepository.createTicket(
      operator,
      { eligibleFactoryId: 10, measurementPoint: null, topicCode: 'other', message: 'เรื่องแรก' },
      'first',
    );
    const second = await chatRepository.createTicket(
      operator,
      {
        eligibleFactoryId: 30,
        measurementPoint: null,
        topicCode: 'forms_reports',
        message: 'เรื่องถัดไป',
      },
      'second',
    );
    await chatRepository.createTicket(
      { ...operator, actorUserId: 103 },
      {
        eligibleFactoryId: 20,
        measurementPoint: null,
        topicCode: 'other',
        message: 'ข้อมูลส่วนตัวโรงงานอื่น',
      },
      'hidden',
    );
    await chatRepository.closeTicket(operator, first.ticket.id);
    const query = { sort: 'lastMessageAt' as const, order: 'desc' as const };
    const page = await chatRepository.listTickets(operator, query);
    expect(page.pagination).toEqual({ page: 1, pageSize: 2, total: 2, totalPages: 1 });
    expect(page.data.map((ticket) => ticket.id)).toEqual([second.ticket.id, first.ticket.id]);
    expect(page.data[0]).not.toHaveProperty('messages');
    expect(page.data[0]).not.toHaveProperty('events');
    const filtered = await chatRepository.listTickets(operator, {
      ...query,
      q: 'REG-10',
      eligibleFactoryId: 10,
      topicCode: 'other',
      status: 'closed',
      provinceName: 'ระยอง',
      regionName: 'ภาคตะวันออก',
      from: first.ticket.openedAt,
      to: first.ticket.lastMessageAt,
    });
    expect(filtered.data.map((ticket) => ticket.id)).toEqual([first.ticket.id]);
    expect(
      (await chatRepository.listTickets(operator, { ...query, q: '%' })).pagination.total,
    ).toBe(0);
  });
  it('pages older history and every missed refresh message without duplicating messages', async () => {
    fixture = await createChatSqlFixture(db);
    const { ticket, firstMessage } = await chatRepository.createTicket(
      operator,
      { eligibleFactoryId: 10, measurementPoint: null, topicCode: 'other', message: 'หนึ่ง' },
      'history',
    );
    const second = await chatRepository.sendMessage(operator, ticket.id, 'สอง', 'two');
    const third = await chatRepository.sendMessage(operator, ticket.id, 'สาม', 'three');
    const fourth = await chatRepository.sendMessage(operator, ticket.id, 'สี่', 'four');
    const latest = await chatRepository.getMessages(operator, ticket.id, { limit: 2 });
    expect(latest.messages.map((message) => message.id)).toEqual([
      third.message.id,
      fourth.message.id,
    ]);
    expect(latest.pagination.hasMore).toBe(true);
    const older = await chatRepository.getMessages(operator, ticket.id, {
      limit: 2,
      olderCursor: latest.pagination.olderCursor ?? '',
    });
    expect(older.messages.map((message) => message.id)).toEqual([
      firstMessage.id,
      second.message.id,
    ]);
    expect(older.pagination).toEqual({
      olderCursor: null,
      nextAfterMessageId: null,
      hasMore: false,
    });
    const refresh = await chatRepository.getMessages(operator, ticket.id, {
      limit: 2,
      afterMessageId: firstMessage.id,
    });
    expect(refresh.messages.map((message) => message.id)).toEqual([
      second.message.id,
      third.message.id,
    ]);
    expect(refresh.pagination).toEqual({
      olderCursor: null,
      nextAfterMessageId: third.message.id,
      hasMore: true,
    });
    const remainder = await chatRepository.getMessages(operator, ticket.id, {
      limit: 2,
      afterMessageId: refresh.pagination.nextAfterMessageId ?? 0,
    });
    expect(remainder.messages.map((message) => message.id)).toEqual([fourth.message.id]);
    await chatRepository.closeTicket(operator, ticket.id);
    const noNewMessages = await chatRepository.getMessages(operator, ticket.id, {
      limit: 2,
      afterMessageId: fourth.message.id,
    });
    expect(noNewMessages.messages).toEqual([]);
    expect(noNewMessages.ticket).toMatchObject({
      status: 'closed',
      events: [{ type: 'opened' }, { type: 'closed' }],
    });
    await expect(
      chatRepository.getMessages(operator, ticket.id, { limit: 2, olderCursor: 'forged-cursor' }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });
  it('retries a database deadlock without exposing a duplicate ticket to the caller', async () => {
    fixture = await createChatSqlFixture(db);
    const context = (db as Knex & { context: { transaction: typeof db.transaction } }).context;
    jest
      .mocked(context.transaction)
      .mockRejectedValueOnce(
        Object.assign(new Error('Synthetic SQL Server deadlock victim'), { number: 1205 }),
      );
    const created = await chatRepository.createTicket(
      operator,
      {
        eligibleFactoryId: 10,
        measurementPoint: null,
        topicCode: 'other',
        message: 'คำถามหลังฐานข้อมูลลองใหม่',
      },
      'deadlock',
    );
    expect(created.ticket.ticketNo).toMatch(/^TK-\d{2}-00001$/);
    expect(
      (
        await chatRepository.listTickets(operator, {
          sort: 'lastMessageAt',
          order: 'desc',
        })
      ).pagination.total,
    ).toBe(1);
  });
  it('rolls back the ticket and its annual number when the first message cannot be saved', async () => {
    fixture = await createChatSqlFixture(db);
    fixture.execute(
      "CREATE TRIGGER fail_chat_message BEFORE INSERT ON chat_messages BEGIN SELECT RAISE(ABORT, 'synthetic message failure'); END",
    );
    const input = {
      eligibleFactoryId: 10,
      measurementPoint: null,
      topicCode: 'other' as const,
      message: 'ข้อความแรกต้องสำเร็จด้วยกัน',
    };
    await expect(chatRepository.createTicket(operator, input, 'rollback')).rejects.toThrow(
      'synthetic message failure',
    );
    expect(
      (
        await chatRepository.listTickets(operator, {
          sort: 'lastMessageAt',
          order: 'desc',
        })
      ).pagination.total,
    ).toBe(0);
    fixture.execute('DROP TRIGGER fail_chat_message');
    const retry = await chatRepository.createTicket(operator, input, 'rollback');
    expect(retry.ticket.ticketNo).toMatch(/^TK-\d{2}-00001$/);
    expect(
      (await chatRepository.getMessages(operator, retry.ticket.id, { limit: 25 })).messages,
    ).toHaveLength(1);
  });
  it('resets ticket numbers at Bangkok Buddhist new year and reports annual exhaustion explicitly', async () => {
    fixture = await createChatSqlFixture(db);
    jest.useFakeTimers({ now: new Date('2026-12-31T16:59:59.000Z') });
    const input = {
      eligibleFactoryId: 10,
      measurementPoint: null,
      topicCode: 'other' as const,
      message: 'คำถามข้ามปี',
    };
    const oldYear = await chatRepository.createTicket(operator, input, 'year-end');
    jest.setSystemTime(new Date('2026-12-31T17:00:00.000Z'));
    const newYear = await chatRepository.createTicket(operator, input, 'new-year');
    expect([oldYear.ticket.ticketNo, newYear.ticket.ticketNo]).toEqual([
      'TK-69-00001',
      'TK-70-00001',
    ]);
    expect(newYear.ticket.openedAt).toBe('2026-12-31T17:00:00.000Z');
    fixture.execute('UPDATE chat_ticket_sequences SET last_number = 99999 WHERE year = 2570');
    await expect(chatRepository.createTicket(operator, input, 'exhausted')).rejects.toMatchObject({
      statusCode: 409,
      code: 'CHAT_TICKET_NUMBER_EXHAUSTED',
    });
    expect(
      (
        await chatRepository.listTickets(operator, {
          sort: 'lastMessageAt',
          order: 'desc',
        })
      ).pagination.total,
    ).toBe(2);
  });
});
