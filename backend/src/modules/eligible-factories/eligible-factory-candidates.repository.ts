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

export const eligibleFactoryCandidatesRepository = {
  async list(_query: ListEligibleFactoryCandidatesQuery): Promise<EligibleFactoryCandidatesDTO> {
    return listExternalCandidates();
  },
};

async function listExternalCandidates(): Promise<EligibleFactoryCandidatesDTO> {
  const selectedRegistrationNumbers = await selectedFactoryRegistrationNumbers();
  const columns = await availableFacImportColumns();
  const baseQuery = buildFacImportBaseQuery();
  const rowsQuery = baseQuery.clone();
  if (columns.includes('FFLAG')) {
    rowsQuery.whereIn('FFLAG', ['1', '3']);
  }
  rowsQuery.select(columns);
  const orderByColumn = firstAvailableColumn(columns, ['FACREG', 'FID', 'DISPFACREG']);

  const rows = await (orderByColumn ? rowsQuery.orderBy(orderByColumn, 'asc') : rowsQuery);
  const [industrialEstateNamesByCode, eiaFactoryKeys] = await Promise.all([
    loadIndustrialEstateNamesByCode(rows),
    loadEiaFactoryKeys(),
  ]);
  const data = excludeSelectedCandidates(
    rows.map((row) =>
      toEligibleFactoryCandidate(row, { industrialEstateNamesByCode, eiaFactoryKeys }),
    ),
    selectedRegistrationNumbers,
  );
  return {
    data,
    meta: {
      total: data.length,
      source: 'external',
    },
  };
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
      FAC_COLONY_INDUST_DESC: string | null;
    }>(`${env.FACTORY_DB_SCHEMA}.FAC_COLONY_INDUST`)
      .whereIn('COLONY_INDUST_CODE', codes)
      .select('COLONY_INDUST_CODE', 'FAC_COLONY_INDUST_DESC');

    return new Map(
      lookupRows
        .filter((row) => row.COLONY_INDUST_CODE && row.FAC_COLONY_INDUST_DESC)
        .map((row) => [row.COLONY_INDUST_CODE as string, row.FAC_COLONY_INDUST_DESC as string]),
    );
  } catch (error) {
    logger.warn('[eligible-factories] Failed to load industrial estate names', { error });
    return new Map();
  }
}

async function loadEiaFactoryKeys(): Promise<Set<string>> {
  try {
    const rows = await factorySourceDb<{ FACREG: string | null; FID: string | null }>(
      `${env.FACTORY_DB_SCHEMA}.check_eia`,
    ).select('FACREG', 'FID');

    return new Set(
      rows.flatMap((row) => [row.FACREG?.trim(), row.FID?.trim()]).filter(isNonEmptyString),
    );
  } catch (error) {
    logger.warn('[eligible-factories] Failed to load EIA factory keys', { error });
    return new Set();
  }
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

function isNonEmptyString(value: string | null | undefined): value is string {
  return Boolean(value);
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
