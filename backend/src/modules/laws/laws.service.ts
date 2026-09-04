import { env } from '../../config/env';
import { logger } from '../../config/logger';
import { NotFoundError } from '../../shared/errors/AppError';
import { LocalLawFileStorage } from './laws-file-storage';
import { lawsRepository } from './laws.repository';
import type {
  LawDTO,
  LawFileContent,
  LawFileStorage,
  LawInput,
  LawRecord,
  LawRepository,
  UploadedLawFile,
} from './laws.types';
import { LAW_CATEGORY_LABELS, LAW_TYPE_LABELS } from './laws.types';
import { lawValidationError } from './laws.validator';

interface LawServiceOptions {
  apiPrefix?: string;
}

export interface LawServiceContract {
  list(): Promise<LawDTO[]>;
  create(input: LawInput, file: UploadedLawFile | undefined, actorUserId: number): Promise<LawDTO>;
  update(
    id: string,
    input: LawInput,
    file: UploadedLawFile | undefined,
    actorUserId: number,
  ): Promise<LawDTO>;
  delete(id: string, actorUserId: number): Promise<{ id: string; deleted: true }>;
  getFile(id: string): Promise<LawFileContent>;
}

export class LawService implements LawServiceContract {
  private readonly apiPrefix: string;

  constructor(
    private readonly repository: LawRepository,
    private readonly fileStorage: LawFileStorage,
    options: LawServiceOptions = {},
  ) {
    this.apiPrefix = normalizeApiPrefix(options.apiPrefix ?? env.API_PREFIX);
  }

  async list(): Promise<LawDTO[]> {
    const records = await this.repository.list();
    return records.map((record) => this.toDTO(record));
  }

  async create(
    input: LawInput,
    file: UploadedLawFile | undefined,
    actorUserId: number,
  ): Promise<LawDTO> {
    if (!file) throw lawValidationError({ file: 'กรุณาแนบไฟล์ PDF' });
    const storedFile = await this.fileStorage.save(file);
    try {
      const created = await this.repository.create({ ...input, file: storedFile }, actorUserId);
      return this.toDTO(created);
    } catch (error) {
      await this.removeFileBestEffort(storedFile.storagePath, 'create-rollback');
      throw error;
    }
  }

  async update(
    id: string,
    input: LawInput,
    file: UploadedLawFile | undefined,
    actorUserId: number,
  ): Promise<LawDTO> {
    const existing = await this.repository.findById(id);
    if (!existing) throw new NotFoundError('Law not found');

    const storedFile = file ? await this.fileStorage.save(file) : undefined;
    let updated;
    try {
      updated = await this.repository.update(id, { ...input, file: storedFile }, actorUserId);
      if (!updated) throw new NotFoundError('Law not found');
    } catch (error) {
      if (storedFile) {
        await this.removeFileBestEffort(storedFile.storagePath, 'update-rollback', id);
      }
      throw error;
    }

    if (storedFile && updated.previous.storagePath !== storedFile.storagePath) {
      await this.removeFileBestEffort(updated.previous.storagePath, 'replace', id);
    }
    return this.toDTO(updated.current);
  }

  async delete(id: string, actorUserId: number): Promise<{ id: string; deleted: true }> {
    const deleted = await this.repository.softDelete(id, actorUserId);
    if (!deleted) throw new NotFoundError('Law not found');
    await this.removeFileBestEffort(deleted.storagePath, 'delete', id);
    return { id, deleted: true };
  }

  async getFile(id: string): Promise<LawFileContent> {
    const record = await this.repository.findById(id);
    if (!record) throw new NotFoundError('Law not found');
    return this.fileStorage.getContent(toStoredFile(record));
  }

  private toDTO(record: LawRecord): LawDTO {
    return {
      id: record.id,
      title: record.title,
      category: record.category,
      categoryLabel: LAW_CATEGORY_LABELS[record.category],
      type: record.type,
      typeLabel: LAW_TYPE_LABELS[record.type],
      publishedDate: record.publishedDate,
      file: {
        fileName: record.fileName,
        fileSize: record.fileSize,
        mimeType: record.mimeType,
        downloadUrl: `${this.apiPrefix}/laws/${record.id}/file`,
      },
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }

  private async removeFileBestEffort(
    storagePath: string,
    context: 'create-rollback' | 'update-rollback' | 'replace' | 'delete',
    lawId?: string,
  ): Promise<void> {
    try {
      await this.fileStorage.remove(storagePath);
    } catch (error) {
      logger.warn('[laws] Failed to remove private PDF', {
        context,
        ...(lawId ? { lawId } : {}),
        storagePath,
        error,
      });
    }
  }
}

function toStoredFile(record: LawRecord) {
  return {
    fileName: record.fileName,
    fileSize: record.fileSize,
    mimeType: record.mimeType,
    storagePath: record.storagePath,
  };
}

function normalizeApiPrefix(value: string): string {
  const normalized = value.replace(/^\/+|\/+$/g, '');
  return normalized ? `/${normalized}` : '';
}

export const lawsService = new LawService(
  lawsRepository,
  new LocalLawFileStorage({ uploadDir: env.UPLOAD_DIR }),
);
