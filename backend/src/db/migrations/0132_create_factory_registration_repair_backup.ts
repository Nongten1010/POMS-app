import type { Knex } from 'knex';

export const config = { transaction: true };
export const REGISTRATION_REPAIR_BACKUP = 'factory_registration_identity_repair_backup_20261006';

/** The fixture variant can only address a connection-local temporary table. */
export function buildRegistrationRepairBackupSchemaSql(
  mode: 'production' | 'fixture' = 'production',
): string {
  const table =
    mode === 'fixture' ? '[#registration_repair_backup]' : `[dbo].[${REGISTRATION_REPAIR_BACKUP}]`;
  const object =
    mode === 'fixture'
      ? 'tempdb..#registration_repair_backup'
      : `dbo.${REGISTRATION_REPAIR_BACKUP}`;
  return `
IF OBJECT_ID(N'${object}', N'U') IS NULL
BEGIN
  CREATE TABLE ${table} (
    entity_type VARCHAR(48) NOT NULL,
    record_id BIGINT NOT NULL,
    before_factory_id NVARCHAR(64) NULL,
    before_registration_no_new NVARCHAR(64) NULL,
    before_registration_no_old NVARCHAR(64) NULL,
    before_factory_snapshot_json NVARCHAR(MAX) NULL,
    before_row_hash VARBINARY(32) NOT NULL,
    after_row_hash VARBINARY(32) NULL,
    created_at DATETIME2 NOT NULL DEFAULT SYSDATETIME(),
    restored_at DATETIME2 NULL,
    PRIMARY KEY (entity_type, record_id)
  );
END;`;
}

export async function up(knex: Knex): Promise<void> {
  await knex.raw(buildRegistrationRepairBackupSchemaSql());
}

export async function down(knex: Knex): Promise<void> {
  // Retain the original snapshots even after data recovery. Removing populated
  // audit backups needs a separate, explicitly reviewed retention migration.
  await knex.raw(`
IF OBJECT_ID(N'dbo.${REGISTRATION_REPAIR_BACKUP}', N'U') IS NOT NULL
BEGIN
  IF EXISTS (SELECT 1 FROM [dbo].[${REGISTRATION_REPAIR_BACKUP}])
    THROW 51320, 'Registration repair backups must be retained while records exist', 1;
  DROP TABLE [dbo].[${REGISTRATION_REPAIR_BACKUP}];
END;`);
}
