import type { EligibleFactoryCandidateDTO } from './eligible-factories.types';

const MOCK_FACTORY_COUNT = 60_000;

const PROVINCES = [
  { name: 'สมุทรปราการ', abbr: 'สป', lat: 13.5432181, lon: 100.6329124 },
  { name: 'พระนครศรีอยุธยา', abbr: 'อย', lat: 14.3234412, lon: 100.6412271 },
  { name: 'ชลบุรี', abbr: 'ชบ', lat: 13.4067824, lon: 101.0314567 },
  { name: 'นครปฐม', abbr: 'นฐ', lat: 13.8197211, lon: 100.0611923 },
  { name: 'ระยอง', abbr: 'รย', lat: 12.6819444, lon: 101.1538888 },
  { name: 'ลำพูน', abbr: 'ลพ', lat: 18.5799821, lon: 99.0162742 },
  { name: 'ปทุมธานี', abbr: 'ปท', lat: 14.0208391, lon: 100.5250276 },
  { name: 'ฉะเชิงเทรา', abbr: 'ฉช', lat: 13.6904194, lon: 101.0779596 },
  { name: 'ปราจีนบุรี', abbr: 'ปจ', lat: 14.0509704, lon: 101.3727439 },
  { name: 'สระบุรี', abbr: 'สบ', lat: 14.5289154, lon: 100.9101421 },
];

const INDUSTRIAL_ESTATES = [
  'นิคมอุตสาหกรรมบางปู',
  'นิคมอุตสาหกรรมโรจนะ',
  'นิคมอุตสาหกรรมอมตะซิตี้ ชลบุรี',
  null,
  'นิคมอุตสาหกรรมมาบตาพุด',
  'นิคมอุตสาหกรรมภาคเหนือ',
  'นิคมอุตสาหกรรมนวนคร',
  'นิคมอุตสาหกรรมเวลโกรว์',
  'นิคมอุตสาหกรรม 304',
  'นิคมอุตสาหกรรมแก่งคอย',
];

const BUSINESS_ACTIVITIES = [
  'หลอมและรีไซเคิลโลหะ',
  'ผลิตสารเคมีสำหรับอุตสาหกรรม',
  'แปรรูปอาหารทะเลแช่แข็ง',
  'ผลิตบรรจุภัณฑ์พลาสติก',
  'ผลิตไอน้ำและพลังงานความร้อน',
  'ประกอบชิ้นส่วนอิเล็กทรอนิกส์',
  'ฟอกย้อมและตกแต่งสิ่งทอ',
  'ผลิตอาหารสัตว์',
  'ผลิตชิ้นส่วนยานยนต์',
  'ผลิตเยื่อและกระดาษ',
];

const COMPANY_PREFIXES = ['บริษัท', 'ห้างหุ้นส่วนจำกัด'];
const COMPANY_NAMES = [
  'สมุทรรีไซเคิล',
  'เจ้าพระยาเคมีคอล',
  'อีสเทิร์นฟู้ดโปรเซสซิ่ง',
  'นครพลาสติก',
  'ระยองพาวเวอร์บอยเลอร์',
  'ลำพูนอิเล็กทรอนิกส์',
  'ไทยวอเตอร์ทรีตเมนต์',
  'กรีนแมททีเรียล',
  'เอเซียออโต้พาร์ท',
  'ยูไนเต็ดเท็กซ์ไทล์',
];

const OPERATION_STATUSES = [
  'แจ้งประกอบแล้ว',
  'หยุดประกอบกิจการชั่วคราว',
  'เลิกประกอบกิจการ',
];

const FUELS = ['ก๊าซธรรมชาติ', 'น้ำมันเตา', 'ชีวมวล', 'ไฟฟ้า', 'ถ่านหิน'];

export const MOCK_ELIGIBLE_FACTORY_CANDIDATE_COUNT = MOCK_FACTORY_COUNT;

export const MOCK_ELIGIBLE_FACTORY_CANDIDATES: EligibleFactoryCandidateDTO[] = Array.from(
  { length: MOCK_FACTORY_COUNT },
  (_, index) => buildMockFactory(index + 1),
);

function buildMockFactory(sequence: number): EligibleFactoryCandidateDTO {
  const province = PROVINCES[(sequence - 1) % PROVINCES.length]!;
  const businessActivity = BUSINESS_ACTIVITIES[(sequence - 1) % BUSINESS_ACTIVITIES.length]!;
  const companyPrefix = COMPANY_PREFIXES[sequence % COMPANY_PREFIXES.length]!;
  const companyName = COMPANY_NAMES[(sequence - 1) % COMPANY_NAMES.length]!;
  const operationStatus = OPERATION_STATUSES[sequence % OPERATION_STATUSES.length]!;
  const hasBoiler = sequence % 4 !== 0;
  const boilerCount = hasBoiler ? (sequence % 5) + 1 : 0;
  const hasWastewaterDischarge = sequence % 3 !== 0;
  const hasEia = sequence % 5 === 0 || sequence % 7 === 0;
  const year = 50 + (sequence % 17);
  const category = String((sequence % 120) + 1).padStart(3, '0');
  const group = String((sequence % 99) + 1).padStart(2, '0');
  const running = String(sequence).padStart(5, '0');

  return {
    sourceSystem: 'mock_external_factory_db',
    sourceFactoryId: `mock-factory-${String(sequence).padStart(6, '0')}`,
    factoryName: `${companyPrefix} ${companyName} ${running} จำกัด`,
    factoryRegistrationNoNew: `3-${category}-${group}/${year}${province.abbr}`,
    factoryRegistrationNoOld: `รง.4-${running}`,
    factoryTypeSequence: sequence % 3 === 0 ? 'รอง' : 'หลัก',
    address: `${(sequence % 299) + 1}/${sequence % 30} หมู่ ${(sequence % 12) + 1}`,
    provinceName: province.name,
    industrialEstateName: INDUSTRIAL_ESTATES[(sequence - 1) % INDUSTRIAL_ESTATES.length],
    coordinates: {
      latitude: roundCoordinate(province.lat + ((sequence % 100) - 50) / 10_000),
      longitude: roundCoordinate(province.lon + ((sequence % 100) - 50) / 10_000),
    },
    businessActivity,
    operationStatus,
    capitalAmount: 1_000_000 + sequence * 1_250,
    machineryHorsepower: 50 + (sequence % 1_500),
    productionCapacity: `${10 + (sequence % 250)} ตัน/วัน`,
    wastewaterDischargeInfo: hasWastewaterDischarge
      ? 'มีการระบายน้ำทิ้งออกนอกโรงงาน'
      : 'ไม่มีการระบายน้ำทิ้งจากกระบวนการผลิต',
    boilerCount,
    boilerSizeEach: boilerCount > 0 ? `${5 + (sequence % 25)} ตัน/ชั่วโมง` : null,
    fuelUsed: FUELS[sequence % FUELS.length]!,
    hasEia,
  };
}

function roundCoordinate(value: number): number {
  return Number(value.toFixed(7));
}
