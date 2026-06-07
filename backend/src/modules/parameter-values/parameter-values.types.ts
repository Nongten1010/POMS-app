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

export interface ConnectionTestParameterValueDTO {
  parameter: string;
  value: unknown;
  status: unknown;
  unit: unknown;
  valueColumn: string | null;
  statusColumn: string | null;
  unitColumn: string | null;
}

export interface ConnectionTestQuery {
  stationId: string;
}

export interface ParameterValueAccessContext {
  actorUserId: number;
  scope: string | null | undefined;
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

export interface ConnectionTestResultDTO {
  data: {
    stationId: string;
    timestamp: string | null;
    values: Record<string, unknown>;
    statuses: Record<string, unknown>;
    results: ConnectionTestParameterValueDTO[];
  } | null;
  meta: {
    stationId: string;
    interval: 'test';
    schemaName: string;
    tableName: string;
    count: number;
    registeredParameters: string[];
    returnedColumns: string[];
  };
}
