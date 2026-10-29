import { describe, expect, it } from '@jest/globals';
import { pomsOpenApiDocument } from '../../src/modules/api-docs/poms.openapi';
import request from 'supertest';
import { createApp } from '../../src/app';

type JsonObject = Record<string, unknown>;
function object(value: unknown): JsonObject {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Expected object');
  return value as JsonObject;
}

describe('integration device config request-status OpenAPI', () => {
  it('publishes all current Worker fields in the served OpenAPI document', async () => {
    const response = await request(createApp()).get('/api/v1/openapi.json');
    expect(response.status).toBe(200);
    const schemas = response.body.components.schemas;
    const device = schemas.IntegrationDeviceConfig;
    expect(device.properties.readFunction).toMatchObject({
      type: 'string',
      nullable: true,
      enum: ['READ_INPUT', 'READ_HOLDING'],
    });
    expect(device.properties.readFunction).not.toHaveProperty('default');
    expect(device.required).toContain('readFunction');
    expect(device.properties.comPort).toMatchObject({
      oneOf: [{ type: 'number' }, { type: 'string' }],
      nullable: true,
    });
    const channel = schemas.IntegrationParameterConfig;
    expect(channel.properties.valueFormat.example).toBe('16bit');
    for (const field of ['scaleMin', 'scaleMax', 'gain']) {
      expect(channel.properties[field]).toMatchObject({ type: 'number', nullable: true });
      expect(channel.required).toContain(field);
    }
    expect(channel.properties.testMode.enum).toEqual([false]);
  });

  it.each([
    '/integrations/device-configs/{stationId}',
    '/integrations/device-configs/{stationId}/{buddhistYear}',
  ])('publishes the same status, cancellation and credential rules for %s', (path) => {
    const operation = object(object(object(pomsOpenApiDocument.paths)[path]).get);
    expect(operation.security).toEqual([{ deviceConfigApiKey: [] }]);
    expect(operation.description).toEqual(
      expect.stringContaining('ทุกสถานะคำขอยกเว้น CANCELED รวม REJECTED'),
    );
    expect(operation.description).toEqual(expect.stringContaining('สำเนา current'));
    expect(operation.description).toEqual(expect.stringContaining('snapshot'));
    expect(operation.description).toEqual(expect.stringContaining('no-store'));
    expect(operation.description).toEqual(expect.stringContaining('dbPass'));
    const responses = object(operation.responses);
    const success = object(object(object(responses['200']).content)['application/json']);
    expect(success.schema).toEqual({
      $ref: '#/components/schemas/IntegrationDeviceConfigsResponse',
    });
    const missing = object(object(object(responses['404']).content)['application/json']);
    expect(missing.example).toEqual({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Measurement point not found' },
    });
  });
});
