import { describe, expect, it } from '@jest/globals';
import { readAlertEmailPolicy } from '../../src/modules/alert-emails/alert-email-policy';

const configured = {
  ALERT_EMAIL_ENABLED: 'true',
  ALERT_EMAIL_RECIPIENT_MODE: 'POINT_OFFICERS_AND_FACTORY',
  ALERT_EMAIL_COMPLETENESS_POLICY: 'ON_TIME',
  ALERT_EMAIL_EXEMPT_DAY_POLICY: 'RESET',
  ALERT_EMAIL_DAILY_FORMAT: 'BY_TYPE',
  ALERT_EMAIL_ABNORMAL_MODE: 'PREVIOUS_DAY',
  ALERT_EMAIL_ABNORMAL_READINGS: '5',
  ALERT_EMAIL_HOURLY_DELAY_MINUTES: '5',
};

describe('alert email activation policy', () => {
  it('does not enable automatic mail by merely deploying the code', () => {
    expect(readAlertEmailPolicy({})).toEqual({ enabled: false });
    expect(readAlertEmailPolicy({ ALERT_EMAIL_ENABLED: 'false' })).toEqual({ enabled: false });
  });
  it('requires explicit business policies when automatic mail is enabled', () => {
    expect(() => readAlertEmailPolicy({ ALERT_EMAIL_ENABLED: 'true' })).toThrow();
  });
  it('reads a complete explicit policy without inferring recipients from user roles', () => {
    expect(readAlertEmailPolicy(configured)).toMatchObject({
      enabled: true,
      recipientMode: 'POINT_OFFICERS_AND_FACTORY',
      completenessPolicy: 'ON_TIME',
      exemptDayPolicy: 'RESET',
      abnormalReadings: 5,
      hourlyDelayMinutes: 5,
    });
  });
  it('rejects misspelled activation flags, unknown policies and fractional limits', () => {
    expect(() => readAlertEmailPolicy({ ALERT_EMAIL_ENABLED: 'TRUEE' })).toThrow();
    expect(() =>
      readAlertEmailPolicy({ ...configured, ALERT_EMAIL_RECIPIENT_MODE: 'ALL_USERS' }),
    ).toThrow();
    expect(() =>
      readAlertEmailPolicy({ ...configured, ALERT_EMAIL_ABNORMAL_READINGS: '4.5' }),
    ).toThrow();
    expect(() =>
      readAlertEmailPolicy({ ...configured, ALERT_EMAIL_HOURLY_DELAY_MINUTES: '60' }),
    ).toThrow();
  });
});
