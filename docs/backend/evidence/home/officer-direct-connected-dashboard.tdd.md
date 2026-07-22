# หลักฐาน TDD: โรงงานที่เจ้าหน้าที่เชื่อมต่อแสดงบนหน้าหลัก

## Canonical Contract

- [หน้าหลัก](../../api/menus/home/README.md)

## Source And User Journey

ไม่มี plan file. Journey มาจากเหตุการณ์ที่เจ้าหน้าที่ Direct Connection โรงงาน `40100007125560` สำเร็จและหน้าขอเชื่อมต่อแสดง `CONNECTED` แต่หน้าหลักไม่พบโรงงาน

ในฐานะเจ้าหน้าที่ที่มี permission scope ถูกต้อง ต้องเห็นโรงงานที่เชื่อมต่อแล้วบนหน้าหลัก แม้ยังไม่มี `factories` row โดยไม่ขยาย `OWN_FACTORY` ให้ผู้ประกอบการที่ไม่มี ownership.

## RED / GREEN Report

| Stage | Command | Result | Evidence |
| --- | --- | --- | --- |
| RED | `npm test -- --runInBand tests/unit/connection-requests.repository.test.ts tests/unit/connection-requests.service.test.ts` | FAIL | ไม่มี `buildConnectedFactoriesForAccessQueryForTests` และ `FactoryAccess` ยังไม่รองรับ `connectedPomsOnly` |
| RED: parameter access | `npm test -- --runInBand tests/unit/parameter-values.repository.test.ts -t "allows connected station access by selected permission province"` | FAIL | query จังหวัดยัง join ผ่าน `factories` และไม่มี `eligible_factories` |
| RED: general/favorite | `npm test -- --runInBand tests/unit/connection-requests.repository.test.ts -t "resolves connected factory detail"` | FAIL | ยังไม่มี fallback query สำหรับ connected eligible factory ที่ไม่มี factory master |
| RED: point identity | `npm test -- --runInBand tests/unit/connection-requests.repository.test.ts -t "loads connected points by eligible"` | FAIL | ยังไม่มี query helper ที่ยืนยันการค้นผ่าน `eligible_factory_id` |
| GREEN | `npm test -- --runInBand tests/unit/connection-requests.repository.test.ts tests/unit/connection-requests.service.test.ts tests/unit/parameter-values.repository.test.ts tests/unit/parameter-values.service.test.ts` | PASS | 4 suites, 116 tests |

## Test Specification

| # | What is guaranteed | Test file | Test type | Result |
| --- | --- | --- | --- | --- |
| 1 | Dashboard source รับ active connected POMS factory โดยไม่บังคับ factory master | `connection-requests.repository.test.ts` | Repository SQL | PASS |
| 2 | `40100007125560` แบบ `id: null` แสดงพร้อม active point | `connection-requests.service.test.ts` | Service regression | PASS |
| 3 | `OWN_FACTORY` ยังตรวจ `user_juristics`/`user_factory_access` ผ่าน `factories` | `connection-requests.repository.test.ts` | Authorization SQL | PASS |
| 4 | Province/region scope ใช้ location ของ active eligible factory | `connection-requests.repository.test.ts` | Authorization SQL | PASS |
| 5 | Parameter-value access ของ connected point ใช้ `eligible_factory_id` หา province | `parameter-values.repository.test.ts` | Authorization SQL | PASS |
| 6 | จุดตรวจวัดจับคู่โรงงานด้วย `eligible_factory_id` ได้ แม้ `factory_id` ที่เก็บไว้เป็น alias เดิม | `connection-requests.repository.test.ts`, `connection-requests.service.test.ts` | Repository SQL + service regression | PASS |
| 7 | ข้อมูลทั่วไปและ favorite resolve active connected eligible factory ได้เมื่อยังไม่มี factory master | `connection-requests.repository.test.ts` | Repository SQL | PASS |

## Coverage And Known Gaps

Focused coverage ของ source files ที่เปลี่ยน (`connection-requests.repository.ts`, `connection-requests.service.ts`, `parameter-values.repository.ts`) ได้ statements `58.01%`, branches `48.66%`, functions `64.11%` และ lines `61.02%`. ค่านี้ต่ำกว่าเป้าหมาย `80%` เพราะทั้งสามไฟล์เป็น modules เดิมขนาดใหญ่และ focused run ไม่ได้ execute unrelated functions; regression behavior ในงานนี้มี repository SQL, service และ authorization tests โดยตรง.

Focused verification เพิ่มเติม: 6 suites และ 132 tests ผ่าน. Full backend suite: 77 suites และ 711 tests ผ่านทั้งหมด. Build, typecheck, lint เฉพาะ changed files และ formatting check ผ่าน.

การยืนยัน row จริงใน MSSQL สำหรับ `40100007125560` ต้องทำในเครือข่ายที่เข้าถึงฐานข้อมูลภายในได้; การเชื่อมต่อจาก environment ระหว่าง diagnosis timeout.

ไม่มี database migration และไม่สร้าง `factories` row หรือ ownership อัตโนมัติ.
