import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from '@jest/globals';
import { pomsOpenApiDocument, pomsOpenApiStats } from '../../src/modules/api-docs/poms.openapi';
import { MENU_TAGS } from '../../src/modules/api-docs/openapi.shared';
import { loginSchema } from '../../src/modules/auth/auth.validator';
import {
  addMeasurementPointRequestSchema,
  addParameterRequestSchema,
  cancelConnectionRequestSchema,
  changeConnectionRequestStatusSchema,
  confirmConnectionSchema,
  createConnectionRequestSchema,
  directConnectionRequestSchema,
  resubmitConnectionRequestSchema,
  reviewConnectionRequestSchema,
  verifyConnectionSchema,
} from '../../src/modules/connection-requests/connection-requests.validator';
import {
  createDeviceConnectionConfigRequestSchema,
  testDeviceConnectionSchema,
} from '../../src/modules/device-connections/device-connections.validator';
import {
  createEligibleFactoryAddRequestSchema,
  createEligibleFactorySchema,
  reviewEligibleFactoryAddRequestSchema,
} from '../../src/modules/eligible-factories/eligible-factories.validator';
import {
  createPomsFactoryEditRequestSchema,
  reviewPomsFactoryEditRequestSchema,
} from '../../src/modules/poms-factories/poms-factories.validator';
import { saveMonitoringPointFormSchema } from '../../src/modules/monitoring-point-forms/monitoring-point-forms.validator';
import {
  changeKwpWorkflowStatusSchema,
  createKwp01SubmissionSchema,
  createKwp02SubmissionSchema,
  createKwp03SubmissionSchema,
  createKwp04SubmissionSchema,
  createKwp05SubmissionSchema,
  resubmitKwpFormSubmissionSchema,
} from '../../src/modules/kwp-form-submissions/kwp-form-submissions.validator';
import {
  changeBodCodWorkflowStatusSchema,
  createBodCodDeviationReportSchema,
  resubmitBodCodDeviationReportSchema,
  upsertBodCodResultNoticeSchema,
} from '../../src/modules/bod-cod-deviations/bod-cod-deviation-reports.validator';
import { BOD_COD_DEVIATION_REPORT_STATUSES } from '../../src/modules/bod-cod-deviations/bod-cod-deviation-reports.types';
import {
  KWP_FORM_STATUSES,
  KWP_FORM_TYPES,
} from '../../src/modules/kwp-form-reports/kwp-form-reports.types';
import {
  createLocalAccountSchema,
  createManagedUserSchema,
  replaceUserPermissionsSchema,
  updateManagedUserSchema,
} from '../../src/modules/users/users.validator';
import {
  createIntegrationAlertEventBatchSchema,
  updateAlertEventStatusSchema,
} from '../../src/modules/alert-events/alert-events.validator';
import { sendEmailTestSchema } from '../../src/modules/email-test/email-test.validator';
import {
  addOfficerNotificationEmailSchema,
  createOfficerNotificationEmailRecipientSchema,
} from '../../src/modules/officer-notification-email-recipients/officer-notification-email-recipients.validator';

type JsonObject = Record<string, unknown>;
type RuntimeSchema = { parse: (value: unknown) => unknown };

const operationMethods = new Set([
  'get',
  'put',
  'post',
  'delete',
  'options',
  'head',
  'patch',
  'trace',
]);

function asObject(value: unknown, label: string): JsonObject {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value as JsonObject;
}

function requestExample(pathKey: string, method: string): unknown {
  const document = asObject(pomsOpenApiDocument, 'OpenAPI document');
  const paths = asObject(document.paths, 'paths');
  const pathItem = asObject(paths[pathKey], pathKey);
  const operation = asObject(pathItem[method], `${method.toUpperCase()} ${pathKey}`);
  const requestBody = asObject(operation.requestBody, 'requestBody');
  const content = asObject(requestBody.content, 'requestBody.content');
  const mediaTypes = ['application/json', 'multipart/form-data'];

  for (const mediaType of mediaTypes) {
    if (mediaType in content) {
      return asObject(content[mediaType], mediaType).example;
    }
  }

  return undefined;
}

function readEndpointRegistryOperations(): string[] {
  const filePath = path.resolve(__dirname, '../../../docs/backend/api/ENDPOINTS.md');
  const markdown = fs.readFileSync(filePath, 'utf8');
  const operations: string[] = [];
  for (const line of markdown.split('\n')) {
    const match = line.match(/^\|\s+`([A-Z]+)`\s+\|\s+`([^`]+)`\s+\|/);
    if (!match) continue;

    const [, method, fullPath] = match;
    const isRootEndpoint = fullPath === '/health' || fullPath.startsWith('/integrations/lasthour/');
    if (!isRootEndpoint && !fullPath.startsWith('/api/v1')) continue;

    const relativePath = (isRootEndpoint ? fullPath : fullPath.replace(/^\/api\/v1/, '')).replace(
      /:([A-Za-z0-9_]+)/g,
      '{$1}',
    );
    operations.push(`${method} ${relativePath || '/'}`);
  }

  return operations.sort();
}

const annualTestingVariants = [
  'GET /connected-measurement-points/{stationId}/{buddhistYear}/requests',
  'GET /connected-measurement-points/{stationId}/{buddhistYear}/parameter-form',
  'GET /connected-measurement-points/{stationId}/{buddhistYear}/device-configs',
  'POST /connected-measurement-points/{stationId}/{buddhistYear}/device-configs',
  'GET /connected-measurement-points/{stationId}/{buddhistYear}/measurement-statistics',
  'GET /connected-measurement-points/{stationId}/{buddhistYear}/measurement-export.csv',
  'GET /connected-measurement-points/{stationId}/{buddhistYear}/calendar-status',
  'GET /connected-measurement-points/{stationId}/{buddhistYear}/calendar-status/details',
  'GET /integrations/device-configs/{stationId}/{buddhistYear}',
].sort();

function writeValidationDocumentation(pathKey: string, method: 'post' | 'put'): JsonObject {
  const document = asObject(pomsOpenApiDocument, 'OpenAPI document');
  const paths = asObject(document.paths, 'paths');
  const operation = asObject(
    asObject(paths[pathKey], pathKey)[method],
    `${method.toUpperCase()} ${pathKey}`,
  );
  const container = isRequestBody(operation.requestBody)
    ? asObject(operation.requestBody, `${pathKey}.requestBody`)
    : operation;

  return asObject(
    container['x-poms-request-validation'],
    `${method.toUpperCase()} ${pathKey}.x-poms-request-validation`,
  );
}

function isRequestBody(value: unknown): value is JsonObject {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function validationFields(documentation: JsonObject): JsonObject[] {
  const mediaTypes = documentation.mediaTypes as JsonObject[];
  return mediaTypes.flatMap((mediaType) => mediaType.fields as JsonObject[]);
}

describe('POMS OpenAPI contract', () => {
  it('documents the current permission-management input and response matrices', () => {
    const document = asObject(pomsOpenApiDocument, 'OpenAPI document');
    const schemas = asObject(asObject(document.components, 'components').schemas, 'schemas');
    const editableInput = asObject(schemas.EditablePermissionGroups, 'EditablePermissionGroups');
    const inputProperties = asObject(
      editableInput.properties,
      'EditablePermissionGroups.properties',
    );
    const chatInput = asObject(inputProperties.chat, 'EditablePermissionGroups.chat');
    const chatInputProperties = asObject(
      chatInput.properties,
      'EditablePermissionGroups.chat.properties',
    );
    const connectionInput = asObject(
      inputProperties.connection,
      'EditablePermissionGroups.connection',
    );
    const connectionInputProperties = asObject(
      connectionInput.properties,
      'EditablePermissionGroups.connection.properties',
    );

    expect(editableInput.additionalProperties).toBe(false);
    expect(chatInputProperties).toEqual({
      view: { type: 'boolean' },
      edit: { type: 'boolean' },
    });
    expect(connectionInputProperties).toHaveProperty('data');
    expect(connectionInputProperties).not.toHaveProperty('estateCode');
    expect(connectionInputProperties).not.toHaveProperty('estate');
    expect(connectionInputProperties).not.toHaveProperty('direct_connect');
    expect(inputProperties).not.toHaveProperty('api_documentation');

    const editableResponse = asObject(
      schemas.EditablePermissionGroupsResponse,
      'EditablePermissionGroupsResponse',
    );
    const responseProperties = asObject(
      editableResponse.properties,
      'EditablePermissionGroupsResponse.properties',
    );
    const eligibleFactoriesResponse = asObject(
      responseProperties.eligible_factories,
      'EditablePermissionGroupsResponse.eligible_factories',
    );
    const eligibleFactoriesResponseProperties = asObject(
      eligibleFactoriesResponse.properties,
      'EditablePermissionGroupsResponse.eligible_factories.properties',
    );
    expect(eligibleFactoriesResponseProperties).not.toHaveProperty('estateCode');
    expect(eligibleFactoriesResponseProperties).not.toHaveProperty('estate');

    const paths = asObject(document.paths, 'paths');
    const getUser = asObject(asObject(paths['/users/{id}'], '/users/{id}').get, 'GET /users/{id}');
    const successResponse = asObject(
      asObject(getUser.responses, 'getUser.responses')['200'],
      '200',
    );
    const content = asObject(successResponse.content, 'getUser.200.content');
    const mediaType = asObject(content['application/json'], 'getUser.application/json');
    expect(mediaType.schema).toEqual({ $ref: '#/components/schemas/ManagedUserEditResponse' });
  });

  it.each<[string, string, RuntimeSchema]>([
    ['/auth/login', 'post', loginSchema],
    ['/cems-wpms-requests', 'post', createConnectionRequestSchema],
    ['/cems-wpms-requests/measurement-points', 'post', addMeasurementPointRequestSchema],
    ['/cems-wpms-requests/parameters', 'post', addParameterRequestSchema],
    ['/cems-wpms-requests/direct-connections', 'post', directConnectionRequestSchema],
    ['/cems-wpms-requests/{id}/form', 'put', resubmitConnectionRequestSchema],
    ['/cems-wpms-requests/{id}/review', 'post', reviewConnectionRequestSchema],
    ['/cems-wpms-requests/{id}/status', 'post', changeConnectionRequestStatusSchema],
    ['/cems-wpms-requests/{id}/cancel', 'post', cancelConnectionRequestSchema],
    ['/cems-wpms-requests/{id}/confirm-connection', 'post', confirmConnectionSchema],
    ['/cems-wpms-requests/{id}/verify-connection', 'post', verifyConnectionSchema],
    ['/device-connections/test-connection', 'post', testDeviceConnectionSchema],
    ['/cems-wpms-requests/{id}/device-configs', 'post', createDeviceConnectionConfigRequestSchema],
    [
      '/connected-measurement-points/{stationId}/device-configs',
      'post',
      createDeviceConnectionConfigRequestSchema,
    ],
    ['/users/local-accounts', 'post', createLocalAccountSchema],
    ['/users', 'post', createManagedUserSchema],
    ['/users/{id}', 'patch', updateManagedUserSchema],
    ['/users/{id}/permissions', 'put', replaceUserPermissionsSchema],
    ['/eligible-factories', 'post', createEligibleFactorySchema],
    ['/eligible-factories/add-requests', 'post', createEligibleFactoryAddRequestSchema],
    ['/eligible-factories/add-requests/{id}/review', 'post', reviewEligibleFactoryAddRequestSchema],
    ['/poms-factories/{factoryId}/edit-requests', 'post', createPomsFactoryEditRequestSchema],
    ['/poms-factories/edit-requests/{id}/review', 'post', reviewPomsFactoryEditRequestSchema],
    ['/monitoring-point-forms', 'post', saveMonitoringPointFormSchema],
    ['/monitoring-point-forms/{id}', 'put', saveMonitoringPointFormSchema],
    ['/kwp-form-submissions/kwp01', 'post', createKwp01SubmissionSchema],
    ['/kwp-form-submissions/kwp01/{id}', 'patch', createKwp01SubmissionSchema],
    ['/kwp-form-submissions/kwp02', 'post', createKwp02SubmissionSchema],
    ['/kwp-form-submissions/kwp03', 'post', createKwp03SubmissionSchema],
    ['/kwp-form-submissions/kwp04', 'post', createKwp04SubmissionSchema],
    ['/kwp-form-submissions/kwp05', 'post', createKwp05SubmissionSchema],
    ['/kwp-form-submissions/kwp01/{id}/resubmit', 'post', resubmitKwpFormSubmissionSchema],
    ['/kwp-form-submissions/{id}/workflow-actions', 'post', changeKwpWorkflowStatusSchema],
    ['/bod-cod-deviation-reports', 'post', createBodCodDeviationReportSchema],
    ['/bod-cod-deviation-reports/{id}/resubmission', 'put', resubmitBodCodDeviationReportSchema],
    ['/bod-cod-deviation-reports/{id}/workflow-actions', 'post', changeBodCodWorkflowStatusSchema],
    ['/bod-cod-deviation-reports/{id}/result-notice', 'post', upsertBodCodResultNoticeSchema],
    ['/integrations/alert-events', 'post', createIntegrationAlertEventBatchSchema],
    ['/alert-events/{id}/status', 'patch', updateAlertEventStatusSchema],
    ['/email-test/send', 'post', sendEmailTestSchema],
    [
      '/officer-notification-email-recipients',
      'post',
      createOfficerNotificationEmailRecipientSchema,
    ],
    [
      '/officer-notification-email-recipients/{id}/emails',
      'post',
      addOfficerNotificationEmailSchema,
    ],
  ])('keeps the example for %s valid against the runtime schema', (pathKey, method, schema) => {
    expect(() => schema.parse(requestExample(pathKey, method))).not.toThrow();
  });

  it('keeps every local component reference resolvable', () => {
    const document = asObject(pomsOpenApiDocument, 'OpenAPI document');
    const components = asObject(document.components, 'components');
    const serialized = JSON.stringify(document);
    const references = serialized.matchAll(/"\$ref":"#\/components\/([^/]+)\/([^"/]+)"/g);

    for (const match of references) {
      const sectionName = match[1];
      const componentName = match[2];
      const section = asObject(components[sectionName], `components.${sectionName}`);
      expect(section[componentName]).toBeDefined();
    }
  });

  it('adds human-readable enum labels for connection-request filters and workflow actions', () => {
    const document = asObject(pomsOpenApiDocument, 'OpenAPI document');
    const paths = asObject(document.paths, 'paths');
    const listRequests = asObject(paths['/cems-wpms-requests'], '/cems-wpms-requests');
    const listParameters = (listRequests.get as JsonObject).parameters as JsonObject[];
    const statusParameter = listParameters.find((parameter) => parameter.name === 'status');
    const requestTypeParameter = listParameters.find(
      (parameter) => parameter.name === 'requestType',
    );
    const reviewOperation = asObject(
      asObject(paths['/cems-wpms-requests/{id}/review'], '/cems-wpms-requests/{id}/review').post,
      'POST /cems-wpms-requests/{id}/review',
    );
    const statusOperation = asObject(
      asObject(paths['/cems-wpms-requests/{id}/status'], '/cems-wpms-requests/{id}/status').post,
      'POST /cems-wpms-requests/{id}/status',
    );

    const statusParameterSchema = asObject(
      asObject(statusParameter, 'statusParameter').schema,
      'statusParameter.schema',
    );
    expect(statusParameterSchema['x-enum-labels']).toMatchObject({
      PENDING_DESIGN_REVIEW: 'รอพิจารณาแบบ',
      WAITING_FACTORY_REVISION: 'รอโรงงานแก้ไข',
      CONNECTED: 'เชื่อมต่อแล้ว',
    });
    expect(statusParameterSchema['x-enum-descriptions']).toMatchObject({
      WAITING_CONNECTION: 'แบบผ่านแล้วและรอโรงงานตั้งค่าอุปกรณ์เพื่อเชื่อมต่อ',
      CONNECTED: 'เชื่อมต่อสำเร็จและใช้งานในระบบแล้ว',
    });
    expect((statusParameter?.description as string) || '').toContain('รอโรงงานตั้งค่าอุปกรณ์');
    expect((statusParameter?.description as string) || '').toContain('CONNECTION_CONFIRMED');
    const requestTypeParameterSchema = asObject(
      asObject(requestTypeParameter, 'requestTypeParameter').schema,
      'requestTypeParameter.schema',
    );
    expect(requestTypeParameterSchema['x-enum-labels']).toMatchObject({
      NEW_CONNECTION: 'ขอเชื่อมต่อใหม่',
      ADD_MEASUREMENT_POINT: 'เพิ่มจุดตรวจวัด',
      ADD_PARAMETER: 'เพิ่มพารามิเตอร์',
    });
    expect(requestTypeParameterSchema['x-enum-descriptions']).toMatchObject({
      ADD_MEASUREMENT_POINT: 'ใช้เมื่อขอเพิ่มจุดตรวจวัดในโรงงานที่มีอยู่แล้ว',
      ADD_PARAMETER: 'ใช้เมื่อขอเพิ่มพารามิเตอร์ในจุดตรวจวัดเดิม',
    });
    expect((requestTypeParameter?.description as string) || '').toContain('เพิ่มจุดตรวจวัด');
    expect((requestTypeParameter?.description as string) || '').toContain('ADD_PARAMETER');

    const reviewSchema = asObject(
      asObject(
        asObject(reviewOperation.requestBody, 'review.requestBody').content,
        'review.content',
      )['application/json'] as unknown,
      'review.application/json',
    ).schema as JsonObject;
    const approveDecision = asObject(
      asObject((reviewSchema.oneOf as JsonObject[])[0], 'review.oneOf[0]').properties as unknown,
      'review.oneOf[0].properties',
    ).decision as JsonObject;
    const approveBranchProperties = asObject(
      asObject((reviewSchema.oneOf as JsonObject[])[0], 'review.oneOf[0]').properties as unknown,
      'review.oneOf[0].properties',
    );

    expect(approveDecision['x-enum-labels']).toMatchObject({
      APPROVE_DESIGN: 'อนุมัติแบบ',
    });
    expect(
      asObject(approveBranchProperties.pointCodeAssignments, 'review.pointCodeAssignments'),
    ).toMatchObject(
      expect.objectContaining({
        type: 'array',
        items: expect.objectContaining({ $ref: '#/components/schemas/PointCodeAssignment' }),
      }),
    );
    expect(asObject(reviewOperation.responses, 'review.responses')).toHaveProperty('409');

    const pointCodeAssignmentSchema = asObject(
      asObject(asObject(document.components, 'components').schemas, 'schemas')
        .PointCodeAssignment as unknown,
      'PointCodeAssignment',
    );
    const manualAssignmentProperties = asObject(
      pointCodeAssignmentSchema.properties as unknown,
      'PointCodeAssignment.properties',
    );
    expect(asObject(manualAssignmentProperties.pointCode, 'manual.pointCode')).toMatchObject({
      pattern: '^[SP]\\d{4}$',
    });

    const changeStatusSchema = asObject(
      asObject(
        asObject(statusOperation.requestBody, 'status.requestBody').content,
        'status.content',
      )['application/json'] as unknown,
      'status.application/json',
    ).schema as JsonObject;
    const returnAction = asObject(
      asObject((changeStatusSchema.oneOf as JsonObject[])[2], 'status.oneOf[2]')
        .properties as unknown,
      'status.oneOf[2].properties',
    ).action as JsonObject;
    const approveFormBranchProperties = asObject(
      asObject((changeStatusSchema.oneOf as JsonObject[])[0], 'status.oneOf[0]')
        .properties as unknown,
      'status.oneOf[0].properties',
    );

    expect(returnAction['x-enum-labels']).toMatchObject({
      RETURN_TO_WAITING_CONNECTION: 'ย้อนกลับไปรอเชื่อมต่อ',
    });
    expect(
      asObject(approveFormBranchProperties.pointCodeAssignments, 'status.pointCodeAssignments'),
    ).toMatchObject(
      expect.objectContaining({
        type: 'array',
        items: expect.objectContaining({ $ref: '#/components/schemas/PointCodeAssignment' }),
      }),
    );
    expect(asObject(statusOperation.responses, 'status.responses')).toHaveProperty('409');

    const connectionRequestResponse = asObject(
      asObject(asObject(document.components, 'components').schemas, 'schemas')
        .ConnectionRequestResponse as unknown,
      'ConnectionRequestResponse',
    );
    const responseMeasurementPointProperties = asObject(
      asObject(
        asObject(
          asObject(connectionRequestResponse.properties, 'ConnectionRequestResponse.properties')
            .data as unknown,
          'ConnectionRequestResponse.data',
        ).properties as unknown,
        'ConnectionRequestResponse.data.properties',
      ).measurementPoints as unknown,
      'ConnectionRequestResponse.measurementPoints',
    );
    const responseMeasurementPointItemProperties = asObject(
      asObject(responseMeasurementPointProperties.items as unknown, 'measurementPoints.items')
        .properties as unknown,
      'measurementPoints.items.properties',
    );
    const assignmentMode = asObject(
      responseMeasurementPointItemProperties.pointCodeAssignmentMode,
      'measurementPoints.items.properties.pointCodeAssignmentMode',
    );
    expect(assignmentMode.nullable).toBe(true);
    expect(assignmentMode.enum).toEqual(
      expect.arrayContaining(['AUTO', 'MANUAL_LEGACY', 'OFFICER_DIRECT', 'LEGACY_IMPORTED']),
    );
  });

  it('uses unique operation IDs and complete path parameters', () => {
    const document = asObject(pomsOpenApiDocument, 'OpenAPI document');
    const paths = asObject(document.paths, 'paths');
    const operationIds = new Set<string>();

    for (const [pathKey, rawPathItem] of Object.entries(paths)) {
      const pathItem = asObject(rawPathItem, pathKey);
      const placeholders = [...pathKey.matchAll(/\{([^}]+)\}/g)].map((match) => match[1]);

      for (const [method, rawOperation] of Object.entries(pathItem)) {
        if (!operationMethods.has(method)) continue;

        const operation = asObject(rawOperation, `${method.toUpperCase()} ${pathKey}`);
        const operationId = operation.operationId;
        expect(typeof operationId).toBe('string');
        expect(operationIds.has(operationId as string)).toBe(false);
        operationIds.add(operationId as string);

        const parameters = Array.isArray(operation.parameters) ? operation.parameters : [];
        const pathParameters = parameters
          .map((parameter) => asObject(parameter, 'parameter'))
          .filter((parameter) => parameter.in === 'path');

        for (const placeholder of placeholders) {
          expect(pathParameters).toEqual(
            expect.arrayContaining([
              expect.objectContaining({ name: placeholder, in: 'path', required: true }),
            ]),
          );
        }
      }
    }
  });

  it('covers all 127 canonical registry endpoints plus 9 annual testing variants', () => {
    const document = asObject(pomsOpenApiDocument, 'OpenAPI document');
    const paths = asObject(document.paths, 'paths');
    const documentedOperations: string[] = [];

    for (const [pathKey, rawPathItem] of Object.entries(paths)) {
      const pathItem = asObject(rawPathItem, pathKey);
      for (const method of Object.keys(pathItem)) {
        if (!operationMethods.has(method)) continue;
        documentedOperations.push(`${method.toUpperCase()} ${pathKey}`);
      }
    }

    const registryOperations = readEndpointRegistryOperations();
    expect(registryOperations).toHaveLength(127);
    expect(documentedOperations.sort()).toEqual(
      [...registryOperations, ...annualTestingVariants].sort(),
    );
    expect(pomsOpenApiStats).toEqual({
      canonicalOperationCount: 127,
      operationCount: 136,
      tagCount: 11,
    });
  });

  it('documents request-body validation for every POST and PUT operation', () => {
    const document = asObject(pomsOpenApiDocument, 'OpenAPI document');
    const paths = asObject(document.paths, 'paths');
    const writeOperations: Array<[string, 'post' | 'put', JsonObject]> = [];

    for (const [pathKey, rawPathItem] of Object.entries(paths)) {
      const pathItem = asObject(rawPathItem, pathKey);
      for (const method of ['post', 'put'] as const) {
        if (!(method in pathItem)) continue;
        writeOperations.push([
          pathKey,
          method,
          asObject(pathItem[method], `${method.toUpperCase()} ${pathKey}`),
        ]);
      }
    }

    expect(writeOperations).toHaveLength(53);
    expect(
      writeOperations.filter(([, , operation]) => isRequestBody(operation.requestBody)),
    ).toHaveLength(52);

    for (const [pathKey, method, operation] of writeOperations) {
      const hasRequestBody = isRequestBody(operation.requestBody);
      const container = hasRequestBody
        ? asObject(operation.requestBody, `${pathKey}.requestBody`)
        : operation;
      const documentation = asObject(
        container['x-poms-request-validation'],
        `${method.toUpperCase()} ${pathKey}.x-poms-request-validation`,
      );
      const description = String(hasRequestBody ? container.description : operation.description);

      expect(description).toContain('Validation ของ Request body');
      expect(documentation.bodyRequired).toBe(hasRequestBody);
      expect(Array.isArray(documentation.mediaTypes)).toBe(true);

      if (hasRequestBody) {
        expect(description).toContain('| Field | การส่งค่า | รับ `null` | Data type |');
        expect((documentation.mediaTypes as JsonObject[]).length).toBeGreaterThan(0);
      } else {
        expect(description).toContain('Operation นี้ไม่รับ request body');
        expect(documentation.mediaTypes).toEqual([]);
      }
    }
  });

  it('publishes required, nullable, type, range and cross-field rules for key write APIs', () => {
    const addPoint = writeValidationDocumentation('/cems-wpms-requests/measurement-points', 'post');
    const addPointFields = validationFields(addPoint);
    expect(addPointFields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: 'measurementPoints',
          requirement: 'required',
          nullable: false,
          type: 'array<object>',
          rules: expect.arrayContaining(['จำนวน 1–100 รายการ']),
        }),
        expect.objectContaining({
          field: 'measurementPoints[].pointName',
          requirement: 'required',
          nullable: false,
          type: 'string',
          rules: expect.arrayContaining(['ความยาว 1–255 ตัวอักษร']),
        }),
      ]),
    );

    const directConnection = writeValidationDocumentation(
      '/cems-wpms-requests/direct-connections',
      'post',
    );
    const directFields = validationFields(directConnection);
    for (const field of ['factoryId', 'factoryRegistrationNo']) {
      expect(directFields).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field,
            requirement: 'conditional',
            nullable: true,
            type: 'string',
            condition: expect.stringContaining('factoryId หรือ factoryRegistrationNo'),
          }),
        ]),
      );
    }
    expect(
      (directConnection.mediaTypes as JsonObject[]).flatMap(
        (mediaType) => mediaType.rules as string[],
      ),
    ).toEqual(
      expect.arrayContaining([
        expect.stringContaining('ต้องมี factoryId หรือ factoryRegistrationNo อย่างน้อยหนึ่งค่า'),
      ]),
    );
    expect(
      (directConnection.mediaTypes as JsonObject[]).flatMap(
        (mediaType) => mediaType.rules as string[],
      ),
    ).not.toEqual(expect.arrayContaining([expect.stringContaining('รูปแบบ 1 หรือ รูปแบบ 2')]));

    const eligibleFactoryFields = validationFields(
      writeValidationDocumentation('/eligible-factories', 'post'),
    );
    expect(eligibleFactoryFields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: 'factoryClass',
          requirement: 'required',
          nullable: true,
          type: 'string',
        }),
      ]),
    );

    expect(addPointFields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field:
            'measurementPoints[].measurementInstruments.parameters[].standardCriteria.standardValue',
          type: 'string หรือ number',
        }),
        expect.objectContaining({
          field:
            'measurementPoints[].measurementInstruments.parameters[].eiaCriteria.standardValue',
          type: 'string หรือ number',
        }),
      ]),
    );
  });

  it('explains one-of workflow branches and multipart file-or-link validation', () => {
    const statusDocumentation = writeValidationDocumentation(
      '/cems-wpms-requests/{id}/status',
      'post',
    );
    expect(validationFields(statusDocumentation)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: 'revisionReason',
          requirement: 'conditional',
          condition: 'action=REQUEST_REVISION',
          nullable: false,
        }),
      ]),
    );

    const uploadDocumentation = writeValidationDocumentation(
      '/cems-wpms-requests/document-images',
      'post',
    );
    expect((uploadDocumentation.mediaTypes as JsonObject[])[0]).toEqual(
      expect.objectContaining({ mediaType: 'multipart/form-data' }),
    );
    expect(validationFields(uploadDocumentation)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          field: 'file',
          requirement: 'conditional',
          nullable: false,
          type: 'file',
        }),
        expect.objectContaining({
          field: 'link',
          requirement: 'conditional',
          nullable: false,
          type: 'string',
          rules: expect.arrayContaining(['URL/URI ที่ถูกต้อง']),
        }),
      ]),
    );

    const document = asObject(pomsOpenApiDocument, 'OpenAPI document');
    const paths = asObject(document.paths, 'paths');
    const addPointOperation = asObject(
      asObject(
        paths['/cems-wpms-requests/measurement-points'],
        '/cems-wpms-requests/measurement-points',
      ).post,
      'POST /cems-wpms-requests/measurement-points',
    );
    const addPointBody = asObject(addPointOperation.requestBody, 'add point requestBody');
    expect(addPointBody.description).toContain('`string หรือ number`');
  });

  it('groups every operation under exactly one declared user-menu tag', () => {
    const document = asObject(pomsOpenApiDocument, 'OpenAPI document');
    const paths = asObject(document.paths, 'paths');
    const declaredTags = (document.tags as JsonObject[]).map((tag) => tag.name);

    expect(declaredTags).toEqual(Object.values(MENU_TAGS));

    for (const [pathKey, rawPathItem] of Object.entries(paths)) {
      const pathItem = asObject(rawPathItem, pathKey);
      for (const [method, rawOperation] of Object.entries(pathItem)) {
        if (!operationMethods.has(method)) continue;
        const operation = asObject(rawOperation, `${method.toUpperCase()} ${pathKey}`);
        expect(operation.tags).toHaveLength(1);
        expect(declaredTags).toContain((operation.tags as string[])[0]);
      }
    }
  });

  it('uses the expected security model for public, bearer and API-key endpoints', () => {
    const document = asObject(pomsOpenApiDocument, 'OpenAPI document');
    const paths = asObject(document.paths, 'paths');

    expect(asObject(asObject(paths['/auth/login'], 'login').post, 'login.post').security).toEqual(
      [],
    );
    expect(
      asObject(asObject(paths['/public/factory-map-points'], 'public').get, 'public.get').security,
    ).toEqual([]);
    expect(
      asObject(
        asObject(paths['/integrations/alert-events'], 'integration').post,
        'integration.post',
      ).security,
    ).toEqual([{ alertEventApiKey: [] }]);
    expect(
      asObject(asObject(paths['/cems-wpms-requests'], 'requests').get, 'requests.get').security,
    ).toEqual([{ bearerAuth: [] }]);
  });

  it('documents the operator-owned factory overview and POMS membership contract', () => {
    const document = asObject(pomsOpenApiDocument, 'OpenAPI document');
    const paths = asObject(document.paths, 'paths');
    const operation = asObject(
      asObject(paths['/operator-factories'], '/operator-factories').get,
      'GET /operator-factories',
    );
    const parameters = operation.parameters as JsonObject[];

    expect(operation).toMatchObject({
      operationId: 'listOperatorFactoryOverview',
      security: [{ bearerAuth: [] }],
      'x-poms-permissions': ['dashboard:view'],
      'x-poms-permission-mode': 'any',
    });
    expect(operation.description).toContain('operator');
    expect(operation.description).toContain('OWN_FACTORY');

    expect(
      asObject(
        asObject(
          parameters.find((parameter) => parameter.name === 'systemType'),
          'systemType parameter',
        ).schema,
        'systemType schema',
      ).enum,
    ).toEqual(['CEMS', 'WPMS']);
    expect(
      asObject(
        asObject(
          parameters.find((parameter) => parameter.name === 'favoriteOnly'),
          'favoriteOnly parameter',
        ).schema,
        'favoriteOnly schema',
      ).type,
    ).toBe('boolean');
    expect(
      asObject(
        asObject(
          parameters.find((parameter) => parameter.name === 'pomsMembershipStatus'),
          'pomsMembershipStatus parameter',
        ).schema,
        'pomsMembershipStatus schema',
      ).enum,
    ).toEqual(['IN_POMS', 'NOT_IN_POMS']);

    const responses = asObject(operation.responses, 'operator factory overview responses');
    const responseSchema = asObject(
      asObject(
        asObject(asObject(responses['200'], '200 response').content, '200 response content')[
          'application/json'
        ],
        'application/json response',
      ).schema,
      'operator factory overview response schema',
    );
    expect(responseSchema.$ref).toBe('#/components/schemas/OperatorFactoryOverviewResponse');

    const schemas = asObject(asObject(document.components, 'components').schemas, 'schemas');
    const rowProperties = asObject(
      asObject(schemas.OperatorFactoryOverviewRow, 'OperatorFactoryOverviewRow').properties,
      'OperatorFactoryOverviewRow.properties',
    );
    expect(asObject(rowProperties.pomsMembershipStatus, 'pomsMembershipStatus').enum).toEqual([
      'IN_POMS',
      'NOT_IN_POMS',
    ]);
    expect(rowProperties).not.toHaveProperty('latestConnectionRequest');
    expect(schemas).not.toHaveProperty('OperatorFactoryLatestConnectionRequest');

    const response = asObject(schemas.OperatorFactoryOverviewResponse, 'overview response');
    const responseProperties = asObject(response.properties, 'overview response properties');
    const metaProperties = asObject(
      asObject(responseProperties.meta, 'overview meta').properties,
      'overview meta properties',
    );
    const summaryProperties = asObject(
      asObject(metaProperties.summary, 'overview summary').properties,
      'overview summary properties',
    );
    expect(Object.keys(summaryProperties).sort()).toEqual(
      ['all', 'connectionInProgress', 'inPoms', 'notConnected'].sort(),
    );
  });

  it('documents the eligible-factory add-request workflow and operator request state', () => {
    const document = asObject(pomsOpenApiDocument, 'OpenAPI document');
    const paths = asObject(document.paths, 'paths');
    const schemas = asObject(asObject(document.components, 'components').schemas, 'schemas');
    expect(schemas.CreateEligibleFactoryRequest).toBeDefined();
    expect(schemas).not.toHaveProperty('CreateEligibleFactorySelectionRequest');
    const addRequests = asObject(
      paths['/eligible-factories/add-requests'],
      '/eligible-factories/add-requests',
    );
    const listOperation = asObject(addRequests.get, 'GET add requests');
    const listParameters = listOperation.parameters as JsonObject[];
    expect(listParameters.map((parameter) => parameter.name)).toEqual(['search']);
    const searchParameter = asObject(listParameters[0], 'search parameter');
    const searchSchema = asObject(searchParameter.schema, 'search schema');
    expect(searchParameter).toMatchObject({ name: 'search', in: 'query', required: false });
    expect(searchSchema).toMatchObject({ minLength: 1, maxLength: 200 });
    expect(listOperation.description).toEqual(expect.stringContaining('คืนคำขอทุกสถานะ'));
    expect(listOperation.description).toEqual(expect.stringContaining('โดยไม่แบ่งหน้า'));
    expect(listOperation.description).toEqual(
      expect.stringContaining('status, page และ perPage ไม่อยู่ใน contract'),
    );

    const listResponse = asObject(
      schemas.EligibleFactoryAddRequestListResponse,
      'EligibleFactoryAddRequestListResponse',
    );
    const listResponseProperties = asObject(
      listResponse.properties,
      'EligibleFactoryAddRequestListResponse.properties',
    );
    const listMeta = asObject(
      listResponseProperties.meta,
      'EligibleFactoryAddRequestListResponse.meta',
    );
    const listMetaProperties = asObject(
      listMeta.properties,
      'EligibleFactoryAddRequestListResponse.meta.properties',
    );
    expect(listMeta.additionalProperties).toBe(false);
    expect(listMeta.required).toEqual(['total']);
    expect(Object.keys(listMetaProperties)).toEqual(['total']);
    expect(listMetaProperties.total).toEqual(
      expect.objectContaining({ type: 'integer', minimum: 0 }),
    );

    const createResponses = asObject(
      asObject(addRequests.post, 'POST add requests').responses,
      'POST add request responses',
    );
    const reviewOperation = asObject(
      asObject(paths['/eligible-factories/add-requests/{id}/review'], 'review add request').post,
      'POST review add request',
    );
    const reviewResponses = asObject(reviewOperation.responses, 'POST review responses');
    expect(createResponses['201']).toBeDefined();
    expect(createResponses['409']).toBeDefined();
    expect(reviewResponses['200']).toBeDefined();
    expect(reviewResponses['409']).toBeDefined();

    const addRequestProperties = asObject(
      asObject(schemas.EligibleFactoryAddRequest, 'EligibleFactoryAddRequest').properties,
      'EligibleFactoryAddRequest.properties',
    );
    expect(asObject(addRequestProperties.factoryRegistrationNo, 'factoryRegistrationNo')).toEqual(
      expect.objectContaining({ type: 'string', minLength: 1, maxLength: 80 }),
    );
    expect(addRequestProperties).toHaveProperty('reviewNote');
    expect(addRequestProperties).not.toHaveProperty('officerNote');
    const eligibleFactoryIdSchema = asObject(
      addRequestProperties.eligibleFactoryId,
      'eligibleFactoryId',
    );
    expect(eligibleFactoryIdSchema).toEqual(
      expect.objectContaining({ type: 'integer', minimum: 1, nullable: true }),
    );
    expect(eligibleFactoryIdSchema.description).toEqual(
      expect.stringContaining('คำขอที่อนุมัติใหม่คืน null'),
    );
    expect(eligibleFactoryIdSchema.description).toEqual(
      expect.stringContaining('ข้อมูลประวัติเดิมอาจยังมี id'),
    );

    const reviewSchema = asObject(
      schemas.ReviewEligibleFactoryAddRequest,
      'ReviewEligibleFactoryAddRequest',
    );
    const reviewBranches = reviewSchema.oneOf as JsonObject[];
    expect(reviewBranches).toHaveLength(2);
    const approveBranch = asObject(reviewBranches[0], 'ReviewEligibleFactoryAddRequest.APPROVE');
    const approveProperties = asObject(
      approveBranch.properties,
      'ReviewEligibleFactoryAddRequest.APPROVE.properties',
    );
    const rejectBranch = asObject(reviewBranches[1], 'ReviewEligibleFactoryAddRequest.REJECT');
    const rejectProperties = asObject(
      rejectBranch.properties,
      'ReviewEligibleFactoryAddRequest.REJECT.properties',
    );
    expect(asObject(approveProperties.decision, 'APPROVE decision').enum).toEqual(['APPROVE']);
    expect(approveBranch.required).toEqual(['decision']);
    expect(asObject(approveProperties.officerNote, 'APPROVE officerNote')).toEqual(
      expect.objectContaining({ minLength: 1, maxLength: 1000, nullable: true }),
    );
    expect(asObject(rejectProperties.decision, 'REJECT decision').enum).toEqual(['REJECT']);
    expect(rejectBranch.required).toEqual(['decision', 'officerNote']);
    expect(asObject(rejectProperties.officerNote, 'REJECT officerNote')).toEqual(
      expect.objectContaining({ minLength: 1, maxLength: 1000 }),
    );
    expect(asObject(rejectProperties.officerNote, 'REJECT officerNote').nullable).toBeUndefined();
    expect(reviewOperation.description).toEqual(expect.stringContaining('เปลี่ยนเฉพาะสถานะคำขอ'));
    expect(reviewOperation.description).toEqual(
      expect.stringContaining('โดยไม่สร้าง ไม่ restore และไม่แก้ไข eligible_factories'),
    );

    const operatorFactories = asObject(
      asObject(
        paths['/cems-wpms-requests/operator-factories'],
        '/cems-wpms-requests/operator-factories',
      ).get,
      'GET operator factories',
    );
    const operatorResponses = asObject(operatorFactories.responses, 'operator responses');
    const operatorResponseSchema = asObject(
      asObject(
        asObject(
          asObject(operatorResponses['200'], 'operator 200').content,
          'operator 200 content',
        )['application/json'],
        'operator application/json',
      ).schema,
      'operator response schema',
    );
    expect(operatorResponseSchema.$ref).toBe('#/components/schemas/OperatorFactoryTableResponse');

    const operatorRow = asObject(schemas.OperatorFactoryTableRow, 'OperatorFactoryTableRow');
    expect(operatorRow.required).toEqual(
      expect.arrayContaining(['eligibilityRequest', 'canRequestEligibility']),
    );
    const operatorRowProperties = asObject(
      operatorRow.properties,
      'OperatorFactoryTableRow.properties',
    );
    expect(operatorRowProperties).toHaveProperty('eligibilityRequest');
    expect(operatorRowProperties).toHaveProperty('canRequestEligibility');
  });

  it('documents the Fac60k source-factory lookup path, permission, and response schema', () => {
    const document = asObject(pomsOpenApiDocument, 'OpenAPI document');
    const paths = asObject(document.paths, 'paths');
    const schemas = asObject(asObject(document.components, 'components').schemas, 'schemas');
    const operation = asObject(
      asObject(
        paths['/eligible-factories/source-factories/{factoryRegistrationNo}'],
        'source factory lookup',
      ).get,
      'GET source factory lookup',
    );

    expect(operation.operationId).toBe('getEligibleFactorySourceFactory');
    expect(operation['x-poms-permissions']).toEqual(['eligible_factories:view']);
    expect(operation['x-poms-permission-mode']).toBe('any');

    const parameters = operation.parameters as JsonObject[];
    const registrationNoParameter = asObject(
      parameters.find((parameter) => parameter.name === 'factoryRegistrationNo'),
      'factoryRegistrationNo path parameter',
    );
    expect(registrationNoParameter).toMatchObject({
      name: 'factoryRegistrationNo',
      in: 'path',
      required: true,
    });
    expect(asObject(registrationNoParameter.schema, 'factoryRegistrationNo schema')).toMatchObject({
      type: 'string',
      minLength: 1,
      maxLength: 64,
    });

    const responses = asObject(operation.responses, 'source factory lookup responses');
    expect(responses['404']).toBeDefined();
    const successSchema = asObject(
      asObject(
        asObject(asObject(responses['200'], 'source factory 200').content, '200 content')[
          'application/json'
        ],
        '200 application/json',
      ).schema,
      'source factory response schema',
    );
    expect(successSchema.$ref).toBe('#/components/schemas/EligibleFactoryCandidateResponse');

    const responseProperties = asObject(
      asObject(schemas.EligibleFactoryCandidateResponse, 'EligibleFactoryCandidateResponse')
        .properties,
      'EligibleFactoryCandidateResponse.properties',
    );
    expect(asObject(responseProperties.data, 'EligibleFactoryCandidateResponse.data').$ref).toBe(
      '#/components/schemas/EligibleFactoryCandidate',
    );

    const candidate = asObject(schemas.EligibleFactoryCandidate, 'EligibleFactoryCandidate');
    expect(candidate.required).toEqual(
      expect.arrayContaining([
        'factoryName',
        'factoryId',
        'factoryRegistrationNo',
        'factoryClass',
        'factorySubclass',
        'address',
        'provinceName',
        'industrialEstateName',
        'longitude',
        'latitude',
        'businessActivity',
        'operationStatus',
        'hasEia',
      ]),
    );
    const candidateProperties = asObject(
      candidate.properties,
      'EligibleFactoryCandidate.properties',
    );
    expect(candidateProperties).toEqual(
      expect.objectContaining({
        factoryRegistrationNo: expect.objectContaining({ type: 'string', maxLength: 64 }),
        factoryClass: expect.objectContaining({ type: 'string', nullable: true }),
        factorySubclass: expect.objectContaining({ type: 'string', nullable: true }),
        operationStatus: expect.objectContaining({ type: 'string' }),
        hasEia: expect.objectContaining({ type: 'boolean', nullable: true }),
      }),
    );
  });

  it('documents every bearer operation with its runtime permission requirement', () => {
    const document = asObject(pomsOpenApiDocument, 'OpenAPI document');
    const paths = asObject(document.paths, 'paths');

    for (const [pathKey, rawPathItem] of Object.entries(paths)) {
      const pathItem = asObject(rawPathItem, pathKey);
      for (const [method, rawOperation] of Object.entries(pathItem)) {
        if (!operationMethods.has(method)) continue;
        const operation = asObject(rawOperation, `${method.toUpperCase()} ${pathKey}`);
        const security = Array.isArray(operation.security) ? operation.security : [];
        const usesBearer = security.some((requirement) =>
          Object.hasOwn(asObject(requirement, 'security requirement'), 'bearerAuth'),
        );
        if (!usesBearer) continue;

        expect(Array.isArray(operation['x-poms-permissions'])).toBe(true);
        expect(['any', 'all', 'authenticated']).toContain(operation['x-poms-permission-mode']);
        expect(operation.description).toMatch(/(?:Permission(?: \([^)]+\))?|Authentication):/i);
      }
    }

    const favoriteOperation = asObject(
      asObject(paths['/operator-factories/{factoryId}/favorite'], 'favorite').put,
      'favorite.put',
    );
    expect(favoriteOperation['x-poms-permissions']).toEqual(['dashboard.alerts:view']);
    expect(favoriteOperation['x-poms-permission-mode']).toBe('any');

    const eligibleFactories = asObject(paths['/eligible-factories'], 'eligible factories');
    expect(asObject(eligibleFactories.get, 'eligible factories.get')['x-poms-permissions']).toEqual(
      ['eligible_factories:view'],
    );
    expect(
      asObject(eligibleFactories.post, 'eligible factories.post')['x-poms-permissions'],
    ).toEqual(['eligible_factories:edit']);

    const eligibleFactoryAddRequests = asObject(
      paths['/eligible-factories/add-requests'],
      'eligible factory add requests',
    );
    expect(
      asObject(eligibleFactoryAddRequests.get, 'eligible factory add requests.get')[
        'x-poms-permissions'
      ],
    ).toEqual(['eligible_factories:view']);
    expect(
      asObject(eligibleFactoryAddRequests.post, 'eligible factory add requests.post')[
        'x-poms-permissions'
      ],
    ).toEqual(['factories:view', 'factories:edit']);
    expect(
      asObject(eligibleFactoryAddRequests.post, 'eligible factory add requests.post')[
        'x-poms-permission-mode'
      ],
    ).toBe('all');

    const selectEligible = asObject(
      asObject(
        paths['/monitoring-point-forms/{id}/select-eligible'],
        'select eligible monitoring point form',
      ).post,
      'select eligible monitoring point form.post',
    );
    expect(selectEligible['x-poms-permissions']).toEqual(['eligible_factories:approve']);

    const reviewEligibleFactoryAddRequest = asObject(
      asObject(
        paths['/eligible-factories/add-requests/{id}/review'],
        'review eligible factory add request',
      ).post,
      'review eligible factory add request.post',
    );
    expect(reviewEligibleFactoryAddRequest['x-poms-permissions']).toEqual([
      'eligible_factories:view',
      'eligible_factories:approve',
    ]);
    expect(reviewEligibleFactoryAddRequest['x-poms-permission-mode']).toBe('all');
  });

  it('matches runtime delete statuses, alert filters and integration station IDs', () => {
    const document = asObject(pomsOpenApiDocument, 'OpenAPI document');
    const paths = asObject(document.paths, 'paths');

    for (const pathKey of ['/users/{id}', '/eligible-factories/{id}']) {
      const operation = asObject(asObject(paths[pathKey], pathKey).delete, `${pathKey}.delete`);
      const responses = asObject(operation.responses, `${pathKey}.delete.responses`);
      expect(responses['204']).toBeDefined();
      expect(responses['200']).toBeUndefined();
      expect(asObject(responses['204'], '204 response').content).toBeUndefined();
    }

    const alertOperation = asObject(asObject(paths['/alert-events'], 'alerts').get, 'alerts.get');
    const alertParameters = alertOperation.parameters as JsonObject[];
    const alertType = alertParameters.find((parameter) => parameter.name === 'alertType');
    expect(asObject(alertType, 'alertType').schema).toEqual(
      expect.objectContaining({
        enum: [
          'STANDARD_EXCEEDED',
          'EIA_EXCEEDED',
          'DAILY_COMPLETENESS_LOW',
          'CONSECUTIVE_NO_REPORT',
          'ABNORMAL_VALUE',
        ],
      }),
    );

    const components = asObject(document.components, 'components');
    const schemas = asObject(components.schemas, 'components.schemas');
    const alertStatusSchema = asObject(schemas.AlertEventStatusRequest, 'AlertEventStatusRequest');
    const alertStatusProperties = asObject(
      alertStatusSchema.properties,
      'AlertEventStatusRequest.properties',
    );
    expect(asObject(alertStatusProperties.notificationStatus, 'notificationStatus').enum).toEqual([
      'AUTO',
      'OFFICER',
      'ACKNOWLEDGED',
      'DISMISSED',
    ]);

    const integrationOperation = asObject(
      asObject(paths['/integrations/device-configs/{stationId}'], 'integration device config').get,
      'integration device config.get',
    );
    const stationParameter = (integrationOperation.parameters as JsonObject[]).find(
      (parameter) => parameter.name === 'stationId',
    );
    const pattern = new RegExp(
      asObject(asObject(stationParameter, 'stationId').schema, 'stationId.schema')
        .pattern as string,
    );
    expect(pattern.test('1-LEGACY_POINT')).toBe(true);
    expect(pattern.test('CEMS-0001/2569')).toBe(true);

    for (const schemaName of ['DeviceChannel', 'DeviceConnectionChannel']) {
      const channelSchema = asObject(schemas[schemaName], schemaName);
      const channelProperties = asObject(channelSchema.properties, `${schemaName}.properties`);
      expect(channelProperties.testMode).toEqual(
        expect.objectContaining({ type: 'boolean', nullable: true, default: false }),
      );
    }

    const integrationResponses = asObject(
      integrationOperation.responses,
      'integration device config.responses',
    );
    const integrationSuccess = asObject(integrationResponses['200'], 'integration 200');
    const integrationContent = asObject(integrationSuccess.content, 'integration 200.content');
    expect(
      asObject(integrationContent['application/json'], 'integration application/json').schema,
    ).toEqual({ $ref: '#/components/schemas/IntegrationDeviceConfigsResponse' });

    const integrationParameterConfig = asObject(
      schemas.IntegrationParameterConfig,
      'IntegrationParameterConfig',
    );
    expect(integrationParameterConfig.required).toEqual(expect.arrayContaining(['testMode']));
    expect(
      asObject(integrationParameterConfig.properties, 'IntegrationParameterConfig.properties')
        .testMode,
    ).toEqual(expect.objectContaining({ type: 'boolean', default: false }));
  });

  it('does not offer requestType on the two dedicated operator endpoints', () => {
    const document = asObject(pomsOpenApiDocument, 'OpenAPI document');
    const components = asObject(document.components, 'components');
    const schemas = asObject(components.schemas, 'components.schemas');

    for (const schemaName of ['AddMeasurementPointRequest', 'AddParameterRequest']) {
      const schema = asObject(schemas[schemaName], schemaName);
      const properties = asObject(schema.properties, `${schemaName}.properties`);
      expect(properties.requestType).toBeUndefined();
      expect(schema.additionalProperties).toBe(false);
    }
  });

  it('documents the point-level monitoring status used by fully exempted active points', () => {
    const document = asObject(pomsOpenApiDocument, 'OpenAPI document');
    const schemas = asObject(
      asObject(document.components, 'components').schemas,
      'components.schemas',
    );
    const addPointProperties = asObject(
      asObject(schemas.AddPointMeasurementPoint, 'AddPointMeasurementPoint').properties,
      'AddPointMeasurementPoint.properties',
    );
    const monitoringStatus = asObject(
      addPointProperties.monitoringPointStatus,
      'monitoringPointStatus',
    );

    expect(monitoringStatus).toEqual(
      expect.objectContaining({
        type: 'string',
        nullable: true,
        enum: expect.arrayContaining(['ได้รับการยกเว้นทั้งหมด', 'เชื่อมต่อครบแล้ว']),
      }),
    );
    expect(asObject(addPointProperties.parameters, 'parameters').minItems).toBe(0);
    expect(String(asObject(schemas.AddMeasurementPointRequest, 'request').description)).toContain(
      'parameters = []',
    );
  });

  it('documents officer submission actions and examples on both add-point endpoints', () => {
    const document = asObject(pomsOpenApiDocument, 'OpenAPI document');
    const components = asObject(document.components, 'components');
    const schemas = asObject(components.schemas, 'components.schemas');

    const addPoint = asObject(schemas.AddMeasurementPointRequest, 'AddMeasurementPointRequest');
    const addPointProperties = asObject(
      addPoint.properties,
      'AddMeasurementPointRequest.properties',
    );
    expect(asObject(addPointProperties.submissionAction, 'submissionAction')).toEqual(
      expect.objectContaining({
        type: 'string',
        enum: ['REQUEST_FACTORY_REVISION', 'CONNECT'],
      }),
    );
    expect(asObject(addPointProperties.revisionReason, 'revisionReason')).toEqual(
      expect.objectContaining({ type: 'string', maxLength: 1000, nullable: true }),
    );
    expect(asObject(addPointProperties.officerNote, 'officerNote')).toEqual(
      expect.objectContaining({ type: 'string', maxLength: 1000, nullable: true }),
    );
    expect(asObject(addPoint.example, 'AddMeasurementPointRequest.example')).toEqual(
      expect.objectContaining({
        submissionAction: 'REQUEST_FACTORY_REVISION',
        revisionReason: expect.any(String),
        officerNote: expect.any(String),
      }),
    );

    const direct = asObject(schemas.DirectConnectionRequest, 'DirectConnectionRequest');
    const directProperties = asObject(direct.properties, 'DirectConnectionRequest.properties');
    expect(asObject(directProperties.submissionAction, 'submissionAction')).toEqual(
      expect.objectContaining({
        type: 'string',
        enum: ['REQUEST_FACTORY_REVISION', 'CONNECT'],
      }),
    );
    expect(asObject(directProperties.status, 'status')).toEqual(
      expect.objectContaining({
        type: 'string',
        enum: ['WAITING_FACTORY_REVISION', 'CONNECTED'],
        nullable: true,
      }),
    );
    expect(asObject(directProperties.revisionReason, 'revisionReason')).toEqual(
      expect.objectContaining({ type: 'string', maxLength: 1000, nullable: true }),
    );
    expect(asObject(directProperties.officerNote, 'officerNote')).toEqual(
      expect.objectContaining({ type: 'string', maxLength: 1000, nullable: true }),
    );
    expect(asObject(direct.example, 'DirectConnectionRequest.example')).toEqual(
      expect.objectContaining({ submissionAction: 'CONNECT' }),
    );
  });

  it('publishes the WPMS outside-factory discharge point photo contract', () => {
    const document = asObject(pomsOpenApiDocument, 'OpenAPI document');
    const components = asObject(document.components, 'components');
    const schemas = asObject(components.schemas, 'components.schemas');
    const requestDocumentImage = asObject(schemas.RequestDocumentImage, 'RequestDocumentImage');
    const properties = asObject(requestDocumentImage.properties, 'RequestDocumentImage.properties');
    const title = asObject(properties.title, 'RequestDocumentImage.title');

    expect(title).toEqual(
      expect.objectContaining({
        type: 'string',
        example: 'ภาพถ่ายจุดระบายน้ำทิ้งออกนอกโรงงาน',
        description: expect.stringContaining('ไม่เกิน 3 rows ต่อจุดตรวจวัด'),
      }),
    );
    expect(asObject(requestDocumentImage.example, 'RequestDocumentImage.example')).toEqual(
      expect.objectContaining({
        title: 'ภาพถ่ายจุดระบายน้ำทิ้งออกนอกโรงงาน',
        fileType: 'image/jpeg',
      }),
    );

    const paths = asObject(document.paths, 'paths');
    const uploadPath = asObject(
      paths['/cems-wpms-requests/document-images'],
      '/cems-wpms-requests/document-images',
    );
    const uploadOperation = asObject(uploadPath.post, 'POST /cems-wpms-requests/document-images');
    const uploadRequestBody = asObject(uploadOperation.requestBody, 'upload.requestBody');
    const uploadContent = asObject(uploadRequestBody.content, 'upload.requestBody.content');
    const multipart = asObject(uploadContent['multipart/form-data'], 'multipart/form-data');
    const uploadSchema = asObject(multipart.schema, 'multipart.schema');
    const uploadProperties = asObject(uploadSchema.properties, 'multipart.schema.properties');
    expect(asObject(uploadProperties.title, 'multipart.title')).toEqual(
      expect.objectContaining({
        example: 'ภาพถ่ายจุดระบายน้ำทิ้งออกนอกโรงงาน',
        description: expect.stringContaining('ช่องรูปจุดระบายน้ำทิ้ง WPMS'),
      }),
    );
  });

  it('keeps resubmission and upload schemas aligned with runtime constraints', () => {
    const document = asObject(pomsOpenApiDocument, 'OpenAPI document');
    const components = asObject(document.components, 'components');
    const schemas = asObject(components.schemas, 'components.schemas');

    const resubmission = asObject(
      schemas.BodCodReportResubmissionRequest,
      'BodCodReportResubmissionRequest',
    );
    expect(resubmission.allOf).toBeUndefined();
    expect(resubmission.additionalProperties).toBe(false);
    expect(asObject(resubmission.properties, 'resubmission.properties').revisionNote).toEqual(
      expect.objectContaining({ type: 'string', maxLength: 1000, nullable: true }),
    );

    const kwpAttachmentUpload = asObject(schemas.KwpAttachmentUploadRequest, 'KwpAttachmentUpload');
    const kwpUploadProperties = asObject(
      kwpAttachmentUpload.properties,
      'KwpAttachmentUpload.properties',
    );
    expect(asObject(kwpUploadProperties.attachmentType, 'attachmentType')).toEqual(
      expect.objectContaining({ type: 'string', maxLength: 64, nullable: true }),
    );
    expect(asObject(kwpUploadProperties.file, 'file').description).toContain(
      'RATA_REPORT/CALIBRATION_PHOTO ไม่เกิน 10 MiB',
    );

    const monitoringUpload = asObject(
      schemas.MonitoringPointAttachmentUploadRequest,
      'MonitoringPointAttachmentUploadRequest',
    );
    const monitoringUploadProperties = asObject(
      monitoringUpload.properties,
      'MonitoringPointAttachmentUploadRequest.properties',
    );
    expect(asObject(monitoringUploadProperties.file, 'monitoring file').description).toContain(
      '10 MiB',
    );
  });

  it('publishes inherited KWP and BOD request fields as valid strict objects', () => {
    const document = asObject(pomsOpenApiDocument, 'OpenAPI document');
    const components = asObject(document.components, 'components');
    const schemas = asObject(components.schemas, 'components.schemas');
    const expectations: Array<[string, string[], string[]]> = [
      [
        'BodCodReportResubmissionRequest',
        ['factoryName', 'measurements', 'revisionNote'],
        [
          'reportRoundNo',
          'reportYear',
          'factoryName',
          'factoryRegistrationNo',
          'provinceName',
          'selectedParameterCode',
          'measurements',
        ],
      ],
      [
        'Kwp01Request',
        ['factoryId', 'factoryName', 'issueReason', 'unreportedParameters'],
        ['factoryId', 'factoryName', 'issueReason', 'unreportedParameters'],
      ],
      [
        'Kwp02Or04Request',
        ['factoryId', 'factoryName', 'measurementItems'],
        ['factoryId', 'factoryName', 'measurementItems'],
      ],
      [
        'Kwp03Request',
        ['factoryId', 'factoryName', 'instruments', 'issueReasons', 'failedParameters'],
        ['factoryId', 'factoryName', 'instruments', 'issueReasons', 'failedParameters'],
      ],
      [
        'Kwp05Request',
        ['factoryId', 'factoryName', 'calibrationItems'],
        ['factoryId', 'factoryName', 'calibrationItems'],
      ],
    ];

    for (const [schemaName, propertyNames, requiredNames] of expectations) {
      const schema = asObject(schemas[schemaName], schemaName);
      const properties = asObject(schema.properties, `${schemaName}.properties`);
      expect(schema.allOf).toBeUndefined();
      expect(schema.additionalProperties).toBe(false);
      for (const propertyName of propertyNames) {
        expect(properties[propertyName]).toBeDefined();
      }
      expect(schema.required).toEqual(expect.arrayContaining(requiredNames));
    }
  });

  it('keeps key optional, nullable and BOD upload constraints aligned with runtime', () => {
    const document = asObject(pomsOpenApiDocument, 'OpenAPI document');
    const components = asObject(document.components, 'components');
    const schemas = asObject(components.schemas, 'components.schemas');

    const login = asObject(schemas.LoginRequest, 'LoginRequest');
    const loginProperties = asObject(login.properties, 'LoginRequest.properties');
    expect(login.required).toEqual(['userType', 'username', 'password']);
    for (const propertyName of ['accountType', 'provider', 'departmentID']) {
      expect(asObject(loginProperties[propertyName], propertyName).nullable).toBeUndefined();
    }

    const managedUser = asObject(schemas.CreateManagedUserRequest, 'CreateManagedUserRequest');
    expect(managedUser.required).toEqual(['username', 'firstName', 'lastName', 'roleCodes']);

    const monitoringPoint = asObject(
      schemas.MonitoringPointFormRequest,
      'MonitoringPointFormRequest',
    );
    const monitoringPointProperties = asObject(
      monitoringPoint.properties,
      'MonitoringPointFormRequest.properties',
    );
    expect(monitoringPoint.required).toEqual(['factory']);
    expect(asObject(monitoringPointProperties.points, 'points').default).toEqual([]);

    const bodUpload = asObject(
      schemas.BodCodAttachmentUploadRequest,
      'BodCodAttachmentUploadRequest',
    );
    const bodUploadProperties = asObject(
      bodUpload.properties,
      'BodCodAttachmentUploadRequest.properties',
    );
    expect(asObject(bodUploadProperties.file, 'file').description).toMatch(/5 MiB/);

    const paths = asObject(document.paths, 'paths');
    const uploadOperation = asObject(
      asObject(paths['/bod-cod-deviation-reports/attachments'], 'BOD upload').post,
      'BOD upload.post',
    );
    const requestBody = asObject(uploadOperation.requestBody, 'BOD upload.requestBody');
    const content = asObject(requestBody.content, 'BOD upload.requestBody.content');
    const multipart = asObject(content['multipart/form-data'], 'multipart/form-data');
    expect(asObject(multipart.schema, 'multipart schema').$ref).toBe(
      '#/components/schemas/BodCodAttachmentUploadRequest',
    );
  });

  it('documents every accepted device-config shape and alert note nullability', () => {
    const document = asObject(pomsOpenApiDocument, 'OpenAPI document');
    const components = asObject(document.components, 'components');
    const schemas = asObject(components.schemas, 'components.schemas');

    const config = asObject(schemas.DeviceConnectionConfig, 'DeviceConnectionConfig');
    const configProperties = asObject(config.properties, 'DeviceConnectionConfig.properties');
    expect(config.required).toEqual(['stationId', 'protocol']);
    expect(asObject(configProperties.stationId, 'stationId').pattern).toBeUndefined();
    expect(asObject(configProperties.settings, 'settings')).toEqual(
      expect.objectContaining({ nullable: true, default: {} }),
    );
    expect(asObject(configProperties.channels, 'channels')).toEqual(
      expect.objectContaining({ nullable: true, default: [] }),
    );

    const configRequest = asObject(
      schemas.DeviceConnectionConfigRequest,
      'DeviceConnectionConfigRequest',
    );
    const configRequestBranches = configRequest.oneOf as JsonObject[];
    expect(configRequestBranches).toHaveLength(3);
    expect(configRequestBranches).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          required: ['config'],
          properties: expect.objectContaining({
            config: { $ref: '#/components/schemas/StructuredDeviceConnectionForm' },
          }),
        }),
      ]),
    );

    const structuredConfig = asObject(
      schemas.StructuredDeviceConnectionForm,
      'StructuredDeviceConnectionForm',
    );
    expect(structuredConfig.required).toEqual(['stationId', 'device']);
    const structuredProperties = asObject(
      structuredConfig.properties,
      'StructuredDeviceConnectionForm.properties',
    );
    expect(asObject(structuredProperties.device, 'device')).toEqual(
      expect.objectContaining({ minItems: 1, maxItems: 50 }),
    );

    const alertStatus = asObject(schemas.AlertEventStatusRequest, 'AlertEventStatusRequest');
    const alertStatusProperties = asObject(
      alertStatus.properties,
      'AlertEventStatusRequest.properties',
    );
    expect(asObject(alertStatusProperties.note, 'note').nullable).toBeUndefined();
  });

  it('does not overstate calendar validation on regex or Date.parse-only query fields', () => {
    const document = asObject(pomsOpenApiDocument, 'OpenAPI document');
    const paths = asObject(document.paths, 'paths');
    const cases: Array<[string, string[]]> = [
      ['/parameter-values', ['startDate', 'endDate']],
      ['/connected-measurement-points/{stationId}/measurement-statistics', ['date']],
      ['/alert-events', ['dateFrom', 'dateTo']],
    ];

    for (const [pathKey, parameterNames] of cases) {
      const operation = asObject(asObject(paths[pathKey], pathKey).get, `${pathKey}.get`);
      const parameters = operation.parameters as JsonObject[];
      for (const parameterName of parameterNames) {
        const parameter = parameters.find((candidate) => candidate.name === parameterName);
        expect(
          asObject(asObject(parameter, parameterName).schema, `${parameterName}.schema`).format,
        ).toBeUndefined();
      }
    }
  });

  it('keeps KWP and BOD/COD list filters aligned with every runtime enum value', () => {
    const document = asObject(pomsOpenApiDocument, 'OpenAPI document');
    const paths = asObject(document.paths, 'paths');
    const cases: Array<[string, string, readonly string[]]> = [
      ['/kwp-form-reports/requests', 'formType', KWP_FORM_TYPES],
      ['/kwp-form-reports/requests', 'status', KWP_FORM_STATUSES],
      ['/bod-cod-deviation-reports', 'status', BOD_COD_DEVIATION_REPORT_STATUSES],
    ];

    for (const [pathKey, parameterName, expectedValues] of cases) {
      const operation = asObject(asObject(paths[pathKey], pathKey).get, `${pathKey}.get`);
      const parameters = operation.parameters as JsonObject[];
      const parameter = parameters.find((candidate) => candidate.name === parameterName);
      const schema = asObject(asObject(parameter, parameterName).schema, `${parameterName}.schema`);
      expect(schema.enum).toEqual([...expectedValues]);
    }

    const schemas = asObject(asObject(document.components, 'components').schemas, 'schemas');
    const kwp03 = asObject(schemas.Kwp03Request, 'Kwp03Request');
    const issueReasons = asObject(
      asObject(kwp03.properties, 'Kwp03Request.properties').issueReasons,
      'issueReasons',
    );
    expect(issueReasons.uniqueItems).toBeUndefined();
  });

  it('documents canonical current factory identity for both KWP report tables', () => {
    const document = asObject(pomsOpenApiDocument, 'OpenAPI document');
    const schemas = asObject(asObject(document.components, 'components').schemas, 'schemas');
    const factoryRow = asObject(schemas.KwpFormFactoryRow, 'KwpFormFactoryRow');
    const factoryProperties = asObject(factoryRow.properties, 'KwpFormFactoryRow.properties');
    const requestRow = asObject(schemas.KwpFormRequestRow, 'KwpFormRequestRow');
    const requestProperties = asObject(requestRow.properties, 'KwpFormRequestRow.properties');

    expect(factoryRow.required).toEqual(
      expect.arrayContaining(['factoryId', 'newRegistrationNo', 'oldRegistrationNo', 'province']),
    );
    expect(asObject(factoryProperties.newRegistrationNo, 'newRegistrationNo')).toMatchObject({
      type: 'string',
      example: '10840002225552',
    });
    expect(asObject(factoryProperties.oldRegistrationNo, 'oldRegistrationNo')).toMatchObject({
      type: 'string',
      nullable: true,
      example: '3-7(1)-22/55สฎ',
    });

    expect(requestRow.required).toEqual(
      expect.arrayContaining(['factoryRegistration', 'oldRegistrationNo', 'province', 'requestNo']),
    );
    expect(asObject(requestProperties.factoryRegistration, 'factoryRegistration')).toMatchObject({
      type: 'string',
      nullable: true,
      example: '10840002225552',
    });
    expect(
      String(asObject(requestProperties.factoryRegistration, 'factoryRegistration').description),
    ).toContain('eligible_factories.factory_registration_no_new');
    expect(asObject(requestProperties.oldRegistrationNo, 'oldRegistrationNo')).toMatchObject({
      type: 'string',
      nullable: true,
      example: '3-7(1)-22/55สฎ',
    });

    const paths = asObject(document.paths, 'paths');
    const cases: Array<[string, string]> = [
      ['/kwp-form-reports/factories', 'KwpFormFactoriesResponse'],
      ['/kwp-form-reports/requests', 'KwpFormRequestsResponse'],
    ];
    for (const [pathKey, expectedSchema] of cases) {
      const operation = asObject(asObject(paths[pathKey], pathKey).get, `${pathKey}.get`);
      const responses = asObject(operation.responses, `${pathKey}.get.responses`);
      const response = asObject(responses['200'], `${pathKey}.get.200`);
      const content = asObject(response.content, `${pathKey}.get.200.content`);
      const mediaType = asObject(content['application/json'], `${pathKey}.application/json`);
      expect(mediaType.schema).toEqual({ $ref: `#/components/schemas/${expectedSchema}` });
    }
  });

  it('documents the current E- prefix for every BOD/COD report response', () => {
    const document = asObject(pomsOpenApiDocument, 'OpenAPI document');
    const components = asObject(document.components, 'components');
    const schemas = asObject(components.schemas, 'components.schemas');
    const reportNo = asObject(schemas.BodCodReportNo, 'BodCodReportNo');

    expect(reportNo.example).toBe('E-02-0001/2569');
    expect(reportNo.pattern).toContain('E-');
    expect(reportNo.pattern).not.toContain('Error-');

    const paths = asObject(document.paths, 'paths');
    const responseCases: Array<[string, string, string]> = [
      ['/bod-cod-deviation-reports/factories', 'get', 'BodCodFactoriesResponse'],
      ['/bod-cod-deviation-reports', 'get', 'BodCodReportsResponse'],
      ['/bod-cod-deviation-reports', 'post', 'BodCodReportResponse'],
      ['/bod-cod-deviation-reports/{id}', 'get', 'BodCodReportResponse'],
      ['/bod-cod-deviation-reports/{id}/resubmission', 'put', 'BodCodReportResponse'],
      ['/bod-cod-deviation-reports/{id}/workflow-actions', 'post', 'BodCodReportResponse'],
      ['/bod-cod-deviation-reports/{id}/result-notice', 'post', 'BodCodReportResponse'],
      ['/bod-cod-deviation-reports/{id}/result-notice', 'put', 'BodCodReportResponse'],
    ];

    for (const [pathKey, method, expectedSchema] of responseCases) {
      const operation = asObject(asObject(paths[pathKey], pathKey)[method], `${pathKey}.${method}`);
      const responses = asObject(operation.responses, `${pathKey}.${method}.responses`);
      const status = method === 'post' && pathKey === '/bod-cod-deviation-reports' ? '201' : '200';
      const response = asObject(responses[status], `${pathKey}.${method}.${status}`);
      const content = asObject(response.content, `${pathKey}.${method}.${status}.content`);
      const mediaType = asObject(content['application/json'], 'application/json');
      expect(mediaType.schema).toEqual({ $ref: `#/components/schemas/${expectedSchema}` });
    }
  });

  it('keeps edit-user, note and comment nullability aligned with runtime validators', () => {
    const document = asObject(pomsOpenApiDocument, 'OpenAPI document');
    const components = asObject(document.components, 'components');
    const schemas = asObject(components.schemas, 'components.schemas');

    const updateRequest = asObject(schemas.EditResponseUpdateRequest, 'EditResponseUpdateRequest');
    const updateProperties = asObject(
      updateRequest.properties,
      'EditResponseUpdateRequest.properties',
    );
    const userSchema = asObject(updateProperties.user, 'EditResponseUpdateRequest.user');
    const userProperties = asObject(
      userSchema.properties,
      'EditResponseUpdateRequest.user.properties',
    );

    expect(asObject(userProperties.regions, 'user.regions')).toEqual(
      expect.objectContaining({ nullable: true, maxItems: 1 }),
    );
    expect(asObject(userProperties.regionalAccess, 'user.regionalAccess').required).toEqual([
      'regions',
    ]);
    expect(asObject(updateProperties.permissions, 'permissions').nullable).toBeUndefined();

    const bodWorkflow = asObject(
      schemas.BodCodWorkflowActionRequest,
      'BodCodWorkflowActionRequest',
    );
    const bodWorkflowBranches = bodWorkflow.oneOf as JsonObject[];
    for (const branch of bodWorkflowBranches) {
      const properties = asObject(branch.properties, 'BOD workflow branch.properties');
      if (!properties.officerNote) continue;
      expect(asObject(properties.officerNote, 'officerNote')).toEqual(
        expect.objectContaining({ maxLength: 1000, nullable: true }),
      );
      expect(asObject(properties.officerNote, 'officerNote').minLength).toBeUndefined();
    }

    const bodResultNotice = asObject(
      schemas.BodCodResultNoticeRequest,
      'BodCodResultNoticeRequest',
    );
    expect(
      asObject(
        asObject(bodResultNotice.properties, 'BodCodResultNoticeRequest.properties').comment,
        'comment',
      ),
    ).toEqual(expect.objectContaining({ maxLength: 1000, nullable: true }));

    const kwpResubmit = asObject(schemas.KwpResubmitRequest, 'KwpResubmitRequest');
    expect(
      asObject(asObject(kwpResubmit.properties, 'KwpResubmitRequest.properties').note, 'note'),
    ).toEqual(expect.objectContaining({ maxLength: 1000, nullable: true }));

    const kwpWorkflow = asObject(schemas.KwpWorkflowActionRequest, 'KwpWorkflowActionRequest');
    const kwpWorkflowBranches = kwpWorkflow.oneOf as JsonObject[];
    for (const branch of kwpWorkflowBranches) {
      const properties = asObject(branch.properties, 'KWP workflow branch.properties');
      if (!properties.officerNote) continue;
      expect(asObject(properties.officerNote, 'officerNote')).toEqual(
        expect.objectContaining({ maxLength: 1000, nullable: true }),
      );
      expect(asObject(properties.officerNote, 'officerNote').minLength).toBeUndefined();
    }

    const bodReport = asObject(schemas.BodCodReportRequest, 'BodCodReportRequest');
    const bodReportProperties = asObject(bodReport.properties, 'BodCodReportRequest.properties');
    for (const propertyName of [
      'factoryId',
      'businessActivity',
      'factoryAddress',
      'pointCode',
      'pointName',
      'samplerName',
      'officerRegistrationNo',
      'laboratoryName',
      'labReportNo',
      'analysisMethod',
      'reporterName',
      'reporterPosition',
    ]) {
      const property = asObject(bodReportProperties[propertyName], propertyName);
      expect(property).toEqual(expect.objectContaining({ type: 'string', nullable: true }));
      expect(property.minLength).toBeUndefined();
    }

    const kwpBase = asObject(schemas.KwpBaseRequest, 'KwpBaseRequest');
    const kwpBaseProperties = asObject(kwpBase.properties, 'KwpBaseRequest.properties');
    for (const propertyName of [
      'factoryRegistrationNo',
      'factoryAddress',
      'industryType',
      'pointCode',
      'pointName',
      'pointType',
      'productionStack',
      'primaryFuel',
      'secondaryFuel',
      'combustionSystem',
      'productionCapacity',
      'productionCapacityUnit',
      'contactName',
      'contactPhone',
      'reporterName',
      'reporterPosition',
    ]) {
      const property = asObject(kwpBaseProperties[propertyName], propertyName);
      expect(property).toEqual(expect.objectContaining({ type: 'string', nullable: true }));
      expect(property.minLength).toBeUndefined();
    }
    expect(asObject(kwpBaseProperties.contactEmail, 'contactEmail')).toEqual(
      expect.objectContaining({
        type: 'string',
        format: 'email',
        maxLength: 255,
        nullable: true,
      }),
    );
    expect(asObject(kwpBaseProperties.contactEmail, 'contactEmail').minLength).toBeUndefined();
  });
});
