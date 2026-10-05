import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import nodemailer from 'nodemailer';
import { startLocalSmtpSink } from './alert-email-test/local-smtp';
import { renderSimulationReport, runAlertEmailSimulation } from './alert-email-test/simulation';

async function outputDirectory(args: string[]): Promise<string> {
  if (args.length === 0) return mkdtemp('/private/tmp/poms-alert-email-test-');
  if (
    args.length !== 2 ||
    args[0] !== '--output' ||
    !/^\/private\/tmp\/poms-alert-email-test-[A-Za-z0-9_-]+$/.test(args[1])
  )
    throw new Error(
      'Usage: npx --no-install tsx scripts/test-alert-emails.ts [--output /private/tmp/poms-alert-email-test-NAME]',
    );
  const path = resolve(args[1]);
  // Never overwrite an existing directory, follow a user-supplied symlink or write inside the repo.
  await mkdir(path, { recursive: false });
  return path;
}

async function main(): Promise<void> {
  const output = await outputDirectory(process.argv.slice(2));
  const sink = await startLocalSmtpSink();
  const transporter = nodemailer.createTransport({
    host: sink.host,
    port: sink.port,
    secure: false,
    ignoreTLS: true,
    connectionTimeout: 5_000,
    greetingTimeout: 5_000,
    socketTimeout: 5_000,
  });
  try {
    console.log(`SMTP capture: ${sink.host}:${sink.port} (รับไว้ในเครื่องเท่านั้น ไม่มีการส่งต่อ)`);
    const report = await runAlertEmailSimulation({
      async send(input) {
        const sent = await transporter.sendMail({
          from: 'D-POMS Test <qa-sender@example.com>',
          to: input.to,
          cc: input.cc,
          subject: input.subject,
          text: input.text,
          html: input.html,
        });
        return {
          messageId: sent.messageId,
          accepted: (sent.accepted ?? []).map(String),
          rejected: (sent.rejected ?? []).map(String),
        };
      },
    });
    const captureValid =
      sink.messages.length === 7 &&
      sink.messages.every(
        (mail) =>
          mail.recipients.includes('qa-officer@example.com') &&
          mail.recipients.includes('diw.iemc@gmail.com') &&
          /Content-Type: multipart\/alternative/i.test(mail.data.toString('utf8')),
      );
    report.checks.push({
      id: 'loopback-seven-mime-messages',
      caseNumber: null,
      label: 'SMTP sink รับ MIME จริง 7 ฉบับ: ครบ 6 แบบและข้อมูลมาช้ารอบ 13:00 พร้อม To/CC',
      passed: captureValid,
      expected: true,
      actual: captureValid,
    });
    report.passed = report.checks.every((check) => check.passed);
    const captures: Array<{
      file: string;
      from: string;
      recipients: string[];
      bytes: number;
      messageId: string | null;
      deliveryId: number | null;
      eventIds: number[];
      caseNumber: number | null;
    }> = [];
    for (const [index, message] of sink.messages.entries()) {
      const file = `message-${String(index + 1).padStart(2, '0')}.eml`;
      const messageId =
        /^Message-ID:\s*(.+)$/im.exec(message.data.toString('utf8'))?.[1].trim() ?? null;
      const delivery = report.emails.find((mail) => mail.messageId === messageId);
      await writeFile(resolve(output, file), message.data, { flag: 'wx' });
      captures.push({
        file,
        from: message.from,
        recipients: message.recipients,
        bytes: message.data.length,
        messageId,
        deliveryId: delivery?.deliveryId ?? null,
        eventIds: delivery?.eventIds ?? [],
        caseNumber: delivery?.caseNumber ?? null,
      });
    }
    const correlated =
      captures.length === 7 &&
      captures.every((capture) => capture.deliveryId !== null && capture.eventIds.length > 0) &&
      new Set(captures.map((capture) => capture.deliveryId)).size === 7;
    report.checks.push({
      id: 'mime-delivery-correlation',
      caseNumber: null,
      label: 'Message-ID ใน MIME เชื่อมกลับ delivery และเหตุการณ์ครบทุกฉบับ',
      passed: correlated,
      expected: true,
      actual: correlated,
    });
    report.passed = report.checks.every((check) => check.passed);
    await writeFile(
      resolve(output, 'report.json'),
      `${JSON.stringify({ ...report, smtp: { host: sink.host, port: sink.port, forwarded: false }, captures }, null, 2)}\n`,
      { flag: 'wx' },
    );
    await writeFile(resolve(output, 'report.html'), renderSimulationReport(report), { flag: 'wx' });
    for (const check of report.checks)
      console.log(
        `${check.passed ? 'PASS' : 'FAIL'} ${check.caseNumber ? `ข้อ ${check.caseNumber} · ` : ''}${check.label}`,
      );
    console.log(
      `\n${report.passed ? 'PASS' : 'FAIL'} ${report.checks.filter((check) => check.passed).length}/${report.checks.length} checks · ${sink.messages.length} captured emails`,
    );
    console.log(`Report: ${output}/report.html`);
    console.log(`Evidence: ${output}/report.json`);
    console.log(
      'ข้อจำกัด: in-memory adapters; ไม่ทดสอบ SQL Server, ตัวตรวจต้นทาง, scheduler process หรือ inbox production',
    );
    if (!report.passed) process.exitCode = 1;
  } finally {
    transporter.close();
    await sink.close();
  }
}

void main().catch((error: unknown) => {
  console.error(`FAIL ${error instanceof Error ? error.message : 'Simulation failed'}`);
  process.exitCode = 1;
});
