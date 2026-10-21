import { describe, expect, it } from '@jest/globals';
import {
  createDeviceConnectionConfigRequestSchema,
  createDeviceConnectionConfigSchema,
} from '../../src/modules/device-connections/device-connections.validator';

const repeatedChannels = [
  { dataType: 'CO (ppm)', addressId: 3 },
  { dataType: 'CO (ppm)', addressId: null },
  { dataType: 'CO (ppm)', addressId: null },
];

describe('device config duplicate parameter validation', () => {
  it.each(['POMS_BOX', 'MODBUS_RTU', 'DCON_ASCII', 'MODBUS_TCP', 'MSSQL', 'MYSQL'])(
    'rejects repeated parameter rows for %s even when duplicate addresses are blank',
    (protocol) => {
      const result = createDeviceConnectionConfigSchema.safeParse({
        stationId: 'S2014',
        deviceCode: 'S2014/01',
        protocol,
        channels: repeatedChannels,
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues).toEqual([
          expect.objectContaining({ code: 'custom', path: ['channels', 1, 'dataType'] }),
          expect.objectContaining({ code: 'custom', path: ['channels', 2, 'dataType'] }),
        ]);
      }
    },
  );

  it('compares labels after legacy unit normalization, ignoring case and outer whitespace', () => {
    const result = createDeviceConnectionConfigSchema.safeParse({
      stationId: 'S2014',
      protocol: 'MSSQL',
      channels: [
        { dataType: 'CO', unit: ' ppm ', addressId: 3 },
        { dataType: ' co (PPM) ', addressId: 4 },
      ],
    });

    expect(result.success).toBe(false);
  });

  it.each([
    { dataType: ' CO ', unit: 'ppm' },
    { dataType: 'ＣＯ', unit: 'ｐｐｍ' },
    { dataType: 'ＣＯ  ', unit: ' ｐｐｍ ' },
  ])('rejects canonical duplicates after joining separate unit fields (%j)', (channel) => {
    const result = createDeviceConnectionConfigSchema.safeParse({
      stationId: 'S2014',
      protocol: 'MSSQL',
      channels: [
        { ...channel, addressId: 3 },
        { dataType: 'CO (ppm)', addressId: 4 },
      ],
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues).toEqual([
        expect.objectContaining({ code: 'custom', path: ['channels', 1, 'dataType'] }),
      ]);
    }
  });

  it('keeps different units distinct after canonicalizing legacy unit fields', () => {
    const result = createDeviceConnectionConfigSchema.parse({
      stationId: 'S2014',
      protocol: 'MSSQL',
      channels: [
        { dataType: ' ＣＯ  ', unit: 'ｐｐｍ', addressId: 3 },
        { dataType: 'CO', unit: '%', addressId: 4 },
      ],
    });

    expect(result.channels).toEqual([
      expect.objectContaining({ dataType: ' ＣＯ   (ｐｐｍ)', addressId: 3 }),
      expect.objectContaining({ dataType: 'CO (%)', addressId: 4 }),
    ]);
  });

  it('rejects duplicate parameters in batch and structured form payloads', () => {
    const batch = createDeviceConnectionConfigRequestSchema.safeParse({
      configs: [
        {
          stationId: 'S2014',
          deviceCode: 'S2014/01',
          protocol: 'MSSQL',
          channels: repeatedChannels,
        },
      ],
    });
    const structured = createDeviceConnectionConfigRequestSchema.safeParse({
      config: {
        stationId: 'S2014',
        device: [{ deviceCode: 'S2014/01', protocol: 'MSSQL' }],
        channels: repeatedChannels.map((channel) => ({
          ...channel,
          deviceCode: 'S2014/01',
        })),
      },
    });

    expect(batch.success).toBe(false);
    expect(structured.success).toBe(false);
  });

  it('keeps distinct units and parameters valid even with shared or null addresses', () => {
    const result = createDeviceConnectionConfigSchema.parse({
      stationId: 'S2014',
      protocol: 'MSSQL',
      channels: [
        { dataType: 'CO', unit: 'ppm', addressId: 3 },
        { dataType: 'CO', unit: '%', addressId: 3 },
        { dataType: 'NOx (ppm)', addressId: null, offset: null },
      ],
    });

    expect(result.channels.map(({ dataType, addressId }) => ({ dataType, addressId }))).toEqual([
      { dataType: 'CO (ppm)', addressId: 3 },
      { dataType: 'CO (%)', addressId: 3 },
      { dataType: 'NOx (ppm)', addressId: null },
    ]);
    expect(result.channels[2].offset).toBeNull();
  });

  it('allows the same parameter on distinct devices in a structured form', () => {
    const result = createDeviceConnectionConfigRequestSchema.parse({
      config: {
        stationId: 'S2014',
        device: [
          { deviceCode: 'S2014/01', protocol: 'MSSQL' },
          { deviceCode: 'S2014/02', protocol: 'MSSQL' },
        ],
        channels: [
          { deviceCode: 'S2014/01', dataType: 'CO (ppm)', addressId: 3 },
          { deviceCode: 'S2014/02', dataType: 'CO (ppm)', addressId: 4 },
        ],
      },
    });

    expect(result).toMatchObject({
      configs: [
        { deviceCode: 'S2014/01', channels: [{ dataType: 'CO (ppm)', addressId: 3 }] },
        { deviceCode: 'S2014/02', channels: [{ dataType: 'CO (ppm)', addressId: 4 }] },
      ],
    });
  });
});
