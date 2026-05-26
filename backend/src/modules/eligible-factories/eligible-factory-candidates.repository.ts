import type { Knex } from 'knex';
import { logger } from '../../config/logger';
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
      try {
        return await listExternalCandidates();
      } catch (error) {
        logger.error('[eligible-factories] Failed to load Fac60k external candidates', { error });
        return listMockCandidates();
      }
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
  try {
    return new Set(await eligibleFactoriesRepository.listActiveRegistrationNumbers());
  } catch (error) {
    logger.warn('[eligible-factories] Failed to load selected factories for candidate exclusion', {
      error,
    });
    return new Set();
  }
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
    'FNAME',
    'FID',
    'DISPFACREG',
    'FADDR',
    'FMOO',
    'SOI',
    'ROAD',
    'PROV',
    'COLONY_INDUST_CODE',
    'LONGITUDE_X',
    'LATITUDE_Y',
    'OBJECT',
    'FFLAG',
    'TOTAL_CAP',
    'CAPPROD',
  ];
}
