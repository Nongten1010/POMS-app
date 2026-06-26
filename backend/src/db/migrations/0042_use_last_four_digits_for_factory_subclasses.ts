import type { Knex } from 'knex';

const BACKUP_TABLE = 'eligible_factory_type_sequence_cleanup_0042';

interface EligibleFactoryTypeSequenceRow {
  id: number | string;
  factory_type_sequence: string | null;
}

interface BackupRow {
  eligible_factory_id: number | string;
  original_factory_type_sequence: string | null;
}

export async function up(knex: Knex): Promise<void> {
  await ensureBackupTable(knex);

  await knex.transaction(async (trx) => {
    const rows = await trx<EligibleFactoryTypeSequenceRow>('eligible_factories')
      .whereNotNull('factory_type_sequence')
      .select('id', 'factory_type_sequence');

    for (const row of rows) {
      const normalized = normalizeStoredFactoryTypeSequence(row.factory_type_sequence);
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

function normalizeStoredFactoryTypeSequence(value: string | null): string | null {
  if (!value) return null;

  const separatorIndex = value.indexOf('/');
  const factoryClass = separatorIndex >= 0 ? value.slice(0, separatorIndex).trim() : value.trim();
  const factorySubclass = separatorIndex >= 0 ? value.slice(separatorIndex + 1).trim() : null;
  const normalized = normalizeFactoryTypeSequence(factoryClass || null, factorySubclass || null);

  return (
    [normalized.factoryClass, normalized.factorySubclass]
      .filter((item): item is string => Boolean(item))
      .join(' / ') || null
  );
}

function normalizeFactoryTypeSequence(
  factoryClass?: string | null,
  factorySubclass?: string | null,
): { factoryClass: string | null; factorySubclass: string | null } {
  const normalizedClass = normalizeText(factoryClass);
  const duplicateSubclassCode = normalizedClass
    ? factorySubclassCodeFromMainClass(normalizedClass)
    : null;
  const subclassCodes = new Set<string>();

  for (const token of normalizeText(factorySubclass)?.split(/[,\s/|;]+/) ?? []) {
    const subclassCode = normalizeSubclassToken(token);
    if (!subclassCode || subclassCode === duplicateSubclassCode) continue;
    subclassCodes.add(subclassCode);
  }

  return {
    factoryClass: normalizedClass,
    factorySubclass: subclassCodes.size > 0 ? [...subclassCodes].join(',') : null,
  };
}

function normalizeText(value?: string | null): string | null {
  const text = value?.trim();
  return text ? text : null;
}

function factorySubclassCodeFromMainClass(value: string): string | null {
  const digits = value.replace(/\D/g, '');
  if (!digits) return null;
  return digits.slice(-4).padStart(4, '0');
}

function normalizeSubclassToken(value: string): string | null {
  const text = value.trim();
  if (!text) return null;
  return factorySubclassCodeFromSource(text) ?? text;
}

function factorySubclassCodeFromSource(value: string): string | null {
  const digits = value.replace(/\D/g, '');
  if (!digits) return null;
  return digits.slice(-4).padStart(4, '0');
}
