# Frontend Test Handoff

เอกสารนี้คือข้อมูลขั้นต่ำที่ frontend ต้องใช้เพื่อทดสอบกับ POMS backend ในเครื่อง local

## 1. เปิด backend

จากโฟลเดอร์ `backend`:

```bash
docker compose up -d
npm install
npm run db:migrate
npm run db:seed
npm run dev
```

หรือใช้คำสั่งเดียวสำหรับ setup + smoke test:

```bash
npm run test:api:local
```

คำสั่งนี้จะเตรียม MSSQL, migrate, seed, เปิด/เช็ค backend และยิง smoke test ให้ครบ

ถ้าต้องการเปิด backend ค้างไว้ให้ frontend เรียก:

```bash
npm run dev
```

Backend จะอยู่ที่:

```text
http://localhost:3000
```

API prefix:

```text
/api/v1
```

Frontend env ที่แนะนำ:

```env
VITE_API_BASE_URL=http://localhost:3000/api/v1
```

## 2. Health check

```http
GET http://localhost:3000/health
```

Expected:

```json
{
  "success": true,
  "status": "ok"
}
```

## 3. Login endpoint

```http
POST http://localhost:3000/api/v1/auth/login
Content-Type: application/json
```

### Admin officer

```json
{
  "userType": "officer",
  "username": "weekit",
  "departmentID": "2",
  "password": "demo1234"
}
```

### KPM officer

```json
{
  "userType": "officer",
  "username": "officer_kpm",
  "departmentID": "2",
  "password": "demo1234"
}
```

### Provincial officer

```json
{
  "userType": "officer",
  "username": "officer_sng",
  "departmentID": "2",
  "password": "demo1234"
}
```

### Operator

```json
{
  "userType": "operator",
  "citizenId": "3191000135709",
  "password": "demo1234"
}
```

### Citizen

```json
{
  "userType": "citizen",
  "username": "citizen_demo",
  "password": "demo1234"
}
```

## 4. Login response shape

Frontend ใช้ `data.accessToken` สำหรับเรียก endpoint ที่ต้อง login

```json
{
  "success": true,
  "data": {
    "accessToken": "eyJ...",
    "expiresIn": 900,
    "user": {
      "id": 1,
      "userType": "admin",
      "username": "weekit",
      "firstName": "วีกิจ",
      "lastName": "ชมญาติ"
    },
    "profile": {},
    "roles": ["admin"],
    "scopes": {
      "factories:view": "ALL"
    },
    "permissions": ["dashboard:view", "factories:view"]
  }
}
```

หมายเหตุ: `permissions` และ `scopes` จะต่างกันตาม role

## 5. Get current user

```http
GET http://localhost:3000/api/v1/auth/me
Authorization: Bearer <accessToken>
```

Expected:

```json
{
  "success": true,
  "data": {
    "id": 1,
    "userType": "admin",
    "roles": ["admin"],
    "scopes": {},
    "permissions": []
  }
}
```

## 6. Error cases ที่ frontend ควรรองรับ

Wrong password:

```http
POST /api/v1/auth/login
```

Expected status:

```text
401
```

Missing required fields:

```text
400
```

No token / invalid token:

```text
401
```

Unknown route:

```text
404
```

## 7. Quick manual test

```bash
curl http://localhost:3000/health
```

```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"userType":"officer","username":"weekit","departmentID":"2","password":"demo1234"}'
```

## 8. Backend smoke test

ถ้า frontend บอกว่าเรียก backend ไม่ได้ ให้เช็คฝั่ง backend ด้วย:

```bash
npm run test:api:local
```

ถ้าผ่าน `All 15 tests passed` แปลว่า backend พร้อมใช้งาน
