import { z } from 'zod';
import { MAX_DOCUMENT_FILE_SIZE_BYTES } from '../connection-requests/connection-request-document-image.service';
import { CONNECTION_REQUEST_EIA_ASSESSMENTS } from '../connection-requests/connection-request-eia';
import type { RequestDocumentImageInput } from '../connection-requests/connection-requests.types';
import { POMS_FACTORY_EDIT_REQUEST_STATUS } from './poms-factories.types';

const trimmedString = (max: number) => z.string().trim().min(1).max(max);
const optionalNullableTrimmedString = (max: number) =>
  z.preprocess((value) => {
    if (value === undefined || value === null) return value;
    if (typeof value !== 'string') return value;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }, z.string().trim().min(1).max(max).nullable().optional());
const httpUrl = (max: number) =>
  z
    .string()
    .trim()
    .url()
    .max(max)
    .refine((value) => {
      try {
        const protocol = new URL(value).protocol;
        return protocol === 'http:' || protocol === 'https:';
      } catch {
        return false;
      }
    }, 'URL must use http or https');

const requestDocumentImageSchema: z.ZodType<RequestDocumentImageInput> = z
  .object({
    title: trimmedString(255),
    description: optionalNullableTrimmedString(1000),
    link: httpUrl(2048).nullable().optional(),
    fileName: optionalNullableTrimmedString(255),
    fileUrl: httpUrl(2048).nullable().optional(),
    fileType: optionalNullableTrimmedString(128),
    fileSize: z.number().int().min(1).max(MAX_DOCUMENT_FILE_SIZE_BYTES).nullable().optional(),
  })
  .strict()
  .superRefine((document, ctx) => {
    if (document.link || document.fileUrl) return;
    ctx.addIssue({
      code: 'custom',
      path: ['fileUrl'],
      message: 'Document must include link or fileUrl',
    });
  })
  .transform((document) => ({
    ...document,
    description: document.description ?? null,
    link: document.link ?? null,
    fileName: document.fileName ?? null,
    fileUrl: document.fileUrl ?? null,
    fileType: document.fileType ?? null,
    fileSize: document.fileSize ?? null,
  }));

export const pomsFactoryIdParamsSchema = z
  .object({
    factoryId: z.string().trim().min(1).max(64),
  })
  .strict();

export const pomsFactoryEditRequestIdParamsSchema = z
  .object({
    id: z.coerce.number().int().positive(),
  })
  .strict();

export const listPomsFactoriesQuerySchema = z
  .object({
    search: z.string().trim().min(1).max(255).optional(),
  })
  .strict();

export const listPomsFactoryEditRequestsQuerySchema = z
  .object({
    status: z.enum(POMS_FACTORY_EDIT_REQUEST_STATUS).optional(),
    factoryId: z.string().trim().min(1).max(64).optional(),
    search: z.string().trim().min(1).max(255).optional(),
  })
  .strict();

const editableFactoryProfileSchema = z
  .object({
    factoryName: trimmedString(500),
    factoryAddress: optionalNullableTrimmedString(1000),
    latitude: z.number().finite().min(-90).max(90).nullable().optional(),
    longitude: z.number().finite().min(-180).max(180).nullable().optional(),
    eia: z.enum(CONNECTION_REQUEST_EIA_ASSESSMENTS).nullable().optional(),
    eiaOther: optionalNullableTrimmedString(500),
    projectName: optionalNullableTrimmedString(500),
    factoryFrontPhotos: z.array(requestDocumentImageSchema).max(10).optional(),
    factoryLogo: requestDocumentImageSchema.nullable().optional(),
    note: optionalNullableTrimmedString(1000),
  })
  .strict()
  .superRefine((value, ctx) => {
    const hasLatitude = Object.prototype.hasOwnProperty.call(value, 'latitude');
    const hasLongitude = Object.prototype.hasOwnProperty.call(value, 'longitude');
    if (hasLatitude !== hasLongitude || (value.latitude === null) !== (value.longitude === null)) {
      ctx.addIssue({
        code: 'custom',
        path: hasLatitude ? ['longitude'] : ['latitude'],
        message: 'latitude and longitude must be provided or cleared together',
      });
    }

    const hasEia = Object.prototype.hasOwnProperty.call(value, 'eia');
    const hasEiaOther = Object.prototype.hasOwnProperty.call(value, 'eiaOther');
    if (value.eia === 'อื่นๆ' && !value.eiaOther) {
      ctx.addIssue({
        code: 'custom',
        path: ['eiaOther'],
        message: 'eiaOther is required when eia is อื่นๆ',
      });
    }
    if (hasEiaOther && (!hasEia || value.eia !== 'อื่นๆ') && value.eiaOther !== null) {
      ctx.addIssue({
        code: 'custom',
        path: ['eiaOther'],
        message: 'eiaOther is only allowed when eia is อื่นๆ',
      });
    }
  });

export const createPomsFactoryEditRequestSchema = editableFactoryProfileSchema;
export const resubmitPomsFactoryEditRequestSchema = editableFactoryProfileSchema;

export const reviewPomsFactoryEditRequestSchema = z
  .object({
    decision: z.enum(['APPROVE', 'REQUEST_REVISION', 'REJECT']),
    revisionReason: optionalNullableTrimmedString(1000),
    officerNote: optionalNullableTrimmedString(1000),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.decision === 'REQUEST_REVISION' && !value.revisionReason) {
      ctx.addIssue({
        code: 'custom',
        path: ['revisionReason'],
        message: 'revisionReason is required when requesting a revision',
      });
    }
    if (value.decision !== 'REQUEST_REVISION' && value.revisionReason) {
      ctx.addIssue({
        code: 'custom',
        path: ['revisionReason'],
        message: 'revisionReason is only allowed for REQUEST_REVISION',
      });
    }
    if (value.decision === 'REJECT' && !value.officerNote) {
      ctx.addIssue({
        code: 'custom',
        path: ['officerNote'],
        message: 'officerNote is required when rejecting a request',
      });
    }
  });
