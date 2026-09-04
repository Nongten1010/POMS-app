import { NotFoundError } from '../../shared/errors/AppError';
import { faqsRepository } from './faqs.repository';
import type { DeletedFaqDTO, FaqDTO, FaqInput } from './faqs.types';

export const faqsService = {
  async list(): Promise<FaqDTO[]> {
    return faqsRepository.list();
  },

  async create(input: FaqInput, actorUserId: number): Promise<FaqDTO> {
    return faqsRepository.create(input, actorUserId);
  },

  async update(publicId: string, input: FaqInput, actorUserId: number): Promise<FaqDTO> {
    const updated = await faqsRepository.update(publicId, input, actorUserId);
    if (!updated) throw new NotFoundError('FAQ not found');
    return updated;
  },

  async remove(publicId: string, actorUserId: number): Promise<DeletedFaqDTO> {
    const deleted = await faqsRepository.softDelete(publicId, actorUserId);
    if (!deleted) throw new NotFoundError('FAQ not found');
    return { id: publicId, deleted: true };
  },
};
