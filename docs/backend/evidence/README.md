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

- [เจ้าหน้าที่เชื่อมต่อโรงงานเข้าข่ายโดยตรง](./connection-requests/officer-direct-eligible-lookup.tdd.md)

## Home

- [โรงงานที่เจ้าหน้าที่เชื่อมต่อแสดงบนหน้าหลัก](./home/officer-direct-connected-dashboard.tdd.md)
- [ชื่อโรงงานหน้าหลักใช้ข้อมูล current/live POMS](./home/operator-dashboard-current-factory-name.tdd.md)

## Migration Targets

| Legacy evidence | Destination pattern |
| --- | --- |
| `docs/testing/*.tdd.md` | `docs/backend/evidence/<capability>/` |
| `docs/APIDoc/live-api-responses/*.md` | `docs/backend/evidence/live-api-responses/` หรือ capability ที่เกี่ยวข้อง |
| Backend checklist และ rollout verification | `docs/backend/evidence/<capability>/` |

ยังไม่ย้าย evidence เดิมในงานออกแบบนี้ ให้ทำตาม [documentation migration workflow](../explanations/documentation-migration-workflow.md)
