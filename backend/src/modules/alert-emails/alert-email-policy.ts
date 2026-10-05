import { z } from 'zod';

const integerSetting = (minimum: number, maximum: number) =>
  z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().min(minimum).max(maximum));

const activePolicySchema = z.object({
  ALERT_EMAIL_RECIPIENT_MODE: z.enum(['POINT_OFFICERS', 'POINT_OFFICERS_AND_FACTORY']),
  ALERT_EMAIL_COMPLETENESS_POLICY: z.enum(['ON_TIME', 'NORMAL_EXCLUDING_SHUTDOWN']),
  ALERT_EMAIL_EXEMPT_DAY_POLICY: z.enum(['RESET', 'PAUSE']),
  ALERT_EMAIL_DAILY_FORMAT: z.literal('BY_TYPE'),
  ALERT_EMAIL_ABNORMAL_MODE: z.literal('PREVIOUS_DAY'),
  ALERT_EMAIL_ABNORMAL_READINGS: integerSetting(2, 168),
  ALERT_EMAIL_HOURLY_DELAY_MINUTES: integerSetting(0, 59),
});

export interface ActiveAlertEmailPolicy {
  enabled: true;
  recipientMode: 'POINT_OFFICERS' | 'POINT_OFFICERS_AND_FACTORY';
  completenessPolicy: 'ON_TIME' | 'NORMAL_EXCLUDING_SHUTDOWN';
  exemptDayPolicy: 'RESET' | 'PAUSE';
  dailyFormat: 'BY_TYPE';
  abnormalMode: 'PREVIOUS_DAY';
  abnormalReadings: number;
  hourlyDelayMinutes: number;
}

export type AlertEmailPolicy = { enabled: false } | ActiveAlertEmailPolicy;

/** Deployment alone never activates email. All unresolved business choices are explicit. */
export function readAlertEmailPolicy(settings: NodeJS.ProcessEnv): AlertEmailPolicy {
  const flag = z.enum(['true', 'false']).default('false').parse(settings.ALERT_EMAIL_ENABLED);
  if (flag === 'false') return { enabled: false };
  const value = activePolicySchema.parse(settings);
  return {
    enabled: true,
    recipientMode: value.ALERT_EMAIL_RECIPIENT_MODE,
    completenessPolicy: value.ALERT_EMAIL_COMPLETENESS_POLICY,
    exemptDayPolicy: value.ALERT_EMAIL_EXEMPT_DAY_POLICY,
    dailyFormat: value.ALERT_EMAIL_DAILY_FORMAT,
    abnormalMode: value.ALERT_EMAIL_ABNORMAL_MODE,
    abnormalReadings: value.ALERT_EMAIL_ABNORMAL_READINGS,
    hourlyDelayMinutes: value.ALERT_EMAIL_HOURLY_DELAY_MINUTES,
  };
}
