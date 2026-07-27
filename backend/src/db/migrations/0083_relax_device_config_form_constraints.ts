import type { Knex } from 'knex';

const TABLE_NAME = 'device_measurement_channels';

export const config = { transaction: true };

export async function up(knex: Knex): Promise<void> {
  await knex.schema.raw(`
    IF EXISTS (
      SELECT 1
      FROM sys.key_constraints
      WHERE name = 'uq_device_measurement_channels_config_address'
        AND parent_object_id = OBJECT_ID('${TABLE_NAME}')
    )
    BEGIN
      ALTER TABLE ${TABLE_NAME}
      DROP CONSTRAINT uq_device_measurement_channels_config_address;
    END
    ELSE IF EXISTS (
      SELECT 1
      FROM sys.indexes
      WHERE name = 'uq_device_measurement_channels_config_address'
        AND object_id = OBJECT_ID('${TABLE_NAME}')
    )
    BEGIN
      DROP INDEX uq_device_measurement_channels_config_address
      ON ${TABLE_NAME};
    END

    IF EXISTS (
      SELECT 1
      FROM sys.check_constraints
      WHERE name = 'ck_device_measurement_channels_address'
        AND parent_object_id = OBJECT_ID('${TABLE_NAME}')
    )
    BEGIN
      ALTER TABLE ${TABLE_NAME}
      DROP CONSTRAINT ck_device_measurement_channels_address;
    END

    IF EXISTS (
      SELECT 1
      FROM sys.check_constraints
      WHERE name = 'ck_device_measurement_channels_value_format'
        AND parent_object_id = OBJECT_ID('${TABLE_NAME}')
    )
    BEGIN
      ALTER TABLE ${TABLE_NAME}
      DROP CONSTRAINT ck_device_measurement_channels_value_format;
    END

    IF EXISTS (
      SELECT 1
      FROM sys.check_constraints
      WHERE name = 'ck_device_measurement_channels_alert_range'
        AND parent_object_id = OBJECT_ID('${TABLE_NAME}')
    )
    BEGIN
      ALTER TABLE ${TABLE_NAME}
      DROP CONSTRAINT ck_device_measurement_channels_alert_range;
    END

    ALTER TABLE ${TABLE_NAME}
    ALTER COLUMN address_id BIGINT NULL;

    ALTER TABLE ${TABLE_NAME}
    ALTER COLUMN offset_value DECIMAL(18,6) NULL;
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.raw(`
    IF EXISTS (
      SELECT 1
      FROM ${TABLE_NAME}
      WHERE
        address_id IS NULL
        OR offset_value IS NULL
        OR address_id < 40001
        OR (
          value_format IS NOT NULL
          AND value_format NOT IN ('MEASUREMENT_VALUE', 'CURRENT', 'VOLTAGE')
        )
        OR (
          alert_low IS NOT NULL
          AND alert_high IS NOT NULL
          AND alert_low > alert_high
        )
    )
    OR EXISTS (
      SELECT 1
      FROM ${TABLE_NAME}
      GROUP BY config_id, address_id
      HAVING COUNT(*) > 1
    )
    BEGIN
      THROW 50001, 'Cannot restore device config constraints while nullable or invalid channel data exists.', 1;
    END

    ALTER TABLE ${TABLE_NAME}
    ALTER COLUMN address_id BIGINT NOT NULL;

    ALTER TABLE ${TABLE_NAME}
    ALTER COLUMN offset_value DECIMAL(18,6) NOT NULL;

    ALTER TABLE ${TABLE_NAME}
    ADD CONSTRAINT uq_device_measurement_channels_config_address
    UNIQUE (config_id, address_id);

    ALTER TABLE ${TABLE_NAME}
    ADD CONSTRAINT ck_device_measurement_channels_address
    CHECK (address_id >= 40001);

    ALTER TABLE ${TABLE_NAME}
    ADD CONSTRAINT ck_device_measurement_channels_value_format
    CHECK (
      value_format IS NULL OR
      value_format IN ('MEASUREMENT_VALUE', 'CURRENT', 'VOLTAGE')
    );

    ALTER TABLE ${TABLE_NAME}
    ADD CONSTRAINT ck_device_measurement_channels_alert_range
    CHECK (
      alert_low IS NULL OR
      alert_high IS NULL OR
      alert_low <= alert_high
    );
  `);
}
