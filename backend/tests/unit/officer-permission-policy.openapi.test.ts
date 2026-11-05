import { describe, expect, it } from '@jest/globals';
import { env } from '../../src/config/env';
import { decorateOfficerPermissionDocs } from '../../src/modules/api-docs/officer-permissions.openapi';
import { pomsOpenApiDocument } from '../../src/modules/api-docs/poms.openapi';

describe('officer permission runtime OpenAPI policy', () => {
  it('qualifies Bearer permissions and reports the configured runtime mode', () => {
    const paths = pomsOpenApiDocument.paths as Record<
      string,
      Record<string, Record<string, unknown>>
    >;
    expect(pomsOpenApiDocument['x-poms-officer-permission-checks-enabled']).toBe(
      env.OFFICER_PERMISSION_CHECKS_ENABLED,
    );
    for (const path of Object.values(paths)) {
      for (const operation of Object.values(path)) {
        const security = operation?.security as Record<string, unknown>[] | undefined;
        if (!security?.some((scheme) => Object.hasOwn(scheme, 'bearerAuth'))) continue;
        expect(operation.description).toContain('OFFICER_PERMISSION_CHECKS_ENABLED');
        expect(operation['x-poms-officer-permission-checks-enabled']).toBe(
          env.OFFICER_PERMISSION_CHECKS_ENABLED,
        );
      }
    }
  });

  it('leaves public and Integration API security unchanged', () => {
    const paths = {
      '/public': { get: { description: 'Public', security: [] } },
      '/integration': {
        post: { description: 'Integration', security: [{ integrationApiKey: [] }] },
      },
    };
    const original = structuredClone(paths);
    decorateOfficerPermissionDocs(paths);
    expect(paths).toEqual(original);
  });
});
