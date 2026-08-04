# คืนรหัสจุดตรวจวัดเป็น S/W เริ่มที่ 2001

หลักฐานนี้สนับสนุน [Point-code Contract ของเมนูขอเชื่อมต่อ](../../api/menus/connection-requests/README.md#point-code-contract).

## Source

User journey และ acceptance criteria มาจากคำขอในงานนี้ ไม่มีไฟล์แผนภายนอก.

## User Journey

ในฐานะผู้ใช้เมนูขอเชื่อมต่อ ฉันต้องการให้ระบบออกรหัสจุดตรวจวัดของผู้ประกอบการเป็น `S2001...` สำหรับ CEMS และ `W2001...` สำหรับ WPMS ขณะที่ Direct Connection ยังคงใช้รหัสที่เจ้าหน้าที่กรอกเอง และเลขที่คำขอใช้รูปแบบรายปีแยกจากรหัสจุด.

## Task Report

| Stage | Command | Result | Evidence |
| --- | --- | --- | --- |
| RED | `npm test -- --runInBand tests/unit/connection-requests.repository.test.ts tests/unit/connection-requests.point-code-sequence.repository.test.ts` | FAIL: 2 suites, 8 tests | request WPMS ยังเป็น `WPMS-...`; point generator ยัง query annual sequence table |
| GREEN | คำสั่ง RED เดิม | PASS: 2 suites, 42 tests | request WPMS เป็น `WEMS-...`; operator point generator ใช้ `S...`/`W...` และ sequence เดิม |
| Regression | targeted connection-request suites 11 ไฟล์ | PASS: 11 suites, 150 tests | request, approval, direct connection, route, service, validator และ cancel flow ยังผ่าน |
| Full backend suite | `npm test -- --runInBand` | PASS: 95 suites, 823 tests | ไม่พบ regression ใน backend suite |
| Typecheck | `npm run typecheck` | PASS | TypeScript ไม่มี type error |
| Build | `npm run build` | PASS | backend build สำเร็จ |

## Test Specification

| # | What is guaranteed | Test file | Test type | Result |
| --- | --- | --- | --- | --- |
| 1 | เลขที่คำขอ WPMS ลำดับที่ 3 ปี 2569 เป็น `WEMS-0003/2569` | `connection-requests.repository.test.ts` | Unit | PASS |
| 2 | จุด CEMS สองจุดแรกเป็น `S2001` และ `S2002` | `connection-requests.point-code-sequence.repository.test.ts` | Repository unit | PASS |
| 3 | WPMS ต่อจาก sequence 2002 เป็น `W2003` โดยไม่ขึ้นกับปี | `connection-requests.point-code-sequence.repository.test.ts` | Repository unit | PASS |
| 4 | generator ต่อจากรหัส `S...`/`W...` สูงสุดและไม่ใช้ annual point code คำนวณลำดับ | `connection-requests.point-code-sequence.repository.test.ts` | Repository unit | PASS |
| 5 | approval พร้อมกันไม่จองเลขจุดซ้ำ | `connection-requests.point-code-sequence.repository.test.ts` | Concurrency unit | PASS |

## Coverage and Known Gaps

Focused coverage ผ่าน 2 suites / 42 tests. การตั้งค่า Jest เก็บ coverage ทั้ง backend จึงรายงานรวม 3.82%. สำหรับ repository ขนาดใหญ่ บรรทัดครอบคลุม 273/650 (42.00%), functions 97/213 (45.54%) และ branches 214/671 (31.89%). ต่ำกว่า 80% เพราะไฟล์เดียวรวมหลาย business flows นอกขอบเขตนี้; request formatter, approval transition, persisted sequence, existing-code fallback และ concurrent approval ถูก execute ใน focused tests.

ตาราง annual sequence ที่ migration เก่าเคยสร้างยังคงอยู่เพื่อไม่ทำ destructive migration แต่ generator ใหม่ไม่อ่านหรือเขียนตารางนั้น.

## Merge Evidence

- RED checkpoint: `15e56e4 test: require WEMS requests and legacy point codes`
- GREEN checkpoint: `80a8bd0 fix: restore legacy point codes and WEMS requests`
