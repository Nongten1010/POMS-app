import { z } from 'zod';
import {
  MONITORING_POINT_STATUSES,
  MONITORING_POINT_SYSTEM_TYPES,
} from './monitoring-point-forms.types';
import { monitoringPointAttachmentLinksSchema } from './monitoring-point-attachments';

const requiredText = (max: number) => z.string().trim().min(1).max(max);
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((value) => (value ? value : null));
const optionalStringList = (maxItemLength: number, maxItems: number) =>
  z
    .preprocess(
      (value) => {
        if (value === undefined || value === null || value === '') return [];
        if (Array.isArray(value)) {
          return value
            .map((item) => (typeof item === 'string' ? item.trim() : item))
            .filter(Boolean);
        }
        if (typeof value === 'string') {
          return value
            .split(',')
            .map((item) => item.trim())
            .filter(Boolean);
        }
        return value;
      },
      z.array(requiredText(maxItemLength)).max(maxItems),
    )
    .default([]);
const parameterListSchema = optionalStringList(255, 100);
const legalAnnexListSchema = optionalStringList(32, 12);
const typedMonitoringPointFields = [
  'timeSharingParameters',
  'sharedStackCode',
  'monitoringPointStatus',
  'attachmentLinks',
  'attachments',
] as const;
const cemsLegalAnnexRequiredBy = [
  'ประกาศกระทรวงอุตสาหกรรม เรื่อง กำหนดให้โรงงานต้องติดตั้งเครื่องมือหรือเครื่องอุปกรณ์พิเศษเพื่อรายงานมลพิษอากาศจากปล่องโรงงาน พ.ศ. 2565',
  'ประกาศกระทรวงอุตสาหกรรม เรื่อง กำหนดให้โรงงานในท้องที่กรุงเทพมหานครต้องติดตั้งเครื่องมือหรือเครื่องอุปกรณ์พิเศษเพื่อรายงานมลพิษอากาศจากปล่องโรงงาน พ.ศ. 2569',
] as const;
const optionalNumber = z
  .preprocess((value) => {
    if (value === undefined || value === null || value === '') return null;
    return value;
  }, z.coerce.number().finite().nonnegative().nullable())
  .optional()
  .default(null);
const optionalCoordinate = (min: number, max: number) =>
  z
    .preprocess((value) => {
      if (value === undefined || value === null || value === '') return null;
      return value;
    }, z.coerce.number().finite().min(min).max(max).nullable())
    .optional()
    .default(null);
const monitoringPointAttachmentReferenceSchema = z.union([
  z.object({ id: z.coerce.number().int().positive() }).strict(),
  z.object({ uploadToken: z.string().regex(/^[A-Za-z0-9_-]{43}$/) }).strict(),
]);

export const saveMonitoringPointFormSchema = z
  .object({
    factory: z
      .object({
        factoryName: optionalText(500),
        factoryRegistrationNoNew: optionalText(64),
        factoryRegistrationNoOld: optionalText(64),
        provinceName: optionalText(128),
        factoryTypeMain: optionalText(128),
        factoryTypeSub: optionalText(128),
        operationStatus: optionalText(128),
        eiaInfo: optionalText(255),
        eiaOther: optionalText(500),
        projectName: optionalText(500),
        address: optionalText(1000),
        businessActivity: optionalText(4000),
        machineryHorsepower: optionalNumber,
        latitude: optionalCoordinate(-90, 90),
        longitude: optionalCoordinate(-180, 180),
      })
      .strict()
      .superRefine((factory, context) => {
        if (factory.eiaInfo === 'อื่นๆ' && !factory.eiaOther) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['eiaOther'],
            message: 'eiaOther is required when eiaInfo is อื่นๆ',
          });
        }
      })
      .transform((factory) => ({
        ...factory,
        eiaOther: factory.eiaInfo === 'อื่นๆ' ? factory.eiaOther : null,
      })),
    points: z
      .array(
        z
          .object({
            id: z.coerce.number().int().positive().optional(),
            systemType: z.enum(MONITORING_POINT_SYSTEM_TYPES),
            pointCode: optionalText(64),
            pointName: optionalText(255),
            productionUnitType: optionalText(255),
            productionCapacity: optionalText(255),
            cemsInstallationRequiredBy: optionalText(255),
            cemsInstallationRequiredOther: optionalText(255),
            legalAnnexNo: legalAnnexListSchema,
            accountingConnectionStatus: optionalText(255),
            eligibleParameters: parameterListSchema,
            exemptedParameters: parameterListSchema,
            connectedParameters: parameterListSchema,
            pendingParameters: parameterListSchema,
            timeSharingParameters: parameterListSchema,
            sharedStackCode: optionalText(64),
            monitoringPointStatus: z
              .enum(MONITORING_POINT_STATUSES)
              .optional()
              .nullable()
              .default(null),
            attachmentLinks: monitoringPointAttachmentLinksSchema.optional(),
            attachments: z.array(monitoringPointAttachmentReferenceSchema).optional(),
            primaryFuel: optionalText(255),
            primaryFuelOther: optionalText(255),
            secondaryFuel: optionalText(255),
            secondaryFuelOther: optionalText(255),
            details: z.record(z.string(), z.unknown()).optional().nullable().default(null),
          })
          .strict()
          .superRefine((point, context) => {
            typedMonitoringPointFields.forEach((field) => {
              if (!point.details || !Object.prototype.hasOwnProperty.call(point.details, field)) {
                return;
              }
              context.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['details', field],
                message: `${field} must be provided at the point level`,
              });
            });

            const supportsLegalAnnexNo =
              point.systemType === 'CEMS' &&
              cemsLegalAnnexRequiredBy.includes(
                point.cemsInstallationRequiredBy as (typeof cemsLegalAnnexRequiredBy)[number],
              );

            if (point.legalAnnexNo.length > 0 && !supportsLegalAnnexNo) {
              context.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['legalAnnexNo'],
                message:
                  'Legal annex numbers are only allowed for CEMS points under the 2022 ministerial notification or the 2026 Bangkok ministerial notification',
              });
            }

            if (
              point.timeSharingParameters.includes('ไม่มี') &&
              point.timeSharingParameters.length > 1
            ) {
              context.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['timeSharingParameters'],
                message: 'ไม่มี cannot be combined with another time-sharing parameter',
              });
            }
          })
          .transform((point) => ({
            ...point,
            sharedStackCode: point.timeSharingParameters.includes('ไม่มี')
              ? null
              : point.sharedStackCode,
          })),
      )
      .max(100)
      .superRefine((points, context) => {
        const pointIdIndexes = new Map<number, number>();
        points.forEach((point, index) => {
          if (point.id === undefined) return;
          const previousIndex = pointIdIndexes.get(point.id);
          if (previousIndex === undefined) {
            pointIdIndexes.set(point.id, index);
            return;
          }
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: [index, 'id'],
            message: `Duplicate monitoring point id ${point.id}; first used at points.${previousIndex}.id`,
          });
        });
      })
      .default([]),
  })
  .strict();

export const monitoringPointFormIdParamsSchema = z
  .object({
    id: z.coerce.number().int().positive(),
  })
  .strict();

export const listMonitoringPointFormsQuerySchema = z
  .object({
    factoryRegistrationNoNew: z.string().trim().min(1).max(64).optional(),
    systemType: z.enum(MONITORING_POINT_SYSTEM_TYPES).optional(),
  })
  .strict();
