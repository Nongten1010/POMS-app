export interface PomsClientParameterStatus {
  code: number;
  label: string;
  usesMeasurementValue: boolean;
}

const STATUS_BY_CODE: Readonly<Record<number, PomsClientParameterStatus>> = {
  0: { code: 0, label: 'NoData', usesMeasurementValue: false },
  1: { code: 1, label: 'Ok', usesMeasurementValue: true },
  2: { code: 2, label: 'Calibration', usesMeasurementValue: false },
  3: { code: 3, label: 'Defective', usesMeasurementValue: false },
  4: { code: 4, label: 'Maintenance', usesMeasurementValue: false },
  5: { code: 5, label: 'Start up', usesMeasurementValue: false },
  6: { code: 6, label: 'Shut Down', usesMeasurementValue: false },
  7: { code: 7, label: 'Turnaround', usesMeasurementValue: false },
  8: { code: 8, label: 'Etc.', usesMeasurementValue: false },
  9: { code: 9, label: 'No Discharge', usesMeasurementValue: false },
};

const STATUS_CODE_BY_LABEL: Readonly<Record<string, number>> = {
  nodata: 0,
  normal: 1,
  ok: 1,
  calibration: 2,
  defective: 3,
  maintenance: 4,
  startup: 5,
  shutdown: 6,
  turnaround: 7,
  etc: 8,
  nodischarge: 9,
};

export function resolvePomsClientParameterStatus(value: unknown): PomsClientParameterStatus | null {
  const code = parseStatusCode(value);
  return code === null ? null : (STATUS_BY_CODE[code] ?? null);
}

export function measurementDisplayValue(value: unknown, status: unknown): unknown {
  const resolvedStatus = resolvePomsClientParameterStatus(status);
  if (!resolvedStatus || resolvedStatus.usesMeasurementValue) return value;
  return resolvedStatus.label;
}

export function measurementStatusValue(status: unknown): unknown {
  const resolvedStatus = resolvePomsClientParameterStatus(status);
  return resolvedStatus && isStatusCodeInput(status) ? resolvedStatus.label : status;
}

function parseStatusCode(value: unknown): number | null {
  if (typeof value === 'number') return Number.isInteger(value) ? value : null;
  if (typeof value !== 'string') return null;

  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^\d+$/.test(trimmed)) return Number(trimmed);

  return STATUS_CODE_BY_LABEL[normalizeStatusLabel(trimmed)] ?? null;
}

function isStatusCodeInput(value: unknown): boolean {
  return (
    (typeof value === 'number' && Number.isInteger(value)) ||
    (typeof value === 'string' && /^\d+$/.test(value.trim()))
  );
}

function normalizeStatusLabel(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '');
}
