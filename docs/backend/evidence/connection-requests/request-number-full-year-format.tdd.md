# เลขที่คำขอใช้ลำดับ 4 หลักและปี พ.ศ. เต็ม

หลักฐานนี้สนับสนุน [สัญญา API เมนูขอเชื่อมต่อ](../../api/menus/connection-requests/README.md).

## Source

User journey และ acceptance criteria มาจากคำขอในงานนี้ ไม่มีไฟล์แผนภายนอก.

## User Journey

ในฐานะผู้ใช้เมนูขอเชื่อมต่อ ฉันต้องการให้เลขที่คำขอ CEMS/WPMS ใช้ลำดับอย่างน้อย 4 หลักและปี พ.ศ. 4 หลัก เพื่อให้ผู้ประกอบการและเจ้าหน้าที่เห็นรูปแบบเดียวกัน โดยไม่เปลี่ยนกติกาของรหัสจุดตรวจวัด.

## Task Report

| Stage | Command | Result | Evidence |
| --- | --- | --- | --- |
| RED | `npm test -- --runInBand tests/unit/connection-requests.repository.test.ts tests/unit/connection-requests.direct-connections.repository-happy-path.test.ts` | FAIL: 2 suites | ระบบยังสร้าง `CEMS-69-00001`; test helper สำหรับรูปแบบใหม่ยังไม่มี |
| GREEN | คำสั่ง RED เดิม | PASS: 2 suites, 38 tests | formatter คืน `CEMS-0001/2569`; Direct Connection query เฉพาะ sequence ของระบบและปีเดียวกัน |
| Regression | targeted connection-request suites 10 ไฟล์ | PASS: 10 suites, 143 tests | repository, service, validator, route, integration และ cancel flow ยังผ่าน |
| Full backend suite | `npm test -- --runInBand` | PASS: 95 suites, 823 tests | ไม่พบ regression ใน backend suite |
| Typecheck | `npm run typecheck` | PASS | TypeScript ไม่มี type error |
| Build | `npm run build` | PASS | backend build สำเร็จ |

## Test Specification

| # | What is guaranteed | Test file | Test type | Result |
| --- | --- | --- | --- | --- |
| 1 | CEMS ลำดับแรกในปี 2569 เป็น `CEMS-0001/2569` | `connection-requests.repository.test.ts` | Unit | PASS |
| 2 | WPMS ลำดับที่ 3 ในปี 2569 เป็น `WEMS-0003/2569` | `connection-requests.repository.test.ts` | Unit | PASS |
| 3 | Direct Connection ใช้รูปแบบใหม่และยังคง `OFFICER_DIRECT_API`/`CONNECTED` | `connection-requests.direct-connections.repository-happy-path.test.ts` | Repository unit | PASS |
| 4 | ผู้ประกอบการและเจ้าหน้าที่เรียก allocator เดียวกัน | `connection-requests.repository.ts` + targeted regression | Repository/integration | PASS |
| 5 | `requestNo` แยกจาก sequence ของ `measurementPoints[].pointCode` | repository tests + point-code contract แยก | Scope verification | PASS |

## Coverage and Known Gaps

Focused coverage ผ่าน 2 suites / 38 tests. การตั้งค่า Jest เก็บ coverage ทั้ง backend จึงรายงานรวมเพียง 4.42%. สำหรับไฟล์ repository ขนาดใหญ่ บรรทัดครอบคลุม 308/648 (47.53%), functions 105/213 (49.30%) และ branches 303/665 (45.56%). ต่ำกว่า 80% เพราะไฟล์เดียวรวมหลาย business flows ที่ไม่เกี่ยวกับการสร้างเลขคำขอ; บรรทัด formatter และ Direct Connection ที่เปลี่ยนถูก execute ใน focused tests.

การเปลี่ยนนี้ใช้ `COUNT + 1` ตามพฤติกรรม allocator เดิมและเปลี่ยนเฉพาะรูปแบบ/ขอบเขตปี ไม่เพิ่ม migration หรือแก้ข้อมูลย้อนหลัง.

## Merge Evidence

- RED checkpoint: `4f412f4 test: require full-year request number format`
- GREEN checkpoint: `3bfff76 fix: use full-year request number format`
