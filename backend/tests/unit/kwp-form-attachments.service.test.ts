import { afterEach, describe, expect, it } from '@jest/globals';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  getKwpAttachmentFileSizeLimit,
  KWP05_ATTACHMENT_FILE_SIZE_BYTES,
  LocalKwpAttachmentStorage,
} from '../../src/modules/kwp-form-submissions/kwp-form-attachments.service';

const temporaryDirectories: string[] = [];

describe('KWP form attachment storage', () => {
  afterEach(async () => {
    await Promise.all(
      temporaryDirectories
        .splice(0)
        .map((directory) => rm(directory, { recursive: true, force: true })),
    );
  });

  it('allows KWP05 RATA files up to 10 MB while keeping the default limit at 5 MB', async () => {
    const storage = await createStorage();
    const sixMegabytePdf = pdfBuffer(6 * 1024 * 1024);

    await expect(
      storage.save({
        attachmentType: 'RATA_REPORT',
        buffer: sixMegabytePdf,
        originalName: 'rata-report.pdf',
        mimeType: 'application/pdf',
        size: sixMegabytePdf.length,
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        originalFileName: 'rata-report.pdf',
        fileSize: sixMegabytePdf.length,
      }),
    );

    await expect(
      storage.save({
        buffer: sixMegabytePdf,
        originalName: 'general-report.pdf',
        mimeType: 'application/pdf',
        size: sixMegabytePdf.length,
      }),
    ).rejects.toThrow('Uploaded file size must be between 1 byte and 5 MB');
  });

  it('rejects an upload whose content signature does not match its declared file type', async () => {
    const storage = await createStorage();
    const disguisedExecutable = Buffer.from('MZ executable content');

    await expect(
      storage.save({
        attachmentType: 'RATA_REPORT',
        buffer: disguisedExecutable,
        originalName: 'disguised.pdf',
        mimeType: 'application/pdf',
        size: disguisedExecutable.length,
      }),
    ).rejects.toThrow('Uploaded file content does not match its declared type');
  });

  it.each([
    {
      attachmentType: 'RATA_REPORT',
      fileName: 'rata-report.pdf',
      mimeType: 'application/pdf',
      signature: Buffer.from('%PDF-1.7\n'),
    },
    {
      attachmentType: 'CALIBRATION_PHOTO',
      fileName: 'calibration.png',
      mimeType: 'image/png',
      signature: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    },
    {
      attachmentType: 'CALIBRATION_PHOTO',
      fileName: 'calibration.jpg',
      mimeType: 'image/jpeg',
      signature: Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
    },
  ])('accepts a valid $mimeType signature', async (file) => {
    const storage = await createStorage();

    await expect(
      storage.save({
        attachmentType: file.attachmentType,
        buffer: file.signature,
        originalName: file.fileName,
        mimeType: file.mimeType,
        size: file.signature.length,
      }),
    ).resolves.toEqual(
      expect.objectContaining({
        originalFileName: file.fileName,
        mimeType: file.mimeType,
      }),
    );
  });

  it('enforces the 10 MB upper boundary for both KWP05 attachment types', async () => {
    expect(getKwpAttachmentFileSizeLimit('RATA_REPORT')).toBe(KWP05_ATTACHMENT_FILE_SIZE_BYTES);
    expect(getKwpAttachmentFileSizeLimit('CALIBRATION_PHOTO')).toBe(
      KWP05_ATTACHMENT_FILE_SIZE_BYTES,
    );

    const storage = await createStorage();
    const oversizedPdf = pdfBuffer(KWP05_ATTACHMENT_FILE_SIZE_BYTES + 1);

    await expect(
      storage.save({
        attachmentType: 'RATA_REPORT',
        buffer: oversizedPdf,
        originalName: 'oversized-rata-report.pdf',
        mimeType: 'application/pdf',
        size: oversizedPdf.length,
      }),
    ).rejects.toThrow('Uploaded file size must be between 1 byte and 10 MB');
  });
});

async function createStorage(): Promise<LocalKwpAttachmentStorage> {
  const uploadDir = await mkdtemp(path.join(tmpdir(), 'poms-kwp-attachments-'));
  temporaryDirectories.push(uploadDir);
  return new LocalKwpAttachmentStorage({
    uploadDir,
    publicPath: '/uploads',
    publicBaseUrl: 'https://poms.example',
  });
}

function pdfBuffer(size: number): Buffer {
  const buffer = Buffer.alloc(size, 0x20);
  buffer.write('%PDF-1.7\n');
  return buffer;
}
