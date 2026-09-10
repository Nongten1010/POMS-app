import { describe, it, expect } from '@jest/globals';
import { pomsOpenApiDocument } from '../../src/modules/api-docs/poms.openapi';
import {
  statusManagementExample,
  statusManagementSchemas,
} from '../../src/modules/api-docs/poms-status-management.openapi';
import { statusManagementInputSchema } from '../../src/modules/poms-factories/poms-status-management.validator';
describe('Runtime status management OpenAPI', () => {
  it('publishes GET/PATCH with auth, validation, version conflicts and unit-bearing labels', () => {
    const document = pomsOpenApiDocument as {
      paths: Record<
        string,
        Record<string, { security: unknown; responses: Record<string, unknown> }>
      >;
      components: { schemas: Record<string, unknown> };
    };
    const path = document.paths['/poms-factories/{factoryId}/status-management']!;
    expect(path.get!.security).toEqual([{ bearerAuth: [] }]);
    expect(path.patch!.responses).toHaveProperty('409');
    expect(document.components.schemas).toHaveProperty('PomsStatusManagementResponse');
    expect(JSON.stringify(document.components.schemas.PomsStatusManagement)).toContain(
      'displayName',
    );
  });
  it('removes reason from the request contract', () => {
    const schema = statusManagementSchemas.PomsStatusManagementRequest;
    expect(schema?.required).toEqual(['expectedRevision']);
    expect(schema?.properties).not.toHaveProperty('reason');
    expect(statusManagementExample).not.toHaveProperty('reason');
  });
  it('has an executable example matching the real request validator', () => {
    expect(statusManagementInputSchema.parse(statusManagementExample)).toEqual(
      statusManagementExample,
    );
  });
});
