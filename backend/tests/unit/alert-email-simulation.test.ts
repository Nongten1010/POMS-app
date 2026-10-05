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
    expect(report.emails).toHaveLength(6);
    expect(messages).toHaveLength(6);
    expect(messages.every((message) => message.cc.includes('diw.iemc@gmail.com'))).toBe(true);
    expect(report.checks.find((check) => check.id === 'hourly-before-due')?.passed).toBe(true);
    expect(report.checks.find((check) => check.id === 'daily-before-nine')?.passed).toBe(true);
    expect(report.checks.find((check) => check.id === 'restart-no-duplicate')?.passed).toBe(true);
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
    expect(html.match(/<iframe/g)).toHaveLength(6);
    expect(html).toContain('sandbox=""');
  });
});
