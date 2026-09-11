# ชื่อจุดตรวจวัดในหน้าขอเชื่อมต่อหลังอนุมัติแก้ไข

## Source และ user journey

มาจากอาการที่ผู้ใช้แจ้ง: อนุมัติคำขอแก้ชื่อแล้ว หน้าขอเชื่อมต่อควรแสดงชื่อเดียวกับข้อมูล POMS ปัจจุบัน โดยเก็บข้อมูลคำขอเดิมสำหรับประวัติ

Canonical contracts: [Connected points](../../api/menus/connection-requests/README.md#connected-points), [Shared connected-point contract](../../api/shared/connected-measurement-points/README.md)

## หลักฐานก่อนแก้

ตรวจ production แบบอ่านอย่างเดียวเมื่อ 11 กันยายน 2569: คำขอ `point-00003/2569` (ID 22) สถานะ `APPROVED`, จุด `S1125`, connected point ID 9 และ source point ID 15

- Proposed name และ live POMS name: `Boiler 35 T [ทดสอบส่งกลับ 20260909]`
- API รายการจุดและรายละเอียดรายโรงงานในหน้าขอเชื่อมต่อ: `Boiler 35 T`
- หน้าเว็บจริงแสดงชื่อใหม่ในข้อมูลพื้นฐาน และชื่อเดิมในหน้าขอเชื่อมต่อ
- ตรวจซ้ำด้วย `cache: 'no-store'` ได้ `NAME_MISMATCH` เช่นเดิม

สาเหตุ: `listConnectedMeasurementPoints` คืน `point` จาก connected request snapshot โดยตรง แม้ชื่อใน active connected row จะเปลี่ยนแล้ว ส่วน modal lookup ใช้ข้อมูลปัจจุบันเฉพาะหา `connectedPointId`

## RED / GREEN

จาก directory `backend/`:

```bash
npm test -- --runInBand --cacheDirectory=/private/tmp/poms-s1125-jest-cache tests/unit/connection-requests.service.test.ts --testNamePattern='current connected point names after approval' --silent
```

RED: 2 failed, 3 passed; ทั้งรายการและ modal คาดชื่อใหม่ แต่ได้รับ `Boiler 35 T`

หลังแก้เลือกชื่อจาก active row ตาม `source_measurement_point_id` โดยโหลดเฉพาะโรงงานจากคำขอที่ผ่าน scope แล้ว:

```bash
npm test -- --runInBand --cacheDirectory=/private/tmp/poms-s1125-jest-cache tests/unit/connection-requests.service.test.ts --silent
npm run typecheck
```

GREEN: service 113 tests ผ่าน; TypeScript ผ่าน

ตรวจ service, connected-point routes, OpenAPI และ docs routes ด้วย Jest ใน test environment แยกที่ใช้ค่า DB ทดสอบและ signing keys สุ่ม ไม่ใช้ credentials จริง:

```bash
node /private/tmp/poms-s1125-diagnostic/run-checks.cjs tests/unit/connection-requests.service.test.ts tests/unit/connected-measurement-points.route.test.ts tests/unit/api-docs.openapi.test.ts tests/unit/api-docs.route.test.ts --silent
```

ผล: 4 suites, 209 tests ผ่าน ตัว helper อยู่ในพื้นที่ diagnostic ชั่วคราว ไม่ใช่ dependency ของโครงการ; สามารถรัน targets เดียวกันด้วย `npm test` เมื่อมี test environment ครบ

## สิ่งที่ทดสอบยืนยัน

| Guarantee | Test | Result |
| --- | --- | --- |
| รายการคืนชื่อปัจจุบันโดยคง point identity, fields อื่น และ request snapshot | `returns the approved live name in the connection page list without changing the request snapshot` | PASS |
| Modal คืนชื่อใหม่พร้อม connected identity เดิม | `returns the approved live name and connected identity in the factory modal` | PASS |
| เมื่อไม่พบแถว active หรือพบ source ID คนละจุด ใช้ชื่อ snapshot และไม่เดาจากรหัสที่เหมือนกัน | `preserves the snapshot name when no active source point matches` (2 cases) | PASS |
| เมื่อไม่มีคำขอที่อ่านได้ ไม่โหลด live points เพิ่ม | `does not read live points when no connected requests are accessible` | PASS |

Tests: [connection-requests.service.test.ts](../../../../backend/tests/unit/connection-requests.service.test.ts)

## ขอบเขตและข้อจำกัด

- เปลี่ยนเฉพาะชื่อที่แสดง; การอ่าน device configs, station filter, parameters และประวัติคำขอใช้ contract เดิม
- ไม่มี database migration หรือการซ่อมข้อมูลย้อนหลัง เพราะชื่อใหม่อยู่ใน live POMS แล้ว
- ใช้ focused regression และ route checks ตามความเสี่ยง ไม่กำหนด coverage threshold ทั้งโครงการ
- ยังไม่ได้ deploy และยังไม่ได้ยืนยันผลหลังแก้บน production
- ไม่สร้าง checkpoint commits ตามข้อกำหนดโครงการที่ให้ commit เมื่อผู้ใช้สั่งเท่านั้น

Docs impact: updated
Canonical docs: `docs/backend/api/menus/connection-requests/README.md`, `docs/backend/api/shared/connected-measurement-points/README.md`
Reason: ระบุแหล่งข้อมูลปัจจุบันของ pointName และ fallback ให้ตรงกับ runtime OpenAPI
Client impact: frontend
Breaking change: no
