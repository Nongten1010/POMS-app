import type { Knex } from 'knex';

export const config = { transaction: true };

/** Repair only detector events proven by its own hour receipt and legacy Bangkok default. */
export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    IF DATEDIFF(MINUTE, SYSUTCDATETIME(), SYSDATETIME()) = 420
    BEGIN
      UPDATE e SET detected_at = DATEADD(HOUR, -7, e.detected_at)
      FROM dbo.alert_events AS e
      WHERE e.deleted_at IS NULL
        AND JSON_VALUE(CASE WHEN ISJSON(e.evidence_json) = 1 THEN e.evidence_json ELSE '{}' END,
                       '$.producer') = 'POMS_HOURLY_DETECTOR'
        AND e.detected_at = e.created_at
        AND e.detected_at > SYSUTCDATETIME()
        AND DATEADD(HOUR, -7, e.detected_at) <= SYSUTCDATETIME()
        AND EXISTS (
          SELECT 1 FROM dbo.alert_exceedance_hours AS h
          CROSS APPLY OPENJSON(
            CASE WHEN ISJSON(h.summary_json) = 1 THEN h.summary_json ELSE '{}' END,
            '$.eventIds') AS ids
          WHERE h.mode = 'active'
            AND h.system_type = e.system_type AND h.station_id = e.station_id
            AND h.hour_at = e.started_at
            AND TRY_CONVERT(BIGINT, ids.value) = e.id
        );
    END
  `);
}

export async function down(): Promise<void> {
  // Forward-only correction: do not restore future timestamps or replay sent mail.
}
