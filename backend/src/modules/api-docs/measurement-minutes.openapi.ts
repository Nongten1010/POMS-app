import { MINUTE_PARAMETER_STATUSES } from '../parameter-values/measurement-minutes';

/** Source detail keeps decimal strings intact; sourceStatus is separate from normalized status. */
export const measurementMinutesSchemas = {
  MinuteMeasurementValue: {
    type: 'object',
    required: ['value', 'status', 'sourceStatus', 'measuredAt'],
    properties: {
      value: {
        anyOf: [
          { type: 'number', nullable: true },
          {
            type: 'string',
            pattern: '^\\s*[+-]?(?:\\d+(?:\\.\\d*)?|\\.\\d+)(?:[eE][+-]?\\d+)?\\s*$',
          },
        ],
        description:
          'ค่าที่จัดเก็บ ไม่ปัดเศษเพิ่ม; decimal string คงชนิดเดิม ไม่แทนค่าที่หายด้วยศูนย์ และไม่ซ่อนค่าตามสถานะ',
      },
      status: {
        type: 'string',
        nullable: true,
        enum: [...MINUTE_PARAMETER_STATUSES, null],
        description:
          'สถานะมาตรฐาน; รหัส 0/9 และสถานะไม่รู้จักใช้ Etc. โดยคง sourceStatus; null เมื่อไม่มีสถานะ',
      },
      sourceStatus: {
        anyOf: [{ type: 'number', nullable: true }, { type: 'string' }],
        description: 'สถานะต้นทางเดิม เช่น 0 = NoData, 1 = Ok, 9 = No Discharge; ไม่ใช่ค่าตรวจวัด',
      },
      measuredAt: {
        type: 'string',
        format: 'date-time',
        nullable: true,
        description:
          'cdate/ctime ของแถวที่เลือก พร้อม +07:00; null เมื่อไม่มีตัวอย่างที่ตรงพารามิเตอร์และหน่วย',
      },
    },
  },
  MeasurementMinutesResponse: {
    type: 'object',
    required: ['success', 'data', 'meta'],
    properties: {
      success: { type: 'boolean', enum: [true] },
      data: {
        type: 'object',
        required: ['stationId', 'pointName', 'date', 'hour', 'timezone', 'parameters', 'rows'],
        properties: {
          stationId: { type: 'string' },
          pointName: { type: 'string' },
          date: { type: 'string', format: 'date' },
          hour: { type: 'string', pattern: '^(?:[01]\\d|2[0-3])$' },
          timezone: { type: 'string', enum: ['Asia/Bangkok'] },
          parameters: {
            type: 'array',
            uniqueItems: true,
            items: { type: 'string' },
            description:
              'พารามิเตอร์ที่แสดงได้ พร้อมหน่วย เช่น CO (ppm); Flow ใช้ Flow Rate (m3/hr)',
          },
          rows: {
            type: 'array',
            minItems: 60,
            maxItems: 60,
            items: {
              type: 'object',
              required: ['time', 'values'],
              properties: {
                time: { type: 'string', pattern: '^(?:[01]\\d|2[0-3]):[0-5]\\d$' },
                values: {
                  type: 'object',
                  additionalProperties: { $ref: '#/components/schemas/MinuteMeasurementValue' },
                },
              },
            },
          },
        },
      },
      meta: {
        type: 'object',
        required: ['interval', 'minutesWithData'],
        properties: {
          interval: { type: 'string', enum: ['1m'] },
          minutesWithData: {
            type: 'integer',
            minimum: 0,
            maximum: 60,
            description:
              'จำนวนนาทีที่มีตัวอย่างของพารามิเตอร์ที่แสดงได้ ไม่ใช่เปอร์เซ็นต์ความครบถ้วนหรือจำนวนนาที Normal; 0 ใช้แสดงไม่พบข้อมูล',
          },
        },
      },
    },
    example: {
      success: true,
      data: {
        stationId: 'S0199',
        pointName: 'Stack',
        date: '2026-11-11',
        hour: '09',
        timezone: 'Asia/Bangkok',
        parameters: ['CO (ppm)'],
        rows: Array.from({ length: 60 }, (_, minute) => ({
          time: `09:${String(minute).padStart(2, '0')}`,
          values: {
            'CO (ppm)':
              minute === 0
                ? {
                    value: 12.3456789,
                    status: 'Maintenance',
                    sourceStatus: 4,
                    measuredAt: '2026-11-11T09:00:00+07:00',
                  }
                : { value: null, status: null, sourceStatus: null, measuredAt: null },
          },
        })),
      },
      meta: { interval: '1m', minutesWithData: 1 },
    },
  },
};

export const measurementMinutesDescription =
  'Permission: dashboard.stats:view. ใช้ data scope และการซ่อนโรงงาน/จุด/พารามิเตอร์เดียวกับ measurement-statistics; ' +
  'strict query รับเฉพาะ date (วันที่จริง ค.ศ. YYYY-MM-DD) และ hour (00–23) ตาม Asia/Bangkok. ' +
  'อ่านเฉพาะข้อมูล 1m ที่เก็บในชั่วโมงนั้นตาม cdate/ctime ไม่ใช้เวลารับข้อมูลเลือกชั่วโมง ไม่ชดเชย timezone ซ้ำ ไม่คำนวณค่ารายชั่วโมงหรือประเมินเกณฑ์มลพิษใหม่. ' +
  'คืน 60 ช่อง 00–59: ขาดข้อมูลคืน null; ค่ากับสถานะแยกกันและคงค่าแม้สถานะไม่ใช่ Normal; ไม่ปัดเศษเพิ่ม. ' +
  'Flow แบบเดิม normalize ทั้งรายการที่แสดงและที่ลงทะเบียนเป็น Flow Rate (m3/hr); ชื่อไม่มีหน่วยใช้หน่วยเดียวที่ยืนยันได้จาก metadata ปัจจุบันและข้อมูลต้นทาง รวมหน่วยที่ซ่อน; ยกเว้น pH ซึ่งไม่มีหน่วยทางกายภาพ. หากขาดหรือกำกวมคืน 503 MEASUREMENT_PARAMETER_UNIT_UNAVAILABLE ไม่เดาหน่วย. ' +
  'หน่วยเซลเซียส DegC, C° และ °C เทียบเท่ากันโดยไม่แปลงค่าตัวเลขและคง label ที่ลงทะเบียน; generic ที่หน่วย null/ว่างใช้ได้เฉพาะเมื่อลงทะเบียนหน่วยเดียวชัดเจนและไม่มี dedicated ต่างหน่วยแข่งขัน ไม่เดาหน่วยเมื่อกำกวม. ' +
  'หลายแถวในนาทีเดียวเลือกต่อพารามิเตอร์/หน่วยตาม ctime ล่าสุด แล้ว udate/utime ล่าสุด; หากเสมอกันใช้ serialized row ที่เรียง key เป็นตัวตัดสินคงที่ ไม่เฉลี่ย. ' +
  '200 พร้อม minutesWithData: 0 เมื่อไม่มีข้อมูล; 404 เมื่อไม่มีจุด/ตาราง หรือจุดถูกซ่อน/ยกเว้น/ยกเลิกเชื่อมต่อ; 403 เมื่อนอก scope. Cache-Control: no-store. ' +
  'เรียกเมื่อเปิด dialog เท่านั้น ไม่โหลดล่วงหน้าทั้งวัน; ไม่มีกราฟ export หรือตัวกรองเพิ่มเติม.';

export const measurementMinutesUnitUnavailableResponse = {
  description:
    'หน่วยของพารามิเตอร์ที่ลงทะเบียนแบบไม่มีหน่วยยังยืนยันไม่ได้หรือกำกวม; ไม่คืนค่าหรือเดาหน่วย ให้ตรวจ metadata ก่อนเรียกซ้ำ',
  content: {
    'application/json': {
      schema: { $ref: '#/components/schemas/ErrorEnvelope' },
      example: {
        success: false,
        error: {
          code: 'MEASUREMENT_PARAMETER_UNIT_UNAVAILABLE',
          message: 'Measurement parameter unit is missing or ambiguous',
        },
      },
    },
  },
};
