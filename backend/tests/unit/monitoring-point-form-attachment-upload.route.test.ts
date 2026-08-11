import { EventEmitter } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import type { NextFunction, Request, Response } from 'express';

jest.mock('../../src/config/database', () => ({
  db: Object.assign(jest.fn(), { transaction: jest.fn() }),
}));

import { createApp } from '../../src/app';
import { db } from '../../src/config/database';
import { env } from '../../src/config/env';
import {
  buildMonitoringPointAttachmentFileAccess,
  LocalMonitoringPointFormAttachmentStorage,
  type MonitoringPointAttachmentRow,
} from '../../src/modules/monitoring-point-forms/monitoring-point-form-attachments.service';
import { createMonitoringPointAttachmentUploadConcurrencyLimiter } from '../../src/modules/monitoring-point-forms/monitoring-point-forms.routes';
import { signAccessToken } from '../../src/shared/utils/jwt';

const mockedDb = db as unknown as jest.Mock<(...args: unknown[]) => unknown> & {
  transaction: jest.Mock<(...args: unknown[]) => Promise<unknown>>;
};
const insertedRows: MonitoringPointAttachmentRow[] = [];
let currentActorUserId = 41;
const cleanupSpy = jest
  .spyOn(LocalMonitoringPointFormAttachmentStorage.prototype, 'cleanupExpiredAndOrphaned')
  .mockResolvedValue(0);

describe('monitoring point form attachment upload route', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    insertedRows.splice(0);
    currentActorUserId += 1;
    cleanupSpy.mockResolvedValue(0);
    mockedDb.mockImplementation(createAttachmentQuery);
  });

  async function withTempUploadDir<T>(callback: (uploadDir: string) => Promise<T>): Promise<T> {
    const previousUploadDir = env.UPLOAD_DIR;
    const uploadDir = await mkdtemp(path.join(tmpdir(), 'poms-monitoring-point-attachment-'));
    env.UPLOAD_DIR = uploadDir;

    try {
      return await callback(uploadDir);
    } finally {
      env.UPLOAD_DIR = previousUploadDir;
      await rm(uploadDir, { recursive: true, force: true });
    }
  }

  function accessToken(
    scopes: Record<string, string> = { 'cems_wpms_requests:edit': 'OWN_FACTORY' },
  ): string {
    return signAccessToken({
      sub: String(currentActorUserId),
      userType: 'operator',
      roles: ['factory_operator'],
      scopes,
    });
  }

  it('stores one valid file as a pending private upload and returns a claim token', async () => {
    await withTempUploadDir(async () => {
      const pngBuffer = validPng();
      const beforeUpload = Date.now();

      const response = await request(createApp())
        .post('/api/v1/monitoring-point-forms/attachments')
        .set('Authorization', `Bearer ${accessToken()}`)
        .attach('file', pngBuffer, {
          filename: 'stack.png',
          contentType: 'image/png',
        });

      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        success: true,
        data: {
          fileName: 'stack.png',
          fileType: 'image/png',
          fileSize: pngBuffer.length,
        },
      });
      expect(response.body.data.uploadToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
      expect(Date.parse(response.body.data.expiresAt)).toBeGreaterThanOrEqual(
        beforeUpload + 60 * 60 * 1000 - 1000,
      );
      expect(Object.keys(response.body.data).sort()).toEqual(
        ['expiresAt', 'fileName', 'fileSize', 'fileType', 'uploadToken'].sort(),
      );

      expect(insertedRows).toHaveLength(1);
      expect(insertedRows[0]).toMatchObject({
        monitoring_point_id: null,
        original_file_name: 'stack.png',
        mime_type: 'image/png',
        file_size: pngBuffer.length,
        sort_order: null,
        claimed_at: null,
        created_by: 42,
        updated_by: 42,
      });
      expect(insertedRows[0].claim_token_hash).toHaveLength(32);
      expect(insertedRows[0].storage_path).toMatch(
        /^\.private\/monitoring-point-forms\/attachments\/\d{4}\/\d{2}\/[a-f0-9-]+\.png$/,
      );
    });
  });

  it('does not expose a pending private file through the static uploads route', async () => {
    await withTempUploadDir(async () => {
      const app = createApp();
      const uploadResponse = await request(app)
        .post('/api/v1/monitoring-point-forms/attachments')
        .set('Authorization', `Bearer ${accessToken()}`)
        .attach('file', validPng(), { filename: 'private.png', contentType: 'image/png' });
      expect(uploadResponse.status).toBe(201);

      const directResponse = await request(app).get(
        `${env.UPLOAD_PUBLIC_PATH}/${insertedRows[0].storage_path}`,
      );
      expect(directResponse.status).toBe(404);
      expect(directResponse.body).not.toEqual(validPng());
    });
  });

  it('serves a claimed file through a valid signed public route with no-store headers', async () => {
    await withTempUploadDir(async () => {
      const app = createApp();
      const pngBuffer = validPng();
      const uploadResponse = await request(app)
        .post('/api/v1/monitoring-point-forms/attachments')
        .set('Authorization', `Bearer ${accessToken()}`)
        .attach('file', pngBuffer, { filename: 'stack.png', contentType: 'image/png' });
      expect(uploadResponse.status).toBe(201);

      claimInsertedAttachment();
      const access = buildMonitoringPointAttachmentFileAccess(insertedRows[0].public_id);
      const response = await request(app).get(access.fileUrl);

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toMatch(/^image\/png/);
      expect(response.headers['content-disposition']).toContain('inline;');
      expect(response.headers['cache-control']).toBe('private, no-store, max-age=0');
      expect(response.headers.pragma).toBe('no-cache');
      expect(response.headers['referrer-policy']).toBe('no-referrer');
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.body).toEqual(pngBuffer);
    });
  });

  it('never serves a pending file even when presented with a valid signed URL', async () => {
    await withTempUploadDir(async () => {
      const app = createApp();
      await request(app)
        .post('/api/v1/monitoring-point-forms/attachments')
        .set('Authorization', `Bearer ${accessToken()}`)
        .attach('file', validPng(), { filename: 'pending.png', contentType: 'image/png' });

      const access = buildMonitoringPointAttachmentFileAccess(insertedRows[0].public_id);
      const response = await request(app).get(access.fileUrl);
      expect(response.status).toBe(404);
    });
  });

  it('checks a tampered signature before reporting that its timestamp is expired', async () => {
    const publicId = 'a9da52f4-d1a8-4bd0-88b5-7b9211d26e52';
    const expired = Math.floor(Date.now() / 1000) - 60;
    const response = await request(createApp()).get(
      `/api/v1/monitoring-point-forms/attachments/${publicId}/content?expires=${expired}&signature=${'A'.repeat(43)}`,
    );

    expect(response.status).toBe(403);
    expect(response.body.error.code).toBe('FORBIDDEN');
  });

  it('returns a dedicated gone error for a correctly signed expired URL', async () => {
    const publicId = 'a9da52f4-d1a8-4bd0-88b5-7b9211d26e52';
    const access = buildMonitoringPointAttachmentFileAccess(
      publicId,
      new Date(Date.now() - 2 * 60 * 60 * 1000),
    );
    const response = await request(createApp()).get(access.fileUrl);

    expect(response.status).toBe(410);
    expect(response.body.error.code).toBe('ATTACHMENT_URL_EXPIRED');
  });

  it('rejects a database storage path that escapes the private attachment root', async () => {
    await withTempUploadDir(async () => {
      const app = createApp();
      await request(app)
        .post('/api/v1/monitoring-point-forms/attachments')
        .set('Authorization', `Bearer ${accessToken()}`)
        .attach('file', validPng(), { filename: 'stack.png', contentType: 'image/png' });
      claimInsertedAttachment();
      insertedRows[0].storage_path = '../../etc/passwd';

      const access = buildMonitoringPointAttachmentFileAccess(insertedRows[0].public_id);
      const response = await request(app).get(access.fileUrl);
      expect(response.status).toBe(404);
    });
  });

  it('requires authentication and cems_wpms_requests:edit permission', async () => {
    await withTempUploadDir(async () => {
      const anonymousResponse = await request(createApp()).post(
        '/api/v1/monitoring-point-forms/attachments',
      );
      expect(anonymousResponse.status).toBe(401);

      const forbiddenResponse = await request(createApp())
        .post('/api/v1/monitoring-point-forms/attachments')
        .set('Authorization', `Bearer ${accessToken({})}`);
      expect(forbiddenResponse.status).toBe(403);
    });
  });

  it('rate-limits attachment uploads per authenticated actor before multipart buffering', async () => {
    await withTempUploadDir(async () => {
      const app = createApp();
      const token = accessToken();
      for (let attempt = 0; attempt < 20; attempt += 1) {
        const response = await request(app)
          .post('/api/v1/monitoring-point-forms/attachments')
          .set('Authorization', `Bearer ${token}`)
          .attach('file', validPng(), {
            filename: `stack-${attempt}.png`,
            contentType: 'image/png',
          });
        expect(response.status).toBe(201);
      }

      const limitedResponse = await request(app)
        .post('/api/v1/monitoring-point-forms/attachments')
        .set('Authorization', `Bearer ${token}`)
        .attach('file', validPng(), { filename: 'blocked.png', contentType: 'image/png' });

      expect(limitedResponse.status).toBe(429);
      expect(limitedResponse.body).toMatchObject({
        success: false,
        error: { code: 'RATE_LIMITED' },
      });
      expect(insertedRows).toHaveLength(20);
    });
  });

  it('caps process-wide concurrent uploads at four and releases slots after responses finish', async () => {
    const pendingResolvers: Array<
      (value: {
        uploadToken: string;
        fileName: string;
        fileType: 'image/png';
        fileSize: number;
        expiresAt: string;
      }) => void
    > = [];
    const storedUpload = {
      uploadToken: 'A'.repeat(43),
      fileName: 'stack.png',
      fileType: 'image/png' as const,
      fileSize: validPng().length,
      expiresAt: '2026-08-11T13:00:00.000Z',
    };
    const saveSpy = jest
      .spyOn(LocalMonitoringPointFormAttachmentStorage.prototype, 'save')
      .mockImplementation(
        () =>
          new Promise((resolve) => {
            pendingResolvers.push(resolve);
          }),
      );

    try {
      await withTempUploadDir(async () => {
        const app = createApp();
        const token = accessToken();
        const activeRequests = Array.from({ length: 4 }, (_, index) =>
          request(app)
            .post('/api/v1/monitoring-point-forms/attachments')
            .set('Authorization', `Bearer ${token}`)
            .attach('file', validPng(), {
              filename: `active-${index}.png`,
              contentType: 'image/png',
            })
            .then((response) => response),
        );
        await waitFor(() => saveSpy.mock.calls.length === 4);

        const blockedResponse = await request(app)
          .post('/api/v1/monitoring-point-forms/attachments')
          .set('Authorization', `Bearer ${token}`)
          .attach('file', validPng(), { filename: 'blocked.png', contentType: 'image/png' });

        expect(blockedResponse.status).toBe(429);
        expect(blockedResponse.headers['retry-after']).toBe('1');
        expect(blockedResponse.body).toEqual({
          success: false,
          error: {
            code: 'RATE_LIMITED',
            message: 'Too many concurrent attachment uploads. Please try again shortly.',
          },
        });
        expect(saveSpy).toHaveBeenCalledTimes(4);

        saveSpy.mockResolvedValue(storedUpload);
        pendingResolvers.forEach((resolve) => resolve(storedUpload));
        const completedResponses = await Promise.all(activeRequests);
        expect(completedResponses.map((response) => response.status)).toEqual([201, 201, 201, 201]);

        const releasedResponse = await request(app)
          .post('/api/v1/monitoring-point-forms/attachments')
          .set('Authorization', `Bearer ${token}`)
          .attach('file', validPng(), { filename: 'released.png', contentType: 'image/png' });
        expect(releasedResponse.status).toBe(201);
        expect(saveSpy).toHaveBeenCalledTimes(5);
      });
    } finally {
      saveSpy.mockRestore();
    }
  });

  it('releases a concurrent upload slot exactly once when the response closes before finish', () => {
    const limiter = createMonitoringPointAttachmentUploadConcurrencyLimiter(1);
    const requestStub = {} as Request;
    const firstResponse = fakeResponse();
    const firstNext = jest.fn();
    limiter(requestStub, firstResponse as unknown as Response, firstNext as NextFunction);
    expect(firstNext).toHaveBeenCalledTimes(1);

    const blockedResponse = fakeResponse();
    limiter(requestStub, blockedResponse as unknown as Response, jest.fn());
    expect(blockedResponse.status).toHaveBeenCalledWith(429);

    firstResponse.emit('close');
    const replacementResponse = fakeResponse();
    const replacementNext = jest.fn();
    limiter(
      requestStub,
      replacementResponse as unknown as Response,
      replacementNext as NextFunction,
    );
    expect(replacementNext).toHaveBeenCalledTimes(1);

    firstResponse.emit('finish');
    const stillBlockedResponse = fakeResponse();
    limiter(requestStub, stillBlockedResponse as unknown as Response, jest.fn());
    expect(stillBlockedResponse.status).toHaveBeenCalledWith(429);

    replacementResponse.emit('finish');
    const finalResponse = fakeResponse();
    const finalNext = jest.fn();
    limiter(requestStub, finalResponse as unknown as Response, finalNext as NextFunction);
    expect(finalNext).toHaveBeenCalledTimes(1);
    finalResponse.emit('finish');
  });

  it('truncates a long original name to a form-compatible length while preserving extension', async () => {
    await withTempUploadDir(async () => {
      const response = await request(createApp())
        .post('/api/v1/monitoring-point-forms/attachments')
        .set('Authorization', `Bearer ${accessToken()}`)
        .attach('file', validPng(), {
          filename: `${'a'.repeat(300)}.png`,
          contentType: 'image/png',
        });

      expect(response.status).toBe(201);
      expect(response.body.data.fileName).toHaveLength(255);
      expect(response.body.data.fileName).toMatch(/\.png$/);
    });
  });

  it('rejects unsupported file types', async () => {
    await withTempUploadDir(async () => {
      const response = await request(createApp())
        .post('/api/v1/monitoring-point-forms/attachments')
        .set('Authorization', `Bearer ${accessToken()}`)
        .attach('file', Buffer.from('executable'), {
          filename: 'payload.exe',
          contentType: 'application/x-msdownload',
        });

      expect(response.status).toBe(400);
      expect(response.body.error.message).toBe('Unsupported file type');
    });
  });

  it.each([
    {
      caseName: 'extension',
      fileName: 'disguised.pdf',
      mimeType: 'image/png',
      buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      expectedMessage: 'Unsupported file extension',
    },
    {
      caseName: 'signature',
      fileName: 'disguised.png',
      mimeType: 'image/png',
      buffer: Buffer.from('%PDF-1.7'),
      expectedMessage: 'Uploaded file content does not match its declared type',
    },
  ])('rejects a file whose declared type does not match its $caseName', async (testCase) => {
    await withTempUploadDir(async () => {
      const response = await request(createApp())
        .post('/api/v1/monitoring-point-forms/attachments')
        .set('Authorization', `Bearer ${accessToken()}`)
        .attach('file', testCase.buffer, {
          filename: testCase.fileName,
          contentType: testCase.mimeType,
        });

      expect(response.status).toBe(400);
      expect(response.body.error.message).toBe(testCase.expectedMessage);
    });
  });

  it('rejects a file above 10 MB', async () => {
    await withTempUploadDir(async () => {
      const oversizedPng = Buffer.alloc(10 * 1024 * 1024 + 1, 0);
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(oversizedPng);

      const response = await request(createApp())
        .post('/api/v1/monitoring-point-forms/attachments')
        .set('Authorization', `Bearer ${accessToken()}`)
        .attach('file', oversizedPng, {
          filename: 'oversized.png',
          contentType: 'image/png',
        });

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'UPLOAD_ERROR',
          details: { reason: 'LIMIT_FILE_SIZE' },
        },
      });
    });
  });

  it('rejects a multipart request without a file', async () => {
    const response = await request(createApp())
      .post('/api/v1/monitoring-point-forms/attachments')
      .set('Authorization', `Bearer ${accessToken()}`);

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      success: false,
      error: { code: 'BAD_REQUEST', message: 'Attachment file is required' },
    });
  });

  it('rejects multipart text fields outside the file-only contract', async () => {
    const response = await request(createApp())
      .post('/api/v1/monitoring-point-forms/attachments')
      .set('Authorization', `Bearer ${accessToken()}`)
      .field('description', 'not allowed')
      .attach('file', validJpeg(), { filename: 'stack.jpg', contentType: 'image/jpeg' });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({
      success: false,
      error: { code: 'UPLOAD_ERROR', details: { reason: 'LIMIT_FIELD_COUNT' } },
    });
  });

  it('rejects more than one file in the same request', async () => {
    const response = await request(createApp())
      .post('/api/v1/monitoring-point-forms/attachments')
      .set('Authorization', `Bearer ${accessToken()}`)
      .attach('file', validJpeg(), { filename: 'one.jpg', contentType: 'image/jpeg' })
      .attach('file', validJpeg(), { filename: 'two.jpg', contentType: 'image/jpeg' });

    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({ success: false, error: { code: 'UPLOAD_ERROR' } });
  });
});

function createAttachmentQuery(tableName: unknown): unknown {
  const name = String(tableName);
  if (name === 'factory_monitoring_point_attachments') {
    const query = {
      insert: jest.fn(async (input: Record<string, unknown>) => {
        insertedRows.push({
          id: insertedRows.length + 1,
          ...input,
          created_at: new Date(),
          updated_at: new Date(),
          deleted_at: null,
        } as MonitoringPointAttachmentRow);
        return [insertedRows.length];
      }),
    };
    return query;
  }
  if (name === 'factory_monitoring_point_attachments as attachment') {
    let requestedPublicId: unknown;
    const query = {
      innerJoin: jest.fn(() => query),
      select: jest.fn(() => query),
      where: jest.fn((column: string, value: unknown) => {
        if (column === 'attachment.public_id') requestedPublicId = value;
        return query;
      }),
      whereNotNull: jest.fn(() => query),
      whereNull: jest.fn(() => query),
      first: jest.fn(async () => {
        const row = insertedRows.find(
          (candidate) =>
            candidate.public_id === requestedPublicId &&
            candidate.monitoring_point_id !== null &&
            candidate.claimed_at !== null &&
            candidate.deleted_at === null,
        );
        return row
          ? {
              original_file_name: row.original_file_name,
              mime_type: row.mime_type,
              file_size: row.file_size,
              storage_path: row.storage_path,
            }
          : undefined;
      }),
    };
    return query;
  }
  throw new Error(`Unexpected attachment query table: ${name}`);
}

function claimInsertedAttachment(): void {
  insertedRows[0].monitoring_point_id = 101;
  insertedRows[0].sort_order = 1;
  insertedRows[0].claimed_at = new Date();
}

function validPng(): Buffer {
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    Buffer.from('image!'),
  ]);
}

function validJpeg(): Buffer {
  return Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
}

async function waitFor(predicate: () => boolean): Promise<void> {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (predicate()) return;
    await new Promise<void>((resolve) => setImmediate(resolve));
  }
  throw new Error('Timed out waiting for concurrent upload requests');
}

function fakeResponse() {
  const response = Object.assign(new EventEmitter(), {
    setHeader: jest.fn(),
    status: jest.fn(),
    json: jest.fn(),
  });
  response.status.mockImplementation(() => response);
  response.json.mockImplementation(() => response);
  return response;
}
