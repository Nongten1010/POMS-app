import type { Knex } from 'knex';
import { db } from '../../config/database';
import { applyAssignedFactoryAccessFilter } from '../../shared/utils/factory-access-query';
import { applyFactoryType88Filter, isFactoryType88 } from '../../shared/utils/factory-type-scope';
import type { PermissionScopeDetails } from '../auth/permissions';
import type { RegionalAccessDTO } from '../auth/regional-access';
import { resolveAssignedRegions } from '../auth/regional-access';
import { diwProvinceCodeFromName } from './fac-import.mapper';
import type { CreateEligibleFactoryInput } from './eligible-factories.types';

export type EligibleFactoryAccessScope = string | null | undefined | PermissionScopeDetails;

export interface EligibleFactoryAccessContext {
  actorUserId: number;
  scope: EligibleFactoryAccessScope;
  regionalAccess?: RegionalAccessDTO | null;
}

type ExtendedScopeDetails = PermissionScopeDetails & {
  estateId?: number | string | null;
  estateCode?: string | null;
  estateName?: string | null;
  estate?: string | null;
};

interface SelectedFactoryAccessFilters {
  denyAll: boolean;
  regionNames: string[];
  provinceNames: string[];
  estateCodes: string[];
  estateNames: string[];
  requireAssignedFactory: boolean;
  requireFactoryType88: boolean;
}

interface CandidateAccessFilters {
  denyAll: boolean;
  provinceCodes: string[];
  estateCodes: string[];
  assignedFactoryIdentifiers: string[];
  requireFactoryType88: boolean;
}

interface IndustrialEstateRow {
  id: number | string;
  code: string | null;
  name_th: string | null;
}

interface ProvinceRow {
  id: number | string;
  name_th: string;
  region: string | null;
}

export async function resolveSelectedFactoryAccessFilters(
  access: EligibleFactoryAccessContext | undefined,
): Promise<SelectedFactoryAccessFilters> {
  if (!access) {
    return {
      denyAll: false,
      regionNames: [],
      provinceNames: [],
      estateCodes: [],
      estateNames: [],
      requireAssignedFactory: false,
      requireFactoryType88: false,
    };
  }

  const scope = toScopeDetails(access.scope);
  const filters: SelectedFactoryAccessFilters = {
    denyAll: false,
    regionNames: [],
    provinceNames: [],
    estateCodes: [],
    estateNames: [],
    requireAssignedFactory: false,
    requireFactoryType88: false,
  };

  switch (scope.scope) {
    case 'ALL':
      return filters;
    case 'IN_REGION': {
      const regions = resolveAssignedRegions(scope.region, access.regionalAccess);
      if (regions.length === 0) return { ...filters, denyAll: true };
      return { ...filters, regionNames: regions };
    }
    case 'IN_PROVINCE': {
      const province = normalizeText(scope.province);
      if (!province) return { ...filters, denyAll: true };
      return { ...filters, provinceNames: [province] };
    }
    case 'IN_ESTATE': {
      const assignment = await resolveEstateAssignment(scope);
      if (assignment.codes.length === 0 && assignment.names.length === 0) {
        return { ...filters, denyAll: true };
      }
      return {
        ...filters,
        estateCodes: assignment.codes,
        estateNames: assignment.names,
      };
    }
    case 'OWN_FACTORY':
      return { ...filters, requireAssignedFactory: true };
    case 'FACTORY_TYPE_88':
      return { ...filters, requireFactoryType88: true };
    default:
      return { ...filters, denyAll: true };
  }
}

export async function resolveCandidateAccessFilters(
  access: EligibleFactoryAccessContext | undefined,
): Promise<CandidateAccessFilters> {
  if (!access) {
    return {
      denyAll: false,
      provinceCodes: [],
      estateCodes: [],
      assignedFactoryIdentifiers: [],
      requireFactoryType88: false,
    };
  }

  const scope = toScopeDetails(access.scope);
  let provinceCodes: string[] = [];

  switch (scope.scope) {
    case 'ALL':
      break;
    case 'IN_REGION': {
      const regions = resolveAssignedRegions(scope.region, access.regionalAccess);
      if (regions.length === 0) return denyAllCandidateAccess();
      provinceCodes = await provinceCodesForRegions(regions);
      break;
    }
    case 'IN_PROVINCE': {
      const province = normalizeText(scope.province);
      const provinceCodesForScope = province ? provinceCodesForProvince(province) : [];
      if (provinceCodesForScope.length === 0) return denyAllCandidateAccess();
      provinceCodes = intersectOrFallback(provinceCodes, provinceCodesForScope);
      break;
    }
    case 'IN_ESTATE': {
      const assignment = await resolveEstateAssignment(scope);
      if (assignment.codes.length === 0) return denyAllCandidateAccess();
      return {
        denyAll: false,
        provinceCodes,
        estateCodes: assignment.codes,
        assignedFactoryIdentifiers: [],
        requireFactoryType88: false,
      };
    }
    case 'OWN_FACTORY': {
      const ownFactoryIdentifiers = await loadAssignedFactoryIdentifiers(access.actorUserId);
      if (ownFactoryIdentifiers.length === 0) return denyAllCandidateAccess();
      return {
        denyAll: false,
        provinceCodes,
        estateCodes: [],
        assignedFactoryIdentifiers: ownFactoryIdentifiers,
        requireFactoryType88: false,
      };
    }
    case 'FACTORY_TYPE_88':
      return {
        denyAll: false,
        provinceCodes,
        estateCodes: [],
        assignedFactoryIdentifiers: [],
        requireFactoryType88: true,
      };
    default:
      return denyAllCandidateAccess();
  }

  return {
    denyAll: false,
    provinceCodes,
    estateCodes: [],
    assignedFactoryIdentifiers: [],
    requireFactoryType88: false,
  };
}

export function applySelectedFactoryAccessFilters(
  builder: Knex.QueryBuilder,
  filters: SelectedFactoryAccessFilters,
  actorUserId: number | undefined,
  identifierColumns: {
    registrationNo: 'ef.factory_registration_no_new' | 'ef.factory_registration_no';
    sourceFactoryId: 'ef.source_factory_id';
    factoryMasterId?: 'ef.factory_master_id';
    provinceName: 'ef.province_name' | 'p.name_th';
    industrialEstateName: 'ef.industrial_estate_name' | 'ie.name_th';
    factoryTypeSequence: 'ef.factory_type_sequence';
  } = {
    registrationNo: 'ef.factory_registration_no_new',
    sourceFactoryId: 'ef.source_factory_id',
    provinceName: 'ef.province_name',
    industrialEstateName: 'ef.industrial_estate_name',
    factoryTypeSequence: 'ef.factory_type_sequence',
  },
): void {
  if (filters.denyAll) {
    builder.whereRaw('1 = 0');
    return;
  }

  if (filters.requireAssignedFactory) {
    if (!actorUserId) {
      builder.whereRaw('1 = 0');
      return;
    }
    builder.whereExists(function assignedEligibleFactoryAccess() {
      this.select(db.raw('1'))
        .from('factories as f')
        .whereNull('f.deleted_at')
        .where(function eligibleFactoryIdentifierMatch() {
          if (identifierColumns.factoryMasterId) {
            this.whereRaw(`f.id = ${identifierColumns.factoryMasterId}`);
            return;
          }
          this.whereRaw(`f.code = ${identifierColumns.registrationNo}`)
            .orWhereRaw(`f.fid = ${identifierColumns.registrationNo}`)
            .orWhereRaw(`f.fid = ${identifierColumns.sourceFactoryId}`)
            .orWhereRaw(`f.code = ${identifierColumns.sourceFactoryId}`);
        });
      applyAssignedFactoryAccessFilter(this, actorUserId, 'f');
    });
  }

  if (filters.requireFactoryType88) {
    applyFactoryType88Filter(builder, identifierColumns.factoryTypeSequence);
  }

  if (filters.regionNames.length > 0) {
    builder.whereIn('p.region', filters.regionNames);
  }
  if (filters.provinceNames.length > 0) {
    if (filters.provinceNames.length === 1) {
      builder.where(identifierColumns.provinceName, filters.provinceNames[0]);
    } else {
      builder.whereIn(identifierColumns.provinceName, filters.provinceNames);
    }
  }
  if (filters.estateCodes.length > 0) {
    if (filters.estateCodes.length === 1) {
      builder.where('ie.code', filters.estateCodes[0]);
    } else {
      builder.whereIn('ie.code', filters.estateCodes);
    }
    return;
  }
  if (filters.estateNames.length > 0) {
    if (filters.estateNames.length === 1) {
      builder.where(identifierColumns.industrialEstateName, filters.estateNames[0]);
    } else {
      builder.whereIn(identifierColumns.industrialEstateName, filters.estateNames);
    }
  }
}

export function applyCandidateAccessFilters(
  query: Knex.QueryBuilder,
  filters: CandidateAccessFilters,
): void {
  if (filters.denyAll) {
    query.whereRaw('1 = 0');
    return;
  }

  if (filters.provinceCodes.length > 0) {
    query.whereIn('PROV', filters.provinceCodes);
  }
  if (filters.estateCodes.length > 0) {
    query.whereIn('COLONY_INDUST_CODE', filters.estateCodes);
  }
  if (filters.assignedFactoryIdentifiers.length > 0) {
    query.where(function assignedFactoryScope() {
      this.whereIn('FID', filters.assignedFactoryIdentifiers)
        .orWhereIn('FACREG', filters.assignedFactoryIdentifiers)
        .orWhereIn('DISPFACREG', filters.assignedFactoryIdentifiers);
    });
  }
  if (filters.requireFactoryType88) {
    applyFactoryType88Filter(query, 'CLASS');
  }
}

export async function canAccessEligibleFactoryInput(
  input: CreateEligibleFactoryInput,
  access: EligibleFactoryAccessContext | undefined,
): Promise<boolean> {
  if (!access) return true;

  const filters = await resolveSelectedFactoryAccessFilters(access);
  if (filters.denyAll) return false;

  const provinceName = normalizeText(input.provinceName);
  if (!provinceName) return false;
  if (filters.provinceNames.length > 0 && !filters.provinceNames.includes(provinceName))
    return false;

  if (filters.regionNames.length > 0) {
    const province = await provinceByName(provinceName);
    if (!province?.region || !filters.regionNames.includes(province.region)) return false;
  }

  if (filters.estateCodes.length > 0) {
    const estateName = normalizeText(input.industrialEstateName);
    if (!estateName) return false;
    const estate = await estateByName(estateName);
    if (!estate?.code || !filters.estateCodes.includes(estate.code)) return false;
  } else if (filters.estateNames.length > 0) {
    const estateName = normalizeText(input.industrialEstateName);
    if (!estateName || !filters.estateNames.includes(estateName)) return false;
  }

  if (filters.requireAssignedFactory) {
    const identifiers = uniqueValues([
      input.sourceFactoryId ?? undefined,
      input.factoryRegistrationNoNew,
      input.factoryRegistrationNoOld ?? undefined,
    ]);
    if (identifiers.length === 0) return false;
    const allowedIdentifiers = new Set(await loadAssignedFactoryIdentifiers(access.actorUserId));
    return identifiers.some((identifier) => allowedIdentifiers.has(identifier));
  }

  if (filters.requireFactoryType88) {
    return isFactoryType88(input.factoryTypeSequence);
  }

  return true;
}

function toScopeDetails(scope: EligibleFactoryAccessScope): ExtendedScopeDetails {
  if (scope && typeof scope === 'object') return scope as ExtendedScopeDetails;
  return { scope: scope as ExtendedScopeDetails['scope'] };
}

async function resolveEstateAssignment(scope: ExtendedScopeDetails): Promise<{
  codes: string[];
  names: string[];
}> {
  const estateId = scope.estateId;
  const estateCode = normalizeText(scope.estateCode);
  const estateName = normalizeText(scope.estateName);
  const legacyEstate = normalizeText(scope.estate);
  const hasAssignment =
    (estateId !== null && estateId !== undefined && `${estateId}`.trim()) ||
    estateCode ||
    estateName ||
    legacyEstate;
  if (!hasAssignment) {
    return {
      codes: [],
      names: [],
    };
  }

  const rows: IndustrialEstateRow[] = await db<IndustrialEstateRow>('industrial_estates')
    .modify((builder) => {
      builder.where(function estateAssignment() {
        let hasClause = false;
        if (estateId !== null && estateId !== undefined && `${estateId}`.trim()) {
          hasClause = true;
          builder.where('id', estateId as number | string);
        }
        if (estateCode) {
          hasClause = true;
          if (hasClause) builder.orWhere('code', estateCode);
        }
        if (estateName) {
          hasClause = true;
          builder.orWhere('name_th', estateName);
        }
        if (legacyEstate) {
          hasClause = true;
          builder.orWhere('code', legacyEstate).orWhere('name_th', legacyEstate);
        }
        if (!hasClause) builder.whereRaw('1 = 0');
      });
    })
    .select('id', 'code', 'name_th');

  if (rows.length === 0) {
    return {
      codes: [],
      names: uniqueValues([estateName ?? undefined, legacyEstate ?? undefined]),
    };
  }

  return {
    codes: uniqueValues(rows.map((row: IndustrialEstateRow) => row.code)),
    names: uniqueValues(rows.map((row: IndustrialEstateRow) => row.name_th)),
  };
}

async function provinceCodesForRegions(regions: string[]): Promise<string[]> {
  const normalizedRegions = uniqueValues(regions);
  if (normalizedRegions.length === 0) return [];

  const rows = await db<ProvinceRow>('provinces')
    .whereIn('region', normalizedRegions)
    .select('id', 'name_th', 'region');
  return uniqueValues(rows.map((row) => String(row.id)));
}

function provinceCodesForProvince(provinceName: string): string[] {
  const directCode = diwProvinceCodeFromName(provinceName);
  return directCode ? [directCode] : [];
}

async function provinceByName(provinceName: string): Promise<ProvinceRow | null> {
  const row = await db<ProvinceRow>('provinces')
    .where('name_th', provinceName)
    .first('id', 'name_th', 'region');
  return row ?? null;
}

async function estateByName(estateName: string): Promise<IndustrialEstateRow | null> {
  const row = await db<IndustrialEstateRow>('industrial_estates')
    .where('name_th', estateName)
    .first('id', 'code', 'name_th');
  return row ?? null;
}

async function loadAssignedFactoryIdentifiers(actorUserId: number): Promise<string[]> {
  const rows: Array<{ fid: string | null; code: string | null }> = await db('factories as f')
    .whereNull('f.deleted_at')
    .modify((builder) => applyAssignedFactoryAccessFilter(builder, actorUserId, 'f'))
    .select('f.fid', 'f.code');

  return uniqueValues(
    rows.flatMap((row: { fid: string | null; code: string | null }) => [
      row.fid as string | null | undefined,
      row.code as string | null | undefined,
    ]),
  );
}

function intersectOrFallback(current: string[], next: string[]): string[] {
  if (current.length === 0) return uniqueValues(next);
  const allowed = new Set(next);
  return current.filter((value) => allowed.has(value));
}

function denyAllCandidateAccess(): CandidateAccessFilters {
  return {
    denyAll: true,
    provinceCodes: [],
    estateCodes: [],
    assignedFactoryIdentifiers: [],
    requireFactoryType88: false,
  };
}

function normalizeText(value: unknown): string | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const text = String(value).trim();
  return text ? text : null;
}

function uniqueValues(values: Array<string | null | undefined>): string[] {
  return [
    ...new Set(
      values
        .map((value) => normalizeText(value))
        .filter((value): value is string => Boolean(value)),
    ),
  ];
}
