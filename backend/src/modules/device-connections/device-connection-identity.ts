import type { CreateDeviceConnectionConfigInput } from './device-connections.types';

/** A named device may change transport; unnamed legacy devices remain protocol-specific. */
export function deviceConnectionIdentity(
  config: Pick<CreateDeviceConnectionConfigInput, 'stationId' | 'deviceCode' | 'protocol'>,
): string {
  return JSON.stringify([
    config.stationId,
    config.deviceCode ?? null,
    config.deviceCode ? null : config.protocol,
  ]);
}
