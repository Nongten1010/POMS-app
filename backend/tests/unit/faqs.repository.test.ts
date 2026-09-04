import { beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('../../src/config/database', () => ({
  db: Object.assign(jest.fn(), {
    fn: { now: jest.fn(() => 'db-now') },
  }),
}));

import { db } from '../../src/config/database';
import { faqsRepository } from '../../src/modules/faqs/faqs.repository';

const mockedDb = db as unknown as jest.Mock<(...args: unknown[]) => unknown> & {
  fn: { now: jest.Mock<() => string> };
};

const publicId = 'c24ff643-87c1-4154-bb8a-293a76b9900f';
const row = {
  public_id: publicId,
  question: 'คำถาม',
  answer: 'คำตอบ',
  category: 'OTHER',
  updated_date: '2026-09-04',
  created_at: new Date('2026-09-04T09:30:00.000Z'),
  updated_at: '2026-09-04T10:30:00.000Z',
};

describe('faqsRepository', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedDb.fn.now.mockReturnValue('db-now');
  });

  it('lists only active rows and maps the public DTO without leaking the internal id', async () => {
    const query = listQuery([row]);
    mockedDb.mockReturnValue(query);

    await expect(faqsRepository.list()).resolves.toEqual([
      {
        id: publicId,
        question: 'คำถาม',
        answer: 'คำตอบ',
        category: 'OTHER',
        categoryLabel: 'อื่นๆ',
        updatedDate: '2026-09-04',
        createdAt: '2026-09-04T09:30:00.000Z',
        updatedAt: '2026-09-04T10:30:00.000Z',
      },
    ]);
    expect(query.whereNull).toHaveBeenCalledWith('deleted_at');
    expect(query.select).toHaveBeenCalledWith(
      'public_id',
      'question',
      'answer',
      'category',
      'updated_date',
      'created_at',
      'updated_at',
    );
  });

  it('creates a UUID-backed row with audit fields and reloads its public DTO', async () => {
    let inserted: Record<string, unknown> | undefined;
    const insertQuery = {
      insert: jest.fn((values: Record<string, unknown>) => {
        inserted = values;
        return {
          returning: jest.fn().mockResolvedValue([{ public_id: values.public_id }] as never),
        };
      }),
    };
    const findQuery = findOneQuery(row);
    mockedDb.mockReturnValueOnce(insertQuery).mockReturnValueOnce(findQuery);

    const result = await faqsRepository.create(
      {
        question: 'คำถาม',
        answer: 'คำตอบ',
        category: 'OTHER',
        updatedDate: '2026-09-04',
      },
      42,
    );

    expect(inserted).toMatchObject({
      public_id: expect.any(String),
      question: 'คำถาม',
      answer: 'คำตอบ',
      category: 'OTHER',
      updated_date: '2026-09-04',
      created_by: 42,
      updated_by: 42,
    });
    expect(inserted?.public_id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(findQuery.where).toHaveBeenCalledWith('public_id', inserted?.public_id);
    expect(result.id).toBe(publicId);
  });

  it('updates only an active public id and reloads the latest DTO', async () => {
    const updateQuery = mutationQuery(1);
    const findQuery = findOneQuery(row);
    mockedDb.mockReturnValueOnce(updateQuery).mockReturnValueOnce(findQuery);

    await expect(
      faqsRepository.update(
        publicId,
        {
          question: 'คำถามใหม่',
          answer: 'คำตอบใหม่',
          category: 'CEMS',
          updatedDate: '2026-09-05',
        },
        42,
      ),
    ).resolves.toMatchObject({ id: publicId });

    expect(updateQuery.where).toHaveBeenCalledWith('public_id', publicId);
    expect(updateQuery.whereNull).toHaveBeenCalledWith('deleted_at');
    expect(updateQuery.update).toHaveBeenCalledWith({
      question: 'คำถามใหม่',
      answer: 'คำตอบใหม่',
      category: 'CEMS',
      updated_date: '2026-09-05',
      updated_at: 'db-now',
      updated_by: 42,
    });
  });

  it('returns null instead of reloading when no active row is updated', async () => {
    mockedDb.mockReturnValue(mutationQuery(0));

    await expect(
      faqsRepository.update(
        publicId,
        {
          question: 'คำถามใหม่',
          answer: 'คำตอบใหม่',
          category: 'CEMS',
          updatedDate: '2026-09-05',
        },
        42,
      ),
    ).resolves.toBeNull();
    expect(mockedDb).toHaveBeenCalledTimes(1);
  });

  it('soft-deletes only an active public id and records the actor', async () => {
    const query = mutationQuery(1);
    mockedDb.mockReturnValue(query);

    await expect(faqsRepository.softDelete(publicId, 42)).resolves.toBe(true);
    expect(query.update).toHaveBeenCalledWith({
      deleted_at: 'db-now',
      updated_at: 'db-now',
      updated_by: 42,
    });
  });

  it('reports when an active row was not available to soft-delete', async () => {
    mockedDb.mockReturnValue(mutationQuery(0));

    await expect(faqsRepository.softDelete(publicId, 42)).resolves.toBe(false);
  });

  it('fails closed when stored category data violates the response contract', async () => {
    mockedDb.mockReturnValue(listQuery([{ ...row, category: 'UNKNOWN' }]));

    await expect(faqsRepository.list()).rejects.toThrow('Stored FAQ category is invalid');
  });
});

function listQuery(rows: unknown[]) {
  const query: Record<string, jest.Mock> & PromiseLike<unknown[]> = {} as never;
  Object.assign(query, {
    whereNull: jest.fn(() => query),
    select: jest.fn(() => query),
    orderBy: jest.fn(() => query),
    then: (resolve: (value: unknown[]) => unknown, reject: (reason: unknown) => unknown) =>
      Promise.resolve(rows).then(resolve, reject),
  });
  return query;
}

function findOneQuery(value: unknown) {
  const query = {
    where: jest.fn().mockReturnThis(),
    whereNull: jest.fn().mockReturnThis(),
    first: jest.fn().mockResolvedValue(value as never),
  };
  return query;
}

function mutationQuery(affectedRows: number) {
  return {
    where: jest.fn().mockReturnThis(),
    whereNull: jest.fn().mockReturnThis(),
    update: jest.fn().mockResolvedValue(affectedRows as never),
  };
}
