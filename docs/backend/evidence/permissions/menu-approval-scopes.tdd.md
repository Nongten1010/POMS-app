# สิทธิ์อนุมัติรายเมนูและขอบเขตจังหวัดของ candidate

สัญญาหลัก: [สิทธิ์อนุมัติแยกรายเมนู](../../api/menus/permissions/README.md#สิทธิ์อนุมัติแยกรายเมนู), [ขอเชื่อมต่อ](../../api/menus/connection-requests/README.md#approval-access) และ [จังหวัดของ candidate](../../api/menus/eligible-factories/README.md#candidate-region-province-mapping)

```text
Docs impact: updated
Canonical docs: docs/backend/api/menus/permissions/README.md, docs/backend/api/menus/connection-requests/README.md, docs/backend/api/menus/eligible-factories/README.md, docs/backend/api/shared/authentication/README.md
Reason: แก้เฉพาะ backend API ให้ approve รายเมนูใช้ effective grants และ scope พร้อมตรวจ assignment จริง และแปลงจังหวัดที่ใช้กรอง candidate
Client impact: frontend
Breaking change: no
```

## วงรอบตรวจ

Release นี้เป็น backend-only ต่อจาก `3335007` โดยคงงาน production เดิม พฤติกรรม API ที่ตรวจคือ approve ของแต่ละเมนูไม่ติด role/userType, ไม่เติม view/edit หรือสิทธิ์เมนูอื่น และยังต้องผ่าน scope, สถานะและ current step ตาม contract เดิม

- Connection OWN_FACTORY: ใช้ service จริงกับ SQL fixture ตรวจ assignment โรงงานโดยตรงหรือนิติบุคคลที่ยัง active, revoked grants, โรงงานอื่นในนิติบุคคลเดียวกัน และผู้สร้างคำขอที่ไม่มี assignment ชุดเฉพาะหลังปิด race ผ่าน 5 suites / 295 tests รวม HTTP ผ่าน service/repository จริงที่ถอนสิทธิ์ระหว่างทาง 4 กรณีและอนุมัติเมื่อสิทธิ์ยังอยู่ 4 กรณี และตรวจสิทธิ์ซ้ำภายใต้ request-row transaction lock ก่อนเขียน status/history/point side effects เพื่อให้การถอน assignment ระหว่างคำขอปิดสิทธิ์ได้
- Candidate IN_REGION: ก่อนแก้ใช้ POMS province ID เป็นรหัสต้นทาง ทำให้รหัสกรองผิด วงรอบเริ่ม 12 failed / 15 passed; หลัง map ด้วยชื่อจังหวัด canonical ผ่าน 3 suites / 61 tests ครอบคลุม master IDs จริงทั้งหกภาค, จังหวัดภาคใต้, ชื่อไม่รู้จักและไม่มี province master
- OpenAPI: [menu-approval-scopes.openapi.test.ts](../../../../backend/tests/unit/menu-approval-scopes.openapi.test.ts) ตรวจ grants รายเมนู, ownership policy, view ที่แยกจาก approve และจังหวัดที่ไม่รู้จักต้องปิดขอบเขต รวมกับชุดสัญญาที่เกี่ยวข้องผ่าน 9 suites / 145 tests ใน 3.906 วินาทีหลังปรับสัญญาเป็น backend-only; canonical transition check ของเอกสารที่แก้ 9 ไฟล์มี broken links 0 / orphans 0 และ diff check ผ่าน
- Backend รอบรวมผ่าน 320 suites / 4,081 tests ใน 37.529 วินาที พร้อม typecheck และ build ผ่าน โดยใช้ environment fixture สังเคราะห์
- ไม่รวมการแก้ frontend ใน release: patch ที่เตรียมไว้ถูกเก็บแยกและคืนไฟล์เป็น HEAD แล้ว ไม่มีการแก้หรือยืนยัน App refresh ข้อจำกัด role/userType และปุ่มหน้าเว็บเดิมยังอาจขวางการอนุมัติแม้ backend API อนุญาต

การพบ mapping จังหวัดผิดและการผ่าน regression ในเครื่องยังไม่ยืนยันสาเหตุของ HTTP 500 ที่รายงาน หรือการเรียก production ด้วย session จริง กรณี production ที่ต้องยืนยันตัวตนยังรอการตรวจที่ได้รับอนุญาต ไม่ใช้ token จำลองแทนบัญชีจริง

## ก่อนปิด release

ไม่มี request/response fields, mode หรือ database migration ใหม่จากรอบนี้ ต้องตรวจ runtime OpenAPI ของ deployment ให้ตรง source หลังขึ้นระบบ และบันทึกผล health/contract รวมถึงข้อจำกัดของ authenticated verification แยกจากผล fixture
