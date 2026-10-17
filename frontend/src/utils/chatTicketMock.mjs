export const ticketTopics = [
  'ข้อมูลโรงงานและสิทธิ์การใช้งาน',
  'การขอเชื่อมต่อและการส่งข้อมูล',
  'ผลตรวจวัดและการแจ้งเตือน',
  'แบบฟอร์มและการยื่นรายงาน',
  'ข้อมูลในแบบฟอร์ม กฎหมายและประกาศฯ',
  'อื่นๆ',
]

export const mockPeople = {
  officer: { name: 'กมลวรรณ ใจดี', role: 'เจ้าหน้าที่ภาคตะวันออก' },
  operator: { name: 'วิภา สุขใจ', role: 'ผู้ประกอบการ' },
  colleague: { name: 'ธนา รุ่งเรือง', role: 'ผู้ประกอบการร่วมโรงงาน' },
}

export const mockFactories = [
  { id: 'factory-1', name: 'บริษัท อุตสาหกรรมตัวอย่าง จำกัด', registration: 'DEMO-001', region: 'ภาคตะวันออก', province: 'ระยอง', points: ['S2001 · ปล่องหม้อไอน้ำ 1', 'S2002 · ปล่องหม้อไอน้ำ 2', 'P2001 · จุดระบายน้ำทิ้ง'] },
  { id: 'factory-2', name: 'บริษัท พลังงานตัวอย่าง จำกัด', registration: 'DEMO-002', region: 'ภาคตะวันออก', province: 'ชลบุรี', points: ['S2003 · ปล่องผลิตไฟฟ้า'] },
]

export function canAccessMockTicket(ticket, viewer) {
  if (!mockPeople[viewer]) return false
  const factory = mockFactories.find((item) => item.id === ticket.factoryId)
  return Boolean(factory && (viewer === 'officer' ? factory.region === 'ภาคตะวันออก' : factory.id === 'factory-1'))
}

export function makeMockTickets() {
  return [
    { id: 'TK-69-00018', factoryId: 'factory-1', point: mockFactories[0].points[0], topic: ticketTopics[1], status: 'open', creator: 'operator', messages: [
      { sender: 'operator', text: 'ขอสอบถามข้อมูลของจุดตรวจวัด S2001 ค่ะ ข้อมูลช่วงเช้าวันนี้ยังไม่แสดงในระบบ แต่เครื่องมือส่งข้อมูลตามปกติ', at: '2026-10-17T08:15:00+07:00' },
      { sender: 'officer', text: 'ได้รับเรื่องแล้วค่ะ ขอทราบช่วงเวลาที่ข้อมูลไม่แสดง และสถานะการเชื่อมต่อที่หน้าอุปกรณ์เพิ่มเติมค่ะ', at: '2026-10-17T09:20:00+07:00' },
      { sender: 'colleague', text: 'ผมตรวจสอบเพิ่มเติมแล้วครับ เป็นช่วงเวลา 06:00–08:00 น. สถานะอุปกรณ์แสดงว่าเชื่อมต่ออยู่ครับ', at: '2026-10-17T09:45:00+07:00' },
    ] },
    { id: 'TK-69-00017', factoryId: 'factory-1', point: 'ทั้งหมด', topic: ticketTopics[4], status: 'open', creator: 'operator', messages: [
      { sender: 'operator', text: 'ขอสอบถามรายละเอียดข้อมูลที่ต้องระบุในแบบฟอร์ม กวภ. ค่ะ', at: '2026-10-16T14:30:00+07:00' },
    ] },
    { id: 'TK-69-00016', factoryId: 'factory-2', point: 'ทั้งหมด', topic: ticketTopics[2], status: 'open', creator: 'operator', messages: [
      { sender: 'operator', text: 'ขอสอบถามผลการแจ้งเตือนของโรงงานค่ะ', at: '2026-10-15T10:00:00+07:00' },
    ] },
    { id: 'TK-69-00015', factoryId: 'factory-1', point: mockFactories[0].points[2], topic: ticketTopics[3], status: 'closed', creator: 'operator', closedBy: 'officer', closedAt: '2026-10-15T16:05:00+07:00', messages: [
      { sender: 'operator', text: 'ส่งแบบรายงานแล้ว ต้องดำเนินการเพิ่มเติมหรือไม่คะ', at: '2026-10-14T13:10:00+07:00' },
      { sender: 'officer', text: 'ได้รับแบบรายงานแล้วค่ะ สามารถติดตามสถานะได้ในรายการส่งแบบรายงานค่ะ', at: '2026-10-15T15:20:00+07:00' },
      { sender: 'operator', text: 'ตรวจสอบแล้วค่ะ ขอบคุณค่ะ', at: '2026-10-15T16:00:00+07:00' },
    ] },
  ]
}

export function updateMockTicket(ticket, viewer, action, text = '', now = new Date().toISOString()) {
  if (!canAccessMockTicket(ticket, viewer) || ticket.status !== 'open') return ticket
  if (action === 'close') return { ...ticket, status: 'closed', closedBy: viewer, closedAt: now }
  if (action === 'send' && text.trim() && text.length <= 2000) {
    return { ...ticket, messages: [...ticket.messages, { sender: viewer, text: text.trim(), at: now }] }
  }
  return ticket
}

export function createMockTicket(tickets, viewer, form, now = new Date().toISOString()) {
  const factory = mockFactories.find((item) => item.id === form.factoryId)
  if (viewer === 'officer' || !canAccessMockTicket(form, viewer) || !ticketTopics.includes(form.topic)
    || !form.text.trim() || form.text.length > 2000 || (form.point !== 'ทั้งหมด' && !factory?.points.includes(form.point))) return null
  const year = new Intl.DateTimeFormat('th-TH', { year: 'numeric', timeZone: 'Asia/Bangkok' }).format(new Date(now)).replace(/\D/g, '').slice(-2)
  const prefix = `TK-${year}-`
  const sequence = Math.max(0, ...tickets.filter((ticket) => ticket.id.startsWith(prefix)).map((ticket) => Number(ticket.id.slice(-5)))) + 1
  return { id: `${prefix}${String(sequence).padStart(5, '0')}`, factoryId: form.factoryId, point: form.point, topic: form.topic,
    status: 'open', creator: viewer, messages: [{ sender: viewer, text: form.text.trim(), at: now }] }
}
