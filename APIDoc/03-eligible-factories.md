# Eligible Factories API

API สำหรับเลือกโรงงานที่เข้าเกณฑ์ และจัดการรายการโรงงานที่เลือกแล้ว

ทุก endpoint ในไฟล์นี้ต้องส่ง:

```http
Authorization: Bearer <accessToken>
Content-Type: application/json
```

Permission ที่ต้องมีทุก endpoint:

```text
eligible_factories:manage
```

## Endpoints

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/api/v1/eligible-factories/candidates` | รายชื่อโรงงาน candidate จาก source |
| `GET` | `/api/v1/eligible-factories` | รายชื่อโรงงานที่เลือกแล้ว |
| `POST` | `/api/v1/eligible-factories` | เพิ่มโรงงานเข้า eligible list |
| `DELETE` | `/api/v1/eligible-factories/:id` | ลบโรงงานออกจาก eligible list |

## `GET /api/v1/eligible-factories/candidates`

ปัจจุบัน query ต้องว่าง (`strict`) ถ้าส่ง query ที่ไม่ได้ประกาศจะได้ validation error

### Success Response

```json
{
  "success": true,
  "data": [
    {
      "factoryName": "โรงงานตัวอย่าง",
      "factoryId": "FAC001",
      "factoryRegistrationNo": "3-100-1/60",
      "factoryClass": "00101",
      "factorySubclass": "00001",
      "address": "99 หมู่ 1",
      "provinceName": "ระยอง",
      "industrialEstateName": "นิคมอุตสาหกรรมมาบตาพุด",
      "longitude": 101.123,
      "latitude": 12.123,
      "businessActivity": "ผลิตสารเคมี",
      "operationStatus": "เปิดดำเนินการ",
      "capitalAmount": 1000000,
      "machineryHorsepower": 500,
      "productionCapacity": "100 ตัน/วัน",
      "wastewaterDischargeInfo": "มีระบบบำบัด",
      "boilerCount": 2,
      "boilerSizeEach": "10 ton/hr",
      "fuelUsed": "NG",
      "hasEia": true
    }
  ],
  "meta": {
    "total": 1,
    "source": "mock"
  }
}
```

## `GET /api/v1/eligible-factories`

รายการโรงงานที่ถูกเลือกไว้แล้ว

```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "factoryName": "โรงงานตัวอย่าง",
      "factoryId": "FAC001",
      "factoryRegistrationNo": "3-100-1/60",
      "factoryClass": "0101",
      "factorySubclass": "01",
      "address": "99 หมู่ 1",
      "provinceName": "ระยอง",
      "industrialEstateName": "นิคมอุตสาหกรรมมาบตาพุด",
      "longitude": 101.123,
      "latitude": 12.123,
      "businessActivity": "ผลิตสารเคมี",
      "operationStatus": "เปิดดำเนินการ",
      "capitalAmount": 1000000,
      "machineryHorsepower": 500,
      "productionCapacity": "100 ตัน/วัน",
      "wastewaterDischargeInfo": "มีระบบบำบัด",
      "boilerCount": 2,
      "boilerSizeEach": "10 ton/hr",
      "fuelUsed": "NG",
      "hasEia": true
    }
  ],
  "meta": {
    "total": 1
  }
}
```

## `POST /api/v1/eligible-factories`

ใช้ payload รูปแบบ candidate แล้ว backend จะแปลงเป็น schema ภายใน:

| Input Field | Internal Field |
| --- | --- |
| `factoryId` | `sourceFactoryId` |
| `factoryRegistrationNo` | `factoryRegistrationNoNew` |
| `factoryClass` + `factorySubclass` | `factoryTypeSequence`; `factoryClass` มาจาก `fac_import.CLASS` 5 ตัวท้าย |
| `latitude` + `longitude` | `coordinates` |
| fixed | `sourceSystem = "diw.fac_import"` |

### Request Body

```json
{
  "factoryName": "โรงงานตัวอย่าง",
  "factoryId": "FAC001",
  "factoryRegistrationNo": "3-100-1/60",
  "factoryClass": "00101",
  "factorySubclass": "00001",
  "address": "99 หมู่ 1",
  "provinceName": "ระยอง",
  "industrialEstateName": "นิคมอุตสาหกรรมมาบตาพุด",
  "longitude": 101.123,
  "latitude": 12.123,
  "businessActivity": "ผลิตสารเคมี",
  "operationStatus": "เปิดดำเนินการ",
  "capitalAmount": 1000000,
  "machineryHorsepower": 500,
  "productionCapacity": "100 ตัน/วัน",
  "wastewaterDischargeInfo": "มีระบบบำบัด",
  "boilerCount": 2,
  "boilerSizeEach": "10 ton/hr",
  "fuelUsed": "NG",
  "hasEia": true
}
```

### Validation

| Field | Rule |
| --- | --- |
| `factoryName` | required, 1-500 chars |
| `factoryId` | required, 1-64 chars |
| `factoryRegistrationNo` | required, 1-64 chars |
| `factoryClass`, `factorySubclass` | string 1-64 chars หรือ `null` |
| `address` | string 1-1000 chars หรือ `null` |
| `provinceName` | required, 1-128 chars |
| `industrialEstateName` | string 1-255 chars หรือ `null` |
| `longitude` | number -180 ถึง 180 หรือ `null` |
| `latitude` | number -90 ถึง 90 หรือ `null` |
| `businessActivity` | string 1-4000 chars หรือ `null` |
| `operationStatus` | required, 1-64 chars |
| `capitalAmount`, `machineryHorsepower` | number หรือ `null` |
| `productionCapacity` | string 1-500 chars หรือ `null` |
| `wastewaterDischargeInfo` | string 1-4000 chars หรือ `null` |
| `boilerCount` | integer 0-10000 หรือ `null` |
| `boilerSizeEach`, `fuelUsed` | string 1-500 chars หรือ `null` |
| `hasEia` | boolean หรือ `null` |

### Success Response

```json
{
  "success": true,
  "data": {
    "id": 1,
    "sourceSystem": "diw.fac_import",
    "sourceFactoryId": "FAC001",
    "factoryRegistrationNoNew": "3-100-1/60",
    "factoryRegistrationNoOld": null,
    "factoryName": "โรงงานตัวอย่าง",
    "factoryTypeSequence": "00101 / 00001",
    "address": "99 หมู่ 1",
    "provinceName": "ระยอง",
    "industrialEstateName": "นิคมอุตสาหกรรมมาบตาพุด",
    "coordinates": {
      "latitude": 12.123,
      "longitude": 101.123
    },
    "businessActivity": "ผลิตสารเคมี",
    "operationStatus": "เปิดดำเนินการ",
    "selectedBy": 1,
    "selectedAt": "2026-05-30T00:00:00.000Z",
    "createdAt": "2026-05-30T00:00:00.000Z",
    "updatedAt": "2026-05-30T00:00:00.000Z"
  }
}
```

## `DELETE /api/v1/eligible-factories/:id`

ลบรายการที่เลือกไว้แล้วด้วย numeric id

Success response:

```text
204 No Content
```

## Errors

| HTTP | Case |
| --- | --- |
| `400` | payload ไม่ตรง validation |
| `401` | ไม่มี token หรือ token ผิด |
| `403` | ไม่มี `eligible_factories:manage` |
| `404` | ไม่พบ eligible factory id |
