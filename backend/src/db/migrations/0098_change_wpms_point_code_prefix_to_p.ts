import type { Knex } from 'knex';

const SEQUENCES_TABLE = 'cems_wpms_point_code_sequences';
const REGISTRY_TABLE = 'cems_wpms_point_code_registry';
const SEQUENCE_PREFIX_CHECK = 'ck_cems_wpms_point_code_sequences_prefix';
const REGISTRY_PREFIX_CHECK = 'ck_cems_wpms_point_code_registry_prefix_sequence';

export const config = { transaction: true };

export async function up(knex: Knex): Promise<void> {
  await dropCheckConstraint(knex, SEQUENCES_TABLE, SEQUENCE_PREFIX_CHECK);
  await dropCheckConstraint(knex, REGISTRY_TABLE, REGISTRY_PREFIX_CHECK);

  await knex.schema.raw(`
    UPDATE ${SEQUENCES_TABLE}
    SET
      prefix = 'P',
      updated_at = SYSDATETIME()
    WHERE system_type = 'WPMS';

    ALTER TABLE ${SEQUENCES_TABLE}
    ADD CONSTRAINT ${SEQUENCE_PREFIX_CHECK}
    CHECK (prefix IN ('S', 'P'));
  `);

  await addRegistryPrefixConstraint(knex);
}

export async function down(knex: Knex): Promise<void> {
  await dropCheckConstraint(knex, SEQUENCES_TABLE, SEQUENCE_PREFIX_CHECK);

  await knex.schema.raw(`
    UPDATE ${SEQUENCES_TABLE}
    SET
      prefix = 'W',
      updated_at = SYSDATETIME()
    WHERE system_type = 'WPMS';

    ALTER TABLE ${SEQUENCES_TABLE}
    ADD CONSTRAINT ${SEQUENCE_PREFIX_CHECK}
    CHECK (prefix IN ('S', 'W'));
  `);
}

async function addRegistryPrefixConstraint(knex: Knex): Promise<void> {
  await knex.schema.raw(`
    ALTER TABLE ${REGISTRY_TABLE}
    ADD CONSTRAINT ${REGISTRY_PREFIX_CHECK}
    CHECK (
      (prefix IS NULL AND numeric_sequence IS NULL)
      OR (
        prefix IS NOT NULL
        AND numeric_sequence IS NOT NULL
        AND prefix IN ('S', 'W', 'P')
        AND numeric_sequence BETWEEN 0 AND 9999
        AND normalized_point_code =
          prefix + RIGHT('0000' + CONVERT(VARCHAR(4), numeric_sequence), 4)
      )
    );
  `);
}

async function dropCheckConstraint(
  knex: Knex,
  tableName: string,
  constraintName: string,
): Promise<void> {
  await knex.schema.raw(`
    IF EXISTS (
      SELECT 1
      FROM sys.check_constraints
      WHERE name = '${constraintName}'
        AND parent_object_id = OBJECT_ID('${tableName}')
    )
    BEGIN
      ALTER TABLE ${tableName} DROP CONSTRAINT ${constraintName};
    END;
  `);
}
