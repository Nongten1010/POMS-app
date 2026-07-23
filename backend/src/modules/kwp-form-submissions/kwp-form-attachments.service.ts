import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { BadRequestError } from '../../shared/errors/AppError';

export const DEFAULT_KWP_ATTACHMENT_FILE_SIZE_BYTES = 5 * 1024 * 1024;
export const KWP05_ATTACHMENT_FILE_SIZE_BYTES = 10 * 1024 * 1024;
export const MAX_KWP_ATTACHMENT_FILE_SIZE_BYTES = KWP05_ATTACHMENT_FILE_SIZE_BYTES;
const STORAGE_PREFIX = 'kwp/form-attachments';
const KWP05_TEN_MEGABYTE_ATTACHMENT_TYPES = new Set(['RATA_REPORT', 'CALIBRATION_PHOTO']);

export const allowedKwpAttachmentFileTypes = new Map([
  ['image/jpeg', new Set(['.jpg', '.jpeg'])],
  ['image/png', new Set(['.png'])],
  ['application/pdf', new Set(['.pdf'])],
]);

export interface UploadedKwpAttachmentFile {
  attachmentType?: string;
  buffer: Buffer;
  originalName: string;
  mimeType: string;
  size: number;
}

export interface StoredKwpAttachment {
  originalFileName: string;
  storedFileName: string;
  mimeType: string;
  fileSize: number;
  storagePath: string;
  fileUrl: string;
}

interface KwpAttachmentStorageOptions {
  uploadDir: string;
  publicPath: string;
  publicBaseUrl: string;
}

export class LocalKwpAttachmentStorage {
  constructor(private readonly options: KwpAttachmentStorageOptions) {}

  async save(file: UploadedKwpAttachmentFile): Promise<StoredKwpAttachment> {
    validateKwpAttachmentFile(file);

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

export function createKwpAttachmentStorage(
  options: KwpAttachmentStorageOptions,
): LocalKwpAttachmentStorage {
  return new LocalKwpAttachmentStorage(options);
}

function validateKwpAttachmentFile(file: UploadedKwpAttachmentFile): void {
  if (!Buffer.isBuffer(file.buffer) || file.buffer.length === 0) {
    throw new BadRequestError('Uploaded file is empty');
  }

  const maximumFileSize = getKwpAttachmentFileSizeLimit(file.attachmentType);
  if (!Number.isInteger(file.size) || file.size <= 0 || file.size > maximumFileSize) {
    const maximumMegabytes = maximumFileSize / (1024 * 1024);
    throw new BadRequestError(
      `Uploaded file size must be between 1 byte and ${maximumMegabytes} MB`,
    );
  }

  if (file.buffer.length !== file.size) {
    throw new BadRequestError('Uploaded file size does not match file content');
  }

  const allowedExtensions = allowedKwpAttachmentFileTypes.get(file.mimeType);
  if (!allowedExtensions) {
    throw new BadRequestError('Unsupported file type');
  }

  const extension = path.extname(file.originalName).toLowerCase();
  if (!extension || !allowedExtensions.has(extension)) {
    throw new BadRequestError('Unsupported file extension');
  }

  if (!hasMatchingFileSignature(file.buffer, file.mimeType)) {
    throw new BadRequestError('Uploaded file content does not match its declared type');
  }
}

export function getKwpAttachmentFileSizeLimit(attachmentType?: string): number {
  return attachmentType && KWP05_TEN_MEGABYTE_ATTACHMENT_TYPES.has(attachmentType)
    ? KWP05_ATTACHMENT_FILE_SIZE_BYTES
    : DEFAULT_KWP_ATTACHMENT_FILE_SIZE_BYTES;
}

function hasMatchingFileSignature(buffer: Buffer, mimeType: string): boolean {
  if (mimeType === 'application/pdf') {
    return buffer.subarray(0, 5).equals(Buffer.from('%PDF-'));
  }
  if (mimeType === 'image/png') {
    return buffer
      .subarray(0, 8)
      .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  }
  if (mimeType === 'image/jpeg') {
    return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }
  return false;
}

function sanitizeOriginalFileName(value: string): string {
  const baseName = path.basename(value).replace(/[^\w.\- ก-๙()]/g, '_');
  return baseName || 'uploaded-file';
}

export function buildPublicFileUrl(
  publicBaseUrl: string,
  publicPath: string,
  storagePath: string,
): string {
  const baseUrl = publicBaseUrl.replace(/\/+$/, '');
  const normalizedPublicPath = `/${publicPath.replace(/^\/+|\/+$/g, '')}`;
  const normalizedStoragePath = normalizeStoredPathForPublicUrl(storagePath, normalizedPublicPath);
  return `${baseUrl}${normalizedPublicPath}/${normalizedStoragePath
    .split('/')
    .map((part) => encodeURIComponent(part))
    .join('/')}`;
}

function normalizeStoredPathForPublicUrl(
  storagePath: string,
  normalizedPublicPath: string,
): string {
  const trimmedPath = storagePath.replace(/^\/+/, '');
  const publicPathPrefix = `${normalizedPublicPath.replace(/^\/+/, '')}/`;
  if (trimmedPath.toLowerCase().startsWith(publicPathPrefix.toLowerCase())) {
    return trimmedPath.slice(publicPathPrefix.length);
  }
  return trimmedPath;
}
