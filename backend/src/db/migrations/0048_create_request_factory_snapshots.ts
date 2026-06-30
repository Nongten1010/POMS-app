import type { Knex } from 'knex';
import { addAuditColumns } from '../migration-helpers';

const TABLE_NAME = 'cems_wpms_request_factory_snapshots';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable(TABLE_NAME, (table) => {
    table.bigIncrements('id').primary();
    table.bigInteger('request_id').notNullable();
    table.specificType('region_code', 'NVARCHAR(64) NULL');
    table.specificType('region_name', 'NVARCHAR(128) NULL');
    table.specificType('province_code', 'VARCHAR(32) NULL');
    table.specificType('province_name', 'NVARCHAR(128) NULL');
    table.specificType('district_code', 'VARCHAR(32) NULL');
    table.specificType('district_name', 'NVARCHAR(128) NULL');
    table.specificType('subdistrict_code', 'VARCHAR(32) NULL');
    table.specificType('subdistrict_name', 'NVARCHAR(128) NULL');
    table.specificType('industrial_estate_code', 'VARCHAR(32) NULL');
    table.specificType('industrial_estate_name', 'NVARCHAR(255) NULL');
    table.specificType('factory_main_type_code', 'NVARCHAR(128) NULL');
    table.specificType('factory_main_type_label', 'NVARCHAR(500) NULL');
    addAuditColumns(table);
    table
      .foreign('request_id', 'fk_request_factory_snapshot_request')
      .references('id')
      .inTable('cems_wpms_connection_requests');
  });

  await knex.schema.raw(`
    CREATE UNIQUE INDEX uq_request_factory_snapshot_active_request
    ON ${TABLE_NAME}(request_id)
    WHERE deleted_at IS NULL;
  `);
  await knex.schema.raw(`
    CREATE INDEX ix_request_factory_snapshot_province
    ON ${TABLE_NAME}(province_name, request_id)
    WHERE deleted_at IS NULL AND province_name IS NOT NULL;
  `);
  await knex.schema.raw(`
    CREATE INDEX ix_request_factory_snapshot_district
    ON ${TABLE_NAME}(district_name, request_id)
    WHERE deleted_at IS NULL AND district_name IS NOT NULL;
  `);
  await knex.schema.raw(`
    CREATE INDEX ix_request_factory_snapshot_estate
    ON ${TABLE_NAME}(industrial_estate_name, request_id)
    WHERE deleted_at IS NULL AND industrial_estate_name IS NOT NULL;
  `);
  await knex.schema.raw(`
    CREATE INDEX ix_request_factory_snapshot_main_type
    ON ${TABLE_NAME}(factory_main_type_code, request_id)
    WHERE deleted_at IS NULL AND factory_main_type_code IS NOT NULL;
  `);

  await backfillFactorySnapshots(knex);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists(TABLE_NAME);
}

async function backfillFactorySnapshots(knex: Knex): Promise<void> {
  await knex.schema.raw(`
    WITH snapshot_source AS (
      SELECT
        r.id,
        p.region,
        f.province_id,
        p.name_th AS province_name,
        ie.code AS industrial_estate_code,
        ie.name_th AS industrial_estate_name,
        r.industry_main_order,
        COALESCE(r.created_by, r.updated_by) AS created_by,
        COALESCE(r.updated_by, r.created_by) AS updated_by,
        ROW_NUMBER() OVER (
          PARTITION BY r.id
          ORDER BY
            CASE
              WHEN f.fid = r.factory_id THEN 1
              WHEN f.code = r.factory_registration_no THEN 2
              WHEN f.code = r.factory_id THEN 3
              ELSE 4
            END,
            f.id
        ) AS source_rank
      FROM cems_wpms_connection_requests AS r
      LEFT JOIN factories AS f
        ON f.deleted_at IS NULL
        AND (
          f.fid = r.factory_id
          OR f.code = r.factory_id
          OR f.code = r.factory_registration_no
        )
      LEFT JOIN provinces AS p
        ON p.id = f.province_id
      LEFT JOIN industrial_estates AS ie
        ON ie.id = f.industrial_estate_id
      WHERE r.deleted_at IS NULL
    )
    INSERT INTO ${TABLE_NAME} (
      request_id,
      region_code,
      region_name,
      province_code,
      province_name,
      industrial_estate_code,
      industrial_estate_name,
      factory_main_type_code,
      factory_main_type_label,
      created_by,
      updated_by
    )
    SELECT
      source.id,
      source.region,
      source.region,
      source.province_id,
      source.province_name,
      source.industrial_estate_code,
      source.industrial_estate_name,
      source.industry_main_order,
      NULL,
      source.created_by,
      source.updated_by
    FROM snapshot_source AS source
    WHERE source.source_rank = 1
      AND NOT EXISTS (
        SELECT 1
        FROM ${TABLE_NAME} AS fs
        WHERE fs.request_id = source.id
          AND fs.deleted_at IS NULL
      );
  `);
}
