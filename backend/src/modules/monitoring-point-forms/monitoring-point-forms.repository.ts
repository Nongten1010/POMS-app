import type { Knex } from 'knex';
import { db } from '../../config/database';
import type {
  ListMonitoringPointFormsQuery,
  MonitoringPointDTO,
  MonitoringPointFormDTO,
  MonitoringPointFormFactoryInput,
  MonitoringPointFormSummaryDTO,
  MonitoringPointInput,
  SaveMonitoringPointFormInput,
} from './monitoring-point-forms.types';

interface MonitoringPointFormRow {
  id: number | string;
  factory_name: string | null;
  factory_registration_no_new: string | null;
  factory_registration_no_old: string | null;
  province_name: string | null;
  factory_type_main: string | null;
  factory_type_sub: string | null;
  operation_status: string | null;
  eia_info: string | null;
  address: string | null;
  business_activity: string | null;
  machinery_horsepower: number | string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

interface MonitoringPointRow {
  id: number | string;
  form_id: number | string;
  system_type: 'CEMS' | 'WPMS';
  point_code: string | null;
  point_name: string | null;
  production_unit_type: string | null;
  production_capacity: string | null;
  cems_installation_required_by: string | null;
  cems_installation_required_other: string | null;
  legal_annex_no: string | null;
  accounting_connection_status: string | null;
  eligible_parameters_json: string;
  exempted_parameters_json: string;
  connected_parameters_json: string;
  pending_parameters_json: string;
  primary_fuel: string | null;
  primary_fuel_other: string | null;
  secondary_fuel: string | null;
  secondary_fuel_other: string | null;
  details_json: string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

interface MonitoringPointFormSummaryRow extends MonitoringPointFormRow {
  point_count: number | string | null;
  cems_point_count: number | string | null;
  wpms_point_count: number | string | null;
}

export const monitoringPointFormsRepository = {
  async list(query: ListMonitoringPointFormsQuery): Promise<MonitoringPointFormSummaryDTO[]> {
    const rows = await buildFormsQuery(query)
      .leftJoin('factory_monitoring_points as p', function joinPoints() {
        this.on('p.form_id', '=', 'f.id').andOnNull('p.deleted_at');
      })
      .groupBy(
        'f.id',
        'f.factory_name',
        'f.factory_registration_no_new',
        'f.factory_registration_no_old',
        'f.province_name',
        'f.factory_type_main',
        'f.factory_type_sub',
        'f.operation_status',
        'f.eia_info',
        'f.address',
        'f.business_activity',
        'f.machinery_horsepower',
        'f.created_at',
        'f.updated_at',
      )
      .select<MonitoringPointFormSummaryRow[]>([
        'f.id',
        'f.factory_name',
        'f.factory_registration_no_new',
        'f.factory_registration_no_old',
        'f.province_name',
        'f.factory_type_main',
        'f.factory_type_sub',
        'f.operation_status',
        'f.eia_info',
        'f.address',
        'f.business_activity',
        'f.machinery_horsepower',
        'f.created_at',
        'f.updated_at',
        db.raw('COUNT(p.id) as point_count'),
        db.raw("SUM(CASE WHEN p.system_type = 'CEMS' THEN 1 ELSE 0 END) as cems_point_count"),
        db.raw("SUM(CASE WHEN p.system_type = 'WPMS' THEN 1 ELSE 0 END) as wpms_point_count"),
      ])
      .orderBy('f.updated_at', 'desc')
      .orderBy('f.id', 'desc');

    return rows.map(toSummaryDTO);
  },

  async findById(id: number, trx?: Knex.Transaction): Promise<MonitoringPointFormDTO | null> {
    const form = await (trx ?? db)<MonitoringPointFormRow>('factory_monitoring_point_forms')
      .where('id', id)
      .whereNull('deleted_at')
      .first();
    if (!form) return null;

    const points = await (trx ?? db)<MonitoringPointRow>('factory_monitoring_points')
      .where('form_id', id)
      .whereNull('deleted_at')
      .orderBy('id', 'asc');

    return {
      ...toFormDTO(form),
      points: points.map(toPointDTO),
    };
  },

  async create(
    input: SaveMonitoringPointFormInput,
    actorUserId: number,
  ): Promise<MonitoringPointFormDTO> {
    return db.transaction(async (trx) => {
      const [{ id }] = await trx('factory_monitoring_point_forms')
        .insert(toFormInsertRow(input.factory, actorUserId))
        .returning('id');
      await insertPoints(trx, Number(id), input.points, actorUserId);
      const created = await this.findById(Number(id), trx);
      if (!created) throw new Error('Created monitoring point form could not be loaded');
      return created;
    });
  },

  async update(
    id: number,
    input: SaveMonitoringPointFormInput,
    actorUserId: number,
  ): Promise<MonitoringPointFormDTO | null> {
    return db.transaction(async (trx) => {
      const affected = await trx('factory_monitoring_point_forms')
        .where('id', id)
        .whereNull('deleted_at')
        .update({
          ...toFormInsertRow(input.factory, actorUserId),
          updated_at: trx.fn.now(),
          updated_by: actorUserId,
        });
      if (affected === 0) return null;

      await trx('factory_monitoring_points').where('form_id', id).whereNull('deleted_at').update({
        deleted_at: trx.fn.now(),
        updated_at: trx.fn.now(),
        updated_by: actorUserId,
      });
      await insertPoints(trx, id, input.points, actorUserId);

      return this.findById(id, trx);
    });
  },
};

function buildFormsQuery(query: ListMonitoringPointFormsQuery) {
  const builder = db('factory_monitoring_point_forms as f').whereNull('f.deleted_at');

  if (query.factoryRegistrationNoNew) {
    builder.where('f.factory_registration_no_new', query.factoryRegistrationNoNew);
  }

  if (query.systemType) {
    builder.whereExists(function existsPoint() {
      this.select(db.raw('1'))
        .from('factory_monitoring_points as sp')
        .whereRaw('sp.form_id = f.id')
        .whereNull('sp.deleted_at')
        .where('sp.system_type', query.systemType);
    });
  }

  return builder;
}

async function insertPoints(
  trx: Knex.Transaction,
  formId: number,
  points: MonitoringPointInput[],
  actorUserId: number,
) {
  if (points.length === 0) return;

  await trx('factory_monitoring_points').insert(
    points.map((point) => toPointInsertRow(formId, point, actorUserId)),
  );
}

function toFormInsertRow(
  factory: MonitoringPointFormFactoryInput,
  actorUserId: number,
): Record<string, unknown> {
  return {
    factory_name: factory.factoryName ?? null,
    factory_registration_no_new: factory.factoryRegistrationNoNew ?? null,
    factory_registration_no_old: factory.factoryRegistrationNoOld ?? null,
    province_name: factory.provinceName ?? null,
    factory_type_main: factory.factoryTypeMain ?? null,
    factory_type_sub: factory.factoryTypeSub ?? null,
    operation_status: factory.operationStatus ?? null,
    eia_info: factory.eiaInfo ?? null,
    address: factory.address ?? null,
    business_activity: factory.businessActivity ?? null,
    machinery_horsepower: factory.machineryHorsepower ?? null,
    created_by: actorUserId,
    updated_by: actorUserId,
  };
}

function toPointInsertRow(
  formId: number,
  point: MonitoringPointInput,
  actorUserId: number,
): Record<string, unknown> {
  return {
    form_id: formId,
    system_type: point.systemType,
    point_code: point.pointCode ?? null,
    point_name: point.pointName ?? null,
    production_unit_type: point.productionUnitType ?? null,
    production_capacity: point.productionCapacity ?? null,
    cems_installation_required_by: point.cemsInstallationRequiredBy ?? null,
    cems_installation_required_other: point.cemsInstallationRequiredOther ?? null,
    legal_annex_no: formatStringList(point.legalAnnexNo),
    accounting_connection_status: point.accountingConnectionStatus ?? null,
    eligible_parameters_json: JSON.stringify(point.eligibleParameters ?? []),
    exempted_parameters_json: JSON.stringify(point.exemptedParameters ?? []),
    connected_parameters_json: JSON.stringify(point.connectedParameters ?? []),
    pending_parameters_json: JSON.stringify(point.pendingParameters ?? []),
    primary_fuel: point.primaryFuel ?? null,
    primary_fuel_other: point.primaryFuelOther ?? null,
    secondary_fuel: point.secondaryFuel ?? null,
    secondary_fuel_other: point.secondaryFuelOther ?? null,
    details_json: point.details ? JSON.stringify(point.details) : null,
    created_by: actorUserId,
    updated_by: actorUserId,
  };
}

function toFormDTO(row: MonitoringPointFormRow): Omit<MonitoringPointFormDTO, 'points'> {
  return {
    id: Number(row.id),
    factory: toFactoryDTO(row),
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at),
  };
}

function toSummaryDTO(row: MonitoringPointFormSummaryRow): MonitoringPointFormSummaryDTO {
  return {
    ...toFormDTO(row),
    pointCount: Number(row.point_count ?? 0),
    cemsPointCount: Number(row.cems_point_count ?? 0),
    wpmsPointCount: Number(row.wpms_point_count ?? 0),
  };
}

function toFactoryDTO(row: MonitoringPointFormRow): Required<MonitoringPointFormFactoryInput> {
  return {
    factoryName: row.factory_name,
    factoryRegistrationNoNew: row.factory_registration_no_new,
    factoryRegistrationNoOld: row.factory_registration_no_old,
    provinceName: row.province_name,
    factoryTypeMain: row.factory_type_main,
    factoryTypeSub: row.factory_type_sub,
    operationStatus: row.operation_status,
    eiaInfo: row.eia_info,
    address: row.address,
    businessActivity: row.business_activity,
    machineryHorsepower: toNullableNumber(row.machinery_horsepower),
  };
}

function toPointDTO(row: MonitoringPointRow): MonitoringPointDTO {
  return {
    id: Number(row.id),
    formId: Number(row.form_id),
    systemType: row.system_type,
    pointCode: row.point_code,
    pointName: row.point_name,
    productionUnitType: row.production_unit_type,
    productionCapacity: row.production_capacity,
    cemsInstallationRequiredBy: row.cems_installation_required_by,
    cemsInstallationRequiredOther: row.cems_installation_required_other,
    legalAnnexNo: parseDelimitedStringList(row.legal_annex_no),
    accountingConnectionStatus: row.accounting_connection_status,
    eligibleParameters: parseStringList(row.eligible_parameters_json),
    exemptedParameters: parseStringList(row.exempted_parameters_json),
    connectedParameters: parseStringList(row.connected_parameters_json),
    pendingParameters: parseStringList(row.pending_parameters_json),
    primaryFuel: row.primary_fuel,
    primaryFuelOther: row.primary_fuel_other,
    secondaryFuel: row.secondary_fuel,
    secondaryFuelOther: row.secondary_fuel_other,
    details: parseObject(row.details_json),
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at),
  };
}

function parseStringList(value: string): string[] {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

function parseDelimitedStringList(value: string | null): string[] {
  if (!value) return [];

  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      return parsed.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
    }
  } catch {
    // Fall back to the legacy comma-separated format below.
  }

  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function formatStringList(value: string[] | undefined): string | null {
  if (!value?.length) return null;
  return value.map((item) => item.trim()).filter(Boolean).join(',') || null;
}

function parseObject(value: string | null): Record<string, unknown> | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function toIsoString(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function toNullableNumber(value: number | string | null): number | null {
  if (value === null) return null;
  return Number(value);
}
