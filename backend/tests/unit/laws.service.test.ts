import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { logger } from '../../src/config/logger';
import { LawService } from '../../src/modules/laws/laws.service';
import type {
  LawFileStorage,
  LawRecord,
  LawRepository,
  StoredLawFile,
} from '../../src/modules/laws/laws.types';

const LAW_ID = '28b69ad9-2acf-4b50-961f-84d7a5bea945';

describe('law service', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns the exact consumer DTO with labels and a direct download URL', async () => {
    const repository = repositoryStub({ list: async () => [lawRecord()] });
    const service = new LawService(repository, storageStub(), { apiPrefix: '/api/v1/' });

    await expect(service.list()).resolves.toEqual([
      {
        id: LAW_ID,
        title: 'ประกาศทดสอบ',
        category: 'CEMS',
        categoryLabel: 'CEMS',
        type: 'RULE_AND_ANNOUNCEMENT',
        typeLabel: 'กฎและประกาศ',
        publishedDate: '2026-09-04',
        file: {
          fileName: 'law.pdf',
          fileSize: 15,
          mimeType: 'application/pdf',
          downloadUrl: `/api/v1/laws/${LAW_ID}/file`,
        },
        createdAt: '2026-09-04T08:00:00.000Z',
        updatedAt: '2026-09-04T08:00:00.000Z',
      },
    ]);
  });

  it('requires a file when creating a law', async () => {
    const service = new LawService(repositoryStub(), storageStub());

    await expect(service.create(lawInput(), undefined, 7)).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      details: { file: expect.any(String) },
    });
  });

  it('stores and returns a newly created law', async () => {
    const create = jest.fn<LawRepository['create']>(async () => lawRecord());
    const save = jest.fn<LawFileStorage['save']>(async () => storedFile());
    const service = new LawService(repositoryStub({ create }), storageStub({ save }));

    await expect(service.create(lawInput(), uploadedPdf(), 7)).resolves.toMatchObject({
      id: LAW_ID,
      file: { downloadUrl: `/api/v1/laws/${LAW_ID}/file` },
    });
    expect(save).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ file: storedFile() }), 7);
  });

  it('removes the newly stored file when creating the database row fails', async () => {
    const remove = jest.fn<LawFileStorage['remove']>(async () => undefined);
    const repository = repositoryStub({
      create: async () => {
        throw new Error('database unavailable');
      },
    });
    const storage = storageStub({ remove });
    const service = new LawService(repository, storage);

    await expect(service.create(lawInput(), uploadedPdf(), 7)).rejects.toThrow(
      'database unavailable',
    );
    expect(remove).toHaveBeenCalledWith('.private/laws/2026/09/new.pdf');
  });

  it('keeps the existing file when updating metadata without a new upload', async () => {
    const previous = lawRecord();
    const current = lawRecord({ title: 'ประกาศฉบับแก้ไข' });
    const update = jest.fn<LawRepository['update']>(async () => ({ previous, current }));
    const save = jest.fn<LawFileStorage['save']>(async () => storedFile());
    const remove = jest.fn<LawFileStorage['remove']>(async () => undefined);
    const service = new LawService(
      repositoryStub({ findById: async () => previous, update }),
      storageStub({ save, remove }),
    );

    const result = await service.update(
      LAW_ID,
      { ...lawInput(), title: 'ประกาศฉบับแก้ไข' },
      undefined,
      7,
    );

    expect(update).toHaveBeenCalledWith(LAW_ID, expect.objectContaining({ file: undefined }), 7);
    expect(save).not.toHaveBeenCalled();
    expect(remove).not.toHaveBeenCalled();
    expect(result.title).toBe('ประกาศฉบับแก้ไข');
  });

  it('does not store a replacement when the requested law is already missing', async () => {
    const save = jest.fn<LawFileStorage['save']>(async () => storedFile());
    const service = new LawService(repositoryStub(), storageStub({ save }));

    await expect(service.update(LAW_ID, lawInput(), uploadedPdf(), 7)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    expect(save).not.toHaveBeenCalled();
  });

  it('replaces the old file only after a successful update', async () => {
    const previous = lawRecord();
    const current = lawRecord({
      fileName: 'replacement.pdf',
      storagePath: '.private/laws/2026/09/replacement.pdf',
    });
    const remove = jest.fn<LawFileStorage['remove']>(async () => undefined);
    const service = new LawService(
      repositoryStub({
        findById: async () => previous,
        update: async () => ({ previous, current }),
      }),
      storageStub({
        save: async () => ({
          ...storedFile(),
          fileName: 'replacement.pdf',
          storagePath: '.private/laws/2026/09/replacement.pdf',
        }),
        remove,
      }),
    );

    await service.update(LAW_ID, lawInput(), uploadedPdf(), 7);

    expect(remove).toHaveBeenCalledWith(previous.storagePath);
  });

  it('returns not found and removes a speculative replacement after an update race', async () => {
    const remove = jest.fn<LawFileStorage['remove']>(async () => undefined);
    const service = new LawService(
      repositoryStub({ findById: async () => lawRecord(), update: async () => null }),
      storageStub({ remove }),
    );

    await expect(service.update(LAW_ID, lawInput(), uploadedPdf(), 7)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    expect(remove).toHaveBeenCalledWith('.private/laws/2026/09/new.pdf');
  });

  it('soft-deletes the row and removes its private file', async () => {
    const remove = jest.fn<LawFileStorage['remove']>(async () => undefined);
    const service = new LawService(
      repositoryStub({ softDelete: async () => lawRecord() }),
      storageStub({ remove }),
    );

    await expect(service.delete(LAW_ID, 7)).resolves.toEqual({ id: LAW_ID, deleted: true });
    expect(remove).toHaveBeenCalledWith('.private/laws/2026/09/law.pdf');
  });

  it('logs a private-file cleanup failure while preserving a committed delete result', async () => {
    const cleanupError = new Error('filesystem unavailable');
    const warn = jest.spyOn(logger, 'warn').mockImplementation(() => logger);
    const service = new LawService(
      repositoryStub({ softDelete: async () => lawRecord() }),
      storageStub({
        remove: async () => {
          throw cleanupError;
        },
      }),
    );

    await expect(service.delete(LAW_ID, 7)).resolves.toEqual({ id: LAW_ID, deleted: true });
    expect(warn.mock.calls[0]).toEqual([
      '[laws] Failed to remove private PDF',
      {
        context: 'delete',
        lawId: LAW_ID,
        storagePath: '.private/laws/2026/09/law.pdf',
        error: cleanupError,
      },
    ]);
  });

  it('returns not found when deleting an unknown law', async () => {
    const remove = jest.fn<LawFileStorage['remove']>(async () => undefined);
    const service = new LawService(repositoryStub(), storageStub({ remove }));

    await expect(service.delete(LAW_ID, 7)).rejects.toMatchObject({ code: 'NOT_FOUND' });
    expect(remove).not.toHaveBeenCalled();
  });

  it('resolves a public download through the confined storage service', async () => {
    const content = {
      filePath: '/tmp/private/law.pdf',
      fileName: 'law.pdf',
      fileSize: 15,
      mimeType: 'application/pdf' as const,
    };
    const getContent = jest.fn<LawFileStorage['getContent']>(async () => content);
    const service = new LawService(
      repositoryStub({ findById: async () => lawRecord() }),
      storageStub({ getContent }),
    );

    await expect(service.getFile(LAW_ID)).resolves.toEqual(content);
    expect(getContent).toHaveBeenCalledWith(
      expect.objectContaining({ storagePath: '.private/laws/2026/09/law.pdf' }),
    );
  });
});

function lawInput() {
  return {
    title: 'ประกาศทดสอบ',
    category: 'CEMS' as const,
    type: 'RULE_AND_ANNOUNCEMENT' as const,
    publishedDate: '2026-09-04',
  };
}

function lawRecord(overrides: Partial<LawRecord> = {}): LawRecord {
  return {
    id: LAW_ID,
    title: 'ประกาศทดสอบ',
    category: 'CEMS',
    type: 'RULE_AND_ANNOUNCEMENT',
    publishedDate: '2026-09-04',
    fileName: 'law.pdf',
    fileSize: 15,
    mimeType: 'application/pdf',
    storagePath: '.private/laws/2026/09/law.pdf',
    createdAt: '2026-09-04T08:00:00.000Z',
    updatedAt: '2026-09-04T08:00:00.000Z',
    ...overrides,
  };
}

function storedFile(): StoredLawFile {
  return {
    fileName: 'new.pdf',
    fileSize: 15,
    mimeType: 'application/pdf',
    storagePath: '.private/laws/2026/09/new.pdf',
  };
}

function uploadedPdf() {
  const buffer = Buffer.from('%PDF-1.7\n%%EOF\n');
  return { buffer, originalName: 'new.pdf', mimeType: 'application/pdf', size: buffer.length };
}

function repositoryStub(overrides: Partial<LawRepository> = {}): LawRepository {
  return {
    list: async () => [],
    findById: async () => null,
    create: async () => lawRecord(),
    update: async () => null,
    softDelete: async () => null,
    ...overrides,
  };
}

function storageStub(overrides: Partial<LawFileStorage> = {}): LawFileStorage {
  return {
    save: async () => storedFile(),
    remove: async () => undefined,
    getContent: async () => {
      throw new Error('not configured');
    },
    ...overrides,
  };
}
