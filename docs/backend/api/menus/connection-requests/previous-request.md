# โหลดข้อมูลจากคำขอก่อนหน้า

[กลับไปหน้าเมนู](./README.md)

## `GET /api/v1/cems-wpms-requests/factories/:factoryId/previous-request`

โหลดข้อมูล 5 ส่วนจากคำขอล่าสุดที่ผู้เรียกอ่านได้ เพื่อเติมฟอร์มคำขอใหม่ของโรงงานเดียวกัน ได้แก่ ข้อมูลทั่วไปโรงงาน ภาพหน้าโรงงานหรือป้ายโรงงาน โลโก้บริษัท ผู้ติดต่อประสานงาน และอีเมลแจ้งเตือนโรงงาน

### การยืนยันตัวตนและสิทธิ์

- Authentication: Bearer token
- Permission: `cems_wpms_requests:view`
- Data scope: กฎเดียวกับ [อ่านฟอร์มคำขอ](./README.md#connection-request-form-prefill) ได้แก่ `ALL`, `OWN_FACTORY`, `IN_REGION`, `IN_PROVINCE`, `IN_ESTATE`, `FACTORY_TYPE_88`; `OWN_FACTORY` อ่านคำขอที่ตนสร้างหรือโรงงานที่ได้รับมอบหมายได้ สิทธิ์พื้นที่ใช้พื้นที่ใน snapshot ของคำขอ
- ค้นหาเฉพาะคำขอที่มีสิทธิ์อ่าน หากไม่พบ รวมถึงโรงงานที่ไม่มีหรืออยู่นอกสิทธิ์ คืนผลว่างแบบเดียวกัน

### ข้อมูลที่ต้องส่ง

| Field | Location | Type | Required | Description |
| --- | --- | --- | --- | --- |
| `factoryId` | path | string | Yes | รหัสเดียวกับ `factoryId` ที่บันทึกในคำขอ; trim แล้วต้องยาว 1–64 ตัวอักษร หากมี `/` ให้ URL-encode เป็น `%2F` |

ไม่มี query parameters หรือ request body ตัวอย่าง: `GET /api/v1/cems-wpms-requests/factories/factory-001/previous-request` ดู curl ที่ [Quick Start](./README.md#เติมข้อมูลจากคำขอก่อนหน้า)

### ข้อมูลที่ตอบกลับ

| Field | Type | Nullable | Description |
| --- | --- | --- | --- |
| `success` | boolean | No | `true` เมื่อค้นหาสำเร็จ ทั้งกรณีพบและไม่พบ |
| `data.hasPreviousRequest` | boolean | No | มีคำขอก่อนหน้าที่อ่านได้หรือไม่ |
| `data.sourceRequestId` | integer | Yes | ID คำขอต้นทาง; ไม่พบคืน `null` |
| `data.formData` | object | Yes | ข้อมูลสำหรับเติมฟอร์ม; ไม่พบคืน `null` |
| `data.message` | string | No | ข้อความภาษาไทย; client ใช้ `hasPreviousRequest` ตัดสินสถานะ |

เมื่อพบคำขอ `formData` มีทุก field ในตารางนี้:

| Field ใน `formData` | Type | Nullable | Description |
| --- | --- | --- | --- |
| `factoryId`, `factoryName`, `factoryRegistrationNo` | string | No | รหัส ชื่อ และทะเบียนโรงงาน |
| `industryMainOrder`, `industryMainOrderLabel`, `industrySubOrder`, `businessActivity` | string | Yes | ประเภทและลักษณะกิจการ |
| `eia`, `eiaOther`, `projectName` | string | Yes | ข้อมูล EIA และโครงการ ตาม [contract ฟอร์ม](./request-payloads-and-validation.md) |
| `hasEia` | boolean | Yes | ข้อมูล EIA เดิมของคำขอ |
| `address` | string | Yes | ที่อยู่ |
| `regionCode`, `regionName`, `provinceCode`, `provinceName`, `districtCode`, `districtName`, `subdistrictCode`, `subdistrictName`, `industrialEstateCode`, `industrialEstateName` | string | Yes | รหัสและชื่อพื้นที่ |
| `latitude`, `longitude` | number | Yes | พิกัดโรงงาน หน่วยองศา |
| `factoryFrontPhotos` | object[] | No | ภาพหน้าโรงงานหรือป้ายโรงงาน; ไม่มีคืน `[]` |
| `factoryLogo` | object | Yes | โลโก้บริษัท; ไม่มีคืน `null` |
| `contactName`, `contactPhone` | string | No | ชื่อและโทรศัพท์ผู้ติดต่อหลัก |
| `contactEmail` | string | Yes | อีเมลผู้ติดต่อหลัก |
| `contactPersons` | object[] | No | ผู้ติดต่อทั้งหมด; ไม่มีคืน `[]` |
| `notificationEmails` | string[] | No | อีเมลแจ้งเตือนโรงงาน; ไม่มีคืน `[]` |

รายการใน `contactPersons` ใช้ `name`, `phone` และ optional `email`, `position` ที่เป็น `string | null` ตาม [ฟอร์มมาตรฐาน](./README.md#connection-request-form-prefill)

รายการรูปใช้ metadata เดิมของ `documentsAndImages`: `title` และ optional `description`, `link`, `fileName`, `fileUrl`, `fileType` เป็น `string | null`; `fileSize` เป็น `number | null` หน่วย byte ตาม [เอกสารและรูปใน payload](./request-payloads-and-validation.md) จึงใช้แสดงรูปเดิมได้โดยไม่ต้องอัปโหลดซ้ำ

### ตัวอย่างเมื่อพบ (`200 OK`)

```json
{
  "success": true,
  "data": {
    "hasPreviousRequest": true,
    "sourceRequestId": 17,
    "message": "พบข้อมูลจากคำขอก่อนหน้า",
    "formData": {
      "factoryId": "factory-001",
      "factoryName": "บริษัท ตัวอย่าง จำกัด",
      "factoryRegistrationNo": "3-106-33/50สบ",
      "industryMainOrder": null,
      "industryMainOrderLabel": null,
      "industrySubOrder": null,
      "businessActivity": null,
      "eia": null,
      "eiaOther": null,
      "hasEia": null,
      "projectName": null,
      "address": "99 หมู่ 1",
      "regionCode": null,
      "regionName": null,
      "provinceCode": null,
      "provinceName": null,
      "districtCode": null,
      "districtName": null,
      "subdistrictCode": null,
      "subdistrictName": null,
      "industrialEstateCode": null,
      "industrialEstateName": null,
      "latitude": null,
      "longitude": null,
      "factoryFrontPhotos": [
        {
          "title": "ภาพถ่ายหน้าโรงงานหรือป้ายโรงงาน",
          "fileUrl": "https://example.com/uploads/front.jpg"
        }
      ],
      "factoryLogo": {
        "title": "สัญลักษณ์ของโรงงานหรือโลโก้บริษัท",
        "fileUrl": "https://example.com/uploads/logo.png"
      },
      "contactName": "สมชาย ใจดี",
      "contactPhone": "0812345678",
      "contactEmail": null,
      "contactPersons": [],
      "notificationEmails": ["factory@example.com"]
    }
  }
}
```

### ตัวอย่างเมื่อไม่พบ (`200 OK`)

```json
{
  "success": true,
  "data": {
    "hasPreviousRequest": false,
    "sourceRequestId": null,
    "formData": null,
    "message": "ไม่พบคำขอก่อนหน้าของโรงงานนี้"
  }
}
```

### กติกาการเลือกและนำข้อมูลไปใช้

- เลือกคำขอที่ยังไม่ถูกลบ เรียง `created_at DESC`, `id DESC` และคืนเพียงรายการแรก การแก้คำขอเก่าไม่ทำให้กลายเป็นคำขอล่าสุด
- รวมทุกสถานะและประเภทคำขอ ทั้ง CEMS/WPMS เพราะใช้ข้อมูลระดับโรงงานร่วมกัน ไม่ต้องรอคำขอเชื่อมต่อสำเร็จ
- ข้อมูลทุกส่วนมาจาก snapshot ของคำขอเดียวกัน ไม่เติมส่วนที่ว่างจากคำขอเก่ากว่า หรือจากข้อมูลโรงงานปัจจุบัน
- รูปหน้าโรงงานรวบรวมจากทุกจุดตรวจวัด เฉพาะ title `ภาพถ่ายหน้าโรงงานหรือป้ายโรงงาน` และตัดรูปซ้ำตาม `fileUrl` หรือ `link` โดยให้ `fileUrl` มีลำดับก่อน
- โลโก้เลือก title `สัญลักษณ์ของโรงงานหรือโลโก้บริษัท` รายการแรก ตามลำดับ ID จุดตรวจวัดและลำดับเอกสารในจุดนั้น
- `formData` เป็นข้อมูลบางส่วนสำหรับเติมฟอร์ม ไม่ใช่ payload สร้างคำขอครบชุด; เมื่อส่งคำขอใหม่ ให้นำ `factoryFrontPhotos` และ `factoryLogo` ที่เลือกไปใส่ `measurementPoints[].documentsAndImages` โดยคง `title` เดิมตาม [payload สร้างคำขอ](./request-payloads-and-validation.md)
- API นี้ไม่คืนจุดตรวจวัด อุปกรณ์ สถานะคำขอ หรืออีเมลแจ้งเตือนเจ้าหน้าที่ และไม่สร้างหรือแก้ไขข้อมูลใด

### ข้อผิดพลาด

ใช้ [shared error envelope](../../shared/README.md):

| HTTP status | Code | Condition | Client action |
| --- | --- | --- | --- |
| `400` | `VALIDATION_ERROR` | `factoryId` ว่างหรือยาวเกิน 64 หลัง trim | แก้รหัสโรงงาน |
| `401` | `UNAUTHORIZED` | ไม่มีหรือใช้ token ที่ไม่ถูกต้อง | เข้าสู่ระบบใหม่ |
| `403` | `FORBIDDEN` | ไม่มี `cems_wpms_requests:view` | ตรวจสิทธิ์ผู้ใช้ |
| `500` | `INTERNAL_ERROR` | ระบบค้นหาข้อมูลขัดข้อง | แจ้งข้อผิดพลาดและลองใหม่ ไม่ตีความเป็นไม่มีคำขอ |

## ลิงก์สำหรับผู้ดูแล backend

- [Route](../../../../../backend/src/modules/connection-requests/connection-requests.routes.ts)
- [Validator](../../../../../backend/src/modules/connection-requests/connection-requests.validator.ts): `factoryGeneralParamsSchema`
- [Service](../../../../../backend/src/modules/connection-requests/connection-requests.service.ts): `getPreviousRequest`
- [Repository](../../../../../backend/src/modules/connection-requests/connection-requests.repository.ts): `findPreviousRequestForReadAccess`
- [Types](../../../../../backend/src/modules/connection-requests/connection-requests.types.ts): `PreviousConnectionRequestDTO`, `PreviousRequestFormData`
- [OpenAPI](../../../../../backend/src/modules/api-docs/connection-requests.openapi.ts)
- [Route/service tests](../../../../../backend/tests/unit/connection-requests.previous-request.route.test.ts)
- [Service tests](../../../../../backend/tests/unit/connection-requests.service.test.ts)
- [Repository tests](../../../../../backend/tests/unit/connection-requests.repository.test.ts)
