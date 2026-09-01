import { z } from 'zod';
import { CONNECTION_REQUEST_EIA_ASSESSMENTS } from '../connection-requests/connection-request-eia';
import {
  measurementInstrumentsSchema,
  measurementPointDetailsSchema,
  requestDocumentImageSchema,
} from '../connection-requests/connection-requests.validator';
import type {
  MeasurementInstrumentsInput,
  MeasurementPointDetailsInput,
} from '../connection-requests/connection-requests.types';
import { MONITORING_POINT_STATUSES } from '../monitoring-point-forms/monitoring-point-forms.types';
import {
  POMS_FACTORY_EDIT_REQUEST_FORM_TYPE,
  POMS_FACTORY_EDIT_REQUEST_STATUS,
  type CreatePomsFactoryMeasurementPointsEditRequestInput,
  type PomsMeasurementPointPatchInput,
} from './poms-factories.types';

const trimmedString = (max: number) => z.string().trim().min(1).max(max);
const optionalNullableTrimmedString = (max: number) =>
  z.preprocess((value) => {
    if (value === undefined || value === null) return value;
    if (typeof value !== 'string') return value;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }, z.string().trim().min(1).max(max).nullable().optional());

type EditableFactoryProfileCompatibilityInput = {
  address?: string | null;
  factoryAddress?: string | null;
  remarks?: string | null;
  note?: string | null;
};
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

export const pomsFactoryFormQuerySchema = z
  .object({
    formType: z.enum(POMS_FACTORY_EDIT_REQUEST_FORM_TYPE).optional(),
    systemType: z.enum(['CEMS', 'WPMS']).optional(),
  })
  .strict();

export const pomsFactoryEditRequestFormQuerySchema = pomsFactoryFormQuerySchema.pick({
  systemType: true,
});

export const listPomsFactoryEditRequestsQuerySchema = z
  .object({
    status: z.enum(POMS_FACTORY_EDIT_REQUEST_STATUS).optional(),
    factoryId: z.string().trim().min(1).max(64).optional(),
    search: z.string().trim().min(1).max(255).optional(),
  })
  .strict();

const editableFactoryProfileSchema = z
  .object({
    formType: z.literal(POMS_FACTORY_EDIT_REQUEST_FORM_TYPE.BASIC_INFO).optional(),
    factoryName: trimmedString(500),
    factoryAddress: optionalNullableTrimmedString(1000),
    address: optionalNullableTrimmedString(1000),
    latitude: z.number().finite().min(-90).max(90).nullable().optional(),
    longitude: z.number().finite().min(-180).max(180).nullable().optional(),
    eia: z.enum(CONNECTION_REQUEST_EIA_ASSESSMENTS).nullable().optional(),
    eiaOther: optionalNullableTrimmedString(500),
    projectName: optionalNullableTrimmedString(500),
    remarks: optionalNullableTrimmedString(1000),
    factoryFrontPhotos: z.array(requestDocumentImageSchema).max(10).optional(),
    factoryLogo: requestDocumentImageSchema.nullable().optional(),
    note: optionalNullableTrimmedString(1000),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (
      value.address !== undefined &&
      value.factoryAddress !== undefined &&
      value.address !== value.factoryAddress
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['address'],
        message: 'address and factoryAddress must match when both are provided',
      });
    }
    if (value.remarks !== undefined && value.note !== undefined && value.remarks !== value.note) {
      ctx.addIssue({
        code: 'custom',
        path: ['remarks'],
        message: 'remarks and note must match when both are provided',
      });
    }
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
  })
  .transform(normalizeEditableFactoryProfileInput);

const editableMeasurementPointPatchSchema: z.ZodType<PomsMeasurementPointPatchInput> = z
  .object({
    connectedPointId: z.number().int().positive(),
    pointName: trimmedString(255).optional(),
    monitoringPointStatus: z.enum(MONITORING_POINT_STATUSES).nullable().optional(),
    details: measurementPointDetailsSchema.nullable().optional() as z.ZodType<
      MeasurementPointDetailsInput | null | undefined
    >,
    documentsAndImages: z.array(requestDocumentImageSchema).max(50).optional(),
    measurementInstruments: measurementInstrumentsSchema.nullable().optional() as z.ZodType<
      MeasurementInstrumentsInput | null | undefined
    >,
  })
  .strict()
  .superRefine((value, ctx) => {
    const editableKeys = [
      'pointName',
      'monitoringPointStatus',
      'details',
      'documentsAndImages',
      'measurementInstruments',
    ];
    if (editableKeys.some((key) => Object.prototype.hasOwnProperty.call(value, key))) return;
    ctx.addIssue({
      code: 'custom',
      path: ['connectedPointId'],
      message: 'measurement point patch must include at least one editable field',
    });
  });

const editableMeasurementPointsSchema: z.ZodType<CreatePomsFactoryMeasurementPointsEditRequestInput> =
  z
    .object({
      formType: z.literal(POMS_FACTORY_EDIT_REQUEST_FORM_TYPE.MEASUREMENT_POINTS),
      remarks: optionalNullableTrimmedString(1000),
      measurementPoints: z.array(editableMeasurementPointPatchSchema).min(1).max(100),
      note: optionalNullableTrimmedString(1000),
    })
    .strict()
    .superRefine((value, ctx) => {
      const seen = new Set<number>();
      value.measurementPoints.forEach((point, index) => {
        if (!seen.has(point.connectedPointId)) {
          seen.add(point.connectedPointId);
          return;
        }
        ctx.addIssue({
          code: 'custom',
          path: ['measurementPoints', index, 'connectedPointId'],
          message: 'connectedPointId must be unique within one request',
        });
      });
      if (value.remarks !== undefined && value.note !== undefined && value.remarks !== value.note) {
        ctx.addIssue({
          code: 'custom',
          path: ['remarks'],
          message: 'remarks and note must match when both are provided',
        });
      }
    })
    .transform(({ remarks, ...value }) => ({
      ...value,
      note: value.note === undefined ? remarks : value.note,
    }));

export const createPomsFactoryEditRequestSchema = z.union([
  editableFactoryProfileSchema,
  editableMeasurementPointsSchema,
]);
export const resubmitPomsFactoryEditRequestSchema = createPomsFactoryEditRequestSchema;

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

function normalizeEditableFactoryProfileInput<T extends EditableFactoryProfileCompatibilityInput>(
  value: T,
): Omit<T, 'address' | 'remarks'> & {
  factoryAddress?: string | null;
  note?: string | null;
} {
  const { address, remarks, ...rest } = value;
  const normalized = {
    ...rest,
    ...(Object.prototype.hasOwnProperty.call(rest, 'factoryAddress')
      ? {}
      : Object.prototype.hasOwnProperty.call(value, 'address')
        ? { factoryAddress: address ?? null }
        : {}),
  };
  if (Object.prototype.hasOwnProperty.call(normalized, 'note')) return normalized;
  if (Object.prototype.hasOwnProperty.call(value, 'remarks')) {
    return { ...normalized, note: remarks ?? null };
  }
  return normalized;
}
