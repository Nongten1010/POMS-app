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

Login เป็น operator เพื่อสร้างคำขอ:

```bash
OPERATOR_TOKEN=$(curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"userType":"operator","username":"operator_demo","password":"demo1234"}' \
  | python3 -c "import sys,json;print(json.load(sys.stdin)['data']['accessToken'])")
```

สร้างแบบฟอร์มคำขอเพิ่มจุดตรวจวัด:

```bash
REQUEST_ID=$(curl -s -X POST http://localhost:3000/api/v1/cems-wpms-requests \
  -H "Authorization: Bearer $OPERATOR_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{
    "factoryId":"factory-001",
    "factoryName":"บริษัท ทดสอบ จำกัด",
    "factoryRegistrationNo":"3-106-33/50สบ",
    "systemType":"CEMS",
    "contactName":"สมชาย ใจดี",
    "contactPhone":"0812345678",
    "contactEmail":"ops@example.com",
    "measurementPoints":[{
      "pointName":"ปล่องระบาย A",
      "pointCode":"STACK-A",
      "pointType":"STACK",
      "latitude":13.7563,
      "longitude":100.5018,
      "parameters":["NOx","SO2","PM"],
      "description":"จุดตรวจวัดหลัก"
    }],
    "remarks":"ขอเชื่อมต่อระบบใหม่"
  }' | python3 -c "import sys,json;print(json.load(sys.stdin)['data']['id'])")
```

Login เป็นเจ้าหน้าที่ กฝม. แล้วอนุมัติแบบ:

```bash
OFFICER_TOKEN=$(curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"userType":"officer","username":"officer_kpm","departmentID":"2","password":"demo1234"}' \
  | python3 -c "import sys,json;print(json.load(sys.stdin)['data']['accessToken'])")

curl -X POST "http://localhost:3000/api/v1/cems-wpms-requests/$REQUEST_ID/review" \
  -H "Authorization: Bearer $OFFICER_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"decision":"APPROVE_DESIGN","officerNote":"แบบถูกต้อง"}'
```

ผู้ประกอบการยืนยันว่า config และส่งค่าเข้าระบบได้แล้วภายใน 30 วัน:

```bash
curl -X POST "http://localhost:3000/api/v1/cems-wpms-requests/$REQUEST_ID/confirm-connection" \
  -H "Authorization: Bearer $OPERATOR_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"note":"ส่งค่าเข้าระบบได้แล้ว"}'
```

เจ้าหน้าที่ตรวจค่าในระบบแล้วปิดงาน:

```bash
curl -X POST "http://localhost:3000/api/v1/cems-wpms-requests/$REQUEST_ID/verify-connection" \
  -H "Authorization: Bearer $OFFICER_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"note":"ตรวจสอบค่าในระบบแล้ว"}'
```

ถ้าต้องการทดสอบ case แก้ไขแบบ ให้เปลี่ยน review step เป็น:

```bash
curl -X POST "http://localhost:3000/api/v1/cems-wpms-requests/$REQUEST_ID/review" \
  -H "Authorization: Bearer $OFFICER_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"decision":"REQUEST_REVISION","revisionReason":"เพิ่มรายละเอียดจุดตรวจวัด"}'
```

แล้วส่งแบบเดิมอีกครั้งด้วย:

```bash
curl -X PUT "http://localhost:3000/api/v1/cems-wpms-requests/$REQUEST_ID/form" \
  -H "Authorization: Bearer $OPERATOR_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{...body shape เดียวกับตอน POST...}'
```

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
