# Permission matrix rollout evidence

เอกสารนี้สนับสนุน canonical contract [สิทธิ์การใช้งาน](../../api/menus/permissions/README.md) และไม่ใช้แทน API contract

## Status

- Current state: verified after one-role and assignment-ceiling hardening. Backend full regression passed 120 suites / 1,201 tests. Backend typecheck, build, and lint also passed. This rollout does not modify `frontend/`.

## Planned checks

| Check | Target role or flow | Expected result | Evidence status |
| --- | --- | --- | --- |
| Role matrix, aliases and override narrowing | auth/users unit tests | ไม่เพิ่มสิทธิ์หรือขยาย scope; alias/grouped response ถูกต้อง | passed |
| Migration up/down mapping | migration unit test | role grants ใช้ snapshot ที่ versioned และ rollback คืนชุดเดิม | passed |
| Regional, province, estate and own-factory access | eligible, connection, KWP/BOD, CEMS repository/route tests | scope ขัดกันหรือ qualifier หายต้อง fail closed | passed |
| Permission groups and aliases | auth permission unit tests | grouped response และ permission aliases ตรงกับ matrix ที่ backend บังคับใช้ | passed |
| Alert status redaction | alert-events unit/route tests | ผู้ไม่มี `notifications:view_status` ได้ `null` | passed |
| One-role IdP synchronization | auth repository/service tests | specialized role ไม่ถูกเติม base role ซ้ำ; หลาย role ต้อง login ไม่ผ่าน | passed |
| Managed profile assignment | users validator/service tests | หนึ่ง region/province/estate, API account แก้ได้เฉพาะ authorization fields, role change ล้าง assignment เก่า | passed |
| Connected device writes | device service tests | create/test config นอก station scope ตอบ `403` | passed |

## Commands

```bash
cd backend
npm run typecheck
npm test -- --runInBand \
  tests/unit/auth.permissions.test.ts \
  tests/unit/auth.rbac-seeds.test.ts \
  tests/unit/auth.rbac-migration.test.ts \
  tests/unit/auth.repository.test.ts \
  tests/unit/auth.service.test.ts \
  tests/unit/users.service.test.ts \
  tests/unit/device-connections.service.test.ts \
  tests/unit/device-connections.route.test.ts \
  tests/unit/device-connections.access.repository.test.ts \
  tests/unit/monitoring-point-forms.route.test.ts \
  tests/unit/monitoring-point-forms.access.repository.test.ts \
  tests/unit/parameter-values.route.test.ts \
  tests/unit/parameter-values.repository.test.ts \
  tests/unit/eligible-factories.route.test.ts \
  tests/unit/eligible-factories.access.repository.test.ts \
  tests/unit/eligible-factories.service.test.ts \
  tests/unit/connection-requests.service.test.ts \
  tests/unit/connection-requests.repository.test.ts \
  tests/unit/alert-events.route.test.ts \
  tests/unit/alert-events.service.test.ts \
  tests/unit/kwp-form-reports.route.test.ts \
  tests/unit/kwp-form-submissions.route.test.ts \
  tests/unit/bod-cod-deviation-reports.route.test.ts

# Result: targeted security and matrix suites passed (2026-08-11)

# Full verification
cd backend && npm run typecheck && npm run build && npm test -- --runInBand
cd backend && npm run lint -- --quiet

# Scope guard
git diff --name-only origin/main..HEAD -- frontend

# Result: backend 120 suites / 1,201 tests passed; typecheck/build/lint passed;
# no frontend files are included in the rollout (2026-08-11)
```

## Notes

- ห้ามบันทึก token, password, หรือ credential จริง
- เมื่อเริ่มบันทึกผลจริง ให้เพิ่ม sanitized request/response snippets เฉพาะส่วนที่จำเป็นต่อการพิสูจน์ contract
