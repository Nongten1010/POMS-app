import { z } from 'zod';
import { BOD_COD_DEVIATION_REPORT_STATUSES } from './bod-cod-deviation-reports.types';

const emptyStringToUndefined = (value: unknown) => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
};

const emptyStringToNull = (value: unknown) => {
  if (value === undefined || value === null) return value;
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const requiredText = (max: number) => z.string().trim().min(1).max(max);
const blankableRequiredText = (max: number) => z.string().trim().max(max);
const nullableText = (max: number) =>
  z.preprocess(emptyStringToNull, z.string().trim().min(1).max(max).nullable().optional());
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected date format YYYY-MM-DD');
const timeOfDay = z.string().regex(/^\d{2}:\d{2}$/, 'Expected time format HH:mm');
const decimalValue = z.coerce.number().finite();
const nullableDecimalValue = z.coerce.number().finite().nullable().optional();

export const listBodCodDeviationReportsQuerySchema = z
  .object({
    status: z.preprocess(
      emptyStringToUndefined,
      z.enum(BOD_COD_DEVIATION_REPORT_STATUSES).optional(),
    ),
    parameterCode: z.preprocess(emptyStringToUndefined, z.enum(['BOD', 'COD']).optional()),
    factoryId: z.preprocess(emptyStringToUndefined, z.string().trim().min(1).max(64).optional()),
  })
  .strict();

export const bodCodDeviationReportIdParamsSchema = z
  .object({
    id: z.coerce.number().int().positive(),
  })
  .strict();

const bodCodDeviationMeasurementSchema = z
  .object({
    sampleDate: isoDate,
    sampleTime: timeOfDay,
    deviceValueMgL: decimalValue,
    labValueMgL: decimalValue,
    standardDeviationMgL: nullableDecimalValue,
  })
  .strict();

const bodCodDeviationAttachmentSchema = z
  .object({
    attachmentType: z.enum(['SAMPLE_PHOTO', 'DEVICE_PHOTO', 'LAB_REPORT']),
    originalFileName: requiredText(500),
    storedFileName: nullableText(500),
    mimeType: nullableText(128),
    fileSize: z.coerce.number().int().min(0).nullable().optional(),
    storagePath: nullableText(1000),
  })
  .strict();

export const createBodCodDeviationReportSchema = z
  .object({
    reportRoundNo: z.coerce.number().int().min(1).max(2),
    reportYear: z.coerce.number().int().min(2500).max(2700),
    factoryId: nullableText(64),
    factoryName: requiredText(500),
    factoryRegistrationNo: requiredText(80),
    businessActivity: nullableText(255),
    factoryAddress: nullableText(1000),
    provinceName: requiredText(120),
    connectedMeasurementPointId: z.coerce.number().int().positive().nullable().optional(),
    pointCode: nullableText(64),
    pointName: nullableText(255),
    wastewaterFlowM3PerHour: nullableDecimalValue,
    samplerName: nullableText(255),
    officerRegistrationNo: nullableText(80),
    laboratoryName: nullableText(255),
    laboratoryRegistrationNo: nullableText(80),
    labReportNo: nullableText(120),
    analysisMethod: nullableText(255),
    deviceBrand: nullableText(120),
    deviceModel: nullableText(120),
    deviceSerialNo: nullableText(120),
    selectedParameterCode: z.enum(['BOD', 'COD']),
    reporterName: nullableText(255),
    reporterPosition: nullableText(255),
    measurements: z.array(bodCodDeviationMeasurementSchema).min(1).max(50),
    attachments: z.array(bodCodDeviationAttachmentSchema).max(30).optional().default([]),
  })
  .strict();

export const resubmitBodCodDeviationReportSchema = createBodCodDeviationReportSchema
  .extend({
    revisionNote: nullableText(1000),
  })
  .strict();

export const changeBodCodWorkflowStatusSchema = z.discriminatedUnion('action', [
  z
    .object({
      action: z.literal('REQUEST_REVISION'),
      revisionReason: requiredText(1000),
      officerNote: nullableText(1000),
    })
    .strict(),
  z
    .object({
      action: z.literal('APPROVE'),
      officerNote: nullableText(1000),
    })
    .strict(),
  z
    .object({
      action: z.literal('REJECT'),
      officerNote: nullableText(1000),
    })
    .strict(),
]);

export const upsertBodCodResultNoticeSchema = z
  .object({
    reportCorrectness: z.enum(['ถูกต้องครบถ้วน', 'ไม่ถูกต้องครบถ้วน']),
    checkedParameters: z
      .array(z.enum(['BOD', 'COD']))
      .min(1)
      .max(2)
      .refine((items) => new Set(items).size === items.length, {
        message: 'checkedParameters must not contain duplicates',
      }),
    reviewResult: z.enum(['เห็นควรแจ้งผลการตรวจสอบ', 'เห็นควรให้แก้ไขเพิ่มเติม']),
    comment: nullableText(1000),
    inspectorName: blankableRequiredText(255),
    inspectorPosition: blankableRequiredText(255),
  })
  .strict();
