import type { Knex } from 'knex';

const BACKUP_TABLE = 'cems_wpms_measurement_point_dedupe_0046';
const UNIQUE_INDEX = 'ux_cems_wpms_points_active_request_name';

export async function up(knex: Knex): Promise<void> {
  await ensureBackupTable(knex);

  await knex.transaction(async (trx) => {
    await trx.raw(`
      WITH ranked_points AS (
        SELECT
          id,
          request_id,
          point_name,
          point_code,
          deleted_at,
          updated_at,
          updated_by,
          ROW_NUMBER() OVER (
            PARTITION BY request_id, LOWER(LTRIM(RTRIM(point_name)))
            ORDER BY
              CASE WHEN NULLIF(LTRIM(RTRIM(point_code)), '') IS NULL THEN 1 ELSE 0 END,
              id ASC
          ) AS duplicate_rank
        FROM cems_wpms_measurement_points
        WHERE deleted_at IS NULL
      )
      INSERT INTO ${BACKUP_TABLE} (
        measurement_point_id,
        request_id,
        point_name,
        point_code,
        original_deleted_at,
        original_updated_at,
        original_updated_by
      )
      SELECT
        ranked.id,
        ranked.request_id,
        ranked.point_name,
        ranked.point_code,
        ranked.deleted_at,
        ranked.updated_at,
        ranked.updated_by
      FROM ranked_points AS ranked
      WHERE ranked.duplicate_rank > 1
        AND NOT EXISTS (
          SELECT 1
          FROM ${BACKUP_TABLE} AS backup
          WHERE backup.measurement_point_id = ranked.id
        );
    `);

    await trx.raw(`
      WITH ranked_points AS (
        SELECT
          id,
          ROW_NUMBER() OVER (
            PARTITION BY request_id, LOWER(LTRIM(RTRIM(point_name)))
            ORDER BY
              CASE WHEN NULLIF(LTRIM(RTRIM(point_code)), '') IS NULL THEN 1 ELSE 0 END,
              id ASC
          ) AS duplicate_rank
        FROM cems_wpms_measurement_points
        WHERE deleted_at IS NULL
      )
      UPDATE mp
      SET
        deleted_at = SYSDATETIME(),
        updated_at = SYSDATETIME()
      FROM cems_wpms_measurement_points AS mp
      JOIN ranked_points AS ranked
        ON ranked.id = mp.id
      WHERE ranked.duplicate_rank > 1;
    `);
  });

  await knex.schema.raw(`
    IF NOT EXISTS (
      SELECT 1
      FROM sys.indexes
      WHERE name = '${UNIQUE_INDEX}'
        AND object_id = OBJECT_ID('cems_wpms_measurement_points')
    )
    BEGIN
      CREATE UNIQUE INDEX ${UNIQUE_INDEX}
      ON cems_wpms_measurement_points(request_id, point_name)
      WHERE deleted_at IS NULL;
    END
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.raw(`
    IF EXISTS (
      SELECT 1
      FROM sys.indexes
      WHERE name = '${UNIQUE_INDEX}'
        AND object_id = OBJECT_ID('cems_wpms_measurement_points')
    )
    BEGIN
      DROP INDEX ${UNIQUE_INDEX}
      ON cems_wpms_measurement_points;
    END
  `);

  const hasBackupTable = await knex.schema.hasTable(BACKUP_TABLE);
  if (!hasBackupTable) return;

  await knex.transaction(async (trx) => {
    const backups = await trx<{
      measurement_point_id: number | string;
      original_deleted_at: string | null;
      original_updated_at: string | null;
      original_updated_by: number | string | null;
    }>(BACKUP_TABLE).select(
      'measurement_point_id',
      'original_deleted_at',
      'original_updated_at',
      'original_updated_by',
    );

    for (const backup of backups) {
      await trx('cems_wpms_measurement_points')
        .where('id', backup.measurement_point_id)
        .update({
          deleted_at: backup.original_deleted_at,
          updated_at: backup.original_updated_at ?? trx.fn.now(),
          updated_by: backup.original_updated_by,
        });
    }
  });

  await knex.schema.dropTable(BACKUP_TABLE);
}

async function ensureBackupTable(knex: Knex): Promise<void> {
  const hasBackupTable = await knex.schema.hasTable(BACKUP_TABLE);
  if (hasBackupTable) return;

  await knex.schema.createTable(BACKUP_TABLE, (table) => {
    table.bigIncrements('id').primary();
    table.specificType('measurement_point_id', 'BIGINT NOT NULL');
    table.specificType('request_id', 'BIGINT NOT NULL');
    table.specificType('point_name', 'NVARCHAR(255) NOT NULL');
    table.specificType('point_code', 'VARCHAR(64) NULL');
    table.specificType('original_deleted_at', 'DATETIME2 NULL');
    table.specificType('original_updated_at', 'DATETIME2 NULL');
    table.specificType('original_updated_by', 'BIGINT NULL');
    table.specificType('created_at', 'DATETIME2 NOT NULL DEFAULT SYSDATETIME()');
  });
}
