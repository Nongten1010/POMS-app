import type { Knex } from 'knex';

const TABLE_NAME = 'device_connection_configs';
const CONSTRAINT_NAME = 'ck_device_connection_configs_status_management_json';

export const config = { transaction: true };

export async function up(knex: Knex): Promise<void> {
  await knex.schema.raw(`
    IF EXISTS (
      SELECT 1
      FROM ${TABLE_NAME}
      WHERE status_management_json IS NOT NULL
        AND ISJSON(status_management_json) <> 1
    )
    BEGIN
      THROW 50001, 'Cannot validate device status management because invalid JSON exists.', 1;
    END

    IF NOT EXISTS (
      SELECT 1
      FROM sys.check_constraints
      WHERE name = '${CONSTRAINT_NAME}'
        AND parent_object_id = OBJECT_ID('${TABLE_NAME}')
    )
    BEGIN
      ALTER TABLE ${TABLE_NAME} WITH CHECK
      ADD CONSTRAINT ${CONSTRAINT_NAME}
      CHECK (status_management_json IS NULL OR ISJSON(status_management_json) = 1);
    END
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.raw(`
    IF EXISTS (
      SELECT 1
      FROM sys.check_constraints
      WHERE name = '${CONSTRAINT_NAME}'
        AND parent_object_id = OBJECT_ID('${TABLE_NAME}')
    )
    BEGIN
      ALTER TABLE ${TABLE_NAME}
      DROP CONSTRAINT ${CONSTRAINT_NAME};
    END
  `);
}
