import { env } from '../../config/env';
import { factorySourceDb, factorySourceTableName } from '../../config/factory-source-database';
import { AppError, BadRequestError } from '../../shared/errors/AppError';
import { diwProvinceCodeFromName } from './fac-import.mapper';
import {
  factoryAreaCodeMatches,
  hasNumericFactoryAddressAreas,
  normalizedFactoryAreaCode,
  numericFactoryAddressAreaCodes,
  replaceNumericFactoryAddressAreas,
  withoutNumericFactoryAddressAreas,
} from './factory-address';

export interface FactoryAreaNamesInput {
  address?: string | null;
  provinceCode?: string | null;
  provinceName?: string | null;
  districtCode?: string | null;
  districtName?: string | null;
  subdistrictCode?: string | null;
  subdistrictName?: string | null;
  sourceFactoryId?: string | null;
  factoryId?: string | null;
  factoryRegistrationNoNew?: string | null;
  factoryRegistrationNo?: string | null;
}

interface Area {
  PROV: string | number | null;
  AMP: string | number | null;
  TUMBOL: string | number | null;
  AMPNAME: string | null;
  TUMNAME: string | null;
}
interface Source extends Pick<Area, 'PROV' | 'AMP' | 'TUMBOL'> {
  FID: string | null;
  FACREG: string | null;
  DISPFACREG: string | null;
}
interface Context {
  province: string | null;
  districts: string[];
  subdistricts: string[];
  needsDistrict: boolean;
  needsSubdistrict: boolean;
  hasReadableDistrict: boolean;
  invalid: boolean;
}

const LOOKUP_TIMEOUT_MS = 15000;
const CHUNK_SIZE = 500;

/** Human-readable administrative fields only. Machine codes remain unchanged. */
export async function normalizeFactoryAreaNamesForWrite<T extends FactoryAreaNamesInput>(
  input: T,
): Promise<T> {
  if (!needsNames(input)) return input;
  const [result] = await normalize([input], true);
  return result;
}

/** Shared, batched read enrichment. Never writes a display fallback to storage. */
export async function normalizeFactoryAreaNamesForRead<T extends FactoryAreaNamesInput>(
  rows: T[],
): Promise<T[]> {
  return normalize(rows, false);
}

async function normalize<T extends FactoryAreaNamesInput>(
  rows: T[],
  strict: boolean,
): Promise<T[]> {
  const pending = rows.filter(needsNames);
  if (!pending.length) return rows;
  const contexts = new Map(pending.map((row) => [row, contextFor(row)]));
  try {
    const missing = pending.filter((row) => {
      const context = contexts.get(row);
      return context != null && needsSource(context);
    });
    const keys = [...new Set(missing.flatMap(identityKeys))];
    const sources: Source[] = [];
    for (let offset = 0; offset < keys.length; offset += CHUNK_SIZE) {
      const chunk = keys.slice(offset, offset + CHUNK_SIZE);
      sources.push(
        ...(await factorySourceDb<Source>(factorySourceTableName())
          .where((builder) =>
            builder.whereIn('FID', chunk).orWhereIn('DISPFACREG', chunk).orWhereIn('FACREG', chunk),
          )
          .timeout(LOOKUP_TIMEOUT_MS)
          .select('FID', 'FACREG', 'DISPFACREG', 'PROV', 'AMP', 'TUMBOL')),
      );
    }
    for (const row of missing) {
      const context = contexts.get(row);
      if (!context) continue;
      const source = sourceFor(row, sources);
      if (!source) continue;
      const province = normalizedFactoryAreaCode(source.PROV);
      if (context.province && context.province !== province) context.invalid = true;
      context.province ??= province;
      const district = normalizedFactoryAreaCode(source.AMP);
      const subdistrict = normalizedFactoryAreaCode(source.TUMBOL);
      if (district) context.districts.push(district);
      if (subdistrict) context.subdistricts.push(subdistrict);
    }
    const provinces = [
      ...new Set(
        [...contexts.values()].map((x) => x.province).filter((x): x is string => x != null),
      ),
    ];
    const areas: Area[] = provinces.length
      ? await factorySourceDb<Area>(`${env.FACTORY_DB_SCHEMA}.TUMBOL`)
          .whereIn('PROV', provinces)
          .timeout(LOOKUP_TIMEOUT_MS)
          .select('PROV', 'AMP', 'TUMBOL', 'AMPNAME', 'TUMNAME')
      : [];
    return rows.map((row) => {
      const context = contexts.get(row);
      if (!context) return row;
      const matches =
        context.invalid || needsSource(context)
          ? []
          : areas.filter((area) => matchesContext(row, context, area));
      const distinct = new Set(
        matches.map((area) =>
          JSON.stringify([
            context.needsDistrict ? area.AMPNAME?.trim() : null,
            context.needsSubdistrict ? area.TUMNAME?.trim() : null,
          ]),
        ),
      );
      const area = distinct.size === 1 ? matches[0] : undefined;
      const result = area ? applyNames(row, area) : null;
      if (result) return result;
      if (strict) throw unresolved(row);
      return suppressNames(row);
    });
  } catch (error) {
    if (error instanceof BadRequestError) throw error;
    if (strict)
      throw new AppError(
        'Administrative area lookup is temporarily unavailable',
        503,
        'FACTORY_AREA_LOOKUP_UNAVAILABLE',
      );
    return rows.map((row) => (needsNames(row) ? suppressNames(row) : row));
  }
}

function needsNames(row: FactoryAreaNamesInput): boolean {
  return (
    hasNumericFactoryAddressAreas(row.address) ||
    isNumericAreaName(row.districtName) ||
    isNumericAreaName(row.subdistrictName)
  );
}
function isNumericAreaName(value: string | null | undefined): boolean {
  return normalizedFactoryAreaCode(value) != null || hasNumericFactoryAddressAreas(value);
}
function numericName(value: string | null | undefined, subdistrict: boolean): string | null {
  const plain = normalizedFactoryAreaCode(value);
  if (plain != null) return plain;
  if (!value || withoutNumericFactoryAddressAreas(value).trim()) return null;
  const labels = numericFactoryAddressAreaCodes(value);
  const expected = subdistrict ? labels.subdistrict : labels.district;
  const opposite = subdistrict ? labels.district : labels.subdistrict;
  return expected.length === 1 && opposite.length === 0 ? expected[0] : null;
}
function contextFor(row: FactoryAreaNamesInput): Context {
  const labels = numericFactoryAddressAreaCodes(row.address);
  const districts = [...labels.district];
  const subdistricts = [...labels.subdistrict];
  const districtName = numericName(row.districtName, false);
  const subdistrictName = numericName(row.subdistrictName, true);
  const needsDistrict = labels.district.length > 0 || isNumericAreaName(row.districtName);
  const needsSubdistrict = labels.subdistrict.length > 0 || isNumericAreaName(row.subdistrictName);
  const provinceCandidates: string[] = [];
  const hasReadableDistrict =
    Boolean(row.districtName?.trim() && !isNumericAreaName(row.districtName)) ||
    readableAddressAreaNames(row.address).district.length > 0;
  let invalid =
    (isNumericAreaName(row.districtName) && districtName == null) ||
    (isNumericAreaName(row.subdistrictName) && subdistrictName == null);
  const addProvinceName = (name: string | null | undefined) => {
    if (!name?.trim()) return;
    const code = diwProvinceCodeFromName(name.trim().replace(/^จังหวัด\s*/u, ''));
    if (code) provinceCandidates.push(code);
    else invalid = true;
  };
  addProvinceName(row.provinceName);
  const inAddress = /จังหวัด\s*([ก-ฮะ-์]+)/u.exec(row.address ?? '')?.[1];
  if (inAddress) addProvinceName(inAddress);
  else if (row.address?.includes('กรุงเทพมหานคร')) provinceCandidates.push('10');
  const provinceCode = normalizedFactoryAreaCode(row.provinceCode);
  // Existing POMS snapshots also expose internal province IDs (e.g. Rayong 1021).
  // Only a two-digit code is DIW context; preserve every machine code as supplied.
  if (provinceCode?.length === 2) provinceCandidates.push(provinceCode);
  for (const [value, list] of [
    [row.districtCode, districts],
    [row.subdistrictCode, subdistricts],
  ] as const) {
    if (!value?.trim()) continue;
    const code = normalizedFactoryAreaCode(value);
    if (code) list.push(code);
    else invalid = true;
  }
  if (districtName) districts.push(districtName);
  if (subdistrictName) subdistricts.push(subdistrictName);
  for (const code of districts) if (code.length === 4) provinceCandidates.push(code.slice(0, 2));
  for (const code of subdistricts)
    if (code.length === 6) {
      provinceCandidates.push(code.slice(0, 2));
      districts.push(code.slice(0, 4));
    }
  const provinces = [...new Set(provinceCandidates)];
  if (provinces.length > 1) invalid = true;
  return {
    province: provinces[0] ?? null,
    districts,
    subdistricts,
    needsDistrict,
    needsSubdistrict,
    hasReadableDistrict,
    invalid,
  };
}
function needsSource(context: Context): boolean {
  return (
    !context.province ||
    ((context.needsDistrict || context.needsSubdistrict) &&
      !context.districts.length &&
      !context.hasReadableDistrict) ||
    (context.needsSubdistrict && !context.subdistricts.length)
  );
}
function identityKeys(row: FactoryAreaNamesInput): string[] {
  return [
    row.sourceFactoryId,
    row.factoryId,
    row.factoryRegistrationNoNew,
    row.factoryRegistrationNo,
  ]
    .filter((x): x is string => Boolean(x?.trim()))
    .map((x) => x.trim());
}
function sourceFor(row: FactoryAreaNamesInput, sources: Source[]): Source | undefined {
  const sourceIds = [row.sourceFactoryId, row.factoryId].filter((key): key is string =>
    Boolean(key?.trim()),
  );
  const registrations = [
    row.factoryRegistrationNoNew,
    row.factoryRegistrationNo,
    ...(sources.some((source) => source.FID?.trim() === row.factoryId?.trim())
      ? []
      : [row.factoryId]),
  ].filter((key): key is string => Boolean(key?.trim()));
  const searches: Array<{ key: string; fields: Array<'FID' | 'DISPFACREG' | 'FACREG'> }> = [
    ...sourceIds.map((key) => ({ key, fields: ['FID'] as Array<'FID'> })),
    ...registrations.map((key) => ({
      key,
      fields: ['DISPFACREG', 'FACREG', 'FID'] as Array<'FID' | 'DISPFACREG' | 'FACREG'>,
    })),
  ];
  const candidates: Source[] = [];
  for (const { key, fields } of searches) {
    for (const field of fields) {
      const matches = sources.filter((source) => source[field]?.trim() === key.trim());
      if (!matches.length) continue;
      candidates.push(...matches);
      break;
    }
  }
  const identities = new Set(candidates.map((source) => source.FID?.trim()));
  const locations = new Set(
    candidates.map(
      (source) =>
        `${normalizedFactoryAreaCode(source.PROV)}:${normalizedFactoryAreaCode(source.AMP)}:${normalizedFactoryAreaCode(source.TUMBOL)}`,
    ),
  );
  return identities.size === 1 && locations.size === 1 ? candidates[0] : undefined;
}
function matchesContext(row: FactoryAreaNamesInput, context: Context, area: Area): boolean {
  if (normalizedFactoryAreaCode(area.PROV) !== context.province) return false;
  if (!context.districts.every((code) => factoryAreaCodeMatches(code, area, false))) return false;
  if (!context.subdistricts.every((code) => factoryAreaCodeMatches(code, area, true))) return false;
  if (context.needsDistrict && !validName(area.AMPNAME)) return false;
  if (context.needsSubdistrict && !validName(area.TUMNAME)) return false;
  const embeddedNames = readableAddressAreaNames(row.address);
  if (!embeddedNames.district.every((name) => name === area.AMPNAME?.trim())) return false;
  if (!embeddedNames.subdistrict.every((name) => name === area.TUMNAME?.trim())) return false;
  if (
    row.districtName?.trim() &&
    !isNumericAreaName(row.districtName) &&
    row.districtName.trim() !== area.AMPNAME?.trim()
  )
    return false;
  if (
    row.subdistrictName?.trim() &&
    !isNumericAreaName(row.subdistrictName) &&
    row.subdistrictName.trim() !== area.TUMNAME?.trim()
  )
    return false;
  return true;
}
function validName(value: string | null): boolean {
  return Boolean(value && /[ก-ฮ]/u.test(value) && !hasNumericFactoryAddressAreas(value));
}

function readableAddressAreaNames(address: string | null | undefined): {
  district: string[];
  subdistrict: string[];
} {
  const names: { district: string[]; subdistrict: string[] } = { district: [], subdistrict: [] };
  const pattern =
    /(ตำบล|อำเภอ|แขวง|เขต|(?<![ก-์a-zA-Z])ต\.|(?<![ก-์a-zA-Z])อ\.)\s*([ก-ฮะ-์]+?)(?=\s|$|จังหวัด|กรุงเทพมหานคร|ตำบล|อำเภอ|แขวง|เขต|ต\.|อ\.)/gu;
  for (const match of String(address ?? '').matchAll(pattern)) {
    names[['ตำบล', 'แขวง', 'ต.'].includes(match[1]) ? 'subdistrict' : 'district'].push(match[2]);
  }
  return names;
}
function applyNames<T extends FactoryAreaNamesInput>(row: T, area: Area): T | null {
  const result = { ...row };
  if (hasNumericFactoryAddressAreas(row.address) && row.address) {
    const address = replaceNumericFactoryAddressAreas(
      row.address,
      { districtName: area.AMPNAME, subdistrictName: area.TUMNAME },
      area,
    );
    if (address == null) return null;
    result.address = address;
  }
  if (isNumericAreaName(row.districtName)) result.districtName = area.AMPNAME?.trim() ?? null;
  if (isNumericAreaName(row.subdistrictName)) result.subdistrictName = area.TUMNAME?.trim() ?? null;
  return result;
}
function suppressNames<T extends FactoryAreaNamesInput>(row: T): T {
  const result = { ...row };
  if (row.address && hasNumericFactoryAddressAreas(row.address))
    result.address = withoutNumericFactoryAddressAreas(row.address);
  if (isNumericAreaName(row.districtName)) result.districtName = null;
  if (isNumericAreaName(row.subdistrictName)) result.subdistrictName = null;
  return result;
}
function unresolved(row: FactoryAreaNamesInput): BadRequestError {
  const path = hasNumericFactoryAddressAreas(row.address)
    ? 'address'
    : isNumericAreaName(row.districtName)
      ? 'districtName'
      : 'subdistrictName';
  return new BadRequestError('Administrative area codes cannot be resolved to verified names', {
    path,
    reason: 'UNRESOLVED_ADMINISTRATIVE_AREA',
  });
}
