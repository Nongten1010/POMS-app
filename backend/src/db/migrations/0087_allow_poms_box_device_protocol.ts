import type { Knex } from 'knex';

const TABLE_NAME = 'device_connection_configs';
const CONSTRAINT_NAME = 'ck_device_connection_configs_protocol';

export const config = { transaction: true };

export async function up(knex: Knex): Promise<void> {
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

    ALTER TABLE ${TABLE_NAME}
    ADD CONSTRAINT ${CONSTRAINT_NAME}
    CHECK (protocol IN ('POMS_BOX', 'MODBUS_RTU', 'MODBUS_TCP', 'MSSQL', 'MYSQL'));
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.raw(`
    IF EXISTS (
      SELECT 1
      FROM ${TABLE_NAME}
      WHERE protocol = 'POMS_BOX'
    )
    BEGIN
      THROW 50001, 'Cannot remove POMS_BOX protocol while device configs exist.', 1;
    END

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

    ALTER TABLE ${TABLE_NAME}
    ADD CONSTRAINT ${CONSTRAINT_NAME}
    CHECK (protocol IN ('MODBUS_RTU', 'MODBUS_TCP', 'MSSQL', 'MYSQL'));
  `);
}
