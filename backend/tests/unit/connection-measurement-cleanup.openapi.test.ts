import { describe, expect, it } from '@jest/globals';
import { pomsOpenApiDocument } from '../../src/modules/api-docs/poms.openapi';

describe('new point cleanup runtime API contract', () => {
  it.each([
    '/cems-wpms-requests/measurement-points',
    '/cems-wpms-requests/direct-connections',
    '/cems-wpms-requests/{id}/review',
    '/cems-wpms-requests/{id}/status',
    '/cems-wpms-requests/{id}/verify-connection',
  ])('documents the cleanup scope and retryable failure at %s', (path) => {
    const document = pomsOpenApiDocument as {
      paths: Record<
        string,
        {
          post: {
            description: string;
            responses: Record<string, unknown>;
            security: unknown;
          };
        }
      >;
    };
    const operation = document.paths[path].post;
    expect(operation.description).toContain('NEW_CONNECTION');
    expect(operation.description).toContain('ADD_MEASUREMENT_POINT');
    expect(operation.description).toContain('การล้างทั้งตารางนี้ไม่ใช้กับ ADD_PARAMETER');
    expect(operation.description).toContain('_data_1day');
    expect(operation.description).toContain('ไม่ใช้ verifiedAt');
    expect(operation.responses['503']).toMatchObject({
      content: {
        'application/json': {
          schema: {
            allOf: [
              { $ref: '#/components/schemas/ErrorEnvelope' },
              expect.objectContaining({
                properties: expect.objectContaining({
                  error: expect.objectContaining({
                    properties: expect.objectContaining({
                      code: { type: 'string', enum: ['MEASUREMENT_CLEANUP_FAILED'] },
                    }),
                  }),
                }),
              }),
            ],
          },
          example: {
            success: false,
            error: {
              code: 'MEASUREMENT_CLEANUP_FAILED',
              details: { retryable: true },
            },
          },
        },
      },
    });
    expect(operation.security).toEqual([{ bearerAuth: [] }]);
  });
});
