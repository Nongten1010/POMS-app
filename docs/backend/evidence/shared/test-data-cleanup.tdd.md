# TDD evidence: test-data cleanup SQL

เอกสารนี้เป็นหลักฐาน TDD สำหรับสคริปต์ล้างข้อมูลทดสอบในฐาน POMS หลักและฐาน Parameter โดยรองรับเฉพาะข้อมูลที่มี marker ชัดเจนหรือผู้ปฏิบัติงานระบุเลขอ้างอิงเองเท่านั้น

เอกสารนี้สนับสนุนคู่มือปฏิบัติการด้านล่างและอ้างอิง contract ของ [เมนูคำขอเชื่อมต่อ](../../api/menus/connection-requests/README.md) กับ [เมนูแบบ กวภ.](../../api/menus/kwp-forms/README.md) โดยไม่ใช้แทน canonical API contract

## Source plan

- งานนี้มาจากการวางแผน cleanup test data ในแชตเดียวกัน ไม่มีไฟล์ `*.plan.md`
- Canonical guide: [ล้างข้อมูลทดสอบด้วย SQL](../../guides/test-data-cleanup.md)

## User journeys

1. As a backend operator, I want a dry-run SQL cleanup for known test data, so that I can review impact before deleting anything.
2. As a backend operator, I want the script to require exact database confirmation and backup confirmation, so that I do not delete rows in the wrong database.
3. As a backend operator, I want KWP/BOD manual test data to require explicit identifiers, so that format-based over-deletion cannot happen.
4. As a backend operator, I want Parameter cleanup limited to allow-listed stations, tables, and date windows, so that cleanup stays inside known mock ranges.

## Task report

| Task | Validation command | Result | Guarantee |
| --- | --- | --- | --- |
| Add SQL safety tests before implementing the scripts | `npm test -- --runInBand tests/unit/test-data-cleanup-sql.test.ts` | RED: 4 tests failed because both cleanup scripts did not exist | The test establishes the required safety contract before implementation |
| Add guarded cleanup scripts | `npm test -- --runInBand tests/unit/test-data-cleanup-sql.test.ts` | GREEN: 4 tests passed | Both scripts satisfy the initial static safety contract |
| Store cleanup evidence and index it | `npm test -- --runInBand tests/unit/test-data-cleanup-sql.test.ts` | GREEN: 5 tests passed | The cleanup workflow has indexed evidence |
| Make cleanup rerunnable in the same SQL session | `npm test -- --runInBand tests/unit/test-data-cleanup-sql.test.ts` | RED on retained temp tables, then GREEN: 6 tests passed | A dry run or commit no longer causes duplicate `#Target...` errors on the next run |
| Harden destructive cleanup review | `npm test -- --runInBand tests/unit/test-data-cleanup-sql.test.ts` | RED: missing alert detail output and preloaded Parameter scope; GREEN: 7 tests passed | POMS dry runs show targeted alerts and Parameter execution requires an explicit empty-by-default scope plus an exact reviewed row count |

## Test specification

| # | What is guaranteed | Test file or command | Test type | Result | Evidence |
| --- | --- | --- | --- | --- | --- |
| 1 | Both cleanup scripts exist in `backend/db/` | `backend/tests/unit/test-data-cleanup-sql.test.ts` | unit/static | PASS | `npm test -- test-data-cleanup-sql.test.ts` |
| 2 | Both scripts default to `@Execute = 0`, require `@ExpectedDatabase`, require `@BackupConfirmed`, and include transaction guards with rollback/commit paths | `backend/tests/unit/test-data-cleanup-sql.test.ts` | unit/static | PASS | `npm test -- test-data-cleanup-sql.test.ts` |
| 3 | Main cleanup script includes only known seed request markers plus explicit target tables for manually added KWP and BOD/COD identifiers | `backend/tests/unit/test-data-cleanup-sql.test.ts` | unit/static | PASS | `npm test -- test-data-cleanup-sql.test.ts` |
| 4 | Main cleanup script does not issue `DELETE` against preserved master/sequence tables (`users`, `factories`, `eligible_factories`, sequence tables) and does not use `TRUNCATE` | `backend/tests/unit/test-data-cleanup-sql.test.ts` | unit/static | PASS | `npm test -- test-data-cleanup-sql.test.ts` |
| 5 | Parameter cleanup script is constrained to allow-listed tables, known station IDs, known mock date windows, and dynamic SQL with `QUOTENAME`/`sp_executesql` | `backend/tests/unit/test-data-cleanup-sql.test.ts` | unit/static | PASS | `npm test -- test-data-cleanup-sql.test.ts` |
| 6 | Cleanup workflow stores a canonical evidence document under `docs/backend/evidence/` | `backend/tests/unit/test-data-cleanup-sql.test.ts` | unit/static | PASS | `npm test -- test-data-cleanup-sql.test.ts` |
| 7 | Parameter deletion scope is empty by default and execution requires explicit scope confirmation plus an exact reviewed total | `backend/tests/unit/test-data-cleanup-sql.test.ts` | unit/static | PASS | `npm test -- test-data-cleanup-sql.test.ts` |
| 8 | POMS dry run lists each targeted mock alert with its identifying fields | `backend/tests/unit/test-data-cleanup-sql.test.ts` | unit/static | PASS | `npm test -- test-data-cleanup-sql.test.ts` |

## RED/GREEN excerpts

### RED

`npm test -- --runInBand tests/unit/test-data-cleanup-sql.test.ts`

```text
FAIL tests/unit/test-data-cleanup-sql.test.ts
  test-data cleanup SQL scripts
    ✕ provides one guarded script for each database

Test Suites: 1 failed, 1 total
Tests:       4 failed, 4 total
```

Root cause: `backend/db/cleanup_poms_test_data.sql` และ `backend/db/cleanup_parameter_test_data.sql` ยังไม่มี

### GREEN

Validation command rerun after adding the evidence file:

```bash
npm test -- --runInBand tests/unit/test-data-cleanup-sql.test.ts
```

```text
Test Suites: 1 passed, 1 total
Tests:       5 passed, 5 total
```

## Coverage and known gaps

- Validation in this task is static and document-oriented; it checks the SQL structure and safety guards, not live database execution.
- No cleanup script was executed against any database in this task.
- Parameter rows have no durable seed-origin marker, so operators must keep the scope empty until they verify each station/table/date bucket and its exact candidate count.
- File deletion from storage is intentionally out of scope for the SQL scripts; operators must review `storage_path` outputs separately.
- Full backend suite: `92` suites and `812` tests passed.
- `npm run typecheck`, ESLint on the new test, and `git diff --check` passed.

## Merge evidence

- RED: safety tests failed because the cleanup scripts did not exist.
- GREEN: guarded scripts, indexed evidence, and the operational guide were added; the focused suite passed.
