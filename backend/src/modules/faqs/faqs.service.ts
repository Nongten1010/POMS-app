import { NotFoundError } from '../../shared/errors/AppError';
import { faqsRepository } from './faqs.repository';
import type { DeletedFaqDTO, FaqDTO, FaqInput, StoredFaqAttachment } from './faqs.types';
import { env } from '../../config/env';
import { FaqFileStorage, faqFileError, validateFaqFile } from './faqs-file-storage';

export const faqFileStorage = new FaqFileStorage(env.UPLOAD_DIR);

export const faqsService = {
  async list(): Promise<FaqDTO[]> {
    return faqsRepository.list();
  },

  async create(
    input: FaqInput,
    actorUserId: number,
    files: Express.Multer.File[] = [],
  ): Promise<FaqDTO> {
    return withUploads(files, (newAttachments) =>
      faqsRepository.create({ ...input, ...(files.length ? { newAttachments } : {}) }, actorUserId),
    );
  },

  async update(
    publicId: string,
    input: FaqInput,
    actorUserId: number,
    files: Express.Multer.File[] = [],
  ): Promise<FaqDTO> {
    return withUploads(files, async (newAttachments) => {
      const updated = await faqsRepository.update(
        publicId,
        { ...input, ...(files.length ? { newAttachments } : {}) },
        actorUserId,
      );
      if (!updated) throw new NotFoundError('FAQ not found');
      return updated;
    });
  },

  async download(publicId: string, attachmentId: string) {
    const file = await faqsRepository.findAttachment(publicId, attachmentId);
    if (!file) throw new NotFoundError('FAQ attachment not found');
    return { ...file, filePath: await faqFileStorage.getPath(file) };
  },

  async remove(publicId: string, actorUserId: number): Promise<DeletedFaqDTO> {
    const deleted = await faqsRepository.softDelete(publicId, actorUserId);
    if (!deleted) throw new NotFoundError('FAQ not found');
    return { id: publicId, deleted: true };
  },
};

async function withUploads<T>(
  files: Express.Multer.File[],
  save: (files: StoredFaqAttachment[]) => Promise<T>,
): Promise<T> {
  if (files.length > 10) throw faqFileError('แนบได้สูงสุด 10 ไฟล์ต่อคำถาม');
  files.forEach(validateFaqFile);
  const stored: StoredFaqAttachment[] = [];
  try {
    for (const file of files) stored.push(await faqFileStorage.save(file));
    return await save(stored);
  } catch (error) {
    await Promise.allSettled(stored.map((file) => faqFileStorage.remove(file)));
    throw error;
  }
}
