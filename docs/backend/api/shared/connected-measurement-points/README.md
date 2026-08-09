# จุดตรวจวัดที่เชื่อมต่อแล้ว

> Owner: Backend

## Frontend Quick Start

API กลุ่มนี้เป็น contract ร่วมสำหรับหน้าขอเชื่อมต่อ หน้าหลัก และหน้าแจ้งแบบ กวภ. Endpoint รายโรงงานคืนรายการจุดตรวจวัดพร้อมข้อมูล prefill ของ กวภ.01 และ กวภ.05 โดย key ของข้อมูล prefill จะอยู่ใน response เสมอและเป็น `null` เมื่อไม่มีข้อมูลต้นทาง

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
| อ่านแบบตั้งค่าอุปกรณ์ปัจจุบัน | `GET` | `/api/v1/connected-measurement-points/:stationId/device-configs` | Bearer | `cems_wpms_requests:view` | [Device config contract](../../menus/connection-requests/device-configs.md) |
| แทนที่การตั้งค่าอุปกรณ์ปัจจุบัน | `POST` | `/api/v1/connected-measurement-points/:stationId/device-configs` | Bearer | `cems_wpms_requests:edit` | [Device config contract](../../menus/connection-requests/device-configs.md) |
| อ่านสถิติรายชั่วโมง | `GET` | `/api/v1/connected-measurement-points/:stationId/measurement-statistics?date=YYYY-MM-DD` | Bearer | `dashboard.stats:view` | [Measurement statistics](#get-apiv1connected-measurement-pointsstationidmeasurement-statistics) |
| อ่านปฏิทินและสรุปสถานะรายเดือน | `GET` | `/api/v1/connected-measurement-points/:stationId/calendar-status?month=YYYY-MM` | Bearer | `dashboard.stats:view` | [Calendar status](#get-apiv1connected-measurement-pointsstationidcalendar-status) |
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
| `data[].pointName` | string | No | ชื่อจุดตรวจวัด |
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
| `data.measurementPoints[].rows[].time` | string | No | ชั่วโมงของข้อมูล เช่น `00:00` |
| `data.measurementPoints[].rows[].dataCompletenessPercent` | number | No | ร้อยละความครบถ้วนของข้อมูลในชั่วโมงนั้น |
| `data.measurementPoints[].rows[].values` | object | No | ค่าที่วัดได้ โดย key เป็นชื่อพารามิเตอร์พร้อมหน่วย |
| `data.measurementPoints[].rows[].values["Flow Rate (m3/hr)"]` | object | No | ค่าอัตราการไหล; เป็นชื่อ Flow เพียงชื่อเดียวใน response |
| `data.measurementPoints[].rows[].values["Flow Rate (m3/hr)"].value` | number \| null | Yes | ค่าจาก source `flow_value` หน่วย `m3/hr` |
| `data.measurementPoints[].rows[].values["Flow Rate (m3/hr)"].displayValue` | string | No | ค่าที่ format สำหรับแสดงผล, ชื่อ POMS Client status เมื่อ StatusCode ไม่ใช่ `1` หรือ `-` เมื่อข้อมูลไม่เพียงพอ |
| `data.measurementPoints[].rows[].values["Flow Rate (m3/hr)"].status` | string | No | `normal`, `warning`, `exceeded`, `insufficient`, `noData` หรือ `invalid`; operational status ใช้ `invalid` เพื่อไม่ให้ client นำไปวาดเป็นค่าตรวจวัด |

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
    ]
  }
}
```

#### Validation And Business Rules

- ชื่อที่ลงทะเบียนเป็น `Flow`, `Flow Rate (m3/hr)` หรือ `Flow Rate (m³/hr)` จะอ่านจาก source `flow_value` เดียวกัน และคืนเป็น key มาตรฐาน `Flow Rate (m3/hr)` เพียงหนึ่ง key
- เมื่อข้อมูลไม่ครบถ้วนต่ำกว่า 80% จะคืน `value: null`, `displayValue: "-"` และ `status: "insufficient"`
- เมื่อ POMS Client status ไม่ใช่ `1`, `Ok` หรือ `Normal` จะคืน `value: null`, ใช้ชื่อสถานะใน `displayValue` และไม่ใช้ค่าต้นทางคำนวณกราฟ เช่น StatusCode `6` คืน `displayValue: "Shut Down"`; StatusCode `9` คืน `displayValue: "No Discharge"`. ดู [StatusCode contract](../../menus/connection-requests/parameter-values.md#statuscode-contract)

#### Errors

| HTTP status | Condition | Client action |
| --- | --- | --- |
| `400 Bad Request` | `stationId` หรือ `date` ไม่ผ่าน validation | ตรวจรูปแบบ path และ query string |
| `401 Unauthorized` | ไม่มี bearer token ที่ถูกต้อง | login ใหม่ |
| `403 Forbidden` | ไม่มี permission หรือจุดตรวจวัดอยู่นอก data scope | ซ่อนข้อมูลหรือแจ้งสิทธิ์ไม่เพียงพอ |
| `404 Not Found` | ไม่พบจุดตรวจวัดหรือตารางข้อมูลของจุดนั้น | ตรวจรหัสจุดตรวจวัด |

### `GET /api/v1/connected-measurement-points/:stationId/calendar-status`

คืนสถานะรายวันของปฏิทินและตารางสรุปของแต่ละพารามิเตอร์สำหรับเดือนคริสต์ศักราชที่เลือก

#### Authentication And Permission

- Authentication: required
- Permission: `dashboard.stats:view`
- Data scope: `ALL`, `IN_REGION`, `IN_PROVINCE` หรือ `OWN_FACTORY`

#### Request Fields

| Field | Location | Type | Required | Description |
| --- | --- | --- | --- | --- |
| `stationId` | path | string | Yes | รหัส connected measurement point ที่อยู่ใน data scope ของผู้เรียก |
| `month` | query | `YYYY-MM` | Yes | เดือนตามคริสต์ศักราช เช่น `2025-08`; เดือนต้องอยู่ระหว่าง `01` ถึง `12` |

#### Request Example

```bash
curl --request GET \
  --url '<BASE_URL>/api/v1/connected-measurement-points/S1125/calendar-status?month=2025-08' \
  --header 'Authorization: Bearer <ACCESS_TOKEN>' \
  --header 'Accept: application/json'
```

#### Success Response Fields

| Field | Type | Nullable | Description |
| --- | --- | --- | --- |
| `success` | boolean | No | `true` เมื่อสำเร็จ |
| `data.metadata.description` | string | No | คำอธิบายชุดข้อมูล calendar status |
| `data.metadata.month` | string | No | เดือนเดียวกับ query ในรูปแบบ `YYYY-MM` |
| `data.metadata.valueDefinitions` | object | No | คำอธิบายความหมายของ calendar statuses |
| `data.factory` | object | No | โรงงาน current/live ของจุดตรวจวัดที่เลือก |
| `data.factory.factoryId` | string | No | รหัสโรงงาน current/live |
| `data.factory.factoryName` | string | No | ชื่อโรงงาน current/live |
| `data.factory.systemType` | string | No | ประเภทระบบของจุด เช่น `CEMS` หรือ `WPMS` |
| `data.calendar.year` | number | No | ปีคริสต์ศักราชจาก `month` |
| `data.calendar.month` | number | No | เลขเดือน `1` ถึง `12` จาก `month` |
| `data.calendar.days` | object[] | No | สถานะของวันที่มี source rows ในเดือนที่เลือก เรียงวันที่จากเก่าไปใหม่ |
| `data.calendar.days[].date` | string | No | วันที่ในรูปแบบ `YYYY-MM-DD` |
| `data.calendar.days[].dataCompletenessPercent` | number | No | ร้อยละความครบถ้วนของข้อมูลรายวัน |
| `data.calendar.days[].dataCompletenessStatus` | `lowData` \| `highData` | No | `lowData` เมื่อต่ำกว่า 80%; มิฉะนั้นเป็น `highData` |
| `data.calendar.days[].pollutionStatus` | `normal` \| `warning` \| `exceeded` \| `insufficient` | No | สถานะมลพิษรายวันสำหรับเส้นขอบปฏิทิน |
| `data.calendar.days[].display.backgroundStatus` | `lowData` \| `highData` | No | สถานะพื้นหลังเดียวกับ `dataCompletenessStatus` |
| `data.calendar.days[].display.borderStatus` | `normal` \| `warning` \| `exceeded` \| `insufficient` | No | สถานะเส้นขอบเดียวกับ `pollutionStatus` |
| `data.monthlySummary` | object[] | No | สรุปของพารามิเตอร์ที่ลงทะเบียน |
| `data.monthlySummary[].parameterCode` | string | No | รหัสพารามิเตอร์แบบ machine-stable |
| `data.monthlySummary[].parameterName` | string | No | ชื่อพารามิเตอร์ |
| `data.monthlySummary[].unit` | string | No | หน่วยของพารามิเตอร์ เช่น `ppm` |
| `data.monthlySummary[].exceededDays` | number | No | จำนวนวันของพารามิเตอร์นั้นที่มีสถานะ `exceeded` เฉพาะในเดือนที่ร้องขอ |
| `data.monthlySummary[].lowDataDays` | number | No | จำนวนวันที่มีความครบถ้วนต่ำกว่า 80% เฉพาะในเดือนที่ร้องขอ |
| `data.monthlySummary[].todayDataCompletenessPercent` | number | Yes | ร้อยละความครบถ้วนของ daily summary ล่าสุดในชุดข้อมูลที่ endpoint ได้รับ; เป็น `null` เมื่อไม่มีข้อมูล |
| `meta.stationId` | string | No | รหัสจุดตรวจวัดที่อ่านข้อมูล |
| `meta.interval` | `60m` | No | ตารางข้อมูลรายชั่วโมงที่ใช้ |
| `meta.schemaName` | string | No | schema ของ parameter source database |
| `meta.tableName` | string | No | ตาราง `{stationId}_data_60m` ที่ใช้ |
| `meta.month` | string | No | เดือนเดียวกับ query ในรูปแบบ `YYYY-MM` |
| `meta.count` | number | No | จำนวน source rows ที่ repository คืนสำหรับ request นี้ |
| `meta.registeredParameters` | string[] | No | พารามิเตอร์ที่ลงทะเบียน โดยชื่อที่อ่านได้ต้องมีหน่วยเมื่อ source ระบุได้ |

#### Success Response Example

```json
{
  "success": true,
  "data": {
    "metadata": {
      "description": "DateCalendar และตารางสรุปสถานะรายเดือนของโรงงาน",
      "month": "2025-08",
      "valueDefinitions": {
        "dataCompletenessStatus": {
          "lowData": "ส่งข้อมูลน้อยกว่า 80% ใช้พื้นหลังสีเทา",
          "highData": "ส่งข้อมูลมากกว่าหรือเท่ากับ 80% ใช้พื้นหลังสีฟ้า"
        },
        "pollutionStatus": {
          "normal": "ปกติทั้งวัน ใช้เส้นขอบสีเขียว",
          "warning": "เฝ้าระวัง ใช้เส้นขอบสีส้ม",
          "exceeded": "เกินมาตรฐาน ใช้เส้นขอบสีแดง",
          "insufficient": "ข้อมูลไม่เพียงพอเมื่อ dataCompletenessStatus เป็น lowData"
        }
      }
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
          }
        },
        {
          "date": "2025-08-10",
          "dataCompletenessPercent": 42,
          "dataCompletenessStatus": "lowData",
          "pollutionStatus": "insufficient",
          "display": {
            "backgroundStatus": "lowData",
            "borderStatus": "insufficient"
          }
        }
      ]
    },
    "monthlySummary": [
      {
        "parameterCode": "CO",
        "parameterName": "CO",
        "unit": "ppm",
        "exceededDays": 1,
        "lowDataDays": 1,
        "todayDataCompletenessPercent": 42
      }
    ]
  },
  "meta": {
    "stationId": "S1125",
    "interval": "60m",
    "schemaName": "ingest",
    "tableName": "S1125_data_60m",
    "month": "2025-08",
    "count": 30,
    "registeredParameters": ["CO (ppm)"]
  }
}
```

#### Validation And Business Rules

- `month=2025-08` กำหนดช่วงแบบ inclusive ตั้งแต่ `2025-08-01` ถึง `2025-08-31`
- `monthlySummary[].exceededDays` และ `monthlySummary[].lowDataDays` นับเฉพาะ daily summaries ที่ `date` อยู่ในช่วงเดือนที่ร้องขอ แม้ adapter ต้นทางจะคืน row นอกช่วงเข้ามา
- `exceededDays` แยกตามพารามิเตอร์และใช้เกณฑ์ของ connected point; วันเดียวกันนับได้สูงสุดหนึ่งวันต่อพารามิเตอร์
- `lowDataDays` ใช้สถานะความครบถ้วนระดับวันและจึงอาจมีค่าเดียวกันในหลายพารามิเตอร์
- `todayDataCompletenessPercent` คงพฤติกรรมเดิมและไม่ใช้ตัวกรอง defensive ของสอง counter: ใช้ daily summary ล่าสุดในชุดข้อมูลที่ endpoint ได้รับ และไม่ได้หมายความว่าต้องเป็นวันปัจจุบันตามนาฬิกา
- ชื่อพารามิเตอร์ที่อ่านได้ต้องคืนพร้อม `unit`; client ใช้ `parameterCode` เมื่อต้องการ key ที่คงที่
- หลักฐาน TDD: [Calendar summary requested-month isolation](../../../evidence/shared/calendar-summary-requested-month-isolation.tdd.md)

#### Errors

| HTTP status | Code | Condition | Client action |
| --- | --- | --- | --- |
| `400 Bad Request` | `VALIDATION_ERROR` | `stationId` หรือ `month` ไม่ผ่าน validation | ตรวจรูปแบบ path และ `YYYY-MM` |
| `401 Unauthorized` | `UNAUTHORIZED` | ไม่มี bearer token ที่ถูกต้อง | login ใหม่ |
| `403 Forbidden` | `FORBIDDEN` | ไม่มี `dashboard.stats:view` หรือจุดตรวจวัดอยู่นอก data scope | ซ่อนข้อมูลหรือแจ้งสิทธิ์ไม่เพียงพอ |
| `404 Not Found` | `NOT_FOUND` | ไม่พบจุดตรวจวัดหรือตาราง `{stationId}_data_60m` | ตรวจรหัสจุดตรวจวัดและสถานะการเชื่อมต่อ |

### `GET /api/v1/connected-measurement-points/:stationId/measurement-export.csv`

อ่านข้อมูลจริงของจุดตรวจวัดตามช่วงวันที่ แล้ว stream เป็นไฟล์ CSV โดย backend resolve ชื่อโรงงาน current/live, registered parameters, permission และ data scope จาก `stationId`; client ไม่ต้องส่ง `factoryId`, `factoryName` หรือ `reportType` กลับมาเป็น source of truth

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

CSV ใช้ identity columns `date_time`, `factory_name`, `meas_code` ก่อน แล้วแต่ละพารามิเตอร์ใช้สองคอลัมน์ `<Parameter with unit>` และ `<Parameter with unit> Status`

```csv
﻿date_time,factory_name,meas_code,CO (ppm),CO (ppm) Status,Flow Rate (m3/hr),Flow Rate (m3/hr) Status
2026-08-09 00:00:00,โรงไฟฟ้าพระนครเหนือ ชุดที่ 2,S0199,76.74,Normal,94.20,Normal
```

#### Validation And Business Rules

- `hourly` จำกัดช่วงไม่เกิน 366 วันแบบ inclusive และ `daily` จำกัดไม่เกิน 10 ปีปฏิทินแบบ inclusive
- `monthly` และ `yearly` ยังไม่รองรับและตอบ `400`; frontend ต้องซ่อนหรือ disable สองตัวเลือกนี้จนกว่าจะมี aggregation contract
- เมื่อส่ง `parameters=all` ระบบเรียงคอลัมน์ตาม registered parameters; เมื่อส่ง key ซ้ำ ระบบเรียงตาม request และตัดค่าซ้ำหลัง normalize โดยเก็บค่าตัวแรก
- Parameter matching trim และไม่สนตัวพิมพ์เล็ก-ใหญ่ แต่หน่วยในวงเล็บต้องตรงกับ registered parameter; parameter ที่ไม่ลงทะเบียนตอบ `400`
- ชื่อ parameter ใน header ต้องมีหน่วยเมื่อ source ระบุได้ เช่น `BOD (mg/l)`, `CO2 (ppm)` หรือ `Flow Rate (m3/hr)`
- ส่งออกเฉพาะ source rows ที่มีอยู่ เรียง `cdate`, `ctime` จากเก่าไปใหม่ และรักษาทุก row ที่ timestamp ซ้ำ; daily row ที่ไม่มี `ctime` ใช้ `00:00:00`
- `date_time` ใช้ `YYYY-MM-DD HH:mm:ss` ตามเวลา source ซึ่งเป็น `Asia/Bangkok`; measurement value ใช้ทศนิยมสองตำแหน่งและไม่มี thousands separator
- Status column เป็น operational status เท่านั้น: `Normal`, `Calibration`, `Defective`, `Maintenance`, `Start up`, `Shut Down`, `Turnaround`, `Etc.` หรือค่าว่าง; ไม่ใช้ threshold status `warning`/`exceeded`
- Numeric value ที่ใช้ได้ส่ง status `Normal`; operational status อื่นทำให้ value ว่าง โดย `NoData` ทำให้ทั้ง value/status ว่าง และ `No Discharge` ส่ง status `Etc.`
- เมื่อ source status เป็น `null`/ค่าว่างและมี numeric value ให้ถือเป็น `Normal`; status ที่ไม่รู้จักและไม่ว่างทำให้ value ว่างและส่ง `Etc.`
- ถ้ามี completeness field ต่ำกว่า 80% ให้ value/status ว่าง; ถ้าไม่มี completeness field และมี numeric value ให้ถือว่า completeness 100%
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
