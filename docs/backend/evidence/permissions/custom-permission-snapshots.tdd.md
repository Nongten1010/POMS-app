# หลักฐานการแก้สิทธิ์รายคนโดยไม่ใช้ role เป็นเพดาน

สัญญาที่เผยแพร่อยู่ใน [สิทธิ์การใช้งาน](../../api/menus/permissions/README.md), [API ผู้ใช้และสิทธิ์รายคน](../../api/menus/permissions/user-management-api.md) และ [Authentication](../../api/shared/authentication/README.md) เอกสารนี้บันทึกหลักฐานทดสอบและข้อจำกัดของการตรวจในเครื่อง

## ผลกระทบของการเปลี่ยนแปลง

```text
Docs impact: updated
Canonical docs: docs/backend/api/menus/permissions/README.md, docs/backend/api/menus/permissions/user-management-api.md, docs/backend/api/shared/authentication/README.md
Reason: เปลี่ยนสิทธิ์รายคนเป็น custom snapshot และตรวจสิทธิ์ล่าสุดสำหรับ session เดิม
Client impact: frontend
Breaking change: yes
```

รายการ breaking change และวิธีย้าย client: [custom user permission snapshots](../../api/CHANGELOG.md#custom-user-permission-snapshots)

## ข้อผิดพลาดที่จำลองได้ก่อนแก้

เรียก service บันทึกสิทธิ์จริงโดยจำลอง repository และให้ผู้ดูแลเพิ่ม `chat:answer` ที่ role ไม่มี กรณีทดสอบต้องการให้บันทึกสำเร็จ แต่ได้ข้อความตรงกับภาพที่แจ้ง:

```text
Permission override cannot grant an action outside the assigned role
```

การเพิ่ม `factories:view` จาก `OWN_FACTORY` เป็น `ALL` ถูกปฏิเสธอีกกรณีด้วยข้อความ `Permission override cannot widen the assigned role scope` ชุดทดสอบเริ่มต้น `users.custom-permissions.test.ts` มี 5 กรณีล้มเหลวและ 2 กรณีผ่านก่อนแก้

ชุดทดสอบ live authorization จำลองสิทธิ์ล่าสุดที่ต่างจาก token พบว่าก่อนแก้ API ยังใช้สิทธิ์ที่ถูกถอนและปฏิเสธสิทธิ์ที่เพิ่มใหม่ ส่วน `/auth/me` ใช้ข้อมูลใน token

## การทดสอบป้องกันการกลับเป็นซ้ำ

- [users.custom-permissions.test.ts](../../../../backend/tests/unit/users.custom-permissions.test.ts): การเพิ่ม action/scope นอก role, ชุด custom, reset และสิทธิ์ผู้เรียก รวม GET → PATCH ที่คง scope ราย action, จังหวัดชื่อ/รหัส, นิคม และผลอ่านข้อมูลคนละลำดับ
- [auth.custom-permissions.test.ts](../../../../backend/tests/unit/auth.custom-permissions.test.ts): ตัวคำนวณ custom ไม่เติม role grants และชุดว่างไม่คืนสิทธิ์ตาม role
- [auth.live-authorization.test.ts](../../../../backend/tests/unit/auth.live-authorization.test.ts): token เดิมต้องใช้สิทธิ์ล่าสุด, ระงับ/ลบบัญชี, ตัวตน token ผิด, การอ่านข้อมูลล้มเหลว และพื้นที่ custom
- [users.permission-mode.repository.test.ts](../../../../backend/tests/unit/users.permission-mode.repository.test.ts): mode และ grants บันทึกพร้อมกัน, reset, audit ก่อน–หลัง และ rollback เมื่อ audit ล้มเหลว
- [user-permission-mode.migration.test.ts](../../../../backend/tests/unit/user-permission-mode.migration.test.ts): snapshot ใช้สิทธิ์และพื้นที่ที่บันทึกไว้เหนือ role รวม saved `ALL` และ action นอก role, คง `deny` และ audit, ใช้ role defaults เฉพาะ code ที่ไม่มีรายการบันทึก, ย้ายเฉพาะ officer/admin และหยุดเมื่อพื้นที่เริ่มต้นที่ไม่ได้ถูกแทนด้วยค่าบันทึกเก็บให้ตรงเดิมไม่ได้
- [users.custom-permissions.openapi.test.ts](../../../../backend/tests/unit/users.custom-permissions.openapi.test.ts): mode, grouped/raw payload, reset, พื้นที่นิคม และ runtime contract

คำสั่งสำหรับวงรอบทดสอบหลักจาก `backend/`:

```bash
npm test -- --runInBand tests/unit/users.custom-permissions.test.ts tests/unit/auth.custom-permissions.test.ts tests/unit/auth.live-authorization.test.ts tests/unit/users.permission-mode.repository.test.ts tests/unit/user-permission-mode.migration.test.ts tests/unit/users.custom-permissions.openapi.test.ts
npm run typecheck
```

วงรอบหลักหลังแก้ผ่านทั้ง 6 suites / 65 tests ใน 1.365 วินาที และ `typecheck` ผ่าน

วงรอบ migration สำหรับ requirement ให้ผู้ที่เคยบันทึกสิทธิ์ไม่ต้องกำหนดใหม่:

```bash
npm test -- --runInBand tests/unit/user-permission-mode.migration.test.ts
```

ก่อนแก้ migration กรณี saved `factories:view = ALL` กลับเป็น `OWN_FACTORY`, saved action `permissions:manage` ที่ไม่มีใน role หายไป และข้อมูลพื้นที่ของ `deny` ถูกล้าง ได้ 4 failed / 7 passed ใน 1.293 วินาที หลังแก้เป็น role defaults เฉพาะ code ที่ไม่เคยบันทึก แล้วใช้รายการ saved ทุก code เหนือ role ได้ 11 passed รวมการเรียก `up()` ที่บันทึก snapshot และคงบัญชีไม่มีรายการ saved เป็น `role_default` การคง preflight พื้นที่เริ่มต้นที่กำกวมมีกรณีทดสอบแยกจาก saved `ALL` ที่ต้องผ่านได้

ทดสอบเส้นทางจริงที่เคยตรวจ role เพิ่มในคำขอเชื่อมต่อ, POMS, BOD/COD และ KWP ด้วย repository fixtures ที่ไม่เชื่อมฐานข้อมูลจริง เงื่อนไขสถานะ workflow และการเข้าถึงข้อมูลตามพื้นที่/ownership ยังคงถูกตรวจ

## การตรวจ scope และขอบเขตข้อมูลก่อน release

การบันทึก data-scoped allow ใหม่ปฏิเสธ `scope: null` แม้ role มี code นั้น การละ field คัดลอก role scope ครั้งเดียว รวม default edit/approve แบบ null ที่ใช้ role view ของ resource เดียวกัน ถ้าไม่มี scope หรือ qualifier ที่ใช้ได้หลังเติม defaults และ resolve master ตอบ `400 BAD_REQUEST`

สำหรับข้อมูล custom เดิมที่ scope null มีเฉพาะ edit/approve ที่ใช้ saved view scope และ qualifiers ของ resource เดียวกันเมื่อ view ยังอนุญาตและ valid; ไม่มี role/profile fallback ระหว่าง runtime และไม่เขียนค่าบันทึกเดิมทับ Data-scoped view/search/export/direct_connect ที่ null/invalid ไม่ให้สิทธิ์ ส่วน binary codes คงพฤติกรรมเดิม

Parameter creation ตรวจ effective edit data scope และ assignment ของ active eligible factory ก่อนบันทึก โรงงานนอกพื้นที่หรือ ownership ตอบ `404 NOT_FOUND`; legacy edit grant ที่ endpoint ได้เป็น null ใช้ granted view data scope เพื่อตรวจโรงงาน แต่ยังต้องส่งรายละเอียดฟอร์มครบ และไม่มี data scope ใช้ได้ตอบ `403 FORBIDDEN`

## การตรวจ release ที่แยกจาก workspace

Release เตรียมจาก `origin/main` commit `2d55040` และรวม production ล่าสุด `c295925` ก่อนส่ง release และรวมเฉพาะการเปลี่ยนสิทธิ์กับเอกสารที่เกี่ยวข้อง โดยคงพฤติกรรมและสัญญาที่ production ใช้อยู่สำหรับการใช้ชื่อบัญชี local หลัง soft-delete, คำนำหน้า 64 ตัวอักษร, identity ของจุดตรวจวัด, ADD_PARAMETER และอีเมลแจ้งเตือน

ผลวงรอบด้านบนเป็นหลักฐานจากการพัฒนา วงรอบ contract ของ clean release ผ่าน 8 suites / 135 tests ใน 3.282 วินาที โดยใช้ environment fixture สังเคราะห์และไม่เชื่อมฐานข้อมูลจริง ครอบคลุม OpenAPI หลัก, POMS, rejection, custom permissions, menu locations, การใช้ชื่อบัญชี local หลัง soft-delete, คำนำหน้า 64 ตัวอักษร และ connection resubmission ผลล้มเหลวสองกรณีใน workspace เดิมไม่ใช่ข้อสรุปของ clean release นี้

Clean release รอบสุดท้ายผ่าน full backend tests ทั้ง 318 suites / 4,029 tests ใน 27.722 วินาที, `npm run typecheck` และ `npm run build` ผ่าน โดยใช้ environment fixture สังเคราะห์ ไม่เชื่อมฐานข้อมูลจริง ตรวจ lint เฉพาะ backend source/tests ที่เปลี่ยน 94 ไฟล์ไม่มี errors (มี warnings รูปแบบ/non-null assertions 77 รายการ) ทดสอบ migration ล่าสุดผ่าน 16 กรณี รวม raw saved null ที่ต้องไม่กลับไปเป็น role grant และการคง nullable edit/approve ให้ runtime ใช้เฉพาะ saved view ที่ถูกต้อง ยังรอตรวจ runtime OpenAPI และ migration บนระบบจริงหลัง deploy ก่อนปิดงาน ไม่มีสคริปต์ docs guard ที่เรียกใช้งานได้ใน repository รุ่นนี้ การตรวจ links และ reachability ด้วยตัวตรวจชั่วคราวตามขอบเขต transition mode ผ่านเอกสาร canonical ที่แก้ทั้ง 14 ไฟล์: broken links 0 และ orphans จาก backend hub 0 โดยไม่นับ placeholder ของ template เดิมที่ไม่ได้แก้ `git diff --check` ผ่าน และ lint เฉพาะ OpenAPI/contract tests ที่แก้ผ่านโดยไม่มี errors (มี 5 warnings จากรูปแบบและ non-null assertions เดิม)

## ก่อนใช้งานบนระบบจริง

ยังไม่ได้รัน [migration 0136](../../../../backend/src/db/migrations/0136_add_user_permission_mode.ts) กับฐานข้อมูลจริงหรือ deploy ต้องรัน migration ก่อนเริ่ม backend รุ่นนี้ และตรวจ runtime OpenAPI หลัง deploy ตาม [ขั้นตอนย้ายสัญญา](../../api/CHANGELOG.md#custom-user-permission-snapshots) เมนูที่ client เก็บไว้ต้องอ่าน `/auth/me` ใหม่เพื่อแสดงสิทธิ์ล่าสุด เลข `0136` ต่อจาก migration `0135_expand_user_prename` ที่ production มีอยู่แล้ว
