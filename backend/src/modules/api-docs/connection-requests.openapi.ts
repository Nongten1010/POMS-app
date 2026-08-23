import { env } from '../../config/env';
import {
  CONNECTION_REQUEST_DOCUMENT_TITLE,
  CONNECTION_REQUEST_STATUS_LABELS,
  CONNECTION_REQUEST_TYPE_LABELS,
  MAX_WPMS_OUTSIDE_FACTORY_DISCHARGE_POINT_PHOTOS,
} from '../connection-requests/connection-requests.types';
import { MONITORING_POINT_STATUSES } from '../monitoring-point-forms/monitoring-point-forms.types';

type OpenApiObject = Record<string, unknown>;
type EnumLabelMap = Record<string, string>;

interface OperationOptions {
  tag: string;
  summary: string;
  operationId: string;
  description?: string;
  parameters?: OpenApiObject[];
  requestBody?: OpenApiObject;
  successStatus?: string;
  successDescription?: string;
  successSchema?: OpenApiObject;
  extraResponses?: OpenApiObject;
  deprecated?: boolean;
  focus?: boolean;
}
const schemaRef = (name: string): OpenApiObject => ({ $ref: `#/components/schemas/${name}` });
const nullableRef = (name: string): OpenApiObject => ({
  allOf: [schemaRef(name)],
  nullable: true,
});
const jsonRequestBody = (
  schema: OpenApiObject,
  example?: unknown,
  description?: string,
): OpenApiObject => ({
  required: true,
  ...(description ? { description } : {}),
  content: {
    'application/json': {
      schema,
      ...(example === undefined ? {} : { example }),
    },
  },
});
const successResponse = (
  description: string,
  schema: OpenApiObject = schemaRef('SuccessEnvelope'),
) => ({
  description,
  content: {
    'application/json': {
      schema,
    },
  },
});
const standardErrorResponses: OpenApiObject = {
  '400': { $ref: '#/components/responses/BadRequest' },
  '401': { $ref: '#/components/responses/Unauthorized' },
  '403': { $ref: '#/components/responses/Forbidden' },
  '404': { $ref: '#/components/responses/NotFound' },
};
function securedOperation(options: OperationOptions): OpenApiObject {
  const successStatus = options.successStatus ?? '200';
  return {
    tags: [options.tag],
    summary: options.summary,
    operationId: options.operationId,
    ...(options.description ? { description: options.description } : {}),
    ...(options.parameters ? { parameters: options.parameters } : {}),
    ...(options.requestBody ? { requestBody: options.requestBody } : {}),
    ...(options.deprecated ? { deprecated: true } : {}),
    ...(options.focus ? { 'x-focus-endpoint': true } : {}),
    security: [{ bearerAuth: [] }],
    responses: {
      [successStatus]: successResponse(
        options.successDescription ?? 'สำเร็จ',
        options.successSchema,
      ),
      ...standardErrorResponses,
      ...(options.extraResponses ?? {}),
    },
  };
}
const stringQuery = (
  name: string,
  description: string,
  required = false,
  maxLength?: number,
): OpenApiObject => ({
  name,
  in: 'query',
  required,
  description,
  schema: {
    type: 'string',
    minLength: required ? 1 : undefined,
    ...(maxLength ? { maxLength } : {}),
  },
});
const enumSchema = (
  values: readonly string[],
  labels?: EnumLabelMap,
  descriptions?: EnumLabelMap,
  extraSchema: OpenApiObject = {},
): OpenApiObject => ({
  type: 'string',
  enum: [...values],
  ...(labels
    ? { 'x-enum-labels': Object.fromEntries(values.map((value) => [value, labels[value]])) }
    : {}),
  ...(descriptions
    ? {
        'x-enum-descriptions': Object.fromEntries(
          values.map((value) => [value, descriptions[value]]),
        ),
      }
    : {}),
  ...extraSchema,
});
const enumQuery = (
  name: string,
  values: string[],
  description: string,
  required = false,
  defaultValue?: string,
  labels?: EnumLabelMap,
  descriptions?: EnumLabelMap,
): OpenApiObject => ({
  name,
  in: 'query',
  required,
  description,
  schema: enumSchema(values, labels, descriptions, defaultValue ? { default: defaultValue } : {}),
});

const submissionSourceLabels: EnumLabelMap = {
  OPERATOR_FORM: 'แบบฟอร์มจากผู้ประกอบการ',
  OFFICER_DIRECT_API: 'เจ้าหน้าที่เพิ่มจุดตรวจวัดโดยตรง',
};

const systemTypeLabels: EnumLabelMap = {
  CEMS: 'CEMS ระบบตรวจวัดอากาศเสีย',
  WPMS: 'WPMS ระบบตรวจวัดน้ำเสีย',
};

const measurementPointTypeLabels: EnumLabelMap = {
  STACK: 'ปล่องระบายอากาศ',
  WASTEWATER: 'จุดระบายน้ำทิ้ง',
  OTHER: 'อื่นๆ',
};

const monitoringPointStatusLabels: EnumLabelMap = Object.fromEntries(
  MONITORING_POINT_STATUSES.map((status) => [status, status]),
);

const monitoringPointStatusSchema = (description: string): OpenApiObject => ({
  ...enumSchema(MONITORING_POINT_STATUSES, monitoringPointStatusLabels),
  nullable: true,
  description,
});

const reviewDecisionLabels: EnumLabelMap = {
  APPROVE_DESIGN: 'อนุมัติแบบ',
  REQUEST_REVISION: 'แจ้งแก้ไขแบบ',
};

const statusActionLabels: EnumLabelMap = {
  APPROVE_FORM: 'อนุมัติคำขอ',
  REQUEST_REVISION: 'ส่งกลับให้แก้ไข',
  RETURN_TO_WAITING_CONNECTION: 'ย้อนกลับไปรอเชื่อมต่อ',
};

const pointCodeAssignmentModeLabels: EnumLabelMap = {
  AUTO: 'ให้ระบบออกรหัสอัตโนมัติ',
  MANUAL_LEGACY: 'ใช้รหัส legacy ที่เจ้าหน้าที่กำหนด',
  OFFICER_DIRECT: 'รหัสจากการเชื่อมต่อโดยเจ้าหน้าที่โดยตรง',
  LEGACY_IMPORTED: 'รหัส legacy ที่มาจากข้อมูลเดิม',
};

const confirmActionLabels: EnumLabelMap = {
  SAVE: 'บันทึกแบบยังไม่ยืนยัน',
  CONFIRM: 'ยืนยันการเชื่อมต่อ',
};

const requestStatusDescriptions: EnumLabelMap = {
  PENDING_DESIGN_REVIEW: 'เจ้าหน้าที่กำลังตรวจสอบข้อมูลและแบบคำขอ',
  WAITING_CONNECTION: 'แบบผ่านแล้วและรอโรงงานตั้งค่าอุปกรณ์เพื่อเชื่อมต่อ',
  WAITING_FACTORY_REVISION: 'เจ้าหน้าที่ส่งกลับให้โรงงานแก้ไขข้อมูลหรือเอกสาร',
  REVISED_PENDING_DESIGN_REVIEW: 'โรงงานแก้ไขแล้วและรอเจ้าหน้าที่ตรวจแบบอีกครั้ง',
  CONNECTION_CONFIRMED: 'โรงงานยืนยันการตั้งค่าแล้วและรอเจ้าหน้าที่ตรวจยืนยันการเชื่อมต่อ',
  CONNECTED: 'เชื่อมต่อสำเร็จและใช้งานในระบบแล้ว',
  CANCELED: 'คำขอถูกยกเลิกและไม่เดิน workflow ต่อ',
};

const requestTypeDescriptions: EnumLabelMap = {
  NEW_CONNECTION: 'ใช้เมื่อยื่นคำขอเชื่อมต่อโรงงานหรือระบบใหม่',
  ADD_MEASUREMENT_POINT: 'ใช้เมื่อขอเพิ่มจุดตรวจวัดในโรงงานที่มีอยู่แล้ว',
  ADD_PARAMETER: 'ใช้เมื่อขอเพิ่มพารามิเตอร์ในจุดตรวจวัดเดิม',
};

const connectionRequestStatusFilterDescription =
  'กรองสถานะคำขอ เช่น รอพิจารณาแบบ (PENDING_DESIGN_REVIEW), รอโรงงานตั้งค่าอุปกรณ์ (WAITING_CONNECTION), รอโรงงานแก้ไข (WAITING_FACTORY_REVISION), รอเชื่อมต่อ (CONNECTION_CONFIRMED), เชื่อมต่อแล้ว (CONNECTED)';

const connectionRequestTypeFilterDescription =
  'กรองประเภทคำขอ เช่น ขอเชื่อมต่อใหม่ (NEW_CONNECTION), เพิ่มจุดตรวจวัด (ADD_MEASUREMENT_POINT), เพิ่มพารามิเตอร์ (ADD_PARAMETER)';
const idPathParameter = {
  name: 'id',
  in: 'path',
  required: true,
  description: 'รหัสคำขอ ต้องเป็นจำนวนเต็มบวก',
  schema: { type: 'integer', minimum: 1 },
  example: 101,
};
const configIdPathParameter = {
  name: 'configId',
  in: 'path',
  required: true,
  description: 'รหัส device config ต้องเป็นจำนวนเต็มบวก',
  schema: { type: 'integer', minimum: 1 },
  example: 12,
};
const factoryIdPathParameter = {
  name: 'factoryId',
  in: 'path',
  required: true,
  description: 'รหัสโรงงาน ความยาว 1-64 ตัวอักษร',
  schema: { type: 'string', minLength: 1, maxLength: 64 },
  example: 'F000123',
};
const stationIdPathParameter = {
  name: 'stationId',
  in: 'path',
  required: true,
  description: 'รหัสจุดตรวจวัด ความยาว 1-64 ตัวอักษร; หากมี / ให้ URL-encode เป็น %2F',
  schema: { type: 'string', minLength: 1, maxLength: 64 },
  example: 'S2001',
};
const annualStationIdPathParameter = {
  name: 'stationId',
  in: 'path',
  required: true,
  description: 'ส่วนหน้าของ annual point code เมื่อ proxy ถอด %2F ก่อนส่งต่อ',
  schema: {
    type: 'string',
    pattern: '^(?:CEMS|WEMS)-\\d{4,}$',
    maxLength: 59,
  },
  example: 'CEMS-0001',
};
const buddhistYearPathParameter = {
  name: 'buddhistYear',
  in: 'path',
  required: true,
  description: 'ปี พ.ศ. 4 หลัก ซึ่ง middleware จะประกอบกลับกับ stationId ด้วย /',
  schema: { type: 'string', pattern: '^\\d{4}$' },
  example: '2569',
};
const parameterValueStationIdQuery = {
  name: 'stationId',
  in: 'query',
  required: true,
  description:
    'รหัส legacy ที่ขึ้นต้นด้วยตัวอักษรและมีเฉพาะตัวอักษร/ตัวเลข/_ หรือ annual code รูปแบบ CEMS|WEMS-NNNN/BBBB; ยาวไม่เกิน 64',
  schema: {
    type: 'string',
    minLength: 1,
    maxLength: 64,
    pattern: '^(?:[A-Za-z][A-Za-z0-9_]*|(?:CEMS|WEMS)-\\d{4,}/\\d{4})$',
  },
  example: 'S2001',
};
const requestListParameters = [
  enumQuery(
    'status',
    [
      'PENDING_DESIGN_REVIEW',
      'WAITING_CONNECTION',
      'WAITING_FACTORY_REVISION',
      'REVISED_PENDING_DESIGN_REVIEW',
      'CONNECTION_CONFIRMED',
      'CONNECTED',
      'CANCELED',
    ],
    connectionRequestStatusFilterDescription,
    false,
    undefined,
    CONNECTION_REQUEST_STATUS_LABELS,
    requestStatusDescriptions,
  ),
  enumQuery(
    'requestType',
    ['NEW_CONNECTION', 'ADD_MEASUREMENT_POINT', 'ADD_PARAMETER'],
    connectionRequestTypeFilterDescription,
    false,
    undefined,
    CONNECTION_REQUEST_TYPE_LABELS,
    requestTypeDescriptions,
  ),
  stringQuery('factoryId', 'กรองรหัสโรงงาน', false, 64),
  stringQuery('stationId', 'กรองรหัสจุดตรวจวัด', false, 64),
  stringQuery('regionName', 'กรองชื่อภูมิภาค', false, 128),
  stringQuery('provinceName', 'กรองชื่อจังหวัด', false, 128),
  stringQuery('districtName', 'กรองชื่ออำเภอ/เขต', false, 128),
  stringQuery('subdistrictName', 'กรองชื่อตำบล/แขวง', false, 128),
  stringQuery('industrialEstateName', 'กรองชื่อนิคมอุตสาหกรรม', false, 255),
  stringQuery('factoryMainTypeCode', 'กรองรหัสประเภทโรงงานหลัก', false, 128),
];
const connectedPointFilterParameters = [
  stringQuery('factoryId', 'กรองรหัสโรงงาน', false, 64),
  stringQuery('stationId', 'กรองรหัสจุดตรวจวัด', false, 64),
];
const operatorFactoryParameters = [
  enumQuery('systemType', ['CEMS', 'WPMS'], 'กรองระบบตรวจวัด', false, undefined, systemTypeLabels),
  {
    name: 'favoriteOnly',
    in: 'query',
    required: false,
    description: 'คืนเฉพาะโรงงานโปรด; รับ true/false, 1/0 หรือ yes/no; default false',
    schema: { type: 'boolean', default: false },
  },
];
const nullableString = (maxLength: number, description: string): OpenApiObject => ({
  type: 'string',
  maxLength,
  nullable: true,
  description,
});
const nullableNumber = (minimum: number, maximum: number, description: string): OpenApiObject => ({
  type: 'number',
  minimum,
  maximum,
  nullable: true,
  description,
});
const operatorFormProperties: Record<string, OpenApiObject> = {
  requestType: {
    ...enumSchema(
      ['NEW_CONNECTION', 'ADD_MEASUREMENT_POINT', 'ADD_PARAMETER'],
      CONNECTION_REQUEST_TYPE_LABELS,
      requestTypeDescriptions,
    ),
    description:
      'รับเฉพาะ create/resubmit แบบทั่วไป; dedicated add-point/add-parameter ปฏิเสธ field นี้',
  },
  factoryId: {
    type: 'string',
    minLength: 1,
    maxLength: 64,
    description: 'Required, not null; ต้อง resolve เป็น active eligible factory',
  },
  factoryName: {
    type: 'string',
    minLength: 1,
    maxLength: 500,
    description: 'Required, not null',
  },
  factoryRegistrationNo: {
    type: 'string',
    maxLength: 64,
    nullable: true,
    description: 'Optional; trim แล้วเมื่อไม่ส่ง/null/ค่าว่าง backend ใช้ factoryId',
  },
  industryMainOrder: nullableString(128, 'Optional'),
  industryMainOrderLabel: nullableString(500, 'Optional'),
  industrySubOrder: nullableString(128, 'Optional'),
  businessActivity: nullableString(4000, 'Optional'),
  eia: {
    type: 'string',
    enum: ['มี', 'ไม่มี', 'มี IEE', 'มี EIA', 'มี EHIA', 'อื่นๆ'],
    nullable: true,
    description: 'Optional; เมื่อเป็น อื่นๆ ต้องส่ง eiaOther',
  },
  eiaOther: nullableString(500, 'Required เมื่อ eia = อื่นๆ'),
  hasEia: {
    type: 'boolean',
    nullable: true,
    description: 'Optional; ถ้าส่งพร้อม eia ต้องตรงกับค่าที่ derive จาก eia',
  },
  projectName: nullableString(500, 'Optional'),
  address: nullableString(1000, 'Optional'),
  regionCode: nullableString(64, 'Optional'),
  regionName: nullableString(128, 'Optional'),
  provinceCode: nullableString(32, 'Optional'),
  provinceName: nullableString(128, 'Optional'),
  districtCode: nullableString(32, 'Optional'),
  districtName: nullableString(128, 'Optional'),
  subdistrictCode: nullableString(32, 'Optional'),
  subdistrictName: nullableString(128, 'Optional'),
  industrialEstateCode: nullableString(32, 'Optional'),
  industrialEstateName: nullableString(255, 'Optional'),
  latitude: nullableNumber(-90, 90, 'Optional'),
  longitude: nullableNumber(-180, 180, 'Optional'),
  systemType: {
    ...enumSchema(['CEMS', 'WPMS'], systemTypeLabels),
    description: 'Required, not null',
  },
  type: {
    ...enumSchema(['CEMS', 'WPMS'], systemTypeLabels),
    description: 'Legacy frontend alias; client ใหม่ไม่ควรส่ง',
  },
  contactName: {
    type: 'string',
    maxLength: 255,
    description: 'Required พร้อม contactPhone เมื่อไม่ส่ง contactPersons',
  },
  contactPhone: {
    type: 'string',
    maxLength: 64,
    description: 'Required พร้อม contactName เมื่อไม่ส่ง contactPersons',
  },
  contactEmail: {
    type: 'string',
    format: 'email',
    maxLength: 255,
    nullable: true,
  },
  contactPersons: {
    type: 'array',
    minItems: 1,
    maxItems: 20,
    items: schemaRef('ContactPerson'),
    description: 'Required เมื่อไม่ส่งคู่ contactName/contactPhone',
  },
  notificationEmails: {
    type: 'array',
    maxItems: 20,
    items: { type: 'string', format: 'email', maxLength: 255 },
    description: 'Optional; backend dedupe และ default จาก contactEmail',
  },
  officerNotificationEmails: {
    type: 'array',
    maxItems: 20,
    items: { type: 'string', format: 'email', maxLength: 255 },
  },
  informationProviderName: nullableString(255, 'Optional'),
  informationProviderPosition: nullableString(255, 'Optional'),
  measurementPoints: {
    type: 'array',
    minItems: 1,
    maxItems: 100,
    items: schemaRef('MeasurementPoint'),
  },
  remarks: nullableString(1000, 'Optional'),
};
const dedicatedOperatorFormProperties: Record<string, OpenApiObject> = {
  ...operatorFormProperties,
};
delete dedicatedOperatorFormProperties.requestType;
const addPointExample = {
  factoryId: 'F000123',
  factoryName: 'โรงงานตัวอย่าง',
  factoryRegistrationNo: 'น.60-1/2560',
  systemType: 'CEMS',
  contactPersons: [
    {
      name: 'สมชาย ใจดี',
      phone: '0812345678',
      email: 'ops@example.com',
      position: 'ผู้ประสานงาน',
    },
  ],
  measurementPoints: [
    {
      pointName: 'ปล่องระบาย A',
      pointType: 'STACK',
      details: {
        monitoringPointKind: 'CEMS',
        stackShape: 'วงกลม',
        stackDiameter: 1.2,
        hasTreatmentSystem: 'มี',
        treatmentSystem: 'ระบบดักจับฝุ่น',
        connectionDevice: 'POMS Box (กรอ.)',
      },
      documentsAndImages: [
        {
          title: 'ภาพถ่ายปล่อง',
          fileUrl: 'https://example.com/uploads/stack-a.jpg',
          fileName: 'stack-a.jpg',
          fileType: 'image/jpeg',
          fileSize: 2048,
        },
      ],
      measurementInstruments: {
        converterBrand: 'Converter Brand',
        converterModel: 'CV-100',
        parameters: [{ parameter: 'NOx (ppm)', technique: 'NDIR' }],
      },
    },
  ],
  remarks: 'ขอเพิ่มจุดตรวจวัดปล่องใหม่',
};
const officerAddPointExample = {
  ...addPointExample,
  submissionAction: 'REQUEST_FACTORY_REVISION',
  revisionReason: 'กรุณาตรวจสอบและแก้ไขรายละเอียดจุดตรวจวัด',
  officerNote: 'ตรวจสอบแบบฟอร์มโดยเจ้าหน้าที่แล้ว',
};
const addParameterExample = {
  factoryId: 'F000123',
  factoryName: 'โรงงานตัวอย่าง',
  factoryRegistrationNo: 'น.60-1/2560',
  systemType: 'CEMS',
  contactPersons: [
    {
      name: 'สมชาย ใจดี',
      phone: '0812345678',
      email: 'ops@example.com',
      position: 'ผู้ประสานงาน',
    },
  ],
  measurementPoints: [
    {
      pointName: 'ปล่องระบาย A',
      pointCode: 'S2001',
      pointType: 'STACK',
      details: {
        monitoringPointKind: 'CEMS',
        pendingParameters: ['CO (ppm)'],
        requestedParameters: ['CO (ppm)'],
        stackShape: 'วงกลม',
        stackDiameter: 1.2,
        hasTreatmentSystem: 'มี',
        treatmentSystem: 'ระบบดักจับฝุ่น',
        connectionDevice: 'POMS Box (กรอ.)',
      },
      documentsAndImages: [],
      measurementInstruments: {
        converterBrand: 'Converter Brand',
        converterModel: 'CV-100',
        parameters: [{ parameter: 'CO (ppm)', technique: 'NDIR' }],
      },
    },
  ],
};
const directConnectionExample = {
  factoryId: 'F000123',
  factoryRegistrationNo: null,
  systemType: 'CEMS',
  submissionAction: 'CONNECT',
  contactName: null,
  contactPhone: null,
  contactEmail: null,
  contactPersons: null,
  measurementPoints: [
    {
      pointName: null,
      pointCode: 'S1128',
      pointType: null,
      parameters: null,
      details: null,
      documentsAndImages: null,
      measurementInstruments: null,
    },
  ],
  remarks: null,
};
const deviceConnectionExample = {
  stationId: 'S2001',
  deviceCode: 'S2001/01',
  protocol: 'MSSQL',
  settings: {
    hostIp: '10.0.0.10',
    port: 1433,
    dbUser: 'poms_reader',
    dbPass: 'test-only-placeholder',
    dbName: 'POMS',
  },
  channels: [{ dataType: 'CO (ppm)', addressId: 1, testMode: true }],
  statusManagement: null,
};
const annualDeviceConnectionExample = {
  ...deviceConnectionExample,
  stationId: 'CEMS-0001/2569',
  deviceCode: 'CEMS-0001/2569/01',
};
const componentSchemas: Record<string, OpenApiObject> = {
  ErrorEnvelope: {
    type: 'object',
    additionalProperties: false,
    required: ['success', 'error'],
    properties: {
      success: { type: 'boolean', enum: [false] },
      error: {
        type: 'object',
        required: ['code', 'message'],
        properties: {
          code: {
            type: 'string',
            example: 'VALIDATION_ERROR',
          },
          message: { type: 'string', example: 'Validation failed' },
          issues: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                path: { type: 'array', items: {} },
                pathString: { type: 'string', example: 'measurementPoints.0.pointName' },
                message: { type: 'string' },
              },
            },
          },
        },
      },
    },
  },
  SuccessEnvelope: {
    type: 'object',
    additionalProperties: true,
    required: ['success', 'data'],
    properties: {
      success: { type: 'boolean', enum: [true] },
      data: { nullable: true },
      meta: { type: 'object', additionalProperties: true },
    },
  },
  ConnectionRequestResponse: {
    type: 'object',
    additionalProperties: true,
    required: ['success', 'data'],
    properties: {
      success: { type: 'boolean', enum: [true] },
      data: {
        type: 'object',
        additionalProperties: true,
        required: ['id', 'requestType', 'status'],
        properties: {
          id: { type: 'integer', minimum: 1, example: 101 },
          requestNo: {
            type: 'string',
            description:
              'เลขที่คำขอแบบ opaque string; คำขอใหม่ใช้ CEMS-NNNN/YYYY หรือ WPMS-NNNN/YYYY',
            example: 'WPMS-0001/2569',
          },
          requestType: {
            ...enumSchema(
              ['NEW_CONNECTION', 'ADD_MEASUREMENT_POINT', 'ADD_PARAMETER'],
              CONNECTION_REQUEST_TYPE_LABELS,
              requestTypeDescriptions,
            ),
          },
          requestTypeLabel: { type: 'string', example: 'เพิ่มจุดตรวจวัด' },
          submissionSource: {
            ...enumSchema(['OPERATOR_FORM', 'OFFICER_DIRECT_API'], submissionSourceLabels),
          },
          status: {
            ...enumSchema(
              [
                'PENDING_DESIGN_REVIEW',
                'WAITING_CONNECTION',
                'WAITING_FACTORY_REVISION',
                'REVISED_PENDING_DESIGN_REVIEW',
                'CONNECTION_CONFIRMED',
                'CONNECTED',
                'CANCELED',
              ],
              CONNECTION_REQUEST_STATUS_LABELS,
              requestStatusDescriptions,
            ),
          },
          statusLabel: { type: 'string' },
          measurementPoints: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: true,
              properties: {
                pointName: { type: 'string' },
                pointCode: { type: 'string', nullable: true },
                pointCodeAssignmentMode: {
                  ...enumSchema(
                    ['AUTO', 'MANUAL_LEGACY', 'OFFICER_DIRECT', 'LEGACY_IMPORTED'],
                    pointCodeAssignmentModeLabels,
                  ),
                  nullable: true,
                  description:
                    'Optional; บอกแหล่งที่มาของ pointCode. `AUTO` คือระบบออกรหัส S/P2001-9999, `MANUAL_LEGACY` คือเจ้าหน้าที่ reuse รหัสเดิมช่วง S/P0001-1999, `OFFICER_DIRECT` คือ direct connection, `LEGACY_IMPORTED` คือข้อมูลเดิมที่ import มา',
                },
                pointType: {
                  ...enumSchema(['STACK', 'WASTEWATER', 'OTHER'], measurementPointTypeLabels),
                },
                parameters: { type: 'array', items: { type: 'string' } },
                monitoringPointStatus: monitoringPointStatusSchema(
                  'สถานะระดับจุด; จุดที่ได้รับการยกเว้นทั้งหมดยังเป็น active POMS point และมี parameters ว่างได้',
                ),
              },
            },
          },
        },
      },
    },
  },
  ContactPerson: {
    type: 'object',
    additionalProperties: false,
    required: ['name', 'phone'],
    properties: {
      name: { type: 'string', minLength: 1, maxLength: 255 },
      phone: { type: 'string', minLength: 1, maxLength: 64 },
      email: { type: 'string', format: 'email', maxLength: 255, nullable: true },
      position: { type: 'string', maxLength: 255, nullable: true },
    },
  },
  RequestDocumentImage: {
    type: 'object',
    additionalProperties: false,
    required: ['title'],
    description:
      'แต่ละ row ต้องมี link หรือ fileUrl อย่างน้อยหนึ่งค่า; placeholder ที่ยังไม่มีไฟล์จะถูกละทิ้ง',
    example: {
      title: CONNECTION_REQUEST_DOCUMENT_TITLE.WPMS_OUTSIDE_FACTORY_DISCHARGE_POINT_PHOTO,
      fileName: 'outside-factory-discharge-point.jpg',
      fileUrl: 'https://example.com/uploads/outside-factory-discharge-point.jpg',
      fileType: 'image/jpeg',
      fileSize: 3072,
    },
    properties: {
      title: {
        type: 'string',
        minLength: 1,
        maxLength: 255,
        example: CONNECTION_REQUEST_DOCUMENT_TITLE.WPMS_OUTSIDE_FACTORY_DISCHARGE_POINT_PHOTO,
        description: `ใช้ ${CONNECTION_REQUEST_DOCUMENT_TITLE.WPMS_OUTSIDE_FACTORY_DISCHARGE_POINT_PHOTO} สำหรับช่องภาพถ่ายจุดระบายน้ำทิ้งของ WPMS; ส่งได้ไม่เกิน ${MAX_WPMS_OUTSIDE_FACTORY_DISCHARGE_POINT_PHOTOS} rows ต่อจุดตรวจวัด โดย title อื่นยังรองรับตามเดิม`,
      },
      description: { type: 'string', maxLength: 1000, nullable: true },
      link: {
        type: 'string',
        format: 'uri',
        maxLength: 2048,
        nullable: true,
        description: 'รองรับเฉพาะ http/https',
      },
      fileName: { type: 'string', maxLength: 255, nullable: true },
      fileUrl: {
        type: 'string',
        format: 'uri',
        maxLength: 2048,
        nullable: true,
        description: 'รองรับเฉพาะ http/https',
      },
      fileType: { type: 'string', maxLength: 128, nullable: true },
      fileSize: {
        type: 'integer',
        minimum: 1,
        maximum: 5242880,
        nullable: true,
        description: 'หน่วย byte; สูงสุด 5 MiB',
      },
    },
  },
  CriteriaRangeRow: {
    type: 'object',
    additionalProperties: false,
    required: ['level', 'min', 'max'],
    properties: {
      level: { type: 'string', enum: ['normal', 'warning', 'critical'] },
      min: { type: 'number', nullable: true },
      max: { type: 'number', nullable: true },
    },
  },
  MeasurementCriteria: {
    type: 'object',
    required: ['enabled'],
    properties: {
      enabled: {
        oneOf: [{ type: 'boolean' }, { type: 'string', enum: ['true', 'false'] }],
        description:
          'รับ boolean หรือ string true/false; เมื่อ true backend อาจ derive 3 rows จาก standardValue',
      },
      standardValue: {
        oneOf: [{ type: 'string', minLength: 1, maxLength: 255 }, { type: 'number' }],
        nullable: true,
        description: 'เมื่อมีค่าจริงต้องแปลงเป็น finite positive number ได้',
      },
      rows: {
        type: 'array',
        maxItems: 3,
        items: schemaRef('CriteriaRangeRow'),
        description: 'เมื่อใช้ rows ต้องมี normal, warning และ critical ครบโดยไม่ซ้ำ',
      },
    },
  },
  MeasurementInstrumentParameter: {
    type: 'object',
    additionalProperties: false,
    required: ['parameter'],
    properties: {
      parameter: {
        type: 'string',
        minLength: 1,
        maxLength: 128,
        example: 'CO (ppm)',
        description: 'ชื่อพารามิเตอร์พร้อมหน่วย',
      },
      technique: nullableString(255, 'Optional'),
      range: nullableString(255, 'Optional'),
      brand: nullableString(255, 'Optional'),
      supplier: nullableString(255, 'Optional'),
      eiaStandard: nullableString(255, 'Optional'),
      standardCondition: { type: 'boolean', nullable: true },
      dryBasis: { type: 'boolean', nullable: true },
      oxygenOrExcessAir: { type: 'boolean', nullable: true },
      standardCriteria: nullableRef('MeasurementCriteria'),
      eiaCriteria: nullableRef('MeasurementCriteria'),
    },
  },
  MeasurementInstruments: {
    type: 'object',
    additionalProperties: false,
    properties: {
      converterBrand: nullableString(255, 'Optional'),
      converterModel: nullableString(255, 'Optional'),
      parameters: {
        type: 'array',
        maxItems: 100,
        items: schemaRef('MeasurementInstrumentParameter'),
        default: [],
      },
    },
  },
  MeasurementPointDetails: {
    type: 'object',
    additionalProperties: true,
    description:
      'Generic JSON record: key ยาว 1-128; array แต่ละระดับสูงสุด 100 รายการ และมี business rules ตาม systemType',
    properties: {
      monitoringPointKind: { ...enumSchema(['CEMS', 'WPMS'], systemTypeLabels) },
      eligibleParameters: { type: 'array', items: { type: 'string' }, maxItems: 100 },
      exemptedParameters: { type: 'array', items: { type: 'string' }, maxItems: 100 },
      connectedParameters: { type: 'array', items: { type: 'string' }, maxItems: 100 },
      pendingParameters: { type: 'array', items: { type: 'string' }, maxItems: 100 },
      requestedParameters: {
        type: 'array',
        items: { type: 'string' },
        maxItems: 100,
        description:
          'ไม่บังคับให้ส่ง pendingParameters; ถ้าส่ง pendingParameters ด้วย ต้องเป็น subset และต้องเป็นชุดเดียวกับ measurementInstruments.parameters',
      },
      timeSharingParameters: {
        type: 'array',
        items: { type: 'string' },
        maxItems: 100,
        description: 'CEMS only',
      },
      hasTreatmentSystem: { type: 'string', enum: ['มี', 'ไม่มี'] },
      treatmentSystem: { type: 'string', maxLength: 1000 },
      treatmentSystemOther: { type: 'string', maxLength: 1000 },
      connectionDevice: { type: 'string', maxLength: 1000 },
      connectionDeviceOther: { type: 'string', maxLength: 1000 },
      stackShape: {
        type: 'string',
        enum: ['วงกลม', 'สี่เหลี่ยม', 'อื่นๆ'],
        description: 'CEMS required',
      },
      stackDiameter: { type: 'number', description: 'Required เมื่อ stackShape = วงกลม' },
      stackWidth: { type: 'number', description: 'Required เมื่อ stackShape = สี่เหลี่ยม' },
      stackLength: { type: 'number', description: 'Required เมื่อ stackShape = สี่เหลี่ยม' },
      stackShapeOther: { type: 'string', description: 'Required เมื่อ stackShape = อื่นๆ' },
      sharedStackCode: { type: 'string', nullable: true },
      legalAnnexNo: {
        type: 'array',
        items: {
          type: 'string',
          enum: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13'],
        },
      },
      exemptedParameterRegulationClauses: {
        type: 'string',
        enum: ['ไม่มี', '4(1)', '4(2)', '11(3)', 'อื่นๆ'],
      },
      exemptedParameterRegulationClauseOther: {
        type: 'string',
        maxLength: 500,
        nullable: true,
        description: 'Required เมื่อ exemptedParameterRegulationClauses = อื่นๆ',
      },
      primaryFuel: { type: 'string' },
      primaryFuelOther: { type: 'string' },
      primaryFuelPercent: { type: 'number', nullable: true },
      secondaryFuel: { type: 'string' },
      secondaryFuelOther: { type: 'string' },
      secondaryFuelPercent: { type: 'number', nullable: true },
      combustionControlSystem: {
        type: 'string',
        enum: ['ระบบปิด', 'ระบบเปิด', 'ควบคุมอัตโนมัติ'],
      },
      averageWastewaterDischarge: { type: 'number', description: 'WPMS only' },
      maxTreatmentCapacity: {
        type: 'number',
        description: 'WPMS required เมื่อ hasTreatmentSystem = มี',
      },
      instrumentLatitude: { type: 'number', minimum: -90, maximum: 90 },
      instrumentLongitude: { type: 'number', minimum: -180, maximum: 180 },
      wastewaterSource: { type: 'string' },
    },
  },
  MeasurementPoint: {
    type: 'object',
    additionalProperties: false,
    required: ['pointName'],
    properties: {
      pointName: { type: 'string', minLength: 1, maxLength: 255 },
      pointCode: { type: 'string', minLength: 1, maxLength: 64, nullable: true },
      pointType: {
        ...enumSchema(['STACK', 'WASTEWATER', 'OTHER'], measurementPointTypeLabels),
        description: 'Required หาก backend infer จาก monitoringPointKind หรือ legacy type ไม่ได้',
      },
      latitude: nullableNumber(-90, 90, 'Optional'),
      longitude: nullableNumber(-180, 180, 'Optional'),
      parameters: {
        type: 'array',
        minItems: 1,
        maxItems: 50,
        items: { type: 'string', minLength: 1, maxLength: 64 },
        description: 'Backend split comma, dedupe และตัดค่า ไม่มี',
      },
      description: nullableString(1000, 'Optional'),
      monitoringPointStatus: monitoringPointStatusSchema(
        'Optional สถานะระดับจุด; ค่าว่าง normalize เป็น null',
      ),
      details: nullableRef('MeasurementPointDetails'),
      documentsAndImages: {
        type: 'array',
        maxItems: 50,
        items: schemaRef('RequestDocumentImage'),
      },
      measurementInstruments: nullableRef('MeasurementInstruments'),
    },
  },
  AddPointMeasurementPoint: {
    type: 'object',
    additionalProperties: false,
    required: ['pointName', 'details', 'measurementInstruments'],
    properties: {
      pointName: { type: 'string', minLength: 1, maxLength: 255 },
      pointCode: {
        type: 'string',
        minLength: 1,
        maxLength: 64,
        nullable: true,
        description: 'Optional; backend clear pending pointCode ก่อนบันทึก',
      },
      pointType: {
        ...enumSchema(['STACK', 'WASTEWATER', 'OTHER'], measurementPointTypeLabels),
        description: 'CEMS ต้องเป็น STACK; WPMS ต้องเป็น WASTEWATER',
      },
      latitude: nullableNumber(-90, 90, 'Optional'),
      longitude: nullableNumber(-180, 180, 'Optional'),
      parameters: {
        type: 'array',
        minItems: 0,
        maxItems: 50,
        items: { type: 'string', minLength: 1, maxLength: 64 },
        description: 'ส่ง [] ได้สำหรับจุดที่ monitoringPointStatus = ได้รับการยกเว้นทั้งหมด',
      },
      description: nullableString(1000, 'Optional'),
      monitoringPointStatus: monitoringPointStatusSchema(
        'เมื่อเป็น ได้รับการยกเว้นทั้งหมด เจ้าหน้าที่อนุมัติแล้วคำขอไป CONNECTED และสร้าง active point ที่ไม่มีพารามิเตอร์',
      ),
      details: {
        allOf: [schemaRef('MeasurementPointDetails')],
        minProperties: 1,
        description: 'Required, not null และต้องไม่เป็น object ว่าง',
      },
      documentsAndImages: {
        type: 'array',
        maxItems: 50,
        items: schemaRef('RequestDocumentImage'),
        description: 'Required และอย่างน้อย 1 รายการเมื่อ systemType = CEMS; WPMS ส่งว่างได้',
      },
      measurementInstruments: schemaRef('MeasurementInstruments'),
    },
  },
  AddParameterMeasurementPoint: {
    type: 'object',
    additionalProperties: false,
    required: ['pointName', 'pointCode', 'details', 'measurementInstruments'],
    properties: {
      pointName: { type: 'string', minLength: 1, maxLength: 255 },
      pointCode: { type: 'string', minLength: 1, maxLength: 64 },
      pointType: { ...enumSchema(['STACK', 'WASTEWATER', 'OTHER'], measurementPointTypeLabels) },
      latitude: nullableNumber(-90, 90, 'Optional'),
      longitude: nullableNumber(-180, 180, 'Optional'),
      parameters: {
        type: 'array',
        minItems: 1,
        maxItems: 50,
        items: { type: 'string', minLength: 1, maxLength: 64 },
      },
      description: nullableString(1000, 'Optional'),
      monitoringPointStatus: monitoringPointStatusSchema(
        'สถานะระดับจุดเดิมหรือสถานะใหม่หลังเพิ่มพารามิเตอร์',
      ),
      details: {
        allOf: [schemaRef('MeasurementPointDetails')],
        minProperties: 1,
        description: 'Required, not null และต้องไม่เป็น object ว่าง',
      },
      documentsAndImages: {
        type: 'array',
        maxItems: 50,
        items: schemaRef('RequestDocumentImage'),
        description: 'Optional แม้เป็น CEMS',
      },
      measurementInstruments: schemaRef('MeasurementInstruments'),
    },
  },
  CreateConnectionRequest: {
    type: 'object',
    additionalProperties: false,
    required: ['factoryId', 'factoryName', 'systemType', 'measurementPoints'],
    properties: operatorFormProperties,
    description:
      'หากไม่ส่ง requestType backend ใช้ NEW_CONNECTION; ต้องมี contactPersons หรือคู่ contactName/contactPhone',
  },
  AddMeasurementPointRequest: {
    type: 'object',
    additionalProperties: false,
    required: ['factoryId', 'factoryName', 'systemType', 'measurementPoints'],
    properties: {
      ...dedicatedOperatorFormProperties,
      submissionAction: {
        ...enumSchema(['REQUEST_FACTORY_REVISION', 'CONNECT'], {
          REQUEST_FACTORY_REVISION: 'รอโรงงานแก้ไข',
          CONNECT: 'เชื่อมต่อแล้ว',
        }),
        description:
          'Optional; ใช้เฉพาะ officer/admin flow. หากไม่ส่งจะสร้าง PENDING_DESIGN_REVIEW ตาม flow เดิม',
      },
      revisionReason: nullableString(
        1000,
        'Required เมื่อ submissionAction = REQUEST_FACTORY_REVISION',
      ),
      officerNote: nullableString(1000, 'Optional note จากเจ้าหน้าที่'),
      measurementPoints: {
        type: 'array',
        minItems: 1,
        maxItems: 100,
        items: schemaRef('AddPointMeasurementPoint'),
      },
    },
    description:
      'ห้ามส่ง requestType; backend stamp ADD_MEASUREMENT_POINT. หากไม่ส่ง submissionAction จะสร้าง PENDING_DESIGN_REVIEW; officer/admin เลือก REQUEST_FACTORY_REVISION หรือ CONNECT ได้ โดย CONNECT ต้องมี direct-connect permission, exactly 1 point และ pointCode. คำขอปกติที่ทุกจุดมี monitoringPointStatus = ได้รับการยกเว้นทั้งหมด จะไป CONNECTED ทันทีเมื่อเจ้าหน้าที่ APPROVE_DESIGN/APPROVE_FORM พร้อมสร้าง active point parameters = []',
    example: officerAddPointExample,
  },
  AddParameterRequest: {
    type: 'object',
    additionalProperties: false,
    required: ['factoryId', 'factoryName', 'systemType', 'measurementPoints'],
    properties: {
      ...dedicatedOperatorFormProperties,
      measurementPoints: {
        type: 'array',
        minItems: 1,
        maxItems: 1,
        items: schemaRef('AddParameterMeasurementPoint'),
      },
    },
    description:
      'ห้ามส่ง requestType; backend stamp ADD_PARAMETER. ต้องอ้าง point เดิม exactly 1 point',
    example: addParameterExample,
  },
  PointCodeAssignment: {
    type: 'object',
    additionalProperties: false,
    required: ['measurementPointId', 'assignmentMode'],
    properties: {
      measurementPointId: {
        type: 'integer',
        minimum: 1,
        example: 201,
        description: 'รหัส measurement point ภายในคำขอที่กำลังอนุมัติ',
      },
      assignmentMode: {
        ...enumSchema(['AUTO', 'MANUAL_LEGACY'], {
          AUTO: pointCodeAssignmentModeLabels.AUTO,
          MANUAL_LEGACY: pointCodeAssignmentModeLabels.MANUAL_LEGACY,
        }),
        description:
          'ถ้าเป็น `AUTO` หรือไม่ส่งทั้ง array ระบบจะออกรหัสใหม่ตามลำดับ S/P2001-9999; ถ้าเป็น `MANUAL_LEGACY` ต้องส่ง pointCode และ reason',
      },
      pointCode: {
        type: 'string',
        nullable: true,
        pattern: '^[SP]\\d{4}$',
        example: 'S1054',
        description:
          'Required เมื่อ assignmentMode = MANUAL_LEGACY; ต้องเป็นรหัส legacy รูปแบบ S/P ตามด้วย 4 หลัก, ค่าตัวเลขช่วง 0001-1999 และ prefix ต้องตรงกับ systemType (CEMS = S, WPMS = P)',
      },
      reason: {
        type: 'string',
        maxLength: 500,
        nullable: true,
        example: 'ใช้รหัสเดิมของจุดตรวจวัดเก่าตามทะเบียนโรงงาน',
        description:
          'Required เมื่อ assignmentMode = MANUAL_LEGACY; อธิบายเหตุผลที่ต้อง reuse รหัส legacy',
      },
    },
  },
  ResubmitConnectionRequest: {
    type: 'object',
    additionalProperties: false,
    required: ['factoryId', 'factoryName', 'systemType', 'measurementPoints'],
    properties: operatorFormProperties,
    description:
      'ใช้ requestType เดิมของคำขอ validate; ถ้าส่ง requestType ต้องตรงของเดิม และผู้เรียกต้องเป็น owner ในสถานะ WAITING_FACTORY_REVISION',
    example: addPointExample,
  },
  DirectConnectionMeasurementPoint: {
    type: 'object',
    additionalProperties: false,
    required: ['pointCode'],
    properties: {
      pointName: nullableString(255, 'Optional; default เป็น pointCode'),
      pointCode: { type: 'string', minLength: 1, maxLength: 64 },
      pointType: {
        ...enumSchema(['STACK', 'WASTEWATER', 'OTHER'], measurementPointTypeLabels),
        nullable: true,
        description: 'Default STACK สำหรับ CEMS หรือ WASTEWATER สำหรับ WPMS',
      },
      latitude: nullableNumber(-90, 90, 'Optional'),
      longitude: nullableNumber(-180, 180, 'Optional'),
      parameters: {
        type: 'array',
        maxItems: 50,
        nullable: true,
        items: { type: 'string', minLength: 1, maxLength: 64 },
      },
      description: nullableString(1000, 'Optional'),
      monitoringPointStatus: monitoringPointStatusSchema('Optional สถานะระดับจุด'),
      details: nullableRef('MeasurementPointDetails'),
      documentsAndImages: {
        type: 'array',
        maxItems: 50,
        nullable: true,
        items: schemaRef('RequestDocumentImage'),
      },
      measurementInstruments: nullableRef('MeasurementInstruments'),
    },
  },
  DirectConnectionRequest: {
    type: 'object',
    additionalProperties: false,
    required: ['systemType', 'measurementPoints'],
    anyOf: [
      {
        required: ['factoryId'],
        properties: {
          factoryId: { type: 'string', minLength: 1, maxLength: 64 },
        },
      },
      {
        required: ['factoryRegistrationNo'],
        properties: {
          factoryRegistrationNo: { type: 'string', minLength: 1, maxLength: 64 },
        },
      },
    ],
    description:
      'ต้องมี factoryId หรือ factoryRegistrationNo อย่างน้อยหนึ่งค่า; actor ต้องเป็น officer/admin ที่มี role และ scope ตาม contract. แนะนำให้ client ส่ง submissionAction; หากไม่ส่งทั้ง submissionAction และ status จะใช้ CONNECTED',
    properties: {
      factoryId: nullableString(
        64,
        'Conditional: ต้องมีอย่างน้อย factoryId หรือ factoryRegistrationNo',
      ),
      factoryName: nullableString(500, 'Optional; backend ใช้ชื่อ canonical เมื่อไม่ส่ง'),
      factoryRegistrationNo: nullableString(
        64,
        'Conditional: ต้องมีอย่างน้อย factoryId หรือ factoryRegistrationNo',
      ),
      industryMainOrder: nullableString(128, 'Optional'),
      industryMainOrderLabel: nullableString(500, 'Optional'),
      industrySubOrder: nullableString(128, 'Optional'),
      businessActivity: nullableString(4000, 'Optional'),
      eia: {
        type: 'string',
        enum: ['มี', 'ไม่มี', 'มี IEE', 'มี EIA', 'มี EHIA', 'อื่นๆ'],
        nullable: true,
      },
      eiaOther: nullableString(500, 'Required เมื่อ eia = อื่นๆ'),
      hasEia: { type: 'boolean', nullable: true },
      projectName: nullableString(500, 'Optional'),
      address: nullableString(1000, 'Optional'),
      regionCode: nullableString(64, 'Optional'),
      regionName: nullableString(128, 'Optional'),
      provinceCode: nullableString(32, 'Optional'),
      provinceName: nullableString(128, 'Optional'),
      districtCode: nullableString(32, 'Optional'),
      districtName: nullableString(128, 'Optional'),
      subdistrictCode: nullableString(32, 'Optional'),
      subdistrictName: nullableString(128, 'Optional'),
      industrialEstateCode: nullableString(32, 'Optional'),
      industrialEstateName: nullableString(255, 'Optional'),
      latitude: nullableNumber(-90, 90, 'Optional'),
      longitude: nullableNumber(-180, 180, 'Optional'),
      systemType: { ...enumSchema(['CEMS', 'WPMS'], systemTypeLabels) },
      type: {
        ...enumSchema(['CEMS', 'WPMS'], systemTypeLabels),
        nullable: true,
        description: 'Legacy alias; stripped และไม่เทียบกับ systemType',
      },
      submissionAction: {
        ...enumSchema(['REQUEST_FACTORY_REVISION', 'CONNECT'], {
          REQUEST_FACTORY_REVISION: 'รอโรงงานแก้ไข',
          CONNECT: 'เชื่อมต่อแล้ว',
        }),
        description:
          'Optional และเป็น field ที่แนะนำสำหรับ client; REQUEST_FACTORY_REVISION map เป็น WAITING_FACTORY_REVISION, CONNECT map เป็น CONNECTED. ถ้าส่งพร้อม status ค่าต้องสอดคล้องกัน',
      },
      status: {
        ...enumSchema(['WAITING_FACTORY_REVISION', 'CONNECTED'], {
          WAITING_FACTORY_REVISION: 'รอโรงงานแก้ไข',
          CONNECTED: 'เชื่อมต่อแล้ว',
        }),
        nullable: true,
        description:
          'Optional legacy field สำหรับ backward compatibility; client ใหม่ควรใช้ submissionAction',
      },
      revisionReason: nullableString(1000, 'Required เมื่อผลลัพธ์เป็น WAITING_FACTORY_REVISION'),
      officerNote: nullableString(1000, 'Optional'),
      contactName: nullableString(255, 'Optional; default empty string'),
      contactPhone: nullableString(64, 'Optional; default empty string'),
      contactEmail: { type: 'string', format: 'email', maxLength: 255, nullable: true },
      contactPersons: {
        type: 'array',
        maxItems: 20,
        nullable: true,
        items: schemaRef('ContactPerson'),
      },
      notificationEmails: {
        type: 'array',
        maxItems: 20,
        nullable: true,
        items: { type: 'string', format: 'email', maxLength: 255 },
      },
      officerNotificationEmails: {
        type: 'array',
        maxItems: 20,
        nullable: true,
        items: { type: 'string', format: 'email', maxLength: 255 },
      },
      informationProviderName: nullableString(255, 'Optional'),
      informationProviderPosition: nullableString(255, 'Optional'),
      measurementPoints: {
        type: 'array',
        minItems: 1,
        maxItems: 1,
        items: schemaRef('DirectConnectionMeasurementPoint'),
      },
      remarks: nullableString(1000, 'Optional'),
    },
    example: directConnectionExample,
  },
  DeviceConnectionRange: {
    type: 'object',
    additionalProperties: true,
    properties: {
      min: { type: 'number', nullable: true, default: null },
      max: { type: 'number', nullable: true, default: null },
    },
  },
  DatabaseConnectionSettings: {
    type: 'object',
    nullable: true,
    additionalProperties: true,
    properties: {
      hostIp: { type: 'string', nullable: true },
      port: { type: 'number', nullable: true },
      dbUser: { type: 'string', nullable: true },
      dbPass: {
        type: 'string',
        format: 'password',
        nullable: true,
        writeOnly: true,
        description: 'ห้ามใช้ production secret ในหน้า Swagger',
      },
      dbName: { type: 'string', nullable: true },
      minuteTableName: { type: 'string', nullable: true },
      fiveMinuteTableName: { type: 'string', nullable: true },
      hourlyTableName: { type: 'string', nullable: true },
      valueRange: nullableRef('DeviceConnectionRange'),
    },
  },
  ModbusRtuSettings: {
    type: 'object',
    nullable: true,
    additionalProperties: true,
    properties: {
      comPort: { oneOf: [{ type: 'number' }, { type: 'string' }], nullable: true },
      slaveId: { type: 'number', nullable: true },
      baudRate: { type: 'number', nullable: true },
      parity: { type: 'string', nullable: true },
      stopBits: { type: 'number', nullable: true },
      dataBits: { type: 'number', nullable: true },
      quantity: { type: 'number', nullable: true },
      valueRange: nullableRef('DeviceConnectionRange'),
    },
  },
  ModbusTcpSettings: {
    type: 'object',
    nullable: true,
    additionalProperties: true,
    properties: {
      hostIp: { type: 'string', nullable: true },
      slaveId: { type: 'number', nullable: true },
      port: { type: 'number', nullable: true },
      valueRange: nullableRef('DeviceConnectionRange'),
    },
  },
  DeviceChannel: {
    type: 'object',
    additionalProperties: true,
    required: ['dataType'],
    properties: {
      addressId: { type: 'number', nullable: true, default: null },
      dataType: {
        type: 'string',
        example: 'CO (ppm)',
        description: 'Required เมื่อมี channel row; ใช้ชื่อพารามิเตอร์พร้อมหน่วย',
      },
      unit: { type: 'string', nullable: true },
      valueRange: nullableRef('DeviceConnectionRange'),
      alertLow: { type: 'number', nullable: true },
      alertHigh: { type: 'number', nullable: true },
      testMode: {
        type: 'boolean',
        nullable: true,
        default: false,
        description:
          'ระบุว่า channel อยู่ในโหมดทดสอบ; เมื่อไม่ส่งหรือส่ง null ระบบ normalize เป็น false',
      },
      valueFormat: { type: 'string', nullable: true },
      offset: { type: 'number', nullable: true },
      encoding: { type: 'string', nullable: true },
      status: {
        type: 'string',
        enum: [
          'Normal',
          'Calibration',
          'Defective',
          'Maintenance',
          'Start up',
          'Shut Down',
          'No Discharge',
          'Turnaround',
          'Etc.',
        ],
        nullable: true,
      },
    },
  },
  StatusSchedule: {
    type: 'object',
    additionalProperties: true,
    required: ['selectedParameters', 'startAt', 'endAt', 'status'],
    properties: {
      selectedParameters: {
        type: 'array',
        minItems: 1,
        maxItems: 200,
        items: { type: 'string', minLength: 1, maxLength: 128 },
      },
      startAt: { type: 'string', example: '2026-08-05 08:00:00' },
      endAt: {
        type: 'string',
        example: '2026-08-05 12:00:00',
        description: 'ต้องอยู่หลัง startAt',
      },
      status: {
        type: 'string',
        enum: [
          'Normal',
          'Calibration',
          'Defective',
          'Maintenance',
          'Start up',
          'Shut Down',
          'No Discharge',
          'Turnaround',
          'Etc.',
        ],
      },
    },
  },
  StatusManagement: {
    type: 'object',
    nullable: true,
    additionalProperties: true,
    properties: {
      selectedParameters: {
        type: 'array',
        minItems: 1,
        maxItems: 200,
        nullable: true,
        items: { type: 'string', minLength: 1, maxLength: 128 },
      },
      startAt: { type: 'string', nullable: true },
      endAt: { type: 'string', nullable: true, description: 'ต้องอยู่หลัง startAt' },
      status: {
        type: 'string',
        enum: [
          'Normal',
          'Calibration',
          'Defective',
          'Maintenance',
          'Start up',
          'Shut Down',
          'No Discharge',
          'Turnaround',
          'Etc.',
        ],
        nullable: true,
      },
      schedules: {
        type: 'array',
        maxItems: 100,
        nullable: true,
        items: schemaRef('StatusSchedule'),
        description: 'ช่วงของพารามิเตอร์เดียวกันห้ามทับกัน',
      },
    },
  },
  DeviceConnectionConfig: {
    type: 'object',
    additionalProperties: false,
    required: ['stationId', 'protocol'],
    discriminator: { propertyName: 'protocol' },
    properties: {
      stationId: { type: 'string', minLength: 1, maxLength: 64 },
      deviceCode: { type: 'string', minLength: 1, maxLength: 64, nullable: true },
      protocol: {
        type: 'string',
        enum: ['POMS_BOX', 'MODBUS_RTU', 'MODBUS_TCP', 'MSSQL', 'MYSQL'],
      },
      settings: {
        oneOf: [
          { type: 'object', additionalProperties: true, description: 'POMS_BOX' },
          schemaRef('ModbusRtuSettings'),
          schemaRef('ModbusTcpSettings'),
          schemaRef('DatabaseConnectionSettings'),
        ],
        nullable: true,
        default: {},
      },
      channels: {
        type: 'array',
        maxItems: 200,
        nullable: true,
        default: [],
        items: schemaRef('DeviceChannel'),
      },
      statusManagement: nullableRef('StatusManagement'),
    },
    example: deviceConnectionExample,
  },
  StructuredDeviceConnectionDevice: {
    type: 'object',
    additionalProperties: true,
    required: ['protocol'],
    properties: {
      deviceCode: { type: 'string', minLength: 1, maxLength: 64, nullable: true },
      protocol: {
        type: 'string',
        enum: ['POMS_BOX', 'MODBUS_RTU', 'MODBUS_TCP', 'MSSQL', 'MYSQL'],
      },
      settings: {
        type: 'object',
        nullable: true,
        default: {},
        additionalProperties: true,
      },
    },
  },
  StructuredDeviceConnectionChannel: {
    allOf: [
      schemaRef('DeviceChannel'),
      {
        type: 'object',
        properties: {
          deviceCode: {
            type: 'string',
            minLength: 1,
            maxLength: 64,
            nullable: true,
            description: 'ใช้จับคู่ channel กับ device; ละได้เมื่อมี device เดียว',
          },
        },
      },
    ],
  },
  StructuredDeviceConnectionForm: {
    type: 'object',
    additionalProperties: true,
    required: ['stationId', 'device'],
    properties: {
      stationId: { type: 'string', minLength: 1, maxLength: 64 },
      device: {
        type: 'array',
        minItems: 1,
        maxItems: 50,
        items: schemaRef('StructuredDeviceConnectionDevice'),
      },
      channels: {
        type: 'array',
        nullable: true,
        default: [],
        items: schemaRef('StructuredDeviceConnectionChannel'),
        description: 'หลังจับคู่แล้ว แต่ละ device รับได้ไม่เกิน 200 channels',
      },
      statusManagement: nullableRef('StatusManagement'),
    },
  },
  DeviceConnectionConfigRequest: {
    oneOf: [
      schemaRef('DeviceConnectionConfig'),
      {
        type: 'object',
        additionalProperties: false,
        required: ['configs'],
        properties: {
          configs: {
            type: 'array',
            minItems: 1,
            maxItems: 50,
            items: schemaRef('DeviceConnectionConfig'),
          },
        },
      },
      {
        type: 'object',
        additionalProperties: false,
        required: ['config'],
        description: 'Structured frontend form wrapper',
        properties: { config: schemaRef('StructuredDeviceConnectionForm') },
      },
    ],
  },
  DeviceConnectionTestResponse: {
    type: 'object',
    additionalProperties: false,
    required: ['success', 'data'],
    properties: {
      success: { type: 'boolean', enum: [true] },
      data: {
        type: 'object',
        required: ['success', 'mode', 'protocol', 'stationId', 'message', 'checkedAt'],
        properties: {
          success: { type: 'boolean', enum: [true] },
          mode: {
            type: 'string',
            enum: ['MOCK'],
            description: 'ปัจจุบันยังไม่เชื่อมต่อ transport/database จริง',
          },
          protocol: {
            type: 'string',
            enum: ['POMS_BOX', 'MODBUS_RTU', 'MODBUS_TCP', 'MSSQL', 'MYSQL'],
          },
          stationId: { type: 'string' },
          message: { type: 'string', example: 'Mock connection succeeded' },
          checkedAt: { type: 'string', format: 'date-time' },
          details: { type: 'object', additionalProperties: true },
        },
      },
    },
  },
};
const connectionRequestPaths: Record<string, OpenApiObject> = {
  '/cems-wpms-requests': {
    get: securedOperation({
      tag: 'คำขอเชื่อมต่อ',
      summary: 'อ่านรายการคำขอ',
      operationId: 'listConnectionRequests',
      description: 'Permission: cems_wpms_requests:view',
      parameters: requestListParameters,
    }),
    post: securedOperation({
      tag: 'คำขอเชื่อมต่อ',
      summary: 'สร้างคำขอเชื่อมต่อใหม่',
      operationId: 'createConnectionRequest',
      description:
        'Permission: cems_wpms_requests:edit. ถ้าไม่ส่ง requestType backend ใช้ NEW_CONNECTION',
      requestBody: jsonRequestBody(schemaRef('CreateConnectionRequest'), {
        ...addPointExample,
        requestType: 'NEW_CONNECTION',
      }),
      successStatus: '201',
      successDescription: 'สร้างคำขอแล้ว',
      successSchema: schemaRef('ConnectionRequestResponse'),
    }),
  },
  '/cems-wpms-requests/table-rows': {
    get: securedOperation({
      tag: 'คำขอเชื่อมต่อ',
      summary: 'อ่านรายการคำขอสำหรับตาราง',
      operationId: 'listConnectionRequestTableRows',
      description: 'Permission: cems_wpms_requests:view',
      parameters: requestListParameters,
    }),
  },
  '/cems-wpms-requests/operator-factories': {
    get: securedOperation({
      tag: 'ข้อมูลประกอบฟอร์ม',
      summary: 'อ่านโรงงานของผู้ประกอบการ',
      operationId: 'listOperatorFactories',
      description: 'Permission: factories:view',
      parameters: operatorFactoryParameters,
    }),
  },
  '/cems-wpms-requests/eligible-factories': {
    get: securedOperation({
      tag: 'ข้อมูลประกอบฟอร์ม',
      summary: 'อ่านโรงงานเข้าข่ายสำหรับเจ้าหน้าที่',
      operationId: 'listOfficerEligibleFactories',
      description: 'Permission: cems_wpms_requests:view',
      parameters: operatorFactoryParameters,
    }),
  },
  '/cems-wpms-requests/operator-factory-dashboard': {
    get: {
      tags: ['คำขอเชื่อมต่อ'],
      summary: 'Compatibility route ที่ยกเลิกแล้ว',
      operationId: 'deprecatedOperatorFactoryDashboard',
      deprecated: true,
      description: 'ตอบ 404 เสมอ; ใช้ GET /operator-factory-dashboard แทน',
      security: [{ bearerAuth: [] }],
      responses: {
        '401': { $ref: '#/components/responses/Unauthorized' },
        '404': {
          description: 'Compatibility response ที่ชี้ไป route ใหม่',
          content: {
            'application/json': {
              schema: schemaRef('ErrorEnvelope'),
              example: {
                success: false,
                error: {
                  code: 'NOT_FOUND',
                  message: 'Use GET /api/v1/operator-factory-dashboard',
                },
              },
            },
          },
        },
      },
    },
  },
  '/cems-wpms-requests/factories/{factoryId}/general': {
    get: securedOperation({
      tag: 'ข้อมูลประกอบฟอร์ม',
      summary: 'อ่านข้อมูลทั่วไปของโรงงาน',
      operationId: 'getConnectionRequestFactoryGeneral',
      description: 'Permission: factories:view',
      parameters: [factoryIdPathParameter],
    }),
  },
  '/cems-wpms-requests/connected-measurement-points': {
    get: securedOperation({
      tag: 'จุดตรวจวัด',
      summary: 'อ่านจุดที่เชื่อมต่อแล้วผ่าน alias',
      operationId: 'listConnectedMeasurementPointsAlias',
      description: 'Permission: cems_wpms_requests:view',
      parameters: connectedPointFilterParameters,
    }),
  },
  '/cems-wpms-requests/measurement-points': {
    post: securedOperation({
      tag: 'Flow หลัก',
      summary: 'ขอเพิ่มจุดตรวจวัด',
      operationId: 'createMeasurementPointRequest',
      description:
        'Permission: cems_wpms_requests:edit. ห้ามส่ง requestType; backend stamp ADD_MEASUREMENT_POINT. default เป็น PENDING_DESIGN_REVIEW; officer/admin ส่ง submissionAction=REQUEST_FACTORY_REVISION หรือ CONNECT ได้ โดย CONNECT ต้องมี direct-connect permission เพิ่ม',
      requestBody: jsonRequestBody(schemaRef('AddMeasurementPointRequest'), officerAddPointExample),
      successStatus: '201',
      successDescription: 'สร้างคำขอเพิ่มจุดตรวจวัดแล้ว',
      successSchema: schemaRef('ConnectionRequestResponse'),
      focus: true,
    }),
  },
  '/cems-wpms-requests/direct-connections': {
    post: securedOperation({
      tag: 'Flow หลัก',
      summary: 'เพิ่มจุดตรวจวัดโดยเจ้าหน้าที่',
      operationId: 'createDirectConnection',
      description:
        'Permission: cems_wpms_requests:direct_connect. ต้องเป็น officer/admin ที่มี role monitoring_kpm/admin และ active eligible factory อยู่ใน scope; submissionAction=REQUEST_FACTORY_REVISION สร้างสถานะ WAITING_FACTORY_REVISION และ CONNECT สร้างสถานะ CONNECTED. หากไม่ส่ง action/status จะใช้ CONNECTED',
      requestBody: jsonRequestBody(schemaRef('DirectConnectionRequest'), directConnectionExample),
      successStatus: '201',
      successDescription: 'เพิ่มจุดตรวจวัดและบันทึกสถานะที่เลือกแล้ว',
      successSchema: schemaRef('ConnectionRequestResponse'),
      extraResponses: {
        '409': { $ref: '#/components/responses/Conflict' },
      },
      focus: true,
    }),
  },
  '/cems-wpms-requests/document-images': {
    post: securedOperation({
      tag: 'ข้อมูลประกอบฟอร์ม',
      summary: 'อัปโหลดรูปหรือเอกสารสำหรับฟอร์ม',
      operationId: 'uploadConnectionRequestDocumentImage',
      description:
        'Permission: cems_wpms_requests:edit. ต้องมี file หรือ link อย่างน้อยหนึ่งค่า; file สูงสุด 5 MiB และตรวจ MIME, นามสกุล และ file signature',
      requestBody: {
        required: true,
        content: {
          'multipart/form-data': {
            schema: {
              type: 'object',
              additionalProperties: false,
              anyOf: [{ required: ['file'] }, { required: ['link'] }],
              properties: {
                file: {
                  type: 'string',
                  format: 'binary',
                  description:
                    'Optional เมื่อมี link; 1 byte ถึง 5 MiB; รองรับ .jpg/.jpeg (image/jpeg), .png (image/png), .pdf (application/pdf)',
                },
                title: {
                  type: 'string',
                  example:
                    CONNECTION_REQUEST_DOCUMENT_TITLE.WPMS_OUTSIDE_FACTORY_DISCHARGE_POINT_PHOTO,
                  description: `Optional; ใช้ ${CONNECTION_REQUEST_DOCUMENT_TITLE.WPMS_OUTSIDE_FACTORY_DISCHARGE_POINT_PHOTO} สำหรับช่องรูปจุดระบายน้ำทิ้ง WPMS; trim แล้วถ้าว่าง/ไม่ส่ง backend ใช้ เอกสารและรูปภาพ`,
                },
                description: { type: 'string', nullable: true },
                link: {
                  type: 'string',
                  format: 'uri',
                  minLength: 1,
                  description: 'Optional เมื่อมี file; ต้องเป็น URL แบบ http หรือ https',
                },
              },
            },
          },
        },
      },
      successStatus: '201',
      successDescription: 'อัปโหลดแล้ว',
    }),
  },
  '/cems-wpms-requests/parameters': {
    post: securedOperation({
      tag: 'Flow หลัก',
      summary: 'ขอเพิ่มพารามิเตอร์ให้จุดเดิม',
      operationId: 'createParameterRequest',
      description:
        'Permission: cems_wpms_requests:edit. ห้ามส่ง requestType; backend stamp ADD_PARAMETER. ต้องมี exactly 1 measurement point พร้อม pointCode, details และ measurementInstruments',
      requestBody: jsonRequestBody(schemaRef('AddParameterRequest'), addParameterExample),
      successStatus: '201',
      successDescription: 'สร้างคำขอเพิ่มพารามิเตอร์แล้ว',
      successSchema: schemaRef('ConnectionRequestResponse'),
      focus: true,
    }),
  },
  '/cems-wpms-requests/{id}': {
    get: securedOperation({
      tag: 'คำขอเชื่อมต่อ',
      summary: 'อ่านสรุปคำขอ',
      operationId: 'getConnectionRequestById',
      description: 'Permission: cems_wpms_requests:view',
      parameters: [idPathParameter],
      successSchema: schemaRef('ConnectionRequestResponse'),
    }),
  },
  '/cems-wpms-requests/{id}/detail': {
    get: securedOperation({
      tag: 'คำขอเชื่อมต่อ',
      summary: 'อ่านรายละเอียดเต็มสำหรับ prefill',
      operationId: 'getConnectionRequestDetail',
      description: 'Permission: cems_wpms_requests:view',
      parameters: [idPathParameter],
      successSchema: schemaRef('ConnectionRequestResponse'),
    }),
  },
  '/cems-wpms-requests/{id}/device-configs': {
    get: securedOperation({
      tag: 'ตั้งค่าอุปกรณ์',
      summary: 'อ่านแบบตั้งค่าอุปกรณ์ในคำขอ',
      operationId: 'getConnectionRequestDeviceConfigs',
      description:
        'Permission: cems_wpms_requests:view. ถ้าไม่ส่ง stationId backend ใช้จุดแรกในคำขอ',
      parameters: [
        idPathParameter,
        stringQuery('stationId', 'เลือกจุดตรวจวัด; optional และยาวไม่เกิน 64', false, 64),
      ],
    }),
    post: securedOperation({
      tag: 'ตั้งค่าอุปกรณ์',
      summary: 'บันทึก config อุปกรณ์ในคำขอ',
      operationId: 'saveConnectionRequestDeviceConfigs',
      description:
        'Permission: cems_wpms_requests:edit. รับ config เดี่ยว, batch 1-50 หรือ structured form wrapper',
      parameters: [idPathParameter],
      requestBody: jsonRequestBody(
        schemaRef('DeviceConnectionConfigRequest'),
        deviceConnectionExample,
      ),
      successStatus: '201',
      successDescription: 'บันทึก config แล้ว',
    }),
  },
  '/cems-wpms-requests/{id}/device-configs/{configId}': {
    get: securedOperation({
      tag: 'ตั้งค่าอุปกรณ์',
      summary: 'อ่าน config เดียวในคำขอ',
      operationId: 'getSingleConnectionRequestDeviceConfig',
      description: 'Permission: cems_wpms_requests:view',
      parameters: [idPathParameter, configIdPathParameter],
    }),
  },
  '/cems-wpms-requests/{id}/form': {
    put: securedOperation({
      tag: 'Flow หลัก',
      summary: 'ส่งแบบใหม่หลังถูกแจ้งแก้ไข',
      operationId: 'resubmitConnectionRequestForm',
      description:
        'Permission: cems_wpms_requests:edit + owner. ใช้ได้เฉพาะสถานะ WAITING_FACTORY_REVISION; requestType ถ้าส่งต้องตรงกับคำขอเดิม',
      parameters: [idPathParameter],
      requestBody: jsonRequestBody(schemaRef('ResubmitConnectionRequest'), addPointExample),
      successDescription: 'ส่งแบบแก้ไขแล้วและเปลี่ยนเป็น REVISED_PENDING_DESIGN_REVIEW',
      successSchema: schemaRef('ConnectionRequestResponse'),
      focus: true,
    }),
  },
  '/cems-wpms-requests/{id}/review': {
    post: securedOperation({
      tag: 'พิจารณาคำขอ',
      summary: 'อนุมัติแบบหรือแจ้งแก้ไข',
      operationId: 'reviewConnectionRequest',
      description: 'Permission: cems_wpms_requests:approve',
      parameters: [idPathParameter],
      requestBody: jsonRequestBody(
        {
          oneOf: [
            {
              type: 'object',
              additionalProperties: false,
              required: ['decision'],
              properties: {
                decision: { ...enumSchema(['APPROVE_DESIGN'], reviewDecisionLabels) },
                officerNote: { type: 'string', maxLength: 1000, nullable: true },
                pointCodeAssignments: {
                  type: 'array',
                  minItems: 1,
                  maxItems: 100,
                  items: schemaRef('PointCodeAssignment'),
                  description:
                    'Optional; omission = AUTO ทุกจุด. ถ้าส่ง ต้องระบุทุกจุดที่ยังไม่มีรหัสให้ครบและไม่ซ้ำกัน โดยเลือก AUTO หรือ MANUAL_LEGACY ตอน APPROVE_DESIGN',
                },
              },
            },
            {
              type: 'object',
              additionalProperties: false,
              required: ['decision', 'revisionReason'],
              properties: {
                decision: { ...enumSchema(['REQUEST_REVISION'], reviewDecisionLabels) },
                revisionReason: { type: 'string', minLength: 1, maxLength: 1000 },
                officerNote: { type: 'string', maxLength: 1000, nullable: true },
              },
            },
          ],
          discriminator: { propertyName: 'decision' },
        },
        {
          decision: 'APPROVE_DESIGN',
          officerNote: null,
          pointCodeAssignments: [
            {
              measurementPointId: 201,
              assignmentMode: 'MANUAL_LEGACY',
              pointCode: 'S1054',
              reason: 'ใช้รหัสเดิมของจุดตรวจวัดเก่าตามทะเบียนโรงงาน',
            },
            {
              measurementPointId: 202,
              assignmentMode: 'AUTO',
            },
          ],
        },
      ),
      extraResponses: {
        '409': { $ref: '#/components/responses/Conflict' },
      },
    }),
  },
  '/cems-wpms-requests/{id}/status': {
    post: securedOperation({
      tag: 'พิจารณาคำขอ',
      summary: 'เปลี่ยนสถานะหรือแจ้งแก้ไข',
      operationId: 'changeConnectionRequestStatus',
      description: 'Permission: cems_wpms_requests:approve',
      parameters: [idPathParameter],
      requestBody: jsonRequestBody(
        {
          oneOf: [
            {
              type: 'object',
              additionalProperties: false,
              required: ['action'],
              properties: {
                action: { ...enumSchema(['APPROVE_FORM'], statusActionLabels) },
                officerNote: { type: 'string', maxLength: 1000, nullable: true },
                pointCodeAssignments: {
                  type: 'array',
                  minItems: 1,
                  maxItems: 100,
                  items: schemaRef('PointCodeAssignment'),
                  description:
                    'Optional; omission = AUTO ทุกจุด. ถ้าส่ง ต้องระบุทุกจุดที่ยังไม่มีรหัสให้ครบและไม่ซ้ำกัน โดยเลือก AUTO หรือ MANUAL_LEGACY ตอน APPROVE_FORM',
                },
              },
            },
            {
              type: 'object',
              additionalProperties: false,
              required: ['action', 'revisionReason'],
              properties: {
                action: { ...enumSchema(['REQUEST_REVISION'], statusActionLabels) },
                revisionReason: { type: 'string', minLength: 1, maxLength: 1000 },
                officerNote: { type: 'string', maxLength: 1000, nullable: true },
              },
            },
            {
              type: 'object',
              additionalProperties: false,
              required: ['action', 'revisionReason'],
              properties: {
                action: { ...enumSchema(['RETURN_TO_WAITING_CONNECTION'], statusActionLabels) },
                revisionReason: { type: 'string', minLength: 1, maxLength: 1000 },
                officerNote: { type: 'string', maxLength: 1000, nullable: true },
              },
            },
          ],
          discriminator: { propertyName: 'action' },
        },
        {
          action: 'APPROVE_FORM',
          officerNote: 'ตรวจข้อมูลครบแล้ว',
          pointCodeAssignments: [
            {
              measurementPointId: 201,
              assignmentMode: 'MANUAL_LEGACY',
              pointCode: 'P0188',
              reason: 'ใช้รหัสเดิมของจุดตรวจวัดเก่า',
            },
          ],
        },
      ),
      extraResponses: {
        '409': { $ref: '#/components/responses/Conflict' },
      },
    }),
  },
  '/cems-wpms-requests/{id}/cancel': {
    post: securedOperation({
      tag: 'คำขอเชื่อมต่อ',
      summary: 'ผู้ประกอบการยกเลิกคำขอ',
      operationId: 'cancelConnectionRequest',
      description: 'Permission: cems_wpms_requests:edit + owner; ยกเลิกได้เฉพาะสถานะที่กำหนด',
      parameters: [idPathParameter],
      requestBody: jsonRequestBody(
        {
          type: 'object',
          additionalProperties: false,
          properties: {
            reason: { type: 'string', maxLength: 1000, nullable: true },
          },
        },
        { reason: 'ยุติโครงการติดตั้งระบบตรวจวัด' },
      ),
      extraResponses: { '409': { $ref: '#/components/responses/Conflict' } },
    }),
  },
  '/cems-wpms-requests/{id}/confirm-connection': {
    post: securedOperation({
      tag: 'ตั้งค่าอุปกรณ์',
      summary: 'บันทึกหรือยืนยันการเชื่อมต่อ',
      operationId: 'confirmConnectionRequestConnection',
      description: 'Permission: cems_wpms_requests:edit',
      parameters: [idPathParameter],
      requestBody: jsonRequestBody(
        {
          type: 'object',
          additionalProperties: false,
          properties: {
            action: {
              ...enumSchema(['SAVE', 'CONFIRM'], confirmActionLabels, undefined, {
                default: 'CONFIRM',
              }),
            },
            confirmedAt: { type: 'string', format: 'date-time' },
            note: { type: 'string', maxLength: 1000, nullable: true },
          },
        },
        { action: 'CONFIRM', note: null },
      ),
    }),
  },
  '/cems-wpms-requests/{id}/verify-connection': {
    post: securedOperation({
      tag: 'พิจารณาคำขอ',
      summary: 'เจ้าหน้าที่ตรวจยืนยันการเชื่อมต่อ',
      operationId: 'verifyConnectionRequestConnection',
      description: 'Permission: cems_wpms_requests:approve',
      parameters: [idPathParameter],
      requestBody: jsonRequestBody(
        {
          type: 'object',
          additionalProperties: false,
          properties: {
            verifiedAt: { type: 'string', format: 'date-time' },
            note: { type: 'string', maxLength: 1000, nullable: true },
          },
        },
        { note: 'ตรวจสอบข้อมูลทดสอบแล้ว' },
      ),
    }),
  },
  '/connected-measurement-points': {
    get: securedOperation({
      tag: 'จุดตรวจวัด',
      summary: 'อ่านจุดที่เชื่อมต่อแล้ว',
      operationId: 'listConnectedMeasurementPoints',
      description: 'Permission: cems_wpms_requests:view',
      parameters: connectedPointFilterParameters,
    }),
  },
  '/connected-measurement-points/factories/{factoryId}': {
    get: securedOperation({
      tag: 'จุดตรวจวัด',
      summary: 'อ่านจุดที่เชื่อมต่อแล้วของโรงงาน',
      operationId: 'listConnectedMeasurementPointsForFactory',
      description: 'Permission: cems_wpms_requests:view',
      parameters: [factoryIdPathParameter],
    }),
  },
  '/connected-measurement-points/{stationId}/requests': {
    get: securedOperation({
      tag: 'จุดตรวจวัด',
      summary: 'อ่านประวัติคำขอของจุดตรวจวัด',
      operationId: 'listRequestsForConnectedMeasurementPoint',
      description: 'Permission: cems_wpms_requests:view',
      parameters: [stationIdPathParameter],
    }),
  },
  '/connected-measurement-points/{stationId}/parameter-form': {
    get: securedOperation({
      tag: 'ข้อมูลประกอบฟอร์ม',
      summary: 'อ่าน prefill ฟอร์มเพิ่มพารามิเตอร์',
      operationId: 'getAddParameterFormDetail',
      description: 'Permission: cems_wpms_requests:view',
      parameters: [stationIdPathParameter],
    }),
  },
  '/connected-measurement-points/{stationId}/device-configs': {
    get: securedOperation({
      tag: 'ตั้งค่าอุปกรณ์',
      summary: 'อ่าน config ปัจจุบันของจุดตรวจวัด',
      operationId: 'getCurrentConnectedPointDeviceConfigs',
      description: 'Permission: cems_wpms_requests:view',
      parameters: [stationIdPathParameter],
    }),
    post: securedOperation({
      tag: 'ตั้งค่าอุปกรณ์',
      summary: 'แทนที่ config ปัจจุบันของจุดตรวจวัด',
      operationId: 'saveCurrentConnectedPointDeviceConfigs',
      description:
        'Permission: cems_wpms_requests:edit. stationId ใน body ต้องตรงกับ path; รับ config เดี่ยว, batch หรือ form wrapper',
      parameters: [stationIdPathParameter],
      requestBody: jsonRequestBody(
        schemaRef('DeviceConnectionConfigRequest'),
        deviceConnectionExample,
      ),
      successStatus: '201',
      successDescription: 'แทนที่ config แล้ว',
    }),
  },
  '/connected-measurement-points/{stationId}/{buddhistYear}/requests': {
    get: securedOperation({
      tag: 'จุดตรวจวัด',
      summary: 'อ่านประวัติคำขอของ annual point code (proxy-decoded path)',
      operationId: 'listRequestsForAnnualConnectedMeasurementPoint',
      description:
        'Permission: cems_wpms_requests:view. Compatibility path เมื่อ reverse proxy ถอด %2F ในรหัส เช่น CEMS-0001/2569 ก่อนส่งถึง Express',
      parameters: [annualStationIdPathParameter, buddhistYearPathParameter],
    }),
  },
  '/connected-measurement-points/{stationId}/{buddhistYear}/parameter-form': {
    get: securedOperation({
      tag: 'ข้อมูลประกอบฟอร์ม',
      summary: 'อ่าน prefill เพิ่มพารามิเตอร์ของ annual point code (proxy-decoded path)',
      operationId: 'getAnnualAddParameterFormDetail',
      description:
        'Permission: cems_wpms_requests:view. Compatibility path สำหรับ annual point code ที่ถูกแยกเป็น 2 path segments',
      parameters: [annualStationIdPathParameter, buddhistYearPathParameter],
    }),
  },
  '/connected-measurement-points/{stationId}/{buddhistYear}/device-configs': {
    get: securedOperation({
      tag: 'ตั้งค่าอุปกรณ์',
      summary: 'อ่าน config ของ annual point code (proxy-decoded path)',
      operationId: 'getAnnualConnectedPointDeviceConfigs',
      description:
        'Permission: cems_wpms_requests:view. Compatibility path สำหรับ annual point code ที่ถูกแยกเป็น 2 path segments',
      parameters: [annualStationIdPathParameter, buddhistYearPathParameter],
    }),
    post: securedOperation({
      tag: 'ตั้งค่าอุปกรณ์',
      summary: 'แทนที่ config ของ annual point code (proxy-decoded path)',
      operationId: 'saveAnnualConnectedPointDeviceConfigs',
      description:
        'Permission: cems_wpms_requests:edit. Middleware ประกอบ stationId/buddhistYear กลับเป็น annual point code ก่อนตรวจ body',
      parameters: [annualStationIdPathParameter, buddhistYearPathParameter],
      requestBody: jsonRequestBody(
        schemaRef('DeviceConnectionConfigRequest'),
        annualDeviceConnectionExample,
      ),
      successStatus: '201',
      successDescription: 'แทนที่ config แล้ว',
    }),
  },
  '/parameter-values/tables': {
    get: securedOperation({
      tag: 'ทดสอบข้อมูล',
      summary: 'อ่านรายชื่อตารางข้อมูลที่มีสิทธิ์',
      operationId: 'listParameterValueTables',
      description: 'Permission: cems_wpms_requests:view; ไม่มี input',
    }),
  },
  '/parameter-values/connection-test': {
    get: securedOperation({
      tag: 'ทดสอบข้อมูล',
      summary: 'อ่านข้อมูลทดสอบล่าสุด',
      operationId: 'getParameterConnectionTest',
      description:
        'Permission: cems_wpms_requests:view. คืนล่าสุดไม่เกิน 5 rows และ map values/statuses ด้วยชื่อพารามิเตอร์พร้อมหน่วย',
      parameters: [parameterValueStationIdQuery],
    }),
  },
  '/parameter-values/latest': {
    get: securedOperation({
      tag: 'ทดสอบข้อมูล',
      summary: 'อ่าน raw row ล่าสุด',
      operationId: 'getLatestParameterValue',
      description: 'Permission: cems_wpms_requests:view',
      parameters: [
        parameterValueStationIdQuery,
        enumQuery(
          'interval',
          ['real', '1m', '5m', '60m', '1day', 'test'],
          'ช่วงข้อมูล',
          false,
          'real',
        ),
      ],
    }),
  },
  '/parameter-values': {
    get: securedOperation({
      tag: 'ทดสอบข้อมูล',
      summary: 'อ่าน raw rows ตามช่วงวัน',
      operationId: 'listParameterValues',
      description: 'Permission: cems_wpms_requests:view; startDate ต้องไม่เกิน endDate',
      parameters: [
        parameterValueStationIdQuery,
        enumQuery(
          'interval',
          ['real', '1m', '5m', '60m', '1day', 'test'],
          'ช่วงข้อมูล',
          false,
          'real',
        ),
        {
          name: 'startDate',
          in: 'query',
          required: true,
          description:
            'วันเริ่มรูปแบบ YYYY-MM-DD; runtime ตรวจด้วย Date.parse และไม่บังคับ calendar round-trip',
          schema: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
          example: '2026-08-08',
        },
        {
          name: 'endDate',
          in: 'query',
          required: true,
          description:
            'วันสิ้นสุดรูปแบบ YYYY-MM-DD และต้องไม่น้อยกว่า startDate; runtime ตรวจด้วย Date.parse และไม่บังคับ calendar round-trip',
          schema: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
          example: '2026-08-08',
        },
      ],
    }),
  },
  '/device-connections/test-connection': {
    post: securedOperation({
      tag: 'ทดสอบข้อมูล',
      summary: 'ตรวจ schema และสิทธิ์ของ config ก่อนบันทึก (MOCK)',
      operationId: 'testDeviceConnection',
      description:
        'Permission: cems_wpms_requests:edit. รับ config เดี่ยวเท่านั้น ไม่รับ batch/wrapper. ปัจจุบันตรวจ schema และ station scope แต่ยังไม่เชื่อมต่อ transport/database จริง',
      requestBody: jsonRequestBody(schemaRef('DeviceConnectionConfig'), deviceConnectionExample),
      successDescription: 'ผ่านการตรวจแบบ mock',
      successSchema: schemaRef('DeviceConnectionTestResponse'),
      focus: true,
    }),
  },
};
export const connectionRequestsOpenApiDocument: OpenApiObject = {
  openapi: '3.0.3',
  info: {
    title: 'POMS — API หน้าขอเชื่อมต่อ',
    version: '1.0.0',
    description:
      'OpenAPI สำหรับ 34 canonical route signatures ของเมนูขอเชื่อมต่อ โดยขยาย optional buddhistYear compatibility path เป็น 38 operations เพื่อให้ทดสอบ annual point code ได้ทั้งแบบ encode %2F และแบบ proxy-decoded; ใน canonical set มี 33 API ที่ใช้งานได้ และ 1 compatibility route ที่ตอบ 404 เสมอ\n\nทุก API ต้องใช้ Bearer JWT. กด Authorize แล้วใส่ token (ไม่ต้องพิมพ์คำว่า Bearer หาก UI เติมให้อัตโนมัติ) ก่อนใช้ Try it out. ห้ามใช้ production secrets ในตัวอย่างทดสอบ',
  },
  servers: [
    {
      url: env.API_PREFIX,
      description: 'POMS API prefix ของ environment ปัจจุบัน',
    },
  ],
  tags: [
    { name: 'Flow หลัก', description: '4 flow ที่หน้าแบบคำขอใช้งานโดยตรง' },
    { name: 'คำขอเชื่อมต่อ', description: 'รายการ รายละเอียด และการจัดการคำขอ' },
    { name: 'ข้อมูลประกอบฟอร์ม', description: 'โรงงาน prefill และไฟล์แนบ' },
    { name: 'พิจารณาคำขอ', description: 'งานอนุมัติ แจ้งแก้ไข และยืนยันโดยเจ้าหน้าที่' },
    { name: 'จุดตรวจวัด', description: 'ข้อมูลจุดตรวจวัดที่เชื่อมต่อแล้ว' },
    { name: 'ตั้งค่าอุปกรณ์', description: 'อ่านและบันทึก device config' },
    { name: 'ทดสอบข้อมูล', description: 'API ตรวจข้อมูลและ config หลังกรอกแบบ' },
  ],
  paths: connectionRequestPaths,
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Access token จากระบบ POMS',
      },
    },
    schemas: componentSchemas,
    responses: {
      BadRequest: {
        description: 'Payload/query/path ไม่ผ่าน validation หรือ business state ไม่ถูกต้อง',
        content: { 'application/json': { schema: schemaRef('ErrorEnvelope') } },
      },
      Unauthorized: {
        description: 'ไม่มี Bearer token หรือ token ใช้ไม่ได้',
        content: { 'application/json': { schema: schemaRef('ErrorEnvelope') } },
      },
      Forbidden: {
        description: 'ไม่มี permission, ไม่ใช่ owner หรือข้อมูลอยู่นอก scope',
        content: { 'application/json': { schema: schemaRef('ErrorEnvelope') } },
      },
      NotFound: {
        description: 'ไม่พบ resource หรือ active eligible factory ภายใน scope',
        content: { 'application/json': { schema: schemaRef('ErrorEnvelope') } },
      },
      Conflict: {
        description: 'ข้อมูลขัดแย้ง เช่น pointCode ซ้ำ หรือสถานะไม่รองรับ action',
        content: { 'application/json': { schema: schemaRef('ErrorEnvelope') } },
      },
    },
  },
};
