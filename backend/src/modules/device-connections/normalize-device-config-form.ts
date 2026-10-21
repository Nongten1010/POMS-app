import { parameterKey } from '../poms-factories/poms-measurement-point-parameters';
import { deviceConnectionIdentity } from './device-connection-identity';
import type {
  DeviceConnectionConfigDTO,
  DeviceMeasurementChannelInput,
} from './device-connections.types';

/** Recover old form snapshots without changing stored data or combining separate devices. */
export function normalizeDeviceConfigsForForm(
  configs: DeviceConnectionConfigDTO[],
): DeviceConnectionConfigDTO[] {
  const latest = new Map<string, DeviceConnectionConfigDTO>();
  for (const config of configs) {
    const key = JSON.stringify([config.requestId, deviceConnectionIdentity(config)]);
    const previous = latest.get(key);
    if (!previous || isNewer(config, previous)) latest.set(key, config);
  }

  return [...latest.values()].map((config) => ({
    ...config,
    channels: uniqueChannels(config.channels),
  }));
}

function isNewer(
  candidate: DeviceConnectionConfigDTO,
  previous: DeviceConnectionConfigDTO,
): boolean {
  const candidateTime = Date.parse(candidate.updatedAt) || 0;
  const previousTime = Date.parse(previous.updatedAt) || 0;
  return (
    candidateTime > previousTime || (candidateTime === previousTime && candidate.id > previous.id)
  );
}

function uniqueChannels(
  channels: DeviceMeasurementChannelInput[],
): DeviceMeasurementChannelInput[] {
  const selected = new Map<string, DeviceMeasurementChannelInput>();
  for (const channel of channels) {
    const key = parameterKey(channel.dataType);
    const previous = selected.get(key);
    // Preserve a whole stored row. Equal-quality conflicts keep the first row (DB id ascending).
    if (!previous || preferChannel(channel, previous)) selected.set(key, channel);
  }
  return [...selected.values()];
}

function preferChannel(
  candidate: DeviceMeasurementChannelInput,
  previous: DeviceMeasurementChannelInput,
): boolean {
  if ((candidate.addressId != null) !== (previous.addressId != null)) {
    return candidate.addressId != null;
  }
  return populatedFields(candidate) > populatedFields(previous);
}

function populatedFields(channel: DeviceMeasurementChannelInput): number {
  return [
    channel.valueRange?.min,
    channel.valueRange?.max,
    channel.alertLow,
    channel.alertHigh,
    channel.valueFormat,
    channel.offset,
    channel.encoding,
    channel.status,
    channel.testMode === true ? true : null,
  ].filter((value) => value != null && (typeof value !== 'string' || value.trim() !== '')).length;
}
