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
          measuredValue: 125,
          thresholdValue: 120,
          thresholdType: 'STANDARD',
        } as AlertEventDTO,
        evidence: null as Record<string, unknown> | null,
      },
      {
        event: {
          id: 2,
          alertType: job.alertType,
          systemType: 'CEMS',
          factoryId: 'F2',
          stationId: 'S2',
          notificationStatus: 'AUTO',
          measuredValue: 125,
          thresholdValue: 120,
          thresholdType: 'STANDARD',
        } as AlertEventDTO,
        evidence: null as Record<string, unknown> | null,
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
  it.each([
    ['STANDARD_EXCEEDED' as const, 'STANDARD' as const],
    ['EIA_EXCEEDED' as const, 'EIA' as const],
  ])('requires true finite exceedances for every %s event', async (alertType, thresholdType) => {
    const hourlyJob = { ...job, alertType };
    const deps = dependencies();
    deps.events.forEach(({ event }) => {
      event.alertType = alertType;
      event.thresholdType = thresholdType;
    });
    expect(await isAlertEmailJobEligible(hourlyJob, policy, deps)).toBe(true);
    for (const measuredValue of [100, 120, null, NaN, Infinity, -Infinity]) {
      deps.events[1].event.measuredValue = measuredValue;
      expect(await isAlertEmailJobEligible(hourlyJob, policy, deps)).toBe(false);
    }
    deps.events[1].event.measuredValue = 125;
    for (const thresholdValue of [null, NaN, Infinity, -Infinity]) {
      deps.events[1].event.thresholdValue = thresholdValue;
      expect(await isAlertEmailJobEligible(hourlyJob, policy, deps)).toBe(false);
    }
    deps.events[1].event.thresholdValue = 120;
    deps.events[1].event.thresholdType = thresholdType === 'STANDARD' ? 'EIA' : 'STANDARD';
    expect(await isAlertEmailJobEligible(hourlyJob, policy, deps)).toBe(false);
  });
  it('does not allow hourly exceedances through a daily job with matching daily evidence', async () => {
    const deps = dependencies();
    deps.events.forEach((item) => {
      item.evidence = {
        completenessPolicy: policy.completenessPolicy,
        exemptDayPolicy: policy.exemptDayPolicy,
      };
    });
    expect(await isAlertEmailJobEligible({ ...job, cadence: 'DAILY' }, policy, deps)).toBe(false);
  });
  it('rejects daily events in hourly jobs but retains valid daily eligibility', async () => {
    const deps = dependencies();
    deps.events.forEach((item) => {
      item.event.alertType = 'DAILY_COMPLETENESS_LOW';
      item.event.measuredValue = null;
      item.event.thresholdValue = null;
      item.event.thresholdType = null;
      item.evidence = {
        completenessPolicy: policy.completenessPolicy,
        exemptDayPolicy: policy.exemptDayPolicy,
      };
    });
    const dailyJob = {
      ...job,
      alertType: 'DAILY_COMPLETENESS_LOW',
      cadence: 'DAILY',
    } as AlertEmailJob;
    expect(await isAlertEmailJobEligible(dailyJob, policy, deps)).toBe(true);
    expect(await isAlertEmailJobEligible({ ...dailyJob, cadence: 'HOURLY' }, policy, deps)).toBe(
      false,
    );
  });
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
