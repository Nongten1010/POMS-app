import type { Knex } from 'knex';
import { BadRequestError } from '../../shared/errors/AppError';
import { factoryProfileReadTable } from '../factory-profiles/factory-profile-mode';

export interface KwpParameterPointReference {
  factoryId: string;
  connectedPointId?: number | null;
  pointCode?: string | null;
  pointName?: string | null;
}

export function parameterKey(value: string): string {
  return value.normalize('NFKC').trim().toLowerCase().replace(/\s+/gu, ' ');
}

function jsonObject(value: string | null): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(value ?? '{}');
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function stringList(value: unknown): string[] {
  if (typeof value === 'string') {
    try {
      return stringList(JSON.parse(value));
    } catch {
      return [];
    }
  }
  return Array.isArray(value)
    ? [
        ...new Set(
          value
            .filter((item): item is string => typeof item === 'string')
            .map((item) => item.trim())
            .filter(Boolean),
        ),
      ]
    : [];
}

/** Called only after factory/point access has been checked by the caller. */
export async function getKwpEligibleParameters(
  connection: Knex | Knex.Transaction,
  reference: KwpParameterPointReference,
): Promise<string[]> {
  const query = connection(factoryProfileReadTable('cems_wpms_connected_measurement_points'))
    .where('factory_id', reference.factoryId)
    .whereNull('deleted_at');
  if (reference.connectedPointId != null) query.where('id', reference.connectedPointId);
  else if (reference.pointCode) query.where('point_code', reference.pointCode);
  else if (reference.pointName) query.where('point_name', reference.pointName);
  else return [];
  const points = await query.select(
    'id',
    'eligible_factory_id',
    'point_code',
    'point_name',
    'system_type',
    'details_json',
    'parameters_json',
  );
  if (points.length !== 1) return [];
  const point = points[0];
  const factories = connection(factoryProfileReadTable('eligible_factories')).whereNull(
    'deleted_at',
  );
  if (point.eligible_factory_id != null) factories.where('id', point.eligible_factory_id);
  else
    factories.where((builder) =>
      builder
        .where('source_factory_id', reference.factoryId)
        .orWhere('factory_registration_no_new', reference.factoryId)
        .orWhere('factory_registration_no_old', reference.factoryId),
    );
  const matches = await factories.select('monitoring_point_form_id');
  let eligible: string[] | undefined;
  if (matches.length === 1 && matches[0].monitoring_point_form_id != null) {
    const candidates = await connection('factory_monitoring_points')
      .where('form_id', matches[0].monitoring_point_form_id)
      .where('system_type', point.system_type)
      .whereNull('deleted_at')
      .select('point_code', 'point_name', 'eligible_parameters_json');
    const byCode = point.point_code
      ? candidates.filter(
          (candidate) =>
            parameterKey(candidate.point_code ?? '') === parameterKey(point.point_code),
        )
      : [];
    const selected = byCode.length
      ? byCode
      : candidates.filter(
          (candidate) =>
            point.point_name &&
            parameterKey(candidate.point_name ?? '') === parameterKey(point.point_name),
        );
    if (selected.length === 1) eligible = stringList(selected[0].eligible_parameters_json);
    else if (selected.length > 1) return [];
  }
  // Only an explicitly stored eligibility snapshot is a legacy fallback, never the connected list.
  eligible ??= stringList(jsonObject(point.details_json).eligibleParameters);
  const liveLabels = stringList(point.parameters_json);
  return [
    ...new Set(
      eligible.map((parameter) => {
        if (/\([^()]+\)\s*$/.test(parameter)) return parameter;
        const labels = liveLabels.filter(
          (label) =>
            parameterKey(label.replace(/\s*\([^()]+\)\s*$/, '')) === parameterKey(parameter),
        );
        return labels.length === 1 && /\([^()]+\)\s*$/.test(labels[0])
          ? labels[0]
          : `${parameter} (ไม่ระบุหน่วย)`;
      }),
    ),
  ];
}

export function validateKwpParameterSelection(selected: string[], eligible: string[]): void {
  const keys = new Set(eligible.map(parameterKey));
  for (const parameter of selected) {
    if (parameter === 'ทั้งหมด' && eligible.length > 0) continue;
    if (keys.has(parameterKey(parameter))) continue;
    // Legacy code-only selections are accepted only when the eligible unit is unambiguous.
    const matchingNames = eligible.filter(
      (label) => parameterKey(label.replace(/\s*\([^()]+\)\s*$/, '')) === parameterKey(parameter),
    );
    if (matchingNames.length === 1) continue;
    throw new BadRequestError('Selected parameter is not eligible for this measurement point', {
      parameter,
      allowedParameters: eligible,
    });
  }
}
