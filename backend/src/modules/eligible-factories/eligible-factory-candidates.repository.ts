import type { Knex } from 'knex';
import { logger } from '../../config/logger';
import { env } from '../../config/env';
import { factorySourceDb, factorySourceTableName } from '../../config/factory-source-database';
import { boilerSourceDb, boilerSourceTableName } from '../../config/boiler-source-database';
import { type FacImportRow, toEligibleFactoryCandidate } from './fac-import.mapper';
import { eligibleFactoriesRepository } from './eligible-factories.repository';
import type {
  EligibleFactoryCandidateDTO,
  EligibleFactoryCandidatesDTO,
  BoilerLookupValue,
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
  const [industrialEstateNamesByCode, productionCapacitiesByFid, boilerValuesByFid] =
    await Promise.all([
      loadIndustrialEstateNamesByCode(rows),
      loadProductionCapacitiesByFid(rows),
      loadBoilerValuesByFid(rows),
    ]);
  const data = excludeSelectedCandidates(
    rows.map((row) =>
      toEligibleFactoryCandidate(row, {
        industrialEstateNamesByCode,
        eiaLookupSkipped: true,
        productionCapacitiesByFid,
        boilerValuesByFid,
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

async function loadBoilerValuesByFid(rows: FacImportRow[]): Promise<Map<string, BoilerLookupValue>> {
  const fids = uniqueFids(rows);
  if (fids.length === 0) return new Map();

  const boilerRows: Array<Record<string, unknown>> = [];
  try {
    if (fids.length > BULK_LOOKUP_THRESHOLD) {
      boilerRows.push(
        ...(await boilerSourceDb<Record<string, unknown>>(boilerSourceTableName())
          .whereNotNull('fac_id_reg')
          .timeout(EXTERNAL_QUERY_TIMEOUT_MS)
          .select('fac_id_reg', 'mac_max_stream_prod', 'fuel_name', 'fuel_volume')),
      );
    } else {
      for (const fidChunk of chunks(fids, 1000)) {
        const chunkRows = await boilerSourceDb<Record<string, unknown>>(boilerSourceTableName())
          .whereIn('fac_id_reg', fidChunk)
          .timeout(EXTERNAL_QUERY_TIMEOUT_MS)
          .select('fac_id_reg', 'mac_max_stream_prod', 'fuel_name', 'fuel_volume');
        boilerRows.push(...chunkRows);
      }
    }
  } catch (error) {
    logger.warn('[eligible-factories] Failed to load boiler sizes', { error });
    return new Map();
  }

  const requestedFids = new Set(fids);
  const boilerSizesByFid = new Map<string, string[]>();
  const fuelNamesByFid = new Map<string, string[]>();
  for (const row of boilerRows) {
    const fid = firstRowText(row, ['fac_id_reg', 'FAC_ID_REG']);
    if (!fid || !requestedFids.has(fid)) continue;

    const boilerSize = formatDecimalText(
      firstRowText(row, ['mac_max_stream_prod', 'MAC_MAX_STREAM_PROD']),
    );
    if (boilerSize) {
      boilerSizesByFid.set(fid, [...(boilerSizesByFid.get(fid) ?? []), boilerSize]);
    }

    const fuel = formatFuelUsed(row);
    if (fuel) {
      fuelNamesByFid.set(fid, [...(fuelNamesByFid.get(fid) ?? []), fuel]);
    }
  }

  return new Map(
    [...new Set([...boilerSizesByFid.keys(), ...fuelNamesByFid.keys()])].map((fid) => [
      fid,
      {
        boilerSizeEach: joinUnique(boilerSizesByFid.get(fid), ','),
        fuelUsed: joinUnique(fuelNamesByFid.get(fid)),
      },
    ]),
  );
}

async function loadProductionCapacitiesByFid(rows: FacImportRow[]): Promise<Map<string, string>> {
  const fids = uniqueFids(rows);
  if (fids.length === 0) return new Map();

  const productionRows: ProductionCapacityRow[] = [];
  try {
    if (fids.length > BULK_LOOKUP_THRESHOLD) {
      productionRows.push(...(await loadActiveFactoryProductionCapacities()));
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

async function loadActiveFactoryProductionCapacities(): Promise<ProductionCapacityRow[]> {
  return factorySourceDb<ProductionCapacityRow>(`${env.FACTORY_DB_SCHEMA}.FAC_PROD as fp`)
    .join(`${factorySourceTableName()} as fi`, 'fp.FID', 'fi.FID')
    .leftJoin(`${env.FACTORY_DB_SCHEMA}.UNIT as u`, 'fp.UNIT', 'u.UNIT')
    .whereIn('fi.FFLAG', ['1', '3'])
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

function formatProductionCapacity(row: ProductionCapacityRow): string | null {
  const parts = [row.PRODNAME, row.PRODQUAN, row.UNT_ENAME]
    .map((value) => (value === null || value === undefined ? null : String(value).trim()))
    .filter((value): value is string => Boolean(value));
  return parts.length > 0 ? parts.join(' ') : null;
}

function joinUnique(values: string[] | undefined, separator = ', '): string | null {
  if (!values || values.length === 0) return null;
  const uniqueValues = [...new Set(values)];
  return uniqueValues.length > 0 ? uniqueValues.join(separator) : null;
}

function formatFuelUsed(row: Record<string, unknown>): string | null {
  const fuelName = firstRowText(row, ['fuel_name', 'FUEL_NAME']);
  const fuelVolume = firstRowText(row, ['fuel_volume', 'FUEL_VOLUME']);
  if (!fuelName) return fuelVolume;
  if (!fuelVolume) return fuelName;
  return `${fuelName} ${fuelVolume}`;
}

function formatDecimalText(value: string | null): string | null {
  if (!value) return null;
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return value;
  return Number(numeric.toFixed(2)).toString();
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
