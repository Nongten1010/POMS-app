# Backend Documentation Migration Workflow

> สถานะ: แบบร่างระหว่าง grilling; ยังไม่อนุญาตให้ย้ายหรือลบ legacy files

## Goal

รวม backend Markdown ที่ยังใช้งานเข้า `docs/backend/` โดยสร้าง canonical contract จาก implementation ปัจจุบัน แยก evidence และ explanations ออกจาก contract และเลิกเก็บสำเนาใน legacy locations

## Trigger

เริ่ม workflow เมื่อ information architecture, source mapping, migration sequence และสิทธิ์แก้ legacy paths ได้รับการยืนยันครบ

## Canonical Menu Targets

| Directory | Display name | Main API families |
| --- | --- | --- |
| `api/menus/home/` | หน้าหลัก | operator dashboard, public map, favorite, point details |
| `api/menus/connection-requests/` | ขอเชื่อมต่อ | CEMS/WPMS requests, parameter values, connection workflow |
| `api/menus/eligible-factories/` | โรงงานที่เข้าข่าย | eligible factories, monitoring-point forms |
| `api/menus/kwp-forms/` | แจ้งแบบ กวภ. 01 - กวภ. 05 | submissions, reports, workflow |
| `api/menus/bod-cod-deviation-reports/` | รายงานค่าความคลาดเคลื่อน BOD/COD Online | deviation reports, result notices |
| `api/menus/notifications/` | การแจ้งเตือน | alert list, detail, status |
| `api/menus/permissions/` | สิทธิ์การใช้งาน | users, roles, permission overrides |

Cross-menu contracts เช่น authentication และ connected measurement points ต้องอยู่ใต้ `api/shared/` หน้าเมนูลิงก์อ้างอิงและไม่คัดลอก contract

## Shared And Integration Targets

```text
api/shared/
├── common-api/
├── authentication/
├── connected-measurement-points/
├── notification-recipients/
└── internal-tools/

api/integrations/
├── device-configs/
├── alert-events/
└── device-connections/
```

`parameter-values` เป็น focused subpage ของ `api/menus/connection-requests/` เพราะ current frontend consumer อยู่ในเมนูนั้นและ route ใช้ bearer permission ไม่ใช่ external API key

## Legacy Source Sets

- `APIDoc/` — API handoff รุ่นเก่าและข้อมูลบางส่วนที่ขัดกับ runtime
- `docs/APIDoc/` — contract, integration manuals และ live-response evidence ที่ปนกัน
- `backend/docs/` — setup, schema, permissions, testing และ handoff แบบรวม
- `docs/testing/` — TDD evidence
- `docs/*.md` — feature explanations และ historical notes
- `NOTES.md` และ `workflows/*.md` — backend terminology และ workflow specs ที่ยังอยู่นอก canonical tree
- `frontend/md/` — มี backend-contract copies ที่ drift และ frontend-only notesปะปนกัน แต่ไม่อยู่ในขอบเขตการแก้ไขของ migration นี้

## Frontend Boundary

- ห้ามแก้ ย้าย ลบ หรือแทน pointer ใน `frontend/md/`
- ห้ามแก้ `frontend/src/` หรือ frontend application code
- Backend canonical content ต้องสร้างจาก implementation และแหล่ง legacy ที่อยู่ในขอบเขต โดยไม่ใช้ frontend copy เป็น destination
- สำเนาเดิมใต้ `frontend/md/` จะยังคงเป็น legacy non-canonical material และต้องไม่ถูกนับว่า migration กำจัดสำเนาทั้ง repository แล้ว

### Frozen Legacy Contract Copies

CI ต้องปฏิเสธการแก้ไฟล์ต่อไปนี้และชี้ให้แก้ canonical document แทน โดยห้ามแก้เนื้อหาในไฟล์เอง:

- `frontend/md/ALERT_NOTIFICATION_DB_MANUAL.md`
- `frontend/md/AUTH_LOGIN_RESPONSE_FRONTEND_HANDOFF.md`
- `frontend/md/API.md`
- `frontend/md/BOD_COD_DEVIATION_REPORT_APIS.md`
- `frontend/md/CEMS_WPMS_REQUEST_APIS.md`
- `frontend/md/KWP_FORM_REPORT_APIS.md`
- `frontend/md/KWP_FORM_SUBMISSION_APIS.md`
- `frontend/md/OPERATOR_FACTORY_DASHBOARD.md`

ไฟล์ frontend-only และไฟล์ผสมอื่นไม่อยู่ใน freeze นี้ แต่ไม่มีไฟล์ใดใต้ `frontend/md/` เป็น canonical backend contract

## Skill-managed Workspace Exception

- `NOTES.md` และ `workflows/*.md` คงอยู่ที่ repository root ตามข้อกำหนดของ `loop-me`
- ไฟล์เหล่านี้เป็น raw notes และ workflow specs ไม่ใช่ published API contract
- `docs/backend/README.md` ต้องลิงก์ไปยังไฟล์เหล่านี้เพื่อให้ backend owner ค้นพบได้จาก hub เดียว
- Strict placement checks ต้อง allowlist exact paths นี้ แต่ยังตรวจ links เมื่อไฟล์ถูกเปลี่ยน

## High-risk Conflicts

1. Legacy parameter-value docs ระบุว่า public แต่ runtime บังคับ authentication และ `cems_wpms_requests:view`
2. Connection-request docs แต่ละรุ่นครอบคลุม endpoint คนละชุด ขณะที่ runtime mount ทั้ง legacy และ newer flows
3. Permission-scope vocabulary ในเอกสารเก่าไม่ตรงกับ runtime values เช่น `OWN_FACTORY`, `IN_PROVINCE`, `IN_ESTATE` และ `IN_REGION`
4. Backend contracts ใน `frontend/md/` หลายไฟล์เป็นสำเนาที่ drift จาก `docs/APIDoc/`

## Migration Rule Per Document

1. ตรวจ source กับ routes, validators, public types และ tests
2. รวมเฉพาะ contract ปัจจุบันเข้า canonical target จาก template
3. ย้าย explanations และ evidence ไปหมวดของตนโดยใช้ links แทนสำเนา
4. ตรวจ index reachability และ relative links
5. แทน legacy source ด้วย pointer เป็นเวลา 1 deployment cycle
6. ลบ pointer หลัง repository links เปลี่ยนครบ; ใช้ Git history แทน duplicate archive

## Migration Batches

หนึ่ง capability ต้องย้าย contract, explanations, evidence, indexes และ legacy pointers ที่เกี่ยวข้องให้ครบใน batch เดียว

1. **Shared foundation** — common conventions, shared error envelope, authentication และ connected measurement points
2. **High-risk menus** — ขอเชื่อมต่อ, โรงงานที่เข้าข่าย และสิทธิ์การใช้งาน
3. **Remaining menus** — หน้าหลัก, แจ้งแบบ กวภ. 01 - กวภ. 05, รายงานค่าความคลาดเคลื่อน BOD/COD Online และการแจ้งเตือน
4. **Integrations and cleanup** — external APIs, remaining guides/explanations/evidence, legacy-pointer cleanup และการเปิด strict CI

## Decisions Still In Progress

- วิธี implement route extractor และ CI docs guard ที่เทียบ mounted `Method + Path` กับ `docs/backend/api/ENDPOINTS.md`
- รายละเอียด file-by-file mapping และ pointer สำหรับแต่ละ migration batch
