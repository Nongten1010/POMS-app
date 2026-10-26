# ค่าตรวจวัดและการทดสอบข้อมูลเชื่อมต่อ

[กลับไปหน้าขอเชื่อมต่อ](./README.md)

ค่าที่เห็นระหว่างทดสอบของจุดใหม่จะถูก [ล้างเมื่อเชื่อมต่อสำเร็จ](./measurement-cleanup.md) ทั้ง 6 interval ก่อนยืนยัน `CONNECTED`; สำหรับ `ADD_PARAMETER` ล้างเฉพาะค่ากับสถานะของพารามิเตอร์ที่เพิ่มใหม่ โดยเก็บทุกแถวและพารามิเตอร์เดิม หลังจากนั้นเก็บข้อมูลที่เข้ามาใหม่ตามปกติ รวมข้อมูลที่ส่งย้อนหลัง

## Frontend Quick Start

อ่านข้อมูลทดสอบล่าสุดของจุดตรวจวัด โดย `values` คืนค่าตรวจวัดตามต้นทางทุกสถานะ และ `statuses` คืนสถานะคู่กันเสมอ:

```bash
curl --request GET \
  --url '<BASE_URL>/api/v1/parameter-values/connection-test?stationId=S2001' \
  --header 'Authorization: Bearer <ACCESS_TOKEN>'
```

ผู้ประกอบการใช้ `cems_wpms_requests:view` ตามขอบเขตเดิม ส่วนเจ้าหน้าที่ (`officer`/`admin`) ใช้ `cems_wpms_requests:approve` พร้อมขอบเขตของสิทธิ์อนุมัติ โดยไม่ต้องมี `view` เพิ่มสำหรับ endpoint นี้ อ่าน [กติกาสิทธิ์และสถานะคำขอ](#get-apiv1parameter-valuesconnection-test) ก่อนแสดงปุ่มตรวจข้อมูลให้เจ้าหน้าที่

Backend เลือก source จาก config ที่บันทึกและผู้เรียกเข้าถึงได้: `MODBUS_RTU`, `MODBUS_TCP`, `DCON_ASCII` (`DCON`) ใช้ realtime (`meta.interval: "real"`) ส่วนอุปกรณ์อื่นหรือไม่มี config ใช้รายนาที (`"1m"`) คืนล่าสุดไม่เกิน 10 แถวโดยใช้ URL เดิม ไม่ต้องส่ง query เลือก interval ดู [กติกาเลือกตาราง](#validation-and-business-rules) และ [การปรับ client](../../CHANGELOG.md#connection-test-protocol-source)

## StatusCode Contract

ตารางนี้อธิบายการแปลงรหัสสถานะ และค่าที่จัดรูปสำหรับ dashboard, public map และ measurement statistics. ส่วน connection test ใช้การแปลงชื่อสถานะเดียวกันใน `statuses` แต่ `values` คงค่าตรวจวัดจริงเสมอ รวม `0`, string และ `null` โดยไม่แทนด้วยชื่อสถานะ:

| `StatusCode` | POMS Client status | ค่าที่แสดงในหน้าหลัก/สถิติ |
| ---: | --- | --- |
| `0` | `NoData` | `NoData` |
| `1` | `Ok` | ใช้ค่าใน `*_value` |
| `2` | `Calibration` | `Calibration` |
| `3` | `Defective` | `Defective` |
| `4` | `Maintenance` | `Maintenance` |
| `5` | `Start up` | `Start up` |
| `6` | `Shut Down` | `Shut Down` |
| `7` | `Turnaround` | `Turnaround` |
| `8` | `Etc.` | `Etc.` |
| `9` | `No Discharge` | `No Discharge` |

- Source รองรับทั้ง integer เช่น `6`, numeric string เช่น `"6"` และชื่อสถานะเดิม เช่น `Maintenance`.
- ถ้า source ส่งชื่อสถานะเดิม `Normal` หรือ `Ok` จะใช้ค่าตรวจวัด.
- Raw endpoints `/parameter-values` และ `/parameter-values/latest` ไม่แทนค่า `*_value`; client จะได้รับ `*_value` และ `*_status` ตาม source เพื่อใช้ตรวจสอบข้อมูลต้นทาง.

## `GET /api/v1/parameter-values/tables`

คืนเฉพาะตารางค่าตรวจวัดของ station ที่ผู้เรียกมีสิทธิ์อ่าน

### Authentication And Permission

- Authentication: required
- Permission: `cems_wpms_requests:view`
- Data scope: ตาม scope ของ permission

### Request Fields

Endpoint นี้ไม่มี path, query หรือ request body fields

### Success Response Fields

| Field | Type | Nullable | Description |
| --- | --- | --- | --- |
| `success` | boolean | No | `true` เมื่อสำเร็จ |
| `data[].schemaName` | string | No | schema ของ parameter source database |
| `data[].tableName` | string | No | ชื่อตาราง `{stationId}_data_{interval}` |
| `data[].columnCount` | integer | No | จำนวนคอลัมน์ |
| `data[].rowCount` | integer | No | จำนวนแถว |
| `meta.total` | integer | No | จำนวนตารางที่คืน |

### Success Response Example

```json
{
  "success": true,
  "data": [
    {
      "schemaName": "ingest",
      "tableName": "S2001_data_real",
      "columnCount": 392,
      "rowCount": 24
    }
  ],
  "meta": { "total": 1 }
}
```

## `GET /api/v1/parameter-values`

อ่าน raw rows ของ station และ interval ตามช่วงวันที่ โดยคืนเฉพาะคอลัมน์ของพารามิเตอร์ที่ลงทะเบียน

### Authentication And Permission

- Authentication: required
- Permission: `cems_wpms_requests:view`
- Data scope: ตาม scope ของ permission

### Request Fields

| Field | Location | Type | Required | Description |
| --- | --- | --- | --- | --- |
| `stationId` | query | string | Yes | รหัสจุดตรวจวัด ความยาวไม่เกิน 64 ตัวอักษร |
| `interval` | query | enum string | No | `real`, `1m`, `5m`, `60m`, `1day` หรือ `test`; default `real` |
| `startDate` | query | `YYYY-MM-DD` | Yes | วันเริ่มต้น |
| `endDate` | query | `YYYY-MM-DD` | Yes | วันสิ้นสุด ต้องไม่น้อยกว่า `startDate` |

### Success Response Fields

| Field | Type | Nullable | Description |
| --- | --- | --- | --- |
| `data[]` | object[] | No | raw source rows หลังกรอง registered parameters |
| `data[].*_value` | unknown | Yes | ค่าตรวจวัดดิบ ไม่ถูกแทนด้วยชื่อสถานะ |
| `data[].*_units` | string | Yes | หน่วยของพารามิเตอร์ |
| `data[].*_status` | integer \| string | Yes | StatusCode หรือข้อความจาก source |
| `meta.registeredParameters` | string[] | No | ชื่อพารามิเตอร์พร้อมหน่วยที่ลงทะเบียน |
| `meta.returnedColumns` | string[] | No | คอลัมน์ที่คืนจริง |

### Success Response Example

```json
{
  "success": true,
  "data": [
    {
      "station_id": "S2001",
      "nox_value": 88.2,
      "nox_units": "ppm",
      "nox_status": 6,
      "cdate": "2026-08-08",
      "ctime": "10:00:00"
    }
  ],
  "meta": {
    "stationId": "S2001",
    "interval": "real",
    "schemaName": "ingest",
    "tableName": "S2001_data_real",
    "startDate": "2026-08-08",
    "endDate": "2026-08-08",
    "count": 1,
    "registeredParameters": ["NOx (ppm)"],
    "returnedColumns": ["station_id", "nox_value", "nox_units", "nox_status", "cdate", "ctime"]
  }
}
```

## `GET /api/v1/parameter-values/latest`

อ่าน raw row ล่าสุดของ station และ interval โดยใช้ contract ของ `*_value`, `*_units` และ `*_status` แบบเดียวกับ list endpoint

### Authentication And Permission

- Authentication: required
- Permission: `cems_wpms_requests:view`
- Data scope: ตาม scope ของ permission

### Request Fields

| Field | Location | Type | Required | Description |
| --- | --- | --- | --- | --- |
| `stationId` | query | string | Yes | รหัสจุดตรวจวัด |
| `interval` | query | enum string | No | `real`, `1m`, `5m`, `60m`, `1day` หรือ `test`; default `real` |

### Success Response Fields

| Field | Type | Nullable | Description |
| --- | --- | --- | --- |
| `data` | object | Yes | raw row ล่าสุด หรือ `null` เมื่อยังไม่มีข้อมูล |
| `meta.count` | integer | No | `1` เมื่อพบ row หรือ `0` เมื่อไม่พบ |
| `meta.registeredParameters` | string[] | No | ชื่อพารามิเตอร์พร้อมหน่วยที่ลงทะเบียน |
| `meta.returnedColumns` | string[] | No | คอลัมน์ที่คืนจริง |

### Success Response Example

```json
{
  "success": true,
  "data": {
    "station_id": "S2001",
    "nox_value": 88.2,
    "nox_units": "ppm",
    "nox_status": 6,
    "cdate": "2026-08-08",
    "ctime": "10:00:00"
  },
  "meta": {
    "stationId": "S2001",
    "interval": "real",
    "schemaName": "ingest",
    "tableName": "S2001_data_real",
    "count": 1,
    "registeredParameters": ["NOx (ppm)"],
    "returnedColumns": ["station_id", "nox_value", "nox_units", "nox_status", "cdate", "ctime"]
  }
}
```

## `GET /api/v1/parameter-values/connection-test`

อ่านข้อมูลล่าสุดไม่เกิน 10 แถวจาก `<stationId>_data_real` หรือ `<stationId>_data_1m` ตาม protocol ของ config ที่บันทึกและผู้เรียกเข้าถึงได้ เรียง `cdate DESC, ctime DESC` และจัดกลุ่มเป็น `values` กับ `statuses` ตามชื่อพารามิเตอร์พร้อมหน่วย

### Authentication And Permission

- Authentication: required
- Permission: แยกตาม `userType` ในตารางด้านล่าง; `citizen` และประเภทบัญชีอื่นเข้าไม่ได้แม้มี permission
- Data scope: ตรวจทั้งสิทธิ์ของผู้เรียกและจุดตรวจวัด โดยใช้ scope ของ permission ในเส้นทางนั้นเสมอ

| ผู้เรียก | Permission | จุดที่อ่านได้ |
| --- | --- | --- |
| `operator` | `cems_wpms_requests:view` | current connected point หรือจุดในคำขอ `WAITING_CONNECTION` ตามขอบเขตเดิมและสิทธิ์โรงงาน |
| `officer` / `admin` | `cems_wpms_requests:approve` | current connected point ในขอบเขตอนุมัติ หรือจุดในคำขอ `WAITING_CONNECTION` / `CONNECTION_CONFIRMED` ที่อยู่ในขอบเขตอนุมัติ |

- เจ้าหน้าที่ที่มีแค่ `view` ตอบ `403 FORBIDDEN`; เจ้าหน้าที่ที่มี `approve` โดยไม่มี `view` ใช้ endpoint นี้ได้เมื่อจุดอยู่ในขอบเขต
- ขอบเขตเจ้าหน้าที่ใช้ `approve` เท่านั้น ไม่ fallback ไปหา scope ของ `view` แม้ `view` จะกว้างกว่า เช่น `view: ALL` และ `approve: IN_PROVINCE` อ่านได้เฉพาะจังหวัดของ `approve`
- scope อนุมัติรองรับ `ALL`, `IN_REGION`, `IN_PROVINCE`, `IN_ESTATE` และ `FACTORY_TYPE_88`; scope ที่ขาด ไม่รองรับ หรือขาดค่าพื้นที่ที่จำเป็นไม่ให้สิทธิ์อ่าน
- จุดระหว่างคำขอใช้ข้อมูลพื้นที่/ประเภทโรงงานจาก request factory snapshot ที่ยังไม่ถูกลบ ตามขอบเขตเดียวกับการอนุมัติคำขอ ส่วน current connected point ใช้ข้อมูลจุดเชื่อมต่อ POMS ปัจจุบัน
- จุดระหว่างคำขอรองรับชื่อหรือรหัสพื้นที่ตามที่มีใน snapshot; สำหรับ current connected point ขอบเขต `IN_REGION` ต้องตรงกับค่าภาคในข้อมูลปัจจุบัน ไม่มีการแปลงรหัสภาคจาก snapshot ให้อัตโนมัติ หากรหัสเทียบกับค่าปัจจุบันไม่ได้ ตอบ `403 FORBIDDEN`
- สิทธิ์นี้เพิ่มเฉพาะการอ่านข้อมูลทดสอบ ไม่ให้สิทธิ์แก้ config, ทดสอบ config หรืออ่าน `/parameter-values`, `/parameter-values/latest`, `/parameter-values/tables` เพิ่ม
- client เดิมของเจ้าหน้าที่ต้องปรับสิทธิ์และการแสดงปุ่มตาม [ผลกระทบและการเปลี่ยนผ่าน](../../CHANGELOG.md#connection-test-approval-access)

### Request Fields

| Field | Location | Type | Required | Description |
| --- | --- | --- | --- | --- |
| `stationId` | query | string | Yes | รหัสจุดตรวจวัด |

### Success Response Fields

| Field | Type | Nullable | Description |
| --- | --- | --- | --- |
| `data[].timestamp` | string | Yes | วันที่และเวลาของ source row |
| `data[].values` | object | No | map จากชื่อพารามิเตอร์พร้อมหน่วยไปยังค่าตรวจวัดจริงตามต้นทางทุกสถานะ; คง `0` และชนิดข้อมูลเดิม; ไม่มีค่าหรือคอลัมน์ให้คืน `null` และมี key คู่กับ `statuses` เสมอ |
| `data[].statuses` | object | No | map สถานะของพารามิเตอร์; numeric StatusCode ถูกแปลงเป็นชื่อสถานะ |
| `meta.stationId` | string | No | รหัสจุดตรวจวัดที่ขอ |
| `meta.interval` | string | No | `real` สำหรับ `MODBUS_RTU`, `MODBUS_TCP`, `DCON_ASCII` (`DCON`); `1m` สำหรับ protocol อื่นหรือไม่มี config |
| `meta.schemaName` | string | No | schema ของ source table ตามการตั้งค่าระบบ เช่น `ingest` |
| `meta.tableName` | string | No | `<stationId>_data_real` หรือ `<stationId>_data_1m` ตาม `meta.interval` |
| `meta.count` | integer | No | จำนวนแถวที่คืนจริง ระหว่าง `0` ถึง `10` |
| `meta.registeredParameters` | string[] | No | ชื่อพารามิเตอร์พร้อมหน่วยที่ลงทะเบียน |

### Success Response Example

ตัวอย่างจุดที่ใช้ `MODBUS_RTU`, `MODBUS_TCP` หรือ `DCON_ASCII` (`DCON`):

```json
{
  "success": true,
  "data": [
    {
      "timestamp": "2026-08-08 10:15:00",
      "values": {
        "CO (ppm)": "12.5",
        "NOx (ppm)": "88.2",
        "Flow Rate (m3/hr)": "0"
      },
      "statuses": {
        "CO (ppm)": "Ok",
        "NOx (ppm)": "Shut Down",
        "Flow Rate (m3/hr)": "No Discharge"
      }
    }
  ],
  "meta": {
    "stationId": "S2001",
    "interval": "real",
    "schemaName": "ingest",
    "tableName": "S2001_data_real",
    "count": 1,
    "registeredParameters": ["CO (ppm)", "NOx (ppm)", "Flow Rate (m3/hr)"]
  }
}
```

สำหรับ `POMS_BOX`, `MSSQL`, `MYSQL` หรือจุดที่ไม่มี config รูปแบบ `data` เดิม แต่ `meta.interval` เป็น `"1m"` และ `meta.tableName` เป็น `"S2001_data_1m"`

### Validation And Business Rules

- เลือกตารางจาก saved active `device_connection_configs` ของจุดที่ผู้เรียกเข้าถึงได้ โดย config ของ current connected point ต้องมี `request_id IS NULL`; config ระหว่างคำขอต้องอยู่ใน request snapshot ที่ยังเข้าถึงได้ตามสิทธิ์และสถานะคำขอด้านบน ไม่ใช้ config ของคำขออื่นที่ถูกลบหรืออยู่นอกขอบเขต.
- จับคู่ `config.station_id` ด้วย `point_code`; ใช้ `point_name` เฉพาะข้อมูลเก่าที่ `point_code` เป็น `null` เพื่อไม่ให้ชื่อจุดที่ชนกับรหัส station อื่นเลือก config ผิด.
- `MODBUS_RTU`, `MODBUS_TCP` และ `DCON_ASCII` (`DCON`) เลือก `<stationId>_data_real` และ `meta.interval: "real"`; protocol อื่น เช่น `POMS_BOX`, `MSSQL`, `MYSQL` หรือไม่มี config เลือก `<stationId>_data_1m` และ `meta.interval: "1m"`.
- หากจุดมีหลาย protocol และอย่างน้อยหนึ่ง config ที่เข้าถึงได้ใช้ realtime ให้เลือกตาราง realtime ของจุดนั้น; endpoint รับเฉพาะ `stationId` และไม่มี query เพิ่มให้เลือก protocol หรือ interval.
- อ่านสูงสุด 10 แถวล่าสุดที่มีในตารางที่เลือก ไม่จำกัดว่าต้องเป็นข้อมูล 10 นาทีที่ผ่านมา; วันเวลาเป็นของ source row จริง.
- ก่อนอ่านตารางค่าต้องผ่านการตรวจสิทธิ์ของ station และอ่านรายการพารามิเตอร์ด้วยขอบเขตเดียวกัน จุดหรือคำขอที่ถูกลบไม่เปิดให้อ่านผ่านเส้นทางคำขอ; สถานะอื่นที่ไม่มี current connected point ที่เข้าถึงได้ตอบ `403 FORBIDDEN`.
- หากมีน้อยกว่า 10 แถว ให้คืนเท่าที่มี; ตารางว่างคืน `data: []` และ `meta.count: 0`.
- หากไม่มีตารางที่เลือก ตอบ `404 NOT_FOUND`; ไม่ fallback ไปอ่านตาราง interval อื่น.
- client ที่ตรวจ `meta.interval` ต้องรองรับทั้ง `real` และ `1m` และรายการได้ถึง 10 แถว ดู [ผลกระทบและการปรับ client](../../CHANGELOG.md#connection-test-protocol-source).
- ชื่อ key ใน `values` และ `statuses` ต้องเป็นชื่อพารามิเตอร์พร้อมหน่วยจาก `registeredParameters` และมี key คู่กันเสมอ แม้ไม่มีค่าหรือสถานะ (`null`).
- `values` คืนค่าตามต้นทางโดยไม่แทนด้วยสถานะ เช่น status `Maintenance` และ value `88.2` ยังคงส่งทั้งสองค่า ดู [ผลกระทบต่อ client](../../CHANGELOG.md#connection-test-measured-values).
- `testMode` ไม่มีผลต่อการเลือกตารางของ endpoint นี้; ใช้ `real`/`1m` ตาม protocol เท่านั้น ไม่อ่าน `_data_test`.
- StatusCode ที่รองรับคือ `0` ถึง `9`; `9` แสดงเป็น `No Discharge`.
- Status ที่ไม่มีหรือไม่รู้จักยังใช้ค่าเดิมเพื่อรองรับ source rows รุ่นเก่าที่ไม่มี StatusCode.

### การจับคู่ค่ากับสถานะและหน่วย

`values` และ `statuses` ของพารามิเตอร์หนึ่งในแต่ละแถวต้องมาจากชุดคอลัมน์เดียวกัน เช่น `co2_ppm_value` คู่กับ `co2_ppm_status` โดยคงชื่อพร้อมหน่วยตามที่ลงทะเบียน; `pH` เป็นพารามิเตอร์ไร้มิติที่ใช้ชื่อ canonical โดยไม่ต้องเติมหน่วย

- รองรับ dedicated family แยกหน่วย เช่น `co2_ppm_*` และ `co2_percent_*` รวมถึง generic `co2_*` ที่ระบุหน่วยใน `co2_units`. ข้อมูล ppm ไม่ถูกแสดงซ้ำใต้ `CO2 (%)`
- ชื่อกับหน่วยของ dedicated ทั่วไปต้องแยกด้วย `_` จริง; รองรับชื่อ compact เฉพาะ CO2 ที่ระบุไว้คือ `co2ppm`, `co2percent`, `co2pct`. ไม่ตีความ `cod_*` เป็น `CO (d)`; เมื่อไม่มี family ที่ยืนยันได้ให้ค่ากับสถานะเป็น `null` แทนการเดา
- เลือก dedicated ที่ตรงหน่วยก่อนในแต่ละแถว เมื่อมี value **หรือ** status แม้อีกฝั่งเป็น `null`. ตัวอย่าง `co2_ppm_value: null`, `co2_ppm_status: Maintenance` จะส่งค่า `null` คู่ `Maintenance` ไม่ดึง value จาก generic มาผสม
- ใช้ generic ที่ตรงหน่วยได้เมื่อ dedicated ไม่มีข้อมูลทั้ง value และ status ในแถวนั้นเท่านั้น; รักษาค่า `0`, `null` และชนิดข้อมูลตามต้นทาง
- generic รุ่นเก่าที่ไม่มีหน่วยอ่านเพื่อ compatibility ได้เฉพาะเมื่อพารามิเตอร์ที่ลงทะเบียนมีหน่วยเดียวที่ระบุได้แน่นอนและไม่มี dedicated ต่างหน่วยแข่งขันกัน. เมื่อกำกวมหรือหน่วยไม่ตรง จะไม่เดาหรือคัดลอกค่าไปทุก label
- รองรับ identifier ที่มี underscore เช่น `pm2_5_value`/`pm2_5_status` สำหรับ `PM2.5 (µg/m3)` โดยใช้คู่คอลัมน์เดียวกัน
- `pH` ที่ระบุเป็นไร้มิติชัดเจนรองรับ `ph_units` ว่างหรือ `NULL`; label เดิม `pH (pH)` ยังใช้ได้ตามที่ลงทะเบียน. ข้อยกเว้นนี้ไม่ใช้กับพารามิเตอร์อื่นที่หน่วยหาย

ตัวอย่างสองแถว: แถวแรกมีสถานะใน dedicated ppm จึงรักษาคู่ `null`/`Maintenance`; แถวถัดมา dedicated ppm ไม่มีข้อมูลทั้งคู่ จึงใช้ generic ที่หน่วย ppm และไม่แสดงค่าซ้ำใต้ `%`:

```json
[
  {
    "timestamp": "2026-10-26 10:15:00",
    "values": { "CO2 (ppm)": null, "CO2 (%)": "0.04", "PM2.5 (µg/m3)": 0, "pH": "7.2" },
    "statuses": { "CO2 (ppm)": "Maintenance", "CO2 (%)": "Normal", "PM2.5 (µg/m3)": "Calibration", "pH": "Normal" }
  },
  {
    "timestamp": "2026-10-26 10:14:00",
    "values": { "CO2 (ppm)": "420.0", "CO2 (%)": null, "PM2.5 (µg/m3)": null, "pH": null },
    "statuses": { "CO2 (ppm)": "Normal", "CO2 (%)": null, "PM2.5 (µg/m3)": null, "pH": null }
  }
]
```

ดู [ผลกระทบของการจับคู่ family](../../CHANGELOG.md#parameter-column-family-matching). การล้างข้อมูลหลังอนุมัติใช้กฎยืนยันหน่วยที่เข้มกว่าการอ่าน compatibility ตาม [สัญญา cleanup](./measurement-cleanup.md#ขอเพิ่มพารามิเตอร์-ล้างเฉพาะคอลัมน์ของพารามิเตอร์ใหม่)

## Errors

ใช้ [shared error envelope](../../shared/README.md):

| HTTP status | Code | Condition | Client action |
| --- | --- | --- | --- |
| `400` | `VALIDATION_ERROR` | query ไม่ผ่าน validation | แก้ `stationId`, interval หรือวันที่ |
| `401` | `UNAUTHORIZED` | ไม่มี bearer token ที่ถูกต้อง | login ใหม่ |
| `403` | `FORBIDDEN` | ขาด permission, ประเภทบัญชีไม่รองรับ, station อยู่นอก data scope หรือสถานะคำขอไม่เปิดให้อ่าน | ซ่อนข้อมูลหรือแจ้งสิทธิ์ไม่เพียงพอ; สำหรับเจ้าหน้าที่ตรวจ `approve` และขอบเขตของสิทธิ์นั้น |
| `404` | `NOT_FOUND` | ไม่พบ source table | ตรวจ station และ interval |

## Backend Maintainer Links

- Route: [`parameter-values.routes.ts`](../../../../../backend/src/modules/parameter-values/parameter-values.routes.ts)
- Validator: [`parameter-values.validator.ts`](../../../../../backend/src/modules/parameter-values/parameter-values.validator.ts)
- Service: [`parameter-values.service.ts`](../../../../../backend/src/modules/parameter-values/parameter-values.service.ts)
- Repository และลำดับแถว: [`parameter-values.repository.ts`](../../../../../backend/src/modules/parameter-values/parameter-values.repository.ts)
- การจับคู่ family ร่วมกับ cleanup: [`measurement-parameter-columns.ts`](../../../../../backend/src/modules/parameter-values/measurement-parameter-columns.ts)
- Status mapping: [`parameter-status.ts`](../../../../../backend/src/modules/parameter-values/parameter-status.ts)
- Types: [`parameter-values.types.ts`](../../../../../backend/src/modules/parameter-values/parameter-values.types.ts)
- Tests: [`parameter-values.service.test.ts`](../../../../../backend/tests/unit/parameter-values.service.test.ts)
- Tests การเลือกตารางและขอบเขต config: [`parameter-values.connection-test-source.repository.test.ts`](../../../../../backend/tests/unit/parameter-values.connection-test-source.repository.test.ts)
- Tests ผ่าน API จริงสำหรับค่า/สถานะและหน่วย: [`parameter-values.connection-test-values.api.test.ts`](../../../../../backend/tests/unit/parameter-values.connection-test-values.api.test.ts)
- Runtime OpenAPI: [`connection-requests.openapi.ts`](../../../../../backend/src/modules/api-docs/connection-requests.openapi.ts)
- OpenAPI tests: [`parameter-values.connection-test.openapi.test.ts`](../../../../../backend/tests/unit/parameter-values.connection-test.openapi.test.ts)
