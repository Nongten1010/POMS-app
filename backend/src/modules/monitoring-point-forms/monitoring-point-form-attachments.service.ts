import { createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { mkdir, realpath, stat, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Knex } from 'knex';
import { StatusCodes } from 'http-status-codes';
import { db } from '../../config/database';
import { env } from '../../config/env';
import { logger } from '../../config/logger';
import {
  AppError,
  BadRequestError,
  ForbiddenError,
  NotFoundError,
} from '../../shared/errors/AppError';
import {
  MAX_MONITORING_POINT_ATTACHMENT_FILE_SIZE_BYTES,
  MONITORING_POINT_ATTACHMENT_FILE_TYPES,
} from './monitoring-point-attachments';

export const MONITORING_POINT_ATTACHMENTS_TABLE = 'factory_monitoring_point_attachments';
export const MONITORING_POINT_ATTACHMENT_PENDING_TTL_MS = 60 * 60 * 1000;
export const MONITORING_POINT_ATTACHMENT_FILE_URL_TTL_MS = 60 * 60 * 1000;
export const MONITORING_POINT_ATTACHMENT_CLEANUP_BATCH_SIZE = 100;

const STORAGE_PREFIX = '.private/monitoring-point-forms/attachments';
const MONITORING_POINT_ATTACHMENT_DELETION_RETRY_BATCH_SIZE = 20;
const UPLOAD_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SIGNATURE_PATTERN = /^[A-Za-z0-9_-]{43}$/;

const FILE_EXTENSIONS_BY_MIME_TYPE = {
  'image/jpeg': new Set(['.jpg', '.jpeg']),
  'image/png': new Set(['.png']),
  'application/pdf': new Set(['.pdf']),
} satisfies Record<(typeof MONITORING_POINT_ATTACHMENT_FILE_TYPES)[number], ReadonlySet<string>>;

export type MonitoringPointAttachmentMimeType =
  (typeof MONITORING_POINT_ATTACHMENT_FILE_TYPES)[number];

export const allowedMonitoringPointFormAttachmentFileTypes: ReadonlyMap<
  string,
  ReadonlySet<string>
> = new Map(
  MONITORING_POINT_ATTACHMENT_FILE_TYPES.map((mimeType) => [
    mimeType,
    FILE_EXTENSIONS_BY_MIME_TYPE[mimeType],
  ]),
);

export interface MonitoringPointAttachmentRow {
  id: number | string;
  public_id: string;
  claim_token_hash: Buffer;
  monitoring_point_id: number | string | null;
  original_file_name: string;
  mime_type: MonitoringPointAttachmentMimeType;
  file_size: number | string;
  storage_path: string;
  sort_order: number | string | null;
  expires_at: Date | string;
  claimed_at: Date | string | null;
  created_at: Date | string;
  updated_at: Date | string;
  created_by: number | string;
  updated_by: number | string | null;
  deleted_at: Date | string | null;
}

export interface UploadedMonitoringPointFormAttachmentFile {
  buffer: Buffer;
  originalName: string;
  mimeType: string;
  size: number;
}

export interface StoredMonitoringPointFormAttachment {
  uploadToken: string;
  fileName: string;
  fileType: MonitoringPointAttachmentMimeType;
  fileSize: number;
  expiresAt: string;
}

export interface MonitoringPointAttachmentFileAccess {
  fileUrl: string;
  fileUrlExpiresAt: string;
}

export interface MonitoringPointAttachmentContent {
  filePath: string;
  fileName: string;
  fileType: MonitoringPointAttachmentMimeType;
  fileSize: number;
  urlExpiresAt: Date;
}

interface MonitoringPointFormAttachmentStorageOptions {
  uploadDir: string;
  signingSecret: string;
  apiPrefix: string;
  database?: Knex;
  now?: () => Date;
  pendingTtlMs?: number;
  fileUrlTtlMs?: number;
}

interface BuildFileAccessOptions {
  apiPrefix?: string;
  signingSecret?: string;
  ttlMs?: number;
}

interface CleanupCandidateRow {
  id: number | string;
  storage_path: string;
}

interface DownloadableAttachmentRow {
  original_file_name: string;
  mime_type: MonitoringPointAttachmentMimeType;
  file_size: number | string;
  storage_path: string;
}

export class LocalMonitoringPointFormAttachmentStorage {
  private readonly database: Knex;
  private readonly now: () => Date;
  private readonly pendingTtlMs: number;
  private readonly fileUrlTtlMs: number;

  constructor(private readonly options: MonitoringPointFormAttachmentStorageOptions) {
    this.database = options.database ?? db;
    this.now = options.now ?? (() => new Date());
    this.pendingTtlMs = options.pendingTtlMs ?? MONITORING_POINT_ATTACHMENT_PENDING_TTL_MS;
    this.fileUrlTtlMs = options.fileUrlTtlMs ?? MONITORING_POINT_ATTACHMENT_FILE_URL_TTL_MS;
  }

  async save(
    file: UploadedMonitoringPointFormAttachmentFile,
    actorUserId: number,
  ): Promise<StoredMonitoringPointFormAttachment> {
    const fileType = validateMonitoringPointFormAttachmentFile(file);
    if (!Number.isInteger(actorUserId) || actorUserId <= 0) {
      throw new Error('Authenticated user id is required');
    }

    await this.cleanupExpiredAndOrphaned().catch((error: unknown) => {
      logger.warn('[monitoring-point-attachments] Opportunistic cleanup failed', { error });
    });

    const now = this.now();
    const pendingExpiresAt = new Date(now.getTime() + this.pendingTtlMs);
    const uploadToken = randomBytes(32).toString('base64url');
    const publicId = randomUUID();
    const yyyy = String(now.getFullYear());
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const extension = path.extname(file.originalName).toLowerCase();
    const storedFileName = `${randomUUID()}${extension}`;
    const storagePath = path.posix.join(STORAGE_PREFIX, yyyy, mm, storedFileName);
    const absolutePath = resolveMonitoringPointAttachmentStoragePath(
      this.options.uploadDir,
      storagePath,
    );
    const fileName = sanitizeOriginalFileName(file.originalName);
    const claimTokenHash = hashMonitoringPointAttachmentUploadToken(uploadToken);

    await this.database<MonitoringPointAttachmentRow>(MONITORING_POINT_ATTACHMENTS_TABLE).insert({
      public_id: publicId,
      claim_token_hash: claimTokenHash,
      monitoring_point_id: null,
      original_file_name: fileName,
      mime_type: fileType,
      file_size: file.size,
      storage_path: storagePath,
      sort_order: null,
      expires_at: pendingExpiresAt,
      claimed_at: null,
      created_by: actorUserId,
      updated_by: actorUserId,
    });

    try {
      await mkdir(path.dirname(absolutePath), { recursive: true });
      await writeFile(absolutePath, file.buffer, { flag: 'wx' });
    } catch (error) {
      await this.compensateFailedWrite(publicId, claimTokenHash, absolutePath, now).catch(
        (compensationError: unknown) => {
          logger.warn('[monitoring-point-attachments] Failed to compensate file write', {
            publicId,
            error: compensationError,
          });
        },
      );
      throw error;
    }

    return {
      uploadToken,
      fileName,
      fileType,
      fileSize: file.size,
      expiresAt: pendingExpiresAt.toISOString(),
    };
  }

  async getContent(
    publicId: unknown,
    expires: unknown,
    signature: unknown,
  ): Promise<MonitoringPointAttachmentContent> {
    const normalizedPublicId = validatePublicId(publicId);
    const urlExpiresAt = verifyMonitoringPointAttachmentFileAccess(
      normalizedPublicId,
      expires,
      signature,
      this.options.signingSecret,
      this.now(),
      this.fileUrlTtlMs,
    );

    const row = await this.database<DownloadableAttachmentRow>(
      `${MONITORING_POINT_ATTACHMENTS_TABLE} as attachment`,
    )
      .innerJoin('factory_monitoring_points as point', 'point.id', 'attachment.monitoring_point_id')
      .innerJoin('factory_monitoring_point_forms as form', 'form.id', 'point.form_id')
      .select(
        'attachment.original_file_name',
        'attachment.mime_type',
        'attachment.file_size',
        'attachment.storage_path',
      )
      .where('attachment.public_id', normalizedPublicId)
      .whereNotNull('attachment.monitoring_point_id')
      .whereNotNull('attachment.claimed_at')
      .whereNull('attachment.deleted_at')
      .whereNull('point.deleted_at')
      .whereNull('form.deleted_at')
      .first();

    if (!row) throw new NotFoundError('Attachment not found');

    const absolutePath = await resolveExistingMonitoringPointAttachmentPath(
      this.options.uploadDir,
      row.storage_path,
    ).catch(() => {
      throw new NotFoundError('Attachment file not found');
    });
    const fileInfo = await stat(absolutePath).catch(() => null);
    const expectedFileSize = Number(row.file_size);
    if (!fileInfo?.isFile() || fileInfo.size !== expectedFileSize) {
      throw new NotFoundError('Attachment file not found');
    }

    return {
      filePath: absolutePath,
      fileName: row.original_file_name,
      fileType: row.mime_type,
      fileSize: expectedFileSize,
      urlExpiresAt,
    };
  }

  async cleanupExpiredAndOrphaned(): Promise<number> {
    const now = this.now();
    const candidates = await this.database.transaction(async (trx) => {
      const deletionRetryRows = await trx<CleanupCandidateRow>(MONITORING_POINT_ATTACHMENTS_TABLE)
        .select('id', 'storage_path')
        .whereNotNull('deleted_at')
        .orderBy('id', 'asc')
        .limit(MONITORING_POINT_ATTACHMENT_DELETION_RETRY_BATCH_SIZE);

      const markedRows: CleanupCandidateRow[] = [...deletionRetryRows];
      let remaining = MONITORING_POINT_ATTACHMENT_CLEANUP_BATCH_SIZE - markedRows.length;
      if (remaining <= 0) return markedRows;

      const expiredPendingRows = await trx<CleanupCandidateRow>(
        trx.raw('?? WITH (UPDLOCK, READPAST, ROWLOCK, READCOMMITTEDLOCK)', [
          MONITORING_POINT_ATTACHMENTS_TABLE,
        ]) as unknown as string,
      )
        .select('id', 'storage_path')
        .whereNull('monitoring_point_id')
        .whereNull('claimed_at')
        .whereNull('deleted_at')
        .where('expires_at', '<=', now)
        .orderBy('id', 'asc')
        .limit(remaining);

      for (const row of expiredPendingRows) {
        const affected = await trx(MONITORING_POINT_ATTACHMENTS_TABLE)
          .where('id', row.id)
          .whereNull('monitoring_point_id')
          .whereNull('claimed_at')
          .whereNull('deleted_at')
          .where('expires_at', '<=', now)
          .update({ deleted_at: now, updated_at: now });
        if (affected === 1) markedRows.push(row);
      }

      remaining = MONITORING_POINT_ATTACHMENT_CLEANUP_BATCH_SIZE - markedRows.length;
      if (remaining <= 0) return markedRows;

      const orphanedRows = await trx<CleanupCandidateRow>(
        `${MONITORING_POINT_ATTACHMENTS_TABLE} as attachment`,
      )
        .leftJoin(
          'factory_monitoring_points as point',
          'point.id',
          'attachment.monitoring_point_id',
        )
        .leftJoin('factory_monitoring_point_forms as form', 'form.id', 'point.form_id')
        .select('attachment.id', 'attachment.storage_path')
        .whereNull('attachment.deleted_at')
        .whereNotNull('attachment.monitoring_point_id')
        .whereNotNull('attachment.claimed_at')
        .where((parentQuery) => {
          parentQuery
            .whereNull('point.id')
            .orWhereNotNull('point.deleted_at')
            .orWhereNull('form.id')
            .orWhereNotNull('form.deleted_at');
        })
        .orderBy('attachment.id', 'asc')
        .limit(remaining);

      for (const row of orphanedRows) {
        const affected = await trx(MONITORING_POINT_ATTACHMENTS_TABLE)
          .where('id', row.id)
          .whereNull('deleted_at')
          .whereNotNull('monitoring_point_id')
          .whereNotNull('claimed_at')
          .whereNotExists((activeParentQuery) => {
            activeParentQuery
              .select(trx.raw('1'))
              .from('factory_monitoring_points as point')
              .innerJoin('factory_monitoring_point_forms as form', 'form.id', 'point.form_id')
              .whereRaw(`point.id = ${MONITORING_POINT_ATTACHMENTS_TABLE}.monitoring_point_id`)
              .whereNull('point.deleted_at')
              .whereNull('form.deleted_at');
          })
          .update({ deleted_at: now, updated_at: now });
        if (affected === 1) markedRows.push(row);
      }
      return markedRows;
    });

    const removedRowIds: Array<number | string> = [];
    for (const candidate of candidates) {
      try {
        const absolutePath = await resolveExistingMonitoringPointAttachmentPath(
          this.options.uploadDir,
          candidate.storage_path,
        );
        await unlink(absolutePath);
        removedRowIds.push(candidate.id);
      } catch (error) {
        if (error instanceof NotFoundError || isFileNotFoundError(error)) {
          removedRowIds.push(candidate.id);
          continue;
        }
        logger.warn('[monitoring-point-attachments] Failed to remove stale file', {
          attachmentId: candidate.id,
          error,
        });
      }
    }

    if (removedRowIds.length > 0) {
      await this.database(MONITORING_POINT_ATTACHMENTS_TABLE)
        .whereIn('id', removedRowIds)
        .whereNotNull('deleted_at')
        .delete();
    }
    return removedRowIds.length;
  }

  private async compensateFailedWrite(
    publicId: string,
    claimTokenHash: Buffer,
    absolutePath: string,
    now: Date,
  ): Promise<void> {
    let fileRemoved = false;
    try {
      await unlink(absolutePath);
      fileRemoved = true;
    } catch (error) {
      fileRemoved = isFileNotFoundError(error);
    }

    const pendingRow = this.database(MONITORING_POINT_ATTACHMENTS_TABLE)
      .where('public_id', publicId)
      .where('claim_token_hash', claimTokenHash)
      .whereNull('monitoring_point_id')
      .whereNull('claimed_at')
      .whereNull('deleted_at');
    if (fileRemoved) {
      await pendingRow.delete();
      return;
    }
    await pendingRow.update({ deleted_at: now, updated_at: now });
  }
}

export function createMonitoringPointFormAttachmentStorage(
  options: MonitoringPointFormAttachmentStorageOptions,
): LocalMonitoringPointFormAttachmentStorage {
  return new LocalMonitoringPointFormAttachmentStorage(options);
}

export function hashMonitoringPointAttachmentUploadToken(uploadToken: string): Buffer {
  if (!UPLOAD_TOKEN_PATTERN.test(uploadToken)) {
    throw new BadRequestError('Invalid attachment upload token');
  }
  return createHash('sha256').update(uploadToken, 'utf8').digest();
}

export function buildMonitoringPointAttachmentFileAccess(
  publicId: string,
  now: Date = new Date(),
  options: BuildFileAccessOptions = {},
): MonitoringPointAttachmentFileAccess {
  const normalizedPublicId = validatePublicId(publicId);
  const ttlMs = options.ttlMs ?? MONITORING_POINT_ATTACHMENT_FILE_URL_TTL_MS;
  const expires = Math.floor((now.getTime() + ttlMs) / 1000);
  const apiPrefix = (options.apiPrefix ?? env.API_PREFIX).replace(/\/+$/, '');
  const signingSecret = options.signingSecret ?? env.JWT_SECRET;
  const signature = signFileAccess(normalizedPublicId, expires, signingSecret);
  return {
    fileUrl: `${apiPrefix}/monitoring-point-forms/attachments/${normalizedPublicId}/content?expires=${expires}&signature=${signature}`,
    fileUrlExpiresAt: new Date(expires * 1000).toISOString(),
  };
}

export function resolveMonitoringPointAttachmentStoragePath(
  uploadDir: string,
  storagePath: string,
): string {
  if (
    !storagePath.startsWith(`${STORAGE_PREFIX}/`) ||
    storagePath.includes('\\') ||
    path.posix.normalize(storagePath) !== storagePath ||
    path.posix.isAbsolute(storagePath)
  ) {
    throw new NotFoundError('Attachment file not found');
  }

  const root = path.resolve(uploadDir);
  const absolutePath = path.resolve(root, ...storagePath.split('/'));
  const relativePath = path.relative(root, absolutePath);
  if (!relativePath || relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    throw new NotFoundError('Attachment file not found');
  }
  return absolutePath;
}

function validateMonitoringPointFormAttachmentFile(
  file: UploadedMonitoringPointFormAttachmentFile,
): MonitoringPointAttachmentMimeType {
  if (!Buffer.isBuffer(file.buffer) || file.buffer.length === 0) {
    throw new BadRequestError('Uploaded file is empty');
  }

  if (
    !Number.isInteger(file.size) ||
    file.size <= 0 ||
    file.size > MAX_MONITORING_POINT_ATTACHMENT_FILE_SIZE_BYTES
  ) {
    throw new BadRequestError('Uploaded file size must be between 1 byte and 10 MB');
  }

  if (file.buffer.length !== file.size) {
    throw new BadRequestError('Uploaded file size does not match file content');
  }

  const allowedExtensions = allowedMonitoringPointFormAttachmentFileTypes.get(file.mimeType);
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

  return file.mimeType as MonitoringPointAttachmentMimeType;
}

function verifyMonitoringPointAttachmentFileAccess(
  publicId: string,
  expiresValue: unknown,
  signatureValue: unknown,
  signingSecret: string,
  now: Date,
  maximumTtlMs: number,
): Date {
  if (typeof expiresValue !== 'string' || !/^\d{10}$/.test(expiresValue)) {
    throw new BadRequestError('Invalid attachment URL expiry');
  }
  if (typeof signatureValue !== 'string' || !SIGNATURE_PATTERN.test(signatureValue)) {
    throw new BadRequestError('Invalid attachment URL signature');
  }

  const expires = Number(expiresValue);
  if (!Number.isSafeInteger(expires)) {
    throw new BadRequestError('Invalid attachment URL expiry');
  }
  const expectedSignature = Buffer.from(signFileAccess(publicId, expires, signingSecret));
  const suppliedSignature = Buffer.from(signatureValue);
  if (
    expectedSignature.length !== suppliedSignature.length ||
    !timingSafeEqual(expectedSignature, suppliedSignature)
  ) {
    throw new ForbiddenError('Invalid attachment URL signature');
  }

  const nowSeconds = Math.floor(now.getTime() / 1000);
  if (expires <= nowSeconds) {
    throw new AppError('Attachment URL has expired', StatusCodes.GONE, 'ATTACHMENT_URL_EXPIRED');
  }
  if (expires > Math.floor((now.getTime() + maximumTtlMs) / 1000) + 1) {
    throw new BadRequestError('Invalid attachment URL expiry');
  }
  return new Date(expires * 1000);
}

function signFileAccess(publicId: string, expires: number, signingSecret: string): string {
  return createHmac('sha256', signingSecret)
    .update(`monitoring-point-attachment\n${publicId}\n${expires}`, 'utf8')
    .digest('base64url');
}

function validatePublicId(value: unknown): string {
  if (typeof value !== 'string' || !UUID_PATTERN.test(value)) {
    throw new BadRequestError('Invalid attachment public id');
  }
  return value.toLowerCase();
}

async function resolveExistingMonitoringPointAttachmentPath(
  uploadDir: string,
  storagePath: string,
): Promise<string> {
  const lexicalPath = resolveMonitoringPointAttachmentStoragePath(uploadDir, storagePath);
  const [rootPath, filePath] = await Promise.all([
    realpath(path.resolve(uploadDir)),
    realpath(lexicalPath),
  ]);
  const relativePath = path.relative(rootPath, filePath);
  if (!relativePath || relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    throw new NotFoundError('Attachment file not found');
  }
  return filePath;
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
  if (!baseName) return 'uploaded-file';
  if (baseName.length <= 255) return baseName;

  const extension = path.extname(baseName);
  return `${baseName.slice(0, 255 - extension.length)}${extension}`;
}

function isFileNotFoundError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error.code === 'ENOENT' || error.code === 'ENOTDIR')
  );
}
