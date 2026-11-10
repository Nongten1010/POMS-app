import { db } from '../../config/database';
import { factoryProfileReadTable } from '../factory-profiles/factory-profile-mode';
import type { GeneralInformationSystemType } from './general-information.validator';

export interface GeneralInformationPointRow {
  id: number;
  eligible_factory_id: number | null;
  factory_id: string;
  factory_registration_no: string;
  source_measurement_point_id: number;
  point_code: string | null;
  parameters_json: string;
  details_json: string | null;
  updated_at: Date | string;
  province_name: string | null;
  region: string | null;
  industrial_estate_name: string | null;
  factory_registration_no_new: string | null;
  system_type: GeneralInformationSystemType;
  deleted_at: Date | string | null;
  management_state_json: string | null;
}

/** Include current siblings from both systems to resolve factory visibility in the same read. */
export async function listGeneralInformationPoints(
  systemType: GeneralInformationSystemType,
): Promise<GeneralInformationPointRow[]> {
  return db(factoryProfileReadTable('cems_wpms_connected_measurement_points', 'cp'))
    .leftJoin(
      factoryProfileReadTable('eligible_factories', 'ef'),
      'ef.id',
      'cp.eligible_factory_id',
    )
    .leftJoin('provinces as p', 'p.name_th', 'ef.province_name')
    .leftJoin(
      'poms_factory_status_management as fsm',
      'fsm.eligible_factory_id',
      'cp.eligible_factory_id',
    )
    .where((query) =>
      query
        .where('cp.system_type', systemType)
        .orWhere((siblings) =>
          siblings
            .whereNull('cp.deleted_at')
            .whereIn(
              'cp.eligible_factory_id',
              db(factoryProfileReadTable('cems_wpms_connected_measurement_points', 'requested_cp'))
                .where('requested_cp.system_type', systemType)
                .select('requested_cp.eligible_factory_id'),
            ),
        ),
    )
    .select(
      'cp.id',
      'cp.eligible_factory_id',
      'cp.factory_id',
      'cp.factory_registration_no',
      'cp.source_measurement_point_id',
      'cp.point_code',
      'cp.parameters_json',
      'cp.details_json',
      'cp.updated_at',
      'cp.system_type',
      'cp.deleted_at',
      'fsm.state_json as management_state_json',
      'ef.province_name',
      'ef.industrial_estate_name',
      'ef.factory_registration_no_new',
      'p.region',
    );
}
