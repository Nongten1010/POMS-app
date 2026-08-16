# เลขที่คำขอใช้ลำดับ 4 หลักและปี พ.ศ. เต็ม

หลักฐานนี้สนับสนุน [สัญญา API เมนูขอเชื่อมต่อ](../../api/menus/connection-requests/README.md).

## Source

User journey และ acceptance criteria มาจากคำขอในงานนี้ ไม่มีไฟล์แผนภายนอก.

## User Journey

ในฐานะผู้ใช้เมนูขอเชื่อมต่อ ฉันต้องการให้เลขที่คำขอ CEMS/WPMS ใช้ลำดับอย่างน้อย 4 หลักและปี พ.ศ. 4 หลัก เพื่อให้ผู้ประกอบการและเจ้าหน้าที่เห็นรูปแบบเดียวกัน โดยไม่เปลี่ยนกติกาของรหัสจุดตรวจวัด.

## Task Report

| Stage              | Command                                                                                                                                                     | Result                       | Evidence                                                                                                                                                                                                    |
| ------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| RED                | `npm test -- --runInBand tests/unit/connection-requests.repository.test.ts tests/unit/connection-requests.direct-connections.repository-happy-path.test.ts` | FAIL: 2 suites               | ระบบยังสร้าง `CEMS-69-00001`; test helper สำหรับรูปแบบใหม่ยังไม่มี                                                                                                                                          |
| GREEN              | คำสั่ง RED เดิม                                                                                                                                             | PASS: 2 suites, 38 tests     | formatter คืน `CEMS-0001/2569`; Direct Connection query เฉพาะ sequence ของระบบและปีเดียวกัน                                                                                                                 |
| Regression         | targeted request-number, request-flow และ migration suites 9 ไฟล์                                                                                           | PASS: 9 suites, 197 tests    | `requestNo` ของ WPMS เป็น `WPMS-...`; sequence query ของ WPMS ยังนับ `WEMS-...` ระหว่าง rollout; allocator normalize แถว `WEMS-...` ที่ค้างอยู่ก่อนออกเลขใหม่; migration backfill ตรวจ collision ก่อนอัปเดต |
| Full backend suite | `npm test -- --runInBand`                                                                                                                                   | PASS: 129 suites, 1302 tests | ไม่พบ regression ใน backend suite                                                                                                                                                                           |
| Typecheck          | `npm run typecheck`                                                                                                                                         | PASS                         | TypeScript ไม่มี type error                                                                                                                                                                                 |
| Build              | `npm run build`                                                                                                                                             | PASS                         | backend build สำเร็จ                                                                                                                                                                                        |

## Test Specification

| #   | What is guaranteed                                                                                                                        | Test file                                                                                                         | Test type          | Result |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | ------------------ | ------ |
| 1   | CEMS ลำดับแรกในปี 2569 เป็น `CEMS-0001/2569`                                                                                              | `connection-requests.repository.test.ts`                                                                          | Unit               | PASS   |
| 2   | WPMS ลำดับที่ 3 ในปี 2569 เป็น `WPMS-0003/2569`                                                                                           | `connection-requests.repository.test.ts`                                                                          | Unit               | PASS   |
| 3   | Direct Connection ใช้รูปแบบใหม่และยังคง `OFFICER_DIRECT_API`/`CONNECTED`                                                                  | `connection-requests.direct-connections.repository-happy-path.test.ts`                                            | Repository unit    | PASS   |
| 4   | ผู้ประกอบการและเจ้าหน้าที่เรียก allocator เดียวกัน และ allocator ของ WPMS ยังนับ `WEMS-...` ระหว่าง backfill rollout                      | `connection-requests.repository.test.ts` + `connection-requests.direct-connections.repository-happy-path.test.ts` | Repository/unit    | PASS   |
| 5   | allocator ของ WPMS จะ normalize แถว `WEMS-NNNN/YYYY` ที่ค้างอยู่ก่อนนับ sequence ถัดไป และหยุดเมื่อชนเลขปลายทาง                           | `connection-requests.repository.test.ts` + `connection-requests.direct-connections.repository-happy-path.test.ts` | Repository/unit    | PASS   |
| 6   | Migration `0094_backfill_wpms_request_number_prefix` แปลงเฉพาะ request rows ของ WPMS ที่ยังเป็น `WEMS-NNNN/YYYY` และหยุดเมื่อชนเลขปลายทาง | `wpms-request-number-migration.test.ts`                                                                           | Migration unit     | PASS   |
| 7   | `requestNo` แยกจาก sequence ของ `measurementPoints[].pointCode`                                                                           | repository tests + point-code contract แยก                                                                        | Scope verification | PASS   |

## Coverage and Known Gaps

Focused coverage เดิมผ่าน 2 suites / 38 tests และ regression ล่าสุดเติม targeted suites ของ repository/route/service/migration สำหรับกรณี `WEMS -> WPMS` ให้ชัดขึ้น. การตั้งค่า Jest เก็บ coverage ทั้ง backend จึงรายงานรวมต่ำกว่าขอบเขตงานย่อยนี้; จุดที่แก้จริงถูก execute ทั้งใน request-number formatter, WPMS query scope, route/service response, runtime self-heal ของ allocator และ migration unit.

การเปลี่ยนนี้ยังใช้ `COUNT + 1` ตามพฤติกรรม allocator เดิม แต่ backend ของ `systemType = WPMS` จะนับทั้ง `WPMS-%/BBBB` และ `WEMS-%/BBBB` ระหว่าง rollout เพื่อหลีกเลี่ยงเลขซ้ำหากมีข้อมูลเดิมค้างก่อน migration. ก่อนนับลำดับใหม่ allocator จะ normalize แถว `WEMS-...` ของ WPMS ที่ยังค้างอยู่ใน transaction เดียวกันเพื่อลดความเสี่ยงจากหน้าต่าง deploy ที่ service เก่ายังรันอยู่. ข้อมูลย้อนหลังถูกแก้ผ่าน `0094_backfill_wpms_request_number_prefix` และจำกัดเฉพาะ `cems_wpms_connection_requests.request_no`.

## Merge Evidence

รายการ commit ด้านล่างเป็นหลักฐานของการเปลี่ยนรูปแบบปีเต็มเดิม ส่วนการแก้ prefix WPMS และ migration ข้อมูลเดิมอ้างอิงผลทดสอบล่าสุดด้านบนกับ [API CHANGELOG](../../api/CHANGELOG.md#2026-08-16--เปลี่ยน-prefix-เลขที่คำขอ-wpms-จาก-wems-เป็น-wpms).

- RED checkpoint: `4f412f4 test: require full-year request number format`
- GREEN checkpoint: `3bfff76 fix: use full-year request number format`
