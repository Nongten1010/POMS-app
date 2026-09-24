import { env } from '../../config/env';
import { StatusCodes } from 'http-status-codes';
import {
  AppError,
  BadRequestError,
  ForbiddenError,
  NotFoundError,
} from '../../shared/errors/AppError';
import { createMeasurementCsvExport } from './measurement-csv-export';
import { parameterValuesRepository } from './parameter-values.repository';
import {
  measurementDisplayValue,
  measurementStatusValue,
  resolvePomsClientParameterStatus,
} from './parameter-status';
import {
  type CalendarStatusEvaluationOptions,
  type CalendarStatusDetailRowDTO,
  type CalendarStatusDetailsQuery,
  type CalendarStatusDetailsResultDTO,
  type CalendarStatusExceededOccurrenceDTO,
  type CalendarStatusExceededStandardDTO,
  type CalendarStatusQuery,
  type CalendarStatusResultDTO,
  type ConnectionTestQuery,
  type ConnectionTestResultDTO,
  type HourlyMeasurementCutoff,
  type HomeMeasurementSummaryDTO,
  type LatestHourlyParameterValuesResultDTO,
  type LatestParameterValueQuery,
  type LatestParameterValueResultDTO,
  type ListParameterValuesQuery,
  type MeasurementParameterThresholdDTO,
  type MeasurementStatisticsEvaluationOptions,
  type MeasurementStatisticsQuery,
  type MeasurementStatisticsResultDTO,
  type MeasurementStatisticValueDTO,
  type ParameterEvaluationOptions,
  type MeasurementCsvExportQuery,
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
    cutoff?: HourlyMeasurementCutoff,
    options?: { homeHour?: boolean },
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

    const query = { stationId, interval } as const;
    const result =
      cutoff && options?.homeHour
        ? await parameterValuesRepository
            .listRows({
              stationId,
              interval,
              startDate: cutoff.date,
              endDate: cutoff.date,
            })
            .then((result) => ({
              ...result,
              rows: result.rows
                .filter(
                  (row) =>
                    stringValue(row.cdate) === cutoff.date && parseHour(row.ctime) === cutoff.hour,
                )
                .sort(compareHomeMeasurementRows),
            }))
        : cutoff
          ? await parameterValuesRepository.latestRowsAtOrBeforeHour(query, cutoff)
          : await parameterValuesRepository.latestRowsAtLatestTimestamp(query);
    const registeredParameters = await parameterValuesRepository.listRegisteredParameters(
      stationId,
      access,
    );
    const filtered = filterRowsByRegisteredParameters(
      result.rows,
      registeredParameters,
      options?.homeHour,
    );

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
    await ensureConnectionTestStationAccess(query.stationId, access);

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
    const registeredParameters =
      await parameterValuesRepository.listRegisteredParametersForConnectionTest(
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
    options?: MeasurementStatisticsEvaluationOptions,
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

    const current = toBangkokDateHour(new Date());
    const loaded = await loadHomeMeasurementRows(query.stationId, query.date, access, options);
    const { result, registeredParameters, definitions, expectedStartDate } = loaded;
    const dailySummaries = buildDailySummaries(
      result.rows,
      definitions,
      current,
      expectedStartDate,
      query.date,
    );
    const selectedRows = result.rows.filter((row) => stringValue(row.cdate) === query.date);

    return {
      data: {
        metadata: {
          description: 'สถิติรายชั่วโมงสำหรับตารางสถิติข้อมูลและกราฟแนวโน้มสถานการณ์มลพิษ',
          date: query.date,
          valueDefinitions: measurementStatisticsValueDefinitions(),
        },
        summary: buildHomeMeasurementSummary(dailySummaries, query.date),
        thresholds: definitions.map(toThreshold).filter(isMeasurementParameterThreshold),
        measurementPoints: [
          {
            pointCode: query.stationId,
            stationId: query.stationId,
            date: query.date,
            rows: buildHourlyStatisticRows(query.date, selectedRows, definitions),
          },
        ],
      },
      meta: {
        stationId: query.stationId,
        interval,
        schemaName: env.PARAMETER_DB_SCHEMA,
        tableName: result.tableName,
        date: query.date,
        count: selectedRows.length,
        registeredParameters: canonicalizeRegisteredParameterLabels(registeredParameters),
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

    const {
      year,
      month,
      startDate: monthStartDate,
      endDate: monthEndDate,
    } = monthRange(query.month);
    const current = toBangkokDateHour(new Date());
    const endDate = resolveHomeEndDate(query.endDate, monthStartDate, monthEndDate, current);
    const loaded = await loadHomeMeasurementRows(query.stationId, endDate, access, options);
    const { result, registeredParameters, definitions, expectedStartDate } = loaded;
    const dailySummaries = buildDailySummaries(
      result.rows,
      definitions,
      current,
      expectedStartDate,
      endDate,
    );
    const requestedMonthSummaries = dailySummaries.filter(
      (summary) => summary.date >= monthStartDate && summary.date <= monthEndDate,
    );
    const summaryPeriod = endDate < monthStartDate ? [] : dailySummaries;

    return {
      data: {
        metadata: {
          description: 'DateCalendar รายเดือนและตารางสรุปสถานะของปีที่เลือก',
          month: query.month,
          endDate,
          valueDefinitions: calendarStatusValueDefinitions(),
        },
        summary: buildHomeMeasurementSummary(summaryPeriod, endDate),
        calendar: {
          year,
          month,
          days: requestedMonthSummaries.map((summary) => ({
            date: summary.date,
            dataCompletenessPercent: summary.dataCompletenessPercent,
            lateDataPercent: summary.lateDataPercent,
            dataCompletenessStatus: summary.dataCompletenessStatus,
            pollutionStatus: summary.pollutionStatus,
            display: {
              backgroundStatus: summary.dataCompletenessStatus,
              borderStatus: summary.pollutionStatus,
            },
          })),
        },
        monthlySummary: definitions.map((definition) =>
          buildYearlyParameterSummary(definition, summaryPeriod, endDate),
        ),
      },
      meta: {
        stationId: query.stationId,
        interval,
        schemaName: env.PARAMETER_DB_SCHEMA,
        tableName: result.tableName,
        month: query.month,
        endDate,
        count: result.rows.length,
        registeredParameters,
      },
    };
  },

  async calendarStatusDetails(
    query: CalendarStatusDetailsQuery,
    access: ParameterValueAccessContext,
    options?: CalendarStatusEvaluationOptions,
  ): Promise<CalendarStatusDetailsResultDTO> {
    await ensureStationAccess(query.stationId, access);

    const interval = '60m';
    const tableName = parameterValuesRepository.tableName(query.stationId, interval);
    const exists = await parameterValuesRepository.tableExists(tableName);
    if (!exists) {
      throw new NotFoundError(
        `Parameter value table ${env.PARAMETER_DB_SCHEMA}.${tableName} not found`,
      );
    }

    const { year, startDate, endDate: yearEndDate } = yearRange(query.year);
    const current = toBangkokDateHour(new Date());
    const endDate = resolveHomeEndDate(query.endDate, startDate, yearEndDate, current);
    const loaded = await loadHomeMeasurementRows(query.stationId, endDate, access, options);
    const { result, registeredParameters, definitions, expectedStartDate } = loaded;
    const annualRows = result.rows.filter((row) => {
      const date = stringValue(row.cdate);
      return date !== null && date >= startDate && date <= endDate;
    });
    const definition = resolveCalendarStatusDetailParameter(
      definitions,
      query.parameterCode,
      query.unit,
    );
    const dailySummaries = buildDailySummaries(
      result.rows,
      definitions,
      current,
      expectedStartDate,
      endDate,
    );
    const detailSummaries =
      endDate < startDate
        ? []
        : query.summaryType === 'lowData'
          ? trailingLowDataSummaries(dailySummaries, endDate, definition.label)
          : dailySummaries.filter((summary) => summary.date >= startDate);
    const exceededStandard = resolveExceededStandard(definition);
    const rowsByDate = groupRowsByDate(annualRows);
    const rows = detailSummaries.flatMap((summary) =>
      buildCalendarStatusDetailRow(
        query.summaryType,
        summary,
        completedRowsForDate(summary.date, rowsByDate.get(summary.date) ?? [], current),
        definition,
        exceededStandard,
      ),
    );

    return {
      data: {
        metadata: {
          description: 'รายละเอียดรายวันที่ใช้คำนวณตารางสรุปสถานะของปีที่เลือก',
          year,
          endDate,
          summaryType: query.summaryType,
          valueDefinitions: calendarStatusDetailsValueDefinitions(),
        },
        parameter: {
          parameterCode: definition.code,
          parameterName: definition.name,
          parameterLabel: definition.label,
          unit: definition.unit,
          exceededStandard,
        },
        summary: {
          affectedDays: rows.length,
        },
        rows,
      },
      meta: {
        stationId: query.stationId,
        interval,
        schemaName: env.PARAMETER_DB_SCHEMA,
        tableName: result.tableName,
        year: query.year,
        endDate,
        count: result.rows.length,
        registeredParameters,
      },
    };
  },

  async measurementCsvExport(
    query: MeasurementCsvExportQuery,
    access: ParameterValueAccessContext,
    loadFactoryContext: () => Promise<{
      factoryName: string;
      factoryRegistrationNumber: string;
    }>,
  ) {
    await ensureStationExportAccess(query.stationId, access);

    const interval = query.frequency === 'hourly' ? '60m' : '1day';
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
        startDate: query.startDate,
        endDate: query.endDate,
      }),
      parameterValuesRepository.listRegisteredParameters(query.stationId, access),
    ]);
    if (result.rows.length === 0) {
      throw new AppError(
        'No measurement data found for the selected export range',
        StatusCodes.NOT_FOUND,
        'NO_EXPORT_DATA',
      );
    }
    const factoryContext = await loadFactoryContext();

    return createMeasurementCsvExport({
      stationId: query.stationId,
      ...factoryContext,
      frequency: query.frequency,
      startDate: query.startDate,
      endDate: query.endDate,
      registeredParameters,
      requestedParameters: query.parameters,
      rows: result.rows,
    });
  },
};

const DEFAULT_NORMAL_MAX = 180;
const DEFAULT_WARNING_MAX = 190;
const HOURS_PER_DAY = 24;
const BANGKOK_TIME_ZONE = 'Asia/Bangkok';
const bangkokDateHourFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: BANGKOK_TIME_ZONE,
  calendar: 'gregory',
  numberingSystem: 'latn',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  hourCycle: 'h23',
});

interface DateHour {
  date: string;
  hour: number;
}

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
  dataCompletenessPercent: number | null;
  lateDataPercent: number | null;
  dataCompletenessStatus: 'lowData' | 'highData' | null;
  pollutionStatus: 'normal' | 'lateData' | 'warning' | 'exceeded' | 'insufficient';
  parameterStatuses: Map<string, ParameterValueStatus[]>;
  parameterCompleteness: Map<
    string,
    { onTime: number | null; late: number | null; lowData: boolean | null }
  >;
}

interface CriteriaRangeRow {
  level: 'normal' | 'warning' | 'critical';
  min: number | null;
  max: number | null;
}

interface ParameterEvaluationInput {
  parameter: string;
  standardCriteria?: unknown;
  eiaCriteria?: unknown;
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
const PARAMETER_COLUMN_PREFIX_ALIASES: Readonly<Record<string, readonly string[]>> = {
  flowrate: ['flow'],
};
const CANONICAL_FLOW_RATE_PARAMETER = {
  name: 'Flow Rate',
  unit: 'm3/hr',
} as const;

async function loadHomeMeasurementRows(
  stationId: string,
  endDate: string,
  access: ParameterValueAccessContext,
  options?: ParameterEvaluationOptions,
) {
  const earliestMeasurementDate =
    await parameterValuesRepository.earliestMeasurementDate(stationId);
  const expectedStartDate =
    [options?.expectedStartDate, earliestMeasurementDate]
      .filter((date): date is string => Boolean(date))
      .sort()[0] ?? null;
  const yearStart = `${endDate.slice(0, 4)}-01-01`;
  const startDate =
    expectedStartDate && expectedStartDate < yearStart ? expectedStartDate : yearStart;
  const [source, sourceRegisteredParameters] = await Promise.all([
    parameterValuesRepository.listRows({ stationId, interval: '60m', startDate, endDate }),
    parameterValuesRepository.listRegisteredParameters(stationId, access),
  ]);
  const registeredParameters = allowedHomeParameters(sourceRegisteredParameters, options);
  const rows = source.rows.filter((row) => {
    const date = timestampDate(row.cdate);
    return date !== null && date >= startDate && date <= endDate;
  });
  const definitions = buildParameterDefinitions(
    registeredParameters,
    rows,
    options?.parameterEvaluations,
  );
  return {
    result: { ...source, rows },
    registeredParameters,
    definitions,
    expectedStartDate: expectedStartDate ?? rows.map((row) => String(row.cdate)).sort()[0] ?? null,
  };
}

function resolveHomeEndDate(
  requestedEndDate: string | undefined,
  periodStart: string,
  periodEnd: string,
  current: DateHour | null,
): string {
  if (requestedEndDate) {
    if (
      requestedEndDate < periodStart ||
      requestedEndDate > periodEnd ||
      (current && requestedEndDate > current.date)
    ) {
      throw new BadRequestError(
        'endDate must be within the requested period and no later than today',
      );
    }
    return requestedEndDate;
  }
  return current && current.date < periodEnd ? current.date : periodEnd;
}

function allowedHomeParameters(
  parameters: string[],
  options?: ParameterEvaluationOptions,
): string[] {
  if (!options?.allowedParameterLabels) return parameters;
  const allowed = new Set(options.allowedParameterLabels.map(parameterIdentity));
  return parameters.filter((parameter) => allowed.has(parameterIdentity(parameter)));
}

function parameterIdentity(parameter: string): string {
  const parsed = canonicalParameterPresentation(parseParameterLabel(parameter), parameter);
  return `${normalizeParameterName(parsed.name)}:${normalizeUnit(parsed.unit)}`;
}

/** Uses the same value and status rules as the home statistics table. */
export function evaluateHomeMeasurementRow(
  row: Record<string, unknown> | undefined,
  parameters: string[],
  options?: ParameterEvaluationOptions,
): Record<string, MeasurementStatisticValueDTO> {
  return evaluateHomeMeasurementRows(row ? [row] : [], parameters, options);
}

export function evaluateHomeMeasurementRows(
  rows: Record<string, unknown>[],
  parameters: string[],
  options?: ParameterEvaluationOptions,
): Record<string, MeasurementStatisticValueDTO> {
  const definitions = buildParameterDefinitions(
    allowedHomeParameters(parameters, options),
    rows,
    options?.parameterEvaluations,
  );
  const chronologicalRows = [...rows].sort(compareHomeMeasurementRows);
  return Object.fromEntries(
    definitions.map((definition) => {
      const row = selectHomeParameterRow(chronologicalRows, definition);
      const sourceStatus = row ? readPomsClientStatus(row, definition) : null;
      const missingValue =
        !row ||
        (readParameterNumber(row, definition) === null &&
          (!sourceStatus || sourceStatus.usesMeasurementValue));
      return [
        definition.label,
        missingValue
          ? { value: null, displayValue: '-', status: 'noData' as const }
          : buildStatisticValue(
              row,
              definition,
              row ? (readParameterCompletenessPercent(row, definition) ?? 100) : 0,
            ),
      ];
    }),
  );
}

function selectHomeParameterRow(
  rows: Record<string, unknown>[],
  definition: ParameterDefinition,
): Record<string, unknown> | undefined {
  return rows.find(
    (row) => readParameterNumber(row, definition) !== null || readPomsClientStatus(row, definition),
  );
}

/**
 * cdate/ctime is the device measurement time; udate/utime is its send time.
 * Both source pairs already use Asia/Bangkok. Compare their stored local dates
 * and hours directly; applying another timezone offset would shift the deadline.
 */
export function homeMeasurementReceiptStatus(
  row: Record<string, unknown>,
): 'onTime' | 'late' | 'unknown' {
  const measuredDate = timestampDate(row.cdate);
  const measuredHour = receiptTimestampHour(row.ctime);
  const sentDate = timestampDate(row.udate);
  const sentHour = receiptTimestampHour(row.utime);
  if (!measuredDate || measuredHour === null || !sentDate || sentHour === null) {
    return 'unknown';
  }
  const measuredBucket = `${measuredDate} ${String(measuredHour).padStart(2, '0')}`;
  const sentBucket = `${sentDate} ${String(sentHour).padStart(2, '0')}`;
  return sentBucket <= measuredBucket ? 'onTime' : 'late';
}

function timestampDate(value: unknown): string | null {
  const date = stringValue(value);
  return date && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null;
}

function receiptTimestampHour(value: unknown): number | null {
  if (typeof value !== 'string') return null;
  const match = value.trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2})(?:\.\d+)?)?$/);
  if (!match || Number(match[1]) > 23 || Number(match[2]) > 59 || Number(match[3] ?? 0) > 59) {
    return null;
  }
  return Number(match[1]);
}

function withHomeReceiptStatus(
  status: ParameterValueStatus,
  row: Record<string, unknown>,
): ParameterValueStatus {
  return status === 'normal' && homeMeasurementReceiptStatus(row) === 'late' ? 'lateData' : status;
}

function buildParameterDefinitions(
  registeredParameters: string[],
  rows: Record<string, unknown>[],
  evaluations: ParameterEvaluationInput[] | undefined = undefined,
): ParameterDefinition[] {
  const definitionsByLabel = new Map<string, ParameterDefinition>();

  for (const parameter of registeredParameters) {
    const parsed = parseParameterLabel(parameter);
    const prefixes = toParameterColumnPrefixes(parameter);
    const presentation = canonicalParameterPresentation(parsed, parameter);
    const code = normalizeParameterName(presentation.name || parameter).toUpperCase();
    const unit = presentation.unit || findUnitForPrefixes(rows, prefixes);
    const evaluation = findParameterEvaluation(parameter, prefixes, evaluations);
    const definition = {
      code,
      label: toParameterLabel(presentation.name, unit),
      name: presentation.name,
      unit,
      prefixes,
      normalMax: DEFAULT_NORMAL_MAX,
      warningMax: DEFAULT_WARNING_MAX,
      criteriaRows: readPreferredCriteriaRows(evaluation),
      channelStatus: evaluation?.channelStatus ?? null,
      useConfiguredEvaluation: Boolean(evaluations),
    };

    if (!definitionsByLabel.has(definition.label)) {
      definitionsByLabel.set(definition.label, definition);
    }
  }

  return [...definitionsByLabel.values()];
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

function canonicalParameterPresentation(
  parsed: { name: string; unit: string },
  parameter: string,
): { name: string; unit: string } {
  if (isFlowRateParameter(parsed, parameter)) {
    return CANONICAL_FLOW_RATE_PARAMETER;
  }

  return parsed;
}

function canonicalizeRegisteredParameterLabels(parameters: string[]): string[] {
  const labels = new Map<string, string>();

  for (const parameter of parameters) {
    const parsed = parseParameterLabel(parameter);
    const label = isFlowRateParameter(parsed, parameter)
      ? toParameterLabel(CANONICAL_FLOW_RATE_PARAMETER.name, CANONICAL_FLOW_RATE_PARAMETER.unit)
      : parameter.trim();
    const normalizedLabel = label.toLowerCase();
    if (label && !labels.has(normalizedLabel)) labels.set(normalizedLabel, label);
  }

  return [...labels.values()];
}

function isFlowRateParameter(parsed: { name: string; unit: string }, parameter: string): boolean {
  const normalizedName = normalizeParameterName(parsed.name || parameter);
  const isFlowName = normalizedName === 'flow' || normalizedName === 'flowrate';
  const normalizedUnit = normalizeUnit(parsed.unit);
  return isFlowName && (!normalizedUnit || normalizedUnit === 'm3hr');
}

function toParameterLabel(name: string, unit: string): string {
  const trimmedName = name.trim();
  const trimmedUnit = unit.trim();
  return trimmedUnit ? `${trimmedName} (${trimmedUnit})` : trimmedName;
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

function toThreshold(definition: ParameterDefinition): MeasurementParameterThresholdDTO | null {
  const criteriaThreshold = toCriteriaThreshold(definition.criteriaRows);
  if (criteriaThreshold) {
    return {
      parameterCode: definition.code,
      parameterLabel: definition.label,
      unit: definition.unit,
      normalMax: criteriaThreshold.normalMax,
      warningMax: criteriaThreshold.warningMax,
    };
  }

  if (definition.useConfiguredEvaluation) {
    return {
      parameterCode: definition.code,
      parameterLabel: definition.label,
      unit: definition.unit,
      normalMax: null,
      warningMax: null,
    };
  }

  return {
    parameterCode: definition.code,
    parameterLabel: definition.label,
    unit: definition.unit,
    normalMax: definition.normalMax,
    warningMax: definition.warningMax,
  };
}

function isMeasurementParameterThreshold(
  threshold: MeasurementParameterThresholdDTO | null,
): threshold is MeasurementParameterThresholdDTO {
  return threshold !== null;
}

function toCriteriaThreshold(
  rows: CriteriaRangeRow[],
): Pick<MeasurementParameterThresholdDTO, 'normalMax' | 'warningMax'> | null {
  const normalMax = findCriteriaMax(rows, 'normal');
  const warningMax = findCriteriaMax(rows, 'warning');
  if (normalMax === null || warningMax === null) return null;

  return { normalMax, warningMax };
}

function buildHourlyStatisticRows(
  date: string,
  rows: Record<string, unknown>[],
  definitions: ParameterDefinition[],
) {
  const rowsByHour = new Map<number, Record<string, unknown>[]>();
  for (const row of [...rows].sort(compareHomeMeasurementRows)) {
    const rowDate = stringValue(row.cdate);
    const hour = parseHour(row.ctime);
    if (rowDate === date && hour !== null) {
      rowsByHour.set(hour, [...(rowsByHour.get(hour) ?? []), row]);
    }
  }

  return Array.from({ length: HOURS_PER_DAY }, (_, hour) => {
    const hourRows = rowsByHour.get(hour) ?? [];
    const onTimeParameters = definitions.filter((definition) =>
      hourRows.some(
        (row) =>
          readParameterNumber(row, definition) !== null &&
          homeMeasurementReceiptStatus(row) === 'onTime',
      ),
    ).length;
    const dataCompletenessPercent = percentOfExpected(onTimeParameters, definitions.length) ?? 0;

    return {
      time: hourLabel(hour),
      chartTime: chartHour(hour),
      dataCompletenessPercent,
      values: Object.fromEntries(
        definitions.map((definition) => {
          const row = selectHomeParameterRow(hourRows, definition) ?? hourRows[0];
          const sourceCompleteness = row
            ? (readParameterCompletenessPercent(row, definition) ?? 100)
            : 0;
          return [definition.label, buildStatisticValue(row, definition, sourceCompleteness)];
        }),
      ),
    };
  });
}

function compareHomeMeasurementRows(
  left: Record<string, unknown>,
  right: Record<string, unknown>,
): number {
  const leftKey = `${String(left.cdate)} ${String(left.ctime)} ${String(left.udate)} ${String(left.utime)}`;
  const rightKey = `${String(right.cdate)} ${String(right.ctime)} ${String(right.udate)} ${String(right.utime)}`;
  return rightKey.localeCompare(leftKey);
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

  const sourceStatus = readPomsClientStatus(row, definition);
  if (sourceStatus && !sourceStatus.usesMeasurementValue) {
    return {
      value: null,
      displayValue: sourceStatus.label,
      status: sourceStatus.code === 0 ? ('noData' as const) : ('invalid' as const),
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
    status: withHomeReceiptStatus(readParameterStatus(row, definition, value), row),
  };
}

function buildDailySummaries(
  rows: Record<string, unknown>[],
  definitions: ParameterDefinition[],
  current: DateHour | null,
  expectedStartDate: string | null,
  endDate: string,
): DailySummary[] {
  if (!expectedStartDate || expectedStartDate > endDate) return [];
  const rowsByDate = groupRowsByDate(rows);
  const summaries: DailySummary[] = [];
  for (let date = expectedStartDate; date <= endDate; date = nextCalendarDate(date)) {
    summaries.push(buildDailySummary(date, rowsByDate.get(date) ?? [], definitions, current));
  }
  return summaries;
}

function completedRowsForDate(
  date: string,
  rows: Record<string, unknown>[],
  current: DateHour | null,
): Record<string, unknown>[] {
  const hours = expectedHoursForDate(date, current);
  return rows.filter((row) => {
    const hour = parseHour(row.ctime);
    return hour !== null && hour < hours;
  });
}

function buildDailySummary(
  date: string,
  rows: Record<string, unknown>[],
  definitions: ParameterDefinition[],
  current: DateHour | null,
): DailySummary {
  const expectedHours = expectedHoursForDate(date, current);
  const completedRows = completedRowsForDate(date, rows, current);
  const parameterCompleteness = new Map<
    string,
    { onTime: number | null; late: number | null; lowData: boolean | null }
  >();
  const parameterStatuses = new Map<string, ParameterValueStatus[]>();
  let totalOnTime = 0;
  let totalLate = 0;
  for (const definition of definitions) {
    const onTimeHours = new Set<number>();
    const lateHours = new Set<number>();
    const statuses: ParameterValueStatus[] = [];
    for (const row of completedRows) {
      const hour = parseHour(row.ctime);
      const value = readParameterNumber(row, definition);
      if (hour === null || value === null) continue;
      const receiptStatus = homeMeasurementReceiptStatus(row);
      if (receiptStatus === 'onTime') onTimeHours.add(hour);
      if (receiptStatus === 'late') lateHours.add(hour);
      if (!hasNormalMeasurementStatus(row, definition)) continue;
      const completeness = readParameterCompletenessPercent(row, definition) ?? 100;
      statuses.push(
        completeness < 80
          ? 'insufficient'
          : withHomeReceiptStatus(evaluateParameterPollutionStatus(definition, value), row),
      );
    }
    for (const hour of onTimeHours) lateHours.delete(hour);
    totalOnTime += onTimeHours.size;
    totalLate += lateHours.size;
    parameterCompleteness.set(definition.label, {
      onTime: percentOfExpected(onTimeHours.size, expectedHours),
      late: percentOfExpected(lateHours.size, expectedHours),
      lowData: expectedHours > 0 ? onTimeHours.size * 5 < expectedHours * 4 : null,
    });
    parameterStatuses.set(definition.label, statuses);
  }
  const denominator = expectedHours * definitions.length;
  const dataCompletenessPercent = percentOfExpected(totalOnTime, denominator);
  const lateDataPercent = percentOfExpected(totalLate, denominator);
  return {
    date,
    dataCompletenessPercent,
    lateDataPercent,
    dataCompletenessStatus:
      dataCompletenessPercent === null
        ? null
        : totalOnTime * 5 < denominator * 4
          ? 'lowData'
          : 'highData',
    pollutionStatus: worstPollutionStatus([...parameterStatuses.values()].flat()),
    parameterStatuses,
    parameterCompleteness,
  };
}

function percentOfExpected(received: number, expected: number): number | null {
  return expected > 0 ? clampPercent(Math.round((received / expected) * 10000) / 100) : null;
}

function trailingLowDataSummaries(
  summaries: DailySummary[],
  endDate: string,
  parameterLabel?: string,
): DailySummary[] {
  const byDate = new Map(summaries.map((summary) => [summary.date, summary]));
  const streak: DailySummary[] = [];
  for (let date = endDate; ; date = previousCalendarDate(date)) {
    const summary = byDate.get(date);
    if (!summary) break;
    const lowData = parameterLabel
      ? (summary.parameterCompleteness.get(parameterLabel)?.lowData ?? null)
      : summary.dataCompletenessStatus === 'lowData';
    if (lowData !== true) break;
    streak.push(summary);
  }
  return streak.reverse();
}

function buildHomeMeasurementSummary(
  summaries: DailySummary[],
  endDate: string,
): HomeMeasurementSummaryDTO {
  const selected = summaries.find((summary) => summary.date === endDate);
  const yearStart = `${endDate.slice(0, 4)}-01-01`;
  return {
    exceededDays: summaries.filter(
      (summary) =>
        summary.date >= yearStart &&
        summary.date <= endDate &&
        summary.pollutionStatus === 'exceeded',
    ).length,
    lowDataDays: trailingLowDataSummaries(summaries, endDate).length,
    todayDataCompletenessPercent: selected?.dataCompletenessPercent ?? null,
    lateDataPercent: selected?.lateDataPercent ?? null,
  };
}

function buildYearlyParameterSummary(
  definition: ParameterDefinition,
  summaries: DailySummary[],
  endDate: string,
) {
  const selected = summaries.find((summary) => summary.date === endDate);
  const yearStart = `${endDate.slice(0, 4)}-01-01`;
  return {
    parameterCode: definition.code,
    parameterName: definition.name,
    parameterLabel: definition.label,
    unit: definition.unit,
    exceededDays: summaries.filter(
      (summary) =>
        summary.date >= yearStart &&
        summary.date <= endDate &&
        (summary.parameterStatuses.get(definition.label) ?? []).includes('exceeded'),
    ).length,
    lowDataDays: trailingLowDataSummaries(summaries, endDate, definition.label).length,
    todayDataCompletenessPercent:
      selected?.parameterCompleteness.get(definition.label)?.onTime ?? null,
    lateDataPercent: selected?.parameterCompleteness.get(definition.label)?.late ?? null,
  };
}

function resolveCalendarStatusDetailParameter(
  definitions: ParameterDefinition[],
  parameterCode: string,
  unit: string | undefined,
): ParameterDefinition {
  const normalizedCode = normalizeParameterName(parameterCode);
  const codeMatches = definitions.filter(
    (definition) => normalizeParameterName(definition.code) === normalizedCode,
  );
  const matches = unit
    ? codeMatches.filter((definition) => normalizeUnit(definition.unit) === normalizeUnit(unit))
    : codeMatches;

  if (matches.length === 0) {
    const parameterDescription = unit ? `${parameterCode} (${unit})` : parameterCode;
    throw new NotFoundError(`Parameter ${parameterDescription} not found for this station`);
  }
  if (matches.length > 1) {
    throw new BadRequestError(`unit is required to identify parameter ${parameterCode}`);
  }

  return matches[0];
}

function resolveExceededStandard(
  definition: ParameterDefinition,
): CalendarStatusExceededStandardDTO {
  const criticalMin = findCriteriaMin(definition.criteriaRows, 'critical');
  const value = criticalMin ?? definition.warningMax;

  return {
    value,
    displayValue: formatMeasurementValue(value),
    operator: criticalMin === null ? '>' : '>=',
  };
}

function groupRowsByDate(rows: Record<string, unknown>[]): Map<string, Record<string, unknown>[]> {
  const rowsByDate = new Map<string, Record<string, unknown>[]>();

  for (const row of rows) {
    const date = stringValue(row.cdate);
    if (!date) continue;
    rowsByDate.set(date, [...(rowsByDate.get(date) ?? []), row]);
  }

  return rowsByDate;
}

function buildCalendarStatusDetailRow(
  summaryType: CalendarStatusDetailsQuery['summaryType'],
  summary: DailySummary,
  rows: Record<string, unknown>[],
  definition: ParameterDefinition,
  exceededStandard: CalendarStatusExceededStandardDTO,
): CalendarStatusDetailRowDTO[] {
  if (summaryType === 'lowData') {
    const completeness = summary.parameterCompleteness.get(definition.label)?.onTime ?? null;
    if (summary.parameterCompleteness.get(definition.label)?.lowData !== true) return [];

    return [
      {
        date: summary.date,
        dataCompletenessPercent: completeness,
      },
    ];
  }

  const firstExceededOccurrence = buildFirstExceededOccurrence(rows, definition, exceededStandard);
  if (!firstExceededOccurrence) return [];

  return [
    {
      date: summary.date,
      ...firstExceededOccurrence,
    },
  ];
}

function buildFirstExceededOccurrence(
  rows: Record<string, unknown>[],
  definition: ParameterDefinition,
  exceededStandard: CalendarStatusExceededStandardDTO,
): CalendarStatusExceededOccurrenceDTO | null {
  const chronologicalRows = rows
    .flatMap((row) => {
      const hour = parseHour(row.ctime);
      if (hour === null) return [];

      return [
        {
          hour,
          time: normalizeOccurrenceTime(row.ctime, hour),
          row,
        },
      ];
    })
    .sort((left, right) => left.time.localeCompare(right.time));

  for (const { hour, time, row } of chronologicalRows) {
    const value = readParameterNumber(row, definition);
    if (value === null || !hasNormalMeasurementStatus(row, definition)) continue;

    const completeness = readParameterCompletenessPercent(row, definition) ?? 100;
    if (completeness < 80 || evaluateParameterPollutionStatus(definition, value) !== 'exceeded') {
      continue;
    }

    const exceededBy = Number(Math.max(0, value - exceededStandard.value).toFixed(10));
    return {
      time,
      displayTime: hourLabel(hour),
      value,
      displayValue: formatMeasurementValue(value),
      standardValue: exceededStandard.value,
      displayStandardValue: exceededStandard.displayValue,
      exceededBy,
      displayExceededBy: formatMeasurementValue(exceededBy),
    };
  }

  return null;
}

function normalizeOccurrenceTime(value: unknown, fallbackHour: number): string {
  const rawTime = stringValue(value);
  const match = rawTime?.match(/^(\d{1,2})[.:](\d{2})(?:[.:](\d{2}))?/);
  if (!match) return `${chartHour(fallbackHour)}:00`;

  const hour = Number(match[1]);
  const minute = Number(match[2]);
  const second = Number(match[3] ?? 0);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59 || second < 0 || second > 59) {
    return `${chartHour(fallbackHour)}:00`;
  }

  return [hour, minute, second].map((part) => String(part).padStart(2, '0')).join(':');
}

function expectedHoursForDate(date: string, current: DateHour | null): number {
  if (!current) return HOURS_PER_DAY;
  if (date > current.date) return 0;
  return date === current.date ? current.hour : HOURS_PER_DAY;
}

function nextCalendarDate(date: string): string {
  return shiftCalendarDate(date, 1);
}

function previousCalendarDate(date: string): string {
  return shiftCalendarDate(date, -1);
}

function shiftCalendarDate(date: string, offset: number): string {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + offset);
  return value.toISOString().slice(0, 10);
}

function toBangkokDateHour(date: Date): DateHour | null {
  const parts = bangkokDateHourFormatter.formatToParts(date);
  const valueByType = new Map(parts.map((part) => [part.type, part.value]));
  const year = valueByType.get('year');
  const month = valueByType.get('month');
  const day = valueByType.get('day');
  const hour = Number(valueByType.get('hour'));
  if (!year || !month || !day || !Number.isInteger(hour) || hour < 0 || hour > 23) return null;

  return { date: `${year}-${month}-${day}`, hour };
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
    if (!sourceUnitMatchesDefinition(row, prefix, definition)) continue;

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
  if (definition.useConfiguredEvaluation)
    return evaluateParameterPollutionStatus(definition, value);

  for (const prefix of definition.prefixes) {
    if (!sourceUnitMatchesDefinition(row, prefix, definition)) continue;

    const sourceStatus = normalizeSourceStatus(row[`${prefix}_status`]);
    if (sourceStatus) return sourceStatus;
  }

  return evaluateParameterPollutionStatus(definition, value);
}

function evaluateParameterPollutionStatus(
  definition: ParameterDefinition,
  value: number,
): ParameterValueStatus {
  if (definition.useConfiguredEvaluation) {
    const criteriaStatus = readCriteriaStatus(definition.criteriaRows, value);
    if (criteriaStatus) return criteriaStatus;
  }

  if (value <= definition.normalMax) return 'normal';
  if (value <= definition.warningMax) return 'warning';
  return 'exceeded';
}

function readPomsClientStatus(row: Record<string, unknown>, definition: ParameterDefinition) {
  for (const prefix of definition.prefixes) {
    if (!sourceUnitMatchesDefinition(row, prefix, definition)) continue;

    const sourceStatus = resolvePomsClientParameterStatus(row[`${prefix}_status`]);
    if (sourceStatus) return sourceStatus;
  }

  return null;
}

function hasNormalMeasurementStatus(
  row: Record<string, unknown>,
  definition: ParameterDefinition,
): boolean {
  for (const prefix of definition.prefixes) {
    if (!sourceUnitMatchesDefinition(row, prefix, definition)) continue;
    if (toNumber(row[`${prefix}_value`]) === null) continue;

    const rawStatus = row[`${prefix}_status`];
    return isNormalMeasurementStatusValue(rawStatus);
  }

  return false;
}

function isNormalMeasurementStatusValue(value: unknown): boolean {
  const sourceStatus = resolvePomsClientParameterStatus(value);
  return sourceStatus?.usesMeasurementValue ?? false;
}

function sourceUnitMatchesDefinition(
  row: Record<string, unknown>,
  prefix: string,
  definition: ParameterDefinition,
): boolean {
  const sourceUnit = row[`${prefix}_units`];
  if (typeof sourceUnit !== 'string' || !sourceUnit.trim() || !definition.unit) return true;
  return normalizeUnit(sourceUnit) === normalizeUnit(definition.unit);
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
): 'normal' | 'lateData' | 'warning' | 'exceeded' | 'insufficient' {
  if (statuses.includes('exceeded')) return 'exceeded';
  if (statuses.includes('warning')) return 'warning';
  if (statuses.includes('lateData')) return 'lateData';
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

function findCriteriaMax(
  rows: CriteriaRangeRow[],
  level: CriteriaRangeRow['level'],
): number | null {
  const row = rows.find((item) => item.level === level);
  return row?.max ?? null;
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

function readPreferredCriteriaRows(
  evaluation: ParameterEvaluationInput | null,
): CriteriaRangeRow[] {
  if (!evaluation) return [];

  const standardRows = readCriteriaRows(evaluation.standardCriteria);
  if (standardRows.length > 0) return standardRows;

  return readCriteriaRows(evaluation.eiaCriteria);
}

function findParameterEvaluation(
  parameter: string,
  prefixes: string[],
  evaluations: ParameterEvaluationInput[] | undefined,
): ParameterEvaluationInput | null {
  if (!evaluations) return null;

  const parameterLabelKey = normalizeParameterName(parameter);
  const exactMatch = evaluations.find(
    (evaluation) => normalizeParameterName(evaluation.parameter) === parameterLabelKey,
  );
  if (exactMatch) return exactMatch;

  const parameterUnit = normalizeUnit(parseParameterLabel(parameter).unit);
  const parameterKeys = new Set([normalizeParameterName(parameter), ...prefixes]);
  return (
    evaluations.find(
      (evaluation) =>
        canMatchParameterEvaluationByPrefix(parameterUnit, evaluation) &&
        toParameterColumnPrefixes(evaluation.parameter).some((prefix) => parameterKeys.has(prefix)),
    ) ?? null
  );
}

function canMatchParameterEvaluationByPrefix(
  parameterUnit: string,
  evaluation: ParameterEvaluationInput,
): boolean {
  const evaluationUnit = normalizeUnit(parseParameterLabel(evaluation.parameter).unit);
  return !parameterUnit || !evaluationUnit || parameterUnit === evaluationUnit;
}

function normalizeUnit(unit: string): string {
  return normalizeParameterName(unit);
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

function yearRange(yearValue: string): {
  year: number;
  startDate: string;
  endDate: string;
} {
  return {
    year: Number(yearValue),
    startDate: `${yearValue}-01-01`,
    endDate: `${yearValue}-12-31`,
  };
}

function measurementStatisticsValueDefinitions(): Record<string, unknown> {
  return {
    status: {
      normal: 'สีเขียว ปกติ ค่ามลพิษ <= normalMax',
      lateData: 'ค่าปกติที่ Server ได้รับหลังสิ้นสุดชั่วโมงตาม ctime',
      warning: 'สีส้ม เฝ้าระวัง ค่ามลพิษ <= warningMax',
      exceeded: 'สีแดง เกินมาตรฐาน ค่ามลพิษ > warningMax',
      insufficient: 'สีเทา ข้อมูลไม่เพียงพอ',
      noData: 'สีเทา ไม่มีข้อมูล',
      invalid: 'สีเทา ข้อมูลผิดรูปแบบหรือสถานะอื่นๆ',
    },
    dataCompletenessPercent:
      'ร้อยละ parameter-hour ที่มีค่าตัวเลขและได้รับภายในชั่วโมง ctime; ความครบถ้วนต้นทางที่ใช้ตัดสิน insufficient แยกจากเปอร์เซ็นต์ส่งทัน',
  };
}

function calendarStatusValueDefinitions(): Record<string, unknown> {
  return {
    summaryPeriod:
      'calendar.days แสดงเดือนที่ขอถึง endDate; exceededDays นับวันไม่ซ้ำตั้งแต่ 1 มกราคม ส่วน lowDataDays นับช่วงต่ำกว่า 80% ต่อเนื่องย้อนจาก endDate จนถึงวันเริ่มใช้งาน รวมข้ามปี',
    dataCompletenessStatus: {
      lowData: 'ส่งข้อมูลน้อยกว่า 80% ใช้พื้นหลังสีเทาโดยไม่บังคับสถานะเส้นขอบ',
      highData: 'ส่งข้อมูลมากกว่าหรือเท่ากับ 80% ใช้พื้นหลังสีฟ้า',
    },
    pollutionStatus: {
      lateData: 'ค่าปกติที่ Server ได้รับหลังสิ้นสุดชั่วโมงตาม ctime',
      normal:
        'ข้อมูลที่ source status เป็น Normal, Ok หรือ code 1 อยู่ในเกณฑ์ปกติ ใช้เส้นขอบสีเขียว',
      warning:
        'ข้อมูลที่ source status เป็น Normal, Ok หรือ code 1 อยู่ในเกณฑ์เฝ้าระวัง ใช้เส้นขอบสีส้ม',
      exceeded: 'ข้อมูลที่ source status เป็น Normal, Ok หรือ code 1 เกินมาตรฐาน ใช้เส้นขอบสีแดง',
      insufficient:
        'ไม่มีค่าจาก source status Normal, Ok หรือ code 1 ที่ใช้ประเมินได้ หรือมีเฉพาะค่าราย row ที่ความครบถ้วนต่ำกว่า 80%',
    },
  };
}

function calendarStatusDetailsValueDefinitions(): Record<string, unknown> {
  return {
    summaryType: {
      exceeded:
        'คืนหนึ่งแถวต่อวันที่เกินมาตรฐาน โดยเลือกข้อมูล source status Normal, Ok หรือ code 1 รายการแรกที่เกินตามเวลา รวมวันที่มีความครบถ้วนรายวันต่ำกว่า 80%',
      lowData:
        'คืนหนึ่งแถวต่อวันในช่วงข้อมูลส่งทันต่ำกว่า 80% ต่อเนื่องล่าสุดของพารามิเตอร์ ย้อนจาก endDate โดยไม่คืนเวลา',
    },
    rows: 'เรียงวันที่จากเก่าไปใหม่ หนึ่งแถวต่อวัน; exceeded จำกัดปีที่ขอถึง endDate ส่วน lowData ต่อเนื่องข้ามปีได้',
    displayTime: 'ช่วงชั่วโมงของค่าที่เกินมาตรฐานรายการแรก เช่น 01.00-01.59 น.',
    value: 'ค่าตรวจวัด source status Normal, Ok หรือ code 1 รายการแรกของวันที่เกินมาตรฐาน',
    dataCompletenessPercent: 'ร้อยละความครบถ้วนรายวันที่ใช้ตัดสิน lowData',
  };
}

function filterRowsByRegisteredParameters(
  rows: Record<string, unknown>[],
  registeredParameters: string[],
  preserveHomeCompleteness = false,
): { rows: Record<string, unknown>[]; returnedColumns: string[] } {
  const allowedColumns = getAllowedColumns(rows, registeredParameters);
  if (preserveHomeCompleteness) {
    for (const row of rows) {
      for (const key of [
        'data_completeness_percent',
        'dataCompletenessPercent',
        'completeness_percent',
        'availability_percent',
      ]) {
        if (Object.hasOwn(row, key)) allowedColumns.add(key);
      }
    }
  }

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
  const baseCandidate = normalizeParameterName(beforeAtSign);

  for (const match of trimmed.matchAll(/\(([^)]+)\)/g)) {
    const unitCandidate = normalizeUnitColumnToken(match[1]);
    if (baseCandidate && unitCandidate) {
      addParameterCandidate(candidates, `${baseCandidate}_${unitCandidate}`);
    }
    addParameterCandidate(candidates, unitCandidate);
  }

  addParameterCandidate(candidates, baseCandidate);
  for (const alias of PARAMETER_COLUMN_PREFIX_ALIASES[baseCandidate] ?? []) {
    addParameterCandidate(candidates, alias);
  }

  if (!trimmed.includes('(')) {
    addParameterCandidate(candidates, trimmed);
  }

  return [...candidates].filter((candidate) => !IGNORED_PARAMETER_TOKENS.has(candidate));
}

function normalizeUnitColumnToken(value: string | undefined): string {
  const normalized = normalizeParameterName(value ?? '');
  if (normalized === 'pct' || normalized === 'percent') return 'percent';
  if (!normalized && value?.includes('%')) return 'percent';
  return normalized;
}

function addParameterCandidate(candidates: Set<string>, value: string | undefined): void {
  const candidate = normalizeParameterName(value ?? '');
  if (candidate) candidates.add(candidate);
}

function normalizeParameterName(value: string): string {
  return value
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
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
        columns.valueColumn
          ? measurementDisplayValue(
              row[columns.valueColumn],
              columns.statusColumn ? row[columns.statusColumn] : null,
            )
          : null,
      ]),
    ),
    statuses: Object.fromEntries(
      entries.map(({ parameter, columns }) => {
        const sourceStatus = columns.statusColumn ? row[columns.statusColumn] : null;
        return [parameter, measurementStatusValue(sourceStatus)];
      }),
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

async function ensureStationExportAccess(
  stationId: string,
  access: ParameterValueAccessContext,
): Promise<void> {
  const hasAccess = await parameterValuesRepository.canAccessStation(stationId, access);
  if (hasAccess) return;

  const exists = await parameterValuesRepository.stationExists(stationId);
  if (!exists) throw new NotFoundError(`Connected measurement point ${stationId} not found`);
  throw new ForbiddenError(`Station ${stationId} is not available for this user`);
}

async function ensureConnectionTestStationAccess(
  stationId: string,
  access: ParameterValueAccessContext,
): Promise<void> {
  const hasAccess = await parameterValuesRepository.canAccessStationForConnectionTest(
    stationId,
    access,
  );
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
