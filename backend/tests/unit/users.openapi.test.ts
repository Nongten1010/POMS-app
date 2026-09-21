import { describe, expect, it } from '@jest/globals';
import { pomsOpenApiDocument } from '../../src/modules/api-docs/poms.openapi';

describe('managed user identity conflict contract', () => {
  it.each([
    ['/users/local-accounts', 'post'],
    ['/users', 'post'],
    ['/users/{id}', 'patch'],
  ] as const)('documents 409 and a safe error for %s %s', (path, method) => {
    const paths = pomsOpenApiDocument.paths as Record<
      string,
      Record<string, { responses: Record<string, unknown>; description: string }>
    >;
    const operation = paths[path][method];
    expect(operation.responses['409']).toMatchObject({
      content: {
        'application/json': {
          example: {
            success: false,
            error: { code: 'CONFLICT', message: 'External ID already exists' },
          },
        },
      },
    });
    expect(operation.description).toContain('soft-delete');
  });
});
