import { describe, expect, it } from '@jest/globals';
import { renderAlertEmail } from '../../src/modules/alert-emails/alert-email-template';
import type { AlertEventDTO } from '../../src/modules/alert-events/alert-events.types';

const scheduledAt = '2026-10-04T05:05:00.000Z';
const dailyScheduledAt = '2026-10-05T02:00:00.000Z';

function event(overrides: Partial<AlertEventDTO> = {}): AlertEventDTO {
  return {
    id: 1,
    idempotencyKey: 'event-1',
    alertType: 'STANDARD_EXCEEDED',
    systemType: 'CEMS',
    displaySystemType: 'CEMS',
    factoryId: 'factory-1',
    factoryName: 'บริษัท ตัวอย่าง จำกัด',
    factoryRegistrationNo: '3-001',
    stationId: 'station-1',
    pointCode: 'S01',
    pointName: 'Stack 1',
    pointType: 'STACK',
    parameterCode: 'SO2',
    parameterName: 'SO₂',
    parameterLabel: 'SO₂ (ppm)',
    unit: 'ppm',
    eventDate: '2026-10-04',
    eventDateText: '4-Oct-69',
    timeRange: '11.00 - 11.59',
    startedAt: '2026-10-04T04:00:00.000Z',
    endedAt: '2026-10-04T04:59:00.000Z',
    measuredValue: 250,
    thresholdValue: 200,
    thresholdType: 'STANDARD',
    thresholdLabel: 'ค่ามาตรฐาน',
    completenessPercent: null,
    completenessPercentText: null,
    consecutiveDays: null,
    abnormalType: null,
    abnormalLabel: null,
    abnormalStreakCount: null,
    firstAbnormalAt: null,
    confirmedAbnormalAt: null,
    notificationStatus: 'AUTO',
    notificationStatusLabel: 'อัตโนมัติ',
    sourcePayload: null,
    detectedAt: '2026-10-04T05:00:00.000Z',
    ...overrides,
  };
}

describe('renderAlertEmail', () => {
  it.each([
    ['STANDARD_EXCEEDED' as const, 'STANDARD' as const],
    ['EIA_EXCEEDED' as const, 'EIA' as const],
  ])(
    'rejects below/equal-threshold %s events, including a mixed valid/invalid batch',
    (alertType, thresholdType) => {
      const valid = event({ alertType, thresholdType, measuredValue: 125, thresholdValue: 120 });
      expect(renderAlertEmail({ events: [valid], scheduledAt }).text).toContain('ค่าตรวจวัด: 125');
      for (const measuredValue of [100, 120]) {
        expect(() =>
          renderAlertEmail({
            events: [
              valid,
              event({ id: 2, alertType, thresholdType, measuredValue, thresholdValue: 120 }),
            ],
            scheduledAt,
          }),
        ).toThrow('greater');
      }
    },
  );
  it.each([
    ['STANDARD_EXCEEDED' as const, 'STANDARD' as const],
    ['EIA_EXCEEDED' as const, 'EIA' as const],
  ])('rejects missing or non-finite %s evidence before rendering', (alertType, thresholdType) => {
    for (const value of [null, NaN, Infinity, -Infinity]) {
      expect(() =>
        renderAlertEmail({
          events: [event({ alertType, thresholdType, measuredValue: value })],
          scheduledAt,
        }),
      ).toThrow('threshold');
      expect(() =>
        renderAlertEmail({
          events: [event({ alertType, thresholdType, thresholdValue: value })],
          scheduledAt,
        }),
      ).toThrow('threshold');
    }
  });
  it('renders a completed hourly standard window with distinct scheduled and detected times in Bangkok', () => {
    const rendered = renderAlertEmail({ events: [event()], scheduledAt });

    expect(rendered.subject).toContain('[D-POMS] ผลตรวจวัดเกินมาตรฐาน');
    expect(rendered.subject).toContain('1 โรงงาน');
    expect(rendered.text).toContain('รอบแจ้งเตือน: 4 ต.ค. 2569 เวลา 12:05 น.');
    expect(rendered.text).toContain(
      'ช่วงตรวจวัด: 4 ต.ค. 2569 เวลา 11:00 น. ถึง 4 ต.ค. 2569 เวลา 11:59 น.',
    );
    expect(rendered.text).toContain('ตรวจพบ: 4 ต.ค. 2569 เวลา 12:00 น.');
    expect(rendered.text).toContain('ค่าตรวจวัด: 250');
    expect(rendered.text).toContain('ค่ามาตรฐาน: 200');
    expect(rendered.text).toContain('SO₂ (ppm)');
    expect(rendered.text).not.toContain('ส่งแล้ว');
  });

  it('renders EIA as the actual threshold rather than claiming IEE or EHIA', () => {
    const rendered = renderAlertEmail({
      events: [event({ alertType: 'EIA_EXCEEDED', thresholdType: 'EIA' })],
      scheduledAt,
    });

    expect(rendered.subject).toContain('ผลตรวจวัดเกินค่าควบคุม EIA');
    expect(rendered.text).toContain('ค่าควบคุม EIA: 200');
    expect(rendered.text).not.toMatch(/IEE|EHIA/);
  });

  it('renders the preceding daily reporting date at the scheduled 09:00 round', () => {
    const rendered = renderAlertEmail({
      events: [event({ alertType: 'DAILY_COMPLETENESS_LOW', completenessPercent: 79.17 })],
      scheduledAt: dailyScheduledAt,
    });

    expect(rendered.subject).toContain('รายงานผลไม่ถึง 80% ต่อวัน');
    expect(rendered.text).toContain('รอบแจ้งเตือน: 5 ต.ค. 2569 เวลา 09:00 น.');
    expect(rendered.text).toContain('วันที่ตรวจสอบ: 4 ต.ค. 2569');
    expect(rendered.text).toContain('รายงานครบ: 79.17%');
    expect(rendered.text).toContain('เกณฑ์: อย่างน้อย 80%');
    expect(rendered.text).not.toContain('ค่ามาตรฐาน:');
  });

  it.each([
    ['CEMS' as const, 'CEMS', 15],
    ['WPMS' as const, 'BOD/COD Online', 8],
  ])(
    'renders %s consecutive incomplete reporting including absent and below-80%% days',
    (systemType, name, days) => {
      const rendered = renderAlertEmail({
        events: [event({ alertType: 'CONSECUTIVE_NO_REPORT', systemType, consecutiveDays: days })],
        scheduledAt: dailyScheduledAt,
      });

      expect(rendered.subject).toContain(`${name} รายงานไม่ครบต่อเนื่อง`);
      expect(rendered.text).toContain(`ต่อเนื่อง: ${days} วัน`);
      expect(rendered.text).toContain('รวมวันที่ไม่รายงานและวันที่รายงานต่ำกว่า 80%');
      expect(rendered.text).not.toContain('ไม่รายงานต่อเนื่อง');
    },
  );

  it.each([
    ['CONSTANT' as const, 'ค่านิ่ง'],
    ['ZERO' as const, 'ค่าเป็นศูนย์'],
    ['NEGATIVE' as const, 'ค่าติดลบ'],
  ])(
    'renders %s with a truthful reading count and elapsed measurement interval',
    (abnormalType, label) => {
      const rendered = renderAlertEmail({
        events: [
          event({
            alertType: 'ABNORMAL_VALUE',
            abnormalType,
            abnormalStreakCount: 5,
            firstAbnormalAt: '2026-10-04T01:00:00.000Z',
            confirmedAbnormalAt: '2026-10-04T05:00:00.000Z',
          }),
        ],
        scheduledAt: dailyScheduledAt,
      });

      expect(rendered.subject).toContain('พบค่าตรวจวัดผิดปกติ');
      expect(rendered.text).toContain(`ลักษณะ: ${label}`);
      expect(rendered.text).toContain('ค่าต่อเนื่อง: 5 ค่า');
      expect(rendered.text).toContain('ระยะห่างระหว่างค่าแรกและค่าที่ยืนยัน: 4 ชั่วโมง');
      expect(rendered.text).not.toContain('5 ชั่วโมง');
    },
  );

  it('counts factories rather than events and groups parameters beneath each measurement point', () => {
    const events = [
      event({ id: 3, factoryId: 'factory-2', factoryName: 'โรงงานสอง' }),
      event({ id: 2, parameterCode: 'NOX', parameterLabel: 'NOx (ppm)' }),
      event(),
    ];
    const rendered = renderAlertEmail({ events, scheduledAt });

    expect(rendered.subject).toContain('2 โรงงาน');
    expect(rendered.text.match(/บริษัท ตัวอย่าง จำกัด/g)).toHaveLength(1);
    expect(rendered.text.match(/จุดตรวจวัด: Stack 1/g)).toHaveLength(2);
    expect(rendered.text).toContain('SO₂ (ppm)');
    expect(rendered.text).toContain('NOx (ppm)');
    expect(renderAlertEmail({ events: [...events].reverse(), scheduledAt })).toEqual(rendered);
  });

  it('keeps different units distinct and appends the registered unit when a label lacks it', () => {
    const rendered = renderAlertEmail({
      events: [
        event({ parameterCode: 'CO', parameterLabel: 'CO', unit: 'ppm' }),
        event({ id: 2, parameterCode: 'CO', parameterLabel: 'CO (%)', unit: '%' }),
      ],
      scheduledAt,
    });

    expect(rendered.text).toContain('CO (ppm)');
    expect(rendered.text).toContain('CO (%)');
    expect(rendered.text).not.toContain('CO (%) (%)');
  });

  it('escapes data in table-based HTML, ignores untrusted payload URLs, and includes a plain text alternative', () => {
    const rendered = renderAlertEmail({
      events: [
        event({
          factoryName: '<img src=x onerror="alert(1)">',
          factoryRegistrationNo: 'reg & "quoted"',
          pointName: '<script>danger</script>',
          parameterLabel: '<b>CO</b>',
          unit: '%<x>',
          sourcePayload: { url: 'https://evil.invalid/', html: '<iframe src="bad">' },
        }),
      ],
      scheduledAt,
    });

    expect(rendered.html).toContain('&lt;img src=x onerror=&quot;alert(1)&quot;&gt;');
    expect(rendered.html).toContain('reg &amp; &quot;quoted&quot;');
    expect(rendered.html).toContain('&lt;script&gt;danger&lt;/script&gt;');
    expect(rendered.html).toContain('%&lt;x&gt;');
    expect(rendered.html).toContain('<table');
    expect(rendered.html).toContain('style="');
    expect(rendered.html).toContain('href="https://d-poms.diw.go.th/"');
    expect(rendered.html).not.toMatch(/<script|<img|<iframe|https:\/\/evil|<link|<style/i);
    expect(rendered.text).toContain('<img src=x onerror="alert(1)">');
    expect(rendered.text).toContain('https://d-poms.diw.go.th/');
  });

  it('uses registration identity when factory IDs are absent and keeps different registrations separate', () => {
    const rendered = renderAlertEmail({
      events: [
        event({ factoryId: null }),
        event({ id: 2, factoryId: null, parameterLabel: 'NOx (ppm)' }),
        event({ id: 3, factoryId: null, factoryRegistrationNo: '3-002' }),
      ],
      scheduledAt,
    });

    expect(rendered.subject).toContain('2 โรงงาน');
  });

  it('shows missing optional evidence explicitly without inventing thresholds, percentages, or intervals', () => {
    const rendered = renderAlertEmail({
      events: [
        event({
          alertType: 'ABNORMAL_VALUE',
          abnormalType: null,
          abnormalStreakCount: null,
          firstAbnormalAt: null,
          confirmedAbnormalAt: null,
          pointCode: null,
          factoryRegistrationNo: null,
          measuredValue: null,
        }),
      ],
      scheduledAt: dailyScheduledAt,
    });

    expect(rendered.text).toContain('ลักษณะ: ไม่ระบุ');
    expect(rendered.text).toContain('ค่าต่อเนื่อง: ไม่ระบุ');
    expect(rendered.text).not.toContain('ระยะห่างระหว่างค่าแรก');
    expect(rendered.text).not.toMatch(/NaN|undefined|null/);
  });

  it('rejects empty or mixed alert categories and mixed consecutive-reporting systems', () => {
    expect(() => renderAlertEmail({ events: [], scheduledAt })).toThrow('At least one');
    expect(() =>
      renderAlertEmail({
        events: [event(), event({ alertType: 'EIA_EXCEEDED', thresholdType: 'EIA' })],
        scheduledAt,
      }),
    ).toThrow('same alert type');
    expect(() =>
      renderAlertEmail({
        events: [
          event({ alertType: 'CONSECUTIVE_NO_REPORT' }),
          event({ alertType: 'CONSECUTIVE_NO_REPORT', systemType: 'WPMS' }),
        ],
        scheduledAt,
      }),
    ).toThrow('same system');
  });

  it('rejects invalid schedules and future or reversed hourly measurement windows', () => {
    expect(() => renderAlertEmail({ events: [event()], scheduledAt: 'not-a-date' })).toThrow(
      'Invalid',
    );
    expect(() =>
      renderAlertEmail({ events: [event({ endedAt: '2026-10-04T06:00:00Z' })], scheduledAt }),
    ).toThrow('completed');
    expect(() =>
      renderAlertEmail({ events: [event({ endedAt: '2026-10-04T03:00:00Z' })], scheduledAt }),
    ).toThrow('completed');
    expect(() => renderAlertEmail({ events: [event({ startedAt: null })], scheduledAt })).toThrow(
      'completed',
    );
  });

  it('rejects ambiguous times and unsupported hourly threshold combinations', () => {
    expect(() =>
      renderAlertEmail({ events: [event()], scheduledAt: '2026-10-04T12:05:00' }),
    ).toThrow('timezone');
    expect(() =>
      renderAlertEmail({ events: [event({ thresholdType: 'EIA' })], scheduledAt }),
    ).toThrow('threshold');
    expect(() =>
      renderAlertEmail({ events: [event({ thresholdValue: null })], scheduledAt }),
    ).toThrow('threshold');
  });
});
