import type { Knex } from 'knex';

export const ADDRESS_NAMES_REPAIR_BACKUP = 'factory_address_names_repair_backup_0149';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable(ADDRESS_NAMES_REPAIR_BACKUP, (table) => {
    table.string('target_table', 64).notNullable();
    table.bigInteger('entity_id').notNullable();
    table.specificType('original_address', 'NVARCHAR(1000) NOT NULL');
    table.specificType('resolved_address', 'NVARCHAR(1000) NOT NULL');
    table.bigInteger('original_revision').nullable();
    table.bigInteger('resolved_revision').nullable();
    table.specificType('created_at', 'DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()');
    table.primary(['target_table', 'entity_id']);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`IF EXISTS (SELECT 1 FROM [${ADDRESS_NAMES_REPAIR_BACKUP}])
    THROW 51490, 'Address repair backups must be retained; use a forward migration.', 1;`);
  await knex.schema.dropTable(ADDRESS_NAMES_REPAIR_BACKUP);
}
