import type { PublicFactoryMapPointDTO } from '../connection-requests/connection-requests.types';
import type {
  CalendarStatusDetailsResultDTO,
  CalendarStatusResultDTO,
  MeasurementStatisticsResultDTO,
} from '../parameter-values/parameter-values.types';

type Schema = Record<string, unknown>;
const ref = (name: string): Schema => ({ $ref: `#/components/schemas/${name}` });
const text = { type: 'string' };
const date = { type: 'string', format: 'date' };
const count = { type: 'integer', minimum: 0 };
const percent = { type: 'number', minimum: 0, maximum: 100 };
const nullablePercent = { ...percent, nullable: true };
const dailyCompleteness = {
  ...nullablePercent,
  description:
    'ร้อยละคู่พารามิเตอร์ที่แสดง–ชั่วโมงของวันที่เลือก: วันย้อนหลังรวมส่งตรงเวลาและส่งช้า หารด้วย 24 ชั่วโมงต่อพารามิเตอร์; วันปัจจุบันรวมส่งตรงเวลาและส่งช้าเฉพาะชั่วโมงที่จบแล้วตาม Asia/Bangkok; ไม่มี expected buckets คืน null',
};
const lateCompleteness = {
  ...nullablePercent,
  description:
    'ร้อยละคู่พารามิเตอร์–ชั่วโมงที่ส่งช้าและไม่มีรายการตรงเวลาใน bucket เดียวกัน ใช้ฐานเดียวกับเปอร์เซ็นต์หลัก; ทุกวันเป็นส่วนหนึ่งของเปอร์เซ็นต์หลัก ห้ามนำมาบวกซ้ำ; ไม่มี expected buckets คืน null',
};
const array = (items: Schema): Schema => ({ type: 'array', items });
const object = (
  properties: Record<string, Schema>,
  required = Object.keys(properties),
): Schema => ({
  type: 'object',
  required,
  properties,
});
const valueDefinitions = { type: 'object', additionalProperties: true };
const status = {
  type: 'string',
  enum: ['normal', 'lateData', 'warning', 'exceeded', 'insufficient', 'noData', 'invalid'],
  description:
    'ค่าปกติที่ส่งล่าช้าใช้ lateData; ค่าที่มีระดับมลพิษใช้ exceeded > warning > lateData > normal โดยไม่กลบ noData/invalid/insufficient',
};
const pollutionStatus = {
  type: 'string',
  enum: ['normal', 'lateData', 'warning', 'exceeded', 'insufficient'],
};
const completenessStatus = { type: 'string', enum: ['lowData', 'highData', null], nullable: true };
const parameterLabel = {
  type: 'string',
  description: 'ชื่อพารามิเตอร์พร้อมหน่วย เช่น CO (ppm), CO (%) หรือ BOD (mg/l)',
};
const measurementFactory = object({ factoryId: text, factoryName: text, systemType: text });
const sourceMeta = {
  stationId: text,
  interval: { type: 'string', enum: ['60m'] },
  schemaName: text,
  tableName: text,
  count,
  registeredParameters: array(parameterLabel),
};
const response = (data: Schema, meta: Schema): Schema =>
  object({ success: { type: 'boolean', enum: [true] }, data, meta });

export const homeHandoffSchemas: Record<string, Schema> = {
  HomeMeasurementSummary: object({
    exceededDays: {
      ...count,
      description:
        'จำนวนวันไม่ซ้ำที่พารามิเตอร์ที่แสดงอย่างน้อยหนึ่งตัวเกินมาตรฐาน ตั้งแต่ 1 มกราคมถึงวันสิ้นสุด รวมวันต้นและวันสิ้นสุด; ไม่นับ warning',
    },
    lowDataDays: {
      ...count,
      description:
        'จำนวนวันต่ำกว่า 80% ต่อเนื่องล่าสุด ใช้เปอร์เซ็นต์หลักซึ่งวันย้อนหลังรวมส่งตรงเวลาและส่งช้า ย้อนจากวันสิ้นสุดได้ข้ามปี หยุดเมื่อถึงอย่างน้อย 80% หรือวันเริ่มเชื่อมต่อ; วันสิ้นสุดถึง 80% หรือไม่มี expected bucket คืน 0',
    },
    todayDataCompletenessPercent: dailyCompleteness,
    lateDataPercent: lateCompleteness,
  }),
  HomeMeasurementValue: object({
    value: { type: 'number', nullable: true },
    displayValue: text,
    status,
  }),
  HomeLatestMeasurement: {
    ...object({
      date,
      time: { type: 'string', pattern: '^(?:[01]\\d|2[0-3]):00:00$' },
      values: {
        type: 'object',
        description:
          'ทุกพารามิเตอร์ที่แสดงใช้ key เป็นชื่อพร้อมหน่วย หากชั่วโมงเป้าหมายไม่มีค่าคืน value:null, status:noData; ไม่ย้อนใช้ชั่วโมงที่เก่ากว่า',
        additionalProperties: ref('HomeMeasurementValue'),
      },
    }),
    example: {
      date: '2026-09-23',
      time: '09:00:00',
      values: {
        'CO (ppm)': { value: 10, displayValue: '10.00', status: 'lateData' },
        'CO2 (ppm)': { value: null, displayValue: '-', status: 'noData' },
      },
    },
  },
  HomeMeasurementStatisticRow: object({
    time: { type: 'string', example: '09.00-09.59 น.' },
    chartTime: { type: 'string', example: '09:00' },
    dataCompletenessPercent: {
      ...percent,
      description:
        'ร้อยละพารามิเตอร์ที่ได้รับในชั่วโมงนั้น: วันย้อนหลังรวมส่งตรงเวลาและส่งช้า; วันปัจจุบันรวมส่งตรงเวลาและส่งช้าเฉพาะชั่วโมงที่จบแล้ว; ชั่วโมงปัจจุบันและถัดไปคืน 0 และ values เป็น noData',
    },
    values: {
      type: 'object',
      description:
        'key เป็นชื่อพารามิเตอร์พร้อมหน่วย; คืนเฉพาะพารามิเตอร์ที่แสดง; วันปัจจุบันชั่วโมงที่ยังไม่จบและถัดไปคืน value: null, displayValue: -, status: noData แม้มีข้อมูลต้นทางแล้ว',
      additionalProperties: ref('HomeMeasurementValue'),
      example: { 'CO (ppm)': { value: 10, displayValue: '10.00', status: 'lateData' } },
    },
  }),
  HomeMeasurementStatisticsResponse: response(
    object({
      metadata: object({ description: text, date, valueDefinitions }),
      factory: measurementFactory,
      summary: ref('HomeMeasurementSummary'),
      thresholds: array(
        object({
          parameterCode: text,
          parameterLabel,
          unit: text,
          normalMax: { type: 'number', nullable: true },
          warningMax: { type: 'number', nullable: true },
        }),
      ),
      measurementPoints: array(
        object(
          {
            pointCode: text,
            stationId: text,
            pointName: text,
            latitude: { type: 'number', nullable: true },
            longitude: { type: 'number', nullable: true },
            date,
            rows: array(ref('HomeMeasurementStatisticRow')),
          },
          ['pointCode', 'stationId', 'date', 'rows'],
        ),
      ),
    }),
    object({ ...sourceMeta, date }),
  ),
  HomeCalendarDay: object({
    date,
    dataCompletenessPercent: dailyCompleteness,
    lateDataPercent: lateCompleteness,
    dataCompletenessStatus: completenessStatus,
    pollutionStatus,
    display: object({ backgroundStatus: completenessStatus, borderStatus: pollutionStatus }),
  }),
  HomeParameterSummary: object({
    parameterCode: text,
    parameterName: text,
    parameterLabel,
    unit: text,
    exceededDays: {
      ...count,
      description: 'จำนวนวันเกินมาตรฐานของพารามิเตอร์นี้ตั้งแต่ 1 มกราคมถึง endDate',
    },
    lowDataDays: {
      ...count,
      description: 'ช่วงต่ำกว่า 80% ต่อเนื่องล่าสุดของพารามิเตอร์นี้สิ้นสุดที่ endDate',
    },
    todayDataCompletenessPercent: {
      ...dailyCompleteness,
      description:
        'ร้อยละข้อมูลของพารามิเตอร์นี้ ณ endDate แม้ชื่อ field มี today: วันย้อนหลังรวมส่งตรงเวลาและส่งช้า หารด้วย 24 ชั่วโมง; วันปัจจุบันรวมส่งตรงเวลาและส่งช้าเฉพาะชั่วโมงที่จบแล้ว; ตรวจวันที่จาก meta.endDate; ไม่มี expected buckets คืน null',
    },
    lateDataPercent: lateCompleteness,
  }),
  HomeCalendarStatusResponse: response(
    object({
      metadata: object({ description: text, month: text, endDate: date, valueDefinitions }),
      factory: measurementFactory,
      summary: ref('HomeMeasurementSummary'),
      calendar: object({
        year: { type: 'integer' },
        month: { type: 'integer', minimum: 1, maximum: 12 },
        days: array(ref('HomeCalendarDay')),
      }),
      monthlySummary: {
        ...array(ref('HomeParameterSummary')),
        description:
          'ชื่อ field เดิมเพื่อ compatibility; exceededDays สะสมในปีถึง endDate และ lowDataDays เป็นช่วงต่อเนื่องล่าสุด',
      },
    }),
    object({ ...sourceMeta, month: text, endDate: date }),
  ),
  HomeCalendarExceededDetailRow: object({
    date,
    time: text,
    displayTime: text,
    value: { type: 'number' },
    displayValue: text,
    standardValue: { type: 'number' },
    displayStandardValue: text,
    exceededBy: { type: 'number' },
    displayExceededBy: text,
  }),
  HomeCalendarLowDataDetailRow: object({ date, dataCompletenessPercent: dailyCompleteness }),
  HomeCalendarStatusDetailsResponse: response(
    object({
      metadata: object({
        description: text,
        year: { type: 'integer' },
        endDate: date,
        summaryType: { type: 'string', enum: ['exceeded', 'lowData'] },
        valueDefinitions,
      }),
      factory: measurementFactory,
      parameter: object({
        parameterCode: text,
        parameterName: text,
        parameterLabel,
        unit: text,
        exceededStandard: object({
          value: { type: 'number' },
          displayValue: text,
          operator: { type: 'string', enum: ['>', '>='] },
        }),
      }),
      summary: object({ affectedDays: count }),
      rows: {
        type: 'array',
        description:
          'exceeded คืนวันเกินมาตรฐานตั้งแต่ 1 มกราคมถึง endDate; lowData คืนเฉพาะช่วงต่ำกว่า 80% ต่อเนื่องล่าสุดที่สิ้นสุด endDate',
        items: {
          oneOf: [ref('HomeCalendarExceededDetailRow'), ref('HomeCalendarLowDataDetailRow')],
        },
      },
    }),
    object({ ...sourceMeta, year: text, endDate: date }),
  ),
};

/** Copy home schemas so additions never change the external integration contract. */
export function buildHomeFactorySchemas(existing: Record<string, Schema>): Record<string, Schema> {
  const basePoint = existing.FactoryDashboardMeasurementPoint;
  const baseFactory = existing.IntegrationFactoryDashboardRow;
  const factoryProperties = baseFactory.properties as Record<string, Schema>;
  const pointProperties = basePoint.properties as Record<string, Schema>;
  const point = {
    ...basePoint,
    required: [...(basePoint.required as string[]), 'latestMeasurement'],
    description:
      'เฉพาะจุดที่แสดงและไม่ได้รับการยกเว้นทั้งหมด กรองพารามิเตอร์ที่ซ่อนก่อนคำนวณค่า/สถานะ/จำนวน',
    properties: {
      ...pointProperties,
      latestMeasurement: ref('HomeLatestMeasurement'),
      data: {
        ...pointProperties.data,
        description:
          'รูปแบบเดิมเฉพาะชั่วโมงปฏิทินก่อนหน้าเท่านั้น; ไม่มี row ในชั่วโมงนั้นคืน [] ไม่ดึงข้อมูลเก่ามาแทน ใช้ latestMeasurement สำหรับค่า/หน่วย/สถานะของ popup',
      },
    },
  };
  const publicFactory = {
    ...baseFactory,
    properties: {
      ...factoryProperties,
      industrialAreaType: {
        ...factoryProperties.industrialAreaType,
        description:
          'ใช้ประเภทพื้นที่ต้นทางหรือชื่อ/รหัสที่จับคู่ได้แน่นอน; รหัสนิคมว่างไม่ได้แปลว่าอยู่นอกนิคม และไม่เดารหัสจากชื่อที่ไม่ชัดเจน',
      },
      isEligible: { type: 'boolean' },
      eligibilityStatus: { type: 'string', enum: ['เข้าข่าย', 'ไม่เข้าข่าย'] },
      measurementPoints: {
        ...array(ref('HomeFactoryMeasurementPoint')),
        minItems: 1,
        description:
          'กรองตามสถานะโรงงาน → จุด → พารามิเตอร์ และตัดจุดยกเว้นทั้งหมดก่อนสรุป; ถ้าไม่เหลือจุดไม่คืน factory row',
      },
    },
  };
  const operatorFactory = {
    ...publicFactory,
    required: [...(baseFactory.required as string[]), 'isFavorite'],
    properties: { ...publicFactory.properties, isFavorite: { type: 'boolean' } },
  };
  const meta = object({ total: count });
  return {
    HomeFactoryMeasurementPoint: point,
    HomePublicFactoryRow: publicFactory,
    HomeOperatorFactoryRow: operatorFactory,
    HomePublicFactoryMapResponse: response(array(ref('HomePublicFactoryRow')), meta),
    HomeOperatorFactoryDashboardResponse: response(array(ref('HomeOperatorFactoryRow')), meta),
  };
}

const timestampRules =
  'เฉพาะหน้าหลัก: cdate/ctime เป็นเวลาตรวจวัดหน้าเครื่อง ใช้จัดวัน/ชั่วโมง; udate/utime เป็นเวลาที่เครื่องส่งข้อมูล ทั้งสองชุดใช้ Asia/Bangkok ที่ต้นทางปรับ timezone แล้ว เปรียบเทียบวันและเวลาที่เก็บโดยตรง ไม่บวกหรือลบ timezone ซ้ำ ส่งก่อนเริ่มชั่วโมงถัดไปถือว่าทันกำหนด ตั้งแต่ชั่วโมงถัดไปถือว่าส่งย้อนหลัง รวมกรณีข้ามวัน/ปี เช่น cdate/ctime=2026-09-23 23:00:00 และ udate/utime=2026-09-24 00:00:00 เป็นข้อมูลย้อนหลังของวันที่ 23 ชั่วโมง 23 ข้อมูลส่งช้าแสดงค่าได้; วันย้อนหลังรวมส่งตรงเวลาและส่งช้าในเปอร์เซ็นต์หลัก หารด้วย 24 ชั่วโมงต่อพารามิเตอร์ และใช้ยอดรวมนี้ตัดสิน lowData/lowDataDays/lowData details; lateDataPercent เป็นส่วนหนึ่งของยอดรวม ห้ามบวกซ้ำ ส่วนวันปัจจุบันรวมส่งตรงเวลาและส่งช้าเฉพาะชั่วโมงที่จบแล้ว denominator คือคู่พารามิเตอร์ที่แสดง–ชั่วโมงที่คาดว่าจะได้รับ เริ่มชั่วโมง 00:00 วันปัจจุบันรวมเฉพาะชั่วโมงปฏิทินที่จบแล้ว เช่น 22:15 ใช้ถึง 21:59; ตารางคง 24 แถว แต่ชั่วโมง 22–23 คืน value: null, displayValue: -, status: noData; รับครบ 22 ชั่วโมงได้ 100% แม้บางชั่วโมงส่งช้า; 00:00–00:59 การส่งข้อมูลวันนี้เป็น null และ popup ใช้ชั่วโมงล่าสุด 23 ของวันก่อนหน้า กรองโรงงาน → จุด → พารามิเตอร์ที่ซ่อนก่อนคำนวณ ตัดจุดที่ยกเว้นทั้งหมด และถ้าไม่เหลือจุดไม่คืนโรงงาน';

export function decorateHomeHandoffPaths(paths: Record<string, Schema>): Record<string, Schema> {
  const result = { ...paths };
  for (const [path, pathItem] of Object.entries(paths)) {
    let responseSchema: string;
    let endDatePeriod: 'month' | 'year' | undefined;
    if (path === '/operator-factory-dashboard') {
      responseSchema = 'HomeOperatorFactoryDashboardResponse';
    } else if (path === '/public/factory-map-points') {
      responseSchema = 'HomePublicFactoryMapResponse';
    } else if (path.startsWith('/connected-measurement-points/')) {
      if (path.endsWith('/measurement-statistics')) {
        responseSchema = 'HomeMeasurementStatisticsResponse';
      } else if (path.endsWith('/calendar-status/details')) {
        responseSchema = 'HomeCalendarStatusDetailsResponse';
        endDatePeriod = 'year';
      } else if (path.endsWith('/calendar-status')) {
        responseSchema = 'HomeCalendarStatusResponse';
        endDatePeriod = 'month';
      } else continue;
    } else continue;
    const operation = pathItem.get as Schema;
    const responses = operation.responses as Record<string, Schema>;
    const success = responses['200'];
    const content = success.content as Record<string, Schema>;
    const parameters = [...((operation.parameters as Schema[]) ?? [])];
    if (endDatePeriod) {
      parameters.push({
        name: 'endDate',
        in: 'query',
        required: false,
        schema: { ...date, pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
        description: `วันสิ้นสุดที่รวมในการสรุป ต้องเป็นวันจริงใน ${endDatePeriod} ที่ขอและไม่เกินวันนี้ตาม Asia/Bangkok; ไม่ส่งใช้วันที่น้อยกว่าระหว่างวันนี้กับวันสุดท้ายของ ${endDatePeriod}; ไม่ถูกต้องคืน 400 VALIDATION_ERROR${endDatePeriod === 'month' ? '; เมื่อคลิกวันในปฏิทิน ต้องส่ง endDate ของวันนั้นพร้อม month เพื่อคำนวณ todayDataCompletenessPercent และ lateDataPercent ของวันที่เลือก' : ''}`,
        example: '2026-09-23',
      });
    }
    result[path] = {
      ...pathItem,
      get: {
        ...operation,
        description: [operation.description, timestampRules].filter(Boolean).join('\n\n'),
        parameters,
        responses: {
          ...responses,
          '200': {
            ...success,
            content: {
              ...content,
              'application/json': {
                ...content['application/json'],
                schema: ref(responseSchema),
                example: homeResponseExamples[responseSchema],
              },
            },
          },
        },
      },
    };
  }
  return result;
}

const summaryExample = {
  exceededDays: 0,
  lowDataDays: 0,
  todayDataCompletenessPercent: 95.83,
  lateDataPercent: 4.17,
};
const metaExample = {
  stationId: 'S1128',
  interval: '60m' as const,
  schemaName: 'dbo',
  tableName: 'S1128_60m',
  count: 23,
  registeredParameters: ['CO (ppm)'],
};
const factoryExample = { factoryId: 'F001', factoryName: 'โรงงานตัวอย่าง', systemType: 'CEMS' };
const statisticsExample: MeasurementStatisticsResultDTO = {
  data: {
    metadata: { description: 'สถิติรายชั่วโมง', date: '2026-09-23', valueDefinitions: {} },
    summary: summaryExample,
    thresholds: [
      {
        parameterCode: 'CO',
        parameterLabel: 'CO (ppm)',
        unit: 'ppm',
        normalMax: 80,
        warningMax: 100,
      },
    ],
    measurementPoints: [
      {
        pointCode: 'S1128',
        stationId: 'S1128',
        date: '2026-09-23',
        rows: [
          {
            time: '09.00-09.59 น.',
            chartTime: '09:00',
            dataCompletenessPercent: 100,
            values: { 'CO (ppm)': { value: 10, displayValue: '10.00', status: 'lateData' } },
          },
        ],
      },
    ],
  },
  meta: { ...metaExample, date: '2026-09-23' },
};
const calendarExample: CalendarStatusResultDTO = {
  data: {
    metadata: {
      description: 'ปฏิทินรายเดือน',
      month: '2026-09',
      endDate: '2026-09-23',
      valueDefinitions: {},
    },
    summary: summaryExample,
    calendar: {
      year: 2026,
      month: 9,
      days: [
        {
          date: '2026-09-23',
          dataCompletenessPercent: 95.83,
          lateDataPercent: 4.17,
          dataCompletenessStatus: 'highData',
          pollutionStatus: 'lateData',
          display: { backgroundStatus: 'highData', borderStatus: 'lateData' },
        },
      ],
    },
    monthlySummary: [
      {
        parameterCode: 'CO',
        parameterName: 'CO',
        parameterLabel: 'CO (ppm)',
        unit: 'ppm',
        ...summaryExample,
      },
    ],
  },
  meta: { ...metaExample, month: '2026-09', endDate: '2026-09-23' },
};
const detailsExample: CalendarStatusDetailsResultDTO = {
  data: {
    metadata: {
      description: 'รายละเอียดวันเกินมาตรฐาน',
      year: 2026,
      endDate: '2026-09-23',
      summaryType: 'exceeded',
      valueDefinitions: {},
    },
    parameter: {
      parameterCode: 'CO',
      parameterName: 'CO',
      parameterLabel: 'CO (ppm)',
      unit: 'ppm',
      exceededStandard: { value: 100, displayValue: '100.00', operator: '>' },
    },
    summary: { affectedDays: 0 },
    rows: [],
  },
  meta: { ...metaExample, year: '2026', endDate: '2026-09-23' },
};
const publicFactoryExample: PublicFactoryMapPointDTO = {
  id: 1,
  eligibleFactoryId: 1,
  factoryId: 'F001',
  factoryName: 'โรงงานตัวอย่าง',
  newRegistrationNo: '10840002225552',
  oldRegistrationNo: null,
  factoryLogoUrl: null,
  industryMainOrder: null,
  industryMainOrderLabel: null,
  industrySubOrder: null,
  eia: null,
  hasEia: null,
  regionCode: null,
  regionName: null,
  provinceCode: null,
  provinceName: null,
  province: null,
  address: null,
  latitude: '13.7563',
  longitude: '100.5018',
  districtCode: null,
  districtName: null,
  industrialAreaType: 'OUTSIDE_INDUSTRIAL_ESTATE',
  industrialAreaTypeLabel: 'นอกนิคมอุตสาหกรรม',
  industrialEstateCode: null,
  industrialEstateName: null,
  isEligible: true,
  eligibilityStatus: 'เข้าข่าย',
  hasLatestHourlyMeasurement: false,
  monitoringPointCountBySystem: [{ systemType: 'CEMS', count: 1 }],
  status: 'แสดง',
  measurementPoints: [
    {
      stationId: 'S1128',
      pointName: 'ปล่อง 1',
      pointCode: 'S1128',
      systemType: 'CEMS',
      parameters: ['CO (ppm)'],
      parameterStandards: [],
      data: [],
      latestMeasurement: {
        date: '2026-09-23',
        time: '09:00:00',
        values: {
          'CO (ppm)': { value: null, displayValue: '-', status: 'noData' },
        },
      },
    },
  ],
};
const withFactory = (result: { data: unknown; meta: unknown }) => ({
  success: true,
  ...result,
  data: { ...(result.data as Schema), factory: factoryExample },
});
const homeResponseExamples: Record<string, unknown> = {
  HomeMeasurementStatisticsResponse: withFactory(statisticsExample),
  HomeCalendarStatusResponse: withFactory(calendarExample),
  HomeCalendarStatusDetailsResponse: withFactory(detailsExample),
  HomePublicFactoryMapResponse: { success: true, data: [publicFactoryExample], meta: { total: 1 } },
  HomeOperatorFactoryDashboardResponse: {
    success: true,
    data: [{ ...publicFactoryExample, isFavorite: false }],
    meta: { total: 1 },
  },
};
