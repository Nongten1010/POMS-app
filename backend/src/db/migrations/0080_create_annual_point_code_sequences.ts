import type { Knex } from 'knex';

const SEQUENCES_TABLE = 'cems_wpms_annual_point_code_sequences';

export const config = { transaction: true };

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable(SEQUENCES_TABLE, (table) => {
    table.specificType('system_type', 'VARCHAR(8) NOT NULL');
    table.specificType('buddhist_year', 'CHAR(4) NOT NULL');
    table.specificType(
      'last_sequence',
      'INT NOT NULL CONSTRAINT df_cems_wpms_annual_point_sequences_last_sequence DEFAULT 0',
    );
    table.specificType(
      'updated_at',
      'DATETIME2 NOT NULL CONSTRAINT df_cems_wpms_annual_point_sequences_updated_at DEFAULT SYSDATETIME()',
    );
    table.primary(['system_type', 'buddhist_year'], {
      constraintName: 'pk_cems_wpms_annual_point_code_sequences',
    });
  });

  await knex.schema.raw(`
    ALTER TABLE ${SEQUENCES_TABLE}
    ADD CONSTRAINT ck_cems_wpms_annual_point_sequences_system_type
    CHECK (system_type IN ('CEMS', 'WPMS'));
  `);

  await knex.schema.raw(`
    ALTER TABLE ${SEQUENCES_TABLE}
    ADD CONSTRAINT ck_cems_wpms_annual_point_sequences_buddhist_year
    CHECK (buddhist_year LIKE '[0-9][0-9][0-9][0-9]');
  `);

  await knex.schema.raw(`
    ALTER TABLE ${SEQUENCES_TABLE}
    ADD CONSTRAINT ck_cems_wpms_annual_point_sequences_last_sequence
    CHECK (last_sequence >= 0);
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists(SEQUENCES_TABLE);
}
