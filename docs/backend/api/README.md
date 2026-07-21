# Backend API Documentation by Menu

> สถานะ: แบบร่างระหว่างออกแบบ navigation และย้ายเอกสาร

หน้านี้เป็น entry point ของ API contract สำหรับ frontend และ QA โดยจัดตามเมนูงานหรือ business capability ที่ผู้ใช้เห็น ไม่จัดตามชื่อ module ภายใน backend

Backend เป็นเจ้าของ contract เหล่านี้ หน้า API ต้องอ่านได้โดยไม่ต้องเปิด source code และต้องมี maintainer links ไปยัง implementation, tests และคำอธิบายเชิงลึกโดยไม่คัดลอกเนื้อหาเหล่านั้นเข้ามาปนกับ contract

## Navigation Rules

- หนึ่งหน้าเอกสารอธิบาย API ทั้งหมดที่รองรับเมนูงานเดียวกัน
- หนึ่งหน้าอาจอ้างถึงหลาย backend route groups หรือ modules
- ใช้ชื่อเมนูจาก frontend เป็น canonical display name
- ใส่ method และ path ของทุก endpoint เพื่อให้ค้นด้วยชื่อ API ได้
- ลิงก์ไป implementation sources แทนการจัด navigation ตามชื่อ source file
- ทุกเมนูใช้ directory ที่มี `README.md` เป็น stable landing page; เพิ่ม subpages เฉพาะเมื่อเนื้อหาใหญ่เกินกว่าจะอ่านเป็นหน้าเดียว
- วาง frontend quick start และ contract ก่อน แล้ววาง backend maintainer links ตอนท้าย เพื่อให้ผู้อ่านสองกลุ่มใช้ contract ชุดเดียวกัน

## Language Convention

- Directory และ filename ใช้ English kebab-case
- Display heading และคำอธิบายใช้ภาษาไทย
- Method, path, field, status, permission และ error code ใช้ identifier ตาม code โดยไม่แปล
- ไม่สร้างเอกสารภาษาไทยและอังกฤษที่มี contract ซ้ำกันทั้งหน้า

## Examples Convention

- ทุก endpoint มี field tables และ minimal request/response JSON อย่างละหนึ่งชุด
- วาง copy-paste curl ของ flow หลักไว้ใน menu quick start
- เพิ่ม endpoint-specific curl เฉพาะ upload, complex authentication หรือกรณีที่ JSON อย่างเดียวไม่พอ
- อธิบาย shared error envelope ครั้งเดียวใน `shared/` และลิงก์จากหน้าเมนู

เริ่มเอกสารใหม่จาก [documentation templates](../guides/documentation/README.md)

ไม่ใส่ `Last updated` หรือ changelog ซ้ำในแต่ละไฟล์ ใช้ Git history สำหรับการเปลี่ยนทั่วไปและใช้ breaking-change log เฉพาะเมื่อ client ต้องแก้ตาม

## API Groups

- [Endpoint registry](./ENDPOINTS.md) — รายการ `Method + Path` ของ mounted endpoints และหน้า canonical owner
- [Menus](./menus/README.md) — API ตามเมนูงานที่ผู้ใช้เห็น
- [Shared](./shared/README.md) — authentication, profile, users, permissions และ API กลาง
- [Integrations](./integrations/README.md) — contract สำหรับอุปกรณ์ worker และระบบภายนอก
- [Breaking-change log](./CHANGELOG.md) — ผลกระทบและวิธี migrate เฉพาะ breaking changes

## Confirmed Menu Names

- `ขอเชื่อมต่อ`
- `โรงงานที่เข้าข่าย`
- `แจ้งแบบ กวภ. 01 - กวภ. 05`

รายการหน้า canonical จะเพิ่มใน index ของแต่ละกลุ่มระหว่างการย้ายเอกสาร
