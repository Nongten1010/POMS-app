import { describe, expect, it } from '@jest/globals';
import { pomsOpenApiDocument } from '../../src/modules/api-docs/poms.openapi';

describe('menu badge runtime OpenAPI', () => {
  it('publishes the authenticated endpoint with seven required boolean fields and errors', () => {
    const document = pomsOpenApiDocument as unknown as {
      paths: Record<
        string,
        {
          get: {
            security: unknown[];
            parameters?: unknown[];
            description: string;
            'x-poms-permissions': string[];
            responses: Record<string, { headers: Record<string, { schema: { example: string } }> }>;
          };
        }
      >;
      components: {
        schemas: Record<
          string,
          {
            required: string[];
            additionalProperties: boolean;
            properties: Record<string, unknown>;
          }
        >;
      };
    };
    const operation = document.paths['/me/menu-badges']?.get;
    expect(operation).toBeDefined();
    expect(operation.security).toEqual([{ bearerAuth: [] }]);
    expect(operation['x-poms-permissions']).toEqual([]);
    expect(operation.parameters ?? []).toEqual([]);
    expect(operation.responses).toHaveProperty('401');
    expect(operation.responses).toHaveProperty('429');
    expect(operation.responses).toHaveProperty('500');
    const data = document.components.schemas.MenuBadges;
    expect(data.required).toEqual([
      'factories',
      'connection',
      'kwp_forms',
      'bod_cod_errors',
      'eligible_factories',
      'notifications',
      'chat',
    ]);
    expect(data.additionalProperties).toBe(false);
    expect(Object.values(data.properties)).toEqual(
      Array(7).fill(expect.objectContaining({ type: 'boolean' })),
    );
    expect(operation.description).toContain('Asia/Bangkok');
    expect(operation.description).toContain('approve');
    expect(operation.description).toContain('chat:view');
    expect(operation.description).toContain('status=open');
    expect(operation.description).toContain('status=closed');
    expect(operation.responses['200'].headers['Cache-Control'].schema.example).toBe(
      'private, no-store',
    );
  });
});
