# D-POMS API Reference

เอกสารนี้ใช้เป็นข้อมูลอ้างอิงสำหรับ agent ที่ทำงานกับ D-POMS frontend

## API Document Index

| Area | Document |
| --- | --- |
| Authentication | เอกสารนี้ |
| CEMS/WPMS request workflow | [APIDoc/CEMS_WPMS_REQUEST_APIS.md](./APIDoc/CEMS_WPMS_REQUEST_APIS.md) |

## Authentication

### Login

- Method: `POST`
- URL: `http://d-poms.diw.go.th/api/v1/auth/login`
- Content-Type: `application/json`

#### Request Body

```json
{
  "accountType": "api",
  "userType": "officer",
  "username": "U-code-or-13-digit-login",
  "password": "password",
  "departmentID": "2"
}
```

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `accountType` | string | Recommended | `poms` ตรวจเฉพาะบัญชีที่สร้างใน POMS; `api` ตรวจเฉพาะ external API. Request เก่าที่ยังไม่ส่งค่านี้รองรับชั่วคราวเท่านั้น |
| `userType` | string | Yes | ประเภทผู้ใช้งาน: `officer`, `operator`, `citizen` |
| `username` | string | Yes | เลขบัตรประชาชน หรือ UID |
| `password` | string | Yes | รหัสผ่าน |
| `departmentID` | string | เมื่อเป็น API officer | รหัสหน่วยงานสำหรับเจ้าหน้าที่ API; บัญชี POMS ไม่ต้องส่ง |

#### User Types

| Label | Value |
| --- | --- |
| เจ้าหน้าที่ | `officer` |
| ผู้ประกอบการ | `operator` |
| ประชาชนทั่วไป | `citizen` |

#### Department IDs

ใช้เฉพาะเมื่อ `userType = officer`

| Label | Value |
| --- | --- |
| สำนักงานปลัดกระทรวงอุตสาหกรรม | `1` |
| กรมโรงงานอุตสาหกรรม | `2` |
| การนิคมอุตสาหกรรมแห่งประเทศไทย | `8` |
| หน่วยงานอื่นๆ | `0` |

#### Response Body

```json
{
  "accessToken": "string",
  "user": {
    "accountType": "api",
    "username": "string",
    "fullName": "string",
    "prenameTh": "นาย",
    "firstName": "สมชาย",
    "lastName": "ทดสอบ",
    "name": {
      "prenameTh": "นาย",
      "firstName": "สมชาย",
      "lastName": "ทดสอบ",
      "fullName": "นายสมชาย ทดสอบ"
    },
    "department": "string",
    "lineNameTh": "string",
    "levelNameTh": "string",
    "mposition": "วิศวกร",
    "organize": "ฝ่ายบริการผู้ประกอบกิจการ",
    "division": "กองอนุญาตผู้ประกอบกิจการ",
    "provinceId": "1021",
    "roles": "diw_central",
    "roleCodes": ["diw_central"],
    "officerProfile": {
      "lineNameTh": "string",
      "levelNameTh": "string",
      "mposition": "วิศวกร",
      "organize": { "id": "40100", "name": "ฝ่ายบริการผู้ประกอบกิจการ" },
      "division": "กองอนุญาตผู้ประกอบกิจการ",
      "department": { "id": "01000", "name": "การนิคมอุตสาหกรรมแห่งประเทศไทย" }
    },
    "isActive": true,
    "regionalAccess": {
      "regions": ["ภาคตะวันออก"]
    }
  },
  "permissions": {
    "dashboard": {
      "data": "ALL",
      "view": true,
      "favorite": true,
      "search": true,
      "advanced_search": true,
      "statistics": true,
      "export": true
    },
    "factories": {
      "data": "IN_PROVINCE",
      "region": null,
      "province": "ระยอง",
      "view": true,
      "edit": true,
      "approve": true
    },
    "connection": {
      "data": "ALL",
      "view": true,
      "edit": true,
      "approve": true
    },
    "kwp_forms": {
      "data": "ALL",
      "view": true,
      "edit": true,
      "approve": true
    },
    "bod_cod_errors": {
      "data": "ALL",
      "view": true,
      "edit": true,
      "approve": true
    },
    "notifications": {
      "data": "ALL",
      "view": true,
      "view_status": true,
      "edit": true,
      "approve": true
    },
    "statistics": {
      "data": "ALL",
      "view": true
    },
    "conditional_search": {
      "data": "ALL",
      "view": true
    },
    "helpdesk": {
      "data": "ALL",
      "view": true
    },
    "feedback": {
      "data": "ALL",
      "view": true
    },
    "laws": {
      "data": "ALL",
      "view": true,
      "edit": true
    },
    "faq": {
      "data": "ALL",
      "view": true,
      "edit": true
    },
    "chat": {
      "data": "ALL",
      "view": true,
      "edit": true
    },
    "permissions": {
      "data": "ALL",
      "view": true
    },
    "eligible_factories": {
      "data": "ALL",
      "view": true
    },
    "api_documentation": {
      "data": "ALL",
      "view": true
    }
  }
}
```

#### Login Response Fields

| Field | Type | Description |
| --- | --- | --- |
| `accessToken` | string | Token สำหรับส่งใน `Authorization` header ของ API ที่ต้อง login |
| `user` | object | ข้อมูลผู้ใช้งาน |
| `permissions` | object | สิทธิ์การใช้งานตาม module/action |

#### User Response Fields

| Field | Type | Description |
| --- | --- | --- |
| `accountType` | `poms`/`api` | ประเภทบัญชีสาธารณะ derive จาก internal provider |
| `username` | string | account login key ของช่องทางนั้น เช่น POMS username, U-code หรือเลข 13 หลัก; ไม่ derive จาก `percardno`/`per_cardno` |
| `fullName` | string | ชื่อ-นามสกุล |
| `prenameTh` | string/null | คำนำหน้าชื่อภาษาไทยจาก DIW Officer Login V2 |
| `firstName` | string | ชื่อภาษาไทย |
| `lastName` | string | นามสกุลภาษาไทย |
| `department` | string | หน่วยงาน |
| `lineNameTh` | string | สายงานภาษาไทย |
| `levelNameTh` | string | ระดับภาษาไทย |
| `mposition` | string/null | ตำแหน่งบริหาร/ตำแหน่งงานจาก `mposition` |
| `organize` | string/null | legacy alias ของ `officerProfile.organize.name`; ไม่มี ID fallback |
| `division` | string/null | legacy alias ของ `officerProfile.division`; ไม่มี `division_id` fallback |
| `provinceId` | string/null | รหัสจังหวัดของเจ้าหน้าที่จาก `officer_profiles.province_id`; ใช้กับ scope `IN_PROVINCE` |
| `provinceName` | string/null | ชื่อจังหวัดภาษาไทยใน API จัดการผู้ใช้ ดึงจาก `provinces.name_th` ตาม `provinceId` |
| `roles` | string | บทบาทผู้ใช้งาน ดูรายการค่าที่เป็นไปได้ในหัวข้อ Role Codes |
| `roleCodes` | string[] | บทบาททั้งหมดของผู้ใช้; frontend ใหม่ควรใช้ field นี้แทน `roles` |
| `name` | object | โครงสร้างชื่อ canonical; flat name fields ยังอยู่ช่วง compatibility |
| `officerProfile` | object/null | โครงสร้างสายงาน/ระดับ/ตำแหน่ง/หน่วยงาน; `null` สำหรับ user ที่ไม่มี officer profile |
| `isActive` | boolean | สถานะการใช้งาน |
| `regionalAccess` | object/null | ภาคที่เจ้าหน้าที่รับผิดชอบ ถ้ามีค่า backend จะกรองคำขอ/โรงงานตาม `regions` เพิ่มจาก permission scope |

#### Managed User Form Save Contract

ใช้กับหน้าจัดการสิทธิ์การใช้งาน:

- `POST /api/v1/users/local-accounts`
- `PATCH /api/v1/users/:id`

ฟอร์มสิทธิ์การใช้งานต้องส่งภาค/จังหวัดเฉพาะรายเมนูใน `permissions.<module>` เท่านั้น ไม่ส่ง `provinceId`, `provinceName`, `regionName`, `regions`, หรือ `regionalAccess` ใน object `user`:

```json
{
  "user": {
    "fullName": "สมชาย ทดสอบ",
    "username": "local_officer",
    "password": "",
    "department": "สำนักงานปลัดกระทรวงอุตสาหกรรม",
    "lineNameTh": "นักวิชาการอุตสาหกรรม",
    "levelNameTh": "ชำนาญการ",
    "roles": "monitoring_5_centers",
    "isActive": true
  },
  "permissions": {
    "dashboard": {
      "data": "IN_REGION",
      "region": "ภาคตะวันออก",
      "province": "all",
      "view": true,
      "search": true
    },
    "factories": {
      "data": "IN_PROVINCE",
      "region": "all",
      "province": "ระยอง",
      "view": true
    }
  }
}
```

Backend accepts per-menu permission location fields:

| Field | Type | Description |
| --- | --- | --- |
| `permissions.<module>.data` | string/null | `ALL`, `IN_REGION`, `IN_PROVINCE`, `IN_ESTATE`, `OWN_FACTORY`, หรือ `null` |
| `permissions.<module>.region` | string/null | ใช้เมื่อ `data = IN_REGION`; ส่ง `null`, `"all"`, หรือค่าว่างได้เพื่อไม่ล็อกภาค; ถ้ามีค่า backend เก็บใน `user_permissions.region_name` |
| `permissions.<module>.province` | string/null | ใช้เมื่อ `data = IN_PROVINCE`; ส่ง `null`, `"all"`, หรือค่าว่างได้เพื่อไม่ล็อกจังหวัด; ถ้ามีค่ารับได้ทั้งชื่อจังหวัดไทยหรือรหัสจังหวัด แล้ว backend เก็บเป็น `user_permissions.province_id` |
| `permissions.<module>.<action>` | boolean | เปิด/ปิด action ในเมนูนั้น เช่น `view`, `edit`, `approve`, `search` |

Response จาก `GET /api/v1/users/:id` หลังบันทึก และ `POST /api/v1/auth/login` / `GET /api/v1/auth/me` สำหรับผู้ใช้เดียวกัน:

```json
{
  "user": {
    "username": "local_officer",
    "fullName": "สมชาย ทดสอบ",
    "department": "สำนักงานปลัดกระทรวงอุตสาหกรรม",
    "lineNameTh": "นักวิชาการอุตสาหกรรม",
    "levelNameTh": "ชำนาญการ",
    "roles": "monitoring_5_centers",
    "isActive": true
  },
  "permissions": {
    "dashboard": {
      "data": "IN_REGION",
      "region": "ภาคตะวันออก",
      "province": null,
      "view": true,
      "search": true
    },
    "factories": {
      "data": "IN_PROVINCE",
      "region": null,
      "province": "ระยอง",
      "view": true
    }
  }
}
```

หมายเหตุ: `accessToken` ยังเก็บ `scopes` เป็นค่า scope ต่อ permission code เช่น `"factories:view": "IN_PROVINCE"` เพื่อให้ middleware เดิมอ่านได้ ส่วนค่า `region`/`province` ส่งกลับใน `permissions` response สำหรับ frontend ใช้แสดงและ round-trip ฟอร์ม

#### Role Codes

| Code | nameTh | nameEn | ใช้กับ UI |
| --- | --- | --- | --- |
| `public_anonymous` | ประชาชน ไม่ login | Public Anonymous | public/no auth เท่านั้น ปกติไม่ต้องใช้ในฟอร์มเจ้าหน้าที่ |
| `public_user` | ประชาชน login | Public Logged-in | citizen login |
| `factory_operator` | โรงงาน (ผู้ประกอบการ) | Factory Operator | ผู้ประกอบการ/โรงงาน |
| `diw_central` | กรอ. | DIW Central | เจ้าหน้าที่ กรอ. ส่วนกลาง |
| `provincial_office` | สอจ. | Provincial Industrial Office | สำนักงานอุตสาหกรรมจังหวัด |
| `industrial_estate` | กนอ. | Industrial Estate Authority | การนิคมฯ |
| `monitoring_kpm` | เจ้าหน้าที่ศูนย์เฝ้า (กฝม.) | Pollution Monitoring (KPM) | เจ้าหน้าที่ กฝม. |
| `monitoring_5_centers` | เจ้าหน้าที่ศูนย์เฝ้า (5 ศูนย์) | Regional Centers (5) | เจ้าหน้าที่ 5 ศูนย์ภูมิภาค |
| `center_director` | ผอ.ศูนย์ | Center Director | ผู้อำนวยการศูนย์ |
| `kpm_director` | ผอ.กฝม. | KPM Director | ผู้อำนวยการ กฝม. |
| `kwp_director` | ผอ.กวภ. | KWP Director | ผู้อำนวยการ กวภ. |
| `admin` | Admin | Administrator | ผู้ดูแลระบบ |

### Me

- Method: `GET`
- URL: `http://d-poms.diw.go.th/api/v1/auth/me`

#### Headers Request

| Header | Type | Required | Description |
| --- | --- | --- | --- |
| `Authorization` | string | Yes | `Bearer <accessToken>` |

#### Response Body

เหมือน `POST http://d-poms.diw.go.th/api/v1/auth/login` แต่ไม่มี `accessToken`

```json
{
  "user": {
    "username": "string",
    "fullName": "string",
    "prenameTh": "นาย",
    "firstName": "สมชาย",
    "lastName": "ทดสอบ",
    "department": "string",
    "lineNameTh": "string",
    "levelNameTh": "string",
    "mposition": "วิศวกร",
    "organize": "ฝ่ายบริการผู้ประกอบกิจการ",
    "division": "กองอนุญาตผู้ประกอบกิจการ",
    "roles": "diw_central",
    "isActive": true,
    "regionalAccess": {
      "regions": ["ภาคตะวันออก"]
    }
  },
  "permissions": {
    "dashboard": {
      "data": "ALL",
      "view": true,
      "favorite": true,
      "search": true,
      "advanced_search": true,
      "statistics": true,
      "export": true
    },
    "factories": {
      "data": "ALL",
      "view": true,
      "edit": true,
      "approve": true
    },
    "connection": {
      "data": "ALL",
      "view": true,
      "edit": true,
      "approve": true
    },
    "kwp_forms": {
      "data": "ALL",
      "view": true,
      "edit": true,
      "approve": true
    },
    "bod_cod_errors": {
      "data": "ALL",
      "view": true,
      "edit": true,
      "approve": true
    },
    "notifications": {
      "data": "ALL",
      "view": true,
      "view_status": true,
      "edit": true,
      "approve": true
    },
    "statistics": {
      "data": "ALL",
      "view": true
    },
    "conditional_search": {
      "data": "ALL",
      "view": true
    },
    "helpdesk": {
      "data": "ALL",
      "view": true
    },
    "feedback": {
      "data": "ALL",
      "view": true
    },
    "laws": {
      "data": "ALL",
      "view": true,
      "edit": true
    },
    "faq": {
      "data": "ALL",
      "view": true,
      "edit": true
    },
    "chat": {
      "data": "ALL",
      "view": true,
      "edit": true
    },
    "permissions": {
      "data": "ALL",
      "view": true
    },
    "eligible_factories": {
      "data": "ALL",
      "view": true
    },
    "api_documentation": {
      "data": "ALL",
      "view": true
    }
  }
}
```

### Permission Keys

| Module | Actions |
| --- | --- |
| `dashboard` | `data`, `view`, `favorite`, `search`, `advanced_search`, `statistics`, `export` |
| `factories` | `data`, `view`, `edit`, `approve` |
| `connection` | `data`, `view`, `edit`, `approve` |
| `kwp_forms` | `data`, `view`, `edit`, `approve` |
| `bod_cod_errors` | `data`, `view`, `edit`, `approve` |
| `notifications` | `data`, `view`, `view_status`, `edit`, `approve` |
| `statistics` | `data`, `view` |
| `conditional_search` | `data`, `view` |
| `helpdesk` | `data`, `view` |
| `feedback` | `data`, `view` |
| `laws` | `data`, `view`, `edit` |
| `faq` | `data`, `view`, `edit` |
| `chat` | `data`, `view`, `edit` |
| `permissions` | `data`, `view` |
| `eligible_factories` | `data`, `view` |
| `api_documentation` | `data`, `view` |

### Permission Data Scope

ทุก object ภายใต้ `permissions` มี field `data` เป็น string เพื่อระบุขอบเขตข้อมูลที่ใช้ได้

| Value | Description |
| --- | --- |
| `ALL` | เห็นข้อมูลทั้งหมด |
| `IN_PROVINCE` | เห็นข้อมูลในจังหวัดที่เกี่ยวข้อง |
| `IN_ESTATE` | เห็นข้อมูลในนิคมอุตสาหกรรมที่เกี่ยวข้อง |
| `OWN_FACTORY` | เห็นเฉพาะข้อมูลโรงงานของตนเอง |
| `null` | ไม่มีขอบเขตข้อมูล |
