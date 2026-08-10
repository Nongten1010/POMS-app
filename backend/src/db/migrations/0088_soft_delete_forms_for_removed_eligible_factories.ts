import type { Knex } from 'knex';

export const config = { transaction: true };

export async function up(knex: Knex): Promise<void> {
  await knex.schema.raw(`
    DROP TABLE IF EXISTS #removed_eligible_forms_0088;

    SELECT form_row.id AS form_id
    INTO #removed_eligible_forms_0088
    FROM factory_monitoring_point_forms AS form_row
    WHERE form_row.deleted_at IS NULL
      AND EXISTS (
        SELECT 1
        FROM eligible_factories AS deleted_eligible
        WHERE deleted_eligible.monitoring_point_form_id = form_row.id
          AND deleted_eligible.deleted_at IS NOT NULL
      )
      AND NOT EXISTS (
        SELECT 1
        FROM eligible_factories AS active_eligible
        WHERE active_eligible.monitoring_point_form_id = form_row.id
          AND active_eligible.deleted_at IS NULL
      )
      AND NOT EXISTS (
        SELECT 1
        FROM eligible_factories AS connected_eligible
        INNER JOIN cems_wpms_connected_measurement_points AS connected_point
          ON connected_point.eligible_factory_id = connected_eligible.id
         AND connected_point.deleted_at IS NULL
        WHERE connected_eligible.monitoring_point_form_id = form_row.id
      );

    UPDATE point_row
    SET deleted_at = SYSDATETIME(),
        updated_at = SYSDATETIME()
    FROM factory_monitoring_points AS point_row
    INNER JOIN #removed_eligible_forms_0088 AS removed_form
      ON removed_form.form_id = point_row.form_id
    WHERE point_row.deleted_at IS NULL;

    UPDATE form_row
    SET deleted_at = SYSDATETIME(),
        updated_at = SYSDATETIME()
    FROM factory_monitoring_point_forms AS form_row
    INNER JOIN #removed_eligible_forms_0088 AS removed_form
      ON removed_form.form_id = form_row.id
    WHERE form_row.deleted_at IS NULL;

    DROP TABLE #removed_eligible_forms_0088;
  `);
}

export async function down(_knex: Knex): Promise<void> {
  // Intentionally irreversible: restoring removed operational forms could recreate stale data.
}
