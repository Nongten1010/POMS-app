# Auth API

ไฟล์นี้อธิบาย API สำหรับ login, ตรวจผู้ใช้ปัจจุบัน และโครง permission ที่ frontend ใช้เปิด/ปิดเมนูหรือ action

## Endpoints

| Method | Path | Auth | Rate Limit | Description |
| --- | --- | --- | --- | --- |
| `POST` | `/api/v1/auth/login` | No | 10 ครั้ง / 15 นาที | Login และรับ `accessToken` |
| `GET` | `/api/v1/auth/me` | Yes | global limit | ดึง profile และ permission ของ token ปัจจุบัน |

## `POST /api/v1/auth/login`

ใช้ login ได้ 3 ประเภทผู้ใช้: เจ้าหน้าที่, ผู้ประกอบการ, ประชาชนทั่วไป

หมายเหตุฝั่ง backend: login เดิมยังทำงานเหมือนเดิม โดยระบบจะตรวจ local POMS account ก่อน จากนั้นใช้ identity provider หลัก (`IDENTITY_PROVIDER=mock` ใน demo). ถ้าเปิด `DIW_USER_LOGIN_ENABLED=true` ผู้ประกอบการ (`userType: "operator"`) จะมี fallback เพิ่มไปยัง DIW `UserLogin` API ด้วย `clientId + username + password`; ถ้าเปิด `DIW_OFFICER_LOGIN_ENABLED=true` เจ้าหน้าที่ (`userType: "officer"`) จะมี fallback เพิ่มไปยัง DIW DPIS `UserLogin` API ด้วย `clientId + username + password + departmentID`. `ClientID` ต้องเก็บใน env `DIW_USER_LOGIN_CLIENT_ID` เท่านั้น ห้าม hardcode ลง source code.

### Request Body

```json
{
  "userType": "officer",
  "provider": "local",
  "username": "citizenID-or-UID",
  "password": "password",
  "departmentID": "2"
}
```

| Field | Type | Required | Validation | Description |
| --- | --- | --- | --- | --- |
| `userType` | string | Yes | `officer`, `operator`, `citizen` | ประเภทผู้ใช้ |
| `provider` | string | No | `local` เท่านั้นถ้าส่งมา | ใช้ local POMS account แทน external/mock IdP |
| `username` | string | Yes | trim, 1-64 chars | เลขบัตรประชาชน, UID, หรือ username |
| `password` | string | Yes | 1-128 chars | รหัสผ่าน |
| `departmentID` | string | No | trim, 1-32 chars | ใช้กับ officer external/mock flow |

### User Type Values

| Label | Value |
| --- | --- |
| เจ้าหน้าที่ | `officer` |
| ผู้ประกอบการ | `operator` |
| ประชาชนทั่วไป | `citizen` |

### Department ID Values

| Label | Value |
| --- | --- |
| สำนักงานปลัดกระทรวงอุตสาหกรรม | `1` |
| กรมโรงงานอุตสาหกรรม | `2` |
| การนิคมแห่งประเทศไทย | `8` |
| หน่วยงานอื่นๆ | `0` |

### Success Response

```json
{
  "accessToken": "jwt-token",
  "user": {
    "userType": "officer",
    "username": "1234567890123",
    "fullName": "สมชาย ใจดี",
    "department": "กรมโรงงานอุตสาหกรรม",
    "lineNameTh": "นักวิชาการ",
    "levelNameTh": "ชำนาญการ",
    "roles": "diw_central",
    "isActive": true,
    "regionalAccess": {
      "regions": ["ภาคตะวันออก"]
    },
    "ownedFactoryIds": ["FAC001"]
  },
  "permissions": {
    "dashboard": {
      "data": "ALL",
      "view": true
    }
  }
}
```

### Response Fields

| Field | Type | Description |
| --- | --- | --- |
| `accessToken` | string | JWT สำหรับส่งใน `Authorization: Bearer <token>` |
| `user.userType` | string | `officer`, `operator`, `citizen`, หรือ `admin` |
| `user.username` | string | identifier ที่ frontend แสดงหรืออ้างอิง |
| `user.fullName` | string | ชื่อเต็ม |
| `user.department` | string/null | หน่วยงาน |
| `user.lineNameTh` | string/null | สายงาน |
| `user.levelNameTh` | string/null | ระดับตำแหน่ง |
| `user.roles` | string | role code หลัก |
| `user.isActive` | boolean | สถานะการใช้งาน |
| `user.regionalAccess` | object/null | ภาคที่เจ้าหน้าที่รับผิดชอบ ถ้ามีค่า backend จะจำกัดข้อมูลคำขอ/โรงงานตาม `regions` เพิ่มจาก permission scope |
| `user.ownedFactoryIds` | string[] | โรงงานที่ผู้ใช้เป็นเจ้าของ ใช้กับ operator ถ้ามี |
| `permissions` | object | permission group สำหรับ UI |

## `GET /api/v1/auth/me`

ใช้ตรวจ token และ refresh state ฝั่ง frontend หลัง reload หน้า

### Headers

```http
Authorization: Bearer <accessToken>
```

### Success Response

เหมือน `POST /auth/login` แต่ไม่มี `accessToken`

```json
{
  "user": {
    "userType": "officer",
    "username": "1234567890123",
    "fullName": "สมชาย ใจดี",
    "department": "กรมโรงงานอุตสาหกรรม",
    "lineNameTh": "นักวิชาการ",
    "levelNameTh": "ชำนาญการ",
    "roles": "diw_central",
    "isActive": true,
    "regionalAccess": {
      "regions": ["ภาคตะวันออก"]
    }
  },
  "permissions": {
    "permissions": {
      "data": "ALL",
      "view": true
    }
  }
}
```

## Role Codes

| Code | ชื่อไทย | ใช้กับ |
| --- | --- | --- |
| `public_anonymous` | ประชาชน ไม่ login | public/no auth |
| `public_user` | ประชาชน login | citizen login |
| `factory_operator` | โรงงาน/ผู้ประกอบการ | operator |
| `diw_central` | กรอ. | เจ้าหน้าที่ กรอ. ส่วนกลาง |
| `provincial_office` | สอจ. | สำนักงานอุตสาหกรรมจังหวัด |
| `industrial_estate` | กนอ. | การนิคมฯ |
| `monitoring_kpm` | เจ้าหน้าที่ศูนย์เฝ้า กฝม. | monitoring |
| `monitoring_5_centers` | เจ้าหน้าที่ศูนย์เฝ้า 5 ศูนย์ | regional monitoring |
| `center_director` | ผอ.ศูนย์ | director |
| `kpm_director` | ผอ.กฝม. | director |
| `kwp_director` | ผอ.กวภ. | director |
| `admin` | Admin | ผู้ดูแลระบบ |

## Permission Groups

ค่าที่ส่งใน `permissions` เป็น object แยกตาม module โดยแต่ละ module มี `data` เป็น scope และ action เป็น boolean

หมายเหตุ: permission code ที่ใช้ตรวจ route บางตัวถูก alias ก่อนส่งให้ frontend เช่น `cems_wpms_requests:view` จะอยู่ใต้ response module `connection.view`, `permissions:manage` จะอยู่ใต้ `permissions.view`, และ `eligible_factories:manage` จะอยู่ใต้ `eligible_factories.view`

หมายเหตุการจำกัดภาค: ถ้า `user.regionalAccess` มีค่า ระบบจะฝังค่านี้ลง JWT และกรอง endpoint อ่านข้อมูลคำขอ/โรงงาน เช่น `/cems-wpms-requests`, `/operator-factory-dashboard`, detail/config/statistics ตาม snapshot `regionCode`/`regionName` หรือ `provinces.region` แม้ permission scope ของ role จะเป็น `ALL`

การกำหนด/แก้ไข `regionalAccess` ผ่าน user management ต้องใช้สิทธิ์ `permissions:manage`

| Module | Actions |
| --- | --- |
| `dashboard` | `view`, `favorite`, `search`, `advanced_search`, `statistics`, `export` |
| `factories` | `view`, `edit`, `approve` |
| `connection` | `view`, `edit`, `approve` |
| `kwp_forms` | `view`, `edit`, `approve` |
| `bod_cod_errors` | `view`, `edit`, `approve` |
| `notifications` | `view`, `view_status`, `edit`, `approve` |
| `statistics` | `view` |
| `conditional_search` | `view` |
| `helpdesk` | `view` |
| `feedback` | `view` |
| `laws` | `view`, `edit` |
| `faq` | `view`, `edit` |
| `chat` | `view`, `edit` |
| `permissions` | `view` |
| `eligible_factories` | `view` |
| `api_documentation` | `view` |

## Errors

| HTTP | Code | Case |
| --- | --- | --- |
| `400` | `VALIDATION_ERROR` | field ไม่ครบหรือชนิดผิด |
| `401` | `UNAUTHORIZED` | username/password ผิด, token หาย, token หมดอายุ |
| `429` | `RATE_LIMITED` | login เกิน 10 ครั้งใน 15 นาที |
