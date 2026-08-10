import type { Knex } from 'knex';
import { db } from '../../config/database';
import { applyAssignedFactoryAccessFilter } from '../../shared/utils/factory-access-query';
import { resolveAssignedRegions } from '../auth/regional-access';
import type {
  ListMonitoringPointFormsQuery,
  MonitoringPointFormAccessContext,
  MonitoringPointDTO,
  MonitoringPointFormDTO,
  MonitoringPointFormFactoryInput,
  MonitoringPointFormSummaryDTO,
  MonitoringPointInput,
  MonitoringPointStatus,
  SaveMonitoringPointFormInput,
} from './monitoring-point-forms.types';
import { MONITORING_POINT_STATUSES } from './monitoring-point-forms.types';

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
  eia_other: string | null;
  project_name: string | null;
  address: string | null;
  business_activity: string | null;
  machinery_horsepower: number | string | null;
  latitude: number | string | null;
  longitude: number | string | null;
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
  async list(
    query: ListMonitoringPointFormsQuery,
    access?: MonitoringPointFormAccessContext,
  ): Promise<MonitoringPointFormSummaryDTO[]> {
    const rows = await buildFormsQuery(query, access)
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
        'f.eia_other',
        'f.project_name',
        'f.address',
        'f.business_activity',
        'f.machinery_horsepower',
        'f.latitude',
        'f.longitude',
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
        'f.eia_other',
        'f.project_name',
        'f.address',
        'f.business_activity',
        'f.machinery_horsepower',
        'f.latitude',
        'f.longitude',
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

  async findById(
    id: number,
    access?: MonitoringPointFormAccessContext,
    trx?: Knex.Transaction,
  ): Promise<MonitoringPointFormDTO | null> {
    const form = access
      ? await buildFormsQuery({}, access, trx ?? db)
          .where('f.id', id)
          .select<MonitoringPointFormRow[]>('f.*')
          .first()
      : await (trx ?? db)<MonitoringPointFormRow>('factory_monitoring_point_forms')
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
      const created = await this.findById(Number(id), undefined, trx);
      if (!created) throw new Error('Created monitoring point form could not be loaded');
      return created;
    });
  },

  async update(
    id: number,
    input: SaveMonitoringPointFormInput,
    actorUserId: number,
    access?: MonitoringPointFormAccessContext,
  ): Promise<MonitoringPointFormDTO | null> {
    if (access && !(await this.findById(id, access))) return null;
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

      return this.findById(id, undefined, trx);
    });
  },

  async canAccessFactory(
    factory: MonitoringPointFormFactoryInput,
    access: MonitoringPointFormAccessContext,
  ): Promise<boolean> {
    const scope = toScopeDetails(access.scope);
    if (scope.scope === 'ALL') return true;

    const registration = normalizeLocationValue(factory.factoryRegistrationNoNew);
    if (scope.scope === 'IN_PROVINCE') {
      const selectedProvince = normalizeLocationValue(scope.province);
      const inputProvince = normalizeLocationValue(factory.provinceName);
      return Boolean(selectedProvince && inputProvince && sameLocation(selectedProvince, inputProvince));
    }
    if (scope.scope === 'IN_REGION') {
      const regions = resolveAssignedRegions(scope.region, access.regionalAccess);
      const province = normalizeLocationValue(factory.provinceName);
      if (regions.length === 0 || !province) return false;
      const row = await db('provinces').where('name_th', province).whereIn('region', regions).first();
      return Boolean(row);
    }
    if (!registration) return false;

    const query = db('factories as f')
      .whereNull('f.deleted_at')
      .where((builder) => {
        builder.where('f.fid', registration).orWhere('f.code', registration);
      });
    if (scope.scope === 'IN_ESTATE') {
      const estate = normalizeLocationValue(scope.estateCode ?? scope.estate);
      if (!estate) return false;
      query
        .join('industrial_estates as ie', 'ie.id', 'f.industrial_estate_id')
        .whereNull('ie.deleted_at')
        .where((builder) => builder.where('ie.code', estate).orWhere('ie.name_th', estate));
    } else if (scope.scope === 'OWN_FACTORY') {
      applyAssignedFactoryAccessFilter(query, access.actorUserId);
    } else {
      return false;
    }
    return Boolean(await query.select('f.id').first());
  },
};

function buildFormsQuery(
  query: ListMonitoringPointFormsQuery,
  access?: MonitoringPointFormAccessContext,
  executor: Knex | Knex.Transaction = db,
) {
  const builder = executor('factory_monitoring_point_forms as f').whereNull('f.deleted_at');

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

  if (access) applyFormAccessFilter(builder, access);

  return builder;
}

export function buildFormsQueryForTests(
  query: ListMonitoringPointFormsQuery,
  access: MonitoringPointFormAccessContext,
) {
  return buildFormsQuery(query, access);
}

function applyFormAccessFilter(
  builder: Knex.QueryBuilder,
  access: MonitoringPointFormAccessContext,
): void {
  const scope = toScopeDetails(access.scope);
  switch (scope.scope) {
    case 'ALL':
      return;
    case 'IN_REGION': {
      const regions = resolveAssignedRegions(scope.region, access.regionalAccess);
      if (regions.length === 0) {
        builder.whereRaw('1 = 0');
        return;
      }
      builder.whereExists(function formRegionAccess() {
        this.select(db.raw('1'))
          .from('provinces as pr')
          .whereRaw('pr.name_th = f.province_name')
          .whereIn('pr.region', regions);
      });
      return;
    }
    case 'IN_PROVINCE': {
      const province = normalizeLocationValue(scope.province);
      if (!province) builder.whereRaw('1 = 0');
      else builder.where('f.province_name', province);
      return;
    }
    case 'IN_ESTATE': {
      const estate = normalizeLocationValue(scope.estateCode ?? scope.estate);
      if (!estate) {
        builder.whereRaw('1 = 0');
        return;
      }
      builder.whereExists(function formEstateAccess() {
        this.select(db.raw('1'))
          .from('factories as af')
          .join('industrial_estates as ie', 'ie.id', 'af.industrial_estate_id')
          .whereNull('af.deleted_at')
          .whereNull('ie.deleted_at')
          .where(function formFactoryIdentifier() {
            this.whereRaw('af.fid = f.factory_registration_no_new').orWhereRaw(
              'af.code = f.factory_registration_no_new',
            );
          })
          .where((estateBuilder) => {
            estateBuilder.where('ie.code', estate).orWhere('ie.name_th', estate);
          });
      });
      return;
    }
    case 'OWN_FACTORY':
      builder.whereExists(function formOwnerAccess() {
        this.select(db.raw('1'))
          .from('factories')
          .whereNull('factories.deleted_at')
          .where(function formFactoryIdentifier() {
            this.whereRaw('factories.fid = f.factory_registration_no_new').orWhereRaw(
              'factories.code = f.factory_registration_no_new',
            );
          });
        applyAssignedFactoryAccessFilter(this, access.actorUserId, 'factories');
      });
      return;
    default:
      builder.whereRaw('1 = 0');
  }
}

function toScopeDetails(
  scope: MonitoringPointFormAccessContext['scope'],
): { scope: string | null | undefined; region?: string | null; province?: string | null; estateCode?: string | null; estate?: string | null } {
  return scope && typeof scope === 'object' ? scope : { scope };
}

function normalizeLocationValue(value: string | null | undefined): string | null {
  if (value == null) return null;
  const normalized = value.trim();
  return normalized && normalized.toLowerCase() !== 'all' ? normalized : null;
}

function sameLocation(left: string, right: string): boolean {
  return left.trim().toLowerCase() === right.trim().toLowerCase();
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
    eia_other: factory.eiaOther ?? null,
    project_name: factory.projectName ?? null,
    address: factory.address ?? null,
    business_activity: factory.businessActivity ?? null,
    machinery_horsepower: factory.machineryHorsepower ?? null,
    latitude: factory.latitude ?? null,
    longitude: factory.longitude ?? null,
    created_by: actorUserId,
    updated_by: actorUserId,
  };
}

function toPointInsertRow(
  formId: number,
  point: MonitoringPointInput,
  actorUserId: number,
): Record<string, unknown> {
  const details = {
    ...(point.details ?? {}),
    timeSharingParameters: point.timeSharingParameters ?? [],
    sharedStackCode: point.timeSharingParameters?.includes('ไม่มี')
      ? null
      : (point.sharedStackCode ?? null),
    monitoringPointStatus: point.monitoringPointStatus ?? null,
  };

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
    details_json: JSON.stringify(details),
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
    eiaOther: row.eia_other,
    projectName: row.project_name,
    address: row.address,
    businessActivity: row.business_activity,
    machineryHorsepower: toNullableNumber(row.machinery_horsepower),
    latitude: toNullableNumber(row.latitude),
    longitude: toNullableNumber(row.longitude),
  };
}

function toPointDTO(row: MonitoringPointRow): MonitoringPointDTO {
  const details = parseObject(row.details_json);
  const timeSharingParameters = parseStoredStringList(details?.timeSharingParameters);

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
    timeSharingParameters,
    sharedStackCode: timeSharingParameters.includes('ไม่มี')
      ? null
      : parseNullableString(details?.sharedStackCode),
    monitoringPointStatus: parseMonitoringPointStatus(details?.monitoringPointStatus),
    primaryFuel: row.primary_fuel,
    primaryFuelOther: row.primary_fuel_other,
    secondaryFuel: row.secondary_fuel,
    secondaryFuelOther: row.secondary_fuel_other,
    details,
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at),
  };
}

function parseStringList(value: string): string[] {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === 'string')
      : [];
  } catch {
    return [];
  }
}

function parseStoredStringList(value: unknown): string[] {
  const items = Array.isArray(value) ? value : typeof value === 'string' ? value.split(',') : [];

  return items
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseNullableString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  return value.trim() || null;
}

function parseMonitoringPointStatus(value: unknown): MonitoringPointStatus | null {
  return MONITORING_POINT_STATUSES.find((status) => status === value) ?? null;
}

function parseDelimitedStringList(value: string | null): string[] {
  if (!value) return [];

  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) {
      return parsed.filter(
        (item): item is string => typeof item === 'string' && item.trim().length > 0,
      );
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
  return (
    value
      .map((item) => item.trim())
      .filter(Boolean)
      .join(',') || null
  );
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
