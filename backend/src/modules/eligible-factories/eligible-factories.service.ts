import { ConflictError } from '../../shared/errors/AppError';
import { eligibleFactoriesRepository } from './eligible-factories.repository';
import type {
  CreateEligibleFactoryInput,
  EligibleFactoryCandidatesDTO,
  EligibleFactoryDTO,
  ListEligibleFactoryCandidatesQuery,
  ListEligibleFactoriesQuery,
  PaginatedEligibleFactoriesDTO,
} from './eligible-factories.types';
import { MOCK_ELIGIBLE_FACTORY_CANDIDATES } from './eligible-factories.mock-source';

export const eligibleFactoriesService = {
  async listCandidates(
    query: ListEligibleFactoryCandidatesQuery,
  ): Promise<EligibleFactoryCandidatesDTO> {
    const normalizedSearch = query.search?.toLocaleLowerCase('th-TH');
    const data = MOCK_ELIGIBLE_FACTORY_CANDIDATES.filter((factory) => {
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

    return {
      data,
      meta: {
        total: data.length,
        source: 'mock',
      },
    };
  },

  async list(query: ListEligibleFactoriesQuery): Promise<PaginatedEligibleFactoriesDTO> {
    const { rows, total } = await eligibleFactoriesRepository.list(query);
    const meta: PaginatedEligibleFactoriesDTO['meta'] = { total };
    if (query.page !== undefined && query.perPage !== undefined) {
      meta.page = query.page;
      meta.perPage = query.perPage;
      meta.totalPages = Math.ceil(total / query.perPage);
    }
    return { data: rows, meta };
  },

  async create(input: CreateEligibleFactoryInput, actorUserId: number): Promise<EligibleFactoryDTO> {
    const existing = await eligibleFactoriesRepository.findByRegistrationNoNew(
      input.factoryRegistrationNoNew,
    );
    if (existing) {
      throw new ConflictError('Factory is already selected as eligible', {
        factoryRegistrationNoNew: input.factoryRegistrationNoNew,
      });
    }

    return eligibleFactoriesRepository.create(input, actorUserId);
  },
};
