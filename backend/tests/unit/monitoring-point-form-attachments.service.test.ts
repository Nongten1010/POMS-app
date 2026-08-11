import { mkdir, mkdtemp, readFile, readdir, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, jest } from '@jest/globals';
import type { Knex } from 'knex';

jest.mock('../../src/config/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn() },
}));

import {
  buildMonitoringPointAttachmentFileAccess,
  LocalMonitoringPointFormAttachmentStorage,
  resolveMonitoringPointAttachmentStoragePath,
} from '../../src/modules/monitoring-point-forms/monitoring-point-form-attachments.service';

const temporaryDirectories: string[] = [];

describe('monitoring point form attachment storage lifecycle', () => {
  afterEach(async () => {
    await Promise.all(
      temporaryDirectories
        .splice(0)
        .map((directory) => rm(directory, { recursive: true, force: true })),
    );
    jest.restoreAllMocks();
  });

  it('marks stale rows before unlinking and hard-deletes them after file removal', async () => {
    const uploadDir = await temporaryDirectory();
    const storagePath = privateStoragePath('89e74199-30c1-4d46-8ea4-293667a66a23.png');
    const absolutePath = resolveMonitoringPointAttachmentStoragePath(uploadDir, storagePath);
    await mkdir(path.dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, validPng());
    const harness = cleanupDatabase([{ id: 7, storage_path: storagePath }]);
    const storage = createStorage(uploadDir, harness.database);

    await expect(storage.cleanupExpiredAndOrphaned()).resolves.toBe(1);
    await expect(readFile(absolutePath)).rejects.toMatchObject({ code: 'ENOENT' });
    expect(harness.markedRowIds).toEqual([7]);
    expect(harness.hardDeletedRowIds).toEqual([7]);
    expect(harness.markedValues).toMatchObject({
      deleted_at: new Date('2026-08-11T12:00:00.000Z'),
      updated_at: new Date('2026-08-11T12:00:00.000Z'),
    });
  });

  it('keeps a conditionally deleted row for retry when unlink fails', async () => {
    const uploadDir = await temporaryDirectory();
    const storagePath = privateStoragePath('17f0a71c-1390-410d-bc7b-4bd151863230.png');
    const absolutePath = resolveMonitoringPointAttachmentStoragePath(uploadDir, storagePath);
    await mkdir(absolutePath, { recursive: true });
    const harness = cleanupDatabase([{ id: 8, storage_path: storagePath }]);
    const storage = createStorage(uploadDir, harness.database);

    await expect(storage.cleanupExpiredAndOrphaned()).resolves.toBe(0);
    expect(harness.markedRowIds).toEqual([8]);
    expect(harness.hardDeletedRowIds).toEqual([]);

    await expect(storage.cleanupExpiredAndOrphaned()).resolves.toBe(0);
    expect(harness.markedRowIds).toEqual([8, 8]);
    expect(harness.hardDeletedRowIds).toEqual([]);
  });

  it('does not unlink a file when the conditional cleanup update loses a claim race', async () => {
    const uploadDir = await temporaryDirectory();
    const storagePath = privateStoragePath('18172658-a3f1-4f86-8451-6010fbd7baf5.png');
    const absolutePath = resolveMonitoringPointAttachmentStoragePath(uploadDir, storagePath);
    await mkdir(path.dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, validPng());
    const harness = cleanupDatabase([{ id: 9, storage_path: storagePath }], 0);
    const storage = createStorage(uploadDir, harness.database);

    await expect(storage.cleanupExpiredAndOrphaned()).resolves.toBe(0);
    await expect(readFile(absolutePath)).resolves.toEqual(validPng());
    expect(harness.markedRowIds).toEqual([]);
    expect(harness.hardDeletedRowIds).toEqual([]);
    expect(harness.raw).toHaveBeenCalledWith(
      '?? WITH (UPDLOCK, READPAST, ROWLOCK, READCOMMITTEDLOCK)',
      expect.any(Array),
    );
  });

  it('does not write a private file when the pending database insert fails', async () => {
    const uploadDir = await temporaryDirectory();
    const query = chainableQuery({
      insert: jest.fn(async () => {
        throw new Error('database unavailable');
      }),
    });
    const database = attachmentDatabase(query);
    const storage = createStorage(uploadDir, database);
    jest.spyOn(storage, 'cleanupExpiredAndOrphaned').mockResolvedValue(0);

    await expect(storage.save(uploadedPng(), 42)).rejects.toThrow('database unavailable');
    await expect(readdir(path.join(uploadDir, '.private'))).rejects.toMatchObject({
      code: 'ENOENT',
    });
  });

  it('conditionally removes the pending row when writing the private file fails', async () => {
    const temporaryRoot = await temporaryDirectory();
    const uploadDir = path.join(temporaryRoot, 'not-a-directory');
    await writeFile(uploadDir, 'blocks directory creation');
    const query = chainableQuery({
      insert: jest.fn(async () => [1]),
      delete: jest.fn(async () => 1),
      update: jest.fn(async () => 1),
    });
    const database = attachmentDatabase(query);
    const storage = createStorage(uploadDir, database);
    jest.spyOn(storage, 'cleanupExpiredAndOrphaned').mockResolvedValue(0);

    await expect(storage.save(uploadedPng(), 42)).rejects.toMatchObject({ code: 'ENOTDIR' });
    expect(query.insert).toHaveBeenCalledTimes(1);
    expect(query.where).toHaveBeenCalledWith('public_id', expect.any(String));
    expect(query.where).toHaveBeenCalledWith('claim_token_hash', expect.any(Buffer));
    expect(query.whereNull).toHaveBeenCalledWith('monitoring_point_id');
    expect(query.delete).toHaveBeenCalledTimes(1);
    expect(query.update).not.toHaveBeenCalled();
  });

  it('returns a confined file path and metadata without buffering download content', async () => {
    const uploadDir = await temporaryDirectory();
    const publicId = 'a9da52f4-d1a8-4bd0-88b5-7b9211d26e52';
    const storagePath = privateStoragePath('45f804ae-c08e-4cd1-952c-1c3d09e67271.png');
    const absolutePath = resolveMonitoringPointAttachmentStoragePath(uploadDir, storagePath);
    const png = validPng();
    await mkdir(path.dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, png);
    const query = chainableQuery({
      first: jest.fn(async () => ({
        original_file_name: 'stack.png',
        mime_type: 'image/png',
        file_size: png.length,
        storage_path: storagePath,
      })),
    });
    const storage = createStorage(uploadDir, attachmentDatabase(query));
    const access = buildMonitoringPointAttachmentFileAccess(
      publicId,
      new Date('2026-08-11T12:00:00.000Z'),
      {
        apiPrefix: '/api/v1',
        signingSecret: 'test-signing-secret-at-least-16-characters',
      },
    );
    const url = new URL(access.fileUrl, 'http://localhost');

    const content = await storage.getContent(
      publicId,
      url.searchParams.get('expires'),
      url.searchParams.get('signature'),
    );
    const canonicalPath = await realpath(absolutePath);

    expect(content).toMatchObject({
      filePath: canonicalPath,
      fileName: 'stack.png',
      fileType: 'image/png',
      fileSize: png.length,
    });
    expect(content).not.toHaveProperty('buffer');
  });

  it.each([
    '../../etc/passwd',
    '.private/monitoring-point-forms/attachments/../../outside.png',
    '.private\\monitoring-point-forms\\attachments\\2026\\08\\file.png',
    '/absolute/private.png',
  ])('rejects an unsafe stored path: %s', (storagePath) => {
    expect(() => resolveMonitoringPointAttachmentStoragePath('/tmp/uploads', storagePath)).toThrow(
      'Attachment file not found',
    );
  });
});

function createStorage(
  uploadDir: string,
  database: Knex,
): LocalMonitoringPointFormAttachmentStorage {
  return new LocalMonitoringPointFormAttachmentStorage({
    uploadDir,
    signingSecret: 'test-signing-secret-at-least-16-characters',
    apiPrefix: '/api/v1',
    database,
    now: () => new Date('2026-08-11T12:00:00.000Z'),
  });
}

function attachmentDatabase(query: Record<string, unknown>): Knex {
  return Object.assign(
    jest.fn(() => query),
    { transaction: jest.fn() },
  ) as unknown as Knex;
}

function cleanupDatabase(
  candidates: Array<{ id: number; storage_path: string }>,
  markAffectedRows = candidates.length,
): {
  database: Knex;
  markedRowIds: number[];
  hardDeletedRowIds: number[];
  markedValues: Record<string, unknown>;
  raw: jest.Mock<(statement: string, bindings?: unknown[]) => symbol>;
} {
  const markedRowIds: number[] = [];
  const hardDeletedRowIds: number[] = [];
  const markedValues: Record<string, unknown> = {};
  const deletionRetrySelectQuery = chainableQuery({ limit: async () => [] });
  const pendingSelectQuery = chainableQuery({ limit: async () => candidates });
  const orphanSelectQuery = chainableQuery({ limit: async () => [] });
  const markQuery = chainableQuery({
    update: async (values: Record<string, unknown>) => {
      Object.assign(markedValues, values);
      if (markAffectedRows === 1) {
        markedRowIds.push(...candidates.map((candidate) => candidate.id));
      }
      return markAffectedRows;
    },
  });
  const hardDeleteQuery = chainableQuery({
    delete: async () => {
      hardDeletedRowIds.push(...candidates.map((candidate) => candidate.id));
      return candidates.length;
    },
  });
  const pendingSource = Symbol('pending attachments with lock hints');
  const orphanSource = Symbol('orphan attachments with lock hints');
  const raw = jest.fn((statement: string, _bindings?: unknown[]) => {
    if (statement.includes('as ??')) return orphanSource;
    if (statement.includes('UPDLOCK')) return pendingSource;
    return Symbol('other raw query');
  });
  const createTransaction = () => {
    let baseTableCalls = 0;
    return Object.assign(
      jest.fn((tableName: unknown) => {
        if (tableName === pendingSource) return pendingSelectQuery;
        if (String(tableName).includes(' as attachment')) return orphanSelectQuery;
        if (baseTableCalls++ === 0) return deletionRetrySelectQuery;
        return markQuery;
      }),
      { raw },
    );
  };
  const database = Object.assign(
    jest.fn(() => hardDeleteQuery),
    {
      transaction: jest.fn(async (callback: (transaction: unknown) => Promise<unknown>) =>
        callback(createTransaction()),
      ),
    },
  ) as unknown as Knex;
  return { database, markedRowIds, hardDeletedRowIds, markedValues, raw };
}

function chainableQuery(overrides: Record<string, unknown>): Record<string, unknown> {
  const query: Record<string, unknown> = {};
  for (const method of [
    'leftJoin',
    'innerJoin',
    'select',
    'from',
    'where',
    'whereNull',
    'whereNotNull',
    'whereNotExists',
    'whereRaw',
    'whereIn',
    'orWhere',
    'orWhereNotNull',
    'orderBy',
    'limit',
  ]) {
    query[method] = jest.fn(() => query);
  }
  Object.assign(query, overrides);
  return query;
}

async function temporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(path.join(tmpdir(), 'poms-attachment-storage-'));
  temporaryDirectories.push(directory);
  return directory;
}

function privateStoragePath(fileName: string): string {
  return `.private/monitoring-point-forms/attachments/2026/08/${fileName}`;
}

function uploadedPng() {
  const buffer = validPng();
  return {
    buffer,
    originalName: 'stack.png',
    mimeType: 'image/png',
    size: buffer.length,
  };
}

function validPng(): Buffer {
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    Buffer.from('image!'),
  ]);
}
