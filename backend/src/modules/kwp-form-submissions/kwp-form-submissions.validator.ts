import { z } from 'zod';
import { KWP01_ISSUE_REASONS } from './kwp-form-submissions.types';

const emptyStringToNull = (value: unknown) => {
  if (value === undefined || value === null) return value;
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const nullableText = (max: number) =>
  z.preprocess(emptyStringToNull, z.string().trim().min(1).max(max).nullable().optional());

const requiredText = (max: number) => z.string().trim().min(1).max(max);

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected date format YYYY-MM-DD');

const commonKwpSubmissionShape = {
  factoryId: requiredText(64),
  factoryName: requiredText(500),
  factoryRegistrationNo: nullableText(64),
  factoryAddress: nullableText(1000),
  industryType: nullableText(255),
  connectedPointId: z.coerce.number().int().positive().nullable().optional(),
  pointCode: nullableText(64),
  pointName: nullableText(255),
  pointType: nullableText(32),
  productionStack: nullableText(255),
  primaryFuel: nullableText(255),
  secondaryFuel: nullableText(255),
  combustionSystem: nullableText(64),
  productionCapacity: nullableText(255),
  productionCapacityUnit: nullableText(64),
  contactName: nullableText(255),
  contactPhone: nullableText(64),
  contactEmail: z.preprocess(
    emptyStringToNull,
    z.string().trim().email().max(255).nullable().optional(),
  ),
  reporterName: nullableText(255),
  reporterPosition: nullableText(255),
};

const kwpAttachmentSchema = z
  .object({
    attachmentType: requiredText(64),
    originalFileName: requiredText(500),
    storedFileName: nullableText(500),
    mimeType: nullableText(128),
    fileSize: z.coerce.number().int().min(0).nullable().optional(),
    storagePath: nullableText(1000),
  })
  .strict();

const kwpEmissionMeasurementItemSchema = z
  .object({
    pollutant: requiredText(255),
    sampleDate: z.preprocess(emptyStringToNull, isoDate.nullable().optional()),
    measuredValue: z
      .union([z.string().trim().min(1).max(100), z.coerce.number()])
      .nullable()
      .optional(),
    unit: nullableText(64),
    laboratoryNo: nullableText(100),
    reportNo: nullableText(100),
    method: nullableText(1000),
    attachments: z.array(kwpAttachmentSchema).max(20).optional().default([]),
  })
  .strict();

export const createKwp01SubmissionSchema = z
  .object({
    ...commonKwpSubmissionShape,
    issueReason: z.enum(KWP01_ISSUE_REASONS),
    reasonDetail: nullableText(2000),
    problemDate: z.preprocess(emptyStringToNull, isoDate.nullable().optional()),
    expectedDoneDate: z.preprocess(emptyStringToNull, isoDate.nullable().optional()),
    totalDays: z.coerce.number().int().min(0).max(366).nullable().optional(),
    unreportedParameters: z
      .array(requiredText(255))
      .max(100)
      .transform((parameters) => [...new Set(parameters)]),
    correctiveAction: nullableText(2000),
  })
  .strict()
  .refine(
    (value) => {
      if (!value.problemDate || !value.expectedDoneDate) return true;
      return value.expectedDoneDate >= value.problemDate;
    },
    {
      path: ['expectedDoneDate'],
      message: 'Expected done date must be on or after problem date',
    },
  );

export const createKwp02SubmissionSchema = z
  .object({
    ...commonKwpSubmissionShape,
    measurementItems: z.array(kwpEmissionMeasurementItemSchema).min(1).max(100),
  })
  .strict();

export const createKwp04SubmissionSchema = createKwp02SubmissionSchema;
