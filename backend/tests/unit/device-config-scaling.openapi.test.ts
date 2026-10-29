import request from 'supertest';
import { describe, expect, it } from '@jest/globals';
import { createApp } from '../../src/app';
import { createDeviceConnectionConfigRequestSchema } from '../../src/modules/device-connections/device-connections.validator';

describe('published device channel scaling contract', () => {
  it('exposes request/response fields, form strings and a valid TCP example at runtime', async () => {
    const response = await request(createApp()).get('/api/v1/openapi.json');
    expect(response.status).toBe(200);
    const schemas = response.body.components.schemas;
    for (const name of ['DeviceChannel', 'DeviceChannelResponse', 'DeviceConnectionChannel']) {
      expect(schemas[name].properties.valueFormat.example).toBe('16bit');
      for (const field of ['scaleMin', 'scaleMax', 'gain']) {
        expect(schemas[name].properties[field]).toMatchObject({ type: 'number', nullable: true });
        expect(schemas[name].required ?? []).not.toContain(field);
      }
    }
    expect(schemas.ModbusTcpSettings.properties.quantity).toMatchObject({
      type: 'number',
      nullable: true,
    });
    expect(schemas.ModbusTcpSettings.required ?? []).not.toContain('quantity');
    const form = schemas.DeviceConfigFormDetailResponse.properties.data.properties;
    for (const field of ['valueFormat', 'scaleMin', 'scaleMax', 'gain']) {
      expect(form.parameterMappings.items.properties[field].type).toBe('string');
    }
    expect(form.connectionForms.items.properties.values.properties.quantity.type).toBe('string');
    const tcp = schemas.DeviceConnectionConfig.allOf[0].oneOf.find(
      (variant: { properties: { protocol: { enum: string[] } } }) =>
        variant.properties.protocol.enum.includes('MODBUS_TCP'),
    );
    expect(tcp.example).toMatchObject({
      settings: { quantity: 4 },
      channels: [{ valueFormat: '16bit', scaleMin: -1.5, scaleMax: 100, gain: 0.25 }],
    });
    expect(createDeviceConnectionConfigRequestSchema.safeParse(tcp.example).success).toBe(true);
  });
});
