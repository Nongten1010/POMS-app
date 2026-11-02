import path from 'node:path';
import type { Request, RequestHandler, Response } from 'express';
import type { FileFilterCallback } from 'multer';
import { logger } from '../../config/logger';
import { validateUploadFileMetadata } from '../utils/upload-file-policy';

interface FileMetadata {
  fileExtension: string | null;
  declaredMimeType: string;
}

interface UploadObservation {
  endpoint: string;
  files: FileMetadata[];
  reasonCode: string;
  errorCode: string | null;
  logged: boolean;
}

const observations = new WeakMap<Request, UploadObservation>();
const MAX_LOGGED_FILES = 10;
const knownExtensions = new Set(
  'pdf png jpg jpeg jfif gif webp bmp tif tiff heic avif txt csv json xml mp3 wav ogg mp4 mov webm zip docx xlsx pptx ppsx odt ods odp doc xls ppt rtf exe dll com scr msi apk jar wasm bat cmd ps1 sh js mjs cjs ts py php html htm svg docm xlsm pptm xlsb rar 7z gz tar env'.split(
    ' ',
  ),
);
const knownMimeTypes = new Set([
  'application/pdf',
  'application/octet-stream',
  'application/zip',
  'application/x-zip-compressed',
  'application/json',
  'application/xml',
  'application/javascript',
  'application/x-msdownload',
  'application/x-dosexec',
  'application/msword',
  'application/vnd.ms-excel',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.oasis.opendocument.text',
  'application/vnd.oasis.opendocument.spreadsheet',
  'application/vnd.oasis.opendocument.presentation',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/bmp',
  'image/tiff',
  'image/heic',
  'image/avif',
  'image/svg+xml',
  'text/plain',
  'text/csv',
  'text/xml',
  'text/html',
  'text/javascript',
  'audio/mpeg',
  'audio/wav',
  'audio/ogg',
  'video/mp4',
  'video/quicktime',
  'video/webm',
]);
const knownErrorCodes = new Set([
  'BAD_REQUEST',
  'UPLOAD_ERROR',
  'FILE_UPLOAD_FAILED',
  'VALIDATION_ERROR',
  'UNAUTHORIZED',
  'FORBIDDEN',
  'INTERNAL_ERROR',
  'RATE_LIMITED',
  'TOO_MANY_REQUESTS',
  'NOT_FOUND',
  'CONFLICT',
]);
const multerReasons = new Set([
  'LIMIT_PART_COUNT',
  'LIMIT_FILE_SIZE',
  'LIMIT_FILE_COUNT',
  'LIMIT_FIELD_KEY',
  'LIMIT_FIELD_VALUE',
  'LIMIT_FIELD_COUNT',
  'LIMIT_UNEXPECTED_FILE',
  'MISSING_FIELD_NAME',
]);
const messageReasons = new Map([
  ['Invalid uploaded file name', 'FILE_NAME_INVALID'],
  ['Uploaded file must have a valid extension', 'FILE_EXTENSION_INVALID'],
  ['Programs, scripts, macros and uninspectable archives are not allowed', 'BLOCKED_FILE_TYPE'],
  [
    'Executable, legacy Office or uninspectable archive content is not allowed',
    'EXECUTABLE_OR_UNINSPECTABLE_CONTENT',
  ],
  ['Script or active web content is not allowed', 'ACTIVE_WEB_CONTENT'],
  ['Uploaded file content does not match its declared type', 'FILE_TYPE_MISMATCH'],
  ['PDF active content or embedded files are not allowed', 'PDF_ACTIVE_CONTENT'],
  ['Invalid, encrypted or unsupported PDF file', 'PDF_UNREADABLE'],
  ['TXT files must contain UTF-8 text', 'TEXT_ENCODING_INVALID'],
  ['TXT files must contain text', 'TEXT_CONTENT_INVALID'],
  ['Uploaded file is empty', 'FILE_EMPTY'],
  ['Uploaded file size does not match file content', 'FILE_SIZE_MISMATCH'],
  ['Attachment metadata does not match the uploaded file', 'METADATA_INVALID'],
  ['Archive nesting limit exceeded', 'ARCHIVE_REJECTED'],
  ['Archive inspection limit exceeded', 'ARCHIVE_REJECTED'],
  ['Invalid or unsupported ZIP file', 'ARCHIVE_REJECTED'],
  ['Encrypted, duplicate or unsafe archive entry is not allowed', 'ARCHIVE_REJECTED'],
  ['Inconsistent ZIP entry headers are not allowed', 'ARCHIVE_REJECTED'],
  ['Archive directories must not contain data', 'ARCHIVE_REJECTED'],
  ['Invalid nested ZIP or Office file', 'ARCHIVE_REJECTED'],
  ['Office macros, scripts or embedded objects are not allowed', 'OFFICE_ACTIVE_CONTENT'],
  ['Office macros are not allowed', 'OFFICE_ACTIVE_CONTENT'],
]);

function record(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

function rejectionReason(error: Record<string, unknown>): string {
  const details = record(error.details);
  if (typeof details?.reason === 'string' && multerReasons.has(details.reason)) {
    return details.reason;
  }
  // Only known messages become reason codes. Error bodies are never retained or logged.
  for (const candidate of [error.message, details?.file, details?.files]) {
    if (typeof candidate !== 'string') continue;
    const known = messageReasons.get(candidate);
    if (known) return known;
    if (
      /^Uploaded file (?:must contain 1 byte to [\d.]+ MB and match its declared size|size must be between 1 byte and [\d.]+ MB)$/.test(
        candidate,
      )
    ) {
      return 'FILE_SIZE_INVALID';
    }
    if (candidate === 'link must be a valid URL') return 'METADATA_INVALID';
  }
  return error.code === 'VALIDATION_ERROR' ? 'REQUEST_VALIDATION_FAILED' : 'UPLOAD_REJECTED';
}

function endpointFor(req: Request, apiPrefix: string): string | undefined {
  const pathname = req.path.replace(/\/+$/, '').toLowerCase();
  const prefix = apiPrefix.replace(/\/+$/, '');
  if (!pathname.startsWith(`${prefix.toLowerCase()}/`)) return undefined;
  const relativePath = pathname.slice(prefix.length);
  if (
    req.method === 'POST' &&
    [
      '/cems-wpms-requests/document-images',
      '/poms-factories/document-images',
      '/monitoring-point-forms/attachments',
      '/bod-cod-deviation-reports/attachments',
      '/kwp-form-submissions/attachments',
      '/laws',
      '/faqs',
    ].includes(relativePath)
  ) {
    return `${prefix}${relativePath}`;
  }
  const resource = /^\/(laws|faqs)\/[^/]+$/.exec(relativePath);
  return req.method === 'PUT' && resource ? `${prefix}/${resource[1]}/:id` : undefined;
}

function safeSize(value: unknown): number | null {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null;
}

function declaredRequestBytes(req: Request): number | null {
  const value = req.get('content-length');
  return value && /^(?:0|[1-9]\d{0,15})$/.test(value) ? safeSize(Number(value)) : null;
}

export function captureUploadFileMetadata(
  req: Request,
  file: Pick<Express.Multer.File, 'originalname' | 'mimetype'>,
): void {
  const observation = observations.get(req);
  if (!observation || observation.files.length >= MAX_LOGGED_FILES) return;
  const extension = path.posix
    .extname(file.originalname.replace(/\\/g, '/'))
    .slice(1)
    .toLowerCase();
  const mimeType = file.mimetype.toLowerCase();
  observation.files.push({
    fileExtension: extension ? (knownExtensions.has(extension) ? `.${extension}` : 'other') : null,
    declaredMimeType: knownMimeTypes.has(mimeType) ? mimeType : 'other',
  });
}

export function validateUploadMetadataFileFilter(
  req: Request,
  file: Express.Multer.File,
  callback: FileFilterCallback,
): void {
  captureUploadFileMetadata(req, file);
  try {
    validateUploadFileMetadata(file.originalname, file.mimetype);
    callback(null, true);
  } catch (error) {
    callback(error instanceof Error ? error : new Error('Invalid uploaded file'));
  }
}

export function createUploadRejectionObserver(apiPrefix: string): RequestHandler {
  return (req, res, next) => {
    const endpoint = endpointFor(req, apiPrefix);
    if (!endpoint) {
      next();
      return;
    }
    const observation: UploadObservation = {
      endpoint,
      files: [],
      reasonCode: 'UPLOAD_REJECTED',
      errorCode: null,
      logged: false,
    };
    observations.set(req, observation);
    const originalJson = res.json;
    res.json = function observeError(this: Response, body: unknown): Response {
      const error = record(record(body)?.error);
      if (this.statusCode >= 400 && error) {
        observation.reasonCode = rejectionReason(error);
        observation.errorCode =
          typeof error.code === 'string' && knownErrorCodes.has(error.code) ? error.code : 'OTHER';
      }
      return originalJson.call(this, body);
    };

    const writeRejection = (status: number | null, aborted = false): void => {
      if (observation.logged) return;
      observation.logged = true;
      const receivedFiles = req.file ? [req.file] : Array.isArray(req.files) ? req.files : [];
      const files = observation.files.map((file, index) => ({
        ...file,
        fileSize: safeSize(receivedFiles[index]?.size),
      }));
      const singleFile = files.length === 1 ? files[0] : undefined;
      try {
        logger.warn('upload.rejected', {
          event: 'upload.rejected',
          endpoint: observation.endpoint,
          method: req.method,
          status,
          reasonCode: aborted ? 'REQUEST_ABORTED' : observation.reasonCode,
          errorCode: observation.errorCode,
          fileExtension: singleFile?.fileExtension ?? null,
          declaredMimeType: singleFile?.declaredMimeType ?? null,
          fileSize: singleFile?.fileSize ?? null,
          declaredRequestBytes: declaredRequestBytes(req),
          fileCount: files.length,
          ...(files.length > 1 ? { files } : {}),
        });
      } catch {
        // Diagnostic transport failures must not change upload handling or crash the server.
      }
    };
    res.once('finish', () => {
      if (res.statusCode >= 400) writeRejection(res.statusCode);
    });
    res.once('close', () => {
      if (!res.writableFinished) writeRejection(null, true);
    });
    next();
  };
}
