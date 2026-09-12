import { describe, expect, it } from '@jest/globals';
import { pomsOpenApiDocument } from '../../src/modules/api-docs/poms.openapi';
import { createPomsFactoryEditRequestSchema } from '../../src/modules/poms-factories/poms-factories.validator';

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
  return jsonResponseSchema(path, method, '200');
}

function jsonResponseSchema(path: string, method: string, status: string): JsonObject {
  const responses = asObject(operation(path, method).responses, 'responses');
  const response = asObject(responses[status], `${status} response`);
  const content = asObject(response.content, 'response.content');
  return asObject(asObject(content['application/json'], 'application/json').schema, 'schema');
}

describe('POMS factory master-data OpenAPI contract', () => {
  it('publishes all factory read and edit-request workflow operations', () => {
    const operations = [
      ['/poms-factories', 'get'],
      ['/poms-factories/{factoryId}', 'get'],
      ['/poms-factories/{factoryId}/form', 'get'],
      ['/poms-factories/document-images', 'post'],
      ['/poms-factories/{factoryId}/edit-requests', 'post'],
      ['/poms-factories/edit-requests', 'get'],
      ['/poms-factories/edit-requests/{id}', 'get'],
      ['/poms-factories/edit-requests/{id}/form', 'get'],
      ['/poms-factories/edit-requests/{id}/resubmission', 'put'],
      ['/poms-factories/edit-requests/{id}/cancel', 'post'],
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

  it('documents the single-file document-image upload contract and its error variants', () => {
    const documented = operation('/poms-factories/document-images', 'post');
    const requestBody = asObject(documented.requestBody, 'upload requestBody');
    expect(requestBody.required).toBe(true);

    const content = asObject(requestBody.content, 'upload content');
    const multipart = asObject(content['multipart/form-data'], 'multipart/form-data');
    expect(multipart.schema).toEqual({
      $ref: '#/components/schemas/PomsFactoryDocumentImageUploadRequest',
    });
    expect(multipart.encoding).toEqual({
      file: { contentType: 'image/jpeg, image/png, application/pdf' },
    });

    const upload = asObject(
      schemas().PomsFactoryDocumentImageUploadRequest,
      'document image upload request',
    );
    const uploadProperties = asObject(upload.properties, 'upload properties');
    expect(upload.additionalProperties).toBe(false);
    expect(upload.required).toEqual(['file']);
    expect(upload['x-max-files']).toBe(1);
    expect(Object.keys(uploadProperties).sort()).toEqual(
      ['file', 'title', 'description', 'link'].sort(),
    );

    const file = asObject(uploadProperties.file, 'upload file');
    expect(file).toEqual(
      expect.objectContaining({
        type: 'string',
        format: 'binary',
        'x-min-size-bytes': 1,
        'x-max-size-bytes': 5 * 1024 * 1024,
        'x-allowed-media-types': ['image/jpeg', 'image/png', 'application/pdf'],
        'x-allowed-file-extensions': ['.jpg', '.jpeg', '.png', '.pdf'],
      }),
    );
    expect(uploadProperties.title).toEqual(
      expect.objectContaining({ type: 'string', maxLength: 255, nullable: true }),
    );
    expect(uploadProperties.description).toEqual(
      expect.objectContaining({ type: 'string', maxLength: 1000, nullable: true }),
    );
    expect(uploadProperties.link).toEqual(
      expect.objectContaining({
        type: 'string',
        format: 'uri',
        maxLength: 2048,
        nullable: true,
      }),
    );
    expect(upload.required).not.toEqual(expect.arrayContaining(['title', 'description', 'link']));

    expect(jsonResponseSchema('/poms-factories/document-images', 'post', '201')).toEqual({
      $ref: '#/components/schemas/PomsFactoryDocumentImageResponse',
    });
    const uploadResponse = asObject(
      schemas().PomsFactoryDocumentImageResponse,
      'document image response',
    );
    expect(asObject(uploadResponse.properties, 'upload response properties').data).toEqual({
      $ref: '#/components/schemas/PomsFactoryUploadedDocumentImage',
    });
    const uploadedDocument = asObject(
      schemas().PomsFactoryUploadedDocumentImage,
      'uploaded document metadata',
    );
    expect(uploadedDocument.required).toEqual([
      'title',
      'description',
      'link',
      'fileName',
      'fileUrl',
      'fileType',
      'fileSize',
    ]);
    const uploadedProperties = asObject(uploadedDocument.properties, 'uploaded properties');
    expect(asObject(uploadedProperties.fileUrl, 'uploaded fileUrl')).toEqual(
      expect.objectContaining({ type: 'string', format: 'uri', pattern: '^https?://' }),
    );
    expect(asObject(uploadedProperties.fileType, 'uploaded fileType').enum).toEqual([
      'image/jpeg',
      'image/png',
      'application/pdf',
    ]);

    const responses = asObject(documented.responses, 'upload responses');
    const badRequest = asObject(responses['400'], 'upload 400 response');
    const badRequestContent = asObject(badRequest.content, 'upload 400 content');
    const badRequestJson = asObject(badRequestContent['application/json'], 'upload 400 JSON');
    expect(badRequestJson.schema).toEqual({ $ref: '#/components/schemas/ErrorEnvelope' });
    const examples = asObject(badRequestJson.examples, 'upload 400 examples');
    expect(
      asObject(asObject(examples.fileUploadFailed, 'multer example').value, 'multer value'),
    ).toEqual(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({ code: 'FILE_UPLOAD_FAILED' }),
      }),
    );
    expect(
      asObject(asObject(examples.badRequest, 'validation example').value, 'validation value'),
    ).toEqual(
      expect.objectContaining({
        success: false,
        error: expect.objectContaining({ code: 'BAD_REQUEST' }),
      }),
    );
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
    expect(pomsList.description).toEqual(
      expect.stringContaining('officerNotificationEmails รวมอีเมล current'),
    );
    expect(pomsList.description).toEqual(expect.stringContaining('eligibilityRequest=null'));
    expect(operatorList.description).not.toEqual(pomsList.description);
  });

  it('limits create and resubmission payloads to profile and contact fields', () => {
    const schema = asObject(schemas().PomsFactoryEditableProfileRequest, 'edit profile request');
    const properties = asObject(schema.properties, 'edit profile properties');

    expect(Object.keys(properties).sort()).toEqual(
      [
        'formType',
        'latitude',
        'longitude',
        'contactPersons',
        'notificationEmails',
        'officerNotificationEmails',
        'eia',
        'eiaOther',
        'projectName',
        'factoryFrontPhotos',
        'factoryLogo',
      ].sort(),
    );
    expect(schema.additionalProperties).toBe(false);
    expect(schema).not.toHaveProperty('required');
    expect(schema.anyOf).toEqual(
      [
        'eia',
        'eiaOther',
        'projectName',
        'factoryFrontPhotos',
        'factoryLogo',
        'latitude',
        'longitude',
        'contactPersons',
        'notificationEmails',
        'officerNotificationEmails',
      ].map((field) => ({ required: [field] })),
    );
    expect(properties).not.toHaveProperty('measurementPoints');
    expect(properties).not.toHaveProperty('businessActivity');
    expect(asObject(properties.factoryFrontPhotos, 'factoryFrontPhotos').maxItems).toBe(10);
    expect(
      String(asObject(properties.factoryFrontPhotos, 'factoryFrontPhotos').description),
    ).toContain('omitted = คงค่าเดิม');
    expect(
      String(asObject(properties.factoryFrontPhotos, 'factoryFrontPhotos').description),
    ).toContain('[] = ล้าง');
    expect(asObject(properties.factoryLogo, 'factoryLogo').nullable).toBe(true);
    expect(asObject(properties.factoryLogo, 'factoryLogo').allOf).toEqual([
      { $ref: '#/components/schemas/RequestDocumentImage' },
    ]);
    expect(String(asObject(properties.factoryLogo, 'factoryLogo').description)).toContain(
      'omitted = คงค่าเดิม',
    );
    expect(String(asObject(properties.factoryLogo, 'factoryLogo').description)).toContain(
      'สูงสุด 1 object',
    );
    expect(String(asObject(properties.factoryLogo, 'factoryLogo').description)).toContain(
      'null = ล้าง',
    );
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
        projectName: expect.any(String),
        factoryFrontPhotos: expect.any(Array),
        factoryLogo: expect.any(Object),
      }),
    );
    for (const field of ['factoryName', 'factoryAddress', 'address', 'remarks', 'note']) {
      expect(createExample).not.toHaveProperty(field);
    }
  });

  it('publishes basic-info create and resubmission examples accepted by the runtime validator', () => {
    const schema = asObject(schemas().PomsFactoryEditableProfileRequest, 'profile schema');
    expect(createPomsFactoryEditRequestSchema.safeParse(schema.example).success).toBe(true);
    for (const [path, method] of [
      ['/poms-factories/{factoryId}/edit-requests', 'post'],
      ['/poms-factories/edit-requests/{id}/resubmission', 'put'],
    ]) {
      const body = asObject(operation(path, method).requestBody, 'request body');
      const content = asObject(body.content, 'request content');
      const json = asObject(content['application/json'], 'JSON request');
      expect(createPomsFactoryEditRequestSchema.safeParse(json.example).success).toBe(true);
    }
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

    for (const field of [
      'eia',
      'eiaOther',
      'projectName',
      'factoryFrontPhotos',
      'factoryLogo',
      'latitude',
      'longitude',
    ]) {
      expect(requestProperties).toHaveProperty(field);
    }
    expect(createPomsFactoryEditRequestSchema.safeParse(request.example).success).toBe(true);
    expect(request.example).toEqual(expect.objectContaining({ projectName: expect.any(String) }));

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

  it('documents the current/live parameter semantics for the POMS factory form', () => {
    const description = String(operation('/poms-factories/{factoryId}/form', 'get').description);

    expect(description).toContain('eligibleParameters');
    expect(description).toContain('connectedParameters');
    expect(description).toContain('pendingParameters = eligibleParameters - connectedParameters');
    expect(description).toContain('requestedParameters');
    expect(description).toContain('parameters_json');
  });

  it('documents contacts and distinct current/proposed parameters on edit-request detail', () => {
    expect(jsonSuccessSchema('/poms-factories/edit-requests/{id}', 'get')).toEqual({
      $ref: '#/components/schemas/PomsFactoryEditRequestDetailResponse',
    });
    expect(jsonSuccessSchema('/poms-factories/edit-requests/{id}/review', 'post')).toEqual({
      $ref: '#/components/schemas/PomsFactoryEditRequestDetailResponse',
    });

    const detail = asObject(schemas().PomsFactoryEditRequestDetail, 'PomsFactoryEditRequestDetail');
    const properties = asObject(detail.properties, 'PomsFactoryEditRequestDetail properties');
    expect(detail.additionalProperties).toBe(false);
    expect(detail).not.toHaveProperty('allOf');
    expect(detail.required).toEqual(
      expect.arrayContaining([
        'id',
        'contactPersons',
        'notificationEmails',
        'officerNotificationEmails',
        'informationProviderName',
        'informationProviderPosition',
      ]),
    );
    expect(properties).toEqual(
      expect.objectContaining({
        contactPersons: expect.any(Object),
        notificationEmails: expect.any(Object),
        officerNotificationEmails: expect.any(Object),
        informationProviderName: expect.objectContaining({ type: 'string', nullable: true }),
        informationProviderPosition: expect.objectContaining({ type: 'string', nullable: true }),
      }),
    );

    const description = String(operation('/poms-factories/edit-requests/{id}', 'get').description);
    expect(description).toContain('currentMeasurementPoints');
    expect(description).toContain('parameters_json');
    expect(description).toContain('proposedMeasurementPoints');
    expect(description).toContain('contactPersons');
    expect(description).toContain('informationProviderName');
    expect(description).toContain('BASIC_INFO');
    expect(operation('/poms-factories/edit-requests/{id}/review', 'post').description).toEqual(
      expect.stringContaining('JWT role admin'),
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
    expect(operation('/poms-factories/{factoryId}/form', 'get').description).toEqual(
      expect.stringContaining('source_request_id'),
    );

    const editRequest = asObject(allSchemas.PomsFactoryEditRequest, 'edit request');
    const editRequestProperties = asObject(editRequest.properties, 'edit request properties');
    expect(editRequest.required).toEqual(
      expect.arrayContaining(['factoryRegistrationNo', 'approvedAt']),
    );
    expect(editRequestProperties).toEqual(
      expect.objectContaining({
        requestNo: expect.objectContaining({
          example: 'base-00001/2569',
          description: expect.stringContaining('point-00001/2569'),
        }),
        factoryRegistrationNo: expect.objectContaining({
          description: expect.stringContaining('eligible_factories.factory_registration_no_old'),
        }),
        formType: expect.objectContaining({ enum: ['BASIC_INFO', 'MEASUREMENT_POINTS'] }),
        revisionNo: expect.objectContaining({ minimum: 0 }),
        approvedAt: expect.objectContaining({ nullable: true, format: 'date-time' }),
        currentMeasurementPoints: expect.objectContaining({ nullable: true }),
        proposedMeasurementPoints: expect.objectContaining({ nullable: true }),
      }),
    );

    expect(operation('/poms-factories/{factoryId}/form', 'get').description).toEqual(
      expect.stringContaining('เลขทะเบียนเดิม'),
    );
    expect(operation('/poms-factories/edit-requests/{id}', 'get').description).toEqual(
      expect.stringContaining('ไม่เขียนทับ JSON snapshots'),
    );

    expect(operation('/poms-factories/{factoryId}/edit-requests', 'post').responses).toEqual(
      expect.objectContaining({
        '409': expect.objectContaining({ description: expect.stringContaining('99999') }),
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
      'CANCELLED',
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
    expect(asObject(eventProperties.action, 'event action').enum).toEqual([
      'SUBMIT',
      'REQUEST_REVISION',
      'RESUBMIT',
      'APPROVE',
      'REJECT',
      'CANCEL',
    ]);
  });

  it('publishes a required nullable actor name on shared edit-request events', () => {
    const event = asObject(schemas().PomsFactoryEditRequestEvent, 'event');
    const properties = asObject(event.properties, 'event properties');

    expect(event.required).toEqual(expect.arrayContaining(['actorUserId', 'actorName']));
    expect(properties.actorName).toEqual(
      expect.objectContaining({ type: 'string', nullable: true, example: 'สมชาย ใจดี' }),
    );
    expect(event.example).toEqual(
      expect.objectContaining({ actorUserId: 77, actorName: 'สมชาย ใจดี' }),
    );
  });

  it('documents owner-only cancellation without a body and with explicit transition errors', () => {
    const documented = operation('/poms-factories/edit-requests/{id}/cancel', 'post');
    expect(documented).not.toHaveProperty('requestBody');
    expect(String(documented.description)).toContain('createdBy');
    expect(String(documented.description)).toContain('PENDING_REVIEW');
    expect(String(documented.description)).toContain('REVISION_REQUESTED');
    expect(String(documented.description)).toContain('REVISED_PENDING_REVIEW');
    expect(String(documented.description)).toContain('REJECTED');
    expect(String(documented.description)).toContain('ยกเว้น APPROVED และ CANCELLED');
    expect(jsonSuccessSchema('/poms-factories/edit-requests/{id}/cancel', 'post')).toEqual({
      $ref: '#/components/schemas/PomsFactoryEditRequestResponse',
    });
    const editRequest = asObject(schemas().PomsFactoryEditRequest, 'cancelled edit request');
    expect(editRequest.required).toEqual(
      expect.arrayContaining(['id', 'status', 'statusLabel', 'isOpen', 'updatedAt']),
    );

    const responses = asObject(documented.responses, 'cancel responses');
    expect(responses['403']).toEqual({ $ref: '#/components/responses/Forbidden' });
    expect(responses['404']).toEqual({ $ref: '#/components/responses/NotFound' });

    const conflict = asObject(responses['409'], 'cancel 409 response');
    expect(String(conflict.description)).toContain('REJECTED');
    const conflictContent = asObject(conflict.content, 'cancel 409 content');
    const conflictJson = asObject(conflictContent['application/json'], 'cancel 409 JSON');
    expect(conflictJson.schema).toEqual({ $ref: '#/components/schemas/ErrorEnvelope' });
    expect(conflictJson.example).toEqual({
      success: false,
      error: {
        code: 'INVALID_STATUS_TRANSITION',
        message: 'ไม่สามารถยกเลิกคำขอในสถานะปัจจุบันได้',
        details: { id: 123, status: 'APPROVED' },
      },
    });
  });

  it('documents view data-scope plus the action permission for every write', () => {
    const expectations: Array<[string, string, string[], string]> = [
      ['/poms-factories', 'get', ['factories:view'], 'any'],
      ['/poms-factories/{factoryId}', 'get', ['factories:view'], 'any'],
      ['/poms-factories/{factoryId}/form', 'get', ['factories:view'], 'any'],
      ['/poms-factories/document-images', 'post', ['factories:edit'], 'any'],
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
        '/poms-factories/edit-requests/{id}/cancel',
        'post',
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

it('documents managed display fields while preserving legacy monitoring status', () => {
  const point = asObject(schemas().PomsMeasurementPoint, 'point');
  const fields = asObject(point.properties, 'properties');
  expect(fields.status).toMatchObject({
    enum: ['แสดง', 'ซ่อน', 'ยกเลิกการเชื่อมต่อ'],
    readOnly: true,
  });
  expect(fields.effectiveVisibility).toMatchObject({ enum: ['VISIBLE', 'HIDDEN'] });
  expect(fields.monitoringPointStatus).toBeDefined();
});

describe('POMS officer email contract', () => {
  it('documents point-level email replacement for writes and reads', () => {
    for (const name of ['PomsFactoryMeasurementPointPatchRequest', 'PomsMeasurementPoint']) {
      const properties = asObject(asObject(schemas()[name], name).properties, 'properties');
      expect(properties.officerNotificationEmails).toMatchObject({
        type: 'array',
        maxItems: 20,
        items: { type: 'string', format: 'email', maxLength: 254 },
      });
    }
  });
});

it('publishes nullable contact comparison snapshots and contact-only input examples', () => {
  const schema = asObject(schemas().PomsFactoryEditRequest, 'request');
  const properties = asObject(schema.properties, 'properties');
  expect(schema.required).toEqual(expect.arrayContaining(['currentContacts', 'proposedContacts']));
  expect(properties.currentContacts).toMatchObject({
    nullable: true,
    allOf: [{ $ref: '#/components/schemas/PomsFactoryContactsSnapshot' }],
  });
  const fields = asObject(
    asObject(schemas().PomsFactoryEditableProfileRequest, 'input').properties,
    'fields',
  );
  expect(fields.notificationEmails).toMatchObject({ type: 'array', maxItems: 20 });
  expect(
    createPomsFactoryEditRequestSchema.safeParse({
      contactPersons: [],
      notificationEmails: [],
      officerNotificationEmails: [],
    }).success,
  ).toBe(true);
});
