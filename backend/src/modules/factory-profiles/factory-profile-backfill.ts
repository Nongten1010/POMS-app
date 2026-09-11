import type { Knex } from 'knex';
import { ConflictError } from '../../shared/errors/AppError';
import {
  CONNECTION_REQUEST_EIA_ASSESSMENTS,
  deriveHasEiaFromAssessment,
} from '../connection-requests/connection-request-eia';
import {
  normalizeFactoryTypeSequence,
  splitFactoryTypeSequence,
} from '../eligible-factories/factory-type-sequence';

type Identifier = number | string;
type NullableText = string | null;

interface SharedFactoryData {
  factory_name: NullableText;
  address: NullableText;
  latitude: number | string | null;
  longitude: number | string | null;
  eia_assessment: NullableText;
  eia_other: NullableText;
  has_eia: boolean | number | null;
  project_name: NullableText;
}

interface EligibleFactoryData extends SharedFactoryData {
  province_name: NullableText;
  industrial_estate_name: NullableText;
  business_activity: NullableText;
  factory_type_sequence: NullableText;
}

export interface FactoryProfileBackfillCandidate extends EligibleFactoryData {
  eligible_factory_id: string;
  front_photos_json: NullableText;
  logo_json: NullableText;
}

export interface FactoryProfileBackfillSources {
  schemaReady: boolean;
  eligibleFactories: Array<
    EligibleFactoryData & {
      id: Identifier;
      source_factory_id: NullableText;
      factory_registration_no_new: NullableText;
      factory_registration_no_old: NullableText;
      monitoring_point_form_id: Identifier | null;
    }
  >;
  connectedPoints: Array<
    SharedFactoryData & {
      id: Identifier;
      eligible_factory_id: Identifier | null;
      factory_id: NullableText;
      factory_registration_no: NullableText;
      front_photos_json: NullableText;
      logo_json: NullableText;
    }
  >;
  forms: Array<
    Omit<SharedFactoryData, 'has_eia'> & {
      id: Identifier;
      province_name: NullableText;
      business_activity: NullableText;
      factory_type_main: NullableText;
      factory_type_sub: NullableText;
      factory_registration_no_new: NullableText;
      factory_registration_no_old: NullableText;
    }
  >;
  profiles: Array<FactoryProfileBackfillCandidate & { id: Identifier; revision: Identifier }>;
}

export interface FactoryProfileAuditConflict {
  code: string;
  eligibleFactoryIds: string[];
  connectedPointIds?: string[];
  formIds?: string[];
  profileIds?: string[];
  fields?: string[];
}

export interface FactoryProfileAuditReport {
  schemaReady: boolean;
  readyForCanonical: boolean;
  counts: {
    eligibleFactories: number;
    connectedPoints: number;
    linkedForms: number;
    existingProfiles: number;
    missingProfiles: number;
    seedableProfiles: number;
    identityCollisions: number;
    conflicts: number;
  };
  conflicts: FactoryProfileAuditConflict[];
}

interface BackfillPlan {
  report: FactoryProfileAuditReport;
  candidates: FactoryProfileBackfillCandidate[];
}

export interface FactoryProfileBackfillOptions {
  apply?: boolean;
  actorUserId?: number;
  batchSize?: number;
}

const SHARED_FIELDS = [
  'factory_name',
  'address',
  'latitude',
  'longitude',
  'eia_assessment',
  'eia_other',
  'has_eia',
  'project_name',
] as const;
const ELIGIBLE_ONLY_FIELDS = [
  'province_name',
  'industrial_estate_name',
  'business_activity',
  'factory_type_sequence',
] as const;
const ASSET_FIELDS = ['front_photos_json', 'logo_json'] as const;
const PROFILE_FIELDS = [...SHARED_FIELDS, ...ELIGIBLE_ONLY_FIELDS, ...ASSET_FIELDS] as const;
const FORM_FIELDS = [
  'factory_name',
  'address',
  'latitude',
  'longitude',
  'eia_assessment',
  'eia_other',
  'project_name',
  'province_name',
  'business_activity',
] as const;

// Sources are active current rows only. Request snapshots deliberately never participate.
// A point's updated_at can change for measurement data and is never used to choose a winner.
export function auditFactoryProfiles(sources: FactoryProfileBackfillSources): BackfillPlan {
  const conflicts: FactoryProfileAuditConflict[] = [];
  const blocked = new Set<string>();
  const addConflict = (conflict: FactoryProfileAuditConflict) => {
    conflicts.push(conflict);
    conflict.eligibleFactoryIds.forEach((id) => blocked.add(id));
  };
  const eligibleById = new Map(sources.eligibleFactories.map((row) => [identifier(row.id), row]));
  const pointsByEligible = groupBy(sources.connectedPoints, (row) =>
    row.eligible_factory_id === null ? null : identifier(row.eligible_factory_id),
  );
  const profilesByEligible = groupBy(sources.profiles, (row) =>
    identifier(row.eligible_factory_id),
  );
  const formsById = new Map(sources.forms.map((row) => [identifier(row.id), row]));
  const linkedEligibleByForm = groupBy(sources.eligibleFactories, (row) =>
    row.monitoring_point_form_id === null ? null : identifier(row.monitoring_point_form_id),
  );
  const aliases = new Map<string, Set<string>>();
  for (const eligible of sources.eligibleFactories) {
    for (const rawAlias of [
      eligible.source_factory_id,
      eligible.factory_registration_no_new,
      eligible.factory_registration_no_old,
    ]) {
      const alias = nonemptyAlias(rawAlias);
      if (alias === null) continue;
      const owners = aliases.get(alias) ?? new Set<string>();
      owners.add(identifier(eligible.id));
      aliases.set(alias, owners);
    }
  }
  // Some legacy point identifiers are absent from the current eligible aliases. They still
  // participate in API grouping, so duplicate ownership must block the cutover too.
  for (const point of sources.connectedPoints) {
    if (point.eligible_factory_id === null) continue;
    const ownerId = identifier(point.eligible_factory_id);
    if (!eligibleById.has(ownerId)) continue;
    for (const rawAlias of [point.factory_id, point.factory_registration_no]) {
      const alias = nonemptyAlias(rawAlias);
      if (alias === null) continue;
      const owners = aliases.get(alias) ?? new Set<string>();
      owners.add(ownerId);
      aliases.set(alias, owners);
    }
  }
  for (const owners of aliases.values()) {
    if (owners.size > 1)
      addConflict({ code: 'AMBIGUOUS_FACTORY_ALIAS', eligibleFactoryIds: sortIds([...owners]) });
  }
  for (const [formId, owners] of linkedEligibleByForm) {
    if (owners.length > 1)
      addConflict({
        code: 'AMBIGUOUS_FORM_LINK',
        formIds: [formId],
        eligibleFactoryIds: sortIds(owners.map((row) => identifier(row.id))),
      });
  }
  for (const point of sources.connectedPoints) {
    const eligibleId =
      point.eligible_factory_id === null ? null : identifier(point.eligible_factory_id);
    if (eligibleId === null || !eligibleById.has(eligibleId)) {
      addConflict({
        code: 'CONNECTED_POINT_MISSING_LINK',
        eligibleFactoryIds: eligibleId === null ? [] : [eligibleId],
        connectedPointIds: [identifier(point.id)],
      });
      continue;
    }
    const aliasOwners = new Set<string>();
    for (const alias of [point.factory_id, point.factory_registration_no]) {
      for (const owner of aliases.get(nonemptyAlias(alias) ?? '') ?? []) aliasOwners.add(owner);
    }
    if ([...aliasOwners].some((owner) => owner !== eligibleId)) {
      addConflict({
        code: 'CONNECTED_POINT_IDENTITY_MISMATCH',
        eligibleFactoryIds: sortIds([...new Set([eligibleId, ...aliasOwners])]),
        connectedPointIds: [identifier(point.id)],
      });
    }
  }
  const allCandidates: FactoryProfileBackfillCandidate[] = [];
  let missingProfiles = 0;
  for (const eligible of sources.eligibleFactories) {
    const eligibleId = identifier(eligible.id);
    const points = pointsByEligible.get(eligibleId) ?? [];
    const profiles = profilesByEligible.get(eligibleId) ?? [];
    if (profiles.length === 0) missingProfiles += 1;
    if (profiles.length > 1)
      addConflict({
        code: 'DUPLICATE_PROFILE_LINK',
        eligibleFactoryIds: [eligibleId],
        profileIds: profiles.map((row) => identifier(row.id)),
      });
    const firstPoint = points[0];
    for (const point of points) {
      const differingFields = differentFields(eligible, point, SHARED_FIELDS);
      if (differingFields.length)
        addConflict({
          code: 'CONNECTED_ELIGIBLE_MISMATCH',
          eligibleFactoryIds: [eligibleId],
          connectedPointIds: [identifier(point.id)],
          fields: differingFields,
        });
      if (point !== firstPoint) {
        const pointFields = differentFields(firstPoint, point, [...SHARED_FIELDS, ...ASSET_FIELDS]);
        if (pointFields.length)
          addConflict({
            code: 'CONNECTED_POINTS_MISMATCH',
            eligibleFactoryIds: [eligibleId],
            connectedPointIds: [identifier(firstPoint.id), identifier(point.id)],
            fields: pointFields,
          });
      }
    }
    if (eligible.monitoring_point_form_id !== null) {
      const formId = identifier(eligible.monitoring_point_form_id);
      const form = formsById.get(formId);
      if (!form) {
        addConflict({
          code: 'LINKED_FORM_MISSING',
          eligibleFactoryIds: [eligibleId],
          formIds: [formId],
        });
      } else {
        const fields = differentFields(eligible, form, FORM_FIELDS);
        // Form projection uses this domain representation (for example 88 -> 00088).
        // Compare that representation only; retain every stored value in the seed/profile.
        const eligibleType = splitFactoryTypeSequence(eligible.factory_type_sequence);
        const formType = normalizeFactoryTypeSequence(
          form.factory_type_main,
          form.factory_type_sub,
        );
        if (JSON.stringify(eligibleType) !== JSON.stringify(formType))
          fields.push('factory_type_sequence');
        fields.push(
          ...differentFields(eligible, form, [
            'factory_registration_no_new',
            'factory_registration_no_old',
          ]),
        );
        if (fields.length)
          addConflict({
            code: 'LINKED_FORM_MISMATCH',
            eligibleFactoryIds: [eligibleId],
            formIds: [formId],
            fields,
          });
      }
    }
    const candidate: FactoryProfileBackfillCandidate = {
      eligible_factory_id: eligibleId,
      factory_name: (firstPoint ?? eligible).factory_name,
      address: (firstPoint ?? eligible).address,
      latitude: (firstPoint ?? eligible).latitude,
      longitude: (firstPoint ?? eligible).longitude,
      eia_assessment: (firstPoint ?? eligible).eia_assessment,
      eia_other: (firstPoint ?? eligible).eia_other,
      has_eia: (firstPoint ?? eligible).has_eia,
      project_name: (firstPoint ?? eligible).project_name,
      province_name: eligible.province_name,
      industrial_estate_name: eligible.industrial_estate_name,
      business_activity: eligible.business_activity,
      factory_type_sequence: eligible.factory_type_sequence,
      front_photos_json: firstPoint?.front_photos_json ?? null,
      logo_json: firstPoint?.logo_json ?? null,
    };
    const invalidFields = invalidProfileFields(candidate);
    if (invalidFields.length)
      addConflict({
        code: 'INVALID_PROFILE_VALUE',
        eligibleFactoryIds: [eligibleId],
        fields: invalidFields,
      });
    if (profiles.length === 1) {
      const fields = differentFields(candidate, profiles[0], PROFILE_FIELDS);
      if (fields.length)
        addConflict({
          code: 'EXISTING_PROFILE_DRIFT',
          eligibleFactoryIds: [eligibleId],
          profileIds: [identifier(profiles[0].id)],
          fields,
        });
    } else if (profiles.length === 0) allCandidates.push(candidate);
  }
  const candidates = allCandidates
    .filter((candidate) => !blocked.has(candidate.eligible_factory_id))
    .sort((left, right) => compareIds(left.eligible_factory_id, right.eligible_factory_id));
  return {
    candidates,
    report: {
      schemaReady: sources.schemaReady,
      readyForCanonical: sources.schemaReady && missingProfiles === 0 && conflicts.length === 0,
      counts: {
        eligibleFactories: sources.eligibleFactories.length,
        connectedPoints: sources.connectedPoints.length,
        linkedForms: linkedEligibleByForm.size,
        existingProfiles: sources.profiles.filter((row) =>
          eligibleById.has(identifier(row.eligible_factory_id)),
        ).length,
        missingProfiles,
        seedableProfiles: candidates.length,
        identityCollisions: conflicts.filter((row) =>
          [
            'AMBIGUOUS_FACTORY_ALIAS',
            'CONNECTED_POINT_IDENTITY_MISMATCH',
            'AMBIGUOUS_FORM_LINK',
            'DUPLICATE_PROFILE_LINK',
          ].includes(row.code),
        ).length,
        conflicts: conflicts.length,
      },
      conflicts,
    },
  };
}

export function parseFactoryProfileBackfillOptions(args: string[]): FactoryProfileBackfillOptions {
  const options: FactoryProfileBackfillOptions = { apply: false, batchSize: 100 };
  const seen = new Set<string>();
  for (let index = 0; index < args.length; index += 1) {
    const name = args[index];
    if (seen.has(name)) throw new Error('Duplicate backfill option');
    seen.add(name);
    if (name === '--apply') options.apply = true;
    else if (name === '--dry-run') options.apply = false;
    else if (name === '--actor-id' || name === '--batch-size') {
      const value = args[++index];
      if (!value || !/^[1-9][0-9]*$/.test(value))
        throw new Error('Backfill options require positive integers');
      if (name === '--actor-id') options.actorUserId = Number(value);
      else options.batchSize = Number(value);
    } else throw new Error('Unknown backfill option');
  }
  if (seen.has('--apply') && seen.has('--dry-run'))
    throw new Error('Choose either apply or dry-run');
  validateOptions(options);
  return options;
}

export async function runFactoryProfileBackfill(
  database: Knex,
  options: FactoryProfileBackfillOptions = {},
): Promise<FactoryProfileAuditReport & { mode: 'dry-run' | 'applied'; insertedProfiles: number }> {
  const effective = { apply: false, batchSize: 100, ...options };
  validateOptions(effective);
  const profilesExist = await database.schema.hasTable('factory_profiles');
  const eventsExist = await database.schema.hasTable('factory_profile_events');
  // MSSQL hasTable reads INFORMATION_SCHEMA.TABLES, which includes views. Both
  // additive migrations are prerequisites: otherwise canonical SELECTs fail even
  // when every profile has been seeded successfully.
  const eligibleViewExists = await database.schema.hasTable('current_eligible_factories');
  const connectedViewExists = await database.schema.hasTable(
    'current_connected_measurement_points',
  );
  const formsViewExists = await database.schema.hasTable('current_factory_monitoring_point_forms');
  const requestRevisionExists = await database.schema.hasColumn(
    'poms_factory_edit_requests',
    'source_factory_profile_revision',
  );
  const connectionRevisionExists = await database.schema.hasColumn(
    'cems_wpms_connection_requests',
    'source_factory_profile_revision',
  );
  const schemaReady =
    profilesExist &&
    eventsExist &&
    eligibleViewExists &&
    connectedViewExists &&
    formsViewExists &&
    requestRevisionExists &&
    connectionRevisionExists;
  const initial = auditFactoryProfiles(
    await readSources(database, profilesExist, schemaReady, false),
  );
  if (!effective.apply) return { mode: 'dry-run', insertedProfiles: 0, ...initial.report };
  if (!schemaReady)
    throw new ConflictError('Backfill refused: canonical schema migration is required');
  assertNoConflicts(initial.report);
  return database.transaction(async (trx) => {
    // The full current source set is read again with range locks held through commit. Limiting
    // only writes preserves detection of aliases colliding outside the selected insert batch.
    const locked = auditFactoryProfiles(await readSources(trx, true, true, true));
    assertNoConflicts(locked.report);
    const actor = await trx('users')
      .where('id', effective.actorUserId)
      .whereNull('deleted_at')
      .first('id');
    if (!actor) throw new ConflictError('Backfill refused: actor does not exist');
    const candidates = locked.candidates.slice(0, effective.batchSize);
    for (const candidate of candidates) {
      const [inserted] = await trx('factory_profiles')
        .insert({
          ...candidate,
          revision: 1,
          created_by: effective.actorUserId,
          updated_by: effective.actorUserId,
        })
        .returning('id');
      await trx('factory_profile_events').insert({
        factory_profile_id: inserted.id,
        revision: 1,
        source: 'factory-profile-backfill',
        actor_user_id: effective.actorUserId,
        before_json: null,
        after_json: JSON.stringify({ ...candidate, revision: 1 }),
      });
    }
    const after = auditFactoryProfiles(await readSources(trx, true, true, true));
    assertNoConflicts(after.report);
    return { mode: 'applied' as const, insertedProfiles: candidates.length, ...after.report };
  });
}

function assertNoConflicts(report: FactoryProfileAuditReport): void {
  if (report.conflicts.length)
    throw new ConflictError(
      'Backfill refused: unresolved conflicts; use the dry-run report to resolve source records explicitly',
      report,
    );
}

function validateOptions(options: FactoryProfileBackfillOptions): void {
  const batchSize = options.batchSize ?? 100;
  if (!Number.isSafeInteger(batchSize) || batchSize < 1 || batchSize > 1000)
    throw new Error('Batch size must be 1 to 1000');
  if (
    (options.apply || options.actorUserId !== undefined) &&
    (!Number.isSafeInteger(options.actorUserId) || (options.actorUserId ?? 0) < 1)
  ) {
    throw new Error('Apply requires a positive actor user ID');
  }
}

async function readSources(
  executor: Knex | Knex.Transaction,
  profilesExist: boolean,
  schemaReady: boolean,
  lock: boolean,
): Promise<FactoryProfileBackfillSources> {
  const hint = lock ? ' WITH (UPDLOCK, HOLDLOCK)' : '';
  // Deliberately SELECT-only in dry-run. All identifiers are fixed literals, not user input.
  // CAST preserves MSSQL BIGINT IDs without a lossy JavaScript number conversion.
  const eligibleFactories = await executor.raw<FactoryProfileBackfillSources['eligibleFactories']>(`
    SELECT CAST(id AS VARCHAR(20)) AS id, source_factory_id, factory_registration_no_new,
      factory_registration_no_old, CAST(monitoring_point_form_id AS VARCHAR(20)) AS monitoring_point_form_id,
      factory_name, address, latitude, longitude, eia_assessment, eia_other, has_eia, project_name,
      province_name, industrial_estate_name, business_activity, factory_type_sequence
    FROM eligible_factories${hint} WHERE deleted_at IS NULL ORDER BY id`);
  const connectedPoints = await executor.raw<FactoryProfileBackfillSources['connectedPoints']>(`
    SELECT CAST(id AS VARCHAR(20)) AS id, CAST(eligible_factory_id AS VARCHAR(20)) AS eligible_factory_id,
      factory_id, factory_registration_no, factory_name, factory_address AS address,
      factory_latitude AS latitude, factory_longitude AS longitude, factory_eia_assessment AS eia_assessment,
      factory_eia_other AS eia_other, factory_has_eia AS has_eia, factory_project_name AS project_name,
      factory_front_photos_json AS front_photos_json, factory_logo_json AS logo_json
    FROM cems_wpms_connected_measurement_points${hint} WHERE deleted_at IS NULL ORDER BY id`);
  const forms = await executor.raw<FactoryProfileBackfillSources['forms']>(`
    SELECT CAST(id AS VARCHAR(20)) AS id, factory_name, factory_registration_no_new, factory_registration_no_old,
      address, province_name, latitude, longitude, eia_info AS eia_assessment, eia_other, project_name,
      business_activity, factory_type_main, factory_type_sub
    FROM factory_monitoring_point_forms${hint} WHERE deleted_at IS NULL ORDER BY id`);
  const profiles = profilesExist
    ? await executor.raw<FactoryProfileBackfillSources['profiles']>(`
    SELECT CAST(id AS VARCHAR(20)) AS id, CAST(eligible_factory_id AS VARCHAR(20)) AS eligible_factory_id,
      CAST(revision AS VARCHAR(20)) AS revision,
      factory_name, address, latitude, longitude, eia_assessment, eia_other, has_eia, project_name,
      province_name, industrial_estate_name, business_activity, factory_type_sequence, front_photos_json, logo_json
    FROM factory_profiles${hint} ORDER BY id`)
    : [];
  return { schemaReady, eligibleFactories, connectedPoints, forms, profiles };
}

function identifier(value: Identifier): string {
  if (
    (typeof value === 'number' && !Number.isSafeInteger(value)) ||
    !/^[1-9][0-9]*$/.test(String(value))
  ) {
    throw new Error('Backfill refused: invalid or unsafe internal identifier');
  }
  return String(value);
}

function compareIds(left: string, right: string): number {
  return BigInt(left) < BigInt(right) ? -1 : BigInt(left) > BigInt(right) ? 1 : 0;
}

function sortIds(ids: string[]): string[] {
  return ids.sort(compareIds);
}

function nonemptyAlias(value: NullableText): string | null {
  return value?.trim() || null;
}

function groupBy<T>(rows: T[], keyFor: (row: T) => string | null): Map<string, T[]> {
  const result = new Map<string, T[]>();
  for (const row of rows) {
    const key = keyFor(row);
    if (key === null) continue;
    const grouped = result.get(key) ?? [];
    grouped.push(row);
    result.set(key, grouped);
  }
  return result;
}

function differentFields<A, B>(
  left: A,
  right: B,
  fields: readonly (keyof A & keyof B & string)[],
): string[] {
  return fields.filter((field) => !sameValue(field, left[field], right[field]));
}

function sameValue(field: string, left: unknown, right: unknown): boolean {
  if (left === null || right === null || left === undefined || right === undefined)
    return left === right;
  if (field === 'latitude' || field === 'longitude') {
    return decimalValue(left) !== null && decimalValue(left) === decimalValue(right);
  }
  if (field === 'has_eia') return Number(left) === Number(right);
  if (field === 'factory_type_sequence' && typeof left === 'string' && typeof right === 'string') {
    return (
      JSON.stringify(splitFactoryTypeSequence(left)) ===
      JSON.stringify(splitFactoryTypeSequence(right))
    );
  }
  // Assets are intentionally compared as stored, retaining all raw differences for review.
  if (ASSET_FIELDS.includes(field as (typeof ASSET_FIELDS)[number])) return left === right;
  return typeof left === 'string' && typeof right === 'string'
    ? left.trim() === right.trim()
    : left === right;
}

function decimalValue(value: unknown): number | null {
  if (
    typeof value !== 'number' &&
    (typeof value !== 'string' || !/^[+-]?[0-9]+(?:\.[0-9]+)?$/.test(value.trim()))
  )
    return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function invalidProfileFields(candidate: FactoryProfileBackfillCandidate): string[] {
  const invalid: string[] = [];
  if (candidate.factory_name === null || candidate.factory_name.trim() === '')
    invalid.push('factory_name');
  if ((candidate.latitude === null) !== (candidate.longitude === null))
    invalid.push('latitude', 'longitude');
  for (const field of ['latitude', 'longitude'] as const) {
    const value = candidate[field];
    if (value === null) continue;
    const numeric = decimalValue(value);
    const maximum = field === 'latitude' ? 90 : 180;
    if (numeric === null || Math.abs(numeric) > maximum) invalid.push(field);
  }
  const assessment = CONNECTION_REQUEST_EIA_ASSESSMENTS.find(
    (value) => value === candidate.eia_assessment,
  );
  if (candidate.eia_assessment !== null && assessment === undefined) invalid.push('eia_assessment');
  if (candidate.has_eia !== null && ![true, false, 0, 1].includes(candidate.has_eia))
    invalid.push('has_eia');
  // Validate the writer's full-profile invariants without normalizing or discarding
  // stored values. Agreement between copies alone does not make a profile usable.
  if (candidate.eia_assessment === null || assessment !== undefined) {
    const expectedHasEia = assessment === undefined ? null : deriveHasEiaFromAssessment(assessment);
    if (!sameValue('has_eia', candidate.has_eia, expectedHasEia))
      invalid.push('eia_assessment', 'has_eia');
  }
  if (candidate.eia_assessment !== 'อื่นๆ' && candidate.eia_other !== null)
    invalid.push('eia_assessment', 'eia_other');
  for (const field of ASSET_FIELDS) {
    if (candidate[field] === null) continue;
    try {
      const parsed: unknown = JSON.parse(candidate[field]);
      if (
        field === 'front_photos_json'
          ? !Array.isArray(parsed)
          : parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)
      )
        invalid.push(field);
    } catch {
      invalid.push(field);
    }
  }
  return [...new Set(invalid)];
}
