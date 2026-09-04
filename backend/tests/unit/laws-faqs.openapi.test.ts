import { describe, expect, it } from '@jest/globals';
import { MENU_TAGS } from '../../src/modules/api-docs/openapi.shared';
import { pomsOpenApiDocument, pomsOpenApiStats } from '../../src/modules/api-docs/poms.openapi';

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
  return asObject(asObject(pomsOpenApiDocument.components, 'components').schemas, 'schemas');
}

function schemaProperties(name: string): JsonObject {
  return asObject(asObject(schemas()[name], name).properties, `${name}.properties`);
}

function requestSchema(path: string, method: string, mediaType: string): JsonObject {
  const requestBody = asObject(operation(path, method).requestBody, 'requestBody');
  const content = asObject(requestBody.content, 'requestBody.content');
  return asObject(asObject(content[mediaType], mediaType).schema, `${mediaType}.schema`);
}

function successSchema(path: string, method: string, status = '200'): JsonObject {
  const responses = asObject(operation(path, method).responses, 'responses');
  const response = asObject(responses[status], `${status} response`);
  const content = asObject(response.content, `${status}.content`);
  return asObject(asObject(content['application/json'], 'application/json').schema, 'schema');
}

function expectUuidPathParameter(path: string, method: string): void {
  const parameters = operation(path, method).parameters as JsonObject[];
  const id = parameters.find((parameter) => parameter.name === 'id');
  expect(id).toEqual(
    expect.objectContaining({
      in: 'path',
      required: true,
      schema: expect.objectContaining({ type: 'string', format: 'uuid' }),
    }),
  );
}

function expectSharedErrorEnvelope(response: unknown): void {
  const documented = asObject(response, 'error response');
  if (documented.$ref) {
    expect(documented).toEqual({ $ref: '#/components/responses/BadRequest' });
    return;
  }

  const content = asObject(documented.content, 'error response content');
  const mediaType = asObject(content['application/json'], 'application/json error response');
  expect(mediaType.schema).toEqual({ $ref: '#/components/schemas/ErrorEnvelope' });
}

describe('laws and FAQs OpenAPI contract', () => {
  it('publishes all nine operations under their user-facing menu tags', () => {
    const publicOperations = [
      ['/laws', 'get', MENU_TAGS.LAWS],
      ['/laws/{id}/file', 'get', MENU_TAGS.LAWS],
      ['/faqs', 'get', MENU_TAGS.FAQS],
    ] as const;
    const writeOperations = [
      ['/laws', 'post', MENU_TAGS.LAWS, 'laws:edit'],
      ['/laws/{id}', 'put', MENU_TAGS.LAWS, 'laws:edit'],
      ['/laws/{id}', 'delete', MENU_TAGS.LAWS, 'laws:edit'],
      ['/faqs', 'post', MENU_TAGS.FAQS, 'faq:edit'],
      ['/faqs/{id}', 'put', MENU_TAGS.FAQS, 'faq:edit'],
      ['/faqs/{id}', 'delete', MENU_TAGS.FAQS, 'faq:edit'],
    ] as const;

    for (const [path, method, tag] of publicOperations) {
      expect(operation(path, method)).toEqual(
        expect.objectContaining({ tags: [tag], security: [] }),
      );
    }
    for (const [path, method, tag, permission] of writeOperations) {
      expect(operation(path, method)).toEqual(
        expect.objectContaining({
          tags: [tag],
          security: [{ bearerAuth: [] }],
          'x-poms-permissions': [permission],
          'x-poms-permission-mode': 'any',
        }),
      );
    }

    expect(pomsOpenApiStats).toEqual({
      canonicalOperationCount: 139,
      operationCount: 148,
      tagCount: 13,
    });
  });

  it('documents UUID identifiers and unpaginated public lists', () => {
    expect(operation('/laws', 'get').parameters ?? []).toEqual([]);
    expect(operation('/faqs', 'get').parameters ?? []).toEqual([]);
    expectUuidPathParameter('/laws/{id}', 'put');
    expectUuidPathParameter('/laws/{id}', 'delete');
    expectUuidPathParameter('/laws/{id}/file', 'get');
    expectUuidPathParameter('/faqs/{id}', 'put');
    expectUuidPathParameter('/faqs/{id}', 'delete');

    expect(schemaProperties('Law').id).toEqual(
      expect.objectContaining({ type: 'string', format: 'uuid' }),
    );
    expect(schemaProperties('Faq').id).toEqual(
      expect.objectContaining({ type: 'string', format: 'uuid' }),
    );
    expect(successSchema('/laws', 'get')).toEqual({
      $ref: '#/components/schemas/LawListResponse',
    });
    expect(successSchema('/faqs', 'get')).toEqual({
      $ref: '#/components/schemas/FaqListResponse',
    });
  });

  it('defines the law DTO, enums, multipart payloads, and PDF download', () => {
    expect(asObject(schemas().LawCategory, 'LawCategory').enum).toEqual(['CEMS', 'WPMS', 'OTHER']);
    expect(asObject(schemas().LawType, 'LawType').enum).toEqual([
      'MINISTERIAL_REGULATION',
      'RULE_AND_ANNOUNCEMENT',
      'REGULATION_REQUIREMENT',
      'OTHER',
    ]);

    const law = asObject(schemas().Law, 'Law');
    expect(law.additionalProperties).toBe(false);
    expect(law.required).toEqual([
      'id',
      'title',
      'category',
      'categoryLabel',
      'type',
      'typeLabel',
      'publishedDate',
      'file',
      'createdAt',
      'updatedAt',
    ]);
    expect(schemaProperties('Law').publishedDate).toEqual(
      expect.objectContaining({ type: 'string', format: 'date' }),
    );
    expect(schemaProperties('Law').category).toEqual({ $ref: '#/components/schemas/LawCategory' });
    expect(schemaProperties('Law').type).toEqual({ $ref: '#/components/schemas/LawType' });

    const file = asObject(schemas().LawFile, 'LawFile');
    expect(file.required).toEqual(['fileName', 'fileSize', 'mimeType', 'downloadUrl']);
    expect(schemaProperties('LawFile').fileSize).toEqual(
      expect.objectContaining({ type: 'integer', minimum: 1, maximum: 10 * 1024 * 1024 }),
    );
    expect(schemaProperties('LawFile').mimeType).toEqual(
      expect.objectContaining({ type: 'string', enum: ['application/pdf'] }),
    );
    expect(schemaProperties('LawFile').downloadUrl).toEqual(
      expect.objectContaining({ type: 'string', format: 'uri-reference' }),
    );

    const create = requestSchema('/laws', 'post', 'multipart/form-data');
    expect(create).toEqual({ $ref: '#/components/schemas/CreateLawRequest' });
    expect(asObject(schemas().CreateLawRequest, 'CreateLawRequest').required).toEqual([
      'title',
      'category',
      'type',
      'publishedDate',
      'file',
    ]);
    expect(schemaProperties('CreateLawRequest').file).toEqual(
      expect.objectContaining({
        type: 'string',
        format: 'binary',
        'x-max-size-bytes': 10 * 1024 * 1024,
      }),
    );
    expect(successSchema('/laws', 'post', '201')).toEqual({
      $ref: '#/components/schemas/LawResponse',
    });

    const update = requestSchema('/laws/{id}', 'put', 'multipart/form-data');
    expect(update).toEqual({ $ref: '#/components/schemas/UpdateLawRequest' });
    expect(asObject(schemas().UpdateLawRequest, 'UpdateLawRequest').required).toEqual([
      'title',
      'category',
      'type',
      'publishedDate',
    ]);
    expect(schemaProperties('UpdateLawRequest').file).toEqual(
      expect.objectContaining({ type: 'string', format: 'binary' }),
    );

    const fileResponses = asObject(operation('/laws/{id}/file', 'get').responses, 'responses');
    const fileContent = asObject(asObject(fileResponses['200'], '200 response').content, 'content');
    expect(asObject(fileContent['application/pdf'], 'application/pdf').schema).toEqual({
      type: 'string',
      format: 'binary',
    });
  });

  it('defines strict FAQ request and response DTOs', () => {
    expect(asObject(schemas().FaqCategory, 'FaqCategory').enum).toEqual(['CEMS', 'WPMS', 'OTHER']);

    const faq = asObject(schemas().Faq, 'Faq');
    expect(faq.additionalProperties).toBe(false);
    expect(faq.required).toEqual([
      'id',
      'question',
      'answer',
      'category',
      'categoryLabel',
      'updatedDate',
      'createdAt',
      'updatedAt',
    ]);
    expect(schemaProperties('Faq').category).toEqual({ $ref: '#/components/schemas/FaqCategory' });
    expect(schemaProperties('Faq').updatedDate).toEqual(
      expect.objectContaining({ type: 'string', format: 'date' }),
    );

    for (const [path, method] of [
      ['/faqs', 'post'],
      ['/faqs/{id}', 'put'],
    ]) {
      expect(requestSchema(path, method, 'application/json')).toEqual({
        $ref: '#/components/schemas/FaqRequest',
      });
    }
    const faqRequest = asObject(schemas().FaqRequest, 'FaqRequest');
    expect(faqRequest.additionalProperties).toBe(false);
    expect(faqRequest.required).toEqual(['question', 'answer', 'category', 'updatedDate']);
    expect(schemaProperties('FaqRequest')).not.toHaveProperty('id');
    expect(successSchema('/faqs', 'post', '201')).toEqual({
      $ref: '#/components/schemas/FaqResponse',
    });
    expect(successSchema('/faqs/{id}', 'put')).toEqual({
      $ref: '#/components/schemas/FaqResponse',
    });
  });

  it('uses the shared client-readable error envelope on validation and missing records', () => {
    for (const [path, method] of [
      ['/laws', 'post'],
      ['/laws/{id}', 'put'],
      ['/laws/{id}', 'delete'],
      ['/laws/{id}/file', 'get'],
      ['/faqs', 'post'],
      ['/faqs/{id}', 'put'],
      ['/faqs/{id}', 'delete'],
    ]) {
      const responses = asObject(operation(path, method).responses, `${method} ${path}.responses`);
      expectSharedErrorEnvelope(responses['400']);
      expect(responses['404']).toEqual({ $ref: '#/components/responses/NotFound' });
    }

    const errorEnvelope = asObject(schemas().ErrorEnvelope, 'ErrorEnvelope');
    const error = asObject(schemaProperties('ErrorEnvelope').error, 'ErrorEnvelope.error');
    expect(errorEnvelope.required).toEqual(expect.arrayContaining(['success', 'error']));
    expect(asObject(error.properties, 'ErrorEnvelope.error.properties')).toEqual(
      expect.objectContaining({
        code: expect.objectContaining({ type: 'string' }),
        message: expect.objectContaining({ type: 'string' }),
        details: expect.objectContaining({ type: 'object' }),
      }),
    );
  });
});
