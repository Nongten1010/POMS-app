import { describe, expect, it } from '@jest/globals';
import { pomsOpenApiDocument } from '../../src/modules/api-docs/poms.openapi';

type Obj = Record<string, unknown>;
const obj = (value: unknown) => value as Obj;

describe('add-parameter form factory assets OpenAPI contract', () => {
  it.each([
    '/connected-measurement-points/{stationId}/parameter-form',
    '/connected-measurement-points/{stationId}/{buddhistYear}/parameter-form',
  ])('publishes factory assets in the point documents for %s', (path) => {
    const operation = obj(obj(obj(pomsOpenApiDocument.paths)[path]).get);
    const response = obj(obj(obj(obj(operation.responses)['200']).content)['application/json']);
    expect(response.schema).toEqual({ $ref: '#/components/schemas/AddParameterFormResponse' });

    const schemas = obj(obj(pomsOpenApiDocument.components).schemas);
    const schema = obj(schemas.AddParameterFormResponse);
    const data = obj(obj(schema.properties).data);
    const form = obj(obj(data.properties).formDefaults);
    const point = obj(obj(obj(form.properties).measurementPoints).items);
    expect(point.required).toContain('documentsAndImages');
    expect(obj(point.properties).documentsAndImages).toMatchObject({
      type: 'array',
      items: { $ref: '#/components/schemas/RequestDocumentImage' },
    });
    expect(schemas.RequestDocumentImage).toBeDefined();

    const exampleData = obj(obj(schema.example).data);
    const exampleForm = obj(exampleData.formDefaults);
    const examplePoint = obj((exampleForm.measurementPoints as unknown[])[0]);
    expect(examplePoint.documentsAndImages).toEqual([
      expect.objectContaining({
        title: 'ภาพถ่ายหน้าโรงงานหรือป้ายโรงงาน',
        fileUrl: 'https://example.com/uploads/factory-front.jpg',
      }),
      expect.objectContaining({
        title: 'สัญลักษณ์ของโรงงานหรือโลโก้บริษัท',
        fileUrl: 'https://example.com/uploads/factory-logo.png',
      }),
    ]);
    for (const object of [exampleData, exampleForm]) {
      expect(object).not.toHaveProperty('factoryFrontPhotos');
      expect(object).not.toHaveProperty('factoryLogo');
      expect(object).not.toHaveProperty('documentsAndImages');
    }
  });
});
