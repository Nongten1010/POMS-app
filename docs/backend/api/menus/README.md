# Menu API Index

API contract ในกลุ่มนี้จัดตามเมนูงานที่ผู้ใช้เห็น แต่ละเมนูมี landing page ของตนเองและสามารถรวม endpoints จากหลาย backend modules ได้

Index นี้แสดงเฉพาะเมนูหรือ business capability ที่ backend มี contract ให้ดูแล ไม่ใช้ติดตามหน้า frontend-only, mock UI หรือความคืบหน้าของ frontend

## ศูนย์ทดสอบ API

เปิด `<BASE_URL>/api/v1/docs` เพื่อใช้ Swagger UI ที่รวม API ทั้งระบบ ตัวเลขในตารางนี้นับ `Method + Path` โดย **API ในทะเบียน** คือ route canonical 122 รายการ ส่วน **Operations ใน Swagger** มี 131 รายการ เพราะเพิ่ม path แบบแยก `stationId/{buddhistYear}` อีก 9 รายการให้กรอกและทดสอบ annual point code ได้สะดวก

| กลุ่มใน Swagger                         | API ในทะเบียน | Operations ใน Swagger | Canonical contract                                                                                                                                       |
| --------------------------------------- | ------------: | --------------------: | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ระบบทั่วไปและการเข้าสู่ระบบ             |             8 |                     8 | [Common API](../shared/common-api/README.md), [Authentication](../shared/authentication/README.md), [Internal tools](../shared/internal-tools/README.md) |
| หน้าหลัก                                |             4 |                     4 | [หน้าหลัก](./home/README.md)                                                                                                                             |
| ข้อมูลพื้นฐาน                           |            13 |                    17 | [ข้อมูลพื้นฐาน](./master-data/README.md)                                                                                                                 |
| ขอเชื่อมต่อ                             |            31 |                    31 | [ขอเชื่อมต่อ](./connection-requests/README.md)                                                                                                           |
| แจ้งแบบ กวภ. 01 - กวภ. 05               |            25 |                    25 | [แจ้งแบบ กวภ.](./kwp-forms/README.md)                                                                                                                    |
| รายงานค่าความคลาดเคลื่อน BOD/COD Online |             9 |                     9 | [BOD/COD Online](./bod-cod-deviation-reports/README.md)                                                                                                  |
| การแจ้งเตือน                            |             6 |                     6 | [การแจ้งเตือน](./notifications/README.md), [ผู้รับอีเมล](../shared/notification-recipients/README.md)                                                    |
| สถิติข้อมูล                             |             4 |                     8 | [สถิติข้อมูล](./statistics/README.md)                                                                                                                    |
| สิทธิ์การใช้งาน                         |             8 |                     8 | [สิทธิ์การใช้งาน](./permissions/README.md)                                                                                                               |
| โรงงานที่เข้าข่าย                       |            11 |                    11 | [โรงงานที่เข้าข่าย](./eligible-factories/README.md)                                                                                                      |
| ระบบเชื่อมต่อภายนอก                     |             3 |                     4 | [Integrations](../integrations/README.md)                                                                                                                |
| **รวม**                                 |       **122** |               **131** | [Endpoint registry](../ENDPOINTS.md)                                                                                                                     |

```text
menus/
└── <menu-slug>/
    ├── README.md       stable landing page
    └── <subpage>.md    optional focused contract page
```

## Required Landing-page Sections

1. Frontend quick start
2. Endpoint summary
3. Request, response, authentication, permission, validation และ error contract หรือ links ไปยัง focused subpages
4. Business-flow และ explanation links
5. Backend maintainer links ไปยัง routes, validators, types, tests และ evidence

ชื่อ directory ใช้ English kebab-case แต่ `#` heading ใช้ชื่อเมนูภาษาไทยตาม frontend ส่วน technical identifiers ต้องตรงกับ code

## Canonical Menu Map

| Menu                                    | Directory                    | Backend API families                                                        |
| --------------------------------------- | ---------------------------- | --------------------------------------------------------------------------- |
| หน้าหลัก                                | `home/`                      | operator dashboard, public factory map, favorite และรายละเอียดจุดตรวจวัด    |
| ข้อมูลพื้นฐาน                           | `master-data/`               | โรงงาน current/live, จุดตรวจวัด, คำขอแก้ไข profile และ device configuration |
| ขอเชื่อมต่อ                             | `connection-requests/`       | CEMS/WPMS requests, parameter values และ connection workflow                |
| โรงงานที่เข้าข่าย                       | `eligible-factories/`        | eligible factories และ monitoring-point forms                               |
| แจ้งแบบ กวภ. 01 - กวภ. 05               | `kwp-forms/`                 | KWP submissions, reports และ workflow                                       |
| รายงานค่าความคลาดเคลื่อน BOD/COD Online | `bod-cod-deviation-reports/` | deviation reports และ result notices                                        |
| การแจ้งเตือน                            | `notifications/`             | alert list, detail และ status                                               |
| สถิติข้อมูล                             | `statistics/`                | measurement statistics, calendar status และ CSV export                      |
| สิทธิ์การใช้งาน                         | `permissions/`               | users, roles และ permission overrides                                       |

## Canonical Menu Pages

- [หน้าหลัก](./home/README.md) — โรงงานของผู้ประกอบการพร้อมสถานะ POMS, dashboard current/live, public map และ favorite
- [ข้อมูลพื้นฐาน](./master-data/README.md) — โรงงาน current/live, จุดตรวจวัด, workflow คำขอแก้ไข profile, ประวัติ และ device config
- [ขอเชื่อมต่อ](./connection-requests/README.md) — contract คำขอ CEMS/WPMS และการออกรหัสจุดตรวจวัด
- [โรงงานที่เข้าข่าย](./eligible-factories/README.md) — contract รายการโรงงานเข้าข่าย ข้อมูลที่ซิงก์ และเงื่อนไขการถอดออก
- [แจ้งแบบ กวภ. 01 - กวภ. 05](./kwp-forms/README.md) — contract การส่งแบบ กวภ., upload เอกสาร, workflow และรายงานรายการคำขอ
- [รายงานค่าความคลาดเคลื่อน BOD/COD Online](./bod-cod-deviation-reports/README.md) — contract การส่งรายงาน, เลขที่รายงาน, เอกสารแนบ และ workflow พิจารณา
- [การแจ้งเตือน](./notifications/README.md) — contract รายการ alert, รายละเอียด, filter และการอัปเดตสถานะ
- [สถิติข้อมูล](./statistics/README.md) — contract สถิติ ปฏิทินสถานะ และการส่งออกข้อมูล
- [สิทธิ์การใช้งาน](./permissions/README.md) — contract การจัดการผู้ใช้, role grants, permission overrides และ data scope

API ที่หลายเมนูใช้ร่วมกัน เช่น authentication และ connected measurement points อยู่ใต้ `../shared/` และให้หน้าเมนูลิงก์อ้างอิง

Canonical links จะเพิ่มเมื่อแต่ละหน้าได้รับการตรวจเทียบกับ routes, validators, types และ tests แล้ว ห้ามสร้างหน้า contract เปล่าเพื่อให้ดูเหมือนมี coverage
