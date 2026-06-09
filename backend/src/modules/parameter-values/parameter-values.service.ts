import { env } from '../../config/env';
import { ForbiddenError, NotFoundError } from '../../shared/errors/AppError';
import { parameterValuesRepository } from './parameter-values.repository';
import {
  type CalendarStatusEvaluationOptions,
  type CalendarStatusQuery,
  type CalendarStatusResultDTO,
  type ConnectionTestQuery,
  type ConnectionTestResultDTO,
  type LatestHourlyParameterValuesResultDTO,
  type LatestParameterValueQuery,
  type LatestParameterValueResultDTO,
  type ListParameterValuesQuery,
  type MeasurementParameterThresholdDTO,
  type MeasurementStatisticsQuery,
  type MeasurementStatisticsResultDTO,
  type ParameterValueStatus,
  PARAMETER_VALUE_INTERVALS,
  type ParameterValueAccessContext,
  type ParameterValuesResultDTO,
  type ParameterValuesTableDTO,
} from './parameter-values.types';

export const parameterValuesService = {
  async listTables(access: ParameterValueAccessContext): Promise<ParameterValuesTableDTO[]> {
    const [tables, accessibleStationIds] = await Promise.all([
      parameterValuesRepository.listTables(),
      parameterValuesRepository.listAccessibleStationIds(access),
    ]);

    const accessible = new Set(accessibleStationIds);
    return tables.filter((table) => {
      const stationId = getStationIdFromTableName(table.tableName);
      return stationId ? accessible.has(stationId) : false;
    });
  },

  async list(
    query: ListParameterValuesQuery,
    access: ParameterValueAccessContext,
  ): Promise<ParameterValuesResultDTO> {
    await ensureStationAccess(query.stationId, access);

    const tableName = parameterValuesRepository.tableName(query.stationId, query.interval);
    const exists = await parameterValuesRepository.tableExists(tableName);
    if (!exists) {
      throw new NotFoundError(
        `Parameter value table ${env.PARAMETER_DB_SCHEMA}.${tableName} not found`,
      );
    }

    const result = await parameterValuesRepository.listRows(query);
    const registeredParameters = await parameterValuesRepository.listRegisteredParameters(
      query.stationId,
      access,
    );
    const filtered = filterRowsByRegisteredParameters(result.rows, registeredParameters);

    return {
      data: filtered.rows,
      meta: {
        stationId: query.stationId,
        interval: query.interval,
        schemaName: env.PARAMETER_DB_SCHEMA,
        tableName: result.tableName,
        startDate: query.startDate,
        endDate: query.endDate,
        count: filtered.rows.length,
        registeredParameters,
        returnedColumns: filtered.returnedColumns,
      },
    };
  },

  async latest(
    query: LatestParameterValueQuery,
    access: ParameterValueAccessContext,
  ): Promise<LatestParameterValueResultDTO> {
    await ensureStationAccess(query.stationId, access);

    const tableName = parameterValuesRepository.tableName(query.stationId, query.interval);
    const exists = await parameterValuesRepository.tableExists(tableName);
    if (!exists) {
      throw new NotFoundError(
        `Parameter value table ${env.PARAMETER_DB_SCHEMA}.${tableName} not found`,
      );
    }

    const result = await parameterValuesRepository.latestRow(query);
    const registeredParameters = await parameterValuesRepository.listRegisteredParameters(
      query.stationId,
      access,
    );
    const filtered = filterRowsByRegisteredParameters(
      result.row ? [result.row] : [],
      registeredParameters,
    );

    return {
      data: filtered.rows[0] ?? null,
      meta: {
        stationId: query.stationId,
        interval: query.interval,
        schemaName: env.PARAMETER_DB_SCHEMA,
        tableName: result.tableName,
        count: filtered.rows.length,
        registeredParameters,
        returnedColumns: filtered.returnedColumns,
      },
    };
  },

  async latestHourly(
    stationId: string,
    access: ParameterValueAccessContext,
  ): Promise<LatestHourlyParameterValuesResultDTO> {
    await ensureStationAccess(stationId, access);

    const interval = '60m';
    const tableName = parameterValuesRepository.tableName(stationId, interval);
    const exists = await parameterValuesRepository.tableExists(tableName);
    if (!exists) {
      throw new NotFoundError(
        `Parameter value table ${env.PARAMETER_DB_SCHEMA}.${tableName} not found`,
      );
    }

    const result = await parameterValuesRepository.latestRowsAtLatestTimestamp({
      stationId,
      interval,
    });
    const registeredParameters = await parameterValuesRepository.listRegisteredParameters(
      stationId,
      access,
    );
    const filtered = filterRowsByRegisteredParameters(result.rows, registeredParameters);

    return {
      data: filtered.rows,
      meta: {
        stationId,
        interval,
        schemaName: env.PARAMETER_DB_SCHEMA,
        tableName: result.tableName,
        count: filtered.rows.length,
        registeredParameters,
        returnedColumns: filtered.returnedColumns,
      },
    };
  },

  async connectionTest(
    query: ConnectionTestQuery,
    access: ParameterValueAccessContext,
  ): Promise<ConnectionTestResultDTO> {
    await ensureStationAccess(query.stationId, access);

    const interval = 'test';
    const tableName = parameterValuesRepository.tableName(query.stationId, interval);
    const exists = await parameterValuesRepository.tableExists(tableName);
    if (!exists) {
      throw new NotFoundError(
        `Parameter value table ${env.PARAMETER_DB_SCHEMA}.${tableName} not found`,
      );
    }

    const result = await parameterValuesRepository.latestRows(
      {
        stationId: query.stationId,
        interval,
      },
      5,
    );
    const registeredParameters = await parameterValuesRepository.listRegisteredParameters(
      query.stationId,
      access,
    );
    const filtered = filterRowsByRegisteredParameters(result.rows, registeredParameters);

    return {
      data: filtered.rows.map((row) => buildConnectionTestData(row, registeredParameters)),
      meta: {
        stationId: query.stationId,
        interval,
        schemaName: env.PARAMETER_DB_SCHEMA,
        tableName: result.tableName,
        count: filtered.rows.length,
        registeredParameters,
      },
    };
  },

  async measurementStatistics(
    query: MeasurementStatisticsQuery,
    access: ParameterValueAccessContext,
  ): Promise<MeasurementStatisticsResultDTO> {
    await ensureStationAccess(query.stationId, access);

    const interval = '60m';
    const tableName = parameterValuesRepository.tableName(query.stationId, interval);
    const exists = await parameterValuesRepository.tableExists(tableName);
    if (!exists) {
      throw new NotFoundError(
        `Parameter value table ${env.PARAMETER_DB_SCHEMA}.${tableName} not found`,
      );
    }

    const [result, registeredParameters] = await Promise.all([
      parameterValuesRepository.listRows({
        stationId: query.stationId,
        interval,
        startDate: query.date,
        endDate: query.date,
      }),
      parameterValuesRepository.listRegisteredParameters(query.stationId, access),
    ]);
    const definitions = buildParameterDefinitions(registeredParameters, result.rows);

    return {
      data: {
        metadata: {
          description: 'สถิติรายชั่วโมงสำหรับตารางสถิติข้อมูลและกราฟแนวโน้มสถานการณ์มลพิษ',
          date: query.date,
          valueDefinitions: measurementStatisticsValueDefinitions(),
        },
        thresholds: definitions.map(toThreshold),
        measurementPoints: [
          {
            pointCode: query.stationId,
            stationId: query.stationId,
            date: query.date,
            rows: buildHourlyStatisticRows(query.date, result.rows, definitions),
          },
        ],
      },
      meta: {
        stationId: query.stationId,
        interval,
        schemaName: env.PARAMETER_DB_SCHEMA,
        tableName: result.tableName,
        date: query.date,
        count: result.rows.length,
        registeredParameters,
      },
    };
  },

  async calendarStatus(
    query: CalendarStatusQuery,
    access: ParameterValueAccessContext,
    options?: CalendarStatusEvaluationOptions,
  ): Promise<CalendarStatusResultDTO> {
    await ensureStationAccess(query.stationId, access);

    const interval = '60m';
    const tableName = parameterValuesRepository.tableName(query.stationId, interval);
    const exists = await parameterValuesRepository.tableExists(tableName);
    if (!exists) {
      throw new NotFoundError(
        `Parameter value table ${env.PARAMETER_DB_SCHEMA}.${tableName} not found`,
      );
    }

    const { year, month, startDate, endDate } = monthRange(query.month);
    const [result, registeredParameters] = await Promise.all([
      parameterValuesRepository.listRows({
        stationId: query.stationId,
        interval,
        startDate,
        endDate,
      }),
      parameterValuesRepository.listRegisteredParameters(query.stationId, access),
    ]);
    const definitions = buildParameterDefinitions(
      registeredParameters,
      result.rows,
      options?.parameterEvaluations,
    );
    const useConfiguredEvaluation = Boolean(options?.parameterEvaluations);
    const dailySummaries = buildDailySummaries(result.rows, definitions, useConfiguredEvaluation);

    return {
      data: {
        metadata: {
          description: 'DateCalendar และตารางสรุปสถานะรายเดือนของโรงงาน',
          month: query.month,
          valueDefinitions: calendarStatusValueDefinitions(),
        },
        calendar: {
          year,
          month,
          days: dailySummaries.map((summary) => ({
            date: summary.date,
            dataCompletenessPercent: summary.dataCompletenessPercent,
            dataCompletenessStatus: summary.dataCompletenessStatus,
            pollutionStatus: summary.pollutionStatus,
            display: {
              backgroundStatus: summary.dataCompletenessStatus,
              borderStatus: summary.pollutionStatus,
            },
          })),
        },
        monthlySummary: definitions.map((definition) =>
          buildMonthlyParameterSummary(definition, dailySummaries),
        ),
      },
      meta: {
        stationId: query.stationId,
        interval,
        schemaName: env.PARAMETER_DB_SCHEMA,
        tableName: result.tableName,
        month: query.month,
        count: result.rows.length,
        registeredParameters,
      },
    };
  },
};

const DEFAULT_NORMAL_MAX = 180;
const DEFAULT_WARNING_MAX = 190;
const HOURS_PER_DAY = 24;

interface ParameterDefinition {
  code: string;
  label: string;
  name: string;
  unit: string;
  prefixes: string[];
  normalMax: number;
  warningMax: number;
  criteriaRows: CriteriaRangeRow[];
  channelStatus: string | null;
  useConfiguredEvaluation: boolean;
}

interface DailySummary {
  date: string;
  dataCompletenessPercent: number;
  dataCompletenessStatus: 'lowData' | 'highData';
  pollutionStatus: 'normal' | 'warning' | 'exceeded' | 'insufficient';
  parameterStatuses: Map<string, ParameterValueStatus[]>;
}

interface CriteriaRangeRow {
  level: 'normal' | 'warning' | 'critical';
  min: number | null;
  max: number | null;
}

interface ParameterEvaluationInput {
  parameter: string;
  standardCriteria?: unknown;
  channelStatus?: string | null;
}

const BASE_PARAMETER_VALUE_COLUMNS = new Set(['station_id', 'cdate', 'ctime', 'udate', 'utime']);
const IGNORED_PARAMETER_TOKENS = new Set([
  'mg',
  'mgl',
  'mgm3',
  'mgm',
  'ppm',
  'ppb',
  'percent',
  'pct',
  'unit',
  'units',
]);

function buildParameterDefinitions(
  registeredParameters: string[],
  rows: Record<string, unknown>[],
  evaluations: ParameterEvaluationInput[] | undefined = undefined,
): ParameterDefinition[] {
  return registeredParameters.map((parameter) => {
    const prefixes = toParameterColumnPrefixes(parameter);
    const code = (prefixes[0] ?? normalizeParameterName(parameter)).toUpperCase();
    const parsed = parseParameterLabel(parameter);
    const evaluation = findParameterEvaluation(parameter, prefixes, evaluations);

    return {
      code,
      label: parsed.label,
      name: parsed.name,
      unit: parsed.unit || findUnitForPrefixes(rows, prefixes),
      prefixes,
      normalMax: DEFAULT_NORMAL_MAX,
      warningMax: DEFAULT_WARNING_MAX,
      criteriaRows: readCriteriaRows(evaluation?.standardCriteria),
      channelStatus: evaluation?.channelStatus ?? null,
      useConfiguredEvaluation: Boolean(evaluations),
    };
  });
}

function parseParameterLabel(parameter: string): { label: string; name: string; unit: string } {
  const label = parameter.trim();
  const match = label.match(/^(.+?)\s*\(([^)]+)\)\s*$/);
  if (!match) {
    return {
      label,
      name: label,
      unit: '',
    };
  }

  return {
    label,
    name: match[1].trim(),
    unit: match[2].trim(),
  };
}

function findUnitForPrefixes(rows: Record<string, unknown>[], prefixes: string[]): string {
  for (const row of rows) {
    for (const prefix of prefixes) {
      const value = row[`${prefix}_units`];
      if (typeof value === 'string' && value.trim()) return value.trim();
    }
  }

  return '';
}

function toThreshold(definition: ParameterDefinition): MeasurementParameterThresholdDTO {
  return {
    parameterCode: definition.code,
    parameterLabel: definition.label,
    unit: definition.unit,
    normalMax: definition.normalMax,
    warningMax: definition.warningMax,
  };
}

function buildHourlyStatisticRows(
  date: string,
  rows: Record<string, unknown>[],
  definitions: ParameterDefinition[],
) {
  const rowsByHour = new Map<number, Record<string, unknown>>();
  for (const row of rows) {
    const rowDate = stringValue(row.cdate);
    const hour = parseHour(row.ctime);
    if (rowDate === date && hour !== null && !rowsByHour.has(hour)) {
      rowsByHour.set(hour, row);
    }
  }

  return Array.from({ length: HOURS_PER_DAY }, (_, hour) => {
    const row = rowsByHour.get(hour);
    const dataCompletenessPercent = row
      ? (readCompletenessPercent(row) ?? (hasAnyParameterValue(row, definitions) ? 100 : 0))
      : 0;

    return {
      time: hourLabel(hour),
      chartTime: chartHour(hour),
      dataCompletenessPercent,
      values: Object.fromEntries(
        definitions.map((definition) => [
          definition.code,
          buildStatisticValue(row, definition, dataCompletenessPercent),
        ]),
      ),
    };
  });
}

function buildStatisticValue(
  row: Record<string, unknown> | undefined,
  definition: ParameterDefinition,
  dataCompletenessPercent: number,
) {
  if (!row) {
    return {
      value: null,
      displayValue: '-',
      status: 'noData' as const,
    };
  }

  const value = readParameterNumber(row, definition);
  if (value === null || dataCompletenessPercent < 80) {
    return {
      value: null,
      displayValue: '-',
      status: 'insufficient' as const,
    };
  }

  return {
    value,
    displayValue: formatMeasurementValue(value),
    status: readParameterStatus(row, definition, value),
  };
}

function buildDailySummaries(
  rows: Record<string, unknown>[],
  definitions: ParameterDefinition[],
  useParameterCompleteness = false,
): DailySummary[] {
  const rowsByDate = new Map<string, Record<string, unknown>[]>();
  for (const row of rows) {
    const date = stringValue(row.cdate);
    if (!date) continue;
    rowsByDate.set(date, [...(rowsByDate.get(date) ?? []), row]);
  }

  return [...rowsByDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, dayRows]) =>
      buildDailySummary(date, dayRows, definitions, useParameterCompleteness),
    );
}

function buildDailySummary(
  date: string,
  rows: Record<string, unknown>[],
  definitions: ParameterDefinition[],
  useParameterCompleteness = false,
): DailySummary {
  const dataCompletenessPercent = useParameterCompleteness
    ? calculateLowestDailyParameterCompleteness(rows, definitions)
    : calculateDailyCompleteness(rows, definitions);
  const dataCompletenessStatus = dataCompletenessPercent < 80 ? 'lowData' : 'highData';
  const parameterStatuses = new Map<string, ParameterValueStatus[]>(
    definitions.map((definition) => [definition.code, []]),
  );
  const parameterCompletenessByCode = useParameterCompleteness
    ? new Map(
        definitions.map((definition) => [
          definition.code,
          calculateDailyParameterCompleteness(rows, definition),
        ]),
      )
    : new Map<string, number>();

  for (const row of rows) {
    for (const definition of definitions) {
      const value = readParameterNumber(row, definition);
      if (value === null) continue;
      const completeness = useParameterCompleteness
        ? (parameterCompletenessByCode.get(definition.code) ?? 0)
        : (readCompletenessPercent(row) ?? 100);
      const statuses = parameterStatuses.get(definition.code) ?? [];
      statuses.push(
        completeness < 80 ? 'insufficient' : readParameterStatus(row, definition, value),
      );
      parameterStatuses.set(definition.code, statuses);
    }
  }

  const pollutionStatus =
    dataCompletenessPercent < 80
      ? 'insufficient'
      : worstPollutionStatus(
          [...parameterStatuses.values()].flat(),
          definitions.some((definition) => definition.useConfiguredEvaluation),
        );

  return {
    date,
    dataCompletenessPercent,
    dataCompletenessStatus,
    pollutionStatus,
    parameterStatuses,
  };
}

function calculateLowestDailyParameterCompleteness(
  rows: Record<string, unknown>[],
  definitions: ParameterDefinition[],
): number {
  if (definitions.length === 0) return calculateDailyCompleteness(rows, definitions);

  return Math.min(
    ...definitions.map((definition) => calculateDailyParameterCompleteness(rows, definition)),
  );
}

function calculateDailyParameterCompleteness(
  rows: Record<string, unknown>[],
  definition: ParameterDefinition,
): number {
  const explicitCompleteness = rows
    .map((row) => readParameterCompletenessPercent(row, definition))
    .filter((value): value is number => value !== null);

  if (explicitCompleteness.length > 0) {
    return Math.round(
      explicitCompleteness.reduce((sum, value) => sum + value, 0) / explicitCompleteness.length,
    );
  }

  const completeHours = new Set<number>();
  for (const row of rows) {
    const hour = parseHour(row.ctime);
    if (hour !== null && readParameterNumber(row, definition) !== null) completeHours.add(hour);
  }

  return Math.round((completeHours.size / HOURS_PER_DAY) * 100);
}

function buildMonthlyParameterSummary(
  definition: ParameterDefinition,
  dailySummaries: DailySummary[],
) {
  const latestSummary = dailySummaries.at(-1);

  return {
    parameterCode: definition.code,
    parameterName: definition.name,
    unit: definition.unit,
    exceededDays: dailySummaries.filter((summary) =>
      (summary.parameterStatuses.get(definition.code) ?? []).includes('exceeded'),
    ).length,
    lowDataDays: dailySummaries.filter((summary) => summary.dataCompletenessStatus === 'lowData')
      .length,
    todayDataCompletenessPercent: latestSummary?.dataCompletenessPercent ?? null,
  };
}

function calculateDailyCompleteness(
  rows: Record<string, unknown>[],
  definitions: ParameterDefinition[],
): number {
  const explicitCompleteness = rows
    .map(readCompletenessPercent)
    .filter((value): value is number => value !== null);

  if (explicitCompleteness.length > 0) {
    return Math.round(
      explicitCompleteness.reduce((sum, value) => sum + value, 0) / explicitCompleteness.length,
    );
  }

  const completeHours = new Set<number>();
  for (const row of rows) {
    const hour = parseHour(row.ctime);
    if (hour !== null && hasAnyParameterValue(row, definitions)) completeHours.add(hour);
  }

  return Math.round((completeHours.size / HOURS_PER_DAY) * 100);
}

function hasAnyParameterValue(
  row: Record<string, unknown>,
  definitions: ParameterDefinition[],
): boolean {
  return definitions.some((definition) => readParameterNumber(row, definition) !== null);
}

function readCompletenessPercent(row: Record<string, unknown>): number | null {
  for (const key of [
    'data_completeness_percent',
    'dataCompletenessPercent',
    'completeness_percent',
    'availability_percent',
  ]) {
    const value = toNumber(row[key]);
    if (value !== null) return clampPercent(Math.round(value));
  }

  return null;
}

function readParameterCompletenessPercent(
  row: Record<string, unknown>,
  definition: ParameterDefinition,
): number | null {
  for (const prefix of definition.prefixes) {
    for (const suffix of [
      'data_completeness_percent',
      'dataCompletenessPercent',
      'completeness_percent',
      'availability_percent',
    ]) {
      const value = toNumber(row[`${prefix}_${suffix}`]);
      if (value !== null) return clampPercent(Math.round(value));
    }
  }

  return readCompletenessPercent(row);
}

function readParameterNumber(
  row: Record<string, unknown>,
  definition: ParameterDefinition,
): number | null {
  for (const prefix of definition.prefixes) {
    const value = toNumber(row[`${prefix}_value`]);
    if (value !== null) return value;
  }

  return null;
}

function readParameterStatus(
  row: Record<string, unknown>,
  definition: ParameterDefinition,
  value: number,
): ParameterValueStatus {
  if (definition.useConfiguredEvaluation) {
    if (!isNormalChannelStatus(definition.channelStatus)) return 'insufficient';

    const criteriaStatus = readCriteriaStatus(definition.criteriaRows, value);
    if (criteriaStatus) return criteriaStatus;

    if (value <= definition.normalMax) return 'normal';
    if (value <= definition.warningMax) return 'warning';
    return 'exceeded';
  }

  for (const prefix of definition.prefixes) {
    const sourceStatus = normalizeSourceStatus(row[`${prefix}_status`]);
    if (sourceStatus) return sourceStatus;
  }

  if (value <= definition.normalMax) return 'normal';
  if (value <= definition.warningMax) return 'warning';
  return 'exceeded';
}

function normalizeSourceStatus(value: unknown): ParameterValueStatus | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return null;
  if (['normal', 'ok', 'pass', 'ปกติ'].some((token) => normalized.includes(token))) {
    return 'normal';
  }
  if (['warning', 'warn', 'alert', 'เฝ้าระวัง'].some((token) => normalized.includes(token))) {
    return 'warning';
  }
  if (['exceed', 'over', 'fail', 'เกิน'].some((token) => normalized.includes(token))) {
    return 'exceeded';
  }
  if (['insufficient', 'missing', 'ไม่เพียงพอ'].some((token) => normalized.includes(token))) {
    return 'insufficient';
  }
  if (['nodata', 'no data', 'ไม่มีข้อมูล'].some((token) => normalized.includes(token))) {
    return 'noData';
  }

  return 'invalid';
}

function worstPollutionStatus(
  statuses: ParameterValueStatus[],
  insufficientIsHighest = false,
): 'normal' | 'warning' | 'exceeded' | 'insufficient' {
  if (insufficientIsHighest && statuses.includes('insufficient')) return 'insufficient';
  if (statuses.includes('exceeded')) return 'exceeded';
  if (statuses.includes('warning')) return 'warning';
  if (statuses.includes('normal')) return 'normal';
  return 'insufficient';
}

function readCriteriaStatus(
  rows: CriteriaRangeRow[],
  value: number,
): 'normal' | 'warning' | 'exceeded' | null {
  const criticalMin = findCriteriaMin(rows, 'critical');
  if (criticalMin !== null && value >= criticalMin) return 'exceeded';

  const warningMin = findCriteriaMin(rows, 'warning');
  if (warningMin !== null && value >= warningMin) return 'warning';

  const normalMin = findCriteriaMin(rows, 'normal');
  if (normalMin === null || value >= normalMin) return 'normal';

  return 'normal';
}

function findCriteriaMin(
  rows: CriteriaRangeRow[],
  level: CriteriaRangeRow['level'],
): number | null {
  const row = rows.find((item) => item.level === level);
  return row?.min ?? null;
}

function readCriteriaRows(value: unknown): CriteriaRangeRow[] {
  if (!isRecord(value) || !Array.isArray(value.rows)) return [];

  return value.rows
    .map((row): CriteriaRangeRow | null => {
      if (!isRecord(row)) return null;
      if (row.level !== 'normal' && row.level !== 'warning' && row.level !== 'critical') {
        return null;
      }

      return {
        level: row.level,
        min: toNumber(row.min),
        max: toNumber(row.max),
      };
    })
    .filter((row): row is CriteriaRangeRow => row !== null);
}

function isNormalChannelStatus(value: string | null): boolean {
  if (value === null) return true;
  const normalized = value.trim().toLowerCase();
  return normalized === '' || normalized === 'normal';
}

function findParameterEvaluation(
  parameter: string,
  prefixes: string[],
  evaluations: ParameterEvaluationInput[] | undefined,
): ParameterEvaluationInput | null {
  if (!evaluations) return null;

  const parameterKeys = new Set([normalizeParameterName(parameter), ...prefixes]);
  return (
    evaluations.find((evaluation) =>
      toParameterColumnPrefixes(evaluation.parameter).some((prefix) => parameterKeys.has(prefix)),
    ) ?? null
  );
}

function toNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value !== 'string') return null;
  const cleaned = value.replace(/,/g, '').trim();
  if (!cleaned || cleaned === '-') return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function parseHour(value: unknown): number | null {
  if (typeof value !== 'string') return null;
  const match = value.trim().match(/^(\d{1,2})(?::|\.)/);
  if (!match) return null;
  const hour = Number(match[1]);
  return Number.isInteger(hour) && hour >= 0 && hour <= 23 ? hour : null;
}

function hourLabel(hour: number): string {
  const value = String(hour).padStart(2, '0');
  return `${value}.00-${value}.59 น.`;
}

function chartHour(hour: number): string {
  return `${String(hour).padStart(2, '0')}:00`;
}

function formatMeasurementValue(value: number): string {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function clampPercent(value: number): number {
  if (value < 0) return 0;
  if (value > 100) return 100;
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function monthRange(monthValue: string): {
  year: number;
  month: number;
  startDate: string;
  endDate: string;
} {
  const year = Number(monthValue.slice(0, 4));
  const month = Number(monthValue.slice(5, 7));
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();

  return {
    year,
    month,
    startDate: `${monthValue}-01`,
    endDate: `${monthValue}-${String(lastDay).padStart(2, '0')}`,
  };
}

function measurementStatisticsValueDefinitions(): Record<string, unknown> {
  return {
    status: {
      normal: 'สีเขียว ปกติ ค่ามลพิษ <= normalMax',
      warning: 'สีส้ม เฝ้าระวัง ค่ามลพิษ <= warningMax',
      exceeded: 'สีแดง เกินมาตรฐาน ค่ามลพิษ > warningMax',
      insufficient: 'สีเทา ข้อมูลไม่เพียงพอ',
      noData: 'สีเทา ไม่มีข้อมูล',
      invalid: 'สีเทา ข้อมูลผิดรูปแบบหรือสถานะอื่นๆ',
    },
    dataCompletenessPercent:
      'ร้อยละการส่งข้อมูลในช่วงเวลานั้น ถ้าน้อยกว่า 80 ให้แสดงสีเทาหรือ status insufficient',
  };
}

function calendarStatusValueDefinitions(): Record<string, unknown> {
  return {
    dataCompletenessStatus: {
      lowData: 'ส่งข้อมูลน้อยกว่า 80% ใช้พื้นหลังสีเทา',
      highData: 'ส่งข้อมูลมากกว่าหรือเท่ากับ 80% ใช้พื้นหลังสีฟ้า',
    },
    pollutionStatus: {
      normal: 'ปกติทั้งวัน ใช้เส้นขอบสีเขียว',
      warning: 'เฝ้าระวัง ใช้เส้นขอบสีส้ม',
      exceeded: 'เกินมาตรฐาน ใช้เส้นขอบสีแดง',
      insufficient: 'ข้อมูลไม่เพียงพอ หรือประเมินสถานะไม่ได้',
    },
  };
}

function filterRowsByRegisteredParameters(
  rows: Record<string, unknown>[],
  registeredParameters: string[],
): { rows: Record<string, unknown>[]; returnedColumns: string[] } {
  const allowedColumns = getAllowedColumns(rows, registeredParameters);

  return {
    rows: rows.map((row) =>
      Object.fromEntries(Object.entries(row).filter(([key]) => allowedColumns.has(key))),
    ),
    returnedColumns: [...allowedColumns],
  };
}

function getAllowedColumns(
  rows: Record<string, unknown>[],
  registeredParameters: string[],
): Set<string> {
  const prefixes = new Set(registeredParameters.flatMap(toParameterColumnPrefixes));
  const allowedColumns = new Set<string>();

  for (const row of rows) {
    for (const key of Object.keys(row)) {
      const lowerKey = key.toLowerCase();
      if (BASE_PARAMETER_VALUE_COLUMNS.has(lowerKey) || hasRegisteredPrefix(lowerKey, prefixes)) {
        allowedColumns.add(key);
      }
    }
  }

  return allowedColumns;
}

function hasRegisteredPrefix(key: string, prefixes: Set<string>): boolean {
  for (const prefix of prefixes) {
    if (key.startsWith(`${prefix}_`)) return true;
  }

  return false;
}

function toParameterColumnPrefixes(parameter: string): string[] {
  const candidates = new Set<string>();
  const trimmed = parameter.trim();
  const beforeParenthesis = trimmed.split('(')[0] ?? trimmed;
  const beforeAtSign = beforeParenthesis.split('@')[0] ?? beforeParenthesis;

  addParameterCandidate(candidates, beforeAtSign);

  for (const match of trimmed.matchAll(/\(([^)]+)\)/g)) {
    addParameterCandidate(candidates, match[1]);
  }

  if (!trimmed.includes('(')) {
    addParameterCandidate(candidates, trimmed);
  }

  return [...candidates].filter((candidate) => !IGNORED_PARAMETER_TOKENS.has(candidate));
}

function addParameterCandidate(candidates: Set<string>, value: string | undefined): void {
  const candidate = normalizeParameterName(value ?? '');
  if (candidate) candidates.add(candidate);
}

function normalizeParameterName(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function buildConnectionTestData(
  row: Record<string, unknown>,
  registeredParameters: string[],
): ConnectionTestResultDTO['data'][number] {
  const entries = registeredParameters.map((parameter) => ({
    parameter,
    columns: findParameterColumns(row, parameter),
  }));

  return {
    timestamp: buildTimestamp(row),
    values: Object.fromEntries(
      entries.map(({ parameter, columns }) => [
        parameter,
        columns.valueColumn ? row[columns.valueColumn] : null,
      ]),
    ),
    statuses: Object.fromEntries(
      entries.map(({ parameter, columns }) => [
        parameter,
        columns.statusColumn ? row[columns.statusColumn] : null,
      ]),
    ),
  };
}

function findParameterColumns(
  row: Record<string, unknown>,
  parameter: string,
): { valueColumn: string | null; statusColumn: string | null } {
  const keysByLower = new Map(Object.keys(row).map((key) => [key.toLowerCase(), key]));
  const prefixes = toParameterColumnPrefixes(parameter);

  return {
    valueColumn: findColumn(keysByLower, prefixes, 'value'),
    statusColumn: findColumn(keysByLower, prefixes, 'status'),
  };
}

function findColumn(
  keysByLower: Map<string, string>,
  prefixes: string[],
  suffix: string,
): string | null {
  for (const prefix of prefixes) {
    const key = keysByLower.get(`${prefix}_${suffix}`);
    if (key) return key;
  }

  return null;
}

function buildTimestamp(row: Record<string, unknown>): string | null {
  const cdate = typeof row.cdate === 'string' ? row.cdate : null;
  const ctime = typeof row.ctime === 'string' ? row.ctime : null;
  if (cdate && ctime) return `${cdate} ${ctime}`;
  if (cdate) return cdate;

  const udate = typeof row.udate === 'string' ? row.udate : null;
  const utime = typeof row.utime === 'string' ? row.utime : null;
  if (udate && utime) return `${udate} ${utime}`;
  if (udate) return udate;

  return null;
}

async function ensureStationAccess(
  stationId: string,
  access: ParameterValueAccessContext,
): Promise<void> {
  const hasAccess = await parameterValuesRepository.canAccessStation(stationId, access);
  if (!hasAccess) {
    throw new ForbiddenError(`Station ${stationId} is not available for this user`);
  }
}

function getStationIdFromTableName(tableName: string): string | null {
  for (const interval of PARAMETER_VALUE_INTERVALS) {
    const suffix = `_data_${interval}`;
    if (tableName.endsWith(suffix)) {
      return tableName.slice(0, -suffix.length);
    }
  }

  return null;
}
