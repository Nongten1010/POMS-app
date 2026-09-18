import { describe, expect, it } from '@jest/globals';
import { connectionRequestsOpenApiDocument } from '../../src/modules/api-docs/connection-requests.openapi';
import { pomsOpenApiDocument } from '../../src/modules/api-docs/poms.openapi';
import { createDeviceConnectionConfigRequestSchema } from '../../src/modules/device-connections/device-connections.validator';

type Obj = Record<string, unknown>;
const obj = (value: unknown) => value as Obj;

describe('DCON API contract', () => {
  it.each(['DeviceConnectionConfig', 'StructuredDeviceConnectionDevice'])(
    'documents DCON in %s',
    (name) => {
      const schemas = obj(obj(connectionRequestsOpenApiDocument.components).schemas);
      expect(obj(obj(obj(schemas[name]).properties).protocol).enum).toContain('DCON_ASCII');
      expect(obj(obj(obj(schemas.ModbusRtuSettings).properties).slaveId).description).toContain(
        'device address',
      );
    },
  );

  it.each([
    '/cems-wpms-requests/{id}/device-configs',
    '/connected-measurement-points/{stationId}/device-configs',
  ])('publishes a valid DCON request example for %s', (path) => {
    const post = obj(obj(obj(connectionRequestsOpenApiDocument.paths)[path]).post);
    const media = obj(obj(obj(post.requestBody).content)['application/json']);
    expect(createDeviceConnectionConfigRequestSchema.parse(media.example)).toMatchObject({
      protocol: 'DCON_ASCII',
      settings: { slaveId: 7, valueRange: { min: 0 } },
    });
  });

  it('documents DCON in the integration response', () => {
    const schemas = obj(obj(pomsOpenApiDocument.components).schemas);
    const properties = obj(obj(schemas.IntegrationDeviceConfig).properties);
    expect(obj(properties.protocol).enum).toContain('DCON_ASCII');
    expect(obj(properties.slaveId).description).toContain('device address');
  });
});
