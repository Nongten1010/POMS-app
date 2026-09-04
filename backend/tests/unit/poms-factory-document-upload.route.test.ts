import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from '@jest/globals';
import request from 'supertest';
import { createApp } from '../../src/app';
import { env } from '../../src/config/env';
import { signAccessToken } from '../../src/shared/utils/jwt';

describe('POMS factory document image upload route', () => {
  async function withTempUploadDir<T>(callback: (uploadDir: string) => Promise<T>): Promise<T> {
    const previousUploadDir = env.UPLOAD_DIR;
    const previousPublicBaseUrl = env.PUBLIC_BASE_URL;
    const uploadDir = await mkdtemp(path.join(tmpdir(), 'poms-factory-upload-route-test-'));
    env.UPLOAD_DIR = uploadDir;
    env.PUBLIC_BASE_URL = undefined;

    try {
      return await callback(uploadDir);
    } finally {
      env.UPLOAD_DIR = previousUploadDir;
      env.PUBLIC_BASE_URL = previousPublicBaseUrl;
      await rm(uploadDir, { recursive: true, force: true });
    }
  }

  function accessToken(
    scopes: Record<string, string> = { 'factories:edit': 'OWN_FACTORY' },
  ): string {
    return signAccessToken({
      sub: '42',
      userType: 'operator',
      roles: ['factory_operator'],
      scopes,
    });
  }

  it('uploads one file and returns reusable metadata with an absolute URL', async () => {
    await withTempUploadDir(async () => {
      const pngBuffer = Buffer.concat([
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        Buffer.from('image!'),
      ]);

      const response = await request(createApp())
        .post('/api/v1/poms-factories/document-images')
        .set('Authorization', `Bearer ${accessToken()}`)
        .field('title', 'ภาพถ่ายหน้าโรงงาน')
        .field('description', '')
        .field('link', 'https://example.com/factory-reference')
        .attach('file', pngBuffer, {
          filename: 'factory-front.png',
          contentType: 'image/png',
        });

      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        success: true,
        data: {
          title: 'ภาพถ่ายหน้าโรงงาน',
          description: null,
          link: 'https://example.com/factory-reference',
          fileName: 'factory-front.png',
          fileType: 'image/png',
          fileSize: pngBuffer.length,
        },
      });
      expect(response.body.data.fileUrl).toMatch(
        /^http:\/\/127\.0\.0\.1:\d+\/uploads\/cems-wpms\/document-images\/\d{4}\/\d{2}\/[a-f0-9-]+\.png$/,
      );
      expect(() => new URL(response.body.data.fileUrl)).not.toThrow();
      expect(response.body.data).not.toHaveProperty('storageKey');
    });
  });

  it('requires factories:edit permission', async () => {
    await withTempUploadDir(async () => {
      const response = await request(createApp())
        .post('/api/v1/poms-factories/document-images')
        .set('Authorization', `Bearer ${accessToken({ 'factories:view': 'ALL' })}`)
        .attach('file', Buffer.from('not-processed'), {
          filename: 'factory-front.png',
          contentType: 'image/png',
        });

      expect(response.status).toBe(403);
      expect(response.body.error.code).toBe('FORBIDDEN');
    });
  });

  it('requires the multipart file even when a link is provided', async () => {
    await withTempUploadDir(async () => {
      const response = await request(createApp())
        .post('/api/v1/poms-factories/document-images')
        .set('Authorization', `Bearer ${accessToken()}`)
        .field('link', 'https://example.com/factory-reference');

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'BAD_REQUEST',
          message: 'file is required',
        },
      });
    });
  });

  it('keeps unsupported file validation as BAD_REQUEST', async () => {
    await withTempUploadDir(async () => {
      const response = await request(createApp())
        .post('/api/v1/poms-factories/document-images')
        .set('Authorization', `Bearer ${accessToken()}`)
        .attach('file', Buffer.from('bad'), {
          filename: 'payload.exe',
          contentType: 'application/x-msdownload',
        });

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'BAD_REQUEST',
          message: 'Unsupported file type',
        },
      });
    });
  });

  it('rejects metadata that cannot be reused in an edit-request payload before storing the file', async () => {
    await withTempUploadDir(async (uploadDir) => {
      const pngBuffer = Buffer.concat([
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        Buffer.from('image!'),
      ]);
      const response = await request(createApp())
        .post('/api/v1/poms-factories/document-images')
        .set('Authorization', `Bearer ${accessToken()}`)
        .field('title', 'ก'.repeat(256))
        .attach('file', pngBuffer, {
          filename: 'factory-front.png',
          contentType: 'image/png',
        });

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'BAD_REQUEST',
          details: { field: 'title', maxLength: 255 },
        },
      });
      expect(await readdir(uploadDir)).toEqual([]);
    });
  });

  it('rejects multipart metadata fields outside the documented allowlist', async () => {
    await withTempUploadDir(async () => {
      const pngBuffer = Buffer.concat([
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        Buffer.from('image!'),
      ]);
      const response = await request(createApp())
        .post('/api/v1/poms-factories/document-images')
        .set('Authorization', `Bearer ${accessToken()}`)
        .field('unexpected', 'value')
        .attach('file', pngBuffer, {
          filename: 'factory-front.png',
          contentType: 'image/png',
        });

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'BAD_REQUEST',
          message: 'Unsupported multipart field',
          details: { field: 'unexpected' },
        },
      });
    });
  });

  it('maps the route-scoped over-limit error to FILE_UPLOAD_FAILED', async () => {
    await withTempUploadDir(async () => {
      const response = await request(createApp())
        .post('/api/v1/poms-factories/document-images')
        .set('Authorization', `Bearer ${accessToken()}`)
        .attach('file', Buffer.alloc(5 * 1024 * 1024 + 1, 1), {
          filename: 'factory-front.png',
          contentType: 'image/png',
        });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        success: false,
        error: {
          code: 'FILE_UPLOAD_FAILED',
          message: 'ไม่สามารถอัปโหลดไฟล์ได้',
          details: {
            field: 'file',
            reason: 'LIMIT_FILE_SIZE',
          },
        },
      });
    });
  });
});
