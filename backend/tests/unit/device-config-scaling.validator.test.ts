import { describe, expect, it } from '@jest/globals';
import { DEVICE_CONNECTION_PROTOCOL } from '../../src/modules/device-connections/device-connections.types';
import { createDeviceConnectionConfigSchema } from '../../src/modules/device-connections/device-connections.validator';

describe('device channel scaling validation', () => {
  it.each(Object.values(DEVICE_CONNECTION_PROTOCOL))('accepts scaling for %s', (protocol) => {
    const channel = {
      dataType: 'CO (ppm)',
      valueFormat: '16bit',
      scaleMin: -1.5,
      scaleMax: 100,
      gain: 0,
    };
    expect(
      createDeviceConnectionConfigSchema.parse({
        stationId: 'P0002',
        protocol,
        channels: [channel],
      }).channels[0],
    ).toMatchObject(channel);
  });

  for (const field of ['scaleMin', 'scaleMax', 'gain']) {
    it.each([NaN, Infinity, -Infinity, '', '1.5', true, {}, []])(
      `rejects nonnumeric/nonfinite ${field}: %p`,
      (value) => {
        expect(
          createDeviceConnectionConfigSchema.safeParse({
            stationId: 'P0002',
            protocol: 'MODBUS_TCP',
            channels: [{ dataType: 'CO (ppm)', [field]: value }],
          }).success,
        ).toBe(false);
      },
    );
  }

  it.each([NaN, Infinity, -Infinity])('rejects nonfinite TCP Quantity: %p', (quantity) => {
    expect(
      createDeviceConnectionConfigSchema.safeParse({
        stationId: 'P0002',
        protocol: 'MODBUS_TCP',
        settings: { quantity },
      }).success,
    ).toBe(false);
  });
});
