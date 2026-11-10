import { db } from '../../config/database';
import { factoryAccessReadTable } from '../../shared/utils/factory-access-query';
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
  monitoring_point_status: string | null;
  factory_is_active: boolean | number | null;
}

/** Read current connected membership; the factory master supplies activity metadata only. */
export async function listGeneralInformationPoints(
  systemType: GeneralInformationSystemType,
): Promise<GeneralInformationPointRow[]> {
  return db(factoryProfileReadTable('cems_wpms_connected_measurement_points', 'cp'))
    .join(factoryProfileReadTable('eligible_factories', 'ef'), 'ef.id', 'cp.eligible_factory_id')
    .leftJoin(factoryAccessReadTable('f'), function joinFactoryMaster() {
      this.on(function joinFactoryKeys() {
        this.on('f.code', '=', 'ef.factory_registration_no_new')
          .orOn('f.fid', '=', 'ef.factory_registration_no_new')
          .orOn('f.fid', '=', 'ef.source_factory_id')
          .orOn('f.code', '=', 'ef.source_factory_id');
      }).andOnNull('f.deleted_at');
    })
    .leftJoin('provinces as p', 'p.name_th', 'ef.province_name')
    .leftJoin(
      'poms_factory_status_management as fsm',
      'fsm.eligible_factory_id',
      'cp.eligible_factory_id',
    )
    .where('cp.system_type', systemType)
    .whereNull('cp.deleted_at')
    .whereNull('ef.deleted_at')
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
      'cp.monitoring_point_status',
      db.raw('CAST(f.is_active AS INT) as factory_is_active'),
      'fsm.state_json as management_state_json',
      'ef.province_name',
      'ef.industrial_estate_name',
      'ef.factory_registration_no_new',
      'p.region',
    );
}
