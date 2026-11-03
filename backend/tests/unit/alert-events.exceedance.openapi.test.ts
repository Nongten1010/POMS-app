import { describe, expect, it } from '@jest/globals';
import { pomsOpenApiDocument } from '../../src/modules/api-docs/poms.openapi';
function asObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Expected object');
  return value as Record<string, unknown>;
}
describe('integration alert receipt runtime contract', () => {
  it('publishes passive receipt behavior and an explicit receipt response', () => {
    const operation = asObject(
      asObject(asObject(pomsOpenApiDocument.paths)['/integrations/alert-events']).post,
    );
    expect(operation.description).toEqual(expect.stringContaining('STORE_ONLY'));
    expect(operation.description).toEqual(expect.stringContaining('ไม่เขียน alert_events'));
    const response = asObject(asObject(operation.responses)['200']);
    const schema = asObject(asObject(asObject(response.content)['application/json']).schema);
    expect(schema.$ref).toBe('#/components/schemas/IntegrationAlertReceiptBatchResponse');
    expect(operation.security).toEqual([{ alertEventApiKey: [] }]);
  });
  it('requires only the bounded JSON events envelope, without business field validation', () => {
    const schemas = asObject(asObject(pomsOpenApiDocument.components).schemas);
    const batch = asObject(schemas.IntegrationAlertEventBatchRequest);
    const events = asObject(asObject(batch.properties).events);
    expect(batch.required).toEqual(['events']);
    expect(batch.additionalProperties).toBe(true);
    expect(events).toMatchObject({ minItems: 1, maxItems: 500 });
    expect(asObject(events.items)).toMatchObject({ type: 'object', additionalProperties: true });
    expect(asObject(events.items).required).toBeUndefined();
    const data = asObject(
      asObject(asObject(schemas.IntegrationAlertReceiptBatchResponse).properties).data,
    );
    const properties = asObject(data.properties);
    expect(asObject(properties.mode).enum).toEqual(['STORE_ONLY']);
    expect(asObject(properties.created).enum).toEqual([0]);
    const item = asObject(asObject(properties.results).items);
    expect(asObject(asObject(item.properties).event).enum).toEqual([null]);
  });
});
