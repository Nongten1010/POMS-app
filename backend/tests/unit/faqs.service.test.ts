import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('../../src/modules/faqs/faqs.repository', () => ({
  faqsRepository: {
    create: jest.fn(),
    list: jest.fn(),
    softDelete: jest.fn(),
    update: jest.fn(),
    findAttachment: jest.fn(),
  },
}));

import { faqsRepository } from '../../src/modules/faqs/faqs.repository';
import { faqsService, faqFileStorage } from '../../src/modules/faqs/faqs.service';
import type { FaqDTO } from '../../src/modules/faqs/faqs.types';

const mockedRepository = jest.mocked(faqsRepository);

const faq: FaqDTO = {
  id: 'c24ff643-87c1-4154-bb8a-293a76b9900f',
  question: 'คำถาม',
  answer: 'คำตอบ',
  category: 'OTHER',
  categoryLabel: 'อื่นๆ',
  updatedDate: '2026-09-04',
  createdAt: '2026-09-04T09:30:00.000Z',
  updatedAt: '2026-09-04T09:30:00.000Z',
  links: [],
  attachments: [],
};

const input = {
  question: 'คำถาม',
  answer: 'คำตอบ',
  category: 'OTHER' as const,
  updatedDate: '2026-09-04',
};

describe('faqsService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('returns every active FAQ without pagination metadata', async () => {
    mockedRepository.list.mockResolvedValue([faq]);

    await expect(faqsService.list()).resolves.toEqual([faq]);
  });

  it('creates an FAQ with the authenticated actor', async () => {
    mockedRepository.create.mockResolvedValue(faq);

    await expect(faqsService.create(input, 42)).resolves.toEqual(faq);
    expect(mockedRepository.create).toHaveBeenCalledWith(input, 42);
  });

  it('returns the latest FAQ after a full update', async () => {
    mockedRepository.update.mockResolvedValue(faq);

    await expect(faqsService.update(faq.id, input, 42)).resolves.toEqual(faq);
  });

  it('reports NotFound when an update targets a missing or deleted FAQ', async () => {
    mockedRepository.update.mockResolvedValue(null);

    await expect(faqsService.update(faq.id, input, 42)).rejects.toMatchObject({
      code: 'NOT_FOUND',
      statusCode: 404,
      message: 'FAQ not found',
    });
  });

  it('soft-deletes an FAQ and returns the frontend confirmation shape', async () => {
    mockedRepository.softDelete.mockResolvedValue(true);

    await expect(faqsService.remove(faq.id, 42)).resolves.toEqual({
      id: faq.id,
      deleted: true,
    });
  });

  it('reports NotFound when a delete targets a missing or already deleted FAQ', async () => {
    mockedRepository.softDelete.mockResolvedValue(false);

    await expect(faqsService.remove(faq.id, 42)).rejects.toMatchObject({
      code: 'NOT_FOUND',
      statusCode: 404,
      message: 'FAQ not found',
    });
  });

  it('passes two stored attachments and two links into the FAQ write', async () => {
    const first = storedFile('11111111-1111-4111-8111-111111111111');
    const second = storedFile('22222222-2222-4222-8222-222222222222');
    jest.spyOn(faqFileStorage, 'save').mockResolvedValueOnce(first).mockResolvedValueOnce(second);
    mockedRepository.create.mockResolvedValue({
      ...faq,
      links: ['https://example.com/a', 'https://example.com/b'],
    });
    await faqsService.create(
      { ...input, links: ['https://example.com/a', 'https://example.com/b'] },
      42,
      [uploadedFile(), uploadedFile()],
    );
    expect(mockedRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        newAttachments: [first, second],
        links: ['https://example.com/a', 'https://example.com/b'],
      }),
      42,
    );
  });

  it('removes every new upload when the database write fails', async () => {
    const file = storedFile('11111111-1111-4111-8111-111111111111');
    jest.spyOn(faqFileStorage, 'save').mockResolvedValue(file);
    const remove = jest.spyOn(faqFileStorage, 'remove').mockResolvedValue();
    mockedRepository.create.mockRejectedValue(new Error('DB failure'));
    await expect(faqsService.create(input, 42, [uploadedFile(), uploadedFile()])).rejects.toThrow(
      'DB failure',
    );
    expect(remove).toHaveBeenCalledTimes(2);
  });

  it('removes an earlier upload if storing the second one fails, without saving metadata', async () => {
    const first = storedFile('11111111-1111-4111-8111-111111111111');
    jest
      .spyOn(faqFileStorage, 'save')
      .mockResolvedValueOnce(first)
      .mockRejectedValueOnce(new Error('Disk full'));
    const remove = jest.spyOn(faqFileStorage, 'remove').mockResolvedValue();
    await expect(faqsService.create(input, 42, [uploadedFile(), uploadedFile()])).rejects.toThrow(
      'Disk full',
    );
    expect(remove).toHaveBeenCalledWith(first);
    expect(mockedRepository.create).not.toHaveBeenCalled();
  });

  it('validates all files before storing any of them', async () => {
    const save = jest.spyOn(faqFileStorage, 'save');
    await expect(
      faqsService.create(input, 42, [
        uploadedFile(),
        { ...uploadedFile(), originalname: 'bad.exe' },
      ]),
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(save).not.toHaveBeenCalled();
  });

  it('denies downloads when the attachment is not part of an active FAQ', async () => {
    mockedRepository.findAttachment.mockResolvedValue(undefined);
    const getPath = jest.spyOn(faqFileStorage, 'getPath');
    await expect(
      faqsService.download(faq.id, '11111111-1111-4111-8111-111111111111'),
    ).rejects.toMatchObject({ statusCode: 404 });
    expect(getPath).not.toHaveBeenCalled();
  });
});

function uploadedFile(): Express.Multer.File {
  const buffer = Buffer.from('%PDF-test');
  return {
    originalname: 'test.pdf',
    buffer,
    size: buffer.length,
    mimetype: 'application/pdf',
  } as Express.Multer.File;
}

function storedFile(id: string) {
  return { id, fileName: 'test.pdf', fileSize: 9, mimeType: 'application/pdf', storagePath: id };
}
