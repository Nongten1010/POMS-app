import { describe, expect, it } from '@jest/globals';
import { pomsOpenApiDocument } from '../../src/modules/api-docs/poms.openapi';

describe('explicit Chat ask auth response contract', () => {
  it('requires chat.ask as a boolean in login and me responses', () => {
    expect(pomsOpenApiDocument).toHaveProperty(
      'components.schemas.AuthSessionResponse.properties.permissions.$ref',
      '#/components/schemas/AuthPermissionGroups',
    );
    expect(pomsOpenApiDocument).toHaveProperty(
      'components.schemas.AuthPermissionGroups',
      expect.objectContaining({
        required: ['chat'],
        properties: {
          chat: {
            allOf: expect.arrayContaining([
              expect.objectContaining({
                required: ['ask'],
                properties: { ask: expect.objectContaining({ type: 'boolean' }) },
              }),
            ]),
            example: expect.objectContaining({ ask: false }),
          },
        },
      }),
    );
    for (const [path, method] of [
      ['/auth/login', 'post'],
      ['/auth/me', 'get'],
    ] as const) {
      expect(pomsOpenApiDocument).toHaveProperty(
        [
          'paths',
          path,
          method,
          'responses',
          '200',
          'content',
          'application/json',
          'schema',
          '$ref',
        ],
        '#/components/schemas/AuthSessionResponse',
      );
    }
  });

  it('keeps chat.ask required in the managed-user response', () => {
    expect(pomsOpenApiDocument).toHaveProperty(
      'components.schemas.EditablePermissionGroupsResponse.properties.chat.required',
      expect.arrayContaining(['ask']),
    );
    expect(pomsOpenApiDocument).toHaveProperty(
      'components.schemas.EditablePermissionGroupsResponse.properties.chat.properties.ask.type',
      'boolean',
    );
  });
});
