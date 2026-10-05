import { describe, expect, it, jest } from '@jest/globals';
import { isAlertEmailJobEligible } from '../../src/modules/alert-emails/alert-email-eligibility';
import type { AlertEmailJob } from '../../src/modules/alert-emails/alert-email-outbox.repository';
import type { AlertEventDTO } from '../../src/modules/alert-events/alert-events.types';
import type { AlertEmailPoint } from '../../src/modules/alert-emails/alert-email-source.repository';
import type { ActiveAlertEmailPolicy } from '../../src/modules/alert-emails/alert-email-policy';
const policy = {
  enabled: true,
  recipientMode: 'POINT_OFFICERS',
  completenessPolicy: 'ON_TIME',
  exemptDayPolicy: 'RESET',
  abnormalReadings: 5,
} as ActiveAlertEmailPolicy;
const job = {
  eventIds: [1, 2],
  recipient: 'officer@example.com',
  alertType: 'STANDARD_EXCEEDED',
  systemType: null,
  cadence: 'HOURLY',
} as AlertEmailJob;
function dependencies() {
  return {
    events: [
      {
        event: {
          id: 1,
          alertType: job.alertType,
          systemType: 'CEMS',
          factoryId: 'F1',
          stationId: 'S1',
          notificationStatus: 'AUTO',
        } as AlertEventDTO,
        evidence: null,
      },
      {
        event: {
          id: 2,
          alertType: job.alertType,
          systemType: 'CEMS',
          factoryId: 'F2',
          stationId: 'S2',
          notificationStatus: 'AUTO',
        } as AlertEventDTO,
        evidence: null,
      },
    ],
    points: [
      {
        id: 1,
        factoryId: 'F1',
        stationId: 'S1',
        systemType: 'CEMS',
        officerEmails: ['officer@example.com'],
        factoryEmails: [],
      },
      {
        id: 2,
        factoryId: 'F2',
        stationId: 'S2',
        systemType: 'CEMS',
        officerEmails: ['officer@example.com'],
        factoryEmails: [],
      },
    ] as unknown as AlertEmailPoint[],
    hasActiveParameter: jest
      .fn<(event: AlertEventDTO) => Promise<boolean>>()
      .mockResolvedValue(true),
  };
}
describe('recipient eligibility immediately before SMTP', () => {
  it('requires current recipient ownership for every event in the frozen batch', async () => {
    const deps = dependencies();
    expect(await isAlertEmailJobEligible(job, policy, deps)).toBe(true);
    deps.points[1].officerEmails = [];
    expect(await isAlertEmailJobEligible(job, policy, deps)).toBe(false);
  });
  it('rejects deleted/missing events, dismissed events, and inactive parameters', async () => {
    const deps = dependencies();
    deps.events.pop();
    expect(await isAlertEmailJobEligible(job, policy, deps)).toBe(false);
    const dismissed = dependencies();
    dismissed.events[0].event.notificationStatus = 'DISMISSED';
    expect(await isAlertEmailJobEligible(job, policy, dismissed)).toBe(false);
    const inactive = dependencies();
    inactive.hasActiveParameter.mockResolvedValue(false);
    expect(await isAlertEmailJobEligible(job, policy, inactive)).toBe(false);
  });
  it('rejects daily evidence generated under a different active business policy', async () => {
    const deps = dependencies();
    const dailyJob = {
      ...job,
      cadence: 'DAILY',
      alertType: 'DAILY_COMPLETENESS_LOW',
    } as AlertEmailJob;
    deps.events.forEach((item) => {
      item.event.alertType = 'DAILY_COMPLETENESS_LOW';
    });
    expect(await isAlertEmailJobEligible(dailyJob, policy, deps)).toBe(false);
  });
});
