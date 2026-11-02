import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { createApp } from '../../src/app';
import { env } from '../../src/config/env';
import { logger } from '../../src/config/logger';
import { signTestAccessToken } from '../helpers/live-authorization-fixture';
import { pdfFixture } from '../helpers/pdf-fixture';

describe('failed upload diagnostics', () => {
  beforeEach(() => {
    jest.spyOn(logger, 'warn').mockImplementation(() => logger);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  function accessToken(): string {
    return signTestAccessToken({
      sub: '42',
      userType: 'operator',
      roles: ['operator'],
      scopes: {
        'cems_wpms_requests:edit': 'OWN_FACTORY',
        'factories:edit': 'OWN_FACTORY',
        'faq:edit': null,
        'laws:edit': null,
      },
    });
  }

  async function withUploadDirectory(callback: () => Promise<void>): Promise<void> {
    const previousUploadDir = env.UPLOAD_DIR;
    const previousPublicBaseUrl = env.PUBLIC_BASE_URL;
    const uploadDir = await mkdtemp(path.join(tmpdir(), 'poms-upload-diagnostics-'));
    env.UPLOAD_DIR = uploadDir;
    env.PUBLIC_BASE_URL = undefined;
    try {
      await callback();
    } finally {
      env.UPLOAD_DIR = previousUploadDir;
      env.PUBLIC_BASE_URL = previousPublicBaseUrl;
      await rm(uploadDir, { recursive: true, force: true });
    }
  }

  it('records metadata rejection without logging private filenames, tokens or fields', async () => {
    const token = accessToken();
    const response = await request(createApp())
      .post('/api/v1/cems-wpms-requests/document-images?token=private-query-token')
      .set('Authorization', `Bearer ${token}`)
      .set('Cookie', 'session=private-cookie')
      .field('title', 'private-factory-title')
      .attach('file', Buffer.from('MZ private-file-contents'), {
        filename: 'private-factory-owner.exe',
        contentType: 'application/x-msdownload',
      });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('BAD_REQUEST');
    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(logger.warn).toHaveBeenCalledWith(
      'upload.rejected',
      expect.objectContaining({
        event: 'upload.rejected',
        endpoint: '/api/v1/cems-wpms-requests/document-images',
        method: 'POST',
        status: 400,
        reasonCode: 'BLOCKED_FILE_TYPE',
        fileExtension: '.exe',
        fileSize: null,
        fileCount: 1,
        declaredRequestBytes: expect.any(Number),
      }),
    );
    const captured = JSON.stringify(jest.mocked(logger.warn).mock.calls);
    for (const secret of [
      token,
      'private-query-token',
      'private-cookie',
      'private-factory-title',
      'private-file-contents',
      'private-factory-owner',
    ]) {
      expect(captured).not.toContain(secret);
    }
  });

  it('records a file-size limit with its file type before Multer removes the buffer', async () => {
    const response = await request(createApp())
      .post('/api/v1/cems-wpms-requests/document-images')
      .set('Authorization', `Bearer ${accessToken()}`)
      .attach('file', Buffer.alloc(5 * 1024 * 1024 + 1, 65), {
        filename: 'oversized-private-document.pdf',
        contentType: 'application/pdf',
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toMatchObject({
      code: 'UPLOAD_ERROR',
      details: { reason: 'LIMIT_FILE_SIZE' },
    });
    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(logger.warn).toHaveBeenCalledWith(
      'upload.rejected',
      expect.objectContaining({
        reasonCode: 'LIMIT_FILE_SIZE',
        fileExtension: '.pdf',
        declaredMimeType: 'application/pdf',
        declaredRequestBytes: expect.any(Number),
      }),
    );
  });

  it('records the structural PDF rejection and the received file size', async () => {
    const contents = pdfFixture({
      catalogEntries: '/OpenAction << /S /JavaScript /JS (void\\(0\\)) >>',
    });
    const response = await request(createApp())
      .post('/api/v1/cems-wpms-requests/document-images')
      .set('Authorization', `Bearer ${accessToken()}`)
      .attach('file', contents, {
        filename: 'private-document.pdf',
        contentType: 'application/pdf',
      });

    expect(response.status).toBe(400);
    expect(response.body.error.message).toBe(
      'PDF active content or embedded files are not allowed',
    );
    expect(logger.warn).toHaveBeenCalledWith(
      'upload.rejected',
      expect.objectContaining({ reasonCode: 'PDF_ACTIVE_CONTENT', fileSize: contents.length }),
    );
    expect(JSON.stringify(jest.mocked(logger.warn).mock.calls)).not.toContain('private-document');
  });

  it('observes the custom factory upload error without changing its envelope', async () => {
    const response = await request(createApp())
      .post('/api/v1/poms-factories/document-images')
      .set('Authorization', `Bearer ${accessToken()}`)
      .attach('file', Buffer.alloc(5 * 1024 * 1024 + 1, 65), {
        filename: 'private-factory.jpg',
        contentType: 'image/jpeg',
      });

    expect(response.status).toBe(400);
    expect(response.body.error).toEqual({
      code: 'FILE_UPLOAD_FAILED',
      message: 'ไม่สามารถอัปโหลดไฟล์ได้',
      details: { field: 'file', reason: 'LIMIT_FILE_SIZE' },
    });
    expect(logger.warn).toHaveBeenCalledWith(
      'upload.rejected',
      expect.objectContaining({
        endpoint: '/api/v1/poms-factories/document-images',
        reasonCode: 'LIMIT_FILE_SIZE',
        fileExtension: '.jpg',
        declaredMimeType: 'image/jpeg',
      }),
    );
  });

  it('keeps the law validation envelope and normalizes the resource id in its log', async () => {
    const response = await request(createApp())
      .put('/api/v1/laws/private-resource-id')
      .set('Authorization', `Bearer ${accessToken()}`)
      .attach('file', Buffer.from('MZ'), {
        filename: 'private-law.exe',
        contentType: 'application/x-msdownload',
      });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(logger.warn).toHaveBeenCalledWith(
      'upload.rejected',
      expect.objectContaining({ endpoint: '/api/v1/laws/:id', reasonCode: 'BLOCKED_FILE_TYPE' }),
    );
    expect(JSON.stringify(jest.mocked(logger.warn).mock.calls)).not.toContain(
      'private-resource-id',
    );
  });

  it('keeps FAQ validation and records bounded metadata for the multipart file list', async () => {
    const response = await request(createApp())
      .post('/api/v1/faqs')
      .set('Authorization', `Bearer ${accessToken()}`)
      .field('question', 'Question')
      .field('answer', 'Answer')
      .field('category', 'CEMS')
      .field('updatedDate', '2026-11-02')
      .attach('files', Buffer.from('ordinary notes'), {
        filename: 'private-notes.txt',
        contentType: 'text/plain',
      })
      .attach('files', Buffer.from('MZ'), {
        filename: 'private-faq.exe',
        contentType: 'application/x-msdownload',
      });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(logger.warn).toHaveBeenCalledWith(
      'upload.rejected',
      expect.objectContaining({
        endpoint: '/api/v1/faqs',
        reasonCode: 'BLOCKED_FILE_TYPE',
        fileExtension: null,
        fileCount: 2,
        files: [
          expect.objectContaining({ fileExtension: '.txt', declaredMimeType: 'text/plain' }),
          expect.objectContaining({ fileExtension: '.exe' }),
        ],
      }),
    );
    expect(JSON.stringify(jest.mocked(logger.warn).mock.calls)).not.toContain('private-faq');
  });

  it('does not log successful uploads', async () => {
    await withUploadDirectory(async () => {
      const response = await request(createApp())
        .post('/api/v1/cems-wpms-requests/document-images')
        .set('Authorization', `Bearer ${accessToken()}`)
        .attach('file', Buffer.from('ordinary notes'), {
          filename: 'notes.txt',
          contentType: 'text/plain',
        });
      expect(response.status).toBe(201);
      expect(logger.warn).not.toHaveBeenCalled();
    });
  });

  it('does not log failures from unrelated endpoints', async () => {
    const response = await request(createApp()).post('/api/v1/not-an-upload').send({
      privateField: 'private-body-value',
    });
    expect(response.status).toBe(404);
    expect(logger.warn).not.toHaveBeenCalled();
  });
});
