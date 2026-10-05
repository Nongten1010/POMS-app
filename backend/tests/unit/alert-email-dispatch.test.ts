import { describe, expect, it, jest } from '@jest/globals';
import type { AlertEmailTransportResult } from '../../src/modules/alert-emails/alert-email-dispatch';
import type { AlertEmailJob } from '../../src/modules/alert-emails/alert-email-outbox.repository';
import { isAlertEmailJobEligible } from '../../src/modules/alert-emails/alert-email-eligibility';
import type { AlertEventDTO } from '../../src/modules/alert-events/alert-events.types';
import type { AlertEmailPoint } from '../../src/modules/alert-emails/alert-email-source.repository';
import type { ActiveAlertEmailPolicy } from '../../src/modules/alert-emails/alert-email-policy';

const now = new Date('2026-10-05T02:00:00.000Z');
const recipient = 'officer@example.com';
const cc = 'diw.iemc@gmail.com';

function fixture(attempts = 1) {
  const job: AlertEmailJob = {
    id: 11,
    batchId: 7,
    deduplicationKey: 'daily:2026-10-04:officer:3',
    cadence: 'DAILY',
    alertType: 'DAILY_COMPLETENESS_LOW',
    systemType: 'CEMS',
    scheduledAt: now.toISOString(),
    periodStart: '2026-10-03T17:00:00.000Z',
    periodEnd: '2026-10-04T17:00:00.000Z',
    recipient,
    cc: [cc],
    subject: 'รายงานไม่ครบ',
    text: 'โรงงานตัวอย่าง',
    html: '<p>โรงงานตัวอย่าง</p>',
    eventIds: [1, 2],
    attempts,
    leaseToken: 'lease-123',
    status: 'PROCESSING',
    leasedUntil: '2026-10-05T02:02:00.000Z',
    nextAttemptAt: null,
    messageId: null,
    errorCode: null,
    acceptedRecipients: [],
    rejectedRecipients: [],
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    completedAt: null,
  };
  const repository = {
    claim: jest.fn(async (_now: Date, _leaseSeconds?: number) => job),
    renewLease: jest.fn(
      async (_id: number, _token: string, _now: Date, _leaseSeconds?: number) => true,
    ),
    complete: jest.fn(async (_id: number, _token: string, _outcome: unknown) => true),
  };
  const transport = {
    send: jest.fn(
      async (_input: unknown): Promise<AlertEmailTransportResult> => ({
        messageId: 'message-123',
        accepted: [recipient, cc],
        rejected: [],
      }),
    ),
  };
  const isRecipientEligible = jest.fn(async (_job: unknown) => true);
  return { job, repository, transport, isRecipientEligible, now: () => now };
}

// Runtime RED: the new behavior is exercised even before its production module exists.
function dispatch(input: ReturnType<typeof fixture>): Promise<{
  claimed: boolean;
  status?: string;
  persisted?: boolean;
}> {
  return jest
    .requireActual<
      typeof import('../../src/modules/alert-emails/alert-email-dispatch')
    >('../../src/modules/alert-emails/alert-email-dispatch')
    .dispatchNextAlertEmail(input);
}

describe('alert email dispatch', () => {
  it.each([
    ['STANDARD_EXCEEDED' as const, 'STANDARD' as const, 100, 'SKIPPED'],
    ['STANDARD_EXCEEDED' as const, 'STANDARD' as const, 120, 'SKIPPED'],
    ['EIA_EXCEEDED' as const, 'EIA' as const, 100, 'SKIPPED'],
    ['EIA_EXCEEDED' as const, 'EIA' as const, 120, 'SKIPPED'],
    ['STANDARD_EXCEEDED' as const, 'STANDARD' as const, null, 'SKIPPED'],
    ['EIA_EXCEEDED' as const, 'EIA' as const, Infinity, 'SKIPPED'],
    ['STANDARD_EXCEEDED' as const, 'STANDARD' as const, 125, 'SMTP_ACCEPTED'],
    ['EIA_EXCEEDED' as const, 'EIA' as const, 125, 'SMTP_ACCEPTED'],
  ])(
    'checks an immutable %s/%s batch with measuredValue %s and records %s',
    async (alertType, thresholdType, measuredValue, expectedStatus) => {
      const input = fixture();
      input.job.alertType = alertType;
      input.job.cadence = 'HOURLY';
      const events = [125, measuredValue].map((value, index) => ({
        event: {
          id: index + 1,
          alertType,
          systemType: 'CEMS',
          factoryId: 'F1',
          stationId: 'S1',
          notificationStatus: 'AUTO',
          thresholdType,
          measuredValue: value,
          thresholdValue: 120,
        } as AlertEventDTO,
        evidence: null,
      }));
      const policy = { enabled: true, recipientMode: 'POINT_OFFICERS' } as ActiveAlertEmailPolicy;
      const points = [
        {
          id: 1,
          factoryId: 'F1',
          stationId: 'S1',
          systemType: 'CEMS',
          officerEmails: [recipient],
          factoryEmails: [],
        },
      ] as unknown as AlertEmailPoint[];
      input.isRecipientEligible.mockImplementation(async (job) =>
        isAlertEmailJobEligible(job as AlertEmailJob, policy, {
          events,
          points,
          hasActiveParameter: async () => true,
        }),
      );
      expect(await dispatch(input)).toEqual(
        expect.objectContaining({ status: expectedStatus, persisted: true }),
      );
      expect(input.transport.send).toHaveBeenCalledTimes(expectedStatus === 'SKIPPED' ? 0 : 1);
      expect(input.repository.renewLease).toHaveBeenCalledTimes(
        expectedStatus === 'SKIPPED' ? 0 : 1,
      );
      expect(input.repository.complete).toHaveBeenCalledWith(
        11,
        'lease-123',
        expect.objectContaining({ status: expectedStatus, nextAttemptAt: null }),
      );
    },
  );
  it('sends the frozen TO and CC envelope and records SMTP acceptance rather than delivered', async () => {
    const input = fixture();
    const result = await dispatch(input);
    expect(input.transport.send).toHaveBeenCalledWith({
      to: recipient,
      cc: [cc],
      subject: input.job.subject,
      text: input.job.text,
      html: input.job.html,
    });
    expect(input.repository.complete).toHaveBeenCalledWith(
      11,
      'lease-123',
      expect.objectContaining({
        status: 'SMTP_ACCEPTED',
        acceptedRecipients: [recipient, cc],
        rejectedRecipients: [],
        messageId: 'message-123',
      }),
    );
    expect(result).toEqual({
      claimed: true,
      deliveryId: 11,
      status: 'SMTP_ACCEPTED',
      persisted: true,
    });
  });

  it('does not send when no item was claimed', async () => {
    const input = fixture();
    input.repository.claim.mockResolvedValue(null as never);
    expect(await dispatch(input)).toEqual({ claimed: false });
    expect(input.transport.send).not.toHaveBeenCalled();
  });

  it('fails closed if the frozen envelope lost its mandatory central CC', async () => {
    const input = fixture();
    input.job.cc = [];
    expect(await dispatch(input)).toEqual(expect.objectContaining({ status: 'FAILED' }));
    expect(input.transport.send).not.toHaveBeenCalled();
    expect(input.repository.complete).toHaveBeenCalledWith(
      11,
      'lease-123',
      expect.objectContaining({ errorCode: 'MANDATORY_CC_MISSING' }),
    );
  });

  it('rechecks recipient eligibility and skips the entire frozen batch after a scope change', async () => {
    const input = fixture();
    input.isRecipientEligible.mockResolvedValue(false);
    expect(await dispatch(input)).toEqual(expect.objectContaining({ status: 'SKIPPED' }));
    expect(input.transport.send).not.toHaveBeenCalled();
    expect(input.isRecipientEligible).toHaveBeenCalledWith(input.job);
  });

  it('does not send after losing its lease', async () => {
    const input = fixture();
    input.repository.renewLease.mockResolvedValue(false);
    expect(await dispatch(input)).toEqual(
      expect.objectContaining({ status: 'UNKNOWN', persisted: false }),
    );
    expect(input.transport.send).not.toHaveBeenCalled();
  });

  it('records partial recipient acceptance without replaying the already accepted central CC', async () => {
    const input = fixture();
    input.transport.send.mockResolvedValue({
      messageId: 'partial',
      accepted: [cc],
      rejected: [recipient],
    });
    expect(await dispatch(input)).toEqual(expect.objectContaining({ status: 'FAILED' }));
    expect(input.repository.complete).toHaveBeenCalledWith(
      11,
      'lease-123',
      expect.objectContaining({
        status: 'FAILED',
        errorCode: 'SMTP_PARTIAL_ACCEPTANCE',
        acceptedRecipients: [cc],
        rejectedRecipients: [recipient],
        nextAttemptAt: null,
      }),
    );
    expect(input.transport.send).toHaveBeenCalledTimes(1);
  });

  it('retries a definite temporary SMTP rejection using capped exponential backoff', async () => {
    const input = fixture(2);
    input.transport.send.mockRejectedValue({
      responseCode: 451,
      command: 'DATA',
      message: 'do not persist SMTP credentials or an email address',
    });
    expect(await dispatch(input)).toEqual(expect.objectContaining({ status: 'RETRY_PENDING' }));
    expect(input.repository.complete).toHaveBeenCalledWith(
      11,
      'lease-123',
      expect.objectContaining({
        errorCode: 'SMTP_TEMPORARY_REJECTION',
        nextAttemptAt: '2026-10-05T02:02:00.000Z',
      }),
    );
    expect(JSON.stringify(input.repository.complete.mock.calls)).not.toContain('credentials');
  });

  it('fails on the fifth definite temporary SMTP rejection', async () => {
    const input = fixture(5);
    input.transport.send.mockRejectedValue({ responseCode: 421 });
    expect(await dispatch(input)).toEqual(expect.objectContaining({ status: 'FAILED' }));
  });

  it('does not retry permanent SMTP rejection', async () => {
    const input = fixture();
    input.transport.send.mockRejectedValue({ responseCode: 550 });
    expect(await dispatch(input)).toEqual(expect.objectContaining({ status: 'FAILED' }));
  });

  it('keeps timeout outcomes UNKNOWN because the SMTP server may already have accepted the message', async () => {
    const input = fixture();
    input.transport.send.mockRejectedValue({ code: 'ETIMEDOUT', message: 'smtp secret' });
    expect(await dispatch(input)).toEqual(expect.objectContaining({ status: 'UNKNOWN' }));
    expect(input.repository.complete).toHaveBeenCalledWith(
      11,
      'lease-123',
      expect.objectContaining({ errorCode: 'SMTP_OUTCOME_UNKNOWN', nextAttemptAt: null }),
    );
  });

  it('does not treat an unreported envelope outcome as acceptance', async () => {
    const input = fixture();
    input.transport.send.mockResolvedValue({ messageId: 'unreported' });
    expect(await dispatch(input)).toEqual(expect.objectContaining({ status: 'UNKNOWN' }));
  });

  it('records an error carrying accepted recipients as partial and never auto-retries it', async () => {
    const input = fixture();
    input.transport.send.mockRejectedValue({
      responseCode: 450,
      accepted: [cc],
      rejected: [recipient],
    });
    expect(await dispatch(input)).toEqual(expect.objectContaining({ status: 'FAILED' }));
  });

  it('safe-retries an eligibility lookup failure without invoking SMTP', async () => {
    const input = fixture();
    input.isRecipientEligible.mockRejectedValue(new Error('internal lookup details'));
    expect(await dispatch(input)).toEqual(expect.objectContaining({ status: 'RETRY_PENDING' }));
    expect(input.transport.send).not.toHaveBeenCalled();
    expect(input.repository.complete).toHaveBeenCalledWith(
      11,
      'lease-123',
      expect.objectContaining({ errorCode: 'RECIPIENT_CHECK_FAILED' }),
    );
  });

  it('reports a lost completion lease as UNKNOWN without sending again', async () => {
    const input = fixture();
    input.repository.complete.mockResolvedValue(false);
    expect(await dispatch(input)).toEqual(
      expect.objectContaining({ status: 'UNKNOWN', persisted: false }),
    );
    expect(input.transport.send).toHaveBeenCalledTimes(1);
  });

  it('leaves a database completion failure for lease-expiry review instead of reclassifying SMTP acceptance', async () => {
    const input = fixture();
    input.repository.complete.mockRejectedValue(new Error('database unavailable'));
    await expect(dispatch(input)).rejects.toThrow('database unavailable');
    expect(input.repository.complete).toHaveBeenCalledTimes(1);
    expect(input.transport.send).toHaveBeenCalledTimes(1);
  });
});
