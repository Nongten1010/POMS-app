import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const locations = JSON.parse(readFileSync(new URL('../option/locationOptions.json', import.meta.url), 'utf8'))
const expected = {
  ภาคเหนือ: 'เชียงใหม่ เชียงราย ลำปาง ลำพูน แม่ฮ่องสอน พะเยา แพร่ น่าน อุตรดิตถ์ พิษณุโลก ตาก สุโขทัย กำแพงเพชร พิจิตร เพชรบูรณ์ นครสวรรค์',
  ภาคตะวันออกเฉียงเหนือ: 'นครราชสีมา บุรีรัมย์ สุรินทร์ ศรีสะเกษ อุบลราชธานี ยโสธร ร้อยเอ็ด มหาสารคาม ชัยภูมิ ขอนแก่น อุดรธานี หนองคาย นครพนม สกลนคร กาฬสินธุ์ เลย หนองบัวลำภู อำนาจเจริญ มุกดาหาร บึงกาฬ',
  ภาคตะวันตก: 'สมุทรสาคร สมุทรสงคราม นครปฐม ราชบุรี กาญจนบุรี สุพรรณบุรี เพชรบุรี ประจวบคีรีขันธ์',
  ภาคตะวันออก: 'ฉะเชิงเทรา นครนายก สระแก้ว ปราจีนบุรี ชลบุรี ระยอง จันทบุรี ตราด',
  ภาคใต้: 'ชุมพร ระนอง พังงา ภูเก็ต สุราษฎร์ธานี ยะลา นครศรีธรรมราช สตูล กระบี่ พัทลุง ตรัง สงขลา ปัตตานี นราธิวาส',
  ภาคกลาง: 'กรุงเทพมหานคร สมุทรปราการ นนทบุรี ปทุมธานี พระนครศรีอยุธยา สระบุรี ลพบุรี สิงห์บุรี อ่างทอง ชัยนาท อุทัยธานี',
}

test('DIW regions contain exactly 77 unique provinces', () => {
  assert.equal(locations.provinces.length, 77)
  assert.equal(new Set(locations.provinces.map((province) => province.value)).size, 77)
  assert.deepEqual([...new Set(locations.provinces.map((province) => province.region))].sort(), Object.keys(expected).sort())
})

for (const [region, names] of Object.entries(expected)) {
  test(`${region} matches the approved DIW province list`, () => {
    assert.deepEqual(locations.provinces.filter((province) => province.region === region).map((province) => province.value).sort(), names.split(' ').sort())
  })
}
