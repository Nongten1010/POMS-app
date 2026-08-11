import type { Knex } from 'knex';
import { env } from '../../config/env';
import { factorySourceDb, factorySourceTableName } from '../../config/factory-source-database';

const BACKUP_TABLE = 'eligible_factory_industrial_estate_cleanup_0090';
const CONNECTED_POINTS_TABLE = 'cems_wpms_connected_measurement_points';
const EXTERNAL_QUERY_TIMEOUT_MS = 300000;
const LOOKUP_CHUNK_SIZE = 500;
const UPDATE_BATCH_SIZE = 500;
const MAX_INDUSTRIAL_ESTATE_NAME_LENGTH = 255;

interface EligibleFactoryIndustrialEstateRow {
  id: number | string;
  source_factory_id: string | null;
  factory_registration_no_new: string;
  industrial_estate_name: string | null;
}

interface FactorySourceIndustrialEstateRow {
  FID: string | null;
  FACREG: string | null;
  DISPFACREG: string | null;
  COLONY_INDUST_CODE: string | null;
}

interface IndustrialEstateDescriptionRow {
  COLONY_INDUST_CODE: string | null;
  COLONY_INDUST_DESC: string | null;
}

interface ConnectedEligibleFactoryRow {
  eligible_factory_id: number | string;
}

interface BackupRow {
  eligible_factory_id: number | string;
  original_industrial_estate_name: string | null;
  backfilled_industrial_estate_name: string;
}

interface FactorySourceIndexEntry {
  row: FactorySourceIndustrialEstateRow;
  industrialEstateCode: string | null;
  hasIndustrialEstateConflict: boolean;
}

interface FactorySourceIndexes {
  byFid: Map<string, FactorySourceIndexEntry>;
  byFacreg: Map<string, FactorySourceIndexEntry>;
  byDisplayFacreg: Map<string, FactorySourceIndexEntry>;
}

interface FactorySourceResolution {
  row: FactorySourceIndustrialEstateRow | null;
  hasIndustrialEstateConflict: boolean;
}

export interface IndustrialEstateBackfillUpdate {
  eligibleFactoryId: number | string;
  originalIndustrialEstateName: string | null;
  industrialEstateCode: string;
  industrialEstateName: string;
  isConnectedPomsFactory: boolean;
}

export interface IndustrialEstateBackfillUnresolved {
  eligibleFactoryId: number | string;
  reason:
    | 'source_factory_not_found'
    | 'source_factory_conflict'
    | 'industrial_estate_description_not_found'
    | 'industrial_estate_name_too_long';
  isConnectedPomsFactory: boolean;
}

export interface IndustrialEstateBackfillPlan {
  updates: IndustrialEstateBackfillUpdate[];
  noIndustrialEstateEligibleFactoryIds: Array<number | string>;
  unresolved: IndustrialEstateBackfillUnresolved[];
}

export async function up(knex: Knex): Promise<void> {
  const eligibleRows = await loadEligibleFactoriesWithBlankIndustrialEstate(knex);
  if (eligibleRows.length === 0) return;

  const connectedEligibleFactoryIds = await loadConnectedEligibleFactoryIds(knex, eligibleRows);
  const sourceRows = await loadFactorySourceRows(eligibleRows);
  const industrialEstateNamesByCode = await loadIndustrialEstateNamesByCode(sourceRows);
  const plan = buildIndustrialEstateBackfillPlan({
    eligibleRows,
    sourceRows,
    industrialEstateNamesByCode,
    connectedEligibleFactoryIds,
  });

  assertResolvableBackfillPlan(plan);
  if (plan.updates.length === 0) return;

  await ensureBackupTable(knex);
  await knex.transaction(async (trx) => {
    for (const updateBatch of chunks(plan.updates, UPDATE_BATCH_SIZE)) {
      const { sql, bindings } = buildBatchUpdate(updateBatch);
      await trx.raw(sql, bindings);
    }
  });
}

export async function down(knex: Knex): Promise<void> {
  const hasBackupTable = await knex.schema.hasTable(BACKUP_TABLE);
  if (!hasBackupTable) return;

  await knex.transaction(async (trx) => {
    const backups = await trx<BackupRow>(BACKUP_TABLE).select(
      'eligible_factory_id',
      'original_industrial_estate_name',
      'backfilled_industrial_estate_name',
    );

    for (const backup of backups) {
      const restoredCount = await trx('eligible_factories')
        .where('id', backup.eligible_factory_id)
        .where('industrial_estate_name', backup.backfilled_industrial_estate_name)
        .update({
          industrial_estate_name: backup.original_industrial_estate_name,
          updated_at: trx.fn.now(),
        });

      if (Number(restoredCount) > 0) {
        await trx(BACKUP_TABLE).where('eligible_factory_id', backup.eligible_factory_id).del();
      }
    }

    await trx.raw(`IF NOT EXISTS (SELECT 1 FROM [${BACKUP_TABLE}])
                   DROP TABLE [${BACKUP_TABLE}];`);
  });
}

export function buildIndustrialEstateBackfillPlan(args: {
  eligibleRows: EligibleFactoryIndustrialEstateRow[];
  sourceRows: FactorySourceIndustrialEstateRow[];
  industrialEstateNamesByCode: Map<string, string>;
  connectedEligibleFactoryIds: Set<string>;
}): IndustrialEstateBackfillPlan {
  const sourceIndexes = indexFactorySourceRows(args.sourceRows);
  const plan: IndustrialEstateBackfillPlan = {
    updates: [],
    noIndustrialEstateEligibleFactoryIds: [],
    unresolved: [],
  };

  for (const eligibleRow of args.eligibleRows) {
    if (normalizeText(eligibleRow.industrial_estate_name)) continue;

    const eligibleFactoryId = eligibleRow.id;
    const isConnectedPomsFactory = args.connectedEligibleFactoryIds.has(String(eligibleFactoryId));
    const sourceResolution = findFactorySourceRow(eligibleRow, sourceIndexes);
    if (!sourceResolution.row) {
      plan.unresolved.push({
        eligibleFactoryId,
        reason: 'source_factory_not_found',
        isConnectedPomsFactory,
      });
      continue;
    }
    if (sourceResolution.hasIndustrialEstateConflict) {
      plan.unresolved.push({
        eligibleFactoryId,
        reason: 'source_factory_conflict',
        isConnectedPomsFactory,
      });
      continue;
    }

    const industrialEstateCode = normalizeText(sourceResolution.row.COLONY_INDUST_CODE);
    if (!industrialEstateCode) {
      plan.noIndustrialEstateEligibleFactoryIds.push(eligibleFactoryId);
      continue;
    }

    const industrialEstateName = normalizeText(
      args.industrialEstateNamesByCode.get(industrialEstateCode),
    );
    if (!industrialEstateName) {
      plan.unresolved.push({
        eligibleFactoryId,
        reason: 'industrial_estate_description_not_found',
        isConnectedPomsFactory,
      });
      continue;
    }
    if (industrialEstateName.length > MAX_INDUSTRIAL_ESTATE_NAME_LENGTH) {
      plan.unresolved.push({
        eligibleFactoryId,
        reason: 'industrial_estate_name_too_long',
        isConnectedPomsFactory,
      });
      continue;
    }

    plan.updates.push({
      eligibleFactoryId,
      originalIndustrialEstateName: eligibleRow.industrial_estate_name,
      industrialEstateCode,
      industrialEstateName,
      isConnectedPomsFactory,
    });
  }

  return plan;
}

async function loadEligibleFactoriesWithBlankIndustrialEstate(
  knex: Knex,
): Promise<EligibleFactoryIndustrialEstateRow[]> {
  return knex<EligibleFactoryIndustrialEstateRow>('eligible_factories')
    .whereNull('deleted_at')
    .where((builder) => {
      builder
        .whereNull('industrial_estate_name')
        .orWhereRaw("LTRIM(RTRIM(industrial_estate_name)) = N''");
    })
    .select('id', 'source_factory_id', 'factory_registration_no_new', 'industrial_estate_name');
}

async function loadConnectedEligibleFactoryIds(
  knex: Knex,
  eligibleRows: EligibleFactoryIndustrialEstateRow[],
): Promise<Set<string>> {
  const result = new Set<string>();
  for (const idChunk of chunks(
    eligibleRows.map((row) => row.id),
    LOOKUP_CHUNK_SIZE,
  )) {
    const rows = await knex<ConnectedEligibleFactoryRow>(CONNECTED_POINTS_TABLE)
      .whereNull('deleted_at')
      .whereIn('eligible_factory_id', idChunk)
      .distinct('eligible_factory_id');
    for (const row of rows) result.add(String(row.eligible_factory_id));
  }
  return result;
}

async function loadFactorySourceRows(
  eligibleRows: EligibleFactoryIndustrialEstateRow[],
): Promise<FactorySourceIndustrialEstateRow[]> {
  const result: FactorySourceIndustrialEstateRow[] = [];
  for (const keyChunk of chunks(factorySourceKeys(eligibleRows), LOOKUP_CHUNK_SIZE)) {
    const rows = await factorySourceDb<FactorySourceIndustrialEstateRow>(factorySourceTableName())
      .where((builder) => {
        builder
          .whereIn('FID', keyChunk)
          .orWhereIn('DISPFACREG', keyChunk)
          .orWhereIn('FACREG', keyChunk);
      })
      .timeout(EXTERNAL_QUERY_TIMEOUT_MS)
      .select('FID', 'FACREG', 'DISPFACREG', 'COLONY_INDUST_CODE');
    result.push(...rows);
  }
  return result;
}

async function loadIndustrialEstateNamesByCode(
  sourceRows: FactorySourceIndustrialEstateRow[],
): Promise<Map<string, string>> {
  const codes = uniqueText(sourceRows.map((row) => row.COLONY_INDUST_CODE));
  const result = new Map<string, string>();

  for (const codeChunk of chunks(codes, LOOKUP_CHUNK_SIZE)) {
    const rows = await factorySourceDb<IndustrialEstateDescriptionRow>(
      `${env.FACTORY_DB_SCHEMA}.FAC_COLONY_INDUST`,
    )
      .whereIn('COLONY_INDUST_CODE', codeChunk)
      .timeout(EXTERNAL_QUERY_TIMEOUT_MS)
      .select('COLONY_INDUST_CODE', 'COLONY_INDUST_DESC');

    for (const row of rows) {
      const code = normalizeText(row.COLONY_INDUST_CODE);
      const name = normalizeText(row.COLONY_INDUST_DESC);
      if (code && name && !result.has(code)) result.set(code, name);
    }
  }

  return result;
}

function assertResolvableBackfillPlan(plan: IndustrialEstateBackfillPlan): void {
  const connectedUnresolved = plan.unresolved.filter((row) => row.isConnectedPomsFactory);
  if (connectedUnresolved.length === 0) return;

  const identifiers = connectedUnresolved
    .slice(0, 50)
    .map((row) => `${row.eligibleFactoryId}:${row.reason}`)
    .join(',');
  throw new Error(
    `ELIGIBLE_FACTORY_INDUSTRIAL_ESTATE_BACKFILL_FAILED: connected_unresolved=${connectedUnresolved.length}; total_unresolved=${plan.unresolved.length}; eligible_factory_ids=${identifiers}`,
  );
}

function buildBatchUpdate(updates: IndustrialEstateBackfillUpdate[]): {
  sql: string;
  bindings: Array<number | string>;
} {
  const valuesSql = updates.map(() => '(?, ?, ?)').join(', ');
  const bindings = updates.flatMap((update) => [
    update.eligibleFactoryId,
    update.industrialEstateName,
    update.industrialEstateCode,
  ]);
  return {
    sql: `UPDATE target
          SET industrial_estate_name = source.backfilled_industrial_estate_name,
              updated_at = SYSUTCDATETIME()
          OUTPUT INSERTED.id,
                 DELETED.industrial_estate_name,
                 INSERTED.industrial_estate_name,
                 source.source_industrial_estate_code
          INTO [${BACKUP_TABLE}]
            (eligible_factory_id,
             original_industrial_estate_name,
             backfilled_industrial_estate_name,
             source_industrial_estate_code)
          FROM [eligible_factories] AS target
          INNER JOIN (VALUES ${valuesSql}) AS source
            (eligible_factory_id,
             backfilled_industrial_estate_name,
             source_industrial_estate_code)
            ON source.eligible_factory_id = target.id
          WHERE target.deleted_at IS NULL
            AND NULLIF(LTRIM(RTRIM(target.industrial_estate_name)), N'') IS NULL
            AND NOT EXISTS (
              SELECT 1
              FROM [${BACKUP_TABLE}] AS existing_backup
              WHERE existing_backup.eligible_factory_id = target.id
            );`,
    bindings,
  };
}

export function buildIndustrialEstateBatchUpdateForTests(
  updates: IndustrialEstateBackfillUpdate[],
): { sql: string; bindings: Array<number | string> } {
  return buildBatchUpdate(updates);
}

function indexFactorySourceRows(rows: FactorySourceIndustrialEstateRow[]): FactorySourceIndexes {
  const result: FactorySourceIndexes = {
    byFid: new Map(),
    byFacreg: new Map(),
    byDisplayFacreg: new Map(),
  };
  for (const row of rows) {
    addFirst(result.byFid, row.FID, row);
    addFirst(result.byFacreg, row.FACREG, row);
    addFirst(result.byDisplayFacreg, row.DISPFACREG, row);
  }
  return result;
}

function findFactorySourceRow(
  row: EligibleFactoryIndustrialEstateRow,
  sourceIndexes: FactorySourceIndexes,
): FactorySourceResolution {
  const sourceFactoryId = normalizeText(row.source_factory_id);
  const registrationNo = normalizeText(row.factory_registration_no_new);
  const entries = [
    sourceFactoryId ? sourceIndexes.byFid.get(sourceFactoryId) : undefined,
    registrationNo ? sourceIndexes.byDisplayFacreg.get(registrationNo) : undefined,
    registrationNo ? sourceIndexes.byFacreg.get(registrationNo) : undefined,
    registrationNo ? sourceIndexes.byFid.get(registrationNo) : undefined,
  ].filter((entry): entry is FactorySourceIndexEntry => Boolean(entry));
  const entry = entries[0] ?? null;
  const matchedIndustrialEstateCodes = new Set(
    entries.map((candidate) => candidate.industrialEstateCode),
  );
  return entry
    ? {
        row: entry.row,
        hasIndustrialEstateConflict:
          entries.some((candidate) => candidate.hasIndustrialEstateConflict) ||
          matchedIndustrialEstateCodes.size > 1,
      }
    : { row: null, hasIndustrialEstateConflict: false };
}

function factorySourceKeys(rows: EligibleFactoryIndustrialEstateRow[]): string[] {
  return uniqueText(
    rows.flatMap((row) => [row.source_factory_id, row.factory_registration_no_new]),
  );
}

function addFirst(
  index: Map<string, FactorySourceIndexEntry>,
  rawKey: string | null,
  row: FactorySourceIndustrialEstateRow,
): void {
  const key = normalizeText(rawKey);
  if (!key) return;

  const industrialEstateCode = normalizeText(row.COLONY_INDUST_CODE);
  const existing = index.get(key);
  if (!existing) {
    index.set(key, {
      row,
      industrialEstateCode,
      hasIndustrialEstateConflict: false,
    });
    return;
  }
  if (existing.industrialEstateCode !== industrialEstateCode) {
    existing.hasIndustrialEstateConflict = true;
  }
}

function uniqueText(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.map(normalizeText).filter((value): value is string => Boolean(value)))];
}

function normalizeText(value: string | null | undefined): string | null {
  const text = value?.trim();
  return text ? text : null;
}

function chunks<T>(values: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size));
  }
  return result;
}

async function ensureBackupTable(knex: Knex): Promise<void> {
  const hasBackupTable = await knex.schema.hasTable(BACKUP_TABLE);
  if (hasBackupTable) return;

  await knex.schema.createTable(BACKUP_TABLE, (table) => {
    table.bigIncrements('id').primary();
    table.specificType('eligible_factory_id', 'BIGINT NOT NULL');
    table.specificType('original_industrial_estate_name', 'NVARCHAR(255) NULL');
    table.specificType('backfilled_industrial_estate_name', 'NVARCHAR(255) NOT NULL');
    table.specificType('source_industrial_estate_code', 'VARCHAR(64) NOT NULL');
    table.specificType('created_at', 'DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()');
    table.unique(['eligible_factory_id'], {
      indexName: 'uq_eligible_factory_industrial_estate_cleanup_0090_factory',
    });
  });
}
