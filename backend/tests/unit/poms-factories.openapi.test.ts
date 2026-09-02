import { describe, expect, it } from '@jest/globals';
import { pomsOpenApiDocument } from '../../src/modules/api-docs/poms.openapi';

type JsonObject = Record<string, unknown>;

function asObject(value: unknown, label: string): JsonObject {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value as JsonObject;
}

function operation(path: string, method: string): JsonObject {
  const paths = asObject(pomsOpenApiDocument.paths, 'paths');
  return asObject(asObject(paths[path], path)[method], `${method.toUpperCase()} ${path}`);
}

function schemas(): JsonObject {
  const components = asObject(pomsOpenApiDocument.components, 'components');
  return asObject(components.schemas, 'components.schemas');
}

function jsonRequestSchema(path: string, method: string): JsonObject {
  const requestBody = asObject(operation(path, method).requestBody, 'requestBody');
  const content = asObject(requestBody.content, 'requestBody.content');
  return asObject(asObject(content['application/json'], 'application/json').schema, 'schema');
}

function jsonSuccessSchema(path: string, method: string): JsonObject {
  const responses = asObject(operation(path, method).responses, 'responses');
  const response = asObject(responses['200'], '200 response');
  const content = asObject(response.content, 'response.content');
  return asObject(asObject(content['application/json'], 'application/json').schema, 'schema');
}

describe('POMS factory master-data OpenAPI contract', () => {
  it('publishes all factory read and edit-request workflow operations', () => {
    const operations = [
      ['/poms-factories', 'get'],
      ['/poms-factories/{factoryId}', 'get'],
      ['/poms-factories/{factoryId}/form', 'get'],
      ['/poms-factories/{factoryId}/edit-requests', 'post'],
      ['/poms-factories/edit-requests', 'get'],
      ['/poms-factories/edit-requests/{id}', 'get'],
      ['/poms-factories/edit-requests/{id}/form', 'get'],
      ['/poms-factories/edit-requests/{id}/resubmission', 'put'],
      ['/poms-factories/edit-requests/{id}/review', 'post'],
    ];

    for (const [path, method] of operations) {
      expect(operation(path, method)).toEqual(
        expect.objectContaining({
          tags: ['ข้อมูลพื้นฐาน'],
          security: [{ bearerAuth: [] }],
        }),
      );
    }
  });

  it('reuses the operator-factory table response for the active connected POMS list', () => {
    const pomsList = operation('/poms-factories', 'get');
    const operatorList = operation('/cems-wpms-requests/operator-factories', 'get');

    expect(jsonSuccessSchema('/poms-factories', 'get')).toEqual(
      jsonSuccessSchema('/cems-wpms-requests/operator-factories', 'get'),
    );
    expect(jsonSuccessSchema('/poms-factories', 'get')).toEqual({
      $ref: '#/components/schemas/OperatorFactoryTableResponse',
    });
    expect(pomsList.description).toEqual(
      expect.stringContaining('active row ใน cems_wpms_connected_measurement_points'),
    );
    expect(pomsList.description).toEqual(expect.stringContaining('current/live connected POMS'));
    expect(pomsList.description).toEqual(expect.stringContaining('requestStatusCode="CONNECTED"'));
    expect(pomsList.description).toEqual(expect.stringContaining('officerNotificationEmails=[]'));
    expect(pomsList.description).toEqual(expect.stringContaining('eligibilityRequest=null'));
    expect(operatorList.description).not.toEqual(pomsList.description);
  });

  it('limits create and resubmission payloads to the first-version profile allowlist', () => {
    const schema = asObject(schemas().PomsFactoryEditableProfileRequest, 'edit profile request');
    const properties = asObject(schema.properties, 'edit profile properties');

    expect(Object.keys(properties).sort()).toEqual(
      [
        'formType',
        'factoryName',
        'address',
        'factoryAddress',
        'latitude',
        'longitude',
        'eia',
        'eiaOther',
        'projectName',
        'factoryFrontPhotos',
        'factoryLogo',
        'remarks',
        'note',
      ].sort(),
    );
    expect(schema.additionalProperties).toBe(false);
    expect(schema.required).toEqual(['factoryName']);
    expect(properties).not.toHaveProperty('measurementPoints');
    expect(properties).not.toHaveProperty('businessActivity');
    expect(asObject(properties.factoryName, 'factoryName')).toEqual(
      expect.objectContaining({ minLength: 1, maxLength: 500 }),
    );
    expect(asObject(properties.factoryFrontPhotos, 'factoryFrontPhotos').maxItems).toBe(10);
    expect(asObject(properties.address, 'address')).toEqual(
      expect.objectContaining({ nullable: true, maxLength: 1000 }),
    );
    expect(asObject(properties.factoryAddress, 'factoryAddress').nullable).toBe(true);
    expect(asObject(properties.factoryAddress, 'factoryAddress').deprecated).toBe(true);
    expect(asObject(properties.note, 'note').deprecated).toBe(true);
    expect(asObject(properties.latitude, 'latitude')).toEqual(
      expect.objectContaining({ minimum: -90, maximum: 90, nullable: true }),
    );
    expect(asObject(properties.longitude, 'longitude')).toEqual(
      expect.objectContaining({ minimum: -180, maximum: 180, nullable: true }),
    );

    expect(jsonRequestSchema('/poms-factories/{factoryId}/edit-requests', 'post')).toEqual({
      $ref: '#/components/schemas/PomsFactoryEditSubmissionRequest',
    });
    expect(jsonRequestSchema('/poms-factories/edit-requests/{id}/resubmission', 'put')).toEqual({
      $ref: '#/components/schemas/PomsFactoryEditSubmissionRequest',
    });

    const createRequestBody = asObject(
      operation('/poms-factories/{factoryId}/edit-requests', 'post').requestBody,
      'create request body',
    );
    const createContent = asObject(createRequestBody.content, 'create request content');
    const createExample = asObject(
      asObject(createContent['application/json'], 'create JSON').example,
      'create example',
    );
    expect(createExample).not.toHaveProperty('measurementPoints');
    expect(createExample).not.toHaveProperty('businessActivity');
    expect(createExample).toEqual(
      expect.objectContaining({
        address: expect.any(String),
        remarks: expect.any(String),
        factoryFrontPhotos: expect.any(Array),
        factoryLogo: expect.any(Object),
      }),
    );
    expect(createExample).not.toHaveProperty('factoryAddress');
    expect(createExample).not.toHaveProperty('note');
  });

  it('publishes the measurement-point edit form as a second submission variant', () => {
    const request = asObject(
      schemas().PomsFactoryEditableMeasurementPointsRequest,
      'measurement-point request',
    );
    const requestProperties = asObject(request.properties, 'measurement request properties');
    expect(request.required).toEqual(['formType', 'measurementPoints']);
    expect(asObject(requestProperties.formType, 'formType').enum).toEqual(['MEASUREMENT_POINTS']);
    expect(requestProperties).toEqual(
      expect.objectContaining({
        remarks: expect.any(Object),
        note: expect.objectContaining({ deprecated: true }),
      }),
    );

    const pointPatch = asObject(
      schemas().PomsFactoryMeasurementPointPatchRequest,
      'measurement-point patch request',
    );
    const pointPatchProperties = asObject(pointPatch.properties, 'patch properties');
    expect(pointPatch.required).toEqual(['connectedPointId']);
    expect(pointPatchProperties).toEqual(
      expect.objectContaining({
        connectedPointId: expect.any(Object),
        pointName: expect.any(Object),
        monitoringPointStatus: expect.any(Object),
        details: expect.any(Object),
        documentsAndImages: expect.any(Object),
        measurementInstruments: expect.any(Object),
      }),
    );
    expect(pointPatchProperties).not.toHaveProperty('pointCode');
    expect(pointPatchProperties).not.toHaveProperty('parameters');
    expect(
      asObject(pointPatchProperties.monitoringPointStatus, 'monitoringPointStatus').enum,
    ).toEqual([
      'เชื่อมต่อครบแล้ว',
      'ได้รับการยกเว้นทั้งหมด',
      'เชื่อมต่อแล้วแต่ยังไม่ครบ',
      'อยู่ระหว่างขยายเวลา',
      'ยังไม่ได้ดำเนินการเชื่อมต่อ',
      'อยู่ระหว่างการตรวจสอบของจังหวัด',
      'อยู่ระหว่างเชื่อมต่อ',
    ]);

    const union = asObject(schemas().PomsFactoryEditSubmissionRequest, 'submission union');
    expect(union.oneOf).toEqual([
      { $ref: '#/components/schemas/PomsFactoryEditableProfileRequest' },
      { $ref: '#/components/schemas/PomsFactoryEditableMeasurementPointsRequest' },
    ]);
  });

  it('uses one canonical connection-request form response for every prefill endpoint', () => {
    const expectedResponse = { $ref: '#/components/schemas/ConnectionRequestFormResponse' };
    expect(jsonSuccessSchema('/cems-wpms-requests/{id}/form', 'get')).toEqual(expectedResponse);
    expect(jsonSuccessSchema('/poms-factories/{factoryId}/form', 'get')).toEqual(expectedResponse);
    expect(jsonSuccessSchema('/poms-factories/edit-requests/{id}/form', 'get')).toEqual(
      expectedResponse,
    );

    const form = asObject(schemas().ConnectionRequestForm, 'ConnectionRequestForm');
    const properties = asObject(form.properties, 'ConnectionRequestForm.properties');
    expect(Object.keys(properties).sort()).toEqual(
      [
        'requestType',
        'factoryId',
        'factoryName',
        'factoryRegistrationNo',
        'industryMainOrder',
        'industryMainOrderLabel',
        'industrySubOrder',
        'businessActivity',
        'eia',
        'eiaOther',
        'hasEia',
        'projectName',
        'address',
        'regionCode',
        'regionName',
        'provinceCode',
        'provinceName',
        'districtCode',
        'districtName',
        'subdistrictCode',
        'subdistrictName',
        'industrialEstateCode',
        'industrialEstateName',
        'latitude',
        'longitude',
        'systemType',
        'contactName',
        'contactPhone',
        'contactEmail',
        'contactPersons',
        'notificationEmails',
        'officerNotificationEmails',
        'informationProviderName',
        'informationProviderPosition',
        'measurementPoints',
        'remarks',
      ].sort(),
    );
    expect(form.additionalProperties).toBe(false);
    expect(properties).not.toHaveProperty('eligibleFactoryId');
    expect(properties).not.toHaveProperty('id');
    expect(properties).not.toHaveProperty('requestNo');
    expect(properties).not.toHaveProperty('status');
    expect(properties).not.toHaveProperty('type');

    const point = asObject(schemas().MeasurementPoint, 'MeasurementPoint');
    const pointProperties = asObject(point.properties, 'MeasurementPoint.properties');
    expect(pointProperties).not.toHaveProperty('id');
    expect(pointProperties).not.toHaveProperty('connectedPointId');
    expect(pointProperties).not.toHaveProperty('sourceMeasurementPointId');

    const factoryParameters = operation('/poms-factories/{factoryId}/form', 'get')
      .parameters as JsonObject[];
    expect(factoryParameters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'formType',
          required: false,
          schema: expect.objectContaining({ enum: ['BASIC_INFO', 'MEASUREMENT_POINTS'] }),
        }),
        expect.objectContaining({
          name: 'systemType',
          required: false,
          schema: expect.objectContaining({ enum: ['CEMS', 'WPMS'] }),
        }),
      ]),
    );
    const editParameters = operation('/poms-factories/edit-requests/{id}/form', 'get')
      .parameters as JsonObject[];
    expect(editParameters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'systemType',
          required: false,
          schema: expect.objectContaining({ enum: ['CEMS', 'WPMS'] }),
        }),
      ]),
    );
  });

  it('keeps factory summary and edit-request responses aligned with runtime DTOs', () => {
    const allSchemas = schemas();
    const profile = asObject(allSchemas.PomsFactoryProfile, 'factory profile');
    const profileProperties = asObject(profile.properties, 'factory profile properties');
    expect(profile.required).toEqual(
      expect.arrayContaining([
        'industryMainOrder',
        'industryMainOrderLabel',
        'industrySubOrder',
        'businessActivity',
      ]),
    );
    expect(profileProperties).toEqual(
      expect.objectContaining({
        industryMainOrder: expect.objectContaining({
          nullable: true,
          maxLength: 128,
          description: expect.stringContaining('eligible_factories.factory_type_sequence'),
        }),
        industryMainOrderLabel: expect.objectContaining({
          nullable: true,
          maxLength: 500,
          description: expect.stringContaining('normalize'),
        }),
        industrySubOrder: expect.objectContaining({
          nullable: true,
          maxLength: 128,
          description: expect.stringContaining('eligible_factories.factory_type_sequence'),
        }),
        businessActivity: expect.objectContaining({
          nullable: true,
          maxLength: 4000,
          description: expect.stringContaining('eligible_factories.business_activity'),
        }),
      }),
    );
    expect(asObject(profileProperties.factoryName, 'profile factoryName').maxLength).toBe(500);
    expect(
      asObject(profileProperties.factoryFrontPhotos, 'profile factoryFrontPhotos').maxItems,
    ).toBe(10);
    expect(profileProperties).not.toHaveProperty('measurementPointCount');

    const summary = asObject(allSchemas.PomsFactorySummary, 'factory summary');
    const summaryBranches = summary.allOf as unknown[];
    expect(summaryBranches[0]).toEqual({ $ref: '#/components/schemas/PomsFactoryProfile' });
    const summaryExtension = asObject(summaryBranches[1], 'factory summary extension');
    expect(summaryExtension.required).toEqual([
      'systemTypes',
      'measurementPointCount',
      'pendingEditRequestCount',
    ]);
    expect(asObject(summaryExtension.properties, 'factory summary properties')).toEqual(
      expect.objectContaining({
        systemTypes: expect.any(Object),
        measurementPointCount: expect.any(Object),
        pendingEditRequestCount: expect.any(Object),
      }),
    );

    expect(allSchemas).not.toHaveProperty('PomsFactoriesResponse');

    const detail = asObject(allSchemas.PomsFactoryDetail, 'factory detail');
    expect((detail.allOf as unknown[])[0]).toEqual({
      $ref: '#/components/schemas/PomsFactorySummary',
    });
    expect(jsonSuccessSchema('/poms-factories/{factoryId}', 'get')).toEqual({
      $ref: '#/components/schemas/PomsFactoryDetailResponse',
    });
    expect(operation('/poms-factories/{factoryId}/form', 'get').description).toEqual(
      expect.stringContaining('eligible_factories.factory_type_sequence'),
    );

    const editRequest = asObject(allSchemas.PomsFactoryEditRequest, 'edit request');
    const editRequestProperties = asObject(editRequest.properties, 'edit request properties');
    expect(editRequest.required).toEqual(
      expect.arrayContaining(['factoryRegistrationNo', 'approvedAt']),
    );
    expect(editRequestProperties).toEqual(
      expect.objectContaining({
        requestNo: expect.objectContaining({ example: 'PFE-20260824-1A2B3C4D' }),
        factoryRegistrationNo: expect.any(Object),
        formType: expect.objectContaining({ enum: ['BASIC_INFO', 'MEASUREMENT_POINTS'] }),
        revisionNo: expect.objectContaining({ minimum: 0 }),
        approvedAt: expect.objectContaining({ nullable: true, format: 'date-time' }),
        currentMeasurementPoints: expect.objectContaining({ nullable: true }),
        proposedMeasurementPoints: expect.objectContaining({ nullable: true }),
      }),
    );

    const listOperation = operation('/poms-factories/edit-requests', 'get');
    const parameters = listOperation.parameters as JsonObject[];
    expect(parameters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'search',
          in: 'query',
          schema: expect.objectContaining({ type: 'string', maxLength: 255 }),
        }),
      ]),
    );
  });

  it('documents the complete revision workflow, decisions, and event timeline', () => {
    const allSchemas = schemas();
    const status = asObject(allSchemas.PomsFactoryEditRequestStatus, 'status');
    expect(status.enum).toEqual([
      'PENDING_REVIEW',
      'REVISION_REQUESTED',
      'REVISED_PENDING_REVIEW',
      'APPROVED',
      'REJECTED',
    ]);

    const review = asObject(allSchemas.PomsFactoryEditReviewRequest, 'review request');
    const reviewProperties = asObject(review.properties, 'review properties');
    expect(asObject(reviewProperties.decision, 'decision').enum).toEqual([
      'APPROVE',
      'REQUEST_REVISION',
      'REJECT',
    ]);
    expect(
      String(asObject(reviewProperties.revisionReason, 'revisionReason').description),
    ).toContain('REQUEST_REVISION');
    expect(String(asObject(reviewProperties.officerNote, 'officerNote').description)).toContain(
      'REJECT',
    );

    const request = asObject(allSchemas.PomsFactoryEditRequest, 'edit request response');
    const requestProperties = asObject(request.properties, 'edit request properties');
    expect(requestProperties).toEqual(
      expect.objectContaining({
        requestNo: expect.any(Object),
        revisionNo: expect.any(Object),
        isOpen: expect.any(Object),
        requestNote: expect.any(Object),
        revisionReason: expect.any(Object),
        officerNote: expect.any(Object),
        createdBy: expect.any(Object),
        submittedBy: expect.any(Object),
        events: expect.any(Object),
      }),
    );
    expect(asObject(requestProperties.events, 'events').items).toEqual({
      $ref: '#/components/schemas/PomsFactoryEditRequestEvent',
    });

    const event = asObject(allSchemas.PomsFactoryEditRequestEvent, 'event');
    const eventProperties = asObject(event.properties, 'event properties');
    expect(eventProperties).toEqual(
      expect.objectContaining({
        action: expect.any(Object),
        fromStatus: expect.any(Object),
        toStatus: expect.any(Object),
        actorUserId: expect.any(Object),
        createdAt: expect.any(Object),
      }),
    );
  });

  it('documents view data-scope plus the action permission for every write', () => {
    const expectations: Array<[string, string, string[], string]> = [
      ['/poms-factories', 'get', ['factories:view'], 'any'],
      ['/poms-factories/{factoryId}', 'get', ['factories:view'], 'any'],
      ['/poms-factories/{factoryId}/form', 'get', ['factories:view'], 'any'],
      ['/poms-factories/edit-requests', 'get', ['factories:view'], 'any'],
      ['/poms-factories/edit-requests/{id}', 'get', ['factories:view'], 'any'],
      ['/poms-factories/edit-requests/{id}/form', 'get', ['factories:view'], 'any'],
      [
        '/poms-factories/{factoryId}/edit-requests',
        'post',
        ['factories:view', 'factories:edit'],
        'all',
      ],
      [
        '/poms-factories/edit-requests/{id}/resubmission',
        'put',
        ['factories:view', 'factories:edit'],
        'all',
      ],
      [
        '/poms-factories/edit-requests/{id}/review',
        'post',
        ['factories:view', 'factories:approve'],
        'all',
      ],
    ];

    for (const [path, method, permissions, mode] of expectations) {
      const documented = operation(path, method);
      expect(documented['x-poms-permissions']).toEqual(permissions);
      expect(documented['x-poms-permission-mode']).toBe(mode);
      for (const permission of permissions) {
        expect(String(documented.description)).toContain(permission);
      }
    }

    const reviewDescription = String(
      operation('/poms-factories/edit-requests/{id}/review', 'post').description,
    );
    expect(reviewDescription).toContain('createdBy');
    expect(reviewDescription).toContain('submittedBy');
  });
});
