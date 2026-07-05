export interface RegionalAccessDTO {
  regions: string[];
}

const centralRegionTextValues: Record<string, string> = {
  'กวภ.': 'ภาคกลาง',
  กองวิจัยและเตือนภัยมลพิษโรงงาน: 'ภาคกลาง',
};

const regionalCenterRegionByAbbreviation: Record<string, string> = {
  'ศวภ.ตอ.': 'ภาคตะวันออก',
  'ศวภ.ตต.': 'ภาคตะวันตก',
  'ศวภ.ตอน.': 'ภาคตะวันออกเฉียงเหนือ',
  'ศวภ.น.': 'ภาคเหนือ',
  'ศวภ.ต.': 'ภาคใต้',
};

export function normalizeRegionalAccess(
  input:
    | Partial<RegionalAccessDTO>
    | { regionCodes?: string[]; regionNames?: string[] }
    | null
    | undefined,
): RegionalAccessDTO | null {
  const legacy = input as { regionCodes?: string[]; regionNames?: string[] } | null | undefined;
  const current = input as Partial<RegionalAccessDTO> | null | undefined;
  const regions = uniqueTrimmed([
    ...(current?.regions ?? []),
    ...(legacy?.regionNames ?? []),
    ...(legacy?.regionCodes ?? []),
  ]);
  return regions.length > 0 ? { regions } : null;
}

export function parseRegionalAccessJson(
  value: string | null | undefined,
): RegionalAccessDTO | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as Partial<RegionalAccessDTO>;
    return normalizeRegionalAccess(parsed);
  } catch {
    return null;
  }
}

export function serializeRegionalAccess(
  input: Partial<RegionalAccessDTO> | null | undefined,
): string | null {
  const normalized = normalizeRegionalAccess(input);
  return normalized ? JSON.stringify(normalized) : null;
}

export function inferRegionalAccessFromText(
  ...values: Array<string | null | undefined>
): RegionalAccessDTO | null {
  const regionalCenterRegionNames = values.flatMap((value) => {
    if (!value) return [];
    return Object.entries(regionalCenterRegionByAbbreviation)
      .filter(([abbreviation]) => value.includes(abbreviation))
      .map(([, regionName]) => regionName);
  });
  const regionalCenterAccess = normalizeRegionalAccess({ regions: regionalCenterRegionNames });
  if (regionalCenterAccess) return regionalCenterAccess;

  const centralRegionNames = values.flatMap((value) => {
    if (!value) return [];
    const trimmed = value.trim();
    return Object.entries(centralRegionTextValues)
      .filter(([text]) => trimmed.includes(text))
      .map(([, regionName]) => regionName);
  });
  return normalizeRegionalAccess({ regions: centralRegionNames });
}

function uniqueTrimmed(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const trimmed = value.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(trimmed);
  }
  return result;
}
