import type { Knex } from 'knex';
import {
  resolveLegacyFactoryAddressNames,
  type FactoryAddressNamesInput,
} from '../../modules/eligible-factories/eligible-factory-source-hydration';
import { hasNumericFactoryAddressAreas } from '../../modules/eligible-factories/factory-address';
import { ADDRESS_NAMES_REPAIR_BACKUP } from './0149_create_factory_address_names_repair_backup';

// Resolve external master data before taking local locks. Each factory is repaired atomically.
export const config = { transaction: false };

interface AddressRow extends FactoryAddressNamesInput {
  id: number | string;
  eligibleFactoryId: number | string | null;
  revision?: number | string;
}

type TargetTable =
  | 'eligible_factories'
  | 'factory_profiles'
  | 'cems_wpms_connected_measurement_points'
  | 'factory_monitoring_point_forms'
  | 'cems_wpms_connection_requests';

interface Repair {
  table: TargetTable;
  row: AddressRow;
  address: string;
}

// Frozen event fields: history retains the full before/after profile, not display enrichment.
const PROFILE_FIELDS = [
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

export async function up(knex: Knex): Promise<void> {
  const targets = await loadTargets(knex);
  const pending = targets.flatMap(({ table, rows }) =>
    rows
      .filter((row) => hasNumericFactoryAddressAreas(row.address))
      .map((row) => ({ ...row, table })),
  );
  // A failed/missing/ambiguous lookup must not mark a partially repaired migration complete.
  const resolved = await resolveLegacyFactoryAddressNames(pending, { strict: true });
  const groups = new Map<string, Repair[]>();
  resolved.forEach((row, index) => {
    const original = pending[index];
    if (!row.address || row.address === original.address) return;
    const key =
      row.eligibleFactoryId == null ? `${row.table}:${row.id}` : `factory:${row.eligibleFactoryId}`;
    const group = groups.get(key) ?? [];
    group.push({ table: row.table, row: original, address: row.address });
    groups.set(key, group);
  });
  for (const repairs of groups.values()) {
    await knex.transaction(async (trx) => {
      for (const repair of repairs) await applyRepair(trx, repair);
    });
  }
}

async function applyRepair(trx: Knex.Transaction, { table, row, address }: Repair): Promise<void> {
  const column = table === 'cems_wpms_connected_measurement_points' ? 'factory_address' : 'address';
  const backup = await trx(ADDRESS_NAMES_REPAIR_BACKUP)
    .where({ target_table: table, entity_id: row.id })
    .first();
  if (backup)
    throw new Error(`Address changed after its repair: ${table}:${row.id}; review before retrying`);
  const query = trx(table).where('id', row.id).where(column, row.address);
  // Keep point timestamps: they choose the current legacy profile among connected rows.
  const patch: Record<string, unknown> = { [column]: address };
  let nextRevision: string | null = null;
  if (table === 'factory_profiles') {
    nextRevision = (BigInt(String(row.revision)) + 1n).toString();
    query.where('revision', row.revision);
    patch.revision = nextRevision;
    patch.updated_at = trx.fn.now();
  } else {
    query.whereNull('deleted_at');
  }
  const updated = await query.update(patch);
  if (updated !== 1)
    throw new Error(`Address changed during repair: ${table}:${row.id}; retry migration`);
  await trx(ADDRESS_NAMES_REPAIR_BACKUP).insert({
    target_table: table,
    entity_id: row.id,
    original_address: row.address,
    resolved_address: address,
    original_revision: row.revision ?? null,
    resolved_revision: nextRevision,
  });
  if (table === 'factory_profiles') {
    const values = Object.fromEntries(
      PROFILE_FIELDS.map((field) => [field, Reflect.get(row, field) ?? null]),
    );
    await trx('factory_profile_events').insert({
      factory_profile_id: row.id,
      revision: nextRevision,
      source: 'address-area-names-backfill-0150',
      actor_user_id: null,
      before_json: JSON.stringify(values),
      after_json: JSON.stringify({ ...values, address }),
      created_at: trx.fn.now(),
    });
  }
}

async function loadTargets(knex: Knex): Promise<Array<{ table: TargetTable; rows: AddressRow[] }>> {
  // Base tables intentionally bypass FACTORY_PROFILE_MODE so both read modes are repaired.
  const eligible = await knex<AddressRow>('eligible_factories as ef')
    .whereNull('ef.deleted_at')
    .select(
      'ef.id',
      'ef.id as eligibleFactoryId',
      'ef.address',
      'ef.province_name as provinceName',
      'ef.source_factory_id as sourceFactoryId',
      'ef.factory_registration_no_new as factoryRegistrationNoNew',
    );
  const profiles = await knex<AddressRow>('factory_profiles as fp')
    .innerJoin('eligible_factories as ef', 'ef.id', 'fp.eligible_factory_id')
    .whereNull('ef.deleted_at')
    .select(
      'fp.*',
      'ef.id as eligibleFactoryId',
      'fp.province_name as provinceName',
      'ef.source_factory_id as sourceFactoryId',
      'ef.factory_registration_no_new as factoryRegistrationNoNew',
    );
  const connected = await knex<AddressRow>('cems_wpms_connected_measurement_points as cp')
    .innerJoin('eligible_factories as ef', 'ef.id', 'cp.eligible_factory_id')
    .whereNull('cp.deleted_at')
    .whereNull('ef.deleted_at')
    .select(
      'cp.id',
      'ef.id as eligibleFactoryId',
      'cp.factory_address as address',
      'ef.province_name as provinceName',
      'cp.factory_id as sourceFactoryId',
      'cp.factory_registration_no as factoryRegistrationNoNew',
    );
  const forms = await knex<AddressRow>('factory_monitoring_point_forms as form')
    .leftJoin('eligible_factories as ef', function joinEligible() {
      this.on('ef.monitoring_point_form_id', '=', 'form.id').andOnNull('ef.deleted_at');
    })
    .whereNull('form.deleted_at')
    .select(
      'form.id',
      'ef.id as eligibleFactoryId',
      'form.address',
      'form.province_name as provinceName',
      'ef.source_factory_id as sourceFactoryId',
      'form.factory_registration_no_new as factoryRegistrationNoNew',
    );
  const requests = await knex<AddressRow>('cems_wpms_connection_requests as req')
    .leftJoin('eligible_factories as ef', function joinEligible() {
      this.on('ef.id', '=', 'req.eligible_factory_id').andOnNull('ef.deleted_at');
    })
    .whereNull('req.deleted_at')
    .whereNotIn('req.status', ['CANCELED', 'REJECTED'])
    .select(
      'req.id',
      'ef.id as eligibleFactoryId',
      'req.address',
      'ef.province_name as provinceName',
      'req.factory_id as sourceFactoryId',
      'req.factory_registration_no as factoryRegistrationNoNew',
    );
  return [
    { table: 'eligible_factories', rows: eligible },
    { table: 'factory_profiles', rows: profiles },
    { table: 'cems_wpms_connected_measurement_points', rows: connected },
    { table: 'factory_monitoring_point_forms', rows: forms },
    { table: 'cems_wpms_connection_requests', rows: requests },
  ];
}

export async function down(): Promise<void> {
  // Never silently reintroduce numeric place names or rewind canonical revisions/history.
  throw new Error(
    'Address-name data repair is irreversible; retain backups and use a reviewed forward migration',
  );
}
