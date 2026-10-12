import { describe, expect, it } from '@jest/globals';
import { pomsOpenApiDocument } from '../../src/modules/api-docs/poms.openapi';

interface ContractSchema {
  enum: string[];
  required: string[];
  description: string;
  properties: Record<string, ContractSchema>;
}

interface ContractOperation {
  description: string;
  responses: Record<string, { content: Record<string, { schema: unknown }> }>;
}

describe('custom user permission OpenAPI contract', () => {
  const document = pomsOpenApiDocument as unknown as {
    components: { schemas: Record<string, ContractSchema> };
    paths: Record<string, Record<string, ContractOperation>>;
  };
  const schemas = document.components.schemas;

  it('publishes the permission mode in managed and authenticated user responses', () => {
    expect(schemas.PermissionMode.enum).toEqual(['role_default', 'custom']);
    expect(schemas.ManagedUserEditUser.required).toContain('permissionMode');
    expect(schemas.ManagedUserEditUser.properties.permissionMode).toEqual({
      $ref: '#/components/schemas/PermissionMode',
    });
    expect(schemas.AuthSessionResponse.properties.user.properties.permissionMode).toEqual({
      $ref: '#/components/schemas/PermissionMode',
    });
  });

  it('publishes explicit reset and echoed user mode on the existing PATCH shapes', () => {
    expect(schemas.LegacyUpdateManagedUserRequest.properties.permissionMode).toEqual({
      $ref: '#/components/schemas/PermissionMode',
    });
    expect(schemas.EditResponseUpdateRequest.properties.permissionMode).toEqual({
      $ref: '#/components/schemas/PermissionMode',
    });
    expect(
      schemas.EditResponseUpdateRequest.properties.user.properties.permissionMode,
    ).toMatchObject({ enum: ['role_default', 'custom'] });
    expect(schemas.UpdateManagedUserRequest.description).toContain('role_default');
    expect(schemas.UpdateManagedUserRequest.description).toContain('custom');
  });

  it.each(['get', 'put'])('publishes mode with the raw %s permission response', (method) => {
    expect(
      document.paths['/users/{id}/permissions'][method].responses['200'].content['application/json']
        .schema,
    ).toEqual({
      $ref: '#/components/schemas/UserPermissionsResponse',
    });
    expect(schemas.UserPermissionsResponse.properties.data.properties.permissionMode).toEqual({
      $ref: '#/components/schemas/PermissionMode',
    });
  });

  it('documents replacement rather than inherited role permissions and latest authorization', () => {
    const description = document.paths['/users/{id}/permissions'].put.description;
    expect(description).toContain('custom');
    expect(description).toContain('ไม่จำกัด');
    expect(description).toContain('คำขอถัดไป');
    expect(schemas.ReplaceUserPermissionsRequest.properties.permissions.description).toContain(
      '[]',
    );
    expect(document.paths['/auth/me'].get.description).toContain('ล่าสุด');
  });

  it('distinguishes rejected explicit null data scopes from defaults copied once at save time', () => {
    const description = schemas.PermissionOverride.properties.scope.description;
    expect(description).toContain('ห้ามส่ง scope: null');
    expect(description).toContain('400 BAD_REQUEST');
    expect(description).toContain('ตอนบันทึกครั้งเดียว');
    expect(description).toContain('role view scope');
    expect(description).toContain('binary code ใช้ null ได้');
    expect(description).toContain('qualifier ที่ใช้ได้หลังเติม defaults');
    expect(document.paths['/auth/me'].get.description).toContain('saved view');
    expect(document.paths['/auth/me'].get.description).toContain('ไม่ fallback role หรือ profile');
  });

  it('documents parameter-create access without allowing null edit scope to omit form sections', () => {
    const description = document.paths['/cems-wpms-requests/parameters'].post.description;
    expect(description).toContain('effective edit scope');
    expect(description).toContain('assignment ปัจจุบัน');
    expect(description).toContain('ไม่มี data scope ที่ใช้ได้ตอบ 403 FORBIDDEN');
    expect(description).toContain('นอก scope/assignment หรือไม่พบตอบ 404 NOT_FOUND');
    expect(schemas.AddParameterMeasurementPoint.description).toContain('scope null ต้องส่ง');
  });

  it('preserves an explicit per-menu estate in grouped edit roundtrips', () => {
    const input = schemas.EditablePermissionGroups.properties.connection.properties;
    const output = schemas.EditablePermissionGroupsResponse.properties.connection.properties;
    expect(input.estateCode).toMatchObject({ type: 'string', maxLength: 32, nullable: true });
    expect(input.estate).toMatchObject({ type: 'string', maxLength: 32, nullable: true });
    expect(output.estateCode).toMatchObject({ type: 'string', maxLength: 32, nullable: true });
    expect(schemas.EditablePermissionGroups.properties.permissions.properties).not.toHaveProperty(
      'estateCode',
    );
    expect(schemas.EditablePermissionGroups.description).toContain('ราย action');
  });

  it('publishes raw legacy PATCH permissions without internal parser metadata', () => {
    const properties = schemas.LegacyUpdateManagedUserRequest.properties;
    expect(properties.permissionOverrides).toMatchObject({
      type: 'array',
      maxItems: 200,
      items: { $ref: '#/components/schemas/PermissionOverride' },
    });
    expect(properties).not.toHaveProperty('permissionEditSource');
    expect(schemas.EditResponseUpdateRequest.properties).not.toHaveProperty('permissionEditSource');
    expect(schemas.UpdateManagedUserRequest.description).toContain('permissionOverrides');
    expect(schemas.UpdateManagedUserRequest).toMatchObject({
      allOf: expect.arrayContaining([
        expect.objectContaining({
          anyOf: expect.arrayContaining([{ required: ['permissionOverrides'] }]),
        }),
      ]),
    });
  });
});
