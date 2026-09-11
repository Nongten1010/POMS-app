import type { Knex } from 'knex';
import {
  CONNECTION_REQUEST_EIA_ASSESSMENTS,
  deriveHasEiaFromAssessment,
  type ConnectionRequestEiaAssessment,
} from '../connection-requests/connection-request-eia';
import { BadRequestError, ConflictError } from '../../shared/errors/AppError';
import { isCanonicalFactoryProfilesEnabled } from './factory-profile-mode';
import { splitFactoryTypeSequence } from '../eligible-factories/factory-type-sequence';

export const FACTORY_PROFILE_FIELDS = [
  'factory_name',
  'address',
  'province_name',
  'industrial_estate_name',
  'latitude',
  'longitude',
  'eia_assessment',
  'eia_other',
  'has_eia',
  'project_name',
  'business_activity',
  'factory_type_sequence',
  'front_photos_json',
  'logo_json',
] as const;

type ProfileField = (typeof FACTORY_PROFILE_FIELDS)[number];
export interface FactoryProfileValues {
  factory_name: string;
  address: string | null;
  province_name: string | null;
  industrial_estate_name: string | null;
  latitude: number | string | null;
  longitude: number | string | null;
  eia_assessment: string | null;
  eia_other: string | null;
  has_eia: boolean | number | null;
  project_name: string | null;
  business_activity: string | null;
  factory_type_sequence: string | null;
  front_photos_json: string | null;
  logo_json: string | null;
}
export type FactoryProfilePatch = Partial<FactoryProfileValues>;
export interface FactoryProfileRow extends FactoryProfileValues {
  id: number | string;
  eligible_factory_id: number | string;
  revision: number | string;
  updated_at: Date | string;
}
interface EligibleProfileRow extends FactoryProfileValues {
  id: number | string;
  monitoring_point_form_id: number | string | null;
}

async function lockEligible(
  trx: Knex.Transaction,
  eligibleFactoryId: number,
): Promise<EligibleProfileRow> {
  const row = await trx<EligibleProfileRow>('eligible_factories')
    .where('id', eligibleFactoryId)
    .whereNull('deleted_at')
    .forUpdate()
    .first();
  if (!row) throw new ConflictError('Eligible factory is no longer active', { eligibleFactoryId });
  return row;
}

/** Uniform write lock order: eligible -> profile -> connected points -> form. */
export async function lockFactoryProfileInTransaction(
  trx: Knex.Transaction,
  eligibleFactoryId: number,
): Promise<FactoryProfileRow | null> {
  if (!isCanonicalFactoryProfilesEnabled()) return null;
  await lockEligible(trx, eligibleFactoryId);
  const row = await trx<FactoryProfileRow>('factory_profiles')
    .where('eligible_factory_id', eligibleFactoryId)
    .forUpdate()
    .first();
  if (!row)
    throw new ConflictError('Factory profile is not ready; complete the guarded backfill', {
      eligibleFactoryId,
    });
  return row;
}

export async function createFactoryProfileFromEligibleInTransaction(
  trx: Knex.Transaction,
  eligibleFactoryId: number,
  actorUserId: number,
  source: string,
): Promise<void> {
  if (!isCanonicalFactoryProfilesEnabled()) return;
  const eligible = await lockEligible(trx, eligibleFactoryId);
  const existing = await trx<FactoryProfileRow>('factory_profiles')
    .where('eligible_factory_id', eligibleFactoryId)
    .forUpdate()
    .first();
  if (existing) {
    await projectProfile(trx, eligible, profileValues(existing), actorUserId);
    return;
  }
  const values = normalizedPatch({
    ...profileValues(eligible),
    front_photos_json: null,
    logo_json: null,
  });
  const [created] = await trx('factory_profiles')
    .insert({
      ...values,
      eligible_factory_id: eligibleFactoryId,
      revision: 1,
      created_by: actorUserId,
      updated_by: actorUserId,
      created_at: trx.fn.now(),
      updated_at: trx.fn.now(),
    })
    .returning('id');
  await projectProfile(trx, eligible, values, actorUserId);
  await trx('factory_profile_events').insert({
    factory_profile_id: created.id,
    revision: 1,
    source,
    actor_user_id: actorUserId,
    before_json: null,
    after_json: JSON.stringify(values),
    created_at: trx.fn.now(),
  });
}

/** Restore shared form fields after a full PUT, including fields omitted by the client. */
export async function projectFactoryProfileToMonitoringFormInTransaction(
  trx: Knex.Transaction,
  eligibleFactoryId: number,
  actorUserId: number,
): Promise<void> {
  if (!isCanonicalFactoryProfilesEnabled()) return;
  const eligible = await lockEligible(trx, eligibleFactoryId);
  const profile = await trx<FactoryProfileRow>('factory_profiles')
    .where('eligible_factory_id', eligibleFactoryId)
    .forUpdate()
    .first();
  if (!profile) {
    throw new ConflictError('Factory profile is not ready; complete the guarded backfill', {
      eligibleFactoryId,
    });
  }
  await projectProfileToForm(trx, eligible, profileValues(profile), actorUserId);
}

export async function updateFactoryProfileInTransaction(
  trx: Knex.Transaction,
  eligibleFactoryId: number,
  input: FactoryProfilePatch,
  actorUserId: number,
  source: string,
  expectedRevision?: number,
): Promise<void> {
  if (!isCanonicalFactoryProfilesEnabled()) return;
  const patch = normalizedPatch(input);
  const eligible = await lockEligible(trx, eligibleFactoryId);
  const current = await trx<FactoryProfileRow>('factory_profiles')
    .where('eligible_factory_id', eligibleFactoryId)
    .forUpdate()
    .first();
  if (!current)
    throw new ConflictError('Factory profile is not ready; complete the guarded backfill', {
      eligibleFactoryId,
    });
  const revision = Number(current.revision);
  if (
    !Number.isSafeInteger(revision) ||
    revision >= Number.MAX_SAFE_INTEGER ||
    (expectedRevision !== undefined && expectedRevision !== revision)
  ) {
    throw new ConflictError('Factory profile changed while the request was pending', {
      eligibleFactoryId,
    });
  }
  const changed = Object.entries(patch).some(
    ([key, value]) => !sameValue(key as ProfileField, current[key as ProfileField], value),
  );
  if (!changed) return;
  const next = { ...profileValues(current), ...patch };
  const updated = await trx('factory_profiles')
    .where('id', current.id)
    .where('revision', revision)
    .update({
      ...patch,
      revision: revision + 1,
      updated_by: actorUserId,
      updated_at: trx.fn.now(),
    });
  if (updated !== 1)
    throw new ConflictError('Factory profile changed while saving', { eligibleFactoryId });
  await projectProfile(trx, eligible, patch, actorUserId);
  await trx('factory_profile_events').insert({
    factory_profile_id: current.id,
    revision: revision + 1,
    source,
    actor_user_id: actorUserId,
    before_json: JSON.stringify(profileValues(current)),
    after_json: JSON.stringify(next),
    created_at: trx.fn.now(),
  });
}

function profileValues(row: FactoryProfileValues): FactoryProfileValues {
  return Object.fromEntries(
    FACTORY_PROFILE_FIELDS.map((key) => [key, row[key] ?? null]),
  ) as unknown as FactoryProfileValues;
}

function normalizedPatch(input: FactoryProfilePatch): FactoryProfilePatch {
  const patch: FactoryProfilePatch = {};
  for (const [key, value] of Object.entries(input)) {
    if (!FACTORY_PROFILE_FIELDS.includes(key as ProfileField))
      throw new BadRequestError('Unsupported factory profile field', { field: key });
    if (value !== undefined) Object.assign(patch, { [key]: value });
  }
  if (
    'factory_name' in patch &&
    (typeof patch.factory_name !== 'string' || !patch.factory_name.trim())
  ) {
    throw new BadRequestError('Factory name is required');
  }
  if ('latitude' in patch !== 'longitude' in patch)
    throw new BadRequestError('Factory coordinates must be provided together');
  if ('latitude' in patch) {
    if ((patch.latitude == null) !== (patch.longitude == null))
      throw new BadRequestError('Factory coordinates must be cleared together');
    for (const [key, limit] of [
      ['latitude', 90],
      ['longitude', 180],
    ] as const) {
      if (patch[key] != null) {
        const value = Number(patch[key]);
        if (!Number.isFinite(value) || Math.abs(value) > limit)
          throw new BadRequestError('Invalid factory coordinates');
        patch[key] = value;
      }
    }
  }
  if ('eia_assessment' in patch) {
    if (
      patch.eia_assessment !== null &&
      !CONNECTION_REQUEST_EIA_ASSESSMENTS.some((value) => value === patch.eia_assessment)
    ) {
      throw new BadRequestError('Invalid factory EIA assessment');
    }
    patch.has_eia =
      patch.eia_assessment == null
        ? null
        : deriveHasEiaFromAssessment(patch.eia_assessment as ConnectionRequestEiaAssessment);
    patch.eia_other = patch.eia_assessment === 'อื่นๆ' ? (patch.eia_other ?? null) : null;
  }
  for (const key of ['front_photos_json', 'logo_json'] as const) {
    const document = patch[key];
    if (document == null) continue;
    let value: unknown;
    try {
      value = JSON.parse(document);
    } catch {
      throw new BadRequestError('Invalid factory image JSON');
    }
    if (
      key === 'front_photos_json'
        ? !Array.isArray(value)
        : !value || typeof value !== 'object' || Array.isArray(value)
    ) {
      throw new BadRequestError('Invalid factory image document');
    }
  }
  return patch;
}

function sameValue(key: ProfileField, left: unknown, right: unknown): boolean {
  if (left == null || right == null) return left == null && right == null;
  if (key === 'latitude' || key === 'longitude') return Number(left) === Number(right);
  if (key === 'has_eia') return Boolean(left) === Boolean(right);
  return left === right;
}

async function projectProfile(
  trx: Knex.Transaction,
  eligible: EligibleProfileRow,
  patch: FactoryProfilePatch,
  actorUserId: number,
): Promise<void> {
  const eligiblePatch = Object.fromEntries(
    Object.entries(patch).filter(([key]) => !['front_photos_json', 'logo_json'].includes(key)),
  );
  if (Object.keys(eligiblePatch).length > 0) {
    const updated = await trx('eligible_factories')
      .where('id', eligible.id)
      .whereNull('deleted_at')
      .update({
        ...eligiblePatch,
        updated_by: actorUserId,
        updated_at: trx.fn.now(),
      });
    if (updated !== 1)
      throw new ConflictError('Eligible factory changed while saving', {
        eligibleFactoryId: eligible.id,
      });
  }
  const pointColumns: Partial<Record<ProfileField, string>> = {
    factory_name: 'factory_name',
    address: 'factory_address',
    latitude: 'factory_latitude',
    longitude: 'factory_longitude',
    eia_assessment: 'factory_eia_assessment',
    eia_other: 'factory_eia_other',
    has_eia: 'factory_has_eia',
    project_name: 'factory_project_name',
    front_photos_json: 'factory_front_photos_json',
    logo_json: 'factory_logo_json',
  };
  const pointPatch = remapPatch(patch, pointColumns);
  if (Object.keys(pointPatch).length > 0) {
    // Profile writes must not invalidate point-only pending requests.
    await trx('cems_wpms_connected_measurement_points')
      .where('eligible_factory_id', eligible.id)
      .whereNull('deleted_at')
      .update({ ...pointPatch, updated_by: actorUserId });
  }
  await projectProfileToForm(trx, eligible, patch, actorUserId);
}

async function projectProfileToForm(
  trx: Knex.Transaction,
  eligible: EligibleProfileRow,
  patch: FactoryProfilePatch,
  actorUserId: number,
): Promise<void> {
  if (eligible.monitoring_point_form_id != null) {
    const formPatch = remapPatch(patch, {
      factory_name: 'factory_name',
      address: 'address',
      province_name: 'province_name',
      latitude: 'latitude',
      longitude: 'longitude',
      eia_assessment: 'eia_info',
      eia_other: 'eia_other',
      project_name: 'project_name',
      business_activity: 'business_activity',
    });
    if ('factory_type_sequence' in patch) {
      const factoryType = splitFactoryTypeSequence(patch.factory_type_sequence ?? null);
      Object.assign(formPatch, {
        factory_type_main: factoryType.factoryClass,
        factory_type_sub: factoryType.factorySubclass,
      });
    }
    if (Object.keys(formPatch).length > 0) {
      await trx('factory_monitoring_point_forms')
        .where('id', eligible.monitoring_point_form_id)
        .whereNull('deleted_at')
        .update({ ...formPatch, updated_by: actorUserId, updated_at: trx.fn.now() });
    }
  }
}

function remapPatch(
  patch: FactoryProfilePatch,
  columns: Partial<Record<ProfileField, string>>,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(patch).flatMap(([key, value]) => {
      const column = columns[key as ProfileField];
      return column ? [[column, value]] : [];
    }),
  );
}
