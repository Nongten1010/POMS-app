import { describe, expect, it } from '@jest/globals';
import { pomsOpenApiDocument } from '../../src/modules/api-docs/poms.openapi';

describe('BOD/COD step actor name contract', () => {
  it('documents actorName on the workflow steps returned by the detail endpoint', () => {
    const document = JSON.parse(JSON.stringify(pomsOpenApiDocument));
    const schemas = document.components.schemas;
    expect(
      document.paths['/bod-cod-deviation-reports/{id}'].get.responses['200'].content[
        'application/json'
      ].schema,
    ).toEqual({ $ref: '#/components/schemas/BodCodReportResponse' });
    expect(schemas.BodCodReportResponse.properties.data).toEqual({
      $ref: '#/components/schemas/BodCodReportData',
    });
    expect(schemas.BodCodReportData.properties.steps.items).toEqual({
      $ref: '#/components/schemas/BodCodWorkflowStep',
    });
    expect(schemas.BodCodWorkflowStep.required).toContain('actorName');
    expect(schemas.BodCodWorkflowStep.properties.actorName).toMatchObject({
      type: 'string',
      nullable: true,
      example: 'นาย สมชาย ใจดี',
    });
  });
});
