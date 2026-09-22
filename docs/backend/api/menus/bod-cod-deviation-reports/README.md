# รายงานค่าความคลาดเคลื่อน BOD/COD Online

> Owner: Backend

## Frontend Quick Start

เมนูนี้ใช้สำหรับผู้ประกอบการส่งผลเปรียบเทียบเครื่องตรวจวัดกับห้องปฏิบัติการ และใช้สำหรับเจ้าหน้าที่ตรวจสอบ บันทึกแบบแจ้งผล และอนุมัติรายงาน ทุก endpoint ต้องส่ง Bearer token และถูกจำกัดด้วย permission กับ data scope ของผู้ใช้

permission code, alias ที่ frontend ใช้, และ scope keyword ที่อ้างในหน้านี้ใช้ canonical definition เดียวกับ [สิทธิ์การใช้งาน](../permissions/README.md)

### Main Flow

1. เรียก `GET /api/v1/bod-cod-deviation-reports/factories` เพื่อเลือกโรงงาน จุดตรวจวัด ปี และรอบที่ยังยื่นได้
2. ถ้ามีไฟล์ ให้ upload ทีละไฟล์ผ่าน `POST /api/v1/bod-cod-deviation-reports/attachments`
3. ส่งรายงานผ่าน `POST /api/v1/bod-cod-deviation-reports`; backend ออก `reportNo` และเริ่ม workflow ทันที
4. อ่านรายการหรือรายละเอียด แล้วใช้ `allowedActions` และ `currentStep` ควบคุม action ที่แสดง
5. เมื่อถูกขอแก้ไข ผู้ประกอบการส่งข้อมูลทั้งฉบับใหม่ผ่าน `PUT /:id/resubmission`; เจ้าหน้าที่ใช้ workflow action และ result notice endpoints ตามขั้นปัจจุบัน

```bash
curl --request POST \
  --url '<BASE_URL>/api/v1/bod-cod-deviation-reports' \
  --header 'Authorization: Bearer <ACCESS_TOKEN>' \
  --header 'Content-Type: application/json' \
  --data '{
    "reportRoundNo": 2,
    "reportYear": 2569,
    "factoryId": "FID-001",
    "factoryName": "บริษัท ตัวอย่าง จำกัด",
    "factoryRegistrationNo": "10520000225172",
    "provinceName": "กาญจนบุรี",
    "connectedMeasurementPointId": 9,
    "pointCode": "WEMS-0001/2569",
    "pointName": "จุดระบายน้ำทิ้ง A",
    "selectedParameterCode": "BOD",
    "measurements": [
      {
        "sampleDate": "2026-07-01",
        "sampleTime": "09:30",
        "deviceValueMgL": 12.5,
        "labValueMgL": 10,
        "standardDeviationMgL": 3
      }
    ],
    "attachments": []
  }'
```

## กติกาการทำงาน

### กติกาการยื่นรายงานและเลขครั้งรายปี

- สร้างรายงานใหม่ได้เฉพาะผู้ประกอบการ (`factory_operator`, scope `OWN_FACTORY`) หรือผู้มี role `admin` และต้องมี `bod_cod_errors:view` ร่วมกับ `bod_cod_errors:edit`; ข้อมูลต้องอยู่ภายใต้ scope ทั้งสองสิทธิ์
- `reportRoundNo` คือครึ่งปี `1` (ม.ค.-มิ.ย.) หรือ `2` (ก.ค.-ธ.ค.) และ `reportYear` คือปี พ.ศ. ปัจจุบันตาม `Asia/Bangkok`; backend ตรวจเวลาหลังรอ lock ก่อนบันทึก ไม่รับการสร้างย้อนหลังหรือข้ามรอบ
- ต้องระบุ `connectedMeasurementPointId` หรือ `pointCode` ที่ระบุจุดปัจจุบันได้เพียงจุดเดียว จุดต้องเป็นของโรงงานที่เลือกและมีพารามิเตอร์ที่รายงาน หากส่งทั้งสอง field ต้องตรงกัน; รองรับพารามิเตอร์จุดที่เก็บเป็น code (`BOD`/`COD`) หรือชื่อรวมหน่วย (`BOD (mg/l)`/`COD (mg/l)`) โดย request ยังคงส่ง code
- จุดเดียวกัน + พารามิเตอร์เดียวกัน + ปีเดียวกันมีคำขอค้างได้หนึ่งฉบับ โดย `APPROVED`, `REJECTED`, `CANCELLED` เป็นสถานะสิ้นสุด; `REVISION_REQUESTED` ยังเป็นคำขอค้าง การตรวจและสร้างทำภายใน transaction ที่ serialize การยื่นของจุดเดียวกัน
- `reportSequenceNo` เป็น integer บวกที่ server จัดสรรและคืนใน list/detail และ response ของ create/resubmission/workflow/result-notice/cancel; ไม่รับ field นี้ใน request นับแยกจุด + BOD/COD + ปี และนับต่อข้ามครึ่งปี
- อนุมัติสำเร็จแล้วครั้งถัดไปเพิ่มหนึ่ง; ยกเลิก/ไม่อนุมัติแล้วคำขอใหม่ใช้เลขครั้งเดิม; resubmit คงเลขครั้ง ปี รอบ และ `reportNo` ของคำขอเดิม และแก้ไขงานค้างข้ามครึ่งปีได้
- รายงานเก่าก่อน migration `0124` คืน `reportSequenceNo: null` เพราะไม่มีหลักฐานเลขครั้งเดิม ไม่เติมเลขย้อนหลัง; การจัดสรรใหม่ใช้จำนวนรายงาน `APPROVED` เดิมเป็นฐาน ร่วมกับเลขครั้งสูงสุดที่อนุมัติแล้ว ไม่แก้ `reportNo` เก่า
- `reportRound` เป็นข้อความรอบเดิมเพื่อความเข้ากันได้; client ต้องใช้ `reportSequenceNo` คู่กับ `reportYear` สำหรับช่องครั้งที่ และแสดง `-` เมื่อเป็น null รวมถึง preview ที่ยังไม่บันทึก

### สิทธิ์การพิจารณา

ทุก mutation ต้องมี `view` ร่วมกับ `edit` หรือ `approve` ตามงาน และผ่าน data scope ทั้งสองสิทธิ์; หาก action เป็น binary grant (`scope: null`) ให้ใช้ scope ของ `view` โดยไม่ขยายพื้นที่ การพิจารณาใช้ role + สถานะ + current step ร่วมกัน:

| ขั้น | Role ที่ใช้ได้ |
| --- | --- |
| `INSPECTOR` | `monitoring_kpm`, `monitoring_5_centers`, `admin` |
| `RESULT_NOTICE` สำหรับ workflow action | `monitoring_kpm`, `admin` |
| บันทึกแบบแจ้งผลผ่าน `POST`/`PUT /:id/result-notice` | `monitoring_kpm`, `monitoring_5_centers`, `admin` |
| `REVIEWER` | `kpm_director` |
| `APPROVER` | `center_director`, `kwp_director` |

`admin` เพียงอย่างเดียวไม่ให้สิทธิ์ทบทวน/อนุมัติสุดท้าย; detail คืน `allowedActions` ตามสิทธิ์และ scope ของงานนั้นจริง

### ยกเลิกคำขอ

`POST /api/v1/bod-cod-deviation-reports/:id/cancel` ไม่รับ request body (`id` เป็น positive integer) ใช้ Bearer token และ `bod_cod_errors:view` + `bod_cod_errors:edit`

เฉพาะผู้ประกอบการเจ้าของโรงงาน (`factory_operator`, scope `OWN_FACTORY`) ยกเลิกได้ทุกสถานะยกเว้น `APPROVED`/`CANCELLED` รวมถึง `REJECTED`; ตรวจสถานะซ้ำหลัง lock ร่วมกับ workflow/resubmit/result-notice และบันทึก event `CANCEL` ใน transaction เดียวกัน ไม่ลบรายงานหรือประวัติเดิม

```json
{
  "success": true,
  "data": {
    "id": 9,
    "reportNo": "E-02-0001/2569",
    "reportSequenceNo": 1,
    "statusCode": "CANCELLED",
    "approvalTrack": "REGIONAL",
    "currentStep": null,
    "steps": [],
    "allowedActions": []
  }
}
```

สำเร็จตอบ `200`; `steps` คืนประวัติขั้นตอนจริงโดยไม่มี current step; ยกเลิกซ้ำหรือคำขออนุมัติแล้วตอบ `409 CONFLICT` โดยไม่เพิ่มประวัติซ้ำ ฝั่ง frontend ต้องเชื่อม dialog กับ route นี้ก่อนใช้งานยกเลิกได้ครบ flow

กรณีสร้างผิดรอบหรือมีคำขอค้างตอบ `409 CONFLICT` พร้อม `error.details.reason` เป็น `REPORT_PERIOD_CLOSED` หรือ `PENDING_REPORT_EXISTS`; จุดไม่ถูกต้อง/พารามิเตอร์ไม่มีในจุดตอบ `400 BAD_REQUEST`; role ไม่ตรงตอบ `403 FORBIDDEN` และรายงานนอก scope ตอบ `404 NOT_FOUND`

## Endpoint Summary

| งาน | Method | Path | Auth | Permission |
| --- | --- | --- | --- | --- |
| Upload เอกสาร | `POST` | `/api/v1/bod-cod-deviation-reports/attachments` | Bearer | `bod_cod_errors:view` + `bod_cod_errors:edit` |
| รายการโรงงานและรอบรายงาน | `GET` | `/api/v1/bod-cod-deviation-reports/factories` | Bearer | `bod_cod_errors:view` |
| รายการรายงาน | `GET` | `/api/v1/bod-cod-deviation-reports` | Bearer | `bod_cod_errors:view` |
| รายละเอียดรายงาน | `GET` | `/api/v1/bod-cod-deviation-reports/:id` | Bearer | `bod_cod_errors:view` |
| สร้างและส่งรายงาน | `POST` | `/api/v1/bod-cod-deviation-reports` | Bearer | `bod_cod_errors:view` + `bod_cod_errors:edit` |
| ส่งรายงานที่แก้ไข | `PUT` | `/api/v1/bod-cod-deviation-reports/:id/resubmission` | Bearer | `bod_cod_errors:view` + `bod_cod_errors:edit` |
| ยกเลิกคำขอ | `POST` | `/api/v1/bod-cod-deviation-reports/:id/cancel` | Bearer | `bod_cod_errors:view` + `bod_cod_errors:edit` |
| ดำเนินการ workflow | `POST` | `/api/v1/bod-cod-deviation-reports/:id/workflow-actions` | Bearer | `bod_cod_errors:view` + `bod_cod_errors:approve` |
| สร้างหรือแก้ไขแบบแจ้งผล | `POST`, `PUT` | `/api/v1/bod-cod-deviation-reports/:id/result-notice` | Bearer | `bod_cod_errors:view` + `bod_cod_errors:approve` |

## เลขที่รายงาน `reportNo`

รายงานที่สร้างใหม่ใช้รูปแบบ:

```text
E-{รหัสภาค 2 หลัก}-{ลำดับ 4 หลัก}/{reportYear}
```

ตัวอย่าง `E-02-0001/2569` หมายถึงรายงานลำดับที่ 1 ของภาคตะวันตกในปีรายงาน 2569

| ภาคจากข้อมูลจังหวัด | รหัส |
| --- | --- |
| ภาคตะวันตก | `02` |
| ภาคตะวันออก | `03` |
| ภาคเหนือ | `04` |
| ภาคใต้ | `05` |
| ภาคตะวันออกเฉียงเหนือ | `06` |
| ภาคกลาง | `07` |

กติกา:

- Backend หา region จากจังหวัดของโรงงานในข้อมูลฝั่ง server ไม่รับ `regionCode` จาก request body
- Running แยกตาม `region + reportYear` และใช้ชุดเดียวกันระหว่าง BOD, COD และรอบรายงานที่ 1-2
- ลำดับอยู่ระหว่าง `0001`-`9999` และเริ่มที่ `0001` ใหม่เมื่อเปลี่ยน region หรือ `reportYear`
- การ resubmit ใช้ `reportNo` เดิม; เลขที่ถูกใช้แล้วจะไม่นำกลับมาออกซ้ำ
- Migration `0102_change_bod_cod_report_number_prefix_to_e` แปลงเลข regional เดิมจาก `Error-RR-NNNN/YYYY` เป็น `E-RR-NNNN/YYYY`
- รายงานเดิมอาจคืนเลขรูปแบบ `BODCOD-2569-0001` โดยไม่ถูก renumber
- Client ต้องถือ `reportNo` เป็น opaque string: ห้ามสร้าง แก้ ตัด หรือ sort ด้วยส่วนประกอบภายใน และต้อง URL-encode หากนำไปใช้เป็น path/query value

## Contracts

### Upload เอกสาร

`POST /api/v1/bod-cod-deviation-reports/attachments` รับ `multipart/form-data` โดย field ชื่อ `file` จำนวน 1 ไฟล์ รองรับ `.jpg`, `.jpeg`, `.png`, `.pdf` ที่ MIME type ตรงกับนามสกุลและขนาด 1 byte ถึง 5 MB

```bash
curl --request POST \
  --url '<BASE_URL>/api/v1/bod-cod-deviation-reports/attachments' \
  --header 'Authorization: Bearer <ACCESS_TOKEN>' \
  --form 'file=@./lab-report.pdf;type=application/pdf'
```

ตัวอย่าง response (`201 Created`):

```json
{
  "success": true,
  "data": {
    "originalFileName": "lab-report.pdf",
    "storedFileName": "66ffed87-bd77-48a5-933d-490c3bfd00e2.pdf",
    "mimeType": "application/pdf",
    "fileSize": 1024,
    "storagePath": "bod-cod/deviation-attachments/2026/07/66ffed87-bd77-48a5-933d-490c3bfd00e2.pdf",
    "fileUrl": "https://example.go.th/uploads/bod-cod/deviation-attachments/2026/07/66ffed87-bd77-48a5-933d-490c3bfd00e2.pdf"
  }
}
```

นำ metadata ใน `data` ไปสร้างสมาชิกของ `attachments[]`; ไม่ส่ง `fileUrl` กลับใน create body

### รายการโรงงานและรอบรายงาน

`GET /api/v1/bod-cod-deviation-reports/factories` ไม่มี query parameter และตอบ:

- `data[]`: ข้อมูลโรงงาน (`factoryId`, ชื่อ เลขทะเบียน จังหวัด ภาค ที่อยู่ และประเภทอุตสาหกรรม)
- `data[].measurementPoints[]`: จุดตรวจวัด พร้อม `parameterCodes`, `round1Status`, `round2Status`
- `data[].measurementPoints[].reportSlots[]`: สถานะรอบ 1 และ 2 โดยมี `year`, `status`, `reportId`, `reportNo`
- `data[].latestReport*`: รายงานล่าสุดของโรงงาน
- `meta.total`: จำนวนโรงงาน

```json
{
  "success": true,
  "data": [
    {
      "factoryId": "FID-001",
      "factoryName": "บริษัท ตัวอย่าง จำกัด",
      "newRegistrationNo": "10520000225172",
      "provinceName": "กาญจนบุรี",
      "regionName": "ภาคตะวันตก",
      "monitoringPointCount": 1,
      "measurementPoints": [
        {
          "id": 9,
          "pointCode": "WEMS-0001/2569",
          "pointName": "จุดระบายน้ำทิ้ง A",
          "systemType": "WPMS",
          "parameterCodes": ["BOD", "COD"],
          "reportSlots": [
            {
              "roundNo": 1,
              "year": 2569,
              "status": "NOT_SUBMITTED",
              "statusLabel": "ยังไม่ยื่น",
              "reportId": null,
              "reportNo": null
            }
          ]
        }
      ],
      "latestReportId": null,
      "latestReportNo": null
    }
  ],
  "meta": { "total": 1 }
}
```

### รายการรายงาน

`GET /api/v1/bod-cod-deviation-reports` รองรับ query ต่อไปนี้:

| Field | Type | Required | Rules |
| --- | --- | --- | --- |
| `status` | string | No | หนึ่งใน [สถานะรายงาน](#สถานะและ-workflow) |
| `parameterCode` | string | No | `BOD` หรือ `COD` |
| `factoryId` | string | No | trim แล้ว 1-64 ตัวอักษร |

Response เป็น `{ success, data[], meta: { total } }`; แต่ละรายการมี `reportSequenceNo` (integer บวก หรือ null สำหรับรายงานก่อน migration) และ identity ของรายงาน/โรงงาน/จุดตรวจวัด, `selectedParameterCode`, `selectedParameterLabel` ซึ่งรวมหน่วย `mg/l`, `approvalTrack`, สถานะ, วันเวลา, `measurementCount` และ `statusHistory[]`

```json
{
  "success": true,
  "data": [
    {
      "id": 9,
      "reportNo": "E-02-0001/2569",
      "reportSequenceNo": 3,
      "reportRound": "ครั้งที่ 1",
      "reportRoundNo": 1,
      "reportYear": 2569,
      "selectedParameterCode": "BOD",
      "selectedParameterLabel": "BOD (mg/l)",
      "factoryId": "FID-001",
      "factoryName": "บริษัท ตัวอย่าง จำกัด",
      "provinceName": "กาญจนบุรี",
      "approvalTrack": "REGIONAL",
      "statusCode": "SUBMITTED",
      "statusLabel": "ส่งรายงานแล้ว",
      "measurementCount": 1,
      "statusHistory": []
    }
  ],
  "meta": { "total": 1 }
}
```

### สร้างรายงานและ resubmit

`POST /api/v1/bod-cod-deviation-reports` และ `PUT /api/v1/bod-cod-deviation-reports/:id/resubmission` ใช้ body shape เดียวกัน โดย resubmit เพิ่ม `revisionNote` แบบ optional และเป็น full replacement ของ measurements/attachments

| Field | Type | Required | Rules |
| --- | --- | --- | --- |
| `reportRoundNo` | integer | Yes | `1` หรือ `2`; create ต้องเป็นครึ่งปีปัจจุบันตามเวลาไทย; resubmit คงรอบเดิม |
| `reportYear` | integer | Yes | พ.ศ. `2500`-`2700`; create ต้องเป็นปีปัจจุบันตามเวลาไทย; resubmit คงปีเดิม |
| `factoryId` | string \| null | No | สูงสุด 64 ตัวอักษร |
| `factoryName` | string | Yes | 1-500 ตัวอักษร |
| `factoryRegistrationNo` | string | Yes | 1-80 ตัวอักษร |
| `businessActivity` | string \| null | No | สูงสุด 255 ตัวอักษร |
| `factoryAddress` | string \| null | No | สูงสุด 1,000 ตัวอักษร |
| `provinceName` | string | Yes | 1-120 ตัวอักษร และต้องตรงกับจังหวัด authoritative ของโรงงาน |
| `connectedMeasurementPointId` | positive integer \| null | No | id จุดตรวจวัดที่เชื่อมต่อ |
| `pointCode` | string \| null | No | สูงสุด 64 ตัวอักษร |
| `pointName` | string \| null | No | สูงสุด 255 ตัวอักษร |
| `wastewaterFlowM3PerHour` | number \| null | No | อัตราการไหล `m³/hour` |
| `samplerName` | string \| null | No | สูงสุด 255 ตัวอักษร |
| `officerRegistrationNo` | string \| null | No | สูงสุด 80 ตัวอักษร |
| `laboratoryName` | string \| null | No | สูงสุด 255 ตัวอักษร |
| `laboratoryRegistrationNo` | string \| null | No | สูงสุด 80 ตัวอักษร |
| `labReportNo` | string \| null | No | สูงสุด 120 ตัวอักษร |
| `analysisMethod` | string \| null | No | สูงสุด 255 ตัวอักษร |
| `deviceBrand`, `deviceModel`, `deviceSerialNo` | string \| null | No | แต่ละ field สูงสุด 120 ตัวอักษร |
| `selectedParameterCode` | string | Yes | `BOD` หรือ `COD`; ค่า measurement มีหน่วย `mg/l` |
| `reporterName`, `reporterPosition` | string \| null | No | แต่ละ field สูงสุด 255 ตัวอักษร |
| `measurements` | array | Yes | 1-50 รายการตามตารางถัดไป |
| `attachments` | array | No | 0-30 รายการ; default `[]` |
| `revisionNote` | string \| null | Resubmit only | สูงสุด 1,000 ตัวอักษร |

`measurements[]`:

| Field | Type | Required | Rules |
| --- | --- | --- | --- |
| `sampleDate` | string | Yes | `YYYY-MM-DD` |
| `sampleTime` | string | Yes | `HH:mm` |
| `deviceValueMgL` | number | Yes | ค่าจากเครื่อง หน่วย `mg/l` |
| `labValueMgL` | number | Yes | ค่าจากห้องปฏิบัติการ หน่วย `mg/l` |
| `standardDeviationMgL` | number \| null | No | เกณฑ์ความคลาดเคลื่อน หน่วย `mg/l` |

`attachments[]`:

| Field | Type | Required | Rules |
| --- | --- | --- | --- |
| `attachmentType` | string | Yes | `SAMPLE_PHOTO`, `DEVICE_PHOTO` หรือ `LAB_REPORT` |
| `originalFileName` | string | Yes | 1-500 ตัวอักษร |
| `storedFileName` | string \| null | No | สูงสุด 500 ตัวอักษร |
| `mimeType` | string \| null | No | สูงสุด 128 ตัวอักษร |
| `fileSize` | non-negative integer \| null | No | byte |
| `storagePath` | string \| null | No | สูงสุด 1,000 ตัวอักษร |

Create สำเร็จตอบ `201 Created`, ส่ง `Location: /api/v1/bod-cod-deviation-reports/:id` และ workflow response; resubmit สำเร็จตอบ `200 OK` ด้วย shape เดียวกันและคง `reportNo` เดิม:

```json
{
  "success": true,
  "data": {
    "id": 9,
    "reportNo": "E-02-0001/2569",
    "reportSequenceNo": 1,
    "statusCode": "SUBMITTED",
    "approvalTrack": "REGIONAL",
    "currentStep": {
      "stepNo": 1,
      "roleCode": "INSPECTOR",
      "roleLabel": "เจ้าหน้าที่ศูนย์เฝ้าฯ 5 ศูนย์ (ตรวจสอบความถูกต้อง)",
      "status": "PENDING",
      "isCurrent": true
    },
    "steps": [],
    "allowedActions": ["CANCEL"]
  }
}
```

Resubmit ทำได้เฉพาะผู้ประกอบการเจ้าของโรงงาน เมื่อรายงานเป็น `REVISION_REQUESTED`; identity ได้แก่โรงงาน เลขทะเบียน จุดตรวจวัด ปี รอบ และ parameter ต้องตรงกับรายงานเดิม

### รายละเอียดรายงาน

`GET /api/v1/bod-cod-deviation-reports/:id` คืนข้อมูลเดียวกับรายการ และเพิ่มข้อมูลฟอร์มเต็ม, `measurements[]`, `attachments[]`, `resultNotice`, `currentStep`, `steps[]` และ `allowedActions[]`

`id` เป็น path parameter ชนิด positive integer และต้องเป็นรายงานที่ผู้ใช้เข้าถึงได้ตาม data scope

```json
{
  "success": true,
  "data": {
    "id": 9,
    "reportNo": "E-02-0001/2569",
    "reportSequenceNo": 1,
    "reportRoundNo": 1,
    "reportYear": 2569,
    "selectedParameterCode": "BOD",
    "selectedParameterLabel": "BOD (mg/l)",
    "statusCode": "SUBMITTED",
    "measurements": [
      {
        "parameterCode": "BOD",
        "sampleDate": "2026-07-01",
        "sampleTime": "09:30",
        "deviceValueMgL": 12.5,
        "labValueMgL": 10,
        "deviationValueMgL": 2.5,
        "standardDeviationMgL": 3,
        "isWithinStandard": true,
        "sortOrder": 1
      }
    ],
    "attachments": [],
    "resultNotice": null,
    "currentStep": null,
    "steps": [],
    "allowedActions": []
  }
}
```

### Workflow action

`POST /api/v1/bod-cod-deviation-reports/:id/workflow-actions`:

`id` เป็น path parameter ชนิด positive integer

| Field | Type | Required | Rules |
| --- | --- | --- | --- |
| `action` | string | Yes | `APPROVE`, `REQUEST_REVISION` หรือ `REJECT` |
| `revisionReason` | string | เมื่อ `REQUEST_REVISION` | 1-1,000 ตัวอักษร |
| `officerNote` | string \| null | No | สูงสุด 1,000 ตัวอักษร |

```json
{
  "action": "APPROVE",
  "officerNote": "ข้อมูลถูกต้อง"
}
```

สำเร็จตอบ `200 OK` ด้วย workflow response shape เดียวกับ create; client ต้องใช้ `allowedActions` ล่าสุดแทนการอนุมาน action จาก `statusCode` เพียงอย่างเดียว

### แบบแจ้งผล

`POST` และ `PUT /api/v1/bod-cod-deviation-reports/:id/result-notice` เป็น upsert alias ที่มี behavior เดียวกัน และบันทึกได้เฉพาะ current step `RESULT_NOTICE`

อนุญาต role `monitoring_kpm`, `monitoring_5_centers` หรือ `admin` ที่มี `bod_cod_errors:view` + `bod_cod_errors:approve` และผ่าน data scope ทั้งสองสิทธิ์ โดย scope ต้องไม่เป็น `OWN_FACTORY`; รายงานต้องอยู่สถานะ `WAITING_RESULT_NOTICE` และ current step เป็น `RESULT_NOTICE` / `PENDING` การบันทึกไม่เปลี่ยนขั้น workflow และสิทธิ์ workflow action ยังเป็นไปตามตารางข้างต้น

`id` เป็น path parameter ชนิด positive integer

| Field | Type | Required | Rules |
| --- | --- | --- | --- |
| `reportCorrectness` | string | Yes | `ถูกต้องครบถ้วน` หรือ `ไม่ถูกต้องครบถ้วน` |
| `checkedParameters` | string[] | Yes | 1-2 ค่า, ไม่ซ้ำ, แต่ละค่าเป็น `BOD` หรือ `COD` |
| `reviewResult` | string | Yes | `เห็นควรแจ้งผลการตรวจสอบ` หรือ `เห็นควรให้แก้ไขเพิ่มเติม` |
| `comment` | string \| null | No | สูงสุด 1,000 ตัวอักษร |
| `inspectorName` | string | Yes | field ต้องมีใน body, เป็นค่าว่างได้, สูงสุด 255 ตัวอักษร |
| `inspectorPosition` | string | Yes | field ต้องมีใน body, เป็นค่าว่างได้, สูงสุด 255 ตัวอักษร |

```json
{
  "reportCorrectness": "ถูกต้องครบถ้วน",
  "checkedParameters": ["BOD", "COD"],
  "reviewResult": "เห็นควรแจ้งผลการตรวจสอบ",
  "comment": "ตรวจสอบแล้วข้อมูลครบถ้วน",
  "inspectorName": "นางเจ้าหน้าที่ ตรวจสอบ",
  "inspectorPosition": "นักวิชาการสิ่งแวดล้อมชำนาญการ"
}
```

Response `200 OK` เป็น workflow response และเพิ่ม `resultNotice` ที่มี `id`, `reportId`, input fields, `updatedBy`, `updatedAt`

## สถานะและ workflow

สถานะที่ API อาจคืนหรือรับเป็น filter:

`DRAFT`, `SUBMITTED`, `REVISED_PENDING_REVIEW`, `WAITING_RESULT_NOTICE`, `WAITING_REVIEW`, `WAITING_APPROVAL`, `APPROVED`, `REJECTED`, `REVISION_REQUESTED`, `CANCELLED`

`approvalTrack` เป็น `CENTRAL` หรือ `REGIONAL`; steps ใช้ role `INSPECTOR`, `RESULT_NOTICE`, `REVIEWER`, `APPROVER` และ step status `PENDING`, `WAITING`, `APPROVED`, `REJECTED`, `REVISION_REQUESTED`

`allowedActions` อาจมี `CANCEL`, `APPROVE`, `REQUEST_REVISION`, `REJECT` ตามผู้ใช้ สิทธิ์ data scope สถานะ และ current step; ใช้ route `/cancel` สำหรับ `CANCEL`

## Errors

Error envelope:

```json
{
  "success": false,
  "error": {
    "code": "CONFLICT",
    "message": "BOD/COD deviation report sequence has reached 9999"
  }
}
```

| HTTP | Code | Condition | Client action |
| --- | --- | --- | --- |
| `400` | `VALIDATION_ERROR` | path/query/body ไม่ตรง schema เช่น status ไม่รู้จัก ปีหรือรอบไม่ถูกต้อง | แสดง validation และแก้ payload |
| `400` | `BAD_REQUEST` | ไม่มีไฟล์, ไฟล์ไม่รองรับ, จังหวัดไม่ตรงข้อมูลโรงงาน หรือหา region สำหรับออกเลขไม่ได้ | โหลดข้อมูลโรงงานใหม่หรือแก้ไฟล์/ข้อมูล |
| `400` | `UPLOAD_ERROR` | เกินข้อจำกัด multer เช่นไฟล์ใหญ่กว่า 5 MB | เลือกไฟล์ใหม่ |
| `401` | `UNAUTHORIZED` | token ขาด หมดอายุ หรือไม่ถูกต้อง | login ใหม่ |
| `403` | `FORBIDDEN` | ไม่มี permission/data scope, ไม่ใช่เจ้าของโรงงาน หรือผู้ประกอบการเรียกงานเจ้าหน้าที่ | ซ่อน action และแจ้งเรื่องสิทธิ์ |
| `404` | `NOT_FOUND` | ไม่พบรายงานภายใต้ data scope | กลับหน้ารายการ |
| `409` | `CONFLICT` | รอบ/สถานะ/current step ไม่อนุญาต, identity ตอน resubmit เปลี่ยน หรือ sequence ของ region+ปีถึง `9999` | โหลดรายละเอียดล่าสุด; overflow ต้องติดต่อผู้ดูแล |

## Business Flow And Explanations

- [เลขรายงาน BOD/COD แยกตามภาคและปี](../../../evidence/bod-cod-deviation-reports/request-numbering.tdd.md)
- [Shared API index](../../shared/README.md)

## Backend Maintainer Map

| Concern | Canonical source |
| --- | --- |
| Routes | [`bod-cod-deviation-reports.routes.ts`](../../../../../backend/src/modules/bod-cod-deviations/bod-cod-deviation-reports.routes.ts) |
| Controller | [`bod-cod-deviation-reports.controller.ts`](../../../../../backend/src/modules/bod-cod-deviations/bod-cod-deviation-reports.controller.ts) |
| Validators | [`bod-cod-deviation-reports.validator.ts`](../../../../../backend/src/modules/bod-cod-deviations/bod-cod-deviation-reports.validator.ts) |
| Public types | [`bod-cod-deviation-reports.types.ts`](../../../../../backend/src/modules/bod-cod-deviations/bod-cod-deviation-reports.types.ts) |
| Repository | [`bod-cod-deviation-reports.repository.ts`](../../../../../backend/src/modules/bod-cod-deviations/bod-cod-deviation-reports.repository.ts) |
| Submission policy | [`bod-cod-report-submission-policy.ts`](../../../../../backend/src/modules/bod-cod-deviations/bod-cod-report-submission-policy.ts) |
| Annual sequence migration | [`0124_add_bod_cod_annual_report_sequence.ts`](../../../../../backend/src/db/migrations/0124_add_bod_cod_annual_report_sequence.ts) |
| Regression tests | [`bod-cod-report-submission-policy.test.ts`](../../../../../backend/tests/unit/bod-cod-report-submission-policy.test.ts), [`bod-cod-cancellation.repository.test.ts`](../../../../../backend/tests/unit/bod-cod-cancellation.repository.test.ts) |
| Numbering | [`bod-cod-deviation-report-number.ts`](../../../../../backend/src/modules/bod-cod-deviations/bod-cod-deviation-report-number.ts), [`bod-cod-deviation-report-numbering.repository.ts`](../../../../../backend/src/modules/bod-cod-deviations/bod-cod-deviation-report-numbering.repository.ts) |
| Tests | [`bod-cod-deviation-reports.route.test.ts`](../../../../../backend/tests/unit/bod-cod-deviation-reports.route.test.ts), [`bod-cod-deviation-reports.repository.test.ts`](../../../../../backend/tests/unit/bod-cod-deviation-reports.repository.test.ts), [`bod-cod-deviation-report-number.test.ts`](../../../../../backend/tests/unit/bod-cod-deviation-report-number.test.ts), [`bod-cod-deviation-report-numbering.repository.test.ts`](../../../../../backend/tests/unit/bod-cod-deviation-report-numbering.repository.test.ts) |
| Evidence | [เลขรายงาน BOD/COD แยกตามภาคและปี](../../../evidence/bod-cod-deviation-reports/request-numbering.tdd.md) |
