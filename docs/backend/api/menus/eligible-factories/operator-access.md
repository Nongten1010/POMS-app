# จัดการผู้ประกอบการที่มีสิทธิ์ในโรงงานเข้าข่าย

[กลับไปโรงงานที่เข้าข่าย](./README.md) · [การยืนยันตัวตน](../../shared/authentication/README.md) · [การเปิดใช้และงานรายวัน](../../../guides/operator-eligible-factory-access.md)

> Contract สำหรับ implementation ใน change นี้ ต้องรัน migration `0158_create_eligible_operator_access` และเปิด backend flag ก่อนใช้งาน ยังไม่ใช่หลักฐานว่า production เปิดให้บริการแล้ว

## เริ่มเชื่อมต่อสำหรับ frontend

รองรับ dialog ในตารางโรงงานเข้าข่ายตาม [handoff วันที่ 9 พฤศจิกายน 2569](../../../../../frontend/md/frontend-handoff-09112026.md) โดยไม่เพิ่มเมนูใหม่ รหัสใน path คือ `eligible_factories.id` ไม่ใช่ FID/เลขทะเบียน และไม่เปลี่ยนความหมาย `ownedFactoryIds`

ทุกเส้นทางใช้ Bearer token ต้องเป็น `userType = admin` หรือมี role code `admin` พร้อม `eligible_factories:view` ที่ครอบคลุมโรงงานนั้น ไม่ต้องมี `eligible_factories:edit` เจ้าหน้าที่/director ที่มี edit แต่ไม่มี admin ใช้งานไม่ได้

```bash
curl -H "Authorization: Bearer $TOKEN" \
  "$BASE_URL/api/v1/eligible-factories/17/operator-access"
curl -G -H "Authorization: Bearer $TOKEN" --data-urlencode 'query=ทดสอบ' \
  "$BASE_URL/api/v1/eligible-factories/17/operator-access/candidates"
curl -X POST -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"userId":42}' "$BASE_URL/api/v1/eligible-factories/17/operator-access"
curl -X POST -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{}' "$BASE_URL/api/v1/eligible-factories/17/operator-access/123/revoke"
```

- ทุก success ใช้ `{ "success": true, "data": ... }` การเพิ่มตอบ `201` การอ่าน/เพิกถอนตอบ `200` ไม่ใช้ `204`
- รายการและประวัติคืนครบ ไม่แบ่งหน้าที่ server เพื่อให้ client pagination 10/25/50 ใช้ได้โดยไม่ตัดข้อมูลเงียบ ๆ
- ส่งเวลา UTC ISO datetime พร้อม `Z`; response มี `Cache-Control: no-store`
- เหตุผลไม่บังคับ ส่ง `{}` สำหรับการเพิกถอน หรือไม่ใส่ `reason` สำหรับการเพิ่มได้ ไม่รับไฟล์หลักฐานในรุ่นนี้
- เมื่อ POST ไม่ทราบผล ให้ GET ตรวจรายการก่อนทำซ้ำ ห้าม retry การเพิ่มอัตโนมัติ
- เปิด `VITE_ELIGIBLE_OPERATOR_ACCESS_ENABLED` ที่ frontend หลัง backend พร้อมและทดสอบ adapter แล้วเท่านั้น งาน backend นี้ไม่ได้เปลี่ยน frontend flag

## รายชื่อ ประวัติ และสถานะล่าสุด

`GET /api/v1/eligible-factories/{id}/operator-access`

ไม่มี request body

| Field | ชนิด | ความหมาย |
| --- | --- | --- |
| path `id` | positive safe integer | ID โรงงานเข้าข่ายที่ยังไม่ถูกลบ |
| `data.factory.id` | integer | ID โรงงานเข้าข่าย |
| `data.factory.name` | string | ชื่อโรงงาน |
| `data.factory.factoryRegistrationNo` | string | เลขทะเบียนใหม่/FID |
| `data.factory.operationStatus` | string | สถานะประกอบกิจการที่บันทึกไว้; ดูเวลายืนยันควบคู่ |
| `data.factory.statusVerifiedAt` | ISO datetime / null | เวลาตรวจต้นทางสำเร็จล่าสุด ไม่ใช่เวลาเปลี่ยนสถานะจริง |
| `data.capabilities.canGrant` | boolean | เพิ่มได้เมื่อยืนยัน Fac60k สถานะ `0` และข้อมูลยังสด |
| `data.capabilities.grantUnavailableReason` | string / null | `SOURCE_STATUS_UNVERIFIED`, `FACTORY_NOT_NOT_STARTED` หรือ `null` |
| `data.items` | array | รายการผูกทั้งหมด รวมรายการที่สิ้นสุดแล้ว |
| `data.items[].id`, `userId` | integer | ID รายการผูกและ ID บัญชี POMS |
| `data.items[].name` | string | ชื่อผู้ประกอบการ |
| `data.items[].citizenIdMasked` | string | เช่น `*********1234`; ไม่คืนเลขบัตรเต็ม |
| `data.items[].status` | string | `active`, `revoked`, `expired`, `suspended` |
| `data.items[].grantedAt` | ISO datetime | เวลาให้สิทธิ์ |
| `data.items[].grantedByName` | string | ผู้ให้สิทธิ์ |
| `data.items[].canRevoke` | boolean | true สำหรับรายการที่ยังไม่สิ้นสุด แม้สถานะโรงงานเปลี่ยนหรือยืนยันต้นทางไม่ได้ |
| `data.history` | array | ประวัติเรียงใหม่ไปเก่า |
| `data.history[].id` | integer | ID เหตุการณ์ |
| `data.history[].occurredAt` | ISO datetime | เวลาบันทึกเหตุการณ์ |
| `data.history[].action` | string | `granted`, `revoked`, `expired`, `suspended` |
| `data.history[].name`, `actorName` | string | ผู้รับสิทธิ์และผู้ดำเนินการ; เหตุการณ์อัตโนมัติใช้ actor `ระบบ` |
| `data.history[].reason` | string / null | เหตุผลที่กรอกหรือเหตุจากระบบ |

```json
{"success":true,"data":{"factory":{"id":17,"name":"โรงงานทดสอบ","factoryRegistrationNo":"10000000000017","operationStatus":"ยังไม่แจ้งประกอบ","statusVerifiedAt":"2026-11-09T01:00:00.000Z"},"capabilities":{"canGrant":true,"grantUnavailableReason":null},"items":[],"history":[]}}
```

เปิด dialog ดูได้ทุกสถานะตามสิทธิ์โรงงาน หากต้นทางอ่านไม่ได้จะเก็บสถานะที่ยืนยันล่าสุดไว้และปิด canGrant เมื่อข้อมูลเก่า ไม่เปลี่ยนเป็นจำหน่ายทะเบียนโดยเดา

## ค้นหาบัญชี

`GET /api/v1/eligible-factories/{id}/operator-access/candidates?query=...`

ไม่มี request body

| Field | ชนิด / validation | ความหมาย |
| --- | --- | --- |
| path `id` | positive safe integer | โรงงานเป้าหมาย |
| query `query` | string, trim, 2–100 ตัวอักษร, required | ค้นบางส่วนของชื่อ/นามสกุล หรือเลขบัตรเต็ม 13 หลักแบบ exact; ไม่ค้นเลขบัตรบางส่วน |
| `data.items[].userId` | integer | บัญชีสำหรับส่งเพิ่มสิทธิ์ |
| `data.items[].name` | string | ชื่อและนามสกุล |
| `data.items[].citizenIdMasked` | string | เลขบัตรปิดบัง |

```json
{"success":true,"data":{"items":[{"userId":42,"name":"ผู้ประกอบการ ทดสอบ","citizenIdMasked":"*********1234"}]}}
```

คืนเฉพาะบัญชี `identity_provider = i_industry`, `user_type` เป็น citizen/operator, active, ไม่ถูกลบ และมี `last_login_at` แล้ว ไม่คืนบัญชี local/mock/officer หรือบัญชีที่มีรายการผูกเปิดอยู่กับโรงงานนี้ การเพิ่มตรวจเงื่อนไขซ้ำที่ server ไม่เชื่อผลค้นจาก client

Application error logs ตัด query ออกจากเส้นทางนี้ และไม่ส่งเลขบัตรเต็มกลับ แต่ reverse proxy/access logs ต้องตั้งไม่เก็บ query ของเส้นทางนี้ก่อนเปิดใช้งาน ไม่ส่งเลขจริงในลิงก์ตัวอย่างหรือบันทึกใน browser storage/console

## เพิ่มสิทธิ์

`POST /api/v1/eligible-factories/{id}/operator-access`

| Field | ชนิด / validation | ความหมาย |
| --- | --- | --- |
| path `id` | positive safe integer | โรงงานเข้าข่าย |
| body `userId` | positive safe integer, required; ไม่รับ numeric string | บัญชีที่เคยยืนยันผ่าน i-industry |
| body `reason` | string, trim, max 1000, optional | เว้นว่างเท่ากับไม่ส่ง ไม่รับ null |
| `data.id` | integer | ID รายการผูกที่สร้าง |

Request:

```json
{"userId":42}
```

Response `201`:

```json
{"success":true,"data":{"id":123}}
```

ตรวจ Fac60k ใหม่ก่อนเพิ่ม ต้องเป็น `FFLAG = 0` (`ยังไม่แจ้งประกอบ`) และตรวจข้อมูลบัญชี สถานะต้นทาง ความซ้ำ และ data scope ซ้ำใน transaction ที่ lock โรงงาน รองรับหลายคนต่อโรงงาน/หลายโรงงานต่อคน รายการ expired/revoked เก็บไว้และสร้างรายการใหม่เมื่ออนุมัติใหม่ได้ ไม่คืนสิทธิ์เก่าเอง

## เพิกถอนสิทธิ์

`POST /api/v1/eligible-factories/{id}/operator-access/{grantId}/revoke`

| Field | ชนิด / validation | ความหมาย |
| --- | --- | --- |
| path `id`, `grantId` | positive safe integer | โรงงานและรายการผูก ต้องเป็นคู่เดียวกัน |
| body `reason` | string, trim, max 1000, optional | เหตุผลไม่บังคับ |
| `data.id` | integer | ID รายการผูกที่เพิกถอน |

Request:

```json
{}
```

Response `200`:

```json
{"success":true,"data":{"id":123}}
```

เพิกถอน active/suspended ได้โดยไม่ต้องอ่าน Fac60k สำเร็จ รายการ expired/revoked ตอบ `409` เก็บประวัติ ไม่ลบคำขอ และไม่เพิกถอนสิทธิ์จาก i-industry/นิติบุคคล/สิทธิ์รายโรงงานเดิม

## สิทธิ์หลัง login และเมื่อสถานะเปลี่ยน

- ผู้เลือกเข้าแบบ operator และยืนยันกับ i-industry สำเร็จ จะได้โรงงานตาม flow เดิมรวมกับรายการผูกที่มีผล ตัด FID ซ้ำใน `ownedFactoryIds`
- ถ้า provider ไม่ส่งโรงงานหรือนิติบุคคล แต่บัญชีมีสิทธิ์ผูกที่ใช้ได้ จะเข้าเป็น operator ได้; citizen persona ที่เลือกชัดเจนยังเป็น citizen และการผูกไม่ใช้ข้ามการยืนยันตัวตน
- supporting master ที่ไม่มีจาก i-industry ใช้ read-only identity projection จากโรงงานเข้าข่าย โดยไม่สร้าง FID/นิติบุคคลจำลอง
- ใช้การตรวจสิทธิ์เดียวกันกับ `/auth/me`, รายการโรงงาน และธุรกรรมเดิม ครอบคลุมคำขอ/ข้อมูลโรงงาน/ตรวจวัด/แบบ กวภ./BOD-COD/chat ตาม permission และ validation เดิม การผูกไม่เพิ่ม action permission
- สถานะ `0 → 1/2/3` ทำให้สิทธิ์ผูกเป็น expired และมีผลต่อ token เดิมในการเรียกครั้งถัดไปหลังตรวจพบ; ถ้ามีสิทธิ์จากแหล่งเดิมยังใช้สิทธิ์นั้นได้
- สถานะกลับ `0` ไม่คืนสิทธิ์ expired เอง ข้อมูลเก่าและตรวจต้นทางไม่ได้ระงับชั่วคราว; เมื่อยืนยันสถานะ `0` ใหม่ได้ suspended กลับ active โดยบันทึก action `granted` พร้อมเหตุผลจากระบบ
- คำขอที่ยื่นแล้วและ connected points ไม่ยกเลิกอัตโนมัติ เจ้าหน้าที่ดำเนินการต่อได้ตามสิทธิ์ของตน

## HTTP errors

ใช้ [error envelope กลาง](../../shared/common-api/README.md) ไม่เพิ่มรูปแบบแยก

| Status / code | เงื่อนไข |
| --- | --- |
| `400 VALIDATION_ERROR` | id/query/body ไม่ถูกต้อง หรือส่ง field เกิน schema |
| `401 UNAUTHORIZED` | ไม่มี token หรือ token ไม่ผ่านการตรวจ |
| `403 FORBIDDEN` | ไม่เป็น admin หรือไม่มี view permission |
| `404 NOT_FOUND` | โรงงานนอก scope/ถูกลบ, บัญชีไม่เข้าเงื่อนไข หรือ grant ไม่ใช่ของโรงงานนี้ |
| `409 CONFLICT` | ผูกซ้ำ (`details.reason = DUPLICATE_GRANT`), สถานะไม่ใช่ 0 (`FACTORY_NOT_NOT_STARTED`), ยืนยันสถานะไม่ได้ (`SOURCE_STATUS_UNVERIFIED`), identity เปลี่ยนระหว่างตรวจ หรือ grant สิ้นสุดแล้ว |
| `503 SERVICE_UNAVAILABLE` | ยังไม่เปิด backend flag |

## แหล่ง implementation และการตรวจสอบ

- [Routes](../../../../../backend/src/modules/eligible-factories/eligible-factories.routes.ts), [validators/controller/service](../../../../../backend/src/modules/eligible-factories/eligible-operator-access.ts)
- [สถานะ Fac60k และ worker](../../../../../backend/src/modules/eligible-factories/eligible-factory-status-sync.ts), [migration](../../../../../backend/src/db/migrations/0158_create_eligible_operator_access.ts)
- [สิทธิ์รายโรงงานกลาง](../../../../../backend/src/shared/utils/factory-access-query.ts), [auth](../../../../../backend/src/modules/auth/auth.service.ts)
- [OpenAPI](../../../../../backend/src/modules/api-docs/eligible-operator-access.openapi.ts), [tests](../../../../../backend/tests/unit/eligible-operator-access.test.ts)

สิทธิ์และผลตรวจต้นทางบันทึก FID ที่ยืนยันไว้ด้วย หากเลขทะเบียนใหม่ของแถวเข้าข่ายเปลี่ยน จะใช้ cache/สิทธิ์จากเลขเดิมกับเลขใหม่ไม่ได้ รายการผูกเดิมสิ้นสุดพร้อมเหตุผล `FACTORY_IDENTITY_CHANGED` และต้องให้แอดมินอนุมัติใหม่หลังยืนยันต้นทาง ไม่สร้างหรือซ่อม identity อัตโนมัติ
