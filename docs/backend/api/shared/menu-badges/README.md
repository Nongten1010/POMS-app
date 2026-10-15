# จุด Badge บน Sidebar

[กลับไป Shared API](../README.md)

`GET /api/v1/me/menu-badges` สรุปว่าบัญชีที่เข้าสู่ระบบมีรายการเข้าเกณฑ์แสดงจุด Badge ในแต่ละเมนูหรือไม่ คืน boolean ครบทั้ง 6 เมนู ไม่มีจำนวน สี หรือรายละเอียดรายการ สีและการแสดงจุดเป็นหน้าที่ของ client

## เริ่มเชื่อมต่อ

```bash
curl 'https://d-poms.diw.go.th/api/v1/me/menu-badges' \
  -H "Authorization: Bearer ${ACCESS_TOKEN}"
```

เรียกหลัง login, หลังเปลี่ยนสถานะงานสำเร็จ และทุกประมาณ 60 วินาทีเฉพาะขณะหน้าเว็บมองเห็น เมื่อกลับเข้าแท็บให้รีเฟรชหากข้อมูลเก่า ใช้การเรียกส่วนกลางสำหรับ Sidebar ทั้งชุด ไม่ต้องเรียกแยกเมนู และไม่เปลี่ยน API ตัวนับเมนูย่อยเดิม

## `GET /api/v1/me/menu-badges`

### ตัวตนและสิทธิ์

- ต้องใช้ Bearer token ตาม [Authentication](../authentication/README.md) ระบบตรวจบัญชีและโหลด roles, effective permissions และ scope ล่าสุดทุกครั้ง ไม่เชื่อสิทธิ์ที่ค้างอยู่ใน token
- ไม่ต้องมี permission กลางเพิ่มเติม แต่ตรวจ `view` ของแต่ละเมนูแยกกัน ไม่มี `view` คืน `false` และไม่ตรวจรายการของเมนูนั้น
- งานคำขอของเจ้าหน้าที่และแอดมิน รวม Director ต้องมี `approve` ของเมนูเดียวกันด้วย แม้มีเพียง `view` หรือ `edit` ก็ได้ `false` แอดมินไม่ข้ามเงื่อนไขนี้
- ผู้ประกอบการใช้ `view` โดยไม่บังคับ `approve` และไม่เห็น Badge คำขอเพิ่มโรงงานเข้าข่าย
- การแจ้งเตือนใช้เพียง `notifications:view` ไม่บังคับ `approve`
- ใช้ขอบเขตเดียวกับ API รายการของแต่ละเมนู เช่น โรงงานที่ผูก/มอบหมาย ภาค จังหวัด นิคม และประเภทโรงงานตาม effective scope บัญชี role เดียวกันจึงอาจได้ผลต่างกัน
- Badge ไม่ให้สิทธิ์บันทึกหรืออนุมัติเพิ่มเติม API ดำเนินการต้องตรวจสิทธิ์ของตัวเองตามเดิม

| Response key | Permission `view` | Permission `approve` สำหรับงานคำขอ |
| --- | --- | --- |
| `factories` | `factories:view` | `factories:approve` |
| `connection` | `cems_wpms_requests:view` | `cems_wpms_requests:approve` |
| `kwp_forms` | `kwp_forms:view` | `kwp_forms:approve` |
| `bod_cod_errors` | `bod_cod_errors:view` | `bod_cod_errors:approve` |
| `eligible_factories` | `eligible_factories:view` | `eligible_factories:approve` สำหรับผู้ไม่ใช่ operator |
| `notifications` | `notifications:view` | ไม่ใช้ |

`connection` เป็น key ฝั่ง client ซึ่งจับคู่กับ backend permission `cems_wpms_requests:*` ตาม alias เดิม ไม่สร้าง permission ใหม่

### Request

| Field | ตำแหน่ง | Type | Required | คำอธิบาย |
| --- | --- | --- | --- | --- |
| `Authorization` | header | string | Yes | `Bearer <accessToken>` |

ไม่มี path/query parameter และไม่มี request body จึงไม่มี request JSON สำหรับ endpoint นี้ ค่า user ID, role, scope หรือ pagination ที่ client ส่งเพิ่มไม่ถูกใช้กำหนดบัญชี สิทธิ์ หรือผล Badge

### Response

HTTP `200` พร้อม `Cache-Control: private, no-store`

| Field | Type | Nullable | คำอธิบาย |
| --- | --- | --- | --- |
| `success` | boolean | No | `true` เมื่อประมวลผลสำเร็จ |
| `data.factories` | boolean | No | ข้อมูลพื้นฐานมีคำขอเข้าเกณฑ์ |
| `data.connection` | boolean | No | ขอเชื่อมต่อมีคำขอเข้าเกณฑ์ |
| `data.kwp_forms` | boolean | No | แจ้งแบบ กวภ. มีคำขอเข้าเกณฑ์ |
| `data.bod_cod_errors` | boolean | No | BOD/COD มีรายงานเข้าเกณฑ์ |
| `data.eligible_factories` | boolean | No | มีคำขอเพิ่มโรงงานเข้าข่ายรอพิจารณา |
| `data.notifications` | boolean | No | มีเหตุการณ์เข้าเกณฑ์ของวันนี้ตามเวลาไทย |

```json
{
  "success": true,
  "data": {
    "factories": true,
    "connection": false,
    "kwp_forms": true,
    "bod_cod_errors": false,
    "eligible_factories": true,
    "notifications": true
  }
}
```

คืนทั้ง 6 key เสมอ ไม่มีสิทธิ์หรือไม่มีรายการตรงเกณฑ์ให้ใช้ `false` หากประมวลผลล้มเหลวให้ตอบ error ไม่แทนข้อผิดพลาดด้วย `false`

### สถานะงานคำขอ

ตรวจว่ามีอย่างน้อยหนึ่งรายการตรงสถานะในขอบเขต โดยไม่จำกัดวันที่ ไม่เกี่ยวกับสถานะอ่าน และไม่ขึ้นกับ pagination ของตาราง

| เมนู | กลุ่มผู้ใช้ | สถานะที่ทำให้เป็น `true` |
| --- | --- | --- |
| `factories` | operator | `REVISION_REQUESTED` |
| `factories` | officer/admin | `PENDING_REVIEW`, `REVISED_PENDING_REVIEW` |
| `connection` | operator | `WAITING_FACTORY_REVISION`, `WAITING_CONNECTION` |
| `connection` | officer/admin | `PENDING_DESIGN_REVIEW`, `REVISED_PENDING_DESIGN_REVIEW`, `CONNECTION_CONFIRMED` |
| `kwp_forms` | operator | `REVISION_REQUESTED` |
| `kwp_forms` | officer/admin | `SUBMITTED`, `UNDER_REVIEW` |
| `bod_cod_errors` | operator | `REVISION_REQUESTED` |
| `bod_cod_errors` | officer/admin | `SUBMITTED`, `REVISED_PENDING_REVIEW`, `WAITING_RESULT_NOTICE` |
| `bod_cod_errors` | Director | `WAITING_REVIEW`, `WAITING_APPROVAL` |
| `eligible_factories` | ผู้ไม่ใช่ operator ที่มี view และ approve | `PENDING_REVIEW` |

- operator คือ `userType = operator`; officer คือ `userType = officer`; admin ตรวจจาก role `admin`
- Director คือ `kpm_director`, `center_director`, `kwp_director` ตรวจทุก role ใน `roles[]` ของ authorization context ปัจจุบัน ซึ่งเป็นแหล่งเดียวกับ `roles`/`roleCodes` ใน auth DTO ไม่รับ role จาก query
- Director ทั้งสามนับทั้งสองสถานะ ไม่จำกัดตามขั้นที่ role นั้นกดอนุมัติได้ ถ้ามี `admin` ร่วมกับ Director ใช้เกณฑ์ admin
- เมนูข้อมูลพื้นฐาน ขอเชื่อมต่อ และ กวภ. ใช้เกณฑ์เจ้าหน้าที่เดียวกันสำหรับ Director
- หากข้อมูลมี alias `WAITING_FACTORY_DEVICE_CONFIG`, `WAITING_FACTORY_DEVICE_CONFIGURATION`, `WAITING_DEVICE_CONFIG` ให้นับเหมือน `WAITING_CONNECTION` โดยไม่สร้างสถานะใหม่
- ไม่เพิ่มตัวกรอง `edit`, `allowedActions`, ผู้สร้างคำขอ หรือ `currentStep` นอกเหนือจากขอบเขตการเข้าถึงรายการเดิม
- กลุ่มผู้ใช้อื่นคืน `false` สำหรับงานคำขอที่ไม่มีเกณฑ์รองรับ โดยเมนู `eligible_factories` ใช้เงื่อนไขผู้ไม่ใช่ operator ตามตาราง

### เหตุการณ์การแจ้งเตือน

ใช้ scope เดียวกับ [API การแจ้งเตือน](../../menus/notifications/README.md) และ `eventDate` เท่ากับวันที่ปัจจุบันตาม `Asia/Bangkok` เท่านั้น ไม่ใช้ `createdAt` หรือ `detectedAt` และไม่กรองการอ่าน/การส่งแจ้งเตือน

ตรวจ CEMS (`systemType = CEMS`) หรือ BOD/COD Online (`systemType = WPMS` และ `displaySystemType = BOD_COD_ONLINE`) รวม 10 เมนูย่อย แต่ละระบบมีเหตุการณ์ 5 กลุ่ม:

| `alertType` | เงื่อนไขเพิ่มเติม |
| --- | --- |
| `STANDARD_EXCEEDED` | `thresholdType = STANDARD` |
| `EIA_EXCEEDED` | `thresholdType = EIA` |
| `DAILY_COMPLETENESS_LOW` | ไม่เพิ่มเงื่อนไข |
| `CONSECUTIVE_NO_REPORT` | ไม่เพิ่มเงื่อนไข |
| `ABNORMAL_VALUE` | ไม่เพิ่มเงื่อนไข |

ใช้เหตุการณ์ที่ระบบเดิมจัดประเภทแล้ว ไม่คำนวณเกณฑ์ตรวจวัดหรือจำนวนวันขาดรายงานใหม่

### Cache และข้อผิดพลาด

ไม่มี server cache ทุกครั้งตรวจสิทธิ์ scope และข้อมูลใหม่ พร้อม header `Cache-Control: private, no-store` จึงไม่แชร์ผลระหว่างบัญชีหรือใช้ผลของวันก่อนหลังเที่ยงคืนไทย ควรเคารพ global rate limit ที่ใช้ร่วมกับ API อื่น

ใช้ [shared error envelope](../common-api/README.md) สำหรับ authentication และ internal errors:

| HTTP | Code / รูปแบบ | เงื่อนไข | การจัดการของ client |
| --- | --- | --- | --- |
| `401` | `UNAUTHORIZED` | ไม่มี token, token ใช้ไม่ได้ หรือบัญชีใช้ไม่ได้ | เข้าสู่ระบบใหม่ |
| `429` | `text/plain` ตาม global limiter เดิม | เรียกเกิน 300 ครั้งต่อ 15 นาทีต่อ IP ร่วมกับ API อื่น | รอตาม `Retry-After` |
| `500` | `INTERNAL_ERROR` | อ่านสิทธิ์หรือประมวลผล query ไม่สำเร็จ | แสดงว่าโหลดไม่สำเร็จและลองใหม่ ไม่ตีความว่าทุกเมนูไม่มีงาน |

## สำหรับผู้ดูแล backend

ใช้ query การเข้าถึงเดียวกับรายการแต่ละเมนูแล้วเลือกเพียง ID แรกด้วย `TOP (1)` ไม่โหลด DTO/history หรือ `COUNT` ทั้งชุด Index เดิมของสถานะ/วันที่/ขอบเขตยังใช้ได้ งานนี้ไม่เพิ่ม migration; ประสิทธิภาพกับข้อมูล production ต้องตรวจ execution plan ก่อนปรับ index เพิ่ม

- [Route](../../../../../backend/src/modules/menu-badges/menu-badges.routes.ts)
- [Service และกติกา](../../../../../backend/src/modules/menu-badges/menu-badges.service.ts)
- [Response type](../../../../../backend/src/modules/menu-badges/menu-badges.types.ts)
- [Permission mapping](../../../../../backend/src/modules/auth/permissions.ts)
- [Runtime OpenAPI source](../../../../../backend/src/modules/api-docs/menu-badges.openapi.ts) และ [Swagger UI](https://d-poms.diw.go.th/api/v1/docs/) — production จะมี endpoint ใหม่หลัง deploy เท่านั้น
- [Factory edit-request query](../../../../../backend/src/modules/poms-factories/poms-factories.repository.ts)
- [Connection table query](../../../../../backend/src/modules/connection-requests/connection-requests.repository.ts)
- [KWP request query](../../../../../backend/src/modules/kwp-form-reports/kwp-form-reports.repository.ts)
- [BOD/COD report query](../../../../../backend/src/modules/bod-cod-deviations/bod-cod-deviation-reports.repository.ts)
- [Eligible add-request query](../../../../../backend/src/modules/eligible-factories/eligible-factories.repository.ts)
- [Alert-event query](../../../../../backend/src/modules/alert-events/alert-events.repository.ts)
- Tests: [route](../../../../../backend/tests/unit/menu-badges.route.test.ts), [service](../../../../../backend/tests/unit/menu-badges.service.test.ts), [request repositories](../../../../../backend/tests/unit/menu-badges.requests.repository.test.ts), [event repositories](../../../../../backend/tests/unit/menu-badges.events.repository.test.ts), [OpenAPI](../../../../../backend/tests/unit/menu-badges.openapi.test.ts)
- [หลักฐาน TDD และข้อจำกัด](../../../evidence/shared/menu-badges.tdd.md)
