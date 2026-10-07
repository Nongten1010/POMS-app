import { describe, expect, it } from '@jest/globals';
import { pomsOpenApiDocument } from '../../src/modules/api-docs/poms.openapi';
import { updateManagedUserSchema } from '../../src/modules/users/users.validator';

describe('menu location OpenAPI contract', () => {
  const paths = pomsOpenApiDocument.paths as Record<
    string,
    Record<
      string,
      {
        description: string;
        requestBody: { content: { 'application/json': { example: unknown } } };
      }
    >
  >;

  it.each([
    ['/users/{id}', 'get'],
    ['/users/{id}', 'patch'],
    ['/users/{id}/permissions', 'put'],
  ])('documents independent locations and authorization on %s %s', (path, method) => {
    expect(paths[path][method].description).toContain(
      'พื้นที่รายเมนูที่ระบุมีผลก่อนพื้นที่โปรไฟล์',
    );
    expect(paths[path][method].description).toContain('permissions:manage');
    expect(paths[path][method].description).toContain('403 FORBIDDEN');
  });

  it('publishes an API officer example with independent menu locations and no profile patch', () => {
    const example = paths['/users/{id}'].patch.requestBody.content['application/json'].example;
    const input = updateManagedUserSchema.parse(example);
    if (!('permissionOverrides' in input)) throw new Error('Expected the edit-page payload shape');
    expect(input.roleCodes).toEqual(['diw_central']);
    expect(input.profile).toBeUndefined();
    expect(input.permissionOverrides).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          code: 'dashboard:view',
          scope: 'IN_REGION',
          region: 'ภาคตะวันออก',
        }),
        expect.objectContaining({
          code: 'factories:view',
          scope: 'IN_PROVINCE',
          province: 'ระยอง',
        }),
      ]),
    );
  });
});
