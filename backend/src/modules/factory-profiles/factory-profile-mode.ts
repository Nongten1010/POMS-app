import { env } from '../../config/env';

type FactoryProfileReadSource =
  | 'eligible_factories'
  | 'cems_wpms_connected_measurement_points'
  | 'factory_monitoring_point_forms';

/** Enable only after the guarded backfill readiness check passes. */
export function isCanonicalFactoryProfilesEnabled(): boolean {
  return env.FACTORY_PROFILE_MODE === 'canonical';
}

/** Current SELECTs only. Writes, locks and history keep their base tables. */
export function factoryProfileReadTable(table: FactoryProfileReadSource, alias?: string): string {
  const view =
    table === 'cems_wpms_connected_measurement_points'
      ? 'current_connected_measurement_points'
      : `current_${table}`;
  const source = isCanonicalFactoryProfilesEnabled() ? view : table;
  return alias ? `${source} as ${alias}` : source;
}
