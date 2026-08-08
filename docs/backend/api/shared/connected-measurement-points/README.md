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

## Business Flow And Explanations

- [เมนูแจ้งแบบ กวภ.01-กวภ.05](../../menus/kwp-forms/README.md)
- [เมนูขอเชื่อมต่อ CEMS/WPMS](../../menus/connection-requests/README.md)

## Backend Maintainer Map

| Concern | Canonical source |
| --- | --- |
| Routes | [`connected-measurement-points.routes.ts`](../../../../../backend/src/modules/connection-requests/connected-measurement-points.routes.ts) |
| Controller | [`connection-requests.controller.ts`](../../../../../backend/src/modules/connection-requests/connection-requests.controller.ts) |
| Mapper/service | [`connection-requests.service.ts`](../../../../../backend/src/modules/connection-requests/connection-requests.service.ts) |
| Validators | [`connection-requests.validator.ts`](../../../../../backend/src/modules/connection-requests/connection-requests.validator.ts) |
| Public types | [`connection-requests.types.ts`](../../../../../backend/src/modules/connection-requests/connection-requests.types.ts) |
| Tests | [`connection-requests.service.test.ts`](../../../../../backend/tests/unit/connection-requests.service.test.ts), [`connected-measurement-points.route.test.ts`](../../../../../backend/tests/unit/connected-measurement-points.route.test.ts) |
