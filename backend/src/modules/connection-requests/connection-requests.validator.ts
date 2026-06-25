import { z } from 'zod';
import { CONNECTION_REQUEST_STATUS, CONNECTION_REQUEST_TYPE } from './connection-requests.types';

const trimmedString = (max: number) => z.string().trim().min(1).max(max);
const optionalTrimmedString = (max: number) => z.string().trim().min(1).max(max).optional();
const optionalNullableTrimmedString = (max: number) =>
  z
    .preprocess((value) => {
      if (typeof value !== 'string') return value;
      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : null;
    }, z.string().trim().min(1).max(max).nullable().optional())
    .transform((value) => value ?? null);
const requiredStringWithFallback = (max: number) =>
  z.preprocess((value) => {
    if (typeof value !== 'string') return value;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }, z.string().trim().min(1).max(max).nullable().optional());
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

const parameterGroupFields = [
  'eligibleParameters',
  'exemptedParameters',
  'connectedParameters',
  'pendingParameters',
  'timeSharingParameters',
] as const;
const measurementPointParameterFallbackFields = [
  'pendingParameters',
  'eligibleParameters',
  'connectedParameters',
] as const;
const cemsOnlyDetailFields = new Set([
  ...parameterGroupFields,
  'productionUnitType',
  'productionCapacity',
  'cemsInstallationRequiredBy',
  'cemsInstallationRequiredOther',
  'legalAnnexNo',
  'sharedStackCode',
  'stackShape',
  'stackDiameter',
  'stackWidth',
  'stackLength',
  'stackShapeOther',
  'stackHeight',
  'monitoringHeight',
  'averageFlowRate',
  'minFlowRate',
  'maxFlowRate',
  'primaryFuel',
  'primaryFuelOther',
  'primaryFuelPercent',
  'secondaryFuel',
  'secondaryFuelOther',
  'secondaryFuelPercent',
  'combustionControlSystem',
  'stackLatitude',
  'stackLongitude',
]);
const wpmsOnlyDetailFields = new Set([
  'averageWastewaterDischarge',
  'minWastewaterDischarge',
  'maxWastewaterDischarge',
  'maxTreatmentCapacity',
  'instrumentLatitude',
  'instrumentLongitude',
  'wastewaterSource',
  'dischargeReceivingSource',
]);

const contactPersonSchema = z
  .object({
    name: trimmedString(255),
    phone: trimmedString(64),
    email: z.string().trim().email().max(255).nullable().optional(),
    position: optionalNullableTrimmedString(255),
  })
  .strict()
  .transform((contact) => ({
    ...contact,
    email: contact.email ?? null,
    position: contact.position ?? null,
  }));

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

const criteriaLevelSchema = z.enum(['normal', 'warning', 'critical']);
const criteriaStandardValueSchema = z.preprocess(
  (value) => {
    if (typeof value !== 'string') return value;
    const trimmedValue = value.trim();
    return trimmedValue.length > 0 ? trimmedValue : null;
  },
  z
    .union([z.string().min(1).max(255), z.number().finite()])
    .nullable()
    .optional(),
);
const criteriaRangeRowSchema = z
  .object({
    level: criteriaLevelSchema,
    min: z.number().finite().nullable(),
    max: z.number().finite().nullable(),
  })
  .strict();

function normalizeMeasurementCriteriaInput(value: unknown): unknown {
  if (!isRecord(value)) return value;

  const rawEnabled = value.enabled;
  const enabled =
    typeof rawEnabled === 'string'
      ? rawEnabled.trim().toLowerCase() === 'true'
      : rawEnabled === true;

  return {
    ...value,
    enabled,
  };
}

const measurementCriteriaSchema = z
  .preprocess(
    normalizeMeasurementCriteriaInput,
    z
      .object({
        enabled: z.boolean(),
        standardValue: criteriaStandardValueSchema,
        rows: z.array(criteriaRangeRowSchema).max(3).optional(),
      })
      .strict(),
  )
  .superRefine((criteria, ctx) => {
    if (criteria.enabled) return;

    if (criteria.standardValue === undefined || criteria.standardValue === null) {
      ctx.addIssue({
        code: 'custom',
        path: ['standardValue'],
        message: 'standardValue is required when criteria is disabled',
      });
    }

    if (!criteria.rows || criteria.rows.length !== 3) {
      ctx.addIssue({
        code: 'custom',
        path: ['rows'],
        message: 'criteria rows must include normal, warning, and critical',
      });
      return;
    }

    const levels = criteria.rows.map((row) => row.level);
    const uniqueLevels = new Set(levels);
    if (uniqueLevels.size !== levels.length) {
      ctx.addIssue({
        code: 'custom',
        path: ['rows'],
        message: 'criteria rows must not duplicate levels',
      });
      return;
    }

    criteriaLevelSchema.options.forEach((level) => {
      if (uniqueLevels.has(level)) return;
      ctx.addIssue({
        code: 'custom',
        path: ['rows'],
        message: `criteria rows must include ${level}`,
      });
    });
  })
  .transform((criteria) => {
    if (criteria.enabled) {
      return {
        enabled: true,
        standardValue: null,
        rows: [],
      };
    }

    return {
      enabled: false,
      standardValue: criteria.standardValue,
      rows: criteria.rows ?? [],
    };
  });

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
    standardCriteria: measurementCriteriaSchema.nullable().optional(),
    eiaCriteria: measurementCriteriaSchema.nullable().optional(),
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
    parameters: z.array(measurementInstrumentParameterSchema).max(100).optional(),
  })
  .strict()
  .transform((instruments) => ({
    ...instruments,
    converterBrand: instruments.converterBrand ?? null,
    converterModel: instruments.converterModel ?? null,
    parameters: instruments.parameters ?? [],
  }));

function normalizeMeasurementPointInput(value: unknown): unknown {
  if (!isRecord(value)) return value;

  const { type: frontendType, ...point } = value;
  const inferredPointType = inferMeasurementPointType(point.pointType, point.details, frontendType);
  const measurementInstruments = normalizeMeasurementInstrumentsInput(
    point.measurementInstruments,
    point,
  );
  const parameters = normalizeMeasurementPointParameterNames(point);

  return {
    ...point,
    ...(inferredPointType ? { pointType: inferredPointType } : {}),
    ...(parameters.length > 0 ? { parameters } : {}),
    ...(measurementInstruments ? { measurementInstruments } : {}),
  };
}

function normalizeMeasurementInstrumentsInput(
  value: unknown,
  point: Record<string, unknown>,
): unknown {
  if (!isRecord(value)) return value;

  if (Array.isArray(value.parameters) && value.parameters.length > 0) return value;

  const parameterNames = normalizeMeasurementPointParameterNames(point);
  if (parameterNames.length === 0) return value;

  return {
    ...value,
    parameters: parameterNames.map((parameter) => ({ parameter })),
  };
}

function normalizeMeasurementPointParameterNames(point: Record<string, unknown>): string[] {
  const directParameters = normalizeParameterNameList(point.parameters);
  if (directParameters.length > 0) return directParameters;

  if (!isRecord(point.details)) return [];

  for (const field of measurementPointParameterFallbackFields) {
    const detailParameters = normalizeParameterNameList(point.details[field]);
    if (detailParameters.length > 0) return detailParameters;
  }

  return [];
}

function normalizeParameterNameList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  const parameterNames = value.flatMap((item) => {
    if (typeof item !== 'string') return [];
    return item
      .split(',')
      .map((parameter) => parameter.trim())
      .filter((parameter) => parameter.length > 0);
  });

  return [...new Set(parameterNames)];
}

function inferMeasurementPointType(
  pointType: unknown,
  details: unknown,
  frontendType: unknown,
): 'STACK' | 'WASTEWATER' | 'OTHER' | null {
  const candidates = [
    pointType,
    isRecord(details) ? details.monitoringPointKind : undefined,
    frontendType,
  ];

  for (const candidate of candidates) {
    const inferred = inferMeasurementPointTypeFromValue(candidate);
    if (inferred) return inferred;
  }

  return null;
}

function inferMeasurementPointTypeFromValue(
  value: unknown,
): 'STACK' | 'WASTEWATER' | 'OTHER' | null {
  if (typeof value !== 'string') return null;

  const normalizedValue = value.trim().toUpperCase();
  if (!normalizedValue) return null;

  if (
    normalizedValue === 'STACK' ||
    normalizedValue === 'WASTEWATER' ||
    normalizedValue === 'OTHER'
  ) {
    return normalizedValue;
  }
  if (normalizedValue === 'CEMS') return 'STACK';
  if (normalizedValue === 'WPMS') return 'WASTEWATER';

  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

const measurementPointSchema = z
  .preprocess(
    normalizeMeasurementPointInput,
    z
      .object({
        pointName: trimmedString(255),
        pointCode: optionalNullableTrimmedString(64),
        pointType: z.enum(['STACK', 'WASTEWATER', 'OTHER']),
        latitude: z.number().min(-90).max(90).nullable().optional(),
        longitude: z.number().min(-180).max(180).nullable().optional(),
        parameters: z.array(trimmedString(64)).min(1).max(50).optional(),
        description: optionalNullableTrimmedString(1000),
        details: measurementPointDetailsSchema.nullable().optional(),
        documentsAndImages: z.array(requestDocumentImageSchema).max(50).optional(),
        measurementInstruments: measurementInstrumentsSchema.nullable().optional(),
      })
      .strict(),
  )
  .transform((point) => ({
    ...point,
    latitude: point.latitude ?? null,
    longitude: point.longitude ?? null,
    pointCode: point.pointCode ?? null,
    parameters: selectMeasurementPointParameters(point),
    description: point.description ?? null,
    details: point.details ?? null,
    documentsAndImages: point.documentsAndImages ?? [],
    measurementInstruments: point.measurementInstruments ?? null,
  }));

const connectionRequestFormObjectSchema = z
  .object({
    requestType: z.nativeEnum(CONNECTION_REQUEST_TYPE).optional(),
    factoryId: trimmedString(64),
    factoryName: trimmedString(500),
    factoryRegistrationNo: requiredStringWithFallback(64),
    industryMainOrder: optionalNullableTrimmedString(128),
    industrySubOrder: optionalNullableTrimmedString(128),
    businessActivity: optionalNullableTrimmedString(4000),
    eia: z.preprocess(
      (value) => (typeof value === 'string' && value.trim() === '' ? null : value),
      z.enum(['มี', 'ไม่มี']).nullable().optional(),
    ),
    hasEia: z.boolean().nullable().optional(),
    projectName: optionalNullableTrimmedString(500),
    address: optionalNullableTrimmedString(1000),
    latitude: z.number().min(-90).max(90).nullable().optional(),
    longitude: z.number().min(-180).max(180).nullable().optional(),
    systemType: z.enum(['CEMS', 'WPMS']),
    type: z.enum(['CEMS', 'WPMS']).optional(),
    contactName: optionalTrimmedString(255),
    contactPhone: optionalTrimmedString(64),
    contactEmail: z.string().trim().email().max(255).nullable().optional(),
    contactPersons: z.array(contactPersonSchema).min(1).max(20).optional(),
    notificationEmails: z.array(z.string().trim().email().max(255)).max(20).optional(),
    officerNotificationEmails: z.array(z.string().trim().email().max(255)).max(20).optional(),
    measurementPoints: z.array(measurementPointSchema).min(1).max(100),
    remarks: optionalNullableTrimmedString(1000),
  })
  .strict();

const connectionRequestFormBaseSchema =
  connectionRequestFormObjectSchema.superRefine(validateContactSection);

const connectionRequestFormSchema = connectionRequestFormBaseSchema.transform((payload) =>
  normalizeContacts(normalizeFactorySnapshot(stripFrontendSystemTypeAlias(payload))),
);

type ContactFormPayload = z.infer<typeof connectionRequestFormBaseSchema>;
type ContactFormPayloadWithoutRequestType = Omit<ContactFormPayload, 'requestType'>;

function deriveMeasurementPointParameters(
  instruments: z.infer<typeof measurementInstrumentsSchema> | null | undefined,
): string[] {
  if (!instruments) return [];
  return [...new Set(instruments.parameters.map((item) => item.parameter))];
}

function selectMeasurementPointParameters(point: {
  parameters?: string[];
  measurementInstruments?: z.infer<typeof measurementInstrumentsSchema> | null;
}): string[] {
  const instrumentParameters = deriveMeasurementPointParameters(point.measurementInstruments);
  if (instrumentParameters.length > 0) return instrumentParameters;
  return point.parameters ?? [];
}

function validateContactSection(
  payload: ContactFormPayload | ContactFormPayloadWithoutRequestType,
  ctx: z.RefinementCtx,
): void {
  if (!payload.contactPersons?.length && (!payload.contactName || !payload.contactPhone)) {
    ctx.addIssue({
      code: 'custom',
      path: ['contactPersons'],
      message: 'At least one contact person or contactName/contactPhone is required',
    });
  }
}

function stripFrontendSystemTypeAlias<T extends { type?: unknown }>(payload: T): Omit<T, 'type'> {
  const { type: _type, ...formPayload } = payload;
  return formPayload;
}

function normalizeFactorySnapshot<
  T extends ContactFormPayload | ContactFormPayloadWithoutRequestType,
>(
  payload: T,
): T & {
  factoryRegistrationNo: string;
  eia: 'มี' | 'ไม่มี' | null;
} {
  return {
    ...payload,
    factoryRegistrationNo: payload.factoryRegistrationNo ?? payload.factoryId,
    eia: payload.eia ?? null,
  };
}

function normalizeContacts<T extends ContactFormPayload | ContactFormPayloadWithoutRequestType>(
  payload: T,
): T & {
  contactName: string;
  contactPhone: string;
  contactEmail: string | null;
  contactPersons: NonNullable<ContactFormPayload['contactPersons']>;
  notificationEmails: string[];
  officerNotificationEmails: string[];
} {
  const primaryContact = payload.contactPersons?.[0] ?? {
    name: payload.contactName ?? '',
    phone: payload.contactPhone ?? '',
    email: payload.contactEmail ?? null,
    position: null,
  };
  const contactEmail = payload.contactEmail ?? primaryContact.email ?? null;
  const contactPersons =
    payload.contactPersons && payload.contactPersons.length > 0
      ? payload.contactPersons
      : [
          {
            name: primaryContact.name,
            phone: primaryContact.phone,
            email: contactEmail,
            position: null,
          },
        ];
  const notificationEmails =
    payload.notificationEmails && payload.notificationEmails.length > 0
      ? [...new Set(payload.notificationEmails)]
      : contactEmail
        ? [contactEmail]
        : [];
  const officerNotificationEmails =
    payload.officerNotificationEmails && payload.officerNotificationEmails.length > 0
      ? [...new Set(payload.officerNotificationEmails)]
      : [];

  return {
    ...payload,
    contactName: payload.contactName ?? primaryContact.name,
    contactPhone: payload.contactPhone ?? primaryContact.phone,
    contactEmail,
    contactPersons,
    notificationEmails,
    officerNotificationEmails,
  };
}

function validateMeasurementPointDetailsBySystem(
  systemType: 'CEMS' | 'WPMS',
  point: z.infer<typeof measurementPointSchema>,
  index: number,
  ctx: z.RefinementCtx,
): void {
  if (!point.details) return;

  if (systemType === 'CEMS') {
    validateCemsDetails(point, index, ctx);
    return;
  }

  validateWpmsDetails(point, index, ctx);
}

function validateCemsDetails(
  point: z.infer<typeof measurementPointSchema>,
  index: number,
  ctx: z.RefinementCtx,
): void {
  const details = point.details;
  if (!details) return;

  if (point.pointType !== 'STACK') {
    addDetailIssue(ctx, index, 'pointType', 'CEMS measurement point must use pointType STACK');
  }

  validateMonitoringPointKind(details, index, ctx, 'CEMS');
  validateExcludedFields(details, wpmsOnlyDetailFields, index, ctx, 'WPMS-only detail field');
  validateParameterGroups(details, index, ctx);

  const stackShape = details.stackShape;
  if (stackShape === 'วงกลม') {
    requireNumberDetail(details, index, ctx, 'stackDiameter');
  } else if (stackShape === 'สี่เหลี่ยม') {
    requireNumberDetail(details, index, ctx, 'stackWidth');
    requireNumberDetail(details, index, ctx, 'stackLength');
  } else if (stackShape === 'อื่นๆ') {
    requireStringDetail(details, index, ctx, 'stackShapeOther');
  } else {
    addDetailIssue(ctx, index, 'stackShape', 'CEMS stackShape is required');
  }

  if (details.primaryFuel === 'อื่นๆ') {
    requireStringDetail(details, index, ctx, 'primaryFuelOther');
  }
  if (details.secondaryFuel === 'อื่นๆ') {
    requireStringDetail(details, index, ctx, 'secondaryFuelOther');
  }

  validateTreatmentSystem(details, index, ctx);
  validateConnectionDevice(details, index, ctx);
}

function validateWpmsDetails(
  point: z.infer<typeof measurementPointSchema>,
  index: number,
  ctx: z.RefinementCtx,
): void {
  const details = point.details;
  if (!details) return;

  if (point.pointType !== 'WASTEWATER') {
    addDetailIssue(ctx, index, 'pointType', 'WPMS measurement point must use pointType WASTEWATER');
  }

  validateMonitoringPointKind(details, index, ctx, 'WPMS');
  validateExcludedFields(details, cemsOnlyDetailFields, index, ctx, 'CEMS-only detail field');
  validateTreatmentSystem(details, index, ctx);
  validateConnectionDevice(details, index, ctx);

  if (details.hasTreatmentSystem === 'มี') {
    requireNumberDetail(details, index, ctx, 'maxTreatmentCapacity');
  }
}

function validateMonitoringPointKind(
  details: Record<string, unknown>,
  index: number,
  ctx: z.RefinementCtx,
  expected: 'CEMS' | 'WPMS',
): void {
  if (details.monitoringPointKind === undefined || details.monitoringPointKind === expected) return;
  addDetailIssue(ctx, index, 'monitoringPointKind', `monitoringPointKind must be ${expected}`);
}

function validateExcludedFields(
  details: Record<string, unknown>,
  fields: Set<string>,
  index: number,
  ctx: z.RefinementCtx,
  messagePrefix: string,
): void {
  Object.keys(details).forEach((field) => {
    if (!fields.has(field)) return;
    addDetailIssue(ctx, index, field, `${messagePrefix} is not allowed here`);
  });
}

function validateParameterGroups(
  details: Record<string, unknown>,
  index: number,
  ctx: z.RefinementCtx,
): void {
  parameterGroupFields.forEach((field) => {
    const value = details[field];
    if (value === undefined || value === null) return;
    if (Array.isArray(value) && value.every((item) => typeof item === 'string')) return;
    addDetailIssue(ctx, index, field, `${field} must be string[]`);
  });
}

function validateTreatmentSystem(
  details: Record<string, unknown>,
  index: number,
  ctx: z.RefinementCtx,
): void {
  if (details.hasTreatmentSystem !== 'มี') return;
  requireStringDetail(details, index, ctx, 'treatmentSystem');
  if (details.treatmentSystem === 'อื่นๆ') {
    requireStringDetail(details, index, ctx, 'treatmentSystemOther');
  }
}

function validateConnectionDevice(
  details: Record<string, unknown>,
  index: number,
  ctx: z.RefinementCtx,
): void {
  if (details.connectionDevice !== 'อื่นๆ') return;
  requireStringDetail(details, index, ctx, 'connectionDeviceOther');
}

function requireStringDetail(
  details: Record<string, unknown>,
  index: number,
  ctx: z.RefinementCtx,
  field: string,
): void {
  const value = details[field];
  if (typeof value === 'string' && value.trim().length > 0) return;
  addDetailIssue(ctx, index, field, `${field} is required`);
}

function requireNumberDetail(
  details: Record<string, unknown>,
  index: number,
  ctx: z.RefinementCtx,
  field: string,
): void {
  const value = details[field];
  if (typeof value === 'number' && Number.isFinite(value)) return;
  addDetailIssue(ctx, index, field, `${field} must be a number`);
}

function addDetailIssue(ctx: z.RefinementCtx, index: number, field: string, message: string): void {
  ctx.addIssue({
    code: 'custom',
    path: ['measurementPoints', index, 'details', field],
    message,
  });
}

function validateMeasurementPointFormSections(
  payload: ContactFormPayloadWithoutRequestType,
  ctx: z.RefinementCtx,
  options: { requireExistingPointCode?: boolean } = {},
): void {
  payload.measurementPoints.forEach((point, index) => {
    if (options.requireExistingPointCode && !point.pointCode) {
      ctx.addIssue({
        code: 'custom',
        path: ['measurementPoints', index, 'pointCode'],
        message: 'Existing measurement point code is required for add parameter request',
      });
    }
    if (!point.details || Object.keys(point.details).length === 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['measurementPoints', index, 'details'],
        message: 'Measurement point detail section is required',
      });
    }
    if (payload.systemType === 'CEMS' && point.documentsAndImages.length === 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['measurementPoints', index, 'documentsAndImages'],
        message: 'Documents and images section is required for CEMS',
      });
    }
    if (!point.measurementInstruments) {
      ctx.addIssue({
        code: 'custom',
        path: ['measurementPoints', index, 'measurementInstruments'],
        message: 'Measurement instruments section is required',
      });
    }
    validateMeasurementPointDetailsBySystem(payload.systemType, point, index, ctx);
  });
}

export const createConnectionRequestSchema = connectionRequestFormSchema.transform((payload) => ({
  ...payload,
  requestType: payload.requestType ?? CONNECTION_REQUEST_TYPE.NEW_CONNECTION,
  remarks: payload.remarks ?? null,
}));

export const resubmitConnectionRequestSchema = createConnectionRequestSchema;

export const addMeasurementPointRequestSchema = connectionRequestFormObjectSchema
  .omit({ requestType: true })
  .superRefine((payload, ctx) => {
    validateContactSection(payload, ctx);
    validateMeasurementPointFormSections(payload, ctx);
  })
  .transform((payload) => ({
    ...normalizeContacts(normalizeFactorySnapshot(stripFrontendSystemTypeAlias(payload))),
    requestType: CONNECTION_REQUEST_TYPE.ADD_MEASUREMENT_POINT,
  }));

export const addParameterRequestSchema = connectionRequestFormObjectSchema
  .omit({ requestType: true })
  .superRefine((payload, ctx) => {
    validateContactSection(payload, ctx);
    if (payload.measurementPoints.length !== 1) {
      ctx.addIssue({
        code: 'custom',
        path: ['measurementPoints'],
        message: 'Add parameter request must reference exactly one measurement point',
      });
    }
    validateMeasurementPointFormSections(payload, ctx, { requireExistingPointCode: true });
  })
  .transform((payload) => ({
    ...normalizeContacts(normalizeFactorySnapshot(stripFrontendSystemTypeAlias(payload))),
    requestType: CONNECTION_REQUEST_TYPE.ADD_PARAMETER,
  }));

export const listConnectionRequestsQuerySchema = z
  .object({
    status: z.nativeEnum(CONNECTION_REQUEST_STATUS).optional(),
    requestType: z.nativeEnum(CONNECTION_REQUEST_TYPE).optional(),
    factoryId: z.string().trim().min(1).max(64).optional(),
    stationId: z.string().trim().min(1).max(64).optional(),
  })
  .strict();

export const listConnectionRequestTableRowsQuerySchema = listConnectionRequestsQuerySchema;

export const listConnectedMeasurementPointsQuerySchema = z
  .object({
    factoryId: z.string().trim().min(1).max(64).optional(),
    stationId: z.string().trim().min(1).max(64).optional(),
  })
  .strict();

const booleanQuerySchema = z
  .preprocess((value) => {
    if (typeof value !== 'string') return value;
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes'].includes(normalized)) return true;
    if (['false', '0', 'no'].includes(normalized)) return false;
    return value;
  }, z.boolean().optional())
  .transform((value) => value ?? false);

export const listOperatorFactoriesQuerySchema = z
  .object({
    systemType: z.enum(['CEMS', 'WPMS']).optional(),
    favoriteOnly: booleanQuerySchema,
  })
  .strict();

export const connectionRequestIdParamsSchema = z
  .object({
    id: z.coerce.number().int().min(1),
  })
  .strict();

export const factoryGeneralParamsSchema = z
  .object({
    factoryId: z.string().trim().min(1).max(64),
  })
  .strict();

export const operatorFactoryFavoriteParamsSchema = factoryGeneralParamsSchema;

export const operatorFactoryFavoriteSchema = z
  .object({
    isFavorite: z.boolean(),
  })
  .strict();

export const connectedMeasurementPointParamsSchema = z
  .object({
    stationId: z.string().trim().min(1).max(64),
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
    action: z.enum(['SAVE', 'CONFIRM']).default('CONFIRM'),
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
