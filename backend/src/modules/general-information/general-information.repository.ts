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
}

/** One read supplies all four summaries, including deleted/disconnected/hidden points. */
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
    .where('cp.system_type', systemType)
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
      'ef.province_name',
      'ef.industrial_estate_name',
      'ef.factory_registration_no_new',
      'p.region',
    );
}
