import type { Knex } from 'knex';
import { logger } from '../../config/logger';
import { env } from '../../config/env';
import { factorySourceDb, factorySourceTableName } from '../../config/factory-source-database';
import { type FacImportRow, toEligibleFactoryCandidate } from './fac-import.mapper';
import { eligibleFactoriesRepository } from './eligible-factories.repository';
import type {
  EligibleFactoryCandidateDTO,
  EligibleFactoryCandidatesDTO,
  ListEligibleFactoryCandidatesQuery,
} from './eligible-factories.types';

const EXTERNAL_QUERY_TIMEOUT_MS = 15000;

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
  const page = query.page ?? 1;
  const perPage = query.perPage ?? 100;
  const offset = (page - 1) * perPage;

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

  const rows = await rowsQuery.timeout(EXTERNAL_QUERY_TIMEOUT_MS).offset(offset).limit(perPage);
  const [industrialEstateNamesByCode, productionCapacitiesByFid, boilerSizesByFid] =
    await Promise.all([
      loadIndustrialEstateNamesByCode(rows),
      loadProductionCapacitiesByFid(rows),
      loadBoilerSizesByFid(rows),
    ]);
  const data = excludeSelectedCandidates(
    rows.map((row) =>
      toEligibleFactoryCandidate(row, {
        industrialEstateNamesByCode,
        eiaLookupSkipped: true,
        productionCapacitiesByFid,
        boilerSizesByFid,
      }),
    ),
    selectedRegistrationNumbers,
  );
  return {
    data,
    meta: {
      total,
      page,
      perPage,
      totalPages: Math.ceil(total / perPage),
      source: 'external',
    },
  };
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

async function loadBoilerSizesByFid(rows: FacImportRow[]): Promise<Map<string, string>> {
  const fids = uniqueFids(rows);
  if (fids.length === 0) return new Map();

  const boilerRows: Array<Record<string, unknown>> = [];
  try {
    for (const fidChunk of chunks(fids, 1000)) {
      const chunkRows = await factorySourceDb<Record<string, unknown>>(
        `${env.FACTORY_DB_SCHEMA}.boiler_list`,
      )
        .whereIn('FID', fidChunk)
        .timeout(EXTERNAL_QUERY_TIMEOUT_MS)
        .select('*');
      boilerRows.push(...chunkRows);
    }
  } catch (error) {
    logger.warn('[eligible-factories] Failed to load boiler sizes', { error });
    return new Map();
  }

  const valuesByFid = new Map<string, string[]>();
  for (const row of boilerRows) {
    const fid = firstRowText(row, ['FID', 'fid']);
    const value = firstRowText(row, [
      'BOILER_SIZE_EACH',
      'BOILER_SIZE',
      'BOILER_SIZES',
      'BOILER_CAPACITY',
      'BOILER_CAP',
      'BOILER_TON',
      'STEAM_CAPACITY',
      'CAPACITY',
      'SIZE',
    ]);
    if (!fid || !value) continue;
    valuesByFid.set(fid, [...(valuesByFid.get(fid) ?? []), value]);
  }

  return new Map(
    [...valuesByFid.entries()].map(([fid, values]) => [fid, [...new Set(values)].join(', ')]),
  );
}

async function loadProductionCapacitiesByFid(rows: FacImportRow[]): Promise<Map<string, string>> {
  const fids = uniqueFids(rows);
  if (fids.length === 0) return new Map();

  const productionRows: ProductionCapacityRow[] = [];
  try {
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
  } catch (error) {
    logger.warn('[eligible-factories] Failed to load production capacities', { error });
    return new Map();
  }

  const valuesByFid = new Map<string, string[]>();
  for (const row of productionRows) {
    const fid = row.FID?.trim();
    const value = formatProductionCapacity(row);
    if (!fid || !value) continue;
    valuesByFid.set(fid, [...(valuesByFid.get(fid) ?? []), value]);
  }

  return new Map(
    [...valuesByFid.entries()].map(([fid, values]) => [fid, [...new Set(values)].join(', ')]),
  );
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

function formatProductionCapacity(row: ProductionCapacityRow): string | null {
  const parts = [row.PRODNAME, row.PRODQUAN, row.UNT_ENAME]
    .map((value) => (value === null || value === undefined ? null : String(value).trim()))
    .filter((value): value is string => Boolean(value));
  return parts.length > 0 ? parts.join(' ') : null;
}

function firstRowText(row: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = row[key];
    if (value === null || value === undefined) continue;
    const text = String(value).trim();
    if (text) return text;
  }
  return null;
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
