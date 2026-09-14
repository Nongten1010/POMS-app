import { randomUUID } from 'node:crypto';
import { mkdir, realpath, stat, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { AppError, NotFoundError } from '../../shared/errors/AppError';
import type { StoredFaqAttachment } from './faqs.types';

export const FAQ_MAX_FILES = 10;
export const FAQ_MAX_FILE_SIZE = 10 * 1024 * 1024;
const formats: Record<string, { mime: string; signature?: string }> = {
  '.pdf': { mime: 'application/pdf', signature: '255044462d' },
  '.png': { mime: 'image/png', signature: '89504e470d0a1a0a' },
  '.jpg': { mime: 'image/jpeg', signature: 'ffd8ff' },
  '.jpeg': { mime: 'image/jpeg', signature: 'ffd8ff' },
  '.doc': { mime: 'application/msword', signature: 'd0cf11e0a1b11ae1' },
  '.xls': { mime: 'application/vnd.ms-excel', signature: 'd0cf11e0a1b11ae1' },
  '.docx': {
    mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    signature: '504b0304',
  },
  '.xlsx': {
    mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    signature: '504b0304',
  },
  '.txt': { mime: 'text/plain' },
};

export function faqFileError(message: string): AppError {
  return new AppError(message, 400, 'VALIDATION_ERROR', { files: message });
}

export function validateFaqFile(file: Express.Multer.File): string {
  const format = formats[path.extname(file.originalname).toLowerCase()];
  if (!format) throw faqFileError('รองรับไฟล์ PDF, DOC, DOCX, XLS, XLSX, PNG, JPG และ TXT');
  if (
    !Buffer.isBuffer(file.buffer) ||
    file.buffer.length !== file.size ||
    file.size < 1 ||
    file.size > FAQ_MAX_FILE_SIZE
  ) {
    throw faqFileError('ไฟล์ต้องมีข้อมูลและขนาดไม่เกิน 10 MB');
  }
  if (
    format.signature &&
    !file.buffer
      .subarray(0, format.signature.length / 2)
      .equals(Buffer.from(format.signature, 'hex'))
  ) {
    throw faqFileError('เนื้อหาไฟล์ไม่ตรงกับชนิดไฟล์');
  }
  if (!format.signature) {
    try {
      new TextDecoder('utf-8', { fatal: true }).decode(file.buffer);
    } catch {
      throw faqFileError('ไฟล์ TXT ต้องเป็นข้อความ UTF-8');
    }
    if (file.buffer.includes(0)) throw faqFileError('ไฟล์ TXT ต้องเป็นข้อความ');
  }
  return format.mime;
}

export class FaqFileStorage {
  constructor(private readonly uploadDir: string) {}

  private async root(): Promise<string> {
    await mkdir(this.uploadDir, { recursive: true });
    const uploadRoot = await realpath(this.uploadDir);
    const root = path.join(uploadRoot, '.private', 'faqs');
    await mkdir(root, { recursive: true });
    const canonical = await realpath(root);
    assertContained(uploadRoot, canonical);
    return canonical;
  }

  async save(file: Express.Multer.File): Promise<StoredFaqAttachment> {
    const mimeType = validateFaqFile(file);
    const id = randomUUID();
    const fileName = path
      .basename(file.originalname.replace(/\\/g, '/'))
      .replace(/[\u0000-\u001f\u007f<>:"/\\|?*]/g, '_')
      .slice(0, 255);
    await writeFile(path.join(await this.root(), id), file.buffer, { flag: 'wx' });
    return { id, fileName, fileSize: file.size, mimeType, storagePath: id };
  }

  private async resolve(storagePath: string): Promise<string> {
    if (
      !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(storagePath)
    ) {
      throw new NotFoundError('FAQ attachment not found');
    }
    const root = await this.root();
    const resolved = await realpath(path.join(root, storagePath)).catch(() => {
      throw new NotFoundError('FAQ attachment not found');
    });
    assertContained(root, resolved);
    return resolved;
  }

  async remove(file: StoredFaqAttachment): Promise<void> {
    try {
      await unlink(await this.resolve(file.storagePath));
    } catch (error) {
      if (!(error instanceof NotFoundError) && (error as NodeJS.ErrnoException).code !== 'ENOENT')
        throw error;
    }
  }

  async getPath(file: StoredFaqAttachment): Promise<string> {
    const resolved = await this.resolve(file.storagePath);
    const info = await stat(resolved);
    if (!info.isFile() || info.size !== file.fileSize)
      throw new NotFoundError('FAQ attachment not found');
    return resolved;
  }
}

function assertContained(root: string, candidate: string): void {
  const relative = path.relative(root, candidate);
  if (
    !relative ||
    relative === '..' ||
    relative.startsWith(`..${path.sep}`) ||
    path.isAbsolute(relative)
  ) {
    throw new NotFoundError('FAQ attachment not found');
  }
}
