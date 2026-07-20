# Auth account separation — TDD evidence

วันที่: 2026-07-20

## Scope

- แยกบัญชี POMS กับ API ด้วย request `accountType`.
- แยก DPIS U-code (`diw_dpis`) กับ i-Industry เลข 13 หลัก (`i_industry`).
- ใช้ submitted login เป็น provider-scoped account key และไม่ใช้ `percardno` / `per_cardno` เป็น identity.
- เพิ่ม canonical auth response `accountType`, `name`, `officerProfile`, `roleCodes` พร้อม legacy aliases ชั่วคราว.
- ป้องกัน managed-user API จากการเปลี่ยน external identity/profile.
- backfill legacy `division_name_th` โดยไม่ overwrite ค่าที่มีอยู่.

## RED

คำสั่ง:

```bash
npm test -- --runInBand tests/unit/auth.validator.test.ts tests/unit/diw-user-login.identity-provider.test.ts tests/unit/auth.service.test.ts tests/unit/officer-division-name-backfill.test.ts
```

ผล: 4 suites failed ตามที่ตั้งใจ เพราะยังไม่มี `accountType`, API ยังทำ local-first lookup, parser ยังใช้ person number เป็น `external_id`, response ยังไม่มี canonical fields และยังไม่มี migration `0072`.

Managed-user RED:

```bash
npm test -- --runInBand tests/unit/users.validator.test.ts tests/unit/users.service.test.ts
```

ผล: failed เพราะ response-shaped API payload ยัง derive `externalId` จาก username และ service ยังยอมเปลี่ยน API identity/profile.

## GREEN

Focused auth/users/migration verification:

```bash
npm test -- --runInBand tests/unit/auth.repository.test.ts tests/unit/auth.validator.test.ts tests/unit/diw-user-login.identity-provider.test.ts tests/unit/auth.service.test.ts tests/unit/users.validator.test.ts tests/unit/users.service.test.ts tests/unit/officer-organization-names-migration.test.ts tests/unit/officer-division-name-backfill.test.ts
```

ผล: 8 suites, 80 tests passed. ชุดนี้รวม API-profile guard, POMS account-key rename/consistency, managed-user legacy username และกรณีสอง provider คืน person number เดียวกัน.

TypeScript:

```bash
npm run typecheck
```

ผล: passed.

Focused coverage ของ auth/users logic และ migration ที่เปลี่ยน: line coverage **81.16%** (6 suites, 72 tests passed).

Full backend regression:

```bash
npm test -- --runInBand
```

ผล: 56 suites passed, 1 unrelated suite failed; 630/631 tests passed. Failure เดิมอยู่ที่ `eligible-factories.validator.test.ts` ซึ่งคาดรหัสประเภทโรงงาน 4 หลัก แต่ worktree ปัจจุบันคืนค่า normalized 5 หลัก และอยู่นอก scope auth นี้.

## Remaining deployment checks

- Apply migrations `0071` และ `0072` บน staging MSSQL และตรวจ unresolved legacy division rows.
- สร้าง report ของ `identity_provider = officer_dpis`; ห้าม auto-merge หรือ auto-copy permissions.
- ปรับ frontend ให้ส่ง `accountType` และอ่าน `roleCodes`/canonical nested fields ก่อนยกเลิก legacy aliases/fallback.
- ทดสอบ staging ด้วยบัญชีทดสอบของทั้งสามช่องทางโดยไม่บันทึก credential หรือ raw upstream payload ลง log.
