# หลักฐาน TDD: เลขทะเบียนและจังหวัดในตาราง กวภ. ใช้ factory identity เดียวกัน

## Canonical Contract

- [แจ้งแบบ กวภ. 01 - กวภ. 05](../../api/menus/kwp-forms/README.md#get-apiv1kwp-form-reportsrequests)

## Reproduction

รายการ `F01-07-0002/2569` จุดตรวจวัด `S1114` แสดงเลขทะเบียนเดิม
`3-7(1)-22/55สฎ` คู่กับจังหวัด `กรุงเทพมหานคร` ทั้งที่ eligible factory ปัจจุบันของ
โรงงานเดียวกันใช้เลข `10840002225552` และจังหวัด `สุราษฎร์ธานี`

regression fixture จำลองข้อมูลเดียวกันและยืนยันว่า mapper เดิมคืนผลดังนี้:

```json
{
  "factoryName": "บริษัท พี.ซี.ปาล์ม(2550) จำกัด",
  "factoryRegistration": "3-7(1)-22/55สฎ",
  "province": "กรุงเทพมหานคร",
  "monitoringPointCode": "S1114",
  "requestNo": "F01-07-0002/2569"
}
```

HTTP `304 Not Modified` เป็นผล cache revalidation ของ browser และไม่ใช่สาเหตุที่
เลขทะเบียนผิด เพราะ mapper เดิมสร้างค่าผิดจากแถวฐานข้อมูลได้โดยตรงแม้ไม่ผ่าน HTTP cache

## Root Cause

- `GET /api/v1/kwp-form-reports/factories` ตั้งชื่อ field ว่า `newRegistrationNo` แต่เดิมคืน `factories.code` ซึ่ง schema ระบุว่าอาจเป็นเลขทะเบียนเดิม แทน `factories.fid` หรือ `eligible_factories.factory_registration_no_new`; client จึงนำเลขเดิมไปเก็บใน submission ใหม่
- `GET /api/v1/kwp-form-reports/requests` เดิมคืน `factoryRegistration` จาก submission snapshot แต่คืน `province` จาก `factories -> provinces` อีก source chain หนึ่ง จึงสร้าง hybrid row ได้
- joins เดิมใช้หลาย `OR` โดยไม่มี ranking หรือ `TOP (1)` ทำให้ identifier alias หลายค่าอาจขยายหนึ่ง submission เป็นหลายแถวและทำให้ `meta.total` สูงเกินจริง

## Contract Decision

- ตารางโรงงานคืน `newRegistrationNo` จาก active `eligible_factories.factory_registration_no_new` และ fallback เป็น `factories.fid`; เลขเดิมแยกเป็น `oldRegistrationNo`
- ตารางคำขอ resolve eligible factory จาก `connectedPoint.eligible_factory_id` ก่อน แล้วจึง fallback ไป current/legacy identifiers ของ connected point และ submission
- `factoryRegistration`, `oldRegistrationNo` และ `province` ใช้ eligible factory แถวเดียวกัน
- ชื่อโรงงานใช้ active connected point ก่อน แล้ว fallback ไป eligible factory, factory master และ submission snapshot
- submission snapshot ยังคงเป็น audit/fallback และไม่ถูกเขียนทับ

## RED / GREEN Report

| Stage | Command | Result | Evidence |
| --- | --- | --- | --- |
| RED | `npm test -- --runInBand tests/unit/kwp-form-reports.repository.test.ts tests/unit/api-docs.openapi.test.ts` | FAIL: 8, PASS: 77 | fixture คืนเลขเดิม/จังหวัดผิด, SQL ไม่มี deterministic match และ OpenAPI ไม่มี KWP report response schemas |
| GREEN | command เดิม | PASS: 89/89 | fixture คืนเลข `10840002225552`, เลขเดิมแยก field, จังหวัด `สุราษฎร์ธานี`; SQL ใช้ ranked `OUTER APPLY`; OpenAPI ผูก response schema ทั้งสอง endpoint |

## Migration Decision

ไม่เพิ่ม schema หรือ data migration เพราะข้อมูล current identity มีอยู่แล้วใน active
`cems_wpms_connected_measurement_points` และ `eligible_factories` ปัญหาอยู่ที่ read-model
composition การ rewrite `kwp_form_submissions.factory_registration_no` จะทำลาย snapshot
ตอนยื่นและไม่จำเป็นต่อการแก้รายการเดิม หลัง deploy รายการเดิมถูก resolve ใหม่ตอนอ่านทันที

## Regression Guarantees

- active connected point ที่มี `eligible_factory_id` ได้ priority สูงสุด
- รองรับ submission snapshot ที่มีทั้งเลขทะเบียนใหม่และเลขทะเบียนเดิม
- เลือก eligible factory และ factory master อย่างละไม่เกินหนึ่งแถวแบบ deterministic
- หากหา current identity ไม่ได้ ยังคงคืน submission snapshot แทนการทำให้ข้อมูลหาย
- location, region, estate และ factory-type scopes ใช้ aliases จาก canonical factory chain เดียวกัน
- ไม่มีการแก้ frontend หรือข้อมูล production ในงานนี้

## Final Verification

- Focused repository, route และ OpenAPI suites ผ่าน `94/94` tests
- `npm test -- --runInBand --coverage --collectCoverageFrom=src/modules/kwp-form-reports/kwp-form-reports.repository.ts tests/unit/kwp-form-reports.repository.test.ts` ผ่าน `24/24` tests และได้ statements `80.48%`, branches `83.33%`, functions `81.25%`, lines `84.68%`
- `npm run build` และ `npm run typecheck` ผ่าน
- `npm test -- --runInBand` ผ่าน `149/149` suites และ `1548/1548` tests เมื่อรันวันที่ `2026-08-29`
