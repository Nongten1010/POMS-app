# TDD Evidence: Factory Address Province

## Contract

ข้อมูลจังหวัดยังคงอยู่ใน `provinceName`/`province_name` แยกตามเดิม และ backend ประกอบจังหวัดเข้า `address` ก่อนรหัสไปรษณีย์ตั้งแต่ Candidate API ผ่านโรงงานที่เข้าข่าย ฟอร์มข้อมูลจุดตรวจวัด คำขอเชื่อมต่อ จนถึง active connected POMS rows.

## RED/GREEN

| Behavior | RED | GREEN |
| --- | --- | --- |
| Candidate จาก `PROV=18` มี `จังหวัดชัยนาท` ใน address | mapper คืน `197 หมู่ 5 ตำบลหาดอาษา อำเภอสรรพยา 17150` | mapper คืนจังหวัดใน address และยังคืน `provinceName: ชัยนาท` |
| Monitoring form เก็บ address เต็ม | repository ได้ input เดิมที่ไม่มีจังหวัด | service normalize address ก่อนบันทึก |
| Connection request และ Direct Connection เก็บ address เต็ม | request/connected row copy address ที่ไม่มีจังหวัด | row mapper และ connected insert ใช้ formatter เดียวกัน |
| ข้อมูลเดิมถูก backfill แบบย้อนกลับได้ | ไม่มี migration ครบทุกชั้น | migration `0084` backup และอัปเดต eligible, monitoring form, active request และ active connected POMS |
| เลขโฉนด 5 หลักไม่ถูกตีความเป็นรหัสไปรษณีย์ | จังหวัดถูกแทรกก่อนเลขโฉนดชุดแรก | formatter เรียง `อำเภอ → จังหวัด → ZIPCODE` โดยใช้ `ZIPCODE` structured จาก `fac_import` |
| จังหวัดเดิมที่อยู่ก่อนเลขโฉนดถูกย้ายหลังอำเภอ | formatter คืน address ผิดตำแหน่งเดิมแบบ idempotent | formatter ลบเฉพาะ province component เดิมและวางใหม่หลังอำเภอโดยรักษาเลขโฉนดและ spacing |
| ชื่อถนนที่มีคำว่า `จังหวัด` ไม่กลบ province component | `ถนนทางหลวงจังหวัดปราจีนบุรี-บ้านสร้าง` ทำให้ระบบไม่เพิ่มจังหวัด | ระบบเพิ่ม `จังหวัดปราจีนบุรี` หลังอำเภอโดยคงชื่อถนนเดิม |
| ข้อมูลที่บันทึกผิดตำแหน่งถูก backfill แบบย้อนกลับได้ | eligible/form rows 24 แถวต้องเปลี่ยน | migration `0085` backup ก่อนย้ายจังหวัดหลังอำเภอ; active request และ connected POMS ไม่มีแถวต้องเปลี่ยนใน dry-run |

## Focused verification

```bash
npm test -- --runInBand \
  tests/unit/factory-address.test.ts \
  tests/unit/factory-address-province-backfill.test.ts \
  tests/unit/fac-import.mapper.test.ts \
  tests/unit/eligible-factories.repository.test.ts \
  tests/unit/eligible-factory-address-storage.test.ts \
  tests/unit/eligible-factories.service.test.ts \
  tests/unit/monitoring-point-forms.service.test.ts \
  tests/unit/connection-requests.repository.test.ts \
  tests/unit/connection-requests.direct-connections.repository-happy-path.test.ts
```

ผลเฉพาะ formatter, mapper และ migration `0085`: 3 suites, 34 tests ผ่านทั้งหมด รวม test rollback.

ผล regression ทั้ง backend หลังปรับลำดับ: 104 suites, 893 tests ผ่านทั้งหมด (`npm test -- --runInBand --silent`). `npm run build`, `npm run typecheck`, scoped ESLint, scoped Prettier และ `git diff --check` ผ่าน.

ผลสแกน read-only กับ Candidate production 69,007 รายการ: 68,779 รายการที่มี `ZIPCODE` วางจังหวัดก่อน `ZIPCODE` ถูกต้องทั้งหมด และ 228 รายการที่ไม่มี `ZIPCODE` วางจังหวัดท้าย address ทั้งหมด. Dry-run ข้อมูล POMS เดิมพบ eligible factories 12 แถวและ monitoring forms 12 แถวที่ migration `0085` จะย้ายจังหวัด; active requests และ connected POMS ไม่ต้องเปลี่ยน.

Full-repository coverage ปัจจุบันอยู่ที่ statements 57.76%, branches 56.54%, functions 61.61% และ lines 59.02% ซึ่งต่ำกว่าเป้าหมาย 80% เดิมของโครงการ; งานนี้เพิ่ม focused regression tests แต่ไม่ได้ขยาย coverage ของโมดูลอื่นที่อยู่นอกขอบเขต.

## Canonical contract

- [โรงงานที่เข้าข่าย](../../api/menus/eligible-factories/README.md)
- [คำขอเชื่อมต่อ](../../api/menus/connection-requests/README.md)
