# เลขคำขอเจ้าหน้าที่ใช้ลำดับร่วมกับผู้ประกอบการ

> หลักฐานนี้บันทึกการรวม sequence ณ เวลาที่ `requestNo` ยังใช้รูปแบบปี 2 หลักและลำดับ 5 หลัก รูปแบบปัจจุบันอ้างอิง [request-number-full-year-format.tdd.md](./request-number-full-year-format.tdd.md).

## Source

User journey และ acceptance criteria มาจากคำขอในงานนี้ ไม่มีไฟล์แผนภายนอก.

## User Journey

ในฐานะเจ้าหน้าที่ ฉันต้องการให้ Direct Connection ใช้เลขที่คำขอรูปแบบเดียวและลำดับเดียวกับคำขอผู้ประกอบการ เพื่อไม่ให้ตารางคำขอมีระบบเลข `OLDC`/`OLDW` แยกอีกชุด โดยยังคงรหัสจุดตรวจวัดที่เจ้าหน้าที่กรอกและสถานะ `CONNECTED` ทันทีตามเดิม.

## Task Report

| Stage | Command | Result | Evidence |
| --- | --- | --- | --- |
| RED | `npm test -- --runInBand tests/unit/connection-requests.direct-connections.repository-happy-path.test.ts` | FAIL: 1 test | repository ยัง query `cems_wpms_direct_request_sequences`; test รายงาน `Unexpected query for cems_wpms_direct_request_sequences` |
| GREEN | `npm test -- --runInBand tests/unit/connection-requests.direct-connections.repository-happy-path.test.ts tests/unit/connection-requests.direct-connections.integration.test.ts tests/unit/connection-requests.direct-connections.route.test.ts tests/unit/connection-requests.direct-connections.service.test.ts tests/unit/connection-requests.direct-connections.validator.test.ts` | PASS: 5 suites, 24 tests | Direct Connection ใช้ `CEMS-69-00001`/`WPMS-69-00001`, ยังคืน `OFFICER_DIRECT_API`, `CONNECTED` และเก็บ point code ที่เจ้าหน้าที่กรอก |
| Typecheck | `npm run typecheck` | PASS | TypeScript ไม่มี type error |
| Build | `npm run build` | PASS | backend build สำเร็จ |
| Full backend suite | `npm test -- --runInBand` | 85 suites / 765 tests PASS; 1 unrelated suite / 3 tests FAIL | `officer-notification-email-recipients.route.test.ts` อ่าน recipient จริงจากฐานตาม `.env` production จึงชนข้อมูลเดิม; focused Direct Connection suites ยังผ่าน |

## Test Specification

| # | What is guaranteed | Test file | Test type | Result |
| --- | --- | --- | --- | --- |
| 1 | Direct CEMS นับคำขอเดิมด้วย prefix `CEMS-69-` และออก `CEMS-69-00001` เมื่อยังไม่มีคำขอ | `connection-requests.direct-connections.repository-happy-path.test.ts` | Repository unit | PASS |
| 2 | Direct Connection ไม่อ่านหรือเพิ่ม `cems_wpms_direct_request_sequences` อีก | `connection-requests.direct-connections.repository-happy-path.test.ts` | Repository unit | PASS |
| 3 | Point code ที่เจ้าหน้าที่กรอกยังถูกบันทึกทั้ง measurement point และ connected point | `connection-requests.direct-connections.repository-happy-path.test.ts` | Repository unit | PASS |
| 4 | HTTP response ยังคง `CONNECTED` และ `submissionSource=OFFICER_DIRECT_API` | `connection-requests.direct-connections.integration.test.ts` | HTTP integration | PASS |

## Coverage and Known Gaps

Focused regression ครอบคลุม repository, service, validator, route และ HTTP integration ของ Direct Connection. ไม่มีการแก้ frontend, payload, point-code validation, permission หรือ status flow.

คำสั่ง focused coverage ผ่าน 5 suites / 24 tests และรายงาน coverage ของไฟล์ `connection-requests.repository.ts` ที่ 26.39% statements, 31.51% branches, 24.88% functions และ 28.01% lines. ตัวเลขต่ำกว่าเป้าหมาย 80% เพราะ repository เดียวมีหลาย business flows ที่ไม่ถูกโหลดใน focused run; guarantee ของบรรทัดที่เปลี่ยนถูกตรวจโดย happy-path repository test แต่ project ยังไม่มี coverage seam แยกสำหรับ request-number allocator.

Full backend suite มี failure เดิมที่ขึ้นกับข้อมูล production ใน `officer-notification-email-recipients.route.test.ts`: expected fixture ใหม่แต่ฐานมี recipient จริงอยู่แล้ว ทำให้ได้ `409` และรายการเกิน fixture. ไม่แก้ test หรือข้อมูลนั้นในงานนี้เพราะไม่เกี่ยวกับ Direct Connection numbering.

## Merge Evidence

- RED checkpoint: `93d2738 test: require shared officer request numbering`
- GREEN checkpoint: `5cd2083 fix: share officer request numbering`
