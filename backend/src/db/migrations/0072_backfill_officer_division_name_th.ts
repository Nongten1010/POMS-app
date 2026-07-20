import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    UPDATE op
    SET op.division_name_th = org.name_th
    FROM officer_profiles op
    INNER JOIN organizations org
      ON org.external_id = op.division_id
     AND org.level = 'division'
    WHERE op.division_id IS NOT NULL
      AND org.name_th IS NOT NULL
      AND (
        op.division_name_th IS NULL
        OR LTRIM(RTRIM(op.division_name_th)) = ''
      );
  `);
}

export async function down(_knex: Knex): Promise<void> {
  // One-way data repair: previous NULL/blank values cannot be reconstructed safely.
}
