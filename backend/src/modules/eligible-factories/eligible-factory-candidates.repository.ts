import type { Knex } from 'knex';
import { logger } from '../../config/logger';
import { env } from '../../config/env';
import { factorySourceDb, factorySourceTableName } from '../../config/factory-source-database';
import {
  type AdministrativeAreaNames,
  diwAdministrativeAreaKey,
  type FacImportRow,
  toEligibleFactoryCandidate,
} from './fac-import.mapper';
import { eligibleFactoriesRepository } from './eligible-factories.repository';
import type {
  EligibleFactoryCandidateDTO,
  EligibleFactoryCandidatesDTO,
  ListEligibleFactoryCandidatesQuery,
} from './eligible-factories.types';

const EXTERNAL_QUERY_TIMEOUT_MS = 300000;
const BULK_LOOKUP_THRESHOLD = 5000;

export const eligibleFactoryCandidatesRepository = {
  async list(query: ListEligibleFactoryCandidatesQuery): Promise<EligibleFactoryCandidatesDTO> {
    return listExternalCandidates(query);
  },
};

async function listExternalCandidates(
  query: ListEligibleFactoryCandidatesQuery,
): Promise<EligibleFactoryCandidatesDTO> {
  const selectedRegistrationNumbers = await selectedFactoryRegistrationNumbers();
  const columns = await availableFacImportColumns();
  const baseQuery = buildFacImportBaseQuery();
  const page = query.page;
  const perPage = query.perPage;
  const isPaginated = page !== undefined && perPage !== undefined;

  const countQuery = baseQuery.clone();
  applyCandidateFilters(countQuery, columns, selectedRegistrationNumbers);
  const total = await countCandidates(countQuery);

  const rowsQuery = baseQuery.clone();
  applyCandidateFilters(rowsQuery, columns, selectedRegistrationNumbers);
  rowsQuery.select(columns);
  const orderByColumn = firstAvailableColumn(columns, ['FACREG', 'FID', 'DISPFACREG']);
  if (orderByColumn) {
    rowsQuery.orderBy(orderByColumn, 'asc');
  }

  const executableRowsQuery = rowsQuery.timeout(EXTERNAL_QUERY_TIMEOUT_MS);
  const rows = isPaginated
    ? await executableRowsQuery.offset((page - 1) * perPage).limit(perPage)
    : await executableRowsQuery;
  const [
    industrialEstateNamesByCode,
    administrativeAreaNamesByCode,
    factoryClassCodesByFid,
    productionCapacitiesByFid,
  ] =
    rows.length > BULK_LOOKUP_THRESHOLD
      ? [
          await loadIndustrialEstateNamesByCode(rows),
          await loadAdministrativeAreaNamesByCode(rows),
          await loadFactoryClassCodesByFid(rows),
          await loadProductionCapacitiesByFid(rows),
        ]
      : await Promise.all([
          loadIndustrialEstateNamesByCode(rows),
          loadAdministrativeAreaNamesByCode(rows),
          loadFactoryClassCodesByFid(rows),
          loadProductionCapacitiesByFid(rows),
        ]);
  const data = excludeSelectedCandidates(
    rows.map((row) =>
      toEligibleFactoryCandidate(row, {
        industrialEstateNamesByCode,
        administrativeAreaNamesByCode,
        eiaLookupSkipped: true,
        productionCapacitiesByFid,
        factoryClassCodesByFid,
      }),
    ),
    selectedRegistrationNumbers,
  );
  return {
    data,
    meta: {
      total,
      source: 'external',
      ...(isPaginated
        ? {
            page,
            perPage,
            totalPages: Math.ceil(total / perPage),
          }
        : {}),
    },
  };
}

async function loadAdministrativeAreaNamesByCode(
  rows: FacImportRow[],
): Promise<Map<string, AdministrativeAreaNames>> {
  const provinceCodes = [
    ...new Set(
      rows.map((row) => normalizedCode(row.PROV)).filter((code): code is string => code !== null),
    ),
  ];
  if (provinceCodes.length === 0) return new Map();

  try {
    const lookupRows = await factorySourceDb<AdministrativeAreaRow>(
      `${env.FACTORY_DB_SCHEMA}.TUMBOL`,
    )
      .whereIn('PROV', provinceCodes)
      .timeout(EXTERNAL_QUERY_TIMEOUT_MS)
      .select('PROV', 'AMP', 'TUMBOL', 'TUMNAME', 'AMPNAME');

    const result = new Map<string, AdministrativeAreaNames>();
    for (const row of lookupRows) {
      const key = diwAdministrativeAreaKey(row.PROV, row.AMP, row.TUMBOL);
      const subdistrictName = trimmedText(row.TUMNAME);
      const districtName = trimmedText(row.AMPNAME);
      if (!key || (!subdistrictName && !districtName)) continue;
      result.set(key, { subdistrictName, districtName });
    }
    return result;
  } catch (error) {
    logger.warn('[eligible-factories] Failed to load administrative area names', { error });
    return new Map();
  }
}

function applyCandidateFilters(
  query: Knex.QueryBuilder<FacImportRow, unknown>,
  columns: Array<keyof FacImportRow>,
  selectedRegistrationNumbers: Set<string>,
): void {
  if (columns.includes('FFLAG')) {
    query.whereIn('FFLAG', ['1', '3']);
  }
  if (columns.includes('DISPFACREG') && selectedRegistrationNumbers.size > 0) {
    query.whereNotIn('DISPFACREG', [...selectedRegistrationNumbers]);
  }
}

async function countCandidates(query: Knex.QueryBuilder<FacImportRow, unknown>): Promise<number> {
  const rows = await query
    .timeout(EXTERNAL_QUERY_TIMEOUT_MS)
    .count<{ total: string | number | null }[]>({ total: '*' });
  const rawTotal = rows[0]?.total;
  const total = Number(rawTotal ?? 0);
  return Number.isFinite(total) ? total : 0;
}

async function loadIndustrialEstateNamesByCode(rows: FacImportRow[]): Promise<Map<string, string>> {
  const codes = [
    ...new Set(
      rows
        .map((row) => row.COLONY_INDUST_CODE?.trim())
        .filter((code): code is string => Boolean(code)),
    ),
  ];
  if (codes.length === 0) return new Map();

  try {
    const lookupRows = await factorySourceDb<{
      COLONY_INDUST_CODE: string | null;
      COLONY_INDUST_DESC: string | null;
    }>(`${env.FACTORY_DB_SCHEMA}.FAC_COLONY_INDUST`)
      .whereIn('COLONY_INDUST_CODE', codes)
      .timeout(EXTERNAL_QUERY_TIMEOUT_MS)
      .select('COLONY_INDUST_CODE', 'COLONY_INDUST_DESC');

    return new Map(
      lookupRows
        .filter((row) => row.COLONY_INDUST_CODE && row.COLONY_INDUST_DESC)
        .map((row) => [row.COLONY_INDUST_CODE as string, row.COLONY_INDUST_DESC as string]),
    );
  } catch (error) {
    logger.warn('[eligible-factories] Failed to load industrial estate names', { error });
    return new Map();
  }
}

async function loadProductionCapacitiesByFid(rows: FacImportRow[]): Promise<Map<string, string>> {
  const fids = uniqueFids(rows);
  if (fids.length === 0) return new Map();

  let productionRows: ProductionCapacityRow[] = [];
  try {
    if (fids.length > BULK_LOOKUP_THRESHOLD) {
      productionRows = await loadActiveFactoryProductionCapacities();
    } else {
      for (const fidChunk of chunks(fids, 1000)) {
        const chunkRows = await factorySourceDb<ProductionCapacityRow>(
          `${env.FACTORY_DB_SCHEMA}.FAC_PROD as fp`,
        )
          .leftJoin(`${env.FACTORY_DB_SCHEMA}.UNIT as u`, 'fp.UNIT', 'u.UNIT')
          .whereIn('fp.FID', fidChunk)
          .timeout(EXTERNAL_QUERY_TIMEOUT_MS)
          .select('fp.FID', 'fp.PRODNAME', 'fp.PRODQUAN', 'u.UNT_ENAME');
        productionRows.push(...chunkRows);
      }
    }
  } catch (error) {
    logger.warn('[eligible-factories] Failed to load production capacities', { error });
    return new Map();
  }

  const requestedFids = new Set(fids);
  const valuesByFid = new Map<string, string[]>();
  for (const row of productionRows) {
    const fid = row.FID?.trim();
    const value = formatProductionCapacity(row);
    if (!fid || !requestedFids.has(fid) || !value) continue;
    valuesByFid.set(fid, [...(valuesByFid.get(fid) ?? []), value]);
  }

  return new Map(
    [...valuesByFid.entries()].map(([fid, values]) => [fid, [...new Set(values)].join(', ')]),
  );
}

async function loadFactoryClassCodesByFid(rows: FacImportRow[]): Promise<Map<string, string[]>> {
  const fids = uniqueFids(rows);
  if (fids.length === 0) return new Map();

  let classRows: FactoryClassRow[] = [];
  try {
    if (fids.length > BULK_LOOKUP_THRESHOLD) {
      classRows = await loadActiveFactoryClassCodes();
    } else {
      for (const fidChunk of chunks(fids, 1000)) {
        const chunkRows = await factorySourceDb<FactoryClassRow>(`${env.FACTORY_DB_SCHEMA}.FACCLASS`)
          .whereIn('FID', fidChunk)
          .timeout(EXTERNAL_QUERY_TIMEOUT_MS)
          .select('FID', 'CLASS');
        classRows.push(...chunkRows);
      }
    }
  } catch (error) {
    logger.warn('[eligible-factories] Failed to load FACCLASS factory classes', { error });
    return new Map();
  }

  const requestedFids = new Set(fids);
  const codesByFid = new Map<string, string[]>();
  for (const row of classRows) {
    const fid = row.FID?.trim();
    const classCode = row.CLASS?.trim();
    if (!fid || !requestedFids.has(fid) || !classCode) continue;
    codesByFid.set(fid, [...(codesByFid.get(fid) ?? []), classCode]);
  }

  return new Map([...codesByFid.entries()].map(([fid, codes]) => [fid, [...new Set(codes)]]));
}

async function loadActiveFactoryClassCodes(): Promise<FactoryClassRow[]> {
  return factorySourceDb<FactoryClassRow>(`${env.FACTORY_DB_SCHEMA}.FACCLASS as fc`)
    .whereIn(
      'fc.FID',
      factorySourceDb(factorySourceTableName()).whereIn('FFLAG', ['1', '3']).select('FID'),
    )
    .timeout(EXTERNAL_QUERY_TIMEOUT_MS)
    .select('fc.FID', 'fc.CLASS');
}

async function loadActiveFactoryProductionCapacities(): Promise<ProductionCapacityRow[]> {
  return factorySourceDb<ProductionCapacityRow>(`${env.FACTORY_DB_SCHEMA}.FAC_PROD as fp`)
    .leftJoin(`${env.FACTORY_DB_SCHEMA}.UNIT as u`, 'fp.UNIT', 'u.UNIT')
    .whereIn(
      'fp.FID',
      factorySourceDb(factorySourceTableName()).whereIn('FFLAG', ['1', '3']).select('FID'),
    )
    .timeout(EXTERNAL_QUERY_TIMEOUT_MS)
    .select('fp.FID', 'fp.PRODNAME', 'fp.PRODQUAN', 'u.UNT_ENAME');
}

async function selectedFactoryRegistrationNumbers(): Promise<Set<string>> {
  try {
    return new Set(await eligibleFactoriesRepository.listActiveRegistrationNumbers());
  } catch (error) {
    logger.warn('[eligible-factories] Failed to load selected factories for candidate exclusion', {
      error,
    });
    return new Set();
  }
}

function uniqueFids(rows: FacImportRow[]): string[] {
  return [
    ...new Set(rows.map((row) => row.FID?.trim()).filter((fid): fid is string => Boolean(fid))),
  ];
}

interface ProductionCapacityRow {
  FID: string | null;
  PRODNAME: string | null;
  PRODQUAN: string | number | null;
  UNT_ENAME: string | null;
}

interface FactoryClassRow {
  FID: string | null;
  CLASS: string | null;
}

interface AdministrativeAreaRow {
  PROV: string | number | null;
  AMP: string | number | null;
  TUMBOL: string | number | null;
  TUMNAME: string | null;
  AMPNAME: string | null;
}

function normalizedCode(value: string | number | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const numeric = Number(value);
  if (Number.isFinite(numeric)) return String(Math.trunc(numeric));
  const text = String(value).trim();
  return text.length > 0 ? text : null;
}

function trimmedText(value: string | null | undefined): string | null {
  const text = value?.trim();
  return text ? text : null;
}

function formatProductionCapacity(row: ProductionCapacityRow): string | null {
  const parts = [row.PRODNAME, row.PRODQUAN, row.UNT_ENAME]
    .map((value) => (value === null || value === undefined ? null : String(value).trim()))
    .filter((value): value is string => Boolean(value));
  return parts.length > 0 ? parts.join(' ') : null;
}

function chunks<T>(values: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size));
  }
  return result;
}

function excludeSelectedCandidates(
  candidates: EligibleFactoryCandidateDTO[],
  selectedRegistrationNumbers: Set<string>,
): EligibleFactoryCandidateDTO[] {
  if (selectedRegistrationNumbers.size === 0) return candidates;

  return candidates.filter(
    (candidate) => !selectedRegistrationNumbers.has(candidate.factoryRegistrationNo),
  );
}

function buildFacImportBaseQuery(): Knex.QueryBuilder<FacImportRow, FacImportRow[]> {
  return factorySourceDb<FacImportRow>(factorySourceTableName());
}

async function availableFacImportColumns(): Promise<Array<keyof FacImportRow>> {
  const requestedColumns = facImportColumns();
  const rows = await factorySourceDb<{ COLUMN_NAME: string }>('INFORMATION_SCHEMA.COLUMNS')
    .where('TABLE_SCHEMA', env.FACTORY_DB_SCHEMA)
    .where('TABLE_NAME', env.FACTORY_DB_TABLE)
    .whereIn('COLUMN_NAME', requestedColumns)
    .select('COLUMN_NAME');

  const availableColumns = new Set(rows.map((row) => row.COLUMN_NAME));
  return requestedColumns.filter((column) => availableColumns.has(column));
}

function firstAvailableColumn(
  columns: Array<keyof FacImportRow>,
  candidates: Array<keyof FacImportRow>,
): keyof FacImportRow | null {
  return candidates.find((candidate) => columns.includes(candidate)) ?? null;
}

function facImportColumns(): Array<keyof FacImportRow> {
  return [
    'FACREG',
    'FACREQ',
    'FNAME',
    'FID',
    'DISPFACREG',
    'FADDR',
    'FMOO',
    'SOI',
    'ROAD',
    'TUMBOL',
    'AMP',
    'PROV',
    'ZIPCODE',
    'COLONY_INDUST_CODE',
    'LONGITUDE_X',
    'LATITUDE_Y',
    'OBJECT',
    'FFLAG',
    'CANAL',
    'RIVER',
    'HP',
    'HP2',
    'OLDREG',
    'SUBCLASS',
    'CAPLAND',
    'CAPBUILD',
    'CAPMACH',
    'CAPWORK',
    'STARTDATE',
    'CAPREGIS',
    'TOTAL_CAP',
    'CAPPROD',
    'FACTYPE',
    'CLASS',
    'EXPSEQ',
    'BOILER_SIZE_EACH',
    'BOILER_SIZE',
    'BOILER_SIZES',
  ];
}
