type OpenApiObject = Record<string, unknown>;
const schemaRef = (name: string) => ({ $ref: `#/components/schemas/${name}` });

export const menuBadgeSchemas: Record<string, OpenApiObject> = {
  MenuBadges: {
    type: 'object',
    additionalProperties: false,
    required: [
      'factories',
      'connection',
      'kwp_forms',
      'bod_cod_errors',
      'eligible_factories',
      'notifications',
      'chat',
    ],
    properties: {
      factories: {
        type: 'boolean',
        description: 'คำขอแก้ไขข้อมูลพื้นฐานเข้าเกณฑ์ตามสิทธิ์และขอบเขต',
      },
      connection: { type: 'boolean', description: 'คำขอเชื่อมต่อเข้าเกณฑ์ตามสิทธิ์และขอบเขต' },
      kwp_forms: { type: 'boolean', description: 'คำขอ กวภ. เข้าเกณฑ์ตามสิทธิ์และขอบเขต' },
      bod_cod_errors: {
        type: 'boolean',
        description: 'รายงาน BOD/COD เข้าเกณฑ์ตามกลุ่มผู้ใช้และขอบเขต',
      },
      eligible_factories: {
        type: 'boolean',
        description: 'คำขอเพิ่มโรงงานเข้าข่ายรอพิจารณาในขอบเขต',
      },
      notifications: {
        type: 'boolean',
        description: 'มีเหตุการณ์เข้าเกณฑ์ของวันนี้ตาม Asia/Bangkok',
      },
      chat: {
        type: 'boolean',
        description:
          'มี Chat ที่เปิดการสนทนา (open) อย่างน้อยหนึ่งห้องในขอบเขต chat:view ซึ่งข้อความล่าสุดเป็นอีกฝ่าย: operator รอ officer/admin; officer/admin รอ operator; ไม่นับห้อง closed',
      },
    },
    example: {
      factories: true,
      connection: false,
      kwp_forms: true,
      bod_cod_errors: false,
      eligible_factories: true,
      notifications: true,
      chat: true,
    },
  },
  MenuBadgesResponse: {
    type: 'object',
    required: ['success', 'data'],
    properties: { success: { type: 'boolean', enum: [true] }, data: schemaRef('MenuBadges') },
  },
};

export const menuBadgePaths: Record<string, OpenApiObject> = {
  '/me/menu-badges': {
    get: {
      operationId: 'getMyMenuBadges',
      summary: 'สรุปจุด Badge บน Sidebar ของบัญชีปัจจุบันครบ 7 เมนู',
      description: [
        'Authentication: Bearer token; โหลดสิทธิ์ล่าสุดจากบัญชีทุกครั้ง ไม่รับ user ID, role หรือ scope จาก client เป็นตัวตัดสิน',
        'คืน boolean ครบ 7 key เสมอ รวม chat ไม่มีจำนวน สี รายละเอียดรายการ หรือข้อมูลส่วนบุคคล; ไม่มี view คืน false โดยไม่ตรวจรายการของเมนูนั้น',
        'เจ้าหน้าที่/แอดมินรวม Director ต้องมี view และ approve ของเมนูคำขอ แม้เป็น admin ก็ไม่ข้าม approve; ผู้ประกอบการใช้ view โดยไม่บังคับ approve',
        'factories: operator=REVISION_REQUESTED; officer/admin=PENDING_REVIEW, REVISED_PENDING_REVIEW',
        'connection: operator=WAITING_FACTORY_REVISION, WAITING_CONNECTION (รวม alias WAITING_FACTORY_DEVICE_CONFIG, WAITING_FACTORY_DEVICE_CONFIGURATION, WAITING_DEVICE_CONFIG หากมี); officer/admin=PENDING_DESIGN_REVIEW, REVISED_PENDING_DESIGN_REVIEW, CONNECTION_CONFIRMED',
        'kwp_forms: operator=REVISION_REQUESTED; officer/admin=SUBMITTED, UNDER_REVIEW',
        'bod_cod_errors: operator=REVISION_REQUESTED; officer/admin=SUBMITTED, REVISED_PENDING_REVIEW, WAITING_RESULT_NOTICE; Director kpm_director, center_director, kwp_director=WAITING_REVIEW, WAITING_APPROVAL ทั้งสองสถานะ; admin ร่วม Director ใช้เกณฑ์ admin',
        'eligible_factories: ผู้ไม่ใช่ operator ที่มี view และ approve; status=PENDING_REVIEW',
        'ใช้ effective permission mapping เดิม: connection.view/approve คือ cems_wpms_requests:view/approve; เมนูอื่นใช้ <key>:view/approve; ใช้ roles[] ล่าสุดจาก server ซึ่งเป็นแหล่งเดียวกับ roles/roleCodes ใน auth DTO ไม่รับ role จาก query',
        'ใช้ขอบเขตเดียวกับ API รายการของแต่ละเมนู ไม่เพิ่ม currentStep, edit, allowedActions หรือผู้สร้างคำขอ และไม่จำกัดวันสำหรับงานคำขอ',
        'notifications ใช้ notifications:view ไม่บังคับ approve และใช้ scope เดียวกับ /alert-events; eventDate เท่ากับวันนี้ตาม Asia/Bangkok ไม่ใช้ createdAt/detectedAt หรือสถานะอ่าน/ส่ง',
        'chat ใช้ chat:view และขอบเขตเดียวกับ GET /chat/tickets ไม่บังคับ chat:ask, chat:answer หรือ approve; status=open เท่านั้น ส่วน status=closed ไม่นับ; operator=true เมื่อข้อความล่าสุดในอย่างน้อยหนึ่งห้องมาจาก officer/admin; officer/admin=true เมื่อข้อความล่าสุดมาจาก operator; citizen=false',
        'ข้อความล่าสุดของแต่ละ Chat ใช้ message id สูงสุดตามลำดับประวัติ แม้ createdAt เท่ากัน; ใช้ sender_role_label ที่บันทึก persona ณ เวลาส่ง ไม่อิงผู้เปิดเรื่อง role ลำดับแรก หรือชนิดบัญชีที่เปลี่ยนภายหลัง; ไม่มีเงื่อนไขวันหรือการอ่าน; ส่งข้อความ/ปิดห้องสำเร็จแล้วควรรีเฟรช Badge',
        'เหตุการณ์ CEMS หรือ WPMS + displaySystemType=BOD_COD_ONLINE; STANDARD_EXCEEDED + thresholdType=STANDARD, EIA_EXCEEDED + thresholdType=EIA, DAILY_COMPLETENESS_LOW, CONSECUTIVE_NO_REPORT, ABNORMAL_VALUE',
        'ไม่มี server cache; Cache-Control: private, no-store; ตรวจพบรายการแรกโดยไม่ COUNT และไม่ขึ้นกับ pagination; error ส่งตามระบบเดิมไม่แทนด้วย false',
        'Frontend แนะนำรีเฟรชหลัง login/เปลี่ยนสถานะสำเร็จ ทุกประมาณ 60 วินาทีเฉพาะแท็บที่มองเห็น และเมื่อกลับเข้าแท็บที่ข้อมูลเก่า',
        'Canonical docs: docs/backend/api/shared/menu-badges/README.md',
      ].join('\n\n'),
      security: [{ bearerAuth: [] }],
      responses: {
        '200': {
          description: 'ผลการตรวจทั้ง 7 เมนูตามสิทธิ์ปัจจุบัน',
          headers: {
            'Cache-Control': { schema: { type: 'string', example: 'private, no-store' } },
          },
          content: { 'application/json': { schema: schemaRef('MenuBadgesResponse') } },
        },
        '401': { $ref: '#/components/responses/Unauthorized' },
        '429': {
          description: 'เกิน global rate limit ของระบบ; ใช้ Retry-After ก่อนเรียกใหม่',
          headers: { 'Retry-After': { schema: { type: 'integer' } } },
          content: {
            'text/plain': {
              schema: { type: 'string' },
              example: 'Too many requests, please try again later.',
            },
          },
        },
        '500': {
          description: 'ประมวลผลไม่สำเร็จ ไม่ส่ง success ที่เป็น false ทุกเมนูแทนข้อผิดพลาด',
          content: {
            'application/json': {
              schema: schemaRef('ErrorEnvelope'),
              example: {
                success: false,
                error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
              },
            },
          },
        },
      },
    },
  },
};
