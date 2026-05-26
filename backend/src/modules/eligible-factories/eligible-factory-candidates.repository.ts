import type { Knex } from 'knex';
import { env } from '../../config/env';
import { factorySourceDb, factorySourceTableName } from '../../config/factory-source-database';
import { MOCK_ELIGIBLE_FACTORY_CANDIDATES } from './eligible-factories.mock-source';
import { type FacImportRow, toEligibleFactoryCandidate } from './fac-import.mapper';
import { eligibleFactoriesRepository } from './eligible-factories.repository';
import type {
  EligibleFactoryCandidateDTO,
  EligibleFactoryCandidatesDTO,
  ListEligibleFactoryCandidatesQuery,
} from './eligible-factories.types';

export const eligibleFactoryCandidatesRepository = {
  async list(_query: ListEligibleFactoryCandidatesQuery): Promise<EligibleFactoryCandidatesDTO> {
    if (env.FACTORY_SOURCE_MODE === 'external') {
      return listExternalCandidates();
    }

    return listMockCandidates();
  },
};

async function listExternalCandidates(): Promise<EligibleFactoryCandidatesDTO> {
  const selectedRegistrationNumbers = await selectedFactoryRegistrationNumbers();
  const baseQuery = buildFacImportBaseQuery();
  const rowsQuery = baseQuery.clone().select(facImportColumns()).orderBy('FACREG', 'asc');

  const rows = await rowsQuery;
  const data = excludeSelectedCandidates(
    rows.map(toEligibleFactoryCandidate),
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

async function listMockCandidates(): Promise<EligibleFactoryCandidatesDTO> {
  const selectedRegistrationNumbers = await selectedFactoryRegistrationNumbers();
  const data = excludeSelectedCandidates(
    MOCK_ELIGIBLE_FACTORY_CANDIDATES,
    selectedRegistrationNumbers,
  );

  return {
    data,
    meta: {
      total: data.length,
      source: 'mock',
    },
  };
}

async function selectedFactoryRegistrationNumbers(): Promise<Set<string>> {
  return new Set(await eligibleFactoriesRepository.listActiveRegistrationNumbers());
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
