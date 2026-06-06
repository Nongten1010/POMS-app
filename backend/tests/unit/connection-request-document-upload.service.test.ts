import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from '@jest/globals';
import { BadRequestError } from '../../src/shared/errors/AppError';
import {
  createConnectionRequestDocumentImageService,
  type UploadedDocumentFile,
} from '../../src/modules/connection-requests/connection-request-document-image.service';

describe('connection request document image upload service', () => {
  async function withTempUploadDir<T>(callback: (uploadDir: string) => Promise<T>): Promise<T> {
    const uploadDir = await mkdtemp(path.join(tmpdir(), 'poms-upload-test-'));
    try {
      return await callback(uploadDir);
    } finally {
      await rm(uploadDir, { recursive: true, force: true });
    }
  }

  const pngFile: UploadedDocumentFile = {
    buffer: Buffer.from('fake png bytes'),
    originalName: '../../stack photo.png',
    mimeType: 'image/png',
    size: 14,
  };

  it('stores an uploaded file under the configured local root and returns reusable metadata', async () => {
    await withTempUploadDir(async (uploadDir) => {
      const service = createConnectionRequestDocumentImageService({
        uploadDir,
        publicPath: '/uploads',
        publicBaseUrl: 'https://poms.example.go.th',
      });

      const result = await service.createDocumentImage({
        title: 'ภาพถ่ายปล่อง',
        description: '',
        link: '',
        file: pngFile,
      });

      expect(result).toMatchObject({
        title: 'ภาพถ่ายปล่อง',
        description: null,
        link: null,
        fileName: 'stack photo.png',
        fileType: 'image/png',
        fileSize: 14,
      });
      expect(result.fileUrl).toMatch(
        /^https:\/\/poms\.example\.go\.th\/uploads\/cems-wpms\/document-images\/\d{4}\/\d{2}\/[a-f0-9-]+\.png$/,
      );

      const storedPath = result.storageKey ? path.join(uploadDir, result.storageKey) : '';
      await expect(readFile(storedPath)).resolves.toEqual(pngFile.buffer);
    });
  });

  it('returns link-only metadata without writing a file', async () => {
    await withTempUploadDir(async (uploadDir) => {
      const service = createConnectionRequestDocumentImageService({
        uploadDir,
        publicPath: '/uploads',
        publicBaseUrl: 'https://poms.example.go.th',
      });

      const result = await service.createDocumentImage({
        title: 'รายงาน RATA',
        description: 'แนบเป็นลิงก์',
        link: 'https://example.com/rata.pdf',
        file: null,
      });

      expect(result).toEqual({
        title: 'รายงาน RATA',
        description: 'แนบเป็นลิงก์',
        link: 'https://example.com/rata.pdf',
        fileName: null,
        fileUrl: null,
        fileType: null,
        fileSize: null,
        storageKey: null,
      });
    });
  });

  it('rejects unsupported file types before writing to storage', async () => {
    await withTempUploadDir(async (uploadDir) => {
      const service = createConnectionRequestDocumentImageService({
        uploadDir,
        publicPath: '/uploads',
        publicBaseUrl: 'https://poms.example.go.th',
      });

      await expect(
        service.createDocumentImage({
          title: 'script',
          description: null,
          link: null,
          file: {
            ...pngFile,
            originalName: 'payload.exe',
            mimeType: 'application/x-msdownload',
          },
        }),
      ).rejects.toBeInstanceOf(BadRequestError);
    });
  });
});
