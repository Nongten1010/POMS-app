type Schema = Record<string, unknown>;
const object = (
  properties: Record<string, Schema>,
  required = Object.keys(properties),
): Schema => ({ type: 'object', additionalProperties: false, properties, required });
const id = { type: 'integer', minimum: 1, maximum: Number.MAX_SAFE_INTEGER };
const text = { type: 'string' };
const nullableText = { type: 'string', nullable: true };
const time = { type: 'string', format: 'date-time', description: 'UTC ISO datetime พร้อม Z' };
const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });
const response = (schema: Schema, example?: unknown) => ({
  description: 'สำเร็จ',
  content: {
    'application/json': {
      schema: object({ success: { type: 'boolean', enum: [true] }, data: schema }),
      ...(example ? { example } : {}),
    },
  },
});
const item = object({
  id,
  userId: id,
  name: text,
  citizenIdMasked: { type: 'string', pattern: '^\\*{9}[0-9]{4}$|^\\*{13}$' },
  status: { type: 'string', enum: ['active', 'revoked', 'expired', 'suspended'] },
  grantedAt: time,
  grantedByName: text,
  canRevoke: { type: 'boolean' },
});
const history = object({
  id,
  occurredAt: time,
  action: { type: 'string', enum: ['granted', 'revoked', 'expired', 'suspended'] },
  name: text,
  actorName: text,
  reason: nullableText,
});
const optionalReason = {
  type: 'string',
  maxLength: 1000,
  description: 'ไม่บังคับ; trim; ว่างเท่ากับไม่ส่ง ไม่มีไฟล์หลักฐาน',
};
export const eligibleOperatorAccessSchemas: Record<string, Schema> = {
  EligibleOperatorAccessSnapshot: object({
    factory: object({
      id,
      name: text,
      factoryRegistrationNo: text,
      operationStatus: text,
      statusVerifiedAt: { ...time, nullable: true },
    }),
    capabilities: object({
      canGrant: { type: 'boolean' },
      grantUnavailableReason: {
        type: 'string',
        nullable: true,
        enum: ['SOURCE_STATUS_UNVERIFIED', 'FACTORY_NOT_NOT_STARTED', null],
      },
    }),
    items: { type: 'array', items: item },
    history: { type: 'array', items: history },
  }),
  EligibleOperatorAccessGrantInput: object({ userId: id, reason: optionalReason }, ['userId']),
  EligibleOperatorAccessRevokeInput: object({ reason: optionalReason }, []),
  EligibleOperatorAccessCandidates: object({
    items: {
      type: 'array',
      items: object({
        userId: id,
        name: text,
        citizenIdMasked: { type: 'string', description: 'เลขบัตรปิดบัง ไม่คืน external_id เต็ม' },
      }),
    },
  }),
};
const errors = {
  '400': {
    description:
      'VALIDATION_ERROR: id ต้องเป็นจำนวนเต็มบวก; query 2–100 ตัวอักษร; reason ไม่เกิน 1000; ไม่รับ field เกิน',
    content: { 'application/json': { schema: ref('ErrorEnvelope') } },
  },
  '401': { $ref: '#/components/responses/Unauthorized' },
  '403': {
    description: 'FORBIDDEN: ต้องเป็น admin และมี eligible_factories:view',
    content: { 'application/json': { schema: ref('ErrorEnvelope') } },
  },
  '404': {
    description:
      'NOT_FOUND: โรงงานอยู่นอก scope/ถูกลบ, ไม่พบบัญชีที่เคย login ผ่าน i-industry หรือ grant ไม่ใช่ของโรงงานนี้',
    content: { 'application/json': { schema: ref('ErrorEnvelope') } },
  },
  '409': {
    description:
      'CONFLICT: DUPLICATE_GRANT, SOURCE_STATUS_UNVERIFIED, FACTORY_NOT_NOT_STARTED หรือ grant สิ้นสุดแล้ว',
    content: { 'application/json': { schema: ref('ErrorEnvelope') } },
  },
  '503': {
    description: 'SERVICE_UNAVAILABLE: ยังไม่เปิด ELIGIBLE_OPERATOR_ACCESS_ENABLED',
    content: { 'application/json': { schema: ref('ErrorEnvelope') } },
  },
};
const base = '/eligible-factories/{id}/operator-access';
const common = { security: [{ bearerAuth: [] }], 'x-poms-required-roles': ['admin'] };
const description =
  'Permission: eligible_factories:view ตาม data scope และ userType=admin หรือ role admin เท่านั้น ไม่ต้องมี edit; officer/director แม้มี edit ก็ทำไม่ได้. ต้องเปิด ELIGIBLE_OPERATOR_ACCESS_ENABLED หลัง migration 0158. id คือ eligible_factories.id ไม่ใช่ FID. Cache-Control: no-store. รายการและประวัติคืนครบ ไม่มี server pagination. สิทธิ์ผูกมีผลเฉพาะ Fac60k FFLAG=0 และข้อมูลใหม่ไม่เกิน FACTORY_STATUS_MAX_AGE_SECONDS; เปลี่ยนเป็น 1/2/3 สิทธิ์ expired และไม่คืนเองเมื่อกลับเป็น 0; ข้อมูลเก่าและตรวจไม่ได้ suspended จนยืนยันใหม่ โดยไม่ยกเลิกคำขอเดิม. ';
const parameter = { name: 'id', in: 'path', required: true, schema: id };
export const eligibleOperatorAccessPaths: Record<string, Schema> = {
  [base]: {
    get: {
      operationId: 'getEligibleOperatorAccess',
      parameters: [parameter],
      ...common,
      summary: 'รายชื่อผู้มีสิทธิ์ ประวัติ และสถานะล่าสุด',
      description,
      responses: { ...errors, '200': response(ref('EligibleOperatorAccessSnapshot')) },
    },
    post: {
      operationId: 'grantEligibleOperatorAccess',
      parameters: [parameter],
      ...common,
      summary: 'ผูกผู้ประกอบการกับโรงงานที่ยังไม่แจ้งประกอบ',
      description:
        description +
        'ตรวจ Fac60k ใหม่ก่อนบันทึก ตรวจสถานะ/บัญชี/สิทธิ์ซ้ำภายใน transaction; userId ต้องเป็นบัญชี active ที่เคย login ผ่าน i-industry และไม่ถูกลบ; รองรับ citizen ที่ provider ไม่ส่งนิติบุคคล; ไม่รับบัญชี local/mock/officer. เหตุผลไม่บังคับ. ห้าม retry POST อัตโนมัติเมื่อไม่ทราบผล ให้ GET ตรวจรายการก่อน.',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: ref('EligibleOperatorAccessGrantInput'),
            example: { userId: 42 },
          },
        },
      },
      responses: {
        ...errors,
        '201': response(object({ id }), { success: true, data: { id: 123 } }),
      },
    },
  },
  [`${base}/candidates`]: {
    get: {
      operationId: 'searchEligibleOperatorAccessCandidates',
      ...common,
      summary: 'ค้นหาบัญชีที่เคยยืนยันตัวตนผ่าน i-industry',
      description:
        description +
        'ค้นชื่อ/นามสกุล หรือเลขบัตรเต็ม 13 หลักแบบ exact; ไม่คืนเลขบัตรเต็ม และไม่คืนบัญชีที่มีรายการผูกเปิดอยู่. Application logs ตัด query ออก; ต้องตั้ง reverse-proxy/access logs ไม่เก็บ query ของ path นี้ก่อนเปิดใช้งาน.',
      parameters: [
        parameter,
        {
          name: 'query',
          in: 'query',
          required: true,
          schema: { type: 'string', minLength: 2, maxLength: 100 },
        },
      ],
      responses: {
        ...errors,
        '200': response(ref('EligibleOperatorAccessCandidates'), {
          success: true,
          data: {
            items: [{ userId: 42, name: 'ผู้ประกอบการ ทดสอบ', citizenIdMasked: '*********1234' }],
          },
        }),
      },
    },
  },
  [`${base}/{grantId}/revoke`]: {
    post: {
      operationId: 'revokeEligibleOperatorAccess',
      parameters: [parameter, { name: 'grantId', in: 'path', required: true, schema: id }],
      ...common,
      summary: 'เพิกถอนสิทธิ์รายโรงงาน',
      description:
        description +
        'ใช้ได้กับ active/suspended แม้โรงงานไม่ใช่สถานะ 0; ไม่ต้องติดต่อ Fac60k เพื่อเพิกถอน; expired/revoked ตอบ 409. มีผลต่อ token เดิมในการเรียกครั้งถัดไป; ไม่ลบประวัติหรือสิทธิ์จากแหล่งอื่น.',
      requestBody: {
        required: true,
        content: {
          'application/json': { schema: ref('EligibleOperatorAccessRevokeInput'), example: {} },
        },
      },
      responses: {
        ...errors,
        '200': response(object({ id }), { success: true, data: { id: 123 } }),
      },
    },
  },
};
