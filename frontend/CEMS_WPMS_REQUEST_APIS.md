# CEMS/WPMS Request APIs

เอกสารชุด API สำหรับฟอร์มคำขอเพิ่มจุดตรวจวัด, เพิ่มพารามิเตอร์, ตั้งค่าอุปกรณ์ และหน้าตาราง/PDF ที่เกี่ยวข้อง

## Base URL

```text
http://localhost:3000/api/v1
```

ทุก endpoint ต้องส่ง token:

```http
Authorization: Bearer <accessToken>
Content-Type: application/json
```

## Point Code Auto Running

- ตอนผู้ประกอบการส่งฟอร์มเพิ่มจุดตรวจวัด ไม่ต้องส่ง `measurementPoints[].pointCode`
- Backend จะล้าง `pointCode` ของคำขอเพิ่มจุดตรวจวัด/ขอเชื่อมต่อใหม่ ถึง frontend ส่งมาก็ไม่ใช้เป็นเลขจริง
- เจ้าหน้าที่ตรวจผ่านด้วย `APPROVE_FORM` แล้วสถานะจะเปลี่ยน `PENDING_DESIGN_REVIEW` หรือ `REVISED_PENDING_DESIGN_REVIEW` -> `WAITING_CONNECTION`
- ตอนเข้า `WAITING_CONNECTION` backend จะออกเลข `pointCode` ให้จุดที่ยังไม่มีเลขโดยอัตโนมัติ
- CEMS ใช้ prefix `S` เช่น `S0001`, `S0002`
- WPMS ใช้ prefix `P` เช่น `P0001`, `P0002`

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

Mapping:

- ถ้าส่ง `notificationEmails` backend จะเก็บอีเมลแจ้งเตือนทั้งหมด
- ถ้าไม่ส่ง `notificationEmails` backend จะใช้ `contactPersons[].email` ที่มีค่าเป็น default
- ถ้าส่ง `officerNotificationEmails` backend จะเก็บอีเมลแจ้งเตือนเจ้าหน้าที่แยกจากอีเมลโรงงาน
- `contactName`, `contactPhone`, `contactEmail` ยังรับแบบ legacy เพื่อไม่ให้ API เก่าพัง แต่ request ใหม่ไม่ต้องส่งแล้ว

## Endpoint Summary

| ข้อ | รายการ                                                       | Method | Path                                                       | Permission                   |
| --- | ------------------------------------------------------------ | ------ | ---------------------------------------------------------- | ---------------------------- |
| 0   | ดึงข้อมูลทั่วไปของโรงงานสำหรับลงฟอร์มเพิ่มจุดตรวจวัด         | GET    | `/cems-wpms-requests/factories/:factoryId/general`         | `factories:view`             |
| 1   | บันทึกฟอร์ม เพิ่มจุดตรวจวัด                                  | POST   | `/cems-wpms-requests/measurement-points`                   | `cems_wpms_requests:edit`    |
| 2   | บันทึกฟอร์ม เพิ่มพารามิเตอร์                                 | POST   | `/cems-wpms-requests/parameters`                           | `cems_wpms_requests:edit`    |
| 3   | บันทึกฟอร์ม ตั้งค่าอุปกรณ์ config                            | POST   | `/cems-wpms-requests/:id/device-configs`                   | `cems_wpms_requests:edit`    |
| 4   | รายละเอียดฟอร์ม ตั้งค่าอุปกรณ์ config สำหรับดึงข้อมูลลงฟอร์ม | GET    | `/cems-wpms-requests/:id/device-configs?stationId=S0001`   | `cems_wpms_requests:view`    |
| 4.1 | รายละเอียดฟอร์ม ตั้งค่าอุปกรณ์ config ราย config             | GET    | `/cems-wpms-requests/:id/device-configs/:configId`         | `cems_wpms_requests:view`    |
| 5   | ตรวจฟอร์ม เปลี่ยนสถานะ                                       | POST   | `/cems-wpms-requests/:id/status`                           | `cems_wpms_requests:approve` |
| 6   | รายการคำขอทั้งหมด สำหรับตารางเจ้าหน้าที่                     | GET    | `/cems-wpms-requests/table-rows`                           | `cems_wpms_requests:view`    |
| 7   | รายการคำขอเฉพาะโรงงานตัวเอง สำหรับตารางผู้ประกอบการ          | GET    | `/cems-wpms-requests/table-rows`                           | `cems_wpms_requests:view`    |
| 8   | รายชื่อโรงงาน สำหรับตารางผู้ประกอบการ                        | GET    | `/cems-wpms-requests/operator-factories`                   | `factories:view`             |
| 9   | รายละเอียดคำขอรายคำขอ สำหรับ PDF/เติมฟอร์มเพิ่มพารามิเตอร์   | GET    | `/cems-wpms-requests/:id/detail`                           | `cems_wpms_requests:view`    |
| 10  | รายละเอียดรายจุดตรวจวัดทุกคำขอ เฉพาะ status เชื่อมต่อแล้ว    | GET    | `/cems-wpms-requests/connected-measurement-points`         | `cems_wpms_requests:view`    |

## Flow เพิ่มจุดตรวจวัด จบ 1 คำขอ

1. Frontend เปิดฟอร์ม "เพิ่มจุดตรวจวัด"
2. เรียก `GET /cems-wpms-requests/factories/:factoryId/general` เพื่อดึงข้อมูลทั่วไปของโรงงานลงฟอร์ม
3. ผู้ใช้กรอก `measurementPoints[].details`, `measurementPoints[].documentsAndImages`, `measurementPoints[].measurementInstruments`
4. เรียก `POST /cems-wpms-requests/measurement-points` เพื่อบันทึกทั้งฟอร์ม
5. คำขอถูกสร้างเป็น `ADD_MEASUREMENT_POINT` และสถานะเริ่มต้น `PENDING_DESIGN_REVIEW`

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
| ลำดับประเภทโรงงาน (รอง) | `industrySubOrder` | `string|null` |
| การประกอบกิจการ | `businessActivity` | `string|null` |
| มีการประเมินผลกระทบสิ่งแวดล้อม (EIA) / ไม่มี | `eia` หรือ `hasEia` | `"มี"|"ไม่มี"|null` หรือ `boolean|null` |
| ชื่อโครงการ | `projectName` | `string|null` |
| สถานที่ตั้งโรงงาน | `address` | `string|null` |
| พิกัดโรงงาน (ละติจูด) | `latitude` | `number|null` |
| พิกัดโรงงาน (ลองจิจูด) | `longitude` | `number|null` |

หมายเหตุ:

- `measurementPoints[].parameters` ไม่ต้องส่งจาก frontend แล้ว backend จะ derive จาก `measurementPoints[].measurementInstruments.parameters[].parameter`
- `measurementPoints[].description` เป็น field optional สำหรับหมายเหตุเพิ่มเติม ถ้าหน้าฟอร์มไม่มีช่องนี้ไม่ต้องส่ง

## 1. บันทึกฟอร์ม เพิ่มจุดตรวจวัด

```bash
curl -X POST "http://localhost:3000/api/v1/cems-wpms-requests/measurement-points" \
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
        "pointType": "STACK",
        "details": {
          "productionUnitType": "หม้อไอน้ำ",
          "productionCapacity": "10 ตันไอน้ำ/ชั่วโมง",
          "cemsInstallationRequiredBy": "ประกาศ อก.",
          "cemsInstallationRequiredOther": null,
          "legalAnnexNo": "เฉพาะประกาศปี 65",
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
              "oxygenOrExcessAir": true
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
    "requestNo": "CR-20260530-0001",
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
          "legalAnnexNo": "เฉพาะประกาศปี 65",
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
              "oxygenOrExcessAir": true
            }
          ]
        }
      }
    ]
  }
}
```

## 2. บันทึกฟอร์ม เพิ่มพารามิเตอร์

ต้องส่ง `measurementPoints` แค่ 1 จุดตรวจวัดต่อคำขอ, ต้องส่ง `pointCode` ของจุดตรวจวัดเดิมที่ backend เคยออกเลขให้แล้ว และต้องส่งส่วน `measurementInstruments`

```bash
curl -X POST "http://localhost:3000/api/v1/cems-wpms-requests/parameters" \
  -H "Authorization: Bearer $OPERATOR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "factoryId": "factory-001",
    "factoryName": "บริษัท ทดสอบ จำกัด",
    "factoryRegistrationNo": "3-106-33/50สบ",
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
              "oxygenOrExcessAir": true
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
    "eligibleParameters": ["NOx", "SO2", "PM"],
    "exemptedParameters": ["Hg"],
    "connectedParameters": ["O2", "Flow"],
    "pendingParameters": ["CO", "CO2"]
  }
}
```

Conditional fields ที่ backend ตรวจ:

| ตัวเลือกในฟอร์ม | เงื่อนไข | Field ที่ต้องส่งเพิ่ม |
| --- | --- | --- |
| ลักษณะปล่อง | `stackShape = "วงกลม"` | `details.stackDiameter` เป็น number |
| ลักษณะปล่อง | `stackShape = "สี่เหลี่ยม"` | `details.stackWidth`, `details.stackLength` เป็น number |
| ลักษณะปล่อง | `stackShape = "อื่นๆ"` | `details.stackShapeOther` |
| ระบบบำบัด | `hasTreatmentSystem = "มี"` | `details.treatmentSystem` |
| ระบบบำบัด | `hasTreatmentSystem = "มี"` และ `treatmentSystem = "อื่นๆ"` | `details.treatmentSystemOther` |
| อุปกรณ์/โปรแกรมที่ใช้เชื่อมต่อ | `connectionDevice = "อื่นๆ"` | `details.connectionDeviceOther` |
| เชื้อเพลิงหลัก | `primaryFuel = "อื่นๆ"` | `details.primaryFuelOther` |
| เชื้อเพลิงรอง | `secondaryFuel = "อื่นๆ"` | `details.secondaryFuelOther` |
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
        "eligibleParameters": ["NOx", "SO2"],
        "exemptedParameters": ["PM"],
        "connectedParameters": ["O2", "Flow"],
        "pendingParameters": ["CO", "CO2"],
        "stackShape": "สี่เหลี่ยม",
        "stackWidth": 1.5,
        "stackLength": 2,
        "hasTreatmentSystem": "มี",
        "treatmentSystem": "อื่นๆ",
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
        "hasTreatmentSystem": "มี",
        "treatmentSystem": "ระบบบำบัดชีวภาพ",
        "maxTreatmentCapacity": 1000,
        "instrumentLatitude": 13.7563,
        "instrumentLongitude": 100.5018,
        "wastewaterSource": "กระบวนการผลิต",
        "dischargeReceivingSource": "คลองสาธารณะ",
        "connectionDevice": "POMS Box (กรอ.)"
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
| เข้าข่ายต้องติดตั้ง CEMS ตามกฎหมาย         | `measurementPoints[].details.cemsInstallationRequiredBy`    |
| อื่นๆ โปรดระบุของเข้าข่ายต้องติดตั้ง       | `measurementPoints[].details.cemsInstallationRequiredOther` |
| เข้าข่ายตามบัญชีแนบท้ายลำดับที่            | `measurementPoints[].details.legalAnnexNo`                  |
| พารามิเตอร์ที่เข้าข่าย                     | `measurementPoints[].details.eligibleParameters`            |
| พารามิเตอร์ที่ได้รับการยกเว้น              | `measurementPoints[].details.exemptedParameters`            |
| พารามิเตอร์ที่เชื่อมต่อแล้ว                | `measurementPoints[].details.connectedParameters`           |
| พารามิเตอร์ที่ยังไม่เชื่อมต่อ              | `measurementPoints[].details.pendingParameters`             |
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

หมายเหตุ: `pointCode` เป็นเลขที่ backend ออกให้หลังเจ้าหน้าที่อนุมัติแบบ ไม่ใช่ field ที่ frontend ต้องสร้างเองสำหรับฟอร์มเพิ่มจุดตรวจวัด

### CEMS Details

| Label                                      | Field                                                       |
| ------------------------------------------ | ----------------------------------------------------------- |
| ประเภทของหน่วยการผลิต                      | `measurementPoints[].details.productionUnitType`            |
| กำลังการผลิตต่อหน่วย                       | `measurementPoints[].details.productionCapacity`            |
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
    "legalAnnexNo": "เฉพาะประกาศปี 65",
    "eligibleParameters": ["NOx", "SO2", "PM"],
    "exemptedParameters": [],
    "connectedParameters": [],
    "pendingParameters": ["NOx", "SO2", "PM"],
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
- ถ้าเลือก checkbox ต้องส่ง `enabled: true`, `standardValue`, และ `rows` ให้ครบ 3 แถว
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
              "oxygenOrExcessAir": true
            }
          ]
        }
      }
    ],
    "remarks": "แก้ไขตามเจ้าหน้าที่แจ้ง"
  }'
```

หมายเหตุ:

- ถ้าไม่ส่ง `requestType` backend จะใช้ประเภทคำขอเดิม เช่น `ADD_PARAMETER`
- ถ้าแก้ไขฟอร์มเพิ่มจุดตรวจวัด ต้องส่ง `details`, `documentsAndImages`, `measurementInstruments`
- ถ้าแก้ไขฟอร์มเพิ่มพารามิเตอร์ ต้องส่ง `measurementPoints` 1 รายการ และ `measurementInstruments`

Response:

```json
{
  "success": true,
  "data": {
    "id": 2,
    "requestNo": "CR-20260530-0002",
    "requestType": "ADD_PARAMETER",
    "requestTypeLabel": "เพิ่มพารามิเตอร์",
    "status": "REVISED_PENDING_DESIGN_REVIEW",
    "statusLabel": "แก้ไขแล้ว/รอพิจารณาแบบ"
  }
}
```

## 3. บันทึกฟอร์ม ตั้งค่าอุปกรณ์ config

ใช้หลังคำขออยู่สถานะ `WAITING_CONNECTION` และ `stationId` ต้องตรงกับ `pointCode` หรือ `pointName` ในคำขอนั้น

```bash
curl -X POST "http://localhost:3000/api/v1/cems-wpms-requests/$REQUEST_ID/device-configs" \
  -H "Authorization: Bearer $OPERATOR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "stationId": "S0001",
    "protocol": "MODBUS_TCP",
    "settings": {
      "hostIp": "192.168.1.10",
      "slaveId": 1,
      "port": 502
    },
    "channels": [
      {
        "addressId": 40001,
        "dataType": "NOx",
        "unit": "ppm",
        "valueRange": { "min": 0, "max": 200 },
        "valueFormat": "MEASUREMENT_VALUE",
        "offset": 0,
        "encoding": "UNSIGNED16_BIG_ENDIAN"
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
    "protocol": "MODBUS_TCP",
    "settings": {
      "hostIp": "192.168.1.10",
      "slaveId": 1,
      "port": 502
    },
    "channels": [
      {
        "addressId": 40001,
        "dataType": "NOx",
        "unit": "ppm",
        "valueRange": { "min": 0, "max": 200 },
        "valueFormat": "MEASUREMENT_VALUE",
        "offset": 0,
        "encoding": "UNSIGNED16_BIG_ENDIAN"
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
    "requestNo": "CR-20260530-0001",
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
        "parameter": "NOx",
        "unit": "ppm",
        "min": "0",
        "max": "200",
        "valueFormat": "ค่าข้อมูลตรวจวัด",
        "offset": "0",
        "encodingData": "Unsigned16 - Big Endian",
        "status": "Normal"
      }
    ],
    "testResults": [],
    "rawConfigs": []
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
    "requestNo": "CR-20260530-0001",
    "status": "WAITING_CONNECTION",
    "statusLabel": "รอเชื่อมต่อ",
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
```

ตัวอย่าง:

```bash
curl "http://localhost:3000/api/v1/cems-wpms-requests/table-rows?status=WAITING_CONNECTION&requestType=ADD_MEASUREMENT_POINT" \
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
      "requestNo": "CR-20260530-0001",
      "submittedAt": "2026-05-30T10:00:00.000Z",
      "submittedDate": "30/05/2569",
      "monitoringPointCode": "S0001",
      "codeIssuedAt": "2026-05-30T10:05:00.000Z",
      "codeIssuedDate": "30/05/2569",
      "form": "เพิ่มจุดตรวจวัด",
      "status": "รอเชื่อมต่อ",
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
      "province": "สระบุรี",
      "monitoringPointCount": 1,
      "requestStatus": "เชื่อมต่อแล้ว",
      "requestStatusCode": "CONNECTED",
      "status": "แสดง"
    }
  ],
  "meta": {
    "total": 1
  }
}
```

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
    "requestNo": "CR-20260530-0001",
    "requestType": "ADD_MEASUREMENT_POINT",
    "requestTypeLabel": "เพิ่มจุดตรวจวัด",
    "factoryId": "factory-001",
    "factoryName": "บริษัท ทดสอบ จำกัด",
    "systemType": "CEMS",
    "status": "WAITING_CONNECTION",
    "statusLabel": "รอเชื่อมต่อ",
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
        "changedBy": 42,
        "changedAt": "2026-05-30T10:00:00.000Z"
      }
    ],
    "deviceConfigs": [
      {
        "id": 10,
        "requestId": 1,
        "stationId": "S0001",
        "protocol": "MODBUS_TCP",
        "settings": {
          "hostIp": "192.168.1.10",
          "slaveId": 1,
          "port": 502
        },
        "channels": [
          {
            "addressId": 40001,
            "dataType": "NOx",
            "unit": "ppm",
            "valueRange": { "min": 0, "max": 200 },
            "valueFormat": "MEASUREMENT_VALUE",
            "offset": 0,
            "encoding": "UNSIGNED16_BIG_ENDIAN"
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

## 10. รายละเอียดคำขอ รายจุดตรวจวัด ทุกคำขอ เฉพาะ status เชื่อมต่อแล้ว สำหรับทำ PDF

```bash
curl "http://localhost:3000/api/v1/cems-wpms-requests/connected-measurement-points" \
  -H "Authorization: Bearer $OFFICER_TOKEN"
```

Filter โรงงานเดียว:

```bash
curl "http://localhost:3000/api/v1/cems-wpms-requests/connected-measurement-points?factoryId=factory-001" \
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
      "requestNo": "CR-20260530-0001",
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
          "id": 10,
          "requestId": 1,
          "stationId": "S0001",
          "protocol": "MODBUS_TCP",
          "settings": {
            "hostIp": "192.168.1.10",
            "slaveId": 1,
            "port": 502
          },
          "channels": [
            {
              "addressId": 40001,
              "dataType": "NOx",
              "unit": "ppm",
              "valueRange": { "min": 0, "max": 200 },
              "valueFormat": "MEASUREMENT_VALUE",
              "offset": 0,
              "encoding": "UNSIGNED16_BIG_ENDIAN"
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
```
