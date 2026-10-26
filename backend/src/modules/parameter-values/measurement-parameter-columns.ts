/** Name/unit identity is independent from the physical SQL column prefix. */
export interface MeasurementParameterIdentity {
  label: string;
  nameKey: string;
  unitKey: string | null;
  dimensionless: boolean;
}

export interface MeasurementParameterFamily {
  prefix: string;
  valueColumn: string | null;
  statusColumn: string | null;
  unitsColumn: string | null;
  unitSpecific: boolean;
  hasCompetingUnitFamilies: boolean;
}

export function normalizedMeasurementName(value: string): string {
  const key = value
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
  return key === 'flowrate' ? 'flow' : key;
}

export function normalizedMeasurementUnit(value: string): string {
  return value.normalize('NFKC').toLowerCase().replace(/\s+/gu, '');
}

export function parseMeasurementParameter(label: string): MeasurementParameterIdentity {
  const match = label.trim().match(/^(.*?)\s*\(([^()]*)\)\s*$/u);
  const nameKey = normalizedMeasurementName(match ? match[1] : label);
  const unitKey = match ? normalizedMeasurementUnit(match[2]) : null;
  return {
    label,
    nameKey,
    unitKey,
    dimensionless: nameKey === 'ph' && (unitKey === null || unitKey === '' || unitKey === 'ph'),
  };
}

export function measurementParameterUnitMatches(
  parameter: MeasurementParameterIdentity,
  sourceUnit: unknown,
): boolean {
  if (sourceUnit !== null && sourceUnit !== undefined && typeof sourceUnit !== 'string')
    return false;
  const actual = typeof sourceUnit === 'string' ? normalizedMeasurementUnit(sourceUnit) : '';
  if (parameter.dimensionless) return actual === '' || actual === 'ph';
  return parameter.unitKey !== null && parameter.unitKey !== '' && actual === parameter.unitKey;
}

export function sameMeasurementParameter(left: string, right: string): boolean {
  const a = parseMeasurementParameter(left);
  const b = parseMeasurementParameter(right);
  return (
    a.nameKey === b.nameKey && ((a.dimensionless && b.dimensionless) || a.unitKey === b.unitKey)
  );
}

function unitColumnTokens(unit: string | null): string[] {
  if (unit === null || unit === '') return [];
  if (unit === '%') return ['percent', 'pct'];
  return [unit.replace(/[µμ]/g, 'u').replace(/[^a-z0-9]/g, '')].filter(Boolean);
}

/** Returns whole physical families, ordered unit-specific before generic. */
export function resolveMeasurementParameterFamilies(
  columnNames: string[],
  label: string,
): MeasurementParameterFamily[] {
  const parameter = parseMeasurementParameter(label);
  if (!parameter.nameKey) return [];
  const baseTokens = parameter.nameKey === 'flow' ? ['flow', 'flowrate'] : [parameter.nameKey];
  const requestedUnitTokens = parameter.dimensionless
    ? ['ph']
    : unitColumnTokens(parameter.unitKey);
  const families = new Map<
    string,
    Omit<MeasurementParameterFamily, 'unitSpecific' | 'hasCompetingUnitFamilies'>
  >();
  for (const column of columnNames) {
    const match = column.match(/^(.*)_(value|status|units)$/i);
    if (!match) continue;
    const key = match[1].toLowerCase();
    const family = families.get(key) ?? {
      prefix: match[1],
      valueColumn: null,
      statusColumn: null,
      unitsColumn: null,
    };
    const field = `${match[2].toLowerCase()}Column` as
      | 'valueColumn'
      | 'statusColumn'
      | 'unitsColumn';
    if (family[field] !== null && family[field] !== column)
      throw new Error('Duplicate parameter column');
    family[field] = column;
    families.set(key, family);
  }
  const compact = (prefix: string) =>
    prefix
      .normalize('NFKC')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '');
  const familyUnitToken = (prefix: string): string | null => {
    const normalized = prefix.normalize('NFKC').toLowerCase();
    if (baseTokens.includes(compact(prefix))) return null;
    let best: { unit: string; nameLength: number } | null = null;
    for (
      let index = normalized.indexOf('_');
      index >= 0;
      index = normalized.indexOf('_', index + 1)
    ) {
      const name = compact(normalized.slice(0, index));
      if (baseTokens.includes(name)) {
        const unit = compact(normalized.slice(index + 1));
        if (unit && (!best || name.length > best.nameLength))
          best = { unit, nameLength: name.length };
      }
    }
    if (best) return best.unit;
    // These compact identifiers are documented legacy aliases. Arbitrary
    // concatenation cannot prove ownership: cod_* is not CO measured in days.
    const legacy = parameter.nameKey === 'co2' ? /^co2(ppm|percent|pct)$/.exec(normalized) : null;
    return legacy ? legacy[1] : null;
  };
  const hasCompetingUnitFamilies = [...families.values()].some((family) => {
    const unit = familyUnitToken(family.prefix);
    return unit !== null && !requestedUnitTokens.includes(unit);
  });
  const matches = [...families.values()].flatMap((family) => {
    const token = compact(family.prefix);
    const generic = baseTokens.includes(token);
    const specificUnit = familyUnitToken(family.prefix);
    const unitSpecific = specificUnit !== null && requestedUnitTokens.includes(specificUnit);
    return generic || unitSpecific ? [{ ...family, unitSpecific, hasCompetingUnitFamilies }] : [];
  });
  // Normalizing punctuation must not silently combine two different identifiers.
  const seen = new Set<string>();
  for (const family of matches) {
    const key = compact(family.prefix);
    if (seen.has(key)) throw new Error('Ambiguous parameter column families');
    seen.add(key);
  }
  return matches.sort(
    (a, b) => Number(b.unitSpecific) - Number(a.unitSpecific) || a.prefix.localeCompare(b.prefix),
  );
}
