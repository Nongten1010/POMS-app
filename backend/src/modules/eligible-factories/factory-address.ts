const POSTAL_CODE_PATTERN = /\s+(\d{5})(?=\s|$)/u;
const EXPLICIT_PROVINCE_PATTERN = /จังหวัด\s*[^\s]+/u;

export function withProvinceInFactoryAddress(
  address: string | null | undefined,
  provinceName: string | null | undefined,
): string | null | undefined {
  const normalizedAddress = address?.trim();
  const normalizedProvince = provinceName?.trim();
  if (!normalizedAddress || !normalizedProvince || !isUsableProvinceName(normalizedProvince)) {
    return address;
  }

  const compactAddress = normalizedAddress.replace(/\s+/gu, '');
  if (hasTargetProvince(normalizedAddress, normalizedProvince)) return normalizedAddress;

  // Preserve a conflicting explicit province for manual review instead of creating two provinces.
  if (
    EXPLICIT_PROVINCE_PATTERN.test(normalizedAddress) ||
    compactAddress.includes('กรุงเทพมหานคร')
  ) {
    return normalizedAddress;
  }

  const provincePart =
    normalizedProvince === 'กรุงเทพมหานคร' ? normalizedProvince : `จังหวัด${normalizedProvince}`;
  if (POSTAL_CODE_PATTERN.test(normalizedAddress)) {
    return normalizedAddress.replace(POSTAL_CODE_PATTERN, ` ${provincePart} $1`);
  }
  return `${normalizedAddress} ${provincePart}`;
}

function hasTargetProvince(address: string, provinceName: string): boolean {
  if (provinceName === 'กรุงเทพมหานคร') {
    return address.replace(/\s+/gu, '').includes('กรุงเทพมหานคร');
  }
  const escapedProvince = escapeRegExp(provinceName);
  return (
    new RegExp(`จังหวัด\\s*${escapedProvince}(?=\\s|$)`, 'u').test(address) ||
    new RegExp(`\\s${escapedProvince}\\s+\\d{5}(?=\\s|$)`, 'u').test(address)
  );
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}

function isUsableProvinceName(value: string): boolean {
  return value !== '-' && value !== 'ไม่ระบุจังหวัด' && !value.startsWith('รหัสจังหวัด ');
}
