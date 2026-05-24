const affiliations = [
  'กรมโรงงานอุตสาหกรรม',
  'สำนักงานอุตสาหกรรมจังหวัดชลบุรี',
  'การนิคมแห่งประเทศไทย',
  'กองฝุ่นและมลพิษ',
  'ศูนย์ควบคุมมลพิษภาค 1',
  'ศูนย์ควบคุมมลพิษภาค 2',
  'ศูนย์ควบคุมมลพิษภาค 3',
  'ศูนย์ควบคุมมลพิษภาค 4',
  'ศูนย์ควบคุมมลพิษภาค 5',
]

const positions = [
  'นักวิชาการสิ่งแวดล้อม',
  'วิศวกรปฏิบัติการ',
  'เจ้าหน้าที่ตรวจสอบ',
  'หัวหน้ากลุ่มงาน',
  'ผู้อำนวยการศูนย์',
  'ผู้ดูแลระบบ',
]

const levels = ['ปฏิบัติการ', 'ชำนาญการ', 'ชำนาญการพิเศษ', 'เชี่ยวชาญ', 'อำนวยการต้น', 'อำนวยการสูง']

const roles = ['กรอ.', 'สอจ.', 'กนอ.', 'กฝม.', '5 ศูนย์', 'ผอ.ศูนย์', 'ผอ.กฝม.', 'ผอ.กวภ.', 'Admin', 'อื่นๆ']

const firstNames = ['กมล', 'ปาริชาติ', 'ณัฐพล', 'อรทัย', 'ศรัณย์', 'วิภา', 'ธนกร', 'สุชาดา', 'ภัทร', 'มณีรัตน์']
const lastNames = ['อินทร์สุข', 'วัฒนกุล', 'ศรีสวัสดิ์', 'ตั้งเจริญ', 'บุญประเสริฐ', 'จันทร์หอม', 'เกษมทรัพย์', 'พิพัฒน์วงศ์']

export const systemUsers = Array.from({ length: 1200 }, (_, index) => {
  const id = index + 1
  const role = roles[index % roles.length]

  return {
    id,
    username: `officer${String(id).padStart(4, '0')}`,
    fullName: `${firstNames[index % firstNames.length]} ${lastNames[index % lastNames.length]}`,
    affiliation: affiliations[index % affiliations.length],
    position: positions[index % positions.length],
    level: levels[index % levels.length],
    role,
    status: index % 17 === 0 ? 'ระงับใช้งาน' : 'ใช้งาน',
  }
})

export const roleOptions = roles

export const statusOptions = ['ใช้งาน', 'ระงับใช้งาน']
