# หลักฐาน TDD: Permission Management contract alignment

เอกสารนี้สนับสนุน canonical contract [สิทธิ์การใช้งาน](../../api/menus/permissions/README.md#permission-management-editable-contract) และ [User management API](../../api/menus/permissions/user-management-api.md) ไม่ใช้แทน API contract

## Source contract

- Frontend handoff: [`frontend/md/fixed-29082026.md`](../../../../frontend/md/fixed-29082026.md)
- Runtime OpenAPI source: [`backend/src/modules/api-docs/poms.openapi.ts`](../../../../backend/src/modules/api-docs/poms.openapi.ts)

## User journeys

1. ผู้ดูแลเปิดรายละเอียดผู้ใช้แล้วได้รับ editable permission matrix ที่มี action ครบและไม่มี internal actions
2. Frontend ส่ง binary modules โดยไม่มี `data`, `region`, `province` และ backend แปลงเป็น raw binary overrides ได้
3. บัญชี API/IdP ส่ง locked display values เดิมกลับมาได้โดย backend ไม่เขียนทับข้อมูลที่ provider เป็นเจ้าของ
4. การแก้ editable permissions ไม่ล้าง hidden deny/narrowing overrides และไม่เปิดสิทธิ์กลับจาก role default โดยไม่ตั้งใจ
5. Scoped permission groups ส่งและคืนเฉพาะ `data`, `region`, `province` โดยไม่มี `estateCode` หรือ `estate`

## RED/GREEN evidence

| Guarantee | Test target | RED evidence | GREEN evidence |
| --- | --- | --- | --- |
| Editable response ไม่มี internal actions และ binary scopes | `tests/unit/auth.permissions.test.ts` | compile error เพราะยังไม่มี `projectEditablePermissionGroups` | targeted suite ผ่าน |
| Request schema ปฏิเสธ removed fields/actions | `tests/unit/users.validator.test.ts` | schema เดิมยังรับ `helpdesk.data`, `connection.direct_connect`, `api_documentation` | targeted suite ผ่าน |
| API account round-trip ไม่สร้าง provider-owned patch | `tests/unit/users.validator.test.ts` | parsed result ยังมี `departmentNameTh`, `lineNameTh`, `levelNameTh` | targeted suite ผ่าน |
| Grouped PATCH รักษา hidden overrides | `tests/unit/users.service.test.ts` | repository ได้เฉพาะ editable override และ hidden overrides หาย | targeted suite ผ่าน |
| OpenAPI ใช้ editable schema และ GET response ที่เจาะจง | `tests/unit/api-docs.openapi.test.ts` | ยังไม่มี `EditablePermissionGroups`/`ManagedUserEditResponse` | targeted suite ผ่าน |

RED command:

```bash
npm test -- --runInBand tests/unit/auth.permissions.test.ts tests/unit/users.validator.test.ts tests/unit/users.service.test.ts tests/unit/api-docs.openapi.test.ts
```

ผล RED: `4` test suites ล้มเหลว, `6` tests ล้มเหลว, `114` tests ผ่าน เนื่องจาก behavior ที่ต้องแก้ตามรายการด้านบน

GREEN command เดียวกัน: `4/4` suites และ `135/135` tests ผ่าน

### Estate qualifier correction

หลังยืนยันกับ frontend ว่า grouped permissions ไม่ใช้ `estateCode` และ `estate` เพิ่ม regression assertions ที่ response projection, request validator และ OpenAPI ก่อนแก้ implementation

RED command:

```bash
npm test -- --runInBand tests/unit/users.service.test.ts tests/unit/users.validator.test.ts tests/unit/api-docs.openapi.test.ts
```

ผล RED: `3/3` suites ล้มเหลว, `3` tests ล้มเหลว และ `117` tests ผ่าน เพราะ response ยังคืน estate qualifiers, validator ยังรับ fields และ OpenAPI ยังประกาศ fields เหล่านี้

GREEN command เดียวกัน: `3/3` suites และ `120/120` tests ผ่าน หลังตัด fields ออกจาก Permission Management projection, grouped validator และ OpenAPI schema โดยไม่เปลี่ยน user profile assignment หรือ raw permission override contract

## Verification

| Command | Result |
| --- | --- |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS, `0` errors; มี formatting warnings เดิมกระจายทั้ง repository |
| `npm run build` | PASS |
| `npm test -- --runInBand` | PASS, `149/149` suites และ `1553/1553` tests |
| Initial rollout `npm run test:coverage -- --runInBand` | PASS นอก sandbox, `149/149` suites และ `1553/1553` tests |
| Estate correction full coverage | `148/149` suites และ `1551/1553` tests ผ่าน; failure อยู่ที่ measurement CSV ซึ่งรันเดี่ยวผ่าน `11/11` |
| Estate correction targeted coverage | PASS, `3/3` suites และ `120/120` tests; `users.service.ts` lines `81.25%`, `users.validator.ts` lines `92.39%` |

Coverage ทั้ง repository: statements `66.83%`, branches `64.8%`, functions `69.81%`, lines `68.62%`. ค่า global ต่ำกว่าเป้าหมายของ skill เพราะ migrations/repositories เดิมจำนวนมากไม่มี coverage; modules ที่แก้มี `users.service.ts` lines `81.25%` และ `users.validator.ts` lines `92.39%` งานนี้ไม่ขยาย scope ไปเติม coverage ของ legacy modules

## Security evidence

- ไม่แก้หรือลบ raw RBAC seeds, route guards หรือ runtime auth mapping
- Permission Management ใช้ allowlist แยกจาก runtime grouped permissions
- Hidden overrides ถูกเก็บเฉพาะ code ที่ role ใหม่ยังมี และ allow scope ต้องเท่ากับหรือแคบกว่า role
- Removed/unknown grouped module/action ตอบ validation error แทนการสร้าง raw permission code จาก input อิสระ
- Grouped `estateCode`/`estate` ตอบ validation error; estate assignment ยังคงเป็นข้อมูลระดับ user profile และ raw override ภายในเท่านั้น

## Production verification และ follow-up

- Initial rollout commit `8e6431e` deploy ผ่าน GitHub Actions run `33237594083` และตรวจ production OpenAPI แล้วว่าเผยแพร่ `EditablePermissionGroups`, `EditablePermissionGroupsResponse` และ `ManagedUserEditResponse`
- Estate qualifier correction ในเอกสารนี้ยังเป็น current worktree change; ต้อง deploy และตรวจ production OpenAPI ซ้ำก่อนถือว่า correction ขึ้น production
- Full coverage correction run พบ `measurement-csv-export.route.test.ts` ล้ม `2` tests เฉพาะเมื่อรวม coverage ทั้ง suite; ไฟล์ดังกล่าวรันเดี่ยวผ่าน `11/11` และ full non-coverage suite ผ่าน `1553/1553`. Targeted correction coverage ผ่าน `120/120`; ไม่แก้ measurement CSV เพราะอยู่นอกขอบเขต Permission Management
