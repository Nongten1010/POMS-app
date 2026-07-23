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
| `data[].primaryFuel` | string | Yes | เชื้อเพลิงหลัก |
| `data[].secondaryFuel` | string | Yes | เชื้อเพลิงสำรอง |
| `data[].productionStack` | string | Yes | ข้อมูลปล่อง/หน่วยการผลิตสำหรับ prefill กวภ.01 |
| `data[].combustionSystem` | `ระบบปิด` \| `ระบบเปิด` | Yes | ระบบการเผาไหม้สำหรับ prefill กวภ.01 |
| `data[].productionCapacity` | string | Yes | ค่ากำลังการผลิต ไม่รวมหน่วยเมื่อข้อมูลต้นทางแยกค่าและหน่วยได้ |
| `data[].productionCapacityUnit` | string | Yes | หน่วยกำลังการผลิต |
| `data[].cemsModel` | string | Yes | brand ของเครื่องมือตรวจวัดที่ไม่ซ้ำกัน คั่นด้วย `, ` สำหรับ prefill กวภ.05 |
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
      "primaryFuel": "ไม่มี",
      "secondaryFuel": "ไม่มี",
      "productionStack": "หม้อไอน้ำ",
      "combustionSystem": "ระบบปิด",
      "productionCapacity": "35",
      "productionCapacityUnit": "ตัน/ชั่วโมง",
      "cemsModel": "Acme CEMS"
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
- `cemsModel` รวมค่า `measurementInstruments.parameters[].brand` หลัง trim และตัดค่าซ้ำ โดยคงลำดับเดิม
- `connectedPointId` resolve จาก active connected point ด้วย `source_measurement_point_id`; backend ไม่ใช้ ID ของ request snapshot แทน
- สำหรับ WPMS field prefill ของ CEMS ทั้งห้ารายการจะเป็น `null` และ field WPMS จะยังคืนตาม contract เดิม
- API ใช้ conditional response ของ Express ได้ จึงอาจเห็น `304 Not Modified` เมื่อ browser ส่ง `If-None-Match`; `304` หมายถึง client ใช้ representation ที่ cache ไว้ ไม่ใช่ response contract ใหม่หายไป

### Errors

| HTTP status | Condition | Client action |
| --- | --- | --- |
| `400 Bad Request` | `factoryId` ไม่ผ่าน validation | ตรวจรหัสโรงงานที่ส่ง |
| `401 Unauthorized` | ไม่มี bearer token ที่ถูกต้อง | login ใหม่ |
| `403 Forbidden` | ไม่มี permission หรือโรงงานอยู่นอก data scope | ซ่อน action หรือแจ้งสิทธิ์ไม่เพียงพอ |

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
