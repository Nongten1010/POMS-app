import {
  alertParameterActivationKey,
  parseRegisteredAlertParameter,
} from '../alert-emails/alert-parameter-activations';
import { fingerprint, type ExceedancePoint } from './exceedance-detector';

export interface ExceedancePointRow {
  id: number | string;
  point_code: string;
  point_name: string;
  system_type: 'CEMS' | 'WPMS';
  point_type: string;
  connected_at: Date | string;
  updated_at: Date | string;
  instruments_json: string | null;
  factory_id: string;
  factory_name: string;
  factory_registration_no: string | null;
}

export interface ExceedanceChannelRow {
  station_id: string;
  data_type: string;
  config_updated_at: Date | string;
}

export interface ExceedanceActivationRow {
  connected_point_id: number | string;
  parameter_code: string;
  unit: string;
  activated_at: Date | string;
}

export interface ExceedanceSnapshot extends ExceedancePoint {
  row: ExceedancePointRow;
}

/** Inputs contain no device credentials. A fingerprint is not historical threshold evidence. */
export function buildExceedanceSnapshot(
  row: ExceedancePointRow,
  channels: ExceedanceChannelRow[],
  activations: ExceedanceActivationRow[],
): ExceedanceSnapshot {
  const parsed: unknown = row.instruments_json ? JSON.parse(row.instruments_json) : null;
  const instruments =
    parsed &&
    typeof parsed === 'object' &&
    'parameters' in parsed &&
    Array.isArray(parsed.parameters)
      ? (parsed.parameters as unknown[])
      : [];
  if (instruments.length > 100) throw new Error('Too many registered parameters');
  const approved = new Map<string, number>();
  const activeChannels = channels.filter((channel) => channel.station_id === row.point_code);
  for (const channel of activeChannels) {
    const parameter = parseRegisteredAlertParameter(channel.data_type);
    if (parameter) approved.set(parameter.key, (approved.get(parameter.key) ?? 0) + 1);
  }
  const episodes = new Map<string, string>();
  for (const activation of activations) {
    if (Number(activation.connected_point_id) !== Number(row.id)) continue;
    const key = alertParameterActivationKey(activation.parameter_code, activation.unit);
    if (episodes.has(key)) throw new Error('Ambiguous parameter activation');
    const date = new Date(activation.activated_at);
    if (!Number.isFinite(date.getTime())) throw new Error('Invalid parameter activation');
    episodes.set(key, date.toISOString());
  }
  const seen = new Set<string>();
  const basis: Array<{
    key: string;
    standardCondition: unknown;
    dryBasis: unknown;
    oxygenOrExcessAir: unknown;
  }> = [];
  const parameters = instruments
    .flatMap((input) => {
      if (
        !input ||
        typeof input !== 'object' ||
        !('parameter' in input) ||
        typeof input.parameter !== 'string'
      )
        return [];
      const parameter = parseRegisteredAlertParameter(input.parameter);
      const activatedAt = parameter ? episodes.get(parameter.key) : undefined;
      if (!parameter || !approved.has(parameter.key) || !activatedAt) return [];
      if (approved.get(parameter.key) !== 1 || seen.has(parameter.key))
        throw new Error('Ambiguous registered parameter');
      seen.add(parameter.key);
      const fields = input as Record<string, unknown>;
      basis.push({
        key: parameter.key,
        standardCondition: fields.standardCondition ?? null,
        dryBasis: fields.dryBasis ?? null,
        oxygenOrExcessAir: fields.oxygenOrExcessAir ?? null,
      });
      const read = (field: 'standardCriteria' | 'eiaCriteria'): unknown => {
        const criteria: unknown = (input as Record<string, unknown>)[field];
        return criteria && typeof criteria === 'object' && 'standardValue' in criteria
          ? criteria.standardValue
          : null;
      };
      const enabled = (field: 'standardCriteria' | 'eiaCriteria'): boolean | undefined => {
        const criteria: unknown = fields[field];
        return criteria &&
          typeof criteria === 'object' &&
          'enabled' in criteria &&
          typeof criteria.enabled === 'boolean'
          ? criteria.enabled
          : undefined;
      };
      return [
        {
          label: parameter.label,
          activatedAt,
          standard: read('standardCriteria'),
          eia: read('eiaCriteria'),
          ...(enabled('standardCriteria') === undefined
            ? {}
            : { standardEnabled: enabled('standardCriteria') }),
          ...(enabled('eiaCriteria') === undefined ? {} : { eiaEnabled: enabled('eiaCriteria') }),
        },
      ];
    })
    .sort((a, b) => a.label.localeCompare(b.label));
  return {
    id: Number(row.id),
    stationId: row.point_code,
    systemType: row.system_type,
    row,
    parameters,
    // A factory name/address edit must not restart the measurement configuration epoch.
    fingerprint: fingerprint({
      scope: [row.system_type, row.point_code, row.point_type, row.connected_at, row.factory_id],
      channels: activeChannels,
      parameters,
      basis: basis.sort((a, b) => a.key.localeCompare(b.key)),
    }),
  };
}
