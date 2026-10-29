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

เมื่อสำเร็จ backend คืน `200 OK` พร้อม `accessToken`, `user` และ `permissions` บัญชีที่ใช้ `role_default` รับสิทธิ์เริ่มต้นของ role; บัญชี `custom` รับชุดสิทธิ์รายคนที่บันทึกไว้ สำหรับบัญชี i-Industry citizen/operator ยังคงแยก persona ของ session ที่ผู้ใช้เลือก ไม่รวมสิทธิ์ operator เข้า citizen session

## POST `/api/v1/auth/login`

### Request body

| Field          | Type                             | Required         | Notes                                                                         |
| -------------- | -------------------------------- | ---------------- | ----------------------------------------------------------------------------- |
| `userType`     | `officer \| operator \| citizen` | yes              | ประเภทผู้ใช้ที่ต้องการ login                                                  |
| `username`     | `string`                         | yes              | External `operator` ใช้เลข 13 หลัก; `officer` ใช้ username ตาม provider       |
| `password`     | `string`                         | yes              | ความยาว `1-128` ตัวอักษร; รองรับ `*` และส่งค่าเดิมไปตรวจโดยไม่ตัดอักขระนี้        |
| `departmentID` | `string`                         | officer API only | ต้องส่งเมื่อ external officer login                                           |
| `accountType`  | `poms \| api`                    | no               | `poms` ตรวจเฉพาะ local; `api` ยังคงตรวจ local ก่อนและไม่ข้ามบัญชี POMS; client ใหม่ควรละ field นี้ |
| `provider`     | `local`                          | no               | Legacy local-only route hint                                                  |

### Response fields

| Field                  | Type          | Notes                                                  |
| ---------------------- | ------------- | ------------------------------------------------------ |
| `accessToken`          | `string`      | JWT สำหรับส่งเป็น Bearer token                         |
| `user`                 | `object`      | ข้อมูลผู้ใช้, role และ factory IDs ที่เข้าถึงได้       |
| `user.accountType`     | `poms \| api` | External i-Industry account คืน `api`                                             |
| `user.userType`        | `string`      | Effective persona ของ session; operator request อาจคืน `citizen` ตาม fallback rule |
| `user.prenameTh`, `user.name.prenameTh` | `string \| null` | คำนำหน้าภาษาไทย; รองรับได้ถึง 64 ตัวอักษร รวมคำนำหน้าเจ้าหน้าที่แบบยาวจาก external identity provider |
| `user.roleCodes`       | `string[]`    | `public_user` สำหรับ citizen หรือ `factory_operator` สำหรับ operator persona       |
| `user.permissionMode` | `role_default` \| `custom` | โหมดที่ใช้คำนวณสิทธิ์ปัจจุบัน; ดู [โมเดลสิทธิ์รายคน](../../menus/permissions/README.md#approved-permission-model) |
| `user.ownedFactoryIds` | `string[]`    | มีเฉพาะ operator persona และคำนวณจากสิทธิ์โรงงานปัจจุบัน                           |
| `permissions`          | `object`      | Permission groups ของ persona เดียว พร้อม data scope                               |
| `permissions.chat.ask` | `boolean` | ส่งเสมอทั้ง login และ `/auth/me`: `true` เมื่อมี effective `chat:ask`; `false` เมื่อไม่มีสิทธิ์ |

`permissions.chat.ask` ใช้ค่าเดียวกับ [รายละเอียดผู้ใช้ `GET /users/:id`](../../menus/permissions/user-management-api.md#get-apiv1usersid) เมื่อเป็นผู้ใช้และชุดสิทธิ์เดียวกัน กรณี explicit `deny`, custom snapshot ที่ไม่บันทึก `chat:ask` หรือไม่มีสิทธิ์ Chat ทั้งหมด จะคืน `false` อย่างชัดเจน แม้ role เป็น `admin` ถ้าไม่มีสิทธิ์ Chat ใดเลย auth response จะคืน `"chat": { "ask": false }` Client ต้องตรวจ `ask === true` เพื่อเปิดการสนทนา ไม่อนุมานสิทธิ์จากการมี object `chat` การเติม boolean ใน response ไม่เพิ่ม grant ใน JWT หรือเปลี่ยนสิทธิ์ที่บันทึกไว้

อายุ access token เป็นไปตาม `JWT_EXPIRES_IN` ของ environment ที่ออก token โดยไม่มี production-only cap เพิ่มเติม และ backend ยอมรับ token ที่ลายเซ็นถูกต้องจนถึงค่า `exp` ของ token นั้น การเปลี่ยน `JWT_EXPIRES_IN` มีผลกับ token ที่ออกใหม่เท่านั้น

### พฤติกรรมบัญชี i-Industry แบบหลาย persona

บัญชีประชาชนและผู้ประกอบการใช้ credential ชุดเดียวกัน แต่ permission ของแต่ละ session แยกตาม `userType` ที่เลือก:

1. เลือก `userType: "citizen"` จะได้ `user.userType: "citizen"`, `roleCodes: ["public_user"]`, ไม่มี `ownedFactoryIds` และไม่รับ permission จาก operator role แม้บัญชีนั้นเป็นเจ้าของนิติบุคคล
2. เลือก `userType: "operator"` และ DIW ส่ง `juristics` อย่างน้อย 1 รายการ จะได้ `user.userType: "operator"` กับ `roleCodes: ["factory_operator"]`; นิติบุคคลที่มี `FactoryList: []` ยังนับว่าเป็นผู้ประกอบการ จึงอาจได้ `ownedFactoryIds: []`
3. เลือก `userType: "operator"` แต่ DIW ส่ง `juristics: []` จะ fallback เป็น citizen persona และคืน `200 OK` พร้อม `public_user`; กรณีนี้ไม่คืน `401`
4. Backend ใช้ provider identity แถวเดียวต่อ `identity_provider = i_industry` และเลขประชาชนเดียวกัน. Login แบบ citizen ไม่ downgrade หรือลบ operator profile/access เดิม; เมื่อภายหลังพบนิติบุคคล operator login สามารถ promote stored `user_type` เดิมได้โดยไม่สร้าง user ซ้ำ
5. Token เก็บ persona ที่เลือกของ session นั้น `GET /auth/me` และ authenticated requests โหลดสิทธิ์ปัจจุบันจากฐานข้อมูลพร้อมคง persona ที่เซ็นไว้ จึงรองรับ citizen session และ operator session ของ account เดียวกันพร้อมกัน
6. Citizen session ของบัญชีที่เก็บเป็น operator ยังถูกจำกัดตาม citizen persona ไม่รับ operator actions เพิ่ม การจัดการสิทธิ์รายคนผ่าน `/users*` ในงานนี้รองรับเฉพาะ managed officer/admin; ไม่เพิ่ม endpoint สำหรับมอบสิทธิ์ข้าม persona

### สิทธิ์ล่าสุดระหว่าง session

JWT ใช้ยืนยัน identity, persona และอายุ session Backend ตรวจว่าบัญชียัง active และไม่ถูกลบ แล้วโหลด role, `permissionMode`, grants และ qualifiers ปัจจุบันทุก authenticated request; ไม่ใช้ `scopes` ที่ค้างอยู่ใน JWT เป็นสิทธิ์อนุญาต API

เมื่อผู้มี `permissions:manage` เพิ่มหรือถอนสิทธิ์ของ managed account token ที่ยังไม่หมดอายุใช้สิทธิ์ใหม่ตั้งแต่คำขอถัดไป บัญชี `custom` ไม่รับสิทธิ์เพิ่มจาก role และการเปลี่ยน role อย่างเดียวไม่เปลี่ยน snapshot การคืนค่าเริ่มต้นใช้ PATCH `permissionMode: "role_default"` ตาม [API จัดการสิทธิ์](../../menus/permissions/user-management-api.md#คืนค่าเริ่มต้นตาม-role)

สำหรับ custom snapshot รายการ data-scoped เดิมที่มี scope null ให้ edit/approve รับ scope และ qualifiers จาก saved view ของ resource เดียวกันเท่านั้น หาก view ไม่มี ถูก deny หรือ qualifier ไม่ครบให้ปิด action; view/search/export/direct_connect ที่ scope null ไม่ให้สิทธิ์ Binary codes คงกติกาเดิม ดู [รายละเอียด runtime และ validation ตอนบันทึก](../../menus/permissions/user-management-api.md#scope-ที่เป็น-null-ในข้อมูลเดิม)

Backend ตรวจ approve แยกรายเมนูตาม [ตารางสิทธิ์อนุมัติ](../../menus/permissions/README.md#สิทธิ์อนุมัติแยกรายเมนู) โดยไม่จำกัด role หรือ userType; custom snapshot ไม่เติม view/edit หรือสิทธิ์เมนูอื่นให้อัตโนมัติ รอบนี้ไม่ได้แก้ frontend หรือ App refresh การตรวจ role และข้อมูลสิทธิ์ที่หน้าเว็บเก็บไว้ยังเป็นข้อจำกัดของ UI

Client เรียก `/auth/me` หลังแก้สิทธิ์หรือเมื่อ refresh เมนู เพื่อให้ปุ่มและเมนูตรงกับ API; เมื่อสิทธิ์ที่เคยมีถูกถอน API ตอบ `403 FORBIDDEN` แม้ token เดิมเคยมีสิทธิ์นั้น การเปลี่ยนสถานะบัญชีเป็น inactive หรือ soft-deleted ตอบ `401 UNAUTHORIZED`

### การยืนยันตัวตนและ provisioning

1. ถ้า request ระบุ `accountType: "poms"` หรือ `provider: "local"` backend จะตรวจเฉพาะ local POMS account
2. ถ้าไม่ระบุ route hint หรือส่ง `accountType: "api"` backend จะค้นหา `users.identity_provider = local` ด้วย username ก่อน โดยเลือกบัญชีที่ยังไม่ถูกลบก่อนแถวเก่าชื่อเดียวกัน ถ้าเหลือเฉพาะ soft-deleted ยังถือว่าพบ local ไป external identity provider เฉพาะเมื่อไม่พบบัญชี local เท่านั้น หากพบบัญชีแต่รหัสผ่านผิด ไม่มี password hash, inactive, ถูกลบ หรือ persona ไม่ตรง จะคืน generic `401` และไม่ส่ง credential ไป DIW บัญชี `i_industry` ที่เคย sync ไว้ไม่ใช่บัญชี local และต้องยืนยัน DIW ใหม่ทุกครั้ง
3. External citizen/operator ต้องใช้ submitted username 13 หลัก และ `citizen_id` ที่ DIW ส่งกลับต้องตรงกันทุกหลัก มิฉะนั้นคืน generic `401`
4. เมื่อ DIW ยืนยันสำเร็จครั้งแรก backend จะสร้าง provider-scoped identity ด้วย `identity_provider = i_industry`; operator persona จะ assign role `factory_operator` และ sync `operator_profiles`, `juristics`, `user_juristics` และ `factories` ใน transaction เดียว ส่วน citizen persona สร้าง/reuse เฉพาะ shared identity
5. Login ซ้ำจะ update ข้อมูลเดิมแบบ idempotent ไม่สร้าง identity, role หรือ access row ซ้ำ
6. บัญชี inactive, soft-deleted หรือ identity เดียวกันที่เป็น user type อื่นนอกเหนือจาก `citizen`/`operator` จะไม่ถูกเปิดใช้งานหรือเขียนทับ และคืน generic `401`
7. วันที่ DIW แบบ `DD/MM/YYYY HH:mm:ss` จะถูก normalize เป็น SQL-safe ISO datetime ก่อนบันทึก

สำหรับ external officer login คำนำหน้าภาษาไทยจาก DIW เช่น `ผู้ช่วยศาสตราจารย์ ดร.` รองรับได้ถึง 64 ตัวอักษร โดย provisioning ครั้งแรกและการ sync เมื่อล็อกอินซ้ำเก็บค่าเต็มใน `users.prename_th` และคืนใน `user.prenameTh` กับ `user.name.prenameTh` ของ login และ `/auth/me`

| บัญชี POMS (`identity_provider = local`) | ผลการตรวจ | การเรียก DIW |
| --- | --- | --- |
| พบ | รหัสผ่านและสถานะผ่าน | ไม่เรียก; คืน `200` พร้อม `user.accountType: "poms"` |
| พบ | รหัสผ่าน/สถานะ/persona ไม่ผ่าน | ไม่เรียก; คืน `401` |
| ไม่พบ | ไม่ระบุ hint หรือส่ง `api` | เรียก provider ที่ตั้งค่าไว้; production ใช้ DIW |
| ไม่พบ | ส่ง `poms` หรือ `provider: "local"` | ไม่เรียก; คืน `401` |

การเปลี่ยนลำดับนี้มีผลกับบัญชีที่ใช้ username ซ้ำระหว่าง local และ DIW ดู [ผลกระทบและการย้าย client](../../CHANGELOG.md#auth-local-identity-precedence)

### Response header สำหรับติดตาม login

`200` และ `401` ที่ประมวลผลโดย login controller มี `X-Request-Id` เป็น UUID ที่ backend สร้างใหม่ ใช้แจ้งผู้ดูแลเพื่อตาม log ของคำขอเดียวกัน ค่านี้ไม่ระบุบัญชีหรือเหตุผลที่ปฏิเสธ และไม่ใช้ค่าที่ client ส่งมาแทน UUID ของ backend การปฏิเสธก่อนถึง controller เช่น rate limit อาจไม่มี header นี้

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
    "permissionMode": "role_default",
    "isActive": true,
    "officerProfile": null,
    "ownedFactoryIds": ["10100000000001"]
  },
  "permissions": {
    "factories": {
      "data": "OWN_FACTORY",
      "view": true
    },
    "chat": { "ask": false }
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

DIW ที่ตอบ HTTP `200` แต่ `status: false`/`"false"` ยังถือว่ายืนยันไม่ผ่านและคืน `401` เช่นเดียวกับ provider timeout/HTTP error การเข้าเว็บ i-Industry NEXT สำเร็จไม่ได้ยืนยันว่า DIW UserLogin จะยอมรับ credential เดียวกัน การแก้ routing นี้ไม่เพิ่มการเรียก NEXT API แทน DIW

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
    "permissionMode": "role_default",
    "ownedFactoryIds": ["10100000000001"]
  },
  "permissions": {
    "factories": {
      "data": "OWN_FACTORY",
      "view": true
    },
    "chat": { "ask": false }
  }
}
```

ถ้า token ไม่ถูกต้องหรือหมดอายุ endpoint คืน `401 UNAUTHORIZED` ด้วย shared error envelope เดียวกัน

Endpoint นี้ตรวจว่า user row ยัง active และไม่ถูกลบ แล้วคืน role, `permissionMode` และ permission ล่าสุดจากฐานข้อมูล สำหรับ i-Industry account ยังคง persona citizen/operator ที่เซ็นไว้ใน session เพื่อไม่ให้ citizen token รับ operator actions จาก stored `users.user_type` Token ของ citizen และ operator สำหรับ `sub` เดียวกันจึงยังแยก persona กัน แต่การถอนสิทธิ์และข้อมูลขอบเขตโรงงานมีผลกับคำขอถัดไป

## Maintainer links

### ตรวจ log ของ login

ค้น `[auth] Login decision` ด้วย `requestId` จาก `X-Request-Id` โดยอ่าน `provider` และ `reason`:

- `local_identity_not_found`: ไม่พบบัญชี local; เรียก provider ต่อได้เมื่อ request ไม่ใช่ local-only
- `local_authenticated`, `local_credentials_rejected`, `local_inactive`, `local_deleted`, `local_password_missing`, `local_failed`: ผลการตรวจบัญชี local; ไม่มีการ fallback เมื่อพบบัญชี
- `diw_authenticated`, `diw_rejected`: ผลยืนยันตัวตนจาก payload ที่ DIW ส่งกลับ; การออก token ยังต้องผ่านสถานะบัญชีและ provisioning ของ POMS
- `diw_http_error`, `diw_timeout`, `diw_request_failed`, `diw_invalid_response`: HTTP ไม่สำเร็จ, เกินเวลา, การเรียกต้นทางล้มเหลว หรืออ่าน JSON ไม่ได้ ตามลำดับ; HTTP failure มี `status` และ transport failures มี `elapsedMs`

Log ชุดนี้จำกัด field เป็น `requestId`, `provider`, `reason`, `userType`, `status`, `elapsedMs` ไม่บันทึก username, password, Client ID, token, raw response, status text หรือข้อความ exception จากต้นทาง

- [Routes](../../../../../backend/src/modules/auth/auth.routes.ts) และ [controller](../../../../../backend/src/modules/auth/auth.controller.ts)
- [Service](../../../../../backend/src/modules/auth/auth.service.ts)
- [Authentication middleware](../../../../../backend/src/shared/middlewares/authenticate.ts) และ [ตัวคำนวณสิทธิ์](../../../../../backend/src/modules/auth/permissions.ts)
- [Repository provisioning](../../../../../backend/src/modules/auth/auth.repository.ts)
- [DIW identity mapping](../../../../../backend/src/modules/auth/identity-provider/diw-user-login.identity-provider.ts)
- คำนำหน้า 64 ตัวอักษร: [migration 0135](../../../../../backend/src/db/migrations/0135_expand_user_prename.ts) และ [migration regression](../../../../../backend/tests/unit/user-prename-migration.test.ts)

- [Login diagnostics](../../../../../backend/src/modules/auth/auth-login-diagnostics.ts)
- Tests ผ่านขอบเขตจริง: [HTTP login กับฐานข้อมูลจำลอง](../../../../../backend/tests/unit/auth.login-routing.api.test.ts), [DIW HTTP และ safe logs](../../../../../backend/tests/unit/diw-login.diagnostics.test.ts)
- Tests: [route persona](../../../../../backend/tests/unit/auth.login-personas.route.test.ts), [service](../../../../../backend/tests/unit/auth.service.test.ts), [repository](../../../../../backend/tests/unit/auth.repository.test.ts), [provider](../../../../../backend/tests/unit/diw-user-login.identity-provider.test.ts)
- Tests สำหรับ Chat: [เปรียบเทียบ login, me และรายละเอียดผู้ใช้](../../../../../backend/tests/unit/auth.chat-ask-response.test.ts), [OpenAPI contract](../../../../../backend/tests/unit/auth.chat-ask.openapi.test.ts)
