import { describe, expect, it } from '@jest/globals';
import { renderAlertEmail } from '../../src/modules/alert-emails/alert-email-template';
import type { AlertEventDTO } from '../../src/modules/alert-events/alert-events.types';
import {
  detectAbnormalHourlyEpisodes,
  type AlertHourlySample,
} from '../../src/modules/alert-emails/alert-email-rules';

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
      expect(renderAlertEmail({ events: [valid], scheduledAt }).text).toContain('- SO₂ = 125 ppm');
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
  it.each([
    [
      'STANDARD_EXCEEDED' as const,
      'CEMS' as const,
      'STANDARD' as const,
      'D-POMS แจ้งเตือนผลตรวจวัดมลพิษเกินค่ามาตรฐานกระทรวงอุตสาหกรรม ในวันที่ 4-10-2569 เวลา 11.00 น. จำนวน 1 บริษัท',
    ],
    [
      'EIA_EXCEEDED' as const,
      'CEMS' as const,
      'EIA' as const,
      'D-POMS แจ้งเตือนผลตรวจวัดมลพิษเกินค่าควบคุม EIA/ IEE /EHIA ในวันที่ 4-10-2569 เวลา 11.00 น. จำนวน 1 บริษัท',
    ],
    [
      'DAILY_COMPLETENESS_LOW' as const,
      'CEMS' as const,
      'STANDARD' as const,
      'D-POMS แจ้งเตือนการรายงานผลตรวจวัดมลพิษเข้าสู่ระบบไม่ถึงร้อยละ 80 ต่อวัน ในวันที่ 4-10-2569 จำนวน 1 บริษัท',
    ],
    [
      'CONSECUTIVE_NO_REPORT' as const,
      'CEMS' as const,
      'STANDARD' as const,
      'D-POMS แจ้งเตือนการไม่รายงานผลตรวจวัดมลพิษจากระบบ CEMS หรือรายงานไม่ถึงร้อยละ 80 ต่อวัน ติดต่อกันตั้งแต่ 15 วันขึ้นไป ในวันที่ 4-10-2569 จำนวน 1 บริษัท',
    ],
    [
      'CONSECUTIVE_NO_REPORT' as const,
      'WPMS' as const,
      'STANDARD' as const,
      'D-POMS แจ้งเตือนการไม่รายงานผลตรวจวัด BOD/COD Online หรือรายงานไม่ถึงร้อยละ 80 ต่อวัน ติดต่อกันเกิน 7 วัน ในวันที่ 4-10-2569 จำนวน 1 บริษัท',
    ],
    [
      'ABNORMAL_VALUE' as const,
      'CEMS' as const,
      'STANDARD' as const,
      'D-POMS แจ้งเตือนการรายงานผลการตรวจวัดมีค่าผิดปกติ (ศูนย์/ติดลบ/ค่านิ่ง) ในวันที่ 4-10-2569 จำนวน 1 บริษัท',
    ],
  ])(
    'uses the original PDF subject and letter heading for %s / %s',
    (alertType, systemType, thresholdType, subject) => {
      const rendered = renderAlertEmail({
        events: [
          event({
            alertType,
            systemType,
            thresholdType,
            consecutiveDays: systemType === 'CEMS' ? 15 : 8,
            completenessPercent: 79,
            abnormalType: 'ZERO',
          }),
        ],
        scheduledAt:
          alertType === 'STANDARD_EXCEEDED' || alertType === 'EIA_EXCEEDED'
            ? scheduledAt
            : dailyScheduledAt,
      });

      expect(rendered.subject).toBe(subject);
      expect(rendered.text.startsWith(`เรียน เจ้าหน้าที่ที่เกี่ยวข้อง\nเรื่อง ${subject}\n`)).toBe(
        true,
      );
      expect(rendered.html).toContain('เรียน');
      expect(rendered.html).toContain('เจ้าหน้าที่ที่เกี่ยวข้อง');
      for (const forbidden of [
        '[D-POMS]',
        'รอบแจ้งเตือน:',
        'พบเหตุการณ์ในโรงงาน',
        'ผู้รับผิดชอบที่เกี่ยวข้อง',
      ]) {
        expect(rendered.text).not.toContain(forbidden);
        expect(rendered.html).not.toContain(forbidden);
      }
    },
  );

  it('uses the completed measurement window time in Bangkok rather than scheduled or detected time', () => {
    const rendered = renderAlertEmail({ events: [event()], scheduledAt });

    expect(rendered.subject).toContain('ในวันที่ 4-10-2569 เวลา 11.00 น.');
    expect(rendered.text).toContain('- SO₂ = 250 ppm');
    expect(rendered.text).not.toMatch(/12\.05|12\.00|12:05|12:00|ช่วงตรวจวัด:|ตรวจพบ:|ค่ามาตรฐาน:/);
    expect(rendered.text).not.toContain('ส่งแล้ว');
  });

  it('renders the preceding daily reporting date without presenting the sending date or 09:00 as the report date', () => {
    const rendered = renderAlertEmail({
      events: [event({ alertType: 'DAILY_COMPLETENESS_LOW', completenessPercent: 79.17 })],
      scheduledAt: dailyScheduledAt,
    });

    expect(rendered.subject).toContain('ในวันที่ 4-10-2569 จำนวน 1 บริษัท');
    expect(rendered.text).toContain('- SO₂ (ppm) = ร้อยละ 79.17');
    expect(rendered.text).not.toMatch(/5-10-2569|09[.:]00|ค่ามาตรฐาน:|เกณฑ์:|รอบแจ้งเตือน:/);
  });

  it.each([
    ['CEMS' as const, 15, '2026-09-20', '20-9-2569'],
    ['WPMS' as const, 8, '2026-09-27', '27-9-2569'],
  ])(
    'renders %s consecutive reporting using the persisted episode start and actual day count',
    (systemType, days, reportingStartedOn, formattedStart) => {
      const rendered = renderAlertEmail({
        events: [
          event({
            alertType: 'CONSECUTIVE_NO_REPORT',
            systemType,
            consecutiveDays: days,
            completenessPercent: 50,
          }),
        ],
        scheduledAt: dailyScheduledAt,
        contextByEventId: { 1: { factoryProvinceName: 'ระยอง', reportingStartedOn } },
      });

      expect(rendered.text).toContain(
        `- SO₂ (ppm) = ไม่รายงานหรือรายงานไม่ถึงร้อยละ 80 ต่อวันตั้งแต่วันที่ ${formattedStart} รวม ${days} วัน`,
      );
      expect(rendered.text).not.toContain('ไม่รายงานตั้งแต่วันที่');
      expect(rendered.text).not.toContain('ไม่รายงานต่อเนื่อง');
      if (systemType === 'WPMS') {
        expect(rendered.text).toContain('1.1 Stack 1 (WPMS)');
        expect(rendered.text).not.toContain('(BOD/COD Online)');
      }
    },
  );

  it('retains the original registered-laboratory and กวภ.02 notice only for CEMS consecutive reporting', () => {
    const notice =
      'โรงงานต้องดำเนินการตรวจวัดพารามิเตอร์ที่ไม่สามารถรายงานผลได้ด้วยห้องปฏิบัติการวิเคราะห์ที่ขึ้นทะเบียนกับกรมโรงงานอุตสาหกรรม และรายงานผลการตรวจวัดแก่กรมโรงงานอุตสาหกรรมอย่างน้อยเดือนละ 1 ครั้ง (รายงาน กวภ.02)';
    const cems = renderAlertEmail({
      events: [event({ alertType: 'CONSECUTIVE_NO_REPORT', consecutiveDays: 15 })],
      scheduledAt: dailyScheduledAt,
    });
    const wpms = renderAlertEmail({
      events: [
        event({ alertType: 'CONSECUTIVE_NO_REPORT', systemType: 'WPMS', consecutiveDays: 8 }),
      ],
      scheduledAt: dailyScheduledAt,
    });

    expect(cems.text).toContain(notice);
    expect(cems.html).toContain(notice);
    expect(wpms.text).not.toContain('กวภ.02');
    expect(wpms.html).not.toContain('กวภ.02');
    expect(cems.text.indexOf(notice)).toBeLessThan(cems.text.indexOf('ขอแสดงความนับถือ'));
  });

  it.each([
    ['CONSTANT' as const, 'ค่านิ่งตั้งแต่วันที่'],
    ['ZERO' as const, 'ค่าเป็น 0 วันที่'],
    ['NEGATIVE' as const, 'ค่าติดลบตั้งแต่วันที่'],
  ])(
    'renders %s using elapsed measurement time rather than interpreting five readings as five hours',
    (abnormalType, label) => {
      const rendered = renderAlertEmail({
        events: [
          event({
            alertType: 'ABNORMAL_VALUE',
            abnormalType,
            abnormalStreakCount: 5,
            firstAbnormalAt: '2026-10-04T01:00:00.000Z',
            confirmedAbnormalAt: '2026-10-04T05:00:00.000Z',
            endedAt: '2026-10-04T05:00:00.000Z',
          }),
        ],
        scheduledAt: dailyScheduledAt,
      });

      expect(rendered.text).toContain(
        `- SO₂ (ppm) = ${label} 4-10-2569 เวลา 08.00 น. รวม 0 วัน 4 ชั่วโมง`,
      );
      expect(rendered.text).not.toContain('5 ชั่วโมง');
      expect(rendered.text).not.toContain('รวม 0 วัน 25 ชั่วโมง');
    },
  );

  it('renders elapsed abnormal durations as complete days and remaining hours', () => {
    const rendered = renderAlertEmail({
      events: [
        event({
          alertType: 'ABNORMAL_VALUE',
          abnormalType: 'CONSTANT',
          abnormalStreakCount: 31,
          firstAbnormalAt: '2026-10-02T23:00:00.000Z',
          confirmedAbnormalAt: '2026-10-03T03:00:00.000Z',
          endedAt: '2026-10-04T05:00:00.000Z',
        }),
      ],
      scheduledAt: dailyScheduledAt,
    });

    expect(rendered.text).toContain(
      'ค่านิ่งตั้งแต่วันที่ 3-10-2569 เวลา 06.00 น. รวม 1 วัน 6 ชั่วโมง',
    );
    expect(rendered.text).not.toContain('31 ชั่วโมง');
  });

  it('uses the last observed measurement of a detected 24-reading episode rather than its fifth-reading confirmation', () => {
    const firstAt = Date.parse('2026-10-04T00:00:00+07:00');
    const samples: AlertHourlySample[] = Array.from({ length: 24 }, (_, hour) => {
      const measuredAt = new Date(firstAt + hour * 3_600_000).toISOString();
      return { measuredAt, reportedAt: measuredAt, status: 'Normal', value: 125 };
    });
    const episodes = detectAbnormalHourlyEpisodes(samples, 5);
    expect(episodes).toHaveLength(1);
    const episode = episodes[0];
    expect(episode.confirmedAt).toBe(new Date(firstAt + 4 * 3_600_000).toISOString());
    expect(episode.endedAt).toBe(new Date(firstAt + 23 * 3_600_000).toISOString());
    expect(episode.streakCount).toBe(24);

    const rendered = renderAlertEmail({
      events: [
        event({
          alertType: 'ABNORMAL_VALUE',
          abnormalType: episode.abnormalType,
          measuredValue: episode.measuredValue,
          abnormalStreakCount: episode.streakCount,
          startedAt: episode.startedAt,
          firstAbnormalAt: episode.startedAt,
          confirmedAbnormalAt: episode.confirmedAt,
          endedAt: episode.endedAt,
        }),
      ],
      scheduledAt: dailyScheduledAt,
    });

    expect(rendered.text).toContain(
      'ค่านิ่งตั้งแต่วันที่ 4-10-2569 เวลา 00.00 น. รวม 0 วัน 23 ชั่วโมง',
    );
    expect(rendered.text).not.toContain('รวม 0 วัน 4 ชั่วโมง');
    expect(rendered.text).not.toContain('24 ชั่วโมง');
  });

  it('does not infer an episode duration from confirmation time or count when the last observation is missing', () => {
    const rendered = renderAlertEmail({
      events: [
        event({
          alertType: 'ABNORMAL_VALUE',
          abnormalType: 'CONSTANT',
          abnormalStreakCount: 24,
          firstAbnormalAt: '2026-10-03T17:00:00.000Z',
          confirmedAbnormalAt: '2026-10-03T21:00:00.000Z',
          endedAt: null,
        }),
      ],
      scheduledAt: dailyScheduledAt,
    });

    expect(rendered.text).toContain('ไม่ระบุระยะเวลา');
    expect(rendered.text).not.toMatch(/รวม \d+ วัน \d+ ชั่วโมง/);
    expect(rendered.text).not.toContain('24 ชั่วโมง');
  });

  it('rejects an abnormal episode whose last observation precedes the first measurement', () => {
    expect(() =>
      renderAlertEmail({
        events: [
          event({
            alertType: 'ABNORMAL_VALUE',
            abnormalType: 'CONSTANT',
            firstAbnormalAt: '2026-10-04T01:00:00.000Z',
            confirmedAbnormalAt: '2026-10-04T05:00:00.000Z',
            endedAt: '2026-10-04T00:00:00.000Z',
          }),
        ],
        scheduledAt: dailyScheduledAt,
      }),
    ).toThrow('Invalid abnormal');
  });

  it('counts and numbers companies, points and their parameters as in the PDF regardless of input order', () => {
    const events = [
      event({
        id: 3,
        factoryId: 'factory-2',
        factoryName: 'บริษัท สอง จำกัด',
        factoryRegistrationNo: '3-002',
        stationId: 'station-3',
        pointCode: 'B01',
        pointName: 'Boiler 1',
      }),
      event({
        id: 4,
        systemType: 'WPMS',
        stationId: 'station-2',
        pointCode: 'W01',
        pointName: 'จุดตรวจวัดที่ 1',
        parameterCode: 'BOD',
        parameterName: 'BOD',
        parameterLabel: 'BOD (mg/l)',
        unit: 'mg/l',
        measuredValue: 30,
        thresholdValue: 20,
      }),
      event({ id: 2, parameterCode: 'NOX', parameterLabel: 'NOx (ppm)', measuredValue: 300 }),
      event(),
    ];
    const contextByEventId = {
      1: { factoryProvinceName: 'ระยอง' },
      2: { factoryProvinceName: 'ระยอง' },
      3: { factoryProvinceName: 'ฉะเชิงเทรา' },
      4: { factoryProvinceName: 'ระยอง' },
    };
    const rendered = renderAlertEmail({ events, scheduledAt, contextByEventId });

    expect(rendered.subject).toContain('จำนวน 2 บริษัท');
    expect(rendered.text).toContain('1) บริษัท ตัวอย่าง จำกัด (3-001) จังหวัด ระยอง');
    expect(rendered.text).toContain('2) บริษัท สอง จำกัด (3-002) จังหวัด ฉะเชิงเทรา');
    expect(rendered.text).toContain('1.1 Stack 1 (CEMS)');
    expect(rendered.text).toContain('1.2 จุดตรวจวัดที่ 1 (WPMS)');
    expect(rendered.text).toContain('2.1 Boiler 1 (CEMS)');
    expect(rendered.text.match(/บริษัท ตัวอย่าง จำกัด/g)).toHaveLength(1);
    expect(rendered.text).toMatch(/- SO₂ = 250 ppm\n[ \t]*- NOx = 300 ppm/);
    expect(rendered.text).toContain('- BOD = 30 mg/l');
    expect(
      renderAlertEmail({ events: [...events].reverse(), scheduledAt, contextByEventId }),
    ).toEqual(rendered);
  });

  it('retains distinct real units after hourly measured values without duplicating label units', () => {
    const rendered = renderAlertEmail({
      events: [
        event({ parameterCode: 'CO', parameterLabel: 'CO', unit: 'ppm' }),
        event({ id: 2, parameterCode: 'CO', parameterLabel: 'CO (%)', unit: '%' }),
      ],
      scheduledAt,
    });

    expect(rendered.text).toContain('- CO = 250 ppm');
    expect(rendered.text).toContain('- CO = 250 %');
    expect(rendered.text).not.toContain('CO (%) (%)');
    expect(rendered.text).not.toContain('CO (%) = 250 %');
  });

  it('keeps daily parameter labels human-readable with their registered units', () => {
    const rendered = renderAlertEmail({
      events: [
        event({
          alertType: 'DAILY_COMPLETENESS_LOW',
          parameterCode: 'CO',
          parameterLabel: 'CO',
          unit: 'ppm',
          completenessPercent: 50,
        }),
        event({
          id: 2,
          alertType: 'DAILY_COMPLETENESS_LOW',
          parameterCode: 'CO',
          parameterLabel: 'CO (%)',
          unit: '%',
          completenessPercent: 70,
        }),
      ],
      scheduledAt: dailyScheduledAt,
    });

    expect(rendered.text).toContain('- CO (ppm) = ร้อยละ 50');
    expect(rendered.text).toContain('- CO (%) = ร้อยละ 70');
    expect(rendered.text).not.toContain('CO (%) (%)');
  });

  it('renders an official letter with highlighted data, the original closing and all official contact details', () => {
    const rendered = renderAlertEmail({
      events: [event()],
      scheduledAt,
      contextByEventId: { 1: { factoryProvinceName: 'ระยอง' } },
    });
    const footer = [
      'ขอแสดงความนับถือ',
      'ศูนย์เฝ้าระวังสิ่งแวดล้อมอุตสาหกรรม',
      'กองวิจัยและเตือนภัยมลพิษโรงงาน',
      'กรมโรงงานอุตสาหกรรม',
      'โทร. 02-430-6312 ต่อ 2109',
      'ไปรษณีย์อิเล็กทรอนิกส์ : poms.support@diw.mail.go.th',
      'Line ID : @iemcdiw',
    ];

    expect(rendered.text).toContain('โปรดดำเนินการตรวจสอบ และแก้ไขโดยเร็ว');
    for (const line of footer) {
      expect(rendered.text).toContain(line);
      expect(rendered.html).toContain(line);
    }
    expect(rendered.html).toMatch(/color:\s*(?:black|#000000|#000|#243b53|#16324f)(?:;|["'])/i);
    expect(rendered.html).not.toMatch(/<a\b|href=|<button\b/i);
    expect(rendered.text).not.toContain('ดูรายละเอียดใน D-POMS');
    expect(rendered.html).not.toContain('ดูรายละเอียดใน D-POMS');
    expect(rendered.text).not.toContain('โปรดเข้าสู่ระบบ');
    expect(rendered.html).not.toContain('โปรดเข้าสู่ระบบ');
  });

  it('escapes untrusted names and persisted context in email HTML and ignores payload URLs', () => {
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
      contextByEventId: { 1: { factoryProvinceName: '<svg onload="alert(2)">' } },
    });

    expect(rendered.html).toContain('&lt;img src=x onerror=&quot;alert(1)&quot;&gt;');
    expect(rendered.html).toContain('reg &amp; &quot;quoted&quot;');
    expect(rendered.html).toContain('&lt;script&gt;danger&lt;/script&gt;');
    expect(rendered.html).toContain('%&lt;x&gt;');
    expect(rendered.html).toContain('&lt;svg onload=&quot;alert(2)&quot;&gt;');
    expect(rendered.html).toContain('style="');
    expect(rendered.html).not.toMatch(/<script|<img|<iframe|<svg|https:\/\/evil|<link|<style/i);
    expect(rendered.text).toContain('<img src=x onerror="alert(1)">');
    expect(rendered.text).not.toContain('https://d-poms.diw.go.th/');
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

    expect(rendered.subject).toContain('จำนวน 2 บริษัท');
  });

  it('does not invent absent province or reporting episode metadata from caller payload or day count', () => {
    const rendered = renderAlertEmail({
      events: [
        event({
          alertType: 'CONSECUTIVE_NO_REPORT',
          consecutiveDays: 15,
          sourcePayload: {
            factoryProvinceName: 'จังหวัดจากpayload',
            reportingStartedOn: '2026-09-20',
          },
        }),
      ],
      scheduledAt: dailyScheduledAt,
    });

    expect(rendered.text).toContain('จังหวัด ไม่ระบุ');
    expect(rendered.text).toContain('ตั้งแต่วันที่ ไม่ระบุ รวม 15 วัน');
    expect(rendered.text).not.toContain('จังหวัดจากpayload');
    expect(rendered.text).not.toContain('20-9-2569');
    expect(rendered.text).not.toMatch(/NaN|undefined|null/);
  });

  it('shows missing abnormal evidence without inventing percentages, thresholds or elapsed intervals', () => {
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

    expect(rendered.text).toContain('ไม่ระบุ');
    expect(rendered.text).not.toMatch(/รวม \d+ วัน \d+ ชั่วโมง|NaN|undefined|null/);
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

  it.each(['STANDARD_EXCEEDED' as const, 'DAILY_COMPLETENESS_LOW' as const])(
    'rejects mixed reporting dates for %s instead of giving one misleading PDF heading',
    (alertType) => {
      expect(() =>
        renderAlertEmail({
          events: [
            event({ alertType, completenessPercent: 50 }),
            event({ id: 2, alertType, eventDate: '2026-10-03', completenessPercent: 50 }),
          ],
          scheduledAt: dailyScheduledAt,
        }),
      ).toThrow('same eventDate');
    },
  );

  it('rejects a batch spanning multiple hourly windows instead of giving one misleading time', () => {
    expect(() =>
      renderAlertEmail({
        events: [
          event(),
          event({
            id: 2,
            startedAt: '2026-10-04T03:00:00.000Z',
            endedAt: '2026-10-04T03:59:00.000Z',
          }),
        ],
        scheduledAt,
      }),
    ).toThrow('same');
  });

  it('rejects reversed abnormal evidence rather than displaying a negative duration', () => {
    expect(() =>
      renderAlertEmail({
        events: [
          event({
            alertType: 'ABNORMAL_VALUE',
            abnormalType: 'CONSTANT',
            firstAbnormalAt: '2026-10-04T05:00:00.000Z',
            confirmedAbnormalAt: '2026-10-04T01:00:00.000Z',
            endedAt: '2026-10-04T06:00:00.000Z',
          }),
        ],
        scheduledAt: dailyScheduledAt,
      }),
    ).toThrow('Invalid abnormal');
  });
});
