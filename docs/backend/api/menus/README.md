# Menu API Index

API contract ในกลุ่มนี้จัดตามเมนูงานที่ผู้ใช้เห็น แต่ละเมนูมี landing page ของตนเองและสามารถรวม endpoints จากหลาย backend modules ได้

Index นี้แสดงเฉพาะเมนูหรือ business capability ที่ backend มี contract ให้ดูแล ไม่ใช้ติดตามหน้า frontend-only, mock UI หรือความคืบหน้าของ frontend

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

| Menu | Directory | Backend API families |
| --- | --- | --- |
| หน้าหลัก | `home/` | operator dashboard, public factory map, favorite และรายละเอียดจุดตรวจวัด |
| ขอเชื่อมต่อ | `connection-requests/` | CEMS/WPMS requests, parameter values และ connection workflow |
| โรงงานที่เข้าข่าย | `eligible-factories/` | eligible factories และ monitoring-point forms |
| แจ้งแบบ กวภ. 01 - กวภ. 05 | `kwp-forms/` | KWP submissions, reports และ workflow |
| รายงานค่าความคลาดเคลื่อน BOD/COD Online | `bod-cod-deviation-reports/` | deviation reports และ result notices |
| การแจ้งเตือน | `notifications/` | alert list, detail และ status |
| สิทธิ์การใช้งาน | `permissions/` | users, roles และ permission overrides |

## Canonical Menu Pages

- [ขอเชื่อมต่อ](./connection-requests/README.md) — contract คำขอ CEMS/WPMS และการออกรหัสจุดตรวจวัด

API ที่หลายเมนูใช้ร่วมกัน เช่น authentication และ connected measurement points อยู่ใต้ `../shared/` และให้หน้าเมนูลิงก์อ้างอิง

Canonical links จะเพิ่มเมื่อแต่ละหน้าได้รับการตรวจเทียบกับ routes, validators, types และ tests แล้ว ห้ามสร้างหน้า contract เปล่าเพื่อให้ดูเหมือนมี coverage
