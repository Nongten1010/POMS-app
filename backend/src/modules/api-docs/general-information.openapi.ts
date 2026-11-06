type OpenApiObject = Record<string, unknown>;
const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });
const regions = [
  'ภาคเหนือ',
  'ภาคกลาง',
  'ภาคตะวันออกเฉียงเหนือ',
  'ภาคตะวันตก',
  'ภาคตะวันออก',
  'ภาคใต้',
];
const countProperties = {
  label: { type: 'string', minLength: 1 },
  factoryCount: { type: 'integer', minimum: 0, description: 'จำนวนโรงงานไม่ซ้ำภายในกลุ่ม' },
  pointCount: { type: 'integer', minimum: 0, description: 'จำนวนจุดไม่ซ้ำภายในกลุ่ม' },
};
const flowProperties = Object.fromEntries(
  ['average', 'min', 'max'].map((name) => [name, { type: 'number', nullable: true, minimum: 0 }]),
);
const example = {
  success: true,
  data: {
    systemType: 'CEMS',
    generatedAt: '2026-11-06T03:00:00.000Z',
    regions: regions.map((label) => ({ label, factoryCount: 0, pointCount: 0 })),
    total: { label: 'ทั่วประเทศ', factoryCount: 0, pointCount: 0 },
    estates: ['ในนิคมฯ', 'นอกนิคมฯ'].map((label) => ({ label, factoryCount: 0, pointCount: 0 })),
    parameters: [],
    flowRates: regions.map((label) => ({ label, average: null, min: null, max: null })),
    flowTotal: { label: 'ทั่วประเทศ', average: null, min: null, max: null },
  },
};

export const generalInformationSchemas: Record<string, OpenApiObject> = {
  GeneralInformationCount: {
    type: 'object',
    additionalProperties: false,
    required: ['label', 'factoryCount', 'pointCount'],
    properties: countProperties,
  },
  GeneralInformationParameter: {
    type: 'object',
    additionalProperties: false,
    required: ['label', 'displayName', 'units', 'factoryCount', 'pointCount'],
    properties: {
      ...countProperties,
      label: {
        type: 'string',
        description: 'รหัสกลุ่มสำหรับรายงาน เช่น CO; รวมต่างหน่วย แต่แยก CO กับ CO2',
      },
      displayName: {
        type: 'string',
        description: 'ชื่อแสดงผลรวมหน่วย เช่น CO (%, ppm); ไม่มีหน่วยต้นทางใช้ ไม่ระบุหน่วย',
      },
      units: {
        type: 'array',
        uniqueItems: true,
        items: { type: 'string' },
        description:
          'หน่วยที่พบหลังเลือกข้อมูลล่าสุด เรียงตามตัวอักษร; อาจว่างหากข้อมูลเก่าไม่ระบุหน่วย',
      },
    },
    example: {
      label: 'CO',
      displayName: 'CO (%, ppm)',
      units: ['%', 'ppm'],
      factoryCount: 1,
      pointCount: 2,
    },
  },
  GeneralInformationFlow: {
    type: 'object',
    additionalProperties: false,
    required: ['label', 'average', 'min', 'max'],
    description:
      'อัตราการระบายจาก details จุด ไม่ใช้ค่าตรวจวัดออนไลน์: CEMS m³/hr; WPMS m³/d; average เฉลี่ยเฉพาะจุดที่มีค่าเฉลี่ย; min/max ใช้ช่องต่ำสุด/สูงสุดตามลำดับ; ไม่มีข้อมูลคืน null โดย 0 เป็นข้อมูลจริง',
    properties: { label: { type: 'string' }, ...flowProperties },
  },
  GeneralInformation: {
    type: 'object',
    additionalProperties: false,
    required: [
      'systemType',
      'generatedAt',
      'regions',
      'total',
      'estates',
      'parameters',
      'flowRates',
      'flowTotal',
    ],
    properties: {
      systemType: { type: 'string', enum: ['CEMS', 'WPMS'] },
      generatedAt: {
        type: 'string',
        format: 'date-time',
        description: 'เวลาที่จัดทำข้อมูล UTC มี timezone; ทั้ง 4 หัวข้อใช้ชุดข้อมูลเดียวกัน',
      },
      regions: {
        type: 'array',
        minItems: 6,
        maxItems: 6,
        items: ref('GeneralInformationCount'),
        description:
          regions.join(', ') + '; ภาคว่างส่ง 0; ชัยนาท/อุทัยธานีอยู่ภาคกลาง เหนือ 16 จังหวัด',
      },
      total: {
        ...ref('GeneralInformationCount'),
        description: 'ทั่วประเทศ: distinct จากจุดทั้งหมด ไม่บวกยอดรายพารามิเตอร์',
      },
      estates: {
        type: 'array',
        minItems: 2,
        maxItems: 2,
        items: ref('GeneralInformationCount'),
        description: 'ในนิคมฯ / นอกนิคมฯ; null ข้อความว่าง และเครื่องหมายขีดไม่ใช่ชื่อนิคม',
      },
      parameters: { type: 'array', items: ref('GeneralInformationParameter') },
      flowRates: {
        type: 'array',
        minItems: 6,
        maxItems: 6,
        items: ref('GeneralInformationFlow'),
        description: '6 ภาคตามลำดับ regions',
      },
      flowTotal: {
        ...ref('GeneralInformationFlow'),
        description: 'ทั่วประเทศ: คำนวณจากทุกจุด ไม่เฉลี่ยค่าเฉลี่ยรายภาค',
      },
    },
  },
  GeneralInformationResponse: {
    type: 'object',
    additionalProperties: false,
    required: ['success', 'data'],
    properties: { success: { type: 'boolean', enum: [true] }, data: ref('GeneralInformation') },
    example,
  },
};

export const generalInformationPaths: Record<string, OpenApiObject> = {
  '/general-information': {
    get: {
      operationId: 'getGeneralInformation',
      summary: 'สรุปข้อมูลทั่วไป CEMS/WPMS ทั่วประเทศ',
      description: [
        'Authentication: Bearer token; ใช้ข้อมูลบัญชี/role ล่าสุดจาก server; อนุญาต userType officer/admin หรือ role admin เท่านั้น; ไม่มี permission code เพิ่มเติม',
        'เจ้าหน้าที่ทุกระดับเห็นข้อมูลทั่วประเทศชุดเดียวกัน ไม่กรองภาค/จังหวัด/นิคมหรือ factory type ตามสิทธิ์ของเมนูอื่น; ผู้ประกอบการและประชาชนไม่มีสิทธิ์',
        'รวมจุดที่เคยเชื่อมต่อใน cems_wpms_connected_measurement_points รวม soft-deleted, hidden และ disconnected; ไม่นับ eligible-only หรือคำขอยังไม่เชื่อมต่อ; แต่ละโรงงาน/ระบบ/รหัสจุดใช้ข้อมูลล่าสุดตาม updated_at แล้ว id; ไม่มีรหัสใช้ source_measurement_point_id',
        'ทั้ง 4 หัวข้อใช้ผลอ่านเดียวและไม่มี pagination/ข้อมูลส่วนบุคคล; ไม่มีข้อมูลคืน 200 พร้อม 0/null; ไม่ใช้ 404/501 แทนชุดว่าง',
        'ใช้ profiles ปัจจุบันตาม FACTORY_PROFILE_MODE; อัตราการระบายไม่ระบุหน่วยใช้หน่วยที่สัญญาฟอร์มกำหนด: CEMS m³/hr และ WPMS m³/d; หน่วยชัดเจนปรับก่อนรวม รองรับ m3/hr, m3/h, m3/d, m3/day, m3/s, l/s, l/min และสัญลักษณ์ ³; JSON/ตัวเลข/หน่วย/ภาคไม่ถูกต้องตอบ 503 ไม่ตัดจุดทิ้ง',
        'โหลดเมื่อเข้าหน้า เปลี่ยนระบบ หรือกดรีเฟรช; export Excel/PDF ใช้ snapshot นี้ ไม่มี endpoint ส่งออกแยก; Cache-Control: private, no-store',
        'Canonical docs: docs/backend/api/menus/general-information/README.md',
      ].join('\n\n'),
      security: [{ bearerAuth: [] }],
      'x-poms-user-types': ['officer', 'admin'],
      parameters: [
        {
          name: 'systemType',
          in: 'query',
          required: true,
          schema: { type: 'string', enum: ['CEMS', 'WPMS'] },
          description: 'ส่งค่าเดียวตามตัวพิมพ์ที่กำหนด; ไม่รับ query อื่นหรือ request body',
          example: 'CEMS',
        },
      ],
      responses: {
        '200': {
          description: 'ข้อมูลครบทั้ง 4 หัวข้อ',
          headers: {
            'Cache-Control': { schema: { type: 'string', example: 'private, no-store' } },
          },
          content: { 'application/json': { schema: ref('GeneralInformationResponse'), example } },
        },
        '400': {
          description: 'VALIDATION_ERROR: ขาด/ผิด systemType, ส่งซ้ำ หรือมี query อื่น',
          content: { 'application/json': { schema: ref('ErrorEnvelope') } },
        },
        '401': { $ref: '#/components/responses/Unauthorized' },
        '403': {
          description: 'FORBIDDEN: ไม่ใช่เจ้าหน้าที่หรือแอดมิน',
          content: { 'application/json': { schema: ref('ErrorEnvelope') } },
        },
        '429': {
          description: 'เกิน global rate limit 300 requests/15 นาที/IP; รอ Retry-After',
          headers: { 'Retry-After': { schema: { type: 'integer' } } },
          content: {
            'text/plain': {
              schema: { type: 'string' },
              example: 'Too many requests, please try again later.',
            },
          },
        },
        '500': {
          description: 'INTERNAL_ERROR: ฐานข้อมูลหรือระบบขัดข้อง ไม่มีรายละเอียด SQL/stack trace',
          content: { 'application/json': { schema: ref('ErrorEnvelope') } },
        },
        '503': {
          description:
            'GENERAL_INFORMATION_DATA_INCOMPLETE: ข้อมูลต้นทางจัดหมวดหรือคำนวณไม่ได้ ต้องตรวจข้อมูลก่อนลองใหม่ ไม่คืนผลบางส่วน',
          content: {
            'application/json': {
              schema: ref('ErrorEnvelope'),
              example: {
                success: false,
                error: {
                  code: 'GENERAL_INFORMATION_DATA_INCOMPLETE',
                  message: 'ข้อมูลต้นทางไม่ครบถ้วนสำหรับสรุปข้อมูลทั่วไป',
                },
              },
            },
          },
        },
      },
    },
  },
};
