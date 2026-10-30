import { describe, expect, it } from '@jest/globals';
import { pomsOpenApiDocument } from '../../src/modules/api-docs/poms.openapi';

type JsonObject = Record<string, unknown>;

function object(value: unknown): JsonObject {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Expected an OpenAPI object');
  }
  return value as JsonObject;
}

describe('new point cleanup runtime API contract', () => {
  it.each([
    '/cems-wpms-requests/measurement-points',
    '/cems-wpms-requests/direct-connections',
    '/cems-wpms-requests/{id}/review',
    '/cems-wpms-requests/{id}/status',
    '/cems-wpms-requests/{id}/verify-connection',
  ])('documents the cleanup scope and retryable failure at %s', (path) => {
    const operation = object(object(object(pomsOpenApiDocument.paths)[path]).post);
    const description = String(operation.description);
    expect(description).toContain('NEW_CONNECTION');
    expect(description).toContain('ADD_MEASUREMENT_POINT');
    expect(description).toContain('การล้างทั้งตารางนี้ไม่ใช้กับ ADD_PARAMETER');
    expect(description).toContain('_data_1day');
    expect(description).toContain('ไม่ใช้ verifiedAt');
    const response = object(object(operation.responses)['503']);
    const media = object(object(response.content)['application/json']);
    const schema = object(media.schema);
    const branches = Array.isArray(schema.anyOf) ? schema.anyOf : [schema];
    expect(branches).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          allOf: [
            { $ref: '#/components/schemas/ErrorEnvelope' },
            expect.objectContaining({
              properties: expect.objectContaining({
                error: expect.objectContaining({
                  required: ['code', 'message', 'details'],
                  properties: expect.objectContaining({
                    code: { type: 'string', enum: ['MEASUREMENT_CLEANUP_FAILED'] },
                    details: {
                      type: 'object',
                      required: ['retryable'],
                      properties: { retryable: { type: 'boolean', enum: [true] } },
                    },
                  }),
                }),
              }),
            }),
          ],
        }),
      ]),
    );
    const examples = media.examples
      ? Object.values(object(media.examples)).map((example) => object(example).value)
      : [media.example];
    expect(examples).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          success: false,
          error: expect.objectContaining({
            code: 'MEASUREMENT_CLEANUP_FAILED',
            details: { retryable: true },
          }),
        }),
      ]),
    );
    expect(media.example === undefined || media.examples === undefined).toBe(true);
    expect(operation.security).toEqual([{ bearerAuth: [] }]);
  });
});
