import { describe, expect, it } from '@jest/globals';
import { pomsOpenApiDocument, pomsOpenApiStats } from '../../src/modules/api-docs/poms.openapi';

interface Schema {
  $ref?: string;
  properties: Record<string, Schema>;
  enum?: unknown[];
  additionalProperties?: boolean;
}

interface Operation {
  responses: Record<string, { content: Record<string, { schema: Schema }> }>;
}

interface RuntimeDocument {
  paths: Record<string, { get: Operation; post: Operation }>;
  components: { schemas: Record<string, Schema> };
}

describe('alert email runtime contract', () => {
  it('keeps public operation totals aligned after adding the two email endpoints', () => {
    expect(pomsOpenApiDocument['x-poms-canonical-operation-count']).toBe(
      pomsOpenApiStats.canonicalOperationCount,
    );
    const description = (pomsOpenApiDocument.info as { description: string }).description;
    expect(description).toContain(String(pomsOpenApiStats.canonicalOperationCount));
    expect(description).toContain(String(pomsOpenApiStats.operationCount));
  });
  it('publishes preview validation, success content, and editing permission', () => {
    const doc = pomsOpenApiDocument as unknown as RuntimeDocument;
    const operation = doc.paths['/alert-email-previews']?.post;
    expect(operation).toBeDefined();
    expect(JSON.stringify(operation)).toContain('notifications:edit');
    expect(operation.responses['200'].content['application/json'].schema).toBeDefined();
    expect(operation.responses['200'].content['application/json'].schema.$ref).toBe(
      '#/components/schemas/AlertEmailPreviewResponse',
    );
    expect(doc.components.schemas.AlertEmailPreviewResponse.properties.data.$ref).toBe(
      '#/components/schemas/AlertEmailPreview',
    );
    const request = doc.components.schemas.AlertEmailPreviewRequest;
    expect(request.properties.eventIds).toMatchObject({
      minItems: 1,
      maxItems: 100,
      uniqueItems: true,
    });
    expect(request.additionalProperties).toBe(false);
  });
  it('publishes scoped SMTP status history separately from officer tracking status', () => {
    const doc = pomsOpenApiDocument as unknown as RuntimeDocument;
    const operation = doc.paths['/alert-email-deliveries/{id}']?.get;
    expect(operation).toBeDefined();
    expect(operation.responses['200'].content['application/json'].schema.$ref).toBe(
      '#/components/schemas/AlertEmailDeliveryResponse',
    );
    expect(JSON.stringify(operation)).toContain('notifications:view_status');
    expect(doc.components.schemas.AlertEmailDelivery.properties.status.enum).toContain(
      'SMTP_ACCEPTED',
    );
    expect(doc.components.schemas.AlertEmailDelivery.properties.status.enum).toContain('UNKNOWN');
    expect(doc.components.schemas.AlertEmailDelivery.properties).not.toHaveProperty('leaseToken');
  });
});
