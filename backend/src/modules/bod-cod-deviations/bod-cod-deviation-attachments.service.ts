import { validateGeneralUpload } from '../../shared/utils/upload-file-policy';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { BadRequestError } from '../../shared/errors/AppError';
import { buildPublicFileUrl } from '../kwp-form-submissions/kwp-form-attachments.service';

export const MAX_BOD_COD_ATTACHMENT_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const STORAGE_PREFIX = 'bod-cod/deviation-attachments';

export interface UploadedBodCodAttachmentFile {
  buffer: Buffer;
  originalName: string;
  mimeType: string;
  size: number;
}

export interface StoredBodCodAttachment {
  originalFileName: string;
  storedFileName: string;
  mimeType: string;
  fileSize: number;
  storagePath: string;
  fileUrl: string;
}

interface BodCodAttachmentStorageOptions {
  uploadDir: string;
  publicPath: string;
  publicBaseUrl: string;
}

export class LocalBodCodAttachmentStorage {
  constructor(private readonly options: BodCodAttachmentStorageOptions) {}

  async save(file: UploadedBodCodAttachmentFile): Promise<StoredBodCodAttachment> {
    file = { ...file, mimeType: await validateBodCodAttachmentFile(file) };

    const now = new Date();
    const yyyy = String(now.getFullYear());
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const extension = path.extname(file.originalName).toLowerCase();
    const storedFileName = `${randomUUID()}${extension}`;
    const storagePath = path.posix.join(STORAGE_PREFIX, yyyy, mm, storedFileName);
    const absolutePath = path.join(this.options.uploadDir, storagePath);

    await mkdir(path.dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, file.buffer, { flag: 'wx' });

    return {
      originalFileName: sanitizeOriginalFileName(file.originalName),
      storedFileName,
      mimeType: file.mimeType,
      fileSize: file.size,
      storagePath,
      fileUrl: buildPublicFileUrl(this.options.publicBaseUrl, this.options.publicPath, storagePath),
    };
  }
}

export function createBodCodAttachmentStorage(
  options: BodCodAttachmentStorageOptions,
): LocalBodCodAttachmentStorage {
  return new LocalBodCodAttachmentStorage(options);
}

async function validateBodCodAttachmentFile(file: UploadedBodCodAttachmentFile): Promise<string> {
  if (!Buffer.isBuffer(file.buffer) || file.buffer.length === 0) {
    throw new BadRequestError('Uploaded file is empty');
  }

  if (
    !Number.isInteger(file.size) ||
    file.size <= 0 ||
    file.size > MAX_BOD_COD_ATTACHMENT_FILE_SIZE_BYTES
  ) {
    throw new BadRequestError('Uploaded file size must be between 1 byte and 5 MB');
  }

  if (file.buffer.length !== file.size) {
    throw new BadRequestError('Uploaded file size does not match file content');
  }

  return validateGeneralUpload(file, MAX_BOD_COD_ATTACHMENT_FILE_SIZE_BYTES);
}

function sanitizeOriginalFileName(value: string): string {
  const baseName = path.basename(value).replace(/[^\w.\- ก-๙()]/g, '_');
  if (!baseName) return 'uploaded-file';
  if (baseName.length <= 255) return baseName;
  const extension = path.extname(baseName);
  return `${baseName.slice(0, 255 - extension.length)}${extension}`;
}
