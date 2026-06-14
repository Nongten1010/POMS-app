import type { Knex } from 'knex';

type AlertEventMockRow = {
  idempotency_key: string;
  alert_type: string;
  system_type: string;
  display_system_type: string;
  factory_id: string;
  factory_name: string;
  factory_registration_no: string;
  connected_measurement_point_id: number | null;
  station_id: string;
  point_code: string;
  point_name: string;
  point_type: string;
  parameter_code: string;
  parameter_name: string;
  parameter_label: string;
  unit: string;
  event_date: string;
  started_at: string | null;
  ended_at: string | null;
  measured_value: number | null;
  threshold_value: number | null;
  threshold_type: string | null;
  completeness_percent: number | null;
  consecutive_days: number | null;
  abnormal_type: string | null;
  abnormal_streak_count: number | null;
  first_abnormal_at: string | null;
  confirmed_abnormal_at: string | null;
  source_table: string;
  source_interval: string;
  source_payload_json: string;
  evidence_json: string;
  notification_status: string;
};

const SOURCE_TABLE = 'mock_alert_events_html';

const ALERT_EVENT_MOCK_ROWS: AlertEventMockRow[] = [
  exceeded({
    key: 'cems-standard-so2-stack-01-20260614-0900',
    systemType: 'CEMS',
    displaySystemType: 'CEMS',
    factoryId: 'MOCK-CEMS-001',
    factoryName: 'โรงงานไทยสแต็ค จำกัด',
    registrationNo: '310100001',
    stationId: 'CEMS-ST-001',
    pointName: 'Stack-01',
    pointType: 'STACK',
    parameterCode: 'so2',
    parameterName: 'SO2',
    parameterLabel: 'SO2 (ppm)',
    unit: 'ppm',
    eventDate: '2026-06-14',
    startedAt: '2026-06-14T09:00:00',
    endedAt: '2026-06-14T09:59:59',
    measuredValue: 620,
    thresholdValue: 500,
    thresholdType: 'STANDARD',
  }),
  exceeded({
    key: 'cems-standard-dust-stack-02-20260614-1100',
    systemType: 'CEMS',
    displaySystemType: 'CEMS',
    factoryId: 'MOCK-CEMS-002',
    factoryName: 'โรงงานเคมีภาคกลาง',
    registrationNo: '310100002',
    stationId: 'CEMS-ST-002',
    pointName: 'Stack-02',
    pointType: 'STACK',
    parameterCode: 'dust',
    parameterName: 'Dust',
    parameterLabel: 'Dust (mg/Nm3)',
    unit: 'mg/Nm3',
    eventDate: '2026-06-14',
    startedAt: '2026-06-14T11:00:00',
    endedAt: '2026-06-14T11:59:59',
    measuredValue: 155,
    thresholdValue: 120,
    thresholdType: 'STANDARD',
  }),
  exceeded({
    key: 'cems-eia-nox-stack-02-20260614-1000',
    systemType: 'CEMS',
    displaySystemType: 'CEMS',
    factoryId: 'MOCK-CEMS-003',
    factoryName: 'โรงงานกรีนพาวเวอร์',
    registrationNo: '310200008',
    stationId: 'CEMS-ST-003',
    pointName: 'Stack-02',
    pointType: 'STACK',
    parameterCode: 'nox',
    parameterName: 'NOx',
    parameterLabel: 'NOx (ppm)',
    unit: 'ppm',
    eventDate: '2026-06-14',
    startedAt: '2026-06-14T10:00:00',
    endedAt: '2026-06-14T10:59:59',
    measuredValue: 230,
    thresholdValue: 180,
    thresholdType: 'EIA',
  }),
  exceeded({
    key: 'cems-eia-co-stack-01-20260614-1300',
    systemType: 'CEMS',
    displaySystemType: 'CEMS',
    factoryId: 'MOCK-CEMS-004',
    factoryName: 'โรงงานพลังงานตะวันออก',
    registrationNo: '310200009',
    stationId: 'CEMS-ST-004',
    pointName: 'Stack-01',
    pointType: 'STACK',
    parameterCode: 'co',
    parameterName: 'CO',
    parameterLabel: 'CO (%)',
    unit: '%',
    eventDate: '2026-06-14',
    startedAt: '2026-06-14T13:00:00',
    endedAt: '2026-06-14T13:59:59',
    measuredValue: 0.16,
    thresholdValue: 0.1,
    thresholdType: 'EIA',
  }),
  dailyCompleteness({
    key: 'cems-completeness-co-stack-01-20260613',
    systemType: 'CEMS',
    displaySystemType: 'CEMS',
    factoryId: 'MOCK-CEMS-005',
    factoryName: 'โรงงานอีสเทิร์นเคมี',
    registrationNo: '320100015',
    stationId: 'CEMS-ST-005',
    pointName: 'Stack-01',
    pointType: 'STACK',
    parameterCode: 'co',
    parameterName: 'CO',
    parameterLabel: 'CO (%)',
    unit: '%',
    eventDate: '2026-06-13',
    completenessPercent: 62.5,
    expectedCount: 24,
    receivedCount: 15,
  }),
  dailyCompleteness({
    key: 'cems-completeness-so2-stack-03-20260613',
    systemType: 'CEMS',
    displaySystemType: 'CEMS',
    factoryId: 'MOCK-CEMS-006',
    factoryName: 'โรงงานอินดัสเทรียลแก๊ส',
    registrationNo: '320100016',
    stationId: 'CEMS-ST-006',
    pointName: 'Stack-03',
    pointType: 'STACK',
    parameterCode: 'so2',
    parameterName: 'SO2',
    parameterLabel: 'SO2 (ppm)',
    unit: 'ppm',
    eventDate: '2026-06-13',
    completenessPercent: 75,
    expectedCount: 24,
    receivedCount: 18,
  }),
  noReport({
    key: 'cems-no-report-dust-stack-03-20260613',
    systemType: 'CEMS',
    displaySystemType: 'CEMS',
    factoryId: 'MOCK-CEMS-007',
    factoryName: 'โรงงานเมทัลเวิร์ค',
    registrationNo: '330100021',
    stationId: 'CEMS-ST-007',
    pointName: 'Stack-03',
    pointType: 'STACK',
    parameterCode: 'dust',
    parameterName: 'Dust',
    parameterLabel: 'Dust (mg/Nm3)',
    unit: 'mg/Nm3',
    eventDate: '2026-06-13',
    startDateThai: '30 พ.ค. 2569',
    endDateThai: '13 มิ.ย. 2569',
    consecutiveDays: 15,
  }),
  noReport({
    key: 'cems-no-report-nox-stack-01-20260613',
    systemType: 'CEMS',
    displaySystemType: 'CEMS',
    factoryId: 'MOCK-CEMS-008',
    factoryName: 'โรงงานปิโตรอัลลอย',
    registrationNo: '330100022',
    stationId: 'CEMS-ST-008',
    pointName: 'Stack-01',
    pointType: 'STACK',
    parameterCode: 'nox',
    parameterName: 'NOx',
    parameterLabel: 'NOx (ppm)',
    unit: 'ppm',
    eventDate: '2026-06-13',
    startDateThai: '28 พ.ค. 2569',
    endDateThai: '13 มิ.ย. 2569',
    consecutiveDays: 17,
  }),
  abnormal({
    key: 'cems-abnormal-o2-stack-01-20260614-0800',
    systemType: 'CEMS',
    displaySystemType: 'CEMS',
    factoryId: 'MOCK-CEMS-009',
    factoryName: 'โรงงานพลังงานเหนือ',
    registrationNo: '340100033',
    stationId: 'CEMS-ST-009',
    pointName: 'Stack-01',
    pointType: 'STACK',
    parameterCode: 'o2',
    parameterName: 'O2',
    parameterLabel: 'O2 (%)',
    unit: '%',
    eventDate: '2026-06-14',
    startedAt: '2026-06-14T08:00:00',
    endedAt: '2026-06-14T11:59:59',
    abnormalType: 'CONSTANT',
    abnormalLabel: 'ค่านิ่ง 5 ครั้งติดกัน',
  }),
  abnormal({
    key: 'cems-abnormal-so2-stack-02-20260614-0600',
    systemType: 'CEMS',
    displaySystemType: 'CEMS',
    factoryId: 'MOCK-CEMS-010',
    factoryName: 'โรงงานซีเมนต์นคร',
    registrationNo: '340100034',
    stationId: 'CEMS-ST-010',
    pointName: 'Stack-02',
    pointType: 'STACK',
    parameterCode: 'so2',
    parameterName: 'SO2',
    parameterLabel: 'SO2 (ppm)',
    unit: 'ppm',
    eventDate: '2026-06-14',
    startedAt: '2026-06-14T06:00:00',
    endedAt: '2026-06-14T09:59:59',
    abnormalType: 'ZERO',
    abnormalLabel: 'ค่า 0 ต่อเนื่อง 5 ครั้ง',
  }),
  exceeded({
    key: 'wpms-standard-bod-ww-01-20260614-0900',
    systemType: 'WPMS',
    displaySystemType: 'BOD_COD_ONLINE',
    factoryId: 'MOCK-WPMS-001',
    factoryName: 'โรงงานอาหารทะเล',
    registrationNo: '350100044',
    stationId: 'WPMS-WW-001',
    pointName: 'WW-01',
    pointType: 'WASTEWATER',
    parameterCode: 'bod',
    parameterName: 'BOD',
    parameterLabel: 'BOD (mg/l)',
    unit: 'mg/l',
    eventDate: '2026-06-14',
    startedAt: '2026-06-14T09:00:00',
    endedAt: '2026-06-14T09:59:59',
    measuredValue: 65,
    thresholdValue: 20,
    thresholdType: 'STANDARD',
  }),
  exceeded({
    key: 'wpms-standard-cod-ww-02-20260614-1200',
    systemType: 'WPMS',
    displaySystemType: 'BOD_COD_ONLINE',
    factoryId: 'MOCK-WPMS-002',
    factoryName: 'โรงงานแปรรูปอาหาร',
    registrationNo: '350100045',
    stationId: 'WPMS-WW-002',
    pointName: 'WW-02',
    pointType: 'WASTEWATER',
    parameterCode: 'cod',
    parameterName: 'COD',
    parameterLabel: 'COD (mg/l)',
    unit: 'mg/l',
    eventDate: '2026-06-14',
    startedAt: '2026-06-14T12:00:00',
    endedAt: '2026-06-14T12:59:59',
    measuredValue: 188,
    thresholdValue: 120,
    thresholdType: 'STANDARD',
  }),
  exceeded({
    key: 'wpms-eia-cod-ww-02-20260614-1000',
    systemType: 'WPMS',
    displaySystemType: 'BOD_COD_ONLINE',
    factoryId: 'MOCK-WPMS-003',
    factoryName: 'โรงงานแป้งมัน',
    registrationNo: '350200045',
    stationId: 'WPMS-WW-003',
    pointName: 'WW-02',
    pointType: 'WASTEWATER',
    parameterCode: 'cod',
    parameterName: 'COD',
    parameterLabel: 'COD (mg/l)',
    unit: 'mg/l',
    eventDate: '2026-06-14',
    startedAt: '2026-06-14T10:00:00',
    endedAt: '2026-06-14T10:59:59',
    measuredValue: 145,
    thresholdValue: 100,
    thresholdType: 'EIA',
  }),
  exceeded({
    key: 'wpms-eia-bod-ww-01-20260614-1400',
    systemType: 'WPMS',
    displaySystemType: 'BOD_COD_ONLINE',
    factoryId: 'MOCK-WPMS-004',
    factoryName: 'โรงงานน้ำตาลภาคกลาง',
    registrationNo: '350200046',
    stationId: 'WPMS-WW-004',
    pointName: 'WW-01',
    pointType: 'WASTEWATER',
    parameterCode: 'bod',
    parameterName: 'BOD',
    parameterLabel: 'BOD (mg/l)',
    unit: 'mg/l',
    eventDate: '2026-06-14',
    startedAt: '2026-06-14T14:00:00',
    endedAt: '2026-06-14T14:59:59',
    measuredValue: 52,
    thresholdValue: 30,
    thresholdType: 'EIA',
  }),
  dailyCompleteness({
    key: 'wpms-completeness-bod-ww-01-20260613',
    systemType: 'WPMS',
    displaySystemType: 'BOD_COD_ONLINE',
    factoryId: 'MOCK-WPMS-005',
    factoryName: 'โรงงานเครื่องดื่ม',
    registrationNo: '350300046',
    stationId: 'WPMS-WW-005',
    pointName: 'WW-01',
    pointType: 'WASTEWATER',
    parameterCode: 'bod',
    parameterName: 'BOD',
    parameterLabel: 'BOD (mg/l)',
    unit: 'mg/l',
    eventDate: '2026-06-13',
    completenessPercent: 70.83,
    expectedCount: 24,
    receivedCount: 17,
  }),
  dailyCompleteness({
    key: 'wpms-completeness-cod-ww-02-20260613',
    systemType: 'WPMS',
    displaySystemType: 'BOD_COD_ONLINE',
    factoryId: 'MOCK-WPMS-006',
    factoryName: 'โรงงานนมและอาหาร',
    registrationNo: '350300047',
    stationId: 'WPMS-WW-006',
    pointName: 'WW-02',
    pointType: 'WASTEWATER',
    parameterCode: 'cod',
    parameterName: 'COD',
    parameterLabel: 'COD (mg/l)',
    unit: 'mg/l',
    eventDate: '2026-06-13',
    completenessPercent: 66.67,
    expectedCount: 24,
    receivedCount: 16,
  }),
  noReport({
    key: 'wpms-no-report-cod-ww-03-20260613',
    systemType: 'WPMS',
    displaySystemType: 'BOD_COD_ONLINE',
    factoryId: 'MOCK-WPMS-007',
    factoryName: 'โรงงานสิ่งทอ',
    registrationNo: '350400047',
    stationId: 'WPMS-WW-007',
    pointName: 'WW-03',
    pointType: 'WASTEWATER',
    parameterCode: 'cod',
    parameterName: 'COD',
    parameterLabel: 'COD (mg/l)',
    unit: 'mg/l',
    eventDate: '2026-06-13',
    startDateThai: '6 มิ.ย. 2569',
    endDateThai: '13 มิ.ย. 2569',
    consecutiveDays: 8,
  }),
  noReport({
    key: 'wpms-no-report-bod-ww-01-20260613',
    systemType: 'WPMS',
    displaySystemType: 'BOD_COD_ONLINE',
    factoryId: 'MOCK-WPMS-008',
    factoryName: 'โรงงานฟอกย้อมไทย',
    registrationNo: '350400048',
    stationId: 'WPMS-WW-008',
    pointName: 'WW-01',
    pointType: 'WASTEWATER',
    parameterCode: 'bod',
    parameterName: 'BOD',
    parameterLabel: 'BOD (mg/l)',
    unit: 'mg/l',
    eventDate: '2026-06-13',
    startDateThai: '5 มิ.ย. 2569',
    endDateThai: '13 มิ.ย. 2569',
    consecutiveDays: 9,
  }),
  abnormal({
    key: 'wpms-abnormal-cod-ww-01-20260614-0700',
    systemType: 'WPMS',
    displaySystemType: 'BOD_COD_ONLINE',
    factoryId: 'MOCK-WPMS-009',
    factoryName: 'โรงงานย้อมผ้า',
    registrationNo: '350500048',
    stationId: 'WPMS-WW-009',
    pointName: 'WW-01',
    pointType: 'WASTEWATER',
    parameterCode: 'cod',
    parameterName: 'COD',
    parameterLabel: 'COD (mg/l)',
    unit: 'mg/l',
    eventDate: '2026-06-14',
    startedAt: '2026-06-14T07:00:00',
    endedAt: '2026-06-14T10:59:59',
    abnormalType: 'NEGATIVE',
    abnormalLabel: 'ค่าติดลบ 5 ครั้งติดกัน',
  }),
  abnormal({
    key: 'wpms-abnormal-bod-ww-02-20260614-0500',
    systemType: 'WPMS',
    displaySystemType: 'BOD_COD_ONLINE',
    factoryId: 'MOCK-WPMS-010',
    factoryName: 'โรงงานอาหารพร้อมทาน',
    registrationNo: '350500049',
    stationId: 'WPMS-WW-010',
    pointName: 'WW-02',
    pointType: 'WASTEWATER',
    parameterCode: 'bod',
    parameterName: 'BOD',
    parameterLabel: 'BOD (mg/l)',
    unit: 'mg/l',
    eventDate: '2026-06-14',
    startedAt: '2026-06-14T05:00:00',
    endedAt: '2026-06-14T08:59:59',
    abnormalType: 'CONSTANT',
    abnormalLabel: 'ค่านิ่ง 5 ครั้งติดกัน',
  }),
];

export async function seed(knex: Knex): Promise<void> {
  const hasAlertEventsTable = await knex.schema.hasTable('alert_events');
  if (!hasAlertEventsTable) {
    throw new Error('Missing alert_events table. Run db:migrate before seeding alert event mock data.');
  }

  for (const row of ALERT_EVENT_MOCK_ROWS) {
    const existing = await knex('alert_events')
      .where({ idempotency_key: row.idempotency_key })
      .whereNull('deleted_at')
      .first('id');

    if (existing) {
      await knex('alert_events')
        .where({ id: existing.id })
        .update({
          ...row,
          updated_at: knex.raw('SYSDATETIME()'),
        });
      continue;
    }

    await knex('alert_events').insert({
      ...row,
      created_at: knex.raw('SYSDATETIME()'),
      updated_at: knex.raw('SYSDATETIME()'),
    });
  }
}

function exceeded(input: {
  key: string;
  systemType: string;
  displaySystemType: string;
  factoryId: string;
  factoryName: string;
  registrationNo: string;
  stationId: string;
  pointName: string;
  pointType: string;
  parameterCode: string;
  parameterName: string;
  parameterLabel: string;
  unit: string;
  eventDate: string;
  startedAt: string;
  endedAt: string;
  measuredValue: number;
  thresholdValue: number;
  thresholdType: 'STANDARD' | 'EIA';
}): AlertEventMockRow {
  return baseRow({
    ...input,
    alertType: input.thresholdType === 'EIA' ? 'EIA_EXCEEDED' : 'STANDARD_EXCEEDED',
    measuredValue: input.measuredValue,
    thresholdValue: input.thresholdValue,
    thresholdType: input.thresholdType,
    evidence: {
      measuredValue: input.measuredValue,
      thresholdValue: input.thresholdValue,
      timeRangeText: toTimeRangeText(input.startedAt, input.endedAt),
    },
  });
}

function dailyCompleteness(input: {
  key: string;
  systemType: string;
  displaySystemType: string;
  factoryId: string;
  factoryName: string;
  registrationNo: string;
  stationId: string;
  pointName: string;
  pointType: string;
  parameterCode: string;
  parameterName: string;
  parameterLabel: string;
  unit: string;
  eventDate: string;
  completenessPercent: number;
  expectedCount: number;
  receivedCount: number;
}): AlertEventMockRow {
  return baseRow({
    ...input,
    alertType: 'DAILY_COMPLETENESS_LOW',
    startedAt: null,
    endedAt: null,
    measuredValue: null,
    thresholdValue: null,
    thresholdType: null,
    completenessPercent: input.completenessPercent,
    evidence: {
      expectedCount: input.expectedCount,
      receivedCount: input.receivedCount,
      completenessPercent: input.completenessPercent,
    },
  });
}

function noReport(input: {
  key: string;
  systemType: string;
  displaySystemType: string;
  factoryId: string;
  factoryName: string;
  registrationNo: string;
  stationId: string;
  pointName: string;
  pointType: string;
  parameterCode: string;
  parameterName: string;
  parameterLabel: string;
  unit: string;
  eventDate: string;
  startDateThai: string;
  endDateThai: string;
  consecutiveDays: number;
}): AlertEventMockRow {
  return baseRow({
    ...input,
    alertType: 'CONSECUTIVE_NO_REPORT',
    startedAt: null,
    endedAt: null,
    measuredValue: null,
    thresholdValue: null,
    thresholdType: null,
    consecutiveDays: input.consecutiveDays,
    evidence: {
      startDateText: input.startDateThai,
      endDateText: input.endDateThai,
      consecutiveDays: input.consecutiveDays,
    },
  });
}

function abnormal(input: {
  key: string;
  systemType: string;
  displaySystemType: string;
  factoryId: string;
  factoryName: string;
  registrationNo: string;
  stationId: string;
  pointName: string;
  pointType: string;
  parameterCode: string;
  parameterName: string;
  parameterLabel: string;
  unit: string;
  eventDate: string;
  startedAt: string;
  endedAt: string;
  abnormalType: string;
  abnormalLabel: string;
}): AlertEventMockRow {
  return baseRow({
    ...input,
    alertType: 'ABNORMAL_VALUE',
    measuredValue: null,
    thresholdValue: null,
    thresholdType: null,
    abnormalType: input.abnormalType,
    abnormalStreakCount: 5,
    firstAbnormalAt: input.startedAt,
    confirmedAbnormalAt: input.endedAt,
    evidence: {
      abnormalLabel: input.abnormalLabel,
      abnormalStreakCount: 5,
      timeRangeText: toTimeRangeText(input.startedAt, input.endedAt),
    },
  });
}

function baseRow(input: {
  key: string;
  alertType: string;
  systemType: string;
  displaySystemType: string;
  factoryId: string;
  factoryName: string;
  registrationNo: string;
  stationId: string;
  pointName: string;
  pointType: string;
  parameterCode: string;
  parameterName: string;
  parameterLabel: string;
  unit: string;
  eventDate: string;
  startedAt: string | null;
  endedAt: string | null;
  measuredValue: number | null;
  thresholdValue: number | null;
  thresholdType: string | null;
  completenessPercent?: number | null;
  consecutiveDays?: number | null;
  abnormalType?: string | null;
  abnormalStreakCount?: number | null;
  firstAbnormalAt?: string | null;
  confirmedAbnormalAt?: string | null;
  evidence: Record<string, unknown>;
}): AlertEventMockRow {
  return {
    idempotency_key: `mock-alert-events-${input.key}`,
    alert_type: input.alertType,
    system_type: input.systemType,
    display_system_type: input.displaySystemType,
    factory_id: input.factoryId,
    factory_name: input.factoryName,
    factory_registration_no: input.registrationNo,
    connected_measurement_point_id: null,
    station_id: input.stationId,
    point_code: input.stationId,
    point_name: input.pointName,
    point_type: input.pointType,
    parameter_code: input.parameterCode,
    parameter_name: input.parameterName,
    parameter_label: input.parameterLabel,
    unit: input.unit,
    event_date: input.eventDate,
    started_at: input.startedAt,
    ended_at: input.endedAt,
    measured_value: input.measuredValue,
    threshold_value: input.thresholdValue,
    threshold_type: input.thresholdType,
    completeness_percent: input.completenessPercent ?? null,
    consecutive_days: input.consecutiveDays ?? null,
    abnormal_type: input.abnormalType ?? null,
    abnormal_streak_count: input.abnormalStreakCount ?? null,
    first_abnormal_at: input.firstAbnormalAt ?? null,
    confirmed_abnormal_at: input.confirmedAbnormalAt ?? null,
    source_table: SOURCE_TABLE,
    source_interval: '60m',
    source_payload_json: JSON.stringify({ mockup: 'alert-events-mockup-tables.html' }),
    evidence_json: JSON.stringify(input.evidence),
    notification_status: 'AUTO',
  };
}

function toTimeRangeText(startedAt: string, endedAt: string): string {
  return `${startedAt.slice(11, 16).replace(':', '.')} - ${endedAt.slice(11, 16).replace(':', '.')}`;
}
