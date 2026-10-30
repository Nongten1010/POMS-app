const STANDALONE_EXPLICIT_PROVINCE_PATTERN = /(?:^|\s+)จังหวัด\s*[ก-๙]+(?=\s|$)/u;
const NUMERIC_AREA_PATTERN = /(?:ตำบล|อำเภอ)\s*\d+(?=\s|$)/u;

export function hasNumericFactoryAddressAreas(address: string | null | undefined): boolean {
  return Boolean(address && NUMERIC_AREA_PATTERN.test(address));
}

/** Replace only legacy labels, never rebuild a reviewed street address from Fac60k. */
export function replaceNumericFactoryAddressAreas(
  address: string,
  names: { subdistrictName: string | null; districtName: string | null },
  codes: { TUMBOL: string | number | null; AMP: string | number | null },
): string | null {
  let unresolved = false;
  const resolved = address.replace(/(ตำบล|อำเภอ)\s*(\d+)(?=\s|$)/gu, (label, area, code) => {
    const name = area === 'ตำบล' ? names.subdistrictName : names.districtName;
    const sourceCode = area === 'ตำบล' ? codes.TUMBOL : codes.AMP;
    if (
      !name ||
      !/[ก-๙]/u.test(name) ||
      sourceCode == null ||
      Number(code) !== Number(sourceCode)
    ) {
      unresolved = true;
      return label;
    }
    return `${area}${name.trim()}`;
  });
  return unresolved ? null : resolved;
}

/** Display fallback only; unresolved codes must never be persisted as place names. */
export function withoutNumericFactoryAddressAreas(address: string): string {
  return address.replace(/(?:ตำบล|อำเภอ)\s*\d+(?:\s+|$)/gu, '').trim();
}

interface FactoryAddressPlacementOptions {
  postalCode?: string | number | null;
}

export function withProvinceInFactoryAddress(
  address: string | null | undefined,
  provinceName: string | null | undefined,
  options: FactoryAddressPlacementOptions = {},
): string | null | undefined {
  const normalizedAddress = address?.trim();
  const normalizedProvince = provinceName?.trim();
  if (!normalizedAddress || !normalizedProvince || !isUsableProvinceName(normalizedProvince)) {
    return address;
  }

  const addressWithoutTargetProvince = stripTargetProvince(normalizedAddress, normalizedProvince);

  // Preserve a conflicting explicit province for manual review instead of creating two provinces.
  if (hasConflictingExplicitProvince(addressWithoutTargetProvince, normalizedProvince)) {
    return normalizedAddress;
  }

  const provincePart =
    normalizedProvince === 'กรุงเทพมหานคร' ? normalizedProvince : `จังหวัด${normalizedProvince}`;
  return (
    insertAfterLastDistrict(addressWithoutTargetProvince, provincePart, options.postalCode) ??
    insertBeforePostalCode(addressWithoutTargetProvince, provincePart, options.postalCode) ??
    `${addressWithoutTargetProvince} ${provincePart}`
  );
}

function stripTargetProvince(address: string, provinceName: string): string {
  const escapedProvince = escapeRegExp(provinceName);
  const prefixedPattern =
    provinceName === 'กรุงเทพมหานคร'
      ? new RegExp(`(^|\\s+)${escapedProvince}(?:\\s+|$)`, 'gu')
      : new RegExp(`(^|\\s+)จังหวัด\\s*${escapedProvince}(?:\\s+|$)`, 'gu');
  const withoutPrefixedProvince = address.replace(prefixedPattern, '$1');
  if (provinceName === 'กรุงเทพมหานคร') return withoutPrefixedProvince.trim();

  const bareBeforePostalPattern = new RegExp(
    `(^|\\s+)${escapedProvince}\\s+(?=\\d{5}(?:\\s|$))`,
    'gu',
  );
  return withoutPrefixedProvince.replace(bareBeforePostalPattern, '$1').trim();
}

function hasConflictingExplicitProvince(address: string, provinceName: string): boolean {
  if (STANDALONE_EXPLICIT_PROVINCE_PATTERN.test(address)) return true;
  if (provinceName !== 'กรุงเทพมหานคร') {
    return /(?:^|\s+)กรุงเทพมหานคร(?=\s|$)/u.test(address);
  }
  return false;
}

function insertAfterLastDistrict(
  address: string,
  provincePart: string,
  postalCode: string | number | null | undefined,
): string | null {
  const districtIndex = Math.max(address.lastIndexOf('อำเภอ'), address.lastIndexOf('เขต'));
  if (districtIndex < 0) return null;

  const postal = lastPostalCodeMatch(address, postalCode);
  if (postal?.index !== undefined && postal.index > districtIndex) {
    return insertAtPostalMatch(address, provincePart, postal.index);
  }
  return `${address} ${provincePart}`;
}

function insertBeforePostalCode(
  address: string,
  provincePart: string,
  postalCode: string | number | null | undefined,
): string | null {
  const postal = lastPostalCodeMatch(address, postalCode);
  if (postal?.index === undefined) return null;
  return insertAtPostalMatch(address, provincePart, postal.index);
}

function lastPostalCodeMatch(
  address: string,
  postalCode: string | number | null | undefined,
): RegExpMatchArray | undefined {
  const normalizedPostalCode = String(postalCode ?? '').trim();
  const postalPattern = /^\d{5}$/u.test(normalizedPostalCode)
    ? new RegExp(`(^|\\s+)${escapeRegExp(normalizedPostalCode)}(?=\\s|$)`, 'gu')
    : /(^|\s+)\d{5}(?=\s|$)/gu;
  return [...address.matchAll(postalPattern)].at(-1);
}

function insertAtPostalMatch(address: string, provincePart: string, postalIndex: number): string {
  return `${address.slice(0, postalIndex)} ${provincePart}${address.slice(postalIndex)}`.trim();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}

function isUsableProvinceName(value: string): boolean {
  return value !== '-' && value !== 'ไม่ระบุจังหวัด' && !value.startsWith('รหัสจังหวัด ');
}
