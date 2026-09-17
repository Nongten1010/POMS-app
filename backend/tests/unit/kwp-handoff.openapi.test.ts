import { describe, expect, it } from '@jest/globals';
import { pomsOpenApiDocument } from '../../src/modules/api-docs/poms.openapi';
type ObjectSchema = Record<string, unknown>;
function objectAt(value: unknown, ...keys: string[]): ObjectSchema {
  let result = value;
  for (const key of keys) {
    if (!result || typeof result !== 'object') throw new Error(`Missing schema key ${key}`);
    result = (result as ObjectSchema)[key];
  }
  if (!result || typeof result !== 'object') throw new Error('Expected an OpenAPI object');
  return result as ObjectSchema;
}
const schemas = objectAt(pomsOpenApiDocument, 'components', 'schemas');

describe('KWP handoff runtime contract', () => {
  it('documents the exact optional report and attachment fields on writes and detail reads', () => {
    for (const name of ['Kwp01Request', 'Kwp03Request']) {
      expect(objectAt(schemas, name, 'properties', 'attachmentLink').pattern).toBe('^https?://');
      expect(objectAt(schemas, name, 'properties', 'attachments').maxItems).toBe(5);
    }
    expect(objectAt(schemas, 'Kwp02Or04Request', 'properties', 'reportYear')).toMatchObject({
      type: 'integer',
      minimum: 2400,
      maximum: 9999,
    });
    for (const field of [
      'attachmentLink',
      'attachments',
      'reportRound',
      'reportYear',
      'samplingPhotoLink',
      'labReportLink',
    ]) {
      expect(objectAt(schemas, 'KwpSubmissionDetail', 'properties')[field]).toBeDefined();
    }
    for (const form of ['kwp01', 'kwp02', 'kwp03', 'kwp04', 'kwp05']) {
      for (const method of ['get', 'patch']) {
        expect(
          objectAt(
            pomsOpenApiDocument,
            'paths',
            `/kwp-form-submissions/${form}/{id}`,
            method,
            'responses',
            '200',
            'content',
            'application/json',
            'schema',
          ).$ref,
        ).toBe('#/components/schemas/KwpSubmissionDetailResponse');
      }
    }
  });
  it('publishes cancellation with distinct edit permission and a KWP-scoped prefill endpoint', () => {
    expect(objectAt(schemas, 'KwpWorkflowActionRequest').oneOf).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ properties: { action: { type: 'string', enum: ['CANCEL'] } } }),
      ]),
    );
    expect(
      objectAt(pomsOpenApiDocument, 'paths', '/kwp-form-submissions/{id}/workflow-actions', 'post')
        .description,
    ).toContain('kwp_forms:edit');
    expect(
      objectAt(
        pomsOpenApiDocument,
        'paths',
        '/kwp-form-reports/factories/{factoryId}/measurement-points',
        'get',
      ).description,
    ).toContain('kwp_forms:view');
  });
});
