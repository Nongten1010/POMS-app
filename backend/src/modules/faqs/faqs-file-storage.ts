import { validateGeneralUpload } from '../../shared/utils/upload-file-policy';
import { randomUUID } from 'node:crypto';
import { mkdir, realpath, stat, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { AppError, NotFoundError } from '../../shared/errors/AppError';
import type { StoredFaqAttachment } from './faqs.types';

export const FAQ_MAX_FILES = 10;
export const FAQ_MAX_FILE_SIZE = 10 * 1024 * 1024;
export function faqFileError(message: string): AppError {
  return new AppError(message, 400, 'VALIDATION_ERROR', { files: message });
}

export async function validateFaqFile(file: Express.Multer.File): Promise<string> {
  try {
    return await validateGeneralUpload(
      {
        originalName: file.originalname,
        mimeType: file.mimetype,
        buffer: file.buffer,
        size: file.size,
      },
      FAQ_MAX_FILE_SIZE,
    );
  } catch (error) {
    throw faqFileError(error instanceof Error ? error.message : 'Invalid uploaded file');
  }
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
    const mimeType = await validateFaqFile(file);
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
