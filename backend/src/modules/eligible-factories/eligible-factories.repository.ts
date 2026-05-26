import type { Knex } from 'knex';
import { db } from '../../config/database';
import type {
  CreateEligibleFactoryInput,
  EligibleFactoryDTO,
  ListEligibleFactoriesQuery,
} from './eligible-factories.types';

interface EligibleFactoryRow {
  id: number | string;
  source_system: string;
  source_factory_id: string | null;
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
    return { rows: rows.map(toDTO), total };
  },

  async findByRegistrationNoNew(
    registrationNoNew: string,
  ): Promise<{ id: number; factoryRegistrationNoNew: string } | null> {
    const row = await db('eligible_factories')
      .where('factory_registration_no_new', registrationNoNew)
      .whereNull('deleted_at')
      .select('id', 'factory_registration_no_new')
      .first();

    if (!row) return null;
    return {
      id: Number(row.id),
      factoryRegistrationNoNew: row.factory_registration_no_new,
    };
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

function toDTO(row: EligibleFactoryRow): EligibleFactoryDTO {
  const latitude = toNullableNumber(row.latitude);
  const longitude = toNullableNumber(row.longitude);

  return {
    id: Number(row.id),
    sourceSystem: row.source_system,
    sourceFactoryId: row.source_factory_id,
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
