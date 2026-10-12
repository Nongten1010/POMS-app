import { validateGeneralUpload } from '../../shared/utils/upload-file-policy';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { BadRequestError } from '../../shared/errors/AppError';

export const MAX_DOCUMENT_FILE_SIZE_BYTES = 5 * 1024 * 1024;
const STORAGE_PREFIX = 'cems-wpms/document-images';

export interface UploadedDocumentFile {
  buffer: Buffer;
  originalName: string;
  mimeType: string;
  size: number;
}

export interface CreateDocumentImageInput {
  title?: string | null;
  description?: string | null;
  link?: string | null;
  file?: UploadedDocumentFile | null;
}

export interface StoredDocumentImage {
  title: string;
  description: string | null;
  link: string | null;
  fileName: string | null;
  fileUrl: string | null;
  fileType: string | null;
  fileSize: number | null;
  storageKey: string | null;
}

export interface DocumentFileStorage {
  save(file: UploadedDocumentFile): Promise<{ fileUrl: string; storageKey: string }>;
}

interface LocalDocumentFileStorageOptions {
  uploadDir: string;
  publicPath: string;
  publicBaseUrl: string;
}

export class LocalDocumentFileStorage implements DocumentFileStorage {
  constructor(private readonly options: LocalDocumentFileStorageOptions) {}

  async save(file: UploadedDocumentFile): Promise<{ fileUrl: string; storageKey: string }> {
    file = { ...file, mimeType: await validateDocumentFile(file) };

    const now = new Date();
    const yyyy = String(now.getFullYear());
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const extension = path.extname(file.originalName).toLowerCase();
    const storageKey = path.posix.join(STORAGE_PREFIX, yyyy, mm, `${randomUUID()}${extension}`);
    const absolutePath = path.join(this.options.uploadDir, storageKey);

    await mkdir(path.dirname(absolutePath), { recursive: true });
    await writeFile(absolutePath, file.buffer, { flag: 'wx' });

    return {
      storageKey,
      fileUrl: buildPublicFileUrl(this.options.publicBaseUrl, this.options.publicPath, storageKey),
    };
  }
}

export function createConnectionRequestDocumentImageService(
  options: LocalDocumentFileStorageOptions,
): ConnectionRequestDocumentImageService {
  return new ConnectionRequestDocumentImageService(new LocalDocumentFileStorage(options));
}

export class ConnectionRequestDocumentImageService {
  constructor(private readonly storage: DocumentFileStorage) {}

  async createDocumentImage(input: CreateDocumentImageInput): Promise<StoredDocumentImage> {
    const title = normalizeText(input.title) ?? 'เอกสารและรูปภาพ';
    const description = normalizeText(input.description);
    const link = normalizeUrl(input.link, 'link');
    let file = input.file ?? null;

    if (!file && !link) {
      throw new BadRequestError('Either file or link is required');
    }

    if (!file) {
      return {
        title,
        description,
        link,
        fileName: null,
        fileUrl: null,
        fileType: null,
        fileSize: null,
        storageKey: null,
      };
    }

    file = { ...file, mimeType: await validateDocumentFile(file) };
    const storedFile = await this.storage.save(file);

    return {
      title,
      description,
      link,
      fileName: sanitizeOriginalFileName(file.originalName),
      fileUrl: storedFile.fileUrl,
      fileType: file.mimeType,
      fileSize: file.size,
      storageKey: storedFile.storageKey,
    };
  }
}

async function validateDocumentFile(file: UploadedDocumentFile): Promise<string> {
  if (!Buffer.isBuffer(file.buffer) || file.buffer.length === 0) {
    throw new BadRequestError('Uploaded file is empty');
  }

  if (!Number.isInteger(file.size) || file.size <= 0 || file.size > MAX_DOCUMENT_FILE_SIZE_BYTES) {
    throw new BadRequestError('Uploaded file size must be between 1 byte and 5 MB');
  }

  if (file.buffer.length !== file.size) {
    throw new BadRequestError('Uploaded file size does not match file content');
  }

  return validateGeneralUpload(file, MAX_DOCUMENT_FILE_SIZE_BYTES);
}

function normalizeText(value: string | null | undefined): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeUrl(value: string | null | undefined, field: string): string | null {
  const normalized = normalizeText(value);
  if (!normalized) return null;

  try {
    const url = new URL(normalized);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') {
      throw new Error('Unsupported URL protocol');
    }
    return url.toString();
  } catch {
    throw new BadRequestError(`${field} must be a valid URL`);
  }
}

function sanitizeOriginalFileName(value: string): string {
  const baseName = path.basename(value).replace(/[^\w.\- ก-๙()]/g, '_');
  if (!baseName) return 'uploaded-file';
  if (baseName.length <= 255) return baseName;
  const extension = path.extname(baseName);
  return `${baseName.slice(0, 255 - extension.length)}${extension}`;
}

function buildPublicFileUrl(publicBaseUrl: string, publicPath: string, storageKey: string): string {
  const baseUrl = publicBaseUrl.replace(/\/+$/, '');
  const normalizedPublicPath = `/${publicPath.replace(/^\/+|\/+$/g, '')}`;
  return `${baseUrl}${normalizedPublicPath}/${storageKey
    .split('/')
    .map((part) => encodeURIComponent(part))
    .join('/')}`;
}
