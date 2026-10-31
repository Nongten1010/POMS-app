// Frozen resolver for migration 0154. Do not import mutable runtime normalization logic.
export const PROVINCE_NAMES_0154: Readonly<Record<string, string>> = {
  '10': 'กรุงเทพมหานคร',
  '11': 'สมุทรปราการ',
  '12': 'นนทบุรี',
  '13': 'ปทุมธานี',
  '14': 'พระนครศรีอยุธยา',
  '15': 'อ่างทอง',
  '16': 'ลพบุรี',
  '17': 'สิงห์บุรี',
  '18': 'ชัยนาท',
  '19': 'สระบุรี',
  '20': 'ชลบุรี',
  '21': 'ระยอง',
  '22': 'จันทบุรี',
  '23': 'ตราด',
  '24': 'ฉะเชิงเทรา',
  '25': 'ปราจีนบุรี',
  '26': 'นครนายก',
  '27': 'สระแก้ว',
  '30': 'นครราชสีมา',
  '31': 'บุรีรัมย์',
  '32': 'สุรินทร์',
  '33': 'ศรีสะเกษ',
  '34': 'อุบลราชธานี',
  '35': 'ยโสธร',
  '36': 'ชัยภูมิ',
  '37': 'อำนาจเจริญ',
  '38': 'บึงกาฬ',
  '39': 'หนองบัวลำภู',
  '40': 'ขอนแก่น',
  '41': 'อุดรธานี',
  '42': 'เลย',
  '43': 'หนองคาย',
  '44': 'มหาสารคาม',
  '45': 'ร้อยเอ็ด',
  '46': 'กาฬสินธุ์',
  '47': 'สกลนคร',
  '48': 'นครพนม',
  '49': 'มุกดาหาร',
  '50': 'เชียงใหม่',
  '51': 'ลำพูน',
  '52': 'ลำปาง',
  '53': 'อุตรดิตถ์',
  '54': 'แพร่',
  '55': 'น่าน',
  '56': 'พะเยา',
  '57': 'เชียงราย',
  '58': 'แม่ฮ่องสอน',
  '60': 'นครสวรรค์',
  '61': 'อุทัยธานี',
  '62': 'กำแพงเพชร',
  '63': 'ตาก',
  '64': 'สุโขทัย',
  '65': 'พิษณุโลก',
  '66': 'พิจิตร',
  '67': 'เพชรบูรณ์',
  '70': 'ราชบุรี',
  '71': 'กาญจนบุรี',
  '72': 'สุพรรณบุรี',
  '73': 'นครปฐม',
  '74': 'สมุทรสาคร',
  '75': 'สมุทรสงคราม',
  '76': 'เพชรบุรี',
  '77': 'ประจวบคีรีขันธ์',
  '80': 'นครศรีธรรมราช',
  '81': 'กระบี่',
  '82': 'พังงา',
  '83': 'ภูเก็ต',
  '84': 'สุราษฎร์ธานี',
  '85': 'ระนอง',
  '86': 'ชุมพร',
  '90': 'สงขลา',
  '91': 'สตูล',
  '92': 'ตรัง',
  '93': 'พัทลุง',
  '94': 'ปัตตานี',
  '95': 'ยะลา',
  '96': 'นราธิวาส',
};

export const AREA_NAME_FIELDS_0154 = [
  'province_name',
  'district_name',
  'subdistrict_name',
] as const;
export type AreaNameField0154 = (typeof AREA_NAME_FIELDS_0154)[number];
export interface AreaMaster0154 {
  PROV: string | number | null;
  AMP: string | number | null;
  TUMBOL: string | number | null;
  AMPNAME: string | null;
  TUMNAME: string | null;
}
export interface AreaRepairEvidence0154 {
  patch: Partial<Record<AreaNameField0154, string>>;
  addressEvidenceAllowed: boolean;
  addressEvidence: string | null;
  labels: { province: string[]; district: string[]; subdistrict: string[] };
  provinceCodes: string[];
  conflicts: string[];
  candidateCount: number;
  matchingMasterKeys: string[];
  distinctNames: Record<AreaNameField0154, string[]>;
}

export function isBlankAreaName0154(value: unknown): boolean {
  return value == null || String(value).trim() === '';
}

function areaCode(value: unknown): string | null {
  const text = String(value ?? '')
    .trim()
    .replace(/[๐-๙]/gu, (digit) => String(digit.charCodeAt(0) - 0x0e50));
  return /^\d+$/u.test(text) ? String(Number(text)) : null;
}

function plainName(value: unknown): string {
  return String(value ?? '')
    .trim()
    .replace(/^(?:จังหวัด|อำเภอ|ตำบล|แขวง|เขต|จ\.|อ\.|ต\.)\s*/u, '');
}

function usableName(value: unknown): boolean {
  return (
    !isBlankAreaName0154(value) &&
    /[ก-ฮ]/u.test(String(value)) &&
    !/^(?:-|ไม่ระบุ|รหัสจังหวัด)/u.test(String(value).trim())
  );
}

const PROVINCE_CODES_BY_NAME = new Map(
  Object.entries(PROVINCE_NAMES_0154).map(([code, name]) => [name, code]),
);

export function localProvinceCodes0154(
  rows: Array<{ id: string | number; name_th: string }>,
): Map<string, string> {
  const result = new Map<string, string>();
  for (const row of rows) {
    const code = PROVINCE_CODES_BY_NAME.get(plainName(row.name_th));
    if (code) result.set(String(row.id), code);
  }
  return result;
}

function extractLabels(address: string | null, bangkok: boolean): AreaRepairEvidence0154['labels'] {
  const text = address ?? '';
  const result: AreaRepairEvidence0154['labels'] = { province: [], district: [], subdistrict: [] };
  const boundary = '(?<![ก-๙a-zA-Z])';
  const districtLabels =
    text.includes('อำเภอ') || new RegExp(`${boundary}อ\\.`, 'u').test(text)
      ? 'อำเภอ|' + boundary + 'อ\\.'
      : bangkok
        ? 'เขต|' + boundary + 'อ\\.'
        : boundary + 'อ\\.';
  const subdistrictLabels =
    text.includes('ตำบล') || new RegExp(`${boundary}ต\\.`, 'u').test(text)
      ? 'ตำบล|' + boundary + 'ต\\.'
      : bangkok
        ? 'แขวง|' + boundary + 'ต\\.'
        : boundary + 'ต\\.';
  // เขต inside คลองนครเนื่องเขต or a non-Bangkok industrial/street name is not an administrative label.
  const stops = 'จังหวัด|อำเภอ|ตำบล' + (bangkok ? '|แขวง|เขต' : '');
  const capture = (labels: string) =>
    [
      ...text.matchAll(new RegExp(`(?:${labels})\\s*([ก-๙0-9]+?)(?=\\s|$|[,;()]|${stops})`, 'gu')),
    ].map((match) => match[1]);
  result.province = capture('จังหวัด|' + boundary + 'จ\\.').map((name) =>
    name.replace(/(?<=[ก-ฮ])[0-9๐-๙]{5}$/u, ''),
  );
  if (text.includes('กรุงเทพมหานคร')) result.province.push('กรุงเทพมหานคร');
  result.district = capture(districtLabels);
  result.subdistrict = capture(subdistrictLabels);
  return result;
}

function codeMatches(value: unknown, area: AreaMaster0154, subdistrict: boolean): boolean {
  const input = areaCode(value);
  const local = areaCode(subdistrict ? area.TUMBOL : area.AMP);
  if (input == null || local == null) return false;
  if (input === local) return true;
  const province = areaCode(area.PROV),
    district = areaCode(area.AMP);
  if (!province || !district) return false;
  return (
    input ===
    (subdistrict
      ? `${province.padStart(2, '0')}${district.padStart(2, '0')}${local.padStart(2, '0')}`
      : `${province.padStart(2, '0')}${local.padStart(2, '0')}`)
  );
}

/** Uses recorded context only. Deleted snapshots never borrow their parent's current address. */
export function resolveMissingFactoryAreaNames0154(
  row: Record<string, unknown>,
  fields: readonly AreaNameField0154[],
  areas: readonly AreaMaster0154[],
  localProvinces: ReadonlyMap<string, string>,
): AreaRepairEvidence0154 {
  const snapshot = row.table === 'cems_wpms_request_factory_snapshots';
  const addressEvidenceAllowed = !snapshot || row.deleted_at_exact == null;
  const rawAddress =
    row.address ?? row.factory_address ?? (addressEvidenceAllowed ? row.request_address : null);
  const addressEvidence = rawAddress == null ? null : String(rawAddress);
  const provinceCodes: string[] = [];
  const conflicts: string[] = [];
  const addProvinceName = (value: unknown, conflict: string) => {
    if (!usableName(value)) return;
    const code = PROVINCE_CODES_BY_NAME.get(plainName(value));
    if (code) provinceCodes.push(code);
    else conflicts.push(conflict);
  };
  addProvinceName(row.province_name, 'UNKNOWN_RECORDED_PROVINCE_NAME');
  const provinceOnlyLabels = extractLabels(addressEvidence, false).province;
  for (const name of provinceOnlyLabels) addProvinceName(name, 'UNKNOWN_ADDRESS_PROVINCE_NAME');
  const rawProvince = areaCode(row.province_code);
  if (rawProvince && PROVINCE_NAMES_0154[rawProvince]) provinceCodes.push(rawProvince);
  const localProvince = rawProvince ? localProvinces.get(rawProvince) : undefined;
  if (localProvince) provinceCodes.push(localProvince);
  const bangkok =
    provinceCodes.includes('10') || (addressEvidence?.includes('กรุงเทพมหานคร') ?? false);
  const labels = extractLabels(addressEvidence, bangkok);
  const districts: unknown[] = [row.district_code, ...labels.district].filter(
    (value) => !isBlankAreaName0154(value),
  );
  const subdistricts: unknown[] = [row.subdistrict_code, ...labels.subdistrict].filter(
    (value) => !isBlankAreaName0154(value),
  );
  if (!isBlankAreaName0154(row.district_name)) districts.push(row.district_name);
  if (!isBlankAreaName0154(row.subdistrict_name)) subdistricts.push(row.subdistrict_name);
  for (const district of districts) {
    const code = areaCode(district);
    if (code?.length === 4) provinceCodes.push(code.slice(0, 2));
  }
  for (const subdistrict of subdistricts) {
    const code = areaCode(subdistrict);
    if (code?.length === 6) provinceCodes.push(code.slice(0, 2));
  }
  const provinces = [...new Set(provinceCodes)];
  if (provinces.length > 1) conflicts.push('PROVINCE_CONTEXT_CONFLICT');
  const hasContext = provinces.length > 0 || districts.length > 0 || subdistricts.length > 0;
  const candidates =
    !conflicts.length && hasContext
      ? areas.filter(
          (area) =>
            (!provinces.length || areaCode(area.PROV) === provinces[0]) &&
            districts.every((value) =>
              areaCode(value) != null
                ? codeMatches(value, area, false)
                : plainName(value) === area.AMPNAME?.trim(),
            ) &&
            subdistricts.every((value) =>
              areaCode(value) != null
                ? codeMatches(value, area, true)
                : plainName(value) === area.TUMNAME?.trim(),
            ),
        )
      : [];
  if (hasContext && !candidates.length && !conflicts.length) conflicts.push('NO_MASTER_MATCH');
  const distinctNames: AreaRepairEvidence0154['distinctNames'] = {
    province_name: [],
    district_name: [],
    subdistrict_name: [],
  };
  const patch: AreaRepairEvidence0154['patch'] = {};
  for (const field of AREA_NAME_FIELDS_0154) {
    const values = candidates.map((area) =>
      field === 'province_name'
        ? PROVINCE_NAMES_0154[areaCode(area.PROV) ?? '']
        : field === 'district_name'
          ? area.AMPNAME
          : area.TUMNAME,
    );
    distinctNames[field] = [
      ...new Set(values.filter(usableName).map((value) => String(value).trim())),
    ];
    const hasAreaEvidence = districts.length > 0 || subdistricts.length > 0;
    const sufficient = field === 'province_name' || hasAreaEvidence;
    if (
      fields.includes(field) &&
      isBlankAreaName0154(row[field]) &&
      sufficient &&
      values.length > 0 &&
      values.every(usableName) &&
      distinctNames[field].length === 1
    ) {
      patch[field] = distinctNames[field][0];
    }
  }
  return {
    patch,
    addressEvidenceAllowed,
    addressEvidence,
    labels,
    provinceCodes: provinces,
    conflicts,
    candidateCount: candidates.length,
    matchingMasterKeys: [
      ...new Set(
        candidates.map(
          (area) => `${areaCode(area.PROV)}:${areaCode(area.AMP)}:${areaCode(area.TUMBOL)}`,
        ),
      ),
    ],
    distinctNames,
  };
}
