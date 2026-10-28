import request from 'supertest';
import { describe, expect, it } from '@jest/globals';
import { createApp } from '../../src/app';
import { createDeviceConnectionConfigRequestSchema } from '../../src/modules/device-connections/device-connections.validator';

describe('published device protocol contract', () => {
  it('publishes Serial ASCII and optional Modbus read functions at /api/v1/openapi.json', async () => {
    const response = await request(createApp()).get('/api/v1/openapi.json');
    expect(response.status).toBe(200);
    expect(response.headers['cache-control']).toBe('no-store');
    const schemas = response.body.components.schemas;
    for (const name of [
      'DeviceConnectionConfig',
      'DeviceConnectionConfigData',
      'StructuredDeviceConnectionDevice',
      'IntegrationDeviceConfig',
    ]) {
      expect(schemas[name].properties.protocol.enum).toContain('SERIAL_ASCII');
    }
    for (const name of ['ModbusRtuSettings', 'ModbusTcpSettings']) {
      expect(schemas[name].properties.readFunction).toMatchObject({
        type: 'string',
        enum: ['READ_INPUT', 'READ_HOLDING'],
      });
      expect(schemas[name].properties.readFunction).not.toHaveProperty('default');
      expect(schemas[name].required ?? []).not.toContain('readFunction');
      expect(schemas[name].properties.readFunction.nullable ?? false).toBe(false);
    }
    expect(schemas.SerialConnectionSettings.properties).not.toHaveProperty('readFunction');
    const forms =
      schemas.DeviceConfigFormDetailResponse.properties.data.properties.connectionForms.items
        .properties;
    expect(forms.type.enum).toContain('Serial ASCII');
    expect(forms.values.properties.readFunction.enum).toEqual(['READ_INPUT', 'READ_HOLDING']);
    expect(forms.values.required ?? []).not.toContain('readFunction');
  });

  it('binds each protocol to its settings and publishes valid request examples', async () => {
    const response = await request(createApp()).get('/api/v1/openapi.json');
    const schemas = response.body.components.schemas;
    for (const name of ['DeviceConnectionConfig', 'StructuredDeviceConnectionDevice']) {
      const variants = schemas[name].allOf[0].oneOf;
      for (const [protocol, settingsSchema] of [
        ['SERIAL_ASCII', 'SerialConnectionSettings'],
        ['DCON_ASCII', 'SerialConnectionSettings'],
        ['MODBUS_RTU', 'ModbusRtuSettings'],
        ['MODBUS_TCP', 'ModbusTcpSettings'],
      ]) {
        const variant = variants.find((item: { properties: { protocol: { enum: string[] } } }) =>
          item.properties.protocol.enum.includes(protocol),
        );
        expect(variant.properties.settings.$ref).toBe(`#/components/schemas/${settingsSchema}`);
        expect(createDeviceConnectionConfigRequestSchema.parse(variant.example)).toMatchObject({
          protocol,
        });
      }
    }
    for (const path of [
      '/cems-wpms-requests/{id}/device-configs',
      '/connected-measurement-points/{stationId}/device-configs',
    ]) {
      const post = response.body.paths[path].post;
      expect(post.requestBody.content['application/json'].schema.$ref).toBe(
        '#/components/schemas/DeviceConnectionConfigRequest',
      );
      expect(post.responses).toHaveProperty('201');
      expect(post.responses).toHaveProperty('400');
      expect(post['x-poms-permissions']).toContain('cems_wpms_requests:edit');
    }
  });
});
