# How to test POMS API

> สำหรับ backend dev — วิธีลองยิง API ที่ implement แล้ว

## 1. Prerequisites

ต้องมี 3 อย่างพร้อม:
- ✅ Docker Desktop เปิดอยู่
- ✅ Container `poms-mssql` running
- ✅ DB `POMS` มี data (migrate + seed แล้ว)

ตรวจสอบ:
```bash
docker ps --filter "name=poms-mssql"
```
ต้องเห็น `Up X minutes`. ถ้าไม่เห็น:
```bash
./scripts/setup-mssql.sh    # เริ่มใหม่
npm run db:migrate
npm run db:seed
```

## 2. Start dev server

```bash
npm run dev
```
ดู log ต้องเห็น:
```
[boot] POMS backend listening on http://localhost:3000/api/v1
[db] Connected to MSSQL localhost:1433/POMS
```

หากเห็น `Failed to connect to localhost:1433` → docker container อาจไม่ start. รัน `docker start poms-mssql`

## 3. เครื่องมือทดสอบ — เลือก 1 ใน 3

### A) **curl** (CLI — เร็วสุด)

ใช้ตัวอย่างใน [README.md](#test-cases-ด้านล่าง) ในไฟล์นี้

### B) **VS Code REST Client** (Recommended — ใน VS Code)

1. ติดตั้ง extension: `humao.rest-client`
2. เปิดไฟล์ `tests-manual.http` (อยู่ที่ root ของ backend)
3. กดปุ่ม **"Send Request"** ที่ปรากฏเหนือ request แต่ละอัน
4. Response จะ pop up ในหน้าต่างข้าง ๆ

### C) **Postman / Bruno / Insomnia**

Import collection จาก [openapi.json](./openapi.json) (จะสร้างทีหลัง) หรือ copy curl commands ด้านล่าง

---

## 4. Mock users สำหรับทดสอบ

| User type | Login payload | Expected scope |
| --------- | ------------- | -------------- |
| Admin | `userType:officer, username:weekit` | ALL ทุก permission |
| KPM officer | `userType:officer, username:officer_kpm` | ALL (view + approve) |
| Provincial | `userType:officer, username:officer_sng` | IN_PROVINCE (province=1019 สระบุรี) |
| Operator | `userType:operator, username:operator_demo` | OWN_FACTORY (2 บริษัท + 7 โรงงาน) |
| Citizen | `userType:citizen, username:citizen_demo` | จำกัด (dashboard view, feedback) |

**Password ทุกคน:** `demo1234`

---

## 5. Test cases

### 5.1 Health check

```bash
curl http://localhost:3000/health
```
Response: `{"success":true,"status":"ok",...}`

### 5.2 Login — Admin (officer)

```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"userType":"officer","username":"weekit","departmentID":"2","password":"demo1234"}'
```

Response (สำคัญที่ frontend ใช้):
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJ...",
    "expiresIn": 900,
    "user": { "id": 1, "userType": "admin", ... },
    "profile": { "lineNameTh": "นักวิชาการคอมพิวเตอร์", ... },
    "roles": ["admin"],
    "scopes": { "factories:view": "ALL", ... },
    "permissions": {
      "dashboard": { "view": true },
      "factories": { "view": true, "edit": true, "approve": true }
    }
  }
}
```

### 5.3 Login — Operator

```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"userType":"operator","username":"operator_demo","password":"demo1234"}'
```

ดู `data.profile.juristics[]` ต้องมี 2 บริษัท × รวม 7 factories

### 5.4 /me — ดู profile ของตัวเอง (ต้องส่ง token)

```bash
# ดึง token จาก login ก่อน
TOKEN=$(curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"userType":"officer","username":"weekit","departmentID":"2","password":"demo1234"}' \
  | python3 -c "import sys,json;print(json.load(sys.stdin)['data']['accessToken'])")

curl http://localhost:3000/api/v1/auth/me -H "Authorization: Bearer $TOKEN"
```

### 5.5 Error cases (verify error handling)

```bash
# 5.5.1 Wrong password → 401
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"userType":"officer","username":"weekit","departmentID":"2","password":"WRONG"}'

# 5.5.2 Validation error → 400
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"userType":"officer"}'

# 5.5.3 No token → 401
curl http://localhost:3000/api/v1/auth/me

# 5.5.4 Invalid token → 401
curl http://localhost:3000/api/v1/auth/me -H "Authorization: Bearer fake.token.here"

# 5.5.5 404 route
curl http://localhost:3000/api/v1/does-not-exist
```

### 5.6 Create local user account

สร้าง user ใหม่โดยใช้ชื่อ-สกุลรวมช่องเดียว ไม่ส่ง email/phone และให้ระบบเก็บ password hash:

```bash
TOKEN=$(curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"userType":"officer","username":"weekit","departmentID":"2","password":"demo1234"}' \
  | python3 -c "import sys,json;print(json.load(sys.stdin)['data']['accessToken'])")

curl -X POST http://localhost:3000/api/v1/users/local-accounts \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{
    "fullName":"สมชาย ทดสอบ",
    "username":"local_officer",
    "password":"StrongerPass123",
    "roleCodes":["diw_central"],
    "permissionOverrides":[
      {"code":"chat:ask","effect":"allow"}
    ]
  }'
```

Response:
```json
{
  "success": true,
  "data": {
    "id": 6,
    "username": "local_officer",
    "fullName": "สมชาย ทดสอบ",
    "email": null,
    "phone": null,
    "roles": [{ "code": "diw_central", "nameTh": "กรอ.", "nameEn": "DIW Central" }],
    "status": "active"
  }
}
```

Login ด้วยบัญชี local:

```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"userType":"officer","username":"local_officer","password":"StrongerPass123"}'
```

### 5.7 CEMS/WPMS connection request workflow

เอกสารหลักของ API ชุดนี้อยู่ที่ `../../docs/APIDoc/CEMS_WPMS_REQUEST_APIS.md` และเป็นแหล่งอ้างอิงเดียวสำหรับ payload เต็ม, field mapping ทุกช่อง, validation และตัวอย่าง response.

Login เป็น operator เพื่อสร้างคำขอ:

```bash
OPERATOR_TOKEN=$(curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"userType":"operator","username":"operator_demo","password":"demo1234"}' \
  | python3 -c "import sys,json;print(json.load(sys.stdin)['data']['accessToken'])")
```

Login เป็นเจ้าหน้าที่ กฝม. สำหรับตรวจแบบ/ดูรายการทั้งหมด:

```bash
OFFICER_TOKEN=$(curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"userType":"officer","username":"officer_kpm","departmentID":"2","password":"demo1234"}' \
  | python3 -c "import sys,json;print(json.load(sys.stdin)['data']['accessToken'])")
```

ลำดับ endpoint ที่ต้องทดสอบ:

| Step | Purpose | Method | Path |
| --- | --- | --- | --- |
| 0 | ดึงข้อมูลทั่วไปของโรงงานลงฟอร์มเพิ่มจุดตรวจวัด | GET | `/api/v1/cems-wpms-requests/factories/:factoryId/general` |
| 1 | บันทึกฟอร์มเพิ่มจุดตรวจวัด | POST | `/api/v1/cems-wpms-requests/measurement-points` |
| 2 | บันทึกฟอร์มเพิ่มพารามิเตอร์ | POST | `/api/v1/cems-wpms-requests/parameters` |
| 3 | แก้ไข/ส่งฟอร์มกลับหลังเจ้าหน้าที่ขอแก้ไข | PUT | `/api/v1/cems-wpms-requests/:id/form` |
| 4 | ตรวจฟอร์ม/เปลี่ยนสถานะ | POST | `/api/v1/cems-wpms-requests/:id/status` |
| 5 | บันทึกตั้งค่าอุปกรณ์ config | POST | `/api/v1/cems-wpms-requests/:id/device-configs` |
| 6 | ดึง config กลับไป prefill ฟอร์ม | GET | `/api/v1/cems-wpms-requests/:id/device-configs?stationId=S0001` |
| 7 | รายการคำขอสำหรับตาราง | GET | `/api/v1/cems-wpms-requests/table-rows` |
| 8 | รายชื่อโรงงานของผู้ประกอบการ | GET | `/api/v1/cems-wpms-requests/operator-factories` |
| 9 | รายละเอียดคำขอรายคำขอ | GET | `/api/v1/cems-wpms-requests/:id/detail` |
| 10 | รายจุดตรวจวัดทุกคำขอ เฉพาะเชื่อมต่อแล้ว | GET | `/api/v1/cems-wpms-requests/connected-measurement-points` |

ตัวอย่าง minimal สำหรับสร้างคำขอเพิ่มจุดตรวจวัด:

```bash
REQUEST_ID=$(curl -s -X POST http://localhost:3000/api/v1/cems-wpms-requests/measurement-points \
  -H "Authorization: Bearer $OPERATOR_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{
    "factoryId":"factory-001",
    "factoryName":"บริษัท ทดสอบ จำกัด",
    "factoryRegistrationNo":"3-106-33/50สบ",
    "industryMainOrder":"106",
    "industrySubOrder":"33",
    "businessActivity":"ผลิตไอน้ำ",
    "hasEia":true,
    "projectName":"โครงการทดสอบ CEMS",
    "address":"99 หมู่ 1 ต.ทดสอบ อ.เมือง จ.ระยอง",
    "latitude":13.7563,
    "longitude":100.5018,
    "systemType":"CEMS",
    "contactPersons":[{"name":"สมชาย ใจดี","position":"วิศวกรสิ่งแวดล้อม","phone":"0812345678","email":"ops@example.com"}],
    "notificationEmails":["plant-alert@example.com"],
    "officerNotificationEmails":["officer-alert@example.com"],
    "informationProviderName":"ธนากรณ์ ศรีคอม",
    "informationProviderPosition":"ผู้จัดการโรงงาน",
    "measurementPoints":[{
      "pointName":"ปล่องระบาย A",
      "pointType":"STACK",
      "details":{
        "monitoringPointKind":"CEMS",
        "productionUnitType":"หม้อไอน้ำ",
        "productionCapacity":"10 ตันไอน้ำ/ชั่วโมง",
        "cemsInstallationRequiredBy":"ประกาศ อก.",
        "eligibleParameters":["NOx","SO2"],
        "pendingParameters":["NOx","SO2"],
        "stackShape":"สี่เหลี่ยม",
        "stackWidth":1.5,
        "stackLength":2,
        "connectionDevice":"POMS Box (กรอ.)"
      },
      "documentsAndImages":[{"title":"ภาพถ่ายปล่อง","fileName":"stack.png","fileUrl":"https://example.com/files/stack.png","fileType":"image/png","fileSize":1024}],
      "measurementInstruments":{
        "converterBrand":"Converter Brand",
        "converterModel":"CV-100",
        "parameters":[{
          "parameter":"NOx",
          "technique":"NDIR",
          "range":"0-200 ppm",
          "brand":"Siemens",
          "supplier":"ABC Tech",
          "eiaStandard":"120 ppm",
          "standardCondition":true,
          "dryBasis":true,
          "oxygenOrExcessAir":true,
          "standardCriteria":{"enabled":true,"standardValue":"120","rows":[{"level":"normal","min":0,"max":80},{"level":"warning","min":80,"max":100},{"level":"critical","min":100,"max":null}]},
          "eiaCriteria":{"enabled":false}
        }]
      }
    }],
    "remarks":"ขอเชื่อมต่อระบบใหม่"
  }' | python3 -c "import sys,json;print(json.load(sys.stdin)['data']['id'])")
```

ตัวอย่าง minimal สำหรับเพิ่มพารามิเตอร์ให้จุดตรวจวัดเดิม:

```bash
PARAMETER_REQUEST_ID=$(curl -s -X POST http://localhost:3000/api/v1/cems-wpms-requests/parameters \
  -H "Authorization: Bearer $OPERATOR_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{
    "factoryId":"factory-001",
    "factoryName":"บริษัท ทดสอบ จำกัด",
    "factoryRegistrationNo":"3-106-33/50สบ",
    "systemType":"CEMS",
    "contactPersons":[{"name":"สมชาย ใจดี","position":"วิศวกรสิ่งแวดล้อม","phone":"0812345678","email":"ops@example.com"}],
    "notificationEmails":["plant-alert@example.com"],
    "informationProviderName":"ธนากรณ์ ศรีคอม",
    "informationProviderPosition":"ผู้จัดการโรงงาน",
    "measurementPoints":[{
      "pointName":"ปล่องระบาย A",
      "pointCode":"S0001",
      "pointType":"STACK",
      "measurementInstruments":{
        "converterBrand":"Converter Brand",
        "converterModel":"CV-100",
        "parameters":[{
          "parameter":"CO",
          "technique":"NDIR",
          "range":"0-100 ppm",
          "brand":"Siemens",
          "supplier":"ABC Tech",
          "eiaStandard":"50 ppm",
          "standardCondition":true,
          "dryBasis":true,
          "oxygenOrExcessAir":true,
          "standardCriteria":{"enabled":true,"standardValue":"50","rows":[{"level":"normal","min":0,"max":30},{"level":"warning","min":30,"max":40},{"level":"critical","min":40,"max":null}]},
          "eiaCriteria":{"enabled":false}
        }]
      }
    }],
    "remarks":"ขอเพิ่มพารามิเตอร์"
  }' | python3 -c "import sys,json;print(json.load(sys.stdin)['data']['id'])")
```

ตัวอย่างตรวจฟอร์ม/เปลี่ยนสถานะ:

```bash
curl -X POST "http://localhost:3000/api/v1/cems-wpms-requests/$REQUEST_ID/status" \
  -H "Authorization: Bearer $OFFICER_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"action":"APPROVE_FORM","officerNote":"แบบถูกต้อง"}'
```

หลังเจ้าหน้าที่อนุมัติ ฟอร์มจะเข้าสถานะ `WAITING_CONNECTION` และ backend จะออก `pointCode` ให้อัตโนมัติ โดย CEMS เริ่ม `S0001` และ WPMS เริ่ม `P0001`. Frontend ไม่ต้องส่ง `pointCode` ตอนเพิ่มจุดตรวจวัดใหม่.

### 5.8 Device connection config mock API

API ชุดนี้ใช้ตั้งค่า connection อุปกรณ์ตรวจวัดหลังแบบเชื่อมต่อพร้อมใช้งาน โดย 1 `stationId` คือ 1 จุดตรวจวัด และมีได้หลาย protocol รวมถึงมีหลายอุปกรณ์ใน protocol เดียวกันได้เมื่อ `deviceCode` ต่างกัน แต่ห้ามซ้ำ `stationId + protocol + deviceCode`:

- `settings` = connection point 1 ชุด เช่น COM/Slave หรือ Host/DB
- `channels` = รายการอุปกรณ์/ค่าตรวจวัดหลายตัวใน connection point นั้น
- `deviceCode` = รหัสอุปกรณ์ของ config เช่น `S0001/01`
- `channels[].status` = สถานะพารามิเตอร์ เช่น `Normal`, `Maintenance`, `Inactive`
- `statusManagement` = optional สำหรับ prefill ส่วนจัดการสถานะใน dialog ตั้งค่าอุปกรณ์
- `GET /device-connections?stationId=STATION_001` จะคืน fallback mock config 1 รายการ ถ้า DB ยังไม่มีข้อมูลจริง
- `POST /device-connections/test-connection` = backend จำลองการเชื่อมต่อสำเร็จ เพื่อให้ frontend พัฒนาได้ก่อน external API/driver จริงพร้อม
- `POST /device-connections` = บันทึก config ตาม payload จริง ไม่ต้องส่ง field สำหรับ mock
- `POST /cems-wpms-requests/:id/device-configs` = บันทึก config และผูกกับคำขอ โดย `stationId` ต้องตรงกับ `pointCode` หรือ `pointName` ในคำขอนั้น; รองรับ payload เดี่ยวและ batch `{ "configs": [...] }` สำหรับส่งหลายอุปกรณ์ในครั้งเดียว
- `GET /cems-wpms-requests/:id/device-configs` = ดึงข้อมูล config กลับไป prefill ฟอร์มตั้งค่าอุปกรณ์ตาม `stationId`
- `GET /cems-wpms-requests/:id/device-configs/:configId` = ดึงข้อมูล config รายตัวกลับไป prefill ฟอร์มตั้งค่าอุปกรณ์
- `valueFormat` = รูปแบบค่าข้อมูลตรวจวัด (`MEASUREMENT_VALUE` ค่าปกติ, `CURRENT` ค่ากระแสไฟฟ้า, `VOLTAGE` ค่าแรงดันไฟฟ้า)

Permission ที่ใช้:

```text
GET /device-connections       ไม่ต้องส่ง Authorization
POST /device-connections      cems_wpms_requests:edit
POST /test-connection         cems_wpms_requests:edit
GET /cems-wpms-requests/:id/device-configs            cems_wpms_requests:view
GET /cems-wpms-requests/:id/device-configs/:configId  cems_wpms_requests:view
```

Mock test Modbus RTU หนึ่ง connection point + หลายอุปกรณ์ตรวจวัด:

```bash
curl -X POST http://localhost:3000/api/v1/device-connections/test-connection \
  -H "Authorization: Bearer $OPERATOR_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{
    "stationId":"STATION_001",
    "protocol":"MODBUS_RTU",
    "settings":{
      "comPort":1,
      "slaveId":1,
      "baudRate":9600,
      "parity":"NONE",
      "stopBits":1,
      "dataBits":8,
      "valueRange":{"min":0,"max":200},
      "quantity":2
    },
    "channels":[
      {
        "addressId":40001,
        "dataType":"CO2 (ppm)",
        "valueRange":{"min":0,"max":200},
        "valueFormat":"MEASUREMENT_VALUE",
        "offset":0,
        "encoding":"UNSIGNED"
      },
      {
        "addressId":40002,
        "dataType":"O2 (%)",
        "valueRange":{"min":0,"max":25},
        "valueFormat":"MEASUREMENT_VALUE",
        "offset":-0.1,
        "encoding":"SIGNED"
      }
    ]
  }'
```

Mock response:

```json
{
  "success": true,
  "data": {
    "success": true,
    "mode": "MOCK",
    "protocol": "MODBUS_RTU",
    "stationId": "STATION_001",
    "message": "Mock connection succeeded",
    "checkedAt": "2026-05-27T13:21:00.000Z",
    "details": {
      "endpoint": "COM1:slave-1",
      "channelCount": 2
    }
  }
}
```

Create MSSQL config แบบ mock:

```bash
CONFIG_ID=$(curl -s -X POST http://localhost:3000/api/v1/device-connections \
  -H "Authorization: Bearer $OPERATOR_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{
    "stationId":"STATION_001",
    "protocol":"MSSQL",
    "settings":{
      "hostIp":"192.168.1.254",
      "port":1433,
      "dbUser":"sensor_user",
      "dbPass":"secret-pass",
      "dbName":"sensor_db"
    },
    "channels":[
      {
        "addressId":40001,
        "dataType":"COD (mg/L)",
        "offset":-0.5
      },
      {
        "addressId":40002,
        "dataType":"BOD (mg/L)",
        "offset":0
      }
    ]
  }' | python3 -c "import sys,json;print(json.load(sys.stdin)['data']['id'])")
```

Response จะ mask `settings.dbPass` เป็น `********` เสมอ:

```json
{
  "success": true,
  "data": {
    "id": 1,
    "stationId": "STATION_001",
    "protocol": "MSSQL",
    "settings": {
      "hostIp": "192.168.1.254",
      "port": 1433,
      "dbUser": "sensor_user",
      "dbPass": "********",
      "dbName": "sensor_db"
    },
    "channels": [
      {
        "addressId": 40001,
        "dataType": "COD (mg/L)",
        "offset": -0.5
      }
    ],
    "createdBy": 42,
    "createdAt": "2026-05-27T13:21:00.000Z",
    "updatedAt": "2026-05-27T13:21:00.000Z"
  }
}
```

List/detail:

```bash
curl "http://localhost:3000/api/v1/device-connections?stationId=STATION_001"

curl "http://localhost:3000/api/v1/device-connections/$CONFIG_ID"
```

### 5.9 Parameter values API

API ชุดนี้ดึงค่าพารามิเตอร์จากฐาน external parameter ingestion ตาม env `PARAMETER_DB_*`:

```text
PARAMETER_DB_NAME=parameter_ingest
PARAMETER_DB_SCHEMA=ingest
```

GET endpoints ต้องส่ง `Authorization: Bearer <accessToken>` และต้องมี permission
`cems_wpms_requests:view`:

```text
GET /parameter-values/tables
GET /parameter-values?stationId=S0001&interval=real&startDate=2026-06-04&endDate=2026-06-04
GET /parameter-values/latest?stationId=S0001&interval=real
GET /parameter-values/connection-test?stationId=S0001
```

การมองเห็น station อิงจากฐาน POMS หลัก:

- scope `ALL` เห็น station ที่มีใน `cems_wpms_measurement_points`
- scope `OWN_FACTORY` เห็นเฉพาะ station ของโรงงาน/นิติบุคคลตัวเอง
- demo seed ผูก `operator_demo` กับ `S0001` ผ่าน request `CEMS-DEMO-S0001`
- response ของ `latest` และ list rows จะคืนเฉพาะ base columns (`station_id`, `cdate`, `ctime`, `udate`, `utime`) และกลุ่มคอลัมน์ของ parameter ที่ลงทะเบียนไว้ใน `cems_wpms_measurement_points.parameters_json` เช่น `NOx` จะคืน `nox_value`, `nox_units`, `nox_status`

Interval ที่รองรับ:

```text
real, 1m, 5m, 60m, 1day, test
```

List tables:

```bash
curl "http://localhost:3000/api/v1/parameter-values/tables" \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

Latest row:

```bash
curl "http://localhost:3000/api/v1/parameter-values/latest?stationId=S0001&interval=real" \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

Connection test rows ล่าสุด 5 แถวจากตาราง `ingest.S0001_data_test`:

```bash
curl "http://localhost:3000/api/v1/parameter-values/connection-test?stationId=S0001" \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

Rows by date range:

```bash
curl "http://localhost:3000/api/v1/parameter-values?stationId=S0001&interval=real&startDate=2026-06-04&endDate=2026-06-04" \
  -H "Authorization: Bearer $ACCESS_TOKEN"
```

Expected response metadata:

```json
{
  "success": true,
  "meta": {
    "stationId": "S0001",
    "interval": "real",
    "schemaName": "ingest",
    "tableName": "S0001_data_real",
    "startDate": "2026-06-04",
    "endDate": "2026-06-04",
    "count": 1,
    "registeredParameters": ["NOx", "SO2", "O2"],
    "returnedColumns": [
      "station_id",
      "nox_value",
      "nox_units",
      "nox_status",
      "so2_value",
      "so2_units",
      "so2_status",
      "o2_value",
      "o2_units",
      "o2_status",
      "cdate",
      "ctime"
    ]
  }
}
```

Expected connection test response shape:

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

Seed สำหรับผูก station demo:

```bash
cd backend
npm run db:seed
```

หรือถ้าต้องยิงผ่าน SSMS ให้รัน `backend/db/seed_operator_demo_s0001_station_access.sql`
ในฐาน POMS หลัก แล้วค่อยรัน seed ข้อมูล mock parameter ในฐาน `parameter_ingest`.

---

## 6. ดูข้อมูลใน DB ตรง ๆ

```bash
# Login เข้า sqlcmd
docker exec -it poms-mssql /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P "$SA_PASSWORD" -C -d POMS

# Query examples
1> SELECT * FROM users;
2> GO

1> SELECT u.username, r.code AS role FROM users u
2>   JOIN user_roles ur ON ur.user_id = u.id
3>   JOIN roles r ON r.id = ur.role_id;
4> GO

# Exit: type "exit"
```

หรือใช้ GUI:
- **Azure Data Studio** (free, Microsoft) — connect to `localhost:1433`, user `sa`, pass from local `SA_PASSWORD`
- **DBeaver** (free, cross-platform)
- **TablePlus** (paid)

---

## 7. Restart server หลังแก้ code

`npm run dev` ใช้ `tsx watch` — แก้ไฟล์แล้ว reload อัตโนมัติ ไม่ต้อง restart manual

ยกเว้น:
- แก้ `.env` → ต้อง restart (Ctrl+C → `npm run dev`)
- แก้ migration/seed → ต้อง:
  ```bash
  npm run db:rollback   # ถ้าจะกลับไป version ก่อน
  # หรือ drop+recreate DB:
  docker exec poms-mssql /opt/mssql-tools18/bin/sqlcmd -S localhost -U sa -P "$SA_PASSWORD" -C \
    -Q "ALTER DATABASE POMS SET SINGLE_USER WITH ROLLBACK IMMEDIATE; DROP DATABASE POMS; CREATE DATABASE POMS;"
  npm run db:migrate
  npm run db:seed
  ```

---

## 8. Common troubleshooting

| Problem | Fix |
| ------- | --- |
| `EADDRINUSE: port 3000` | มี process กิน port → `lsof -ti:3000 \| xargs kill -9` |
| `Login failed for user 'sa'` | DB_PASSWORD ใน `.env` ไม่ตรงกับค่า `SA_PASSWORD` ของ local container |
| `Cannot find module '@modules/...'` | path alias ใน tsconfig ใช้ relative path import ตอนนี้ ลอง import แบบ `'../../modules/...'` |
| Server boot OK แต่ login 500 | DB ไม่ได้ migrate/seed — รัน `npm run db:migrate && npm run db:seed` |
| Thai chars → `?` | column ต้องเป็น NVARCHAR ไม่ใช่ VARCHAR — ดู bug session #5 ใน PROGRESS.md |
