import { Readable } from 'node:stream';
import { BadRequestError } from '../../shared/errors/AppError';
import { resolvePomsClientParameterStatus } from './parameter-status';

export type MeasurementCsvExportFrequency = 'hourly' | 'daily';

export interface CreateMeasurementCsvExportInput {
  stationId: string;
  factoryName: string;
  frequency: MeasurementCsvExportFrequency;
  startDate: string;
  endDate: string;
  registeredParameters: string[];
  requestedParameters: string[];
  rows: Record<string, unknown>[];
}

export interface MeasurementCsvExport {
  filename: string;
  contentType: 'text/csv; charset=utf-8';
  stream: Readable;
}

export function createMeasurementCsvExport(
  input: CreateMeasurementCsvExportInput,
): MeasurementCsvExport {
  const parameters = resolveRequestedParameters(
    input.registeredParameters,
    input.requestedParameters,
    input.rows,
  );
  const header = [
    'date_time',
    'factory_name',
    'meas_code',
    ...parameters.flatMap(({ label }) => [label, `${label} Status`]),
  ];

  function* csvChunks(): Generator<string> {
    yield `\uFEFF${header.map((cell) => csvCell(cell, true)).join(',')}\r\n`;
    for (const row of [...input.rows].sort(compareMeasurementRows)) {
      const identityCells = [measurementDateTime(row), input.factoryName, input.stationId].map(
        (cell) => csvCell(cell, true),
      );
      const measurementCells = parameters
        .flatMap(({ prefixes, unit }) => {
          const prefix = prefixes.find(
            (candidate) => `${candidate}_value` in row && sourceUnitMatches(row, candidate, unit),
          );
          return prefix ? formatMeasurementCells(row, prefix) : ['', ''];
        })
        .map((cell) => csvCell(cell, false));
      yield `${[...identityCells, ...measurementCells].join(',')}\r\n`;
    }
  }

  return {
    filename: `measurement-${filenameSegment(input.stationId)}-${input.frequency}-${input.startDate}-${input.endDate}.csv`,
    contentType: 'text/csv; charset=utf-8',
    stream: Readable.from(csvChunks()),
  };
}

function filenameSegment(value: string): string {
  return value
    .replace(/[^A-Za-z0-9_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function csvCell(value: string, neutralizeFormula: boolean): string {
  const safeValue = neutralizeFormula && /^[\s]*[=+\-@]/.test(value) ? `'${value}` : value;
  if (!/[",\r\n]/.test(safeValue)) return safeValue;
  return `"${safeValue.replace(/"/g, '""')}"`;
}

function compareMeasurementRows(
  left: Record<string, unknown>,
  right: Record<string, unknown>,
): number {
  return measurementDateTime(left).localeCompare(measurementDateTime(right));
}

function measurementDateTime(row: Record<string, unknown>): string {
  const date = typeof row.cdate === 'string' ? row.cdate.trim() : String(row.cdate ?? '').trim();
  const time = typeof row.ctime === 'string' && row.ctime.trim() ? row.ctime.trim() : '00:00:00';
  return `${date} ${time}`;
}

interface ResolvedParameter {
  label: string;
  unit: string;
  prefixes: string[];
}

function resolveRequestedParameters(
  registeredParameters: string[],
  requestedParameters: string[],
  rows: Record<string, unknown>[],
): ResolvedParameter[] {
  const definitions = buildRegisteredParameterDefinitions(registeredParameters, rows);
  const registeredByKey = new Map<string, ResolvedParameter>();
  for (const definition of definitions) {
    registeredByKey.set(normalizeParameterLabel(definition.label), definition);
  }
  for (const registeredParameter of registeredParameters) {
    const definition = registeredByKey.get(
      normalizeParameterLabel(canonicalParameterLabel(registeredParameter, rows)),
    );
    if (definition) registeredByKey.set(normalizeParameterLabel(registeredParameter), definition);
  }

  if (
    requestedParameters.length === 1 &&
    normalizeParameterLabel(requestedParameters[0] ?? '') === 'all'
  ) {
    return definitions;
  }

  const seen = new Set<string>();

  return requestedParameters.flatMap((requestedLabel) => {
    const definition = registeredByKey.get(normalizeParameterLabel(requestedLabel));
    if (!definition) {
      throw new BadRequestError(
        `Parameter ${requestedLabel.trim()} is not registered for this station`,
      );
    }

    const canonicalKey = normalizeParameterLabel(definition.label);
    if (seen.has(canonicalKey)) return [];
    seen.add(canonicalKey);
    return [definition];
  });
}

function buildRegisteredParameterDefinitions(
  registeredParameters: string[],
  rows: Record<string, unknown>[],
): ResolvedParameter[] {
  const definitionsByLabel = new Map<string, ResolvedParameter>();

  for (const registeredParameter of registeredParameters) {
    const label = canonicalParameterLabel(registeredParameter, rows);
    const canonicalKey = normalizeParameterLabel(label);

    if (!definitionsByLabel.has(canonicalKey)) {
      definitionsByLabel.set(canonicalKey, {
        label,
        unit: parseParameterLabel(label).unit,
        prefixes: parameterPrefixes(label),
      });
    }
  }

  return [...definitionsByLabel.values()];
}

function canonicalParameterLabel(
  registeredParameter: string,
  rows: Record<string, unknown>[],
): string {
  const parsed = parseParameterLabel(registeredParameter);
  const sourceUnit = parsed.unit || findSourceUnit(rows, parameterPrefixes(registeredParameter));
  const isFlow = ['flow', 'flowrate'].includes(normalizeColumnToken(parsed.name));
  const name = isFlow ? 'Flow Rate' : parsed.name;
  const unit = isFlow && normalizeColumnToken(sourceUnit) === 'm3hr' ? 'm3/hr' : sourceUnit;
  return unit ? `${name} (${unit})` : name;
}

function parseParameterLabel(label: string): { name: string; unit: string } {
  const trimmed = label.trim();
  const match = trimmed.match(/^(.+?)\s*\(([^)]+)\)\s*$/);
  return {
    name: match?.[1]?.trim() ?? trimmed,
    unit: match?.[2]?.trim() ?? '',
  };
}

function findSourceUnit(rows: Record<string, unknown>[], prefixes: string[]): string {
  for (const row of rows) {
    for (const prefix of prefixes) {
      const unit = row[`${prefix}_units`];
      if (typeof unit === 'string' && unit.trim()) return unit.trim();
    }
  }

  return '';
}

function sourceUnitMatches(
  row: Record<string, unknown>,
  prefix: string,
  expectedUnit: string,
): boolean {
  if (!expectedUnit) return true;

  const sourceUnit = row[`${prefix}_units`];
  if (typeof sourceUnit !== 'string' || !sourceUnit.trim()) return true;

  return normalizeUnitColumnToken(sourceUnit) === normalizeUnitColumnToken(expectedUnit);
}

function parameterPrefixes(label: string): string[] {
  const match = label.trim().match(/^(.+?)\s*\(([^)]+)\)\s*$/);
  const name = normalizeColumnToken(match?.[1] ?? label);
  const unit = normalizeUnitColumnToken(match?.[2]);
  const prefixes = new Set<string>();

  if (name && unit) prefixes.add(`${name}_${unit}`);
  if (name === 'flowrate') prefixes.add('flow');
  if (name) prefixes.add(name);

  return [...prefixes];
}

function normalizeParameterLabel(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

function normalizeColumnToken(value: string): string {
  return value
    .normalize('NFKD')
    .toLowerCase()
    .replace(/³/g, '3')
    .replace(/[^a-z0-9]+/g, '');
}

function normalizeUnitColumnToken(value: string | undefined): string {
  if (value?.includes('%')) return 'percent';
  return normalizeColumnToken(value ?? '');
}

function formatMeasurementCells(row: Record<string, unknown>, prefix: string): [string, string] {
  const completeness = readCompleteness(row, prefix);
  if (completeness !== null && completeness < 80) return ['', ''];

  const operationalStatus = resolveOperationalStatus(row[`${prefix}_status`]);
  if (!operationalStatus.usesMeasurementValue) return ['', operationalStatus.label];

  const value = toFiniteNumber(row[`${prefix}_value`]);
  return value === null ? ['', ''] : [value.toFixed(2), 'Normal'];
}

interface OperationalStatus {
  label: string;
  usesMeasurementValue: boolean;
}

const NORMAL_OPERATIONAL_STATUS: OperationalStatus = {
  label: 'Normal',
  usesMeasurementValue: true,
};

function resolveOperationalStatus(value: unknown): OperationalStatus {
  if (value === null || value === undefined || (typeof value === 'string' && value.trim() === '')) {
    return NORMAL_OPERATIONAL_STATUS;
  }

  const status = resolvePomsClientParameterStatus(value);
  if (!status || status.code === 9) return { label: 'Etc.', usesMeasurementValue: false };
  if (status.code === 0) return { label: '', usesMeasurementValue: false };
  if (status.code === 1) return NORMAL_OPERATIONAL_STATUS;
  return { label: status.label, usesMeasurementValue: false };
}

function readCompleteness(row: Record<string, unknown>, prefix: string): number | null {
  for (const key of [
    `${prefix}_data_completeness_percent`,
    `${prefix}_dataCompletenessPercent`,
    `${prefix}_completeness_percent`,
    `${prefix}_availability_percent`,
    'data_completeness_percent',
    'dataCompletenessPercent',
    'completeness_percent',
    'availability_percent',
  ]) {
    const value = toFiniteNumber(row[key]);
    if (value !== null) return Math.max(0, Math.min(100, value));
  }

  return null;
}

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string' || !value.trim()) return null;
  const number = Number(value.replace(/,/g, '').trim());
  return Number.isFinite(number) ? number : null;
}
