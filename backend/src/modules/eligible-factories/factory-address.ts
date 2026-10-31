const STANDALONE_EXPLICIT_PROVINCE_PATTERN = /(?:^|\s+)จังหวัด\s*[ก-๙]+(?=\s|$)/u;
const NUMERIC_AREA_PATTERN_SOURCE =
  '(ตำบล|อำเภอ|แขวง|เขต|(?<![ก-์a-zA-Z])ต\\.|(?<![ก-์a-zA-Z])อ\\.)\\s*[:.\\-]?\\s*([0-9๐-๙]+)(?=\\s|$|[,;()]|ตำบล|อำเภอ|แขวง|เขต|จังหวัด|กรุงเทพมหานคร|ต\\.|อ\\.)';

export function normalizedFactoryAreaCode(
  value: string | number | null | undefined,
): string | null {
  const text = String(value ?? '')
    .trim()
    .replace(/[๐-๙]/gu, (digit) => String(digit.charCodeAt(0) - 0x0e50));
  return /^\d+$/u.test(text) ? String(Number(text)) : null;
}

export function numericFactoryAddressAreaCodes(address: string | null | undefined): {
  district: string[];
  subdistrict: string[];
} {
  const result: { district: string[]; subdistrict: string[] } = { district: [], subdistrict: [] };
  for (const match of String(address ?? '').matchAll(
    new RegExp(NUMERIC_AREA_PATTERN_SOURCE, 'gu'),
  )) {
    const code = normalizedFactoryAreaCode(match[2]);
    if (code != null) result[isSubdistrictLabel(match[1]) ? 'subdistrict' : 'district'].push(code);
  }
  return result;
}

export function hasNumericFactoryAddressAreas(address: string | null | undefined): boolean {
  return Boolean(address && new RegExp(NUMERIC_AREA_PATTERN_SOURCE, 'u').test(address));
}

/** Replace only numeric area labels, never rebuild a reviewed street address from Fac60k. */
export function replaceNumericFactoryAddressAreas(
  address: string,
  names: { subdistrictName: string | null; districtName: string | null },
  codes: {
    PROV?: string | number | null;
    TUMBOL: string | number | null;
    AMP: string | number | null;
  },
): string | null {
  let unresolved = false;
  const resolved = address.replace(
    new RegExp(NUMERIC_AREA_PATTERN_SOURCE, 'gu'),
    (label, area: string, code: string) => {
      const subdistrict = isSubdistrictLabel(area);
      const name = subdistrict ? names.subdistrictName : names.districtName;
      if (
        !name ||
        !/[ก-ฮ]/u.test(name) ||
        hasNumericFactoryAddressAreas(name) ||
        !factoryAreaCodeMatches(code, codes, subdistrict)
      ) {
        unresolved = true;
        return label;
      }
      return `${area}${name.trim()}`;
    },
  );
  return unresolved ? null : resolved;
}

export function factoryAreaCodeMatches(
  value: string | number | null | undefined,
  codes: {
    PROV?: string | number | null;
    AMP: string | number | null;
    TUMBOL: string | number | null;
  },
  subdistrict: boolean,
): boolean {
  const code = normalizedFactoryAreaCode(value);
  const local = normalizedFactoryAreaCode(subdistrict ? codes.TUMBOL : codes.AMP);
  if (code == null || local == null) return false;
  if (code === local) return true;
  const province = normalizedFactoryAreaCode(codes.PROV);
  const district = normalizedFactoryAreaCode(codes.AMP);
  if (!province || !district) return false;
  const full = subdistrict
    ? `${province.padStart(2, '0')}${district.padStart(2, '0')}${local.padStart(2, '0')}`
    : `${province.padStart(2, '0')}${local.padStart(2, '0')}`;
  return code === full;
}

function isSubdistrictLabel(label: string): boolean {
  return label === 'ตำบล' || label === 'แขวง' || label === 'ต.';
}

/** Display fallback only; unresolved codes must never be persisted as place names. */
export function withoutNumericFactoryAddressAreas(address: string): string {
  return address.replace(new RegExp(`${NUMERIC_AREA_PATTERN_SOURCE}\\s*`, 'gu'), '').trim();
}

/** Readable geography labels only; estate/street descriptions are not district names. */
export function readableFactoryAddressAreaNames(
  address: string | null | undefined,
  provinceName?: string | null,
): { district: string[]; subdistrict: string[] } {
  const text = address ?? '';
  const province =
    provinceName?.trim().replace(/^จังหวัด\s*/u, '') ||
    /(?:จังหวัด|(?<![ก-์a-zA-Z])จ\.)\s*([ก-ฮะ-์]+)/u.exec(text)?.[1];
  const outsideBangkok = Boolean(province && province !== 'กรุงเทพมหานคร');
  const district: string[] = [];
  const subdistrict: string[] = [];
  const cityDistrict: string[] = [];
  const citySubdistrict: string[] = [];
  const pattern =
    /(ตำบล|อำเภอ|(?<![ก-์a-zA-Z])แขวง|(?<![ก-์a-zA-Z])เขต|(?<![ก-์a-zA-Z])ต\.|(?<![ก-์a-zA-Z])อ\.)\s*([ก-ฮะ-์]+?)(?=\s|$|[,;()]|จังหวัด|กรุงเทพมหานคร|ตำบล|อำเภอ|ต\.|อ\.)/gu;
  for (const match of text.matchAll(pattern)) {
    if (match[1] === 'แขวง') {
      if (!outsideBangkok) citySubdistrict.push(match[2]);
    } else if (match[1] === 'เขต') {
      if (!outsideBangkok) cityDistrict.push(match[2]);
    } else if (match[1] === 'ตำบล' || match[1] === 'ต.') subdistrict.push(match[2]);
    else district.push(match[2]);
  }
  return {
    district: district.length ? district : cityDistrict,
    subdistrict: subdistrict.length ? subdistrict : citySubdistrict,
  };
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
