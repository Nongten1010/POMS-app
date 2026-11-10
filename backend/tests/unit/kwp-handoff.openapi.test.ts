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
  it('requires reportCondition only on KWP04 writes and returns nullable legacy values', () => {
    const item = objectAt(schemas, 'Kwp04Request', 'properties', 'measurementItems', 'items');
    expect(item.required).toEqual(['pollutant', 'reportCondition']);
    expect(objectAt(item, 'properties', 'reportCondition')).toMatchObject({
      type: 'string',
      enum: ['4(1)', '4(2)', '11(3)', '16'],
    });
    expect(objectAt(item, 'properties', 'reportCondition')).not.toHaveProperty('default');
    expect(
      objectAt(
        schemas,
        'Kwp02Or04Request',
        'properties',
        'measurementItems',
        'items',
        'properties',
      ),
    ).not.toHaveProperty('reportCondition');
    expect(
      objectAt(
        schemas,
        'Kwp04SubmissionDetail',
        'properties',
        'measurementItems',
        'items',
        'properties',
        'reportCondition',
      ),
    ).toMatchObject({ nullable: true, enum: ['4(1)', '4(2)', '11(3)', '16', null] });
    for (const [path, method] of [
      ['/kwp-form-submissions/kwp04', 'post'],
      ['/kwp-form-submissions/kwp04/{id}', 'patch'],
    ]) {
      expect(
        objectAt(
          pomsOpenApiDocument,
          'paths',
          path,
          method,
          'requestBody',
          'content',
          'application/json',
          'schema',
        ).$ref,
      ).toBe('#/components/schemas/Kwp04Request');
    }
  });

  it('documents one current-location policy for every KWP read and workflow operation', () => {
    const paths = objectAt(pomsOpenApiDocument, 'paths');
    for (const [path, item] of Object.entries(paths)) {
      if (!path.startsWith('/kwp-form-') || path.endsWith('/attachments')) continue;
      for (const method of ['get', 'post', 'patch']) {
        const operation = (item as ObjectSchema)[method];
        if (!operation) continue;
        const description = objectAt(operation).description;
        expect(description).toEqual(expect.stringContaining('provinces.region'));
        expect(description).toEqual(expect.stringContaining('ไม่ใช้กรองสิทธิ์'));
        expect(description).toEqual(expect.stringContaining('scope ของ view/edit/approve'));
      }
    }
  });

  it('restricts measurement attachments without narrowing general or legacy attachments', () => {
    const attachmentItems = objectAt(
      schemas,
      'Kwp02Or04Request',
      'properties',
      'measurementItems',
      'items',
      'properties',
      'attachments',
      'items',
    );
    expect(attachmentItems.$ref).toBe('#/components/schemas/KwpMeasurementAttachmentMetadata');
    expect(objectAt(schemas, 'KwpMeasurementAttachmentMetadata').allOf).toEqual([
      { $ref: '#/components/schemas/KwpAttachmentMetadata' },
      expect.objectContaining({
        properties: {
          attachmentType: { type: 'string', enum: ['SAMPLING_PHOTO', 'LAB_REPORT'] },
          fileSize: { type: 'integer', minimum: 1, maximum: 5242880, nullable: true },
        },
      }),
    ]);
    expect(
      objectAt(schemas, 'KwpAttachmentMetadata', 'properties', 'attachmentType').enum,
    ).toBeUndefined();
  });
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
        ).toBe(
          form === 'kwp04'
            ? '#/components/schemas/Kwp04SubmissionDetailResponse'
            : '#/components/schemas/KwpSubmissionDetailResponse',
        );
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
