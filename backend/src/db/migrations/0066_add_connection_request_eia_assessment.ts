import type { Knex } from 'knex';

const TABLE_NAME = 'cems_wpms_connection_requests';
const CONSTRAINT_NAME = 'ck_connection_requests_eia_assessment';

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable(TABLE_NAME, (table) => {
    table.specificType('eia_assessment', 'NVARCHAR(32) NULL');
    table.specificType('eia_other', 'NVARCHAR(500) NULL');
  });

  await knex.schema.raw(`
    ALTER TABLE ${TABLE_NAME}
    ADD CONSTRAINT ${CONSTRAINT_NAME}
    CHECK (
      (eia_assessment IS NULL AND eia_other IS NULL)
      OR (
        eia_assessment IS NOT NULL
        AND has_eia IS NOT NULL
        AND (
          (
            eia_assessment = N'อื่นๆ'
            AND NULLIF(LTRIM(RTRIM(eia_other)), '') IS NOT NULL
            AND has_eia = 0
          )
          OR (
            eia_assessment = N'ไม่มี'
            AND eia_other IS NULL
            AND has_eia = 0
          )
          OR (
            eia_assessment = N'มี'
            AND eia_other IS NULL
            AND has_eia = 1
          )
          OR (
            eia_assessment = N'มี IEE'
            AND eia_other IS NULL
            AND has_eia = 1
          )
          OR (
            eia_assessment = N'มี EIA'
            AND eia_other IS NULL
            AND has_eia = 1
          )
          OR (
            eia_assessment = N'มี EHIA'
            AND eia_other IS NULL
            AND has_eia = 1
          )
        )
      )
    );
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.raw(`
    ALTER TABLE ${TABLE_NAME}
    DROP CONSTRAINT ${CONSTRAINT_NAME};
  `);

  await knex.schema.alterTable(TABLE_NAME, (table) => {
    table.dropColumn('eia_other');
    table.dropColumn('eia_assessment');
  });
}
