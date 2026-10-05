import { randomUUID } from 'node:crypto';
import { createIntegrationAlertEventSchema } from '../../src/modules/alert-events/alert-events.validator';
import type { AlertEventDTO } from '../../src/modules/alert-events/alert-events.types';
import {
  buildDailyAlertCandidates,
  type DailyAlertCandidate,
  type DailyAlertParameter,
} from '../../src/modules/alert-emails/alert-email-daily-detector';
import {
  dispatchNextAlertEmail,
  type AlertEmailTransport,
} from '../../src/modules/alert-emails/alert-email-dispatch';
import { createAlertEmailEngine } from '../../src/modules/alert-emails/alert-email-engine';
import {
  isAlertEmailJobEligible,
  type CurrentAlertEmailEvent,
} from '../../src/modules/alert-emails/alert-email-eligibility';
import type {
  AlertEmailBatchInput,
  AlertEmailCompletion,
  AlertEmailDelivery,
  AlertEmailJob,
} from '../../src/modules/alert-emails/alert-email-outbox.repository';
import type { ActiveAlertEmailPolicy } from '../../src/modules/alert-emails/alert-email-policy';
import {
  summarizeAlertDay,
  type AlertDaySummary,
  type AlertHourlySample,
} from '../../src/modules/alert-emails/alert-email-rules';
import type { AlertEmailPoint } from '../../src/modules/alert-emails/alert-email-source.repository';
import { renderAlertEmail } from '../../src/modules/alert-emails/alert-email-template';

const REPORTING_DATE = '2026-10-04';
const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const OFFICER = 'qa-officer@example.com';
const CASE_LABELS: Record<number, string> = {
  1: 'เกินมาตรฐาน',
  2: 'เกินค่าควบคุม EIA',
  3: 'รายงานไม่ถึง 80%',
  4: 'CEMS รายงานต่ำต่อเนื่อง 15 วัน',
  5: 'WPMS รายงานต่ำต่อเนื่อง 8 วัน',
  6: 'ค่านิ่ง ศูนย์ หรือติดลบต่อเนื่อง',
};

/** Test policy only. These choices do not activate or approve the production policy. */
export const SIMULATION_POLICY: ActiveAlertEmailPolicy = {
  enabled: true,
  recipientMode: 'POINT_OFFICERS',
  completenessPolicy: 'ON_TIME',
  exemptDayPolicy: 'RESET',
  dailyFormat: 'BY_TYPE',
  abnormalMode: 'PREVIOUS_DAY',
  abnormalReadings: 5,
  hourlyDelayMinutes: 5,
};

export interface SimulationCheck {
  id: string;
  caseNumber: number | null;
  label: string;
  passed: boolean;
  expected: unknown;
  actual: unknown;
}

export interface SimulationEmail {
  caseNumber: number;
  label: string;
  deliveryId: number;
  eventIds: number[];
  to: string;
  cc: string[];
  scheduledAt: string;
  status: string;
  messageId: string | null;
  acceptedRecipients: string[];
  rejectedRecipients: string[];
  subject: string;
  text: string;
  html: string;
}

export interface SimulationReport {
  passed: boolean;
  generatedAt: string;
  mode: 'IN_MEMORY_LOOPBACK_SMTP';
  policy: ActiveAlertEmailPolicy;
  checks: SimulationCheck[];
  emails: SimulationEmail[];
  events: AlertEventDTO[];
  limitations: string[];
}

/** Deliberately not a SQL adapter: persistence, SQL races and production queries are not proven here. */
class MemoryOutbox {
  readonly deliveries: AlertEmailDelivery[] = [];
  constructor(private readonly clock: () => Date) {}

  async listBatchedEventIds(recipient: string, cadence: 'HOURLY' | 'DAILY', eventIds: number[]) {
    return [
      ...new Set(
        this.deliveries
          .filter((job) => job.recipient === recipient && job.cadence === cadence)
          .flatMap((job) => job.eventIds)
          .filter((id) => eventIds.includes(id)),
      ),
    ];
  }

  async enqueue(input: AlertEmailBatchInput) {
    const existing = this.deliveries.find((job) => job.deduplicationKey === input.deduplicationKey);
    if (existing) return { batchId: existing.batchId, deliveryId: existing.id, created: false };
    if ((await this.listBatchedEventIds(input.recipient, input.cadence, input.eventIds)).length > 0)
      throw new Error('An event is already batched for this recipient');
    const id = this.deliveries.length + 1;
    this.deliveries.push({
      ...input,
      cc: [...input.cc],
      eventIds: [...input.eventIds],
      id,
      batchId: id,
      status: 'QUEUED',
      attempts: 0,
      leaseToken: null,
      leasedUntil: null,
      nextAttemptAt: input.scheduledAt,
      messageId: null,
      errorCode: null,
      acceptedRecipients: [],
      rejectedRecipients: [],
      completedAt: null,
      createdAt: this.clock().toISOString(),
      updatedAt: this.clock().toISOString(),
    });
    return { batchId: id, deliveryId: id, created: true };
  }

  async claim(now: Date, leaseSeconds: number): Promise<AlertEmailJob | null> {
    for (const job of this.deliveries) {
      if (
        job.status === 'PROCESSING' &&
        job.leasedUntil &&
        Date.parse(job.leasedUntil) <= now.getTime()
      ) {
        job.status = 'UNKNOWN';
        job.errorCode = 'LEASE_EXPIRED';
        job.nextAttemptAt = null;
        job.leaseToken = null;
        job.leasedUntil = null;
      }
    }
    const job = this.deliveries.find(
      (item) =>
        ['QUEUED', 'RETRY_PENDING'].includes(item.status) &&
        item.attempts < 5 &&
        item.nextAttemptAt !== null &&
        Date.parse(item.nextAttemptAt) <= now.getTime(),
    );
    if (!job) return null;
    job.status = 'PROCESSING';
    job.attempts += 1;
    job.leaseToken = randomUUID();
    job.leasedUntil = new Date(now.getTime() + leaseSeconds * 1000).toISOString();
    return {
      ...job,
      eventIds: [...job.eventIds],
      status: 'PROCESSING',
      leaseToken: job.leaseToken,
    };
  }

  async renewLease(id: number, token: string, now: Date, seconds: number) {
    const job = this.leased(id, token, now);
    if (!job) return false;
    job.leasedUntil = new Date(now.getTime() + seconds * 1000).toISOString();
    return true;
  }

  async complete(id: number, token: string, outcome: AlertEmailCompletion) {
    const job = this.leased(id, token, new Date(outcome.completedAt));
    if (!job) return false;
    Object.assign(job, outcome, {
      leaseToken: null,
      leasedUntil: null,
      completedAt: outcome.status === 'RETRY_PENDING' ? null : outcome.completedAt,
    });
    return true;
  }

  private leased(id: number, token: string, now: Date) {
    return this.deliveries.find(
      (job) =>
        job.id === id &&
        job.status === 'PROCESSING' &&
        job.leaseToken === token &&
        job.leasedUntil !== null &&
        Date.parse(job.leasedUntil) > now.getTime(),
    );
  }
}

/** Production functions + explicit clock + synthetic adapters; never imports runtime/app/database/env. */
export async function runAlertEmailSimulation(
  transport: AlertEmailTransport,
): Promise<SimulationReport> {
  let now = new Date('2026-10-05T08:59:59+07:00');
  const clock = () => new Date(now);
  const checks: SimulationCheck[] = [];
  const check = (
    id: string,
    label: string,
    caseNumber: number | null,
    expected: unknown,
    actual: unknown,
  ) => {
    checks.push({
      id,
      label,
      caseNumber,
      expected,
      actual,
      passed: JSON.stringify(expected) === JSON.stringify(actual),
    });
  };
  const points = [
    point(1, 'CEMS', 'QA_STACK'),
    point(2, 'WPMS', 'QA_WATER'),
    point(3, 'CEMS', 'QA_ABNORMAL'),
  ];
  const events: CurrentAlertEmailEvent[] = [];
  const addEvent = (
    event: Omit<AlertEventDTO, 'id'>,
    evidence: Record<string, unknown> | null = null,
  ) => {
    const existing = events.find((item) => item.event.idempotencyKey === event.idempotencyKey);
    if (existing) return existing.event.id;
    const id = events.length + 1;
    events.push({ event: { ...event, id }, evidence });
    return id;
  };

  for (const [thresholdType, caseNumber] of [
    ['STANDARD', 1],
    ['EIA', 2],
  ] as const) {
    for (const value of [100, 120, 125]) {
      const parsed = createIntegrationAlertEventSchema.safeParse(
        hourlyPayload(thresholdType, value),
      );
      check(
        `case-${caseNumber}-value-${value}`,
        `ค่า ${value} เทียบเกณฑ์ 120`,
        caseNumber,
        value > 120,
        parsed.success,
      );
      if (parsed.success) addEvent(hourlyDTO(parsed.data, points[0]));
    }
  }
  check(
    'normal-equal-no-event',
    'ค่าปกติและเท่ากับเกณฑ์ไม่ถูกบันทึกเป็นเหตุการณ์',
    null,
    2,
    events.length,
  );

  const cemsParameter = parameter('SO2', 'ppm', [], history(14));
  const wpmsParameter = parameter('BOD', 'mg/l', [], history(7));
  const abnormalParameters = (
    [
      ['SO2', 12],
      ['CO', 0],
      ['NOX', -1],
    ] as const
  ).map(([code, value]) =>
    parameter(
      code,
      'ppm',
      samples(24).map((sample, hour) => ({ ...sample, value: hour < 5 ? value : hour + 20 })),
    ),
  );
  const registered = new Map<number, DailyAlertParameter[]>([
    [1, [cemsParameter]],
    [2, [wpmsParameter]],
    [3, abnormalParameters],
  ]);
  const candidates = (
    testPoint: AlertEmailPoint,
    parameters: DailyAlertParameter[],
    policy = SIMULATION_POLICY,
  ) =>
    buildDailyAlertCandidates({
      point: testPoint,
      parameters,
      date: REPORTING_DATE,
      detectedAt: '2026-10-05T09:00:00+07:00',
      completenessPolicy: policy.completenessPolicy,
      exemptDayPolicy: policy.exemptDayPolicy,
      abnormalReadings: policy.abnormalReadings,
    });

  for (const count of [0, 19, 20, 24]) {
    const list = candidates(points[0], [parameter('SO2', 'ppm', samples(count))]);
    check(
      `completeness-${count}`,
      `รายงาน ${count}/24 ชั่วโมง`,
      3,
      count < 20,
      list.some((item) => item.alert_type === 'DAILY_COMPLETENESS_LOW'),
    );
  }
  const exactEighty = samples(24).map((sample, hour) => ({
    ...sample,
    status: hour >= 5 ? 'Shut Down' : 'Normal',
    value: hour === 4 ? null : sample.value,
  }));
  const exactSummary = summarizeAlertDay(REPORTING_DATE, exactEighty, 'NORMAL_EXCLUDING_SHUTDOWN');
  check(
    'completeness-exact-eighty',
    'ครบ 80% พอดีเมื่อยกเว้นชั่วโมงหยุดเดินเครื่อง',
    3,
    { percent: 80, low: false },
    { percent: exactSummary.completenessPercent, low: exactSummary.lowCompleteness },
  );

  for (const [testPoint, threshold, caseNumber] of [
    [points[0], 15, 4],
    [points[1], 8, 5],
  ] as const) {
    for (const days of [threshold - 1, threshold]) {
      const list = candidates(testPoint, [
        parameter(
          testPoint.systemType === 'CEMS' ? 'SO2' : 'BOD',
          testPoint.systemType === 'CEMS' ? 'ppm' : 'mg/l',
          [],
          history(days - 1),
        ),
      ]);
      check(
        `case-${caseNumber}-days-${days}`,
        `ไม่รายงานสลับต่ำกว่า 80% ต่อเนื่อง ${days} วัน`,
        caseNumber,
        days >= threshold,
        list.some((item) => item.alert_type === 'CONSECUTIVE_NO_REPORT'),
      );
    }
    const recoveredHistory = history(threshold + 2);
    recoveredHistory[2] = summarizeAlertDay(
      recoveredHistory[2].date,
      samples(24, recoveredHistory[2].date),
      'ON_TIME',
    );
    check(
      `case-${caseNumber}-recovery`,
      'กลับมารายงานครบแล้วเริ่มนับต่อเนื่องใหม่',
      caseNumber,
      false,
      candidates(testPoint, [parameter('SO2', 'ppm', [], recoveredHistory)]).some(
        (item) => item.alert_type === 'CONSECUTIVE_NO_REPORT',
      ),
    );
  }

  for (const [type, value] of [
    ['CONSTANT', 12],
    ['ZERO', 0],
    ['NEGATIVE', -1],
  ] as const) {
    for (const count of [4, 5]) {
      const list = candidates(points[2], [
        parameter(
          'SO2',
          'ppm',
          samples(count).map((sample) => ({ ...sample, value })),
        ),
      ]);
      check(
        `abnormal-${type}-${count}`,
        `${type} ต่อเนื่อง ${count} ค่า (กำหนด 5)`,
        6,
        count === 5,
        list.some((item) => item.alert_type === 'ABNORMAL_VALUE' && item.abnormal_type === type),
      );
    }
  }
  const gaps = samples(6)
    .filter((_, hour) => hour !== 2)
    .map((sample) => ({ ...sample, value: 0 }));
  const calibration = samples(5).map((sample, hour) => ({
    ...sample,
    value: 0,
    status: hour === 2 ? 'Calibration' : 'Normal',
  }));
  for (const [id, readings] of [
    ['gap', gaps],
    ['calibration', calibration],
    ['normal', samples(24)],
  ] as const) {
    check(
      `abnormal-${id}`,
      `ไม่เตือนความผิดปกติเมื่อ ${id}`,
      6,
      false,
      candidates(points[2], [parameter('SO2', 'ppm', readings)]).some(
        (item) => item.alert_type === 'ABNORMAL_VALUE',
      ),
    );
  }

  const outbox = new MemoryOutbox(clock);
  const dependencies = {
    source: {
      listPoints: async () => points,
      listEvents: async ({
        cadence,
        startAt,
        endAt,
      }: {
        cadence: 'HOURLY' | 'DAILY';
        startAt: string;
        endAt: string;
      }) => {
        const date = new Date(Date.parse(startAt) + 7 * HOUR).toISOString().slice(0, 10);
        return events
          .map((item) => item.event)
          .filter((event) =>
            cadence === 'DAILY'
              ? !isHourly(event) && event.eventDate === date
              : isHourly(event) &&
                Date.parse(event.startedAt ?? '') >= Date.parse(startAt) &&
                Date.parse(event.endedAt ?? '') < Date.parse(endAt),
          );
      },
    },
    outbox,
    render: renderAlertEmail,
    prepareDaily: async (
      testPoint: AlertEmailPoint,
      date: string,
      policy: ActiveAlertEmailPolicy,
      at: Date,
    ) => {
      if (date !== REPORTING_DATE) return [];
      return buildDailyAlertCandidates({
        point: testPoint,
        parameters: registered.get(testPoint.id) ?? [],
        date,
        detectedAt: at.toISOString(),
        completenessPolicy: policy.completenessPolicy,
        exemptDayPolicy: policy.exemptDayPolicy,
        abnormalReadings: policy.abnormalReadings,
      }).map((candidate) =>
        addEvent(
          dailyDTO(candidate),
          JSON.parse(candidate.evidence_json ?? '{}') as Record<string, unknown>,
        ),
      );
    },
  };
  const eligible = (job: AlertEmailJob) =>
    isAlertEmailJobEligible(job, SIMULATION_POLICY, {
      events,
      points,
      hasActiveParameter: async (event) =>
        points.some(
          (item) =>
            item.factoryId === event.factoryId &&
            item.stationId === event.stationId &&
            (registered.get(item.id) ?? []).some(
              (param) =>
                param.code.toLowerCase() === event.parameterCode.toLowerCase() &&
                param.unit === event.unit,
            ),
        ),
    });
  let sendAttempts = 0;
  const trackedTransport: AlertEmailTransport = {
    send: async (input) => {
      sendAttempts += 1;
      return transport.send(input);
    },
  };
  const drain = async () => {
    for (let iteration = 0; iteration < 30; iteration += 1) {
      const result = await dispatchNextAlertEmail({
        repository: outbox,
        transport: trackedTransport,
        isRecipientEligible: eligible,
        now: clock,
      });
      if (!result.claimed) return;
    }
    throw new Error('Simulation dispatch exceeded its fixed limit');
  };
  const engine = createAlertEmailEngine(dependencies);
  let prepared = await engine.run(now, SIMULATION_POLICY);
  await drain();
  check(
    'daily-before-nine',
    'ก่อน 09:00 ยังไม่ส่งรายวันของวันที่ทดสอบ',
    null,
    { queued: 0, sends: 0 },
    { queued: prepared.queued, sends: sendAttempts },
  );
  now = new Date('2026-10-05T09:00:00+07:00');
  prepared = await engine.run(now, SIMULATION_POLICY);
  await drain();
  check(
    'daily-at-nine',
    '09:00 จัดคิวข้อ 3–6 ครบ 4 แบบ',
    null,
    { queued: 4, sends: 4, errors: 0 },
    { queued: prepared.queued, sends: sendAttempts, errors: prepared.errors },
  );
  now = new Date('2026-10-05T12:04:59+07:00');
  prepared = await engine.run(now, SIMULATION_POLICY);
  await drain();
  check(
    'hourly-before-due',
    'ก่อน 12:05 ยังไม่ส่งข้อมูลรอบ 11:00–11:59',
    null,
    { queued: 0, sends: 4 },
    { queued: prepared.queued, sends: sendAttempts },
  );
  now = new Date('2026-10-05T12:05:00+07:00');
  prepared = await engine.run(now, SIMULATION_POLICY);
  await drain();
  check(
    'hourly-at-due',
    '12:05 ส่งข้อ 1–2 หลังจบชั่วโมงและหน่วง 5 นาที',
    null,
    { queued: 2, sends: 6, errors: 0 },
    { queued: prepared.queued, sends: sendAttempts, errors: prepared.errors },
  );
  check(
    'smtp-six-cases',
    'อีเมลทั้ง 6 แบบได้รับการยอมรับครบทุก To/CC',
    null,
    6,
    outbox.deliveries.filter(
      (job) =>
        job.status === 'SMTP_ACCEPTED' &&
        job.acceptedRecipients.includes(job.recipient) &&
        job.acceptedRecipients.includes('diw.iemc@gmail.com'),
    ).length,
  );
  check(
    'mandatory-cc',
    'มี CC กล่องกลางทุกฉบับ',
    null,
    true,
    outbox.deliveries.every((job) => job.cc.includes('diw.iemc@gmail.com')),
  );
  check(
    'fixture-recipients',
    'ผู้รับมาจากเจ้าหน้าที่ประจำจุดตามนโยบายทดสอบ',
    null,
    [OFFICER],
    [...new Set(outbox.deliveries.map((job) => job.recipient))],
  );
  const initialMails = outbox.deliveries.map(emailEvidence);
  check(
    'parameter-unit-labels',
    'เนื้อหาอีเมลแสดงพารามิเตอร์พร้อมหน่วย',
    null,
    true,
    initialMails.every((mail) =>
      mail.text.includes(mail.caseNumber === 5 ? 'BOD (mg/l)' : 'SO2 (ppm)'),
    ),
  );
  const abnormalMail = initialMails.find((mail) => mail.caseNumber === 6);
  check(
    'abnormal-evidence-types',
    'อีเมลข้อ 6 มีหลักฐานค่านิ่ง ศูนย์ และติดลบครบ',
    6,
    true,
    ['ค่านิ่ง', 'ค่าเป็นศูนย์', 'ค่าติดลบ'].every((label) => abnormalMail?.text.includes(label)),
  );
  prepared = await engine.run(now, SIMULATION_POLICY);
  await drain();
  check(
    'repeat-no-duplicate',
    'รันซ้ำไม่สร้างคิวหรือส่งอีเมลเดิมซ้ำ',
    null,
    { queued: 0, sends: 6 },
    { queued: prepared.queued, sends: sendAttempts },
  );
  prepared = await createAlertEmailEngine(dependencies).run(now, SIMULATION_POLICY);
  await drain();
  check(
    'restart-no-duplicate',
    'สร้าง engine ใหม่โดยใช้คิวเดิมแล้วไม่ส่งซ้ำ',
    null,
    { queued: 0, sends: 6 },
    { queued: prepared.queued, sends: sendAttempts },
  );

  // A queue created before validation was tightened must be rechecked immediately before SMTP.
  const legacyOutbox = new MemoryOutbox(clock);
  const hourly = events.find((item) => item.event.alertType === 'STANDARD_EXCEEDED')!;
  const validValue = hourly.event.measuredValue;
  await legacyOutbox.enqueue({
    ...outbox.deliveries.find((job) => job.alertType === 'STANDARD_EXCEEDED')!,
    deduplicationKey: 'legacy-invalid-test',
  });
  hourly.event.measuredValue = 100;
  let legacySends = 0;
  const legacy = await dispatchNextAlertEmail({
    repository: legacyOutbox,
    isRecipientEligible: eligible,
    now: clock,
    transport: {
      send: async (input) => {
        legacySends += 1;
        return { accepted: [input.to, ...input.cc], rejected: [] };
      },
    },
  });
  hourly.event.measuredValue = validValue;
  check(
    'legacy-invalid-job',
    'คิวเก่าที่ค่าต่ำกว่าเกณฑ์ต้องถูกข้ามก่อน SMTP',
    null,
    { status: 'SKIPPED', sends: 0 },
    { status: legacy.status, sends: legacySends },
  );

  const template = outbox.deliveries[0];
  const retryOutbox = new MemoryOutbox(clock);
  await retryOutbox.enqueue({ ...template, deduplicationKey: 'smtp-retry-test' });
  const temporary = await dispatchNextAlertEmail({
    repository: retryOutbox,
    isRecipientEligible: eligible,
    now: clock,
    transport: {
      send: async () => {
        throw Object.assign(new Error('Synthetic temporary rejection'), { responseCode: 450 });
      },
    },
  });
  check(
    'smtp-temporary-retry',
    'SMTP 450 เก็บคิวรอลองใหม่',
    null,
    'RETRY_PENDING',
    temporary.status,
  );
  const earlyRetry = await dispatchNextAlertEmail({
    repository: retryOutbox,
    isRecipientEligible: eligible,
    now: clock,
    transport: { send: async (input) => ({ accepted: [input.to, ...input.cc], rejected: [] }) },
  });
  check('smtp-retry-not-early', 'ยังไม่ถึงเวลาลองใหม่ต้องไม่ส่ง', null, false, earlyRetry.claimed);
  now = new Date(now.getTime() + 60_000);
  const retried = await dispatchNextAlertEmail({
    repository: retryOutbox,
    isRecipientEligible: eligible,
    now: clock,
    transport: { send: async (input) => ({ accepted: [input.to, ...input.cc], rejected: [] }) },
  });
  check(
    'smtp-retry-at-due',
    'ถึงเวลาลองใหม่แล้วส่งได้',
    null,
    { status: 'SMTP_ACCEPTED', attempts: 2 },
    { status: retried.status, attempts: retryOutbox.deliveries[0].attempts },
  );
  const unknownOutbox = new MemoryOutbox(clock);
  await unknownOutbox.enqueue({ ...template, deduplicationKey: 'smtp-timeout-test' });
  const ambiguous = await dispatchNextAlertEmail({
    repository: unknownOutbox,
    isRecipientEligible: eligible,
    now: clock,
    transport: {
      send: async () => {
        throw new Error('Synthetic timeout after uncertain DATA outcome');
      },
    },
  });
  check(
    'smtp-unknown',
    'SMTP timeout ที่ไม่รู้ผลต้องเป็น UNKNOWN',
    null,
    'UNKNOWN',
    ambiguous.status,
  );
  now = new Date(now.getTime() + DAY);
  const unknownRetry = await dispatchNextAlertEmail({
    repository: unknownOutbox,
    isRecipientEligible: eligible,
    now: clock,
    transport: { send: async (input) => ({ accepted: [input.to, ...input.cc], rejected: [] }) },
  });
  check('smtp-unknown-no-replay', 'UNKNOWN ไม่ถูกลองส่งซ้ำเอง', null, false, unknownRetry.claimed);

  return {
    passed: checks.every((item) => item.passed),
    generatedAt: new Date().toISOString(),
    mode: 'IN_MEMORY_LOOPBACK_SMTP',
    policy: { ...SIMULATION_POLICY },
    checks,
    emails: initialMails,
    events: events.map((item) => ({ ...item.event })),
    limitations: [
      'ข้อ 1–2 ใช้ fixture เหตุการณ์ที่ผ่าน createIntegrationAlertEventSchema จริง ยังไม่พิสูจน์ตัวตรวจค่ารายชั่วโมงของระบบต้นทางหรือการเลือกเกณฑ์จากทะเบียนจริง',
      'ฐานข้อมูลและคิวเป็น in-memory adapter ไม่ได้ทดสอบ SQL Server, query ข้อมูลจริง, migration, transaction, multi-worker race หรือความคงทนข้าม process',
      'restart จำลองด้วยการสร้าง engine ใหม่โดยใช้ adapter เดิม ไม่ใช่ restart backend หรือฐานข้อมูลจริง',
      'SMTP sink รับเฉพาะในเครื่องและไม่ส่งต่อออกภายนอก จึงไม่พิสูจน์การเข้า inbox จริงหรือ SMTP production',
      'เลือก ON_TIME, RESET, เจ้าหน้าที่ประจำจุด, 5 ค่าผิดปกติ และหน่วง 5 นาทีเพื่อทดสอบเท่านั้น ยังไม่ใช่การยืนยันนโยบาย production',
    ],
  };
}

function point(id: number, systemType: 'CEMS' | 'WPMS', stationId: string): AlertEmailPoint {
  return {
    id,
    systemType,
    stationId,
    pointCode: stationId,
    pointName: systemType === 'CEMS' ? `ปล่องทดสอบ ${id}` : 'บ่อทดสอบ',
    pointType: systemType === 'CEMS' ? 'STACK' : 'WASTEWATER',
    factoryId: `QA_FACTORY_${systemType}`,
    factoryName: `โรงงานจำลอง ${systemType}`,
    factoryRegistrationNo: `QA-REG-${systemType}`,
    connectedAt: '2026-09-01T00:00:00+07:00',
    officerEmails: [OFFICER],
    factoryEmails: ['qa-factory@example.com'],
  };
}

function hourlyPayload(thresholdType: 'STANDARD' | 'EIA', measuredValue: number) {
  return {
    systemType: 'CEMS',
    stationId: 'QA_STACK',
    parameterCode: 'so2',
    unit: 'ppm',
    eventDate: '2026-10-05',
    time: '11:00',
    measuredValue,
    thresholdValue: 120,
    thresholdType,
  };
}

function hourlyDTO(
  input: ReturnType<typeof createIntegrationAlertEventSchema.parse>,
  testPoint: AlertEmailPoint,
): Omit<AlertEventDTO, 'id'> {
  return {
    ...emptyDTO(testPoint),
    idempotencyKey: input.idempotencyKey,
    alertType: input.alertType,
    parameterCode: input.parameterCode,
    parameterName: input.parameterName,
    parameterLabel: input.parameterLabel,
    unit: input.unit,
    eventDate: input.eventDate,
    eventDateText: input.eventDate,
    startedAt: input.startedAt,
    endedAt: input.endedAt,
    measuredValue: input.measuredValue,
    thresholdValue: input.thresholdValue,
    thresholdType: input.thresholdType,
    thresholdLabel: input.thresholdType,
    sourcePayload: input.sourcePayload,
    detectedAt: '2026-10-05T12:00:00+07:00',
  };
}

/** DTO mapping is a fixture adapter; the database repository and its date conversion are not exercised. */
function dailyDTO(candidate: DailyAlertCandidate): Omit<AlertEventDTO, 'id'> {
  return {
    ...emptyDTO(
      point(
        Number(candidate.connected_measurement_point_id),
        candidate.system_type,
        candidate.station_id,
      ),
    ),
    idempotencyKey: candidate.idempotency_key,
    alertType: candidate.alert_type,
    factoryId: candidate.factory_id,
    factoryName: candidate.factory_name,
    factoryRegistrationNo: candidate.factory_registration_no,
    pointCode: candidate.point_code,
    pointName: candidate.point_name,
    pointType: candidate.point_type,
    parameterCode: candidate.parameter_code,
    parameterName: candidate.parameter_name,
    parameterLabel: candidate.parameter_label,
    unit: candidate.unit,
    eventDate: String(candidate.event_date),
    eventDateText: String(candidate.event_date),
    startedAt: candidate.started_at === null ? null : String(candidate.started_at),
    endedAt: candidate.ended_at === null ? null : String(candidate.ended_at),
    measuredValue: numberOrNull(candidate.measured_value),
    completenessPercent: numberOrNull(candidate.completeness_percent),
    consecutiveDays: numberOrNull(candidate.consecutive_days),
    abnormalType: candidate.abnormal_type,
    abnormalStreakCount: numberOrNull(candidate.abnormal_streak_count),
    firstAbnormalAt:
      candidate.first_abnormal_at === null ? null : String(candidate.first_abnormal_at),
    confirmedAbnormalAt:
      candidate.confirmed_abnormal_at === null ? null : String(candidate.confirmed_abnormal_at),
    detectedAt: String(candidate.detected_at),
    notificationStatus: candidate.notification_status,
  };
}

function emptyDTO(testPoint: AlertEmailPoint): Omit<AlertEventDTO, 'id'> {
  return {
    idempotencyKey: '',
    alertType: 'DAILY_COMPLETENESS_LOW',
    systemType: testPoint.systemType,
    displaySystemType: testPoint.systemType === 'CEMS' ? 'CEMS' : 'BOD_COD_ONLINE',
    factoryId: testPoint.factoryId,
    factoryName: testPoint.factoryName,
    factoryRegistrationNo: testPoint.factoryRegistrationNo,
    stationId: testPoint.stationId,
    pointCode: testPoint.pointCode,
    pointName: testPoint.pointName,
    pointType: testPoint.pointType,
    parameterCode: '',
    parameterName: '',
    parameterLabel: '',
    unit: null,
    eventDate: REPORTING_DATE,
    eventDateText: REPORTING_DATE,
    timeRange: null,
    startedAt: null,
    endedAt: null,
    measuredValue: null,
    thresholdValue: null,
    thresholdType: null,
    thresholdLabel: null,
    completenessPercent: null,
    completenessPercentText: null,
    consecutiveDays: null,
    abnormalType: null,
    abnormalLabel: null,
    abnormalStreakCount: null,
    firstAbnormalAt: null,
    confirmedAbnormalAt: null,
    notificationStatus: 'AUTO',
    notificationStatusLabel: 'AUTO',
    sourcePayload: null,
    detectedAt: '2026-10-05T09:00:00+07:00',
  };
}

function parameter(
  code: string,
  unit: string,
  readings: AlertHourlySample[],
  dailySummaries: AlertDaySummary[] = [],
): DailyAlertParameter {
  return { code, name: code, unit, samples: readings, dailySummaries };
}

function samples(count: number, date = REPORTING_DATE): AlertHourlySample[] {
  const start = Date.parse(`${date}T00:00:00+07:00`);
  return Array.from({ length: count }, (_, hour) => ({
    measuredAt: new Date(start + hour * HOUR).toISOString(),
    reportedAt: new Date(start + hour * HOUR + 60_000).toISOString(),
    value: hour + 1,
    status: 'Normal',
  }));
}

function history(previousDayCount: number): AlertDaySummary[] {
  return Array.from({ length: previousDayCount }, (_, index) => {
    const date = new Date(Date.parse(`${REPORTING_DATE}T00:00:00Z`) - (index + 1) * DAY)
      .toISOString()
      .slice(0, 10);
    return summarizeAlertDay(date, samples(index % 2 === 0 ? 19 : 0, date), 'ON_TIME');
  });
}

function isHourly(event: AlertEventDTO) {
  return event.alertType === 'STANDARD_EXCEEDED' || event.alertType === 'EIA_EXCEEDED';
}
function numberOrNull(value: number | string | null) {
  return value === null ? null : Number(value);
}
function emailEvidence(job: AlertEmailDelivery): SimulationEmail {
  const caseNumber =
    job.alertType === 'STANDARD_EXCEEDED'
      ? 1
      : job.alertType === 'EIA_EXCEEDED'
        ? 2
        : job.alertType === 'DAILY_COMPLETENESS_LOW'
          ? 3
          : job.alertType === 'CONSECUTIVE_NO_REPORT'
            ? job.systemType === 'CEMS'
              ? 4
              : 5
            : 6;
  return {
    caseNumber,
    label: CASE_LABELS[caseNumber],
    deliveryId: job.id,
    eventIds: [...job.eventIds],
    to: job.recipient,
    cc: [...job.cc],
    scheduledAt: job.scheduledAt,
    status: job.status,
    messageId: job.messageId,
    acceptedRecipients: [...job.acceptedRecipients],
    rejectedRecipients: [...job.rejectedRecipients],
    subject: job.subject,
    text: job.text,
    html: job.html,
  };
}

function escapeHtml(value: unknown): string {
  return String(value).replace(
    /[&<>"']/g,
    (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!,
  );
}

export function renderSimulationReport(report: SimulationReport): string {
  const passed = report.checks.filter((item) => item.passed).length;
  return `<!doctype html><html lang="th"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>D-POMS · รายงานทดสอบแจ้งเตือน</title><style>
  :root{font-family:Tahoma,Arial,sans-serif;color:#17324f;background:#f2f6fa}body{margin:0}main{max-width:1100px;margin:auto;padding:32px 20px}h1{margin:8px 0;font-size:30px}p{line-height:1.8}header{padding:24px;background:#17324f;color:white;border-radius:12px}.status{display:inline-block;border-radius:30px;padding:8px 14px;font-weight:bold;background:${report.passed ? '#d1fae5;color:#065f46' : '#fee2e2;color:#991b1b'}}section{margin-top:28px}.card{background:white;border:1px solid #dae3ee;border-radius:10px;padding:20px;margin:16px 0}.meta{color:#526780;font-size:13px;line-height:1.9;overflow-wrap:anywhere}table{border-collapse:collapse;width:100%;background:white;font-size:13px}th,td{padding:12px;text-align:left;border-bottom:1px solid #e4eaf1;vertical-align:top}th{background:#e9f0f7}code{white-space:pre-wrap;overflow-wrap:anywhere}.pass{color:#067647}.fail{color:#b42318}iframe{width:100%;height:820px;border:0;background:#f2f6fa;margin-top:16px}summary{cursor:pointer;font-weight:bold}ul{line-height:1.8}@media(max-width:600px){main{padding:16px 10px}h1{font-size:24px}.card{padding:12px}th,td{padding:8px}iframe{height:1050px}}
  </style></head><body><main><header><div>D-POMS / TEST LAB</div><h1>รายงานทดสอบการแจ้งเตือน</h1><p>ใช้กฎ ตัวจัดคิว เทมเพลต และตัวส่งจริงกับข้อมูลจำลองในเครื่อง</p><span class="status">${report.passed ? 'PASS' : 'FAIL'} · ${passed}/${report.checks.length} checks</span></header>
  <section class="card"><h2>ขอบเขตการทดสอบ</h2><p>อีเมลถูกเก็บใน SMTP sink ที่ 127.0.0.1 ไม่มีการส่งต่อออกภายนอก ข้อมูลทั้งหมดเป็น fixture และไม่เชื่อมฐานข้อมูล production</p><ul>${report.limitations.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul><p class="meta">นโยบายทดสอบ: <code>${escapeHtml(JSON.stringify(report.policy))}</code><br>สร้างรายงาน ${escapeHtml(report.generatedAt)}</p></section>
  <section><h2>ผลตรวจรับ</h2><table><thead><tr><th>ผล</th><th>กรณี</th><th>คาดหวัง / พบจริง</th></tr></thead><tbody>${report.checks.map((item) => `<tr><td class="${item.passed ? 'pass' : 'fail'}">${item.passed ? 'PASS' : 'FAIL'}</td><td>${item.caseNumber ? `ข้อ ${item.caseNumber} · ` : ''}${escapeHtml(item.label)}</td><td><code>${escapeHtml(JSON.stringify(item.expected))}</code><br><code>${escapeHtml(JSON.stringify(item.actual))}</code></td></tr>`).join('')}</tbody></table></section>
  <section><h2>ตัวอย่างอีเมลครบ 6 แบบ</h2>${[...report.emails]
    .sort((a, b) => a.caseNumber - b.caseNumber)
    .map(
      (mail) =>
        `<details class="card" open><summary>ข้อ ${mail.caseNumber} · ${escapeHtml(mail.label)}</summary><p class="meta">To: ${escapeHtml(mail.to)}<br>CC: ${escapeHtml(mail.cc.join(', '))}<br>Delivery #${mail.deliveryId} · Event IDs: ${escapeHtml(mail.eventIds.join(', '))}<br>รอบส่ง: ${escapeHtml(mail.scheduledAt)} · ${escapeHtml(mail.status)}<br>Subject: ${escapeHtml(mail.subject)}</p><iframe title="ตัวอย่างอีเมลข้อ ${mail.caseNumber}" sandbox="" srcdoc="${escapeHtml(mail.html)}"></iframe></details>`,
    )
    .join('')}</section></main></body></html>`;
}
