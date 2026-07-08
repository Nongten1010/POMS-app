import type { Knex } from 'knex';
import { env } from '../../config/env';
import { factorySourceDb } from '../../config/factory-source-database';

const BACKUP_TABLE = 'eligible_factory_type_sequence_cleanup_0065';
const EXTERNAL_QUERY_TIMEOUT_MS = 300000;
const FACTORY_TYPE_CODE_LENGTH = 5;

interface EligibleFactoryTypeSequenceRow {
  id: number | string;
  source_factory_id: string | null;
  factory_type_sequence: string | null;
}

interface BackupRow {
  eligible_factory_id: number | string;
  original_factory_type_sequence: string | null;
}

interface SourceFactoryClassRow {
  FID: string | null;
  CLASS: string | null;
}

export async function up(knex: Knex): Promise<void> {
  await ensureBackupTable(knex);

  const rows = await knex<EligibleFactoryTypeSequenceRow>('eligible_factories')
    .whereNull('deleted_at')
    .whereNotNull('source_factory_id')
    .select('id', 'source_factory_id', 'factory_type_sequence');

  const sourceMainClassesByFid = await loadSourceMainClassByFid(rows);
  const sourceSubclassCodesByFid = await loadSourceSubclassCodesByFid(rows);

  await knex.transaction(async (trx) => {
    for (const row of rows) {
      const sourceFactoryId = row.source_factory_id?.trim();
      if (!sourceFactoryId) continue;

      const normalized = normalizeStoredFactoryTypeSequence(
        row.factory_type_sequence,
        sourceMainClassesByFid.get(sourceFactoryId) ?? null,
        sourceSubclassCodesByFid.get(sourceFactoryId) ?? [],
      );
      if (normalized === row.factory_type_sequence) continue;

      const existingBackup = await trx(BACKUP_TABLE)
        .where('eligible_factory_id', row.id)
        .first<{ eligible_factory_id: number | string }>('eligible_factory_id');

      if (!existingBackup) {
        await trx(BACKUP_TABLE).insert({
          eligible_factory_id: row.id,
          original_factory_type_sequence: row.factory_type_sequence,
          normalized_factory_type_sequence: normalized,
        });
      }

      await trx('eligible_factories').where('id', row.id).update({
        factory_type_sequence: normalized,
        updated_at: trx.fn.now(),
      });
    }
  });
}

export async function down(knex: Knex): Promise<void> {
  const hasBackupTable = await knex.schema.hasTable(BACKUP_TABLE);
  if (!hasBackupTable) return;

  await knex.transaction(async (trx) => {
    const backups = await trx<BackupRow>(BACKUP_TABLE).select(
      'eligible_factory_id',
      'original_factory_type_sequence',
    );

    for (const backup of backups) {
      await trx('eligible_factories').where('id', backup.eligible_factory_id).update({
        factory_type_sequence: backup.original_factory_type_sequence,
        updated_at: trx.fn.now(),
      });
    }
  });

  await knex.schema.dropTable(BACKUP_TABLE);
}

async function ensureBackupTable(knex: Knex): Promise<void> {
  const hasBackupTable = await knex.schema.hasTable(BACKUP_TABLE);
  if (hasBackupTable) return;

  await knex.schema.createTable(BACKUP_TABLE, (table) => {
    table.bigIncrements('id').primary();
    table.specificType('eligible_factory_id', 'BIGINT NOT NULL');
    table.specificType('original_factory_type_sequence', 'NVARCHAR(128) NULL');
    table.specificType('normalized_factory_type_sequence', 'NVARCHAR(128) NULL');
    table.specificType('created_at', 'DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()');
  });
}

async function loadSourceMainClassByFid(
  rows: EligibleFactoryTypeSequenceRow[],
): Promise<Map<string, string>> {
  const codesByFid = new Map<string, string>();

  for (const fidChunk of chunks(sourceFactoryIds(rows), 1000)) {
    const sourceRows = await factorySourceDb<SourceFactoryClassRow>(
      `${env.FACTORY_DB_SCHEMA}.${env.FACTORY_DB_TABLE}`,
    )
      .whereIn('FID', fidChunk)
      .timeout(EXTERNAL_QUERY_TIMEOUT_MS)
      .select('FID', 'CLASS');

    for (const sourceRow of sourceRows) {
      const fid = sourceRow.FID?.trim();
      const classCode = normalizeFactoryTypeCode(sourceRow.CLASS);
      if (!fid || !classCode) continue;
      codesByFid.set(fid, classCode);
    }
  }

  return codesByFid;
}

async function loadSourceSubclassCodesByFid(
  rows: EligibleFactoryTypeSequenceRow[],
): Promise<Map<string, string[]>> {
  const codesByFid = new Map<string, string[]>();

  for (const fidChunk of chunks(sourceFactoryIds(rows), 1000)) {
    const sourceRows = await factorySourceDb<SourceFactoryClassRow>(
      `${env.FACTORY_DB_SCHEMA}.FACCLASS`,
    )
      .whereIn('FID', fidChunk)
      .timeout(EXTERNAL_QUERY_TIMEOUT_MS)
      .select('FID', 'CLASS');

    for (const sourceRow of sourceRows) {
      const fid = sourceRow.FID?.trim();
      const classCode = normalizeFactoryTypeCode(sourceRow.CLASS);
      if (!fid || !classCode) continue;
      codesByFid.set(fid, [...(codesByFid.get(fid) ?? []), classCode]);
    }
  }

  return new Map([...codesByFid.entries()].map(([fid, codes]) => [fid, [...new Set(codes)]]));
}

export function normalizeStoredFactoryTypeSequence(
  value: string | null,
  sourceMainClass: string | number | null | undefined,
  sourceSubclassCodes: Array<string | number | null | undefined>,
): string | null {
  const fallback = splitFactoryTypeSequence(value);
  const factoryClass =
    normalizeFactoryTypeCode(sourceMainClass) ?? normalizeFactoryTypeCode(fallback.main);
  const factorySubclass = normalizeFactorySubclassCodes(
    sourceSubclassCodes.length > 0 ? sourceSubclassCodes : fallback.subclass,
    factoryClass,
  );

  return (
    [factoryClass, factorySubclass].filter((item): item is string => Boolean(item)).join(' / ') ||
    null
  );
}

function splitFactoryTypeSequence(value: string | null): {
  main: string | null;
  subclass: string[];
} {
  if (!value) return { main: null, subclass: [] };
  const separatorIndex = value.indexOf('/');
  const main = separatorIndex >= 0 ? value.slice(0, separatorIndex).trim() : value.trim();
  const subclass = separatorIndex >= 0 ? value.slice(separatorIndex + 1).trim() : '';
  return {
    main: main || null,
    subclass: subclass ? subclass.split(/[,\s/|;]+/) : [],
  };
}

function normalizeFactorySubclassCodes(
  sourceSubclassCodes: Array<string | number | null | undefined>,
  factoryClass: string | null,
): string | null {
  const subclassCodes = new Set<string>();

  for (const sourceSubclassCode of sourceSubclassCodes) {
    const normalizedCode = normalizeFactoryTypeCode(sourceSubclassCode);
    if (!normalizedCode || normalizedCode === factoryClass) continue;
    subclassCodes.add(normalizedCode);
  }

  return subclassCodes.size > 0 ? [...subclassCodes].sort().join(',') : null;
}

function normalizeFactoryTypeCode(value: string | number | null | undefined): string | null {
  const text = value === null || value === undefined ? null : String(value).trim();
  if (!text) return null;
  const digits = text.replace(/\D/g, '');
  if (!digits) {
    return text.length > FACTORY_TYPE_CODE_LENGTH
      ? text.slice(-FACTORY_TYPE_CODE_LENGTH)
      : text.padStart(FACTORY_TYPE_CODE_LENGTH, '0');
  }
  return digits.slice(-FACTORY_TYPE_CODE_LENGTH).padStart(FACTORY_TYPE_CODE_LENGTH, '0');
}

function sourceFactoryIds(rows: EligibleFactoryTypeSequenceRow[]): string[] {
  return [
    ...new Set(
      rows
        .map((row) => row.source_factory_id?.trim())
        .filter((value): value is string => Boolean(value)),
    ),
  ];
}

function chunks<T>(values: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size));
  }
  return result;
}
