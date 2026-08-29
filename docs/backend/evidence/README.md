# Backend Evidence Index

หมวดนี้เก็บหลักฐานที่ช่วยตรวจสอบว่า contract หรือ business behavior ถูกทดสอบหรือสังเกตแล้ว เช่น TDD notes, verification checklist และ sanitized live-response snapshots

## Rules

- Evidence สนับสนุน canonical contract แต่ไม่แทน contract ใต้ `../api/`
- แยก directory ตาม business capability เดียวกับ menu, shared หรือ integration owner
- ระบุ command, environment และเงื่อนไขที่ใช้ตรวจเมื่อข้อมูลนั้นจำเป็นต่อการตีความผล
- ห้ามเก็บ token, password, API key, production credential หรือข้อมูลส่วนบุคคลจริง
- Snapshot ต้องระบุว่าเป็นหลักฐาน ณ เวลาหนึ่ง ห้ามให้ frontend ใช้แทน request/response contract ปัจจุบัน
- เอกสาร evidence ใหม่ต้องลิงก์กลับไป canonical API page หรือ explanation ที่มันสนับสนุน

## Connection requests

- [เลขที่คำขอใช้ลำดับ 4 หลักและปี พ.ศ. เต็ม](./connection-requests/request-number-full-year-format.tdd.md)
- [เจ้าหน้าที่เลือกใช้รหัสจุดตรวจวัดเดิมหรือให้ระบบออกรหัสอัตโนมัติ](./connection-requests/point-code-assignment-options.tdd.md)
- [คืนรหัสจุดตรวจวัดเป็น S/W เริ่มที่ 2001](./connection-requests/legacy-point-code-format-restored.tdd.md)
- [รหัสจุดตรวจวัดแบบลำดับรายปี](./connection-requests/annual-point-code-format.tdd.md)
- [ฟอร์มเพิ่มจุดส่งสถานะไปพร้อม `POST /measurement-points`](./connection-requests/add-measurement-point-submission-action.tdd.md)
- [Direct Connection ไม่บังคับเอกสารหรือรูปภาพ](./connection-requests/direct-connection-optional-documents.tdd.md)
- [Direct Connection รับ optional fields เป็น null](./connection-requests/direct-connection-nullable-fields.tdd.md)
- [เลขคำขอเจ้าหน้าที่ใช้ลำดับร่วมกับผู้ประกอบการ](./connection-requests/officer-direct-shared-request-numbering.tdd.md)
- [Normalize อักขระซ่อนในอีเมลคำขอเชื่อมต่อ](./connection-requests/email-invisible-character-normalization.tdd.md)
- [เจ้าหน้าที่เชื่อมต่อโรงงานเข้าข่ายโดยตรง](./connection-requests/officer-direct-eligible-lookup.tdd.md)
- [ชื่อโรงงานในตารางรายการคำขอใช้ current/live POMS](./connection-requests/request-table-current-factory-name.tdd.md)
- [จุดตรวจวัดที่ได้รับการยกเว้นทั้งหมดเป็น Active POMS Point](./connection-requests/fully-exempted-active-point.tdd.md)

## Eligible factories

- [จังหวัดในที่อยู่ตั้งแต่ Candidate ถึง connected POMS](./eligible-factories/factory-address-province.tdd.md)

## Shared operations

- [ล้างข้อมูลทดสอบด้วย SQL](./shared/test-data-cleanup.tdd.md)
- [Frontend monitoring contract 05082026](./shared/frontend-monitoring-contract-05082026.tdd.md)
- [ปฏิทินรายเดือนและจำนวนวันสรุปทั้งปี](./shared/calendar-summary-requested-year-counts.tdd.md)
- [รายละเอียดรายวันทั้งปีสำหรับคลิกสรุป Calendar Status](./shared/calendar-status-details.tdd.md)
- [กรอง Source Status ก่อนประเมิน Calendar](./shared/calendar-normal-status-filter.tdd.md)
- [คำนวณ Calendar completeness ของวันปัจจุบันถึงชั่วโมงปัจจุบัน](./shared/calendar-current-day-completeness.tdd.md)

## Home

- [โรงงานของผู้ประกอบการพร้อมสถานะ POMS](./home/operator-owned-factory-overview.tdd.md)
- [โรงงานที่เจ้าหน้าที่เชื่อมต่อแสดงบนหน้าหลัก](./home/officer-direct-connected-dashboard.tdd.md)
- [ชื่อโรงงานหน้าหลักใช้ข้อมูล current/live POMS](./home/operator-dashboard-current-factory-name.tdd.md)
- [ส่งออกข้อมูลตรวจวัดของจุดเชื่อมต่อเป็น CSV](./home/connected-measurement-csv-export.tdd.md)

## KWP forms

- [เลขคำขอ กวภ. แยกตามแบบ ภาค และปี](./kwp-forms/request-numbering.tdd.md)
- [ชื่อโรงงานในเมนู กวภ. ใช้ข้อมูล current/live POMS](./kwp-forms/factory-table-current-factory-name.tdd.md)
- [เลขทะเบียนและจังหวัดในตาราง กวภ. ใช้ factory identity เดียวกัน](./kwp-forms/request-table-factory-identity.tdd.md)

## BOD/COD deviation reports

- [เลขรายงาน BOD/COD แยกตามภาคและปี](./bod-cod-deviation-reports/request-numbering.tdd.md)

## Permissions

- [Permission matrix rollout evidence](./permissions/permission-matrix-rollout.tdd.md)

## Integrations

- [Dashboard ข้อมูลตรวจวัดรายโรงงานสำหรับระบบภายนอก](./integrations/factory-dashboard-api.tdd.md)
- [Test Mode ของ Device Config Channel](./integrations/device-config-test-mode.tdd.md)
- [การรายงานค่าต่อพารามิเตอร์ใน Device Config](./integrations/device-config-parameter-reporting.tdd.md)
- [ประเภทจุดตรวจวัดใน Device Config](./integrations/device-config-point-types.tdd.md)
- [สัญญาเวลารายชั่วโมงของ Integration Alert Events](./integrations/alert-event-hourly-time.tdd.md)

## Migration Targets

| Legacy evidence                            | Destination pattern                                                       |
| ------------------------------------------ | ------------------------------------------------------------------------- |
| `docs/testing/*.tdd.md`                    | `docs/backend/evidence/<capability>/`                                     |
| `docs/APIDoc/live-api-responses/*.md`      | `docs/backend/evidence/live-api-responses/` หรือ capability ที่เกี่ยวข้อง |
| Backend checklist และ rollout verification | `docs/backend/evidence/<capability>/`                                     |

ยังไม่ย้าย evidence เดิมในงานออกแบบนี้ ให้ทำตาม [documentation migration workflow](../explanations/documentation-migration-workflow.md)
