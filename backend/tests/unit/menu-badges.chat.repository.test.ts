import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { db } from '../../src/config/database';
import { chatRepository } from '../../src/modules/chat/chat.repository';
import type { ChatAccess } from '../../src/modules/chat/chat.types';
import { createChatSqlFixture, type ChatSqlFixture } from '../helpers/chat-sql-fixture';

const operator: ChatAccess = {
  actorUserId: 101,
  userType: 'operator',
  roles: ['factory_operator'],
  factoryScope: { scope: 'OWN_FACTORY' },
  createScope: { scope: 'OWN_FACTORY' },
  answerScope: undefined,
  regionalAccess: null,
  canCreateTicket: true,
  canWrite: true,
};
const officer: ChatAccess = {
  ...operator,
  actorUserId: 201,
  userType: 'officer',
  roles: ['diw_central'],
  factoryScope: { scope: 'ALL' },
  createScope: { scope: 'ALL' },
  answerScope: { scope: 'ALL' },
};
const admin: ChatAccess = {
  ...officer,
  actorUserId: 204,
  userType: 'admin',
  roles: ['admin'],
};
let fixture: ChatSqlFixture;
let sequence = 0;
beforeEach(async () => {
  fixture = await createChatSqlFixture(db);
  sequence = 0;
});
afterEach(() => {
  fixture.close();
  jest.useRealTimers();
});
const badge = (access: ChatAccess) => chatRepository.hasOpenTicketsAwaitingReply(access);
async function openTicket(access = operator, eligibleFactoryId = 10) {
  return chatRepository.createTicket(
    access,
    { eligibleFactoryId, measurementPoint: null, topicCode: 'other', message: 'ข้อความแรก' },
    `badge-ticket-${++sequence}`,
  );
}

describe('Chat menu badge using real ticket and message queries', () => {
  it('returns false without messages, then switches sides after every latest reply', async () => {
    expect(await badge(operator)).toBe(false);
    expect(await badge(officer)).toBe(false);
    const { ticket } = await openTicket();
    expect(await badge(operator)).toBe(false);
    expect(await badge(officer)).toBe(true);
    expect(await badge(admin)).toBe(true);
    await chatRepository.sendMessage(officer, ticket.id, 'เจ้าหน้าที่ตอบ', 'officer-answer');
    expect(await badge(operator)).toBe(true);
    expect(await badge(officer)).toBe(false);
    expect(await badge(admin)).toBe(false);
    await chatRepository.sendMessage(operator, ticket.id, 'ผู้ประกอบการตอบ', 'operator-answer');
    expect(await badge(operator)).toBe(false);
    expect(await badge(officer)).toBe(true);
  });

  it.each([officer, admin])('counts staff messages including persona $userType', async (staff) => {
    const { ticket } = await openTicket(staff);
    expect(await badge(operator)).toBe(true);
    expect(await badge(staff)).toBe(false);
    await chatRepository.closeTicket(staff, ticket.id);
    expect(await badge(operator)).toBe(false);
  });

  it('ignores closed tickets even when their latest sender would otherwise trigger either side', async () => {
    const unanswered = await openTicket();
    const answered = await openTicket();
    await chatRepository.sendMessage(officer, answered.ticket.id, 'ตอบแล้ว', 'answered');
    await chatRepository.closeTicket(officer, answered.ticket.id);
    await chatRepository.closeTicket(officer, unanswered.ticket.id);
    expect(await badge(operator)).toBe(false);
    expect(await badge(officer)).toBe(false);
  });

  it('checks every open ticket independently even when the most recent ticket does not qualify', async () => {
    const earlier = await openTicket();
    await chatRepository.sendMessage(officer, earlier.ticket.id, 'ตอบเรื่องแรก', 'earlier-reply');
    await openTicket();
    expect(await badge(operator)).toBe(true);
    expect(await badge(officer)).toBe(true);
    await chatRepository.closeTicket(officer, earlier.ticket.id);
    expect(await badge(operator)).toBe(false);
    expect(await badge(officer)).toBe(true);
  });

  it('uses message IDs when timestamps are equal and ignores later account persona changes', async () => {
    jest.useFakeTimers({ now: new Date('2026-10-18T03:00:00Z') });
    const { ticket, firstMessage } = await openTicket();
    const reply = await chatRepository.sendMessage(officer, ticket.id, 'ตอบ', 'same-time');
    expect(reply.message.createdAt).toBe(firstMessage.createdAt);
    fixture.execute("UPDATE users SET user_type = 'operator' WHERE id = 201");
    expect(await badge(operator)).toBe(true);
    await chatRepository.sendMessage(operator, ticket.id, 'ถามต่อ', 'same-time-again');
    expect(await badge(operator)).toBe(false);
    expect(await badge(officer)).toBe(true);
  });

  it('does not mistake a coworker or another officer for the opposite side', async () => {
    const { ticket } = await openTicket();
    await chatRepository.sendMessage(
      { ...operator, actorUserId: 102, answerScope: { scope: 'OWN_FACTORY' } },
      ticket.id,
      'เพื่อนร่วมโรงงานตอบ',
      'coworker-reply',
    );
    expect(await badge(operator)).toBe(false);
    await chatRepository.sendMessage(officer, ticket.id, 'เจ้าหน้าที่อีกคนตอบ', 'staff-reply');
    expect(await badge({ ...officer, actorUserId: 202 })).toBe(false);
  });

  it.each([
    ['province in scope', { scope: 'IN_PROVINCE', province: 'ระยอง' }, true],
    ['province out of scope', { scope: 'IN_PROVINCE', province: 'กรุงเทพมหานคร' }, false],
    ['region in scope', { scope: 'IN_REGION', region: 'ภาคตะวันออก' }, true],
    ['region out of scope', { scope: 'IN_REGION', region: 'ภาคกลาง' }, false],
    ['estate in scope', { scope: 'IN_ESTATE', estateCode: 'IE-TEST' }, true],
    ['estate out of scope', { scope: 'IN_ESTATE', estateCode: 'OTHER' }, false],
    ['factory type 88', { scope: 'FACTORY_TYPE_88' }, true],
    ['missing scope', undefined, false],
  ] as const)('uses current Chat visibility: %s', async (_name, factoryScope, expected) => {
    await openTicket();
    expect(await badge({ ...officer, factoryScope, canWrite: false })).toBe(expected);
  });

  it('uses current factory data instead of ticket snapshots for geographic access', async () => {
    await openTicket();
    const provincial = {
      ...officer,
      factoryScope: { scope: 'IN_PROVINCE' as const, province: 'ระยอง' },
    };
    expect(await badge(provincial)).toBe(true);
    fixture.execute("UPDATE eligible_factories SET province_name = 'กรุงเทพมหานคร' WHERE id = 10");
    expect(await badge(provincial)).toBe(false);
  });

  it('isolates operator factories and immediately respects revoked access and deleted factories', async () => {
    const { ticket } = await openTicket(officer);
    expect(await badge({ ...operator, actorUserId: 103 })).toBe(false);
    expect(await badge(operator)).toBe(true);
    fixture.execute("UPDATE user_factory_access SET revoked_at = '2026-10-18' WHERE user_id = 101");
    expect(await badge(operator)).toBe(false);
    await chatRepository.sendMessage(
      operatorWithCoworker(),
      ticket.id,
      'ถามต่อ',
      'coworker-question',
    );
    expect(await badge(officer)).toBe(true);
    fixture.execute("UPDATE eligible_factories SET deleted_at = '2026-10-18' WHERE id = 10");
    expect(await badge(officer)).toBe(false);
  });

  it('denies unsupported personas and missing roles even with ALL scope', async () => {
    await openTicket();
    expect(await badge({ ...officer, roles: [] })).toBe(false);
    expect(await badge({ ...officer, userType: 'citizen' })).toBe(false);
  });
});

function operatorWithCoworker(): ChatAccess {
  return { ...operator, actorUserId: 102, answerScope: { scope: 'OWN_FACTORY' } };
}
