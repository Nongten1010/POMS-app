import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { describe, expect, it } from '@jest/globals';
import { createApp } from '../../src/app';
import { env } from '../../src/config/env';
import { signAccessToken } from '../../src/shared/utils/jwt';

describe('connection request document image upload route', () => {
  async function withTempUploadDir<T>(callback: (uploadDir: string) => Promise<T>): Promise<T> {
    const previousUploadDir = env.UPLOAD_DIR;
    const uploadDir = await mkdtemp(path.join(tmpdir(), 'poms-upload-route-test-'));
    env.UPLOAD_DIR = uploadDir;
    env.PUBLIC_BASE_URL = undefined;

    try {
      return await callback(uploadDir);
    } finally {
      env.UPLOAD_DIR = previousUploadDir;
      await rm(uploadDir, { recursive: true, force: true });
    }
  }

  function accessToken(): string {
    return signAccessToken({
      sub: '42',
      userType: 'operator',
      roles: ['operator'],
      scopes: {
        'cems_wpms_requests:edit': 'OWN_FACTORY',
      },
    });
  }

  it('accepts multipart file uploads and returns document metadata for form submission', async () => {
    await withTempUploadDir(async () => {
      const app = createApp();
      const pngBuffer = Buffer.concat([
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
        Buffer.from('image!'),
      ]);

      const response = await request(app)
        .post('/api/v1/cems-wpms-requests/document-images')
        .set('Authorization', `Bearer ${accessToken()}`)
        .field('title', 'ภาพถ่ายปล่อง')
        .field('description', '')
        .field('link', 'https://example.com/stack-reference.pdf')
        .attach('file', pngBuffer, {
          filename: 'stack.png',
          contentType: 'image/png',
        });

      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        success: true,
        data: {
          title: 'ภาพถ่ายปล่อง',
          description: null,
          link: 'https://example.com/stack-reference.pdf',
          fileName: 'stack.png',
          fileType: 'image/png',
          fileSize: 14,
        },
      });
      expect(response.body.data.fileUrl).toMatch(
        /^http:\/\/127\.0\.0\.1:\d+\/uploads\/cems-wpms\/document-images\/\d{4}\/\d{2}\/[a-f0-9-]+\.png$/,
      );
      expect(response.body.data).not.toHaveProperty('storageKey');
    });
  });

  it('rejects unsupported file types', async () => {
    await withTempUploadDir(async () => {
      const app = createApp();

      const response = await request(app)
        .post('/api/v1/cems-wpms-requests/document-images')
        .set('Authorization', `Bearer ${accessToken()}`)
        .field('title', 'payload')
        .attach('file', Buffer.from('bad'), {
          filename: 'payload.exe',
          contentType: 'application/x-msdownload',
        });

      expect(response.status).toBe(400);
      expect(response.body.error.message).toBe('Unsupported file type');
    });
  });

  it('rejects multipart files above 5 MB with a client error', async () => {
    await withTempUploadDir(async () => {
      const app = createApp();

      const response = await request(app)
        .post('/api/v1/cems-wpms-requests/document-images')
        .set('Authorization', `Bearer ${accessToken()}`)
        .field('title', 'ภาพถ่ายหน้าโรงงาน')
        .attach('file', Buffer.alloc(5 * 1024 * 1024 + 1, 1), {
          filename: 'factory.png',
          contentType: 'image/png',
        });

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        success: false,
        error: {
          code: 'UPLOAD_ERROR',
        },
      });
    });
  });
});
