import { afterEach, describe, expect, it } from '@jest/globals';
import { env } from '../../src/config/env';
import { decorateOfficerWritePermissionDocs } from '../../src/modules/api-docs/officer-write-permissions.openapi';
import { pomsOpenApiDocument } from '../../src/modules/api-docs/poms.openapi';

const originalSetting = env.OFFICER_WRITE_PERMISSION_CHECKS_ENABLED;

describe('officer write-only OpenAPI policy', () => {
  afterEach(() => {
    env.OFFICER_WRITE_PERMISSION_CHECKS_ENABLED = originalSetting;
  });

  it.each([false, true])('leaves read-only operations intact with checks enabled=%s', (enabled) => {
    env.OFFICER_WRITE_PERMISSION_CHECKS_ENABLED = enabled;
    const paths = {
      '/read': {
        get: {
          description: 'Existing read',
          'x-poms-permissions': ['example:view', 'example:approve'],
        },
        head: { 'x-poms-permissions': ['example:edit'] },
      },
      '/mixed': {
        post: {
          description: 'Existing write',
          'x-poms-permissions': ['example:view', 'example:approve'],
          'x-poms-permission-mode': 'all',
        },
      },
      '/internal': { post: { 'x-poms-permissions': ['permissions:manage'] } },
    };
    const original = structuredClone(paths);
    decorateOfficerWritePermissionDocs(paths);
    expect(paths['/read']).toEqual(original['/read']);
    expect(paths['/internal']).toEqual(original['/internal']);
    expect(paths['/mixed'].post).toMatchObject({
      'x-poms-permissions': ['example:view', 'example:approve'],
      'x-poms-permission-mode': 'all',
      'x-poms-officer-write-permission-checks-enabled': enabled,
      'x-poms-officer-bypassed-permissions': enabled ? [] : ['example:approve'],
    });
  });

  it('publishes the runtime mode on writes while retaining every GET/HEAD contract', () => {
    expect(pomsOpenApiDocument['x-poms-officer-write-permission-checks-enabled']).toBe(
      originalSetting,
    );
    const paths = pomsOpenApiDocument.paths as Record<
      string,
      Record<string, Record<string, unknown>>
    >;
    for (const path of Object.values(paths)) {
      for (const method of ['get', 'head']) {
        if (!path[method]) continue;
        expect(path[method]).not.toHaveProperty('x-poms-officer-write-permission-checks-enabled');
        expect(path[method]).not.toHaveProperty('x-poms-officer-bypassed-permissions');
      }
    }
    expect(paths['/monitoring-point-forms/{id}'].put).toMatchObject({
      'x-poms-officer-write-permission-checks-enabled': originalSetting,
      'x-poms-officer-bypassed-permissions': originalSetting ? [] : ['cems_wpms_requests:edit'],
    });
  });
});
