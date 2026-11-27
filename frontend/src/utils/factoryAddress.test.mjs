import assert from 'node:assert/strict'
import test from 'node:test'
import { formatFactoryAddress } from './factoryAddress.mjs'

test('hides postcodes in current and legacy factory addresses', () => {
  const examples = [
    ['89 หมู่ 1 ตำบลบ้านเลน อำเภอบางปะอิน จังหวัดพระนครศรีอยุธยา 13160', '89 หมู่ 1 ตำบลบ้านเลน อำเภอบางปะอิน จังหวัดพระนครศรีอยุธยา'],
    ['197 หมู่ 5 ตำบลหาดอาษา อำเภอสรรพยา 17150 (ประตู 2)', '197 หมู่ 5 ตำบลหาดอาษา อำเภอสรรพยา (ประตู 2)'],
    ['4 หมู่ 6 ตำบล10 อำเภอ4 24130', '4 หมู่ 6 ตำบล10 อำเภอ4'],
    ['90 แขวงมีนบุรี เขตมีนบุรี กรุงเทพมหานคร ๑๐๕๑๐', '90 แขวงมีนบุรี เขตมีนบุรี กรุงเทพมหานคร'],
    ['7/507 ต.มาบยางพร อ.ปลวกแดง ระยอง (21140)', '7/507 ต.มาบยางพร อ.ปลวกแดง ระยอง'],
    ['22 อำเภอเมือง 21000 จังหวัดระยอง', '22 อำเภอเมือง จังหวัดระยอง'],
    ['22 จังหวัดระยอง 21000 ประเทศไทย', '22 จังหวัดระยอง ประเทศไทย'],
    ['61/2 รหัสไปรษณีย์: 10510 (ประตู 2)', '61/2 (ประตู 2)'],
    ['61/2 (ZIP Code: 10510)', '61/2'],
  ]

  for (const [address, expected] of examples) assert.equal(formatFactoryAddress(address), expected)
})

test('preserves five-digit numbers that belong to the factory address', () => {
  const address = 'โฉนดที่ดินเลขที่ 45907 45906 46388 หมู่ 1 ตำบลหนองกินเพล อำเภอวารินชำราบ จังหวัดอุบลราชธานี'
  assert.equal(formatFactoryAddress(`${address} 34190`), address)
  assert.equal(formatFactoryAddress('เลขที่ 13160'), 'เลขที่ 13160')
  assert.equal(formatFactoryAddress('99/2 ถนนสาย 12345'), '99/2 ถนนสาย 12345')
  assert.equal(formatFactoryAddress('โฉนดเลขที่ จังหวัดเชียงใหม่ 12345 อำเภอเมืองเชียงใหม่ 50000'),
    'โฉนดเลขที่ จังหวัดเชียงใหม่ 12345 อำเภอเมืองเชียงใหม่')
  assert.equal(formatFactoryAddress('โฉนดเลขที่ จังหวัดเชียงใหม่ 12345 รหัสไปรษณีย์ 50000'),
    'โฉนดเลขที่ จังหวัดเชียงใหม่ 12345')
  assert.equal(formatFactoryAddress('อำเภอ123456'), 'อำเภอ123456')
  assert.equal(formatFactoryAddress(null), null)
  assert.equal(formatFactoryAddress(''), '')
})
