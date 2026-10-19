import { describe, expect, it } from '@jest/globals';
import { pomsOpenApiDocument } from '../../src/modules/api-docs/poms.openapi';

describe('connection-test OpenAPI contract', () => {
  it('publishes the one-minute source, ten-row limit and existing access requirements', () => {
    const document = pomsOpenApiDocument as any;
    const operation = document.paths['/parameter-values/connection-test'].get;
    const response = operation.responses['200'].content['application/json'];
    const schema = document.components.schemas.ParameterConnectionTestResponse;

    expect(operation.security).toEqual([{ bearerAuth: [] }]);
    expect(operation.description).toContain('cems_wpms_requests:view');
    expect(operation.description).toContain('WAITING_CONNECTION');
    expect(operation.parameters).toEqual([
      expect.objectContaining({ name: 'stationId', in: 'query', required: true }),
    ]);
    expect(response.schema).toEqual({
      $ref: '#/components/schemas/ParameterConnectionTestResponse',
    });
    expect(schema.properties.data).toMatchObject({ type: 'array', maxItems: 10 });
    expect(schema.properties.meta.properties).toMatchObject({
      interval: { enum: ['1m'] },
      tableName: { example: 'S2003_data_1m' },
      count: { minimum: 0, maximum: 10 },
    });
    expect(response.examples.latestMinuteRows.value).toMatchObject({
      success: true,
      data: [expect.objectContaining({ timestamp: '2026-10-19 10:15:00' })],
      meta: { stationId: 'S2003', interval: '1m', tableName: 'S2003_data_1m', count: 1 },
    });
  });
});
