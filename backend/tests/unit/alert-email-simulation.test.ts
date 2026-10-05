import { describe, expect, it, jest } from '@jest/globals';
import {
  runAlertEmailSimulation,
  renderSimulationReport,
} from '../../scripts/alert-email-test/simulation';

describe('safe alert email simulation', () => {
  it('runs the real pipeline for all six cases and rejects negative and boundary fixtures', async () => {
    const messages: Array<{
      to: string;
      cc: string[];
      html: string;
      subject: string;
      text: string;
    }> = [];
    const send = jest.fn(async (message: (typeof messages)[number]) => {
      messages.push(message);
      return {
        messageId: `test-${messages.length}`,
        accepted: [message.to, ...message.cc],
        rejected: [],
      };
    });
    const report = await runAlertEmailSimulation({ send });

    expect(report.passed).toBe(true);
    expect(report.checks.every((check) => check.passed)).toBe(true);
    expect(new Set(report.emails.map((email) => email.caseNumber))).toEqual(
      new Set([1, 2, 3, 4, 5, 6]),
    );
    expect(report.policy.hourlyDelayMinutes).toBe(0);
    expect(report.emails).toHaveLength(7);
    expect(messages).toHaveLength(7);
    expect(messages.every((message) => message.cc.includes('diw.iemc@gmail.com'))).toBe(true);
    expect(report.checks.find((check) => check.id === 'hourly-before-due')?.passed).toBe(true);
    expect(report.checks.find((check) => check.id === 'daily-before-nine')?.passed).toBe(true);
    expect(report.checks.find((check) => check.id === 'restart-no-duplicate')?.passed).toBe(true);
    for (const id of [
      'hourly-round-cutoff',
      'hourly-same-round-restart',
      'hourly-late-between-rounds',
      'hourly-late-before-next-round',
      'hourly-late-next-round',
      'hourly-late-measurement-time',
      'hourly-next-round-no-duplicate',
    ]) {
      expect(report.checks.find((check) => check.id === id)?.passed).toBe(true);
    }
    const lateEmail = report.emails.find(
      (email) => email.scheduledAt === '2026-10-05T06:00:00.000Z',
    );
    expect(lateEmail).toMatchObject({ caseNumber: 1, status: 'SMTP_ACCEPTED' });
    expect(lateEmail?.eventIds).toHaveLength(2);
    expect(lateEmail?.subject).toContain('เวลา 11.00 น.');
    expect(lateEmail?.text).toContain('- CO = 126 ppm');
    expect(lateEmail?.text).toContain('- NOX = 129 ppm');
    expect(report.checks.find((check) => check.id === 'legacy-invalid-job')?.passed).toBe(true);
    expect(report.limitations.join(' ')).toMatch(/ต้นทาง/);
    expect(report.limitations.join(' ')).toMatch(/SQL/);
  });

  it('marks the report failed when the configured SMTP capture rejects a recipient', async () => {
    const report = await runAlertEmailSimulation({
      send: async (message) => ({ accepted: [message.to], rejected: message.cc }),
    });
    expect(report.passed).toBe(false);
    expect(report.checks.find((check) => check.id === 'smtp-six-cases')?.passed).toBe(false);
  });

  it('renders six safe previews, evidence and the testing limits without remote assets', async () => {
    const report = await runAlertEmailSimulation({
      send: async (message) => ({ accepted: [message.to, ...message.cc], rejected: [] }),
    });
    const html = renderSimulationReport(report);
    expect(html).toContain('ข้อ 1');
    expect(html).toContain('ข้อ 6');
    expect(html).toContain('diw.iemc@gmail.com');
    expect(html).toContain('SQL');
    expect(html).not.toMatch(/<script|<link|<img/i);
    expect(html.match(/<iframe/g)).toHaveLength(7);
    expect(html).toContain('13:00');
    expect(html).toContain('sandbox=""');
  });
});
