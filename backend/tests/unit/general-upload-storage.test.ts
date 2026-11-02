import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from '@jest/globals';
import fixtures from '../fixtures/upload-archives.json';
import {
  ConnectionRequestDocumentImageService,
  LocalDocumentFileStorage,
} from '../../src/modules/connection-requests/connection-request-document-image.service';
import { LocalKwpAttachmentStorage } from '../../src/modules/kwp-form-submissions/kwp-form-attachments.service';
import { LocalBodCodAttachmentStorage } from '../../src/modules/bod-cod-deviations/bod-cod-deviation-attachments.service';
import { FaqFileStorage } from '../../src/modules/faqs/faqs-file-storage';
import { LocalLawFileStorage } from '../../src/modules/laws/laws-file-storage';
import type { GeneralUploadedFile } from '../../src/shared/utils/upload-file-policy';

type Save = (root: string, file: GeneralUploadedFile) => Promise<unknown>;
const storageAdapters: [string, Save][] = [
  [
    'connection requests/POMS factories',
    (uploadDir, file) =>
      new ConnectionRequestDocumentImageService(
        new LocalDocumentFileStorage({
          uploadDir,
          publicPath: '/uploads',
          publicBaseUrl: 'https://example.com',
        }),
      ).createDocumentImage({ file }),
  ],
  [
    'KWP',
    (uploadDir, file) =>
      new LocalKwpAttachmentStorage({
        uploadDir,
        publicPath: '/uploads',
        publicBaseUrl: 'https://example.com',
      }).save(file),
  ],
  [
    'BOD/COD',
    (uploadDir, file) =>
      new LocalBodCodAttachmentStorage({
        uploadDir,
        publicPath: '/uploads',
        publicBaseUrl: 'https://example.com',
      }).save(file),
  ],
  [
    'FAQ',
    (root, file) =>
      new FaqFileStorage(root).save({
        originalname: file.originalName,
        mimetype: file.mimeType,
        buffer: file.buffer,
        size: file.size,
      } as Express.Multer.File),
  ],
  ['laws', (uploadDir, file) => new LocalLawFileStorage({ uploadDir }).save(file)],
];

describe.each(storageAdapters.slice(0, 3))('%s uploaded filename', (_name, save) => {
  it('keeps response metadata within 255 characters while preserving the extension', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'poms-general-'));
    try {
      const buffer = Buffer.from('ordinary report');
      const result = (await save(root, {
        originalName: `${'a'.repeat(300)}.txt`,
        mimeType: 'text/plain',
        buffer,
        size: buffer.length,
      })) as { fileName?: string; originalFileName?: string };
      const name = result.fileName ?? result.originalFileName;
      expect(name).toHaveLength(255);
      expect(name).toMatch(/\.txt$/);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});

describe.each(storageAdapters)('%s upload storage', (_name, save) => {
  it('stores a JPEG named PNG using the detected MIME and a matching storage extension', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'poms-general-image-'));
    try {
      const buffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0]);
      const result = (await save(root, {
        originalName: 'photo.png',
        mimeType: 'image/png',
        buffer,
        size: buffer.length,
      })) as {
        fileType?: string;
        mimeType?: string;
        storageKey?: string;
        storagePath?: string;
      };

      expect(result.fileType ?? result.mimeType).toBe('image/jpeg');
      const storagePath = result.storageKey ?? result.storagePath ?? '';
      expect(storagePath).not.toBe('');
      expect(path.extname(storagePath)).toBe(_name === 'FAQ' ? '' : '.jpg');
      const filePath =
        _name === 'FAQ'
          ? path.join(root, '.private', 'faqs', storagePath)
          : path.join(root, storagePath);
      await expect(readFile(filePath)).resolves.toEqual(buffer);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('accepts ordinary text without client MIME restrictions', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'poms-general-'));
    try {
      const buffer = Buffer.from('ordinary report');
      await save(root, {
        originalName: 'report.txt',
        mimeType: 'application/octet-stream',
        buffer,
        size: buffer.length,
      });
      expect((await readdir(root, { recursive: true })).length).toBeGreaterThan(0);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('rejects a macro hidden in an ordinary DOCX before writing anything', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'poms-general-'));
    try {
      const buffer = Buffer.from(fixtures.macro, 'base64');
      await expect(
        save(root, {
          originalName: 'report.docx',
          mimeType: 'application/octet-stream',
          buffer,
          size: buffer.length,
        }),
      ).rejects.toThrow();
      expect(await readdir(root, { recursive: true })).toEqual([]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
