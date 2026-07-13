export const CONNECTION_REQUEST_EIA_ASSESSMENTS = [
  'มี',
  'ไม่มี',
  'มี IEE',
  'มี EIA',
  'มี EHIA',
  'อื่นๆ',
] as const;

export type ConnectionRequestEiaAssessment = (typeof CONNECTION_REQUEST_EIA_ASSESSMENTS)[number];

export function deriveHasEiaFromAssessment(assessment: ConnectionRequestEiaAssessment): boolean {
  return assessment !== 'ไม่มี' && assessment !== 'อื่นๆ';
}

export function resolveStoredConnectionRequestEia(input: {
  eiaAssessment: string | null;
  eiaOther: string | null;
  hasEia: boolean | number | null;
}): {
  eia: ConnectionRequestEiaAssessment | null;
  eiaOther: string | null;
  hasEia: boolean | null;
} {
  const storedHasEia = toNullableBoolean(input.hasEia);
  const categoricalAssessment = isConnectionRequestEiaAssessment(input.eiaAssessment)
    ? input.eiaAssessment
    : null;
  const eia = categoricalAssessment
    ? categoricalAssessment
    : storedHasEia === null
      ? null
      : storedHasEia
        ? 'มี'
        : 'ไม่มี';
  const hasEia = categoricalAssessment
    ? deriveHasEiaFromAssessment(categoricalAssessment)
    : storedHasEia;

  return {
    eia,
    eiaOther: eia === 'อื่นๆ' ? input.eiaOther : null,
    hasEia,
  };
}

function isConnectionRequestEiaAssessment(
  value: string | null,
): value is ConnectionRequestEiaAssessment {
  return CONNECTION_REQUEST_EIA_ASSESSMENTS.some((assessment) => assessment === value);
}

function toNullableBoolean(value: boolean | number | null): boolean | null {
  if (value === null) return null;
  if (typeof value === 'boolean') return value;
  if (value === 1) return true;
  if (value === 0) return false;
  return null;
}
