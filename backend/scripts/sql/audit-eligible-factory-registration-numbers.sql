-- SELECT-only preview. This does not repair records or approve any data changes.
-- Compare proposed values with Fac60k before planning a transactional repair.
SELECT
    ef.id,
    ef.source_system,
    ef.source_factory_id,
    ef.factory_registration_no_new AS stored_new_number,
    ef.factory_registration_no_old AS stored_old_number,
    ef.source_factory_id AS proposed_new_number,
    ef.factory_registration_no_new AS proposed_old_number,
    ef.monitoring_point_form_id,
    ef.created_at,
    ef.updated_at,
    ef.deleted_at,
    CASE WHEN EXISTS (
        SELECT 1 FROM eligible_factories AS other
        WHERE other.id <> ef.id
          AND other.factory_registration_no_new = ef.source_factory_id
    ) THEN 1 ELSE 0 END AS has_registration_conflict
FROM eligible_factories AS ef
WHERE ef.source_system = 'diw.fac_import'
  AND ef.factory_registration_no_old IS NULL
  AND NULLIF(LTRIM(RTRIM(ef.source_factory_id)), '') IS NOT NULL
  AND ef.source_factory_id <> ef.factory_registration_no_new
ORDER BY ef.id;
