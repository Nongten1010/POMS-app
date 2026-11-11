import { expect, it } from '@jest/globals';
import { pomsOpenApiDocument } from '../../src/modules/api-docs/poms.openapi';

interface Schema {
  properties: Record<string, Schema>;
  enum?: unknown[];
}
interface Operation {
  security: unknown;
  'x-poms-permissions': unknown;
  parameters: unknown[];
  responses: Record<string, { content: Record<string, { schema: unknown }> }>;
}
const document = pomsOpenApiDocument as unknown as {
  paths: Record<string, { get: Operation }>;
  components: { schemas: Record<string, Schema> };
};
it.each([
  '/connected-measurement-points/{stationId}/measurement-minutes',
  '/connected-measurement-points/{stationId}/{buddhistYear}/measurement-minutes',
])('publishes the minute-detail contract at %s', (path) => {
  const operation = document.paths[path]?.get;
  expect(operation).toBeDefined();
  expect(operation.security).toEqual([{ bearerAuth: [] }]);
  expect(operation['x-poms-permissions']).toEqual(['dashboard.stats:view']);
  expect(operation.parameters).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ name: 'date', required: true }),
      expect.objectContaining({
        name: 'hour',
        required: true,
        schema: expect.objectContaining({ pattern: '^(?:[01]\\d|2[0-3])$' }),
      }),
    ]),
  );
  expect(operation.responses['200'].content['application/json'].schema).toEqual({
    $ref: '#/components/schemas/MeasurementMinutesResponse',
  });
  expect(operation.responses['429']).toBeDefined();
  expect(operation.responses['503']?.content['application/json']).toMatchObject({
    example: { success: false, error: { code: 'MEASUREMENT_PARAMETER_UNIT_UNAVAILABLE' } },
  });
  const schemas = document.components.schemas;
  expect(schemas.MeasurementMinutesResponse.properties.data.properties.rows).toMatchObject({
    minItems: 60,
    maxItems: 60,
  });
  expect(schemas.MinuteMeasurementValue.properties.status.enum).toEqual([
    'Normal',
    'Calibration',
    'Defective',
    'Maintenance',
    'Start up',
    'Shut Down',
    'Turnaround',
    'Etc.',
    null,
  ]);
});

it('accepts surrounding whitespace on stored decimal strings without accepting nonnumeric text', () => {
  const schema = document.components.schemas.MinuteMeasurementValue.properties.value as unknown as {
    anyOf: Array<{ type: string; pattern?: string }>;
  };
  const pattern = new RegExp(
    schema.anyOf.find((variant) => variant.type === 'string')?.pattern ?? '(?!)',
  );
  expect(pattern.test(' 12.345678901234567890 ')).toBe(true);
  expect(pattern.test('not-a-number')).toBe(false);
});
