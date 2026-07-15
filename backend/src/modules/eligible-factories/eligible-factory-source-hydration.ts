import { env } from '../../config/env';
import { factorySourceDb, factorySourceTableName } from '../../config/factory-source-database';
import { logger } from '../../config/logger';
import type { EligibleFactoryDTO } from './eligible-factories.types';
import {
  type AdministrativeAreaNames,
  diwAdministrativeAreaKey,
  formatFacImportAddress,
} from './fac-import.mapper';

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
const LEGACY_AREA_CODE_PATTERN = /(?:ตำบล|อำเภอ)\s*\d+(?:\s|$)/u;

interface EligibleFactoryAddressStorageInput {
  sourceFactoryId: string | null;
  factoryRegistrationNoNew: string;
  address?: string | null;
}

export async function hydrateEligibleFactoriesFromSource(
  rows: EligibleFactoryDTO[],
): Promise<EligibleFactoryDTO[]> {
  const sourceFactoryIds = uniqueNonEmpty(rows.map((row) => row.sourceFactoryId));
  const registrationNumbers = uniqueNonEmpty(rows.map((row) => row.factoryRegistrationNoNew));
  if (sourceFactoryIds.length === 0 && registrationNumbers.length === 0) return rows;

  try {
    const sourceRows = await loadFactorySourceRows([
      ...new Set([...sourceFactoryIds, ...registrationNumbers]),
    ]);
    const administrativeAreaNamesByCode = await loadAdministrativeAreaNames(sourceRows);
    const sourceRowByFactoryKey = indexSourceRows(sourceRows);

    return rows.map((row) =>
      hydrateFactoryRow(row, sourceRowByFactoryKey, administrativeAreaNamesByCode),
    );
  } catch (error) {
    logger.warn('[eligible-factories] Failed to hydrate selected factory data from source DB', {
      error,
    });
    return rows;
  }
}

export async function resolveEligibleFactoryAddressForStorage(
  input: EligibleFactoryAddressStorageInput,
): Promise<string | null | undefined> {
  const storedAddress = input.address;
  const containsLegacyCodes = Boolean(
    storedAddress && LEGACY_AREA_CODE_PATTERN.test(storedAddress),
  );
  if (storedAddress !== null && storedAddress !== undefined && !containsLegacyCodes) {
    return storedAddress;
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
      return storedAddress
        .replace(/ตำบล\s*\d+(?=\s|$)/u, `ตำบล${names.subdistrictName}`)
        .replace(/อำเภอ\s*\d+(?=\s|$)/u, `อำเภอ${names.districtName}`);
    }

    return formatFacImportAddress(sourceRow, names) ?? storedAddress;
  } catch (error) {
    logger.warn('[eligible-factories] Failed to resolve address for storage', { error });
    return containsLegacyCodes ? undefined : storedAddress;
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

function indexSourceRows(
  rows: FactorySourceHydrationRow[],
): Map<string, FactorySourceHydrationRow> {
  const sourceRowByFactoryKey = new Map<string, FactorySourceHydrationRow>();
  for (const row of rows) {
    for (const key of [row.FID, row.DISPFACREG, row.FACREG]) {
      const normalizedKey = normalizeText(key);
      if (normalizedKey) sourceRowByFactoryKey.set(normalizedKey, row);
    }
  }
  return sourceRowByFactoryKey;
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
  sourceRowByFactoryKey: Map<string, FactorySourceHydrationRow>,
  administrativeAreaNamesByCode: Map<string, AdministrativeAreaNames>,
): EligibleFactoryDTO {
  const sourceKey = normalizeText(row.sourceFactoryId);
  const registrationKey = normalizeText(row.factoryRegistrationNoNew);
  const sourceRow =
    (sourceKey ? sourceRowByFactoryKey.get(sourceKey) : undefined) ??
    (registrationKey ? sourceRowByFactoryKey.get(registrationKey) : undefined);
  if (!sourceRow) return row;

  const administrativeAreaKey = diwAdministrativeAreaKey(
    sourceRow.PROV,
    sourceRow.AMP,
    sourceRow.TUMBOL,
  );
  const resolvedAddress = formatFacImportAddress(
    sourceRow,
    administrativeAreaKey ? administrativeAreaNamesByCode.get(administrativeAreaKey) : undefined,
  );

  return {
    ...row,
    machineryHorsepower:
      row.machineryHorsepower ?? firstNullableNumber(sourceRow.HP2, sourceRow.HP),
    address:
      shouldHydrateAddress(row.address) && resolvedAddress !== null ? resolvedAddress : row.address,
  };
}

function shouldHydrateAddress(address: string | null): boolean {
  return address === null || LEGACY_AREA_CODE_PATTERN.test(address);
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
