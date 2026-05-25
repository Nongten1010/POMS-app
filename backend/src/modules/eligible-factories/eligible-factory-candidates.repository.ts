import type { Knex } from 'knex';
import { env } from '../../config/env';
import { factorySourceDb, factorySourceTableName } from '../../config/factory-source-database';
import { MOCK_ELIGIBLE_FACTORY_CANDIDATES } from './eligible-factories.mock-source';
import {
  diwFactoryFlagFromOperationStatus,
  diwProvinceCodeFromName,
  type FacImportRow,
  toEligibleFactoryCandidate,
} from './fac-import.mapper';
import type {
  EligibleFactoryCandidatesDTO,
  ListEligibleFactoryCandidatesQuery,
} from './eligible-factories.types';

export const eligibleFactoryCandidatesRepository = {
  async list(query: ListEligibleFactoryCandidatesQuery): Promise<EligibleFactoryCandidatesDTO> {
    if (env.FACTORY_SOURCE_MODE === 'external') {
      return listExternalCandidates(query);
    }

    return listMockCandidates(query);
  },
};

async function listExternalCandidates(
  query: ListEligibleFactoryCandidatesQuery,
): Promise<EligibleFactoryCandidatesDTO> {
  const baseQuery = buildFacImportBaseQuery(query);
  const totalRow = await baseQuery
    .clone()
    .clearSelect()
    .clearOrder()
    .count<{ total: number | string }>({ total: '*' })
    .first();
  const total = Number(totalRow?.total ?? 0);

  const rowsQuery = baseQuery.clone().select(facImportColumns()).orderBy('FACREG', 'asc');
  if (query.page !== undefined && query.perPage !== undefined) {
    rowsQuery.limit(query.perPage).offset((query.page - 1) * query.perPage);
  }

  const rows = await rowsQuery;
  const data = rows.map(toEligibleFactoryCandidate);
  return {
    data,
    meta: paginationMeta(total, query, 'external'),
  };
}

function listMockCandidates(query: ListEligibleFactoryCandidatesQuery): EligibleFactoryCandidatesDTO {
  const normalizedSearch = query.search?.toLocaleLowerCase('th-TH');
  const filtered = MOCK_ELIGIBLE_FACTORY_CANDIDATES.filter((factory) => {
    if (query.provinceName && factory.provinceName !== query.provinceName) return false;
    if (query.operationStatus && factory.operationStatus !== query.operationStatus) return false;
    if (query.hasEia !== undefined && factory.hasEia !== query.hasEia) return false;
    if (!normalizedSearch) return true;

    return [
      factory.factoryName,
      factory.factoryRegistrationNoNew,
      factory.factoryRegistrationNoOld,
      factory.provinceName,
      factory.industrialEstateName,
      factory.businessActivity,
    ].some((value) => value?.toLocaleLowerCase('th-TH').includes(normalizedSearch));
  });

  if (query.page === undefined || query.perPage === undefined) {
    return {
      data: filtered,
      meta: {
        total: filtered.length,
        source: 'mock',
      },
    };
  }

  const offset = (query.page - 1) * query.perPage;
  return {
    data: filtered.slice(offset, offset + query.perPage),
    meta: paginationMeta(filtered.length, query, 'mock'),
  };
}

function buildFacImportBaseQuery(
  query: ListEligibleFactoryCandidatesQuery,
): Knex.QueryBuilder<FacImportRow, FacImportRow[]> {
  const builder = factorySourceDb<FacImportRow>(factorySourceTableName());

  if (query.search) {
    builder.andWhere((qb) => {
      qb.where('FNAME', 'like', `%${query.search}%`)
        .orWhere('DISPFACREG', 'like', `%${query.search}%`)
        .orWhere('OLDREG', 'like', `%${query.search}%`)
        .orWhere('FACREG', 'like', `%${query.search}%`)
        .orWhere('FID', 'like', `%${query.search}%`)
        .orWhere('OBJECT', 'like', `%${query.search}%`);
    });
  }

  if (query.provinceName) {
    const provinceCode = diwProvinceCodeFromName(query.provinceName);
    if (provinceCode) builder.where('PROV', Number(provinceCode));
    else builder.whereRaw('1 = 0');
  }

  if (query.operationStatus) {
    const flag = diwFactoryFlagFromOperationStatus(query.operationStatus);
    if (flag) builder.where('FFLAG', flag);
    else builder.whereRaw('1 = 0');
  }

  if (query.hasEia !== undefined) {
    builder.whereRaw('1 = 0');
  }

  return builder;
}

function facImportColumns(): Array<keyof FacImportRow> {
  return [
    'FACREG',
    'FACREQ',
    'FFLAG',
    'EXPSEQ',
    'FNAME',
    'FADDR',
    'FMOO',
    'SOI',
    'ROAD',
    'PROV',
    'CANAL',
    'RIVER',
    'OBJECT',
    'HP',
    'HP2',
    'OLDREG',
    'CAPLAND',
    'CAPBUILD',
    'CAPMACH',
    'CAPWORK',
    'COLONY_INDUST_CODE',
    'STARTDATE',
    'DISPFACREG',
    'LONGITUDE_X',
    'LATITUDE_Y',
    'CAPPROD',
    'TOTAL_CAP',
    'CAPREGIS',
    'FID',
    'FACTYPE',
    'CLASS',
  ];
}

function paginationMeta(
  total: number,
  query: ListEligibleFactoryCandidatesQuery,
  source: 'mock' | 'external',
): EligibleFactoryCandidatesDTO['meta'] {
  if (query.page === undefined || query.perPage === undefined) {
    return { total, source };
  }

  return {
    total,
    page: query.page,
    perPage: query.perPage,
    totalPages: Math.ceil(total / query.perPage),
    source,
  };
}
