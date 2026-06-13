export const ALERT_EVENT_ALERT_TYPES = [
  'STANDARD_EXCEEDED',
  'EIA_EXCEEDED',
  'DAILY_COMPLETENESS_LOW',
  'CONSECUTIVE_NO_REPORT',
  'ABNORMAL_VALUE',
] as const;

export const INTEGRATION_ALERT_EVENT_ALERT_TYPES = ['STANDARD_EXCEEDED', 'EIA_EXCEEDED'] as const;

export const ALERT_EVENT_SYSTEM_TYPES = ['CEMS', 'WPMS'] as const;
export const ALERT_EVENT_DISPLAY_SYSTEM_TYPES = ['CEMS', 'BOD_COD_ONLINE'] as const;
export const ALERT_EVENT_THRESHOLD_TYPES = ['STANDARD', 'EIA'] as const;
export const ALERT_EVENT_NOTIFICATION_STATUSES = [
  'AUTO',
  'OFFICER',
  'ACKNOWLEDGED',
  'DISMISSED',
] as const;
export const ALERT_EVENT_POINT_TYPES = ['STACK', 'WASTEWATER', 'OTHER'] as const;
export const ALERT_EVENT_ABNORMAL_TYPES = ['CONSTANT', 'ZERO', 'NEGATIVE'] as const;

export type AlertEventAlertType = (typeof ALERT_EVENT_ALERT_TYPES)[number];
export type IntegrationAlertEventAlertType = (typeof INTEGRATION_ALERT_EVENT_ALERT_TYPES)[number];
export type AlertEventSystemType = (typeof ALERT_EVENT_SYSTEM_TYPES)[number];
export type AlertEventDisplaySystemType = (typeof ALERT_EVENT_DISPLAY_SYSTEM_TYPES)[number];
export type AlertEventThresholdType = (typeof ALERT_EVENT_THRESHOLD_TYPES)[number];
export type AlertEventNotificationStatus = (typeof ALERT_EVENT_NOTIFICATION_STATUSES)[number];
export type AlertEventPointType = (typeof ALERT_EVENT_POINT_TYPES)[number];
export type AlertEventAbnormalType = (typeof ALERT_EVENT_ABNORMAL_TYPES)[number];

export interface CreateIntegrationAlertEventInput {
  idempotencyKey: string;
  systemType: AlertEventSystemType;
  displaySystemType: AlertEventDisplaySystemType;
  alertType: IntegrationAlertEventAlertType;
  factoryId?: string | null;
  factoryName?: string | null;
  factoryRegistrationNo?: string | null;
  stationId: string;
  pointCode?: string | null;
  pointName: string;
  pointType?: AlertEventPointType | null;
  parameterCode: string;
  parameterName: string;
  parameterLabel: string;
  unit: string;
  eventDate: string;
  startedAt: string;
  endedAt: string;
  measuredValue: number;
  thresholdValue: number;
  thresholdType: AlertEventThresholdType;
  notificationStatus?: AlertEventNotificationStatus;
  sourcePayload?: Record<string, unknown>;
}

export interface ListAlertEventsQuery {
  systemType?: AlertEventSystemType;
  displaySystemType?: AlertEventDisplaySystemType;
  alertType?: AlertEventAlertType;
  thresholdType?: AlertEventThresholdType;
  factoryId?: string;
  stationId?: string;
  parameterCode?: string;
  dateFrom?: string;
  dateTo?: string;
  page: number;
  pageSize: number;
}

export interface UpdateAlertEventStatusInput {
  notificationStatus: AlertEventNotificationStatus;
  note?: string;
}

export interface AlertEventDTO {
  id: number;
  idempotencyKey: string;
  alertType: AlertEventAlertType;
  systemType: AlertEventSystemType;
  displaySystemType: AlertEventDisplaySystemType;
  factoryId: string | null;
  factoryName: string;
  factoryRegistrationNo: string | null;
  stationId: string;
  pointCode: string | null;
  pointName: string;
  pointType: AlertEventPointType | null;
  parameterCode: string;
  parameterName: string;
  parameterLabel: string;
  unit: string | null;
  eventDate: string;
  eventDateText: string;
  timeRange: string | null;
  startedAt: string | null;
  endedAt: string | null;
  measuredValue: number | null;
  thresholdValue: number | null;
  thresholdType: AlertEventThresholdType | null;
  thresholdLabel: string | null;
  completenessPercent: number | null;
  completenessPercentText: string | null;
  consecutiveDays: number | null;
  abnormalType: AlertEventAbnormalType | null;
  abnormalLabel: string | null;
  abnormalStreakCount: number | null;
  firstAbnormalAt: string | null;
  confirmedAbnormalAt: string | null;
  notificationStatus: AlertEventNotificationStatus;
  notificationStatusLabel: string;
  sourcePayload: Record<string, unknown> | null;
  detectedAt: string;
}

export interface CreateAlertEventResult {
  created: boolean;
  duplicate: boolean;
  event: AlertEventDTO;
}

export interface ListAlertEventsResult {
  data: AlertEventDTO[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
  };
}

export interface AlertEventRow {
  id: number | string;
  idempotency_key: string;
  alert_type: AlertEventAlertType;
  system_type: AlertEventSystemType;
  display_system_type: AlertEventDisplaySystemType;
  factory_id: string | null;
  factory_name: string;
  factory_registration_no: string | null;
  connected_measurement_point_id: number | string | null;
  station_id: string;
  point_code: string | null;
  point_name: string;
  point_type: AlertEventPointType | null;
  parameter_code: string;
  parameter_name: string;
  parameter_label: string;
  unit: string | null;
  event_date: unknown;
  started_at: unknown | null;
  ended_at: unknown | null;
  measured_value: number | string | null;
  threshold_value: number | string | null;
  threshold_type: AlertEventThresholdType | null;
  completeness_percent: number | string | null;
  consecutive_days: number | string | null;
  abnormal_type: AlertEventAbnormalType | null;
  abnormal_streak_count: number | string | null;
  first_abnormal_at: unknown | null;
  confirmed_abnormal_at: unknown | null;
  source_table: string | null;
  source_interval: string;
  source_payload_json: string | null;
  evidence_json: string | null;
  notification_status: AlertEventNotificationStatus;
  detected_at: unknown;
  created_at: unknown;
  updated_at: unknown;
  created_by: number | string | null;
  updated_by: number | string | null;
  deleted_at: unknown | null;
}
