import { describe, expect, it } from '@jest/globals';
import { pomsOpenApiDocument } from '../../src/modules/api-docs/poms.openapi';

type Schema = {
  $ref?: string;
  oneOf?: Schema[];
  properties?: Record<string, Schema>;
};

const { schemas } = pomsOpenApiDocument.components as { schemas: Record<string, Schema> };
const paths = pomsOpenApiDocument.paths as Record<
  string,
  Record<string, { requestBody: { content: { 'application/json': { schema: Schema } } } }>
>;
const resolveSchema = (schema: Schema): Schema =>
  schema.$ref ? schemas[schema.$ref.replace('#/components/schemas/', '')] : schema;

describe('managed user prenameTh OpenAPI contract', () => {
  it.each([
    ['/users', 'post'],
    ['/users/{id}', 'patch'],
  ])('publishes the 64-character title limit for %s %s', (path, method) => {
    const request = resolveSchema(
      paths[path][method].requestBody.content['application/json'].schema,
    );
    const variants = request.oneOf?.map(resolveSchema) ?? [request];
    const prenameSchemas = variants
      .map((variant) => variant.properties?.prenameTh)
      .filter((schema): schema is Schema => schema !== undefined);

    expect(prenameSchemas).toHaveLength(1);
    expect(prenameSchemas[0]).toMatchObject({
      type: 'string',
      minLength: 1,
      maxLength: 64,
      nullable: true,
    });
  });
});
