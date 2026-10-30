import { isCanonicalFactoryProfilesEnabled } from '../factory-profiles/factory-profile-mode';
import { env } from '../../config/env';
import { factorySourceDb, factorySourceTableName } from '../../config/factory-source-database';
import { logger } from '../../config/logger';
import type { EligibleFactoryDTO } from './eligible-factories.types';
import {
  type AdministrativeAreaNames,
  diwAdministrativeAreaKey,
  formatFacImportAddress,
} from './fac-import.mapper';
import {
  hasNumericFactoryAddressAreas,
  replaceNumericFactoryAddressAreas,
  withoutNumericFactoryAddressAreas,
  withProvinceInFactoryAddress,
} from './factory-address';

interface FactorySourceHydrationRow {
  FID: string | null;
  FACREG: string | null;
  DISPFACREG: string | null;
  FADDR: string | null;
  FMOO: string | null;
  SOI: string | null;
  ROAD: string | null;
  PROV: string | number | null;
  AMP: string | number | null;
  TUMBOL: string | number | null;
  ZIPCODE: string | number | null;
  HP: number | string | null;
  HP2: number | string | null;
  COLONY_INDUST_CODE: string | null;
}

interface IndustrialEstateRow {
  COLONY_INDUST_CODE: string | null;
  COLONY_INDUST_DESC: string | null;
}

interface AdministrativeAreaRow {
  PROV: string | number | null;
  AMP: string | number | null;
  TUMBOL: string | number | null;
  TUMNAME: string | null;
  AMPNAME: string | null;
}

const EXTERNAL_LOOKUP_TIMEOUT_MS = 300000;
const FACTORY_SOURCE_LOOKUP_CHUNK_SIZE = 500;

interface EligibleFactoryAddressStorageInput {
  sourceFactoryId: string | null;
  factoryRegistrationNoNew: string;
  address?: string | null;
  provinceName?: string | null;
}

interface EligibleFactoryIndustrialEstateStorageInput {
  sourceFactoryId: string | null;
  factoryRegistrationNoNew: string;
}

export interface FactoryAddressNamesInput {
  sourceFactoryId: string | null;
  factoryRegistrationNoNew: string;
  address: string | null;
  provinceName?: string | null;
}

/** Read-only enrichment in either profile mode; a strict caller can prepare a data repair. */
export async function resolveLegacyFactoryAddressNames<T extends FactoryAddressNamesInput>(
  rows: T[],
  options: { strict?: boolean } = {},
): Promise<T[]> {
  const pending = rows.filter((row) => hasNumericFactoryAddressAreas(row.address));
  if (pending.length === 0) return rows;
  let sources: FactorySourceHydrationRow[] = [];
  let names = new Map<string, AdministrativeAreaNames>();
  try {
    const keys = uniqueNonEmpty(
      pending.flatMap((row) => [row.sourceFactoryId, row.factoryRegistrationNoNew]),
    );
    if (keys.length > 0) {
      sources = await loadFactorySourceRows(keys);
      names = await loadAdministrativeAreaNames(sources);
    }
  } catch (error) {
    if (options.strict) throw error;
    logger.warn('[factory-address] Failed to resolve legacy area names', { error });
  }
  return rows.map((row) => {
    if (!row.address || !hasNumericFactoryAddressAreas(row.address)) return row;
    const source = findSourceRowForFactory(
      sources,
      row.sourceFactoryId,
      row.factoryRegistrationNoNew,
    );
    const key = source ? diwAdministrativeAreaKey(source.PROV, source.AMP, source.TUMBOL) : null;
    const areaNames = key ? names.get(key) : undefined;
    const resolved =
      source && areaNames
        ? replaceNumericFactoryAddressAreas(row.address, areaNames, source)
        : null;
    if (resolved === null && options.strict) {
      throw new Error(
        'Cannot safely resolve a legacy factory address; verify Fac60k identity and TUMBOL master before retrying',
      );
    }
    return { ...row, address: resolved ?? withoutNumericFactoryAddressAreas(row.address) };
  });
}

export async function hydrateEligibleFactoriesFromSource(
  rows: EligibleFactoryDTO[],
): Promise<EligibleFactoryDTO[]> {
  const sourceFactoryIds = uniqueNonEmpty(rows.map((row) => row.sourceFactoryId));
  const registrationNumbers = uniqueNonEmpty(rows.map((row) => row.factoryRegistrationNoNew));
  if (sourceFactoryIds.length === 0 && registrationNumbers.length === 0) {
    return normalizeStoredFactoryAddresses(rows);
  }

  try {
    const sourceRows = await loadFactorySourceRows([
      ...new Set([...sourceFactoryIds, ...registrationNumbers]),
    ]);
    const administrativeAreaNamesByCode = await loadAdministrativeAreaNames(sourceRows);
    return rows.map((row) => hydrateFactoryRow(row, sourceRows, administrativeAreaNamesByCode));
  } catch (error) {
    logger.warn('[eligible-factories] Failed to hydrate selected factory data from source DB', {
      error,
    });
    return normalizeStoredFactoryAddresses(rows);
  }
}

function normalizeStoredFactoryAddresses(rows: EligibleFactoryDTO[]): EligibleFactoryDTO[] {
  return rows.map((row) => {
    const address =
      row.address && hasNumericFactoryAddressAreas(row.address)
        ? withoutNumericFactoryAddressAreas(row.address)
        : row.address;
    return {
      ...row,
      address: isCanonicalFactoryProfilesEnabled()
        ? address
        : (withProvinceInFactoryAddress(address, row.provinceName) ?? null),
    };
  });
}

export async function resolveEligibleFactoryAddressForStorage(
  input: EligibleFactoryAddressStorageInput,
): Promise<string | null | undefined> {
  const storedAddress = input.address;
  const containsLegacyCodes = hasNumericFactoryAddressAreas(storedAddress);
  if (storedAddress !== null && storedAddress !== undefined && !containsLegacyCodes) {
    return withProvinceInFactoryAddress(storedAddress, input.provinceName);
  }

  const keys = uniqueNonEmpty([input.sourceFactoryId, input.factoryRegistrationNoNew]);
  if (keys.length === 0) return containsLegacyCodes ? undefined : storedAddress;

  try {
    const sourceRows = await loadFactorySourceRows(keys);
    const sourceRow = findSourceRowForFactory(
      sourceRows,
      input.sourceFactoryId,
      input.factoryRegistrationNoNew,
    );
    if (!sourceRow) return containsLegacyCodes ? undefined : storedAddress;

    const administrativeAreaNamesByCode = await loadAdministrativeAreaNames([sourceRow]);
    const administrativeAreaKey = diwAdministrativeAreaKey(
      sourceRow.PROV,
      sourceRow.AMP,
      sourceRow.TUMBOL,
    );
    const names = administrativeAreaKey
      ? administrativeAreaNamesByCode.get(administrativeAreaKey)
      : undefined;
    if (!names?.subdistrictName || !names.districtName) {
      return containsLegacyCodes ? undefined : storedAddress;
    }

    if (containsLegacyCodes && storedAddress) {
      const resolvedAddress = replaceNumericFactoryAddressAreas(storedAddress, names, sourceRow);
      if (resolvedAddress === null) return undefined;
      return withProvinceInFactoryAddress(resolvedAddress, input.provinceName);
    }

    return withProvinceInFactoryAddress(
      formatFacImportAddress(sourceRow, names) ?? storedAddress,
      input.provinceName,
    );
  } catch (error) {
    logger.warn('[eligible-factories] Failed to resolve address for storage', { error });
    return containsLegacyCodes ? undefined : storedAddress;
  }
}

export async function resolveEligibleFactoryIndustrialEstateForStorage(
  input: EligibleFactoryIndustrialEstateStorageInput,
): Promise<string | undefined> {
  const keys = uniqueNonEmpty([input.sourceFactoryId, input.factoryRegistrationNoNew]);
  if (keys.length === 0) return undefined;

  try {
    const sourceRows = await loadFactorySourceRows(keys);
    const sourceRow = findSourceRowForFactory(
      sourceRows,
      input.sourceFactoryId,
      input.factoryRegistrationNoNew,
    );
    const industrialEstateCode = normalizeText(sourceRow?.COLONY_INDUST_CODE);
    if (!industrialEstateCode) return undefined;

    const estateRows = await factorySourceDb<IndustrialEstateRow>(
      `${env.FACTORY_DB_SCHEMA}.FAC_COLONY_INDUST`,
    )
      .where('COLONY_INDUST_CODE', industrialEstateCode)
      .timeout(EXTERNAL_LOOKUP_TIMEOUT_MS)
      .select('COLONY_INDUST_CODE', 'COLONY_INDUST_DESC');

    return normalizeText(estateRows[0]?.COLONY_INDUST_DESC) ?? industrialEstateCode;
  } catch (error) {
    logger.warn('[eligible-factories] Failed to resolve industrial estate for storage', { error });
    return undefined;
  }
}

async function loadFactorySourceRows(keys: string[]): Promise<FactorySourceHydrationRow[]> {
  const rows: FactorySourceHydrationRow[] = [];
  for (const keyChunk of chunks(keys, FACTORY_SOURCE_LOOKUP_CHUNK_SIZE)) {
    const chunkRows = await factorySourceDb<FactorySourceHydrationRow>(factorySourceTableName())
      .where((builder) => {
        builder
          .whereIn('FID', keyChunk)
          .orWhereIn('DISPFACREG', keyChunk)
          .orWhereIn('FACREG', keyChunk);
      })
      .timeout(EXTERNAL_LOOKUP_TIMEOUT_MS)
      .select(
        'FID',
        'FACREG',
        'DISPFACREG',
        'FADDR',
        'FMOO',
        'SOI',
        'ROAD',
        'PROV',
        'AMP',
        'TUMBOL',
        'ZIPCODE',
        'HP',
        'HP2',
        'COLONY_INDUST_CODE',
      );
    rows.push(...chunkRows);
  }
  return rows;
}

async function loadAdministrativeAreaNames(
  rows: FactorySourceHydrationRow[],
): Promise<Map<string, AdministrativeAreaNames>> {
  const provinceCodes = uniqueNonEmpty(rows.map((row) => normalizedCode(row.PROV)));
  if (provinceCodes.length === 0) return new Map();

  try {
    const lookupRows = await factorySourceDb<AdministrativeAreaRow>(
      `${env.FACTORY_DB_SCHEMA}.TUMBOL`,
    )
      .whereIn('PROV', provinceCodes)
      .timeout(EXTERNAL_LOOKUP_TIMEOUT_MS)
      .select('PROV', 'AMP', 'TUMBOL', 'TUMNAME', 'AMPNAME');

    const result = new Map<string, AdministrativeAreaNames>();
    for (const row of lookupRows) {
      const key = diwAdministrativeAreaKey(row.PROV, row.AMP, row.TUMBOL);
      const subdistrictName = normalizeText(row.TUMNAME);
      const districtName = normalizeText(row.AMPNAME);
      if (!key || (!subdistrictName && !districtName)) continue;
      result.set(key, { subdistrictName, districtName });
    }
    return result;
  } catch (error) {
    logger.warn('[eligible-factories] Failed to load selected factory area names', { error });
    return new Map();
  }
}

function findSourceRowForFactory(
  rows: FactorySourceHydrationRow[],
  sourceFactoryId: string | null,
  registrationNo: string,
): FactorySourceHydrationRow | undefined {
  const normalizedSourceFactoryId = normalizeText(sourceFactoryId);
  const normalizedRegistrationNo = normalizeText(registrationNo);

  return (
    (normalizedSourceFactoryId
      ? rows.find((row) => normalizeText(row.FID) === normalizedSourceFactoryId)
      : undefined) ??
    (normalizedRegistrationNo
      ? rows.find((row) => normalizeText(row.DISPFACREG) === normalizedRegistrationNo)
      : undefined) ??
    (normalizedRegistrationNo
      ? rows.find((row) => normalizeText(row.FACREG) === normalizedRegistrationNo)
      : undefined) ??
    (normalizedRegistrationNo
      ? rows.find((row) => normalizeText(row.FID) === normalizedRegistrationNo)
      : undefined)
  );
}

function hydrateFactoryRow(
  row: EligibleFactoryDTO,
  sourceRows: FactorySourceHydrationRow[],
  administrativeAreaNamesByCode: Map<string, AdministrativeAreaNames>,
): EligibleFactoryDTO {
  const sourceRow = findSourceRowForFactory(
    sourceRows,
    row.sourceFactoryId,
    row.factoryRegistrationNoNew,
  );
  if (!sourceRow) return normalizeStoredFactoryAddresses([row])[0];
  const numericAddress = hasNumericFactoryAddressAreas(row.address);
  if (isCanonicalFactoryProfilesEnabled() && !numericAddress) {
    return {
      ...row,
      machineryHorsepower:
        row.machineryHorsepower ?? firstNullableNumber(sourceRow.HP2, sourceRow.HP),
    };
  }

  const administrativeAreaKey = diwAdministrativeAreaKey(
    sourceRow.PROV,
    sourceRow.AMP,
    sourceRow.TUMBOL,
  );
  if (numericAddress && row.address) {
    const names = administrativeAreaKey
      ? administrativeAreaNamesByCode.get(administrativeAreaKey)
      : undefined;
    const address =
      (names ? replaceNumericFactoryAddressAreas(row.address, names, sourceRow) : null) ??
      withoutNumericFactoryAddressAreas(row.address);
    return {
      ...row,
      machineryHorsepower:
        row.machineryHorsepower ?? firstNullableNumber(sourceRow.HP2, sourceRow.HP),
      address: isCanonicalFactoryProfilesEnabled()
        ? address
        : (withProvinceInFactoryAddress(address, row.provinceName) ?? null),
    };
  }
  const resolvedAddress =
    withProvinceInFactoryAddress(
      formatFacImportAddress(
        sourceRow,
        administrativeAreaKey
          ? administrativeAreaNamesByCode.get(administrativeAreaKey)
          : undefined,
      ),
      row.provinceName,
    ) ?? null;

  return {
    ...row,
    machineryHorsepower:
      row.machineryHorsepower ?? firstNullableNumber(sourceRow.HP2, sourceRow.HP),
    address:
      withProvinceInFactoryAddress(
        shouldHydrateAddress(row.address) && resolvedAddress !== null
          ? resolvedAddress
          : row.address,
        row.provinceName,
      ) ?? null,
  };
}

function shouldHydrateAddress(address: string | null): boolean {
  return address === null || hasNumericFactoryAddressAreas(address);
}

function uniqueNonEmpty(values: Array<string | null>): string[] {
  return [...new Set(values.map(normalizeText).filter((value): value is string => Boolean(value)))];
}

function normalizeText(value: string | null | undefined): string | null {
  const text = value?.trim();
  return text ? text : null;
}

function normalizedCode(value: string | number | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const numeric = Number(value);
  if (Number.isFinite(numeric)) return String(Math.trunc(numeric));
  return normalizeText(String(value));
}

function chunks<T>(values: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size));
  }
  return result;
}

function firstNullableNumber(...values: Array<number | string | null | undefined>): number | null {
  for (const value of values) {
    if (value === null || value === undefined) continue;
    const numberValue = Number(value);
    if (Number.isFinite(numberValue)) return numberValue;
  }
  return null;
}
