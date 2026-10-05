import { describe, expect, it } from '@jest/globals';
import { pomsOpenApiDocument } from '../../src/modules/api-docs/poms.openapi';

type Operation = {
  description: string;
  requestBody: {
    content: {
      'application/json': {
        schema: {
          oneOf: {
            required: string[];
            properties: Record<string, { enum?: string[]; nullable?: boolean; maxLength?: number }>;
          }[];
        };
      };
    };
  };
};

describe('connection request rejection OpenAPI contract', () => {
  it('publishes reasonless rejection through the status action', () => {
    const paths = pomsOpenApiDocument.paths as Record<string, { post: Operation }>;
    const operation = paths['/cems-wpms-requests/{id}/status'].post;
    const branch = operation.requestBody.content['application/json'].schema.oneOf.find((schema) =>
      schema.properties.action?.enum?.includes('REJECT'),
    );
    expect(branch).toMatchObject({
      required: ['action'],
      properties: {
        officerNote: { nullable: true, maxLength: 1000 },
        revisionReason: { nullable: true, maxLength: 1000 },
      },
    });
    expect(operation.description).toContain('ทุกสถานะ');
  });
  it('publishes reasonless rejection through review and the status filter', () => {
    const paths = pomsOpenApiDocument.paths as Record<
      string,
      { post: Operation; get: { parameters: { name: string; schema: { enum?: string[] } }[] } }
    >;
    const operation = paths['/cems-wpms-requests/{id}/review'].post;
    const branch = operation.requestBody.content['application/json'].schema.oneOf.find((schema) =>
      schema.properties.decision?.enum?.includes('REJECT'),
    );
    expect(branch).toMatchObject({
      required: ['decision'],
      properties: { officerNote: { nullable: true }, revisionReason: { nullable: true } },
    });
    expect(
      paths['/cems-wpms-requests'].get.parameters.find((parameter) => parameter.name === 'status')
        ?.schema.enum,
    ).toContain('REJECTED');
  });
});
