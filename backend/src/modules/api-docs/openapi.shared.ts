export const MENU_TAGS = {
  SYSTEM: 'ระบบทั่วไปและการเข้าสู่ระบบ',
  HOME: 'หน้าหลัก',
  MASTER_DATA: 'ข้อมูลพื้นฐาน',
  CONNECTION_REQUESTS: 'ขอเชื่อมต่อ',
  KWP_FORMS: 'แจ้งแบบ กวภ. 01 - กวภ. 05',
  BOD_COD_REPORTS: 'รายงานค่าความคลาดเคลื่อน BOD/COD Online',
  NOTIFICATIONS: 'การแจ้งเตือน',
  STATISTICS: 'สถิติข้อมูล',
  PERMISSIONS: 'สิทธิ์การใช้งาน',
  ELIGIBLE_FACTORIES: 'โรงงานที่เข้าข่าย',
  LAWS: 'กฎหมายที่เกี่ยวข้อง',
  FAQS: 'คำถามที่พบบ่อย',
  INTEGRATIONS: 'ระบบเชื่อมต่อภายนอก',
} as const;

export type MenuTag = (typeof MENU_TAGS)[keyof typeof MENU_TAGS];
