import type {
  AlertEmailCompletion,
  AlertEmailDeliveryStatus,
  AlertEmailJob,
  AlertEmailOutboxRepository,
} from './alert-email-outbox.repository';
import { MANDATORY_EMAIL_CC } from '../../shared/services/email-policy';

export interface AlertEmailTransportResult {
  messageId?: string;
  accepted?: string[];
  rejected?: string[];
}

export interface AlertEmailTransport {
  send(input: {
    to: string;
    cc: string[];
    subject: string;
    text: string;
    html: string;
  }): Promise<AlertEmailTransportResult>;
}

export interface AlertEmailDispatchDependencies {
  repository: Pick<AlertEmailOutboxRepository, 'claim' | 'renewLease' | 'complete'>;
  transport: AlertEmailTransport;
  isRecipientEligible(job: AlertEmailJob): Promise<boolean>;
  now?: () => Date;
  leaseSeconds?: number;
}

export interface AlertEmailDispatchResult {
  claimed: boolean;
  deliveryId?: number;
  status?: AlertEmailDeliveryStatus;
  persisted?: boolean;
}

export async function dispatchNextAlertEmail(
  dependencies: AlertEmailDispatchDependencies,
): Promise<AlertEmailDispatchResult> {
  const clock = dependencies.now ?? (() => new Date());
  const leaseSeconds = dependencies.leaseSeconds ?? 120;
  const job = await dependencies.repository.claim(clock(), leaseSeconds);
  if (!job) return { claimed: false };
  if (!job.cc.some((recipient) => recipient.trim().toLowerCase() === MANDATORY_EMAIL_CC)) {
    return persist(dependencies, job, completion('FAILED', clock(), 'MANDATORY_CC_MISSING'));
  }

  let eligible: boolean;
  try {
    eligible = await dependencies.isRecipientEligible(job);
  } catch {
    return persist(dependencies, job, retryOrFail(job, clock(), 'RECIPIENT_CHECK_FAILED'));
  }
  if (!eligible)
    return persist(dependencies, job, completion('SKIPPED', clock(), 'RECIPIENT_SCOPE_CHANGED'));

  const renewed = await dependencies.repository.renewLease(
    job.id,
    job.leaseToken,
    clock(),
    leaseSeconds,
  );
  if (!renewed) return { claimed: true, deliveryId: job.id, status: 'UNKNOWN', persisted: false };

  let outcome: AlertEmailCompletion;
  try {
    const result = await dependencies.transport.send({
      to: job.recipient,
      cc: job.cc,
      subject: job.subject,
      text: job.text,
      html: job.html,
    });
    outcome = smtpResult(result, job, clock());
  } catch (error) {
    outcome = smtpError(error, job, clock());
  }
  // A database failure after SMTP must leave the lease for UNKNOWN recovery, not trigger another send.
  return persist(dependencies, job, outcome);
}

async function persist(
  dependencies: AlertEmailDispatchDependencies,
  job: AlertEmailJob,
  outcome: AlertEmailCompletion,
): Promise<AlertEmailDispatchResult> {
  const persisted = await dependencies.repository.complete(job.id, job.leaseToken, outcome);
  return {
    claimed: true,
    deliveryId: job.id,
    status: persisted ? outcome.status : 'UNKNOWN',
    persisted,
  };
}

function completion(
  status: AlertEmailCompletion['status'],
  now: Date,
  errorCode: string | null = null,
): AlertEmailCompletion {
  return {
    status,
    completedAt: now.toISOString(),
    nextAttemptAt: null,
    messageId: null,
    acceptedRecipients: [],
    rejectedRecipients: [],
    errorCode,
  };
}

function retryOrFail(job: AlertEmailJob, now: Date, errorCode: string): AlertEmailCompletion {
  const outcome = completion(job.attempts >= 5 ? 'FAILED' : 'RETRY_PENDING', now, errorCode);
  if (outcome.status === 'RETRY_PENDING') {
    const delayMs = Math.min(60_000 * 2 ** Math.max(job.attempts - 1, 0), 900_000);
    outcome.nextAttemptAt = new Date(now.getTime() + delayMs).toISOString();
  }
  return outcome;
}

function normalizeAddresses(value: unknown, envelope: string[]): string[] {
  if (!Array.isArray(value)) return [];
  const allowed = new Set(envelope.map((item) => item.trim().toLowerCase()));
  return [
    ...new Set(
      value
        .filter((item): item is string => typeof item === 'string')
        .map((item) => item.trim().toLowerCase())
        .filter((item) => allowed.has(item)),
    ),
  ];
}

function smtpResult(
  result: AlertEmailTransportResult,
  job: AlertEmailJob,
  now: Date,
): AlertEmailCompletion {
  const envelope = [
    ...new Set([job.recipient, ...job.cc].map((item) => item.trim().toLowerCase())),
  ];
  const accepted = normalizeAddresses(result.accepted, envelope);
  const rejected = normalizeAddresses(result.rejected, envelope);
  const allAccepted = envelope.every((item) => accepted.includes(item)) && rejected.length === 0;
  const status = allAccepted ? 'SMTP_ACCEPTED' : accepted.length > 0 ? 'FAILED' : 'UNKNOWN';
  const outcome = completion(
    status,
    now,
    allAccepted ? null : accepted.length > 0 ? 'SMTP_PARTIAL_ACCEPTANCE' : 'SMTP_OUTCOME_UNKNOWN',
  );
  outcome.messageId = typeof result.messageId === 'string' ? result.messageId.slice(0, 500) : null;
  outcome.acceptedRecipients = accepted;
  outcome.rejectedRecipients = rejected;
  return outcome;
}

function smtpError(error: unknown, job: AlertEmailJob, now: Date): AlertEmailCompletion {
  const record = error && typeof error === 'object' ? (error as Record<string, unknown>) : {};
  const accepted = normalizeAddresses(record.accepted, [job.recipient, ...job.cc]);
  if (accepted.length > 0) {
    const outcome = completion('FAILED', now, 'SMTP_PARTIAL_ACCEPTANCE');
    outcome.acceptedRecipients = accepted;
    outcome.rejectedRecipients = normalizeAddresses(record.rejected, [job.recipient, ...job.cc]);
    return outcome;
  }
  const responseCode = typeof record.responseCode === 'number' ? record.responseCode : null;
  if (responseCode !== null && responseCode >= 400 && responseCode <= 499)
    return retryOrFail(job, now, 'SMTP_TEMPORARY_REJECTION');
  if (responseCode !== null && responseCode >= 500 && responseCode <= 599)
    return completion('FAILED', now, 'SMTP_PERMANENT_REJECTION');
  // A timeout/network exception may occur after DATA was accepted. Never blindly retry it.
  return completion('UNKNOWN', now, 'SMTP_OUTCOME_UNKNOWN');
}
