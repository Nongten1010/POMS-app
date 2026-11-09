import { factoryAccessReadTable } from './factory-access-query';
import type { Knex } from 'knex';
import { factoryProfileReadTable } from '../../modules/factory-profiles/factory-profile-mode';

/** Resolve current province/estate from eligible alias ef; master alias f is a legacy fallback. */
export function joinKwpFactoryLocation(builder: Knex.QueryBuilder): void {
  builder
    .joinRaw(
      `
      OUTER APPLY (
        SELECT TOP (1) p_source.*
        FROM provinces AS p_source
        WHERE p_source.name_th = ef.province_name
          OR (ef.id IS NULL AND p_source.id = f.province_id)
        ORDER BY p_source.id
      ) AS p
    `,
    )
    .joinRaw(
      `
      OUTER APPLY (
        SELECT TOP (1) ie_source.*
        FROM industrial_estates AS ie_source
        WHERE ie_source.name_th = ef.industrial_estate_name
          OR (ef.id IS NULL AND ie_source.id = f.industrial_estate_id)
        ORDER BY ie_source.id
      ) AS ie
    `,
    );
}

/** Factory queries start with factories as f and use the same identity as the KWP factory list. */
export function joinKwpFactoryProfile(builder: Knex.QueryBuilder): void {
  builder
    .joinRaw(
      `
      OUTER APPLY (
        SELECT TOP (1) ef_source.*
        FROM ${factoryProfileReadTable('eligible_factories')} AS ef_source
        WHERE ef_source.deleted_at IS NULL
          AND (
            ef_source.factory_registration_no_new = f.fid
            OR ef_source.source_factory_id = f.fid
            OR ef_source.factory_registration_no_new = f.code
            OR ef_source.source_factory_id = f.code
            OR ef_source.factory_registration_no_old = f.code
          )
        ORDER BY CASE
          WHEN ef_source.factory_registration_no_new = f.fid THEN 0
          WHEN ef_source.source_factory_id = f.fid THEN 1
          WHEN ef_source.factory_registration_no_old = f.code THEN 2
          WHEN ef_source.factory_registration_no_new = f.code THEN 3
          ELSE 4
        END, ef_source.id DESC
      ) AS ef
    `,
    )
    .modify(joinKwpFactoryLocation);
}

/** Submission queries start with kwp_form_submissions as s; snapshots never choose current jurisdiction. */
export function joinKwpSubmissionFactoryProfile(builder: Knex.QueryBuilder): void {
  builder
    .leftJoin(
      factoryProfileReadTable('cems_wpms_connected_measurement_points', 'cp'),
      function joinConnectedPoint() {
        this.on('cp.id', '=', 's.connected_point_id').andOnNull('cp.deleted_at');
      },
    )
    .joinRaw(
      `
      OUTER APPLY (
        SELECT TOP (1) ef_source.*
        FROM ${factoryProfileReadTable('eligible_factories')} AS ef_source
        WHERE ef_source.deleted_at IS NULL
          AND (
            ef_source.id = cp.eligible_factory_id
            OR ef_source.factory_registration_no_new = cp.factory_registration_no
            OR ef_source.factory_registration_no_new = cp.factory_id
            OR ef_source.source_factory_id = cp.factory_id
            OR ef_source.factory_registration_no_old = s.factory_registration_no
            OR ef_source.factory_registration_no_new = s.factory_registration_no
            OR ef_source.factory_registration_no_new = s.factory_id
            OR ef_source.source_factory_id = s.factory_id
          )
        ORDER BY CASE
          WHEN ef_source.id = cp.eligible_factory_id THEN 0
          WHEN ef_source.factory_registration_no_new = cp.factory_registration_no THEN 1
          WHEN ef_source.factory_registration_no_new = cp.factory_id THEN 2
          WHEN ef_source.source_factory_id = cp.factory_id THEN 3
          WHEN ef_source.factory_registration_no_old = s.factory_registration_no THEN 4
          WHEN ef_source.factory_registration_no_new = s.factory_registration_no THEN 5
          WHEN ef_source.factory_registration_no_new = s.factory_id THEN 6
          ELSE 7
        END, ef_source.id DESC
      ) AS ef
    `,
    )
    .joinRaw(
      `
      OUTER APPLY (
        SELECT TOP (1) f_source.*
        FROM ${factoryAccessReadTable('f_source')}
        WHERE f_source.deleted_at IS NULL
          AND (
            f_source.fid = ef.source_factory_id
            OR f_source.fid = ef.factory_registration_no_new
            OR f_source.code = ef.factory_registration_no_old
            OR f_source.fid = cp.factory_id
            OR f_source.code = cp.factory_registration_no
            OR f_source.fid = s.factory_id
            OR f_source.code = s.factory_id
            OR f_source.code = s.factory_registration_no
          )
        ORDER BY CASE
          WHEN f_source.fid = ef.source_factory_id THEN 0
          WHEN f_source.fid = ef.factory_registration_no_new THEN 1
          WHEN f_source.code = ef.factory_registration_no_old THEN 2
          WHEN f_source.fid = cp.factory_id THEN 3
          WHEN f_source.fid = s.factory_id THEN 4
          WHEN f_source.code = s.factory_registration_no THEN 5
          ELSE 6
        END, f_source.id DESC
      ) AS f
    `,
    )
    .modify(joinKwpFactoryLocation);
}
