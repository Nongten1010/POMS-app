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

ผลเฉพาะ feature ระหว่างพัฒนา: 9 suites, 94 tests ผ่านทั้งหมด และ test rollback ของ migration ผ่านเพิ่มเติม.

ผล regression ทั้ง backend หลังปรับ contract: 103 suites, 883 tests ผ่านทั้งหมด (`npm test -- --runInBand --silent`). `npm run build`, `npm run typecheck`, scoped ESLint และ `git diff --check` ผ่าน.

Focused coverage ของ formatter และ migration: statements 90.69%, branches 82.85%, functions 86.36%, lines 94.93%.

## Canonical contract

- [โรงงานที่เข้าข่าย](../../api/menus/eligible-factories/README.md)
- [คำขอเชื่อมต่อ](../../api/menus/connection-requests/README.md)
