import type { ParameterValueAccessContext } from './parameter-values.types';
import { AppError, ForbiddenError, NotFoundError } from '../../shared/errors/AppError';
import { parameterValuesRepository } from './parameter-values.repository';
import {
  resolveMeasurementParameterFamily,
  normalizedMeasurementUnit,
  parseMeasurementParameter,
  resolveMeasurementParameterFamilies,
} from './measurement-parameter-columns';
import { resolvePomsClientParameterStatus } from './parameter-status';

export interface MeasurementMinutesQuery {
  stationId: string;
  date: string;
  hour: string;
}

export const MINUTE_PARAMETER_STATUSES = [
  'Normal',
  'Calibration',
  'Defective',
  'Maintenance',
  'Start up',
  'Shut Down',
  'Turnaround',
  'Etc.',
] as const;
type MinuteStatus = (typeof MINUTE_PARAMETER_STATUSES)[number];
interface MinuteValue {
  value: number | string | null;
  status: MinuteStatus | null;
  sourceStatus: number | string | null;
  measuredAt: string | null;
}

/** Read-only source detail: no hourly evaluation, completeness calculation or value formatting. */
export async function readMeasurementMinutes(
  query: MeasurementMinutesQuery,
  access: ParameterValueAccessContext,
  loadPoint: () => Promise<{
    pointName: string;
    parameters: string[];
    registeredParameters: string[];
  }>,
) {
  if (!(await parameterValuesRepository.canAccessStation(query.stationId, access))) {
    if (!(await parameterValuesRepository.stationExists(query.stationId)))
      throw new NotFoundError('Connected measurement point not found');
    throw new ForbiddenError('Station is not available for this user');
  }
  const context = await loadPoint();
  const pointName = context.pointName;
  if (
    !(await parameterValuesRepository.tableExists(
      parameterValuesRepository.tableName(query.stationId, '1m'),
    ))
  ) {
    throw new NotFoundError('Minute measurement source is unavailable');
  }
  const source = (await parameterValuesRepository.listMinuteRows(query)).sort(
    (a, b) =>
      String(b.ctime).localeCompare(String(a.ctime)) ||
      String(b.udate ?? '').localeCompare(String(a.udate ?? '')) ||
      String(b.utime ?? '').localeCompare(String(a.utime ?? '')) ||
      stableRow(b).localeCompare(stableRow(a)),
  );
  const resolvedLabels = new Map(
    context.parameters
      .map(canonicalMinuteLabel)
      .map(
        (label) =>
          [
            label.toLowerCase(),
            resolveBareMinuteLabel(
              label,
              source,
              context.registeredParameters.map(canonicalMinuteLabel),
            ),
          ] as const,
      ),
  );
  const labels = [...resolvedLabels.values()];
  const registeredParameters = context.registeredParameters
    .map(canonicalMinuteLabel)
    .map((label) => resolvedLabels.get(label.toLowerCase()) ?? label);
  const parameters = labels.filter(
    (label, index) =>
      labels.findIndex((other) => other.toLowerCase() === label.toLowerCase()) === index,
  );
  const rows = Array.from({ length: 60 }, (_, minute) => {
    const time = `${query.hour}:${String(minute).padStart(2, '0')}`;
    const values = Object.fromEntries(
      parameters.map((label): [string, MinuteValue] => {
        const empty = { value: null, status: null, sourceStatus: null, measuredAt: null };
        const candidates = source.filter(
          (candidate) => String(candidate.ctime).slice(0, 5) === time,
        );
        const selected = candidates.flatMap((row) => {
          const family = matchingFamily(row, label, [...registeredParameters, ...parameters]);
          return family ? [{ row, family }] : [];
        })[0];
        if (!selected) return [label, empty];
        const { row, family } = selected;
        const raw = family.valueColumn ? row[family.valueColumn] : null;
        const sourceStatus = family.statusColumn ? row[family.statusColumn] : null;
        const status = resolvePomsClientParameterStatus(sourceStatus);
        return [
          label,
          {
            value: storedNumericValue(raw),
            status:
              status?.code === 1
                ? 'Normal'
                : sourceStatus == null
                  ? null
                  : (MINUTE_PARAMETER_STATUSES.find((label) => label === status?.label) ?? 'Etc.'),
            sourceStatus:
              typeof sourceStatus === 'string' || typeof sourceStatus === 'number'
                ? sourceStatus
                : null,
            measuredAt: `${query.date}T${row.ctime}+07:00`,
          },
        ];
      }),
    );
    return { time, values };
  });
  return {
    data: { ...query, pointName, timezone: 'Asia/Bangkok' as const, parameters, rows },
    meta: {
      interval: '1m' as const,
      minutesWithData: rows.filter((row) =>
        Object.values(row.values).some((cell) => cell.measuredAt !== null),
      ).length,
    },
  };
}

function stableRow(row: Record<string, unknown>): string {
  return JSON.stringify(
    Object.fromEntries(
      Object.keys(row)
        .sort()
        .map((key) => [key, row[key]]),
    ),
  );
}

function matchingFamily(row: Record<string, unknown>, label: string, parameters: string[]) {
  return resolveMeasurementParameterFamily(row, label, parameters);
}

function storedNumericValue(raw: unknown): number | string | null {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
  if (typeof raw === 'string' && /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(raw.trim()))
    return raw;
  return null;
}

function canonicalMinuteLabel(label: string): string {
  const identity = parseMeasurementParameter(label);
  return identity.nameKey === 'flow' && (identity.unitKey === null || identity.unitKey === 'm3/hr')
    ? 'Flow Rate (m3/hr)'
    : label.trim();
}

function resolveBareMinuteLabel(
  label: string,
  rows: Record<string, unknown>[],
  registered: string[],
): string {
  const identity = parseMeasurementParameter(label);
  if (identity.unitKey !== null || identity.dimensionless) return label;
  const units = new Map<string, string>();
  const addUnit = (unit: unknown): void => {
    if (typeof unit !== 'string' || !unit.trim() || /[()]/.test(unit)) return;
    const key = normalizedMeasurementUnit(unit);
    if (!units.has(key)) units.set(key, unit.trim());
  };
  for (const candidate of registered) {
    const parsed = parseMeasurementParameter(candidate);
    if (parsed.nameKey === identity.nameKey && parsed.unitKey !== null)
      addUnit(candidate.match(/\(([^()]*)\)\s*$/)?.[1]);
  }
  try {
    for (const row of rows) {
      for (const family of resolveMeasurementParameterFamilies(Object.keys(row), label)) {
        if (family.unitsColumn) addUnit(row[family.unitsColumn]);
      }
    }
  } catch {
    throw unavailableParameterUnit();
  }
  if (units.size !== 1) throw unavailableParameterUnit();
  return `${label} (${[...units.values()][0]})`;
}

function unavailableParameterUnit(): AppError {
  return new AppError(
    'Measurement parameter unit is missing or ambiguous',
    503,
    'MEASUREMENT_PARAMETER_UNIT_UNAVAILABLE',
  );
}
