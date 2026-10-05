/** Stateless identity and transition rules; importing this module never opens a database. */
export interface RegisteredAlertParameter {
  parameterCode: string;
  name: string;
  unit: string;
  label: string;
  key: string;
}

export interface StoredAlertParameterActivation {
  id: number;
  parameterCode: string;
  unit: string;
  activatedAt: string;
}

export function normalizeAlertActivationStationIdentity(value: string): string {
  return value.normalize('NFKC').trim().toLowerCase();
}

export function alertParameterActivationKey(parameterCode: string, unit: string): string {
  return JSON.stringify([
    parameterCode.normalize('NFKC').trim().toLowerCase(),
    unit.normalize('NFKC').trim().toLowerCase(),
  ]);
}

export function parseRegisteredAlertParameter(value: string): RegisteredAlertParameter | null {
  const match = value.trim().match(/^(.*?)\s*\(([^()]*)\)\s*$/u);
  if (!match) return null;
  const name = match[1].trim();
  const unit = match[2].trim();
  const parameterCode = name
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^a-z0-9_-]/gu, '');
  if (!name || !unit || !parameterCode) return null;
  return {
    parameterCode,
    name,
    unit,
    label: `${name} (${unit})`,
    key: alertParameterActivationKey(parameterCode, unit),
  };
}

export function planAlertParameterActivations(
  existing: StoredAlertParameterActivation[],
  registered: RegisteredAlertParameter[],
  now: string,
  carry: StoredAlertParameterActivation[] = [],
): {
  activate: Array<{ parameterCode: string; unit: string; activatedAt: string }>;
  deactivateIds: number[];
} {
  const currentTime = Date.parse(now);
  if (!Number.isFinite(currentTime)) throw new Error('Invalid activation synchronization time');
  for (const activation of [...existing, ...carry]) {
    const time = Date.parse(activation.activatedAt);
    if (!Number.isFinite(time)) throw new Error('Invalid stored alert parameter activation');
  }
  const parameters = new Map(registered.map((parameter) => [parameter.key, parameter]));
  const active = new Map(
    existing.map((activation) => [
      alertParameterActivationKey(activation.parameterCode, activation.unit),
      activation,
    ]),
  );
  const carried = new Map(
    carry.map((activation) => [
      alertParameterActivationKey(activation.parameterCode, activation.unit),
      activation,
    ]),
  );
  return {
    activate: [...parameters].flatMap(([key, parameter]) =>
      active.has(key)
        ? []
        : [
            {
              parameterCode: parameter.parameterCode,
              unit: parameter.unit.normalize('NFKC').toLowerCase(),
              activatedAt: carried.get(key)?.activatedAt ?? now,
            },
          ],
    ),
    deactivateIds: existing
      .filter(
        (activation) =>
          !parameters.has(alertParameterActivationKey(activation.parameterCode, activation.unit)),
      )
      .map((activation) => activation.id),
  };
}
