/**
 * Mock fixtures สำหรับ demo phase
 *
 * ใช้ตอน IDENTITY_PROVIDER=mock — สลับเป็น external (กรอ. API จริง) ภายหลัง
 * Data ที่สมจริง: ดึงจาก sample txt files ที่ user แนบมา
 *   - เจ้าหน้าที่: "วีกิจ ชมญาติ" (per_cardno=1102001567054)
 *   - ผู้ประกอบการ: "ธนาภรณ์ ศรีอวบ" (citizen_id=3191000135709) + 2 บริษัท + 7 โรงงาน
 */

export interface MockOfficer {
  username: string;
  password: string;
  external_id: string; // per_cardno
  email: string | null;
  phone: string | null;
  prename_th: string;
  first_name: string;
  last_name: string;
  profile: {
    pos_no: string;
    pertype_id: string;
    pertype: string;
    position_type_id: string;
    position_type_th: string;
    line_id: string;
    line_name_th: string;
    level_id: string;
    level_name_th: string;
    organize_id: string;
    division_id: string;
    department_id: string;
    ministry_id: string;
    province_id: string;
    per_status: string;
    per_status_name: string;
  };
  roles: string[]; // role codes
}

export interface MockOperator {
  username: string;
  citizen_id: string;
  password: string;
  email: string | null;
  phone: string | null;
  first_name: string;
  last_name: string;
  user_code: string;
  regis_date: string;
  juristics: Array<{
    juristic_id: string;
    name_th: string;
    name_en: string;
    factories: Array<{
      fid: string;
      code: string;
      name: string;
      province_id: string;
      system_id: number;
      verify_status: number;
      authorize_start: string | null;
      authorize_end: string | null;
      juristic_start: string | null;
      verify_date: string | null;
    }>;
  }>;
  roles: string[];
}

export const MOCK_OFFICERS: MockOfficer[] = [
  {
    username: 'weekit',
    password: 'demo1234',
    external_id: '1102001567054',
    email: 'weekit@diw.go.th',
    phone: null,
    prename_th: 'นาย',
    first_name: 'วีกิจ',
    last_name: 'ชมญาติ',
    profile: {
      pos_no: '539',
      pertype_id: '5',
      pertype: 'ข้าราชการพลเรือนสามัญ',
      position_type_id: '2',
      position_type_th: 'วิชาการ',
      line_id: '20',
      line_name_th: 'นักวิชาการคอมพิวเตอร์',
      level_id: '17',
      level_name_th: 'ชำนาญการ',
      organize_id: '3010073',
      division_id: '3010071',
      department_id: '3010000',
      ministry_id: '22',
      province_id: '1000',
      per_status: '1',
      per_status_name: 'ปกติ',
    },
    roles: ['admin'],
  },
  {
    username: 'officer_kpm',
    password: 'demo1234',
    external_id: '1100000000001',
    email: 'kpm@diw.go.th',
    phone: null,
    prename_th: 'นาง',
    first_name: 'สมหญิง',
    last_name: 'รักษ์สิ่งแวดล้อม',
    profile: {
      pos_no: '601',
      pertype_id: '5',
      pertype: 'ข้าราชการพลเรือนสามัญ',
      position_type_id: '2',
      position_type_th: 'วิชาการ',
      line_id: '21',
      line_name_th: 'นักวิทยาศาสตร์',
      level_id: '17',
      level_name_th: 'ชำนาญการ',
      organize_id: '3010080',
      division_id: '3010080',
      department_id: '3010000',
      ministry_id: '22',
      province_id: '1000',
      per_status: '1',
      per_status_name: 'ปกติ',
    },
    roles: ['monitoring_kpm'],
  },
  {
    username: 'officer_sng',
    password: 'demo1234',
    external_id: '1100000000002',
    email: 'sng@diw.go.th',
    phone: null,
    prename_th: 'นาย',
    first_name: 'ธีระ',
    last_name: 'จังหวัดงาน',
    profile: {
      pos_no: '702',
      pertype_id: '5',
      pertype: 'ข้าราชการพลเรือนสามัญ',
      position_type_id: '2',
      position_type_th: 'วิชาการ',
      line_id: '20',
      line_name_th: 'นักวิชาการอุตสาหกรรม',
      level_id: '17',
      level_name_th: 'ชำนาญการ',
      organize_id: '4019000',
      division_id: '4019000',
      department_id: '4019000',
      ministry_id: '22',
      province_id: '1019',
      per_status: '1',
      per_status_name: 'ปกติ',
    },
    roles: ['provincial_office'],
  },
];

export const MOCK_OPERATORS: MockOperator[] = [
  {
    username: 'operator_demo',
    citizen_id: '3191000135709',
    password: 'demo1234',
    email: 'tanaporn.sriaub@siamcitycement.com',
    phone: '0999454594',
    first_name: 'ธนาภรณ์',
    last_name: 'ศรีอวบ',
    user_code: '53495',
    regis_date: '2023-06-09 12:01:53',
    juristics: [
      {
        juristic_id: '0105556125804',
        name_th: 'บริษัท อินทรี อีโคไซเคิล จำกัด',
        name_en: 'INSEE ECOCYCLE COMPANY LIMITED',
        factories: [
          {
            fid: '10190003325500',
            code: '3-106-33/50สบ',
            name: 'บริษัท อินทรี อีโคไซเคิล จำกัด',
            province_id: '1019',
            system_id: 12,
            verify_status: 1,
            authorize_start: '2024-09-02',
            authorize_end: '2024-09-30',
            juristic_start: '2024-08-05',
            verify_date: '2024-09-13',
          },
          {
            fid: '72080000125562',
            code: 'น.106-1/2556-ญหช.',
            name: 'บริษัท อินทรี อีโคไซเคิล จำกัด',
            province_id: '1072',
            system_id: 12,
            verify_status: 0,
            authorize_start: null,
            authorize_end: null,
            juristic_start: null,
            verify_date: null,
          },
          {
            fid: '10900179425649',
            code: '3-106-13/64สข',
            name: 'บริษัท อินทรี อีโคไซเคิล จำกัด',
            province_id: '1090',
            system_id: 12,
            verify_status: 0,
            authorize_start: null,
            authorize_end: null,
            juristic_start: null,
            verify_date: null,
          },
          {
            fid: '10900061425657',
            code: '3-105-35/65สข',
            name: 'บริษัท อินทรี อีโคไซเคิล จำกัด',
            province_id: '1090',
            system_id: 12,
            verify_status: 0,
            authorize_start: null,
            authorize_end: null,
            juristic_start: null,
            verify_date: null,
          },
        ],
      },
      {
        juristic_id: '0107536001346',
        name_th: 'ปูนซีเมนต์นครหลวง จำกัด (มหาชน)',
        name_en: 'SIAM CITY CEMENT PUBLIC COMPANY LIMITED',
        factories: [
          {
            fid: '10190000125572',
            code: '3-101-1/57สบ',
            name: 'บริษัท ปูนซีเมนต์นครหลวง จำกัด (มหาชน)',
            province_id: '1019',
            system_id: 12,
            verify_status: 0,
            authorize_start: null,
            authorize_end: null,
            juristic_start: null,
            verify_date: null,
          },
          {
            fid: '10190000225448',
            code: '3-101-2/44สบ',
            name: 'บริษัท ปูนซิเมนต์นครหลวง จำกัด (มหาชน) โรงงาน 2',
            province_id: '1019',
            system_id: 12,
            verify_status: 0,
            authorize_start: null,
            authorize_end: null,
            juristic_start: null,
            verify_date: null,
          },
          {
            fid: '10190000325446',
            code: '3-101-3/44สบ',
            name: 'บริษัท ปูนซิเมนต์นครหลวง จำกัด (มหาชน) โรงงาน 3',
            province_id: '1019',
            system_id: 12,
            verify_status: 0,
            authorize_start: null,
            authorize_end: null,
            juristic_start: null,
            verify_date: null,
          },
        ],
      },
    ],
    roles: ['factory_operator'],
  },
];

export interface MockCitizen {
  username: string;
  password: string;
  external_id: string;
  email: string | null;
  first_name: string;
  last_name: string;
  roles: string[];
}

export const MOCK_CITIZENS: MockCitizen[] = [
  {
    username: 'citizen_demo',
    password: 'demo1234',
    external_id: '1100000999999',
    email: 'citizen@example.com',
    first_name: 'สมชาย',
    last_name: 'ใจดี',
    roles: ['public_user'],
  },
];
