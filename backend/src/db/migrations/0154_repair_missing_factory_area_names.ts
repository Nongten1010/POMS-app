import type { Knex } from 'knex';
import { env } from '../../config/env';
import { factorySourceDb } from '../../config/factory-source-database';
import {
  AREA_NAME_FIELDS_0154,
  isBlankAreaName0154,
  localProvinceCodes0154,
  resolveMissingFactoryAreaNames0154,
  type AreaMaster0154,
  type AreaNameField0154,
  type AreaRepairEvidence0154,
} from '../data-repairs/factory-area-names-0154';
import { FACTORY_AREA_NAMES_BACKUP } from './0153_create_factory_area_names_repair_backup';

export const config = { transaction: false };
const TARGET_TABLES = [
  'eligible_factories',
  'factory_profiles',
  'factory_monitoring_point_forms',
  'cems_wpms_request_factory_snapshots',
  'eligible_factory_add_requests',
] as const;
const SNAPSHOTS = 'cems_wpms_request_factory_snapshots';
const REQUESTS = 'cems_wpms_connection_requests';
const PARENT_CONTEXT_FIELDS = [
  'id',
  'address',
  'factory_id',
  'factory_registration_no',
  'request_no',
  'status',
  'created_at',
  'updated_at',
  'deleted_at',
];
interface Column {
  TABLE_NAME: string;
  COLUMN_NAME: string;
  ORDINAL_POSITION: number;
}
interface StoredRow extends Record<string, unknown> {
  id: number | string;
  request_id?: number | string | null;
  repair_row_json: string;
  repair_row_hash: string;
  repair_unchanged_hash: string;
  deleted_at_exact?: string | null;
}
interface RequestContext extends Record<string, unknown> {
  id: number | string;
  address?: string | null;
  repair_context_json: string;
}
interface Plan {
  table: (typeof TARGET_TABLES)[number];
  columns: string[];
  fields: AreaNameField0154[];
  original: StoredRow;
  parent: RequestContext | null;
  proof: AreaRepairEvidence0154;
}

/** Dynamic inventory is verified against a frozen resolver; no current Fac60k location is used. */
export async function up(knex: Knex): Promise<void> {
  const metadata = await knex<Column>('INFORMATION_SCHEMA.COLUMNS as c')
    .join('INFORMATION_SCHEMA.TABLES as t', function physicalTables() {
      this.on('t.TABLE_SCHEMA', '=', 'c.TABLE_SCHEMA').andOn('t.TABLE_NAME', '=', 'c.TABLE_NAME');
    })
    .where('c.TABLE_SCHEMA', 'dbo')
    .where('t.TABLE_TYPE', 'BASE TABLE')
    .whereIn('c.TABLE_NAME', [...TARGET_TABLES, REQUESTS])
    .select('c.TABLE_NAME', 'c.COLUMN_NAME', 'c.ORDINAL_POSITION')
    .orderBy('c.TABLE_NAME')
    .orderBy('c.ORDINAL_POSITION');
  const columnsFor = (table: string) =>
    metadata.filter((column) => column.TABLE_NAME === table).map((column) => column.COLUMN_NAME);
  const requestColumns = PARENT_CONTEXT_FIELDS.filter((field) =>
    columnsFor(REQUESTS).includes(field),
  );
  const parentRows = requestColumns.includes('id')
    ? await loadRequestContexts(knex, requestColumns)
    : [];
  const parents = new Map(parentRows.map((row) => [String(row.id), row]));
  // Complete external reads before entering any local write transaction.
  const areas = await factorySourceDb<AreaMaster0154>(`${env.FACTORY_DB_SCHEMA}.TUMBOL`)
    .select('PROV', 'AMP', 'TUMBOL', 'AMPNAME', 'TUMNAME')
    .timeout(30000);
  const localProvinces = localProvinceCodes0154(
    await knex<{ id: number | string; name_th: string }>('provinces').select('id', 'name_th'),
  );
  const plans: Plan[] = [];
  for (const table of TARGET_TABLES) {
    const columns = columnsFor(table);
    const fields = AREA_NAME_FIELDS_0154.filter((field) => columns.includes(field));
    if (!columns.includes('id') || !fields.length) continue;
    // JavaScript trim covers tabs/newlines/NBSP, unlike SQL Server LTRIM/RTRIM.
    const rows = await storedRowQuery(knex, table, columns);
    for (const original of rows.filter((row) =>
      fields.some((field) => isBlankAreaName0154(row[field])),
    )) {
      const parent =
        table === SNAPSHOTS ? (parents.get(String(original.request_id)) ?? null) : null;
      const proof = resolveMissingFactoryAreaNames0154(
        evidenceRow(table, original, parent),
        fields,
        areas,
        localProvinces,
      );
      if (proof.conflicts.length || !Object.keys(proof.patch).length) continue;
      plans.push({ table, columns, fields, original, parent, proof });
    }
  }
  for (const plan of plans) {
    await knex.transaction(async (trx) => {
      let parent: RequestContext | null = null;
      if (plan.table === SNAPSHOTS) {
        if (plan.original.request_id == null) throw changed(plan, 'REQUEST_CONTEXT_MISSING');
        parent = await loadRequestContexts(
          trx,
          requestColumns,
          plan.original.request_id,
          true,
        ).then((rows) => rows[0] ?? null);
        if (!parent || parent.repair_context_json !== plan.parent?.repair_context_json) {
          throw changed(plan, 'REQUEST_CONTEXT_CHANGED');
        }
      }
      const current = await storedRowQuery(trx, plan.table, plan.columns, true)
        .where('row.id', plan.original.id)
        .first();
      if (!current || current.repair_row_hash !== plan.original.repair_row_hash)
        throw changed(plan, 'ROW_CHANGED');
      const proof = resolveMissingFactoryAreaNames0154(
        evidenceRow(plan.table, current, parent),
        plan.fields,
        areas,
        localProvinces,
      );
      if (
        proof.conflicts.length ||
        JSON.stringify(proof.patch) !== JSON.stringify(plan.proof.patch)
      ) {
        throw changed(plan, 'RESOLUTION_CONTEXT_CHANGED');
      }
      for (const field of Object.keys(proof.patch)) {
        if (!isBlankAreaName0154(current[field])) throw changed(plan, 'NAME_NO_LONGER_BLANK');
      }
      const previous = await trx(FACTORY_AREA_NAMES_BACKUP)
        .where({ target_table: plan.table, entity_id: current.id })
        .first('entity_id');
      if (previous) throw changed(plan, 'BACKUP_ALREADY_EXISTS');
      await trx(FACTORY_AREA_NAMES_BACKUP).insert({
        target_table: plan.table,
        entity_id: current.id,
        request_id: plan.table === SNAPSHOTS ? current.request_id : null,
        original_row_json: current.repair_row_json,
        original_context_json: JSON.stringify({
          record: evidenceRow(plan.table, current, parent),
          request: parent ? JSON.parse(parent.repair_context_json) : null,
          verification: proof,
        }),
        resolved_names_json: JSON.stringify(proof.patch),
        original_row_hash: current.repair_row_hash,
        unchanged_columns_hash: current.repair_unchanged_hash,
      });
      const hash = rowHashSql(plan.columns);
      const update = trx(plan.table)
        .where('id', current.id)
        .whereRaw(`${hash.sql} = ?`, [...hash.bindings, current.repair_row_hash]);
      // The locked blank check and full-row hash protect the exact original whitespace value.
      const affected = await update.update(proof.patch);
      if (affected !== 1) throw changed(plan, 'COMPARE_AND_SET_FAILED');
      const after = await storedRowQuery(trx, plan.table, plan.columns, true)
        .where('row.id', current.id)
        .first();
      if (
        !after ||
        after.repair_unchanged_hash !== current.repair_unchanged_hash ||
        Object.entries(proof.patch).some(([field, value]) => after[field] !== value) ||
        plan.fields.some(
          (field) => !Object.hasOwn(proof.patch, field) && after[field] !== current[field],
        )
      ) {
        throw changed(plan, 'UNRELATED_COLUMNS_CHANGED');
      }
    });
  }
}

function rowJsonSql(columns: string[], alias?: string): { sql: string; bindings: string[] } {
  return {
    sql: `(SELECT ${columns.map(() => '??').join(', ')} FOR JSON PATH, INCLUDE_NULL_VALUES, WITHOUT_ARRAY_WRAPPER)`,
    bindings: columns.map((column) => (alias ? `${alias}.${column}` : column)),
  };
}
function rowHashSql(columns: string[], alias?: string): { sql: string; bindings: string[] } {
  const json = rowJsonSql(columns, alias);
  return {
    sql: `CONVERT(VARCHAR(64), HASHBYTES('SHA2_256', ${json.sql}), 2)`,
    bindings: json.bindings,
  };
}
function storedRowQuery(knex: Knex, table: string, columns: string[], lock = false) {
  const row = rowJsonSql(columns, 'row'),
    hash = rowHashSql(columns, 'row');
  const unchanged = rowHashSql(
    columns.filter((column) => !AREA_NAME_FIELDS_0154.some((field) => field === column)),
    'row',
  );
  const query = knex<StoredRow, StoredRow[]>(
    knex.raw(lock ? '?? AS ?? WITH (UPDLOCK, ROWLOCK)' : '?? AS ??', [table, 'row']),
  );
  query
    .select(columns.map((column) => `row.${column}`))
    .select(knex.raw(`${row.sql} AS repair_row_json`, row.bindings))
    .select(knex.raw(`${hash.sql} AS repair_row_hash`, hash.bindings))
    .select(knex.raw(`${unchanged.sql} AS repair_unchanged_hash`, unchanged.bindings));
  for (const field of ['created_at', 'updated_at', 'deleted_at']) {
    if (columns.includes(field))
      query.select(
        knex.raw('CONVERT(VARCHAR(33), ??, 126) AS ??', [`row.${field}`, `${field}_exact`]),
      );
  }
  return query;
}
async function loadRequestContexts(
  knex: Knex,
  columns: string[],
  requestId?: number | string,
  lock = false,
): Promise<RequestContext[]> {
  const context = rowJsonSql(columns, 'request');
  const query = knex<RequestContext, RequestContext[]>(
    knex.raw(lock ? '?? AS ?? WITH (UPDLOCK, ROWLOCK)' : '?? AS ??', [REQUESTS, 'request']),
  );
  query
    .select(columns.map((column) => `request.${column}`))
    .select(knex.raw(`${context.sql} AS repair_context_json`, context.bindings));
  if (requestId != null) query.where('request.id', requestId);
  return query;
}
function evidenceRow(
  table: string,
  row: StoredRow,
  parent: RequestContext | null,
): Record<string, unknown> {
  const result: Record<string, unknown> = { table };
  for (const field of [
    'id',
    'request_id',
    'province_name',
    'district_name',
    'subdistrict_name',
    'province_code',
    'district_code',
    'subdistrict_code',
    'address',
    'factory_address',
    'created_at_exact',
    'updated_at_exact',
    'deleted_at_exact',
    'status',
  ])
    if (Object.hasOwn(row, field)) result[field] = row[field];
  if (table === SNAPSHOTS && row.deleted_at_exact == null)
    result.request_address = parent?.address ?? null;
  return result;
}
function changed(plan: Plan, reason: string): Error {
  return new Error(
    `FACTORY_AREA_REPAIR_${reason}: ${plan.table}:${plan.original.id}; review before retrying`,
  );
}
export async function down(): Promise<void> {
  throw new Error(
    'Factory area name repair is irreversible; retain backups and use a reviewed forward migration',
  );
}
