# D-POMS API Reference

เอกสารนี้ใช้เป็นข้อมูลอ้างอิงสำหรับ agent ที่ทำงานกับ D-POMS frontend

## Authentication

### Login

- Method: `POST`
- URL: `http://d-poms.diw.go.th/api/v1/auth/login`
- Content-Type: `application/json`

#### Request Body

```json
{
  "userType": "officer",
  "username": "citizenID-or-UID",
  "password": "password",
  "departmentID": "2"
}
```

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `userType` | string | Yes | ประเภทผู้ใช้งาน: `officer`, `operator`, `citizen` |
| `username` | string | Yes | เลขบัตรประชาชน หรือ UID |
| `password` | string | Yes | รหัสผ่าน |
| `departmentID` | string | Required when `userType = officer` | รหัสหน่วยงานสำหรับเจ้าหน้าที่ |

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
| การนิคมแห่งประเทศไทย | `8` |
| หน่วยงานอื่นๆ | `0` |

#### Response Body

```json
{
  "accessToken": "string",
  "user": {
    "username": "string",
    "fullName": "string",
    "department": "string",
    "lineNameTh": "string",
    "levelNameTh": "string",
    "roles": "diw_central",
    "isActive": true
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
    "conditional_search": {
      "data": null,
      "view": true
    },
    "statistics": {
      "data": "ALL",
      "view": true
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
| `username` | string | ชื่อผู้ใช้งาน |
| `fullName` | string | ชื่อ-นามสกุล |
| `department` | string | หน่วยงาน |
| `lineNameTh` | string | สายงานภาษาไทย |
| `levelNameTh` | string | ระดับภาษาไทย |
| `roles` | string | บทบาทผู้ใช้งาน ดูรายการค่าที่เป็นไปได้ในหัวข้อ Role Codes |
| `isActive` | boolean | สถานะการใช้งาน |

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
    "department": "string",
    "lineNameTh": "string",
    "levelNameTh": "string",
    "roles": "diw_central",
    "isActive": true
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
    "conditional_search": {
      "data": null,
      "view": true
    },
    "statistics": {
      "data": "ALL",
      "view": true
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
| `conditional_search` | `data`, `view` |
| `statistics` | `data`, `view` |
| `factories` | `data`, `view`, `edit`, `approve` |
| `connection` | `data`, `view`, `edit`, `approve` |
| `kwp_forms` | `data`, `view`, `edit`, `approve` |
| `bod_cod_errors` | `data`, `view`, `edit`, `approve` |
| `notifications` | `data`, `view`, `view_status`, `edit`, `approve` |
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
| `null` | ไม่อนุญาต |

## Users

### Create User

- Method: `POST`
- URL: `http://d-poms.diw.go.th/api/v1/users/local-accounts`
- Content-Type: `application/json`

#### Headers Request

| Header | Type | Required | Description |
| --- | --- | --- | --- |
| `Authorization` | string | Yes | `Bearer <accessToken>` |

#### Request Body

```json
{
  "fullName": "ชื่อ-นามสกุล",
  "username": "Username",
  "password": "Password",
  "department": "สังกัด",
  "lineNameTh": "ตำแหน่ง",
  "levelNameTh": "ระดับ",
  "roles": "monitoring_kpm",
  "isActive": true
}
```

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `fullName` | string | Yes | ชื่อ-นามสกุล |
| `username` | string | Yes | Username |
| `password` | string | Yes | Password อย่างน้อย 8 ตัวอักษร |
| `department` | string | No | สังกัด |
| `lineNameTh` | string | No | ตำแหน่ง |
| `levelNameTh` | string | No | ระดับ |
| `roles` | string | Yes | สิทธิ์ในระบบ ใช้ role code จาก Role Codes |
| `isActive` | boolean | Yes | สถานะผู้ใช้งาน: `true` = ใช้งาน, `false` = ระงับใช้งาน |

### List Officers

- Method: `GET`
- URL: `http://d-poms.diw.go.th/api/v1/users?status=all`

#### Headers Request

| Header | Type | Required | Description |
| --- | --- | --- | --- |
| `Authorization` | string | Yes | `Bearer <accessToken>` |

#### Response Body

```json
{
  "success": true,
  "data": [
    {
      "id": 2,
      "username": "officer_kpm",
      "fullName": "สมหญิง รักษ์สิ่งแวดล้อม",
      "department": "กรมโรงงานอุตสาหกรรม",
      "lineNameTh": "นักวิทยาศาสตร์",
      "levelNameTh": "ชำนาญการ",
      "roles": "monitoring_kpm",
      "isActive": true
    },
    {
      "id": 3,
      "username": "officer_sng",
      "fullName": "ธีระ จังหวัดงาน",
      "department": "สำนักงานอุตสาหกรรมจังหวัดสระบุรี",
      "lineNameTh": "นักวิชาการอุตสาหกรรม",
      "levelNameTh": "ชำนาญการ",
      "roles": "provincial_office",
      "isActive": true
    }
  ],
  "meta": {
    "total": 2
  }
}
```

#### User List Fields

| Field | Type | Description |
| --- | --- | --- |
| `id` | number | รหัสผู้ใช้งาน |
| `username` | string | ชื่อผู้ใช้งาน |
| `fullName` | string | ชื่อ-นามสกุล |
| `department` | string | หน่วยงาน |
| `lineNameTh` | string | ตำแหน่ง/สายงานภาษาไทย |
| `levelNameTh` | string | ระดับภาษาไทย |
| `roles` | string | role code ของผู้ใช้งาน ใช้เทียบ `nameTh` จาก Role Codes เพื่อแสดงผล |
| `isActive` | boolean | สถานะการใช้งาน |

### Get User Detail

- Method: `GET`
- URL: `http://d-poms.diw.go.th/api/v1/users/<id>`

#### Headers Request

| Header | Type | Required | Description |
| --- | --- | --- | --- |
| `Authorization` | string | Yes | `Bearer <accessToken>` |

#### Response Body

```json
{
  "user": {
    "username": "1100000000001",
    "fullName": "นางสมหญิง รักษ์สิ่งแวดล้อม",
    "department": "กรมโรงงานอุตสาหกรรม",
    "lineNameTh": "นักวิทยาศาสตร์",
    "levelNameTh": "ชำนาญการ",
    "roles": "monitoring_kpm",
    "isActive": true,
    "source": "api"
  },
  "permissions": {
    "dashboard": {
      "data": "ALL",
      "view": true,
      "favorite": true,
      "search": true,
      "advanced_search": true,
      "statistics": true
    },
    "conditional_search": {
      "data": null,
      "view": true
    },
    "statistics": {
      "data": "ALL",
      "view": true
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
      "view": true
    },
    "helpdesk": {
      "data": null,
      "view": true
    },
    "feedback": {
      "data": null,
      "view": true
    },
    "laws": {
      "data": null,
      "view": true
    },
    "faq": {
      "data": null,
      "view": true
    },
    "chat": {
      "data": null,
      "view": true,
      "edit": true
    }
  }
}
```

#### User Detail Fields

| Field | Type | Description |
| --- | --- | --- |
| `user.username` | string | ชื่อผู้ใช้งาน |
| `user.fullName` | string | ชื่อ-นามสกุล |
| `user.department` | string | หน่วยงาน |
| `user.lineNameTh` | string | ตำแหน่ง/สายงานภาษาไทย |
| `user.levelNameTh` | string | ระดับภาษาไทย |
| `user.roles` | string | role code ของผู้ใช้งาน ใช้เทียบ `nameTh` จาก Role Codes เพื่อแสดงผล |
| `user.isActive` | boolean | สถานะการใช้งาน |
| `user.source` | string | แหล่งที่มา: `api`, `created` |
| `permissions` | object | สิทธิ์การใช้งานตาม module/action สำหรับ map ลงฟอร์ม |

#### User Source Values

| Value | Description |
| --- | --- |
| `api` | ข้อมูลมาจาก API |
| `created` | ข้อมูลถูกสร้างในระบบ |

### Delete User

- Method: `DELETE`
- URL: `http://d-poms.diw.go.th/api/v1/users/:id`

#### Headers Request

| Header | Type | Required | Description |
| --- | --- | --- | --- |
| `Authorization` | string | Yes | `Bearer <accessToken>` |

#### Path Parameters

| Field | Type | Required | Description |
| --- | --- | --- | --- |
| `id` | number/string | Yes | รหัสผู้ใช้งาน |

#### Response Body

```json
{
  "success": true
}
```

### Update User

- Method: `PATCH`
- URL: `http://d-poms.diw.go.th/api/v1/users/:id`
- Content-Type: `application/json`

#### Headers Request

| Header | Type | Required | Description |
| --- | --- | --- | --- |
| `Authorization` | string | Yes | `Bearer <accessToken>` |

#### Request Body

```json
{
  "user": {
    "username": "frontend",
    "fullName": "ภาณุ เล้าสุวรรณ",
    "department": null,
    "lineNameTh": "Develop",
    "levelNameTh": "Frontend",
    "roles": "admin",
    "isActive": true,
    "password": "Password",
    "source": "created"
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
    "conditional_search": {
      "data": "ALL",
      "view": true
    },
    "statistics": {
      "data": "ALL",
      "view": true
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
