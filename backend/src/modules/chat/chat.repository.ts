import { createHash } from 'node:crypto';
import type { Knex } from 'knex';
import { db } from '../../config/database';
import { AppError, BadRequestError, NotFoundError } from '../../shared/errors/AppError';
import { factoryProfileReadTable } from '../factory-profiles/factory-profile-mode';
import {
  applyChatFactoryAccess,
  findChatFactory,
  findChatMeasurementPoint,
} from './chat-factories.repository';
import { CHAT_TOPICS } from './chat.types';
import { requireChatWrite } from './chat.access';
import type {
  ChatAccess,
  ChatActor,
  ChatEvent,
  ChatMessage,
  ChatMessagePage,
  ChatMessageQuery,
  ChatPage,
  ChatTicketDetail,
  ChatTicketQuery,
  ChatTicketSummary,
  CreateChatResult,
  CreateChatTicket,
  SendChatResult,
} from './chat.types';

type Executor = Knex | Knex.Transaction;
type Row = Record<string, unknown>;
const PERSONA_LABELS = {
  operator: 'ผู้ประกอบการ',
  officer: 'เจ้าหน้าที่',
  admin: 'ผู้ดูแลระบบ',
  citizen: 'ประชาชน',
};

async function getActor(access: ChatAccess, executor: Executor = db): Promise<ChatActor> {
  const user = await executor('users')
    .where('id', access.actorUserId)
    .where('is_active', true)
    .whereNull('deleted_at')
    .first('id', 'first_name', 'last_name');
  if (!user) throw new NotFoundError('ไม่พบบัญชีผู้ใช้งาน');
  return {
    userId: Number(user.id),
    name:
      [user.first_name, user.last_name].filter(Boolean).join(' ').trim() || `ผู้ใช้งาน ${user.id}`,
    roleCode: access.roles[0] ?? access.userType,
    roleLabel: PERSONA_LABELS[access.userType],
  };
}

function iso(value: unknown): string {
  return value instanceof Date ? value.toISOString() : new Date(String(value)).toISOString();
}
function actorFrom(row: Row, prefix: string, idColumn = `${prefix}_id`): ChatActor {
  return {
    userId: Number(row[idColumn]),
    name: String(row[`${prefix}_name`]),
    roleCode: String(row[`${prefix}_role_code`]),
    roleLabel: String(row[`${prefix}_role_label`]),
  };
}
function actorValues(actor: ChatActor, prefix: string, idColumn = `${prefix}_id`): Row {
  return {
    [idColumn]: actor.userId,
    [`${prefix}_name`]: actor.name,
    [`${prefix}_role_code`]: actor.roleCode,
    [`${prefix}_role_label`]: actor.roleLabel,
  };
}
function messageFrom(row: Row): ChatMessage {
  return {
    id: Number(row.id),
    ticketId: Number(row.ticket_id),
    text: String(row.body),
    sender: actorFrom(row, 'sender'),
    createdAt: iso(row.created_at),
  };
}
function summaryFrom(row: Row, canWrite: boolean): ChatTicketSummary {
  const status = row.status as 'open' | 'closed';
  const pointId = row.eligible_point_id ?? row.connected_point_id;
  return {
    id: Number(row.id),
    ticketNo: String(row.ticket_no),
    topic: {
      code: row.topic_code as ChatTicketSummary['topic']['code'],
      label: String(row.topic_label),
    },
    factory: {
      id: Number(row.eligible_factory_id),
      name: String(row.factory_name),
      registrationNo: String(row.factory_registration_no),
      provinceName: String(row.province_name),
      regionName: row.region_name == null ? null : String(row.region_name),
    },
    measurementPoint:
      pointId == null
        ? null
        : {
            id: Number(pointId),
            kind: row.eligible_point_id != null ? 'eligible' : 'connected',
            systemType: row.point_system_type as 'CEMS' | 'WPMS',
            pointCode: row.point_code == null ? null : String(row.point_code),
            pointName: String(row.point_name),
          },
    status,
    openedBy: actorFrom(row, 'opened_by', 'opened_by'),
    openedAt: iso(row.opened_at),
    closedBy: row.closed_by == null ? null : actorFrom(row, 'closed_by', 'closed_by'),
    closedAt: row.closed_at == null ? null : iso(row.closed_at),
    lastMessageAt: iso(row.last_message_at),
    capabilities: {
      canReply: status === 'open' && canWrite,
      canClose: status === 'open' && canWrite,
    },
  };
}
function ticketQuery(access: ChatAccess, executor: Executor): Knex.QueryBuilder {
  return applyChatFactoryAccess(
    executor('chat_tickets as ct')
      .join(factoryProfileReadTable('eligible_factories', 'ef'), 'ef.id', 'ct.eligible_factory_id')
      .leftJoin('provinces as p', 'p.name_th', 'ef.province_name')
      .whereNull('ef.deleted_at'),
    access,
  );
}

// Reuse current factory access filters for action scopes as well as visibility.
// A single query resolves capabilities for a whole page without trusting ticket snapshots.
async function writableTicketIds(
  access: ChatAccess,
  ids: number[],
  executor: Executor,
): Promise<Set<number>> {
  if (!access.canWrite || ids.length === 0) return new Set();
  const rows = (await ticketQuery(access, executor)
    .whereIn('ct.id', ids)
    .where(function actionAccess() {
      this.where(function answerAccess() {
        // ALL intentionally adds no factory predicates; retain a true branch
        // so Knex cannot discard it as an empty WHERE group.
        this.whereRaw('1 = 1');
        applyChatFactoryAccess(this, { ...access, factoryScope: access.answerScope });
      }).orWhere(function requesterAccess() {
        this.where('ct.opened_by', access.actorUserId);
        applyChatFactoryAccess(this, { ...access, factoryScope: access.createScope });
      });
    })
    .select('ct.id')) as Array<{ id: number | string }>;
  return new Set(rows.map((row) => Number(row.id)));
}
async function readTicket(
  access: ChatAccess,
  id: number,
  executor: Executor,
): Promise<ChatTicketDetail | null> {
  const row = (await ticketQuery(access, executor).where('ct.id', id).select('ct.*').first()) as
    | Row
    | undefined;
  if (!row) return null;
  const writable =
    row.status === 'open' && (await writableTicketIds(access, [id], executor)).has(id);
  const events = (await executor('chat_ticket_events')
    .where('ticket_id', id)
    .orderBy('id', 'asc')) as Row[];
  return {
    ...summaryFrom(row, writable),
    events: events.map(
      (event): ChatEvent => ({
        id: Number(event.id),
        type: event.event_type as ChatEvent['type'],
        actor: actorFrom(event, 'actor'),
        createdAt: iso(event.created_at),
      }),
    ),
  };
}
async function listTickets(
  access: ChatAccess,
  query: ChatTicketQuery,
): Promise<ChatPage<ChatTicketSummary>> {
  const builder = ticketQuery(access, db);
  if (query.status) builder.where('ct.status', query.status);
  if (query.topicCode) builder.where('ct.topic_code', query.topicCode);
  if (query.eligibleFactoryId) builder.where('ct.eligible_factory_id', query.eligibleFactoryId);
  if (query.regionName) builder.where('ct.region_name', query.regionName);
  if (query.provinceName) builder.where('ct.province_name', query.provinceName);
  if (query.from) builder.where('ct.last_message_at', '>=', new Date(query.from));
  if (query.to) builder.where('ct.last_message_at', '<=', new Date(query.to));
  if (query.q) {
    const needle = `%${query.q.replace(/[\\%_\[]/g, '\\$&')}%`;
    builder.where(function searchTicket() {
      for (const column of [
        'ct.ticket_no',
        'ct.topic_label',
        'ct.factory_name',
        'ct.factory_registration_no',
        'ct.province_name',
        'ct.region_name',
      ]) {
        this.orWhereRaw("?? LIKE ? ESCAPE '\\'", [column, needle]);
      }
    });
  }
  const count = await builder.clone().count('ct.id as total').first();
  const total = Number(count?.total ?? 0);
  const sortColumns: Record<ChatTicketQuery['sort'], string> = {
    lastMessageAt: 'ct.last_message_at',
    ticketNo: 'ct.ticket_no',
    topic: 'ct.topic_label',
    factoryName: 'ct.factory_name',
    registrationNo: 'ct.factory_registration_no',
    regionName: 'ct.region_name',
    provinceName: 'ct.province_name',
    status: 'ct.status',
  };
  const rows = (await builder
    .select('ct.*')
    .orderBy(sortColumns[query.sort], query.order)
    .orderBy('ct.id', query.order)
    .offset((query.page - 1) * query.pageSize)
    .limit(query.pageSize)) as Row[];
  const writable = await writableTicketIds(
    access,
    rows.filter((row) => row.status === 'open').map((row) => Number(row.id)),
    db,
  );
  return {
    data: rows.map((row) => summaryFrom(row, writable.has(Number(row.id)))),
    pagination: {
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.ceil(total / query.pageSize),
    },
  };
}
async function getTicket(access: ChatAccess, id: number): Promise<ChatTicketDetail | null> {
  return chatTransaction(async (trx) => {
    // Keep ticket state and lifecycle events in one coherent response, using the same lock as writers.
    await trx('chat_tickets')
      .from(trx.raw('chat_tickets WITH (UPDLOCK, HOLDLOCK)'))
      .where('id', id)
      .select('id')
      .first();
    return readTicket(access, id, trx);
  });
}
async function getMessages(
  access: ChatAccess,
  id: number,
  query: ChatMessageQuery,
): Promise<ChatMessagePage> {
  return chatTransaction(async (trx) => {
    await lockAccessibleTicket(access, id, trx);
    const ticket = await readTicket(access, id, trx);
    if (!ticket) throw new NotFoundError('ไม่พบเรื่องติดต่อ');
    if (query.olderCursor && query.afterMessageId !== undefined)
      throw new BadRequestError('ระบุทิศทางการโหลดข้อความได้ครั้งละหนึ่งทิศทาง');
    const forward = query.afterMessageId !== undefined;
    const builder = trx('chat_messages').where('ticket_id', id);
    if (query.afterMessageId !== undefined) builder.where('id', '>', query.afterMessageId);
    if (query.olderCursor) {
      let cursor: { v?: unknown; ticketId?: unknown; beforeId?: unknown };
      try {
        if (query.olderCursor.length > 512 || !/^[A-Za-z0-9_-]+$/.test(query.olderCursor))
          throw new Error('Invalid cursor');
        cursor = JSON.parse(
          Buffer.from(query.olderCursor, 'base64url').toString('utf8'),
        ) as typeof cursor;
        if (
          !cursor ||
          cursor.v !== 1 ||
          cursor.ticketId !== id ||
          !Number.isSafeInteger(cursor.beforeId) ||
          Number(cursor.beforeId) <= 0
        )
          throw new Error('Invalid cursor');
      } catch {
        throw new BadRequestError('Cursor ไม่ถูกต้องหรือเป็นของเรื่องติดต่ออื่น');
      }
      builder.where('id', '<', Number(cursor.beforeId));
    }
    const rows = (await builder
      .orderBy('id', forward ? 'asc' : 'desc')
      .limit(query.limit + 1)) as Row[];
    const hasMore = rows.length > query.limit;
    const page = rows.slice(0, query.limit);
    if (!forward) page.reverse();
    const messages = page.map(messageFrom);
    return {
      ticket,
      messages,
      pagination: {
        olderCursor:
          !forward && hasMore
            ? Buffer.from(
                JSON.stringify({ v: 1, ticketId: id, beforeId: messages[0].id }),
              ).toString('base64url')
            : null,
        nextAfterMessageId: forward && hasMore ? messages[messages.length - 1].id : null,
        hasMore,
      },
    };
  });
}
function fingerprint(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

async function chatTransaction<T>(work: (trx: Knex.Transaction) => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await db.transaction(work, { isolationLevel: 'serializable' });
    } catch (error) {
      const sqlError = error as { number?: number; originalError?: { info?: { number?: number } } };
      const number = sqlError?.number ?? sqlError?.originalError?.info?.number;
      // SQL Server rolls back a deadlock victim before surfacing 1205; replay the whole atomic operation.
      if (number !== 1205 || attempt >= 2) throw error;
    }
  }
}

async function createTicket(
  access: ChatAccess,
  input: CreateChatTicket,
  idempotencyKey: string,
): Promise<CreateChatResult> {
  requireChatWrite(access, true);
  const requestHash = fingerprint([
    input.eligibleFactoryId,
    input.measurementPoint ? [input.measurementPoint.kind, input.measurementPoint.id] : null,
    input.topicCode,
    input.message,
  ]);
  return chatTransaction(async (trx) => {
    const existing = (await trx('chat_tickets')
      .from(trx.raw('chat_tickets WITH (UPDLOCK, HOLDLOCK)'))
      .where({ opened_by: access.actorUserId, creation_key: idempotencyKey })
      .first()) as Row | undefined;
    const factory = await findChatFactory(
      access,
      existing ? Number(existing.eligible_factory_id) : input.eligibleFactoryId,
      trx,
    );
    if (!factory) throw new NotFoundError('ไม่พบโรงงานที่มีสิทธิ์ติดต่อ');
    if (!(await findChatFactory({ ...access, factoryScope: access.createScope }, factory.id, trx)))
      throw new NotFoundError('ไม่พบโรงงานที่มีสิทธิ์เปิดเรื่อง');
    if (existing) {
      if (existing.creation_hash !== requestHash) {
        throw new AppError(
          'Idempotency-Key ถูกใช้กับข้อมูลอื่นแล้ว',
          409,
          'IDEMPOTENCY_KEY_CONFLICT',
        );
      }
      const ticket = await readTicket(access, Number(existing.id), trx);
      if (!ticket) throw new NotFoundError('ไม่พบเรื่องติดต่อ');
      const firstMessage = (await trx('chat_messages')
        .where('ticket_id', Number(existing.id))
        .orderBy('id', 'asc')
        .first()) as Row;
      return { ticket, firstMessage: messageFrom(firstMessage), replayed: true };
    }
    const point = input.measurementPoint
      ? await findChatMeasurementPoint(access, factory.id, input.measurementPoint, trx)
      : null;
    if (input.measurementPoint && !point) throw new NotFoundError('ไม่พบจุดตรวจวัดของโรงงาน');
    const actor = await getActor(access, trx);
    const now = new Date();
    const year =
      Number(
        new Intl.DateTimeFormat('en-US', { year: 'numeric', timeZone: 'Asia/Bangkok' }).format(now),
      ) + 543;
    const sequence = await trx('chat_ticket_sequences')
      .from(trx.raw('chat_ticket_sequences WITH (UPDLOCK, HOLDLOCK)'))
      .where('year', year)
      .first();
    const nextNumber = Number(sequence?.last_number ?? 0) + 1;
    if (nextNumber > 99999)
      throw new AppError('เลขเรื่องติดต่อของปีนี้เต็มแล้ว', 409, 'CHAT_TICKET_NUMBER_EXHAUSTED');
    if (sequence)
      await trx('chat_ticket_sequences').where('year', year).update({ last_number: nextNumber });
    else await trx('chat_ticket_sequences').insert({ year, last_number: nextNumber });
    const topic = CHAT_TOPICS.find((candidate) => candidate.code === input.topicCode);
    if (!topic) throw new BadRequestError('หัวข้อเรื่องติดต่อไม่ถูกต้อง');
    const [inserted] = await trx('chat_tickets')
      .insert({
        ticket_no: `TK-${String(year).slice(-2)}-${String(nextNumber).padStart(5, '0')}`,
        eligible_factory_id: factory.id,
        eligible_point_id: point?.kind === 'eligible' ? point.id : null,
        connected_point_id: point?.kind === 'connected' ? point.id : null,
        topic_code: topic.code,
        topic_label: topic.label,
        factory_name: factory.name,
        factory_registration_no: factory.registrationNo,
        province_name: factory.provinceName,
        region_name: factory.regionName,
        point_system_type: point?.systemType ?? null,
        point_code: point?.pointCode ?? null,
        point_name: point?.pointName ?? null,
        status: 'open',
        ...actorValues(actor, 'opened_by', 'opened_by'),
        opened_at: now,
        closed_by: null,
        closed_by_name: null,
        closed_by_role_code: null,
        closed_by_role_label: null,
        closed_at: null,
        last_message_at: now,
        creation_key: idempotencyKey,
        creation_hash: requestHash,
      })
      .returning('id');
    const id = Number(inserted.id);
    const [message] = await trx('chat_messages')
      .insert({
        ticket_id: id,
        body: input.message,
        ...actorValues(actor, 'sender'),
        created_at: now,
        idempotency_key: null,
        request_hash: null,
      })
      .returning('*');
    await trx('chat_ticket_events').insert({
      ticket_id: id,
      event_type: 'opened',
      ...actorValues(actor, 'actor'),
      created_at: now,
    });
    const ticket = await readTicket(access, id, trx);
    if (!ticket) throw new NotFoundError('ไม่พบเรื่องติดต่อ');
    return { ticket, firstMessage: messageFrom(message), replayed: false };
  });
}

async function lockAccessibleTicket(
  access: ChatAccess,
  id: number,
  trx: Knex.Transaction,
): Promise<Row> {
  const ticket = (await trx('chat_tickets')
    .from(trx.raw('chat_tickets WITH (UPDLOCK, HOLDLOCK)'))
    .where('id', id)
    .first()) as Row | undefined;
  if (!ticket || !(await findChatFactory(access, Number(ticket.eligible_factory_id), trx))) {
    throw new NotFoundError('ไม่พบเรื่องติดต่อ');
  }
  return ticket;
}

async function requireTicketWrite(access: ChatAccess, id: number, trx: Knex.Transaction) {
  if (!(await writableTicketIds(access, [id], trx)).has(id))
    throw new NotFoundError('ไม่พบเรื่องติดต่อที่มีสิทธิ์ดำเนินการ');
}

async function sendMessage(
  access: ChatAccess,
  id: number,
  text: string,
  idempotencyKey: string,
): Promise<SendChatResult> {
  requireChatWrite(access);
  return chatTransaction(async (trx) => {
    const current = await lockAccessibleTicket(access, id, trx);
    await requireTicketWrite(access, id, trx);
    const hash = fingerprint({ text });
    const existing = (await trx('chat_messages')
      .where({ ticket_id: id, sender_id: access.actorUserId, idempotency_key: idempotencyKey })
      .first()) as Row | undefined;
    if (existing) {
      if (existing.request_hash !== hash)
        throw new AppError(
          'Idempotency-Key ถูกใช้กับข้อมูลอื่นแล้ว',
          409,
          'IDEMPOTENCY_KEY_CONFLICT',
        );
      const ticket = await readTicket(access, id, trx);
      if (!ticket) throw new NotFoundError('ไม่พบเรื่องติดต่อ');
      return { ticket, message: messageFrom(existing), replayed: true };
    }
    if (current.status !== 'open')
      throw new AppError('เรื่องติดต่อนี้ปิดแล้ว', 409, 'CHAT_TICKET_CLOSED');
    const actor = await getActor(access, trx);
    const now = new Date();
    const [message] = await trx('chat_messages')
      .insert({
        ticket_id: id,
        body: text,
        ...actorValues(actor, 'sender'),
        created_at: now,
        idempotency_key: idempotencyKey,
        request_hash: hash,
      })
      .returning('*');
    await trx('chat_tickets').where('id', id).update({ last_message_at: now });
    const ticket = await readTicket(access, id, trx);
    if (!ticket) throw new NotFoundError('ไม่พบเรื่องติดต่อ');
    return { ticket, message: messageFrom(message), replayed: false };
  });
}

async function closeTicket(access: ChatAccess, id: number): Promise<ChatTicketDetail> {
  requireChatWrite(access);
  return chatTransaction(async (trx) => {
    const current = await lockAccessibleTicket(access, id, trx);
    await requireTicketWrite(access, id, trx);
    if (current.status === 'open') {
      const actor = await getActor(access, trx);
      const now = new Date();
      await trx('chat_tickets')
        .where('id', id)
        .update({
          status: 'closed',
          ...actorValues(actor, 'closed_by', 'closed_by'),
          closed_at: now,
        });
      await trx('chat_ticket_events').insert({
        ticket_id: id,
        event_type: 'closed',
        ...actorValues(actor, 'actor'),
        created_at: now,
      });
    }
    const ticket = await readTicket(access, id, trx);
    if (!ticket) throw new NotFoundError('ไม่พบเรื่องติดต่อ');
    return ticket;
  });
}

export const chatRepository = {
  getActor,
  createTicket,
  getTicket,
  listTickets,
  getMessages,
  sendMessage,
  closeTicket,
};
