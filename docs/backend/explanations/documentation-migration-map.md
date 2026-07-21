# Backend Documentation Migration Map

เอกสารนี้กำหนดปลายทางของ legacy backend Markdown เพื่อให้การย้ายแต่ละ batch ตัดสินใจได้โดยไม่สร้าง canonical contract ซ้ำ ดูกติกา execution ที่ [documentation migration workflow](./documentation-migration-workflow.md)

## Action Vocabulary

| Action | Meaning |
| --- | --- |
| `merge` | รวมเฉพาะเนื้อหาที่ยังตรงกับ code และ tests เข้า canonical page |
| `split` | แยก contract, explanation และ evidence ไปคนละหมวด |
| `pointer` | แทน legacy file ด้วยลิงก์สั้นไป canonical page เป็นเวลา 1 deployment cycle |
| `archive` | เก็บเฉพาะข้อมูลประวัติที่ไม่มีเนื้อหาซ้ำกับ active docs |
| `freeze` | ห้ามแก้ไฟล์เดิมใน scope นี้ และไม่ถือเป็น canonical source |

## Batch 1 — Shared Foundation

| Legacy source | Canonical destination | Action |
| --- | --- | --- |
| `APIDoc/01-auth.md` | `docs/backend/api/shared/authentication/README.md` | `merge`, then `pointer` |
| `docs/API.md` | `docs/backend/api/shared/authentication/README.md` | `merge`, then `pointer` |
| `docs/APIDoc/AUTH_LOGIN_RESPONSE_FRONTEND_HANDOFF.md` | authentication contract และ `docs/backend/evidence/authentication/` | `split`, then `pointer` |
| `docs/testing/auth-account-separation.tdd.md` | `docs/backend/evidence/authentication/` | move as evidence |
| `docs/testing/login-without-account-type.tdd.md` | `docs/backend/evidence/authentication/` | move as evidence |
| Connected-point sections ใน `backend/docs/FRONTEND_HANDOFF.md` | `docs/backend/api/shared/connected-measurement-points/README.md` | `merge` |
| Connected-point live responses และ TDD notes | `docs/backend/evidence/connected-measurement-points/` | move as evidence |
| Shared response, pagination และ error conventions จาก legacy API docs | `docs/backend/api/shared/common-api/README.md` | `merge` |

## Batch 2 — High-risk Menus

| Legacy source | Canonical destination | Action |
| --- | --- | --- |
| `APIDoc/04-cems-wpms-requests.md` | `docs/backend/api/menus/connection-requests/` | `merge`, then `pointer` |
| `docs/APIDoc/CEMS_WPMS_REQUEST_APIS.md` | connection-request landing page และ focused subpages | `split`, then `pointer` |
| `docs/APIDoc/CEMS_WPMS_REQUEST_FORM_FRONTEND_HANDOFF.md` | connection contract และ `docs/backend/evidence/connection-requests/` | `split`, then `pointer` |
| `docs/APIDoc/CEMS_WPMS_REQUEST_FORM_BACKEND_CHECKLIST.md` | `docs/backend/evidence/connection-requests/` | move as evidence |
| Connection-request TDD files ใต้ `docs/testing/` | `docs/backend/evidence/connection-requests/` | move as evidence |
| `APIDoc/06-parameter-values.md` | `docs/backend/api/menus/connection-requests/parameter-values.md` | correct auth, `merge`, then `pointer` |
| `APIDoc/03-eligible-factories.md` | `docs/backend/api/menus/eligible-factories/README.md` | `merge`, then `pointer` |
| `docs/APIDoc/ELIGIBLE_FACTORY_CANDIDATES.md` | eligible-factories contract หรือ focused subpage | `merge`, then `pointer` |
| `docs/monitoring-point-forms.md` | eligible-factories contract และ data-model explanation | `split`, then `pointer` |
| Eligible-factory และ monitoring-point TDD files | `docs/backend/evidence/eligible-factories/` | move as evidence |
| `APIDoc/02-users.md` | `docs/backend/api/menus/permissions/README.md` | `merge`, then `pointer` |
| `backend/docs/PERMISSIONS.md` | permission contract และ `docs/backend/explanations/permission-model.md` | `split`, then `pointer` |

ก่อนจบ batch นี้ต้องแก้ conflict ต่อไปนี้จาก code/tests: `parameter-values` authentication, request endpoint variants และ permission-scope vocabulary

## Batch 3 — Remaining Menus

| Legacy source | Canonical destination | Action |
| --- | --- | --- |
| `docs/APIDoc/OPERATOR_FACTORY_DASHBOARD.md` | `docs/backend/api/menus/home/README.md` | `split`, then `pointer` |
| Dashboard, public-map และ point-detail TDD files | `docs/backend/evidence/home/` | move as evidence |
| `docs/APIDoc/KWP_FORM_SUBMISSION_APIS.md` | `docs/backend/api/menus/kwp-forms/submissions.md` | `merge`, then `pointer` |
| `docs/APIDoc/KWP_FORM_REPORT_APIS.md` | `docs/backend/api/menus/kwp-forms/reports.md` | `merge`, then `pointer` |
| KWP TDD files | `docs/backend/evidence/kwp-forms/` | move as evidence |
| `docs/APIDoc/BOD_COD_DEVIATION_REPORT_APIS.md` | `docs/backend/api/menus/bod-cod-deviation-reports/` | `split`, then `pointer` |
| BOD/COD TDD files | `docs/backend/evidence/bod-cod-deviation-reports/` | move as evidence |
| Alert list/detail/status contract จาก alert docs | `docs/backend/api/menus/notifications/README.md` | `split`, then `pointer` |
| `docs/alert-notification-design.md` | `docs/backend/explanations/alert-notification-design.md` | move explanation, then `pointer` |
| `docs/APIDoc/ALERT_NOTIFICATION_DB_MANUAL.md` | `docs/backend/explanations/alert-notification-data-model.md` | `merge`, then `pointer` |

## Batch 4 — Integrations, Guides And Cleanup

| Legacy source | Canonical destination | Action |
| --- | --- | --- |
| `APIDoc/05-device-connections.md` | `docs/backend/api/integrations/device-connections/README.md` | `merge`, then `pointer` |
| `docs/APIDoc/INTEGRATION_DEVICE_CONFIGS.md` | `docs/backend/api/integrations/device-configs/README.md` | `merge`, then `pointer` |
| `docs/APIDoc/INTEGRATION_DEVICE_CONFIGS_MANUAL.md` | device-config consumer guide ใน directory เดียวกัน | `merge`, then `pointer` |
| `docs/APIDoc/INTEGRATION_ALERT_EVENTS_MANUAL.md` | `docs/backend/api/integrations/alert-events/README.md` | `merge`, then `pointer` |
| `docs/APIDoc/OFFICER_NOTIFICATION_EMAIL_RECIPIENTS.md` | `docs/backend/api/shared/notification-recipients/README.md` | `merge`, then `pointer` |
| `backend/docs/API_TESTING.md` | `docs/backend/guides/api-manual-testing.md` และ evidence | `split`, then `pointer` |
| `backend/docs/WINDOWS_DEPLOYMENT.md` | `docs/backend/guides/windows-deployment.md` | `merge`, then `pointer` |
| `backend/docs/SCHEMA.md` | database explanation และ historical archive | `split`, then `pointer` |
| `docs/APIDoc/DERIVED_FIELD_LOGIC.md` | `docs/backend/explanations/derived-field-logic.md` | move, then `pointer` |
| `docs/APIDoc/live-api-responses/*.md` | `docs/backend/evidence/` ตาม capability | move as evidence |
| `backend/PROGRESS.md`, `docs/progress.md`, `docs/GIT_WORK_ARCHIVE.md` | `docs/backend/archive/` เมื่อมีคุณค่าทางประวัติ | `archive` หรือใช้ Git history |
| `backend/README.md` | setup/deployment guides และ README แบบสั้น | `split` |

## Frontend Boundary — No Migration Action

ไฟล์ต่อไปนี้เป็น legacy backend-contract copies แต่ผู้ใช้ยืนยันว่า migration นี้ห้ามแก้ `frontend/md/` จึงใช้ `freeze` และไม่นับเป็น canonical source:

- `frontend/md/ALERT_NOTIFICATION_DB_MANUAL.md`
- `frontend/md/AUTH_LOGIN_RESPONSE_FRONTEND_HANDOFF.md`
- `frontend/md/API.md`
- `frontend/md/BOD_COD_DEVIATION_REPORT_APIS.md`
- `frontend/md/CEMS_WPMS_REQUEST_APIS.md`
- `frontend/md/KWP_FORM_REPORT_APIS.md`
- `frontend/md/KWP_FORM_SUBMISSION_APIS.md`
- `frontend/md/OPERATOR_FACTORY_DASHBOARD.md`

## Completion Check Per Batch

1. Canonical page ตรงกับ routes, validators, public types และ tests
2. Endpoint owner ใน `docs/backend/api/ENDPOINTS.md` ชี้ canonical destination ที่มีอยู่จริง
3. Contract, explanation และ evidence ไม่คัดลอกเนื้อหากัน
4. Category index และ backend hub เดินทางถึงเอกสารใหม่ได้
5. Legacy source ใน scope เหลือเพียง pointer สั้นและมีวันที่เริ่ม deployment cycle ใน PR summary
6. Relative-link check และ docs impact declaration ผ่าน
