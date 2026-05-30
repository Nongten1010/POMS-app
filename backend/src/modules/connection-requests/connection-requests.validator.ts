import { z } from 'zod';
import { CONNECTION_REQUEST_STATUS, CONNECTION_REQUEST_TYPE } from './connection-requests.types';

const trimmedString = (max: number) => z.string().trim().min(1).max(max);
const optionalNullableTrimmedString = (max: number) =>
  z
    .string()
    .trim()
    .min(1)
    .max(max)
    .nullable()
    .optional()
    .transform((value) => value ?? null);

const measurementPointSchema = z
  .object({
    pointName: trimmedString(255),
    pointCode: optionalNullableTrimmedString(64),
    pointType: z.enum(['STACK', 'WASTEWATER', 'OTHER']),
    latitude: z.number().min(-90).max(90).nullable().optional(),
    longitude: z.number().min(-180).max(180).nullable().optional(),
    parameters: z.array(trimmedString(64)).min(1).max(50),
    description: optionalNullableTrimmedString(1000),
  })
  .strict()
  .transform((point) => ({
    ...point,
    latitude: point.latitude ?? null,
    longitude: point.longitude ?? null,
    pointCode: point.pointCode ?? null,
    description: point.description ?? null,
  }));

const connectionRequestFormSchema = z
  .object({
    requestType: z.nativeEnum(CONNECTION_REQUEST_TYPE).optional(),
    factoryId: trimmedString(64),
    factoryName: trimmedString(500),
    factoryRegistrationNo: trimmedString(64),
    systemType: z.enum(['CEMS', 'WPMS']),
    contactName: trimmedString(255),
    contactPhone: trimmedString(64),
    contactEmail: z.string().trim().email().max(255).nullable().optional(),
    measurementPoints: z.array(measurementPointSchema).min(1).max(100),
    remarks: optionalNullableTrimmedString(1000),
  })
  .strict();

export const createConnectionRequestSchema = connectionRequestFormSchema.transform((payload) => ({
  ...payload,
  requestType: payload.requestType ?? CONNECTION_REQUEST_TYPE.NEW_CONNECTION,
  contactEmail: payload.contactEmail ?? null,
  remarks: payload.remarks ?? null,
}));

export const resubmitConnectionRequestSchema = createConnectionRequestSchema;

export const addMeasurementPointRequestSchema = connectionRequestFormSchema
  .omit({ requestType: true })
  .transform((payload) => ({
    ...payload,
    requestType: CONNECTION_REQUEST_TYPE.ADD_MEASUREMENT_POINT,
  }));

export const addParameterRequestSchema = connectionRequestFormSchema
  .omit({ requestType: true })
  .superRefine((payload, ctx) => {
    if (payload.measurementPoints.length !== 1) {
      ctx.addIssue({
        code: 'custom',
        path: ['measurementPoints'],
        message: 'Add parameter request must reference exactly one measurement point',
      });
    }
  })
  .transform((payload) => ({
    ...payload,
    requestType: CONNECTION_REQUEST_TYPE.ADD_PARAMETER,
  }));

export const listConnectionRequestsQuerySchema = z
  .object({
    status: z.nativeEnum(CONNECTION_REQUEST_STATUS).optional(),
    requestType: z.nativeEnum(CONNECTION_REQUEST_TYPE).optional(),
    factoryId: z.string().trim().min(1).max(64).optional(),
  })
  .strict();

export const listConnectionRequestTableRowsQuerySchema = listConnectionRequestsQuerySchema;

export const listConnectedMeasurementPointsQuerySchema = z
  .object({
    factoryId: z.string().trim().min(1).max(64).optional(),
  })
  .strict();

export const connectionRequestIdParamsSchema = z
  .object({
    id: z.coerce.number().int().min(1),
  })
  .strict();

export const connectionRequestDeviceConfigParamsSchema = z
  .object({
    id: z.coerce.number().int().min(1),
    configId: z.coerce.number().int().min(1),
  })
  .strict();

export const deviceConfigFormQuerySchema = z
  .object({
    stationId: z.string().trim().min(1).max(64).optional(),
  })
  .strict();

export const reviewConnectionRequestSchema = z
  .discriminatedUnion('decision', [
    z
      .object({
        decision: z.literal('APPROVE_DESIGN'),
        officerNote: optionalNullableTrimmedString(1000),
      })
      .strict(),
    z
      .object({
        decision: z.literal('REQUEST_REVISION'),
        revisionReason: trimmedString(1000),
        officerNote: optionalNullableTrimmedString(1000),
      })
      .strict(),
  ])
  .transform((payload) => ({
    ...payload,
    officerNote: payload.officerNote ?? null,
  }));

export const changeConnectionRequestStatusSchema = z
  .discriminatedUnion('action', [
    z
      .object({
        action: z.literal('APPROVE_FORM'),
        officerNote: optionalNullableTrimmedString(1000),
      })
      .strict(),
    z
      .object({
        action: z.literal('REQUEST_REVISION'),
        revisionReason: trimmedString(1000),
        officerNote: optionalNullableTrimmedString(1000),
      })
      .strict(),
  ])
  .transform((payload) => ({
    ...payload,
    officerNote: payload.officerNote ?? null,
  }));

export const confirmConnectionSchema = z
  .object({
    confirmedAt: z.string().datetime().optional(),
    note: optionalNullableTrimmedString(1000),
  })
  .strict();

export const verifyConnectionSchema = z
  .object({
    verifiedAt: z.string().datetime().optional(),
    note: optionalNullableTrimmedString(1000),
  })
  .strict();

export type CreateConnectionRequestSchemaInput = z.infer<typeof createConnectionRequestSchema>;
export type ListConnectionRequestsQuerySchemaInput = z.infer<
  typeof listConnectionRequestsQuerySchema
>;
