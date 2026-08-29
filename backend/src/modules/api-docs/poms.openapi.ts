import { env } from '../../config/env';
import {
  ALERT_EVENT_ALERT_TYPES,
  ALERT_EVENT_DISPLAY_SYSTEM_TYPES,
  ALERT_EVENT_NOTIFICATION_STATUSES,
  ALERT_EVENT_SYSTEM_TYPES,
  ALERT_EVENT_THRESHOLD_TYPES,
} from '../alert-events/alert-events.types';
import { BOD_COD_DEVIATION_REPORT_STATUSES } from '../bod-cod-deviations/bod-cod-deviation-reports.types';
import { CONNECTION_REQUEST_EIA_ASSESSMENTS } from '../connection-requests/connection-request-eia';
import { KWP_FORM_STATUSES, KWP_FORM_TYPES } from '../kwp-form-reports/kwp-form-reports.types';
import {
  EDITABLE_LOCATION_SCOPED_PERMISSION_MODULES,
  EDITABLE_PERMISSION_ACTIONS,
} from '../auth/permissions';
import { connectionRequestsOpenApiDocument } from './connection-requests.openapi';
import { MENU_TAGS } from './openapi.shared';
import { decorateWriteRequestValidationDocs } from './request-validation-docs';

type OpenApiObject = Record<string, unknown>;

const baseDocument = connectionRequestsOpenApiDocument as OpenApiObject;

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
  successContentType?: string;
  extraResponses?: OpenApiObject;
  security?: OpenApiObject[];
  deprecated?: boolean;
}

const schemaRef = (name: string): OpenApiObject => ({ $ref: `#/components/schemas/${name}` });
const nullableStringSchema = (maxLength: number): OpenApiObject => ({
  type: 'string',
  maxLength,
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

const multipartRequestBody = (
  schema: OpenApiObject,
  encoding?: Record<string, OpenApiObject>,
  example?: unknown,
): OpenApiObject => ({
  required: true,
  content: {
    'multipart/form-data': {
      schema,
      ...(encoding ? { encoding } : {}),
      ...(example === undefined ? {} : { example }),
    },
  },
});

const successResponse = (
  description: string,
  schema: OpenApiObject = schemaRef('SuccessEnvelope'),
  contentType = 'application/json',
) => ({
  description,
  content:
    contentType === 'none'
      ? undefined
      : {
          [contentType]: {
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

function operation(options: OperationOptions): OpenApiObject {
  const successStatus = options.successStatus ?? '200';
  return {
    tags: [options.tag],
    summary: options.summary,
    operationId: options.operationId,
    ...(options.description ? { description: options.description } : {}),
    ...(options.parameters ? { parameters: options.parameters } : {}),
    ...(options.requestBody ? { requestBody: options.requestBody } : {}),
    ...(options.deprecated ? { deprecated: true } : {}),
    ...(options.security ? { security: options.security } : {}),
    responses: {
      [successStatus]: successResponse(
        options.successDescription ?? 'สำเร็จ',
        options.successSchema,
        options.successContentType,
      ),
      ...standardErrorResponses,
      ...(options.extraResponses ?? {}),
    },
  };
}

function securedOperation(options: OperationOptions): OpenApiObject {
  return operation({ ...options, security: [{ bearerAuth: [] }] });
}

function publicOperation(options: OperationOptions): OpenApiObject {
  return operation({ ...options, security: [] });
}

function apiKeyOperation(
  scheme: 'deviceConfigApiKey' | 'alertEventApiKey' | 'factoryDashboardApiKey',
  options: OperationOptions,
): OpenApiObject {
  return operation({ ...options, security: [{ [scheme]: [] }] });
}

const positiveIntegerPath = (name: string, description: string, example = 1): OpenApiObject => ({
  name,
  in: 'path',
  required: true,
  description,
  schema: { type: 'integer', minimum: 1 },
  example,
});

const stringPath = (
  name: string,
  description: string,
  maxLength = 128,
  example?: string,
): OpenApiObject => ({
  name,
  in: 'path',
  required: true,
  description,
  schema: { type: 'string', minLength: 1, maxLength },
  ...(example ? { example } : {}),
});

const queryString = (
  name: string,
  description: string,
  required = false,
  maxLength?: number,
  pattern?: string,
  format?: string,
): OpenApiObject => ({
  name,
  in: 'query',
  required,
  description,
  schema: {
    type: 'string',
    ...(required ? { minLength: 1 } : {}),
    ...(maxLength ? { maxLength } : {}),
    ...(pattern ? { pattern } : {}),
    ...(format ? { format } : {}),
  },
});

const queryEnum = (
  name: string,
  values: string[],
  description: string,
  required = false,
  defaultValue?: string,
): OpenApiObject => ({
  name,
  in: 'query',
  required,
  description,
  schema: {
    type: 'string',
    enum: values,
    ...(defaultValue ? { default: defaultValue } : {}),
  },
});

const queryInteger = (
  name: string,
  description: string,
  required = false,
  minimum = 1,
  maximum?: number,
): OpenApiObject => ({
  name,
  in: 'query',
  required,
  description,
  schema: {
    type: 'integer',
    minimum,
    ...(maximum === undefined ? {} : { maximum }),
  },
});

const queryBoolean = (name: string, description: string, required = false): OpenApiObject => ({
  name,
  in: 'query',
  required,
  description,
  schema: { type: 'boolean' },
});

const idParameter = positiveIntegerPath('id', 'รหัส resource ต้องเป็นจำนวนเต็มบวก');
const userIdParameter = positiveIntegerPath('id', 'รหัสผู้ใช้ ต้องเป็นจำนวนเต็มบวก', 12);
const formIdParameter = positiveIntegerPath('id', 'รหัสฟอร์ม ต้องเป็นจำนวนเต็มบวก', 9);
const alertEventIdParameter = positiveIntegerPath(
  'id',
  'รหัส alert event ต้องเป็นจำนวนเต็มบวก',
  51,
);
const factoryIdParameter = stringPath(
  'factoryId',
  'รหัสโรงงาน ความยาว 1-64 ตัวอักษร',
  64,
  'F000123',
);
const stationIdParameter = {
  name: 'stationId',
  in: 'path',
  required: true,
  description:
    'รหัสจุดตรวจวัด รองรับ legacy safe identifier หรือ annual code; หากมี / ให้ URL-encode เป็น %2F',
  schema: {
    type: 'string',
    minLength: 1,
    maxLength: 64,
    pattern: '^(?:[A-Za-z][A-Za-z0-9_]*|(?:CEMS|WEMS)-\\d{4,}/\\d{4})$',
  },
  example: 'CEMS-0001/2569',
};
const integrationStationIdParameter = {
  ...stationIdParameter,
  description:
    'รหัสจุดตรวจวัด ความยาว 1-64 ตัวอักษร รองรับ [A-Za-z0-9_-]+ หรือ annual code; หากมี / ให้ URL-encode เป็น %2F',
  schema: {
    type: 'string',
    minLength: 1,
    maxLength: 64,
    pattern: '^(?:[A-Za-z0-9_-]+|(?:CEMS|WEMS)-\\d{4,}/\\d{4})$',
  },
};
const alertMonitoringPointCodeSchema = {
  type: 'string',
  minLength: 1,
  maxLength: 128,
  pattern: '^(?:[A-Za-z0-9_-]+|(?:CEMS|WEMS)-\\d{4,}/\\d{4})$',
};
const annualStationIdParameter = {
  name: 'stationId',
  in: 'path',
  required: true,
  description: 'ส่วนหน้า annual code เมื่อ proxy แยก path เป็นสองส่วน',
  schema: {
    type: 'string',
    maxLength: 59,
    pattern: '^(?:CEMS|WEMS)-\\d{4,}$',
  },
  example: 'CEMS-0001',
};
const buddhistYearParameter = {
  name: 'buddhistYear',
  in: 'path',
  required: true,
  description: 'ปี พ.ศ. 4 หลักที่ middleware นำไปประกอบกลับกับ stationId',
  schema: { type: 'string', pattern: '^\\d{4}$' },
  example: '2569',
};
const factoryRegistrationNoParameter = {
  name: 'registrationNo',
  in: 'path',
  required: true,
  description: 'เลขทะเบียนโรงงานใหม่ 14 หลักของโรงงาน current/live ที่เชื่อมต่อ POMS แล้ว',
  schema: { type: 'string', pattern: '^\\d{14}$' },
  example: '40100007125560',
};
const publicAttachmentIdParameter = {
  name: 'publicId',
  in: 'path',
  required: true,
  description: 'UUID public id ของไฟล์แนบที่ backend ออกให้',
  schema: { type: 'string', format: 'uuid' },
  example: '550e8400-e29b-41d4-a716-446655440000',
};
const expiresParameter = {
  name: 'expires',
  in: 'query',
  required: true,
  description: 'Unix timestamp seconds ที่เซ็นมากับ signed URL',
  schema: { type: 'string', pattern: '^\\d{10}$' },
};
const signatureParameter = {
  name: 'signature',
  in: 'query',
  required: true,
  description: 'HMAC signature แบบ base64url ที่ backend ออกให้',
  schema: { type: 'string', minLength: 43, maxLength: 128 },
};

const systemTypeValues = [...ALERT_EVENT_SYSTEM_TYPES];
const pomsMembershipStatusValues = ['IN_POMS', 'NOT_IN_POMS'];
const isoDatePattern = '^\\d{4}-\\d{2}-\\d{2}$';
const yearMonthPattern = '^\\d{4}-(?:0[1-9]|1[0-2])$';
const fourDigitYearPattern = '^(?!0000)\\d{4}$';
const kwpDateOrHourSchema = {
  oneOf: [
    { type: 'string', format: 'date', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
    {
      type: 'string',
      pattern: '^\\d{4}-\\d{2}-\\d{2}T(?:[01]\\d|2[0-3]):00:00$',
    },
  ],
  nullable: true,
  description: 'วันที่จริงรูปแบบ YYYY-MM-DD หรือ local hour YYYY-MM-DDTHH:00:00',
};
const protocolValues = ['POMS_BOX', 'MODBUS_RTU', 'MODBUS_TCP', 'MSSQL', 'MYSQL'];
const pomsFactoryEditRequestStatusValues = [
  'PENDING_REVIEW',
  'REVISION_REQUESTED',
  'REVISED_PENDING_REVIEW',
  'APPROVED',
  'REJECTED',
];
const pomsFactoryEditDecisionValues = ['APPROVE', 'REQUEST_REVISION', 'REJECT'];
const parameterStatusValues = [
  'Normal',
  'Calibration',
  'Defective',
  'Maintenance',
  'Start up',
  'Shut Down',
  'Turnaround',
  'Etc.',
];
const examplePasswordPlaceholder = '<fill-in-password>';

const loginExample = {
  userType: 'operator',
  username: '1111111111111',
  password: examplePasswordPlaceholder,
};

const createLocalAccountExample = {
  user: {
    fullName: 'เจ้าหน้าที่ กกพ.',
    username: 'erc_officer',
    password: examplePasswordPlaceholder,
    department: '',
    lineNameTh: '',
    levelNameTh: '',
    roleCodes: ['erc_office'],
    userType: 'officer',
    isActive: true,
  },
  permissions: {},
};

const createManagedUserExample = {
  username: 'api_officer_01',
  externalId: '1234567890123',
  userType: 'officer',
  firstName: 'สมชาย',
  lastName: 'ใจดี',
  email: 'officer@example.com',
  phone: '0812345678',
  isActive: true,
  roleCodes: ['monitoring_5_centers'],
  profile: {
    lineNameTh: 'นักวิทยาศาสตร์',
    levelNameTh: 'ชำนาญการ',
    provinceName: 'ชลบุรี',
    regionalAccess: { regions: ['ภาคตะวันออก'] },
  },
};

const updateManagedUserExample = {
  user: {
    fullName: 'สมชาย แก้ไข',
    username: 'local_officer',
    roles: 'monitoring_5_centers',
    isActive: true,
    regionName: 'ภาคตะวันออก',
  },
  permissions: {
    dashboard: {
      data: 'IN_REGION',
      view: true,
      export: true,
      region: 'ภาคตะวันออก',
    },
  },
};

const replacePermissionsExample = {
  permissions: [
    {
      code: 'dashboard.stats:export',
      effect: 'allow',
      scope: 'IN_REGION',
      region: 'ภาคตะวันออก',
    },
    {
      code: 'factories:edit',
      effect: 'deny',
    },
  ],
};

const permissionDataScopeSchema: OpenApiObject = {
  type: 'string',
  enum: ['ALL', 'IN_REGION', 'IN_PROVINCE', 'IN_ESTATE', 'OWN_FACTORY', 'FACTORY_TYPE_88'],
  nullable: true,
};

function editablePermissionGroupSchema(module: string, complete: boolean): OpenApiObject {
  const actions = EDITABLE_PERMISSION_ACTIONS[module as keyof typeof EDITABLE_PERMISSION_ACTIONS];
  const isLocationScoped = EDITABLE_LOCATION_SCOPED_PERMISSION_MODULES.has(module);
  const properties: Record<string, OpenApiObject> = {
    ...(isLocationScoped
      ? {
          data: permissionDataScopeSchema,
          region: { type: 'string', maxLength: 128, nullable: true },
          province: { type: 'string', maxLength: 128, nullable: true },
        }
      : {}),
    ...Object.fromEntries(actions.map((action) => [action, { type: 'boolean' }])),
  };

  return {
    type: 'object',
    additionalProperties: false,
    ...(complete
      ? { required: [...(isLocationScoped ? ['data', 'region', 'province'] : []), ...actions] }
      : isLocationScoped
        ? { required: ['data'] }
        : {}),
    properties,
  };
}

function editablePermissionGroupsSchema(complete: boolean): OpenApiObject {
  const modules = Object.keys(EDITABLE_PERMISSION_ACTIONS);
  return {
    type: 'object',
    additionalProperties: false,
    ...(complete ? { required: modules } : {}),
    properties: Object.fromEntries(
      modules.map((module) => [module, editablePermissionGroupSchema(module, complete)]),
    ),
  };
}

const createEligibleFactoryExample = {
  factoryName: 'บริษัท ตัวอย่าง จำกัด',
  factoryId: 'F000123',
  factoryRegistrationNo: '40100007125560',
  factoryClass: '60',
  factorySubclass: '1',
  address: '89 หมู่ 1 ตำบลบ้านเลน อำเภอบางปะอิน จังหวัดพระนครศรีอยุธยา 13160',
  provinceName: 'พระนครศรีอยุธยา',
  industrialEstateName: null,
  longitude: 100.5,
  latitude: 13.7,
  businessActivity: 'ประกอบกิจการตัวอย่าง',
  operationStatus: 'ดำเนินกิจการ',
  capitalAmount: null,
  machineryHorsepower: 250,
  productionCapacity: null,
  wastewaterDischargeInfo: null,
  boilerCount: 1,
  boilerSizeEach: null,
  fuelUsed: null,
  hasEia: true,
};

const favoriteExample = { isFavorite: true };

const pomsFactoryEditRequestExample = {
  factoryName: 'บริษัท ทดสอบ จำกัด (แก้ไข)',
  factoryAddress: '100 หมู่ 2 ตำบลทดสอบ อำเภอเมือง จังหวัดสระบุรี',
  latitude: 13.7563,
  longitude: 100.5018,
  eia: 'มี',
  eiaOther: null,
  projectName: 'โครงการปรับปรุงใหม่',
  factoryFrontPhotos: [
    {
      title: 'ภาพถ่ายด้านหน้าโรงงาน',
      fileName: 'factory-front.jpg',
      fileUrl: 'https://example.com/uploads/factory-front.jpg',
      fileType: 'image/jpeg',
      fileSize: 204800,
    },
  ],
  factoryLogo: {
    title: 'ตราสัญลักษณ์โรงงาน',
    fileName: 'factory-logo.png',
    fileUrl: 'https://example.com/uploads/factory-logo.png',
    fileType: 'image/png',
    fileSize: 102400,
  },
  note: 'ขอแก้ไขข้อมูลพื้นฐานหลังเชื่อมต่อแล้ว',
};

const pomsFactoryEditReviewExample = {
  decision: 'REQUEST_REVISION',
  revisionReason: 'กรุณาตรวจสอบพิกัดและแนบภาพถ่ายด้านหน้าโรงงานใหม่',
  officerNote: 'ตรวจสอบเอกสารเบื้องต้นแล้ว',
};

const operatorFactoryOverviewExample = {
  success: true,
  data: [
    {
      id: 7,
      eligibleFactoryId: null,
      factoryId: 'F000123',
      factoryName: 'บริษัท โรงงานตัวอย่าง จำกัด',
      newRegistrationNo: '10120000325542',
      oldRegistrationNo: '3-34(3)-3/54นบ',
      factoryLogoUrl: null,
      industryMainOrder: '106',
      industryMainOrderLabel: 'ประเภทโรงงานลำดับที่ 106',
      industrySubOrder: '33',
      eia: null,
      hasEia: null,
      regionCode: null,
      regionName: null,
      provinceCode: '12',
      provinceName: 'นนทบุรี',
      province: 'นนทบุรี',
      address: '39/5 หมู่ 4 ตำบลไทรใหญ่ อำเภอไทรน้อย จังหวัดนนทบุรี 11150',
      latitude: '13.9975',
      longitude: '100.3125',
      districtCode: null,
      districtName: 'ไทรน้อย',
      industrialAreaType: 'OUTSIDE_INDUSTRIAL_ESTATE',
      industrialAreaTypeLabel: 'นอกนิคมอุตสาหกรรม',
      industrialEstateCode: null,
      industrialEstateName: null,
      isEligible: false,
      eligibilityStatus: 'ไม่เข้าข่าย',
      isFavorite: false,
      hasLatestHourlyMeasurement: false,
      monitoringPointCountBySystem: [
        { systemType: 'CEMS', count: 0 },
        { systemType: 'WPMS', count: 0 },
      ],
      status: 'แสดง',
      measurementPoints: [],
      pomsMembershipStatus: 'NOT_IN_POMS',
      pomsMembershipStatusLabel: 'ยังไม่อยู่ในระบบ POMS',
    },
  ],
  meta: {
    total: 1,
    summary: {
      all: 1,
      inPoms: 0,
      connectionInProgress: 1,
      notConnected: 0,
    },
  },
};

const monitoringPointFormExample = {
  factory: {
    eiaInfo: 'อื่นๆ',
    eiaOther: 'รายงานสิ่งแวดล้อมประเภทเฉพาะ',
    projectName: 'โครงการปรับปรุงระบบตรวจวัด',
  },
  points: [
    {
      systemType: 'CEMS',
      pointCode: 'S2001',
      timeSharingParameters: ['NOx (ppm)'],
      sharedStackCode: 'S2002',
      monitoringPointStatus: 'อยู่ระหว่างเชื่อมต่อ',
      attachments: [{ uploadToken: 'mP7bX4qL9nV2cR8tY5kH1fG6dJ3sW0uE_zA4oC9iB7Q' }],
      attachmentLinks: [{ label: 'เอกสารอ้างอิง', url: 'https://example.com/reference' }],
    },
  ],
};

const bodCodReportExample = {
  reportRoundNo: 1,
  reportYear: 2569,
  factoryId: 'FID-001',
  factoryName: 'บริษัท ตัวอย่าง จำกัด',
  factoryRegistrationNo: '10520000225172',
  provinceName: 'กาญจนบุรี',
  connectedMeasurementPointId: 9,
  pointCode: 'WEMS-0001/2569',
  pointName: 'จุดระบายน้ำทิ้ง A',
  selectedParameterCode: 'BOD',
  measurements: [
    {
      sampleDate: '2026-07-01',
      sampleTime: '09:30',
      deviceValueMgL: 12.5,
      labValueMgL: 10,
      standardDeviationMgL: 3,
    },
  ],
  attachments: [],
};

const kwp01Example = {
  factoryId: 'F000123',
  factoryName: 'บริษัท โรงงานตัวอย่าง จำกัด',
  issueReason: 'เครื่องมือหรือเครื่องอุปกรณ์พิเศษขัดข้อง',
  problemDate: '2026-07-01T08:00:00',
  expectedDoneDate: '2026-07-05T06:00:00',
  totalDays: 1,
  unreportedParameters: ['NOx (ppm)', 'SO2 (ppm)'],
};

const kwp03Example = {
  factoryId: 'F000123',
  factoryName: 'บริษัท โรงงานตัวอย่าง จำกัด',
  instruments: ['pH Meter'],
  issueReasons: ['เครื่องมือหรือเครื่องอุปกรณ์พิเศษขัดข้อง'],
  failedParameters: ['BOD (mg/l)'],
  problemDate: '2026-07-01T08:00:00',
  expectedDoneDate: '2026-07-05T06:00:00',
};

const kwp05Example = {
  factoryId: 'F000123',
  factoryName: 'บริษัท โรงงานตัวอย่าง จำกัด',
  businessActivity: 'ประกอบกิจการตัวอย่าง',
  calibrationItems: [
    {
      parameters: ['NOx (ppm)'],
      startDate: '2026-07-01',
      endDate: '2026-07-03',
      result: 'ผ่าน',
      verifierCompany: 'Verifier Co., Ltd.',
    },
  ],
};

const alertEventBatchExample = {
  events: [
    {
      systemType: 'CEMS',
      stationId: 'CEMS-0001/2569',
      pointCode: 'CEMS-0001/2569',
      parameterCode: 'nox',
      unit: 'ppm',
      eventDate: '2026-08-10',
      time: '14:00',
      measuredValue: 120,
      thresholdValue: 80,
      thresholdType: 'STANDARD',
    },
  ],
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

const emailTestExample = {
  subject: 'POMS test email',
  message: 'ตรวจสอบการส่งอีเมลจากระบบทดสอบ',
};

const createRecipientExample = {
  recipientType: 'PROVINCE',
  provinceName: 'ชลบุรี',
  emails: ['officer@example.com'],
};

const componentSchemas: Record<string, OpenApiObject> = {
  LoginRequest: {
    type: 'object',
    additionalProperties: false,
    required: ['userType', 'username', 'password'],
    properties: {
      accountType: { type: 'string', enum: ['poms', 'api'] },
      userType: { type: 'string', enum: ['officer', 'operator', 'citizen'] },
      provider: { type: 'string', enum: ['local'] },
      username: { type: 'string', minLength: 1, maxLength: 64 },
      departmentID: { type: 'string', minLength: 1, maxLength: 32 },
      password: { type: 'string', minLength: 1, maxLength: 128 },
    },
    description:
      'accountType=api + userType=officer ต้องมี departmentID และ username ต้องเป็นเลข 13 หลักหรือขึ้นต้น U',
  },
  AuthSessionResponse: {
    type: 'object',
    additionalProperties: true,
    required: ['user', 'permissions'],
    properties: {
      accessToken: { type: 'string', nullable: true },
      user: { type: 'object', additionalProperties: true },
      permissions: { type: 'object', additionalProperties: true },
    },
  },
  EditablePermissionGroups: {
    ...editablePermissionGroupsSchema(false),
    description:
      'Grouped permissions ที่หน้า Permission Management ส่งได้เท่านั้น; internal RBAC actions ไม่อยู่ใน schema นี้',
  },
  EditablePermissionGroupsResponse: {
    ...editablePermissionGroupsSchema(true),
    description:
      'Grouped permissions แบบเต็มสำหรับหน้า Permission Management; ทุก action เป็น boolean และ binary modules ไม่มี data/region/province',
  },
  ManagedUserEditUser: {
    type: 'object',
    additionalProperties: false,
    required: [
      'accountType',
      'identityProvider',
      'userType',
      'username',
      'fullName',
      'department',
      'lineNameTh',
      'levelNameTh',
      'provinceName',
      'estateCode',
      'regionalAccess',
      'roles',
      'roleCodes',
      'isActive',
      'source',
    ],
    properties: {
      accountType: { type: 'string', enum: ['poms', 'api'] },
      identityProvider: { type: 'string' },
      userType: { type: 'string', enum: ['officer', 'admin'] },
      username: { type: 'string' },
      fullName: { type: 'string' },
      department: { type: 'string', nullable: true },
      lineNameTh: { type: 'string', nullable: true },
      levelNameTh: { type: 'string', nullable: true },
      provinceName: { type: 'string', nullable: true },
      estateCode: { type: 'string', nullable: true },
      regionalAccess: {
        type: 'object',
        nullable: true,
        additionalProperties: false,
        required: ['regions'],
        properties: {
          regions: { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: 1 },
        },
      },
      roles: { type: 'string' },
      roleCodes: { type: 'array', minItems: 1, maxItems: 1, items: { type: 'string' } },
      isActive: { type: 'boolean' },
      source: { type: 'string', enum: ['api', 'created'] },
    },
  },
  ManagedUserEditResponse: {
    type: 'object',
    additionalProperties: false,
    required: ['user', 'permissions'],
    properties: {
      user: schemaRef('ManagedUserEditUser'),
      permissions: schemaRef('EditablePermissionGroupsResponse'),
    },
  },
  LegacyCreateLocalAccountRequest: {
    type: 'object',
    additionalProperties: false,
    required: ['fullName', 'username', 'password', 'roles'],
    properties: {
      fullName: { type: 'string', minLength: 1, maxLength: 255 },
      username: { type: 'string', minLength: 3, maxLength: 64 },
      password: { type: 'string', minLength: 8, maxLength: 128 },
      department: { type: 'string', minLength: 1, maxLength: 255 },
      lineNameTh: { type: 'string', minLength: 1, maxLength: 128 },
      levelNameTh: { type: 'string', minLength: 1, maxLength: 64 },
      provinceId: { type: 'string', minLength: 1, maxLength: 32, nullable: true },
      provinceName: { type: 'string', minLength: 1, maxLength: 128, nullable: true },
      estateCode: { type: 'string', minLength: 1, maxLength: 32, nullable: true },
      regionName: { type: 'string', minLength: 1, maxLength: 128, nullable: true },
      regions: {
        type: 'array',
        maxItems: 1,
        nullable: true,
        items: { type: 'string', minLength: 1, maxLength: 128 },
      },
      regionalAccess: {
        type: 'object',
        nullable: true,
        additionalProperties: false,
        required: ['regions'],
        properties: {
          regions: {
            type: 'array',
            minItems: 1,
            maxItems: 1,
            items: { type: 'string', minLength: 1, maxLength: 128 },
          },
        },
      },
      roles: { type: 'string', minLength: 1, maxLength: 32 },
      userType: { type: 'string', enum: ['officer', 'admin'], default: 'officer' },
      isActive: { type: 'boolean', default: true },
      permissionOverrides: {
        type: 'array',
        maxItems: 200,
        items: schemaRef('PermissionOverride'),
        description: 'ห้ามมี code ซ้ำกัน',
      },
    },
  },
  NestedCreateLocalAccountRequest: {
    type: 'object',
    additionalProperties: false,
    required: ['user'],
    properties: {
      user: {
        type: 'object',
        additionalProperties: false,
        required: ['fullName', 'username', 'password', 'roleCodes'],
        properties: {
          fullName: { type: 'string', minLength: 1, maxLength: 255 },
          username: { type: 'string', minLength: 3, maxLength: 64 },
          password: { type: 'string', minLength: 8, maxLength: 128 },
          department: { type: 'string', maxLength: 255 },
          lineNameTh: { type: 'string', maxLength: 128 },
          levelNameTh: { type: 'string', maxLength: 64 },
          provinceId: { type: 'string', minLength: 1, maxLength: 32, nullable: true },
          provinceName: { type: 'string', minLength: 1, maxLength: 128, nullable: true },
          estateCode: { type: 'string', minLength: 1, maxLength: 32, nullable: true },
          regionName: { type: 'string', minLength: 1, maxLength: 128, nullable: true },
          regions: {
            type: 'array',
            maxItems: 1,
            nullable: true,
            items: { type: 'string', minLength: 1, maxLength: 128 },
          },
          regionalAccess: {
            type: 'object',
            nullable: true,
            additionalProperties: false,
            required: ['regions'],
            properties: {
              regions: {
                type: 'array',
                minItems: 1,
                maxItems: 1,
                items: { type: 'string', minLength: 1, maxLength: 128 },
              },
            },
          },
          roleCodes: {
            type: 'array',
            minItems: 1,
            maxItems: 1,
            items: { type: 'string', minLength: 1, maxLength: 32 },
          },
          userType: { type: 'string', enum: ['officer', 'admin'], default: 'officer' },
          isActive: { type: 'boolean', default: true },
        },
      },
      permissions: schemaRef('EditablePermissionGroups'),
    },
  },
  CreateLocalAccountRequest: {
    oneOf: [
      schemaRef('NestedCreateLocalAccountRequest'),
      schemaRef('LegacyCreateLocalAccountRequest'),
    ],
    description:
      'แนะนำ nested user/permissions ตามหน้า Permission Management; legacy flat payload ยังรองรับเพื่อความเข้ากันได้',
  },
  OfficerProfile: {
    type: 'object',
    additionalProperties: false,
    properties: {
      posNo: { type: 'string', minLength: 1, maxLength: 255, nullable: true },
      pertypeId: { type: 'string', minLength: 1, maxLength: 255, nullable: true },
      pertype: { type: 'string', minLength: 1, maxLength: 255, nullable: true },
      positionTypeId: { type: 'string', minLength: 1, maxLength: 255, nullable: true },
      positionTypeTh: { type: 'string', minLength: 1, maxLength: 255, nullable: true },
      lineId: { type: 'string', minLength: 1, maxLength: 255, nullable: true },
      lineNameTh: { type: 'string', minLength: 1, maxLength: 255, nullable: true },
      levelId: { type: 'string', minLength: 1, maxLength: 255, nullable: true },
      levelNameTh: { type: 'string', minLength: 1, maxLength: 255, nullable: true },
      mpositionId: { type: 'string', minLength: 1, maxLength: 255, nullable: true },
      mposition: { type: 'string', minLength: 1, maxLength: 255, nullable: true },
      organizeId: { type: 'string', minLength: 1, maxLength: 255, nullable: true },
      divisionNameTh: { type: 'string', minLength: 1, maxLength: 255, nullable: true },
      departmentId: { type: 'string', minLength: 1, maxLength: 255, nullable: true },
      ministryId: { type: 'string', minLength: 1, maxLength: 255, nullable: true },
      provinceId: { type: 'string', minLength: 1, maxLength: 255, nullable: true },
      provinceName: { type: 'string', minLength: 1, maxLength: 128, nullable: true },
      estateCode: { type: 'string', minLength: 1, maxLength: 32, nullable: true },
      perStatus: { type: 'string', minLength: 1, maxLength: 255, nullable: true },
      perStatusName: { type: 'string', minLength: 1, maxLength: 255, nullable: true },
      relocationType: { type: 'string', minLength: 1, maxLength: 255, nullable: true },
      relocationName: { type: 'string', minLength: 1, maxLength: 255, nullable: true },
      regionalAccess: {
        type: 'object',
        nullable: true,
        additionalProperties: false,
        required: ['regions'],
        properties: {
          regions: {
            type: 'array',
            minItems: 1,
            maxItems: 1,
            items: { type: 'string', minLength: 1, maxLength: 128 },
          },
        },
      },
    },
  },
  CreateManagedUserRequest: {
    type: 'object',
    additionalProperties: false,
    required: ['username', 'firstName', 'lastName', 'roleCodes'],
    properties: {
      username: { type: 'string', minLength: 3, maxLength: 64 },
      externalId: { type: 'string', minLength: 1, maxLength: 32 },
      userType: { type: 'string', enum: ['officer', 'admin'], default: 'officer' },
      prenameTh: { type: 'string', maxLength: 16, nullable: true },
      firstName: { type: 'string', minLength: 1, maxLength: 128 },
      lastName: { type: 'string', minLength: 1, maxLength: 128 },
      email: { type: 'string', format: 'email', maxLength: 255, nullable: true },
      phone: { type: 'string', maxLength: 32, nullable: true },
      isActive: { type: 'boolean' },
      roleCodes: {
        type: 'array',
        minItems: 1,
        maxItems: 1,
        items: { type: 'string', minLength: 1, maxLength: 32 },
      },
      profile: schemaRef('OfficerProfile'),
    },
  },
  EditResponseUpdateRequest: {
    type: 'object',
    additionalProperties: false,
    required: ['user'],
    properties: {
      user: {
        type: 'object',
        additionalProperties: false,
        required: ['fullName', 'username', 'isActive'],
        properties: {
          accountType: { type: 'string', enum: ['poms', 'api'] },
          identityProvider: { type: 'string', minLength: 1, maxLength: 32 },
          fullName: { type: 'string', minLength: 1, maxLength: 255 },
          username: { type: 'string', minLength: 3, maxLength: 64 },
          password: { type: 'string', minLength: 8, maxLength: 128, nullable: true },
          department: { type: 'string', maxLength: 255, nullable: true },
          lineNameTh: { type: 'string', maxLength: 128, nullable: true },
          levelNameTh: { type: 'string', maxLength: 64, nullable: true },
          provinceName: { type: 'string', maxLength: 128, nullable: true },
          estateCode: { type: 'string', maxLength: 32, nullable: true },
          regionName: { type: 'string', maxLength: 128, nullable: true },
          regions: {
            type: 'array',
            maxItems: 1,
            nullable: true,
            items: { type: 'string', minLength: 1, maxLength: 128 },
          },
          regionalAccess: {
            type: 'object',
            nullable: true,
            additionalProperties: false,
            required: ['regions'],
            properties: {
              regions: {
                type: 'array',
                minItems: 1,
                maxItems: 1,
                items: { type: 'string', minLength: 1, maxLength: 128 },
              },
            },
          },
          roles: { type: 'string', maxLength: 32, nullable: true },
          roleCodes: {
            type: 'array',
            maxItems: 1,
            items: { type: 'string', minLength: 1, maxLength: 32 },
          },
          isActive: { type: 'boolean' },
          source: { type: 'string', enum: ['api', 'created'] },
        },
        description: 'รองรับ contract หน้า edit user ปัจจุบัน',
      },
      permissions: schemaRef('EditablePermissionGroups'),
    },
  },
  LegacyUpdateManagedUserRequest: {
    type: 'object',
    additionalProperties: false,
    minProperties: 1,
    properties: {
      username: { type: 'string', minLength: 3, maxLength: 64 },
      externalId: { type: 'string', minLength: 1, maxLength: 32 },
      userType: { type: 'string', enum: ['officer', 'admin'] },
      prenameTh: { type: 'string', minLength: 1, maxLength: 16, nullable: true },
      firstName: { type: 'string', minLength: 1, maxLength: 128 },
      lastName: { type: 'string', minLength: 1, maxLength: 128 },
      email: { type: 'string', format: 'email', maxLength: 255, nullable: true },
      phone: { type: 'string', minLength: 1, maxLength: 32, nullable: true },
      isActive: { type: 'boolean' },
      roleCodes: {
        type: 'array',
        minItems: 1,
        maxItems: 1,
        items: { type: 'string', minLength: 1, maxLength: 32 },
      },
      profile: schemaRef('OfficerProfile'),
      password: { type: 'string', minLength: 8, maxLength: 128 },
    },
  },
  UpdateManagedUserRequest: {
    oneOf: [schemaRef('LegacyUpdateManagedUserRequest'), schemaRef('EditResponseUpdateRequest')],
    description:
      'รับได้ทั้ง legacy partial payload และ payload รูปแบบหน้า edit ที่มี user/permissions',
  },
  PermissionOverride: {
    type: 'object',
    additionalProperties: false,
    required: ['code', 'effect'],
    properties: {
      code: { type: 'string', minLength: 1, maxLength: 64 },
      effect: { type: 'string', enum: ['allow', 'deny'] },
      scope: {
        type: 'string',
        enum: ['ALL', 'IN_REGION', 'IN_PROVINCE', 'IN_ESTATE', 'OWN_FACTORY', 'FACTORY_TYPE_88'],
        nullable: true,
      },
      region: { type: 'string', minLength: 1, maxLength: 128, nullable: true },
      province: { type: 'string', minLength: 1, maxLength: 128, nullable: true },
      estateCode: { type: 'string', minLength: 1, maxLength: 32, nullable: true },
      estate: { type: 'string', minLength: 1, maxLength: 32, nullable: true },
    },
  },
  PermissionGroup: {
    type: 'object',
    additionalProperties: {
      oneOf: [{ type: 'boolean' }, { type: 'string', nullable: true }],
    },
    properties: {
      data: {
        type: 'string',
        enum: ['ALL', 'IN_REGION', 'IN_PROVINCE', 'IN_ESTATE', 'OWN_FACTORY', 'FACTORY_TYPE_88'],
        nullable: true,
      },
      region: { type: 'string', maxLength: 128, nullable: true },
      province: { type: 'string', maxLength: 128, nullable: true },
      estateCode: { type: 'string', maxLength: 32, nullable: true },
      estate: { type: 'string', maxLength: 32, nullable: true },
    },
    description:
      'Grouped effective permissions สำหรับ runtime/auth และ endpoint raw permission; หน้า Permission Management ใช้ EditablePermissionGroups แทน',
  },
  ReplaceUserPermissionsRequest: {
    type: 'object',
    additionalProperties: false,
    required: ['permissions'],
    properties: {
      permissions: {
        type: 'array',
        maxItems: 200,
        items: schemaRef('PermissionOverride'),
        description: 'ห้ามมี code ซ้ำกัน',
      },
    },
  },
  CreateEligibleFactoryRequest: {
    type: 'object',
    additionalProperties: false,
    required: [
      'factoryName',
      'factoryId',
      'factoryRegistrationNo',
      'factoryClass',
      'factorySubclass',
      'address',
      'provinceName',
      'industrialEstateName',
      'longitude',
      'latitude',
      'businessActivity',
      'operationStatus',
      'capitalAmount',
      'machineryHorsepower',
      'productionCapacity',
      'wastewaterDischargeInfo',
      'boilerCount',
      'boilerSizeEach',
      'fuelUsed',
      'hasEia',
    ],
    properties: {
      factoryName: { type: 'string', minLength: 1, maxLength: 500 },
      factoryId: { type: 'string', minLength: 1, maxLength: 64 },
      factoryRegistrationNo: { type: 'string', minLength: 1, maxLength: 64 },
      factoryClass: { type: 'string', minLength: 1, maxLength: 64, nullable: true },
      factorySubclass: { type: 'string', minLength: 1, maxLength: 64, nullable: true },
      address: { type: 'string', minLength: 1, maxLength: 1000, nullable: true },
      provinceName: { type: 'string', minLength: 1, maxLength: 128 },
      industrialEstateName: { type: 'string', minLength: 1, maxLength: 255, nullable: true },
      longitude: { type: 'number', minimum: -180, maximum: 180, nullable: true },
      latitude: { type: 'number', minimum: -90, maximum: 90, nullable: true },
      businessActivity: { type: 'string', minLength: 1, maxLength: 4000, nullable: true },
      operationStatus: { type: 'string', minLength: 1, maxLength: 64 },
      capitalAmount: { type: 'number', nullable: true },
      machineryHorsepower: { type: 'number', nullable: true },
      productionCapacity: { type: 'string', minLength: 1, maxLength: 500, nullable: true },
      wastewaterDischargeInfo: { type: 'string', minLength: 1, maxLength: 4000, nullable: true },
      boilerCount: { type: 'integer', minimum: 0, maximum: 10000, nullable: true },
      boilerSizeEach: { type: 'string', minLength: 1, maxLength: 500, nullable: true },
      fuelUsed: { type: 'string', minLength: 1, maxLength: 500, nullable: true },
      hasEia: { type: 'boolean', nullable: true },
    },
  },
  OperatorFactoryMeasurementCriteriaRow: {
    type: 'object',
    additionalProperties: false,
    required: ['level', 'min', 'max'],
    properties: {
      level: { type: 'string', enum: ['normal', 'warning', 'critical'] },
      min: { type: 'number', nullable: true },
      max: { type: 'number', nullable: true },
    },
  },
  OperatorFactoryMeasurementCriteria: {
    type: 'object',
    additionalProperties: false,
    required: ['enabled', 'standardValue', 'rows'],
    properties: {
      enabled: { type: 'boolean' },
      standardValue: {
        oneOf: [{ type: 'string' }, { type: 'number' }],
        nullable: true,
      },
      rows: {
        type: 'array',
        items: schemaRef('OperatorFactoryMeasurementCriteriaRow'),
      },
    },
  },
  OperatorFactoryParameterStandard: {
    type: 'object',
    additionalProperties: false,
    required: ['parameter', 'standardCriteria', 'eiaCriteria'],
    properties: {
      parameter: {
        type: 'string',
        description: 'ชื่อพารามิเตอร์พร้อมหน่วย เช่น CO (ppm) หรือ BOD (mg/l)',
      },
      standardCriteria: {
        allOf: [schemaRef('OperatorFactoryMeasurementCriteria')],
        nullable: true,
      },
      eiaCriteria: {
        allOf: [schemaRef('OperatorFactoryMeasurementCriteria')],
        nullable: true,
      },
    },
  },
  OperatorFactoryMeasurementPoint: {
    type: 'object',
    additionalProperties: false,
    required: [
      'stationId',
      'pointName',
      'pointCode',
      'systemType',
      'parameters',
      'parameterStandards',
      'data',
    ],
    properties: {
      stationId: { type: 'string', nullable: true },
      pointName: { type: 'string' },
      pointCode: { type: 'string', nullable: true },
      systemType: { type: 'string', enum: systemTypeValues },
      parameters: {
        type: 'array',
        items: {
          type: 'string',
          description: 'ชื่อพารามิเตอร์พร้อมหน่วย',
        },
      },
      monitoringPointStatus: { type: 'string', nullable: true },
      parameterStandards: {
        type: 'array',
        items: schemaRef('OperatorFactoryParameterStandard'),
      },
      data: {
        type: 'array',
        items: { type: 'object', additionalProperties: true },
      },
    },
  },
  OperatorFactorySystemPointCount: {
    type: 'object',
    additionalProperties: false,
    required: ['systemType', 'count'],
    properties: {
      systemType: { type: 'string', enum: systemTypeValues },
      count: { type: 'integer', minimum: 0 },
    },
  },
  OperatorFactoryOverviewRow: {
    type: 'object',
    additionalProperties: false,
    required: [
      'id',
      'eligibleFactoryId',
      'factoryId',
      'factoryName',
      'newRegistrationNo',
      'oldRegistrationNo',
      'factoryLogoUrl',
      'industryMainOrder',
      'industryMainOrderLabel',
      'industrySubOrder',
      'eia',
      'hasEia',
      'regionCode',
      'regionName',
      'provinceCode',
      'provinceName',
      'province',
      'address',
      'latitude',
      'longitude',
      'districtCode',
      'districtName',
      'industrialAreaType',
      'industrialAreaTypeLabel',
      'industrialEstateCode',
      'industrialEstateName',
      'isEligible',
      'eligibilityStatus',
      'isFavorite',
      'hasLatestHourlyMeasurement',
      'monitoringPointCountBySystem',
      'status',
      'measurementPoints',
      'pomsMembershipStatus',
      'pomsMembershipStatusLabel',
    ],
    properties: {
      id: { type: 'integer', minimum: 1, nullable: true },
      eligibleFactoryId: { type: 'integer', minimum: 1, nullable: true },
      factoryId: { type: 'string' },
      factoryName: { type: 'string' },
      newRegistrationNo: { type: 'string', nullable: true },
      oldRegistrationNo: { type: 'string', nullable: true },
      factoryLogoUrl: { type: 'string', format: 'uri', nullable: true },
      industryMainOrder: { type: 'string', nullable: true },
      industryMainOrderLabel: { type: 'string', nullable: true },
      industrySubOrder: { type: 'string', nullable: true },
      eia: {
        type: 'string',
        enum: CONNECTION_REQUEST_EIA_ASSESSMENTS,
        nullable: true,
      },
      hasEia: { type: 'boolean', nullable: true },
      regionCode: { type: 'string', nullable: true },
      regionName: { type: 'string', nullable: true },
      provinceCode: { type: 'string', nullable: true },
      provinceName: { type: 'string', nullable: true },
      province: { type: 'string', nullable: true },
      address: { type: 'string', nullable: true },
      latitude: { type: 'string', nullable: true },
      longitude: { type: 'string', nullable: true },
      districtCode: { type: 'string', nullable: true },
      districtName: { type: 'string', nullable: true },
      industrialAreaType: {
        type: 'string',
        enum: ['INDUSTRIAL_ESTATE', 'OUTSIDE_INDUSTRIAL_ESTATE'],
        nullable: true,
      },
      industrialAreaTypeLabel: {
        type: 'string',
        enum: ['ในนิคมอุตสาหกรรม', 'นอกนิคมอุตสาหกรรม'],
        nullable: true,
      },
      industrialEstateCode: { type: 'string', nullable: true },
      industrialEstateName: { type: 'string', nullable: true },
      isEligible: { type: 'boolean' },
      eligibilityStatus: { type: 'string', enum: ['เข้าข่าย', 'ไม่เข้าข่าย'] },
      isFavorite: { type: 'boolean' },
      hasLatestHourlyMeasurement: { type: 'boolean' },
      monitoringPointCountBySystem: {
        type: 'array',
        items: schemaRef('OperatorFactorySystemPointCount'),
      },
      status: { type: 'string', enum: ['แสดง'] },
      measurementPoints: {
        type: 'array',
        items: schemaRef('OperatorFactoryMeasurementPoint'),
      },
      pomsMembershipStatus: {
        type: 'string',
        enum: pomsMembershipStatusValues,
        'x-enum-labels': {
          IN_POMS: 'อยู่ในระบบ POMS',
          NOT_IN_POMS: 'ยังไม่อยู่ในระบบ POMS',
        },
      },
      pomsMembershipStatusLabel: {
        type: 'string',
        enum: ['อยู่ในระบบ POMS', 'ยังไม่อยู่ในระบบ POMS'],
      },
    },
  },
  OperatorFactoryOverviewResponse: {
    type: 'object',
    additionalProperties: false,
    required: ['success', 'data', 'meta'],
    properties: {
      success: { type: 'boolean', enum: [true] },
      data: {
        type: 'array',
        items: schemaRef('OperatorFactoryOverviewRow'),
      },
      meta: {
        type: 'object',
        additionalProperties: false,
        required: ['total', 'summary'],
        properties: {
          total: { type: 'integer', minimum: 0 },
          summary: {
            type: 'object',
            additionalProperties: false,
            required: ['all', 'inPoms', 'connectionInProgress', 'notConnected'],
            properties: {
              all: { type: 'integer', minimum: 0 },
              inPoms: { type: 'integer', minimum: 0 },
              connectionInProgress: { type: 'integer', minimum: 0 },
              notConnected: { type: 'integer', minimum: 0 },
            },
          },
        },
      },
    },
    example: operatorFactoryOverviewExample,
  },
  FavoriteRequest: {
    type: 'object',
    additionalProperties: false,
    required: ['isFavorite'],
    properties: {
      isFavorite: { type: 'boolean' },
    },
  },
  PomsFactoryEditableProfileRequest: {
    type: 'object',
    additionalProperties: false,
    required: ['factoryName'],
    minProperties: 1,
    description:
      'ต้องส่ง factoryName ทุกครั้ง; field อื่นที่ไม่ส่งคงค่าเดิม ส่วน null ใช้ล้าง nullable field. latitude และ longitude ต้องส่งมาคู่กัน',
    properties: {
      factoryName: {
        type: 'string',
        minLength: 1,
        maxLength: 500,
        description: 'Required และไม่รับ null',
      },
      factoryAddress: {
        type: 'string',
        minLength: 1,
        maxLength: 1000,
        nullable: true,
        description: 'Optional; omitted = คงค่าเดิม, null = ล้างค่า',
      },
      latitude: {
        type: 'number',
        minimum: -90,
        maximum: 90,
        nullable: true,
        description:
          'Optional; ต้องส่งคู่กับ longitude. omitted = คงค่าเดิม, ส่ง latitude/longitude เป็น null ทั้งคู่ = ล้างพิกัด',
      },
      longitude: {
        type: 'number',
        minimum: -180,
        maximum: 180,
        nullable: true,
        description:
          'Optional; ต้องส่งคู่กับ latitude. omitted = คงค่าเดิม, ส่ง latitude/longitude เป็น null ทั้งคู่ = ล้างพิกัด',
      },
      eia: {
        type: 'string',
        enum: ['มี', 'ไม่มี', 'มี IEE', 'มี EIA', 'มี EHIA', 'อื่นๆ'],
        nullable: true,
        description:
          'Optional; eia = อื่นๆ ต้องส่ง eiaOther. omitted = คงค่าเดิม, null = ล้าง eia และ eiaOther',
      },
      eiaOther: {
        type: 'string',
        minLength: 1,
        maxLength: 500,
        nullable: true,
        description: 'Required เมื่อ eia = อื่นๆ; null ใช้ล้างค่า',
      },
      projectName: {
        type: 'string',
        minLength: 1,
        maxLength: 500,
        nullable: true,
        description: 'Optional; omitted = คงค่าเดิม, null = ล้างค่า',
      },
      factoryFrontPhotos: {
        type: 'array',
        maxItems: 10,
        items: schemaRef('RequestDocumentImage'),
        description: 'Optional; omitted = คงค่าเดิม, [] = ล้างภาพถ่ายด้านหน้าโรงงานทั้งหมด',
      },
      factoryLogo: {
        allOf: [schemaRef('RequestDocumentImage')],
        nullable: true,
        description: 'Optional; omitted = คงค่าเดิม, null = ล้างตราสัญลักษณ์โรงงาน',
      },
      note: {
        type: 'string',
        minLength: 1,
        maxLength: 1000,
        nullable: true,
        description: 'ข้อความประกอบจากโรงงาน; response แสดงเป็น requestNote',
      },
    },
    example: pomsFactoryEditRequestExample,
  },
  PomsFactoryEditReviewRequest: {
    type: 'object',
    additionalProperties: false,
    required: ['decision'],
    properties: {
      decision: { type: 'string', enum: pomsFactoryEditDecisionValues },
      revisionReason: {
        type: 'string',
        minLength: 1,
        maxLength: 1000,
        nullable: true,
        description: 'Required เมื่อ decision = REQUEST_REVISION',
      },
      officerNote: {
        type: 'string',
        minLength: 1,
        maxLength: 1000,
        nullable: true,
        description:
          'Required เมื่อ decision = REJECT; optional เมื่อ decision = APPROVE หรือ REQUEST_REVISION',
      },
    },
    example: pomsFactoryEditReviewExample,
  },
  PomsFactoryProfile: {
    type: 'object',
    additionalProperties: false,
    required: [
      'eligibleFactoryId',
      'factoryId',
      'factoryRegistrationNo',
      'factoryName',
      'factoryAddress',
      'provinceName',
      'industrialEstateName',
      'latitude',
      'longitude',
      'eia',
      'eiaOther',
      'projectName',
      'factoryFrontPhotos',
      'factoryLogo',
      'updatedAt',
    ],
    properties: {
      eligibleFactoryId: { type: 'integer', minimum: 1 },
      factoryId: { type: 'string', minLength: 1, maxLength: 64 },
      factoryRegistrationNo: { type: 'string', minLength: 1, maxLength: 80 },
      factoryName: { type: 'string', minLength: 1, maxLength: 500 },
      factoryAddress: nullableStringSchema(1000),
      provinceName: nullableStringSchema(128),
      industrialEstateName: nullableStringSchema(255),
      latitude: { type: 'number', minimum: -90, maximum: 90, nullable: true },
      longitude: { type: 'number', minimum: -180, maximum: 180, nullable: true },
      eia: {
        type: 'string',
        enum: ['มี', 'ไม่มี', 'มี IEE', 'มี EIA', 'มี EHIA', 'อื่นๆ'],
        nullable: true,
      },
      eiaOther: nullableStringSchema(500),
      projectName: nullableStringSchema(500),
      factoryFrontPhotos: {
        type: 'array',
        maxItems: 10,
        items: schemaRef('RequestDocumentImage'),
      },
      factoryLogo: {
        allOf: [schemaRef('RequestDocumentImage')],
        nullable: true,
      },
      updatedAt: { type: 'string', format: 'date-time' },
    },
  },
  PomsFactorySummary: {
    allOf: [
      schemaRef('PomsFactoryProfile'),
      {
        type: 'object',
        required: ['systemTypes', 'measurementPointCount', 'pendingEditRequestCount'],
        properties: {
          systemTypes: {
            type: 'array',
            minItems: 1,
            maxItems: 2,
            uniqueItems: true,
            items: { type: 'string', enum: systemTypeValues },
          },
          measurementPointCount: { type: 'integer', minimum: 0 },
          pendingEditRequestCount: { type: 'integer', minimum: 0 },
        },
      },
    ],
  },
  PomsMeasurementPoint: {
    type: 'object',
    additionalProperties: false,
    required: [
      'connectedPointId',
      'sourceMeasurementPointId',
      'eligibleFactoryId',
      'factoryId',
      'factoryName',
      'systemType',
      'pointName',
      'pointCode',
      'pointType',
      'parameters',
      'monitoringPointStatus',
      'details',
      'documentsAndImages',
      'measurementInstruments',
      'updatedAt',
    ],
    properties: {
      connectedPointId: { type: 'integer', minimum: 1 },
      sourceMeasurementPointId: { type: 'integer', minimum: 1 },
      eligibleFactoryId: { type: 'integer', minimum: 1 },
      factoryId: { type: 'string', minLength: 1, maxLength: 64 },
      factoryName: { type: 'string', minLength: 1, maxLength: 500 },
      systemType: { type: 'string', enum: systemTypeValues },
      pointName: { type: 'string', minLength: 1, maxLength: 255 },
      pointCode: nullableStringSchema(64),
      pointType: { type: 'string', enum: ['STACK', 'WASTEWATER', 'OTHER'] },
      parameters: {
        type: 'array',
        maxItems: 100,
        items: {
          type: 'string',
          minLength: 1,
          maxLength: 255,
          description: 'ชื่อพารามิเตอร์สำหรับแสดงผลพร้อมหน่วย เช่น CO (ppm)',
        },
      },
      monitoringPointStatus: { type: 'string', nullable: true },
      details: { type: 'object', nullable: true, additionalProperties: true },
      documentsAndImages: {
        type: 'array',
        maxItems: 50,
        items: schemaRef('RequestDocumentImage'),
      },
      measurementInstruments: { type: 'object', nullable: true, additionalProperties: true },
      updatedAt: { type: 'string', format: 'date-time' },
    },
  },
  PomsFactoryDetail: {
    allOf: [
      schemaRef('PomsFactorySummary'),
      {
        type: 'object',
        required: ['measurementPoints'],
        properties: {
          measurementPoints: {
            type: 'array',
            items: schemaRef('PomsMeasurementPoint'),
            description:
              'จุดตรวจวัด current/live สำหรับอ่านอย่างเดียว; รุ่นแรกไม่รับแก้ไขผ่าน factory edit request',
          },
        },
      },
    ],
  },
  PomsFactoryEditRequestStatus: {
    type: 'string',
    enum: pomsFactoryEditRequestStatusValues,
  },
  PomsFactoryEditRequestEvent: {
    type: 'object',
    additionalProperties: false,
    required: ['id', 'action', 'fromStatus', 'toStatus', 'note', 'actorUserId', 'createdAt'],
    properties: {
      id: { type: 'integer', minimum: 1 },
      action: {
        type: 'string',
        enum: ['SUBMIT', 'REQUEST_REVISION', 'RESUBMIT', 'APPROVE', 'REJECT'],
      },
      fromStatus: {
        allOf: [schemaRef('PomsFactoryEditRequestStatus')],
        nullable: true,
      },
      toStatus: schemaRef('PomsFactoryEditRequestStatus'),
      note: nullableStringSchema(1000),
      actorUserId: { type: 'integer', minimum: 1 },
      createdAt: { type: 'string', format: 'date-time' },
    },
  },
  PomsFactoryEditRequest: {
    type: 'object',
    additionalProperties: false,
    required: [
      'id',
      'requestNo',
      'eligibleFactoryId',
      'factoryId',
      'factoryRegistrationNo',
      'factoryName',
      'status',
      'statusLabel',
      'revisionNo',
      'isOpen',
      'requestNote',
      'revisionReason',
      'officerNote',
      'currentFactory',
      'proposedFactory',
      'createdBy',
      'submittedBy',
      'reviewedBy',
      'submittedAt',
      'reviewedAt',
      'approvedAt',
      'createdAt',
      'updatedAt',
      'events',
    ],
    properties: {
      id: { type: 'integer', minimum: 1 },
      requestNo: {
        type: 'string',
        minLength: 1,
        maxLength: 40,
        example: 'PFE-20260824-1A2B3C4D',
      },
      eligibleFactoryId: { type: 'integer', minimum: 1 },
      factoryId: { type: 'string', minLength: 1, maxLength: 64 },
      factoryRegistrationNo: { type: 'string', minLength: 1, maxLength: 80 },
      factoryName: { type: 'string', minLength: 1, maxLength: 500 },
      status: schemaRef('PomsFactoryEditRequestStatus'),
      statusLabel: { type: 'string', minLength: 1, maxLength: 128 },
      revisionNo: {
        type: 'integer',
        minimum: 0,
        description: 'เริ่มที่ 0 และเพิ่มเป็น 1 เมื่อ resubmit ครั้งแรก',
      },
      isOpen: { type: 'boolean' },
      requestNote: nullableStringSchema(1000),
      revisionReason: nullableStringSchema(1000),
      officerNote: nullableStringSchema(1000),
      currentFactory: schemaRef('PomsFactoryProfile'),
      proposedFactory: schemaRef('PomsFactoryProfile'),
      createdBy: { type: 'integer', minimum: 1 },
      submittedBy: { type: 'integer', minimum: 1 },
      reviewedBy: { type: 'integer', minimum: 1, nullable: true },
      submittedAt: { type: 'string', format: 'date-time' },
      reviewedAt: { type: 'string', format: 'date-time', nullable: true },
      approvedAt: { type: 'string', format: 'date-time', nullable: true },
      createdAt: { type: 'string', format: 'date-time' },
      updatedAt: { type: 'string', format: 'date-time' },
      events: {
        type: 'array',
        items: schemaRef('PomsFactoryEditRequestEvent'),
        description: 'เรียงจากเหตุการณ์เก่าสุดไปใหม่สุด',
      },
    },
  },
  PomsFactoriesResponse: {
    type: 'object',
    additionalProperties: false,
    required: ['success', 'data', 'meta'],
    properties: {
      success: { type: 'boolean', enum: [true] },
      data: { type: 'array', items: schemaRef('PomsFactorySummary') },
      meta: {
        type: 'object',
        additionalProperties: false,
        required: ['total'],
        properties: { total: { type: 'integer', minimum: 0 } },
      },
    },
  },
  PomsFactoryDetailResponse: {
    type: 'object',
    additionalProperties: false,
    required: ['success', 'data'],
    properties: {
      success: { type: 'boolean', enum: [true] },
      data: schemaRef('PomsFactoryDetail'),
    },
  },
  PomsFactoryEditRequestsResponse: {
    type: 'object',
    additionalProperties: false,
    required: ['success', 'data', 'meta'],
    properties: {
      success: { type: 'boolean', enum: [true] },
      data: { type: 'array', items: schemaRef('PomsFactoryEditRequest') },
      meta: {
        type: 'object',
        additionalProperties: false,
        required: ['total'],
        properties: { total: { type: 'integer', minimum: 0 } },
      },
    },
  },
  PomsFactoryEditRequestResponse: {
    type: 'object',
    additionalProperties: false,
    required: ['success', 'data'],
    properties: {
      success: { type: 'boolean', enum: [true] },
      data: schemaRef('PomsFactoryEditRequest'),
    },
  },
  DeviceConnectionChannel: {
    type: 'object',
    additionalProperties: true,
    required: ['dataType'],
    properties: {
      addressId: { type: 'number', nullable: true },
      dataType: { type: 'string', minLength: 1 },
      unit: { type: 'string', nullable: true },
      valueRange: {
        type: 'object',
        nullable: true,
        additionalProperties: true,
        properties: {
          min: { type: 'number', nullable: true },
          max: { type: 'number', nullable: true },
        },
      },
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
      status: { type: 'string', enum: parameterStatusValues, nullable: true },
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
      startAt: {
        type: 'string',
        pattern: '^\\d{4}-\\d{2}-\\d{2} \\d{2}:\\d{2}:\\d{2}$',
      },
      endAt: {
        type: 'string',
        pattern: '^\\d{4}-\\d{2}-\\d{2} \\d{2}:\\d{2}:\\d{2}$',
      },
      status: { type: 'string', enum: parameterStatusValues },
    },
  },
  StatusManagement: {
    type: 'object',
    nullable: true,
    additionalProperties: true,
    properties: {
      selectedParameters: {
        type: 'array',
        maxItems: 200,
        items: { type: 'string', minLength: 1, maxLength: 128 },
        nullable: true,
      },
      startAt: {
        type: 'string',
        pattern: '^\\d{4}-\\d{2}-\\d{2} \\d{2}:\\d{2}:\\d{2}$',
        nullable: true,
      },
      endAt: {
        type: 'string',
        pattern: '^\\d{4}-\\d{2}-\\d{2} \\d{2}:\\d{2}:\\d{2}$',
        nullable: true,
      },
      status: { type: 'string', enum: parameterStatusValues, nullable: true },
      schedules: {
        type: 'array',
        maxItems: 100,
        items: schemaRef('StatusSchedule'),
        nullable: true,
      },
    },
    description:
      'startAt/endAt ต้องส่งคู่กันและช่วงเวลาใน schedules ต้องไม่ overlap สำหรับ parameter เดียวกัน',
  },
  DeviceConnectionConfig: {
    type: 'object',
    additionalProperties: false,
    required: ['stationId', 'protocol'],
    properties: {
      stationId: {
        type: 'string',
        minLength: 1,
        maxLength: 64,
      },
      deviceCode: { type: 'string', minLength: 1, maxLength: 64, nullable: true },
      protocol: { type: 'string', enum: protocolValues },
      settings: { type: 'object', nullable: true, default: {}, additionalProperties: true },
      channels: {
        type: 'array',
        maxItems: 200,
        nullable: true,
        default: [],
        items: schemaRef('DeviceConnectionChannel'),
      },
      statusManagement: schemaRef('StatusManagement'),
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
  MonitoringPointAttachmentUploadRequest: {
    type: 'object',
    additionalProperties: false,
    required: ['file'],
    properties: {
      file: {
        type: 'string',
        format: 'binary',
        description: 'ไฟล์ JPEG, PNG หรือ PDF ขนาดไม่เกิน 10 MiB',
      },
    },
  },
  BodCodAttachmentUploadRequest: {
    type: 'object',
    additionalProperties: false,
    required: ['file'],
    properties: {
      file: {
        type: 'string',
        format: 'binary',
        description: 'ไฟล์ JPEG, PNG หรือ PDF ขนาดตั้งแต่ 1 byte ถึง 5 MiB',
      },
    },
  },
  BodCodReportNo: {
    type: 'string',
    maxLength: 40,
    pattern: '^(?:E-(?:02|03|04|05|06|07)-[0-9]{4}/[0-9]{4}|BODCOD-[0-9]{4}-[0-9]{4})$',
    description:
      'เลขที่รายงานแบบ opaque string; รายงาน regional ปัจจุบันใช้ E-RR-NNNN/YYYY ส่วน BODCOD-YYYY-NNNN เป็นรูปแบบ legacy ที่ยังอ่านได้',
    example: 'E-02-0001/2569',
  },
  BodCodNullableReportNo: {
    type: 'string',
    maxLength: 40,
    nullable: true,
    pattern: '^(?:E-(?:02|03|04|05|06|07)-[0-9]{4}/[0-9]{4}|BODCOD-[0-9]{4}-[0-9]{4})$',
    example: 'E-02-0001/2569',
  },
  BodCodReportData: {
    type: 'object',
    additionalProperties: true,
    required: ['id', 'reportNo'],
    properties: {
      id: { type: 'integer', minimum: 1 },
      reportNo: schemaRef('BodCodReportNo'),
    },
  },
  BodCodReportResponse: {
    type: 'object',
    additionalProperties: false,
    required: ['success', 'data'],
    properties: {
      success: { type: 'boolean', enum: [true] },
      data: schemaRef('BodCodReportData'),
    },
  },
  BodCodReportsResponse: {
    type: 'object',
    additionalProperties: false,
    required: ['success', 'data', 'meta'],
    properties: {
      success: { type: 'boolean', enum: [true] },
      data: { type: 'array', items: schemaRef('BodCodReportData') },
      meta: {
        type: 'object',
        additionalProperties: true,
        required: ['total'],
        properties: { total: { type: 'integer', minimum: 0 } },
      },
    },
  },
  BodCodFactoriesResponse: {
    type: 'object',
    additionalProperties: false,
    required: ['success', 'data', 'meta'],
    properties: {
      success: { type: 'boolean', enum: [true] },
      data: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: true,
          properties: {
            latestReportNo: schemaRef('BodCodNullableReportNo'),
            measurementPoints: {
              type: 'array',
              items: {
                type: 'object',
                additionalProperties: true,
                properties: {
                  reportSlots: {
                    type: 'array',
                    items: {
                      type: 'object',
                      additionalProperties: true,
                      properties: {
                        reportNo: schemaRef('BodCodNullableReportNo'),
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      meta: {
        type: 'object',
        additionalProperties: true,
        required: ['total'],
        properties: { total: { type: 'integer', minimum: 0 } },
      },
    },
  },
  MonitoringPointFormRequest: {
    type: 'object',
    additionalProperties: false,
    required: ['factory'],
    description:
      'points เป็น optional และ default []; eiaInfo=อื่นๆ ต้องมี eiaOther; point id ห้ามซ้ำ และ details ห้ามซ้ำ field ที่มี typed property แล้ว',
    properties: {
      factory: {
        type: 'object',
        additionalProperties: false,
        properties: {
          factoryName: { type: 'string', maxLength: 500, nullable: true },
          factoryRegistrationNoNew: { type: 'string', maxLength: 64, nullable: true },
          factoryRegistrationNoOld: { type: 'string', maxLength: 64, nullable: true },
          provinceName: { type: 'string', maxLength: 128, nullable: true },
          factoryTypeMain: { type: 'string', maxLength: 128, nullable: true },
          factoryTypeSub: { type: 'string', maxLength: 128, nullable: true },
          operationStatus: { type: 'string', maxLength: 128, nullable: true },
          eiaInfo: { type: 'string', maxLength: 255, nullable: true },
          eiaOther: { type: 'string', maxLength: 500, nullable: true },
          projectName: { type: 'string', maxLength: 500, nullable: true },
          address: { type: 'string', maxLength: 1000, nullable: true },
          businessActivity: { type: 'string', maxLength: 4000, nullable: true },
          machineryHorsepower: { type: 'number', minimum: 0, nullable: true },
          latitude: { type: 'number', minimum: -90, maximum: 90, nullable: true },
          longitude: { type: 'number', minimum: -180, maximum: 180, nullable: true },
        },
      },
      points: {
        type: 'array',
        maxItems: 100,
        default: [],
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['systemType'],
          properties: {
            id: { type: 'integer', minimum: 1 },
            systemType: { type: 'string', enum: systemTypeValues },
            pointCode: { type: 'string', maxLength: 64, nullable: true },
            pointName: { type: 'string', maxLength: 255, nullable: true },
            productionUnitType: { type: 'string', maxLength: 255, nullable: true },
            productionCapacity: { type: 'string', maxLength: 255, nullable: true },
            cemsInstallationRequiredBy: { type: 'string', maxLength: 255, nullable: true },
            cemsInstallationRequiredOther: { type: 'string', maxLength: 255, nullable: true },
            legalAnnexNo: {
              type: 'array',
              maxItems: 12,
              items: { type: 'string', minLength: 1, maxLength: 32 },
            },
            accountingConnectionStatus: { type: 'string', maxLength: 255, nullable: true },
            eligibleParameters: {
              type: 'array',
              maxItems: 100,
              default: [],
              items: { type: 'string', minLength: 1, maxLength: 255 },
            },
            exemptedParameters: {
              type: 'array',
              maxItems: 100,
              default: [],
              items: { type: 'string', minLength: 1, maxLength: 255 },
            },
            connectedParameters: {
              type: 'array',
              maxItems: 100,
              default: [],
              items: { type: 'string', minLength: 1, maxLength: 255 },
            },
            pendingParameters: {
              type: 'array',
              maxItems: 100,
              default: [],
              items: { type: 'string', minLength: 1, maxLength: 255 },
            },
            timeSharingParameters: {
              type: 'array',
              maxItems: 100,
              default: [],
              items: { type: 'string', minLength: 1, maxLength: 255 },
              description: 'ค่า ไม่มี ห้ามใช้ร่วมกับค่าอื่น',
            },
            sharedStackCode: { type: 'string', maxLength: 64, nullable: true },
            monitoringPointStatus: {
              type: 'string',
              enum: [
                'เชื่อมต่อครบแล้ว',
                'ได้รับการยกเว้นทั้งหมด',
                'เชื่อมต่อแล้วแต่ยังไม่ครบ',
                'อยู่ระหว่างขยายเวลา',
                'ยังไม่ได้ดำเนินการเชื่อมต่อ',
                'อยู่ระหว่างการตรวจสอบของจังหวัด',
                'อยู่ระหว่างเชื่อมต่อ',
              ],
              nullable: true,
            },
            attachmentLinks: {
              type: 'array',
              items: {
                type: 'object',
                additionalProperties: false,
                required: ['url'],
                properties: {
                  label: { type: 'string', maxLength: 255, nullable: true },
                  url: {
                    type: 'string',
                    format: 'uri',
                    maxLength: 2048,
                    pattern: '^https?://',
                  },
                },
              },
            },
            attachments: {
              type: 'array',
              items: {
                oneOf: [
                  {
                    type: 'object',
                    additionalProperties: false,
                    required: ['id'],
                    properties: { id: { type: 'integer', minimum: 1 } },
                  },
                  {
                    type: 'object',
                    additionalProperties: false,
                    required: ['uploadToken'],
                    properties: {
                      uploadToken: {
                        type: 'string',
                        pattern: '^[A-Za-z0-9_-]{43}$',
                      },
                    },
                  },
                ],
              },
            },
            primaryFuel: { type: 'string', maxLength: 255, nullable: true },
            primaryFuelOther: { type: 'string', maxLength: 255, nullable: true },
            secondaryFuel: { type: 'string', maxLength: 255, nullable: true },
            secondaryFuelOther: { type: 'string', maxLength: 255, nullable: true },
            details: { type: 'object', nullable: true, additionalProperties: true },
          },
        },
      },
    },
  },
  BodCodReportRequest: {
    type: 'object',
    additionalProperties: false,
    required: [
      'reportRoundNo',
      'reportYear',
      'factoryName',
      'factoryRegistrationNo',
      'provinceName',
      'selectedParameterCode',
      'measurements',
    ],
    properties: {
      reportRoundNo: { type: 'integer', minimum: 1, maximum: 2 },
      reportYear: { type: 'integer', minimum: 2500, maximum: 2700 },
      factoryId: nullableStringSchema(64),
      factoryName: { type: 'string', minLength: 1, maxLength: 500 },
      factoryRegistrationNo: { type: 'string', minLength: 1, maxLength: 80 },
      businessActivity: nullableStringSchema(255),
      factoryAddress: nullableStringSchema(1000),
      provinceName: { type: 'string', minLength: 1, maxLength: 120 },
      connectedMeasurementPointId: { type: 'integer', minimum: 1, nullable: true },
      pointCode: nullableStringSchema(64),
      pointName: nullableStringSchema(255),
      wastewaterFlowM3PerHour: { type: 'number', nullable: true },
      samplerName: nullableStringSchema(255),
      officerRegistrationNo: nullableStringSchema(80),
      laboratoryName: nullableStringSchema(255),
      laboratoryRegistrationNo: nullableStringSchema(80),
      labReportNo: nullableStringSchema(120),
      analysisMethod: nullableStringSchema(255),
      deviceBrand: nullableStringSchema(120),
      deviceModel: nullableStringSchema(120),
      deviceSerialNo: nullableStringSchema(120),
      selectedParameterCode: { type: 'string', enum: ['BOD', 'COD'] },
      reporterName: nullableStringSchema(255),
      reporterPosition: nullableStringSchema(255),
      measurements: {
        type: 'array',
        minItems: 1,
        maxItems: 50,
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['sampleDate', 'sampleTime', 'deviceValueMgL', 'labValueMgL'],
          properties: {
            sampleDate: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
            sampleTime: { type: 'string', pattern: '^\\d{2}:\\d{2}$' },
            deviceValueMgL: { type: 'number' },
            labValueMgL: { type: 'number' },
            standardDeviationMgL: { type: 'number', nullable: true },
          },
        },
      },
      attachments: {
        type: 'array',
        maxItems: 30,
        default: [],
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['attachmentType', 'originalFileName'],
          properties: {
            attachmentType: {
              type: 'string',
              enum: ['SAMPLE_PHOTO', 'DEVICE_PHOTO', 'LAB_REPORT'],
            },
            originalFileName: { type: 'string', minLength: 1, maxLength: 500 },
            storedFileName: nullableStringSchema(500),
            mimeType: nullableStringSchema(128),
            fileSize: { type: 'integer', minimum: 0, nullable: true },
            storagePath: nullableStringSchema(1000),
          },
        },
      },
    },
  },
  BodCodReportResubmissionRequest: {
    type: 'object',
    additionalProperties: false,
    required: [
      'reportRoundNo',
      'reportYear',
      'factoryName',
      'factoryRegistrationNo',
      'provinceName',
      'selectedParameterCode',
      'measurements',
    ],
    properties: {
      reportRoundNo: { type: 'integer', minimum: 1, maximum: 2 },
      reportYear: { type: 'integer', minimum: 2500, maximum: 2700 },
      factoryId: nullableStringSchema(64),
      factoryName: { type: 'string', minLength: 1, maxLength: 500 },
      factoryRegistrationNo: { type: 'string', minLength: 1, maxLength: 80 },
      businessActivity: nullableStringSchema(255),
      factoryAddress: nullableStringSchema(1000),
      provinceName: { type: 'string', minLength: 1, maxLength: 120 },
      connectedMeasurementPointId: { type: 'integer', minimum: 1, nullable: true },
      pointCode: nullableStringSchema(64),
      pointName: nullableStringSchema(255),
      wastewaterFlowM3PerHour: { type: 'number', nullable: true },
      samplerName: nullableStringSchema(255),
      officerRegistrationNo: nullableStringSchema(80),
      laboratoryName: nullableStringSchema(255),
      laboratoryRegistrationNo: nullableStringSchema(80),
      labReportNo: nullableStringSchema(120),
      analysisMethod: nullableStringSchema(255),
      deviceBrand: nullableStringSchema(120),
      deviceModel: nullableStringSchema(120),
      deviceSerialNo: nullableStringSchema(120),
      selectedParameterCode: { type: 'string', enum: ['BOD', 'COD'] },
      reporterName: nullableStringSchema(255),
      reporterPosition: nullableStringSchema(255),
      measurements: {
        type: 'array',
        minItems: 1,
        maxItems: 50,
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['sampleDate', 'sampleTime', 'deviceValueMgL', 'labValueMgL'],
          properties: {
            sampleDate: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
            sampleTime: { type: 'string', pattern: '^\\d{2}:\\d{2}$' },
            deviceValueMgL: { type: 'number' },
            labValueMgL: { type: 'number' },
            standardDeviationMgL: { type: 'number', nullable: true },
          },
        },
      },
      attachments: {
        type: 'array',
        maxItems: 30,
        default: [],
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['attachmentType', 'originalFileName'],
          properties: {
            attachmentType: {
              type: 'string',
              enum: ['SAMPLE_PHOTO', 'DEVICE_PHOTO', 'LAB_REPORT'],
            },
            originalFileName: { type: 'string', minLength: 1, maxLength: 500 },
            storedFileName: nullableStringSchema(500),
            mimeType: nullableStringSchema(128),
            fileSize: { type: 'integer', minimum: 0, nullable: true },
            storagePath: nullableStringSchema(1000),
          },
        },
      },
      revisionNote: nullableStringSchema(1000),
    },
  },
  BodCodWorkflowActionRequest: {
    oneOf: [
      {
        type: 'object',
        additionalProperties: false,
        required: ['action', 'revisionReason'],
        properties: {
          action: { type: 'string', enum: ['REQUEST_REVISION'] },
          revisionReason: { type: 'string', minLength: 1, maxLength: 1000 },
          officerNote: {
            type: 'string',
            maxLength: 1000,
            nullable: true,
            description: 'Optional; ค่าว่างถูก trim และ normalize เป็น null',
          },
        },
      },
      {
        type: 'object',
        additionalProperties: false,
        required: ['action'],
        properties: {
          action: { type: 'string', enum: ['APPROVE', 'REJECT'] },
          officerNote: {
            type: 'string',
            maxLength: 1000,
            nullable: true,
            description: 'Optional; ค่าว่างถูก trim และ normalize เป็น null',
          },
        },
      },
    ],
  },
  BodCodResultNoticeRequest: {
    type: 'object',
    additionalProperties: false,
    required: [
      'reportCorrectness',
      'checkedParameters',
      'reviewResult',
      'inspectorName',
      'inspectorPosition',
    ],
    properties: {
      reportCorrectness: {
        type: 'string',
        enum: ['ถูกต้องครบถ้วน', 'ไม่ถูกต้องครบถ้วน'],
      },
      checkedParameters: {
        type: 'array',
        minItems: 1,
        maxItems: 2,
        uniqueItems: true,
        items: { type: 'string', enum: ['BOD', 'COD'] },
      },
      reviewResult: {
        type: 'string',
        enum: ['เห็นควรแจ้งผลการตรวจสอบ', 'เห็นควรให้แก้ไขเพิ่มเติม'],
      },
      comment: {
        type: 'string',
        maxLength: 1000,
        nullable: true,
        description: 'Optional; ค่าว่างถูก trim และ normalize เป็น null',
      },
      inspectorName: { type: 'string', maxLength: 255 },
      inspectorPosition: { type: 'string', maxLength: 255 },
    },
  },
  KwpFormStatusHistoryRow: {
    type: 'object',
    additionalProperties: false,
    required: [
      'id',
      'status',
      'statusLabel',
      'note',
      'changedById',
      'changedBy',
      'changedAt',
      'changedDate',
    ],
    properties: {
      id: { type: 'integer', minimum: 1 },
      status: { type: 'string', enum: [...KWP_FORM_STATUSES] },
      statusLabel: { type: 'string', maxLength: 128 },
      note: nullableStringSchema(1000),
      changedById: { type: 'integer', minimum: 1, nullable: true },
      changedBy: nullableStringSchema(500),
      changedAt: { type: 'string', format: 'date-time' },
      changedDate: {
        type: 'string',
        pattern: '^(?:\\d{2}/\\d{2}/\\d{4}|-)$',
        example: '04/07/2569',
      },
    },
  },
  KwpFormFactoryRow: {
    type: 'object',
    additionalProperties: false,
    required: [
      'id',
      'factoryId',
      'factoryName',
      'newRegistrationNo',
      'oldRegistrationNo',
      'industryType',
      'industryMainOrder',
      'businessActivity',
      'province',
      'address',
      'monitoringPointCount',
    ],
    properties: {
      id: { type: 'string', maxLength: 64, example: '10840002225552' },
      factoryId: { type: 'string', maxLength: 64, example: '10840002225552' },
      factoryName: {
        type: 'string',
        maxLength: 500,
        description:
          'ชื่อโรงงานปัจจุบันจากจุดตรวจวัดที่เชื่อมต่ออยู่ โดย fallback ไปข้อมูลโรงงานที่เข้าข่าย',
        example: 'บริษัท พี.ซี.ปาล์ม(2550) จำกัด',
      },
      newRegistrationNo: {
        type: 'string',
        maxLength: 64,
        description:
          'เลขทะเบียนโรงงานปัจจุบันจาก eligible_factories.factory_registration_no_new; fallback เป็น factories.fid',
        example: '10840002225552',
      },
      oldRegistrationNo: {
        ...nullableStringSchema(64),
        description: 'เลขทะเบียนโรงงานเดิมจาก eligible_factories.factory_registration_no_old',
        example: '3-7(1)-22/55สฎ',
      },
      industryType: nullableStringSchema(500),
      industryMainOrder: nullableStringSchema(32),
      businessActivity: { type: 'string', nullable: true },
      province: {
        ...nullableStringSchema(128),
        description: 'จังหวัดปัจจุบันของ eligible factory เดียวกับ newRegistrationNo',
        example: 'สุราษฎร์ธานี',
      },
      address: nullableStringSchema(1000),
      monitoringPointCount: { type: 'integer', minimum: 0 },
    },
  },
  KwpFormRequestRow: {
    type: 'object',
    additionalProperties: false,
    required: [
      'id',
      'factoryId',
      'factoryName',
      'factoryRegistration',
      'oldRegistrationNo',
      'industryType',
      'factoryAddress',
      'province',
      'type',
      'monitoringPointCode',
      'monitoringPointName',
      'requestNo',
      'form',
      'formType',
      'submittedDate',
      'reviewedDate',
      'status',
      'statusCode',
      'revisionNote',
      'statusHistory',
    ],
    properties: {
      id: { type: 'integer', minimum: 1 },
      factoryId: nullableStringSchema(64),
      factoryName: {
        type: 'string',
        maxLength: 500,
        description:
          'ชื่อโรงงานปัจจุบันจากจุดตรวจวัดที่เชื่อมต่อ/โรงงานที่เข้าข่าย; fallback เป็น snapshot ตอนยื่นคำขอ',
        example: 'บริษัท พี.ซี.ปาล์ม(2550) จำกัด',
      },
      factoryRegistration: {
        ...nullableStringSchema(64),
        description:
          'เลขทะเบียนโรงงานปัจจุบันจาก eligible_factories.factory_registration_no_new; fallback ตาม current master แล้วจึงใช้ snapshot ตอนยื่นคำขอ',
        example: '10840002225552',
      },
      oldRegistrationNo: {
        ...nullableStringSchema(64),
        description: 'เลขทะเบียนโรงงานเดิมจาก eligible factory ที่ resolve ได้',
        example: '3-7(1)-22/55สฎ',
      },
      industryType: nullableStringSchema(255),
      factoryAddress: nullableStringSchema(1000),
      province: {
        ...nullableStringSchema(128),
        description: 'จังหวัดปัจจุบันของ eligible factory เดียวกับ factoryRegistration',
        example: 'สุราษฎร์ธานี',
      },
      type: nullableStringSchema(32),
      monitoringPointCode: nullableStringSchema(64),
      monitoringPointName: nullableStringSchema(255),
      requestNo: { type: 'string', maxLength: 32, example: 'F01-07-0002/2569' },
      form: { type: 'string', enum: ['กวภ.01', 'กวภ.02', 'กวภ.03', 'กวภ.04', 'กวภ.05'] },
      formType: { type: 'string', enum: [...KWP_FORM_TYPES] },
      submittedDate: {
        type: 'string',
        pattern: '^(?:\\d{2}/\\d{2}/\\d{4}|-)$',
        example: '04/07/2569',
      },
      reviewedDate: {
        type: 'string',
        pattern: '^(?:\\d{2}/\\d{2}/\\d{4}|-)$',
        example: '-',
      },
      status: { type: 'string', maxLength: 128 },
      statusCode: { type: 'string', enum: [...KWP_FORM_STATUSES] },
      revisionNote: nullableStringSchema(1000),
      statusHistory: {
        type: 'array',
        items: schemaRef('KwpFormStatusHistoryRow'),
      },
    },
  },
  KwpFormFactoriesResponse: {
    type: 'object',
    additionalProperties: false,
    required: ['success', 'data', 'meta'],
    properties: {
      success: { type: 'boolean', enum: [true] },
      data: { type: 'array', items: schemaRef('KwpFormFactoryRow') },
      meta: {
        type: 'object',
        additionalProperties: false,
        required: ['total'],
        properties: { total: { type: 'integer', minimum: 0 } },
      },
    },
  },
  KwpFormRequestsResponse: {
    type: 'object',
    additionalProperties: false,
    required: ['success', 'data', 'meta'],
    properties: {
      success: { type: 'boolean', enum: [true] },
      data: { type: 'array', items: schemaRef('KwpFormRequestRow') },
      meta: {
        type: 'object',
        additionalProperties: false,
        required: ['total'],
        properties: { total: { type: 'integer', minimum: 0 } },
      },
    },
  },
  KwpAttachmentUploadRequest: {
    type: 'object',
    additionalProperties: false,
    required: ['file'],
    properties: {
      attachmentType: {
        type: 'string',
        maxLength: 64,
        nullable: true,
        description: 'Optional; ค่าว่างถูก normalize เป็นไม่ส่งค่า',
      },
      file: {
        type: 'string',
        format: 'binary',
        description:
          'JPEG, PNG หรือ PDF; ทั่วไปไม่เกิน 5 MiB และ RATA_REPORT/CALIBRATION_PHOTO ไม่เกิน 10 MiB',
      },
    },
  },
  KwpAttachmentMetadata: {
    type: 'object',
    additionalProperties: false,
    required: ['attachmentType', 'originalFileName'],
    properties: {
      attachmentType: { type: 'string', minLength: 1, maxLength: 64 },
      originalFileName: { type: 'string', minLength: 1, maxLength: 500 },
      storedFileName: nullableStringSchema(500),
      mimeType: nullableStringSchema(128),
      fileSize: { type: 'integer', minimum: 0, nullable: true },
      storagePath: nullableStringSchema(1000),
    },
  },
  KwpBaseRequest: {
    type: 'object',
    additionalProperties: false,
    required: ['factoryId', 'factoryName'],
    properties: {
      factoryId: { type: 'string', minLength: 1, maxLength: 64 },
      factoryName: { type: 'string', minLength: 1, maxLength: 500 },
      factoryRegistrationNo: {
        ...nullableStringSchema(64),
        description:
          'เลขทะเบียนโรงงานปัจจุบันจาก KwpFormFactoryRow.newRegistrationNo; backend เก็บเป็น submission snapshot',
      },
      factoryAddress: nullableStringSchema(1000),
      industryType: nullableStringSchema(255),
      connectedPointId: { type: 'integer', minimum: 1, nullable: true },
      pointCode: nullableStringSchema(64),
      pointName: nullableStringSchema(255),
      pointType: nullableStringSchema(32),
      productionStack: nullableStringSchema(255),
      primaryFuel: nullableStringSchema(255),
      secondaryFuel: nullableStringSchema(255),
      combustionSystem: nullableStringSchema(64),
      productionCapacity: nullableStringSchema(255),
      productionCapacityUnit: nullableStringSchema(64),
      contactName: nullableStringSchema(255),
      contactPhone: nullableStringSchema(64),
      contactEmail: {
        type: 'string',
        format: 'email',
        maxLength: 255,
        nullable: true,
        description: 'Optional; ค่าว่างถูก trim และ normalize เป็น null',
      },
      reporterName: nullableStringSchema(255),
      reporterPosition: nullableStringSchema(255),
    },
  },
  Kwp01Request: {
    allOf: [
      schemaRef('KwpBaseRequest'),
      {
        type: 'object',
        additionalProperties: false,
        required: ['issueReason', 'unreportedParameters'],
        properties: {
          issueReason: {
            type: 'string',
            enum: ['เครื่องมือหรือเครื่องอุปกรณ์พิเศษขัดข้อง', 'หยุดหน่วยการผลิต'],
          },
          reasonDetail: nullableStringSchema(2000),
          problemDate: kwpDateOrHourSchema,
          expectedDoneDate: {
            ...kwpDateOrHourSchema,
            description:
              'วันที่เสร็จคาดหมาย ต้องไม่น้อยกว่า problemDate; รูปแบบ YYYY-MM-DD หรือ YYYY-MM-DDTHH:00:00',
          },
          totalDays: { type: 'integer', minimum: 0, maximum: 366, nullable: true },
          unreportedParameters: {
            type: 'array',
            maxItems: 100,
            items: { type: 'string', minLength: 1, maxLength: 255 },
          },
          correctiveAction: nullableStringSchema(2000),
        },
      },
    ],
  },
  Kwp02Or04Request: {
    allOf: [
      schemaRef('KwpBaseRequest'),
      {
        type: 'object',
        additionalProperties: false,
        required: ['measurementItems'],
        properties: {
          measurementItems: {
            type: 'array',
            minItems: 1,
            maxItems: 100,
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['pollutant'],
              properties: {
                pollutant: { type: 'string', minLength: 1, maxLength: 255 },
                sampleDate: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$', nullable: true },
                measuredValue: {
                  oneOf: [{ type: 'string', minLength: 1, maxLength: 100 }, { type: 'number' }],
                  nullable: true,
                },
                unit: nullableStringSchema(64),
                laboratoryNo: nullableStringSchema(100),
                reportNo: nullableStringSchema(100),
                method: nullableStringSchema(1000),
                attachments: {
                  type: 'array',
                  maxItems: 20,
                  default: [],
                  items: schemaRef('KwpAttachmentMetadata'),
                },
              },
            },
          },
        },
      },
    ],
  },
  Kwp03Request: {
    allOf: [
      schemaRef('KwpBaseRequest'),
      {
        type: 'object',
        additionalProperties: false,
        required: ['instruments', 'issueReasons', 'failedParameters'],
        properties: {
          instruments: {
            type: 'array',
            minItems: 1,
            maxItems: 20,
            items: { type: 'string', minLength: 1, maxLength: 255 },
          },
          measurementTimes: {
            type: 'array',
            maxItems: 20,
            default: [],
            items: { type: 'string', minLength: 1, maxLength: 255 },
          },
          wastewaterSource: nullableStringSchema(500),
          receivingSource: nullableStringSchema(500),
          treatmentSystemType: nullableStringSchema(500),
          dischargePoint: nullableStringSchema(500),
          averageDischarge: {
            oneOf: [{ type: 'string', minLength: 1, maxLength: 100 }, { type: 'number' }],
            nullable: true,
          },
          minimumDischarge: {
            oneOf: [{ type: 'string', minLength: 1, maxLength: 100 }, { type: 'number' }],
            nullable: true,
          },
          maximumDischarge: {
            oneOf: [{ type: 'string', minLength: 1, maxLength: 100 }, { type: 'number' }],
            nullable: true,
          },
          issueReasons: {
            type: 'array',
            minItems: 1,
            maxItems: 3,
            items: {
              type: 'string',
              enum: [
                'เครื่องมือหรือเครื่องอุปกรณ์พิเศษขัดข้อง',
                'ไม่มีการระบายน้ำทิ้งออกนอกโรงงาน',
                'ระบบรับส่งข้อมูล ระบบไฟฟ้า อินเทอร์เน็ต ขัดข้อง',
              ],
            },
          },
          reasonDetail: nullableStringSchema(2000),
          problemDate: kwpDateOrHourSchema,
          expectedDoneDate: {
            ...kwpDateOrHourSchema,
            description:
              'วันที่เสร็จคาดหมาย ต้องไม่น้อยกว่า problemDate; รูปแบบ YYYY-MM-DD หรือ YYYY-MM-DDTHH:00:00',
          },
          totalDays: { type: 'integer', minimum: 0, maximum: 366, nullable: true },
          failedParameters: {
            type: 'array',
            minItems: 1,
            maxItems: 100,
            items: { type: 'string', minLength: 1, maxLength: 255 },
          },
          correctiveAction: nullableStringSchema(2000),
          attachments: {
            type: 'array',
            maxItems: 20,
            default: [],
            items: schemaRef('KwpAttachmentMetadata'),
          },
        },
      },
    ],
  },
  Kwp05Request: {
    allOf: [
      schemaRef('KwpBaseRequest'),
      {
        type: 'object',
        additionalProperties: false,
        required: ['calibrationItems'],
        properties: {
          businessActivity: nullableStringSchema(500),
          samplerName: nullableStringSchema(255),
          officerRegistration: nullableStringSchema(100),
          laboratoryName: nullableStringSchema(500),
          laboratoryRegistration: nullableStringSchema(100),
          cemsBrand: nullableStringSchema(255),
          cemsDetail: nullableStringSchema(1000),
          reportRound: nullableStringSchema(100),
          reportYear: nullableStringSchema(4),
          calibrationItems: {
            type: 'array',
            minItems: 1,
            maxItems: 100,
            items: {
              type: 'object',
              additionalProperties: false,
              anyOf: [{ required: ['parameter'] }, { required: ['parameters'] }],
              description:
                'ต้องมี parameter หรือ parameters อย่างน้อยหนึ่งค่า; ถ้าส่งทั้งคู่ parameter ต้องตรงกับค่าแรก และ endDate ต้องไม่น้อยกว่า startDate',
              properties: {
                parameter: { type: 'string', minLength: 1, maxLength: 255 },
                parameters: {
                  type: 'array',
                  minItems: 1,
                  maxItems: 100,
                  items: { type: 'string', minLength: 1, maxLength: 255 },
                },
                startDate: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$', nullable: true },
                endDate: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$', nullable: true },
                result: nullableStringSchema(32),
                verifierCompany: nullableStringSchema(500),
                cemsModel: nullableStringSchema(500),
                rataReportLink: nullableStringSchema(1000),
                calibrationPhotoLink: nullableStringSchema(1000),
                attachments: {
                  type: 'array',
                  maxItems: 20,
                  default: [],
                  items: schemaRef('KwpAttachmentMetadata'),
                },
              },
            },
          },
        },
      },
    ],
  },
  KwpResubmitRequest: {
    type: 'object',
    additionalProperties: false,
    properties: {
      note: {
        type: 'string',
        maxLength: 1000,
        nullable: true,
        description: 'Optional; ค่าว่างถูก trim และ normalize เป็น null',
      },
    },
  },
  KwpWorkflowActionRequest: {
    oneOf: [
      {
        type: 'object',
        additionalProperties: false,
        required: ['action', 'revisionReason'],
        properties: {
          action: { type: 'string', enum: ['REQUEST_REVISION'] },
          revisionReason: { type: 'string', minLength: 1, maxLength: 1000 },
          officerNote: {
            type: 'string',
            maxLength: 1000,
            nullable: true,
            description: 'Optional; ค่าว่างถูก trim และ normalize เป็น null',
          },
        },
      },
      {
        type: 'object',
        additionalProperties: false,
        required: ['action'],
        properties: {
          action: { type: 'string', enum: ['APPROVE'] },
          officerNote: {
            type: 'string',
            maxLength: 1000,
            nullable: true,
            description: 'Optional; ค่าว่างถูก trim และ normalize เป็น null',
          },
        },
      },
    ],
  },
  IntegrationDeviceConfig: {
    type: 'object',
    additionalProperties: false,
    required: [
      'deviceCode',
      'protocol',
      'hostIp',
      'port',
      'slaveId',
      'comPort',
      'baudRate',
      'parity',
      'stopBits',
      'dataBits',
      'quantity',
      'dbUser',
      'dbPass',
      'dbName',
      'minuteTableName',
      'fiveMinuteTableName',
      'hourlyTableName',
      'deviceValueRangeMin',
      'deviceValueRangeMax',
    ],
    properties: {
      deviceCode: { type: 'string', minLength: 1 },
      protocol: { type: 'string', enum: protocolValues },
      hostIp: { type: 'string', nullable: true },
      port: { type: 'number', nullable: true },
      slaveId: { type: 'number', nullable: true },
      comPort: { type: 'number', nullable: true },
      baudRate: { type: 'number', nullable: true },
      parity: { type: 'string', nullable: true },
      stopBits: { type: 'number', nullable: true },
      dataBits: { type: 'number', nullable: true },
      quantity: { type: 'number', nullable: true },
      dbUser: { type: 'string', nullable: true },
      dbPass: {
        type: 'string',
        nullable: true,
        description: 'ข้อมูลลับสำหรับ Worker; ห้าม cache หรือบันทึกลง log',
      },
      dbName: { type: 'string', nullable: true },
      minuteTableName: { type: 'string', nullable: true },
      fiveMinuteTableName: { type: 'string', nullable: true },
      hourlyTableName: { type: 'string', nullable: true },
      deviceValueRangeMin: { type: 'number', nullable: true },
      deviceValueRangeMax: { type: 'number', nullable: true },
    },
  },
  IntegrationParameterConfig: {
    type: 'object',
    additionalProperties: false,
    required: [
      'deviceCode',
      'addressId',
      'parameter',
      'parameterName',
      'parameterUnit',
      'testMode',
      'valueRange',
      'alertLow',
      'alertHigh',
      'valueFormat',
      'offset',
      'encoding',
      'standardCriteria',
      'eiaCriteria',
      'standardCondition',
      'dryBasis',
      'oxygenOrExcessAir',
      'status',
    ],
    properties: {
      deviceCode: { type: 'string', minLength: 1 },
      addressId: { type: 'number', nullable: true },
      parameter: {
        type: 'string',
        minLength: 1,
        description: 'ชื่อพารามิเตอร์สำหรับแสดงผลพร้อมหน่วย เช่น CO (ppm)',
      },
      parameterName: { type: 'string', nullable: true },
      parameterUnit: { type: 'string', nullable: true },
      testMode: {
        type: 'boolean',
        default: false,
        description: 'true เมื่อ channel ถูกตั้งเป็นโหมดทดสอบ; response คืน boolean เสมอ',
      },
      valueRange: {
        type: 'object',
        nullable: true,
        additionalProperties: false,
        required: ['min', 'max'],
        properties: {
          min: { type: 'number', nullable: true },
          max: { type: 'number', nullable: true },
        },
      },
      alertLow: { type: 'number', nullable: true },
      alertHigh: { type: 'number', nullable: true },
      valueFormat: { type: 'string', nullable: true },
      offset: { type: 'number', nullable: true },
      encoding: { type: 'string', nullable: true },
      standardCriteria: {
        oneOf: [{ type: 'number' }, { type: 'string' }],
        nullable: true,
      },
      eiaCriteria: {
        oneOf: [{ type: 'number' }, { type: 'string' }],
        nullable: true,
      },
      standardCondition: { type: 'boolean', nullable: true },
      dryBasis: { type: 'boolean', nullable: true },
      oxygenOrExcessAir: { type: 'boolean', nullable: true },
      status: { type: 'string', minLength: 1 },
    },
  },
  IntegrationStatusSchedule: {
    type: 'object',
    additionalProperties: false,
    required: ['parameter', 'startAt', 'endAt', 'status'],
    properties: {
      parameter: {
        type: 'string',
        minLength: 1,
        description: 'ชื่อพารามิเตอร์พร้อมหน่วย',
      },
      startAt: { type: 'string', nullable: true },
      endAt: { type: 'string', nullable: true },
      status: { type: 'string', minLength: 1 },
    },
  },
  IntegrationDeviceConfigsData: {
    type: 'object',
    additionalProperties: false,
    required: [
      'stationId',
      'measurementPointType',
      'systemType',
      'pointType',
      'monitoringPointKind',
      'deviceConfigs',
      'parameterConfigs',
      'statusSchedules',
    ],
    properties: {
      stationId: { type: 'string', minLength: 1 },
      measurementPointType: {
        type: 'string',
        enum: ['CEMS', 'WPMS', 'MOBILE', 'STATION', 'UNKNOWN'],
      },
      systemType: { type: 'string', enum: systemTypeValues },
      pointType: { type: 'string', enum: ['STACK', 'WASTEWATER', 'OTHER'] },
      monitoringPointKind: {
        type: 'string',
        enum: ['CEMS', 'WPMS', 'MOBILE', 'STATION'],
        nullable: true,
      },
      deviceConfigs: {
        type: 'array',
        items: schemaRef('IntegrationDeviceConfig'),
      },
      parameterConfigs: {
        type: 'array',
        items: schemaRef('IntegrationParameterConfig'),
      },
      statusSchedules: {
        type: 'array',
        items: schemaRef('IntegrationStatusSchedule'),
      },
    },
  },
  FactoryDashboardMeasurementCriteriaRow: {
    type: 'object',
    additionalProperties: false,
    required: ['level', 'min', 'max'],
    properties: {
      level: { type: 'string', enum: ['normal', 'warning', 'critical'] },
      min: { type: 'number', nullable: true },
      max: { type: 'number', nullable: true },
    },
  },
  FactoryDashboardMeasurementCriteria: {
    type: 'object',
    additionalProperties: false,
    required: ['enabled', 'standardValue', 'rows'],
    properties: {
      enabled: { type: 'boolean' },
      standardValue: {
        oneOf: [{ type: 'number' }, { type: 'string' }],
        nullable: true,
      },
      rows: {
        type: 'array',
        items: schemaRef('FactoryDashboardMeasurementCriteriaRow'),
      },
    },
  },
  FactoryDashboardParameterStandard: {
    type: 'object',
    additionalProperties: false,
    required: ['parameter', 'standardCriteria', 'eiaCriteria'],
    properties: {
      parameter: {
        type: 'string',
        minLength: 1,
        description: 'ชื่อพารามิเตอร์สำหรับแสดงผลพร้อมหน่วย เช่น CO (ppm) หรือ BOD (mg/l)',
      },
      standardCriteria: {
        allOf: [schemaRef('FactoryDashboardMeasurementCriteria')],
        nullable: true,
      },
      eiaCriteria: {
        allOf: [schemaRef('FactoryDashboardMeasurementCriteria')],
        nullable: true,
      },
    },
  },
  FactoryDashboardMeasurementPoint: {
    type: 'object',
    additionalProperties: false,
    required: [
      'stationId',
      'pointName',
      'pointCode',
      'systemType',
      'parameters',
      'parameterStandards',
      'data',
    ],
    properties: {
      stationId: { type: 'string', nullable: true },
      pointName: { type: 'string', minLength: 1 },
      pointCode: { type: 'string', nullable: true },
      systemType: { type: 'string', enum: systemTypeValues },
      monitoringPointStatus: { type: 'string', nullable: true },
      parameters: {
        type: 'array',
        items: {
          type: 'string',
          minLength: 1,
          description: 'ชื่อพารามิเตอร์พร้อมหน่วย เช่น CO2 (ppm), CO (%) หรือ Flow Rate (m3/hr)',
        },
      },
      parameterStandards: {
        type: 'array',
        items: schemaRef('FactoryDashboardParameterStandard'),
      },
      data: {
        type: 'array',
        description:
          'ข้อมูลชั่วโมงที่คำนวณเสร็จล่าสุด; key ของค่าตรวจวัดเป็นชื่อพารามิเตอร์พร้อมหน่วย และ operational status อาจเป็น string',
        items: {
          type: 'object',
          additionalProperties: {
            oneOf: [{ type: 'number' }, { type: 'string' }],
            nullable: true,
          },
          properties: {
            station_id: { type: 'string' },
            cdate: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
            ctime: { type: 'string', pattern: '^(?:[01]\\d|2[0-3])[:.]\\d{2}[:.]\\d{2}$' },
          },
        },
      },
    },
  },
  IntegrationFactoryDashboardRow: {
    type: 'object',
    additionalProperties: false,
    required: [
      'id',
      'eligibleFactoryId',
      'factoryId',
      'factoryName',
      'newRegistrationNo',
      'oldRegistrationNo',
      'factoryLogoUrl',
      'industryMainOrder',
      'industryMainOrderLabel',
      'industrySubOrder',
      'eia',
      'hasEia',
      'regionCode',
      'regionName',
      'provinceCode',
      'provinceName',
      'province',
      'address',
      'latitude',
      'longitude',
      'districtCode',
      'districtName',
      'industrialAreaType',
      'industrialAreaTypeLabel',
      'industrialEstateCode',
      'industrialEstateName',
      'isEligible',
      'eligibilityStatus',
      'hasLatestHourlyMeasurement',
      'monitoringPointCountBySystem',
      'status',
      'measurementPoints',
    ],
    properties: {
      id: { type: 'integer', nullable: true },
      eligibleFactoryId: { type: 'integer', nullable: true },
      factoryId: { type: 'string', minLength: 1, maxLength: 64 },
      factoryName: { type: 'string', minLength: 1 },
      newRegistrationNo: { type: 'string', pattern: '^\\d{14}$', nullable: true },
      oldRegistrationNo: { type: 'string', nullable: true },
      factoryLogoUrl: { type: 'string', format: 'uri', nullable: true },
      industryMainOrder: { type: 'string', nullable: true },
      industryMainOrderLabel: { type: 'string', nullable: true },
      industrySubOrder: { type: 'string', nullable: true },
      eia: { type: 'string', nullable: true },
      hasEia: { type: 'boolean', nullable: true },
      regionCode: { type: 'string', nullable: true },
      regionName: { type: 'string', nullable: true },
      provinceCode: { type: 'string', nullable: true },
      provinceName: { type: 'string', nullable: true },
      province: { type: 'string', nullable: true },
      address: { type: 'string', nullable: true },
      latitude: { type: 'string', nullable: true },
      longitude: { type: 'string', nullable: true },
      districtCode: { type: 'string', nullable: true },
      districtName: { type: 'string', nullable: true },
      industrialAreaType: {
        type: 'string',
        enum: ['INDUSTRIAL_ESTATE', 'OUTSIDE_INDUSTRIAL_ESTATE'],
        nullable: true,
      },
      industrialAreaTypeLabel: {
        type: 'string',
        enum: ['ในนิคมอุตสาหกรรม', 'นอกนิคมอุตสาหกรรม'],
        nullable: true,
      },
      industrialEstateCode: { type: 'string', nullable: true },
      industrialEstateName: { type: 'string', nullable: true },
      isEligible: { type: 'boolean', enum: [true] },
      eligibilityStatus: { type: 'string', enum: ['เข้าข่าย'] },
      hasLatestHourlyMeasurement: { type: 'boolean' },
      monitoringPointCountBySystem: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['systemType', 'count'],
          properties: {
            systemType: { type: 'string', enum: systemTypeValues },
            count: { type: 'integer', minimum: 0 },
          },
        },
      },
      status: { type: 'string', enum: ['แสดง'] },
      measurementPoints: {
        type: 'array',
        items: schemaRef('FactoryDashboardMeasurementPoint'),
      },
    },
  },
  IntegrationFactoryDashboardResponse: {
    type: 'object',
    additionalProperties: false,
    required: ['success', 'data', 'meta'],
    properties: {
      success: { type: 'boolean', enum: [true] },
      data: {
        type: 'array',
        minItems: 1,
        maxItems: 1,
        items: schemaRef('IntegrationFactoryDashboardRow'),
      },
      meta: {
        type: 'object',
        additionalProperties: false,
        required: ['total'],
        properties: { total: { type: 'integer', minimum: 1, maximum: 1 } },
      },
    },
  },
  IntegrationDeviceConfigsResponse: {
    type: 'object',
    additionalProperties: false,
    required: ['success', 'data'],
    properties: {
      success: { type: 'boolean', enum: [true] },
      data: schemaRef('IntegrationDeviceConfigsData'),
    },
  },
  IntegrationAlertEventBatchRequest: {
    type: 'object',
    additionalProperties: false,
    required: ['events'],
    properties: {
      events: {
        type: 'array',
        minItems: 1,
        maxItems: 500,
        items: {
          type: 'object',
          additionalProperties: false,
          required: [
            'systemType',
            'stationId',
            'parameterCode',
            'unit',
            'eventDate',
            'time',
            'measuredValue',
            'thresholdValue',
            'thresholdType',
          ],
          properties: {
            systemType: { type: 'string', enum: systemTypeValues },
            stationId: alertMonitoringPointCodeSchema,
            pointCode: { ...alertMonitoringPointCodeSchema, nullable: true },
            parameterCode: {
              type: 'string',
              minLength: 1,
              maxLength: 128,
              pattern: '^[A-Za-z0-9_-]+$',
            },
            unit: { type: 'string', minLength: 1, maxLength: 64 },
            eventDate: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
            time: { type: 'string', pattern: '^([01]\\d|2[0-3]):00$' },
            measuredValue: { type: 'number' },
            thresholdValue: { type: 'number' },
            thresholdType: { type: 'string', enum: ['STANDARD', 'EIA'] },
          },
        },
      },
    },
  },
  AlertEventStatusRequest: {
    type: 'object',
    additionalProperties: false,
    required: ['notificationStatus'],
    properties: {
      notificationStatus: {
        type: 'string',
        enum: [...ALERT_EVENT_NOTIFICATION_STATUSES],
      },
      note: { type: 'string', maxLength: 1000 },
    },
  },
  EmailTestRequest: {
    type: 'object',
    additionalProperties: false,
    properties: {
      subject: { type: 'string', minLength: 1, maxLength: 120 },
      message: { type: 'string', minLength: 1, maxLength: 1000 },
    },
  },
  OfficerNotificationRecipientRequest: {
    type: 'object',
    additionalProperties: false,
    required: ['recipientType', 'emails'],
    properties: {
      recipientType: { type: 'string', enum: ['PROVINCE', 'INDUSTRIAL_ESTATE'] },
      provinceName: { type: 'string', minLength: 1, maxLength: 128, nullable: true },
      emails: {
        type: 'array',
        minItems: 1,
        maxItems: 20,
        items: { type: 'string', format: 'email', maxLength: 255 },
      },
    },
    description:
      'recipientType=PROVINCE ต้องส่ง provinceName; recipientType=INDUSTRIAL_ESTATE ห้ามส่ง provinceName',
  },
  OfficerNotificationAddEmailRequest: {
    type: 'object',
    additionalProperties: false,
    required: ['email'],
    properties: {
      email: { type: 'string', format: 'email', maxLength: 255 },
    },
  },
  CsvExportResponse: {
    type: 'string',
    format: 'binary',
  },
  AttachmentContentResponse: {
    type: 'string',
    format: 'binary',
  },
};

/**
 * OpenAPI 3.0 does not merge `additionalProperties: false` across `allOf` object
 * branches. Flatten the shared request shapes so inherited fields remain valid
 * while unknown fields are still rejected by the published contract.
 */
function flattenObjectSchema(schemaName: string, baseSchemaName: string): void {
  const composedSchema = componentSchemas[schemaName];
  const baseSchema = componentSchemas[baseSchemaName];
  const branches = composedSchema.allOf;
  if (!Array.isArray(branches)) {
    return;
  }
  if (branches.length !== 2) {
    throw new Error(`Expected ${schemaName} to contain exactly two allOf branches`);
  }

  const extensionSchema = branches[1] as OpenApiObject;
  const baseRequired = Array.isArray(baseSchema.required) ? (baseSchema.required as string[]) : [];
  const extensionRequired = Array.isArray(extensionSchema.required)
    ? (extensionSchema.required as string[])
    : [];

  componentSchemas[schemaName] = {
    type: 'object',
    additionalProperties: false,
    required: [...new Set([...baseRequired, ...extensionRequired])],
    properties: {
      ...((baseSchema.properties as Record<string, OpenApiObject>) ?? {}),
      ...((extensionSchema.properties as Record<string, OpenApiObject>) ?? {}),
    },
  };
}

flattenObjectSchema('Kwp01Request', 'KwpBaseRequest');
flattenObjectSchema('Kwp02Or04Request', 'KwpBaseRequest');
flattenObjectSchema('Kwp03Request', 'KwpBaseRequest');
flattenObjectSchema('Kwp05Request', 'KwpBaseRequest');

const extraResponses: Record<string, OpenApiObject> = {
  TooManyRequests: {
    description: 'เกินอัตราการเรียกใช้งานหรือ concurrency limit',
    content: {
      'application/json': {
        schema: schemaRef('ErrorEnvelope'),
      },
    },
  },
  Gone: {
    description: 'Signed URL หมดอายุ',
    content: {
      'application/json': {
        schema: schemaRef('ErrorEnvelope'),
      },
    },
  },
};

const extraSecuritySchemes: Record<string, OpenApiObject> = {
  deviceConfigApiKey: {
    type: 'apiKey',
    in: 'header',
    name: 'X-API-Key',
    description: 'API key สำหรับ integration ดึง device config',
  },
  alertEventApiKey: {
    type: 'apiKey',
    in: 'header',
    name: 'X-API-Key',
    description: 'API key สำหรับ integration ส่ง alert events',
  },
  factoryDashboardApiKey: {
    type: 'apiKey',
    in: 'header',
    name: 'X-API-Key',
    description: 'API key เฉพาะสำหรับ integration อ่าน dashboard โรงงานรายเดียว',
  },
};

const extraPaths: Record<string, OpenApiObject> = {
  '/health': {
    get: {
      ...publicOperation({
        tag: 'Common',
        summary: 'Health check',
        operationId: 'getHealth',
        successSchema: {
          type: 'object',
          additionalProperties: false,
          required: ['success', 'status', 'timestamp'],
          properties: {
            success: { type: 'boolean', enum: [true] },
            status: { type: 'string', example: 'ok' },
            timestamp: { type: 'string', format: 'date-time' },
          },
        },
      }),
      servers: [{ url: '/', description: 'Application root; endpoint นี้อยู่นอก API prefix' }],
    },
  },
  '/': {
    get: publicOperation({
      tag: 'Common',
      summary: 'API root',
      operationId: 'getApiRoot',
      successSchema: {
        type: 'object',
        additionalProperties: false,
        required: ['success', 'message', 'version'],
        properties: {
          success: { type: 'boolean', enum: [true] },
          message: { type: 'string', example: 'POMS API' },
          version: { type: 'string', example: '0.1.0' },
        },
      },
    }),
  },
  '/docs': {
    get: publicOperation({
      tag: 'API Docs',
      summary: 'Interactive Swagger UI',
      operationId: 'getApiDocs',
      successDescription: 'Redirect ไป /api/v1/docs/',
      successStatus: '308',
      successSchema: {
        type: 'string',
      },
      extraResponses: {},
    }),
  },
  '/docs/swagger-initializer.js': {
    get: publicOperation({
      tag: 'API Docs',
      summary: 'Swagger initializer',
      operationId: 'getApiDocsInitializer',
      successSchema: { type: 'string' },
      successDescription: 'ไฟล์ JavaScript สำหรับ initialize Swagger UI',
    }),
  },
  '/openapi.json': {
    get: publicOperation({
      tag: 'API Docs',
      summary: 'OpenAPI document',
      operationId: 'getOpenApiDocument',
      successSchema: { type: 'object', additionalProperties: true },
    }),
  },
  '/auth/login': {
    post: publicOperation({
      tag: 'Authentication',
      summary: 'Login',
      operationId: 'login',
      requestBody: jsonRequestBody(schemaRef('LoginRequest'), loginExample),
      successSchema: schemaRef('AuthSessionResponse'),
      extraResponses: {
        '429': { $ref: '#/components/responses/TooManyRequests' },
      },
    }),
  },
  '/auth/me': {
    get: securedOperation({
      tag: 'Authentication',
      summary: 'Current user profile',
      operationId: 'getCurrentUser',
      successSchema: schemaRef('AuthSessionResponse'),
    }),
  },
  '/users': {
    get: securedOperation({
      tag: 'Permissions',
      summary: 'List managed users',
      operationId: 'listUsers',
      parameters: [
        queryInteger('page', 'เลขหน้าสำหรับ pagination'),
        queryInteger('perPage', 'จำนวนรายการต่อหน้า', false, 1, 100),
        queryString('search', 'คำค้นหา trim แล้ว 1-128 ตัวอักษร', false, 128),
        queryString('roleCode', 'กรอง role code', false, 32),
        queryEnum('status', ['active', 'suspended', 'all'], 'กรองสถานะ', false, 'all'),
      ],
    }),
    post: securedOperation({
      tag: 'Permissions',
      summary: 'Create managed user',
      operationId: 'createManagedUser',
      requestBody: jsonRequestBody(schemaRef('CreateManagedUserRequest'), createManagedUserExample),
      successStatus: '201',
      successSchema: schemaRef('SuccessEnvelope'),
    }),
  },
  '/users/local-accounts': {
    post: securedOperation({
      tag: 'Permissions',
      summary: 'Create local POMS account',
      operationId: 'createLocalAccount',
      requestBody: jsonRequestBody(
        schemaRef('CreateLocalAccountRequest'),
        createLocalAccountExample,
      ),
      successStatus: '201',
      successSchema: schemaRef('SuccessEnvelope'),
    }),
  },
  '/users/{id}': {
    get: securedOperation({
      tag: 'Permissions',
      summary: 'Get managed user detail',
      operationId: 'getUserById',
      parameters: [userIdParameter],
      successSchema: schemaRef('ManagedUserEditResponse'),
    }),
    patch: securedOperation({
      tag: 'Permissions',
      summary: 'Update managed user',
      operationId: 'updateUser',
      parameters: [userIdParameter],
      requestBody: jsonRequestBody(schemaRef('UpdateManagedUserRequest'), updateManagedUserExample),
    }),
    delete: securedOperation({
      tag: 'Permissions',
      summary: 'Soft delete managed user',
      operationId: 'deleteUser',
      parameters: [userIdParameter],
      successStatus: '204',
      successDescription: 'ลบผู้ใช้สำเร็จ',
      successContentType: 'none',
    }),
  },
  '/users/{id}/permissions': {
    get: securedOperation({
      tag: 'Permissions',
      summary: 'Get user permission overrides',
      operationId: 'getUserPermissions',
      parameters: [userIdParameter],
    }),
    put: securedOperation({
      tag: 'Permissions',
      summary: 'Replace user permission overrides',
      operationId: 'replaceUserPermissions',
      parameters: [userIdParameter],
      requestBody: jsonRequestBody(
        schemaRef('ReplaceUserPermissionsRequest'),
        replacePermissionsExample,
      ),
    }),
  },
  '/eligible-factories/candidates': {
    get: securedOperation({
      tag: 'Eligible Factories',
      summary: 'List eligible factory candidates',
      operationId: 'listEligibleFactoryCandidates',
      description:
        'คืน candidate จาก Fac60k เฉพาะ FFLAG 0, 1 และ 3 โดยไม่รวม FFLAG 2; mapping สถานะโรงงานคือ 0 = ยังไม่แจ้งประกอบ, 1 = แจ้งประกอบแล้ว, 2 = จำหน่ายทะเบียน และ 3 = หยุดชั่วคราว',
      parameters: [
        queryInteger('page', 'เลขหน้า; ต้องส่งคู่กับ perPage'),
        queryInteger('perPage', 'จำนวนรายการต่อหน้า; ต้องส่งคู่กับ page', false, 1, 200),
      ],
    }),
  },
  '/eligible-factories': {
    get: securedOperation({
      tag: 'Eligible Factories',
      summary: 'List eligible factories',
      operationId: 'listEligibleFactories',
    }),
    post: securedOperation({
      tag: 'Eligible Factories',
      summary: 'Create eligible factory',
      operationId: 'createEligibleFactory',
      requestBody: jsonRequestBody(
        schemaRef('CreateEligibleFactoryRequest'),
        createEligibleFactoryExample,
      ),
      successStatus: '201',
    }),
  },
  '/eligible-factories/{id}': {
    delete: securedOperation({
      tag: 'Eligible Factories',
      summary: 'Delete eligible factory',
      operationId: 'deleteEligibleFactory',
      parameters: [idParameter],
      successStatus: '204',
      successDescription: 'ลบโรงงานออกจากรายการสำเร็จ',
      successContentType: 'none',
    }),
  },
  '/public/factory-map-points': {
    get: publicOperation({
      tag: 'Home',
      summary: 'Public factory map points',
      operationId: 'listPublicFactoryMapPoints',
      parameters: [queryEnum('systemType', systemTypeValues, 'กรองระบบตรวจวัด')],
    }),
  },
  '/operator-factory-dashboard': {
    get: securedOperation({
      tag: 'Home',
      summary: 'Connected-only factory dashboard',
      operationId: 'listOperatorFactoryDashboard',
      description:
        'Compatibility dashboard เดิมที่คืนเฉพาะโรงงานซึ่งมี active POMS point; หน้าแรกของผู้ประกอบการที่ต้องเห็นโรงงานของตนเองทั้งหมดให้ใช้ GET /operator-factories',
      parameters: [
        queryEnum('systemType', systemTypeValues, 'กรองระบบตรวจวัด'),
        queryBoolean('favoriteOnly', 'คืนเฉพาะโรงงานโปรด'),
      ],
    }),
  },
  '/operator-factories': {
    get: securedOperation({
      tag: 'Home',
      summary: 'Operator-owned factories with POMS membership',
      operationId: 'listOperatorFactoryOverview',
      description:
        'สำหรับ userType=operator เท่านั้น คืนโรงงานของผู้ประกอบการจาก ownership ที่ sync ตอน login ทั้งหมด โดยบังคับ effective data scope เป็น OWN_FACTORY แล้วแยกสถานะจาก active POMS point; eligibility และสถานะคำขอเป็นข้อมูลคนละส่วน',
      parameters: [
        queryEnum(
          'systemType',
          systemTypeValues,
          'คืนเฉพาะโรงงานที่มี active POMS point ของระบบนี้; โรงงานที่ยังไม่อยู่ใน POMS จะไม่ตรง filter นี้',
        ),
        queryBoolean(
          'favoriteOnly',
          'คืนเฉพาะโรงงานโปรด; runtime รองรับ true/false, 1/0 และ yes/no',
        ),
        queryEnum(
          'pomsMembershipStatus',
          pomsMembershipStatusValues,
          'กรองสถานะสมาชิก POMS: IN_POMS = มี active connected point, NOT_IN_POMS = ไม่มี active connected point',
        ),
      ],
      successDescription: 'คืนโรงงานของผู้ประกอบการพร้อมสถานะ POMS และสรุปจำนวนตามสถานะ',
      successSchema: schemaRef('OperatorFactoryOverviewResponse'),
    }),
  },
  '/operator-factories/{factoryId}/favorite': {
    put: securedOperation({
      tag: 'Home',
      summary: 'Set factory favorite',
      operationId: 'setOperatorFactoryFavorite',
      parameters: [factoryIdParameter],
      requestBody: jsonRequestBody(schemaRef('FavoriteRequest'), favoriteExample),
    }),
  },
  '/connected-measurement-points/{stationId}/measurement-statistics': {
    get: securedOperation({
      tag: 'Connected Measurement Points',
      summary: 'Measurement statistics by station',
      operationId: 'getMeasurementStatistics',
      parameters: [
        stationIdParameter,
        queryString(
          'date',
          'วันที่รูปแบบ YYYY-MM-DD; runtime ตรวจด้วย Date.parse และไม่บังคับ calendar round-trip',
          true,
          10,
          isoDatePattern,
        ),
      ],
    }),
  },
  '/connected-measurement-points/{stationId}/{buddhistYear}/measurement-statistics': {
    get: securedOperation({
      tag: 'Connected Measurement Points',
      summary: 'Measurement statistics by annual station code',
      operationId: 'getMeasurementStatisticsByAnnualPath',
      parameters: [
        annualStationIdParameter,
        buddhistYearParameter,
        queryString(
          'date',
          'วันที่รูปแบบ YYYY-MM-DD; runtime ตรวจด้วย Date.parse และไม่บังคับ calendar round-trip',
          true,
          10,
          isoDatePattern,
        ),
      ],
    }),
  },
  '/connected-measurement-points/{stationId}/measurement-export.csv': {
    get: securedOperation({
      tag: 'Connected Measurement Points',
      summary: 'Export measurement CSV',
      operationId: 'exportMeasurementCsv',
      description:
        'startDate ต้องไม่เกิน endDate; hourly รวมได้ไม่เกิน 366 วัน และ daily ต้องน้อยกว่า 10 ปีปฏิทิน',
      parameters: [
        stationIdParameter,
        queryEnum('frequency', ['hourly', 'daily'], 'ความถี่ที่ส่งออก', true),
        queryString('startDate', 'วันที่เริ่มต้น YYYY-MM-DD', true, 10, isoDatePattern, 'date'),
        queryString('endDate', 'วันที่สิ้นสุด YYYY-MM-DD', true, 10, isoDatePattern, 'date'),
        {
          name: 'parameters',
          in: 'query',
          required: true,
          description: 'ส่งได้หลายค่าและต้องมีอย่างน้อย 1 รายการ',
          schema: {
            type: 'array',
            minItems: 1,
            items: { type: 'string', minLength: 1 },
          },
          style: 'form',
          explode: true,
        },
      ],
      successSchema: schemaRef('CsvExportResponse'),
      successDescription: 'ไฟล์ CSV',
      extraResponses: {
        '200': {
          description: 'ไฟล์ CSV',
          content: {
            'text/csv': {
              schema: schemaRef('CsvExportResponse'),
            },
          },
        },
      },
    }),
  },
  '/connected-measurement-points/{stationId}/{buddhistYear}/measurement-export.csv': {
    get: securedOperation({
      tag: 'Connected Measurement Points',
      summary: 'Export measurement CSV by annual station code',
      operationId: 'exportMeasurementCsvByAnnualPath',
      description:
        'startDate ต้องไม่เกิน endDate; hourly รวมได้ไม่เกิน 366 วัน และ daily ต้องน้อยกว่า 10 ปีปฏิทิน',
      parameters: [
        annualStationIdParameter,
        buddhistYearParameter,
        queryEnum('frequency', ['hourly', 'daily'], 'ความถี่ที่ส่งออก', true),
        queryString('startDate', 'วันที่เริ่มต้น YYYY-MM-DD', true, 10, isoDatePattern, 'date'),
        queryString('endDate', 'วันที่สิ้นสุด YYYY-MM-DD', true, 10, isoDatePattern, 'date'),
        {
          name: 'parameters',
          in: 'query',
          required: true,
          description: 'ส่งได้หลายค่าและต้องมีอย่างน้อย 1 รายการ',
          schema: {
            type: 'array',
            minItems: 1,
            items: { type: 'string', minLength: 1 },
          },
          style: 'form',
          explode: true,
        },
      ],
      successSchema: schemaRef('CsvExportResponse'),
      successDescription: 'ไฟล์ CSV',
      extraResponses: {
        '200': {
          description: 'ไฟล์ CSV',
          content: {
            'text/csv': {
              schema: schemaRef('CsvExportResponse'),
            },
          },
        },
      },
    }),
  },
  '/connected-measurement-points/{stationId}/calendar-status': {
    get: securedOperation({
      tag: 'Connected Measurement Points',
      summary: 'Calendar status summary',
      operationId: 'getCalendarStatus',
      parameters: [
        stationIdParameter,
        queryString('month', 'เดือนรูปแบบ YYYY-MM', true, 7, yearMonthPattern),
      ],
    }),
  },
  '/connected-measurement-points/{stationId}/{buddhistYear}/calendar-status': {
    get: securedOperation({
      tag: 'Connected Measurement Points',
      summary: 'Calendar status summary by annual station code',
      operationId: 'getCalendarStatusByAnnualPath',
      parameters: [
        annualStationIdParameter,
        buddhistYearParameter,
        queryString('month', 'เดือนรูปแบบ YYYY-MM', true, 7, yearMonthPattern),
      ],
    }),
  },
  '/connected-measurement-points/{stationId}/calendar-status/details': {
    get: securedOperation({
      tag: 'Connected Measurement Points',
      summary: 'Calendar status details',
      operationId: 'getCalendarStatusDetails',
      parameters: [
        stationIdParameter,
        queryString('year', 'ปีรูปแบบ YYYY และต้องมากกว่า 0000', true, 4, fourDigitYearPattern),
        queryEnum('summaryType', ['exceeded', 'lowData'], 'ประเภทสรุป', true),
        queryString('parameterCode', 'รหัสพารามิเตอร์', true, 64),
        queryString('unit', 'หน่วย', false, 64),
      ],
    }),
  },
  '/connected-measurement-points/{stationId}/{buddhistYear}/calendar-status/details': {
    get: securedOperation({
      tag: 'Connected Measurement Points',
      summary: 'Calendar status details by annual station code',
      operationId: 'getCalendarStatusDetailsByAnnualPath',
      parameters: [
        annualStationIdParameter,
        buddhistYearParameter,
        queryString('year', 'ปีรูปแบบ YYYY และต้องมากกว่า 0000', true, 4, fourDigitYearPattern),
        queryEnum('summaryType', ['exceeded', 'lowData'], 'ประเภทสรุป', true),
        queryString('parameterCode', 'รหัสพารามิเตอร์', true, 64),
        queryString('unit', 'หน่วย', false, 64),
      ],
    }),
  },
  '/poms-factories': {
    get: securedOperation({
      tag: 'Master Data',
      summary: 'List current/live POMS factories',
      operationId: 'listPomsFactories',
      description:
        'คืนโรงงานที่มี active row ใน cems_wpms_connected_measurement_points เท่านั้น และใช้ data scope ของ factories:view',
      parameters: [
        queryString(
          'search',
          'ค้นหาจากชื่อโรงงาน รหัสโรงงาน เลขทะเบียนโรงงาน หรือชื่อ/รหัสจุดตรวจวัด',
          false,
          255,
        ),
      ],
      successSchema: schemaRef('PomsFactoriesResponse'),
    }),
  },
  '/poms-factories/{factoryId}': {
    get: securedOperation({
      tag: 'Master Data',
      summary: 'Get current/live POMS factory and measurement points',
      operationId: 'getPomsFactoryDetail',
      description:
        'คืนข้อมูลโรงงานและ active measurement points. measurementPoints เป็นข้อมูลอ่านอย่างเดียวในรุ่นแรก และ resource นอก data scope ตอบ 404',
      parameters: [factoryIdParameter],
      successSchema: schemaRef('PomsFactoryDetailResponse'),
    }),
  },
  '/poms-factories/edit-requests': {
    get: securedOperation({
      tag: 'Master Data',
      summary: 'List POMS factory profile edit requests',
      operationId: 'listPomsFactoryEditRequests',
      description:
        'คืนเฉพาะคำขอของโรงงานใน data scope ของ factories:view พร้อมสถานะ workflow และ event timeline',
      parameters: [
        queryEnum('status', pomsFactoryEditRequestStatusValues, 'กรองสถานะคำขอแก้ไขข้อมูล'),
        queryString('factoryId', 'กรองด้วย factoryId หรือเลขทะเบียนโรงงาน', false, 64),
        queryString(
          'search',
          'ค้นหาจากเลขคำขอ รหัสโรงงาน เลขทะเบียนโรงงาน หรือชื่อโรงงาน',
          false,
          255,
        ),
      ],
      successSchema: schemaRef('PomsFactoryEditRequestsResponse'),
    }),
  },
  '/poms-factories/{factoryId}/edit-requests': {
    post: securedOperation({
      tag: 'Master Data',
      summary: 'Submit a POMS factory profile edit request',
      operationId: 'createPomsFactoryEditRequest',
      description:
        'ต้องมี factories:view และ factories:edit โดยการคัดโรงงานสำหรับ mutation ยึด data scope ของ factories:edit. สร้างคำขอ PENDING_REVIEW จาก current/live profile; รุ่นแรกแก้ได้เฉพาะ allowlist ใน request schema และไม่รับ measurementPoints. โรงงานหนึ่งแห่งมีคำขอเปิดได้ครั้งละหนึ่งรายการ',
      parameters: [factoryIdParameter],
      requestBody: jsonRequestBody(
        schemaRef('PomsFactoryEditableProfileRequest'),
        pomsFactoryEditRequestExample,
      ),
      successStatus: '201',
      successSchema: schemaRef('PomsFactoryEditRequestResponse'),
      extraResponses: {
        '409': {
          description:
            'มีคำขอเปิดของโรงงานนี้อยู่แล้ว หรือ current/live profile เปลี่ยนระหว่างทำรายการ',
          content: {
            'application/json': { schema: schemaRef('ErrorEnvelope') },
          },
        },
      },
    }),
  },
  '/poms-factories/edit-requests/{id}': {
    get: securedOperation({
      tag: 'Master Data',
      summary: 'Get POMS factory profile edit request detail',
      operationId: 'getPomsFactoryEditRequest',
      description:
        'คืน currentFactory, proposedFactory และ events เรียงตามเวลา; resource นอก data scope ตอบ 404',
      parameters: [idParameter],
      successSchema: schemaRef('PomsFactoryEditRequestResponse'),
    }),
  },
  '/poms-factories/edit-requests/{id}/resubmission': {
    put: securedOperation({
      tag: 'Master Data',
      summary: 'Resubmit a revised POMS factory profile',
      operationId: 'resubmitPomsFactoryEditRequest',
      description:
        'ต้องมี factories:view และ factories:edit โดยการคัดคำขอสำหรับ mutation ยึด data scope ของ factories:edit. ทำได้เมื่อ status = REVISION_REQUESTED เท่านั้น; บันทึก event RESUBMIT, เพิ่ม revisionNo และเปลี่ยนเป็น REVISED_PENDING_REVIEW',
      parameters: [idParameter],
      requestBody: jsonRequestBody(schemaRef('PomsFactoryEditableProfileRequest'), {
        ...pomsFactoryEditRequestExample,
        note: 'แก้ไขพิกัดและภาพถ่ายตามคำขอของเจ้าหน้าที่แล้ว',
      }),
      successSchema: schemaRef('PomsFactoryEditRequestResponse'),
      extraResponses: {
        '409': {
          description:
            'สถานะไม่อนุญาตให้ resubmit หรือ current/live profile เปลี่ยนระหว่างทำรายการ',
          content: {
            'application/json': { schema: schemaRef('ErrorEnvelope') },
          },
        },
      },
    }),
  },
  '/poms-factories/edit-requests/{id}/review': {
    post: securedOperation({
      tag: 'Master Data',
      summary: 'Review a POMS factory profile edit request',
      operationId: 'reviewPomsFactoryEditRequest',
      description:
        'ต้องมี factories:view และ factories:approve โดยการคัดคำขอยึด data scope ของ factories:approve; ห้ามทั้ง original creator (createdBy) และ latest submitter (submittedBy) พิจารณาคำขอของตนเอง. APPROVE อัปเดต current/live rows ใน cems_wpms_connected_measurement_points และ eligible_factories ภายใน transaction เดียว; ไม่อัปเดต factories. REQUEST_REVISION เปลี่ยนเป็น REVISION_REQUESTED; REJECT ปิดคำขอ',
      parameters: [idParameter],
      requestBody: jsonRequestBody(
        schemaRef('PomsFactoryEditReviewRequest'),
        pomsFactoryEditReviewExample,
      ),
      successSchema: schemaRef('PomsFactoryEditRequestResponse'),
      extraResponses: {
        '409': {
          description:
            'สถานะไม่อนุญาต ผู้สร้างพยายามพิจารณาคำขอตนเอง หรือ current/live profile เปลี่ยนก่อนอนุมัติ',
          content: {
            'application/json': { schema: schemaRef('ErrorEnvelope') },
          },
        },
      },
    }),
  },
  '/device-connections': {
    get: securedOperation({
      tag: 'Connection Requests',
      summary: 'List device connection configs',
      operationId: 'listDeviceConnections',
      parameters: [
        queryString('stationId', 'รหัสจุดตรวจวัด', true, 64),
        queryEnum('protocol', protocolValues, 'กรอง protocol'),
      ],
    }),
    post: securedOperation({
      tag: 'Connection Requests',
      summary: 'Create device connection config',
      operationId: 'createDeviceConnection',
      requestBody: jsonRequestBody(schemaRef('DeviceConnectionConfig'), deviceConnectionExample),
      successStatus: '201',
    }),
  },
  '/device-connections/{id}': {
    get: securedOperation({
      tag: 'Connection Requests',
      summary: 'Get device connection config',
      operationId: 'getDeviceConnectionById',
      parameters: [idParameter],
    }),
  },
  '/monitoring-point-forms': {
    get: securedOperation({
      tag: 'Eligible Factories',
      summary: 'List monitoring point forms',
      operationId: 'listMonitoringPointForms',
      parameters: [
        queryString('factoryRegistrationNoNew', 'เลขทะเบียนโรงงานใหม่', false, 64),
        queryEnum('systemType', systemTypeValues, 'กรองระบบตรวจวัด'),
      ],
    }),
    post: securedOperation({
      tag: 'Eligible Factories',
      summary: 'Create monitoring point form',
      operationId: 'createMonitoringPointForm',
      requestBody: jsonRequestBody(
        schemaRef('MonitoringPointFormRequest'),
        monitoringPointFormExample,
      ),
      successStatus: '201',
    }),
  },
  '/monitoring-point-forms/{id}': {
    get: securedOperation({
      tag: 'Eligible Factories',
      summary: 'Get monitoring point form detail',
      operationId: 'getMonitoringPointFormById',
      parameters: [formIdParameter],
    }),
    put: securedOperation({
      tag: 'Eligible Factories',
      summary: 'Update monitoring point form',
      operationId: 'updateMonitoringPointForm',
      parameters: [formIdParameter],
      requestBody: jsonRequestBody(
        schemaRef('MonitoringPointFormRequest'),
        monitoringPointFormExample,
      ),
    }),
  },
  '/monitoring-point-forms/{id}/select-eligible': {
    post: securedOperation({
      tag: 'Eligible Factories',
      summary: 'Select monitoring point form as eligible factory',
      operationId: 'selectMonitoringPointFormEligible',
      parameters: [formIdParameter],
      successStatus: '201',
    }),
  },
  '/monitoring-point-forms/attachments': {
    post: securedOperation({
      tag: 'Eligible Factories',
      summary: 'Upload monitoring point attachment',
      operationId: 'uploadMonitoringPointAttachment',
      requestBody: multipartRequestBody(schemaRef('MonitoringPointAttachmentUploadRequest')),
      successStatus: '201',
      extraResponses: {
        '429': { $ref: '#/components/responses/TooManyRequests' },
      },
    }),
  },
  '/monitoring-point-forms/attachments/{publicId}/content': {
    get: publicOperation({
      tag: 'Eligible Factories',
      summary: 'Download monitoring point attachment content',
      operationId: 'downloadMonitoringPointAttachment',
      parameters: [publicAttachmentIdParameter, expiresParameter, signatureParameter],
      successSchema: schemaRef('AttachmentContentResponse'),
      successDescription: 'ไฟล์แนบ',
      extraResponses: {
        '200': {
          description: 'ไฟล์แนบ',
          content: {
            'application/octet-stream': {
              schema: schemaRef('AttachmentContentResponse'),
            },
          },
        },
        '410': { $ref: '#/components/responses/Gone' },
      },
    }),
  },
  '/bod-cod-deviation-reports/attachments': {
    post: securedOperation({
      tag: 'BOD/COD Deviation Reports',
      summary: 'Upload BOD/COD attachment',
      operationId: 'uploadBodCodAttachment',
      requestBody: multipartRequestBody(schemaRef('BodCodAttachmentUploadRequest')),
      successStatus: '201',
    }),
  },
  '/bod-cod-deviation-reports/factories': {
    get: securedOperation({
      tag: 'BOD/COD Deviation Reports',
      summary: 'List BOD/COD factories',
      operationId: 'listBodCodFactories',
      successSchema: schemaRef('BodCodFactoriesResponse'),
    }),
  },
  '/bod-cod-deviation-reports': {
    get: securedOperation({
      tag: 'BOD/COD Deviation Reports',
      summary: 'List BOD/COD deviation reports',
      operationId: 'listBodCodReports',
      parameters: [
        queryEnum('status', [...BOD_COD_DEVIATION_REPORT_STATUSES], 'กรองสถานะ'),
        queryEnum('parameterCode', ['BOD', 'COD'], 'กรองพารามิเตอร์'),
        queryString('factoryId', 'กรองรหัสโรงงาน', false, 64),
      ],
      successSchema: schemaRef('BodCodReportsResponse'),
    }),
    post: securedOperation({
      tag: 'BOD/COD Deviation Reports',
      summary: 'Create BOD/COD deviation report',
      operationId: 'createBodCodReport',
      requestBody: jsonRequestBody(schemaRef('BodCodReportRequest'), bodCodReportExample),
      successStatus: '201',
      successSchema: schemaRef('BodCodReportResponse'),
    }),
  },
  '/bod-cod-deviation-reports/{id}': {
    get: securedOperation({
      tag: 'BOD/COD Deviation Reports',
      summary: 'Get BOD/COD deviation report detail',
      operationId: 'getBodCodReportById',
      parameters: [idParameter],
      successSchema: schemaRef('BodCodReportResponse'),
    }),
  },
  '/bod-cod-deviation-reports/{id}/resubmission': {
    put: securedOperation({
      tag: 'BOD/COD Deviation Reports',
      summary: 'Resubmit BOD/COD deviation report',
      operationId: 'resubmitBodCodReport',
      parameters: [idParameter],
      requestBody: jsonRequestBody(schemaRef('BodCodReportResubmissionRequest'), {
        ...bodCodReportExample,
        revisionNote: 'แก้ไขตามคำขอ',
      }),
      successSchema: schemaRef('BodCodReportResponse'),
    }),
  },
  '/bod-cod-deviation-reports/{id}/workflow-actions': {
    post: securedOperation({
      tag: 'BOD/COD Deviation Reports',
      summary: 'Change BOD/COD workflow status',
      operationId: 'changeBodCodWorkflowStatus',
      parameters: [idParameter],
      requestBody: jsonRequestBody(schemaRef('BodCodWorkflowActionRequest'), {
        action: 'REQUEST_REVISION',
        revisionReason: 'กรุณาแนบข้อมูลห้องปฏิบัติการให้ครบ',
      }),
      successSchema: schemaRef('BodCodReportResponse'),
    }),
  },
  '/bod-cod-deviation-reports/{id}/result-notice': {
    post: securedOperation({
      tag: 'BOD/COD Deviation Reports',
      summary: 'Create BOD/COD result notice',
      operationId: 'createBodCodResultNotice',
      parameters: [idParameter],
      requestBody: jsonRequestBody(schemaRef('BodCodResultNoticeRequest'), {
        reportCorrectness: 'ถูกต้องครบถ้วน',
        checkedParameters: ['BOD'],
        reviewResult: 'เห็นควรแจ้งผลการตรวจสอบ',
        inspectorName: 'เจ้าหน้าที่ตรวจสอบ',
        inspectorPosition: 'นักวิชาการสิ่งแวดล้อม',
      }),
      successSchema: schemaRef('BodCodReportResponse'),
    }),
    put: securedOperation({
      tag: 'BOD/COD Deviation Reports',
      summary: 'Update BOD/COD result notice',
      operationId: 'updateBodCodResultNotice',
      parameters: [idParameter],
      requestBody: jsonRequestBody(schemaRef('BodCodResultNoticeRequest'), {
        reportCorrectness: 'ไม่ถูกต้องครบถ้วน',
        checkedParameters: ['BOD', 'COD'],
        reviewResult: 'เห็นควรให้แก้ไขเพิ่มเติม',
        comment: 'เพิ่มเอกสารแนบ',
        inspectorName: 'เจ้าหน้าที่ตรวจสอบ',
        inspectorPosition: 'นักวิชาการสิ่งแวดล้อม',
      }),
      successSchema: schemaRef('BodCodReportResponse'),
    }),
  },
  '/kwp-form-reports/factories': {
    get: securedOperation({
      tag: 'KWP Forms',
      summary: 'List KWP factories',
      operationId: 'listKwpFactories',
      description:
        'คืนเฉพาะโรงงานที่มีจุดตรวจวัดเชื่อมต่ออยู่ โดย newRegistrationNo และ province มาจาก eligible factory เดียวกัน',
      successSchema: schemaRef('KwpFormFactoriesResponse'),
    }),
  },
  '/kwp-form-reports/requests': {
    get: securedOperation({
      tag: 'KWP Forms',
      summary: 'List KWP requests',
      operationId: 'listKwpRequests',
      parameters: [
        queryEnum('formType', [...KWP_FORM_TYPES], 'กรองประเภทแบบ'),
        queryEnum('status', [...KWP_FORM_STATUSES], 'กรองสถานะ'),
        queryString(
          'factoryId',
          'กรองด้วย factory id, เลขทะเบียนปัจจุบัน หรือเลขทะเบียนเดิม',
          false,
          64,
        ),
      ],
      description:
        'คืนรายการคำขอโดย resolve ข้อมูลโรงงานปัจจุบันแบบ deterministic; snapshot ตอนยื่นยังคงอยู่ในฐานข้อมูลและใช้เป็น fallback เมื่อหา current identity ไม่ได้',
      successSchema: schemaRef('KwpFormRequestsResponse'),
    }),
  },
  '/kwp-form-submissions/attachments': {
    post: securedOperation({
      tag: 'KWP Forms',
      summary: 'Upload KWP attachment',
      operationId: 'uploadKwpAttachment',
      requestBody: multipartRequestBody(schemaRef('KwpAttachmentUploadRequest')),
      successStatus: '201',
    }),
  },
  '/kwp-form-submissions/kwp01': {
    post: securedOperation({
      tag: 'KWP Forms',
      summary: 'Create KWP01',
      operationId: 'createKwp01',
      requestBody: jsonRequestBody(schemaRef('Kwp01Request'), kwp01Example),
      successStatus: '201',
    }),
  },
  '/kwp-form-submissions/kwp01/{id}': {
    get: securedOperation({
      tag: 'KWP Forms',
      summary: 'Get KWP01 detail',
      operationId: 'getKwp01ById',
      parameters: [idParameter],
    }),
    patch: securedOperation({
      tag: 'KWP Forms',
      summary: 'Update KWP01',
      operationId: 'updateKwp01',
      parameters: [idParameter],
      requestBody: jsonRequestBody(schemaRef('Kwp01Request'), kwp01Example),
    }),
  },
  '/kwp-form-submissions/kwp01/{id}/resubmit': {
    post: securedOperation({
      tag: 'KWP Forms',
      summary: 'Resubmit KWP01',
      operationId: 'resubmitKwp01',
      parameters: [idParameter],
      requestBody: jsonRequestBody(schemaRef('KwpResubmitRequest'), { note: 'แก้ไขแล้ว' }),
    }),
  },
  '/kwp-form-submissions/kwp02': {
    post: securedOperation({
      tag: 'KWP Forms',
      summary: 'Create KWP02',
      operationId: 'createKwp02',
      requestBody: jsonRequestBody(schemaRef('Kwp02Or04Request'), {
        factoryId: 'F000123',
        factoryName: 'บริษัท โรงงานตัวอย่าง จำกัด',
        measurementItems: [{ pollutant: 'BOD (mg/l)' }],
      }),
      successStatus: '201',
    }),
  },
  '/kwp-form-submissions/kwp02/{id}': {
    get: securedOperation({
      tag: 'KWP Forms',
      summary: 'Get KWP02 detail',
      operationId: 'getKwp02ById',
      parameters: [idParameter],
    }),
    patch: securedOperation({
      tag: 'KWP Forms',
      summary: 'Update KWP02',
      operationId: 'updateKwp02',
      parameters: [idParameter],
      requestBody: jsonRequestBody(schemaRef('Kwp02Or04Request'), {
        factoryId: 'F000123',
        factoryName: 'บริษัท โรงงานตัวอย่าง จำกัด',
        measurementItems: [{ pollutant: 'BOD (mg/l)' }],
      }),
    }),
  },
  '/kwp-form-submissions/kwp02/{id}/resubmit': {
    post: securedOperation({
      tag: 'KWP Forms',
      summary: 'Resubmit KWP02',
      operationId: 'resubmitKwp02',
      parameters: [idParameter],
      requestBody: jsonRequestBody(schemaRef('KwpResubmitRequest'), { note: 'แก้ไขแล้ว' }),
    }),
  },
  '/kwp-form-submissions/kwp03': {
    post: securedOperation({
      tag: 'KWP Forms',
      summary: 'Create KWP03',
      operationId: 'createKwp03',
      requestBody: jsonRequestBody(schemaRef('Kwp03Request'), kwp03Example),
      successStatus: '201',
    }),
  },
  '/kwp-form-submissions/kwp03/{id}': {
    get: securedOperation({
      tag: 'KWP Forms',
      summary: 'Get KWP03 detail',
      operationId: 'getKwp03ById',
      parameters: [idParameter],
    }),
    patch: securedOperation({
      tag: 'KWP Forms',
      summary: 'Update KWP03',
      operationId: 'updateKwp03',
      parameters: [idParameter],
      requestBody: jsonRequestBody(schemaRef('Kwp03Request'), kwp03Example),
    }),
  },
  '/kwp-form-submissions/kwp03/{id}/resubmit': {
    post: securedOperation({
      tag: 'KWP Forms',
      summary: 'Resubmit KWP03',
      operationId: 'resubmitKwp03',
      parameters: [idParameter],
      requestBody: jsonRequestBody(schemaRef('KwpResubmitRequest'), { note: 'แก้ไขแล้ว' }),
    }),
  },
  '/kwp-form-submissions/kwp04': {
    post: securedOperation({
      tag: 'KWP Forms',
      summary: 'Create KWP04',
      operationId: 'createKwp04',
      requestBody: jsonRequestBody(schemaRef('Kwp02Or04Request'), {
        factoryId: 'F000123',
        factoryName: 'บริษัท โรงงานตัวอย่าง จำกัด',
        measurementItems: [{ pollutant: 'COD (mg/l)' }],
      }),
      successStatus: '201',
    }),
  },
  '/kwp-form-submissions/kwp04/{id}': {
    get: securedOperation({
      tag: 'KWP Forms',
      summary: 'Get KWP04 detail',
      operationId: 'getKwp04ById',
      parameters: [idParameter],
    }),
    patch: securedOperation({
      tag: 'KWP Forms',
      summary: 'Update KWP04',
      operationId: 'updateKwp04',
      parameters: [idParameter],
      requestBody: jsonRequestBody(schemaRef('Kwp02Or04Request'), {
        factoryId: 'F000123',
        factoryName: 'บริษัท โรงงานตัวอย่าง จำกัด',
        measurementItems: [{ pollutant: 'COD (mg/l)' }],
      }),
    }),
  },
  '/kwp-form-submissions/kwp04/{id}/resubmit': {
    post: securedOperation({
      tag: 'KWP Forms',
      summary: 'Resubmit KWP04',
      operationId: 'resubmitKwp04',
      parameters: [idParameter],
      requestBody: jsonRequestBody(schemaRef('KwpResubmitRequest'), { note: 'แก้ไขแล้ว' }),
    }),
  },
  '/kwp-form-submissions/kwp05': {
    post: securedOperation({
      tag: 'KWP Forms',
      summary: 'Create KWP05',
      operationId: 'createKwp05',
      requestBody: jsonRequestBody(schemaRef('Kwp05Request'), kwp05Example),
      successStatus: '201',
    }),
  },
  '/kwp-form-submissions/kwp05/{id}': {
    get: securedOperation({
      tag: 'KWP Forms',
      summary: 'Get KWP05 detail',
      operationId: 'getKwp05ById',
      parameters: [idParameter],
    }),
    patch: securedOperation({
      tag: 'KWP Forms',
      summary: 'Update KWP05',
      operationId: 'updateKwp05',
      parameters: [idParameter],
      requestBody: jsonRequestBody(schemaRef('Kwp05Request'), kwp05Example),
    }),
  },
  '/kwp-form-submissions/kwp05/{id}/resubmit': {
    post: securedOperation({
      tag: 'KWP Forms',
      summary: 'Resubmit KWP05',
      operationId: 'resubmitKwp05',
      parameters: [idParameter],
      requestBody: jsonRequestBody(schemaRef('KwpResubmitRequest'), { note: 'แก้ไขแล้ว' }),
    }),
  },
  '/kwp-form-submissions/{id}/workflow': {
    get: securedOperation({
      tag: 'KWP Forms',
      summary: 'Get KWP workflow',
      operationId: 'getKwpWorkflow',
      parameters: [idParameter],
    }),
  },
  '/kwp-form-submissions/{id}/workflow-actions': {
    post: securedOperation({
      tag: 'KWP Forms',
      summary: 'Change KWP workflow status',
      operationId: 'changeKwpWorkflowStatus',
      parameters: [idParameter],
      requestBody: jsonRequestBody(schemaRef('KwpWorkflowActionRequest'), {
        action: 'REQUEST_REVISION',
        revisionReason: 'กรุณาแนบไฟล์เพิ่ม',
      }),
    }),
  },
  '/integrations/device-configs/{stationId}': {
    get: apiKeyOperation('deviceConfigApiKey', {
      tag: 'Integrations',
      summary: 'Get device config for station',
      operationId: 'getIntegrationDeviceConfig',
      parameters: [integrationStationIdParameter],
      successSchema: schemaRef('IntegrationDeviceConfigsResponse'),
    }),
  },
  '/integrations/lasthour/factories/{registrationNo}': {
    get: {
      ...apiKeyOperation('factoryDashboardApiKey', {
        tag: 'Integrations',
        summary: 'Get latest hourly dashboard for one connected factory',
        operationId: 'getIntegrationFactoryDashboard',
        description:
          'คืนโรงงาน current/live หนึ่งแห่งและข้อมูลชั่วโมงที่คำนวณเสร็จล่าสุดตาม Asia/Bangkok; response ไม่คืน isFavorite และใช้ Cache-Control: no-store',
        parameters: [factoryRegistrationNoParameter],
        successSchema: schemaRef('IntegrationFactoryDashboardResponse'),
        extraResponses: {
          '429': {
            description:
              'เกิน global rate limit; ใช้ Retry-After และ RateLimit headers เพื่อ retry',
            content: {
              'text/html': {
                schema: {
                  type: 'string',
                  example: 'Too many requests, please try again later.',
                },
              },
            },
          },
        },
      }),
      servers: [{ url: '/', description: 'Application root; endpoint นี้อยู่นอก API prefix' }],
    },
  },
  '/integrations/factories/{registrationNo}/dashboard': {
    get: apiKeyOperation('factoryDashboardApiKey', {
      tag: 'Integrations',
      summary: 'Legacy factory dashboard endpoint',
      operationId: 'getLegacyIntegrationFactoryDashboard',
      description:
        'Compatibility alias ที่ deprecated แล้ว; client ใหม่ให้ใช้ GET /integrations/lasthour/factories/{registrationNo}',
      deprecated: true,
      parameters: [factoryRegistrationNoParameter],
      successSchema: schemaRef('IntegrationFactoryDashboardResponse'),
      extraResponses: {
        '429': {
          description: 'เกิน global rate limit; ใช้ Retry-After และ RateLimit headers เพื่อ retry',
          content: {
            'text/html': {
              schema: {
                type: 'string',
                example: 'Too many requests, please try again later.',
              },
            },
          },
        },
      },
    }),
  },
  '/integrations/device-configs/{stationId}/{buddhistYear}': {
    get: apiKeyOperation('deviceConfigApiKey', {
      tag: 'Integrations',
      summary: 'Get device config for annual station code',
      operationId: 'getIntegrationDeviceConfigByAnnualPath',
      parameters: [annualStationIdParameter, buddhistYearParameter],
      successSchema: schemaRef('IntegrationDeviceConfigsResponse'),
    }),
  },
  '/integrations/alert-events': {
    post: apiKeyOperation('alertEventApiKey', {
      tag: 'Integrations',
      summary: 'Submit integration alert events',
      operationId: 'createIntegrationAlertEvents',
      requestBody: jsonRequestBody(
        schemaRef('IntegrationAlertEventBatchRequest'),
        alertEventBatchExample,
      ),
    }),
  },
  '/alert-events': {
    get: securedOperation({
      tag: 'Notifications',
      summary: 'List alert events',
      operationId: 'listAlertEvents',
      description: 'ถ้าส่ง dateFrom และ dateTo ต้องมี dateTo ไม่น้อยกว่า dateFrom',
      parameters: [
        queryEnum('systemType', systemTypeValues, 'กรอง systemType'),
        queryEnum(
          'displaySystemType',
          [...ALERT_EVENT_DISPLAY_SYSTEM_TYPES],
          'กรอง display system',
        ),
        queryEnum('alertType', [...ALERT_EVENT_ALERT_TYPES], 'กรองประเภท alert'),
        queryEnum('thresholdType', [...ALERT_EVENT_THRESHOLD_TYPES], 'กรองประเภทเกณฑ์'),
        queryString('factoryId', 'กรองรหัสโรงงาน', false, 128),
        {
          name: 'stationId',
          in: 'query',
          required: false,
          description: 'กรองรหัสจุดตรวจวัดแบบ safe code หรือ annual monitoring point code',
          schema: alertMonitoringPointCodeSchema,
        },
        {
          name: 'parameterCode',
          in: 'query',
          required: false,
          description: 'กรองรหัสพารามิเตอร์; backend normalize เป็น lowercase',
          schema: {
            type: 'string',
            minLength: 1,
            maxLength: 128,
            pattern: '^[A-Za-z0-9_-]+$',
          },
        },
        queryString('dateFrom', 'วันที่เริ่มต้น YYYY-MM-DD', false, 10, isoDatePattern),
        queryString('dateTo', 'วันที่สิ้นสุด YYYY-MM-DD', false, 10, isoDatePattern),
        queryInteger('page', 'เลขหน้า', false, 1),
        queryInteger('pageSize', 'จำนวนรายการต่อหน้า', false, 1, 100),
      ],
    }),
  },
  '/alert-events/{id}': {
    get: securedOperation({
      tag: 'Notifications',
      summary: 'Get alert event detail',
      operationId: 'getAlertEventById',
      parameters: [alertEventIdParameter],
    }),
  },
  '/alert-events/{id}/status': {
    patch: securedOperation({
      tag: 'Notifications',
      summary: 'Update alert event status',
      operationId: 'updateAlertEventStatus',
      parameters: [alertEventIdParameter],
      requestBody: jsonRequestBody(schemaRef('AlertEventStatusRequest'), {
        notificationStatus: 'ACKNOWLEDGED',
        note: 'รับทราบแล้ว',
      }),
    }),
  },
  '/email-test/send': {
    post: securedOperation({
      tag: 'Internal Tools',
      summary: 'Send test email',
      description: 'ส่งอีเมลทดสอบผ่าน SMTP โดย backend เพิ่ม diw.iemc@gmail.com เป็น CC อัตโนมัติ',
      operationId: 'sendEmailTest',
      requestBody: jsonRequestBody(schemaRef('EmailTestRequest'), emailTestExample),
    }),
  },
  '/officer-notification-email-recipients': {
    get: securedOperation({
      tag: 'Notifications',
      summary: 'List officer notification email recipients',
      description:
        'คืนรายชื่อกลางตามพื้นที่ โดยกรุงเทพมหานครใช้ SARABAN@DIW.MAIL.GO.TH และนิคมอุตสาหกรรมใช้ warroom.emcc@ieat.go.th',
      operationId: 'listOfficerNotificationRecipients',
    }),
    post: securedOperation({
      tag: 'Notifications',
      summary: 'Create officer notification email recipient group',
      operationId: 'createOfficerNotificationRecipient',
      requestBody: jsonRequestBody(
        schemaRef('OfficerNotificationRecipientRequest'),
        createRecipientExample,
      ),
      successStatus: '201',
    }),
  },
  '/officer-notification-email-recipients/{id}/emails': {
    post: securedOperation({
      tag: 'Notifications',
      summary: 'Add email to recipient group',
      operationId: 'addOfficerNotificationRecipientEmail',
      parameters: [idParameter],
      requestBody: jsonRequestBody(schemaRef('OfficerNotificationAddEmailRequest'), {
        email: 'new-officer@example.com',
      }),
    }),
  },
};

const tags: OpenApiObject[] = [
  {
    name: MENU_TAGS.SYSTEM,
    description: 'Health check, API root, หน้าเอกสาร, login, current user และเครื่องมือทดสอบภายใน',
  },
  {
    name: MENU_TAGS.HOME,
    description:
      'โรงงานของผู้ประกอบการ, POMS membership, connected dashboard, public map และ favorite',
  },
  {
    name: MENU_TAGS.MASTER_DATA,
    description: 'ข้อมูลจุดตรวจวัดที่เชื่อมต่อแล้ว ประวัติคำขอ และ device config ปัจจุบัน',
  },
  {
    name: MENU_TAGS.CONNECTION_REQUESTS,
    description: 'คำขอ CEMS/WPMS, parameter values และการตั้งค่าอุปกรณ์',
  },
  {
    name: MENU_TAGS.KWP_FORMS,
    description: 'อัปโหลด ส่ง แก้ไข resubmit อ่านรายละเอียด และ workflow ของแบบ กวภ. 01-05',
  },
  {
    name: MENU_TAGS.BOD_COD_REPORTS,
    description: 'รายงานค่าความคลาดเคลื่อน เอกสารแนบ workflow และแบบแจ้งผล',
  },
  {
    name: MENU_TAGS.NOTIFICATIONS,
    description: 'Alert events, สถานะแจ้งเตือน และผู้รับอีเมลเจ้าหน้าที่',
  },
  {
    name: MENU_TAGS.STATISTICS,
    description: 'สถิติ ค่าปฏิทิน และการส่งออก CSV ของจุดตรวจวัด',
  },
  {
    name: MENU_TAGS.PERMISSIONS,
    description: 'ผู้ใช้ บัญชี local permission overrides และการระงับผู้ใช้',
  },
  {
    name: MENU_TAGS.ELIGIBLE_FACTORIES,
    description: 'รายชื่อโรงงานที่เข้าข่ายและฟอร์มข้อมูลจุดตรวจวัด',
  },
  {
    name: MENU_TAGS.INTEGRATIONS,
    description: 'API key contract สำหรับอุปกรณ์และระบบภายนอก',
  },
];

const operationMethods = new Set([
  'get',
  'put',
  'post',
  'delete',
  'options',
  'head',
  'patch',
  'trace',
]);

function menuTagForPath(path: string): string {
  if (
    path === '/' ||
    path === '/health' ||
    path.startsWith('/docs') ||
    path === '/openapi.json' ||
    path.startsWith('/auth/') ||
    path.startsWith('/email-test/')
  ) {
    return MENU_TAGS.SYSTEM;
  }
  if (
    path.startsWith('/public/factory-map-points') ||
    path.startsWith('/operator-factory-dashboard') ||
    path === '/operator-factories' ||
    path.startsWith('/operator-factories/')
  ) {
    return MENU_TAGS.HOME;
  }
  if (path.startsWith('/connected-measurement-points/')) {
    if (
      path.includes('/measurement-statistics') ||
      path.includes('/measurement-export.csv') ||
      path.includes('/calendar-status')
    ) {
      return MENU_TAGS.STATISTICS;
    }
    return MENU_TAGS.MASTER_DATA;
  }
  if (path === '/connected-measurement-points') return MENU_TAGS.MASTER_DATA;
  if (path.startsWith('/poms-factories')) return MENU_TAGS.MASTER_DATA;
  if (
    path.startsWith('/cems-wpms-requests') ||
    path.startsWith('/device-connections') ||
    path.startsWith('/parameter-values')
  ) {
    return MENU_TAGS.CONNECTION_REQUESTS;
  }
  if (path.startsWith('/kwp-form-')) return MENU_TAGS.KWP_FORMS;
  if (path.startsWith('/bod-cod-deviation-reports')) return MENU_TAGS.BOD_COD_REPORTS;
  if (
    path.startsWith('/alert-events') ||
    path.startsWith('/officer-notification-email-recipients')
  ) {
    return MENU_TAGS.NOTIFICATIONS;
  }
  if (path.startsWith('/users')) return MENU_TAGS.PERMISSIONS;
  if (path.startsWith('/eligible-factories') || path.startsWith('/monitoring-point-forms')) {
    return MENU_TAGS.ELIGIBLE_FACTORIES;
  }
  if (path.startsWith('/integrations')) return MENU_TAGS.INTEGRATIONS;
  throw new Error(`OpenAPI path is not assigned to a POMS menu: ${path}`);
}

interface AuthorizationRequirement {
  permissions: string[];
  mode: 'any' | 'all';
}

function authorizationRequirementFor(path: string, method: string): AuthorizationRequirement {
  if (
    path === '/auth/me' ||
    path === '/email-test/send' ||
    path === '/cems-wpms-requests/operator-factory-dashboard'
  ) {
    return { permissions: [], mode: 'any' };
  }

  if (path.startsWith('/users')) {
    if (path.endsWith('/permissions')) {
      return { permissions: ['permissions:manage'], mode: 'any' };
    }
    return method === 'get'
      ? { permissions: ['users:view', 'permissions:manage'], mode: 'any' }
      : { permissions: ['users:edit', 'permissions:manage'], mode: 'any' };
  }

  if (path.startsWith('/eligible-factories')) {
    return method === 'get'
      ? { permissions: ['eligible_factories:view'], mode: 'any' }
      : { permissions: ['eligible_factories:edit'], mode: 'any' };
  }

  if (path === '/operator-factory-dashboard') {
    return { permissions: ['dashboard:view'], mode: 'any' };
  }
  if (path === '/operator-factories') {
    return { permissions: ['dashboard:view'], mode: 'any' };
  }
  if (path.startsWith('/operator-factories/')) {
    return { permissions: ['dashboard.alerts:view'], mode: 'any' };
  }

  if (path.startsWith('/connected-measurement-points')) {
    if (path.includes('/measurement-export.csv')) {
      return { permissions: ['dashboard.stats:export'], mode: 'any' };
    }
    if (path.includes('/measurement-statistics') || path.includes('/calendar-status')) {
      return { permissions: ['dashboard.stats:view'], mode: 'any' };
    }
    return method === 'post'
      ? { permissions: ['cems_wpms_requests:edit'], mode: 'any' }
      : { permissions: ['cems_wpms_requests:view'], mode: 'any' };
  }

  if (path.startsWith('/poms-factories')) {
    if (path.includes('/edit-requests/') && path.endsWith('/review')) {
      return { permissions: ['factories:view', 'factories:approve'], mode: 'all' };
    }
    if (
      (path.endsWith('/edit-requests') && method === 'post') ||
      (path.endsWith('/resubmission') && method === 'put')
    ) {
      return { permissions: ['factories:view', 'factories:edit'], mode: 'all' };
    }
    return { permissions: ['factories:view'], mode: 'any' };
  }

  if (path.startsWith('/cems-wpms-requests')) {
    if (path.endsWith('/operator-factories') || path.includes('/factories/{factoryId}/general')) {
      return { permissions: ['factories:view'], mode: 'any' };
    }
    if (path.endsWith('/direct-connections')) {
      return { permissions: ['cems_wpms_requests:direct_connect'], mode: 'any' };
    }
    if (
      path.endsWith('/review') ||
      path.endsWith('/status') ||
      path.endsWith('/verify-connection')
    ) {
      return { permissions: ['cems_wpms_requests:approve'], mode: 'any' };
    }
    return method === 'get'
      ? { permissions: ['cems_wpms_requests:view'], mode: 'any' }
      : { permissions: ['cems_wpms_requests:edit'], mode: 'any' };
  }

  if (path.startsWith('/device-connections')) {
    return method === 'get'
      ? { permissions: ['cems_wpms_requests:view'], mode: 'any' }
      : { permissions: ['cems_wpms_requests:edit'], mode: 'any' };
  }
  if (path.startsWith('/parameter-values')) {
    return { permissions: ['cems_wpms_requests:view'], mode: 'any' };
  }

  if (path.startsWith('/monitoring-point-forms')) {
    if (path.endsWith('/select-eligible')) {
      return { permissions: ['eligible_factories:approve'], mode: 'any' };
    }
    return method === 'get'
      ? { permissions: ['cems_wpms_requests:view'], mode: 'any' }
      : { permissions: ['cems_wpms_requests:edit'], mode: 'any' };
  }

  if (path.startsWith('/bod-cod-deviation-reports')) {
    if (method === 'get') return { permissions: ['bod_cod_errors:view'], mode: 'any' };
    if (
      path.endsWith('/attachments') ||
      path === '/bod-cod-deviation-reports' ||
      path.endsWith('/resubmission')
    ) {
      return { permissions: ['bod_cod_errors:edit'], mode: 'any' };
    }
    return { permissions: ['bod_cod_errors:approve'], mode: 'any' };
  }

  if (path.startsWith('/kwp-form-reports')) {
    return { permissions: ['kwp_forms:view'], mode: 'any' };
  }
  if (path.startsWith('/kwp-form-submissions')) {
    if (path.endsWith('/workflow') && method === 'get') {
      return { permissions: ['kwp_forms:view'], mode: 'any' };
    }
    if (path.endsWith('/workflow-actions')) {
      return { permissions: ['kwp_forms:approve'], mode: 'any' };
    }
    return method === 'get'
      ? { permissions: ['kwp_forms:view'], mode: 'any' }
      : { permissions: ['kwp_forms:edit'], mode: 'any' };
  }

  if (path.startsWith('/alert-events')) {
    return method === 'get'
      ? { permissions: ['notifications:view'], mode: 'any' }
      : { permissions: ['notifications:edit'], mode: 'any' };
  }
  if (path.startsWith('/officer-notification-email-recipients')) {
    return { permissions: ['notifications:edit'], mode: 'any' };
  }

  throw new Error(
    `Bearer OpenAPI operation has no permission mapping: ${method.toUpperCase()} ${path}`,
  );
}

function hasBearerSecurity(operation: OpenApiObject): boolean {
  if (!Array.isArray(operation.security)) return false;
  return operation.security.some(
    (requirement) =>
      requirement !== null &&
      typeof requirement === 'object' &&
      Object.hasOwn(requirement, 'bearerAuth'),
  );
}

function authorizationDescription(requirement: AuthorizationRequirement): string {
  if (requirement.permissions.length === 0) {
    return 'Authentication: Bearer token; ไม่มี permission code เพิ่มเติม';
  }
  if (requirement.permissions.length === 1) {
    return `Permission: ${requirement.permissions[0]}`;
  }
  const qualifier = requirement.mode === 'all' ? 'ต้องมีครบ' : 'อย่างน้อย 1';
  return `Permission (${qualifier}): ${requirement.permissions.join(' + ')}`;
}

function decorateOperations(paths: Record<string, OpenApiObject>): Record<string, OpenApiObject> {
  return Object.fromEntries(
    Object.entries(paths).map(([path, pathItem]) => [
      path,
      Object.fromEntries(
        Object.entries(pathItem).map(([key, value]) => {
          if (!operationMethods.has(key)) return [key, value];
          const operation = value as OpenApiObject;
          if (!hasBearerSecurity(operation)) {
            return [key, { ...operation, tags: [menuTagForPath(path)] }];
          }

          const requirement = authorizationRequirementFor(path, key);
          const currentDescription =
            typeof operation.description === 'string' ? operation.description : '';
          const description = /(?:Permission(?: \([^)]+\))?|Authentication):/i.test(
            currentDescription,
          )
            ? currentDescription
            : [currentDescription, authorizationDescription(requirement)]
                .filter(Boolean)
                .join('\n\n');

          return [
            key,
            {
              ...operation,
              tags: [menuTagForPath(path)],
              description,
              'x-poms-permissions': requirement.permissions,
              'x-poms-permission-mode':
                requirement.permissions.length === 0 ? 'authenticated' : requirement.mode,
            },
          ];
        }),
      ),
    ]),
  );
}

function mergePathMaps(...maps: Record<string, OpenApiObject>[]): Record<string, OpenApiObject> {
  const result: Record<string, OpenApiObject> = {};
  for (const map of maps) {
    for (const [path, pathItem] of Object.entries(map)) {
      result[path] = {
        ...(result[path] ?? {}),
        ...pathItem,
      };
    }
  }
  return result;
}

const baseComponents = (baseDocument.components ?? {}) as OpenApiObject;

const components: OpenApiObject = {
  ...baseComponents,
  schemas: {
    ...componentSchemas,
    ...((baseComponents.schemas as Record<string, OpenApiObject>) ?? {}),
  },
  responses: {
    ...((baseComponents.responses as Record<string, OpenApiObject>) ?? {}),
    ...extraResponses,
  },
  securitySchemes: {
    ...((baseComponents.securitySchemes as Record<string, OpenApiObject>) ?? {}),
    ...extraSecuritySchemes,
  },
};

const paths = decorateWriteRequestValidationDocs(
  decorateOperations(
    mergePathMaps((baseDocument.paths as Record<string, OpenApiObject>) ?? {}, extraPaths),
  ),
  components,
);

export const pomsOpenApiDocument: OpenApiObject = {
  openapi: '3.0.3',
  info: {
    title: 'POMS API',
    version: '0.3.0',
    description:
      'Interactive contract สำหรับ HTTP endpoint ทั้ง 123 รายการใน POMS แยกตามเมนูงานจริง พร้อม payload, validation, auth และตัวอย่างทดสอบ\n\nSwagger แสดง 132 operations เพราะขยาย optional buddhistYear path อีก 9 รูปแบบเพื่อรองรับทั้ง annual point code ที่ URL-encode และ path ที่ proxy ถอดรหัสแล้ว',
  },
  servers: [{ url: env.API_PREFIX }],
  tags,
  paths,
  components,
  'x-poms-canonical-operation-count': 123,
};

export function countOpenApiOperations(document: OpenApiObject): number {
  return Object.values(document.paths as Record<string, Record<string, unknown>>).reduce(
    (count, pathItem) =>
      count + Object.keys(pathItem).filter((key) => operationMethods.has(key)).length,
    0,
  );
}

export const pomsOpenApiStats = {
  operationCount: countOpenApiOperations(pomsOpenApiDocument),
  canonicalOperationCount: countOpenApiOperations({
    paths: Object.fromEntries(
      Object.entries(paths).filter(([path]) => !path.includes('/{buddhistYear}')),
    ),
  }),
  tagCount: tags.length,
};
