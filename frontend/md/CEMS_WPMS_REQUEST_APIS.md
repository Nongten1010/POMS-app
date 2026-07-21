# CEMS/WPMS Request APIs

เอกสารชุด API สำหรับฟอร์มคำขอเพิ่มจุดตรวจวัด, เพิ่มพารามิเตอร์, ตั้งค่าอุปกรณ์ และหน้าตาราง/PDF ที่เกี่ยวข้อง

## Base URL

```text
http://localhost:3000/api/v1
```

ทุก endpoint ต้องส่ง token และโดยปกติใช้ JSON:

```http
Authorization: Bearer <accessToken>
Content-Type: application/json
```

ยกเว้น endpoint อัปโหลดไฟล์ `POST /cems-wpms-requests/document-images` ที่ต้องใช้ `multipart/form-data`

## Point Code Auto Running

- ตอนผู้ประกอบการส่งฟอร์มเพิ่มจุดตรวจวัด ไม่ต้องส่ง `measurementPoints[].pointCode`
- Backend จะล้าง `pointCode` ของคำขอเพิ่มจุดตรวจวัด/ขอเชื่อมต่อใหม่ ถึง frontend ส่งมาก็ไม่ใช้เป็นเลขจริง
- เจ้าหน้าที่ตรวจผ่านด้วย `APPROVE_FORM` แล้วสถานะจะเปลี่ยน `PENDING_DESIGN_REVIEW` หรือ `REVISED_PENDING_DESIGN_REVIEW` -> `WAITING_CONNECTION`
- ตอนเข้า `WAITING_CONNECTION` backend จะออกเลข `pointCode` ให้จุดที่ยังไม่มีเลขโดยอัตโนมัติ
- `WAITING_CONNECTION` ครั้งแรกเริ่ม deadline 30 วันใน `connectionDueAt`; ระบบ auto-cancel เป็น `CANCELED` เมื่อคำขอค้าง `WAITING_CONNECTION` เกินกำหนด
- ถ้าเจ้าหน้าที่ส่งกลับจาก `CONNECTION_CONFIRMED` ด้วย `RETURN_TO_WAITING_CONNECTION` ระบบใช้ `pointCode` เดิมและ deadline เดิม ไม่เริ่มนับ 30 วันใหม่; ถ้า deadline หมดแล้ว ระบบเปลี่ยนเป็น `CANCELED` ทันที
- CEMS ใช้ prefix `S` เช่น `S0001`, `S0002`
- WPMS ใช้ prefix `P` เช่น `P0001`, `P0002`

## Request No Auto Running

เลขคำขอรันแยกตามระบบและปี พ.ศ. 2 หลัก ใช้รูปแบบ `<SYSTEM>-<YY>-<RUNNING_5_DIGITS>`

- CEMS ปี 2569: `CEMS-69-00001`, `CEMS-69-00002`
- WPMS ปี 2569: `WPMS-69-00001`, `WPMS-69-00002`

คำขอที่เจ้าหน้าที่สร้างและเชื่อมต่อโดยตรงใช้ชุดเลขแยกจากคำขอปกติและแยก CEMS/WPMS ออกจากกัน:

- CEMS ปี 2569: `OLDC-69-00001`, `OLDC-69-00002`
- WPMS ปี 2569: `OLDW-69-00001`, `OLDW-69-00002`
- running เป็น 5 หลัก รีเซ็ตเมื่อเลขปี พ.ศ. 2 หลักเปลี่ยน และจองเลขด้วย sequence row lock ภายใน transaction

## Contact And Notification Emails

รองรับผู้ติดต่อและอีเมลแจ้งเตือนได้หลายรายการ:

| UI | Field | Type | Required |
| --- | --- | --- | --- |
| ผู้ติดต่อประสานงาน | `contactPersons` | `array` | Yes |
| ชื่อผู้ติดต่อ | `contactPersons[].name` | `string` | Yes |
| เบอร์โทรผู้ติดต่อ | `contactPersons[].phone` | `string` | Yes |
| อีเมลผู้ติดต่อ | `contactPersons[].email` | `string|null` | No |
| ตำแหน่ง/หน้าที่ | `contactPersons[].position` | `string|null` | No |
| อีเมลสำหรับแจ้งเตือนโรงงาน | `notificationEmails` | `string[]` | No |
| อีเมลสำหรับแจ้งเตือนเจ้าหน้าที่ | `officerNotificationEmails` | `string[]` | No |
| ชื่อผู้ให้ข้อมูล/ผู้รับมอบอำนาจที่ลงนาม | `informationProviderName` | `string|null` | No |
| ตำแหน่งผู้ให้ข้อมูล/ผู้รับมอบอำนาจที่ลงนาม | `informationProviderPosition` | `string|null` | No |

Mapping:

- ถ้าส่ง `notificationEmails` backend จะเก็บอีเมลแจ้งเตือนทั้งหมด
- ถ้าไม่ส่ง `notificationEmails` backend จะใช้ `contactPersons[].email` ที่มีค่าเป็น default
- ถ้าส่ง `officerNotificationEmails` backend จะเก็บอีเมลแจ้งเตือนเจ้าหน้าที่แยกจากอีเมลโรงงาน
- `informationProviderName` และ `informationProviderPosition` เป็นข้อมูลผู้ลงนามยื่นคำขอทั้งใบ จึงส่งที่ root payload และเก็บในตารางหัวคำขอ `cems_wpms_connection_requests`
- `contactName`, `contactPhone`, `contactEmail` ยังรับแบบ legacy เพื่อไม่ให้ API เก่าพัง แต่ request ใหม่ไม่ต้องส่งแล้ว

## Endpoint Summary

| ข้อ | รายการ                                                       | Method | Path                                                       | Permission                   |
| --- | ------------------------------------------------------------ | ------ | ---------------------------------------------------------- | ---------------------------- |
| 0   | ดึงข้อมูลทั่วไปของโรงงานสำหรับลงฟอร์มเพิ่มจุดตรวจวัด         | GET    | `/cems-wpms-requests/factories/:factoryId/general`         | `factories:view`             |
| 1   | บันทึกฟอร์ม เพิ่มจุดตรวจวัด                                  | POST   | `/cems-wpms-requests/measurement-points`                   | `cems_wpms_requests:edit`    |
| 1.1 | อัปโหลด/บันทึกลิงก์เอกสารและรูปภาพของฟอร์ม CEMS             | POST   | `/cems-wpms-requests/document-images`                      | `cems_wpms_requests:edit`    |
| 1.2 | เจ้าหน้าที่เพิ่มหนึ่งจุดและเชื่อมต่อทันที                    | POST   | `/cems-wpms-requests/direct-connections`                   | `cems_wpms_requests:direct_connect` |
| 2   | บันทึกฟอร์ม เพิ่มพารามิเตอร์                                 | POST   | `/cems-wpms-requests/parameters`                           | `cems_wpms_requests:edit`    |
| 3   | บันทึกฟอร์ม ตั้งค่าอุปกรณ์ config                            | POST   | `/cems-wpms-requests/:id/device-configs`                   | `cems_wpms_requests:edit`    |
| 4   | รายละเอียดฟอร์ม ตั้งค่าอุปกรณ์ config สำหรับดึงข้อมูลลงฟอร์ม | GET    | `/cems-wpms-requests/:id/device-configs?stationId=S0001`   | `cems_wpms_requests:view`    |
| 4.1 | รายละเอียดฟอร์ม ตั้งค่าอุปกรณ์ config ราย config             | GET    | `/cems-wpms-requests/:id/device-configs/:configId`         | `cems_wpms_requests:view`    |
| 5   | ตรวจฟอร์ม เปลี่ยนสถานะ                                       | POST   | `/cems-wpms-requests/:id/status`                           | `cems_wpms_requests:approve` |
| 6   | รายการคำขอทั้งหมด สำหรับตารางเจ้าหน้าที่                     | GET    | `/cems-wpms-requests/table-rows`                           | `cems_wpms_requests:view`    |
| 7   | รายการคำขอเฉพาะโรงงานตัวเอง สำหรับตารางผู้ประกอบการ          | GET    | `/cems-wpms-requests/table-rows`                           | `cems_wpms_requests:view`    |
| 8   | รายชื่อโรงงาน สำหรับตารางผู้ประกอบการ                        | GET    | `/cems-wpms-requests/operator-factories`                   | `factories:view`             |
| 8.1 | ติดดาว/ยกเลิกติดดาวโรงงาน                                   | PUT    | `/operator-factories/:factoryId/favorite` | `factories:view` + `dashboard.alerts:view` |
| 8.2 | รายชื่อโรงงานเข้าข่ายทั้งหมด สำหรับหน้าขอเชื่อมต่อเจ้าหน้าที่ | GET    | `/cems-wpms-requests/eligible-factories`                   | `cems_wpms_requests:view`    |
| 9   | รายละเอียดคำขอรายคำขอ สำหรับ PDF/เติมฟอร์มเพิ่มพารามิเตอร์   | GET    | `/cems-wpms-requests/:id/detail`                           | `cems_wpms_requests:view`    |
| 10  | รายละเอียดจุดตรวจวัดที่เชื่อมต่อแล้วจากระบบ POMS ปัจจุบัน    | GET    | `/connected-measurement-points`                            | `cems_wpms_requests:view`    |
| 10.1 | รายละเอียดจุดตรวจวัดสำหรับ modal ตามโรงงาน                   | GET    | `/connected-measurement-points/factories/:factoryId`       | `cems_wpms_requests:view`    |
| 11  | รายการคำขอทุกคำขอของจุดตรวจวัดที่เลือก                      | GET    | `/connected-measurement-points/:stationId/requests`        | `cems_wpms_requests:view`    |
| 12  | ดึงข้อมูลปัจจุบันลงฟอร์มเพิ่มพารามิเตอร์                     | GET    | `/connected-measurement-points/:stationId/parameter-form`  | `cems_wpms_requests:view`    |
| 13  | ดึง config ปัจจุบันของจุดตรวจวัดที่เลือก                     | GET    | `/connected-measurement-points/:stationId/device-configs`  | `cems_wpms_requests:view`    |
| 14  | บันทึก config ปัจจุบันของจุดตรวจวัดที่เลือก                  | POST   | `/connected-measurement-points/:stationId/device-configs`  | `cems_wpms_requests:edit`    |
| 15  | ปฏิทินสถานะรายเดือนของจุดตรวจวัดที่เลือก                     | GET    | `/connected-measurement-points/:stationId/calendar-status` | `dashboard.stats:view`    |
| 16  | สถิติรายชั่วโมง/กราฟแนวโน้มของจุดตรวจวัดที่เลือก             | GET    | `/connected-measurement-points/:stationId/measurement-statistics` | `dashboard.stats:view` |
| 17  | Integration ดึง active device/parameter/status config         | GET    | `/integrations/device-configs/:stationId`                  | `X-API-Key`                  |

รายละเอียด API integration สำหรับระบบภายนอกอยู่ใน [`INTEGRATION_DEVICE_CONFIGS.md`](./INTEGRATION_DEVICE_CONFIGS.md)

## เจ้าหน้าที่เพิ่มจุดและเชื่อมต่อทันที

`POST /api/v1/cems-wpms-requests/direct-connections` ใช้ payload ส่วนฟอร์มเดียวกับ endpoint เพิ่มจุดตรวจวัด โดยมีข้อกำหนดเพิ่มดังนี้:

- ใช้ได้เฉพาะผู้ใช้เจ้าหน้าที่/ผู้ดูแลระบบ role `monitoring_kpm` หรือ `admin` ที่มี permission `cems_wpms_requests:direct_connect`
- ต้องส่ง `measurementPoints` exactly 1 รายการ
- ต้องส่ง `measurementPoints[0].pointCode` เป็นข้อความไม่ว่างหลัง trim ความยาวไม่เกิน 64 ตัวอักษร และไม่มีข้อบังคับ prefix/รูปแบบ
- backend ตรวจ factory ตาม scope ของเจ้าหน้าที่และใช้ชื่อ/เลขทะเบียนจาก master data
- client ห้ามส่ง `requestType`, `requestNo`, `status`, `submissionSource` หรือ audit fields

ค่าที่ backend กำหนดเอง:

| Field | Value |
| --- | --- |
| `requestType` | `ADD_MEASUREMENT_POINT` |
| `status` | `CONNECTED` |
| `statusLabel` | `เชื่อมต่อแล้ว` |
| `submissionSource` | `OFFICER_DIRECT_API` |
| CEMS request no | `OLDC-YY-#####` |
| WPMS request no | `OLDW-YY-#####` |

ตัวอย่าง WPMS:

```bash
curl -X POST "http://localhost:3000/api/v1/cems-wpms-requests/direct-connections" \
  -H "Authorization: Bearer $OFFICER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "factoryId": "factory-001",
    "factoryName": "บริษัท ทดสอบ จำกัด",
    "factoryRegistrationNo": "3-106-33/50สบ",
    "systemType": "WPMS",
    "contactPersons": [{ "name": "สมชาย ใจดี", "phone": "0812345678" }],
    "measurementPoints": [{
      "pointName": "จุดระบายน้ำทิ้ง A",
      "pointCode": "รหัสที่เจ้าหน้าที่กำหนดเอง",
      "pointType": "WASTEWATER",
      "details": {
        "monitoringPointKind": "WPMS",
        "eligibleParameters": ["BOD (mg/l)"],
        "exemptedParameters": ["ไม่มี"],
        "connectedParameters": ["ไม่มี"],
        "pendingParameters": ["BOD (mg/l)"],
        "requestedParameters": ["BOD (mg/l)"],
        "hasTreatmentSystem": "มี",
        "treatmentSystem": ["Activated Sludge"],
        "maxTreatmentCapacity": 100,
        "connectionDevice": "D-POMS Client (ใหม่)"
      },
      "documentsAndImages": [],
      "measurementInstruments": { "parameters": [] }
    }]
  }'
```

สำเร็จตอบ `201 Created`, ส่ง `Location: /api/v1/cems-wpms-requests/:id` และ response envelope มาตรฐาน รายการจะมองเห็นได้ทันทีทั้ง API รายการคำขอและ connected measurement points โดยบันทึกหัวคำขอ, factory snapshot, จุดในคำขอ, status history และ current/live point ใน transaction เดียวกัน Endpoint นี้ไม่สร้าง device config หรือ measurement channels

ถ้า `pointCode` ซ้ำกับ active connected point ตอบ `409 Conflict` และ rollback ทั้ง transaction โดยไม่ย้ายหรือแทนที่จุดเดิม

## API Mapping สำหรับปุ่มบนจุดตรวจวัด

ใช้ `factoryId` สำหรับปุ่มรายละเอียดจุดตรวจวัดระดับโรงงาน และใช้ `stationId` เป็นรหัสจุดตรวจวัด เช่น `S0001` หรือ `P0001` สำหรับ action รายจุด

| ปุ่ม | ใช้ API | หมายเหตุ |
| --- | --- | --- |
| รายละเอียดจุดตรวจวัด | `GET /api/v1/connected-measurement-points/factories/:factoryId` | คืนรายการจุดตรวจวัดของโรงงาน โดย CEMS คง field เดิม และ WPMS เพิ่ม field สำหรับ prefill แบบ กวภ.03 เช่น `instruments`, `measurementTimes`, `wastewaterSource`, `receivingSource`, `treatmentSystemType`, `dischargePoint`, `averageDischarge`, `minimumDischarge`, `maximumDischarge` |
| เปิดดู | `GET /api/v1/connected-measurement-points/:stationId/requests` | คืนรายการคำขอทุกคำขอของจุดตรวจวัดที่เลือก โดยจับทั้งรหัส/ชื่อจุดจาก current connected point และแต่ละรายการใช้ shape เดียวกับ `GET /api/v1/cems-wpms-requests/:id/detail` |
| เพิ่มพารามิเตอร์ | `GET /api/v1/connected-measurement-points/:stationId/parameter-form` | คืน `formDefaults` เป็น payload shape เดียวกับ `POST /api/v1/cems-wpms-requests/parameters` |
| เพิ่มพารามิเตอร์ | `POST /api/v1/cems-wpms-requests/parameters` | บันทึกคำขอเพิ่มพารามิเตอร์; ใช้ฟอร์ม shape เดียวกับเพิ่มจุดตรวจวัด แต่ต้องมี `measurementPoints[0].pointCode` |
| ตั้งค่า | `GET /api/v1/connected-measurement-points/:stationId/device-configs` | คืน config ปัจจุบันจาก active settings ของจุดตรวจวัดที่เลือก |
| ตั้งค่า | `POST /api/v1/connected-measurement-points/:stationId/device-configs` | บันทึก active settings ปัจจุบัน; payload ใช้รูปแบบเดียวกับ device config เดิม และ `stationId` ใน payload ต้องตรงกับ path |
| ดูรายละเอียด | `GET /api/v1/connected-measurement-points/:stationId/calendar-status?month=2026-06` | คืนข้อมูลทำ DateCalendar รายเดือนจากตาราง `{stationId}_data_60m` |
| ดูรายละเอียด | `GET /api/v1/connected-measurement-points/:stationId/measurement-statistics?date=2026-06-09` | คืนข้อมูลกราฟและตารางรายชั่วโมงจากตาราง `{stationId}_data_60m`; `data.measurementPoints[]` มี `pointName`, `latitude`, `longitude` โดย fallback จากพิกัดใน `details` เมื่อ column หลักว่าง; `data.thresholds[]` ต้องคงพารามิเตอร์ที่ตั้งค่าไว้ครบ แม้ไม่มีค่าเกณฑ์ โดยส่ง `normalMax: null`, `warningMax: null` |

รายละเอียด API ของหน้าดูรายละเอียดอยู่ใน [`OPERATOR_FACTORY_DASHBOARD.md`](./OPERATOR_FACTORY_DASHBOARD.md#detail-page-apis)

### รายละเอียดจุดตรวจวัดสำหรับ modal

```bash
curl "http://localhost:3000/api/v1/connected-measurement-points/factories/factory-001" \
  -H "Authorization: Bearer $TOKEN"
```

Response:

```json
{
  "success": true,
  "data": [
    {
      "pointCode": "P0001",
      "pointName": "จุดระบายน้ำทิ้ง A",
      "pointType": "WPMS",
      "parameterDetails": ["BOD (mg/l)", "COD (mg/l)"],
      "primaryFuel": null,
      "secondaryFuel": null,
      "instruments": ["ค่าบีโอดี (BOD) และ ค่าซีโอดี (COD)"],
      "measurementTimes": ["Real Time", "15 นาที"],
      "wastewaterSource": "ระบบบำบัดน้ำเสียส่วนกลาง",
      "receivingSource": "คลองสาธารณะ",
      "treatmentSystemType": "ระบบตะกอนเร่ง",
      "dischargePoint": "13.7563, 100.5018",
      "averageDischarge": 120.5,
      "minimumDischarge": 95,
      "maximumDischarge": 160
    }
  ],
  "meta": {
    "total": 1
  }
}
```

WPMS-only fields for กวภ.03:

| Field | Type | Source |
| --- | --- | --- |
| `instruments` | string[] | Derived from registered WPMS `parameterDetails`; returns the กวภ.03 option labels for BOD/COD |
| `measurementTimes` | string[] | Unique non-empty `measurementInstruments.parameters[].technique` values |
| `wastewaterSource` | string|null | `measurementPoints[].details.wastewaterSource` |
| `receivingSource` | string|null | `measurementPoints[].details.dischargeReceivingSource` |
| `treatmentSystemType` | string|null | `measurementPoints[].details.treatmentSystem` |
| `dischargePoint` | string|null | `details.dischargePoint` if present, otherwise `instrumentLatitude, instrumentLongitude` |
| `averageDischarge` | number|string|null | `measurementPoints[].details.averageWastewaterDischarge` |
| `minimumDischarge` | number|string|null | `measurementPoints[].details.minWastewaterDischarge` |
| `maximumDischarge` | number|string|null | `measurementPoints[].details.maxWastewaterDischarge` |

## Flow เพิ่มจุดตรวจวัด จบ 1 คำขอ

1. Frontend เปิดฟอร์ม "เพิ่มจุดตรวจวัด"
2. เรียก `GET /cems-wpms-requests/factories/:factoryId/general` เพื่อดึงข้อมูลทั่วไปของโรงงานลงฟอร์ม
3. ผู้ใช้กรอก `measurementPoints[].details`, `measurementPoints[].measurementInstruments` และแนบเอกสาร/รูปภาพของ CEMS หรือ WPMS ตาม section ในฟอร์ม
4. ถ้ามีไฟล์จริงหรืออยากบันทึกลิงก์ก่อน ให้เรียก `POST /cems-wpms-requests/document-images` แล้วนำ response ไปใส่ `measurementPoints[].documentsAndImages[]`
5. เรียก `POST /cems-wpms-requests/measurement-points` เพื่อบันทึกทั้งฟอร์ม
6. คำขอถูกสร้างเป็น `ADD_MEASUREMENT_POINT` และสถานะเริ่มต้น `PENDING_DESIGN_REVIEW`

## 0. ดึงข้อมูลทั่วไปของโรงงาน สำหรับลงฟอร์ม เพิ่มจุดตรวจวัด

ค้นหาได้ด้วย `factoryId`/`fid` หรือเลขทะเบียนโรงงาน (`factoryRegistrationNo`) และผู้ประกอบการจะเห็นเฉพาะโรงงานตัวเองตาม token

```bash
curl "http://localhost:3000/api/v1/cems-wpms-requests/factories/factory-001/general" \
  -H "Authorization: Bearer $OPERATOR_TOKEN"
```

Response:

```json
{
  "success": true,
  "data": {
    "id": 1,
    "factoryId": "factory-001",
    "factoryName": "บริษัท ทดสอบ จำกัด",
    "newRegistrationNo": "3-106-33/50สบ",
    "oldRegistrationNo": null,
    "juristicId": "0105556125804",
    "juristicName": "บริษัท ทดสอบ จำกัด",
    "industryType": "ผลิตเคมีภัณฑ์",
    "industryMainOrder": "106",
    "industrySubOrder": "33",
    "businessActivity": "ผลิตเคมีภัณฑ์",
    "eia": "มี",
    "projectName": null,
    "address": "99 หมู่ 1",
    "province": "สระบุรี",
    "industrialEstateName": null,
    "latitude": "13.7563",
    "longitude": "100.5018",
    "systemId": 12,
    "systemDetail": "ผลิตเคมีภัณฑ์",
    "verifyStatus": 1,
    "authorizeStart": "2026-01-01",
    "authorizeEnd": "2026-12-31",
    "operationStatus": "ประกอบกิจการ",
    "capitalAmount": 1000000,
    "machineryHorsepower": 250,
    "productionCapacity": "10 ตัน/วัน",
    "wastewaterDischargeInfo": "ระบายน้ำทิ้งหลังบำบัด",
    "boilerCount": 1,
    "boilerSizeEach": "10 ตันไอน้ำ/ชั่วโมง",
    "fuelUsed": "ก๊าซธรรมชาติ",
    "hasEia": true,
    "formDefaults": {
      "factoryId": "factory-001",
      "factoryName": "บริษัท ทดสอบ จำกัด",
      "factoryRegistrationNo": "3-106-33/50สบ"
    }
  }
}
```

Frontend ใช้ `data.formDefaults` เติมค่าหลักใน `POST /measurement-points` ได้ทันที:

```json
{
  "factoryId": "factory-001",
  "factoryName": "บริษัท ทดสอบ จำกัด",
  "factoryRegistrationNo": "3-106-33/50สบ"
}
```

Field ข้อมูลทั่วไปของโรงงานที่ส่งบันทึกเป็น snapshot ในคำขอได้:

| UI | Field | Type |
| --- | --- | --- |
| ลำดับประเภทโรงงาน (หลัก) | `industryMainOrder` | `string|null` |
| คำอธิบายประเภทโรงงาน (หลัก) | `industryMainOrderLabel` | `string|null` |
| ลำดับประเภทโรงงาน (รอง) | `industrySubOrder` | `string|null` |
| การประกอบกิจการ | `businessActivity` | `string|null` |
| ประเภทการประเมินผลกระทบสิ่งแวดล้อม | `eia` | `"มี"|"ไม่มี"|"มี IEE"|"มี EIA"|"มี EHIA"|"อื่นๆ"|null` |
| รายละเอียดประเภทอื่น | `eiaOther` | `string|null`; required เมื่อ `eia = "อื่นๆ"` |
| สถานะ EIA แบบ boolean | `hasEia` | `boolean|null`; ต้องสอดคล้องกับ `eia` |
| ชื่อโครงการ | `projectName` | `string|null` |
| สถานที่ตั้งโรงงาน | `address` | `string|null` |
| ภาค | `regionCode`, `regionName` | `string|null` |
| จังหวัด | `provinceCode`, `provinceName` | `string|null` |
| อำเภอ/เขต | `districtCode`, `districtName` | `string|null` |
| ตำบล/แขวง | `subdistrictCode`, `subdistrictName` | `string|null` |
| นิคมอุตสาหกรรม | `industrialEstateCode`, `industrialEstateName` | `string|null` |
| พิกัดโรงงาน (ละติจูด) | `latitude` | `number|null` |
| พิกัดโรงงาน (ลองจิจูด) | `longitude` | `number|null` |

เมื่อ submit คำขอ ระบบจะ snapshot ข้อมูลค้นหาขั้นสูงลงตาราง `cems_wpms_request_factory_snapshots` แยกจากหัวคำขอ เพื่อให้ค้นหาย้อนหลังตามข้อมูล ณ วันที่ส่งคำขอได้ แม้ข้อมูล master โรงงานจะถูกแก้ภายหลัง ถ้า payload ไม่ส่ง `provinceName`/`regionName`/`industrialEstateName` backend จะพยายาม fallback จาก `factories` + `provinces` + `industrial_estates` ตาม `factoryId`/เลขทะเบียนโรงงาน

แหล่งข้อมูลโรงงานจริง:

ระบบใช้ข้อมูลจริงจาก DIW source table (`FACTORY_DB_SCHEMA`.`FACTORY_DB_TABLE`, ค่าเริ่มต้น `dbo.fac_import`) เท่านั้น ไม่มี mock 60,000 records แล้ว ถ้า DIW source ใช้งานไม่ได้ API รายการโรงงานที่เข้าข่ายจะ error แทนการ fallback เป็น mock

| Field ใน API | แหล่งข้อมูลปัจจุบัน | สถานะข้อมูลจริง |
| --- | --- | --- |
| `factoryName` | `fac_import.FNAME` | มีจาก `fac_import` |
| `factoryId` | `fac_import.FID` fallback `FACREG`/`DISPFACREG` | มีจาก `fac_import` |
| `factoryRegistrationNo` / `newRegistrationNo` | `fac_import.DISPFACREG` fallback `FACREG`/`FID` | มีจาก `fac_import` |
| `industryMainOrder` / `factoryClass` | `fac_import.CLASS` | ใช้เลข 5 ตัวท้ายจาก `CLASS`; มีถ้า column `CLASS` มีใน source; ตาม DataDict อาจต้อง join `FAC_CLASS.CLASS` ด้วย `FID` |
| `industrySubOrder` / `factorySubclass` | `FACCLASS.CLASS` join ด้วย `FID` | ใช้เลข 5 หลักท้ายจาก `FACCLASS.CLASS`, ตัดค่าซ้ำและตัดรหัสที่ซ้ำกับ `industryMainOrder`, มากกว่า 1 ค่า join ด้วย comma; ถ้าไม่เหลือค่าให้คืน `null` |
| `address` | `FADDR`, `FMOO`, `SOI`, `ROAD`, `TUMBOL`, `AMP`, `PROV`, `ZIPCODE` | มีจาก `fac_import` เท่าที่ source ส่งมา |
| `province` / `provinceName` | `fac_import.PROV` map เป็นชื่อจังหวัด | มีจาก `fac_import` |
| `industrialEstateName` | `fac_import.COLONY_INDUST_CODE` | ตอนนี้เป็นค่าที่ source ส่งมา; ถ้าต้องการชื่อเต็มตาม DataDict ให้ join `FAC_COLONY_INDUST.COLONY_INDUST_DESC` |
| `latitude` | `fac_import.LATITUDE_Y` หรือสลับกับ `LONGITUDE_X` เมื่อเป็น WGS84 | มีเฉพาะค่าพิกัด WGS84; ค่า projected จะไม่ถูกส่งเป็น lat/lng |
| `longitude` | `fac_import.LONGITUDE_X` หรือสลับกับ `LATITUDE_Y` เมื่อเป็น WGS84 | มีเฉพาะค่าพิกัด WGS84; ค่า projected จะไม่ถูกส่งเป็น lat/lng |
| `businessActivity` | `fac_import.OBJECT` | มีจาก `fac_import` |
| `operationStatus` | `fac_import.FFLAG` | มีจาก `fac_import` (`1` = แจ้งประกอบแล้ว, `3` = หยุดชั่วคราว) |
| `capitalAmount` | `fac_import.TOTAL_CAP`, fallback `CAPREGIS`, fallback sum `CAPLAND`+`CAPBUILD`+`CAPMACH`+`CAPWORK` | มีจาก `fac_import` เท่าที่ source ส่งมา |
| `machineryHorsepower` | `fac_import.HP2`, fallback `HP` | มีจาก `fac_import`; ตาม DataDict อาจต้อง join `FAC_MACH.HP` ด้วย `FID` ถ้า `fac_import` ไม่มี |
| `productionCapacity` | `fac_import.CAPPROD` | มีจาก `fac_import` |
| `wastewaterDischargeInfo` | `fac_import.CANAL`, `RIVER` | มีจาก `fac_import` ถ้า source มีคลอง/แม่น้ำ |
| `boilerCount` | ไม่มีใน `fac_import` mapping ปัจจุบัน | ต้องหา source เพิ่มจากตารางเครื่องจักร/หม้อน้ำของ DIW หรือให้เจ้าหน้าที่กรอกตอนเลือกโรงงาน |
| `boilerSizeEach` | ไม่มีใน `fac_import` mapping ปัจจุบัน | ต้องหา source เพิ่มจากตารางเครื่องจักร/หม้อน้ำของ DIW หรือให้เจ้าหน้าที่กรอกตอนเลือกโรงงาน |
| `fuelUsed` | ไม่มี direct ใน `fac_import`; DataDict ระบุ `FID -> FAC_MACH.FUELCODE` | ต้อง join `FAC_MACH` ด้วย `FID` และ map `FUELCODE` เป็นชื่อเชื้อเพลิง |
| `eia` / `hasEia` | ไม่มีใน `fac_import` mapping ปัจจุบัน | ต้องหา source จากระบบ/ตาราง EIA หรือให้เจ้าหน้าที่กรอกตอนเลือกโรงงาน; ระหว่างนี้ API คืน `eia: "ไม่มี"` เป็นค่าชั่วคราวเมื่อไม่มีข้อมูล |
| `projectName` | ไม่มีใน `fac_import` mapping ปัจจุบัน | ต้องหา source จากระบบ/ตาราง EIA/project หรือให้ผู้ประกอบการกรอกในฟอร์ม; ระหว่างนี้ API คืน `projectName: "ไม่ระบุ"` เป็นค่าชั่วคราวเมื่อไม่มีข้อมูล |

ค่าชั่วคราว:

ถ้า source ยังไม่มีข้อมูล API รายละเอียดโรงงานและรายการโรงงานผู้ประกอบการจะคืนค่า fallback ชั่วคราวดังนี้ เพื่อให้ frontend ใช้งานได้ก่อน:

| Field | Temporary value |
| --- | --- |
| `industryMainOrder` | `"ไม่ระบุ"` |
| `industrySubOrder` | `"ไม่ระบุ"` |
| `eia` | `"ไม่มี"` |
| `projectName` | `"ไม่ระบุ"` |

หมายเหตุ:

- `measurementPoints[].parameters` ไม่ต้องส่งจาก frontend แล้ว backend จะ derive จาก `measurementPoints[].measurementInstruments.parameters[].parameter`
- ถ้า frontend เดิมส่ง `measurementInstruments.parameters: []` backend จะ fallback จาก `details.pendingParameters`, `details.eligibleParameters`, แล้วจึง `details.connectedParameters`
- `measurementPoints[].description` เป็น field optional สำหรับหมายเหตุเพิ่มเติม ถ้าหน้าฟอร์มไม่มีช่องนี้ไม่ต้องส่ง

## 1. บันทึกฟอร์ม เพิ่มจุดตรวจวัด

Endpoint นี้เป็นการ submit ฟอร์มหลัก จึงยังใช้ `Content-Type: application/json`
ถ้ามีไฟล์จริง ให้ upload ผ่าน `POST /cems-wpms-requests/document-images` แบบ `multipart/form-data` ก่อน แล้วนำ response `data` มาใส่ใน `measurementPoints[].documentsAndImages[]`

```bash
curl -X POST "http://localhost:3000/api/v1/cems-wpms-requests/measurement-points" \
  -H "Authorization: Bearer $OPERATOR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "factoryId": "factory-001",
    "factoryName": "บริษัท ทดสอบ จำกัด",
    "factoryRegistrationNo": "3-106-33/50สบ",
    "industryMainOrder": "106",
    "industryMainOrderLabel": "ประเภทโรงงานลำดับที่ 106: ผลิตเคมีภัณฑ์",
    "industrySubOrder": "33",
    "businessActivity": "ผลิตเคมีภัณฑ์",
    "eia": "มี",
    "hasEia": true,
    "projectName": "โครงการทดสอบ CEMS",
    "address": "99 หมู่ 1 ตำบลทดสอบ อำเภอเมือง จังหวัดสระบุรี",
    "regionName": "ภาคกลาง",
    "provinceCode": "19",
    "provinceName": "สระบุรี",
    "districtName": "เมืองสระบุรี",
    "subdistrictName": "ปากเพรียว",
    "industrialEstateCode": null,
    "industrialEstateName": null,
    "latitude": 13.7563,
    "longitude": 100.5018,
    "systemType": "CEMS",
    "contactPersons": [
      {
        "name": "สมชาย ใจดี",
        "phone": "0812345678",
        "email": "ops@example.com",
        "position": "ผู้จัดการสิ่งแวดล้อม"
      },
      {
        "name": "สมหญิง ใจดี",
        "phone": "0899999999",
        "email": "ops2@example.com",
        "position": "วิศวกร"
      }
    ],
    "notificationEmails": ["ops@example.com", "ops2@example.com"],
    "officerNotificationEmails": ["officer@example.com"],
    "informationProviderName": "ธนากรณ์ ศรีคอม",
    "informationProviderPosition": "ผู้จัดการโรงงาน",
    "measurementPoints": [
      {
        "pointName": "ปล่องระบาย A",
        "pointType": "STACK",
        "details": {
          "productionUnitType": "หม้อไอน้ำ",
          "productionCapacity": "10",
          "productionCapacityUnit": "ตันไอน้ำ/ชั่วโมง",
          "cemsInstallationRequiredBy": "ประกาศ อก.",
          "cemsInstallationRequiredOther": null,
          "legalAnnexNo": ["1", "3"],
          "eligibleParameters": ["NOx", "SO2", "PM"],
          "exemptedParameters": [],
          "connectedParameters": [],
          "pendingParameters": ["NOx", "SO2", "PM"],
          "stackShape": "วงกลม",
          "stackDiameter": 1.2,
          "stackWidth": null,
          "stackLength": null,
          "stackShapeOther": null,
          "stackHeight": 30,
          "monitoringHeight": 20,
          "averageFlowRate": 1200,
          "minFlowRate": 1000,
          "maxFlowRate": 1500,
          "primaryFuel": "ก๊าซธรรมชาติ",
          "primaryFuelOther": null,
          "primaryFuelPercent": 80,
          "secondaryFuel": "ไม่มี",
          "secondaryFuelOther": null,
          "secondaryFuelPercent": null,
          "combustionControlSystem": "ควบคุมอัตโนมัติ",
          "hasTreatmentSystem": "มี",
          "treatmentSystem": "สครับเบอร์",
          "treatmentSystemOther": null,
          "stackLatitude": 13.7563,
          "stackLongitude": 100.5018,
          "connectionDevice": "POMS Box (กรอ.)",
          "connectionDeviceOther": null
        },
        "documentsAndImages": [
          {
            "title": "ภาพถ่ายปล่อง",
            "description": "ภาพถ่ายตำแหน่งปล่องและเครื่องมือตรวจวัด",
            "link": "https://example.com/documents/stack-reference.pdf",
            "fileName": "stack.png",
            "fileUrl": "https://example.com/files/stack.png",
            "fileType": "image/png",
            "fileSize": 1024
          }
        ],
        "measurementInstruments": {
          "converterBrand": "Converter Brand",
          "converterModel": "CV-100",
          "parameters": [
            {
              "parameter": "NOx",
              "technique": "NDIR",
              "range": "0-200",
              "brand": "Siemens",
              "supplier": "ABC Tech",
              "eiaStandard": "120",
              "standardCondition": true,
              "dryBasis": true,
              "oxygenOrExcessAir": true,
              "standardCriteria": {
                "enabled": true,
                "standardValue": "120",
                "rows": [
                  { "level": "normal", "min": 0, "max": 80 },
                  { "level": "warning", "min": 80, "max": 100 },
                  { "level": "critical", "min": 100, "max": null }
                ]
              },
              "eiaCriteria": {
                "enabled": true,
                "standardValue": "100",
                "rows": [
                  { "level": "normal", "min": 0, "max": 70 },
                  { "level": "warning", "min": 70, "max": 90 },
                  { "level": "critical", "min": 90, "max": null }
                ]
              }
            },
            {
              "parameter": "SO2",
              "technique": "UV Fluorescence",
              "range": "0-500",
              "brand": "Thermo",
              "supplier": "XYZ Instrument",
              "eiaStandard": null,
              "standardCondition": false,
              "dryBasis": false,
              "oxygenOrExcessAir": false,
              "standardCriteria": {
                "enabled": false
              },
              "eiaCriteria": {
                "enabled": false
              }
            }
          ]
        }
      }
    ],
    "remarks": "ขอเพิ่มจุดตรวจวัด"
  }'
```

Response:

```json
{
  "success": true,
  "data": {
    "id": 1,
    "requestNo": "CEMS-69-00001",
    "requestType": "ADD_MEASUREMENT_POINT",
    "requestTypeLabel": "เพิ่มจุดตรวจวัด",
    "factoryId": "factory-001",
    "factoryName": "บริษัท ทดสอบ จำกัด",
    "systemType": "CEMS",
    "status": "PENDING_DESIGN_REVIEW",
    "statusLabel": "รอพิจารณาแบบ",
    "contactPersons": [
      {
        "name": "สมชาย ใจดี",
        "phone": "0812345678",
        "email": "ops@example.com",
        "position": "ผู้จัดการสิ่งแวดล้อม"
      },
      {
        "name": "สมหญิง ใจดี",
        "phone": "0899999999",
        "email": "ops2@example.com",
        "position": "วิศวกร"
      }
    ],
    "notificationEmails": ["ops@example.com", "ops2@example.com"],
    "measurementPoints": [
      {
        "id": 1,
        "pointName": "ปล่องระบาย A",
        "pointCode": null,
        "pointType": "STACK",
        "parameters": ["NOx", "SO2", "O2"],
        "details": {
          "productionUnitType": "หม้อไอน้ำ",
          "productionCapacity": "10 ตันไอน้ำ/ชั่วโมง",
          "cemsInstallationRequiredBy": "ประกาศ อก.",
          "cemsInstallationRequiredOther": null,
          "legalAnnexNo": ["1", "3"],
          "eligibleParameters": ["NOx", "SO2", "PM"],
          "exemptedParameters": [],
          "connectedParameters": [],
          "pendingParameters": ["NOx", "SO2", "PM"],
          "stackShape": "วงกลม",
          "stackDiameter": 1.2,
          "stackWidth": null,
          "stackLength": null,
          "stackShapeOther": null,
          "stackHeight": 30,
          "monitoringHeight": 20,
          "averageFlowRate": 1200,
          "minFlowRate": 1000,
          "maxFlowRate": 1500,
          "primaryFuel": "ก๊าซธรรมชาติ",
          "primaryFuelOther": null,
          "primaryFuelPercent": 80,
          "secondaryFuel": "ไม่มี",
          "secondaryFuelOther": null,
          "secondaryFuelPercent": null,
          "combustionControlSystem": "ควบคุมอัตโนมัติ",
          "hasTreatmentSystem": "มี",
          "treatmentSystem": "สครับเบอร์",
          "treatmentSystemOther": null,
          "stackLatitude": 13.7563,
          "stackLongitude": 100.5018,
          "connectionDevice": "POMS Box (กรอ.)",
          "connectionDeviceOther": null
        },
        "documentsAndImages": [
          {
            "title": "ภาพถ่ายปล่อง",
            "fileName": "stack.png",
            "fileUrl": "https://example.com/files/stack.png",
            "fileType": "image/png",
            "fileSize": 1024
          }
        ],
        "measurementInstruments": {
          "converterBrand": "Converter Brand",
          "converterModel": "CV-100",
          "parameters": [
            {
              "parameter": "NOx",
              "technique": "NDIR",
              "range": "0-200",
              "brand": "Siemens",
              "supplier": "ABC Tech",
              "eiaStandard": "120",
              "standardCondition": true,
              "dryBasis": true,
              "oxygenOrExcessAir": true,
              "standardCriteria": {
                "enabled": true,
                "standardValue": "120",
                "rows": [
                  { "level": "normal", "min": 0, "max": 80 },
                  { "level": "warning", "min": 80, "max": 100 },
                  { "level": "critical", "min": 100, "max": null }
                ]
              },
              "eiaCriteria": {
                "enabled": true,
                "standardValue": "100",
                "rows": [
                  { "level": "normal", "min": 0, "max": 70 },
                  { "level": "warning", "min": 70, "max": 90 },
                  { "level": "critical", "min": 90, "max": null }
                ]
              }
            }
          ]
        }
      }
    ]
  }
}
```

## 2. บันทึกฟอร์ม เพิ่มพารามิเตอร์

Payload ใช้ข้อมูลโรงงาน/ผู้ติดต่อและ `measurementPoints[]` รูปแบบเดียวกับข้อ 1 แต่คำขอเพิ่มพารามิเตอร์ไม่บังคับ `documentsAndImages`; ต้องส่ง `measurementInstruments` ของพารามิเตอร์ที่ขอเพิ่ม

เงื่อนไขเฉพาะของฟอร์มเพิ่มพารามิเตอร์คือ ต้องส่ง `measurementPoints` แค่ 1 จุดตรวจวัดต่อคำขอ และต้องส่ง `pointCode` ของจุดตรวจวัดเดิมที่ backend เคยออกเลขให้แล้ว

```bash
curl -X POST "http://localhost:3000/api/v1/cems-wpms-requests/parameters" \
  -H "Authorization: Bearer $OPERATOR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "factoryId": "factory-001",
    "factoryName": "บริษัท ทดสอบ จำกัด",
    "factoryRegistrationNo": "3-106-33/50สบ",
    "industryMainOrder": "106",
    "industrySubOrder": "33",
    "businessActivity": "ผลิตเคมีภัณฑ์",
    "eia": "มี",
    "hasEia": true,
    "projectName": "โครงการทดสอบ CEMS",
    "address": "99 หมู่ 1 ตำบลทดสอบ อำเภอเมือง จังหวัดสระบุรี",
    "latitude": 13.7563,
    "longitude": 100.5018,
    "systemType": "CEMS",
    "contactPersons": [
      {
        "name": "สมชาย ใจดี",
        "phone": "0812345678",
        "email": "ops@example.com",
        "position": "ผู้จัดการสิ่งแวดล้อม"
      },
      {
        "name": "สมหญิง ใจดี",
        "phone": "0899999999",
        "email": "ops2@example.com",
        "position": "วิศวกร"
      }
    ],
    "notificationEmails": ["ops@example.com", "ops2@example.com"],
    "officerNotificationEmails": ["officer@example.com"],
    "informationProviderName": "ธนากรณ์ ศรีคอม",
    "informationProviderPosition": "ผู้จัดการโรงงาน",
    "measurementPoints": [
      {
        "pointName": "ปล่องระบาย A",
        "pointCode": "S0001",
        "pointType": "STACK",
        "details": {
          "productionUnitType": "หม้อไอน้ำ",
          "productionCapacity": "10 ตันไอน้ำ/ชั่วโมง",
          "cemsInstallationRequiredBy": "ประกาศ อก.",
          "cemsInstallationRequiredOther": null,
          "legalAnnexNo": ["1", "3"],
          "eligibleParameters": ["NOx", "SO2", "PM", "CO"],
          "exemptedParameters": [],
          "connectedParameters": ["NOx", "SO2", "PM"],
          "pendingParameters": ["CO"],
          "stackShape": "วงกลม",
          "stackDiameter": 1.2,
          "stackWidth": null,
          "stackLength": null,
          "stackShapeOther": null,
          "stackHeight": 30,
          "monitoringHeight": 20,
          "averageFlowRate": 1200,
          "minFlowRate": 1000,
          "maxFlowRate": 1500,
          "primaryFuel": "ก๊าซธรรมชาติ",
          "primaryFuelOther": null,
          "secondaryFuel": "ไม่มี",
          "secondaryFuelOther": null,
          "hasTreatmentSystem": "มี",
          "treatmentSystem": "สครับเบอร์",
          "treatmentSystemOther": null,
          "connectionDevice": "POMS Box (กรอ.)",
          "connectionDeviceOther": null
        },
        "documentsAndImages": [
          {
            "title": "ภาพถ่ายปล่อง",
            "description": "ภาพถ่ายตำแหน่งปล่องและเครื่องมือตรวจวัด",
            "link": "https://example.com/documents/stack-reference.pdf",
            "fileName": "stack.png",
            "fileUrl": "https://example.com/files/stack.png",
            "fileType": "image/png",
            "fileSize": 1024
          }
        ],
        "measurementInstruments": {
          "converterBrand": "Converter Brand",
          "converterModel": "CV-100",
          "parameters": [
            {
              "parameter": "CO",
              "technique": "NDIR",
              "range": "0-100",
              "brand": "Siemens",
              "supplier": "ABC Tech",
              "eiaStandard": "50",
              "standardCondition": true,
              "dryBasis": true,
              "oxygenOrExcessAir": true,
              "standardCriteria": {
                "enabled": true,
                "standardValue": "50",
                "rows": [
                  { "level": "normal", "min": 0, "max": 30 },
                  { "level": "warning", "min": 30, "max": 40 },
                  { "level": "critical", "min": 40, "max": null }
                ]
              },
              "eiaCriteria": {
                "enabled": true,
                "standardValue": "45",
                "rows": [
                  { "level": "normal", "min": 0, "max": 25 },
                  { "level": "warning", "min": 25, "max": 35 },
                  { "level": "critical", "min": 35, "max": null }
                ]
              }
            }
          ]
        }
      }
    ],
    "remarks": "ขอเพิ่มพารามิเตอร์"
  }'
```

Response จะเป็น shape เดียวกับข้อ 1 แต่ `requestType` เป็น `ADD_PARAMETER`

ตัวอย่าง field สำหรับ `details.stackShape`:

```json
{
  "details": {
    "stackShape": "สี่เหลี่ยม",
    "stackDiameter": null,
    "stackWidth": 1.5,
    "stackLength": 2,
    "stackShapeOther": null
  }
}
```

```json
{
  "details": {
    "stackShape": "อื่นๆ",
    "stackDiameter": null,
    "stackWidth": null,
    "stackLength": null,
    "stackShapeOther": "ปล่องทรงรี"
  }
}
```

### Validation รายละเอียดจุดตรวจวัด CEMS/WPMS

Backend เก็บ `measurementPoints[].details` เป็น JSON เหมือนเดิม แต่ตรวจโครงสร้างแยกตาม `systemType` เพื่อไม่ให้ CEMS/WPMS ปน field กัน

| Rule | CEMS | WPMS |
| --- | --- | --- |
| `pointType` | ต้องใช้ `STACK` | ต้องใช้ `WASTEWATER` |
| `details.monitoringPointKind` | ถ้าส่งต้องเป็น `CEMS` | ถ้าส่งต้องเป็น `WPMS` |
| รายละเอียดหลัก | ใช้ field กลุ่มปล่อง/เชื้อเพลิง/อากาศเสีย | ใช้ field กลุ่มน้ำทิ้ง/จุดติดตั้งเครื่องมือ |
| field ฝั่งตรงข้าม | ไม่รับ WPMS-only field | ไม่รับ CEMS-only field |

กลุ่มพารามิเตอร์ของ CEMS บันทึกได้มากกว่า 1 ค่า และต้องส่งเป็น `string[]`:

```json
{
  "details": {
    "eligibleParameters": ["NOx (ppm)", "SO2 (ppm)", "PM (mg/m³)"],
    "exemptedParameters": ["Hg (mg/m³)"],
    "connectedParameters": ["O2 (%)", "Flow (m³/s)"],
    "pendingParameters": ["CO (ppm)", "CO2 (ppm)"]
  }
}
```

WPMS ใช้กลุ่ม `eligibleParameters`, `connectedParameters`, และ `pendingParameters`
ได้เช่นกันสำหรับรายการพารามิเตอร์น้ำทิ้งที่เลือกในฟอร์ม แต่ field เฉพาะปล่อง
เช่น `timeSharingParameters` และ `sharedStackCode` ยังเป็นของ CEMS เท่านั้น

Conditional fields ที่ backend ตรวจ:

| ตัวเลือกในฟอร์ม | เงื่อนไข | Field ที่ต้องส่งเพิ่ม |
| --- | --- | --- |
| ลักษณะปล่อง | `stackShape = "วงกลม"` | `details.stackDiameter` เป็น number |
| ลักษณะปล่อง | `stackShape = "สี่เหลี่ยม"` | `details.stackWidth`, `details.stackLength` เป็น number |
| ลักษณะปล่อง | `stackShape = "อื่นๆ"` | `details.stackShapeOther` |
| ระบบบำบัด | `hasTreatmentSystem = "มี"` | `details.treatmentSystem` |
| ระบบบำบัด CEMS/WPMS | `treatmentSystem` มีค่า `"อื่นๆ"` | `details.treatmentSystemOther` |
| อุปกรณ์/โปรแกรมที่ใช้เชื่อมต่อ | `connectionDevice = "อื่นๆ"` | `details.connectionDeviceOther` |
| เชื้อเพลิงหลัก | `primaryFuel` เป็น `ชีวมวล`, `Biomass` หรือ `อื่นๆ` | `details.primaryFuelOther` |
| เชื้อเพลิงรอง | `secondaryFuel` เป็น `ชีวมวล`, `Biomass` หรือ `อื่นๆ` | `details.secondaryFuelOther` |
| ระบบบำบัด WPMS | `systemType = "WPMS"` และ `hasTreatmentSystem = "มี"` | `details.maxTreatmentCapacity` เป็น number |

ตัวอย่าง CEMS แบบสี่เหลี่ยม + ช่องงอก:

```json
{
  "systemType": "CEMS",
  "measurementPoints": [
    {
      "pointName": "ปล่องระบาย A",
      "pointType": "STACK",
      "details": {
        "monitoringPointKind": "CEMS",
        "eligibleParameters": ["NOx (ppm)", "SO2 (ppm)"],
        "exemptedParameters": ["PM (mg/m³)"],
        "connectedParameters": ["O2 (%)", "Flow (m³/s)"],
        "pendingParameters": ["CO (ppm)", "CO2 (ppm)"],
        "stackShape": "สี่เหลี่ยม",
        "stackWidth": 1.5,
        "stackLength": 2,
        "hasTreatmentSystem": "มี",
        "treatmentSystem": ["อื่นๆ"],
        "treatmentSystemOther": "ระบบเฉพาะโรงงาน",
        "connectionDevice": "อื่นๆ",
        "connectionDeviceOther": "Gateway เดิม"
      }
    }
  ]
}
```

ตัวอย่าง WPMS:

```json
{
  "systemType": "WPMS",
  "measurementPoints": [
    {
      "pointName": "จุดระบายน้ำทิ้ง A",
      "pointType": "WASTEWATER",
      "details": {
        "monitoringPointKind": "WPMS",
        "averageWastewaterDischarge": 500,
        "minWastewaterDischarge": 300,
        "maxWastewaterDischarge": 800,
        "eligibleParameters": ["COD (mg/l)", "Flow rate (m3/hr)", "Watt (kW/hr)"],
        "connectedParameters": [],
        "pendingParameters": ["COD (mg/l)", "Flow rate (m3/hr)", "Watt (kW/hr)"],
        "hasTreatmentSystem": "มี",
        "treatmentSystem": ["อื่นๆ"],
        "treatmentSystemOther": "ระบบเฉพาะโรงงาน",
        "maxTreatmentCapacity": 1000,
        "instrumentLatitude": 13.7563,
        "instrumentLongitude": 100.5018,
        "wastewaterSource": "กระบวนการผลิต",
        "dischargeReceivingSource": "คลองสาธารณะ",
        "connectionDevice": "D-POMS Box (กรอ.)"
      }
    }
  ]
}
```

Mapping:

| Label                                      | Field                                                       |
| ------------------------------------------ | ----------------------------------------------------------- |
| ประเภทของหน่วยการผลิต                      | `measurementPoints[].details.productionUnitType`            |
| กำลังการผลิตต่อหน่วย                       | `measurementPoints[].details.productionCapacity`            |
| หน่วยกำลังการผลิต                           | `measurementPoints[].details.productionCapacityUnit`        |
| เข้าข่ายต้องติดตั้ง CEMS ตามกฎหมาย         | `measurementPoints[].details.cemsInstallationRequiredBy`    |
| อื่นๆ โปรดระบุของเข้าข่ายต้องติดตั้ง       | `measurementPoints[].details.cemsInstallationRequiredOther` |
| เข้าข่ายตามบัญชีแนบท้ายลำดับที่            | `measurementPoints[].details.legalAnnexNo`                  |
| พารามิเตอร์ที่เข้าข่าย                     | `measurementPoints[].details.eligibleParameters`            |
| พารามิเตอร์ที่ได้รับการยกเว้น              | `measurementPoints[].details.exemptedParameters`            |
| พารามิเตอร์ที่เชื่อมต่อแล้ว                | `measurementPoints[].details.connectedParameters`           |
| พารามิเตอร์ที่ยังไม่เชื่อมต่อ              | `measurementPoints[].details.pendingParameters`             |
| พารามิเตอร์ที่ติดตั้งแบบ Time sharing      | `measurementPoints[].details.timeSharingParameters`         |
| ร่วมกับปล่อง                               | `measurementPoints[].details.sharedStackCode`               |
| ลักษณะปล่อง                                | `measurementPoints[].details.stackShape`                    |
| เส้นผ่านศูนย์กลาง (เมตร) เมื่อเลือกวงกลม   | `measurementPoints[].details.stackDiameter`                 |
| กว้าง (เมตร) เมื่อเลือกสี่เหลี่ยม          | `measurementPoints[].details.stackWidth`                    |
| ยาว (เมตร) เมื่อเลือกสี่เหลี่ยม            | `measurementPoints[].details.stackLength`                   |
| โปรดระบุ เมื่อเลือกอื่นๆ                   | `measurementPoints[].details.stackShapeOther`               |
| ความสูงปล่อง (เมตร)                        | `measurementPoints[].details.stackHeight`                   |
| ความสูงของจุดตรวจวัด (เมตร)                | `measurementPoints[].details.monitoringHeight`              |
| อัตราการระบายอากาศเฉลี่ย (m3/hr)           | `measurementPoints[].details.averageFlowRate`               |
| อัตราการระบายอากาศต่ำสุด (m3/hr)           | `measurementPoints[].details.minFlowRate`                   |
| อัตราการระบายอากาศสูงสุด (m3/hr)           | `measurementPoints[].details.maxFlowRate`                   |
| เชื้อเพลิงหลักที่ใช้                       | `measurementPoints[].details.primaryFuel`                   |
| โปรดระบุของเชื้อเพลิงหลักอื่นๆ             | `measurementPoints[].details.primaryFuelOther`              |
| ร้อยละโดยประมาณของเชื้อเพลิงหลัก           | `measurementPoints[].details.primaryFuelPercent`            |
| เชื้อเพลิงรอง (ถ้ามี)                      | `measurementPoints[].details.secondaryFuel`                 |
| โปรดระบุของเชื้อเพลิงรองอื่นๆ              | `measurementPoints[].details.secondaryFuelOther`            |
| ร้อยละโดยประมาณของเชื้อเพลิงรอง            | `measurementPoints[].details.secondaryFuelPercent`          |
| ระบบการควบคุมปริมาณอากาศและสภาวะการเผาไหม้ | `measurementPoints[].details.combustionControlSystem`       |
| ระบบบำบัด                                  | `measurementPoints[].details.hasTreatmentSystem`            |
| ระบุระบบบำบัด                              | `measurementPoints[].details.treatmentSystem`               |
| ระบุรายละเอียดของระบบบำบัดอื่นๆ            | `measurementPoints[].details.treatmentSystemOther`          |
| พิกัดปล่องที่ติดตั้ง CEMS (ละติจูด)        | `measurementPoints[].details.stackLatitude`                 |
| พิกัดปล่องที่ติดตั้ง CEMS (ลองจิจูด)       | `measurementPoints[].details.stackLongitude`                |
| อุปกรณ์/โปรแกรมที่ใช้เชื่อมต่อ             | `measurementPoints[].details.connectionDevice`              |
| โปรดระบุของอุปกรณ์/โปรแกรมอื่นๆ            | `measurementPoints[].details.connectionDeviceOther`         |

## 2.0 Frontend Field Mapping ครบทุกช่อง

API รับข้อมูลจุดตรวจวัดผ่าน `measurementPoints[]` โดย field หลักที่ backend ใช้ร่วมกันคือ:

| UI                                                   | Field                                        |
| ---------------------------------------------------- | -------------------------------------------- |
| รหัสจุดตรวจวัด / รหัสหน่วยตรวจวัด / รหัสสถานีตรวจวัด | `measurementPoints[].pointCode`              |
| ชื่อจุดตรวจวัด / ชื่อหน่วยตรวจวัด / ชื่อสถานีตรวจวัด | `measurementPoints[].pointName`              |
| ประเภทจุดตรวจวัด                                     | `measurementPoints[].pointType`              |
| พารามิเตอร์                                          | derive จาก `measurementPoints[].measurementInstruments.parameters[].parameter` |
| รายละเอียดเพิ่มเติม                                  | `measurementPoints[].details`                |
| เอกสารและรูปภาพ                                      | `measurementPoints[].documentsAndImages`     |
| รายละเอียดเครื่องมือตรวจวัด                          | `measurementPoints[].measurementInstruments` |

Mapping ประเภทที่ frontend เลือก:

| Frontend type | `systemType`                | `pointType`  | แนะนำเพิ่มใน `details.monitoringPointKind` |
| ------------- | --------------------------- | ------------ | ------------------------------------------ |
| CEMS          | `CEMS`                      | `STACK`      | `CEMS`                                     |
| WPMS          | `WPMS`                      | `WASTEWATER` | `WPMS`                                     |
| Mobile        | `CEMS` หรือ `WPMS` ตามบริบท | `OTHER`      | `Mobile`                                   |
| Station       | `CEMS` หรือ `WPMS` ตามบริบท | `OTHER`      | `Station`                                  |

Backend ยังรับ alias `type: "CEMS" | "WPMS"` และ infer `pointType` จาก `details.monitoringPointKind` ได้เพื่อรองรับฟอร์มเดิม แต่ frontend ใหม่ควรส่ง `systemType` และ `pointType` ตามตารางด้านบนเสมอ.

หมายเหตุ: `pointCode` เป็นเลขที่ backend ออกให้หลังเจ้าหน้าที่อนุมัติแบบ ไม่ใช่ field ที่ frontend ต้องสร้างเองสำหรับฟอร์มเพิ่มจุดตรวจวัด

### CEMS Details

| Label                                      | Field                                                       |
| ------------------------------------------ | ----------------------------------------------------------- |
| ประเภทของหน่วยการผลิต                      | `measurementPoints[].details.productionUnitType`            |
| กำลังการผลิตต่อหน่วย                       | `measurementPoints[].details.productionCapacity`            |
| หน่วยกำลังการผลิต                           | `measurementPoints[].details.productionCapacityUnit`        |
| เข้าข่ายต้องติดตั้ง CEMS ตามกฎหมาย         | `measurementPoints[].details.cemsInstallationRequiredBy`    |
| อื่นๆ โปรดระบุ                             | `measurementPoints[].details.cemsInstallationRequiredOther` |
| เข้าข่ายตามบัญชีแนบท้ายลำดับที่            | `measurementPoints[].details.legalAnnexNo`                  |
| พารามิเตอร์ที่เข้าข่าย                     | `measurementPoints[].details.eligibleParameters`            |
| พารามิเตอร์ที่ได้รับการยกเว้น              | `measurementPoints[].details.exemptedParameters`            |
| พารามิเตอร์ที่เชื่อมต่อแล้ว                | `measurementPoints[].details.connectedParameters`           |
| พารามิเตอร์ที่ยังไม่เชื่อมต่อ              | `measurementPoints[].details.pendingParameters`             |
| ลักษณะปล่อง                                | `measurementPoints[].details.stackShape`                    |
| เส้นผ่านศูนย์กลาง (เมตร)                   | `measurementPoints[].details.stackDiameter`                 |
| กว้าง (เมตร)                               | `measurementPoints[].details.stackWidth`                    |
| ยาว (เมตร)                                 | `measurementPoints[].details.stackLength`                   |
| โปรดระบุของลักษณะปล่องอื่นๆ                | `measurementPoints[].details.stackShapeOther`               |
| ความสูงปล่อง (เมตร)                        | `measurementPoints[].details.stackHeight`                   |
| ความสูงของจุดตรวจวัด (เมตร)                | `measurementPoints[].details.monitoringHeight`              |
| อัตราการระบายอากาศเฉลี่ย (m3/hr)           | `measurementPoints[].details.averageFlowRate`               |
| อัตราการระบายอากาศต่ำสุด (m3/hr)           | `measurementPoints[].details.minFlowRate`                   |
| อัตราการระบายอากาศสูงสุด (m3/hr)           | `measurementPoints[].details.maxFlowRate`                   |
| เชื้อเพลิงหลักที่ใช้                       | `measurementPoints[].details.primaryFuel`                   |
| โปรดระบุของเชื้อเพลิงหลักอื่นๆ             | `measurementPoints[].details.primaryFuelOther`              |
| ร้อยละโดยประมาณของเชื้อเพลิงหลัก           | `measurementPoints[].details.primaryFuelPercent`            |
| เชื้อเพลิงรอง (ถ้ามี)                      | `measurementPoints[].details.secondaryFuel`                 |
| โปรดระบุของเชื้อเพลิงรองอื่นๆ              | `measurementPoints[].details.secondaryFuelOther`            |
| ร้อยละโดยประมาณของเชื้อเพลิงรอง            | `measurementPoints[].details.secondaryFuelPercent`          |
| ระบบการควบคุมปริมาณอากาศและสภาวะการเผาไหม้ | `measurementPoints[].details.combustionControlSystem`       |
| ระบบบำบัด                                  | `measurementPoints[].details.hasTreatmentSystem`            |
| ระบุระบบบำบัด                              | `measurementPoints[].details.treatmentSystem`               |
| ระบุรายละเอียดของระบบบำบัด                 | `measurementPoints[].details.treatmentSystemOther`          |
| พิกัดปล่องที่ติดตั้ง CEMS (ละติจูด)        | `measurementPoints[].details.stackLatitude`                 |
| พิกัดปล่องที่ติดตั้ง CEMS (ลองจิจูด)       | `measurementPoints[].details.stackLongitude`                |
| อุปกรณ์/โปรแกรมที่ใช้เชื่อมต่อ             | `measurementPoints[].details.connectionDevice`              |
| โปรดระบุของอุปกรณ์/โปรแกรมอื่นๆ            | `measurementPoints[].details.connectionDeviceOther`         |

ตัวอย่าง CEMS details:

```json
{
  "pointType": "STACK",
  "details": {
    "monitoringPointKind": "CEMS",
    "productionUnitType": "หม้อไอน้ำ",
    "productionCapacity": "10 ตันไอน้ำ/ชั่วโมง",
    "cemsInstallationRequiredBy": "ประกาศ อก.",
    "cemsInstallationRequiredOther": null,
    "legalAnnexNo": ["1", "3"],
    "eligibleParameters": ["NOx", "SO2", "PM"],
    "exemptedParameters": [],
    "connectedParameters": [],
    "pendingParameters": ["NOx", "SO2", "PM"],
    "timeSharingParameters": ["NOx", "SO2"],
    "sharedStackCode": "S0002",
    "stackShape": "สี่เหลี่ยม",
    "stackDiameter": null,
    "stackWidth": 1.5,
    "stackLength": 2,
    "stackShapeOther": null,
    "stackHeight": 30,
    "monitoringHeight": 20,
    "averageFlowRate": 1200,
    "minFlowRate": 1000,
    "maxFlowRate": 1500,
    "primaryFuel": "ก๊าซธรรมชาติ",
    "primaryFuelOther": null,
    "primaryFuelPercent": 80,
    "secondaryFuel": "ไม่มี",
    "secondaryFuelOther": null,
    "secondaryFuelPercent": null,
    "combustionControlSystem": "ควบคุมอัตโนมัติ",
    "hasTreatmentSystem": "มี",
    "treatmentSystem": "สครับเบอร์",
    "treatmentSystemOther": null,
    "stackLatitude": 13.7563,
    "stackLongitude": 100.5018,
    "connectionDevice": "POMS Box (กรอ.)",
    "connectionDeviceOther": null
  }
}
```

### WPMS Details

| Label                                       | Field                                                    |
| ------------------------------------------- | -------------------------------------------------------- |
| อัตราการระบายน้ำทิ้งเฉลี่ย (m3/d)           | `measurementPoints[].details.averageWastewaterDischarge` |
| อัตราการระบายน้ำทิ้งต่ำสุด (m3/d)           | `measurementPoints[].details.minWastewaterDischarge`     |
| อัตราการระบายน้ำทิ้งสูงสุด (m3/d)           | `measurementPoints[].details.maxWastewaterDischarge`     |
| ระบบบำบัด                                   | `measurementPoints[].details.hasTreatmentSystem`         |
| ระบุ                                        | `measurementPoints[].details.treatmentSystem`            |
| ปริมาณรองรับน้ำเสียสูงสุดของระบบบำบัด       | `measurementPoints[].details.maxTreatmentCapacity`       |
| พิกัดจุดติดตั้งเครื่องมือตรวจวัด (ละติจูด)  | `measurementPoints[].details.instrumentLatitude`         |
| พิกัดจุดติดตั้งเครื่องมือตรวจวัด (ลองจิจูด) | `measurementPoints[].details.instrumentLongitude`        |
| แหล่งกำเนิดน้ำเสีย                          | `measurementPoints[].details.wastewaterSource`           |
| แหล่งรองรับน้ำทิ้ง                          | `measurementPoints[].details.dischargeReceivingSource`   |
| อุปกรณ์/โปรแกรมที่ใช้เชื่อมต่อ              | `measurementPoints[].details.connectionDevice`           |
| โปรดระบุของอุปกรณ์/โปรแกรมอื่นๆ             | `measurementPoints[].details.connectionDeviceOther`      |

ตัวอย่าง WPMS details:

```json
{
  "pointType": "WASTEWATER",
  "details": {
    "monitoringPointKind": "WPMS",
    "averageWastewaterDischarge": 500,
    "minWastewaterDischarge": 300,
    "maxWastewaterDischarge": 800,
    "hasTreatmentSystem": "มี",
    "treatmentSystem": "ระบบบำบัดชีวภาพ",
    "maxTreatmentCapacity": 1000,
    "instrumentLatitude": 13.7563,
    "instrumentLongitude": 100.5018,
    "wastewaterSource": "กระบวนการผลิต",
    "dischargeReceivingSource": "คลองสาธารณะ",
    "connectionDevice": "POMS Box (กรอ.)",
    "connectionDeviceOther": null
  }
}
```

### Mobile Details

| Label                          | Field                                            |
| ------------------------------ | ------------------------------------------------ |
| หมายเลขเครื่องมือ/อุปกรณ์      | `measurementPoints[].details.instrumentSerialNo` |
| ผู้รับผิดชอบหน่วยตรวจวัด       | `measurementPoints[].details.responsiblePerson`  |
| พารามิเตอร์ที่ตรวจวัด          | derive จาก `measurementPoints[].measurementInstruments.parameters[].parameter` |
| อุปกรณ์/โปรแกรมที่ใช้เชื่อมต่อ | `measurementPoints[].details.connectionDevice`   |

ตัวอย่าง Mobile:

```json
{
  "pointName": "หน่วยตรวจวัดเคลื่อนที่ 1",
  "pointType": "OTHER",
  "details": {
    "monitoringPointKind": "Mobile",
    "instrumentSerialNo": "MB-2026-001",
    "responsiblePerson": "สมชาย ใจดี",
    "connectionDevice": "POMS Client (ใหม่)"
  }
}
```

### Station Details

| Label                          | Field                                          |
| ------------------------------ | ---------------------------------------------- |
| ประเภทสถานี                    | `measurementPoints[].details.stationType`      |
| พื้นที่ติดตั้งสถานี            | `measurementPoints[].details.installationArea` |
| พิกัดสถานี (ละติจูด)           | `measurementPoints[].details.stationLatitude`  |
| พิกัดสถานี (ลองจิจูด)          | `measurementPoints[].details.stationLongitude` |
| พารามิเตอร์ที่ตรวจวัด          | derive จาก `measurementPoints[].measurementInstruments.parameters[].parameter` |
| อุปกรณ์/โปรแกรมที่ใช้เชื่อมต่อ | `measurementPoints[].details.connectionDevice` |

ตัวอย่าง Station:

```json
{
  "pointName": "สถานีตรวจวัด A",
  "pointType": "OTHER",
  "details": {
    "monitoringPointKind": "Station",
    "stationType": "สถานีถาวร",
    "installationArea": "หน้าโรงงาน",
    "stationLatitude": 13.7563,
    "stationLongitude": 100.5018,
    "connectionDevice": "POMS Client (ใหม่)"
  }
}
```

### Documents And Images

ใช้สำหรับทั้ง CEMS และ WPMS. คำขอเพิ่มจุด CEMS ต้องมีเอกสารจริงอย่างน้อย 1 รายการ ส่วน WPMS ต้องส่งรายการที่ผู้ใช้แนบไว้เพื่อไม่ให้ metadata ที่อัปโหลดแล้วสูญหาย

ไฟล์จริงให้อัปโหลดผ่าน `POST /api/v1/cems-wpms-requests/document-images` ก่อน แล้วนำ `data` ที่ได้ไปใส่ใน `measurementPoints[].documentsAndImages[]` ตอน submit form หลัก

Backend เริ่มด้วย local disk storage (`UPLOAD_DIR`, `UPLOAD_PUBLIC_PATH`, `PUBLIC_BASE_URL`) แต่ response contract ตั้งใจให้ย้ายไป object storage ภายหลังได้โดยไม่ต้องเปลี่ยน payload ของ form หลัก

ใช้ field เดียวกันทุกหัวข้อ:

| Label             | Field                                                  |
| ----------------- | ------------------------------------------------------ |
| ชื่อเอกสาร/รูปภาพ | `measurementPoints[].documentsAndImages[].title`       |
| คำอธิบาย          | `measurementPoints[].documentsAndImages[].description` |
| Link              | `measurementPoints[].documentsAndImages[].link`        |
| ชื่อไฟล์          | `measurementPoints[].documentsAndImages[].fileName`    |
| URL ไฟล์          | `measurementPoints[].documentsAndImages[].fileUrl`     |
| MIME type         | `measurementPoints[].documentsAndImages[].fileType`    |
| ขนาดไฟล์ byte     | `measurementPoints[].documentsAndImages[].fileSize`    |

หัวข้อเอกสาร/รูปภาพจาก frontend:

```json
[
  {
    "title": "ข้อมูลรายละเอียดการรายงานค่าที่สภาวะมาตรฐาน",
    "description": "รายละเอียดการคำนวณและการรายงานค่าที่สภาวะมาตรฐาน",
    "link": "https://example.com/standard-report",
    "fileName": "standard-report.pdf",
    "fileUrl": "https://example.com/files/standard-report.pdf",
    "fileType": "application/pdf",
    "fileSize": 204800
  },
  {
    "title": "รายงานผลการทำ RATA หรือ อื่นๆ ที่เทียบเท่า ของระบบ CEMS ครั้งล่าสุด",
    "description": null,
    "link": "https://example.com/rata",
    "fileName": "rata.pdf",
    "fileUrl": "https://example.com/files/rata.pdf",
    "fileType": "application/pdf",
    "fileSize": 204800
  },
  {
    "title": "ภาพถ่ายหน้าโรงงานหรือป้ายโรงงาน",
    "description": null,
    "link": null,
    "fileName": "factory-front.png",
    "fileUrl": "https://example.com/files/factory-front.png",
    "fileType": "image/png",
    "fileSize": 1024
  },
  {
    "title": "สัญลักษณ์ของโรงงานหรือโลโก้บริษัท",
    "description": null,
    "link": null,
    "fileName": "logo.png",
    "fileUrl": "https://example.com/files/logo.png",
    "fileType": "image/png",
    "fileSize": 1024
  },
  {
    "title": "ภาพถ่ายปล่อง",
    "description": null,
    "link": null,
    "fileName": "stack.png",
    "fileUrl": "https://example.com/files/stack.png",
    "fileType": "image/png",
    "fileSize": 1024
  },
  {
    "title": "ภาพถ่ายเครื่องมือตรวจวัดที่ติดตั้ง (CEMS)",
    "description": null,
    "link": null,
    "fileName": "instrument.png",
    "fileUrl": "https://example.com/files/instrument.png",
    "fileType": "image/png",
    "fileSize": 1024
  }
]
```

### Measurement Instruments

| Label                                    | Field                                                                       |
| ---------------------------------------- | --------------------------------------------------------------------------- |
| อุปกรณ์แปลงสัญญาณ (Converter) ยี่ห้อ     | `measurementPoints[].measurementInstruments.converterBrand`                 |
| อุปกรณ์แปลงสัญญาณ (Converter) รุ่น       | `measurementPoints[].measurementInstruments.converterModel`                 |
| พารามิเตอร์ที่ขอเชื่อมต่อ                | `measurementPoints[].measurementInstruments.parameters[].parameter`         |
| เทคนิคการตรวจวัด                         | `measurementPoints[].measurementInstruments.parameters[].technique`         |
| ช่วงการตรวจวัด                           | `measurementPoints[].measurementInstruments.parameters[].range`             |
| ยี่ห้อเครื่องมือ                         | `measurementPoints[].measurementInstruments.parameters[].brand`             |
| ผู้จำหน่ายเครื่องมือ                     | `measurementPoints[].measurementInstruments.parameters[].supplier`          |
| มาตรฐาน EIA                              | `measurementPoints[].measurementInstruments.parameters[].eiaStandard`       |
| สภาวะมาตรฐาน                             | `measurementPoints[].measurementInstruments.parameters[].standardCondition` |
| การรายงานค่า (Dry basis)                 | `measurementPoints[].measurementInstruments.parameters[].dryBasis`          |
| O2 @ 7% or Excess Air 50%                | `measurementPoints[].measurementInstruments.parameters[].oxygenOrExcessAir` |
| พารามิเตอร์ไม่มีค่ามาตรฐาน ตามประกาศ อก. | `measurementPoints[].measurementInstruments.parameters[].standardCriteria`  |
| พารามิเตอร์ไม่มีค่ามาตรฐาน ตาม EIA       | `measurementPoints[].measurementInstruments.parameters[].eiaCriteria`       |

รูปแบบ `standardCriteria` และ `eiaCriteria`:

- ถ้าไม่ได้เลือก checkbox ให้ไม่ส่ง field นี้, ส่ง `null`, หรือส่ง `{ "enabled": false }`
- Checkbox ข้อความ `พารามิเตอร์ไม่มีค่ามาตรฐาน ...` เมื่อถูกเลือก ให้ส่ง
  `{ "enabled": false }`; เมื่อผู้ใช้ระบุค่ามาตรฐานให้ส่ง `enabled: true`
- ถ้า `enabled: true` และ `standardValue` เป็นตัวเลขบวก frontend จะส่ง `rows` หรือไม่ก็ได้;
  backend derive/เขียนทับ `rows` เป็น `normal = 0..80%`, `warning = 80%..100%`,
  `critical = 100%..null`
- Boundary เป็น lower-exclusive/upper-inclusive:
  `0 < normal ≤ 80%`, `80% < warning ≤ 100%`, `100% < critical ≤ ไม่จำกัด`
- ค่า legacy ที่ `standardValue` ไม่ใช่ตัวเลขต้องส่ง `rows` ให้ครบ 3 แถว
- ถ้าส่ง `enabled: false` แต่มี `standardValue` หรือ `rows` ที่มีค่า backend จะเก็บค่า
  เหล่านั้นไว้ เพื่อรองรับฟอร์มที่บันทึกค่าเกณฑ์ไว้แม้ checkbox ไม่ถูกเลือก
- ถ้าส่ง `enabled: true` แต่ `standardValue` ว่าง และค่า `rows[].min`/`rows[].max`
  ว่างทั้งหมด backend จะ normalize เป็น `{ "enabled": false, "standardValue": null, "rows": [] }`
- `rows[].level` ต้องมีครบ `normal`, `warning`, `critical` ห้ามซ้ำ
- `rows[].min` และ `rows[].max` เป็น number หรือ `null` กรณีช่องว่าง/ไม่จำกัด

Mapping ช่อง MIN/MAX ในตารางเกณฑ์:

| UI | Field |
| --- | --- |
| พารามิเตอร์ไม่มีค่ามาตรฐาน ตามประกาศ อก. | `standardCriteria.enabled` |
| ตามประกาศ อก. ค่ามาตรฐาน | `standardCriteria.standardValue` |
| ตามประกาศ อก. ปกติ MIN | `standardCriteria.rows[{ "level": "normal" }].min` |
| ตามประกาศ อก. ปกติ MAX | `standardCriteria.rows[{ "level": "normal" }].max` |
| ตามประกาศ อก. เฝ้าระวัง MIN | `standardCriteria.rows[{ "level": "warning" }].min` |
| ตามประกาศ อก. เฝ้าระวัง MAX | `standardCriteria.rows[{ "level": "warning" }].max` |
| ตามประกาศ อก. แจ้งเตือน MIN | `standardCriteria.rows[{ "level": "critical" }].min` |
| ตามประกาศ อก. แจ้งเตือน MAX | `standardCriteria.rows[{ "level": "critical" }].max` |
| พารามิเตอร์ไม่มีค่ามาตรฐาน ตาม EIA | `eiaCriteria.enabled` |
| ตาม EIA ค่ามาตรฐาน | `eiaCriteria.standardValue` |
| ตาม EIA ปกติ MIN | `eiaCriteria.rows[{ "level": "normal" }].min` |
| ตาม EIA ปกติ MAX | `eiaCriteria.rows[{ "level": "normal" }].max` |
| ตาม EIA เฝ้าระวัง MIN | `eiaCriteria.rows[{ "level": "warning" }].min` |
| ตาม EIA เฝ้าระวัง MAX | `eiaCriteria.rows[{ "level": "warning" }].max` |
| ตาม EIA แจ้งเตือน MIN | `eiaCriteria.rows[{ "level": "critical" }].min` |
| ตาม EIA แจ้งเตือน MAX | `eiaCriteria.rows[{ "level": "critical" }].max` |

ตัวอย่างเครื่องมือตรวจวัดพร้อมเกณฑ์:

```json
{
  "measurementInstruments": {
    "converterBrand": "Converter Brand",
    "converterModel": "CV-100",
    "parameters": [
      {
        "parameter": "NOx",
        "technique": "NDIR",
        "range": "0-200",
        "brand": "Siemens",
        "supplier": "ABC Tech",
        "eiaStandard": "120",
        "standardCondition": true,
        "dryBasis": true,
        "oxygenOrExcessAir": true,
        "standardCriteria": {
          "enabled": true,
          "standardValue": "120",
          "rows": [
            { "level": "normal", "min": 0, "max": 80 },
            { "level": "warning", "min": 80, "max": 100 },
            { "level": "critical", "min": 100, "max": null }
          ]
        },
        "eiaCriteria": {
          "enabled": true,
          "standardValue": "100",
          "rows": [
            { "level": "normal", "min": 0, "max": 70 },
            { "level": "warning", "min": 70, "max": 90 },
            { "level": "critical", "min": 90, "max": null }
          ]
        }
      }
    ]
  }
}
```

## 2.1 แก้ไขฟอร์ม เพิ่มจุดตรวจวัด / เพิ่มพารามิเตอร์

ใช้เมื่อเจ้าหน้าที่เปลี่ยนสถานะเป็น `WAITING_FACTORY_REVISION` แล้วผู้ประกอบการต้องแก้ไขและส่งกลับอีกครั้ง

```bash
curl -X PUT "http://localhost:3000/api/v1/cems-wpms-requests/$REQUEST_ID/form" \
  -H "Authorization: Bearer $OPERATOR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "factoryId": "factory-001",
    "factoryName": "บริษัท ทดสอบ จำกัด",
    "factoryRegistrationNo": "3-106-33/50สบ",
    "industryMainOrder": "106",
    "industrySubOrder": "33",
    "businessActivity": "ผลิตเคมีภัณฑ์",
    "eia": "มี",
    "hasEia": true,
    "projectName": "โครงการทดสอบ CEMS",
    "address": "99 หมู่ 1 ตำบลทดสอบ อำเภอเมือง จังหวัดสระบุรี",
    "latitude": 13.7563,
    "longitude": 100.5018,
    "systemType": "CEMS",
    "contactPersons": [
      {
        "name": "สมชาย ใจดี",
        "phone": "0812345678",
        "email": "ops@example.com",
        "position": "ผู้จัดการสิ่งแวดล้อม"
      },
      {
        "name": "สมหญิง ใจดี",
        "phone": "0899999999",
        "email": "ops2@example.com",
        "position": "วิศวกร"
      }
    ],
    "notificationEmails": ["ops@example.com", "ops2@example.com"],
    "officerNotificationEmails": ["officer@example.com"],
    "measurementPoints": [
      {
        "pointName": "ปล่องระบาย A",
        "pointCode": "S0001",
        "pointType": "STACK",
        "measurementInstruments": {
          "converterBrand": "Converter Brand",
          "converterModel": "CV-100",
          "parameters": [
            {
              "parameter": "CO",
              "technique": "NDIR",
              "range": "0-100",
              "brand": "Siemens",
              "supplier": "ABC Tech",
              "eiaStandard": "50",
              "standardCondition": true,
              "dryBasis": true,
              "oxygenOrExcessAir": true,
              "standardCriteria": {
                "enabled": true,
                "standardValue": "50",
                "rows": [
                  { "level": "normal", "min": 0, "max": 30 },
                  { "level": "warning", "min": 30, "max": 40 },
                  { "level": "critical", "min": 40, "max": null }
                ]
              },
              "eiaCriteria": {
                "enabled": true,
                "standardValue": "45",
                "rows": [
                  { "level": "normal", "min": 0, "max": 25 },
                  { "level": "warning", "min": 25, "max": 35 },
                  { "level": "critical", "min": 35, "max": null }
                ]
              }
            }
          ]
        }
      }
    ],
    "remarks": "แก้ไขตามเจ้าหน้าที่แจ้ง"
  }'
```

หมายเหตุ:

- ถ้าไม่ส่ง `requestType` backend จะใช้ประเภทคำขอเดิม เช่น `ADD_PARAMETER`; ถ้าส่งค่าที่ไม่ตรงกับประเภทเดิม backend จะ reject และไม่อนุญาตให้เปลี่ยนชนิดคำขอผ่าน resubmit
- ถ้าแก้ไขฟอร์มเพิ่มจุดตรวจวัด ต้องส่ง `details`, `measurementInstruments`; CEMS ต้องมี `documentsAndImages` อย่างน้อย 1 รายการ และ WPMS ต้องส่งรายการที่ผู้ใช้แนบไว้ไม่ให้ข้อมูลหล่น
- ถ้าแก้ไขฟอร์มเพิ่มพารามิเตอร์ ต้องส่ง `measurementPoints` 1 รายการ และ `measurementInstruments`

Response:

```json
{
  "success": true,
  "data": {
    "id": 2,
    "requestNo": "CEMS-69-00002",
    "requestType": "ADD_PARAMETER",
    "requestTypeLabel": "เพิ่มพารามิเตอร์",
    "status": "REVISED_PENDING_DESIGN_REVIEW",
    "statusLabel": "แก้ไขแล้ว/รอพิจารณาแบบ"
  }
}
```

## 3. บันทึกฟอร์ม ตั้งค่าอุปกรณ์ config

ใช้หลังคำขออยู่สถานะ `WAITING_CONNECTION` และ `stationId` ต้องตรงกับ `pointCode` หรือ `pointName` ในคำขอนั้น

หมายเหตุ:

- 1 `stationId` มีได้หลาย protocol เช่น `MODBUS_RTU`, `MODBUS_TCP`, `MSSQL`, `MYSQL`
- protocol เดียวกันเพิ่มได้หลายอุปกรณ์เมื่อ `deviceCode` ต่างกัน เช่น `S0001/01` และ `S0001/02` เป็น `MODBUS_RTU` ได้ทั้งคู่
- ห้ามมี config ซ้ำชุด `stationId + protocol + deviceCode` ภายใน payload เดียวกัน
- การบันทึกผ่านคำขอจะเก็บ config เป็น snapshot ของคำขอนั้น (`request_id` ของคำขอ) และบันทึก/แทน active setting แยกอีกชุด (`request_id = null`) เพื่อให้ข้อมูลคำขอเดิมไม่เปลี่ยนตามการแก้ config ภายหลัง
- เมื่อเจ้าหน้าที่ verify จนเป็น `CONNECTED` backend จะ sync ข้อมูลใช้งานจริงไปที่ `cems_wpms_connected_measurement_points` ซึ่งเก็บโรงงาน/ที่อยู่/พิกัด/จุดตรวจวัด/พารามิเตอร์ปัจจุบัน แยกจาก snapshot ในคำขอ
- endpoint นี้รับได้ทั้ง payload เดี่ยวแบบเดิม และ payload หลายอุปกรณ์แบบ `{ "config": { "stationId": "...", "device": [...], "channels": [...], "statusManagement": {...} } }`

```bash
curl -X POST "http://localhost:3000/api/v1/cems-wpms-requests/$REQUEST_ID/device-configs" \
  -H "Authorization: Bearer $OPERATOR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "stationId": "S0001",
    "deviceCode": "S0001/01",
    "protocol": "MODBUS_TCP",
    "settings": {
      "hostIp": "192.168.1.10",
      "slaveId": 1,
      "port": 502
    },
    "channels": [
      {
        "addressId": 40001,
        "dataType": "NOx (ppm)",
        "valueRange": { "min": 0, "max": 200 },
        "valueFormat": "MEASUREMENT_VALUE",
        "offset": 0,
        "encoding": "UNSIGNED16_BIG_ENDIAN",
        "status": "Normal"
      }
    ],
    "statusManagement": {
      "selectedParameters": ["ทั้งหมด"],
      "startAt": null,
      "endAt": null,
      "status": "Normal",
      "schedules": []
    }
  }'
```

Response:

```json
{
  "success": true,
  "data": {
    "id": 10,
    "requestId": 1,
    "stationId": "S0001",
    "deviceCode": "S0001/01",
    "protocol": "MODBUS_TCP",
    "settings": {
      "hostIp": "192.168.1.10",
      "slaveId": 1,
      "port": 502
    },
    "channels": [
      {
        "addressId": 40001,
        "dataType": "NOx (ppm)",
        "valueRange": { "min": 0, "max": 200 },
        "valueFormat": "MEASUREMENT_VALUE",
        "offset": 0,
        "encoding": "UNSIGNED16_BIG_ENDIAN",
        "status": "Normal"
      }
    ],
    "statusManagement": {
      "selectedParameters": ["ทั้งหมด"],
      "startAt": null,
      "endAt": null,
      "status": "Normal",
      "schedules": []
    }
  }
}
```

## 4. รายละเอียดฟอร์ม ตั้งค่าอุปกรณ์ config สำหรับดึงข้อมูลลงฟอร์ม

Endpoint นี้อ่าน config snapshot ที่ผูกกับ `requestId` เดิม ใช้สำหรับเปิดดู/พิมพ์/แก้ข้อมูลในบริบทของคำขอ โดยไม่ดึง active setting ล่าสุดมาทับข้อมูลคำขอเดิม

```bash
curl "http://localhost:3000/api/v1/cems-wpms-requests/$REQUEST_ID/device-configs?stationId=S0001" \
  -H "Authorization: Bearer $OPERATOR_TOKEN"
```

Response สำหรับ prefill dialog:

```json
{
  "success": true,
  "data": {
    "requestId": 1,
    "requestNo": "CEMS-69-00001",
    "stationId": "S0001",
    "monitoringPoint": {
      "id": 1,
      "pointName": "ปล่องระบาย A",
      "pointCode": "S0001",
      "pointType": "STACK",
      "parameters": ["NOx", "SO2", "O2"]
    },
    "parameterOptions": ["NOx", "SO2", "O2"],
    "deviceCodeOptions": ["S0001/01"],
    "connectionForms": [
      {
        "id": 10,
        "configId": 10,
        "type": "Modbus TCP",
        "protocol": "MODBUS_TCP",
        "deviceCode": "S0001/01",
        "values": {
          "slaveId": "1",
          "hostIp": "192.168.1.10",
          "port": "502"
        }
      }
    ],
    "statusManagement": {
      "selectedParameters": ["ทั้งหมด"],
      "startAt": null,
      "endAt": null,
      "status": "Normal",
      "schedules": []
    },
    "parameterMappings": [
      {
        "configId": 10,
        "deviceCode": "S0001/01",
        "addressId": "40001",
        "parameter": "NOx (ppm)",
        "min": "0",
        "max": "200",
        "valueFormat": "ค่าข้อมูลตรวจวัด",
        "offset": "0",
        "encodingData": "Unsigned16 - Big Endian",
        "status": "Normal"
      }
    ],
    "testResults": [],
    "rawConfigs": {
      "stationId": "S0001",
      "device": [
        {
          "deviceCode": "S0001/01",
          "protocol": "MODBUS_TCP",
          "settings": {
            "slaveId": 1,
            "hostIp": "192.168.1.10",
            "port": 502
          }
        }
      ],
      "channels": [
        {
          "deviceCode": "S0001/01",
          "addressId": 40001,
          "dataType": "NOx (ppm)",
          "valueRange": { "min": 0, "max": 200 },
          "valueFormat": "MEASUREMENT_VALUE",
          "offset": 0,
          "encoding": "UNSIGNED16_BIG_ENDIAN",
          "status": "Normal"
        }
      ],
      "statusManagement": {
        "selectedParameters": ["ทั้งหมด"],
        "startAt": null,
        "endAt": null,
        "status": "Normal",
        "schedules": []
      }
    }
  }
}
```

## 4.1 รายละเอียดฟอร์ม ตั้งค่าอุปกรณ์ config ราย config

ใช้ตอนเปิดแก้ไขอุปกรณ์เดียว

```bash
curl "http://localhost:3000/api/v1/cems-wpms-requests/$REQUEST_ID/device-configs/$CONFIG_ID" \
  -H "Authorization: Bearer $OPERATOR_TOKEN"
```

Response เป็น shape เดียวกับข้อ 4 แต่ `connectionForms`, `parameterMappings`, `rawConfigs` จะเหลือเฉพาะ config ที่ระบุ

## 5. ตรวจฟอร์ม เปลี่ยนสถานะ

### สรุป Flow สถานะแบบฟอร์ม

| ขั้นตอน | ผู้ดำเนินการ | API | Action/Body | Status ใหม่ | Label |
| --- | --- | --- | --- | --- | --- |
| เพิ่มแบบฟอร์ม เพิ่มจุดตรวจวัด | ผู้ประกอบการ | `POST /api/v1/cems-wpms-requests/measurement-points` | ไม่มี action | `PENDING_DESIGN_REVIEW` | รอพิจารณาแบบ |
| เพิ่มแบบฟอร์ม เพิ่มพารามิเตอร์ | ผู้ประกอบการ | `POST /api/v1/cems-wpms-requests/parameters` | ไม่มี action | `PENDING_DESIGN_REVIEW` | รอพิจารณาแบบ |
| อนุมัติแบบ | เจ้าหน้าที่ | `POST /api/v1/cems-wpms-requests/:id/status` | `{ "action": "APPROVE_FORM" }` | `WAITING_CONNECTION` | รอโรงงานตั้งค่าอุปกรณ์ |
| ส่งกลับแก้ไข | เจ้าหน้าที่ | `POST /api/v1/cems-wpms-requests/:id/status` | `{ "action": "REQUEST_REVISION", "revisionReason": "..." }` | `WAITING_FACTORY_REVISION` | รอโรงงานแก้ไข |
| แก้ไขแล้วส่งใหม่ | ผู้ประกอบการ | `PUT /api/v1/cems-wpms-requests/:id/form` | ไม่มี action | `REVISED_PENDING_DESIGN_REVIEW` | แก้ไขแล้ว/รอพิจารณาแบบ |
| บันทึกข้อมูลการเชื่อมต่อ | ผู้ประกอบการ | `POST /api/v1/cems-wpms-requests/:id/confirm-connection` | `{ "action": "SAVE", "note": "บันทึก config ชั่วคราว" }` | `WAITING_CONNECTION` | รอโรงงานตั้งค่าอุปกรณ์ |
| ยืนยันการเชื่อมต่อ | ผู้ประกอบการ | `POST /api/v1/cems-wpms-requests/:id/confirm-connection` | `{ "action": "CONFIRM", "note": "ตั้งค่าอุปกรณ์และทดสอบแล้ว" }` | `CONNECTION_CONFIRMED` | รอเชื่อมต่อ |
| ส่งกลับแก้ config | เจ้าหน้าที่ | `POST /api/v1/cems-wpms-requests/:id/status` | `{ "action": "RETURN_TO_WAITING_CONNECTION", "revisionReason": "..." }` | `WAITING_CONNECTION` หรือ `CANCELED` ถ้า deadline เดิมหมดแล้ว | รอโรงงานตั้งค่าอุปกรณ์ / ยกเลิก |
| ตรวจสอบแล้วกดยืนยัน | เจ้าหน้าที่ | `POST /api/v1/cems-wpms-requests/:id/verify-connection` | `{ "note": "ตรวจสอบแล้ว" }` | `CONNECTED` | เชื่อมต่อแล้ว |
| ยกเลิกคำขอ | ระบบ/เจ้าหน้าที่ | ระบบภายใน auto-cancel จาก `connectionDueAt`; ยังไม่มี public endpoint เฉพาะในเอกสารนี้ | - | `CANCELED` | ยกเลิก |

บันทึกข้อมูลการเชื่อมต่อ:

```bash
curl -X POST "http://localhost:3000/api/v1/cems-wpms-requests/$REQUEST_ID/confirm-connection" \
  -H "Authorization: Bearer $OPERATOR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "SAVE",
    "note": "บันทึก config ชั่วคราว"
  }'
```

ยืนยันการเชื่อมต่อ:

```bash
curl -X POST "http://localhost:3000/api/v1/cems-wpms-requests/$REQUEST_ID/confirm-connection" \
  -H "Authorization: Bearer $OPERATOR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "CONFIRM",
    "note": "ตั้งค่าอุปกรณ์และทดสอบแล้ว"
  }'
```

อนุมัติแบบ:

```bash
curl -X POST "http://localhost:3000/api/v1/cems-wpms-requests/$REQUEST_ID/status" \
  -H "Authorization: Bearer $OFFICER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "APPROVE_FORM",
    "officerNote": "แบบถูกต้อง"
  }'
```

ขอแก้ไข:

```bash
curl -X POST "http://localhost:3000/api/v1/cems-wpms-requests/$REQUEST_ID/status" \
  -H "Authorization: Bearer $OFFICER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "REQUEST_REVISION",
    "revisionReason": "เพิ่มรายละเอียดพารามิเตอร์",
    "officerNote": "ข้อมูลยังไม่ครบ"
  }'
```

Response:

```json
{
  "success": true,
  "data": {
    "id": 1,
    "requestNo": "CEMS-69-00001",
    "status": "WAITING_CONNECTION",
    "statusLabel": "รอโรงงานตั้งค่าอุปกรณ์",
    "officerNote": "แบบถูกต้อง",
    "measurementPoints": [
      {
        "id": 1,
        "pointName": "ปล่องระบาย A",
        "pointCode": "S0001",
        "pointType": "STACK",
        "parameters": ["NOx", "SO2", "O2"]
      }
    ]
  }
}
```

## 6. รายการคำขอทั้งหมด สำหรับลงตาราง รายการคำขอ เจ้าหน้าที่

```bash
curl "http://localhost:3000/api/v1/cems-wpms-requests/table-rows" \
  -H "Authorization: Bearer $OFFICER_TOKEN"
```

Query ที่ใช้ filter ได้:

```text
status=WAITING_CONNECTION
requestType=ADD_MEASUREMENT_POINT
factoryId=factory-001
provinceName=ระยอง
districtName=เมืองระยอง
industrialEstateName=นิคมอุตสาหกรรมมาบตาพุด
factoryMainTypeCode=08802
```

ตัวอย่าง:

```bash
curl "http://localhost:3000/api/v1/cems-wpms-requests/table-rows?status=WAITING_CONNECTION&requestType=ADD_MEASUREMENT_POINT" \
  -H "Authorization: Bearer $OFFICER_TOKEN"
```

ตัวอย่างค้นหาขั้นสูง:

```bash
curl "http://localhost:3000/api/v1/cems-wpms-requests/table-rows?provinceName=ระยอง&industrialEstateName=นิคมอุตสาหกรรมมาบตาพุด&factoryMainTypeCode=08802" \
  -H "Authorization: Bearer $OFFICER_TOKEN"
```

Response:

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "factoryId": "factory-001",
      "factoryName": "บริษัท ทดสอบ จำกัด",
      "industryType": "ผลิตเคมีภัณฑ์",
      "province": "สระบุรี",
      "type": "CEMS",
      "requestNo": "CEMS-69-00001",
      "submittedAt": "2026-05-30T10:00:00.000Z",
      "submittedDate": "30/05/2569",
      "monitoringPointCode": "S0001",
      "codeIssuedAt": "2026-05-30T10:05:00.000Z",
      "codeIssuedDate": "30/05/2569",
      "connectionDueAt": "2026-06-29T10:05:00.000Z",
      "waitingConnectionDaysRemaining": 18,
      "waitingConnectionText": "รอโรงงานตั้งค่าอุปกรณ์ 18 วัน",
      "form": "เพิ่มจุดตรวจวัด",
      "status": "รอโรงงานตั้งค่าอุปกรณ์",
      "statusCode": "WAITING_CONNECTION",
      "requestType": "ADD_MEASUREMENT_POINT"
    }
  ],
  "meta": {
    "total": 1
  }
}
```

## 7. รายการคำขอเฉพาะโรงงานตัวเอง สำหรับลงตาราง รายการคำขอ ผู้ประกอบการ

ใช้ endpoint เดียวกับข้อ 6 แต่ส่ง token ผู้ประกอบการ ระบบจะจำกัด scope เป็นโรงงานของตัวเอง

```bash
curl "http://localhost:3000/api/v1/cems-wpms-requests/table-rows" \
  -H "Authorization: Bearer $OPERATOR_TOKEN"
```

Response เป็น shape เดียวกับข้อ 6

## 8. รายชื่อโรงงาน สำหรับลงตาราง รายชื่อโรงงาน ผู้ประกอบการ

```bash
curl "http://localhost:3000/api/v1/cems-wpms-requests/operator-factories" \
  -H "Authorization: Bearer $OPERATOR_TOKEN"
```

Response:

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "factoryId": "factory-001",
      "factoryName": "บริษัท ทดสอบ จำกัด",
      "newRegistrationNo": "3-106-33/50สบ",
      "oldRegistrationNo": null,
      "industryType": "ผลิตเคมีภัณฑ์",
      "industryMainOrder": "106",
      "industrySubOrder": "33",
      "businessActivity": "ผลิตเคมีภัณฑ์",
      "eia": "มี",
      "projectName": null,
      "address": "99 หมู่ 1",
      "latitude": "13.7563",
      "longitude": "100.5018",
      "province": "สระบุรี",
      "officerNotificationEmails": ["saraban_saraburi@industry.go.th"],
      "isEligible": true,
      "eligibilityStatus": "เข้าข่าย",
      "monitoringPointCount": 1,
      "requestStatusCode": "CONNECTED",
      "status": "แสดง"
    }
  ],
  "meta": {
    "total": 1
  }
}
```

Endpoint นี้แสดงเฉพาะโรงงานที่เข้าข่ายและมีจุดตรวจวัดที่เชื่อมแล้วอย่างน้อย 1 จุดเท่านั้น โดย join `factories` กับ `eligible_factories` ด้วย `eligible_factories.factory_registration_no_new = factories.code` และต้องเป็น record ที่ยังไม่ถูกลบ (`eligible_factories.deleted_at IS NULL`) เพื่อเติมข้อมูลโรงงานที่คัดจาก DIW source ลงในตารางผู้ประกอบการ เช่น ประเภทโรงงานหลัก/รอง, การประกอบกิจการ, EIA, ที่อยู่ และพิกัดโรงงาน ถ้าโรงงานไม่มี record ใน `eligible_factories` หรือไม่มีจุดตรวจวัดใน `cems_wpms_connected_measurement_points` จะไม่ถูกคืนใน response ของ `operator-factories`

## 9. รายละเอียดคำขอรายคำขอ สำหรับทำ PDF และเรียกข้อมูลเดิมลงฟอร์มเพิ่มพารามิเตอร์

```bash
curl "http://localhost:3000/api/v1/cems-wpms-requests/$REQUEST_ID/detail" \
  -H "Authorization: Bearer $OPERATOR_TOKEN"
```

Response:

```json
{
  "success": true,
  "data": {
    "id": 1,
    "requestNo": "CEMS-69-00001",
    "requestType": "ADD_MEASUREMENT_POINT",
    "requestTypeLabel": "เพิ่มจุดตรวจวัด",
    "factoryId": "factory-001",
    "factoryName": "บริษัท ทดสอบ จำกัด",
    "systemType": "CEMS",
    "status": "WAITING_CONNECTION",
    "statusLabel": "รอโรงงานตั้งค่าอุปกรณ์",
    "factory": {
      "id": 1,
      "factoryId": "factory-001",
      "factoryName": "บริษัท ทดสอบ จำกัด",
      "newRegistrationNo": "3-106-33/50สบ",
      "industryType": "ผลิตเคมีภัณฑ์",
      "province": "สระบุรี"
    },
    "measurementPoints": [
      {
        "id": 1,
        "pointName": "ปล่องระบาย A",
        "pointCode": "S0001",
        "pointType": "STACK",
        "parameters": ["NOx", "SO2", "O2"]
      }
    ],
    "statusHistory": [
      {
        "id": 1,
        "status": "PENDING_DESIGN_REVIEW",
        "statusLabel": "รอพิจารณาแบบ",
        "note": "ผู้ประกอบการส่งฟอร์ม",
        "changedById": 42,
        "changedBy": "นายสมชาย เจ้าหน้าที่",
        "changedAt": "2026-05-30T10:00:00.000Z",
        "endedAt": "2026-05-31T09:00:00.000Z",
        "durationDays": 2,
        "durationText": "2 วัน",
        "isTerminal": false
      }
    ],
    "statusDurationSummary": {
      "startedAt": "2026-05-30T10:00:00.000Z",
      "startDate": "2026-05-30",
      "startStatus": "PENDING_DESIGN_REVIEW",
      "startStatusLabel": "รอพิจารณาแบบ",
      "endedAt": null,
      "endDate": null,
      "endStatus": "WAITING_CONNECTION",
      "endStatusLabel": "รอเชื่อมต่อ",
      "isTerminal": false,
      "terminalStatuses": ["CONNECTED", "CANCELED"],
      "totalDurationDays": null,
      "totalDurationText": null
    },
    "deviceConfigs": [
      {
        "stationId": "S0001",
        "device": [
          {
            "deviceCode": "S0001/01",
            "protocol": "MODBUS_TCP",
            "settings": {
              "hostIp": "192.168.1.10",
              "slaveId": 1,
              "port": 502
            }
          }
        ],
        "channels": [
          {
            "deviceCode": "S0001/01",
            "addressId": 40001,
            "dataType": "NOx (ppm)",
            "valueRange": { "min": 0, "max": 200 },
            "valueFormat": "MEASUREMENT_VALUE",
            "offset": 0,
            "encoding": "UNSIGNED16_BIG_ENDIAN",
            "status": "Normal"
          }
        ],
        "statusManagement": {
          "selectedParameters": ["ทั้งหมด"],
          "startAt": null,
          "endAt": null,
          "status": "Normal",
          "schedules": []
        }
      }
    ]
  }
}
```

## 10. รายละเอียดจุดตรวจวัดที่เชื่อมต่อแล้วจากระบบ POMS ปัจจุบัน

ใช้ endpoint นี้เมื่อต้องการข้อมูล current/live ของระบบ POMS หลังคำขอผ่านการเชื่อมต่อแล้ว ไม่ใช่ config snapshot ของคำขอแรก

หมายเหตุ backward compatibility: `GET /api/v1/cems-wpms-requests/connected-measurement-points` ยังใช้ได้เป็น legacy alias แต่ frontend ใหม่ควรใช้ `/api/v1/connected-measurement-points`

```bash
curl "http://localhost:3000/api/v1/connected-measurement-points" \
  -H "Authorization: Bearer $OFFICER_TOKEN"
```

Filter โรงงานเดียว:

```bash
curl "http://localhost:3000/api/v1/connected-measurement-points?factoryId=factory-001" \
  -H "Authorization: Bearer $OFFICER_TOKEN"
```

Filter จุดตรวจวัดเดียวด้วย `stationId`:

```bash
curl "http://localhost:3000/api/v1/connected-measurement-points?stationId=S0001" \
  -H "Authorization: Bearer $OFFICER_TOKEN"
```

Response:

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "requestId": 1,
      "requestNo": "CEMS-69-00001",
      "factory": {
        "id": 1,
        "factoryId": "factory-001",
        "factoryName": "บริษัท ทดสอบ จำกัด",
        "newRegistrationNo": "3-106-33/50สบ",
        "industryType": "ผลิตเคมีภัณฑ์",
        "province": "สระบุรี"
      },
      "type": "CEMS",
      "status": "เชื่อมต่อแล้ว",
      "statusCode": "CONNECTED",
      "connectedAt": "2026-05-30T10:30:00.000Z",
      "point": {
        "id": 1,
        "pointName": "ปล่องระบาย A",
        "pointCode": "S0001",
        "pointType": "STACK",
        "parameters": ["NOx", "SO2", "O2"]
      },
      "deviceConfigs": [
        {
          "stationId": "S0001",
          "device": [
            {
              "deviceCode": "S0001/01",
              "protocol": "MODBUS_TCP",
              "settings": {
                "hostIp": "192.168.1.10",
                "slaveId": 1,
                "port": 502
              }
            }
          ],
          "channels": [
            {
              "deviceCode": "S0001/01",
              "addressId": 40001,
              "dataType": "NOx (ppm)",
              "valueRange": { "min": 0, "max": 200 },
              "valueFormat": "MEASUREMENT_VALUE",
              "offset": 0,
              "encoding": "UNSIGNED16_BIG_ENDIAN",
              "status": "Normal"
            }
          ],
          "statusManagement": {
            "selectedParameters": ["ทั้งหมด"],
            "startAt": null,
            "endAt": null,
            "status": "Normal",
            "schedules": []
          }
        }
      ]
    }
  ],
  "meta": {
    "total": 1
  }
}
```

## Request Contract And Data Dictionary ทุก API

ส่วนนี้เป็นสรุปสำหรับ frontend/Postman โดยตรง: ทุก API มี URL, headers, request body/query/path, ตัวอย่าง JSON ที่ต้องส่ง และ data dictionary ของฟิลด์ request

### Headers ทุก API

| Header | Required | Value |
| --- | --- | --- |
| `Authorization` | Yes | `Bearer <accessToken>` |
| `Content-Type` | เฉพาะ API ที่มี body | `application/json` |

### API 0: GET ข้อมูลทั่วไปของโรงงาน

| Item | Value |
| --- | --- |
| URL | `GET /api/v1/cems-wpms-requests/factories/:factoryId/general` |
| Header | `Authorization: Bearer <operatorAccessToken>` |
| Body | ไม่มี |

Path params:

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `factoryId` | string | Yes | รหัสโรงงาน หรือเลขทะเบียนโรงงาน ใช้ดึงข้อมูลทั่วไปมาลงฟอร์ม |

ตัวอย่าง request:

```bash
curl "http://localhost:3000/api/v1/cems-wpms-requests/factories/factory-001/general" \
  -H "Authorization: Bearer $OPERATOR_TOKEN"
```

Data dictionary ของ response ที่ใช้ prefill:

| Field | Type | Description |
| --- | --- | --- |
| `data.factoryId` | string | รหัสโรงงาน |
| `data.factoryName` | string | ชื่อโรงงาน |
| `data.newRegistrationNo` | string|null | เลขทะเบียนโรงงาน |
| `data.industryMainOrder` | string|null | ลำดับประเภทโรงงานหลัก |
| `data.industrySubOrder` | string|null | ลำดับประเภทโรงงานรอง |
| `data.businessActivity` | string|null | การประกอบกิจการ |
| `data.eia` | string|null | มี/ไม่มี EIA |
| `data.hasEia` | boolean|null | สถานะ EIA แบบ boolean |
| `data.projectName` | string|null | ชื่อโครงการ |
| `data.address` | string|null | สถานที่ตั้งโรงงาน |
| `data.latitude` | string|number|null | ละติจูดโรงงาน |
| `data.longitude` | string|number|null | ลองจิจูดโรงงาน |
| `data.formDefaults` | object | ค่าเริ่มต้นที่ส่งต่อใน POST form ได้ |

### API 1.1: POST อัปโหลด/บันทึกลิงก์เอกสารและรูปภาพ

ใช้ก่อน submit ฟอร์มหลักเมื่อ CEMS/WPMS มีไฟล์จริง หรือมีลิงก์เอกสารที่ต้องการแปลงเป็น `documentsAndImages[]` metadata

| Item | Value |
| --- | --- |
| URL | `POST /api/v1/cems-wpms-requests/document-images` |
| Header | `Authorization: Bearer <operatorAccessToken>` |
| Content-Type | `multipart/form-data` |
| Permission | `cems_wpms_requests:edit` |

Form fields:

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `file` | file | Conditional | ไฟล์เอกสาร/รูปภาพจริง; รองรับ `image/jpeg`, `image/png`, `application/pdf`, ขนาดไม่เกิน 5 MiB และ signature ต้องตรงกับ MIME/นามสกุล |
| `title` | string | No | ชื่อหัวข้อเอกสาร/รูปภาพ; ถ้าไม่ส่ง backend ใช้ค่า default |
| `description` | string | No | รายละเอียดเพิ่มเติม |
| `link` | URL string | Conditional | URL เอกสารอ้างอิง; ใช้เดี่ยวๆ ได้แม้ไม่มีไฟล์ |

ต้องส่งอย่างน้อย `file` หรือ `link` อย่างใดอย่างหนึ่ง

ตัวอย่าง upload ไฟล์:

```bash
curl -X POST "http://localhost:3000/api/v1/cems-wpms-requests/document-images" \
  -H "Authorization: Bearer $OPERATOR_TOKEN" \
  -F "title=ภาพถ่ายปล่อง" \
  -F "description=ภาพประกอบตำแหน่งติดตั้ง CEMS" \
  -F "link=https://example.com/documents/stack-reference.pdf" \
  -F "file=@./stack.png;type=image/png"
```

ตัวอย่าง response:

```json
{
  "success": true,
  "data": {
    "title": "ภาพถ่ายปล่อง",
    "description": "ภาพประกอบตำแหน่งติดตั้ง CEMS",
    "link": "https://example.com/documents/stack-reference.pdf",
    "fileName": "stack.png",
    "fileUrl": "http://localhost:3000/uploads/cems-wpms/document-images/2026/06/4b775e0f-0f62-4f68-83e0-3352f32f21bb.png",
    "fileType": "image/png",
    "fileSize": 1024
  }
}
```

นำ `data` object ไปใส่ใน `measurementPoints[].documentsAndImages[]` ของ `POST /measurement-points`

### API 1: POST บันทึกฟอร์ม เพิ่มจุดตรวจวัด

| Item | Value |
| --- | --- |
| URL | `POST /api/v1/cems-wpms-requests/measurement-points` |
| Header | `Authorization: Bearer <operatorAccessToken>`, `Content-Type: application/json` |
| Body | `ConnectionRequestFormBody` |

ตัวอย่าง JSON ที่ต้องส่ง:

ตัวอย่าง CEMS:

```json
{
  "factoryId": "factory-001",
  "factoryName": "บริษัท ทดสอบ จำกัด",
  "factoryRegistrationNo": "3-106-33/50สบ",
  "industryMainOrder": "106",
  "industrySubOrder": "33",
  "businessActivity": "ผลิตเคมีภัณฑ์",
  "eia": "มี",
  "hasEia": true,
  "projectName": "โครงการทดสอบ CEMS",
  "address": "99 หมู่ 1 ตำบลทดสอบ อำเภอเมือง จังหวัดสระบุรี",
  "latitude": 13.7563,
  "longitude": 100.5018,
  "systemType": "CEMS",
  "contactPersons": [
    {
      "name": "สมชาย ใจดี",
      "position": "ผู้จัดการสิ่งแวดล้อม",
      "phone": "0812345678",
      "email": "ops@example.com"
    }
  ],
  "notificationEmails": ["ops@example.com"],
  "officerNotificationEmails": ["officer@example.com"],
  "measurementPoints": [
    {
      "pointName": "ปล่องระบาย A",
      "pointType": "STACK",
      "details": {
        "monitoringPointKind": "CEMS",
        "productionUnitType": "หม้อไอน้ำ",
        "productionCapacity": "10 ตันไอน้ำ/ชั่วโมง",
        "cemsInstallationRequiredBy": "ประกาศ อก.",
        "eligibleParameters": ["NOx", "SO2"],
        "exemptedParameters": [],
        "connectedParameters": [],
        "pendingParameters": ["NOx", "SO2"],
        "stackShape": "สี่เหลี่ยม",
        "stackWidth": 1.5,
        "stackLength": 2,
        "hasTreatmentSystem": "มี",
        "treatmentSystem": "สครับเบอร์",
        "connectionDevice": "POMS Box (กรอ.)"
      },
      "documentsAndImages": [
        {
          "title": "ภาพถ่ายปล่อง",
          "description": "ภาพถ่ายตำแหน่งปล่อง",
          "link": "https://example.com/documents/stack-reference.pdf",
          "fileName": "stack.png",
          "fileUrl": "https://example.com/files/stack.png",
          "fileType": "image/png",
          "fileSize": 1024
        }
      ],
      "measurementInstruments": {
        "converterBrand": "Converter Brand",
        "converterModel": "CV-100",
        "parameters": [
          {
            "parameter": "NOx",
            "technique": "NDIR",
            "range": "0-200 ppm",
            "brand": "Siemens",
            "supplier": "ABC Tech",
            "eiaStandard": "120 ppm",
            "standardCondition": true,
            "dryBasis": true,
            "oxygenOrExcessAir": true,
            "standardCriteria": {
              "enabled": true,
              "standardValue": "120 ppm",
              "rows": [
                { "level": "normal", "min": 0, "max": 80 },
                { "level": "warning", "min": 80, "max": 100 },
                { "level": "critical", "min": 100, "max": null }
              ]
            },
            "eiaCriteria": {
              "enabled": false
            }
          }
        ]
      }
    }
  ],
  "remarks": "ขอเพิ่มจุดตรวจวัด"
}
```

ตัวอย่าง WPMS ตามฟอร์มจุดระบายน้ำทิ้ง:

```json
{
  "factoryId": "factory-001",
  "factoryName": "บริษัท ทดสอบ จำกัด",
  "factoryRegistrationNo": "3-106-33/50สบ",
  "industryMainOrder": "106",
  "industrySubOrder": "33",
  "businessActivity": "ผลิตเคมีภัณฑ์",
  "eia": "มี",
  "hasEia": true,
  "projectName": "โครงการทดสอบ WPMS",
  "address": "99 หมู่ 1 ตำบลทดสอบ อำเภอเมือง จังหวัดสระบุรี",
  "latitude": 13.7563,
  "longitude": 100.5018,
  "systemType": "WPMS",
  "contactPersons": [
    {
      "name": "สมชาย ใจดี",
      "position": "ผู้จัดการสิ่งแวดล้อม",
      "phone": "0812345678",
      "email": "ops@example.com"
    }
  ],
  "notificationEmails": ["ops@example.com"],
  "officerNotificationEmails": ["officer@example.com"],
  "measurementPoints": [
    {
      "pointName": "จุดระบายน้ำทิ้ง A",
      "pointType": "WASTEWATER",
      "details": {
        "monitoringPointKind": "WPMS",
        "averageWastewaterDischarge": 500,
        "minWastewaterDischarge": 300,
        "maxWastewaterDischarge": 800,
        "hasTreatmentSystem": "มี",
        "treatmentSystem": "ระบบบำบัดชีวภาพ",
        "maxTreatmentCapacity": 1000,
        "instrumentLatitude": 13.7563,
        "instrumentLongitude": 100.5018,
        "wastewaterSource": "กระบวนการผลิต",
        "dischargeReceivingSource": "คลองสาธารณะ",
        "connectionDevice": "อื่นๆ",
        "connectionDeviceOther": "Gateway เดิมของโรงงาน"
      },
      "measurementInstruments": {
        "converterBrand": "Converter Brand",
        "converterModel": "CV-100",
        "parameters": [
          {
            "parameter": "CO2 (%)",
            "technique": "NDIR",
            "range": "0-200",
            "brand": "Siemens",
            "supplier": "ABC Tech",
            "eiaStandard": "120",
            "standardCondition": true,
            "dryBasis": true,
            "oxygenOrExcessAir": false,
            "standardCriteria": {
              "enabled": true,
              "standardValue": "120",
              "rows": [
                { "level": "normal", "min": 0, "max": 80 },
                { "level": "warning", "min": 80, "max": 100 },
                { "level": "critical", "min": 100, "max": null }
              ]
            },
            "eiaCriteria": {
              "enabled": false
            }
          }
        ]
      }
    }
  ],
  "remarks": "ขอเพิ่มจุดตรวจวัด WPMS"
}
```

Data dictionary:

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `factoryId` | string | Yes | รหัสโรงงาน |
| `factoryName` | string | Yes | ชื่อโรงงาน |
| `factoryRegistrationNo` | string | Yes | เลขทะเบียนโรงงาน |
| `industryMainOrder` | string|null | No | ลำดับประเภทโรงงานหลัก |
| `industrySubOrder` | string|null | No | ลำดับประเภทโรงงานรอง |
| `businessActivity` | string|null | No | การประกอบกิจการ |
| `eia` | string|null | No | categorical snapshot: `มี`, `ไม่มี`, `มี IEE`, `มี EIA`, `มี EHIA`, `อื่นๆ` |
| `eiaOther` | string|null | Conditional | ต้องไม่ว่างเมื่อ `eia = อื่นๆ`; response มี field นี้เสมอและคืน `null` สำหรับประเภทอื่น |
| `hasEia` | boolean|null | No | ค่า EIA แบบ boolean |
| `projectName` | string|null | No | ชื่อโครงการ |
| `address` | string|null | No | สถานที่ตั้งโรงงาน |
| `latitude` | number|string|null | No | ละติจูดของโรงงาน |
| `longitude` | number|string|null | No | ลองจิจูดของโรงงาน |
| `systemType` | string | Yes | `CEMS` หรือ `WPMS` |
| `contactPersons` | array | Yes | รายชื่อผู้ติดต่อประสานงาน เพิ่มได้หลายคน |
| `notificationEmails` | string[] | No | อีเมลแจ้งเตือนโรงงาน เพิ่มได้หลายอัน |
| `officerNotificationEmails` | string[] | No | อีเมลแจ้งเตือนเจ้าหน้าที่ เพิ่มได้หลายอัน |
| `informationProviderName` | string|null | No | ชื่อผู้ให้ข้อมูล/ผู้รับมอบอำนาจที่ลงนามยื่นคำขอ |
| `informationProviderPosition` | string|null | No | ตำแหน่งผู้ให้ข้อมูล/ผู้รับมอบอำนาจที่ลงนามยื่นคำขอ |
| `measurementPoints` | array | Yes | จุดตรวจวัด อย่างน้อย 1 จุด |
| `remarks` | string|null | No | หมายเหตุคำขอ |

### API 2: POST บันทึกฟอร์ม เพิ่มพารามิเตอร์

| Item | Value |
| --- | --- |
| URL | `POST /api/v1/cems-wpms-requests/parameters` |
| Header | `Authorization: Bearer <operatorAccessToken>`, `Content-Type: application/json` |
| Body | `ConnectionRequestFormBody` แต่ `measurementPoints` ต้องมี 1 จุด และต้องมี `pointCode` |

ตัวอย่าง JSON ที่ต้องส่ง:

```json
{
  "factoryId": "factory-001",
  "factoryName": "บริษัท ทดสอบ จำกัด",
  "factoryRegistrationNo": "3-106-33/50สบ",
  "systemType": "CEMS",
  "contactPersons": [
    {
      "name": "สมชาย ใจดี",
      "position": "ผู้จัดการสิ่งแวดล้อม",
      "phone": "0812345678",
      "email": "ops@example.com"
    }
  ],
  "notificationEmails": ["ops@example.com"],
  "measurementPoints": [
    {
      "pointName": "ปล่องระบาย A",
      "pointCode": "S0001",
      "pointType": "STACK",
      "measurementInstruments": {
        "converterBrand": "Converter Brand",
        "converterModel": "CV-100",
        "parameters": [
          {
            "parameter": "CO",
            "technique": "NDIR",
            "range": "0-100 ppm",
            "brand": "Siemens",
            "supplier": "ABC Tech",
            "eiaStandard": "50 ppm",
            "standardCondition": true,
            "dryBasis": true,
            "oxygenOrExcessAir": true,
            "standardCriteria": {
              "enabled": true,
              "standardValue": "50 ppm",
              "rows": [
                { "level": "normal", "min": 0, "max": 30 },
                { "level": "warning", "min": 30, "max": 40 },
                { "level": "critical", "min": 40, "max": null }
              ]
            },
            "eiaCriteria": {
              "enabled": false
            }
          }
        ]
      }
    }
  ],
  "remarks": "ขอเพิ่มพารามิเตอร์"
}
```

Data dictionary เพิ่มเติมจาก API 1:

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `measurementPoints` | array | Yes | ต้องส่ง 1 จุดต่อ 1 คำขอเพิ่มพารามิเตอร์ |
| `measurementPoints[].pointCode` | string | Yes | เลขจุดตรวจวัดเดิมที่ backend ออกแล้ว เช่น `S0001`, `P0001` |
| `measurementPoints[].measurementInstruments` | object | Yes | รายละเอียดเครื่องมือตรวจวัดและพารามิเตอร์ใหม่ |
| `measurementPoints[].details` | object | No | ไม่จำเป็นสำหรับเพิ่มพารามิเตอร์ ถ้าไม่ได้แก้รายละเอียดจุด |
| `measurementPoints[].documentsAndImages` | array | No | ไม่จำเป็นสำหรับเพิ่มพารามิเตอร์ |

### API 2.1: PUT แก้ไขฟอร์ม เพิ่มจุดตรวจวัด / เพิ่มพารามิเตอร์

| Item | Value |
| --- | --- |
| URL | `PUT /api/v1/cems-wpms-requests/:id/form` |
| Header | `Authorization: Bearer <operatorAccessToken>`, `Content-Type: application/json` |
| Body | ใช้ shape เดียวกับ API 1 หรือ API 2 ตามประเภทคำขอเดิม |

Path params:

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | number | Yes | ID คำขอที่อยู่สถานะ `WAITING_FACTORY_REVISION` |

ตัวอย่าง JSON ที่ต้องส่ง:

```json
{
  "factoryId": "factory-001",
  "factoryName": "บริษัท ทดสอบ จำกัด",
  "factoryRegistrationNo": "3-106-33/50สบ",
  "systemType": "CEMS",
  "contactPersons": [
    {
      "name": "สมชาย ใจดี",
      "position": "ผู้จัดการสิ่งแวดล้อม",
      "phone": "0812345678",
      "email": "ops@example.com"
    }
  ],
  "measurementPoints": [
    {
      "pointName": "ปล่องระบาย A",
      "pointCode": "S0001",
      "pointType": "STACK",
      "measurementInstruments": {
        "parameters": [
          {
            "parameter": "CO",
            "technique": "NDIR",
            "range": "0-100 ppm",
            "brand": "Siemens",
            "supplier": "ABC Tech",
            "standardCriteria": {
              "enabled": true,
              "standardValue": "50 ppm",
              "rows": [
                { "level": "normal", "min": 0, "max": 30 },
                { "level": "warning", "min": 30, "max": 40 },
                { "level": "critical", "min": 40, "max": null }
              ]
            },
            "eiaCriteria": {
              "enabled": false
            }
          }
        ]
      }
    }
  ],
  "remarks": "แก้ไขตามเจ้าหน้าที่แจ้ง"
}
```

Data dictionary:

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `requestType` | string | No | ถ้าไม่ส่ง backend ใช้ประเภทคำขอเดิม |
| `measurementPoints[].details` | object | Conditional | ต้องมีเมื่อแก้คำขอเพิ่มจุดตรวจวัด |
| `measurementPoints[].documentsAndImages` | array | Conditional | ต้องมีเมื่อแก้คำขอเพิ่มจุดตรวจวัดแบบ CEMS; WPMS ต้องส่งรายการที่ผู้ใช้แนบไว้ |
| `measurementPoints[].measurementInstruments` | object | Yes | ต้องมีทั้งแก้เพิ่มจุดและแก้เพิ่มพารามิเตอร์ |

### API 3: POST บันทึกฟอร์ม ตั้งค่าอุปกรณ์ config

| Item | Value |
| --- | --- |
| URL | `POST /api/v1/cems-wpms-requests/:id/device-configs` |
| Header | `Authorization: Bearer <operatorAccessToken>`, `Content-Type: application/json` |
| Body | `DeviceConfigBody` หรือ `{ "config": { "stationId": string, "device": DeviceBody[], "channels": ChannelBody[], "statusManagement": object } }` |

Path params:

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | number | Yes | ID คำขอที่อยู่สถานะ `WAITING_CONNECTION` |

หมายเหตุสำหรับ frontend:

- `POST /device-configs` รองรับการส่งหลายอุปกรณ์ในครั้งเดียวด้วย `{ "config": { "stationId": "...", "device": [...], "channels": [...], "statusManagement": {...} } }`
- `config.channels[].deviceCode` ใช้ผูก channel กลับไปหาอุปกรณ์ใน `config.device[]`
- backend อนุญาต `stationId + protocol` ซ้ำได้เมื่อ `deviceCode` ต่างกัน และถ้า `stationId + protocol + deviceCode` เดิมมี active setting อยู่ backend จะ soft delete active setting เก่าแล้ว insert active setting ใหม่ แยกจาก snapshot ของคำขอ
- payload เดี่ยว response `data` เป็น object; structured/batch payload response `data` เป็น array ตามลำดับ `config.device`
- หลังบันทึกหลายอุปกรณ์สำเร็จ ให้เรียก `GET /cems-wpms-requests/:id/device-configs?stationId=...` ซ้ำเพื่อ refresh snapshot ของคำขอ หรือเรียก `GET /device-connections?stationId=...` เมื่อต้องการดู active setting ล่าสุด
- `protocol` สำหรับ Microsoft SQL ต้องส่ง `MSSQL`
- สำหรับ `MSSQL`/`MYSQL` backend รับ metadata ของ channel เช่น `valueRange`, `alertLow`, `alertHigh`, `valueFormat`, และ `encoding` ได้เหมือน payload จากฟอร์ม เพื่อเก็บช่วงค่า/รูปแบบค่าที่ใช้แสดงผลหรือส่งต่อ integration; field เหล่านี้ยังเป็น optional ทั้งหมด

ตัวอย่าง JSON payload เดี่ยวแบบเดิม:

```json
{
  "stationId": "S0001",
  "deviceCode": "S0001/01",
  "protocol": "MODBUS_TCP",
  "settings": {
    "hostIp": "192.168.1.10",
    "slaveId": 1,
    "port": 502
  },
  "channels": [
    {
      "addressId": 40001,
      "dataType": "NOx (ppm)",
      "valueRange": { "min": 0, "max": 200 },
      "alertLow": 50,
      "alertHigh": 180,
      "valueFormat": "MEASUREMENT_VALUE",
      "offset": 0,
      "encoding": "UNSIGNED16_BIG_ENDIAN",
      "status": "Normal"
    }
  ],
  "statusManagement": {
    "selectedParameters": ["ทั้งหมด"],
    "startAt": null,
    "endAt": null,
    "status": "Normal",
    "schedules": []
  }
}
```

ตัวอย่าง JSON ส่งหลายอุปกรณ์ในครั้งเดียว:

```json
{
  "config": {
    "stationId": "S0001",
    "device": [
      {
        "deviceCode": "S0001/01",
        "protocol": "MODBUS_RTU",
        "settings": {
          "comPort": 1,
          "slaveId": 1,
          "baudRate": 9600,
          "parity": "NONE",
          "stopBits": 1,
          "dataBits": 8,
          "quantity": 1,
          "valueRange": { "min": 20, "max": 200 }
        }
      },
      {
        "deviceCode": "S0001/02",
        "protocol": "MODBUS_RTU",
        "settings": {
          "comPort": 1,
          "slaveId": 1,
          "baudRate": 9600,
          "parity": "NONE",
          "stopBits": 1,
          "dataBits": 8,
          "quantity": 1,
          "valueRange": { "min": 0, "max": 180 }
        }
      }
    ],
    "channels": [
      {
        "deviceCode": "S0001/01",
        "addressId": 40001,
        "dataType": "CO2 (%)",
        "valueRange": { "min": 20, "max": 200 },
        "alertLow": 40,
        "alertHigh": 180,
        "valueFormat": "MEASUREMENT_VALUE",
        "offset": 1,
        "encoding": "SIGNED16_BIG_ENDIAN",
        "status": "Start up"
      },
      {
        "deviceCode": "S0001/02",
        "addressId": 40002,
        "dataType": "CO2 (ppm)",
        "valueRange": { "min": 0, "max": 180 },
        "alertLow": null,
        "alertHigh": 160,
        "valueFormat": "MEASUREMENT_VALUE",
        "offset": 1,
        "encoding": "SIGNED16_BIG_ENDIAN",
        "status": "Start up"
      }
    ],
    "statusManagement": {
      "selectedParameters": ["ทั้งหมด"],
      "startAt": null,
      "endAt": null,
      "status": "Normal",
      "schedules": []
    }
  }
}
```

ตัวอย่าง `settings` สำหรับ `MODBUS_RTU`:

```json
{
  "comPort": 1,
  "slaveId": 1,
  "baudRate": 9600,
  "parity": "NONE",
  "stopBits": 1,
  "dataBits": 8,
  "quantity": 1
}
```

Data dictionary:

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `config.stationId` | string | Yes | ต้องตรงกับ `pointCode` หรือ `pointName` ของจุดตรวจวัดในคำขอ |
| `config.device` | array | Yes | รายการอุปกรณ์ที่ต้องสร้าง |
| `config.device[].deviceCode` | string|null | No | รหัสอุปกรณ์ในฟอร์ม เช่น `S0001/01`; ใช้เป็นส่วนหนึ่งของ unique key ร่วมกับ `stationId + protocol` |
| `config.device[].protocol` | string | Yes | `MODBUS_RTU`, `MODBUS_TCP`, `MSSQL`, `MYSQL` |
| `config.device[].settings` | object | Yes | ข้อมูล connection ตาม protocol |
| `config.device[].settings.hostIp` | string | Conditional | IP/host สำหรับ `MODBUS_TCP`, `MSSQL`, `MYSQL` |
| `config.device[].settings.port` | number | Conditional | port สำหรับ TCP/database |
| `config.device[].settings.comPort` | number|string | Conditional | COM port สำหรับ `MODBUS_RTU` |
| `config.device[].settings.slaveId` | number|string | No | Slave ID |
| `config.device[].settings.baudRate` | number|string | No | Baud rate สำหรับ RTU |
| `config.device[].settings.parity` | string | No | Parity สำหรับ RTU |
| `config.device[].settings.stopBits` | number|string | No | Stop bits |
| `config.device[].settings.dataBits` | number|string | No | Data bits |
| `config.device[].settings.valueRange.min` | number|null | No | ช่วงข้อมูลตรวจวัด Min จากการ์ด Connection |
| `config.device[].settings.valueRange.max` | number|null | No | ช่วงข้อมูลตรวจวัด Max จากการ์ด Connection |
| `config.channels` | array | Yes | รายการ mapping ค่าพารามิเตอร์แบบ flat list |
| `config.channels[].deviceCode` | string|null | Yes | ใช้ผูก channel กลับไปหา `config.device[].deviceCode` |
| `config.channels[].addressId` | number|string | Yes | register/address/field id |
| `config.channels[].dataType` | string | Yes | ชื่อพารามิเตอร์เต็มตามที่แสดงในฟอร์ม เช่น `CO2 (%)`, `CO2 (ppm)`, `NOx (ppm)`; backend เก็บตามค่าที่ส่งมา ไม่ตัดหรือประกอบหน่วยเอง |
| `config.channels[].valueRange.min` | number|null | No | ค่าต่ำสุดของช่วงข้อมูล |
| `config.channels[].valueRange.max` | number|null | No | ค่าสูงสุดของช่วงข้อมูล |
| `config.channels[].alertLow` | number|null | No | ค่า Alert(Low) ของพารามิเตอร์; ถ้าไม่กรอกส่ง `null` หรือไม่ส่ง field ได้ |
| `config.channels[].alertHigh` | number|null | No | ค่า Alert(High) ของพารามิเตอร์; ถ้าไม่กรอกส่ง `null` หรือไม่ส่ง field ได้ |
| `config.channels[].valueFormat` | string|null | No | รูปแบบค่า: `MEASUREMENT_VALUE`, `CURRENT`, `VOLTAGE` |
| `config.channels[].offset` | number|null | No | offset |
| `config.channels[].encoding` | string|null | No | รูปแบบ encoding หรือ metadata ของ channel; ใช้ได้กับ `MODBUS_RTU`, `MODBUS_TCP`, `MSSQL`, และ `MYSQL` |
| `config.channels[].status` | string|null | No | สถานะพารามิเตอร์ เช่น `Normal`, `Maintenance`, `Inactive`; ถ้าไม่ส่ง backend ใช้ `Normal` |
| `config.statusManagement` | object|null | No | ข้อมูลจัดการสถานะชั่วคราวของชุด config |

หมายเหตุ: `config.channels[].valueRange` ทั้ง object เป็น optional ได้ ถ้าผู้ใช้ไม่กรอก
Min/Max ในตารางพารามิเตอร์ backend จะเก็บเป็น `null` แทนการ reject payload

### API 4: GET รายละเอียดฟอร์ม ตั้งค่าอุปกรณ์ config สำหรับ prefill

API นี้คืน config snapshot ของคำขอเดิม ไม่ใช่ active setting ล่าสุดหลังเชื่อมต่อ

| Item | Value |
| --- | --- |
| URL | `GET /api/v1/cems-wpms-requests/:id/device-configs?stationId=S0001` |
| Header | `Authorization: Bearer <accessToken>` |
| Body | ไม่มี |

Path/query params:

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | number | Yes | ID คำขอ |
| `stationId` | string | No | pointCode/pointName ที่ต้องการ prefill ถ้าไม่ส่งจะดึง config ทั้งหมดในคำขอ |

ตัวอย่าง request:

```bash
curl "http://localhost:3000/api/v1/cems-wpms-requests/1/device-configs?stationId=S0001" \
  -H "Authorization: Bearer $OPERATOR_TOKEN"
```

Data dictionary response ที่ frontend ใช้:

| Field | Type | Description |
| --- | --- | --- |
| `data.monitoringPoint` | object|null | จุดตรวจวัดที่กำลังตั้งค่า |
| `data.parameterOptions` | string[] | ตัวเลือกพารามิเตอร์ |
| `data.deviceCodeOptions` | string[] | ตัวเลือกรหัสอุปกรณ์ เช่น `S0001/01` |
| `data.connectionForms` | array | ค่า prefill ส่วนอุปกรณ์ connection; แต่ละรายการมี `configId` และ `deviceCode` สำหรับแยกอุปกรณ์เดิมออกจากอุปกรณ์ใหม่ |
| `data.statusManagement` | object | ค่า prefill ส่วนจัดการสถานะ |
| `data.parameterMappings` | array | ค่า prefill ตาราง mapping พารามิเตอร์ |
| `data.testResults` | array | ผลทดสอบ connection |
| `data.rawConfigs` | object | config ต้นฉบับที่จัด shape เหมือน payload: `{ stationId, device, channels, statusManagement }` |

### API 4.1: GET รายละเอียดฟอร์ม ตั้งค่าอุปกรณ์ config ราย config

| Item | Value |
| --- | --- |
| URL | `GET /api/v1/cems-wpms-requests/:id/device-configs/:configId` |
| Header | `Authorization: Bearer <accessToken>` |
| Body | ไม่มี |

Path params:

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | number | Yes | ID คำขอ |
| `configId` | number | Yes | ID config ที่ต้องการเปิดแก้ไข |

ตัวอย่าง request:

```bash
curl "http://localhost:3000/api/v1/cems-wpms-requests/1/device-configs/10" \
  -H "Authorization: Bearer $OPERATOR_TOKEN"
```

Data dictionary response ใช้เหมือน API 4 แต่คืนเฉพาะ config ที่ระบุ

### API 4.2: GET ผลทดสอบการเชื่อมต่อจากตาราง test

ใช้กับปุ่ม `ทดสอบ` ในหน้าตั้งค่าอุปกรณ์ โดย backend จะอ่านค่าล่าสุด 5 แถวจากตาราง external parameter ingestion รูปแบบ `<stationId>_data_test` เช่น `ingest.S0001_data_test` และคืนเฉพาะพารามิเตอร์ที่ผู้ใช้มีสิทธิ์เห็นจาก `cems_wpms_measurement_points.parameters_json`

| Item | Value |
| --- | --- |
| URL | `GET /api/v1/parameter-values/connection-test?stationId=S0001` |
| Header | `Authorization: Bearer <accessToken>` |
| Body | ไม่มี |

Query params:

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `stationId` | string | Yes | pointCode/pointName ของจุดตรวจวัด เช่น `S0001`; backend จะอ่านจากตาราง `S0001_data_test` |

ตัวอย่าง request:

```bash
curl "http://localhost:3000/api/v1/parameter-values/connection-test?stationId=S0001" \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

ตัวอย่าง response:

```json
{
  "success": true,
  "data": [
    {
      "timestamp": "2026-06-07 10:15:00",
      "values": {
        "CO2 (%)": "123.4",
        "CO2 (ppm)": "123.4"
      },
      "statuses": {
        "CO2 (%)": "Normal",
        "CO2 (ppm)": "Normal"
      }
    },
    {
      "timestamp": "2026-06-07 10:14:00",
      "values": {
        "CO2 (%)": "122.4",
        "CO2 (ppm)": "122.4"
      },
      "statuses": {
        "CO2 (%)": "Normal",
        "CO2 (ppm)": "Normal"
      }
    }
  ],
  "meta": {
    "stationId": "S0001",
    "interval": "test",
    "schemaName": "ingest",
    "tableName": "S0001_data_test",
    "count": 2,
    "registeredParameters": ["CO2 (%)", "CO2 (ppm)"]
  }
}
```

### API 5: POST ตรวจฟอร์ม เปลี่ยนสถานะ

| Item | Value |
| --- | --- |
| URL | `POST /api/v1/cems-wpms-requests/:id/status` |
| Header | `Authorization: Bearer <officerAccessToken>`, `Content-Type: application/json` |
| Body | `ChangeStatusBody` |

ตัวอย่าง JSON อนุมัติ:

```json
{
  "action": "APPROVE_FORM",
  "officerNote": "แบบถูกต้อง"
}
```

ตัวอย่าง JSON ขอแก้ไข:

```json
{
  "action": "REQUEST_REVISION",
  "revisionReason": "เพิ่มรายละเอียดพารามิเตอร์",
  "officerNote": "ข้อมูลยังไม่ครบ"
}
```

ตัวอย่าง JSON ส่งกลับแก้ config หลังผู้ประกอบการยืนยันการเชื่อมต่อแล้ว:

```json
{
  "action": "RETURN_TO_WAITING_CONNECTION",
  "revisionReason": "ตั้งค่าอุปกรณ์ยังไม่ถูกต้อง",
  "officerNote": "แก้ mapping channel แล้วส่งยืนยันอีกครั้ง"
}
```

Data dictionary:

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `action` | string | Yes | `APPROVE_FORM`, `REQUEST_REVISION`, หรือ `RETURN_TO_WAITING_CONNECTION` |
| `officerNote` | string|null | No | หมายเหตุเจ้าหน้าที่ |
| `revisionReason` | string | Conditional | ต้องส่งเมื่อ `action = REQUEST_REVISION` หรือ `RETURN_TO_WAITING_CONNECTION` |

### API 6: GET รายการคำขอทั้งหมด สำหรับตารางเจ้าหน้าที่

| Item | Value |
| --- | --- |
| URL | `GET /api/v1/cems-wpms-requests/table-rows` |
| Header | `Authorization: Bearer <officerAccessToken>` |
| Body | ไม่มี |

Query params:

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `status` | string | No | filter status เช่น `WAITING_CONNECTION` |
| `requestType` | string | No | filter ประเภทคำขอ เช่น `ADD_MEASUREMENT_POINT` |
| `factoryId` | string | No | filter โรงงาน |
| `regionName` | string | No | filter ภาคจาก snapshot ของคำขอ |
| `provinceName` | string | No | filter จังหวัดจาก snapshot ของคำขอ |
| `districtName` | string | No | filter อำเภอ/เขตจาก snapshot ของคำขอ |
| `subdistrictName` | string | No | filter ตำบล/แขวงจาก snapshot ของคำขอ |
| `industrialEstateName` | string | No | filter นิคมอุตสาหกรรมจาก snapshot ของคำขอ |
| `factoryMainTypeCode` | string | No | filter ประเภทโรงงานหลัก เช่น `08802` |

ตัวอย่าง request:

```bash
curl "http://localhost:3000/api/v1/cems-wpms-requests/table-rows?status=WAITING_CONNECTION&requestType=ADD_MEASUREMENT_POINT" \
  -H "Authorization: Bearer $OFFICER_TOKEN"
```

Data dictionary response row:

| Field | Type | Description |
| --- | --- | --- |
| `id` | number | ID คำขอ |
| `factoryId` | string | รหัสโรงงาน |
| `factoryName` | string | ชื่อโรงงาน |
| `type` | string | `CEMS` หรือ `WPMS` |
| `requestNo` | string | เลขคำขอ |
| `monitoringPointCode` | string|null | pointCode หลังอนุมัติ |
| `connectionDueAt` | string|null | deadline การเชื่อมต่อ เฉพาะรายการที่ยังอยู่ `WAITING_CONNECTION`; status อื่นคืน `null` |
| `waitingConnectionDaysRemaining` | number|null | จำนวนวันคงเหลือก่อนครบกำหนดเชื่อมต่อ เฉพาะ `WAITING_CONNECTION`; status อื่นคืน `null` |
| `waitingConnectionText` | string|null | ข้อความพร้อมแสดงผล เช่น `รอโรงงานตั้งค่าอุปกรณ์ 18 วัน`; status อื่นคืน `null` |
| `form` | string | ชื่อฟอร์ม |
| `status` | string | label สถานะ |
| `statusCode` | string | code สถานะ |
| `requestType` | string | ประเภทคำขอ |

### API 7: GET รายการคำขอเฉพาะโรงงานตัวเอง สำหรับตารางผู้ประกอบการ

| Item | Value |
| --- | --- |
| URL | `GET /api/v1/cems-wpms-requests/table-rows` |
| Header | `Authorization: Bearer <operatorAccessToken>` |
| Body | ไม่มี |

Query params ใช้เหมือน API 6 แต่ backend จะจำกัดข้อมูลตามโรงงานของ operator จาก token

ตัวอย่าง request:

```bash
curl "http://localhost:3000/api/v1/cems-wpms-requests/table-rows" \
  -H "Authorization: Bearer $OPERATOR_TOKEN"
```

Data dictionary response row ใช้เหมือน API 6

### API 8: GET รายชื่อโรงงาน สำหรับตารางผู้ประกอบการ

| Item | Value |
| --- | --- |
| URL | `GET /api/v1/cems-wpms-requests/operator-factories` |
| Header | `Authorization: Bearer <operatorAccessToken>` |
| Body | ไม่มี |

Query params:

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `systemType` | `CEMS`\|`WPMS` | No | กรองโรงงานที่มีจุดตรวจวัดระบบนั้น ถ้ามีข้อมูลจุดเชื่อมแล้ว |
| `favoriteOnly` | boolean | No | `true` เพื่อแสดงเฉพาะโรงงานที่ user ปัจจุบันติดดาว |

Endpoint นี้ใช้สำหรับหน้าขอเชื่อมต่อ/เพิ่มจุดตรวจวัด คืนเฉพาะโรงงานที่อยู่ใน `eligible_factories` และมี `status = "แสดง"` แต่ไม่บังคับว่าต้องมีจุดตรวจวัดที่เชื่อมแล้ว

ตัวอย่าง request:

```bash
curl "http://localhost:3000/api/v1/cems-wpms-requests/operator-factories" \
  -H "Authorization: Bearer $OPERATOR_TOKEN"
```

สำหรับหน้า dashboard/แผนที่ที่ต้องแสดงเฉพาะโรงงานที่มีจุดตรวจวัดเชื่อมแล้ว ให้ใช้ endpoint แยก:

```bash
curl "http://localhost:3000/api/v1/operator-factory-dashboard?systemType=CEMS" \
  -H "Authorization: Bearer $OPERATOR_TOKEN"
```

สำหรับหน้า public map ก่อน login ให้ใช้ endpoint แยกที่ไม่ต้องส่ง `Authorization`:

```bash
curl "http://localhost:3000/api/v1/public/factory-map-points?systemType=CEMS"
```

ตัวอย่าง response:

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "factoryId": "factory-001",
      "factoryName": "บริษัท ทดสอบ จำกัด",
      "newRegistrationNo": "3-106-33/50สบ",
      "oldRegistrationNo": "3-106-33/50สบ",
      "factoryLogoUrl": "https://example.com/files/logo.png",
      "industryType": "ผลิตเคมีภัณฑ์",
      "industryMainOrder": "106",
      "industrySubOrder": "33",
      "businessActivity": "ผลิตเคมีภัณฑ์",
      "eia": "มี",
      "projectName": null,
      "address": "99 หมู่ 1",
      "latitude": "13.7563",
      "longitude": "100.5018",
      "province": "สระบุรี",
      "isEligible": true,
      "eligibilityStatus": "เข้าข่าย",
      "monitoringPointCount": 1,
      "requestStatusCode": "CONNECTED",
      "status": "แสดง"
    }
  ],
  "meta": {
    "total": 1
  }
}
```

Data dictionary response row:

| Field | Type | Description |
| --- | --- | --- |
| `id` | number|null | primary key จาก `factories.id` สำหรับใช้เป็น row id ในตาราง |
| `factoryId` | string | รหัสโรงงาน |
| `factoryName` | string | ชื่อโรงงาน |
| `newRegistrationNo` | string|null | เลขทะเบียนใหม่ |
| `oldRegistrationNo` | string|null | เลขทะเบียนเก่า |
| `factoryLogoUrl` | string|null | URL รูปโลโก้จากเอกสารแนบ CEMS title `สัญลักษณ์ของโรงงานหรือโลโก้บริษัท`; ถ้าไม่มีคืน `null` |
| `industryType` | string|null | ประเภทอุตสาหกรรม |
| `industryMainOrder` | string|null | ลำดับโรงงานหลัก |
| `industrySubOrder` | string|null | ลำดับโรงงานรอง |
| `businessActivity` | string|null | รายละเอียดการประกอบกิจการ |
| `eia` | string|null | สถานะ EIA |
| `projectName` | string|null | ชื่อโครงการ |
| `address` | string|null | ที่อยู่โรงงาน |
| `latitude` | string|null | พิกัด latitude |
| `longitude` | string|null | พิกัด longitude |
| `province` | string|null | จังหวัด |
| `officerNotificationEmails` | string[] | อีเมลสำหรับแจ้งเตือนเจ้าหน้าที่ ถ้าโรงงานอยู่ในนิคมอุตสาหกรรมจะใช้เมลการนิคม `contact@ieat.mail.go.th`, `investment.1@ieat.mail.go.th`; ถ้านอกนิคมจะใช้เมลสำนักงานอุตสาหกรรมจังหวัดจากตาราง `officer_notification_email_recipients` |
| `isEligible` | boolean | โรงงานอยู่ในรายการเข้าข่าย |
| `eligibilityStatus` | string | `เข้าข่าย` |
| `monitoringPointCount` | number | จำนวนจุดตรวจวัด |
| `requestStatusCode` | string|null | สถานะคำขอล่าสุดแบบ code |
| `status` | string | สถานะการแสดงผลในตาราง |

### API 8.2: GET รายชื่อโรงงานเข้าข่ายทั้งหมดสำหรับหน้าขอเชื่อมต่อเจ้าหน้าที่

| Item | Value |
| --- | --- |
| URL | `GET /api/v1/cems-wpms-requests/eligible-factories` |
| Header | `Authorization: Bearer <officerAccessToken>` |
| Body | ไม่มี |

Query params:

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `systemType` | `CEMS`\|`WPMS` | No | กรองจากจุดตรวจวัดที่ผูกกับแบบคัดเลือกโรงงานเข้าข่ายใน `eligible_factories.measurement_points` |

Endpoint นี้ใช้สำหรับ tab รายชื่อโรงงานบนหน้าขอเชื่อมต่อฝั่งเจ้าหน้าที่ เพื่อดึงโรงงานที่อยู่ใน `eligible_factories` มาเป็นข้อมูลตั้งต้นสำหรับกรอกฟอร์มจากข้อมูลระบบเดิม โดยใช้ pattern response เดียวกับ `/cems-wpms-requests/operator-factories` ให้ frontend นำไปแสดงในตารางเดียวกันได้ แต่ endpoint นี้คืนข้อมูลโรงงานเพื่ออ้างอิงเท่านั้น ไม่อ่านสถานะคำขอเดิมหรือข้อมูล favorite ของผู้ใช้

การมองเห็นข้อมูล:

- ผู้ใช้ที่มี scope `ALL` เห็นโรงงานเข้าข่ายทุกจังหวัด
- scope `IN_REGION` เห็นเฉพาะโรงงานที่ `eligible_factories.province_name` อยู่ในภาคนั้น โดย lookup ภาคจากตาราง `provinces`
- scope `IN_PROVINCE` เห็นเฉพาะโรงงานในจังหวัดนั้น
- ถ้า JWT มี `regionalAccess.regions` จะกรองซ้ำให้เหลือเฉพาะภาคใน claim นั้น

ตัวอย่าง request:

```bash
curl "http://localhost:3000/api/v1/cems-wpms-requests/eligible-factories?systemType=WPMS" \
  -H "Authorization: Bearer $OFFICER_TOKEN"
```

ตัวอย่าง response:

```json
{
  "success": true,
  "data": [
    {
      "id": 7,
      "factoryId": "3-88(2)-5/49อบ",
      "factoryName": "โรงงานเข้าข่ายจากระบบเดิม จำกัด",
      "newRegistrationNo": "3-88(2)-5/49อบ",
      "oldRegistrationNo": null,
      "industryType": "ผลิตพลังงานไฟฟ้า",
      "industryMainOrder": "08802",
      "industrySubOrder": "00001,00002",
      "businessActivity": "ผลิตพลังงานไฟฟ้า",
      "eia": "ไม่มี",
      "projectName": null,
      "address": "88 หมู่ 2",
      "latitude": "13.5001",
      "longitude": "100.7002",
      "province": "ชลบุรี",
      "officerNotificationEmails": ["contact@ieat.mail.go.th"],
      "isEligible": true,
      "eligibilityStatus": "เข้าข่าย",
      "monitoringPointCount": 1,
      "requestStatusCode": null,
      "status": "แสดง"
    }
  ],
  "meta": {
    "total": 1
  }
}
```

หมายเหตุ response:

- `factoryId` และ `newRegistrationNo` ใช้ `eligible_factories.factory_registration_no_new`
- `industryMainOrder` / `industrySubOrder` มาจาก `eligible_factories.factory_type_sequence` ที่ backend แยกเป็นประเภทหลัก/รองแล้ว
- `eia` แปลงจาก `hasEia`: `true` -> `มี`, `false` -> `ไม่มี`, `null` -> `null`
- `requestStatusCode` คืน `null` เสมอ เพราะ endpoint นี้ใช้ข้อมูลโรงงานเป็น reference สำหรับกรอกฟอร์ม ไม่ใช่รายการ workflow คำขอ

Data dictionary response row:

| Field | Type | Description |
| --- | --- | --- |
| `id` | number | primary key จาก `eligible_factories.id` |
| `factoryId` | string | เลขทะเบียนโรงงานใหม่จาก `eligible_factories.factory_registration_no_new` |
| `factoryName` | string | ชื่อโรงงาน |
| `newRegistrationNo` | string | เลขทะเบียนโรงงานใหม่ ใช้ค่าเดียวกับ `factoryId` |
| `oldRegistrationNo` | string|null | เลขทะเบียนเก่า ถ้าค่าเหมือนเลขทะเบียนใหม่จะคืน `null` |
| `industryType` | string|null | ใช้ค่าเดียวกับ `businessActivity` เพื่อให้ตารางเดิมมี field นี้ |
| `industryMainOrder` | string|null | ลำดับโรงงานหลักที่แยกจาก `factory_type_sequence` |
| `industrySubOrder` | string|null | ลำดับโรงงานรองที่แยกจาก `factory_type_sequence` |
| `businessActivity` | string|null | รายละเอียดการประกอบกิจการจากข้อมูลโรงงานเข้าข่าย |
| `eia` | `มี`\|`ไม่มี`\|null | แปลงจาก `has_eia` |
| `projectName` | null | endpoint นี้ยังไม่มีแหล่งข้อมูลชื่อโครงการ |
| `address` | string|null | ที่อยู่โรงงาน |
| `latitude` | string|null | พิกัด latitude แบบ string เพื่อให้ตรงกับตารางผู้ประกอบการเดิม |
| `longitude` | string|null | พิกัด longitude แบบ string เพื่อให้ตรงกับตารางผู้ประกอบการเดิม |
| `province` | string | จังหวัดจาก `eligible_factories.province_name` |
| `officerNotificationEmails` | string[] | อีเมลเจ้าหน้าที่ตามจังหวัดหรือนิคมอุตสาหกรรม |
| `isEligible` | boolean | `true` เสมอสำหรับ endpoint นี้ |
| `eligibilityStatus` | string | `เข้าข่าย` |
| `monitoringPointCount` | number | จำนวนจุดตรวจวัดจากระบบ POMS ปัจจุบันใน `cems_wpms_connected_measurement_points` หลังกรอง `systemType` ถ้ามี |
| `requestStatusCode` | null | คืน `null` เสมอ เพราะ endpoint นี้ไม่อ่านข้อมูลคำขอ |
| `status` | string | `แสดง` |

### API 8-public: GET จุดโรงงานบนแผนที่สำหรับผู้ใช้ที่ยังไม่ login

| Item | Value |
| --- | --- |
| URL | `GET /api/v1/public/factory-map-points` |
| Header | ไม่ต้องส่ง `Authorization` |
| Body | ไม่มี |

Query params:

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `systemType` | `CEMS`\|`WPMS` | No | กรองโรงงานที่มี connected measurement point ของระบบนั้น ถ้าไม่ส่งจะคืนทุกโรงงานที่มี connected measurement point อย่างน้อย 1 จุด |

Endpoint นี้ใช้สำหรับแสดงจุดโรงงานบนหน้า public map ก่อน login โดยคืนเฉพาะโรงงานที่มี connected measurement point อย่างน้อย 1 จุด และคืนเฉพาะข้อมูลที่ใช้แสดง marker/filter เบื้องต้น รวมถึง `factoryLogoUrl` จากเอกสารแนบ CEMS สำหรับแสดง logo บนแผนที่ แต่ไม่คืนข้อมูลเฉพาะผู้ใช้ เช่น favorite หรือ raw measurement data

ตัวอย่าง request:

```bash
curl "http://localhost:3000/api/v1/public/factory-map-points?systemType=CEMS"
```

ตัวอย่าง response:

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "factoryId": "factory-001",
      "factoryName": "บริษัท ทดสอบ จำกัด",
      "newRegistrationNo": "3-106-33/50สบ",
      "oldRegistrationNo": "รง.4-เก่า-001",
      "factoryLogoUrl": "https://example.com/files/logo.png",
      "industryMainOrder": "08802",
      "industryMainOrderLabel": "ประเภทโรงงานลำดับที่ 88(2): การผลิตพลังงานไฟฟ้าจากพลังงานความร้อน",
      "industrySubOrder": null,
      "eia": "ไม่มี",
      "hasEia": false,
      "regionCode": "ภาคตะวันออก",
      "regionName": "ภาคตะวันออก",
      "provinceCode": "24",
      "provinceName": "ฉะเชิงเทรา",
      "province": "ฉะเชิงเทรา",
      "address": "99 หมู่ 1",
      "latitude": "13.7563",
      "longitude": "100.5018",
      "districtCode": null,
      "districtName": null,
      "industrialAreaType": "INDUSTRIAL_ESTATE",
      "industrialAreaTypeLabel": "ในนิคมอุตสาหกรรม",
      "industrialEstateCode": "MTP",
      "industrialEstateName": "นิคมอุตสาหกรรมมาบตาพุด",
      "monitoringPointCountBySystem": [
        { "systemType": "CEMS", "count": 1 },
        { "systemType": "WPMS", "count": 0 }
      ],
      "status": "แสดง",
      "measurementPoints": [
        {
          "stationId": "S0001",
          "pointName": "ปล่องระบาย A",
          "pointCode": "S0001",
          "systemType": "CEMS",
          "parameters": ["CO (ppm)"]
        }
      ]
    }
  ],
  "meta": {
    "total": 1
  }
}
```

Data dictionary response row:

| Field | Type | Description |
| --- | --- | --- |
| `id` | number|null | primary key จาก `factories.id` สำหรับใช้เป็น row id |
| `factoryId` | string | รหัสโรงงาน/รหัสอ้างอิงโรงงาน |
| `factoryName` | string | ชื่อโรงงาน |
| `newRegistrationNo` | string|null | เลขทะเบียนใหม่ |
| `oldRegistrationNo` | string|null | เลขทะเบียนเก่า |
| `factoryLogoUrl` | string|null | URL รูปโลโก้จากเอกสารแนบ CEMS title `สัญลักษณ์ของโรงงานหรือโลโก้บริษัท`; ถ้าไม่มีคืน `null` |
| `industryMainOrder` | string|null | ลำดับโรงงานหลัก |
| `industryMainOrderLabel` | string|null | ชื่อลำดับโรงงานหลักพร้อมคำอธิบายจาก DIW source เมื่อ lookup ได้ |
| `industrySubOrder` | string|null | ลำดับโรงงานรอง |
| `eia`, `hasEia` | string|null / boolean|null | สถานะ EIA แบบ label และ boolean |
| `regionCode`, `regionName` | string|null | ภูมิภาคจาก master จังหวัด ปัจจุบันใช้ source เดียวกัน |
| `provinceCode`, `provinceName`, `province` | string|null | จังหวัดของโรงงาน |
| `address` | string|null | ที่อยู่โรงงาน |
| `latitude`, `longitude` | string|null | พิกัดโรงงานสำหรับวาง marker |
| `districtCode`, `districtName` | string|null | อำเภอ/เขต ถ้ามี source |
| `industrialAreaType`, `industrialAreaTypeLabel` | string | ใน/นอกนิคมอุตสาหกรรม |
| `industrialEstateCode`, `industrialEstateName` | string|null | รหัส/ชื่อนิคมอุตสาหกรรม |
| `monitoringPointCountBySystem` | array | จำนวนจุดตรวจวัดแยกตาม `CEMS` / `WPMS` |
| `status` | string | สถานะแสดงผลของ public map row |
| `measurementPoints[]` | array | จุดตรวจวัดที่เชื่อมแล้ว เฉพาะ metadata สำหรับแผนที่ |

Public endpoint นี้ตั้งใจไม่คืน field ต่อไปนี้:

- `isFavorite`
- `hasLatestHourlyMeasurement`
- `measurementPoints[].data`

### API 8.1: PUT ติดดาว/ยกเลิกติดดาวโรงงาน

| Item | Value |
| --- | --- |
| URL | `PUT /api/v1/operator-factories/:factoryId/favorite` |
| Header | `Authorization: Bearer <accessToken>` |
| Body | `{ "isFavorite": true }` หรือ `{ "isFavorite": false }` |

Path params:

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `factoryId` | string | Yes | ใช้ได้ทั้ง `factoryId`/`fid` หรือเลขทะเบียนที่ `GET /operator-factories` คืนมา แต่ backend จะ normalize เป็น `factoryId` จริงก่อนบันทึก |

ตัวอย่าง request:

```bash
curl -X PUT "http://localhost:3000/api/v1/operator-factories/factory-001/favorite" \
  -H "Authorization: Bearer $OPERATOR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{ "isFavorite": true }'
```

ตัวอย่าง response:

```json
{
  "success": true,
  "data": {
    "factoryId": "factory-001",
    "isFavorite": true
  }
}
```

### API 9: GET รายละเอียดคำขอรายคำขอ

| Item | Value |
| --- | --- |
| URL | `GET /api/v1/cems-wpms-requests/:id/detail` |
| Header | `Authorization: Bearer <accessToken>` |
| Body | ไม่มี |

Path params:

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | number | Yes | ID คำขอ |

ตัวอย่าง request:

```bash
curl "http://localhost:3000/api/v1/cems-wpms-requests/1/detail" \
  -H "Authorization: Bearer $OPERATOR_TOKEN"
```

Data dictionary response:

| Field | Type | Description |
| --- | --- | --- |
| `data.id` | number | ID คำขอ |
| `data.requestNo` | string | เลขคำขอ |
| `data.requestType` | string | ประเภทคำขอ |
| `data.factory` | object | ข้อมูลโรงงาน snapshot/detail |
| `data.measurementPoints` | array | รายจุดตรวจวัด ใช้ทำ PDF และเติมฟอร์มเพิ่มพารามิเตอร์ |
| `data.statusHistory` | array | ประวัติสถานะ พร้อมชื่อผู้เปลี่ยนสถานะและจำนวนวันของแต่ละช่วง |
| `data.statusHistory[].changedById` | number | user id เดิมจาก `cems_wpms_request_status_history.changed_by` |
| `data.statusHistory[].changedBy` | string | ชื่อผู้เปลี่ยนสถานะจากตาราง `users`; fallback เป็น `username` หรือ `User #<id>` |
| `data.statusHistory[].endedAt` | string/null | เวลาเริ่ม status ถัดไป หรือเวลา status เดิมถ้าเป็น terminal status |
| `data.statusHistory[].durationDays` | number/null | จำนวนวันแบบนับรวมวันเริ่มและวันจบ เช่น `2026-06-26` ถึง `2026-06-27` = `2` |
| `data.statusHistory[].isTerminal` | boolean | `true` เมื่อ status เป็น `CONNECTED` หรือ `CANCELED` |
| `data.statusDurationSummary` | object | สรุประยะเวลาจาก status แรกถึง status สุดท้าย เฉพาะเมื่อ status สุดท้ายเป็น terminal |
| `data.deviceConfigs` | array | config snapshot ของคำขอ โดยแต่ละ item จัด shape เหมือน payload: `{ stationId, device, channels, statusManagement }` |

### API 10: GET รายละเอียดจุดตรวจวัดที่เชื่อมต่อแล้วจากระบบ POMS ปัจจุบัน

| Item | Value |
| --- | --- |
| URL | `GET /api/v1/connected-measurement-points` |
| Legacy alias | `GET /api/v1/cems-wpms-requests/connected-measurement-points` |
| Header | `Authorization: Bearer <accessToken>` |
| Body | ไม่มี |

API นี้คืนค่า current/live ของระบบ POMS โดย `deviceConfigs` เป็น active setting ล่าสุด ไม่ใช่ config snapshot ของคำขอ ถ้าต้องการ snapshot ของคำขอให้ใช้ `GET /api/v1/cems-wpms-requests/:id/device-configs`

Query params:

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `factoryId` | string | No | filter เฉพาะโรงงาน |
| `stationId` | string | No | filter รายจุดตรวจวัดเดียว ใช้ค่าเดียวกับ `point.pointCode` เช่น `S0001`; ไม่รับชื่อ query `pointCode` เพื่อให้ contract ใช้คำว่า `stationId` เหมือน endpoint อื่น |

ตัวอย่าง request:

```bash
curl "http://localhost:3000/api/v1/connected-measurement-points?factoryId=factory-001" \
  -H "Authorization: Bearer $OFFICER_TOKEN"
```

ตัวอย่าง request จุดเดียว:

```bash
curl "http://localhost:3000/api/v1/connected-measurement-points?stationId=S0001" \
  -H "Authorization: Bearer $OFFICER_TOKEN"
```

Data dictionary response row:

| Field | Type | Description |
| --- | --- | --- |
| `id` | number | ID จุดตรวจวัด |
| `requestId` | number | ID คำขอ |
| `requestNo` | string | เลขคำขอ |
| `factory` | object | ข้อมูลโรงงาน |
| `type` | string | `CEMS` หรือ `WPMS` |
| `status` | string | label สถานะ |
| `statusCode` | string | ต้องเป็น `CONNECTED` |
| `connectedAt` | string|null | วันเวลาที่เชื่อมต่อแล้ว |
| `point` | object | ข้อมูลจุดตรวจวัด |
| `deviceConfigs` | array | active setting ล่าสุดของจุดตรวจวัด โดยแต่ละ item จัด shape เหมือน payload: `{ stationId, device, channels, statusManagement }`; ไม่ใช่ snapshot ของคำขอแรก |

### Common JSON Data Dictionary

#### `measurementPoints[]`

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `pointName` | string | Yes | ชื่อจุดตรวจวัด |
| `pointCode` | string|null | Conditional | เพิ่มจุดใหม่ไม่ต้องส่ง; เพิ่มพารามิเตอร์ต้องส่งเลขเดิม |
| `pointType` | string | Yes | `STACK`, `WASTEWATER`, `OTHER` |
| `details` | object | Conditional | รายละเอียดจุดตรวจวัด ใช้ในฟอร์มเพิ่มจุดตรวจวัด |
| `documentsAndImages` | array | Conditional | เอกสารและรูปภาพของ CEMS/WPMS; CEMS เพิ่มจุดตรวจวัดต้องมีอย่างน้อย 1 รายการ ส่วน WPMS ส่งเมื่อผู้ใช้แนบไฟล์ |
| `measurementInstruments` | object | Yes | รายละเอียดเครื่องมือตรวจวัด |

#### `measurementPoints[].details`

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `monitoringPointKind` | string|null | No | `CEMS`, `WPMS`, `Mobile`, `Station` |
| `averageWastewaterDischarge` | number|null | WPMS | อัตราการระบายน้ำทิ้งเฉลี่ย (m3/d) |
| `minWastewaterDischarge` | number|null | WPMS | อัตราการระบายน้ำทิ้งต่ำสุด (m3/d) |
| `maxWastewaterDischarge` | number|null | WPMS | อัตราการระบายน้ำทิ้งสูงสุด (m3/d) |
| `instrumentLatitude` | number|string|null | WPMS | พิกัดจุดติดตั้งเครื่องมือตรวจวัด ละติจูด |
| `instrumentLongitude` | number|string|null | WPMS | พิกัดจุดติดตั้งเครื่องมือตรวจวัด ลองจิจูด |
| `wastewaterSource` | string|null | WPMS | แหล่งกำเนิดน้ำเสีย |
| `dischargeReceivingSource` | string|null | WPMS | แหล่งรองรับน้ำทิ้ง |
| `maxTreatmentCapacity` | number|null | Conditional | ปริมาณรองรับน้ำเสียสูงสุดของระบบบำบัด ต้องส่งเมื่อ WPMS และ `hasTreatmentSystem = มี` |
| `productionUnitType` | string|null | No | ประเภทหน่วยการผลิต |
| `productionCapacity` | string|null | No | กำลังการผลิต |
| `productionCapacityUnit` | string|null | CEMS | หน่วยกำลังการผลิต แยกจาก `productionCapacity` |
| `cemsInstallationRequiredBy` | string|null | No | เข้าข่ายต้องติดตั้ง CEMS ตามกฎหมาย |
| `legalAnnexNo` | string[] | CEMS | เข้าข่ายตามบัญชีแนบท้ายลำดับที่ เลือกได้หลายลำดับ โดยรับเฉพาะ `"1"` ถึง `"13"` |
| `exemptedParameterRegulationClauses` | string[] | CEMS | พารามิเตอร์ที่ได้รับการยกเว้นตามประกาศฯ ข้อ; แต่ละรายการต้องเป็นข้อความไม่ว่าง |
| `eligibleParameters` | string[] | No | พารามิเตอร์ที่เข้าข่าย เพิ่มได้หลายตัว |
| `exemptedParameters` | string[] | No | พารามิเตอร์ที่ยกเว้น เพิ่มได้หลายตัว |
| `connectedParameters` | string[] | No | พารามิเตอร์ที่เชื่อมต่อแล้ว เพิ่มได้หลายตัว |
| `pendingParameters` | string[] | No | พารามิเตอร์ที่ยังไม่เชื่อมต่อ เพิ่มได้หลายตัว |
| `requestedParameters` | string[] | No | พารามิเตอร์ที่ขอเชื่อมต่อในคำขอนี้ ต้องเป็น subset ของ `pendingParameters` |
| `timeSharingParameters` | string[] | CEMS | พารามิเตอร์ที่ติดตั้งแบบ Time sharing เลือกได้หลายตัว |
| `sharedStackCode` | string|null | CEMS | รหัสจุดตรวจวัดของปล่องที่ใช้ร่วมกัน |
| `stackShape` | string|null | Conditional | ลักษณะปล่อง เช่น `วงกลม`, `สี่เหลี่ยม`, `อื่นๆ` |
| `stackDiameter` | number|null | Conditional | ต้องส่งเมื่อ `stackShape = วงกลม` |
| `stackWidth` | number|null | Conditional | ต้องส่งเมื่อ `stackShape = สี่เหลี่ยม` |
| `stackLength` | number|null | Conditional | ต้องส่งเมื่อ `stackShape = สี่เหลี่ยม` |
| `stackShapeOther` | string|null | Conditional | ต้องส่งเมื่อ `stackShape = อื่นๆ` |
| `hasTreatmentSystem` | string|null | No | ถ้าส่งต้องเป็น `มี` หรือ `ไม่มี` |
| `treatmentSystem` | string[]\|string\|null | Conditional | ระบบบำบัด ส่งแบบ `string[]` สำหรับ Multiselect; backend ยังรับ string เดิมเพื่ออ่าน/ส่งคำขอเก่าได้ |
| `treatmentSystemOther` | string|null | Conditional | ต้องระบุเมื่อ `treatmentSystem` มี `อื่นๆ` ทั้ง CEMS และ WPMS |
| `connectionDevice` | string|null | No | อุปกรณ์/โปรแกรมที่ใช้เชื่อมต่อ |
| `connectionDeviceOther` | string|null | Conditional | โปรดระบุอุปกรณ์/โปรแกรมอื่นๆ |

#### `documentsAndImages[]`

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `title` | string | Yes | ชื่อเอกสาร/รูปภาพ |
| `description` | string|null | No | รายละเอียดเพิ่มเติม |
| `link` | string|null | Conditional | URL เอกสารอ้างอิง; ต้องมีอย่างน้อย `link` หรือ `fileUrl` |
| `fileName` | string|null | No | ชื่อไฟล์ |
| `fileUrl` | string|null | Conditional | URL ไฟล์; ต้องมีอย่างน้อย `link` หรือ `fileUrl` |
| `fileType` | string|null | No | MIME type |
| `fileSize` | number|null | No | ขนาดไฟล์ byte สูงสุด `5 * 1024 * 1024` bytes |

#### `measurementInstruments`

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `converterBrand` | string|null | No | ยี่ห้อ converter |
| `converterModel` | string|null | No | รุ่น converter |
| `parameters` | array | Yes | รายการพารามิเตอร์ที่ขอเชื่อมต่อ/เพิ่ม |

#### `measurementInstruments.parameters[]`

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `parameter` | string | Yes | พารามิเตอร์ที่ขอเชื่อมต่อพร้อมหน่วย เช่น `NOx (ppm)` |
| `technique` | string|null | No | เทคนิคการตรวจวัด |
| `range` | string|null | No | ช่วงการตรวจวัด |
| `brand` | string|null | No | ยี่ห้อเครื่องมือ |
| `supplier` | string|null | No | ผู้จำหน่ายเครื่องมือ |
| `eiaStandard` | string|null | No | มาตรฐาน EIA |
| `standardCondition` | boolean|null | No | สภาวะมาตรฐาน |
| `dryBasis` | boolean|null | No | การรายงานค่า Dry basis |
| `oxygenOrExcessAir` | boolean|null | No | O2 @ 7% หรือ Excess Air 50% |
| `standardCriteria` | object|null | No | ตาราง MIN/MAX ตามประกาศ อก. |
| `eiaCriteria` | object|null | No | ตาราง MIN/MAX ตาม EIA |

#### `standardCriteria` / `eiaCriteria`

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `enabled` | boolean | Yes | `true` ถ้ามีการเลือกใช้เกณฑ์; ถ้าเป็น `false` แต่มีค่ามาตรฐาน/rows backend ยังเก็บค่าไว้ |
| `standardValue` | string\|number\|null | No | ค่า numeric ใหม่ต้องเป็น finite positive number ที่สร้างขอบ 80% ซึ่งต่างจากค่ามาตรฐานได้ |
| `rows` | array | Conditional | Numeric standard ไม่ต้องส่งเพราะ backend derive ให้; ค่า legacy ที่ไม่ใช่ตัวเลขต้องส่งครบ 3 แถว |
| `rows[].level` | string | Yes | `normal`, `warning`, `critical` |
| `rows[].min` | number|null | No | ค่า MIN |
| `rows[].max` | number|null | No | ค่า MAX |

## Value Reference

### requestType

```text
NEW_CONNECTION
ADD_MEASUREMENT_POINT
ADD_PARAMETER
```

### systemType

```text
CEMS
WPMS
```

### pointType

```text
STACK
WASTEWATER
OTHER
```

### protocol

```text
MODBUS_RTU
MODBUS_TCP
MSSQL
MYSQL
```

### status/action สำหรับตรวจฟอร์ม

```text
APPROVE_FORM
REQUEST_REVISION
RETURN_TO_WAITING_CONNECTION
```

### pointCode

```text
CEMS: S0001, S0002, ...
WPMS: P0001, P0002, ...
```

ออกเลขอัตโนมัติเมื่อเจ้าหน้าที่ `APPROVE_FORM` และคำขอเปลี่ยนเป็น `WAITING_CONNECTION`

### statusCode ที่พบบ่อย

```text
PENDING_DESIGN_REVIEW
WAITING_FACTORY_REVISION
REVISED_PENDING_DESIGN_REVIEW
WAITING_CONNECTION
CONNECTION_CONFIRMED
CONNECTED
CANCELED
```

## Contract update: แบบฟอร์มเพิ่มจุดตรวจวัด CEMS/WPMS (2026-07-13)

ใช้กับ endpoint หลักต่อไปนี้:

- `POST /api/v1/cems-wpms-requests/measurement-points`
- `POST /api/v1/cems-wpms-requests/parameters`
- `POST /api/v1/cems-wpms-requests/document-images`

กติกา payload ที่ frontend ต้องยึด:

1. ค่า `legalAnnexNo` ของ CEMS รับเฉพาะข้อความ `"1"` ถึง `"13"`.
2. พารามิเตอร์ CEMS ใหม่ที่ backend รับและเก็บแบบ label พร้อมหน่วยคือ `CS2 (ppm)`, `CS2 (ppb)` และ `CS2 (mg/m³)`. Backend ไม่แปลง `m3` เป็น `m³` ให้อัตโนมัติ.
3. `requestedParameters` ต้องเป็น `string[]` และทุกค่าต้องอยู่ใน `pendingParameters`; backend ใช้รายการนี้เป็น `measurementPoints[].parameters` เมื่อไม่มี instrument rows ที่ระบุพารามิเตอร์.
4. `ไม่มี` ใช้เป็นตัวเลือกแสดงผลใน `eligibleParameters`, `exemptedParameters`, `connectedParameters`, `pendingParameters` และ `timeSharingParameters` ได้ แต่ต้องเลือกเดี่ยว ห้ามส่งปนกับพารามิเตอร์จริง และ backend จะไม่สร้าง telemetry parameter ชื่อ `ไม่มี`.
5. เมื่อเชื้อเพลิงหลักหรือรองเป็น `ชีวมวล`/`Biomass`/`อื่นๆ` ต้องส่งรายละเอียดที่ `primaryFuelOther` หรือ `secondaryFuelOther` ตามช่องนั้น.
6. Frontend ใหม่ส่ง `combustionControlSystem` เป็น `ระบบปิด` หรือ `ระบบเปิด`; backend รับ legacy `ควบคุมอัตโนมัติ` เพื่อให้คำขอเก่าส่งแก้ไขได้ แต่ reject string อื่น.
7. `treatmentSystem` ควรส่งเป็น array. เมื่อ `hasTreatmentSystem = "มี"` ต้องมีอย่างน้อยหนึ่งระบบจริงและห้ามใช้ `ไม่มี`; ถ้ามี `อื่นๆ` ต้องส่ง `treatmentSystemOther` ทั้ง CEMS และ WPMS.
8. `connectionDevice` รองรับชื่อใหม่ที่มี `D-POMS`; ค่าเดิมที่มี `POMS` ยังรับได้เพื่อ backward compatibility.
9. CEMS และ WPMS ส่งเอกสารที่ `measurementPoints[].documentsAndImages[]`. ส่งหลายรายการที่มี `title` เดียวกันได้ ยกเว้น `สัญลักษณ์ของโรงงานหรือโลโก้บริษัท` ส่งได้ไม่เกินหนึ่งรายการต่อคำขอ แม้มีหลายจุดตรวจวัด.
10. Upload endpoint รับหนึ่ง binary ต่อ request; ถ้ามีหลายไฟล์ให้เรียกซ้ำแล้วรวม metadata ทุก response ไว้ใน `documentsAndImages[]`. ไฟล์แต่ละรายการต้องไม่เกิน 5 MB.
11. `PUT /api/v1/cems-wpms-requests/:id/form` จะใช้ `requestType` เดิมเมื่อ frontend ไม่ส่ง field นี้, reject ค่าที่ไม่ตรงกับประเภทเดิม และตรวจ validation ตามชนิดคำขอเดิมก่อนบันทึก.
12. Root EIA ใช้ `eia`, `eiaOther`, `hasEia`. Backend เก็บ categorical value สำหรับ response แก้ไขย้อนหลัง; คำขอเก่าที่ไม่มีค่าใหม่ fallback จาก `has_eia` เป็น `มี`/`ไม่มี`.
13. Backend กรองเฉพาะ empty document placeholder shape ที่ frontend สร้าง; row ที่เก็บจริงต้องมี `link` หรือ `fileUrl` และ CEMS ที่เหลือเอกสารจริงเป็นศูนย์จะถูก reject.
14. Legacy `POST /api/v1/cems-wpms-requests` ถ้าระบุ `requestType = ADD_MEASUREMENT_POINT` หรือ `ADD_PARAMETER` จะถูกตรวจ form sections ตามชนิดเดียวกับ endpoint เฉพาะ จึงใช้ route เก่าเพื่อข้าม `pointCode`/details/documents/instruments validation ไม่ได้.

Validation error ยังคง `error.details` เดิม และเพิ่ม `error.issues[]` แบบ full path:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": { "measurementPoints": ["Invalid input"] },
    "issues": [
      {
        "code": "custom",
        "path": ["measurementPoints", 0, "details", "requestedParameters"],
        "pathString": "measurementPoints.0.details.requestedParameters",
        "message": "requestedParameters must be selected from pendingParameters"
      }
    ]
  }
}
```

Compatibility: metadata ของคำขอเก่าที่มี `fileSize` มากกว่า 5 MiB จะไม่ผ่าน resubmit contract ใหม่นี้ ต้องลบหรืออัปโหลดไฟล์ใหม่ก่อนส่งแก้ไขซ้ำ.

ตัวอย่างส่วนที่เปลี่ยนของ CEMS:

```json
{
  "systemType": "CEMS",
  "measurementPoints": [
    {
      "pointName": "ปล่องระบาย A",
      "pointType": "STACK",
      "details": {
        "monitoringPointKind": "CEMS",
        "legalAnnexNo": ["1", "13"],
        "eligibleParameters": ["CS2 (ppm)", "CS2 (ppb)", "CS2 (mg/m³)"],
        "exemptedParameters": ["ไม่มี"],
        "connectedParameters": ["ไม่มี"],
        "pendingParameters": ["CS2 (ppm)", "CS2 (ppb)", "CS2 (mg/m³)"],
        "requestedParameters": ["CS2 (ppm)", "CS2 (ppb)"],
        "primaryFuel": "ชีวมวล",
        "primaryFuelOther": "แกลบและเศษไม้",
        "combustionControlSystem": "ระบบปิด",
        "hasTreatmentSystem": "มี",
        "treatmentSystem": ["ระบบถุงกรอง", "อื่นๆ"],
        "treatmentSystemOther": "ระบบเฉพาะของโรงงาน",
        "connectionDevice": "D-POMS Client (ใหม่)"
      }
    }
  ]
}
```

ตัวอย่างส่วนที่เปลี่ยนของ WPMS:

```json
{
  "systemType": "WPMS",
  "measurementPoints": [
    {
      "pointName": "จุดระบายน้ำทิ้ง A",
      "pointType": "WASTEWATER",
      "details": {
        "monitoringPointKind": "WPMS",
        "pendingParameters": ["BOD (mg/l)", "COD (mg/l)"],
        "requestedParameters": ["COD (mg/l)"],
        "hasTreatmentSystem": "มี",
        "treatmentSystem": ["Activated Sludge", "อื่นๆ"],
        "treatmentSystemOther": "ระบบเฉพาะของโรงงาน",
        "maxTreatmentCapacity": 1000,
        "connectionDevice": "D-POMS Client (ใหม่)"
      },
      "documentsAndImages": [
        {
          "title": "ระบบบำบัด",
          "fileName": "treatment-1.pdf",
          "fileUrl": "https://example.com/files/treatment-1.pdf",
          "fileType": "application/pdf",
          "fileSize": 1024
        },
        {
          "title": "ภาพถ่ายเครื่องมือตรวจวัดที่ติดตั้ง (WPMS)",
          "fileName": "instrument.png",
          "fileUrl": "https://example.com/files/instrument.png",
          "fileType": "image/png",
          "fileSize": 2048
        }
      ]
    }
  ]
}
```

รายละเอียด checklist และจุดที่ frontend ยังต้องแก้อยู่ที่ [CEMS_WPMS_REQUEST_FORM_BACKEND_CHECKLIST.md](./CEMS_WPMS_REQUEST_FORM_BACKEND_CHECKLIST.md) และ [CEMS_WPMS_REQUEST_FORM_FRONTEND_HANDOFF.md](./CEMS_WPMS_REQUEST_FORM_FRONTEND_HANDOFF.md).