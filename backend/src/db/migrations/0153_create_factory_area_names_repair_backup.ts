import type { Knex } from 'knex';

export const FACTORY_AREA_NAMES_BACKUP = 'factory_area_names_repair_backup_0153';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable(FACTORY_AREA_NAMES_BACKUP, (table) => {
    table.string('target_table', 128).notNullable();
    table.bigInteger('entity_id').notNullable();
    table.bigInteger('request_id').nullable();
    table.specificType('original_row_json', 'NVARCHAR(MAX) NOT NULL');
    table.specificType('original_context_json', 'NVARCHAR(MAX) NOT NULL');
    table.specificType('resolved_names_json', 'NVARCHAR(MAX) NOT NULL');
    table.string('original_row_hash', 64).notNullable();
    table.string('unchanged_columns_hash', 64).notNullable();
    table.specificType('created_at', 'DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()');
    table.primary(['target_table', 'entity_id']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`IF EXISTS (SELECT 1 FROM [${FACTORY_AREA_NAMES_BACKUP}])
    THROW 51530, 'Factory area name repair backups must be retained; use a forward migration.', 1;`);
  await knex.schema.dropTable(FACTORY_AREA_NAMES_BACKUP);
}
