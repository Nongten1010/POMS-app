import type { PermissionScopeDetails } from '../auth/permissions';

export const PARAMETER_VALUE_INTERVALS = ['real', '1m', '5m', '60m', '1day', 'test'] as const;

export type ParameterValueInterval = (typeof PARAMETER_VALUE_INTERVALS)[number];

export interface ListParameterValuesQuery {
  stationId: string;
  interval: ParameterValueInterval;
  startDate: string;
  endDate: string;
}

export interface LatestParameterValueQuery {
  stationId: string;
  interval: ParameterValueInterval;
}

export interface HourlyMeasurementCutoff {
  date: string;
  hour: number;
}

export interface ConnectionTestQuery {
  stationId: string;
}

export interface MeasurementStatisticsQuery {
  stationId: string;
  date: string;
}

export interface CalendarStatusQuery {
  stationId: string;
  month: string;
}

export type CalendarStatusSummaryType = 'exceeded' | 'lowData';

export interface CalendarStatusDetailsQuery {
  stationId: string;
  year: string;
  summaryType: CalendarStatusSummaryType;
  parameterCode: string;
  unit?: string;
}

export interface MeasurementCsvExportQuery {
  stationId: string;
  frequency: 'hourly' | 'daily';
  startDate: string;
  endDate: string;
  parameters: string[];
}

export interface ParameterEvaluation {
  parameter: string;
  standardCriteria?: unknown;
  eiaCriteria?: unknown;
  channelStatus?: string | null;
}

export interface ParameterEvaluationOptions {
  parameterEvaluations?: ParameterEvaluation[];
}

export type CalendarStatusParameterEvaluation = ParameterEvaluation;
export type CalendarStatusEvaluationOptions = ParameterEvaluationOptions;
export type MeasurementStatisticsEvaluationOptions = ParameterEvaluationOptions;

export interface ParameterValueAccessContext {
  actorUserId: number;
  scope: string | null | undefined | PermissionScopeDetails;
}

export interface ParameterValuesTableDTO {
  schemaName: string;
  tableName: string;
  columnCount: number;
  rowCount: number;
}

export interface ParameterValuesResultDTO {
  data: Record<string, unknown>[];
  meta: {
    stationId: string;
    interval: ParameterValueInterval;
    schemaName: string;
    tableName: string;
    startDate: string;
    endDate: string;
    count: number;
    registeredParameters: string[];
    returnedColumns: string[];
  };
}

export interface LatestParameterValueResultDTO {
  data: Record<string, unknown> | null;
  meta: {
    stationId: string;
    interval: ParameterValueInterval;
    schemaName: string;
    tableName: string;
    count: number;
    registeredParameters: string[];
    returnedColumns: string[];
  };
}

export interface LatestHourlyParameterValuesResultDTO {
  data: Record<string, unknown>[];
  meta: {
    stationId: string;
    interval: '60m';
    schemaName: string;
    tableName: string;
    count: number;
    registeredParameters: string[];
    returnedColumns: string[];
  };
}

export interface ConnectionTestRowDTO {
  timestamp: string | null;
  values: Record<string, unknown>;
  statuses: Record<string, unknown>;
}

export interface ConnectionTestResultDTO {
  data: ConnectionTestRowDTO[];
  meta: {
    stationId: string;
    interval: 'test';
    schemaName: string;
    tableName: string;
    count: number;
    registeredParameters: string[];
  };
}

export type ParameterValueStatus =
  | 'normal'
  | 'warning'
  | 'exceeded'
  | 'insufficient'
  | 'noData'
  | 'invalid';

export interface MeasurementParameterThresholdDTO {
  parameterCode: string;
  parameterLabel: string;
  unit: string;
  normalMax: number | null;
  warningMax: number | null;
}

export interface MeasurementStatisticValueDTO {
  value: number | null;
  displayValue: string;
  status: ParameterValueStatus;
}

export interface MeasurementStatisticRowDTO {
  time: string;
  chartTime: string;
  dataCompletenessPercent: number;
  values: Record<string, MeasurementStatisticValueDTO>;
}

export interface MeasurementStatisticsDTO {
  metadata: {
    description: string;
    date: string;
    valueDefinitions: Record<string, unknown>;
  };
  thresholds: MeasurementParameterThresholdDTO[];
  measurementPoints: Array<{
    pointCode: string;
    stationId: string;
    pointName?: string;
    latitude?: number | null;
    longitude?: number | null;
    date: string;
    rows: MeasurementStatisticRowDTO[];
  }>;
}

export interface MeasurementStatisticsResultDTO {
  data: MeasurementStatisticsDTO;
  meta: {
    stationId: string;
    interval: '60m';
    schemaName: string;
    tableName: string;
    date: string;
    count: number;
    registeredParameters: string[];
  };
}

export interface CalendarStatusDayDTO {
  date: string;
  dataCompletenessPercent: number;
  dataCompletenessStatus: 'lowData' | 'highData';
  pollutionStatus: 'normal' | 'warning' | 'exceeded' | 'insufficient';
  display: {
    backgroundStatus: 'lowData' | 'highData';
    borderStatus: 'normal' | 'warning' | 'exceeded' | 'insufficient';
  };
}

export interface MonthlyParameterSummaryDTO {
  parameterCode: string;
  parameterName: string;
  unit: string;
  exceededDays: number;
  lowDataDays: number;
  todayDataCompletenessPercent: number | null;
}

export interface CalendarStatusDTO {
  metadata: {
    description: string;
    month: string;
    valueDefinitions: Record<string, unknown>;
  };
  calendar: {
    year: number;
    month: number;
    days: CalendarStatusDayDTO[];
  };
  monthlySummary: MonthlyParameterSummaryDTO[];
}

export interface CalendarStatusResultDTO {
  data: CalendarStatusDTO;
  meta: {
    stationId: string;
    interval: '60m';
    schemaName: string;
    tableName: string;
    month: string;
    count: number;
    registeredParameters: string[];
  };
}

export interface CalendarStatusExceededStandardDTO {
  value: number;
  displayValue: string;
  operator: '>' | '>=';
}

export interface CalendarStatusExceededOccurrenceDTO {
  time: string;
  displayTime: string;
  value: number;
  displayValue: string;
  standardValue: number;
  displayStandardValue: string;
  exceededBy: number;
  displayExceededBy: string;
}

export interface CalendarStatusExceededDetailRowDTO extends CalendarStatusExceededOccurrenceDTO {
  date: string;
}

export interface CalendarStatusLowDataDetailRowDTO {
  date: string;
  dataCompletenessPercent: number;
}

export type CalendarStatusDetailRowDTO =
  | CalendarStatusExceededDetailRowDTO
  | CalendarStatusLowDataDetailRowDTO;

export interface CalendarStatusDetailsDTO {
  metadata: {
    description: string;
    year: number;
    summaryType: CalendarStatusSummaryType;
    valueDefinitions: Record<string, unknown>;
  };
  parameter: {
    parameterCode: string;
    parameterName: string;
    parameterLabel: string;
    unit: string;
    exceededStandard: CalendarStatusExceededStandardDTO;
  };
  summary: {
    affectedDays: number;
  };
  rows: CalendarStatusDetailRowDTO[];
}

export interface CalendarStatusDetailsResultDTO {
  data: CalendarStatusDetailsDTO;
  meta: {
    stationId: string;
    interval: '60m';
    schemaName: string;
    tableName: string;
    year: string;
    count: number;
    registeredParameters: string[];
  };
}
