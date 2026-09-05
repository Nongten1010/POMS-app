# ส่งต่อ frontend: แบบฟอร์มแก้ไขข้อมูลทั่วไปของโรงงาน

[กลับไป Backend Guides](../../README.md) · [เมนูข้อมูลพื้นฐาน](../../../api/menus/master-data/README.md)

ทีม frontend ใช้เอกสารนี้ปรับแบบฟอร์ม **แก้ไขข้อมูลทั่วไปของโรงงาน** (`BASIC_INFO`) ให้ส่งเฉพาะข้อมูลที่ผู้ประกอบการแก้ไขได้ ส่วน API contract ฉบับเต็มอยู่ที่ [โรงงานและคำขอแก้ไขข้อมูลในระบบ POMS](../../../api/menus/master-data/factory-edit-requests.md) เพียงแห่งเดียว

## สิ่งที่ต้องปรับ

API รับข้อมูลที่แก้ไขได้เฉพาะ 7 รายการนี้ โดย `formType: "BASIC_INFO"` เป็นตัวเลือกแบบฟอร์ม:

| รายการบนหน้าจอ | Field ที่ส่งให้ API |
| --- | --- |
| การประเมินผลกระทบสิ่งแวดล้อม | `eia` |
| ชื่อโครงการ | `projectName` |
| อื่นๆ ของการประเมินผลกระทบสิ่งแวดล้อม | `eiaOther` |
| ภาพถ่ายหน้าโรงงานหรือป้ายโรงงาน | `factoryFrontPhotos` |
| สัญลักษณ์ของโรงงานหรือโลโก้บริษัท | `factoryLogo` |
| ละติจูด | `latitude` |
| ลองติจูด | `longitude` |

ชื่อโรงงาน เลขทะเบียน การประกอบกิจการ ประเภทโรงงาน สถานที่ตั้ง และข้อมูลอื่นให้แสดงเป็นข้อมูลอ่านอย่างเดียว การอ่าน field จาก API ได้ไม่ได้หมายความว่าส่งกลับเพื่อแก้ไขได้

**ต้องหยุดส่ง `factoryName`, `address`, `factoryAddress`, `remarks` และ `note`** ใน `BASIC_INFO` ทั้งคำขอใหม่และส่งกลับมาแก้ไข แม้ค่าเหมือนเดิมหรือเป็น `null` ก็จะได้รับ `400 VALIDATION_ERROR` ห้าม spread prefill response ทั้ง object ลง write payload

ชนิดข้อมูล ขอบเขตค่า และเงื่อนไขทั้งหมดดู [Shared Basic-info Fields](../../../api/menus/master-data/factory-edit-requests.md#shared-basic-info-fields) ส่วน `MEASUREMENT_POINTS` ใช้ [contract ของตัวเอง](../../../api/menus/master-data/factory-edit-requests.md#measurement-point-fields) และยังรองรับ `remarks`/`note`

## จุดที่ frontend ต้องตรวจ

ไฟล์ที่เกี่ยวข้องคือ [`MasterDataPage.jsx`](../../../../../frontend/src/pages/MasterDataPage.jsx):

- `buildBasicInfoPayload`: ตัดชื่อโรงงาน ที่อยู่ และหมายเหตุออก แล้วประกอบ payload จาก 7 fields ข้างต้น
- `submitFactoryEditRequest`: ใช้ payload ที่กรองแล้วทั้งการสร้างคำขอและ resubmission
- ฟอร์ม `master-data-general-info-form`: ช่องอื่นเป็น read-only และ field ที่ซ่อนจากการเลือก EIA ต้องไม่ถูกส่ง `null` เพื่อล้างค่าโดยไม่ได้ตั้งใจ

หลังส่งสำเร็จเป็นเพียงการยื่นคำขอ ข้อมูลโรงงานจริงเปลี่ยนเมื่อ admin อนุมัติเท่านั้น

## API ที่ใช้และลำดับการทำงาน

| ขั้นตอน | Method และ Path | อ้างอิง |
| --- | --- | --- |
| โหลดข้อมูลโรงงานปัจจุบันลงฟอร์ม | `GET /api/v1/poms-factories/:factoryId/form?formType=BASIC_INFO&systemType=CEMS` | [Prefill โรงงาน](../../../api/menus/master-data/factory-edit-requests.md#get-apiv1poms-factoriesfactoryidform) |
| อัปโหลดรูปก่อนส่งคำขอ | `POST /api/v1/poms-factories/document-images` | [Upload](../../../api/menus/master-data/factory-edit-requests.md#post-apiv1poms-factoriesdocument-images) |
| ส่งคำขอใหม่ | `POST /api/v1/poms-factories/:factoryId/edit-requests` | [Create](../../../api/menus/master-data/factory-edit-requests.md#post-apiv1poms-factoriesfactoryidedit-requests) |
| โหลดคำขอที่ส่งกลับให้แก้ไข | `GET /api/v1/poms-factories/edit-requests/:id/form?systemType=CEMS` | [Prefill คำขอ](../../../api/menus/master-data/factory-edit-requests.md#get-apiv1poms-factoriesedit-requestsidform) |
| ส่งกลับเข้าพิจารณา | `PUT /api/v1/poms-factories/edit-requests/:id/resubmission` | [Resubmit](../../../api/menus/master-data/factory-edit-requests.md#put-apiv1poms-factoriesedit-requestsidresubmission) |

ใช้ `systemType=WPMS` สำหรับโรงงานระบบ WPMS; ต้องระบุชนิดระบบเมื่อโรงงานมีทั้งสองระบบ ทุก endpoint ใช้ Bearer token: อ่านต้องมี `factories:view`, upload ต้องมี `factories:edit`, create/resubmit ต้องมีทั้งสองสิทธิ์ โดยขอบเขตการเขียนยึด `factories:edit`

Resubmit ใช้ได้เฉพาะสถานะ `REVISION_REQUESTED` และต้องคง `formType` เดิม คำขอเก่าที่เคยเสนอแก้ชื่อหรือที่อยู่ต้องส่งกลับด้วย allowlist ใหม่เช่นกัน

## ตัวอย่าง payload ที่ส่งได้

เปลี่ยนชื่อโครงการอย่างเดียว โดยไม่แก้ข้อมูลอื่น ใช้ได้ทั้ง create และ resubmit:

```json
{
  "formType": "BASIC_INFO",
  "projectName": "โครงการปรับปรุงระบบตรวจวัด"
}
```

เปลี่ยน EIA เป็นอื่นๆ พร้อมรายละเอียดและแก้พิกัด:

```json
{
  "formType": "BASIC_INFO",
  "eia": "อื่นๆ",
  "eiaOther": "รายงานสิ่งแวดล้อมประเภทเฉพาะ",
  "latitude": 14.315,
  "longitude": 100.612
}
```

ลบรูปด้านหน้าและโลโก้โดยตั้งใจ:

```json
{
  "formType": "BASIC_INFO",
  "factoryFrontPhotos": [],
  "factoryLogo": null
}
```

เมื่อเลือกรูปใหม่ ให้อัปโหลดก่อน แล้วใช้ document metadata ใน `data` ของ upload response เป็นสมาชิก `factoryFrontPhotos[]` หรือค่า `factoryLogo` อย่าส่ง binary/base64 ใน create/resubmit; สำหรับคำขอใหม่ ถ้าใช้รูป current/live เดิมให้ละ field นั้นได้ แต่ตอน resubmit ให้ส่ง metadata ของรูป/โลโก้ที่เคยเสนอและยังต้องการคงไว้ด้วย แม้ผู้ใช้ไม่ได้เลือกไฟล์ใหม่ ตาม [รูปแบบ document และข้อจำกัด](../../../api/menus/master-data/factory-edit-requests.md#shared-basic-info-fields)

API รองรับภาพหน้าโรงงานมากสุด 10 รายการ และ array ใหม่แทนที่รายการทั้งชุด; UI ปัจจุบันจำกัดการอัปโหลด 3 รายการ ซึ่งไม่ใช่เพดานของ API

## จุดที่ต้องระวังเมื่อสร้าง payload

- ต้องส่งอย่างน้อยหนึ่ง field ที่แก้ได้; `{}` หรือมีเพียง `formType` ตอบ `400 VALIDATION_ERROR` ส่วนส่งข้อมูลเหมือนปัจจุบันทั้งหมดตอบ `409 CONFLICT` เพราะไม่มีการเปลี่ยนแปลง
- ไม่ส่ง field = คงค่าจากข้อมูลโรงงาน current/live รอบส่งคำขอนั้น โดย resubmit ไม่ได้คง proposed value รอบก่อนโดยอัตโนมัติ หากต้องการคงสิ่งที่เคยเสนอแก้ ให้ส่งค่านั้นกลับมาด้วย
- ใช้ `null` เมื่อต้องการล้าง nullable field เท่านั้น และใช้ `[]` เมื่อต้องการล้างรูปทั้งหมด อย่าใช้ `value || fallback` จนการล้างค่ากลายเป็นส่งค่าเก่ากลับไป
- พิกัดต้องเป็น JSON number และส่ง `latitude`/`longitude` เป็นคู่ รวมถึงกรณีล้างด้วย `null` ทั้งคู่; อย่าแปลงช่องว่างเป็นเลข `0`
- `projectName` แก้ไขได้โดยไม่ขึ้นกับค่า `eia`; อย่าล้างชื่อโครงการอัตโนมัติเพียงเพราะ UI ซ่อนช่องตามตัวเลือก EIA
- `eiaOther` ต้องส่งพร้อม `eia: "อื่นๆ"` และมีข้อความ; ล้างรายละเอียดโดยเปลี่ยน `eia` เป็นค่าอื่นหรือ `null` การส่ง `eiaOther: null` เพียงอย่างเดียวไม่เปลี่ยนรายละเอียดเดิม
- Prefill คำขอเก่าใช้ชื่อ ที่อยู่ และข้อมูลอ่านอย่างเดียวจาก current/live ส่วน 7 fields ที่แก้ได้ใช้ proposed values; ห้ามนำ `remarks` ที่อ่านได้จาก shared response กลับไปส่งใน `BASIC_INFO`
- แสดงข้อผิดพลาดตาม [Errors](../../../api/menus/master-data/factory-edit-requests.md#errors) และ [shared response envelope](../../../api/shared/common-api/README.md#shared-response-shape)

## รายการตรวจรับของ frontend

- [ ] แก้ไขได้เฉพาะ 7 รายการ และข้อมูลอื่นแสดงแบบอ่านอย่างเดียว
- [ ] Network payload ของ create และ resubmit ไม่มีชื่อโรงงาน ที่อยู่ หมายเหตุ หรือ field นอก allowlist
- [ ] เปลี่ยนชื่อโครงการอย่างเดียวได้ และการละ field ไม่ล้างข้อมูลเดิม
- [ ] การเลือก EIA อื่นๆ บังคับข้อความ และการเปลี่ยนค่า/ล้าง EIA ทำงานตาม contract
- [ ] พิกัดส่งเป็นตัวเลขคู่กัน พร้อมตรวจกรณีช่องว่างและการล้างทั้งคู่
- [ ] รูปใหม่อัปโหลดก่อนส่ง metadata; ไม่เปลี่ยนรูปแล้วข้อมูลเดิมยังอยู่; การลบรูปและโลโก้ส่ง `[]`/`null` ตามที่ผู้ใช้เลือก
- [ ] Resubmit โดยไม่เลือกไฟล์ใหม่แล้วยังคงรูป/โลโก้ที่เสนอไว้รอบก่อนตามที่ผู้ใช้ต้องการ
- [ ] โรงงานที่มีทั้ง CEMS/WPMS เปิด prefill คำขอได้โดยระบุ `systemType` ที่ถูกต้อง
- [ ] เปิดคำขอ `REVISION_REQUESTED` แล้วส่งกลับได้ รวมถึงคำขอเก่าที่เคยมีชื่อหรือที่อยู่ใน proposed snapshot
- [ ] แสดงสถานะรอพิจารณาหลังส่ง และตรวจข้อมูลจริงหลัง admin อนุมัติ
- [ ] ฟอร์ม `MEASUREMENT_POINTS` ยังคงใช้ payload และ workflow เดิม

## ตรวจ contract ของระบบปลายทาง

ก่อนทดสอบเชื่อมต่อ ให้ตรวจ `PomsFactoryEditableProfileRequest` ใน [OpenAPI ของ production](https://d-poms.diw.go.th/api/v1/openapi.json): properties ต้องมีเพียง `formType` กับ 7 fields ข้างต้น และ `additionalProperties: false` การมีไฟล์ handoff นี้ไม่ได้ยืนยันว่า deploy ไปยัง environment นั้นแล้ว

ดูผลกระทบและแนวทางย้าย client ใน [API changelog](../../../api/CHANGELOG.md#2026-09-05--จำกัด-basic_info-ให้แก้ได้เฉพาะ-7-fields) และใช้ [canonical contract](../../../api/menus/master-data/factory-edit-requests.md) เป็นแหล่งอ้างอิงหลัก
