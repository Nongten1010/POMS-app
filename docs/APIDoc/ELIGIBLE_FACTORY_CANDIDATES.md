# Eligible Factory Candidates API

เอกสารนี้สรุปแหล่งข้อมูลและการปรับประสิทธิภาพของ API รายชื่อโรงงานที่เข้าข่าย

## Endpoint

```http
GET /api/v1/eligible-factories/candidates
Authorization: Bearer <accessToken>
```

Base URL production:

```text
http://d-poms.diw.go.th
```

## ผลทดสอบล่าสุด

หลัง deploy commit `766a459` endpoint แบบไม่ใส่ pagination ตอบกลับได้สำเร็จ:

```text
HTTP 200
time_total: 10.757338s
response size: 54,772,774 bytes
total: 68,841 records
source: external
```

หมายเหตุ: endpoint นี้ต้องส่ง `Authorization` header ถ้าไม่ส่งจะได้ `401 UNAUTHORIZED`

## แหล่งข้อมูลที่ยังดึงอยู่

| Response field | Source | วิธีดึง |
| --- | --- | --- |
| `factoryName` | `sqlservice.diw.go.th` / `diw.dbo.fac_import.FNAME` | query หลัก |
| `factoryId` | `sqlservice.diw.go.th` / `diw.dbo.fac_import.FID` | query หลัก |
| `factoryRegistrationNo` | `sqlservice.diw.go.th` / `diw.dbo.fac_import.DISPFACREG`, fallback `FACREG` | query หลัก |
| `factoryClass` | `sqlservice.diw.go.th` / `diw.dbo.fac_import.CLASS` | เอาเลข 4 ตัวท้าย เช่น `00100` -> `0100` |
| `factorySubclass` | `sqlservice.diw.go.th` / `diw.dbo.FACCLASS.CLASS` join ด้วย `FID` | ใช้เลข 3 หลักท้ายจาก `FACCLASS.CLASS`, ตัดค่าซ้ำ, มากกว่า 1 ค่า join ด้วย comma; ถ้า `FACCLASS` ไม่มีค่าให้คืน `null` |
| `address` | `sqlservice.diw.go.th` / `fac_import` address columns | query หลัก |
| `provinceName` | `sqlservice.diw.go.th` / `fac_import.PROV` | map รหัสจังหวัด DIW เป็นชื่อจังหวัด |
| `industrialEstateName` | `sqlservice.diw.go.th` / `diw.dbo.FAC_COLONY_INDUST` | join lookup จาก `fac_import.COLONY_INDUST_CODE` ไป `FAC_COLONY_INDUST.COLONY_INDUST_DESC` |
| `longitude`, `latitude` | `sqlservice.diw.go.th` / `fac_import.LONGITUDE_X`, `LATITUDE_Y` | ถ้าเป็น `0,0` หรือค่าผิดช่วง จะคืน `null` |
| `businessActivity` | `sqlservice.diw.go.th` / `fac_import.OBJECT` | query หลัก |
| `operationStatus` | `sqlservice.diw.go.th` / `fac_import.FFLAG` | `1` = แจ้งประกอบแล้ว, `3` = หยุดชั่วคราว |
| `machineryHorsepower` | `sqlservice.diw.go.th` / `fac_import.HP2`, fallback `HP` | query หลัก |
| `productionCapacity` | `sqlservice.diw.go.th` / `diw.dbo.FAC_PROD` + `diw.dbo.UNIT` | สำหรับดึงทั้งหมดใช้ join `FAC_PROD -> fac_import` รอบเดียว |

## ข้อมูลที่ไม่ดึงแล้ว

ตาม requirement ล่าสุด ข้อมูลเหล่านี้ไม่ต้องดึงสำหรับ `GET /eligible-factories/candidates` แล้ว:

| Field | เดิม | ปัจจุบัน |
| --- | --- | --- |
| `boilerSizeEach` | `sqldiw.diw.go.th` / `control.dbo.boiler_list.mac_max_stream_prod` | ไม่ query แล้ว, response เป็น `null` |
| `fuelUsed` | `sqldiw.diw.go.th` / `control.dbo.boiler_list.fuel_name`, `fuel_volume` | ไม่ query แล้ว, response เป็น `null` |
| `eia` | `sqlservice.diw.go.th` / `diw.dbo.check_eia` | ไม่ query แล้ว, response เป็น `null` |
| `hasEia` | `sqlservice.diw.go.th` / `diw.dbo.check_eia` | ไม่ query แล้ว, response เป็น `null` |

## Performance notes

จุดที่เคยช้า:

| Query | เวลาก่อนปรับโดยประมาณ |
| --- | --- |
| `FAC_PROD` แบบ `whereIn` chunk หลายรอบ | chunk ตัวอย่าง 1,000 FID ใช้ประมาณ 24s; ถ้าดึงทั้งหมดเสี่ยงเกิน 300s |
| `FACCLASS` แบบ `whereIn` chunk หลายรอบ | เมื่อดึงทั้งหมดต้องยิงหลายสิบ query เพราะมี FID ประมาณ 68k รายการ |
| `boiler_list` แบบ `whereIn` chunk หลายรอบ | ประมาณ 85s |

แนวทางที่ปรับ:

1. ถ้า request มีจำนวน FID มากกว่า `5,000` รายการ จะไม่ยิง `FAC_PROD` แบบ chunk
2. เปลี่ยน `FAC_PROD` เป็น bulk join:

```sql
select fp.FID, fp.PRODNAME, fp.PRODQUAN, u.UNT_ENAME
from dbo.FAC_PROD as fp
join dbo.fac_import as fi on fp.FID = fi.FID
left join dbo.UNIT as u on fp.UNIT = u.UNIT
where fi.FFLAG in ('1', '3')
```

3. ถ้า request มีจำนวน FID มากกว่า `5,000` รายการ จะเปลี่ยน `FACCLASS` เป็น bulk join รอบเดียว:

```sql
select fc.FID, fc.CLASS
from dbo.FACCLASS as fc
join dbo.fac_import as fi on fc.FID = fi.FID
where fi.FFLAG in ('1', '3')
```

4. ตัด `boiler_list` และ `check_eia` ออกจาก candidate lookup แล้ว เพราะ frontend ไม่ใช้แล้ว
5. เพิ่ม MSSQL `requestTimeout = 300000` ใน connection ของ factory source และ boiler source เพื่อให้ timeout ระดับ driver สอดคล้องกับ endpoint timeout

## ตัวอย่าง response

```json
{
  "success": true,
  "data": [
    {
      "factoryName": "สถานีบ่มใบยาปานทอง",
      "factoryId": "10520000225172",
      "factoryRegistrationNo": "3-1-2/17ลป",
      "factoryClass": "0100",
      "factorySubclass": null,
      "address": "1 หมู่ 9 ถนนบ้านช่องกอม ตำบล4 อำเภอ13 52240",
      "provinceName": "ลำปาง",
      "industrialEstateName": null,
      "longitude": null,
      "latitude": null,
      "businessActivity": "บ่มใบยาสูบ",
      "operationStatus": "แจ้งประกอบแล้ว",
      "machineryHorsepower": 121.8,
      "productionCapacity": null,
      "boilerSizeEach": null,
      "fuelUsed": null,
      "eia": null,
      "hasEia": null
    }
  ],
  "meta": {
    "total": 68841,
    "source": "external"
  }
}
```

## Code references

- `backend/src/modules/eligible-factories/eligible-factory-candidates.repository.ts`
- `backend/src/modules/eligible-factories/fac-import.mapper.ts`
- `backend/src/config/factory-source-database.ts`
- `backend/src/config/boiler-source-database.ts`
