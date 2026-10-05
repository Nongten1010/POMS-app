import type { AlertEventAlertType, AlertEventDTO } from '../alert-events/alert-events.types';

const APPLICATION_URL = 'https://d-poms.diw.go.th/';
const TIME_ZONE = 'Asia/Bangkok';

export interface RenderAlertEmailInput {
  events: AlertEventDTO[];
  scheduledAt: string;
}

export interface RenderedAlertEmail {
  subject: string;
  text: string;
  html: string;
}

type Evidence = Array<[label: string, value: string]>;

interface PointGroup {
  event: AlertEventDTO;
  events: AlertEventDTO[];
}

interface FactoryGroup {
  event: AlertEventDTO;
  points: Map<string, PointGroup>;
}

/** Pure rendering only: recipients, authorization, scheduling and delivery belong to the worker. */
export function renderAlertEmail(input: RenderAlertEmailInput): RenderedAlertEmail {
  const scheduledDate = parseTimestamp(input.scheduledAt, 'scheduledAt');
  validateEvents(input.events, scheduledDate);
  const first = input.events[0];
  const title = alertTitle(first);
  const factories = groupEvents(input.events);
  const round = formatTimestamp(scheduledDate);
  const subject = `[D-POMS] ${title} — ${factories.size} โรงงาน — ${round}`;
  const summary = `พบเหตุการณ์ในโรงงาน ${factories.size} แห่ง`;
  const recommendation = actionText(first.alertType);
  const textSections = [
    title,
    summary,
    `รอบแจ้งเตือน: ${round} (เวลาไทย)`,
    '',
    'เรียน ผู้รับผิดชอบที่เกี่ยวข้อง',
  ];
  const htmlSections: string[] = [];

  for (const factory of factories.values()) {
    const registration = factory.event.factoryRegistrationNo ?? 'ไม่ระบุ';
    textSections.push('', factory.event.factoryName, `เลขทะเบียนโรงงาน: ${registration}`);
    const pointsHtml: string[] = [];
    for (const point of factory.points.values()) {
      const system = systemName(point.event);
      const pointTitle = `จุดตรวจวัด: ${point.event.pointName}${point.event.pointCode ? ` (${point.event.pointCode})` : ''} · ${system}`;
      textSections.push('', pointTitle);
      const parametersHtml: string[] = [];
      for (const event of point.events) {
        const parameter = parameterLabel(event);
        const evidence = evidenceFor(event);
        textSections.push(
          `พารามิเตอร์: ${parameter}`,
          ...evidence.map(([label, value]) => `${label}: ${value}`),
          '',
        );
        parametersHtml.push(
          `<tr><td style="padding:12px 16px 4px;color:#16324f;font-weight:bold;">${escapeHtml(parameter)}</td></tr>${evidence.map(([label, value]) => `<tr><td style="padding:3px 16px 6px;color:#334155;line-height:1.6;word-break:break-word;"><strong>${escapeHtml(label)}:</strong> ${escapeHtml(value)}</td></tr>`).join('')}`,
        );
      }
      pointsHtml.push(
        `<tr><td style="padding:14px 0 0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;border:1px solid #dbe3eb;border-collapse:collapse;"><tr><td style="background-color:#f2f6fa;padding:12px 16px;color:#16324f;font-weight:bold;word-break:break-word;">${escapeHtml(pointTitle)}</td></tr>${parametersHtml.join('')}</table></td></tr>`,
      );
    }
    htmlSections.push(
      `<tr><td style="padding:24px 24px 0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse;"><tr><td style="color:#16324f;font-size:18px;font-weight:bold;line-height:1.6;word-break:break-word;">${escapeHtml(factory.event.factoryName)}</td></tr><tr><td style="padding:4px 0;color:#475569;word-break:break-word;">เลขทะเบียนโรงงาน: ${escapeHtml(registration)}</td></tr>${pointsHtml.join('')}</table></td></tr>`,
    );
  }

  textSections.push(
    recommendation,
    '',
    `ดูรายละเอียดใน D-POMS: ${APPLICATION_URL}`,
    'โปรดเข้าสู่ระบบด้วยบัญชีที่มีสิทธิ์เข้าถึงข้อมูลโรงงาน',
    '',
    'ระบบ D-POMS',
  );
  const html = `<!DOCTYPE html>
<html lang="th"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title></head>
<body style="margin:0;padding:0;background-color:#f2f6fa;font-family:Tahoma,Arial,sans-serif;font-size:14px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse;background-color:#f2f6fa;"><tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:680px;border-collapse:collapse;background-color:#ffffff;border:1px solid #dbe3eb;">
<tr><td style="padding:22px 24px;background-color:#16324f;color:#ffffff;font-size:20px;font-weight:bold;line-height:1.5;">D-POMS<br>${escapeHtml(title)}</td></tr>
<tr><td style="padding:20px 24px 0;color:#334155;line-height:1.8;">${escapeHtml(summary)}<br><strong>รอบแจ้งเตือน:</strong> ${escapeHtml(round)} (เวลาไทย)<br>เรียน ผู้รับผิดชอบที่เกี่ยวข้อง</td></tr>
${htmlSections.join('\n')}
<tr><td style="padding:24px;color:#334155;line-height:1.8;">${escapeHtml(recommendation)}</td></tr>
<tr><td align="center" style="padding:0 24px 20px;"><table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;"><tr><td align="center" bgcolor="#175cd3" style="background-color:#175cd3;padding:12px 20px;"><a href="${APPLICATION_URL}" style="font-family:Tahoma,Arial,sans-serif;font-weight:bold;color:#ffffff;text-decoration:none;">ดูรายละเอียดใน D-POMS</a></td></tr></table></td></tr>
<tr><td style="padding:0 24px 24px;color:#64748b;font-size:12px;line-height:1.7;">โปรดเข้าสู่ระบบด้วยบัญชีที่มีสิทธิ์เข้าถึงข้อมูลโรงงาน<br>ระบบ D-POMS</td></tr>
</table></td></tr></table></body></html>`;
  return { subject, text: textSections.join('\n'), html };
}

function validateEvents(events: AlertEventDTO[], scheduledDate: Date): void {
  if (events.length === 0) throw new Error('At least one alert event is required');
  const first = events[0];
  for (const event of events) {
    if (event.alertType !== first.alertType)
      throw new Error('Events must have the same alert type');
    if (event.alertType === 'CONSECUTIVE_NO_REPORT' && event.systemType !== first.systemType) {
      throw new Error('Consecutive reporting events must have the same system');
    }
    if (event.alertType === 'STANDARD_EXCEEDED' || event.alertType === 'EIA_EXCEEDED') {
      if (!event.startedAt || !event.endedAt)
        throw new Error('Hourly events require a completed measurement window');
      const start = parseTimestamp(event.startedAt, 'startedAt');
      const end = parseTimestamp(event.endedAt, 'endedAt');
      if (start >= end || end > scheduledDate)
        throw new Error('Hourly events require a completed measurement window');
      const expectedThreshold = event.alertType === 'STANDARD_EXCEEDED' ? 'STANDARD' : 'EIA';
      if (
        event.thresholdType !== expectedThreshold ||
        !isFiniteNumber(event.thresholdValue) ||
        !isFiniteNumber(event.measuredValue)
      ) {
        throw new Error('Hourly events require a matching threshold and finite measured value');
      }
    }
  }
}

function groupEvents(events: AlertEventDTO[]): Map<string, FactoryGroup> {
  const groups = new Map<string, FactoryGroup>();
  const orderedEvents = [...events].sort((left, right) => {
    const leftKey = eventSortKey(left);
    const rightKey = eventSortKey(right);
    return leftKey < rightKey ? -1 : leftKey > rightKey ? 1 : 0;
  });
  for (const event of orderedEvents) {
    const factoryKey = factoryIdentity(event);
    let factory = groups.get(factoryKey);
    if (!factory) {
      factory = { event, points: new Map() };
      groups.set(factoryKey, factory);
    }
    const pointKey = pointIdentity(event);
    let point = factory.points.get(pointKey);
    if (!point) {
      point = { event, events: [] };
      factory.points.set(pointKey, point);
    }
    point.events.push(event);
  }
  return groups;
}

function factoryIdentity(event: AlertEventDTO): string {
  if (event.factoryId) return `id:${event.factoryId}`;
  if (event.factoryRegistrationNo) return `registration:${event.factoryRegistrationNo}`;
  return `name:${event.factoryName}`;
}

function pointIdentity(event: AlertEventDTO): string {
  return JSON.stringify([event.systemType, event.stationId, event.pointCode, event.pointName]);
}

function eventSortKey(event: AlertEventDTO): string {
  return JSON.stringify([
    factoryIdentity(event),
    pointIdentity(event),
    event.parameterCode,
    event.unit,
    event.eventDate,
    event.startedAt,
    event.id,
  ]);
}

function alertTitle(event: AlertEventDTO): string {
  const titles: Record<AlertEventAlertType, string> = {
    STANDARD_EXCEEDED: 'ผลตรวจวัดเกินมาตรฐาน',
    EIA_EXCEEDED: 'ผลตรวจวัดเกินค่าควบคุม EIA',
    DAILY_COMPLETENESS_LOW: 'รายงานผลไม่ถึง 80% ต่อวัน',
    CONSECUTIVE_NO_REPORT: `${systemName(event)} รายงานไม่ครบต่อเนื่อง`,
    ABNORMAL_VALUE: 'พบค่าตรวจวัดผิดปกติ',
  };
  return titles[event.alertType];
}

function systemName(event: AlertEventDTO): string {
  return event.systemType === 'CEMS' ? 'CEMS' : 'BOD/COD Online';
}

function parameterLabel(event: AlertEventDTO): string {
  const label = event.parameterLabel.trim() || event.parameterName.trim() || event.parameterCode;
  const unit = event.unit?.trim();
  if (!unit) return `${label} (ไม่ระบุหน่วย)`;
  return label.includes(`(${unit})`) ? label : `${label} (${unit})`;
}

function evidenceFor(event: AlertEventDTO): Evidence {
  const evidence: Evidence = [['วันที่ตรวจสอบ', formatDate(event.eventDate)]];
  switch (event.alertType) {
    case 'STANDARD_EXCEEDED':
    case 'EIA_EXCEEDED':
      evidence.push(
        [
          'ช่วงตรวจวัด',
          `${formatTimestamp(parseTimestamp(event.startedAt ?? '', 'startedAt'))} ถึง ${formatTimestamp(parseTimestamp(event.endedAt ?? '', 'endedAt'))}`,
        ],
        ['ค่าตรวจวัด', numberText(event.measuredValue)],
        [
          event.thresholdType === 'STANDARD' ? 'ค่ามาตรฐาน' : 'ค่าควบคุม EIA',
          numberText(event.thresholdValue),
        ],
      );
      break;
    case 'DAILY_COMPLETENESS_LOW':
      evidence.push(
        [
          'รายงานครบ',
          isFiniteNumber(event.completenessPercent)
            ? `${numberText(event.completenessPercent)}%`
            : 'ไม่ระบุ',
        ],
        ['เกณฑ์', 'อย่างน้อย 80%'],
      );
      break;
    case 'CONSECUTIVE_NO_REPORT':
      evidence.push(
        [
          'ต่อเนื่อง',
          isFiniteNumber(event.consecutiveDays)
            ? `${numberText(event.consecutiveDays)} วัน`
            : 'ไม่ระบุ',
        ],
        ['เงื่อนไข', 'รวมวันที่ไม่รายงานและวันที่รายงานต่ำกว่า 80%'],
      );
      if (isFiniteNumber(event.completenessPercent))
        evidence.push(['รายงานครบของวันที่ตรวจสอบ', `${numberText(event.completenessPercent)}%`]);
      break;
    case 'ABNORMAL_VALUE': {
      const labels = { CONSTANT: 'ค่านิ่ง', ZERO: 'ค่าเป็นศูนย์', NEGATIVE: 'ค่าติดลบ' };
      evidence.push(
        ['ลักษณะ', event.abnormalType ? labels[event.abnormalType] : 'ไม่ระบุ'],
        ['ค่าตรวจวัด', numberText(event.measuredValue)],
        [
          'ค่าต่อเนื่อง',
          isFiniteNumber(event.abnormalStreakCount)
            ? `${numberText(event.abnormalStreakCount)} ค่า`
            : 'ไม่ระบุ',
        ],
      );
      if (event.firstAbnormalAt && event.confirmedAbnormalAt) {
        const first = parseTimestamp(event.firstAbnormalAt, 'firstAbnormalAt');
        const confirmed = parseTimestamp(event.confirmedAbnormalAt, 'confirmedAbnormalAt');
        if (confirmed < first) throw new Error('Invalid abnormal measurement interval');
        evidence.push(
          ['ค่าแรกที่ผิดปกติ', formatTimestamp(first)],
          ['ค่าที่ยืนยันความผิดปกติ', formatTimestamp(confirmed)],
          [
            'ระยะห่างระหว่างค่าแรกและค่าที่ยืนยัน',
            elapsedText(confirmed.getTime() - first.getTime()),
          ],
        );
      }
      break;
    }
  }
  if (event.detectedAt)
    evidence.push(['ตรวจพบ', formatTimestamp(parseTimestamp(event.detectedAt, 'detectedAt'))]);
  return evidence;
}

function actionText(alertType: AlertEventAlertType): string {
  if (alertType === 'STANDARD_EXCEEDED' || alertType === 'EIA_EXCEEDED') {
    return 'โปรดตรวจสอบผลตรวจวัด สาเหตุที่เกินเกณฑ์ และดำเนินการแก้ไขโดยเร็ว';
  }
  return 'โปรดตรวจสอบเครื่องตรวจวัด สถานะการเดินเครื่อง และการส่งข้อมูลของจุดตรวจวัดที่ระบุ';
}

function isFiniteNumber(value: number | null): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function numberText(value: number | null): string {
  return isFiniteNumber(value) ? String(value) : 'ไม่ระบุ';
}

function elapsedText(milliseconds: number): string {
  const totalMinutes = Math.floor(milliseconds / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes} นาที`;
  return `${hours} ชั่วโมง${minutes > 0 ? ` ${minutes} นาที` : ''}`;
}

function parseTimestamp(value: string, name: string): Date {
  if (!/(?:Z|[+-]\d{2}:\d{2})$/i.test(value)) {
    throw new Error(`Invalid ${name}: a timestamp with timezone is required`);
  }
  const result = new Date(value);
  if (!Number.isFinite(result.getTime())) throw new Error(`Invalid ${name}`);
  return result;
}

function formatDate(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('Invalid eventDate');
  const date = new Date(`${value}T00:00:00+07:00`);
  if (!Number.isFinite(date.getTime())) throw new Error('Invalid eventDate');
  return new Intl.DateTimeFormat('th-TH', {
    timeZone: TIME_ZONE,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

function formatTimestamp(value: Date): string {
  const date = new Intl.DateTimeFormat('th-TH', {
    timeZone: TIME_ZONE,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(value);
  const time = new Intl.DateTimeFormat('en-GB', {
    timeZone: TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(value);
  return `${date} เวลา ${time} น.`;
}

function escapeHtml(value: string): string {
  const entities: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  };
  return value.replace(/[&<>"']/g, (character) => entities[character]);
}
