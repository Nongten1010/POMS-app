import { beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('../../src/modules/faqs/faqs.repository', () => ({
  faqsRepository: {
    create: jest.fn(),
    list: jest.fn(),
    softDelete: jest.fn(),
    update: jest.fn(),
  },
}));

import { faqsRepository } from '../../src/modules/faqs/faqs.repository';
import { faqsService } from '../../src/modules/faqs/faqs.service';
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
});
