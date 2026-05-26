import { ConflictError, NotFoundError } from '../../shared/errors/AppError';
import { eligibleFactoriesRepository } from './eligible-factories.repository';
import type {
  CreateEligibleFactoryInput,
  EligibleFactoryDTO,
  ListEligibleFactoryCandidatesQuery,
  ListEligibleFactoriesQuery,
  PaginatedEligibleFactoriesDTO,
} from './eligible-factories.types';
import { eligibleFactoryCandidatesRepository } from './eligible-factory-candidates.repository';

export const eligibleFactoriesService = {
  listCandidates(query: ListEligibleFactoryCandidatesQuery) {
    return eligibleFactoryCandidatesRepository.list(query);
  },

  async list(query: ListEligibleFactoriesQuery): Promise<PaginatedEligibleFactoriesDTO> {
    const { rows, total } = await eligibleFactoriesRepository.list(query);
    return { data: rows, meta: { total } };
  },

  async create(
    input: CreateEligibleFactoryInput,
    actorUserId: number,
  ): Promise<EligibleFactoryDTO> {
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

  async remove(id: number, actorUserId: number): Promise<void> {
    const removed = await eligibleFactoriesRepository.softDelete(id, actorUserId);
    if (!removed) {
      throw new NotFoundError('Eligible factory selection not found');
    }
  },
};
