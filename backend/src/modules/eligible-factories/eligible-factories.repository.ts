import type { Knex } from 'knex';
import { db } from '../../config/database';
import { factorySourceDb, factorySourceTableName } from '../../config/factory-source-database';
import { logger } from '../../config/logger';
import type {
  CreateEligibleFactoryInput,
  EligibleFactoryDTO,
  EligibleFactoryMeasurementPointDTO,
  ListEligibleFactoriesQuery,
} from './eligible-factories.types';

interface EligibleFactoryRow {
  id: number | string;
  source_system: string;
  source_factory_id: string | null;
  monitoring_point_form_id: number | string | null;
  factory_registration_no_new: string;
  factory_registration_no_old: string | null;
  factory_name: string;
  factory_type_sequence: string | null;
  address: string | null;
  province_name: string;
  industrial_estate_name: string | null;
  latitude: number | string | null;
  longitude: number | string | null;
  business_activity: string | null;
  operation_status: string;
  capital_amount: number | string | null;
  machinery_horsepower: number | string | null;
  production_capacity: string | null;
  wastewater_discharge_info: string | null;
  boiler_count: number | string | null;
  boiler_size_each: string | null;
  fuel_used: string | null;
  has_eia: boolean | number | null;
  selected_reason: string | null;
  selected_by: number | string;
  selected_at: Date | string;
  created_at: Date | string;
  updated_at: Date | string;
}

interface EligibleFactoryMonitoringPointRow {
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
}

interface FactoryHorsepowerRow {
  FID?: string | null;
  FACREG?: string | null;
  DISPFACREG?: string | null;
  HP?: number | string | null;
  HP2?: number | string | null;
}

const EXTERNAL_LOOKUP_TIMEOUT_MS = 300000;

export const eligibleFactoriesRepository = {
  async list(
    _query: ListEligibleFactoriesQuery,
  ): Promise<{ rows: EligibleFactoryDTO[]; total: number }> {
    const baseQuery = buildEligibleFactoriesBaseQuery();
    const totalRow = await baseQuery
      .clone()
      .clearSelect()
      .clearOrder()
      .count<{ total: number | string }>('id as total')
      .first();
    const total = Number(totalRow?.total ?? 0);

    const rowsQuery = baseQuery.clone().orderBy('selected_at', 'desc').orderBy('id', 'desc');

    const rows = await rowsQuery;
    const factories = await hydrateMissingMachineryHorsepower(rows.map(toDTO));
    return { rows: await hydrateMeasurementPoints(factories), total };
  },

  async findByRegistrationNoNew(
    registrationNoNew: string,
  ): Promise<{
    id: number;
    factoryRegistrationNoNew: string;
    monitoringPointFormId: number | null;
  } | null> {
    const row = await db('eligible_factories')
      .where('factory_registration_no_new', registrationNoNew)
      .whereNull('deleted_at')
      .select('id', 'factory_registration_no_new', 'monitoring_point_form_id')
      .first();

    if (!row) return null;
    return {
      id: Number(row.id),
      factoryRegistrationNoNew: row.factory_registration_no_new,
      monitoringPointFormId:
        row.monitoring_point_form_id === null || row.monitoring_point_form_id === undefined
          ? null
          : Number(row.monitoring_point_form_id),
    };
  },

  async findByMonitoringPointFormId(formId: number): Promise<EligibleFactoryDTO | null> {
    const row = await db<EligibleFactoryRow>('eligible_factories')
      .where('monitoring_point_form_id', formId)
      .whereNull('deleted_at')
      .first();

    return row ? toDTO(row) : null;
  },

  async create(
    input: CreateEligibleFactoryInput,
    actorUserId: number,
  ): Promise<EligibleFactoryDTO> {
    const restored = await restoreDeletedFactory(input, actorUserId);
    if (restored) return restored;

    const [{ id }] = await db('eligible_factories')
      .insert(toInsertRow(input, actorUserId))
      .returning('id');
    const created = await this.findById(Number(id));
    if (!created) throw new Error('Created eligible factory could not be loaded');
    return created;
  },

  async findById(id: number, trx?: Knex.Transaction): Promise<EligibleFactoryDTO | null> {
    const row = await (trx ?? db)<EligibleFactoryRow>('eligible_factories')
      .where('id', id)
      .whereNull('deleted_at')
      .first();
    return row ? toDTO(row) : null;
  },

  async listActiveRegistrationNumbers(): Promise<string[]> {
    const rows = await db('eligible_factories')
      .whereNull('deleted_at')
      .select<{ factory_registration_no_new: string }[]>('factory_registration_no_new');

    return rows.map((row) => row.factory_registration_no_new);
  },

  async softDelete(id: number, actorUserId: number): Promise<boolean> {
    const affected = await db('eligible_factories').where('id', id).whereNull('deleted_at').update({
      deleted_at: db.fn.now(),
      updated_at: db.fn.now(),
      updated_by: actorUserId,
    });

    return affected > 0;
  },

  async attachMonitoringPointForm(
    eligibleFactoryId: number,
    formId: number,
    actorUserId: number,
  ): Promise<EligibleFactoryDTO | null> {
    await db('eligible_factories')
      .where('id', eligibleFactoryId)
      .whereNull('deleted_at')
      .update({
        monitoring_point_form_id: formId,
        updated_at: db.fn.now(),
        updated_by: actorUserId,
      });

    return this.findById(eligibleFactoryId);
  },

  async updateFromMonitoringPointForm(
    eligibleFactoryId: number,
    input: CreateEligibleFactoryInput,
    actorUserId: number,
  ): Promise<EligibleFactoryDTO | null> {
    await db('eligible_factories')
      .where('id', eligibleFactoryId)
      .whereNull('deleted_at')
      .update({
        ...toMonitoringPointFormUpdateRow(input),
        updated_at: db.fn.now(),
        updated_by: actorUserId,
      });

    return this.findById(eligibleFactoryId);
  },
};

function buildEligibleFactoriesBaseQuery(): Knex.QueryBuilder<
  EligibleFactoryRow,
  EligibleFactoryRow[]
> {
  const builder = db<EligibleFactoryRow>('eligible_factories').whereNull('deleted_at');

  return builder.select(
    'id',
    'source_system',
    'source_factory_id',
    'monitoring_point_form_id',
    'factory_registration_no_new',
    'factory_registration_no_old',
    'factory_name',
    'factory_type_sequence',
    'address',
    'province_name',
    'industrial_estate_name',
    'latitude',
    'longitude',
    'business_activity',
    'operation_status',
    'capital_amount',
    'machinery_horsepower',
    'production_capacity',
    'wastewater_discharge_info',
    'boiler_count',
    'boiler_size_each',
    'fuel_used',
    'has_eia',
    'selected_reason',
    'selected_by',
    'selected_at',
    'created_at',
    'updated_at',
  );
}

async function restoreDeletedFactory(
  input: CreateEligibleFactoryInput,
  actorUserId: number,
): Promise<EligibleFactoryDTO | null> {
  const existingDeleted = await db('eligible_factories')
    .where('factory_registration_no_new', input.factoryRegistrationNoNew)
    .whereNotNull('deleted_at')
    .select<{ id: number | string }[]>('id')
    .first();

  if (!existingDeleted) return null;

  await db('eligible_factories')
    .where('id', existingDeleted.id)
    .update({
      ...toInsertRow(input, actorUserId),
      deleted_at: null,
      selected_at: db.fn.now(),
      updated_at: db.fn.now(),
    });

  return eligibleFactoriesRepository.findById(Number(existingDeleted.id));
}

function toInsertRow(
  input: CreateEligibleFactoryInput,
  actorUserId: number,
): Record<string, unknown> {
  return {
    source_system: input.sourceSystem ?? 'external_factory_db',
    source_factory_id: input.sourceFactoryId ?? null,
    monitoring_point_form_id: input.monitoringPointFormId ?? null,
    factory_registration_no_new: input.factoryRegistrationNoNew,
    factory_registration_no_old: input.factoryRegistrationNoOld ?? null,
    factory_name: input.factoryName,
    factory_type_sequence: input.factoryTypeSequence ?? null,
    address: input.address ?? null,
    province_name: input.provinceName,
    industrial_estate_name: input.industrialEstateName ?? null,
    latitude: input.coordinates?.latitude ?? null,
    longitude: input.coordinates?.longitude ?? null,
    business_activity: input.businessActivity ?? null,
    operation_status: input.operationStatus,
    capital_amount: input.capitalAmount ?? null,
    machinery_horsepower: input.machineryHorsepower ?? null,
    production_capacity: input.productionCapacity ?? null,
    wastewater_discharge_info: input.wastewaterDischargeInfo ?? null,
    boiler_count: input.boilerCount ?? null,
    boiler_size_each: input.boilerSizeEach ?? null,
    fuel_used: input.fuelUsed ?? null,
    has_eia: input.hasEia ?? null,
    selected_reason: input.selectedReason ?? null,
    selected_by: actorUserId,
    created_by: actorUserId,
    updated_by: actorUserId,
  };
}

function toMonitoringPointFormUpdateRow(input: CreateEligibleFactoryInput): Record<string, unknown> {
  return {
    source_system: input.sourceSystem ?? 'monitoring_point_forms',
    source_factory_id: input.sourceFactoryId ?? null,
    monitoring_point_form_id: input.monitoringPointFormId ?? null,
    factory_registration_no_new: input.factoryRegistrationNoNew,
    factory_registration_no_old: input.factoryRegistrationNoOld ?? null,
    factory_name: input.factoryName,
    factory_type_sequence: input.factoryTypeSequence ?? null,
    address: input.address ?? null,
    province_name: input.provinceName,
    industrial_estate_name: input.industrialEstateName ?? null,
    latitude: input.coordinates?.latitude ?? null,
    longitude: input.coordinates?.longitude ?? null,
    business_activity: input.businessActivity ?? null,
    operation_status: input.operationStatus,
    machinery_horsepower: input.machineryHorsepower ?? null,
    production_capacity: input.productionCapacity ?? null,
    fuel_used: input.fuelUsed ?? null,
    has_eia: input.hasEia ?? null,
    selected_reason: input.selectedReason ?? null,
  };
}

function toDTO(row: EligibleFactoryRow): EligibleFactoryDTO {
  const latitude = toNullableNumber(row.latitude);
  const longitude = toNullableNumber(row.longitude);

  return {
    id: Number(row.id),
    sourceSystem: row.source_system,
    sourceFactoryId: row.source_factory_id,
    monitoringPointFormId: toNullableNumber(row.monitoring_point_form_id),
    factoryRegistrationNoNew: row.factory_registration_no_new,
    factoryRegistrationNoOld: row.factory_registration_no_old,
    factoryName: row.factory_name,
    factoryTypeSequence: row.factory_type_sequence,
    address: row.address,
    provinceName: row.province_name,
    industrialEstateName: row.industrial_estate_name,
    coordinates:
      latitude === null || longitude === null
        ? null
        : {
            latitude,
            longitude,
          },
    businessActivity: row.business_activity,
    operationStatus: row.operation_status,
    capitalAmount: toNullableNumber(row.capital_amount),
    machineryHorsepower: toNullableNumber(row.machinery_horsepower),
    productionCapacity: row.production_capacity,
    wastewaterDischargeInfo: row.wastewater_discharge_info,
    boilerCount: toNullableNumber(row.boiler_count),
    boilerSizeEach: row.boiler_size_each,
    fuelUsed: row.fuel_used,
    hasEia: toNullableBoolean(row.has_eia),
    selectedReason: row.selected_reason,
    selectedBy: Number(row.selected_by),
    selectedAt: toIsoString(row.selected_at),
    createdAt: toIsoString(row.created_at),
    updatedAt: toIsoString(row.updated_at),
  };
}

async function hydrateMeasurementPoints(rows: EligibleFactoryDTO[]): Promise<EligibleFactoryDTO[]> {
  const formIds = rows
    .map((row) => row.monitoringPointFormId)
    .filter((value): value is number => value !== null && value !== undefined);
  if (formIds.length === 0) return rows;

  const pointRows = await db<EligibleFactoryMonitoringPointRow>('factory_monitoring_points')
    .whereIn('form_id', Array.from(new Set(formIds)))
    .whereNull('deleted_at')
    .orderBy('form_id', 'asc')
    .orderBy('id', 'asc');

  const pointsByFormId = new Map<number, EligibleFactoryMeasurementPointDTO[]>();
  for (const pointRow of pointRows) {
    const formId = Number(pointRow.form_id);
    const currentPoints = pointsByFormId.get(formId) ?? [];
    pointsByFormId.set(formId, [...currentPoints, toMeasurementPointDTO(pointRow)]);
  }

  return rows.map((row) => ({
    ...row,
    measurementPoints:
      row.monitoringPointFormId === null
        ? []
        : pointsByFormId.get(row.monitoringPointFormId) ?? [],
  }));
}

async function hydrateMissingMachineryHorsepower(
  rows: EligibleFactoryDTO[],
): Promise<EligibleFactoryDTO[]> {
  const missingRows = rows.filter((row) => row.machineryHorsepower === null);
  if (missingRows.length === 0) return rows;

  const sourceFactoryIds = uniqueNonEmpty(missingRows.map((row) => row.sourceFactoryId));
  const registrationNumbers = uniqueNonEmpty(
    missingRows.map((row) => row.factoryRegistrationNoNew),
  );
  if (sourceFactoryIds.length === 0 && registrationNumbers.length === 0) return rows;

  try {
    const sourceRows = await factorySourceDb<FactoryHorsepowerRow>(factorySourceTableName())
      .where((builder) => {
        if (sourceFactoryIds.length > 0) {
          builder.whereIn('FID', sourceFactoryIds);
        }
        if (registrationNumbers.length > 0) {
          builder
            .orWhereIn('DISPFACREG', registrationNumbers)
            .orWhereIn('FACREG', registrationNumbers);
        }
      })
      .timeout(EXTERNAL_LOOKUP_TIMEOUT_MS)
      .select('FID', 'FACREG', 'DISPFACREG', 'HP', 'HP2');

    const horsepowerByFactoryKey = new Map<string, number>();
    for (const sourceRow of sourceRows) {
      const horsepower = firstNullableNumber(sourceRow.HP2, sourceRow.HP);
      if (horsepower === null) continue;

      for (const key of [sourceRow.FID, sourceRow.DISPFACREG, sourceRow.FACREG]) {
        const normalizedKey = normalizeText(key);
        if (normalizedKey) horsepowerByFactoryKey.set(normalizedKey, horsepower);
      }
    }

    if (horsepowerByFactoryKey.size === 0) return rows;

    return rows.map((row) => {
      if (row.machineryHorsepower !== null) return row;

      const sourceKey = normalizeText(row.sourceFactoryId);
      const registrationKey = normalizeText(row.factoryRegistrationNoNew);
      const machineryHorsepower =
        (sourceKey ? horsepowerByFactoryKey.get(sourceKey) : undefined) ??
        (registrationKey ? horsepowerByFactoryKey.get(registrationKey) : undefined) ??
        null;

      return machineryHorsepower === null ? row : { ...row, machineryHorsepower };
    });
  } catch (error) {
    logger.warn('[eligible-factories] Failed to hydrate machinery horsepower from source DB', {
      error,
    });
    return rows;
  }
}

function toMeasurementPointDTO(
  row: EligibleFactoryMonitoringPointRow,
): EligibleFactoryMeasurementPointDTO {
  return {
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
    // Fall back to the comma-separated format below.
  }

  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
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

function uniqueNonEmpty(values: Array<string | null>): string[] {
  return [
    ...new Set(values.map(normalizeText).filter((value): value is string => Boolean(value))),
  ];
}

function normalizeText(value: string | null | undefined): string | null {
  const text = value?.trim();
  return text ? text : null;
}

function firstNullableNumber(...values: Array<number | string | null | undefined>): number | null {
  for (const value of values) {
    const numberValue = toNullableNumber(value ?? null);
    if (numberValue !== null && Number.isFinite(numberValue)) return numberValue;
  }

  return null;
}

function toNullableNumber(value: number | string | null): number | null {
  if (value === null) return null;
  return Number(value);
}

function toNullableBoolean(value: boolean | number | null): boolean | null {
  if (value === null) return null;
  return Boolean(value);
}

function toIsoString(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}
