import { MENU_TAGS } from './openapi.shared';
type Schema = Record<string, unknown>;
const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });
const visibility = { type: 'string', enum: ['VISIBLE', 'HIDDEN'] };
const connectionStatus = { type: 'string', enum: ['CONNECTED', 'DISCONNECTED'] };
const id = { type: 'integer', minimum: 1, maximum: Number.MAX_SAFE_INTEGER };
const patchFields = { visibility, connectionStatus };
const parameterFields = {
  parameter: {
    type: 'string',
    minLength: 1,
    maxLength: 200,
    description:
      'ส่ง parameter ที่ได้จาก GET กลับมาตรงตัว รวมหน่วยหากต้นทางใช้หน่วยเป็นส่วนหนึ่งของรหัส',
  },
  visibility,
};
const object = (properties: Schema, required: string[]): Schema => ({
  type: 'object',
  additionalProperties: false,
  ...(required.length ? { required } : {}),
  properties,
});
const parameterPatch = object(parameterFields, ['parameter', 'visibility']);
const statusPatch = { ...object(patchFields, []), minProperties: 1 };
const pointPatch = {
  ...object(
    {
      connectedPointId: id,
      ...patchFields,
      parameters: { type: 'array', minItems: 1, maxItems: 100, items: parameterPatch },
    },
    ['connectedPointId'],
  ),
  anyOf: [
    { required: ['visibility'] },
    { required: ['connectionStatus'] },
    { required: ['parameters'] },
  ],
};
export const statusManagementExample = {
  expectedRevision: 0,
  factory: { visibility: 'VISIBLE' },
  measurementPoints: [
    {
      connectedPointId: 11,
      connectionStatus: 'DISCONNECTED',
      parameters: [{ parameter: 'CO', visibility: 'HIDDEN' }],
    },
  ],
};
export const statusManagementSchemas: Record<string, Schema> = {
  PomsStatusManagementRequest: {
    ...object(
      {
        expectedRevision: { type: 'integer', minimum: 0, maximum: 2147483646 },
        factory: statusPatch,
        measurementPoints: { type: 'array', minItems: 1, maxItems: 200, items: pointPatch },
      },
      ['expectedRevision'],
    ),
    anyOf: [{ required: ['factory'] }, { required: ['measurementPoints'] }],
    description:
      'PATCH แบบ atomic; ห้าม connectedPointId ซ้ำหรือ parameter ซ้ำ (ไม่แยกตัวพิมพ์เล็กใหญ่) ในจุดเดียวกัน; พารามิเตอร์เปลี่ยนได้เฉพาะ visibility; actor มาจาก JWT เท่านั้น',
  },
  PomsStatusManagement: object(
    {
      eligibleFactoryId: id,
      factoryId: { type: 'string' },
      factoryName: { type: 'string' },
      revision: { type: 'integer', minimum: 0 },
      updatedAt: { type: 'string', format: 'date-time', nullable: true },
      updatedBy: { ...id, nullable: true },
      factory: object(
        {
          ...patchFields,
          status: { type: 'string', enum: ['แสดง', 'ซ่อน', 'ยกเลิกการเชื่อมต่อ'] },
          effectiveVisibility: visibility,
          effectiveConnectionStatus: connectionStatus,
          connectionStatusLabel: { type: 'string', enum: ['เชื่อมต่อแล้ว', 'ยกเลิกการเชื่อมต่อ'] },
        },
        ['visibility', 'connectionStatus', 'status', 'connectionStatusLabel'],
      ),
      measurementPoints: {
        type: 'array',
        items: object(
          {
            connectedPointId: id,
            pointCode: { type: 'string', nullable: true },
            pointName: { type: 'string' },
            systemType: { type: 'string', enum: ['CEMS', 'WPMS'] },
            ...patchFields,
            status: { type: 'string', enum: ['แสดง', 'ซ่อน', 'ยกเลิกการเชื่อมต่อ'] },
            effectiveVisibility: visibility,
            effectiveConnectionStatus: connectionStatus,
            parameters: {
              type: 'array',
              items: object(
                {
                  ...parameterFields,
                  displayName: { type: 'string', description: 'ชื่อพารามิเตอร์พร้อมหน่วย' },
                  effectiveVisibility: visibility,
                },
                ['parameter', 'displayName', 'visibility', 'effectiveVisibility'],
              ),
            },
          },
          [
            'connectedPointId',
            'pointCode',
            'pointName',
            'systemType',
            'visibility',
            'connectionStatus',
            'effectiveVisibility',
            'effectiveConnectionStatus',
            'parameters',
          ],
        ),
      },
    },
    [
      'eligibleFactoryId',
      'factoryId',
      'factoryName',
      'revision',
      'updatedAt',
      'updatedBy',
      'factory',
      'measurementPoints',
    ],
  ),
  PomsStatusManagementResponse: object(
    { success: { type: 'boolean', enum: [true] }, data: ref('PomsStatusManagement') },
    ['success', 'data'],
  ),
};
const response = (description: string, schema: Schema) => ({
  description,
  content: { 'application/json': { schema } },
});
const common = {
  tags: [MENU_TAGS.MASTER_DATA],
  security: [{ bearerAuth: [] }],
  parameters: [
    {
      name: 'factoryId',
      in: 'path',
      required: true,
      schema: { type: 'string', minLength: 1, maxLength: 80 },
    },
  ],
  responses: {
    '200': response(
      'สถานะปัจจุบันของโรงงาน จุดตรวจวัด และพารามิเตอร์',
      ref('PomsStatusManagementResponse'),
    ),
    '400': response(
      'VALIDATION_ERROR: body ไม่ถูกต้อง รวมถึงค่าซ้ำ/field ที่ไม่รองรับ',
      ref('ErrorEnvelope'),
    ),
    '401': response('UNAUTHORIZED: JWT ขาดหายหรือไม่ถูกต้อง', ref('ErrorEnvelope')),
    '403': response(
      'FORBIDDEN: ต้องมี JWT role admin และ permission ที่กำหนด',
      ref('ErrorEnvelope'),
    ),
    '404': response(
      'NOT_FOUND: โรงงาน/จุด/พารามิเตอร์ไม่อยู่ใน current POMS หรืออยู่นอก scope',
      ref('ErrorEnvelope'),
    ),
    '409': response(
      'CONFLICT: revision เปลี่ยนหรือข้อมูลต้นทางใช้ไม่ได้ ให้โหลดข้อมูลใหม่',
      ref('ErrorEnvelope'),
    ),
  },
};
export const statusManagementPaths: Record<string, Schema> = {
  '/poms-factories/{factoryId}/status-management': {
    get: {
      ...common,
      operationId: 'getPomsStatusManagement',
      summary: 'อ่านสถานะโรงงาน จุดตรวจวัด และพารามิเตอร์ (Admin)',
      description:
        'ต้องมี JWT roles ที่มี admin และ factories:view พร้อม data scope. userType=officer ที่มี role admin ใช้ได้. อ่านรายการที่ซ่อน/ยกเลิกด้วยเพื่อจัดการได้. ค่าของลูกคงเดิมเมื่อแม่ซ่อนหรือยกเลิก; effectiveVisibility/effectiveConnectionStatus รวมผลจากแม่. สถานะเป็นการบริหารใน POMS ไม่ใช่คำสั่งเปิด/ปิดอุปกรณ์หรือหลักฐาน telemetry.',
    },
    patch: {
      ...common,
      operationId: 'updatePomsStatusManagement',
      summary: 'บันทึกสถานะทั้งหน้าต่างแบบ atomic (Admin)',
      description:
        'ต้องมี JWT role admin และ factories:view + factories:edit โดยโรงงานต้องผ่านทั้งสอง scope. expectedRevision ใช้ค่าจาก GET; revision เก่าตอบ 409 และไม่บันทึกส่วนใด. ไม่รับฟิลด์ reason; บันทึก before/after กับผู้ทำรายการใน transaction เดียวกัน. factory/point เปลี่ยน visibility และ connectionStatus ได้; parameter เปลี่ยนได้เฉพาะ visibility. ฟิลด์ที่ไม่ส่งคงค่าเดิม. การบันทึกไม่ลบข้อมูล ไม่แก้ snapshot คำขอ ไม่สั่งอุปกรณ์ และไม่เปลี่ยนการรับข้อมูลหรือรายงานเดิม. Frontend ต้องเชื่อมปุ่มบันทึกกับ API นี้.',
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: ref('PomsStatusManagementRequest'),
            example: statusManagementExample,
          },
        },
      },
    },
  },
};

export const pomsManagedStatusProperties = {
  status: {
    type: 'string',
    enum: ['แสดง', 'ซ่อน', 'ยกเลิกการเชื่อมต่อ'],
    readOnly: true,
    description:
      'สถานะบริหาร POMS ที่มีผลจริง; ยกเลิกการเชื่อมต่อมีลำดับก่อนซ่อน ไม่ใช่ monitoringPointStatus ของขั้นตอนเชื่อมต่อ',
  },
  visibility: { ...visibility, readOnly: true },
  connectionStatus: { ...connectionStatus, readOnly: true },
  effectiveVisibility: { ...visibility, readOnly: true, description: 'รวมผลจากสถานะโรงงานแม่' },
  effectiveConnectionStatus: {
    ...connectionStatus,
    readOnly: true,
    description: 'รวมผลจากสถานะโรงงานแม่',
  },
};
