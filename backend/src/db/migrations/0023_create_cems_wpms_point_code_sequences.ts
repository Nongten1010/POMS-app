import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable('cems_wpms_point_code_sequences', (table) => {
    table.specificType('system_type', 'VARCHAR(8) NOT NULL').primary();
    table.specificType('prefix', 'VARCHAR(1) NOT NULL');
    table.integer('last_sequence').notNullable().defaultTo(0);
    table.specificType('updated_at', 'DATETIME2 NOT NULL DEFAULT SYSDATETIME()');
  });

  await knex('cems_wpms_point_code_sequences').insert([
    { system_type: 'CEMS', prefix: 'S', last_sequence: 0 },
    { system_type: 'WPMS', prefix: 'P', last_sequence: 0 },
  ]);

  await knex.schema.raw(`
    ALTER TABLE cems_wpms_point_code_sequences
    ADD CONSTRAINT ck_cems_wpms_point_code_sequences_system_type
    CHECK (system_type IN ('CEMS', 'WPMS'));
  `);

  await knex.schema.raw(`
    ALTER TABLE cems_wpms_point_code_sequences
    ADD CONSTRAINT ck_cems_wpms_point_code_sequences_prefix
    CHECK (prefix IN ('S', 'P'));
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('cems_wpms_point_code_sequences');
}
