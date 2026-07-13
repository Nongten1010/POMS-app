import { describe, expect, it, jest } from '@jest/globals';
import {
  ConnectionRequestDocumentImageService,
  MAX_DOCUMENT_FILE_SIZE_BYTES,
  type DocumentFileStorage,
  type UploadedDocumentFile,
} from '../../src/modules/connection-requests/connection-request-document-image.service';
import { BadRequestError } from '../../src/shared/errors/AppError';

function createPngFile(size: number): UploadedDocumentFile {
  const buffer = Buffer.alloc(size, 1);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(buffer);
  return {
    buffer,
    originalName: 'factory.png',
    mimeType: 'image/png',
    size,
  };
}

describe('connection-request document upload 5 MB boundary', () => {
  const storage: DocumentFileStorage = {
    save: jest.fn(async () => ({
      fileUrl: 'https://example.com/files/factory.png',
      storageKey: 'cems-wpms/document-images/factory.png',
    })),
  };
  const service = new ConnectionRequestDocumentImageService(storage);

  it('defines the public upload limit as 5 MB', () => {
    expect(MAX_DOCUMENT_FILE_SIZE_BYTES).toBe(5 * 1024 * 1024);
  });

  it('accepts a file exactly at the 5 MB boundary', async () => {
    await expect(
      service.createDocumentImage({
        title: 'ภาพถ่ายหน้าโรงงาน',
        file: createPngFile(5 * 1024 * 1024),
      }),
    ).resolves.toMatchObject({ fileSize: 5 * 1024 * 1024 });
  });

  it('rejects a file one byte above 5 MB before storage', async () => {
    await expect(
      service.createDocumentImage({
        title: 'ภาพถ่ายหน้าโรงงาน',
        file: createPngFile(5 * 1024 * 1024 + 1),
      }),
    ).rejects.toBeInstanceOf(BadRequestError);
  });

  it('rejects a spoofed PNG whose bytes do not match its declared type', async () => {
    await expect(
      service.createDocumentImage({
        title: 'ภาพถ่ายหน้าโรงงาน',
        file: {
          buffer: Buffer.from('not a png'),
          originalName: 'factory.png',
          mimeType: 'image/png',
          size: 9,
        },
      }),
    ).rejects.toBeInstanceOf(BadRequestError);
  });
});
