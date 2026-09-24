# จุดตรวจวัดที่เชื่อมต่อแล้ว

> Owner: Backend

## Frontend Quick Start

API กลุ่มนี้เป็น contract ร่วมสำหรับหน้าขอเชื่อมต่อ หน้าหลัก และหน้าแจ้งแบบ กวภ. Endpoint รายโรงงานคืนรายการจุดตรวจวัดพร้อมข้อมูล prefill ของ กวภ.01 และ กวภ.05 โดย key ของข้อมูล prefill จะอยู่ใน response เสมอและเป็น `null` เมื่อไม่มีข้อมูลต้นทาง

ชื่อ `pointName` ในรายการและรายละเอียดจุดตรวจวัดใช้ชื่อ current/live ที่อนุมัติแล้วจาก active `cems_wpms_connected_measurement_points` โดยจับคู่ `source_measurement_point_id` กับ `id` ของจุดในคำขอ หลังกรองสิทธิ์เข้าถึงโรงงานแล้ว หากไม่พบแถวปัจจุบันที่จับคู่ได้จะใช้ชื่อ snapshot เดิม รหัสจุดและประวัติคำขอยังคงเดิม

กฎนี้ใช้กับ `GET /api/v1/connected-measurement-points`, alias `GET /api/v1/cems-wpms-requests/connected-measurement-points` และ endpoint รายโรงงานด้านล่าง ส่วน `GET /api/v1/connected-measurement-points/:stationId/requests` ยังคงคืนประวัติตามคำขอแต่ละรายการ

### Main Flow

1. ใช้รหัสโรงงานหรือเลขทะเบียนโรงงานที่อยู่ใน connected request เรียก endpoint รายโรงงาน
2. ให้ผู้ใช้เลือกจุดตรวจวัดจาก `data`
3. ใช้ `connectedPointId` อ้างอิงจุดเมื่อค่าไม่เป็น `null` และใช้ field prefill เติมแบบ กวภ.

```bash
curl --request GET \
  --url '<BASE_URL>/api/v1/connected-measurement-points/factories/10120000325542' \
  --header 'Authorization: Bearer <ACCESS_TOKEN>' \
  --header 'Accept: application/json'
```

## Endpoint Summary

| งาน | Method | Path | Auth | Permission | Contract |
| --- | --- | --- | --- | --- | --- |
| อ่านจุดตรวจวัดของโรงงานและข้อมูล prefill | `GET` | `/api/v1/connected-measurement-points/factories/:factoryId` | Bearer | `cems_wpms_requests:view` | [Factory connected points](#get-apiv1connected-measurement-pointsfactoriesfactoryid) |
| อ่านประวัติคำขอของจุดตรวจวัด | `GET` | `/api/v1/connected-measurement-points/:stationId/requests` | Bearer | `cems_wpms_requests:view` | [Connected-point requests](#get-apiv1connected-measurement-pointsstationidrequests) |
| อ่านแบบตั้งค่าอุปกรณ์ปัจจุบัน | `GET` | `/api/v1/connected-measurement-points/:stationId/device-configs` | Bearer | `cems_wpms_requests:view` | [Device config contract](../../menus/connection-requests/device-configs.md) |
| แทนที่การตั้งค่าอุปกรณ์ปัจจุบัน | `POST` | `/api/v1/connected-measurement-points/:stationId/device-configs` | Bearer | `cems_wpms_requests:edit` | [Device config contract](../../menus/connection-requests/device-configs.md) |
| อ่านสถิติรายชั่วโมง | `GET` | `/api/v1/connected-measurement-points/:stationId/measurement-statistics?date=YYYY-MM-DD` | Bearer | `dashboard.stats:view` | [Measurement statistics](#get-apiv1connected-measurement-pointsstationidmeasurement-statistics) |
| อ่านปฏิทินรายเดือนและจำนวนวันสรุปถึงวันสิ้นสุด | `GET` | `/api/v1/connected-measurement-points/:stationId/calendar-status?month=YYYY-MM` | Bearer | `dashboard.stats:view` | [Calendar status](#get-apiv1connected-measurement-pointsstationidcalendar-status) |
| อ่านรายละเอียดรายวันเมื่อคลิกจำนวนวันในสรุป | `GET` | `/api/v1/connected-measurement-points/:stationId/calendar-status/details?year=YYYY` | Bearer | `dashboard.stats:view` | [Calendar status details](#get-apiv1connected-measurement-pointsstationidcalendar-statusdetails) |
| ส่งออกข้อมูลตรวจวัดเป็น CSV | `GET` | `/api/v1/connected-measurement-points/:stationId/measurement-export.csv` | Bearer | `dashboard.stats:export` | [Measurement CSV export](#get-apiv1connected-measurement-pointsstationidmeasurement-exportcsv) |

## Contracts

### `GET /api/v1/connected-measurement-points/factories/:factoryId`

คืนเฉพาะจุดตรวจวัดจากคำขอที่มีสถานะ `CONNECTED` และอยู่ใน data scope ของผู้เรียก

### Authentication And Permission

- Authentication: required
- Permission: `cems_wpms_requests:view`
- Data scope: `ALL`, `IN_REGION`, `IN_PROVINCE` หรือ `OWN_FACTORY`

### Request Fields

| Field | Location | Type | Required | Description |
| --- | --- | --- | --- | --- |
| `factoryId` | path | string | Yes | `factory_id` หรือเลขทะเบียนโรงงานที่บันทึกใน connected request; trim แล้ว 1-64 ตัวอักษร |

### Request Example

ไม่มี request body

### Success Response Fields

| Field | Type | Nullable | Description |
| --- | --- | --- | --- |
| `success` | boolean | No | `true` เมื่อสำเร็จ |
| `data` | array | No | รายการจุดตรวจวัดที่เชื่อมต่อแล้ว |
| `data[].connectedPointId` | number | Yes | ID จาก active row ใน `cems_wpms_connected_measurement_points` สำหรับส่งเป็น `connectedPointId` ในแบบ กวภ.; เป็น `null` เมื่อหา active row ที่ตรงกับ source point ไม่พบ |
| `data[].pointCode` | string | Yes | รหัสจุดตรวจวัด |
| `data[].pointName` | string | No | ชื่อ current/live ที่อนุมัติแล้ว; fallback เป็นชื่อ snapshot เมื่อไม่พบแถวปัจจุบันที่จับคู่ได้ |
| `data[].pointType` | `CEMS` \| `WPMS` | No | ระบบตรวจวัดของจุด |
| `data[].parameterDetails` | string[] | No | ชื่อพารามิเตอร์พร้อมหน่วย เช่น `CO (ppm)` |
| `data[].parameterInstrumentDetails` | object[] | No | ข้อมูลเครื่องมือตรวจวัดของแต่ละพารามิเตอร์ เรียงลำดับเดียวกับ `parameterDetails`; เป็น `[]` สำหรับ WPMS |
| `data[].parameterInstrumentDetails[].parameter` | string | No | ชื่อพารามิเตอร์พร้อมหน่วย โดยมีค่าเดียวกับสมาชิกที่ตำแหน่งเดียวกันใน `parameterDetails` |
| `data[].parameterInstrumentDetails[].cemsModel` | string | Yes | brand/model สำหรับพารามิเตอร์นั้น; หลายค่าที่ไม่ซ้ำกันคั่นด้วย `, ` และเป็น `null` เมื่อยังไม่มีข้อมูล |
| `data[].primaryFuel` | string | Yes | เชื้อเพลิงหลัก |
| `data[].secondaryFuel` | string | Yes | เชื้อเพลิงสำรอง |
| `data[].productionStack` | string | Yes | ข้อมูลปล่อง/หน่วยการผลิตสำหรับ prefill กวภ.01 |
| `data[].combustionSystem` | `ระบบปิด` \| `ระบบเปิด` | Yes | ระบบการเผาไหม้สำหรับ prefill กวภ.01 |
| `data[].productionCapacity` | string | Yes | ค่ากำลังการผลิต ไม่รวมหน่วยเมื่อข้อมูลต้นทางแยกค่าและหน่วยได้ |
| `data[].productionCapacityUnit` | string | Yes | หน่วยกำลังการผลิต |
| `data[].cemsModel` | string | Yes | compatibility field ที่รวม brand ของเครื่องมือตรวจวัดซึ่งไม่ซ้ำกัน คั่นด้วย `, `; client ใหม่ควรใช้ `parameterInstrumentDetails[].cemsModel` |
| `data[].instruments` | string[] | Yes | ตัวเลือกเครื่องมือสำหรับ WPMS |
| `data[].measurementTimes` | string[] | Yes | รอบเวลาตรวจวัดสำหรับ WPMS |
| `data[].wastewaterSource` | string | Yes | แหล่งกำเนิดน้ำเสียสำหรับ WPMS |
| `data[].receivingSource` | string | Yes | แหล่งรองรับน้ำทิ้งสำหรับ WPMS |
| `data[].treatmentSystemType` | string | Yes | ระบบบำบัดน้ำเสียสำหรับ WPMS |
| `data[].dischargePoint` | string | Yes | จุดระบายน้ำทิ้งหรือพิกัดสำหรับ WPMS |
| `data[].averageDischarge` | number \| string | Yes | ปริมาณน้ำทิ้งเฉลี่ยตามหน่วยที่บันทึกในคำขอ |
| `data[].minimumDischarge` | number \| string | Yes | ปริมาณน้ำทิ้งต่ำสุดตามหน่วยที่บันทึกในคำขอ |
| `data[].maximumDischarge` | number \| string | Yes | ปริมาณน้ำทิ้งสูงสุดตามหน่วยที่บันทึกในคำขอ |
| `meta.total` | number | No | จำนวนจุดใน `data` |

### Success Response Example

```json
{
  "success": true,
  "data": [
    {
      "connectedPointId": 25,
      "pointCode": "S1125",
      "pointName": "Boiler 35 T",
      "pointType": "CEMS",
      "parameterDetails": ["CO (ppm)", "NOx (ppm)", "SO2 (ppm)"],
      "parameterInstrumentDetails": [
        {
          "parameter": "CO (ppm)",
          "cemsModel": "CO Analyzer A"
        },
        {
          "parameter": "NOx (ppm)",
          "cemsModel": "NOx Analyzer B"
        },
        {
          "parameter": "SO2 (ppm)",
          "cemsModel": null
        }
      ],
      "primaryFuel": "ไม่มี",
      "secondaryFuel": "ไม่มี",
      "productionStack": "หม้อไอน้ำ",
      "combustionSystem": "ระบบปิด",
      "productionCapacity": "35",
      "productionCapacityUnit": "ตัน/ชั่วโมง",
      "cemsModel": "CO Analyzer A, NOx Analyzer B"
    }
  ],
  "meta": {
    "total": 1
  }
}
```

### Validation And Business Rules

- `productionStack` อ่านจาก `details.productionStack` ก่อน แล้ว fallback ไป `details.productionUnitType`
- `combustionSystem` อ่านจาก `details.combustionSystem` หรือ `details.combustionControlSystem` และคืนเฉพาะ `ระบบปิด`, `ระบบเปิด` หรือ `null`
- `productionCapacity` ใช้ `details.productionCapacityValue` ก่อน และ fallback ไป `details.productionCapacity`; ถ้ามี `productionCapacityUnit` ต่อท้ายค่าแบบ legacy backend จะแยกหน่วยออก
- `parameterInstrumentDetails` สร้างจาก `parameterDetails` ทุกตัว แล้วจับคู่กับ `measurementInstruments.parameters[].parameter` หลัง trim และเทียบแบบไม่สนตัวพิมพ์เล็ก-ใหญ่
- `parameterInstrumentDetails[].cemsModel` ใช้ `measurementInstruments.parameters[].brand` ของพารามิเตอร์ที่จับคู่ได้ หลัง trim และตัดค่าซ้ำ; ถ้าไม่มี brand จะคืน `null`
- `cemsModel` ระดับจุดตรวจวัดยังรวม brand จาก `measurementInstruments.parameters[]` หลัง trim และตัดค่าซ้ำเพื่อ backward compatibility เท่านั้น
- `connectedPointId` resolve จาก active connected point ด้วย `source_measurement_point_id`; backend ไม่ใช้ ID ของ request snapshot แทน
- สำหรับ WPMS `parameterInstrumentDetails` จะเป็น `[]`, field prefill CEMS อื่นจะเป็น `null` และ field WPMS จะยังคืนตาม contract เดิม
- API ใช้ conditional response ของ Express ได้ จึงอาจเห็น `304 Not Modified` เมื่อ browser ส่ง `If-None-Match`; `304` หมายถึง client ใช้ representation ที่ cache ไว้ ไม่ใช่ response contract ใหม่หายไป

### Errors

| HTTP status | Condition | Client action |
| --- | --- | --- |
| `400 Bad Request` | `factoryId` ไม่ผ่าน validation | ตรวจรหัสโรงงานที่ส่ง |
| `401 Unauthorized` | ไม่มี bearer token ที่ถูกต้อง | login ใหม่ |
| `403 Forbidden` | ไม่มี permission หรือโรงงานอยู่นอก data scope | ซ่อน action หรือแจ้งสิทธิ์ไม่เพียงพอ |

### `GET /api/v1/connected-measurement-points/:stationId/requests`

คืนรายการคำขอทั้งหมดที่เชื่อมโยงกับจุดตรวจวัดตาม `stationId` และอยู่ใน data scope ของผู้เรียก หากไม่มีรายการที่มองเห็นได้ให้ตอบ `200 OK` พร้อม `data: []`.

#### Authentication And Permission

- Authentication: required
- Permission: `cems_wpms_requests:view`
- Data scope: `ALL`, `IN_REGION`, `IN_PROVINCE` หรือ `OWN_FACTORY`
- สำหรับ `OWN_FACTORY` ระบบตรวจ factory assignment จาก `user_juristics` หรือ `user_factory_access` ไม่ตรวจว่า request ถูกสร้างโดยผู้เรียก จึงอ่านคำขอที่เจ้าหน้าที่สร้างให้โรงงานที่ผู้ประกอบการได้รับมอบหมายได้

#### Request Fields

| Field | Location | Type | Required | Description |
| --- | --- | --- | --- | --- |
| `stationId` | path | string | Yes | รหัสจุดตรวจวัด; encode `/` เป็น `%2F` เมื่อสร้าง URL |

#### Request Example

ไม่มี request body:

```text
GET /api/v1/connected-measurement-points/S1125/requests
```

#### Success Response Fields

| Field | Type | Nullable | Description |
| --- | --- | --- | --- |
| `success` | boolean | No | `true` เมื่อสำเร็จ |
| `data` | object[] | No | รายการคำขอที่ผู้เรียกมีสิทธิ์อ่าน |
| `data[].id` | number | No | request ID |
| `data[].requestNo` | string | No | เลขที่คำขอ |
| `data[].status` | string | No | status code ของคำขอ |
| `data[].measurementPoints` | object[] | No | จุดตรวจวัดในคำขอ |
| `data[].deviceConfigs` | object[] | No | device config ของคำขอนั้น |
| `meta.total` | number | No | จำนวนรายการใน `data` |

#### Success Response Example

```json
{
  "success": true,
  "data": [
    {
      "id": 12,
      "requestNo": "CEMS-0001/2569",
      "status": "CONNECTED",
      "measurementPoints": [
        {
          "pointCode": "S1125"
        }
      ],
      "deviceConfigs": []
    }
  ],
  "meta": {
    "total": 1
  }
}
```

#### Errors

| HTTP status | Condition | Client action |
| --- | --- | --- |
| `400 Bad Request` | `stationId` ไม่ผ่าน validation | ตรวจรหัสจุดตรวจวัดที่ส่ง |
| `401 Unauthorized` | ไม่มี bearer token ที่ถูกต้อง | login ใหม่ |
| `403 Forbidden` | ไม่มี permission | ซ่อนข้อมูลหรือแจ้งสิทธิ์ไม่เพียงพอ |

<a id="home-measurement-rules"></a>

### กติกาสถิติและปฏิทินของหน้าหลัก

กติกานี้ใช้กับ `measurement-statistics`, `calendar-status` และ `calendar-status/details` รวม annual path aliases เท่านั้น โดยใช้การเลือกชั่วโมงและการกรองเดียวกับ [dashboard และแผนที่หน้าหลัก](../../menus/home/README.md#กติกาข้อมูลหน้าหลัก) API รายการ/รายละเอียดจุดเพื่อทำคำขอ, CSV export และ consumer ของเมนูอื่นคง contract ของตนเอง

- `cdate`/`ctime` เป็นวันและเวลาตรวจวัดหน้าเครื่อง ส่วน `udate`/`utime` เป็นวันและเวลาที่เครื่องส่งข้อมูล ทั้งสองชุดใช้ `Asia/Bangkok` ที่ต้นทางปรับ timezone แล้ว Backend เปรียบเทียบวันและเวลาที่เก็บโดยตรง ไม่แปลงเป็น UTC หรือบวก/ลบ offset ซ้ำ และไม่อนุมาน offset ของข้อมูลเก่าจากผลต่างเวลา
- จัดวันและชั่วโมงตาม `cdate`/`ctime`; ส่งก่อนเริ่มชั่วโมงถัดไปถือว่าทันกำหนด ตั้งแต่ชั่วโมงถัดไปถือว่าส่งย้อนหลัง เช่นตรวจวัด `2026-09-23 23:00:00` แล้วส่ง `2026-09-23 23:59:59.999` ยังทันเวลา แต่ส่ง `2026-09-24 00:00:00` เป็นข้อมูลย้อนหลังของวันที่ 23 ชั่วโมง 23 ต้องเทียบวันที่ด้วยเสมอ รวมกรณีข้ามปี
- Summary และปฏิทินของวันปัจจุบันคิดเฉพาะชั่วโมงที่จบแล้ว: เวลา `10:30` ใช้ข้อมูลถึง `09:59` ชั่วโมง 10 ไม่อยู่ทั้งตัวตั้งและตัวหาร วันย้อนหลังใช้ช่วงวันเต็มตามกติกาเดียวกัน ข้อมูลส่งช้าไม่ทำให้เปอร์เซ็นต์ส่งทันเวลาเพิ่มย้อนหลัง ตารางสถิติคง 24 แถวและวัน/ชั่วโมงของค่าต้นทางเดิมตาม contract ด้านล่าง
- หน่วยนับคือหนึ่งพารามิเตอร์ต่อหนึ่งชั่วโมง (`parameter-hour`) หลังกรอง visibility: ตัวหาร = จำนวนพารามิเตอร์ที่แสดง × จำนวนชั่วโมงที่จบแล้วซึ่งคาดว่าจะได้รับข้อมูล ชั่วโมงแรกคือ `00:00–00:59` รวม source row เวลา `00:00` ด้วย; เวลา `10:30` มี 10 ชั่วโมง (`00`–`09`) และวันย้อนหลังเต็มวันมี 24 ชั่วโมง
- เปอร์เซ็นต์ส่งทันเวลา = `round(onTimeParameterHours / expectedParameterHours * 100)`; เปอร์เซ็นต์ย้อนหลัง = `round(lateParameterHours / expectedParameterHours * 100)` ไม่ใช้ชั่วโมงปัจจุบันและไม่เฉลี่ย field completeness ต้นทางแทนหลักฐาน `udate`/`utime` พารามิเตอร์ที่ส่งต่างเวลากันจำแนกเป็นรายพารามิเตอร์
- bucket ที่ได้รับข้อมูลต้องมีค่าตัวเลขของพารามิเตอร์ที่ตรงหน่วย (รวม `0`) และวัน/เวลาส่งข้อมูลที่อ่านได้; operational status ที่ไม่มีค่าตัวเลขไม่ถือเป็น measurement bucket การนับการส่งข้อมูลแยกจากการอนุญาตนำค่าไปประเมินมลพิษ และไม่ใช้เวลาปัจจุบันทดแทน `udate`/`utime` ที่หาย/อ่านไม่ได้
- จำนวนซ้ำของพารามิเตอร์เดียวในชั่วโมงเดียวไม่เพิ่มตัวตั้งหรือตัวหาร เมื่อมีรายการที่ทันเวลาแล้ว bucket นั้นนับเป็นส่งทันเวลา และไม่นับซ้ำเป็นข้อมูลย้อนหลัง
- กรอง visibility ตามลำดับโรงงาน → จุด → พารามิเตอร์ และกรองจุดที่ยกเว้นทั้งหมด ก่อนคืนค่า/สถานะและก่อนคำนวณจำนวน เปอร์เซ็นต์ วันต่ำกว่า 80% หรือวันเกินมาตรฐาน การเรียก `stationId` โดยตรงไม่ทำให้เข้าถึงค่าที่ถูกซ่อนได้
- ค่าที่ใช้ประเมินได้และอยู่ในเกณฑ์ปกติแต่ส่งช้าคืน `lateData`; ค่าที่ถึงเกณฑ์ `warning` หรือ `exceeded` ยังคงสถานะตามเกณฑ์ ลำดับคือ `exceeded > warning > lateData > normal` ส่วนค่าที่ใช้ประเมินไม่ได้คง `insufficient`, `invalid` หรือ `noData` ตามเหตุผลเดิม
- `lateData` เป็นสถานะสำหรับการแสดงผล ไม่ใช่ source operational status ของเครื่องตรวจวัด และไม่เปลี่ยนค่า `<parameter>_status` ที่จัดเก็บไว้ Frontend ใช้สีน้ำเงินสำหรับ `lateData`
- จำนวนวันต่ำกว่า 80% เป็นช่วงต่อเนื่องล่าสุด: เริ่มที่วันสิ้นสุดที่เลือกแล้วย้อนกลับจนถึงวันแรกที่ได้อย่างน้อย 80%; ถ้าวันสิ้นสุดได้อย่างน้อย 80% คืน `0`
- ช่วงต่ำกว่า 80% ต่อเนื่องข้ามปีได้และวันไม่มี source row เป็น `0%` เมื่อมี expected data ขอบเขตเริ่มต้นใช้วันที่เก่ากว่าระหว่างวันเชื่อมต่อกับวันที่ source แรกที่มีอยู่ เพื่อไม่ให้วันเชื่อมต่อจากการเพิ่มพารามิเตอร์รอบหลังตัดประวัติเดิมทิ้ง หากมีเพียงค่าใดค่าหนึ่งให้ใช้ค่านั้น และไม่สมมติวันขาดก่อนขอบเขตที่มีหลักฐาน การนับวันเกินมาตรฐานยังเริ่ม 1 มกราคมของปีที่เลือก
- จำนวนวันเกินมาตรฐานนับวันไม่ซ้ำตั้งแต่ 1 มกราคมถึงวันสิ้นสุดที่เลือก ระดับ `warning` ไม่นับ และข้อมูลส่งช้าที่เกินมาตรฐานยังนำมาประเมินมลพิษได้
- เมื่อไม่มี expected buckets เช่นวันปัจจุบันเวลา `00:xx` หรือไม่มีพารามิเตอร์ที่แสดงผล เปอร์เซ็นต์ส่งทันเวลา/ย้อนหลังเป็น `null`, `dataCompletenessStatus` และ `display.backgroundStatus` เป็น `null`, `pollutionStatus` เป็น `insufficient` และ `lowDataDays` เป็น `0`; ไม่นับกรณีนี้เป็นข้อมูลขาด

หลักฐานของกติกาปัจจุบัน: [แผนและหลักฐานตรวจรับ handoff หน้าหลัก](../../../evidence/home/home-handoff-2026-09-23.md) หลักฐาน TDD รุ่นก่อนใน sections ด้านล่างอธิบายที่มาของ behavior เดิม แต่ไม่แทนที่กติกาหน้าหลักส่วนนี้

### `GET /api/v1/connected-measurement-points/:stationId/measurement-statistics`

คืนข้อมูลรายชั่วโมง 24 ช่วงเวลา สำหรับตารางสถิติและกราฟแนวโน้มของจุดตรวจวัด

#### Authentication And Permission

- Authentication: required
- Permission: `dashboard.stats:view`
- Data scope: `ALL`, `IN_REGION`, `IN_PROVINCE` หรือ `OWN_FACTORY`

#### Request Fields

| Field | Location | Type | Required | Description |
| --- | --- | --- | --- | --- |
| `stationId` | path | string | Yes | รหัสจุดตรวจวัด |
| `date` | query | `YYYY-MM-DD` | Yes | วันที่ตามคริสต์ศักราชที่ต้องการอ่านสถิติ |

#### Request Example

```bash
curl --request GET \
  --url '<BASE_URL>/api/v1/connected-measurement-points/SI107/measurement-statistics?date=2026-08-06' \
  --header 'Authorization: Bearer <ACCESS_TOKEN>' \
  --header 'Accept: application/json'
```

#### Success Response Fields

| Field | Type | Nullable | Description |
| --- | --- | --- | --- |
| `success` | boolean | No | `true` เมื่อสำเร็จ |
| `meta.registeredParameters` | string[] | No | พารามิเตอร์ที่ลงทะเบียน โดยชื่อ Flow จะถูก normalize เป็น `Flow Rate (m3/hr)` และไม่ซ้ำ |
| `data.summary.exceededDays` | number | No | จำนวนวันเกินมาตรฐานไม่ซ้ำของจุด ตั้งแต่ 1 มกราคมถึง `date`; หลายพารามิเตอร์เกินวันเดียวกันนับหนึ่งวัน |
| `data.summary.lowDataDays` | number | No | จำนวนวันต่ำกว่า 80% ต่อเนื่องล่าสุดของจุด ย้อนจาก `date` |
| `data.summary.todayDataCompletenessPercent` | number \| null | Yes | ร้อยละการส่งทันเวลาของจุดใน `date` โดยคิดเฉพาะช่วงที่ต้องได้รับข้อมูลแล้ว |
| `data.summary.lateDataPercent` | number \| null | Yes | ร้อยละข้อมูลที่ได้รับหลังเส้นตายของจุดใน `date` ใช้ฐาน expected data เดียวกับเปอร์เซ็นต์ส่งทันเวลา |
| `data.measurementPoints[].rows[].time` | string | No | ชั่วโมงของข้อมูล เช่น `00:00` |
| `data.measurementPoints[].rows[].dataCompletenessPercent` | number | No | ร้อยละพารามิเตอร์ที่มีค่าตัวเลขส่งทันเวลาในชั่วโมงนั้น เทียบกับพารามิเตอร์ที่แสดงผลของจุด; ไม่ใช่ตัวตัดสินว่าใช้ค่าตรวจวัดแสดงย้อนหลังได้หรือไม่ |
| `data.measurementPoints[].rows[].values` | object | No | ค่าที่วัดได้ โดย key เป็นชื่อพารามิเตอร์พร้อมหน่วย |
| `data.measurementPoints[].rows[].values["Flow Rate (m3/hr)"]` | object | No | ค่าอัตราการไหล; เป็นชื่อ Flow เพียงชื่อเดียวใน response |
| `data.measurementPoints[].rows[].values["Flow Rate (m3/hr)"].value` | number \| null | Yes | ค่าจาก source `flow_value` หน่วย `m3/hr` |
| `data.measurementPoints[].rows[].values["Flow Rate (m3/hr)"].displayValue` | string | No | ค่าที่ format สำหรับแสดงผล, ชื่อ POMS Client status เมื่อ StatusCode ไม่ใช่ `1` หรือ `-` เมื่อข้อมูลไม่เพียงพอ |
| `data.measurementPoints[].rows[].values["Flow Rate (m3/hr)"].status` | string | No | `normal`, `lateData`, `warning`, `exceeded`, `insufficient`, `noData` หรือ `invalid`; operational status ใช้ `invalid` เพื่อไม่ให้ client นำไปวาดเป็นค่าตรวจวัด |

#### Success Response Example

```json
{
  "success": true,
  "data": {
    "measurementPoints": [
      {
        "stationId": "SI107",
        "date": "2026-08-06",
        "rows": [
          {
            "time": "00:00",
            "dataCompletenessPercent": 100,
            "values": {
              "Flow Rate (m3/hr)": {
                "value": 80778.038394,
                "displayValue": "80,778.04",
                "status": "exceeded"
              }
            }
          }
        ]
      }
    ],
    "summary": {
      "exceededDays": 1,
      "lowDataDays": 0,
      "todayDataCompletenessPercent": 100,
      "lateDataPercent": 0
    }
  }
}
```

#### Validation And Business Rules

- ชื่อที่ลงทะเบียนเป็น `Flow`, `Flow Rate (m3/hr)` หรือ `Flow Rate (m³/hr)` จะอ่านจาก source `flow_value` เดียวกัน และคืนเป็น key มาตรฐาน `Flow Rate (m3/hr)` เพียงหนึ่ง key
- ชั่วโมงและค่าที่แสดงจัดตาม `ctime` เดิม ข้อมูลส่งช้าต้องยังอยู่ในชั่วโมงต้นทาง พร้อมสถานะตาม [กติกาหน้าหลัก](#home-measurement-rules) ไม่ย้ายไปชั่วโมงที่ `utime` มาถึง
- ตารางคง 24 แถวรายชั่วโมงตาม `date`; การตัดชั่วโมงปัจจุบันออกใช้กับ summary/daily expected data ไม่เปลี่ยนวัน/ชั่วโมงของค่าที่มีอยู่ในตาราง
- เมื่อ completeness ที่ต้นทางระบุสำหรับค่าพารามิเตอร์ต่ำกว่า 80% จะคืน `value: null`, `displayValue: "-"` และ `status: "insufficient"`; เปอร์เซ็นต์ส่งทันเวลาที่ต่ำเพราะ row มาช้าไม่ทำให้ค่าที่ใช้ได้ถูกซ่อน จึงยังแสดง `lateData`, `warning` หรือ `exceeded` ได้
- เมื่อ POMS Client status ไม่ใช่ `1`, `Ok` หรือ `Normal` จะคืน `value: null`, ใช้ชื่อสถานะใน `displayValue` และไม่ใช้ค่าต้นทางคำนวณกราฟ เช่น StatusCode `6` คืน `displayValue: "Shut Down"`; StatusCode `9` คืน `displayValue: "No Discharge"`. ดู [StatusCode contract](../../menus/connection-requests/parameter-values.md#statuscode-contract)

#### Errors

| HTTP status | Condition | Client action |
| --- | --- | --- |
| `400 Bad Request` | `stationId` หรือ `date` ไม่ผ่าน validation | ตรวจรูปแบบ path และ query string |
| `401 Unauthorized` | ไม่มี bearer token ที่ถูกต้อง | login ใหม่ |
| `403 Forbidden` | ไม่มี permission หรือจุดตรวจวัดอยู่นอก data scope | ซ่อนข้อมูลหรือแจ้งสิทธิ์ไม่เพียงพอ |
| `404 Not Found` | ไม่พบจุดตรวจวัด/ตารางข้อมูล หรือจุดถูกซ่อน อยู่ภายใต้โรงงานที่ซ่อน หรือได้รับยกเว้นทั้งหมด | ตรวจรหัสและสถานะการแสดงผลของจุด |

### `GET /api/v1/connected-measurement-points/:stationId/calendar-status`

คืนสถานะรายวันของปฏิทินเฉพาะเดือนที่เลือกถึงวันสิ้นสุดที่ใช้คำนวณ `monthlySummary[].exceededDays` สะสมจากต้นปีถึงวันสิ้นสุด และ `monthlySummary[].lowDataDays` เป็นช่วงต่ำกว่า 80% ต่อเนื่องล่าสุดที่สิ้นสุดวันเดียวกัน

#### Authentication And Permission

- Authentication: required
- Permission: `dashboard.stats:view`
- Data scope: `ALL`, `IN_REGION`, `IN_PROVINCE` หรือ `OWN_FACTORY`

#### Request Fields

| Field | Location | Type | Required | Description |
| --- | --- | --- | --- | --- |
| `stationId` | path | string | Yes | รหัส connected measurement point ที่อยู่ใน data scope ของผู้เรียก |
| `month` | query | `YYYY-MM` | Yes | เดือนตามคริสต์ศักราช เช่น `2025-08`; เดือนต้องอยู่ระหว่าง `01` ถึง `12` |
| `endDate` | query | `YYYY-MM-DD` | No | วันสิ้นสุดที่เลือก ต้องเป็นวันที่จริงใน `month` ที่ขอและไม่เกินวันนี้ตาม `Asia/Bangkok`; ถ้าไม่ส่ง ใช้วันสิ้นเดือนหรือวันนี้ แล้วแต่ว่าวันใดถึงก่อน |

#### Request Example

```bash
curl --request GET \
  --url '<BASE_URL>/api/v1/connected-measurement-points/S1125/calendar-status?month=2025-08&endDate=2025-08-10' \
  --header 'Authorization: Bearer <ACCESS_TOKEN>' \
  --header 'Accept: application/json'
```

#### Success Response Fields

| Field | Type | Nullable | Description |
| --- | --- | --- | --- |
| `success` | boolean | No | `true` เมื่อสำเร็จ |
| `data.metadata.description` | string | No | คำอธิบายชุดข้อมูล calendar status |
| `data.metadata.month` | string | No | เดือนเดียวกับ query ในรูปแบบ `YYYY-MM` |
| `data.metadata.endDate` | string | No | วันสิ้นสุดที่ใช้คำนวณจริงในรูปแบบ `YYYY-MM-DD`; ส่งวันนี้ได้แม้เดือนที่ขอเป็นเดือนอนาคตเมื่อไม่ระบุ `endDate` |
| `data.metadata.valueDefinitions` | object | No | คำอธิบายความหมายของ calendar statuses |
| `data.factory` | object | No | โรงงาน current/live ของจุดตรวจวัดที่เลือก |
| `data.factory.factoryId` | string | No | รหัสโรงงาน current/live |
| `data.factory.factoryName` | string | No | ชื่อโรงงาน current/live |
| `data.factory.systemType` | string | No | ประเภทระบบของจุด เช่น `CEMS` หรือ `WPMS` |
| `data.calendar.year` | number | No | ปีคริสต์ศักราชจาก `month` |
| `data.calendar.month` | number | No | เลขเดือน `1` ถึง `12` จาก `month` |
| `data.calendar.days` | object[] | No | สถานะรายวันในเดือนที่เลือกถึง `endDate` เรียงเก่าไปใหม่ รวมวันไม่มี source row ที่มี expected data; ไม่สร้างวันขาดก่อนวันเริ่มคาดหวังข้อมูลหรือหลังวันนี้ |
| `data.calendar.days[].date` | string | No | วันที่ในรูปแบบ `YYYY-MM-DD` |
| `data.calendar.days[].dataCompletenessPercent` | number \| null | Yes | ร้อยละข้อมูลที่ส่งตามกำหนดรายวัน; วันปัจจุบันคำนวณเฉพาะชั่วโมงที่จบแล้วตาม `Asia/Bangkok` โดยไม่รวมชั่วโมงปัจจุบัน; `null` เมื่อไม่มี expected buckets |
| `data.calendar.days[].lateDataPercent` | number \| null | Yes | ร้อยละข้อมูลย้อนหลังของวันนั้น ใช้ expected data ชุดเดียวกับ `dataCompletenessPercent` และไม่รวมรายการส่งทันเวลา; `null` เมื่อไม่มี expected buckets |
| `data.calendar.days[].dataCompletenessStatus` | `lowData` \| `highData` \| null | Yes | `lowData` เมื่อต่ำกว่า 80%; มิฉะนั้นเป็น `highData`; `null` เมื่อไม่มี expected buckets |
| `data.calendar.days[].pollutionStatus` | `normal` \| `lateData` \| `warning` \| `exceeded` \| `insufficient` | No | สถานะมลพิษรายวันสำหรับเส้นขอบปฏิทิน คำนวณเฉพาะค่าที่ source status เป็น `Normal`, `Ok` หรือ code `1` และเป็นอิสระจาก `dataCompletenessStatus` |
| `data.calendar.days[].display.backgroundStatus` | `lowData` \| `highData` \| null | Yes | สถานะพื้นหลังเดียวกับ `dataCompletenessStatus`; ใช้แสดงความครบถ้วนของข้อมูลเท่านั้น |
| `data.calendar.days[].display.borderStatus` | `normal` \| `lateData` \| `warning` \| `exceeded` \| `insufficient` | No | สถานะเส้นขอบเดียวกับ `pollutionStatus`; วันที่เป็น `lowData` ยังมีเส้นขอบ `normal`, `lateData`, `warning` หรือ `exceeded` ได้ |
| `data.summary.exceededDays` | number | No | จำนวนวันเกินมาตรฐานไม่ซ้ำของจุด ตั้งแต่ 1 มกราคมถึง `endDate`; หลายพารามิเตอร์เกินในวันเดียวกันนับหนึ่งวัน ห้ามรวม `monthlySummary[].exceededDays` แทน |
| `data.summary.lowDataDays` | number | No | จำนวนวันต่ำกว่า 80% ต่อเนื่องล่าสุดของจุด โดยย้อนจาก `endDate` |
| `data.summary.todayDataCompletenessPercent` | number \| null | Yes | ร้อยละการส่งทันเวลาของจุด ณ `endDate`; ชื่อ field คงใช้คำว่า `today` แม้เลือกวันย้อนหลัง |
| `data.summary.lateDataPercent` | number \| null | Yes | ร้อยละข้อมูลย้อนหลังของจุด ณ `endDate` ใช้ expected data ชุดเดียวกับเปอร์เซ็นต์ส่งทันเวลา |
| `data.monthlySummary` | object[] | No | สรุปพารามิเตอร์ที่แสดงผลถึงวันสิ้นสุดที่เลือก; ชื่อ field คงเดิมเพื่อ compatibility |
| `data.monthlySummary[].parameterCode` | string | No | รหัสพารามิเตอร์แบบ machine-stable |
| `data.monthlySummary[].parameterName` | string | No | ชื่อพารามิเตอร์ |
| `data.monthlySummary[].parameterLabel` | string | No | ชื่อแสดงผลพร้อมหน่วย เช่น `CO (ppm)`; client ใช้ label นี้ในตารางและ dialog |
| `data.monthlySummary[].unit` | string | No | หน่วยของพารามิเตอร์ เช่น `ppm` |
| `data.monthlySummary[].exceededDays` | number | No | จำนวนวันของพารามิเตอร์นั้นที่มีค่า source status ปกติและประเมินเป็น `exceeded` ตั้งแต่ 1 มกราคมถึง `endDate` รวมวันที่เป็น `lowData`; วันเดียวกันนับสูงสุดหนึ่งครั้ง |
| `data.monthlySummary[].lowDataDays` | number | No | จำนวนวันต่ำกว่า 80% ต่อเนื่องล่าสุด โดยเริ่มจาก `endDate` และหยุดเมื่อถึงวันที่ได้อย่างน้อย 80% |
| `data.monthlySummary[].todayDataCompletenessPercent` | number | Yes | ร้อยละข้อมูลส่งทันเวลาของพารามิเตอร์ ณ `endDate`; ชื่อ field คงใช้คำว่า `today` แม้เลือกวันย้อนหลัง |
| `data.monthlySummary[].lateDataPercent` | number \| null | Yes | ร้อยละข้อมูลย้อนหลังของพารามิเตอร์ ณ `endDate`; denominator เป็นชั่วโมงที่คาดว่าจะได้รับของพารามิเตอร์นั้น |
| `meta.stationId` | string | No | รหัสจุดตรวจวัดที่อ่านข้อมูล |
| `meta.interval` | `60m` | No | ตารางข้อมูลรายชั่วโมงที่ใช้ |
| `meta.schemaName` | string | No | schema ของ parameter source database |
| `meta.tableName` | string | No | ตาราง `{stationId}_data_60m` ที่ใช้ |
| `meta.month` | string | No | เดือนเดียวกับ query ในรูปแบบ `YYYY-MM` |
| `meta.endDate` | string | No | วันสิ้นสุดเดียวกับ `data.metadata.endDate` |
| `meta.count` | number | No | จำนวน source rows รายชั่วโมงที่ repository คืนสำหรับช่วงที่อ่านใน request นี้ |
| `meta.registeredParameters` | string[] | No | พารามิเตอร์ที่ลงทะเบียน โดยชื่อที่อ่านได้ต้องมีหน่วยเมื่อ source ระบุได้ |

#### Success Response Example

```json
{
  "success": true,
  "data": {
    "metadata": {
      "description": "DateCalendar รายเดือนและตารางสรุปสถานะของปีที่เลือก",
      "month": "2025-08",
      "valueDefinitions": {
        "summaryPeriod": "calendar.days แสดงเดือนที่ขอถึง endDate; exceededDays สะสมตั้งแต่ต้นปี ส่วน lowDataDays เป็นช่วงต่ำกว่า 80% ต่อเนื่องล่าสุดที่สิ้นสุด ณ endDate",
        "dataCompletenessStatus": {
          "lowData": "ส่งข้อมูลน้อยกว่า 80% ใช้พื้นหลังสีเทาโดยไม่บังคับสถานะเส้นขอบ",
          "highData": "ส่งข้อมูลมากกว่าหรือเท่ากับ 80% ใช้พื้นหลังสีฟ้า"
        },
        "pollutionStatus": {
          "normal": "ข้อมูลที่ source status เป็น Normal, Ok หรือ code 1 อยู่ในเกณฑ์ปกติ ใช้เส้นขอบสีเขียว",
          "warning": "ข้อมูลที่ source status เป็น Normal, Ok หรือ code 1 อยู่ในเกณฑ์เฝ้าระวัง ใช้เส้นขอบสีส้ม",
          "exceeded": "ข้อมูลที่ source status เป็น Normal, Ok หรือ code 1 เกินมาตรฐาน ใช้เส้นขอบสีแดง",
          "insufficient": "ไม่มีค่าจาก source status Normal, Ok หรือ code 1 ที่ใช้ประเมินได้ หรือมีเฉพาะค่าราย row ที่ความครบถ้วนต่ำกว่า 80%",
          "lateData": "ค่าปกติที่ส่งหลังเส้นตาย ใช้เส้นขอบสีน้ำเงิน; warning และ exceeded มีลำดับสูงกว่า"
        }
      },
      "endDate": "2025-08-10"
    },
    "factory": {
      "factoryId": "10120000325542",
      "factoryName": "บริษัท ตัวอย่าง จำกัด",
      "systemType": "CEMS"
    },
    "calendar": {
      "year": 2025,
      "month": 8,
      "days": [
        {
          "date": "2025-08-09",
          "dataCompletenessPercent": 83,
          "dataCompletenessStatus": "highData",
          "pollutionStatus": "exceeded",
          "display": {
            "backgroundStatus": "highData",
            "borderStatus": "exceeded"
          },
          "lateDataPercent": 0
        },
        {
          "date": "2025-08-10",
          "dataCompletenessPercent": 42,
          "dataCompletenessStatus": "lowData",
          "pollutionStatus": "exceeded",
          "display": {
            "backgroundStatus": "lowData",
            "borderStatus": "exceeded"
          },
          "lateDataPercent": 0
        }
      ]
    },
    "monthlySummary": [
      {
        "parameterCode": "CO",
        "parameterName": "CO",
        "parameterLabel": "CO (ppm)",
        "unit": "ppm",
        "exceededDays": 2,
        "lowDataDays": 1,
        "todayDataCompletenessPercent": 42,
        "lateDataPercent": 0
      }
    ],
    "summary": {
      "exceededDays": 2,
      "lowDataDays": 1,
      "todayDataCompletenessPercent": 42,
      "lateDataPercent": 0
    }
  },
  "meta": {
    "stationId": "S1125",
    "interval": "60m",
    "schemaName": "ingest",
    "tableName": "S1125_data_60m",
    "month": "2025-08",
    "count": 60,
    "registeredParameters": [
      "CO (ppm)"
    ],
    "endDate": "2025-08-10"
  }
}
```

#### Validation And Business Rules

- `month=2025-08&endDate=2025-08-10` นับวันเกินมาตรฐานตั้งแต่ `2025-01-01` ถึง `2025-08-10` และอ่านข้อมูลก่อนต้นปีได้เมื่อใช้หาช่วงต่ำกว่า 80% ต่อเนื่อง; ถ้าไม่ส่ง `endDate` ใช้วันที่น้อยกว่าระหว่างวันนี้ตาม `Asia/Bangkok` กับวันสุดท้ายของเดือน
- `data.calendar.days` กรองเฉพาะเดือนที่ขอและไม่เกิน `endDate`; การขอเดือนอนาคตโดยไม่ระบุ `endDate` ยังคงทำได้ แต่ไม่สร้างวันอนาคตเป็นวันที่ข้อมูลขาด
- `monthlySummary[].exceededDays` สะสมรายพารามิเตอร์จากต้นปีถึง `endDate`; `data.summary.exceededDays` นับวันไม่ซ้ำรวมทุกพารามิเตอร์ในช่วงเดียวกัน จึงไม่ใช่ผลบวกของ counters รายพารามิเตอร์
- `data.calendar.days[].pollutionStatus` และ `monthlySummary[].exceededDays` ประเมินเฉพาะค่าของพารามิเตอร์ที่ source row มี `<parameter>_status` เป็น `Normal`, `Ok` หรือ code `1`; `null`, ค่าว่าง, สถานะที่ไม่รู้จัก, `Calibration`, `Defective`, `Maintenance`, `Start up`, `Shut Down`, `Turnaround`, `Etc.` และ `No Discharge` ไม่ถูกนำไปเทียบเกณฑ์
- กฎ source status ข้างต้นใช้สถานะของค่าตรวจวัดแต่ละ row ไม่ใช่ `channelStatus` จาก device config
- `dataCompletenessStatus` กับ `pollutionStatus` คำนวณแยกกัน: `lowData` ใช้กำหนดพื้นหลังและ `lowDataDays` เท่านั้น ส่วนค่าที่ประเมินได้จาก source status ปกติยังกำหนดเส้นขอบเป็น `normal`, `lateData`, `warning` หรือ `exceeded` ตาม precedence ใน [กติกาหน้าหลัก](#home-measurement-rules)
- `insufficient` ใช้เมื่อวันนั้นไม่มีค่าตัวเลขจาก source status ปกติให้ประเมิน หรือมีเฉพาะค่าที่ใช้ไม่ได้เพราะความครบถ้วนระดับ row ต่ำกว่า 80%; การเป็น `lowData` ระดับวันเพียงอย่างเดียวไม่ทำให้เป็น `insufficient`
- `exceededDays` แยกตามพารามิเตอร์และใช้เกณฑ์ของ connected point หลังกรอง source status; วันเดียวกันนับได้สูงสุดหนึ่งวันต่อพารามิเตอร์ และยังนับเมื่อวันนั้นเป็น `lowData`
- `lowDataDays` ย้อนจาก `endDate` จนถึงวันแรกที่ได้อย่างน้อย 80%; หาก `endDate` ได้อย่างน้อย 80% คืน `0` วันเดียวกันอาจอยู่ในช่วง `lowDataDays` และเป็นวัน `exceededDays` ด้วย
- วันปัจจุบันอ้างอิง `Asia/Bangkok` และใช้เฉพาะชั่วโมงที่จบแล้ว เช่นเวลา `10:25` ชั่วโมงล่าสุดคือ `09:00–09:59`; ชั่วโมงปัจจุบันไม่อยู่ทั้งตัวตั้งและตัวหาร
- `todayDataCompletenessPercent` ใช้วันที่ `endDate` ไม่ fallback ไปวันที่มีข้อมูลล่าสุด จึงไม่ทำให้วันที่ขาดข้อมูลหายไปจากผลสรุป
- ชื่อพารามิเตอร์ที่อ่านได้ต้องคืนพร้อม `unit`; client ใช้ `parameterCode` เมื่อต้องการ key ที่คงที่
- หลักฐาน TDD: [Calendar summary requested-year counts](../../../evidence/shared/calendar-summary-requested-year-counts.tdd.md)
- หลักฐาน TDD: [Calendar Normal-status filter](../../../evidence/shared/calendar-normal-status-filter.tdd.md)
- หลักฐาน TDD: [Calendar current-day completeness](../../../evidence/shared/calendar-current-day-completeness.tdd.md)

#### Errors

| HTTP status | Code | Condition | Client action |
| --- | --- | --- | --- |
| `400 Bad Request` | `VALIDATION_ERROR` | `stationId`, `month` หรือ `endDate` ไม่ผ่าน validation; `endDate` อยู่นอกเดือนที่ขอหรือเป็นวันอนาคต | ตรวจรูปแบบ path และวันสิ้นสุด |
| `401 Unauthorized` | `UNAUTHORIZED` | ไม่มี bearer token ที่ถูกต้อง | login ใหม่ |
| `403 Forbidden` | `FORBIDDEN` | ไม่มี `dashboard.stats:view` หรือจุดตรวจวัดอยู่นอก data scope | ซ่อนข้อมูลหรือแจ้งสิทธิ์ไม่เพียงพอ |
| `404 Not Found` | `NOT_FOUND` | ไม่พบจุดตรวจวัด/ตาราง `{stationId}_data_60m` หรือจุดถูกซ่อน อยู่ภายใต้โรงงานที่ซ่อน หรือได้รับยกเว้นทั้งหมด | ตรวจรหัสจุดตรวจวัดและสถานะการแสดงผล |

### `GET /api/v1/connected-measurement-points/:stationId/calendar-status/details`

คืนรายละเอียดสำหรับ dialog เมื่อ frontend คลิกจำนวนวัน `exceededDays` หรือ `lowDataDays` ใน `monthlySummary` โดยใช้วันสิ้นสุดเดียวกับปฏิทิน `exceeded` คืนวันเกินมาตรฐานสะสมตั้งแต่ต้นปี ส่วน `lowData` คืนเฉพาะช่วงต่ำกว่า 80% ต่อเนื่องล่าสุดซึ่งอาจข้ามปี ไม่มี pagination; frontend ใช้ scroll และ sticky header เมื่อรายการยาว

#### Authentication And Permission

- Authentication: required
- Permission: `dashboard.stats:view`
- Data scope: `ALL`, `IN_REGION`, `IN_PROVINCE` หรือ `OWN_FACTORY`

#### Request Fields

| Field | Location | Type | Required | Description |
| --- | --- | --- | --- | --- |
| `stationId` | path | string | Yes | รหัส connected measurement point ที่อยู่ใน data scope ของผู้เรียก |
| `year` | query | `YYYY` | Yes | ปีคริสต์ศักราช เช่น `2025`; ค่า `month` ไม่รองรับใน endpoint นี้ |
| `endDate` | query | `YYYY-MM-DD` | No | วันสิ้นสุด ต้องเป็นวันที่จริงใน `year` ที่ขอและไม่เกินวันนี้ตาม `Asia/Bangkok`; default วันที่น้อยกว่าระหว่างวันนี้กับวันสิ้นปี ต้องส่งวันเดียวกับ calendar เพื่อให้จำนวนแถวตรงกับ counter ที่คลิก |
| `summaryType` | query | `exceeded` \| `lowData` | Yes | `exceeded` สำหรับรายละเอียดค่าที่เกินมาตรฐาน หรือ `lowData` สำหรับรายละเอียดวันที่ข้อมูลต่ำกว่า 80% |
| `parameterCode` | query | string | Yes | รหัสจาก `calendar-status.data.monthlySummary[].parameterCode` |
| `unit` | query | string | No | หน่วยจาก `monthlySummary[].unit`; ควรส่งทุกครั้งและต้องส่งเมื่อ `parameterCode` เดียวกันมีหลายหน่วย |

#### Request Examples

รายละเอียดค่าที่เกินมาตรฐาน:

```bash
curl --get \
  --url '<BASE_URL>/api/v1/connected-measurement-points/S1125/calendar-status/details' \
  --header 'Authorization: Bearer <ACCESS_TOKEN>' \
  --header 'Accept: application/json' \
  --data-urlencode 'year=2025' \
  --data-urlencode 'endDate=2025-08-10' \
  --data-urlencode 'summaryType=exceeded' \
  --data-urlencode 'parameterCode=CO' \
  --data-urlencode 'unit=ppm'
```

รายละเอียดข้อมูลไม่ถึง:

```bash
curl --get \
  --url '<BASE_URL>/api/v1/connected-measurement-points/S1125/calendar-status/details' \
  --header 'Authorization: Bearer <ACCESS_TOKEN>' \
  --header 'Accept: application/json' \
  --data-urlencode 'year=2025' \
  --data-urlencode 'endDate=2025-08-10' \
  --data-urlencode 'summaryType=lowData' \
  --data-urlencode 'parameterCode=CO' \
  --data-urlencode 'unit=ppm'
```

#### Success Response Fields

| Field | Type | Nullable | Description |
| --- | --- | --- | --- |
| `success` | boolean | No | `true` เมื่อสำเร็จ |
| `data.metadata.description` | string | No | คำอธิบายชุดข้อมูล detail |
| `data.metadata.year` | number | No | ปีเดียวกับ query |
| `data.metadata.endDate` | string | No | วันสิ้นสุดที่ใช้คำนวณจริงในรูปแบบ `YYYY-MM-DD` |
| `data.metadata.summaryType` | `exceeded` \| `lowData` | No | ประเภท drill-down ที่ร้องขอ |
| `data.metadata.valueDefinitions` | object | No | คำอธิบาย semantics ของ detail fields |
| `data.factory` | object | No | โรงงาน current/live ของจุดตรวจวัดที่เลือก |
| `data.factory.factoryId` | string | No | รหัสโรงงาน current/live; เป็น string ว่างเมื่อ source ไม่มีค่า |
| `data.factory.factoryName` | string | No | ชื่อโรงงาน current/live; เป็น string ว่างเมื่อ source ไม่มีค่า |
| `data.factory.systemType` | string | No | ประเภทระบบของจุดตรวจวัด เช่น `CEMS` หรือ `WPMS` |
| `data.parameter.parameterCode` | string | No | รหัสพารามิเตอร์ที่เลือก |
| `data.parameter.parameterName` | string | No | ชื่อพารามิเตอร์ |
| `data.parameter.parameterLabel` | string | No | ชื่อสำหรับแสดงผลพร้อมหน่วย เช่น `CO (ppm)` |
| `data.parameter.unit` | string | No | หน่วยของค่าที่วัดและค่าเกณฑ์ |
| `data.parameter.exceededStandard.value` | number | No | ค่าเกณฑ์ที่ใช้ตัดสิน `exceeded` |
| `data.parameter.exceededStandard.displayValue` | string | No | ค่าเกณฑ์ที่ format แล้ว |
| `data.parameter.exceededStandard.operator` | `>` \| `>=` | No | ตัวดำเนินการของเกณฑ์; criteria ระดับ critical ใช้ `>=` |
| `data.summary.affectedDays` | number | No | จำนวนสมาชิกใน `data.rows`; วันเดียวกันมีได้สูงสุดหนึ่งแถว |
| `data.rows` | object[] | No | แถวรายวันที่ตรงกับ `summaryType` เรียงวันที่จากเก่าไปใหม่; ไม่มี pagination |
| `data.rows[].date` | `YYYY-MM-DD` | No | วันที่เกิดเหตุ; มีในทั้งสอง `summaryType` |
| `data.rows[].time` | `HH:mm:ss` | Omitted for `lowData` | เวลาจริงของค่าแรกที่เกินมาตรฐานในวันนั้น หลัง normalize แล้ว |
| `data.rows[].displayTime` | string | Omitted for `lowData` | ช่วงชั่วโมงสำหรับแสดงผล เช่น `01.00-01.59 น.` |
| `data.rows[].value` | number | Omitted for `lowData` | ค่าตรวจวัด source status ปกติรายการแรกของวันที่เกินมาตรฐาน หน่วยเดียวกับ `data.parameter.unit` |
| `data.rows[].displayValue` | string | Omitted for `lowData` | ค่าตรวจวัดซึ่ง format แล้ว |
| `data.rows[].standardValue` | number | Omitted for `lowData` | ค่าเกณฑ์ที่ใช้เปรียบเทียบ |
| `data.rows[].displayStandardValue` | string | Omitted for `lowData` | ค่าเกณฑ์ซึ่ง format แล้ว |
| `data.rows[].exceededBy` | number | Omitted for `lowData` | ผลต่าง `value - standardValue`; ต่ำสุดเป็น `0` สำหรับเกณฑ์ `>=` |
| `data.rows[].displayExceededBy` | string | Omitted for `lowData` | ผลต่างจากเกณฑ์ซึ่ง format แล้ว |
| `data.rows[].dataCompletenessPercent` | number | Omitted for `exceeded` | ร้อยละการส่งข้อมูลของวันนั้น; คืนเฉพาะ `summaryType=lowData` และต้องต่ำกว่า 80 |
| `meta.stationId` | string | No | รหัสจุดตรวจวัด |
| `meta.interval` | `60m` | No | ตารางรายชั่วโมงที่ใช้ |
| `meta.schemaName` | string | No | schema ของ parameter source database |
| `meta.tableName` | string | No | ตาราง `{stationId}_data_60m` ที่ใช้ |
| `meta.year` | string | No | ปีเดียวกับ query ในรูปแบบ `YYYY` |
| `meta.endDate` | string | No | วันสิ้นสุดเดียวกับ `data.metadata.endDate` |
| `meta.count` | number | No | จำนวน source rows รายชั่วโมงที่อ่านเพื่อคำนวณ รวมช่วงก่อนต้นปีเมื่อใช้พิสูจน์ low-data streak |
| `meta.registeredParameters` | string[] | No | พารามิเตอร์ที่ลงทะเบียนพร้อมหน่วยเมื่อมี |

#### Success Response Example: `summaryType=exceeded`

```json
{
  "success": true,
  "data": {
    "metadata": {
      "description": "รายละเอียดรายวันที่ใช้คำนวณตารางสรุปสถานะของปีที่เลือก",
      "year": 2025,
      "summaryType": "exceeded",
      "valueDefinitions": {
        "summaryType": {
          "exceeded": "คืนหนึ่งแถวต่อวันที่เกินมาตรฐาน โดยเลือกข้อมูล source status Normal, Ok หรือ code 1 รายการแรกที่เกินตามเวลา รวมวันที่มีความครบถ้วนรายวันต่ำกว่า 80%",
          "lowData": "คืนหนึ่งแถวต่อวันในช่วงต่ำกว่า 80% ต่อเนื่องล่าสุดที่สิ้นสุด ณ endDate โดยไม่คืนเวลา"
        },
        "rows": "เรียงวันที่จากเก่าไปใหม่และมีได้สูงสุดหนึ่งแถวต่อวัน; exceeded จำกัดปีที่ขอ ส่วน lowData ต่อเนื่องข้ามปีได้",
        "displayTime": "ช่วงชั่วโมงของค่าที่เกินมาตรฐานรายการแรก เช่น 01.00-01.59 น.",
        "value": "ค่าตรวจวัด source status Normal, Ok หรือ code 1 รายการแรกของวันที่เกินมาตรฐาน",
        "dataCompletenessPercent": "ร้อยละความครบถ้วนรายวันที่ใช้ตัดสิน lowData"
      },
      "endDate": "2025-08-10"
    },
    "factory": {
      "factoryId": "10120000325542",
      "factoryName": "บริษัท ตัวอย่าง จำกัด",
      "systemType": "CEMS"
    },
    "parameter": {
      "parameterCode": "CO",
      "parameterName": "CO",
      "parameterLabel": "CO (ppm)",
      "unit": "ppm",
      "exceededStandard": {
        "value": 100,
        "displayValue": "100.00",
        "operator": ">="
      }
    },
    "summary": {
      "affectedDays": 2
    },
    "rows": [
      {
        "date": "2025-08-09",
        "time": "01:15:00",
        "displayTime": "01.00-01.59 น.",
        "value": 110,
        "displayValue": "110.00",
        "standardValue": 100,
        "displayStandardValue": "100.00",
        "exceededBy": 10,
        "displayExceededBy": "10.00"
      },
      {
        "date": "2025-08-10",
        "time": "02:00:00",
        "displayTime": "02.00-02.59 น.",
        "value": 115,
        "displayValue": "115.00",
        "standardValue": 100,
        "displayStandardValue": "100.00",
        "exceededBy": 15,
        "displayExceededBy": "15.00"
      }
    ]
  },
  "meta": {
    "stationId": "S1125",
    "interval": "60m",
    "schemaName": "ingest",
    "tableName": "S1125_data_60m",
    "year": "2025",
    "count": 60,
    "registeredParameters": [
      "CO (ppm)"
    ],
    "endDate": "2025-08-10"
  }
}
```

#### Success Response Example: `summaryType=lowData`

```json
{
  "success": true,
  "data": {
    "metadata": {
      "description": "รายละเอียดรายวันที่ใช้คำนวณตารางสรุปสถานะของปีที่เลือก",
      "year": 2025,
      "summaryType": "lowData",
      "valueDefinitions": {
        "summaryType": {
          "exceeded": "คืนหนึ่งแถวต่อวันที่เกินมาตรฐาน โดยเลือกข้อมูล source status Normal, Ok หรือ code 1 รายการแรกที่เกินตามเวลา รวมวันที่มีความครบถ้วนรายวันต่ำกว่า 80%",
          "lowData": "คืนหนึ่งแถวต่อวันในช่วงต่ำกว่า 80% ต่อเนื่องล่าสุดที่สิ้นสุด ณ endDate โดยไม่คืนเวลา"
        },
        "rows": "เรียงวันที่จากเก่าไปใหม่และมีได้สูงสุดหนึ่งแถวต่อวัน; exceeded จำกัดปีที่ขอ ส่วน lowData ต่อเนื่องข้ามปีได้",
        "displayTime": "ช่วงชั่วโมงของค่าที่เกินมาตรฐานรายการแรก เช่น 01.00-01.59 น.",
        "value": "ค่าตรวจวัด source status Normal, Ok หรือ code 1 รายการแรกของวันที่เกินมาตรฐาน",
        "dataCompletenessPercent": "ร้อยละความครบถ้วนรายวันที่ใช้ตัดสิน lowData"
      },
      "endDate": "2025-08-10"
    },
    "factory": {
      "factoryId": "10120000325542",
      "factoryName": "บริษัท ตัวอย่าง จำกัด",
      "systemType": "CEMS"
    },
    "parameter": {
      "parameterCode": "CO",
      "parameterName": "CO",
      "parameterLabel": "CO (ppm)",
      "unit": "ppm",
      "exceededStandard": {
        "value": 100,
        "displayValue": "100.00",
        "operator": ">="
      }
    },
    "summary": {
      "affectedDays": 1
    },
    "rows": [
      {
        "date": "2025-08-10",
        "dataCompletenessPercent": 42
      }
    ]
  },
  "meta": {
    "stationId": "S1125",
    "interval": "60m",
    "schemaName": "ingest",
    "tableName": "S1125_data_60m",
    "year": "2025",
    "count": 60,
    "registeredParameters": [
      "CO (ppm)"
    ],
    "endDate": "2025-08-10"
  }
}
```

#### Validation And Business Rules

- `summaryType=exceeded` จำกัดวันตั้งแต่ `YYYY-01-01` ถึง `endDate`; `summaryType=lowData` อาจอ่านย้อนหลังข้ามปีเพื่อหาต้นช่วงต่อเนื่องตาม [ขอบเขต expected data](#home-measurement-rules) เมื่อไม่ส่งวันสิ้นสุดใช้วันที่น้อยกว่าระหว่างวันนี้ตาม `Asia/Bangkok` กับวันสิ้นปี
- `rows` เรียงวันที่จากเก่าไปใหม่และมีได้สูงสุดหนึ่งแถวต่อวัน โดย low-data rows รวมวันไม่มี source row แต่มี expected data
- `summaryType=exceeded` ใช้กฎ source status เดียวกับ `monthlySummary[].exceededDays` และเลือกเฉพาะค่าที่ source status ปกติซึ่งประเมินเป็น `exceeded` รายการแรกตาม `ctime` ของแต่ละวัน เวลา normalize เป็น `HH:mm:ss` และ `displayTime` เป็นช่วง `HH.00-HH.59 น.`; วันที่เป็น `lowData` ต้องยังอยู่ในผลลัพธ์เมื่อมีค่าที่เกินและใช้ประเมินได้
- ค่าเกณฑ์ใช้ `critical.min` และ operator `>=` เมื่อ connected point มี criteria; ถ้าไม่มี critical threshold จะ fallback ไป `warningMax` และ operator `>` ตาม status logic เดิม
- `summaryType=lowData` คืนเฉพาะ `date` และ `dataCompletenessPercent` ของช่วงวันที่ต่ำกว่า 80% ต่อเนื่องล่าสุดที่สิ้นสุด ณ `endDate` ตามกฎเดียวกับ `monthlySummary[].lowDataDays`; object จะไม่มี `time` หรือ `displayTime`
- วันเดียวกันอาจอยู่ในทั้ง `summaryType=exceeded` และ `summaryType=lowData` เพราะสถานะมลพิษกับความครบถ้วนของข้อมูลเป็นคนละมิติ เมื่อส่ง `endDate` เดียวกับ calendar แล้ว `data.summary.affectedDays` ของแต่ละประเภทต้องตรงกับ counter รายพารามิเตอร์ที่เกี่ยวข้องใน `monthlySummary`
- ถ้า `parameterCode` ตรงกับหลายพารามิเตอร์ต่างหน่วย ต้องส่ง `unit`; client ควรส่ง `parameterCode` และ `unit` จาก monthly summary เดียวกันเสมอ
- response ไม่มี pagination; dialog ฝั่ง frontend ควรใช้พื้นที่ scroll และ sticky header เมื่อรายการยาว
- หลักฐาน TDD: [Calendar status details](../../../evidence/shared/calendar-status-details.tdd.md)
- หลักฐาน TDD: [Calendar Normal-status filter](../../../evidence/shared/calendar-normal-status-filter.tdd.md)

#### Errors

| HTTP status | Code | Condition | Client action |
| --- | --- | --- | --- |
| `400 Bad Request` | `VALIDATION_ERROR` | query ขาด field, `year` ไม่ใช่ `YYYY`, ส่ง `month` แทน `year`, `summaryType` ไม่รองรับ หรือ `endDate` ไม่ใช่วันจริง/อยู่นอกปี/เป็นวันอนาคต | ใช้ contract ของ query fields |
| `400 Bad Request` | `BAD_REQUEST` | `parameterCode` ตรงหลายหน่วยแต่ไม่ส่ง `unit` | ส่ง `unit` จาก monthly summary แถวที่คลิก |
| `401 Unauthorized` | `UNAUTHORIZED` | ไม่มี bearer token ที่ถูกต้อง | login ใหม่ |
| `403 Forbidden` | `FORBIDDEN` | ไม่มี `dashboard.stats:view` หรือจุดตรวจวัดอยู่นอก data scope | ซ่อนข้อมูลหรือแจ้งสิทธิ์ไม่เพียงพอ |
| `404 Not Found` | `NOT_FOUND` | ไม่พบจุดตรวจวัด/ตารางรายชั่วโมง/พารามิเตอร์ที่ระบุ หรือจุด/โรงงานถูกซ่อนหรือจุดได้รับยกเว้นทั้งหมด | ตรวจ `stationId`, `parameterCode`, `unit` และสถานะการแสดงผล |

### `GET /api/v1/connected-measurement-points/:stationId/measurement-export.csv`

อ่านข้อมูลจริงของจุดตรวจวัดตามช่วงวันที่ แล้ว stream เป็นไฟล์ CSV โดย backend resolve ชื่อโรงงาน current/live, เลขทะเบียนโรงงาน, registered parameters, permission และ data scope จาก `stationId`; client ไม่ต้องส่ง `factoryId`, `factoryName` หรือ `reportType` กลับมาเป็น source of truth

#### Authentication And Permission

- Authentication: required
- Permission: `dashboard.stats:export`
- Data scope: `ALL`, `IN_REGION`, `IN_PROVINCE` หรือ `OWN_FACTORY` จาก permission นี้โดยตรง
- งานนี้ไม่เพิ่ม default role grant; `admin` ได้ permission ทั้งหมดตาม seed ส่วน role/user อื่นต้องได้รับสิทธิ์ผ่าน permission management

#### Request Fields

| Field | Location | Type | Required | Description |
| --- | --- | --- | --- | --- |
| `stationId` | path | string | Yes | รหัส connected measurement point ที่อยู่ใน data scope ของผู้เรียก |
| `frequency` | query | `hourly` \| `daily` | Yes | `hourly` อ่าน interval `60m`; `daily` อ่าน interval `1day` |
| `startDate` | query | `YYYY-MM-DD` | Yes | วันเริ่มตามคริสต์ศักราช รวมวันนี้ในผลลัพธ์ |
| `endDate` | query | `YYYY-MM-DD` | Yes | วันสิ้นสุดตามคริสต์ศักราช รวมวันนี้ในผลลัพธ์ |
| `parameters` | query | string หรือ repeated string | Yes | ใช้ `all` เพียงค่าเดียว หรือชื่อพารามิเตอร์พร้อมหน่วย เช่น `CO (ppm)`; ส่ง key ซ้ำเมื่อต้องการหลายพารามิเตอร์ |

#### Request Example

```bash
curl --get \
  --url '<BASE_URL>/api/v1/connected-measurement-points/S0199/measurement-export.csv' \
  --header 'Authorization: Bearer <ACCESS_TOKEN>' \
  --data-urlencode 'frequency=hourly' \
  --data-urlencode 'startDate=2026-08-09' \
  --data-urlencode 'endDate=2026-08-09' \
  --data-urlencode 'parameters=CO (ppm)' \
  --data-urlencode 'parameters=Flow Rate (m3/hr)' \
  --output measurement.csv
```

#### Success Response

| Item | Value | Description |
| --- | --- | --- |
| HTTP status | `200 OK` | เริ่มดาวน์โหลดเมื่อ request ผ่าน validation และมี source rows |
| `Content-Type` | `text/csv; charset=utf-8` | CSV ภาษาไทยแบบ UTF-8 |
| `Content-Disposition` | `attachment; filename="measurement-{stationId}-{frequency}-{startDate}-{endDate}.csv"` | `stationId` ในชื่อไฟล์ถูก sanitize |
| Encoding | UTF-8 with BOM | byte-order mark อยู่หน้าคอลัมน์แรกเพื่อรองรับ Excel |
| Line ending | CRLF | field ใช้ RFC 4180 quoting/escaping |

CSV ใช้ identity columns `date_time`, `factory_name`, `factory_registration_number`, `meas_code` ก่อน แล้วแต่ละพารามิเตอร์ใช้หนึ่งคอลัมน์ `<Parameter with unit>`. ชื่อ `factory_registration_number` เป็น public CSV contract ที่ตั้งใจไม่ใช้ชื่อ DB `factory_registration_no` เพื่อไม่ผูก client กับ schema ภายใน. ไม่มีคอลัมน์ `<Parameter> Status`; cell ของพารามิเตอร์เป็นค่าตัวเลขเมื่อสถานะปกติ หรือเป็นชื่อ operational status เมื่อสถานะไม่ปกติ

| CSV column | Description |
| --- | --- |
| `date_time` | วันและเวลาของข้อมูล source รูปแบบ `YYYY-MM-DD HH:mm:ss` |
| `factory_name` | ชื่อโรงงาน current/live |
| `factory_registration_number` | เลขทะเบียนโรงงาน; อยู่ถัดจาก `factory_name` และไม่ใช่ชื่อ field ใน DB |
| `meas_code` | รหัสจุดตรวจวัดจาก `stationId` |

```csv
﻿date_time,factory_name,factory_registration_number,meas_code,CO (ppm),Flow Rate (m3/hr)
2026-08-09 00:00:00,โรงไฟฟ้าพระนครเหนือ ชุดที่ 2,10120000325542,S0199,76.74,94.20
2026-08-09 01:00:00,โรงไฟฟ้าพระนครเหนือ ชุดที่ 2,10120000325542,S0199,Calibration,No Discharge
```

#### Validation And Business Rules

- `hourly` จำกัดช่วงไม่เกิน 366 วันแบบ inclusive และ `daily` จำกัดไม่เกิน 10 ปีปฏิทินแบบ inclusive
- `monthly` และ `yearly` ยังไม่รองรับและตอบ `400`; frontend ต้องซ่อนหรือ disable สองตัวเลือกนี้จนกว่าจะมี aggregation contract
- เมื่อส่ง `parameters=all` ระบบเรียงคอลัมน์ตาม registered parameters; เมื่อส่ง key ซ้ำ ระบบเรียงตาม request และตัดค่าซ้ำหลัง normalize โดยเก็บค่าตัวแรก
- Parameter matching trim และไม่สนตัวพิมพ์เล็ก-ใหญ่ แต่หน่วยในวงเล็บต้องตรงกับ registered parameter; parameter ที่ไม่ลงทะเบียนตอบ `400`
- ชื่อ parameter ใน header ต้องมีหน่วยเมื่อ source ระบุได้ เช่น `BOD (mg/l)`, `CO2 (ppm)` หรือ `Flow Rate (m3/hr)`
- ส่งออกเฉพาะ source rows ที่มีอยู่ เรียง `cdate`, `ctime` จากเก่าไปใหม่ และรักษาทุก row ที่ timestamp ซ้ำ; daily row ที่ไม่มี `ctime` ใช้ `00:00:00`
- `date_time` ใช้ `YYYY-MM-DD HH:mm:ss` ตามเวลา source ซึ่งเป็น `Asia/Bangkok`; measurement value ใช้ทศนิยมสองตำแหน่งและไม่มี thousands separator
- `factory_registration_number` map จากเลขทะเบียนของ connected request ใน service layer; formatter ไม่ใช้ชื่อ field DB เป็น header โดยอัตโนมัติ
- ไม่มี status column แยก; แต่ละ parameter cell จึงเป็นได้ทั้งตัวเลขและข้อความ operational status
- StatusCode `1`, `Normal` หรือ `Ok` ส่งค่าตรวจวัดเป็นตัวเลขสองตำแหน่ง โดยไม่ส่งคำว่า `Normal`
- Operational status อื่นส่งชื่อสถานะแทนค่าตัวเลขใน cell เดียวกัน ได้แก่ `NoData`, `Calibration`, `Defective`, `Maintenance`, `Start up`, `Shut Down`, `Turnaround`, `Etc.` และ `No Discharge`; ไม่ใช้ threshold status `warning`/`exceeded`
- เมื่อ source status เป็น `null`/ค่าว่างและมี numeric value ให้ถือเป็น `Normal`; status ที่ไม่รู้จักและไม่ว่างส่ง `Etc.` แทนค่าตัวเลข
- ถ้ามี completeness field ต่ำกว่า 80% ให้ parameter cell ว่าง แม้ source จะมี operational status; ถ้าไม่มี completeness field และมี numeric value ให้ถือว่า completeness 100%
- String cells ใช้ RFC 4180 escaping และป้องกัน CSV formula injection
- Backend stream response โดยไม่สร้างไฟล์ถาวร, signed URL, export history หรือ background job

#### Errors

| HTTP status | Error code | Condition | Client action |
| --- | --- | --- | --- |
| `400 Bad Request` | `VALIDATION_ERROR` หรือ `BAD_REQUEST` | query/date/frequency/range ไม่ถูกต้อง หรือ parameter ไม่ได้ลงทะเบียน | แสดง validation error และคง dialog ไว้ให้แก้ไข |
| `401 Unauthorized` | `UNAUTHORIZED` | ไม่มี bearer token ที่ถูกต้อง | login ใหม่ |
| `403 Forbidden` | `FORBIDDEN` | ไม่มี `dashboard.stats:export` หรือ station อยู่นอก data scope | ซ่อน/disable export หรือแจ้งสิทธิ์ไม่เพียงพอ |
| `404 Not Found` | `NOT_FOUND` | ไม่พบ connected station หรือตาราง source | รีเฟรชรายการจุดตรวจวัดหรือแจ้งว่าไม่พบข้อมูลต้นทาง |
| `404 Not Found` | `NO_EXPORT_DATA` | ไม่มี source row ในช่วงวันที่ | ไม่เริ่มดาวน์โหลดและแจ้งว่าไม่มีข้อมูลในช่วงที่เลือก |

ตัวอย่างกรณีไม่มีข้อมูล:

```json
{
  "success": false,
  "error": {
    "code": "NO_EXPORT_DATA",
    "message": "No measurement data found for the selected export range"
  }
}
```

#### Frontend Handoff

- ใช้ `stationId`, `frequency`, `startDate`, `endDate` และ repeated `parameters` ตาม contract นี้; ไม่ส่งค่าชื่อโรงงานหรือประเภทระบบเพื่อให้ backend เชื่อถือ
- ดาวน์โหลด response เป็น Blob และใช้ filename จาก `Content-Disposition`; เมื่อ response เป็น JSON error ห้ามสร้างไฟล์ว่าง
- อย่าคาดหวังคอลัมน์ `<Parameter> Status`; parser ต้องรองรับ parameter cell แบบ mixed value ซึ่งเป็น decimal string เมื่อปกติ หรือ operational-status string เมื่อไม่ปกติ
- หน้า dialog ปัจจุบันต้องซ่อนหรือ disable `monthly`/`yearly`; รุ่นแรกเปิดเฉพาะ `hourly` และ `daily`
- เมื่อ backend ตอบ `NO_EXPORT_DATA` ให้แจ้งผู้ใช้ว่าไม่มีข้อมูลในช่วงวันที่ที่เลือก และคงค่าฟอร์มเดิมไว้

## Business Flow And Explanations

- [เมนูแจ้งแบบ กวภ.01-กวภ.05](../../menus/kwp-forms/README.md)
- [เมนูขอเชื่อมต่อ CEMS/WPMS](../../menus/connection-requests/README.md)

## Backend Maintainer Map

| Concern | Canonical source |
| --- | --- |
| Routes | [`connected-measurement-points.routes.ts`](../../../../../backend/src/modules/connection-requests/connected-measurement-points.routes.ts) |
| Controller | [`connection-requests.controller.ts`](../../../../../backend/src/modules/connection-requests/connection-requests.controller.ts) |
| Mapper/service | [`connection-requests.service.ts`](../../../../../backend/src/modules/connection-requests/connection-requests.service.ts) |
| Parameter query/service | [`parameter-values.service.ts`](../../../../../backend/src/modules/parameter-values/parameter-values.service.ts), [`parameter-values.repository.ts`](../../../../../backend/src/modules/parameter-values/parameter-values.repository.ts) |
| CSV formatter | [`measurement-csv-export.ts`](../../../../../backend/src/modules/parameter-values/measurement-csv-export.ts) |
| Validators | [`connection-requests.validator.ts`](../../../../../backend/src/modules/connection-requests/connection-requests.validator.ts), [`parameter-values.validator.ts`](../../../../../backend/src/modules/parameter-values/parameter-values.validator.ts) |
| Public types | [`connection-requests.types.ts`](../../../../../backend/src/modules/connection-requests/connection-requests.types.ts) |
| Tests | [`connection-requests.service.test.ts`](../../../../../backend/tests/unit/connection-requests.service.test.ts), [`connected-measurement-points.route.test.ts`](../../../../../backend/tests/unit/connected-measurement-points.route.test.ts), [`parameter-values.service.test.ts`](../../../../../backend/tests/unit/parameter-values.service.test.ts), [`measurement-csv-export.route.test.ts`](../../../../../backend/tests/unit/measurement-csv-export.route.test.ts), [`measurement-csv-export.test.ts`](../../../../../backend/tests/unit/measurement-csv-export.test.ts) |

## สถานะบริหาร POMS ในรายการ current

status ของรายการที่เชื่อมต่อใช้ `แสดง`, `ซ่อน`, `ยกเลิกการเชื่อมต่อ` โดยสรุปจากพารามิเตอร์ current/live: ทั้งหมดซ่อนทำให้จุดซ่อน มีหนึ่งตัวแสดงทำให้จุดแสดง โรงงานสรุปจากจุด CONNECTED ตามกฎเดียวกัน; การยกเลิกการเชื่อมต่อยังมีลำดับก่อน visibility จุดตรวจวัดส่ง visibility, connectionStatus, effectiveVisibility, effectiveConnectionStatus ด้วย ส่วน statusCode และ monitoringPointStatus ยังคงความหมายของขั้นตอนคำขอเดิม ดู [กติกาสถานะและการสืบทอดจากโรงงาน](../../menus/master-data/status-management.md)
