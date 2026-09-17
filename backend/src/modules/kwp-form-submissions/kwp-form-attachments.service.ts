import { randomUUID } from 'node:crypto';
import { mkdir, readFile, realpath, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { BadRequestError } from '../../shared/errors/AppError';
import type { KwpFormAttachmentInput } from './kwp-form-submissions.types';

export const DEFAULT_KWP_ATTACHMENT_FILE_SIZE_BYTES = 5 * 1024 * 1024;
export const KWP05_ATTACHMENT_FILE_SIZE_BYTES = 10 * 1024 * 1024;
export const MAX_KWP_ATTACHMENT_FILE_SIZE_BYTES = KWP05_ATTACHMENT_FILE_SIZE_BYTES;
const STORAGE_PREFIX = 'kwp/form-attachments';
const KWP05_TEN_MEGABYTE_ATTACHMENT_TYPES = new Set([
  'GENERAL',
  'RATA_REPORT',
  'CALIBRATION_PHOTO',
]);

export const allowedKwpAttachmentFileTypes = new Map([
  ['image/jpeg', new Set(['.jpg', '.jpeg'])],
  ['image/png', new Set(['.png'])],
  ['application/pdf', new Set(['.pdf'])],
]);

export interface UploadedKwpAttachmentFile {
  actorUserId?: number;
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
    const ownerDirectory = file.actorUserId === undefined ? [] : [String(file.actorUserId)];
    const storagePath = path.posix.join(
      STORAGE_PREFIX,
      yyyy,
      mm,
      ...ownerDirectory,
      storedFileName,
    );
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

/** New files belong to their uploader; legacy files can only be retained on their existing submission. */
export async function validateStoredKwpAttachments(
  attachments: KwpFormAttachmentInput[],
  retained: KwpFormAttachmentInput[],
  actorUserId: number,
  options: Pick<KwpAttachmentStorageOptions, 'uploadDir' | 'publicPath'>,
): Promise<void> {
  for (const attachment of attachments) {
    const storagePath = attachment.storagePath;
    if (
      !storagePath ||
      /[\\%\u0000-\u001f]/.test(storagePath) ||
      storagePath.split('/').some((part) => part === '.' || part === '..')
    ) {
      throw new BadRequestError('Invalid KWP attachment storage path');
    }
    const existing = retained.find((item) => item.storagePath === storagePath);
    if (existing) {
      for (const field of ['storedFileName', 'mimeType', 'fileSize', 'attachmentType'] as const) {
        if ((attachment[field] ?? null) !== (existing[field] ?? null))
          throw new BadRequestError('Stored attachment metadata cannot be changed');
      }
      continue;
    }
    const expectedOwner = new RegExp(`^kwp/form-attachments/\\d{4}/\\d{2}/${actorUserId}/[^/]+$`);
    if (!expectedOwner.test(storagePath))
      throw new BadRequestError(
        'Upload this attachment using the current account before submitting',
      );
    const filePath = path.resolve(options.uploadDir, storagePath);
    try {
      const root = await realpath(options.uploadDir);
      const resolved = await realpath(filePath);
      if (!resolved.startsWith(`${root}${path.sep}`))
        throw new BadRequestError('Invalid KWP attachment storage path');
      const info = await stat(resolved);
      if (!info.isFile() || info.size > getKwpAttachmentFileSizeLimit(attachment.attachmentType))
        throw new BadRequestError('Invalid attachment file size');
      const buffer = await readFile(resolved);
      if (
        attachment.storedFileName !== path.basename(resolved) ||
        attachment.fileSize !== buffer.length
      )
        throw new BadRequestError('Attachment metadata does not match the uploaded file');
      validateKwpAttachmentFile({
        attachmentType: attachment.attachmentType,
        buffer,
        originalName: attachment.originalFileName,
        mimeType: attachment.mimeType ?? '',
        size: buffer.length,
      });
    } catch (error) {
      if (error instanceof BadRequestError) throw error;
      throw new BadRequestError('Uploaded attachment is unavailable; upload it again');
    }
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
