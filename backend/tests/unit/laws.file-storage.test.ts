import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from '@jest/globals';
import {
  LAW_MAX_FILE_SIZE_BYTES,
  LocalLawFileStorage,
  resolveLawStoragePath,
  validateLawPdf,
} from '../../src/modules/laws/laws-file-storage';

const temporaryDirectories: string[] = [];

describe('law file storage', () => {
  afterEach(async () => {
    await Promise.all(
      temporaryDirectories
        .splice(0)
        .map((directory) => rm(directory, { recursive: true, force: true })),
    );
  });

  it('stores a validated PDF below the private law prefix with a generated name', async () => {
    const uploadDir = await temporaryDirectory();
    const storage = new LocalLawFileStorage({
      uploadDir,
      now: () => new Date('2026-09-04T08:00:00.000Z'),
      generateId: () => '28b69ad9-2acf-4b50-961f-84d7a5bea945',
    });
    const file = uploadedPdf('กฎหมายฉบับที่ 1.pdf');

    const stored = await storage.save(file);

    expect(stored).toEqual({
      fileName: 'กฎหมายฉบับที่ 1.pdf',
      fileSize: file.size,
      mimeType: 'application/pdf',
      storagePath: '.private/laws/2026/09/28b69ad9-2acf-4b50-961f-84d7a5bea945.pdf',
    });
    await expect(readFile(resolveLawStoragePath(uploadDir, stored.storagePath))).resolves.toEqual(
      file.buffer,
    );
    await expect(storage.getContent(stored)).resolves.toMatchObject({
      fileName: 'กฎหมายฉบับที่ 1.pdf',
      fileSize: file.size,
      mimeType: 'application/pdf',
    });
    await storage.remove(stored.storagePath);
    await expect(
      readFile(resolveLawStoragePath(uploadDir, stored.storagePath)),
    ).rejects.toMatchObject({ code: 'ENOENT' });
  });

  it('treats removal of an already absent private file as idempotent', async () => {
    const storage = new LocalLawFileStorage({ uploadDir: await temporaryDirectory() });
    await expect(
      storage.remove('.private/laws/2026/09/28b69ad9-2acf-4b50-961f-84d7a5bea945.pdf'),
    ).resolves.toBeUndefined();
  });

  it.each([
    { name: 'wrong extension', file: uploadedPdf('law.exe') },
    { name: 'wrong MIME', file: uploadedPdf('law.pdf', 'text/plain') },
    {
      name: 'spoofed signature',
      file: uploadedPdf('law.pdf', 'application/pdf', Buffer.from('not a PDF')),
    },
    {
      name: 'declared size mismatch',
      file: { ...uploadedPdf('law.pdf'), size: 999 },
    },
    {
      name: 'oversized',
      file: {
        ...uploadedPdf('law.pdf'),
        buffer: Buffer.concat([pdfBuffer(), Buffer.alloc(LAW_MAX_FILE_SIZE_BYTES)]),
        size: LAW_MAX_FILE_SIZE_BYTES + pdfBuffer().length,
      },
    },
  ])('rejects $name uploads', ({ file }) => {
    expect(() => validateLawPdf(file)).toThrow(
      expect.objectContaining({ code: 'VALIDATION_ERROR' }),
    );
  });

  it.each([
    '../../etc/passwd',
    '.private/laws/../../outside.pdf',
    '.private\\laws\\2026\\09\\file.pdf',
    '/absolute/private.pdf',
    '.private/laws/2026/09/file.txt',
  ])('rejects an unsafe stored path: %s', (storagePath) => {
    expect(() => resolveLawStoragePath('/tmp/poms-laws', storagePath)).toThrow(
      'Law file not found',
    );
  });

  it('refuses to serve a symlink that resolves outside the private law directory', async () => {
    const uploadDir = await temporaryDirectory();
    const outsideFile = path.join(await temporaryDirectory(), 'outside.pdf');
    await writeFile(outsideFile, pdfBuffer());
    const storagePath = '.private/laws/2026/09/28b69ad9-2acf-4b50-961f-84d7a5bea945.pdf';
    const absolutePath = resolveLawStoragePath(uploadDir, storagePath);
    await mkdir(path.dirname(absolutePath), { recursive: true });
    await symlink(outsideFile, absolutePath);
    const storage = new LocalLawFileStorage({ uploadDir });

    await expect(
      storage.getContent({
        storagePath,
        fileName: 'law.pdf',
        fileSize: pdfBuffer().length,
        mimeType: 'application/pdf',
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('refuses a private storage root symlink that escapes the upload directory', async () => {
    const uploadDir = await temporaryDirectory();
    const outsideDir = await temporaryDirectory();
    const storagePath = '.private/laws/2026/09/28b69ad9-2acf-4b50-961f-84d7a5bea945.pdf';
    const outsideFile = path.join(outsideDir, '2026/09/28b69ad9-2acf-4b50-961f-84d7a5bea945.pdf');
    await mkdir(path.dirname(outsideFile), { recursive: true });
    await writeFile(outsideFile, pdfBuffer());
    await mkdir(path.join(uploadDir, '.private'), { recursive: true });
    await symlink(outsideDir, path.join(uploadDir, '.private/laws'));
    const storage = new LocalLawFileStorage({ uploadDir });

    await expect(
      storage.getContent({
        storagePath,
        fileName: 'law.pdf',
        fileSize: pdfBuffer().length,
        mimeType: 'application/pdf',
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('never writes through a private-root symlink back into the public upload root', async () => {
    const uploadDir = await temporaryDirectory();
    await mkdir(path.join(uploadDir, '.private'), { recursive: true });
    await symlink(uploadDir, path.join(uploadDir, '.private/laws'));
    const storage = new LocalLawFileStorage({
      uploadDir,
      now: () => new Date('2026-09-04T08:00:00.000Z'),
      generateId: () => '28b69ad9-2acf-4b50-961f-84d7a5bea945',
    });

    await expect(storage.save(uploadedPdf('law.pdf'))).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    await expect(
      readFile(path.join(uploadDir, '2026/09/28b69ad9-2acf-4b50-961f-84d7a5bea945.pdf')),
    ).rejects.toMatchObject({ code: 'ENOENT' });
  });
});

async function temporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(path.join(tmpdir(), 'poms-laws-'));
  temporaryDirectories.push(directory);
  return directory;
}

function pdfBuffer(): Buffer {
  return Buffer.from('%PDF-1.7\n%%EOF\n');
}

function uploadedPdf(originalName: string, mimeType = 'application/pdf', buffer = pdfBuffer()) {
  return { buffer, originalName, mimeType, size: buffer.length };
}
