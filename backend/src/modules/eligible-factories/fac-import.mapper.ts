import type { EligibleFactoryCandidateDTO } from './eligible-factories.types';

export interface FacImportRow {
  FACREG: string | null;
  FACREQ: string | null;
  FFLAG: string | number | null;
  EXPSEQ: string | null;
  FNAME: string | null;
  FADDR: string | null;
  FMOO: string | null;
  SOI: string | null;
  ROAD: string | null;
  PROV: string | number | null;
  CANAL: string | null;
  RIVER: string | null;
  OBJECT: string | null;
  HP: string | number | null;
  HP2: string | number | null;
  OLDREG: string | null;
  SUBCLASS?: string | null;
  CAPLAND: string | number | null;
  CAPBUILD: string | number | null;
  CAPMACH: string | number | null;
  CAPWORK: string | number | null;
  COLONY_INDUST_CODE: string | null;
  STARTDATE: Date | string | null;
  DISPFACREG: string | null;
  LONGITUDE_X: string | number | null;
  LATITUDE_Y: string | number | null;
  CAPPROD: string | number | null;
  TOTAL_CAP: string | number | null;
  CAPREGIS: string | number | null;
  FID: string | null;
  FACTYPE: string | null;
  CLASS: string | null;
}

const PROVINCE_BY_DIW_CODE: Record<string, string> = {
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

const ACTIVE_FACTORY_FLAG = '1';
const TEMPORARY_STOPPED_FACTORY_FLAG = '3';

export function toEligibleFactoryCandidate(row: FacImportRow): EligibleFactoryCandidateDTO {
  const sourceFactoryId = firstText(row.FID, row.FACREG, row.DISPFACREG) ?? '';
  const registrationNoNew =
    firstText(row.DISPFACREG, row.FACREG, sourceFactoryId) ?? sourceFactoryId;
  const factoryName = firstText(row.FNAME) ?? 'ไม่ระบุชื่อโรงงาน';
  const provinceCode = normalizeNumberCode(row.PROV);
  const provinceName = provinceCode
    ? (PROVINCE_BY_DIW_CODE[provinceCode] ?? `รหัสจังหวัด ${provinceCode}`)
    : 'ไม่ระบุจังหวัด';
  const horsepower = firstNumber(row.HP2, row.HP);
  const capitalAmount =
    firstNumber(row.CAPREGIS) ?? sumNumbers(row.CAPLAND, row.CAPBUILD, row.CAPMACH, row.CAPWORK);
  const productionCapacity = firstNumber(row.CAPPROD, row.TOTAL_CAP);
  const coordinates = toFactoryCoordinates(row);

  return {
    factoryName,
    factoryId: sourceFactoryId,
    factoryRegistrationNo: registrationNoNew,
    factoryClass: firstText(row.CLASS),
    factorySubclass: firstText(row.SUBCLASS, row.FACTYPE, row.FACREQ, row.EXPSEQ),
    address: joinAddress(row),
    provinceName,
    industrialEstateName: firstText(row.COLONY_INDUST_CODE),
    longitude: coordinates?.longitude ?? null,
    latitude: coordinates?.latitude ?? null,
    businessActivity: firstText(row.OBJECT),
    operationStatus: operationStatusFromFlag(row.FFLAG),
    capitalAmount,
    machineryHorsepower: horsepower,
    productionCapacity: productionCapacity === null ? null : `${productionCapacity}`,
    wastewaterDischargeInfo: wastewaterDischargeInfo(row),
    boilerCount: null,
    boilerSizeEach: null,
    fuelUsed: null,
    hasEia: null,
  };
}

export function diwProvinceCodeFromName(provinceName: string): string | null {
  const found = Object.entries(PROVINCE_BY_DIW_CODE).find(([, name]) => name === provinceName);
  return found?.[0] ?? null;
}

export function diwFactoryFlagFromOperationStatus(operationStatus: string): string | null {
  if (operationStatus === 'แจ้งประกอบแล้ว') return ACTIVE_FACTORY_FLAG;
  if (operationStatus === 'หยุดชั่วคราว') return TEMPORARY_STOPPED_FACTORY_FLAG;
  return null;
}

function operationStatusFromFlag(value: string | number | null): string {
  const flag = normalizeNumberCode(value);
  if (flag === ACTIVE_FACTORY_FLAG) return 'แจ้งประกอบแล้ว';
  if (flag === TEMPORARY_STOPPED_FACTORY_FLAG) return 'หยุดชั่วคราว';
  if (!flag) return 'ไม่ระบุสถานะ';
  return `สถานะ ${flag}`;
}

function joinAddress(row: FacImportRow): string | null {
  const parts = [
    firstText(row.FADDR),
    firstText(row.FMOO) ? `หมู่ ${firstText(row.FMOO)}` : null,
    firstText(row.SOI) ? `ซอย${firstText(row.SOI)}` : null,
    firstText(row.ROAD) ? `ถนน${firstText(row.ROAD)}` : null,
  ].filter((part): part is string => part !== null);

  return parts.length > 0 ? parts.join(' ') : null;
}

function wastewaterDischargeInfo(row: FacImportRow): string | null {
  const canal = firstText(row.CANAL);
  const river = firstText(row.RIVER);
  if (!canal && !river) return null;
  return [canal ? `คลอง: ${canal}` : null, river ? `แม่น้ำ: ${river}` : null]
    .filter((part): part is string => part !== null)
    .join(', ');
}

function toFactoryCoordinates(row: FacImportRow): { latitude: number; longitude: number } | null {
  return (
    toLatLongCoordinates(row.LATITUDE_Y, row.LONGITUDE_X) ??
    toLatLongCoordinates(row.LONGITUDE_X, row.LATITUDE_Y)
  );
}

function toLatLongCoordinates(
  latitudeValue: string | number | null,
  longitudeValue: string | number | null,
): { latitude: number; longitude: number } | null {
  const latitude = firstNumber(latitudeValue);
  const longitude = firstNumber(longitudeValue);
  if (latitude === null || longitude === null) return null;
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;
  return { latitude, longitude };
}

function firstText(...values: Array<string | number | null | undefined>): string | null {
  for (const value of values) {
    if (value === null || value === undefined) continue;
    const text = String(value).trim();
    if (text.length > 0 && text.toLowerCase() !== 'null' && text !== '-') return text;
  }
  return null;
}

function firstNumber(...values: Array<string | number | null | undefined>): number | null {
  for (const value of values) {
    if (value === null || value === undefined) continue;
    const numeric = Number(value);
    if (Number.isFinite(numeric)) return numeric;
  }
  return null;
}

function sumNumbers(...values: Array<string | number | null | undefined>): number | null {
  const total = values.reduce<number>((sum, value) => {
    const numeric = firstNumber(value);
    return numeric === null ? sum : sum + numeric;
  }, 0);
  return total > 0 ? total : null;
}

function normalizeNumberCode(value: string | number | null): string | null {
  const numeric = firstNumber(value);
  if (numeric === null) return firstText(value);
  return String(Math.trunc(numeric));
}
