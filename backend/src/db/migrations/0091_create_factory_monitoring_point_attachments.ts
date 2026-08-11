import type { Knex } from 'knex';

const ATTACHMENTS_TABLE = 'factory_monitoring_point_attachments';
const POINTS_TABLE = 'factory_monitoring_points';
const LINKS_DEFAULT_CONSTRAINT = 'df_factory_monitoring_points_attachment_links';
const LINKS_CHECK_CONSTRAINT = 'ck_factory_monitoring_points_attachment_links_json';

export const config = { transaction: true };

export async function up(knex: Knex): Promise<void> {
  await knex.schema.raw(`
    ALTER TABLE ${POINTS_TABLE}
    ADD attachment_links_json NVARCHAR(MAX) NOT NULL
      CONSTRAINT ${LINKS_DEFAULT_CONSTRAINT} DEFAULT N'[]' WITH VALUES;
  `);

  await knex.schema.raw(`
    ALTER TABLE ${POINTS_TABLE} WITH CHECK
    ADD CONSTRAINT ${LINKS_CHECK_CONSTRAINT}
    CHECK (
      ISJSON(attachment_links_json) = 1
      AND LEFT(LTRIM(attachment_links_json), 1) = N'['
      AND RIGHT(RTRIM(attachment_links_json), 1) = N']'
    );
  `);

  await knex.schema.createTable(ATTACHMENTS_TABLE, (table) => {
    table.bigIncrements('id').primary();
    table.specificType('public_id', 'UNIQUEIDENTIFIER NOT NULL');
    table.specificType('claim_token_hash', 'VARBINARY(32) NOT NULL');
    table.bigInteger('monitoring_point_id').nullable();
    table.specificType('original_file_name', 'NVARCHAR(255) NOT NULL');
    table.specificType('mime_type', 'VARCHAR(64) NOT NULL');
    table.integer('file_size').notNullable();
    table.specificType('storage_path', 'NVARCHAR(1024) NOT NULL');
    table.integer('sort_order').nullable();
    table.specificType('expires_at', 'DATETIME2 NOT NULL');
    table.specificType('claimed_at', 'DATETIME2 NULL');
    table.specificType('created_at', 'DATETIME2 NOT NULL DEFAULT SYSDATETIME()');
    table.specificType('updated_at', 'DATETIME2 NOT NULL DEFAULT SYSDATETIME()');
    table.bigInteger('created_by').notNullable();
    table.bigInteger('updated_by').nullable();
    table.specificType('deleted_at', 'DATETIME2 NULL');

    table
      .foreign('monitoring_point_id', 'fk_fmp_attachments_point')
      .references('id')
      .inTable(POINTS_TABLE);
  });

  await knex.schema.raw(`
    CREATE UNIQUE INDEX uq_fmp_attachments_public_id
    ON ${ATTACHMENTS_TABLE}(public_id);

    CREATE UNIQUE INDEX uq_fmp_attachments_claim_token
    ON ${ATTACHMENTS_TABLE}(claim_token_hash);

    CREATE INDEX ix_fmp_attachments_active_point_order
    ON ${ATTACHMENTS_TABLE}(monitoring_point_id, sort_order, id)
    WHERE deleted_at IS NULL AND monitoring_point_id IS NOT NULL;

    CREATE INDEX ix_fmp_attachments_pending_expiry
    ON ${ATTACHMENTS_TABLE}(expires_at, id)
    INCLUDE (created_by, storage_path)
    WHERE deleted_at IS NULL AND monitoring_point_id IS NULL AND claimed_at IS NULL;

    CREATE INDEX ix_fmp_attachments_deleted_retry
    ON ${ATTACHMENTS_TABLE}(id)
    INCLUDE (storage_path)
    WHERE deleted_at IS NOT NULL;

    ALTER TABLE ${ATTACHMENTS_TABLE}
    ADD CONSTRAINT ck_fmp_attachments_mime_type
    CHECK (mime_type IN ('image/jpeg', 'image/png', 'application/pdf'));

    ALTER TABLE ${ATTACHMENTS_TABLE}
    ADD CONSTRAINT ck_fmp_attachments_file_size
    CHECK (file_size BETWEEN 1 AND 10485760);

    ALTER TABLE ${ATTACHMENTS_TABLE}
    ADD CONSTRAINT ck_fmp_attachments_storage_path
    CHECK (
      storage_path LIKE '.private/monitoring-point-forms/attachments/%'
      AND storage_path NOT LIKE '%..%'
      AND storage_path NOT LIKE '%\\%'
    );

    ALTER TABLE ${ATTACHMENTS_TABLE}
    ADD CONSTRAINT ck_fmp_attachments_lifecycle
    CHECK (
      (
        monitoring_point_id IS NULL
        AND claimed_at IS NULL
        AND sort_order IS NULL
      )
      OR
      (
        monitoring_point_id IS NOT NULL
        AND claimed_at IS NOT NULL
        AND sort_order IS NOT NULL
        AND sort_order >= 1
      )
    );
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.raw(`
    ALTER TABLE ${POINTS_TABLE} DROP CONSTRAINT ${LINKS_CHECK_CONSTRAINT};
    ALTER TABLE ${POINTS_TABLE} DROP CONSTRAINT ${LINKS_DEFAULT_CONSTRAINT};
    ALTER TABLE ${POINTS_TABLE} DROP COLUMN attachment_links_json;
  `);
  await knex.schema.dropTableIfExists(ATTACHMENTS_TABLE);
}
