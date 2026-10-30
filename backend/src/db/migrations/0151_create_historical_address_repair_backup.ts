import type { Knex } from 'knex';

export const HISTORICAL_ADDRESS_BACKUP = 'factory_address_history_repair_backup_0151';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable(HISTORICAL_ADDRESS_BACKUP, (table) => {
    table.string('target_table', 64).notNullable();
    table.bigInteger('entity_id').notNullable();
    table.specificType('registration_no', 'NVARCHAR(64) NOT NULL');
    table.specificType('original_address', 'NVARCHAR(1000) NOT NULL');
    table.specificType('resolved_address', 'NVARCHAR(1000) NOT NULL');
    table.specificType('original_deleted_at', 'DATETIME2 NULL');
    table.string('original_status', 64).nullable();
    table.string('administrative_area_key', 32).notNullable();
    table.specificType('created_at', 'DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()');
    table.primary(['target_table', 'entity_id']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`IF EXISTS (SELECT 1 FROM [${HISTORICAL_ADDRESS_BACKUP}])
    THROW 51510, 'Historical address repair backups must be retained; use a forward migration.', 1;`);
  await knex.schema.dropTable(HISTORICAL_ADDRESS_BACKUP);
}
