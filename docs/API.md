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
      "alerts:view": true,
      "search:basic": true,
      "search:advanced": true,
      "stats:view": true,
      "stats:export": true
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
      "submit": true
    },
    "feedback": {
      "data": "ALL",
      "submit": true
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
      "ask": true,
      "answer": true
    },
    "permissions": {
      "data": "ALL",
      "manage": true
    },
    "eligible_factories": {
      "data": "ALL",
      "manage": true
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
| `username` | string | เลขประจำตัวผู้ใช้งานจากระบบต้นทาง เช่น `per_cardno` สำหรับเจ้าหน้าที่ |
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
      "alerts:view": true,
      "search:basic": true,
      "search:advanced": true,
      "stats:view": true,
      "stats:export": true
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
      "submit": true
    },
    "feedback": {
      "data": "ALL",
      "submit": true
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
      "ask": true,
      "answer": true
    },
    "permissions": {
      "data": "ALL",
      "manage": true
    },
    "eligible_factories": {
      "data": "ALL",
      "manage": true
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
| `dashboard` | `data`, `view`, `alerts:view`, `search:basic`, `search:advanced`, `stats:view`, `stats:export` |
| `factories` | `data`, `view`, `edit`, `approve` |
| `connection` | `data`, `view`, `edit`, `approve` |
| `kwp_forms` | `data`, `view`, `edit`, `approve` |
| `bod_cod_errors` | `data`, `view`, `edit`, `approve` |
| `notifications` | `data`, `view`, `view_status`, `edit`, `approve` |
| `helpdesk` | `data`, `submit` |
| `feedback` | `data`, `submit` |
| `laws` | `data`, `view`, `edit` |
| `faq` | `data`, `view`, `edit` |
| `chat` | `data`, `ask`, `answer` |
| `permissions` | `data`, `manage` |
| `eligible_factories` | `data`, `manage` |
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
