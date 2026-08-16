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
import { createEligibleFactorySchema } from '../../src/modules/eligible-factories/eligible-factories.validator';
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
    if (fullPath !== '/health' && !fullPath.startsWith('/api/v1')) continue;

    const relativePath = (
      fullPath === '/health' ? fullPath : fullPath.replace(/^\/api\/v1/, '')
    ).replace(/:([A-Za-z0-9_]+)/g, '{$1}');
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

describe('POMS OpenAPI contract', () => {
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

    expect(approveDecision['x-enum-labels']).toMatchObject({
      APPROVE_DESIGN: 'อนุมัติแบบ',
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

    expect(returnAction['x-enum-labels']).toMatchObject({
      RETURN_TO_WAITING_CONNECTION: 'ย้อนกลับไปรอเชื่อมต่อ',
    });
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

  it('covers all 113 canonical registry endpoints plus 9 annual testing variants', () => {
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
    expect(registryOperations).toHaveLength(113);
    expect(documentedOperations.sort()).toEqual(
      [...registryOperations, ...annualTestingVariants].sort(),
    );
    expect(pomsOpenApiStats).toEqual({
      canonicalOperationCount: 113,
      operationCount: 122,
      tagCount: 11,
    });
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

    const selectEligible = asObject(
      asObject(
        paths['/monitoring-point-forms/{id}/select-eligible'],
        'select eligible monitoring point form',
      ).post,
      'select eligible monitoring point form.post',
    );
    expect(selectEligible['x-poms-permissions']).toEqual(['eligible_factories:edit']);
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
