import { describe, expect, it, jest } from '@jest/globals';
import type { Knex } from 'knex';
import { createLawsRepository } from '../../src/modules/laws/laws.repository';

const LAW_ID = '28b69ad9-2acf-4b50-961f-84d7a5bea945';

describe('laws repository', () => {
  it('maps public_id and document_type into the frontend-facing record', async () => {
    const query = selectQuery({ rows: [lawRow()] });
    const database = callableDatabase(() => query);
    const repository = createLawsRepository(database);

    await expect(repository.list()).resolves.toEqual([
      {
        id: LAW_ID,
        title: 'ประกาศทดสอบ',
        category: 'CEMS',
        type: 'RULE_AND_ANNOUNCEMENT',
        publishedDate: '2026-09-04',
        fileName: 'law.pdf',
        fileSize: 15,
        mimeType: 'application/pdf',
        storagePath: '.private/laws/2026/09/file.pdf',
        createdAt: '2026-09-04T08:00:00.000Z',
        updatedAt: '2026-09-04T09:00:00.000Z',
      },
    ]);
    expect(query.select).toHaveBeenCalledWith(
      'public_id',
      'title',
      'category',
      'document_type',
      'published_date',
      'original_file_name',
      'mime_type',
      'file_size',
      'storage_path',
      'created_at',
      'updated_at',
    );
    expect(query.whereNull).toHaveBeenCalledWith('deleted_at');
  });

  it('returns null when an active public UUID does not exist', async () => {
    const query = selectQuery({ first: undefined });
    const repository = createLawsRepository(callableDatabase(() => query));

    await expect(repository.findById(LAW_ID)).resolves.toBeNull();
    expect(query.where).toHaveBeenCalledWith('public_id', LAW_ID);
    expect(query.whereNull).toHaveBeenCalledWith('deleted_at');
  });

  it('generates a UUID and persists the exact migration column names on create', async () => {
    const insertQuery = mutationQuery();
    const findQuery = selectQuery({ first: lawRow() });
    const transaction = sequentialExecutor([insertQuery, findQuery]);
    const database = transactionalDatabase(transaction);
    const repository = createLawsRepository(database, () => LAW_ID);

    await repository.create(
      {
        title: 'ประกาศทดสอบ',
        category: 'CEMS',
        type: 'RULE_AND_ANNOUNCEMENT',
        publishedDate: '2026-09-04',
        file: {
          fileName: 'law.pdf',
          fileSize: 15,
          mimeType: 'application/pdf',
          storagePath: '.private/laws/2026/09/file.pdf',
        },
      },
      42,
    );

    expect(insertQuery.insert).toHaveBeenCalledWith({
      public_id: LAW_ID,
      title: 'ประกาศทดสอบ',
      category: 'CEMS',
      document_type: 'RULE_AND_ANNOUNCEMENT',
      published_date: '2026-09-04',
      original_file_name: 'law.pdf',
      mime_type: 'application/pdf',
      file_size: 15,
      storage_path: '.private/laws/2026/09/file.pdf',
      created_by: 42,
      updated_by: 42,
    });
    expect(findQuery.where).toHaveBeenCalledWith('public_id', LAW_ID);
  });

  it('updates audit ownership and replaces file columns only when supplied', async () => {
    const previous = selectQuery({ first: lawRow() });
    const update = mutationQuery({ affected: 1 });
    const current = selectQuery({
      first: lawRow({
        original_file_name: 'replacement.pdf',
        storage_path: '.private/laws/2026/09/replacement.pdf',
      }),
    });
    const transaction = sequentialExecutor([previous, update, current]);
    const repository = createLawsRepository(transactionalDatabase(transaction));

    const result = await repository.update(
      LAW_ID,
      {
        title: 'ประกาศแก้ไข',
        category: 'WPMS',
        type: 'OTHER',
        publishedDate: '2026-09-05',
        file: {
          fileName: 'replacement.pdf',
          fileSize: 20,
          mimeType: 'application/pdf',
          storagePath: '.private/laws/2026/09/replacement.pdf',
        },
      },
      77,
    );

    expect(update.update).toHaveBeenCalledWith({
      title: 'ประกาศแก้ไข',
      category: 'WPMS',
      document_type: 'OTHER',
      published_date: '2026-09-05',
      updated_by: 77,
      updated_at: 'database-now',
      original_file_name: 'replacement.pdf',
      mime_type: 'application/pdf',
      file_size: 20,
      storage_path: '.private/laws/2026/09/replacement.pdf',
    });
    expect(result?.previous.fileName).toBe('law.pdf');
    expect(result?.current.fileName).toBe('replacement.pdf');
  });

  it('preserves file columns for a metadata-only update', async () => {
    const previous = selectQuery({ first: lawRow() });
    const update = mutationQuery({ affected: 1 });
    const current = selectQuery({ first: lawRow({ title: 'ประกาศแก้ไข' }) });
    const transaction = sequentialExecutor([previous, update, current]);
    const repository = createLawsRepository(transactionalDatabase(transaction));

    await repository.update(
      LAW_ID,
      {
        title: 'ประกาศแก้ไข',
        category: 'CEMS',
        type: 'RULE_AND_ANNOUNCEMENT',
        publishedDate: '2026-09-04',
      },
      77,
    );

    const changes = update.update.mock.calls[0][0] as Record<string, unknown>;
    expect(changes).not.toHaveProperty('original_file_name');
    expect(changes).not.toHaveProperty('mime_type');
    expect(changes).not.toHaveProperty('file_size');
    expect(changes).not.toHaveProperty('storage_path');
  });

  it('soft-deletes by public UUID and records the actor', async () => {
    const previous = selectQuery({ first: lawRow() });
    const softDelete = mutationQuery({ affected: 1 });
    const transaction = sequentialExecutor([previous, softDelete]);
    const repository = createLawsRepository(transactionalDatabase(transaction));

    await expect(repository.softDelete(LAW_ID, 88)).resolves.toMatchObject({ id: LAW_ID });
    expect(softDelete.where).toHaveBeenCalledWith('public_id', LAW_ID);
    expect(softDelete.whereNull).toHaveBeenCalledWith('deleted_at');
    expect(softDelete.update).toHaveBeenCalledWith({
      deleted_at: 'database-now',
      updated_at: 'database-now',
      updated_by: 88,
    });
  });
});

function lawRow(overrides: Record<string, unknown> = {}) {
  return {
    public_id: LAW_ID,
    title: 'ประกาศทดสอบ',
    category: 'CEMS',
    document_type: 'RULE_AND_ANNOUNCEMENT',
    published_date: new Date('2026-09-04T00:00:00.000Z'),
    original_file_name: 'law.pdf',
    mime_type: 'application/pdf',
    file_size: '15',
    storage_path: '.private/laws/2026/09/file.pdf',
    created_at: '2026-09-04T08:00:00.000Z',
    updated_at: new Date('2026-09-04T09:00:00.000Z'),
    ...overrides,
  };
}

type Query = ReturnType<typeof baseQuery>;

function baseQuery() {
  const query = {
    select: jest.fn(),
    where: jest.fn(),
    whereNull: jest.fn(),
    orderBy: jest.fn(),
    first: jest.fn(),
    insert: jest.fn(),
    update: jest.fn(),
  };
  query.select.mockReturnValue(query as never);
  query.where.mockReturnValue(query as never);
  query.whereNull.mockReturnValue(query as never);
  query.orderBy.mockReturnValue(query as never);
  return query;
}

function selectQuery(options: {
  rows?: unknown[];
  first?: unknown;
}): Query & PromiseLike<unknown[]> {
  const query = baseQuery() as Query & PromiseLike<unknown[]>;
  query.first.mockResolvedValue(options.first as never);
  query.then = (resolve, reject) => Promise.resolve(options.rows ?? []).then(resolve, reject);
  return query;
}

function mutationQuery(options: { affected?: number } = {}): Query {
  const query = baseQuery();
  query.insert.mockResolvedValue([] as never);
  query.update.mockResolvedValue((options.affected ?? 1) as never);
  return query;
}

function callableDatabase(factory: () => unknown): Knex {
  return Object.assign(jest.fn(factory), {
    transaction: jest.fn(),
  }) as unknown as Knex;
}

function sequentialDatabase(queries: unknown[]): Knex {
  let index = 0;
  return callableDatabase(() => {
    const query = queries[index];
    index += 1;
    if (!query) throw new Error('Unexpected database query');
    return query;
  });
}

function sequentialExecutor(queries: unknown[]): Knex.Transaction {
  const database = sequentialDatabase(queries) as Knex.Transaction;
  database.fn = { now: () => 'database-now' } as unknown as Knex.FunctionHelper;
  return database;
}

function transactionalDatabase(transaction: Knex.Transaction): Knex {
  return Object.assign(jest.fn(), {
    transaction: jest.fn(async (callback: (trx: Knex.Transaction) => Promise<unknown>) =>
      callback(transaction),
    ),
  }) as unknown as Knex;
}
