import type { Knex } from 'knex';

const SEQUENCES_TABLE = 'cems_wpms_point_code_sequences';
const PREFIX_CHECK = 'ck_cems_wpms_point_code_sequences_prefix';

export const config = { transaction: true };

export async function up(knex: Knex): Promise<void> {
  await dropPrefixConstraint(knex);

  await knex.schema.raw(`
    ALTER TABLE ${SEQUENCES_TABLE}
    ADD legacy_last_sequence INT NULL;
  `);

  await knex.schema.raw(`
    UPDATE ${SEQUENCES_TABLE}
    SET
      prefix = 'S',
      last_sequence = CASE WHEN last_sequence < 2000 THEN 2000 ELSE last_sequence END,
      updated_at = SYSDATETIME()
    WHERE system_type = 'CEMS';

    UPDATE ${SEQUENCES_TABLE}
    SET
      legacy_last_sequence = last_sequence,
      prefix = 'W',
      last_sequence = 2000,
      updated_at = SYSDATETIME()
    WHERE system_type = 'WPMS';
  `);

  await knex.schema.raw(`
    ALTER TABLE ${SEQUENCES_TABLE}
    ADD CONSTRAINT ${PREFIX_CHECK}
    CHECK (prefix IN ('S', 'W'));
  `);
}

export async function down(knex: Knex): Promise<void> {
  await dropPrefixConstraint(knex);

  await knex.schema.raw(`
    UPDATE ${SEQUENCES_TABLE}
    SET
      prefix = 'P',
      last_sequence = legacy_last_sequence,
      updated_at = SYSDATETIME()
    WHERE system_type = 'WPMS';
  `);

  await knex.schema.raw(`
    ALTER TABLE ${SEQUENCES_TABLE}
    ADD CONSTRAINT ${PREFIX_CHECK}
    CHECK (prefix IN ('S', 'P'));
  `);

  await knex.schema.raw(`
    ALTER TABLE ${SEQUENCES_TABLE}
    DROP COLUMN legacy_last_sequence;
  `);
}

async function dropPrefixConstraint(knex: Knex): Promise<void> {
  await knex.schema.raw(`
    IF EXISTS (
      SELECT 1
      FROM sys.check_constraints
      WHERE name = '${PREFIX_CHECK}'
        AND parent_object_id = OBJECT_ID('${SEQUENCES_TABLE}')
    )
    BEGIN
      ALTER TABLE ${SEQUENCES_TABLE} DROP CONSTRAINT ${PREFIX_CHECK};
    END;
  `);
}
