import type { AlertEventDTO } from '../alert-events/alert-events.types';
import { isAlertEventExceedance } from '../alert-events/alert-event-exceedance';

const TIME_ZONE = 'Asia/Bangkok';
const ACTION = 'โปรดดำเนินการตรวจสอบ และแก้ไขโดยเร็ว';
const LAB_NOTICE =
  'โรงงานต้องดำเนินการตรวจวัดพารามิเตอร์ที่ไม่สามารถรายงานผลได้ด้วยห้องปฏิบัติการวิเคราะห์ที่ขึ้นทะเบียนกับกรมโรงงานอุตสาหกรรม และรายงานผลการตรวจวัดแก่กรมโรงงานอุตสาหกรรมอย่างน้อยเดือนละ 1 ครั้ง (รายงาน กวภ.02)';
const SIGNATURE = [
  'ศูนย์เฝ้าระวังสิ่งแวดล้อมอุตสาหกรรม',
  'กองวิจัยและเตือนภัยมลพิษโรงงาน กรมโรงงานอุตสาหกรรม',
  'โทร. 02-430-6312 ต่อ 2109',
  'ไปรษณีย์อิเล็กทรอนิกส์ : poms.support@diw.mail.go.th',
  'Line ID : @iemcdiw',
];

export interface AlertEmailRenderContext {
  factoryProvinceName?: string | null;
  reportingStartedOn?: string | null;
}

export interface RenderAlertEmailInput {
  events: AlertEventDTO[];
  scheduledAt: string;
  contextByEventId?: Readonly<Record<number, AlertEmailRenderContext>>;
}

export interface RenderedAlertEmail {
  subject: string;
  text: string;
  html: string;
}

interface PointGroup {
  event: AlertEventDTO;
  events: AlertEventDTO[];
}

interface FactoryGroup {
  event: AlertEventDTO;
  points: Map<string, PointGroup>;
}

/** The six source-PDF letters. Scheduling, permissions and delivery remain outside rendering. */
export function renderAlertEmail(input: RenderAlertEmailInput): RenderedAlertEmail {
  const scheduledDate = parseTimestamp(input.scheduledAt, 'scheduledAt');
  validateEvents(input.events, scheduledDate);
  const first = input.events[0];
  const factories = groupEvents(input.events);
  const heading = subjectFor(first, factories.size);
  const text = ['เรียน เจ้าหน้าที่ที่เกี่ยวข้อง', 'เรื่อง ' + heading.text, ''];
  const sections = [
    '<p style="margin:0 0 14px;font-size:15px;color:#526980;"><strong>เรียน</strong> เจ้าหน้าที่ที่เกี่ยวข้อง</p>',
    '<p style="margin:0 0 26px;font-size:21px;line-height:1.7;font-weight:600;color:#16324f;"><strong>เรื่อง</strong> ' +
      heading.html +
      '</p>',
  ];
  let factoryNumber = 0;
  for (const factory of factories.values()) {
    factoryNumber += 1;
    const province =
      input.contextByEventId?.[factory.event.id]?.factoryProvinceName?.trim() || 'ไม่ระบุ';
    const company =
      factoryNumber +
      ') ' +
      factory.event.factoryName +
      ' (' +
      (factory.event.factoryRegistrationNo?.trim() || 'ไม่ระบุ') +
      ') จังหวัด ' +
      province;
    text.push(company);
    sections.push(
      '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;margin:0 0 20px;border:1px solid #dce5ef;border-radius:10px;border-collapse:separate;background-color:#ffffff;"><tr><td style="padding:18px 16px;">',
      paragraph(company, 0),
    );
    let pointNumber = 0;
    for (const point of factory.points.values()) {
      pointNumber += 1;
      const pointTitle =
        factoryNumber +
        '.' +
        pointNumber +
        ' ' +
        point.event.pointName +
        ' (' +
        point.event.systemType +
        ')';
      text.push('  ' + pointTitle);
      sections.push(paragraph(pointTitle, 24));
      for (const event of point.events) {
        const line = '- ' + parameterStatement(event, input.contextByEventId?.[event.id]);
        text.push('    ' + line);
        sections.push(paragraph(line, 48));
      }
    }
    sections.push('</td></tr></table>');
    text.push('');
  }
  const hasLabNotice = first.alertType === 'CONSECUTIVE_NO_REPORT' && first.systemType === 'CEMS';
  const stars = hasLabNotice || first.alertType === 'ABNORMAL_VALUE' ? '*' : '**';
  const recommendation = stars + ' ' + ACTION + (stars === '**' ? ' **' : '');
  text.push(recommendation);
  sections.push(
    '<p style="margin:8px 0 20px;padding:16px;background-color:#edf4fd;border-left:3px solid #175cd3;border-radius:0 6px 6px 0;text-align:center;color:#16324f;font-weight:600;">' +
      escapeHtml(recommendation) +
      '</p>',
  );
  if (hasLabNotice) {
    text.push('** ' + LAB_NOTICE + ' **');
    sections.push(
      '<p style="margin:0 0 20px;padding:14px 16px;background-color:#f2f6fa;border-radius:6px;font-size:14px;line-height:1.9;color:#526980;">** ' +
        escapeHtml(LAB_NOTICE) +
        ' **</p>',
    );
  }
  text.push(
    '',
    'ขอแสดงความนับถือ',
    '--------------------------------------------------',
    ...SIGNATURE,
  );
  sections.push(
    '<p style="margin:24px 0;text-align:center;color:#16324f;">ขอแสดงความนับถือ</p>',
    '<p style="margin:0 0 18px;color:#c2cedb;font-size:11px;line-height:1;">--------------------------------------------------</p>',
    '<p style="margin:0;padding:18px 16px;background-color:#f7f9fc;border-radius:8px;font-size:13px;line-height:1.95;color:#64748b;"><strong style="color:#16324f;">' +
      escapeHtml(SIGNATURE[0]) +
      '</strong><br>' +
      SIGNATURE.slice(1).map(escapeHtml).join('<br>') +
      '</p>',
  );
  const html = [
    '<!DOCTYPE html><html lang="th"><head><meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width,initial-scale=1">',
    '<title>' + escapeHtml(heading.text) + '</title></head>',
    '<body style="margin:0;padding:0;background-color:#f3f6fa;color:#243b53;font-family:Sarabun,Thonburi,Tahoma,Arial,sans-serif;font-size:16px;line-height:1.8;">',
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse;"><tr><td align="center" style="padding:28px 12px;">',
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:680px;border-collapse:separate;border:1px solid #dce5ef;border-top:5px solid #16324f;border-radius:12px;background-color:#ffffff;"><tr><td style="padding:26px 20px;text-align:left;word-break:break-word;">',
    ...sections,
    '</td></tr></table></td></tr></table></body></html>',
  ].join('');
  return { subject: heading.text, text: text.join('\n'), html };
}

function subjectFor(event: AlertEventDTO, count: number): { text: string; html: string } {
  const titles = {
    STANDARD_EXCEEDED: 'D-POMS แจ้งเตือนผลตรวจวัดมลพิษเกินค่ามาตรฐานกระทรวงอุตสาหกรรม',
    EIA_EXCEEDED: 'D-POMS แจ้งเตือนผลตรวจวัดมลพิษเกินค่าควบคุม EIA/ IEE /EHIA',
    DAILY_COMPLETENESS_LOW:
      'D-POMS แจ้งเตือนการรายงานผลตรวจวัดมลพิษเข้าสู่ระบบไม่ถึงร้อยละ 80 ต่อวัน',
    CONSECUTIVE_NO_REPORT:
      event.systemType === 'CEMS'
        ? 'D-POMS แจ้งเตือนการไม่รายงานผลตรวจวัดมลพิษจากระบบ CEMS หรือรายงานไม่ถึงร้อยละ 80 ต่อวัน ติดต่อกันตั้งแต่ 15 วันขึ้นไป'
        : 'D-POMS แจ้งเตือนการไม่รายงานผลตรวจวัด BOD/COD Online หรือรายงานไม่ถึงร้อยละ 80 ต่อวัน ติดต่อกันเกิน 7 วัน',
    ABNORMAL_VALUE: 'D-POMS แจ้งเตือนการรายงานผลการตรวจวัดมีค่าผิดปกติ (ศูนย์/ติดลบ/ค่านิ่ง)',
  };
  const title = titles[event.alertType];
  const date = formatDate(event.eventDate);
  const time = isHourly(event)
    ? formatTime(parseTimestamp(event.startedAt ?? '', 'startedAt'))
    : null;
  return {
    text:
      title +
      ' ในวันที่ ' +
      date +
      (time ? ' เวลา ' + time + ' น.' : '') +
      ' จำนวน ' +
      count +
      ' บริษัท',
    html:
      escapeHtml(title) +
      ' ในวันที่ ' +
      emphasize(date) +
      (time ? ' เวลา ' + emphasize(time) + ' น.' : '') +
      ' จำนวน ' +
      emphasize(String(count)) +
      ' บริษัท',
  };
}

function parameterStatement(event: AlertEventDTO, context?: AlertEmailRenderContext): string {
  const label = parameterLabel(event);
  const unit = event.unit?.trim();
  if (isHourly(event)) {
    const suffix = unit ? ' (' + unit + ')' : '';
    const name = suffix && label.endsWith(suffix) ? label.slice(0, -suffix.length) : label;
    return name + ' = ' + numberText(event.measuredValue) + ' ' + (unit || 'ไม่ระบุหน่วย');
  }
  if (event.alertType === 'DAILY_COMPLETENESS_LOW') {
    return label + ' = ร้อยละ ' + numberText(event.completenessPercent);
  }
  if (event.alertType === 'CONSECUTIVE_NO_REPORT') {
    const start = context?.reportingStartedOn ? formatDate(context.reportingStartedOn) : 'ไม่ระบุ';
    // The agreed streak includes low reporting; do not claim every day had zero reports.
    return (
      label +
      ' = ไม่รายงานหรือรายงานไม่ถึงร้อยละ 80 ต่อวันตั้งแต่วันที่ ' +
      start +
      ' รวม ' +
      numberText(event.consecutiveDays) +
      ' วัน'
    );
  }
  const kinds = {
    CONSTANT: 'ค่านิ่งตั้งแต่วันที่',
    ZERO: 'ค่าเป็น 0 วันที่',
    NEGATIVE: 'ค่าติดลบตั้งแต่วันที่',
  };
  const kind = event.abnormalType ? kinds[event.abnormalType] : 'ลักษณะผิดปกติไม่ระบุ';
  if (!event.firstAbnormalAt) return label + ' = ' + kind + ' ไม่ระบุวันเริ่มและระยะเวลา';
  const first = parseTimestamp(event.firstAbnormalAt, 'firstAbnormalAt');
  const began =
    kind + ' ' + formatDate(bangkokCalendarDate(first)) + ' เวลา ' + formatTime(first) + ' น.';
  const confirmed = event.confirmedAbnormalAt
    ? parseTimestamp(event.confirmedAbnormalAt, 'confirmedAbnormalAt')
    : null;
  if (confirmed && confirmed < first) throw new Error('Invalid abnormal measurement interval');
  if (!event.endedAt) return label + ' = ' + began + ' รวม ไม่ระบุระยะเวลา';
  const ended = parseTimestamp(event.endedAt, 'endedAt');
  if (ended < first || (confirmed && ended < confirmed))
    throw new Error('Invalid abnormal measurement interval');
  return label + ' = ' + began + ' รวม ' + elapsedText(ended.getTime() - first.getTime());
}

function validateEvents(events: AlertEventDTO[], scheduledDate: Date): void {
  if (events.length === 0) throw new Error('At least one alert event is required');
  const first = events[0];
  for (const event of events) {
    if (event.alertType !== first.alertType)
      throw new Error('Events must have the same alert type');
    if (event.eventDate !== first.eventDate) throw new Error('Events must have the same eventDate');
    if (event.alertType === 'CONSECUTIVE_NO_REPORT' && event.systemType !== first.systemType) {
      throw new Error('Consecutive reporting events must have the same system');
    }
    if (isHourly(event)) {
      if (!event.startedAt || !event.endedAt)
        throw new Error('Hourly events require a completed measurement window');
      const start = parseTimestamp(event.startedAt, 'startedAt');
      const end = parseTimestamp(event.endedAt, 'endedAt');
      if (start >= end || end > scheduledDate)
        throw new Error('Hourly events require a completed measurement window');
      if (start.getTime() !== parseTimestamp(first.startedAt ?? '', 'startedAt').getTime()) {
        throw new Error('Hourly events must have the same measurement window');
      }
      const expectedThreshold = event.alertType === 'STANDARD_EXCEEDED' ? 'STANDARD' : 'EIA';
      if (
        event.thresholdType !== expectedThreshold ||
        !isAlertEventExceedance(event.measuredValue, event.thresholdValue)
      ) {
        throw new Error(
          'Hourly events require a matching threshold and finite measured value greater than thresholdValue',
        );
      }
    }
  }
}

function groupEvents(events: AlertEventDTO[]): Map<string, FactoryGroup> {
  const groups = new Map<string, FactoryGroup>();
  const ordered = [...events].sort((a, b) => eventSortKey(a).localeCompare(eventSortKey(b), 'en'));
  for (const event of ordered) {
    const factoryKey = factoryIdentity(event);
    let factory = groups.get(factoryKey);
    if (!factory) {
      factory = { event, points: new Map() };
      groups.set(factoryKey, factory);
    }
    const pointKey = JSON.stringify([
      event.systemType,
      event.stationId,
      event.pointCode,
      event.pointName,
    ]);
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
  if (event.factoryId) return 'id:' + event.factoryId;
  if (event.factoryRegistrationNo) return 'registration:' + event.factoryRegistrationNo;
  return 'name:' + event.factoryName;
}

function eventSortKey(event: AlertEventDTO): string {
  return JSON.stringify([
    factoryIdentity(event),
    event.systemType,
    event.stationId,
    event.pointCode,
    event.pointName,
    String(event.id).padStart(16, '0'),
    event.parameterCode,
    event.unit,
  ]);
}

function parameterLabel(event: AlertEventDTO): string {
  const label = event.parameterLabel.trim() || event.parameterName.trim() || event.parameterCode;
  const unit = event.unit?.trim();
  if (!unit) return label + ' (ไม่ระบุหน่วย)';
  return label.endsWith('(' + unit + ')') ? label : label + ' (' + unit + ')';
}

function isHourly(event: AlertEventDTO): boolean {
  return event.alertType === 'STANDARD_EXCEEDED' || event.alertType === 'EIA_EXCEEDED';
}

function numberText(value: number | null): string {
  return typeof value === 'number' && Number.isFinite(value) ? String(value) : 'ไม่ระบุ';
}

function elapsedText(milliseconds: number): string {
  const minutes = Math.floor(milliseconds / 60_000);
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const remainder = minutes % 60;
  return days + ' วัน ' + hours + ' ชั่วโมง' + (remainder ? ' ' + remainder + ' นาที' : '');
}

function parseTimestamp(value: string, name: string): Date {
  if (!/(?:Z|[+-]\d{2}:\d{2})$/i.test(value))
    throw new Error('Invalid ' + name + ': a timestamp with timezone is required');
  const result = new Date(value);
  if (!Number.isFinite(result.getTime())) throw new Error('Invalid ' + name);
  return result;
}

function formatDate(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error('Invalid eventDate');
  const date = new Date(value + 'T00:00:00Z');
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value)
    throw new Error('Invalid eventDate');
  return date.getUTCDate() + '-' + (date.getUTCMonth() + 1) + '-' + (date.getUTCFullYear() + 543);
}

function bangkokCalendarDate(value: Date): string {
  return new Date(value.getTime() + 7 * 3_600_000).toISOString().slice(0, 10);
}

function formatTime(value: Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  })
    .format(value)
    .replace(':', '.');
}

function paragraph(value: string, indent: number): string {
  const style =
    indent === 0
      ? 'margin:0 0 14px;padding:0 0 12px;border-bottom:1px solid #e1e8f0;font-size:16px;font-weight:600;'
      : indent === 24
        ? 'margin:12px 0 8px;padding-left:0;font-size:14px;font-weight:600;'
        : 'margin:0 0 8px;padding:10px 12px;background-color:#f2f6fa;border-radius:6px;font-size:16px;font-weight:500;';
  return '<p style="' + style + 'color:#243b53;">' + escapeHtml(value) + '</p>';
}

function emphasize(value: string): string {
  return '<span style="color:#16324f;font-weight:700;">' + escapeHtml(value) + '</span>';
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
