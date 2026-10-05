import { describe, expect, it } from '@jest/globals';
import { pomsOpenApiDocument } from '../../src/modules/api-docs/poms.openapi';

function asObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Expected an OpenAPI object');
  }
  return value as Record<string, unknown>;
}

describe('integration alert exceedance runtime contract', () => {
  it('publishes the strict numeric comparison and whole-batch validation behavior', () => {
    const paths = asObject(pomsOpenApiDocument.paths);
    const operation = asObject(asObject(paths['/integrations/alert-events']).post);
    expect(operation.description).toEqual(
      expect.stringContaining('measuredValue > thresholdValue'),
    );
    expect(operation.description).toEqual(expect.stringContaining('400 VALIDATION_ERROR'));
    expect(operation.description).toEqual(expect.stringContaining('ทั้ง batch'));
    expect(asObject(operation.responses)['400']).toBeDefined();
  });

  it('documents finite numbers and compatible numeric strings for both fields', () => {
    const schemas = asObject(asObject(pomsOpenApiDocument.components).schemas);
    const batch = asObject(schemas.IntegrationAlertEventBatchRequest);
    const events = asObject(asObject(batch.properties).events);
    const properties = asObject(asObject(events.items).properties);
    for (const field of ['measuredValue', 'thresholdValue']) {
      const schema = asObject(properties[field]);
      expect(schema.oneOf).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ type: 'number' }),
          expect.objectContaining({ type: 'string', minLength: 1 }),
        ]),
      );
      expect(schema.description).toEqual(expect.stringContaining('finite'));
    }
    expect(asObject(properties.measuredValue).description).toEqual(
      expect.stringContaining('thresholdValue'),
    );
  });
});
