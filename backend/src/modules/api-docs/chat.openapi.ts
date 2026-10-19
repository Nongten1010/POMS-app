import { CHAT_TOPICS } from '../chat/chat.types';

type OpenApiObject = Record<string, unknown>;
const ref = (name: string): OpenApiObject => ({ $ref: `#/components/schemas/${name}` });
const object = (
  properties: Record<string, OpenApiObject>,
  required = Object.keys(properties),
): OpenApiObject => ({ type: 'object', additionalProperties: false, required, properties });
const positiveId = { type: 'integer', minimum: 1, maximum: 2147483647 };
const timestamp = { type: 'string', format: 'date-time', description: 'เวลา UTC รูปแบบ ISO 8601' };
const messageText = {
  type: 'string',
  minLength: 1,
  maxLength: 2000,
  description:
    'ข้อความ plain text; trim ก่อนบันทึก ห้ามมีแต่ช่องว่าง; แสดงเป็น text ไม่ประมวลผล HTML',
};
const envelope = (data: OpenApiObject): OpenApiObject =>
  object({ success: { type: 'boolean', enum: [true] }, data });
const response = (description: string, schema: OpenApiObject): OpenApiObject => ({
  description,
  content: { 'application/json': { schema } },
});
const errors: Record<string, OpenApiObject> = {
  '400': response(
    'VALIDATION_ERROR: รูปแบบข้อมูลไม่ถูกต้อง; BAD_REQUEST: JSON ผิดรูปแบบ, cursor ถอดรหัสไม่ได้หรือเป็นของ Ticket อื่น',
    ref('ErrorEnvelope'),
  ),
  '401': { $ref: '#/components/responses/Unauthorized' },
  '403': response('FORBIDDEN: ไม่มีสิทธิ์ดำเนินการ', ref('ErrorEnvelope')),
  '404': response('NOT_FOUND: ไม่พบรายการหรือรายการอยู่นอกขอบเขต', ref('ErrorEnvelope')),
  '413': response('PAYLOAD_TOO_LARGE: request body เกิน 1 MB', ref('ErrorEnvelope')),
  '429': {
    description: 'เกิน global rate limit ของระบบ; รอตาม Retry-After ก่อนลองใหม่',
    headers: { 'Retry-After': { schema: { type: 'integer', minimum: 1 } } },
    content: {
      'text/html': {
        schema: { type: 'string' },
        example: 'Too many requests, please try again later.',
      },
    },
  },
  '500': response('INTERNAL_ERROR: ระบบประมวลผลไม่สำเร็จ', ref('ErrorEnvelope')),
};
const security = [{ bearerAuth: [] }];
const idParameter = { name: 'id', in: 'path', required: true, schema: positiveId };
const query = (name: string, schema: OpenApiObject, description: string): OpenApiObject => ({
  name,
  in: 'query',
  required: false,
  schema,
  description,
});
const pageParameters = [
  query('page', { type: 'integer', minimum: 1, maximum: 1000000, default: 1 }, 'หน้ารายการ'),
  query('pageSize', { type: 'integer', enum: [25, 50, 100], default: 25 }, 'จำนวนรายการต่อหน้า'),
  query('q', { type: 'string', minLength: 1, maxLength: 200 }, 'ข้อความค้นหา; trim ก่อนใช้'),
];
const idempotencyKey = {
  name: 'Idempotency-Key',
  in: 'header',
  required: true,
  description:
    'UUID ต่อการกระทำหนึ่งครั้ง; normalize เป็นตัวพิมพ์เล็ก; retry payload เดิมต้องใช้ key เดิม',
  schema: { type: 'string', format: 'uuid' },
  example: '7c66b2a3-0b21-4eba-b5e8-2fe377bccb01',
};
const actorFields = {
  userId: positiveId,
  name: {
    type: 'string',
    maxLength: 512,
    description: 'ชื่อแสดง; ข้อความ/เหตุการณ์เก็บ snapshot ณ เวลาทำรายการ',
  },
  roleCode: { type: 'string', maxLength: 64 },
  roleLabel: { type: 'string', maxLength: 128 },
};
const pointReferenceFields = {
  kind: { type: 'string', enum: ['eligible', 'connected'] },
  id: positiveId,
};
const pointFields = {
  ...pointReferenceFields,
  systemType: { type: 'string', enum: ['CEMS', 'WPMS'] },
  pointCode: { type: 'string', maxLength: 100, nullable: true },
  pointName: { type: 'string', maxLength: 255 },
};
const ticketFields = {
  id: positiveId,
  ticketNo: {
    type: 'string',
    pattern: '^TK-[0-9]{2}-[0-9]{5}$',
    example: 'TK-69-00001',
    description: 'ปี พ.ศ. 2 หลักจาก Asia/Bangkok; running 00001–99999 เริ่มใหม่ทุกปี',
  },
  topic: ref('ChatTopic'),
  factory: ref('ChatFactory'),
  measurementPoint: {
    ...object(pointFields),
    nullable: true,
    description: 'snapshot จุดที่เลือก; null=เรื่องระดับโรงงาน ไม่ใช่ทุกจุด',
  },
  status: { type: 'string', enum: ['open', 'closed'] },
  openedBy: ref('ChatActor'),
  openedAt: timestamp,
  closedBy: { ...object(actorFields), nullable: true },
  closedAt: { ...timestamp, nullable: true },
  lastMessageAt: { ...timestamp, description: 'เวลาข้อความล่าสุด; การปิด Ticket ไม่เปลี่ยนค่านี้' },
  lastMessageSenderType: {
    type: 'string',
    enum: ['operator', 'officer'],
    description:
      'ฝ่ายผู้ส่งข้อความล่าสุด: operator=ผู้ประกอบการ, officer=เจ้าหน้าที่หรือผู้ดูแลระบบ; ใช้ persona snapshot ของข้อความที่มี id สูงสุดใน Ticket ไม่ขึ้นกับบทบาทปัจจุบัน ผู้เปิดหรือผู้ปิดเรื่อง; ปิด Ticket ไม่เปลี่ยนค่านี้',
  },
  capabilities: object({
    canReply: {
      type: 'boolean',
      description:
        'Ticket ยัง open และอยู่ใน chat:view scope พร้อม chat:answer scope หรือเป็นผู้เปิดเรื่องเองภายใน chat:ask scope; มีเพียง chat:view เป็น false',
    },
    canClose: {
      type: 'boolean',
      description: 'ใช้สิทธิ์และขอบเขตเดียวกับ canReply; Ticket ที่ปิดแล้วเป็น false',
    },
  }),
};
const exampleActor = {
  userId: 101,
  name: 'ผู้ประกอบการตัวอย่าง',
  roleCode: 'factory_operator',
  roleLabel: 'ผู้ประกอบการ',
};
const exampleFactory = {
  id: 10,
  name: 'โรงงานตัวอย่าง',
  registrationNo: 'EXAMPLE-001',
  provinceName: 'ระยอง',
  regionName: 'ภาคตะวันออก',
};
const exampleOpenedEvent = {
  id: 1,
  type: 'opened',
  actor: exampleActor,
  createdAt: '2026-10-17T03:00:00.000Z',
};
const exampleTicket = {
  id: 1,
  ticketNo: 'TK-69-00001',
  topic: { code: 'other', label: 'อื่นๆ' },
  factory: exampleFactory,
  measurementPoint: null,
  status: 'open',
  openedBy: exampleActor,
  openedAt: '2026-10-17T03:00:00.000Z',
  closedBy: null,
  closedAt: null,
  lastMessageAt: '2026-10-17T03:00:00.000Z',
  lastMessageSenderType: 'operator',
  capabilities: { canReply: true, canClose: true },
};
const exampleDetail = { ...exampleTicket, events: [exampleOpenedEvent] };
const exampleMessage = {
  id: 1,
  ticketId: 1,
  text: 'ต้องการสอบถามขั้นตอนการใช้งาน',
  sender: exampleActor,
  createdAt: '2026-10-17T03:00:00.000Z',
};
const examplePagination = { page: 1, pageSize: 25, total: 1, totalPages: 1 };
const exampleClosed = {
  ...exampleDetail,
  status: 'closed',
  closedBy: exampleActor,
  closedAt: '2026-10-17T03:10:00.000Z',
  capabilities: { canReply: false, canClose: false },
  events: [
    exampleOpenedEvent,
    { id: 2, type: 'closed', actor: exampleActor, createdAt: '2026-10-17T03:10:00.000Z' },
  ],
};
const writePermissions = {
  allOf: ['chat:view'],
  anyOf: ['chat:ask', 'chat:answer'],
  requesterOnly: ['chat:ask'],
};
const writeRateLimit = {
  description:
    'เกิน 30 write requests/นาทีต่อบัญชีใน process หรือ global 300 requests/15 นาทีต่อ IP; รอตาม Retry-After',
  headers: { 'Retry-After': { schema: { type: 'integer', minimum: 1 } } },
  content: {
    'application/json': {
      schema: ref('ErrorEnvelope'),
      example: {
        success: false,
        error: { code: 'RATE_LIMIT_EXCEEDED', message: 'Too many chat write requests' },
      },
    },
    'text/html': {
      schema: { type: 'string' },
      example: 'Too many requests, please try again later.',
    },
  },
};
const accessDescription = [
  'resource โรงงาน/Ticket ต้องมี chat:view และอยู่ในขอบเขตปัจจุบันของ chat:view เอง ไม่ใช้ eligible_factories:view; operator ต้องมีความสัมพันธ์โรงงานที่ยังมีสิทธิ์ด้วย แม้ตั้ง scope เป็น ALL; scope ไม่ครบหรือใช้ไม่ได้ทำให้รายการว่างหรือ resource 404',
  'operator/OWN_FACTORY ต้องระบุตัวตนโรงงานได้เพียงหนึ่ง master โดยนับรวม master ที่ถูกลบด้วย แล้วจึงตรวจ active master และความสัมพันธ์ปัจจุบัน; เลขทะเบียนที่นำมาใช้ใหม่หรือ source/registration ที่กำกวมถูกปฏิเสธจนแก้ข้อมูล',
  'ตรวจบัญชี สิทธิ์และขอบเขตจาก server ทุก request; admin ไม่ข้ามสิทธิ์; ไม่รับ actor, role หรือ scope จาก client',
  'เปิด Ticket ได้เมื่อ userType=operator/officer/admin มี chat:view และ chat:ask และโรงงานอยู่ใน scope ของทั้งสอง action; citizen หรือ persona อื่นเปิดไม่ได้; ขาดสิทธิ์ action ตอบ 403 FORBIDDEN ส่วน resource นอก view/action scope ตอบ 404 NOT_FOUND รวมการส่งซ้ำ',
  'ส่งข้อความและปิด Ticket ต้องมี chat:view ร่วมกับ chat:answer ภายใน scope ของ action นั้น หรือ chat:ask ภายใน scope ของ action นั้นและเป็นผู้เปิด Ticket เอง; ผู้มีเพียง chat:view อ่านได้อย่างเดียวและเขียนตอบ 403; มี action แต่ Ticket นอก scope หรือมีเพียง chat:ask กับเรื่องของผู้อื่นตอบ 404; capabilities คำนวณราย Ticket จากสิทธิ์ พื้นที่โรงงานปัจจุบัน ผู้เปิดเรื่อง และสถานะ open; Ticket ที่ปิดแล้วเป็น false',
  'citizen ที่มี chat:view อ่าน options ได้ แต่ canCreate=false และรายการ resource ว่าง; การเข้าถึงโรงงาน/Ticket เฉพาะรายการตอบ 404',
  'หน้า Permission Management รับ chat.view, chat.ask, chat.edit พร้อม data/region/province; edit map เป็น raw chat:answer เพื่อคง compatibility; data เป็นขอบเขต Chat อิสระ รองรับ ALL, IN_REGION, IN_PROVINCE และ scope อื่นตาม permission contract; runtime auth response ยังคืน compatibility answer แต่ grouped request ใช้ edit',
  'เป็น Ticket แบบ asynchronous โหลดเมื่อเข้าหน้าและกดรีเฟรช ไม่มี polling หรือ WebSocket',
  'ผลตอบกลับหลัง authentication ใช้ Cache-Control: private, no-store; query/body ที่ไม่อยู่ใน contract ถูกปฏิเสธเมื่อ endpoint รับข้อมูลชนิดนั้น',
  'Canonical docs: docs/backend/api/menus/chat/README.md',
].join('\n\n');

export const chatSchemas: Record<string, OpenApiObject> = {
  ChatTopicCode: {
    type: 'string',
    enum: CHAT_TOPICS.map((topic) => topic.code),
    'x-enum-labels': Object.fromEntries(CHAT_TOPICS.map((topic) => [topic.code, topic.label])),
  },
  ChatTopic: object({ code: ref('ChatTopicCode'), label: { type: 'string', maxLength: 128 } }),
  ChatActor: object(actorFields),
  ChatOptions: object({
    viewer: ref('ChatActor'),
    topics: { type: 'array', items: ref('ChatTopic') },
    limits: object({ messageMaxLength: { type: 'integer', enum: [2000] } }),
    canCreate: {
      type: 'boolean',
      description:
        'true เมื่อ userType=operator/officer/admin มี chat:view และ chat:ask พร้อม scope ที่ใช้ได้ทั้งสอง action; citizen หรือ persona อื่นเป็น false; โรงงานที่เลือกยังต้องผ่านขอบเขตของทั้งสอง action ตอนสร้าง',
    },
  }),
  ChatOptionsResponse: {
    ...envelope(ref('ChatOptions')),
    example: {
      success: true,
      data: {
        viewer: exampleActor,
        topics: CHAT_TOPICS,
        limits: { messageMaxLength: 2000 },
        canCreate: true,
      },
    },
  },
  ChatFactory: {
    ...object({
      id: positiveId,
      name: { type: 'string', maxLength: 500 },
      registrationNo: { type: 'string', maxLength: 100 },
      provinceName: { type: 'string', maxLength: 128 },
      regionName: { type: 'string', maxLength: 100, nullable: true },
    }),
    example: exampleFactory,
  },
  ChatPointReference: object(pointReferenceFields),
  ChatMeasurementPoint: object(pointFields),
  ChatMessage: {
    ...object({
      id: positiveId,
      ticketId: positiveId,
      text: messageText,
      sender: ref('ChatActor'),
      createdAt: timestamp,
    }),
    example: exampleMessage,
  },
  ChatEvent: object({
    id: positiveId,
    type: { type: 'string', enum: ['opened', 'closed'] },
    actor: ref('ChatActor'),
    createdAt: timestamp,
  }),
  ChatTicketSummary: { ...object(ticketFields), example: exampleTicket },
  ChatTicketDetail: {
    ...object({ ...ticketFields, events: { type: 'array', items: ref('ChatEvent') } }),
    example: exampleDetail,
  },
  ChatCreateTicket: {
    ...object(
      {
        eligibleFactoryId: positiveId,
        measurementPoint: { ...object(pointReferenceFields), nullable: true, default: null },
        topicCode: ref('ChatTopicCode'),
        message: messageText,
      },
      ['eligibleFactoryId', 'topicCode', 'message'],
    ),
    example: {
      eligibleFactoryId: 10,
      measurementPoint: null,
      topicCode: 'other',
      message: 'ต้องการสอบถามขั้นตอนการใช้งาน',
    },
  },
  ChatCreateResult: {
    ...object({
      ticket: ref('ChatTicketDetail'),
      firstMessage: ref('ChatMessage'),
      replayed: { type: 'boolean' },
    }),
    example: { ticket: exampleDetail, firstMessage: exampleMessage, replayed: false },
  },
  ChatCreateResponse: envelope(ref('ChatCreateResult')),
  ChatPagination: object({
    page: { type: 'integer', minimum: 1 },
    pageSize: { type: 'integer', enum: [25, 50, 100] },
    total: { type: 'integer', minimum: 0 },
    totalPages: { type: 'integer', minimum: 0 },
  }),
  ChatFactoryPage: {
    ...object({
      success: { type: 'boolean', enum: [true] },
      data: { type: 'array', items: ref('ChatFactory') },
      pagination: ref('ChatPagination'),
    }),
    example: { success: true, data: [exampleFactory], pagination: examplePagination },
  },
  ChatMeasurementPointsResponse: {
    ...envelope({ type: 'array', items: ref('ChatMeasurementPoint') }),
    example: {
      success: true,
      data: [
        {
          kind: 'eligible',
          id: 501,
          systemType: 'CEMS',
          pointCode: null,
          pointName: 'ปล่องตัวอย่าง',
        },
      ],
    },
  },
  ChatTicketPage: {
    ...object({
      success: { type: 'boolean', enum: [true] },
      data: { type: 'array', items: ref('ChatTicketSummary') },
      pagination: ref('ChatPagination'),
    }),
    example: { success: true, data: [exampleTicket], pagination: examplePagination },
  },
  ChatTicketResponse: {
    ...envelope(ref('ChatTicketDetail')),
    example: { success: true, data: exampleDetail },
  },
  ChatMessagePage: object({
    ticket: ref('ChatTicketDetail'),
    messages: { type: 'array', items: ref('ChatMessage') },
    pagination: object({
      olderCursor: {
        type: 'string',
        nullable: true,
        description: 'cursor สำหรับข้อความเก่าต่อ หรือ null เมื่อไม่มี',
      },
      nextAfterMessageId: {
        ...positiveId,
        nullable: true,
        description: 'ID สำหรับต่อ batch ข้อความใหม่ใน afterMessageId mode หรือ null',
      },
      hasMore: { type: 'boolean', description: 'มีข้อความต่อในทิศทางที่ร้องขอ' },
    }),
  }),
  ChatMessagePageResponse: {
    ...envelope(ref('ChatMessagePage')),
    example: {
      success: true,
      data: {
        ticket: exampleDetail,
        messages: [exampleMessage],
        pagination: { olderCursor: null, nextAfterMessageId: null, hasMore: false },
      },
    },
  },
  ChatSendMessage: {
    ...object({ message: messageText }),
    example: { message: 'ขอข้อมูลเพิ่มเติมเกี่ยวกับขั้นตอนนี้' },
  },
  ChatSendResult: object({
    ticket: ref('ChatTicketDetail'),
    message: ref('ChatMessage'),
    replayed: { type: 'boolean' },
  }),
  ChatSendResponse: {
    ...envelope(ref('ChatSendResult')),
    example: {
      success: true,
      data: { ticket: exampleDetail, message: exampleMessage, replayed: false },
    },
  },
  ChatCloseTicket: { ...object({}), example: {} },
};

export const chatPaths: Record<string, OpenApiObject> = {
  '/chat/options': {
    get: {
      tags: ['Chat'],
      operationId: 'getChatOptions',
      summary: 'ข้อมูลผู้ใช้ หัวข้อ และข้อจำกัดสำหรับ Ticket',
      description: `Authentication: Bearer token; Permission: chat:view. ตัวเลือกโหลดได้เมื่อมี chat:view; canCreate ใช้ chat:ask ร่วมกับ persona และ scope ที่ใช้ได้; ทุก resource ต้องผ่านขอบเขต Chat ของแต่ละ action\n\n${accessDescription}`,
      security,
      'x-poms-permissions': ['chat:view'],
      responses: { ...errors, '200': response('ข้อมูลตัวเลือก', ref('ChatOptionsResponse')) },
    },
  },
  '/chat/tickets': {
    get: {
      tags: ['Chat'],
      operationId: 'listChatTickets',
      summary: 'รายการ Ticket ตามสิทธิ์ ตัวกรอง และลำดับ',
      description: `${accessDescription}\n\nรายการไม่มีข้อความหรือ events; ทุกแถวมี capabilities ของผู้เรียกปัจจุบัน ใช้ ID เป็นลำดับรองเมื่อ sort เท่ากัน ข้อมูลสดอาจเลื่อนหน้าเมื่อมีข้อความใหม่ระหว่างเปลี่ยนหน้าหรือรีเฟรช\n\nfrom/to กรอง lastMessageAt แบบรวมขอบเขตทั้งสองด้าน ต้อง from<=to; รับ ISO 8601 ที่มี Z หรือ timezone offset และ normalize UTC; q ค้น Ticket และข้อมูลโรงงาน; query ที่ไม่ได้ระบุถูกปฏิเสธ`,
      security,
      parameters: [
        ...pageParameters,
        query('status', { type: 'string', enum: ['open', 'closed'] }, 'กรองสถานะ'),
        query('topicCode', ref('ChatTopicCode'), 'กรองหัวข้อ'),
        query('eligibleFactoryId', positiveId, 'กรองโรงงานที่ยังอยู่ในขอบเขต'),
        query('regionName', { type: 'string', minLength: 1, maxLength: 100 }, 'ชื่อภาค; trim'),
        query(
          'provinceName',
          { type: 'string', minLength: 1, maxLength: 128 },
          'ชื่อจังหวัด; trim',
        ),
        query(
          'from',
          { type: 'string', format: 'date-time' },
          'lastMessageAt ตั้งแต่เวลานี้ รวมเวลาที่ระบุ',
        ),
        query(
          'to',
          { type: 'string', format: 'date-time' },
          'lastMessageAt ถึงเวลานี้ รวมเวลาที่ระบุ',
        ),
        query(
          'sort',
          {
            type: 'string',
            enum: [
              'lastMessageAt',
              'ticketNo',
              'topic',
              'factoryName',
              'registrationNo',
              'regionName',
              'provinceName',
              'status',
            ],
            default: 'lastMessageAt',
          },
          'คอลัมน์ที่อนุญาตให้เรียง',
        ),
        query(
          'order',
          { type: 'string', enum: ['asc', 'desc'], default: 'desc' },
          'ทิศทางการเรียง',
        ),
      ],
      responses: {
        ...errors,
        '200': response('รายการ Ticket และ pagination ที่ระดับบนสุด', ref('ChatTicketPage')),
      },
    },
    post: {
      tags: ['Chat'],
      operationId: 'createChatTicket',
      summary: 'เปิด Ticket พร้อมข้อความแรก',
      description: `${accessDescription}\n\nสร้าง Ticket เลขลำดับ เหตุการณ์เปิด และข้อความแรกใน transaction เดียว ไม่มี Ticket ว่าง; ตรวจจุดยังใช้งานและอยู่ในโรงงานโดย kind+id ไม่จับคู่ด้วย pointCode\n\nIdempotency แยกตามบัญชีและการเปิดเรื่อง; key เดิม/payload เดิมคืน Ticket เดิม 200 แม้ปิดหรือจุดเดิมถูกถอดไปแล้ว โดยยังตรวจสิทธิ์และขอบเขตโรงงานปัจจุบันก่อน replay; key เดิม/payload ต่างตอบ 409`,
      security,
      'x-poms-permissions': ['chat:view', 'chat:ask'],
      'x-poms-user-types': ['operator', 'officer', 'admin'],
      parameters: [idempotencyKey],
      requestBody: {
        required: true,
        content: { 'application/json': { schema: ref('ChatCreateTicket') } },
      },
      responses: {
        ...errors,
        '403': response(
          'FORBIDDEN: ไม่มี chat:view หรือ chat:ask หรือ userType ไม่ใช่ operator/officer/admin; citizen เปิดเรื่องไม่ได้ รวมถึงการส่งซ้ำ',
          ref('ErrorEnvelope'),
        ),
        '200': response('ส่งซ้ำสำเร็จ; replayed=true', ref('ChatCreateResponse')),
        '201': {
          ...response('สร้างสำเร็จ; replayed=false', ref('ChatCreateResponse')),
          headers: { Location: { schema: { type: 'string', example: '/api/v1/chat/tickets/1' } } },
        },
        '409': response(
          'IDEMPOTENCY_KEY_CONFLICT: key เดิมแต่ payload ต่าง; CHAT_TICKET_NUMBER_EXHAUSTED: เลขลำดับครบ 99999 ในปีปัจจุบัน',
          ref('ErrorEnvelope'),
        ),
        '429': writeRateLimit,
      },
    },
  },
  '/chat/factories': {
    get: {
      tags: ['Chat'],
      operationId: 'listChatFactories',
      summary: 'โรงงานที่ผู้ใช้มีสิทธิ์เลือกเปิดเรื่อง',
      description: `${accessDescription}\n\nค้นชื่อโรงงาน/เลขทะเบียน; รวมโรงงานที่เข้าข่ายที่ยังไม่เชื่อมต่อหรือไม่มีจุดตรวจวัดเมื่อมีสิทธิ์ ไม่สร้างสิทธิ์จากการกรอกเลขทะเบียนเอง`,
      security,
      parameters: pageParameters,
      responses: {
        ...errors,
        '200': response('รายการโรงงานและ pagination ที่ระดับบนสุด', ref('ChatFactoryPage')),
      },
    },
  },
  '/chat/factories/{id}/measurement-points': {
    get: {
      tags: ['Chat'],
      operationId: 'listChatFactoryMeasurementPoints',
      summary: 'จุดตรวจวัดที่เลือกได้ของโรงงาน',
      description: `${accessDescription}\n\nใช้ kind+id ระบุตัวตนจุด; eligible เป็นจุดในแบบโรงงานที่เข้าข่าย, connected เป็นจุด current/live ที่เชื่อมต่อแล้ว ไม่รวมจุดด้วยชื่อหรือ pointCode ที่ตรงกัน ไม่พบจุดคืน [] และยังเปิดเรื่องระดับโรงงานได้\n\nตรวจ active membership ซ้ำตอนสร้าง Ticket; หลังสร้างเก็บ snapshot จุดและไม่โยงไปจุดใหม่ที่ใช้รหัสเดิม`,
      security,
      parameters: [idParameter],
      responses: {
        ...errors,
        '200': response('ตัวเลือกจุดตรวจวัด', ref('ChatMeasurementPointsResponse')),
      },
    },
  },
  '/chat/tickets/{id}': {
    get: {
      tags: ['Chat'],
      operationId: 'getChatTicket',
      summary: 'รายละเอียด Ticket และเหตุการณ์เปิด/ปิด',
      description: `${accessDescription}\n\nคืนสถานะปัจจุบันและ events แยกจากข้อความ; โหลดข้อความผ่าน /messages; โรงงานที่ถูกถอดหรือสิทธิ์ถูกถอนทำให้มองไม่เห็นโดยเก็บประวัติไว้ ไม่ผูกประวัติกับโรงงาน/จุดใหม่เพียงเพราะเลขทะเบียนหรือรหัสตรงกัน`,
      security,
      parameters: [idParameter],
      responses: { ...errors, '200': response('รายละเอียด Ticket', ref('ChatTicketResponse')) },
    },
  },
  '/chat/tickets/{id}/messages': {
    get: {
      tags: ['Chat'],
      operationId: 'listChatMessages',
      summary: 'ข้อความและสถานะ Ticket ปัจจุบันพร้อม cursor',
      description: `${accessDescription}\n\nครั้งแรกโหลดล่าสุด N ข้อความ แต่เรียง response จากเก่าไปใหม่; olderCursor โหลดเก่าต่อ, afterMessageId รีเฟรชข้อความใหม่ ทั้งสองใช้พร้อมกันไม่ได้\n\nหาก afterMessageId มีผลเกิน limit ใช้ nextAfterMessageId เรียกต่อจน hasMore=false โดยไม่ข้าม batch; คืน ticket พร้อมสถานะ/events/capabilities เสมอ แม้ไม่มีข้อความเพิ่ม ใช้การกดรีเฟรช ไม่มี polling`,
      security,
      parameters: [
        idParameter,
        query(
          'limit',
          { type: 'integer', minimum: 1, maximum: 100, default: 50 },
          'จำนวนข้อความต่อหน้า',
        ),
        query(
          'olderCursor',
          { type: 'string', minLength: 1, maxLength: 256, pattern: '^[A-Za-z0-9_-]+$' },
          'opaque cursor จาก response เพื่อโหลดข้อความเก่า ห้ามสร้าง/แก้เอง',
        ),
        query('afterMessageId', positiveId, 'โหลดข้อความใหม่กว่า ID นี้'),
      ],
      responses: {
        ...errors,
        '200': response(
          'สถานะ Ticket ข้อความ และ cursor pagination ภายใน data',
          ref('ChatMessagePageResponse'),
        ),
      },
    },
    post: {
      tags: ['Chat'],
      operationId: 'sendChatMessage',
      summary: 'ส่งข้อความใน Ticket ที่ยังเปิดอยู่',
      description: `${accessDescription}\n\nbody รับเฉพาะ message; sender และวันเวลามาจาก server\n\nkey แยกตามบัญชี การส่งข้อความ และ Ticket; key เดิม/payload เดิมคืนข้อความเดิม 200 แม้ retry หลังปิด Ticket แต่ต้องมีสิทธิ์และขอบเขตปัจจุบัน; key เดิม/payload ต่างตอบ IDEMPOTENCY_KEY_CONFLICT; ข้อความใหม่หลังปิดตอบ CHAT_TICKET_CLOSED\n\nส่งข้อความและปิด Ticket ถูกจัดลำดับด้วย transaction lock เดียวกัน ข้อความที่บันทึกก่อนปิดยังอยู่ในประวัติ ข้อความใหม่หลังปิดไม่ถูกเพิ่ม`,
      security,
      'x-poms-write-permissions': writePermissions,
      parameters: [idParameter, idempotencyKey],
      requestBody: {
        required: true,
        content: { 'application/json': { schema: ref('ChatSendMessage') } },
      },
      responses: {
        ...errors,
        '200': response('ส่งซ้ำสำเร็จ; replayed=true', ref('ChatSendResponse')),
        '201': response('ส่งข้อความสำเร็จ; replayed=false', ref('ChatSendResponse')),
        '409': response(
          'CHAT_TICKET_CLOSED: ส่งข้อความใหม่หลังปิด; IDEMPOTENCY_KEY_CONFLICT: key เดิมแต่ payload ต่าง',
          ref('ErrorEnvelope'),
        ),
        '429': writeRateLimit,
      },
    },
  },
  '/chat/tickets/{id}/close': {
    post: {
      tags: ['Chat'],
      operationId: 'closeChatTicket',
      summary: 'ปิด Ticket และเก็บประวัติ',
      description: `${accessDescription}\n\nปิดซ้ำสำเร็จโดยไม่สร้าง event เพิ่ม ไม่เปลี่ยนผู้ปิดหรือเวลาปิด และไม่เปลี่ยน lastMessageAt; ตรวจสิทธิ์ปัจจุบันทุกครั้ง ไม่ต้องมี Idempotency-Key\n\nคืน status=closed, canReply=false, canClose=false; อ่านประวัติได้แต่ไม่มี reopen; ปิดกล่องสนทนาใน UI ไม่ใช่การปิด Ticket`,
      security,
      'x-poms-write-permissions': writePermissions,
      parameters: [idParameter],
      requestBody: {
        required: false,
        content: { 'application/json': { schema: ref('ChatCloseTicket') } },
      },
      responses: {
        ...errors,
        '200': {
          description: 'Ticket ที่ปิดแล้วพร้อมเหตุการณ์',
          content: {
            'application/json': {
              schema: ref('ChatTicketResponse'),
              example: { success: true, data: exampleClosed },
            },
          },
        },
        '429': writeRateLimit,
      },
    },
  },
};
