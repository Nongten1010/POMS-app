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
const jsonValueSchema: z.ZodType<unknown> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(jsonValueSchema).max(100),
    z.record(z.string().min(1).max(128), jsonValueSchema),
  ]),
);

const measurementPointDetailsSchema = z.record(z.string().min(1).max(128), jsonValueSchema);

const requestDocumentImageSchema = z
  .object({
    title: trimmedString(255),
    description: optionalNullableTrimmedString(1000),
    link: z.string().trim().url().max(2048).nullable().optional(),
    fileName: optionalNullableTrimmedString(255),
    fileUrl: z.string().trim().url().max(2048).nullable().optional(),
    fileType: optionalNullableTrimmedString(128),
    fileSize: z
      .number()
      .int()
      .min(0)
      .max(20 * 1024 * 1024)
      .nullable()
      .optional(),
  })
  .strict()
  .transform((document) => ({
    ...document,
    description: document.description ?? null,
    link: document.link ?? null,
    fileName: document.fileName ?? null,
    fileUrl: document.fileUrl ?? null,
    fileType: document.fileType ?? null,
    fileSize: document.fileSize ?? null,
  }));

const measurementInstrumentParameterSchema = z
  .object({
    parameter: trimmedString(128),
    technique: optionalNullableTrimmedString(255),
    range: optionalNullableTrimmedString(255),
    brand: optionalNullableTrimmedString(255),
    supplier: optionalNullableTrimmedString(255),
    eiaStandard: optionalNullableTrimmedString(255),
    standardCondition: z.boolean().nullable().optional(),
    dryBasis: z.boolean().nullable().optional(),
    oxygenOrExcessAir: z.boolean().nullable().optional(),
    standardCriteria: jsonValueSchema.nullable().optional(),
    eiaCriteria: jsonValueSchema.nullable().optional(),
  })
  .strict()
  .transform((instrument) => ({
    ...instrument,
    technique: instrument.technique ?? null,
    range: instrument.range ?? null,
    brand: instrument.brand ?? null,
    supplier: instrument.supplier ?? null,
    eiaStandard: instrument.eiaStandard ?? null,
    standardCondition: instrument.standardCondition ?? null,
    dryBasis: instrument.dryBasis ?? null,
    oxygenOrExcessAir: instrument.oxygenOrExcessAir ?? null,
    standardCriteria: instrument.standardCriteria ?? null,
    eiaCriteria: instrument.eiaCriteria ?? null,
  }));

const measurementInstrumentsSchema = z
  .object({
    converterBrand: optionalNullableTrimmedString(255),
    converterModel: optionalNullableTrimmedString(255),
    parameters: z.array(measurementInstrumentParameterSchema).min(1).max(100),
  })
  .strict()
  .transform((instruments) => ({
    ...instruments,
    converterBrand: instruments.converterBrand ?? null,
    converterModel: instruments.converterModel ?? null,
  }));

const measurementPointSchema = z
  .object({
    pointName: trimmedString(255),
    pointCode: optionalNullableTrimmedString(64),
    pointType: z.enum(['STACK', 'WASTEWATER', 'OTHER']),
    latitude: z.number().min(-90).max(90).nullable().optional(),
    longitude: z.number().min(-180).max(180).nullable().optional(),
    parameters: z.array(trimmedString(64)).min(1).max(50),
    description: optionalNullableTrimmedString(1000),
    details: measurementPointDetailsSchema.nullable().optional(),
    documentsAndImages: z.array(requestDocumentImageSchema).max(50).optional(),
    measurementInstruments: measurementInstrumentsSchema.nullable().optional(),
  })
  .strict()
  .transform((point) => ({
    ...point,
    latitude: point.latitude ?? null,
    longitude: point.longitude ?? null,
    pointCode: point.pointCode ?? null,
    description: point.description ?? null,
    details: point.details ?? null,
    documentsAndImages: point.documentsAndImages ?? [],
    measurementInstruments: point.measurementInstruments ?? null,
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
  .superRefine((payload, ctx) => {
    payload.measurementPoints.forEach((point, index) => {
      if (!point.details || Object.keys(point.details).length === 0) {
        ctx.addIssue({
          code: 'custom',
          path: ['measurementPoints', index, 'details'],
          message: 'Measurement point detail section is required',
        });
      }
      if (point.documentsAndImages.length === 0) {
        ctx.addIssue({
          code: 'custom',
          path: ['measurementPoints', index, 'documentsAndImages'],
          message: 'Documents and images section is required',
        });
      }
      if (!point.measurementInstruments) {
        ctx.addIssue({
          code: 'custom',
          path: ['measurementPoints', index, 'measurementInstruments'],
          message: 'Measurement instruments section is required',
        });
      }
    });
  })
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
    payload.measurementPoints.forEach((point, index) => {
      if (!point.pointCode) {
        ctx.addIssue({
          code: 'custom',
          path: ['measurementPoints', index, 'pointCode'],
          message: 'Existing measurement point code is required for add parameter request',
        });
      }
      if (!point.measurementInstruments) {
        ctx.addIssue({
          code: 'custom',
          path: ['measurementPoints', index, 'measurementInstruments'],
          message: 'Measurement instruments section is required',
        });
      }
    });
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
