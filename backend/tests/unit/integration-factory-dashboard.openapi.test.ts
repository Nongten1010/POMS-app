import { describe, expect, it } from '@jest/globals';
import { pomsOpenApiDocument } from '../../src/modules/api-docs/poms.openapi';

type JsonObject = Record<string, unknown>;

function asObject(value: unknown, label: string): JsonObject {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value as JsonObject;
}

describe('integration factory dashboard OpenAPI contract', () => {
  it('documents the dedicated API key, registration number and single-factory response', () => {
    const document = asObject(pomsOpenApiDocument, 'document');
    const paths = asObject(document.paths, 'paths');
    const operation = asObject(
      asObject(
        paths['/integrations/factories/{registrationNo}/dashboard'],
        'factory dashboard path',
      ).get,
      'factory dashboard operation',
    );

    expect(operation.security).toEqual([{ factoryDashboardApiKey: [] }]);
    const registrationParameter = (operation.parameters as JsonObject[]).find(
      (parameter) => parameter.name === 'registrationNo',
    );
    expect(asObject(registrationParameter, 'registrationNo').schema).toEqual(
      expect.objectContaining({ type: 'string', pattern: '^\\d{14}$' }),
    );

    const responses = asObject(operation.responses, 'responses');
    const content = asObject(asObject(responses['200'], '200').content, '200 content');
    expect(asObject(content['application/json'], 'application/json').schema).toEqual({
      $ref: '#/components/schemas/IntegrationFactoryDashboardResponse',
    });

    const components = asObject(document.components, 'components');
    const securitySchemes = asObject(components.securitySchemes, 'security schemes');
    expect(securitySchemes.factoryDashboardApiKey).toEqual(
      expect.objectContaining({ type: 'apiKey', in: 'header', name: 'X-API-Key' }),
    );

    const schemas = asObject(components.schemas, 'schemas');
    const responseSchema = asObject(
      schemas.IntegrationFactoryDashboardResponse,
      'IntegrationFactoryDashboardResponse',
    );
    const responseProperties = asObject(responseSchema.properties, 'response properties');
    const dataSchema = asObject(responseProperties.data, 'data');
    expect(dataSchema).toEqual(
      expect.objectContaining({
        type: 'array',
        minItems: 1,
        maxItems: 1,
        items: { $ref: '#/components/schemas/IntegrationFactoryDashboardRow' },
      }),
    );

    const rowSchema = asObject(
      schemas.IntegrationFactoryDashboardRow,
      'IntegrationFactoryDashboardRow',
    );
    const rowProperties = asObject(rowSchema.properties, 'row properties');
    expect(rowProperties.isFavorite).toBeUndefined();
    expect(rowProperties.hasLatestHourlyMeasurement).toEqual({ type: 'boolean' });
    expect(rowProperties.measurementPoints).toBeDefined();
  });
});
