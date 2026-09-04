import { randomUUID } from 'node:crypto';
import { mkdir, realpath, stat, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { NotFoundError } from '../../shared/errors/AppError';
import type { LawFileContent, LawFileStorage, StoredLawFile, UploadedLawFile } from './laws.types';
import { lawValidationError } from './laws.validator';

export const LAW_MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
export const LAW_STORAGE_PREFIX = '.private/laws';
const PDF_SIGNATURE = Buffer.from('%PDF-');
const LAW_STORAGE_PATH_PATTERN =
  /^\.private\/laws\/\d{4}\/\d{2}\/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.pdf$/i;

interface LocalLawFileStorageOptions {
  uploadDir: string;
  now?: () => Date;
  generateId?: () => string;
}

export class LocalLawFileStorage implements LawFileStorage {
  private readonly now: () => Date;
  private readonly generateId: () => string;

  constructor(private readonly options: LocalLawFileStorageOptions) {
    this.now = options.now ?? (() => new Date());
    this.generateId = options.generateId ?? randomUUID;
  }

  async save(file: UploadedLawFile): Promise<StoredLawFile> {
    validateLawPdf(file);

    const now = this.now();
    const year = String(now.getUTCFullYear()).padStart(4, '0');
    const month = String(now.getUTCMonth() + 1).padStart(2, '0');
    const storedFileName = `${this.generateId()}.pdf`;
    const storagePath = path.posix.join(LAW_STORAGE_PREFIX, year, month, storedFileName);
    const lexicalPath = resolveLawStoragePath(this.options.uploadDir, storagePath);

    await mkdir(this.options.uploadDir, { recursive: true });
    const canonicalUploadRoot = await realpath(this.options.uploadDir);
    const lexicalPrivateRoot = path.resolve(this.options.uploadDir, LAW_STORAGE_PREFIX);
    await mkdir(lexicalPrivateRoot, { recursive: true });
    const canonicalPrivateRoot = await realpath(lexicalPrivateRoot);
    assertStrictlyContained(canonicalUploadRoot, canonicalPrivateRoot);

    await mkdir(path.dirname(lexicalPath), { recursive: true });
    const canonicalParent = await realpath(path.dirname(lexicalPath));
    assertContained(canonicalPrivateRoot, canonicalParent);
    const absolutePath = path.join(canonicalParent, storedFileName);
    await writeFile(absolutePath, file.buffer, { flag: 'wx' });

    return {
      fileName: sanitizeOriginalFileName(file.originalName),
      fileSize: file.size,
      mimeType: 'application/pdf',
      storagePath,
    };
  }

  async remove(storagePath: string): Promise<void> {
    let absolutePath: string;
    try {
      absolutePath = await resolveExistingLawFilePath(this.options.uploadDir, storagePath);
    } catch (error) {
      if (error instanceof NotFoundError) return;
      throw error;
    }
    await unlink(absolutePath).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== 'ENOENT') throw error;
    });
  }

  async getContent(file: StoredLawFile): Promise<LawFileContent> {
    if (
      file.mimeType !== 'application/pdf' ||
      !Number.isSafeInteger(file.fileSize) ||
      file.fileSize <= 0 ||
      file.fileSize > LAW_MAX_FILE_SIZE_BYTES
    ) {
      throw new NotFoundError('Law file not found');
    }

    const filePath = await resolveExistingLawFilePath(this.options.uploadDir, file.storagePath);
    const fileInfo = await stat(filePath).catch(() => null);
    if (!fileInfo?.isFile() || fileInfo.size !== file.fileSize) {
      throw new NotFoundError('Law file not found');
    }

    return {
      filePath,
      fileName: file.fileName,
      fileSize: file.fileSize,
      mimeType: 'application/pdf',
    };
  }
}

export function validateLawPdf(file: UploadedLawFile): void {
  if (!Buffer.isBuffer(file.buffer) || file.buffer.length === 0) {
    throw lawValidationError({ file: 'กรุณาแนบไฟล์ PDF ที่มีข้อมูล' });
  }
  if (
    !Number.isSafeInteger(file.size) ||
    file.size <= 0 ||
    file.size > LAW_MAX_FILE_SIZE_BYTES ||
    file.buffer.length !== file.size
  ) {
    throw lawValidationError({ file: 'ไฟล์ต้องมีขนาดไม่เกิน 10 MB' });
  }
  if (file.mimeType !== 'application/pdf') {
    throw lawValidationError({ file: 'รองรับเฉพาะไฟล์ PDF' });
  }
  if (path.extname(file.originalName).toLowerCase() !== '.pdf') {
    throw lawValidationError({ file: 'นามสกุลไฟล์ต้องเป็น .pdf' });
  }
  if (
    file.buffer.length < PDF_SIGNATURE.length ||
    !file.buffer.subarray(0, PDF_SIGNATURE.length).equals(PDF_SIGNATURE)
  ) {
    throw lawValidationError({ file: 'ลายเซ็นไฟล์ PDF ไม่ถูกต้อง' });
  }
}

export function resolveLawStoragePath(uploadDir: string, storagePath: string): string {
  if (
    typeof storagePath !== 'string' ||
    storagePath.includes('\\') ||
    path.posix.isAbsolute(storagePath) ||
    path.posix.normalize(storagePath) !== storagePath ||
    !LAW_STORAGE_PATH_PATTERN.test(storagePath)
  ) {
    throw new NotFoundError('Law file not found');
  }

  const root = path.resolve(uploadDir, LAW_STORAGE_PREFIX);
  const resolved = path.resolve(uploadDir, ...storagePath.split('/'));
  assertContained(root, resolved);
  return resolved;
}

async function resolveExistingLawFilePath(uploadDir: string, storagePath: string): Promise<string> {
  const lexicalPath = resolveLawStoragePath(uploadDir, storagePath);
  const lexicalRoot = path.resolve(uploadDir, LAW_STORAGE_PREFIX);
  const canonicalUploadRoot = await realpath(uploadDir).catch(() => {
    throw new NotFoundError('Law file not found');
  });
  const canonicalRoot = await realpath(lexicalRoot).catch(() => {
    throw new NotFoundError('Law file not found');
  });
  assertStrictlyContained(canonicalUploadRoot, canonicalRoot);
  const canonicalPath = await realpath(lexicalPath).catch(() => {
    throw new NotFoundError('Law file not found');
  });
  assertContained(canonicalRoot, canonicalPath);
  return canonicalPath;
}

function assertContained(root: string, candidate: string): void {
  const relative = path.relative(root, candidate);
  if (
    relative === '' ||
    (relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative))
  ) {
    return;
  }
  throw new NotFoundError('Law file not found');
}

function assertStrictlyContained(root: string, candidate: string): void {
  const relative = path.relative(root, candidate);
  if (
    relative &&
    relative !== '..' &&
    !relative.startsWith(`..${path.sep}`) &&
    !path.isAbsolute(relative)
  ) {
    return;
  }
  throw new NotFoundError('Law file not found');
}

function sanitizeOriginalFileName(value: string): string {
  const baseName = path
    .basename(value.replace(/\\/g, '/'))
    .replace(/[\u0000-\u001f\u007f<>:"/\\|?*]/g, '_')
    .trim();
  const normalized = baseName.toLowerCase().endsWith('.pdf') ? baseName : 'document.pdf';
  if (normalized.length <= 255) return normalized;
  return `${normalized.slice(0, 251)}.pdf`;
}
