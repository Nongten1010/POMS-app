# API การยืนยันตัวตน

หน้านี้เป็น canonical contract สำหรับ shared authentication API:

- `POST /api/v1/auth/login`
- `GET /api/v1/auth/me`

## Quick start

แทนค่า placeholder ด้วย credential ของ environment ที่กำลังทดสอบ และห้ามบันทึกรหัสผ่านจริงลง source control หรือ log

```bash
curl --request POST 'https://d-poms.diw.go.th/api/v1/auth/login' \
  --header 'Content-Type: application/json' \
  --data '{
    "userType": "operator",
    "username": "<13-digit-username>",
    "password": "<password>"
  }'
```

เมื่อสำเร็จ backend คืน `200 OK` พร้อม `accessToken`, `user` และ `permissions` โดยการ login ครั้งแรกของ external operator ไม่เปลี่ยน response shape

## POST `/api/v1/auth/login`

### Request body

| Field          | Type                             | Required         | Notes                                                                         |
| -------------- | -------------------------------- | ---------------- | ----------------------------------------------------------------------------- |
| `userType`     | `officer \| operator \| citizen` | yes              | ประเภทผู้ใช้ที่ต้องการ login                                                  |
| `username`     | `string`                         | yes              | External `operator` ใช้เลข 13 หลัก; `officer` ใช้ username ตาม provider       |
| `password`     | `string`                         | yes              | ความยาว `1-128` ตัวอักษร                                                      |
| `departmentID` | `string`                         | officer API only | ต้องส่งเมื่อ external officer login                                           |
| `accountType`  | `poms \| api`                    | no               | Legacy route hint; client ใหม่ควรละ field นี้เพื่อให้ backend resolve account |
| `provider`     | `local`                          | no               | Legacy local-only route hint                                                  |

### Response fields

| Field                  | Type          | Notes                                                  |
| ---------------------- | ------------- | ------------------------------------------------------ |
| `accessToken`          | `string`      | JWT สำหรับส่งเป็น Bearer token                         |
| `user`                 | `object`      | ข้อมูลผู้ใช้, role และ factory IDs ที่เข้าถึงได้       |
| `user.accountType`     | `poms \| api` | External operator คืน `api`                            |
| `user.roleCodes`       | `string[]`    | External operator มี `factory_operator` เป็น base role |
| `user.ownedFactoryIds` | `string[]`    | มีเฉพาะ operator และคำนวณจากสิทธิ์โรงงานปัจจุบัน       |
| `permissions`          | `object`      | Permission groups และ data scope                       |

### พฤติกรรม external operator

1. ถ้า request ระบุ `accountType: "poms"` หรือ `provider: "local"` backend จะตรวจเฉพาะ local POMS account
2. ถ้าไม่ระบุ route hint backend จะลอง local account ก่อน แล้วจึง fallback ไป external identity provider
3. External operator ต้องใช้ submitted username 13 หลัก และ `citizen_id` ที่ DIW ส่งกลับต้องตรงกันทุกหลัก มิฉะนั้นคืน generic `401`
4. เมื่อ DIW ยืนยันสำเร็จครั้งแรก backend จะสร้าง provider-scoped identity ด้วย `identity_provider = i_industry`, assign role `factory_operator` และ sync `operator_profiles`, `juristics`, `user_juristics` และ `factories` ใน transaction เดียว
5. Login ซ้ำจะ update ข้อมูลเดิมแบบ idempotent ไม่สร้าง identity, role หรือ access row ซ้ำ
6. บัญชี inactive, soft-deleted หรือ identity เดียวกันที่เป็น `user_type` อื่นจะไม่ถูกเปิดใช้งานหรือเขียนทับ และคืน generic `401`
7. วันที่ DIW แบบ `DD/MM/YYYY HH:mm:ss` จะถูก normalize เป็น SQL-safe ISO datetime ก่อนบันทึก

### Success response (`200 OK`)

ตัวอย่างนี้ใช้ข้อมูลสังเคราะห์ทั้งหมด

```json
{
  "accessToken": "<jwt-token>",
  "user": {
    "accountType": "api",
    "userType": "operator",
    "username": "1111111111111",
    "fullName": "ผู้ใช้งาน ทดสอบ",
    "name": {
      "prenameTh": null,
      "firstName": "ผู้ใช้งาน",
      "lastName": "ทดสอบ",
      "fullName": "ผู้ใช้งาน ทดสอบ"
    },
    "prenameTh": null,
    "firstName": "ผู้ใช้งาน",
    "lastName": "ทดสอบ",
    "department": null,
    "lineNameTh": null,
    "levelNameTh": null,
    "mposition": null,
    "organize": null,
    "division": null,
    "provinceId": null,
    "roles": "factory_operator",
    "roleCodes": ["factory_operator"],
    "isActive": true,
    "officerProfile": null,
    "ownedFactoryIds": ["10100000000001"]
  },
  "permissions": {
    "factories": {
      "data": "OWN_FACTORY",
      "view": true
    }
  }
}
```

### Errors

| HTTP status | `error.code`       | Condition                                                                    |
| ----------- | ------------------ | ---------------------------------------------------------------------------- |
| `400`       | `VALIDATION_ERROR` | Body ไม่ตรง schema หรือมี field ที่ไม่รองรับ                                 |
| `401`       | `UNAUTHORIZED`     | Credential/identity ไม่ผ่าน, account inactive/deleted หรือ identity conflict |
| `429`       | `RATE_LIMITED`     | เกิน `10` attempts ต่อ IP ภายใน `15` นาที                                    |
| `500`       | `INTERNAL_ERROR`   | Provision/sync ล้มเหลวและ transaction ถูก rollback                           |

```json
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Invalid credentials"
  }
}
```

Backend ตั้งใจเก็บ `401` เป็นข้อความกลาง Client ต้องไม่อนุมานว่าล้มเหลวจาก local lookup, upstream authentication, identity mismatch, inactive/deleted account หรือ provider collision

## GET `/api/v1/auth/me`

### Request headers

| Header          | Required | Value                  |
| --------------- | -------- | ---------------------- |
| `Authorization` | yes      | `Bearer <accessToken>` |

### Success response (`200 OK`)

คืน `user` และ `permissions` shape เดียวกับ login แต่ไม่มี `accessToken`

```json
{
  "user": {
    "accountType": "api",
    "userType": "operator",
    "username": "1111111111111",
    "roleCodes": ["factory_operator"],
    "ownedFactoryIds": ["10100000000001"]
  },
  "permissions": {
    "factories": {
      "data": "OWN_FACTORY",
      "view": true
    }
  }
}
```

ถ้า token ไม่ถูกต้องหรือหมดอายุ endpoint คืน `401 UNAUTHORIZED` ด้วย shared error envelope เดียวกัน

## Maintainer links

- [Routes](../../../../../backend/src/modules/auth/auth.routes.ts) และ [controller](../../../../../backend/src/modules/auth/auth.controller.ts)
- [Service](../../../../../backend/src/modules/auth/auth.service.ts)
- [Repository provisioning](../../../../../backend/src/modules/auth/auth.repository.ts)
- [DIW identity mapping](../../../../../backend/src/modules/auth/identity-provider/diw-user-login.identity-provider.ts)
- Tests: [service](../../../../../backend/tests/unit/auth.service.test.ts), [repository](../../../../../backend/tests/unit/auth.repository.test.ts), [provider](../../../../../backend/tests/unit/diw-user-login.identity-provider.test.ts)
