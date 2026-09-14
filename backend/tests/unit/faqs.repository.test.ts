import { beforeEach, describe, expect, it, jest } from '@jest/globals';

jest.mock('../../src/config/database', () => {
  const connection = Object.assign(jest.fn(), {
    fn: { now: jest.fn(() => 'db-now') },
    transaction: jest.fn(),
  });
  connection.transaction.mockImplementation(async (callback: unknown) =>
    (callback as (db: unknown) => Promise<unknown>)(connection),
  );
  return { db: connection };
});

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
        links: [],
        attachments: [],
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
      'links_json',
      'attachments_json',
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

  it('round trips multiple files and links without exposing private storage paths', async () => {
    const files = [
      storedFile('11111111-1111-4111-8111-111111111111'),
      storedFile('22222222-2222-4222-8222-222222222222'),
    ];
    mockedDb.mockReturnValue(
      listQuery([
        {
          ...row,
          attachments_json: JSON.stringify(files),
          links_json: JSON.stringify(['https://example.com/a', 'https://example.com/b']),
        },
      ]),
    );
    const [result] = await faqsRepository.list();
    expect(result.links).toHaveLength(2);
    expect(result.attachments).toHaveLength(2);
    expect(result.attachments[1].downloadUrl).toBe(
      `/api/v1/faqs/${publicId}/attachments/${files[1].id}`,
    );
    expect(result.attachments[0]).not.toHaveProperty('storagePath');
  });

  it('retains selected files, adds new files and removes omitted files in one update', async () => {
    const first = storedFile('11111111-1111-4111-8111-111111111111');
    const second = storedFile('22222222-2222-4222-8222-222222222222');
    const added = storedFile('33333333-3333-4333-8333-333333333333');
    const previousJson = JSON.stringify([first, second]);
    const mutation = mutationQuery(1);
    mockedDb
      .mockReturnValueOnce(findOneQuery({ ...row, attachments_json: previousJson }))
      .mockReturnValueOnce(mutation)
      .mockReturnValueOnce(
        findOneQuery({ ...row, attachments_json: JSON.stringify([second, added]) }),
      );
    const updated = await faqsRepository.update(
      publicId,
      {
        question: 'Q',
        answer: 'A',
        category: 'OTHER',
        updatedDate: '2026-09-14',
        attachmentIds: [second.id],
        newAttachments: [added],
        links: [],
      },
      42,
    );
    expect(updated?.attachments.map((file) => file.id)).toEqual([second.id, added.id]);
    expect(mutation.where).toHaveBeenCalledWith('attachments_json', previousJson);
    expect(mutation.update).toHaveBeenCalledWith(
      expect.objectContaining({
        attachments_json: JSON.stringify([second, added]),
        links_json: '[]',
      }),
    );
  });

  it('rejects attachment ids from another FAQ before writing', async () => {
    const mutation = mutationQuery(1);
    mockedDb.mockReturnValueOnce(findOneQuery(row)).mockReturnValueOnce(mutation);
    await expect(
      faqsRepository.update(
        publicId,
        {
          question: 'Q',
          answer: 'A',
          category: 'OTHER',
          updatedDate: '2026-09-14',
          attachmentIds: ['11111111-1111-4111-8111-111111111111'],
        },
        42,
      ),
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(mutation.update).not.toHaveBeenCalled();
  });

  it('rejects a concurrent attachment replacement', async () => {
    mockedDb.mockReturnValueOnce(findOneQuery(row)).mockReturnValueOnce(mutationQuery(0));
    await expect(
      faqsRepository.update(
        publicId,
        {
          question: 'Q',
          answer: 'A',
          category: 'OTHER',
          updatedDate: '2026-09-14',
          attachmentIds: [],
        },
        42,
      ),
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it('does not expose a file belonging to a missing or deleted FAQ', async () => {
    mockedDb.mockReturnValue(findOneQuery(undefined));
    await expect(
      faqsRepository.findAttachment(publicId, '11111111-1111-4111-8111-111111111111'),
    ).resolves.toBeUndefined();
  });
});

function storedFile(id: string) {
  return { id, fileName: `${id}.pdf`, fileSize: 12, mimeType: 'application/pdf', storagePath: id };
}

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
