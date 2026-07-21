# API Breaking Changes

ไฟล์นี้บันทึกเฉพาะการเปลี่ยน API ที่ทำให้ client ต้องแก้ตาม การเปลี่ยนทั่วไปและประวัติรายละเอียดดูจาก Git history

## 2026-07-21 — เปลี่ยน prefix รหัสจุดตรวจวัด WPMS ที่ออกใหม่

- **Affected menu:** [ขอเชื่อมต่อ](./menus/connection-requests/README.md)
- **Impact:** client หรือ integration ที่ตรวจรูปแบบรหัส WPMS ใหม่เป็น `P` ต้องรองรับ `W`; รหัส `Pxxxx` เดิมยังคงอยู่และยังใช้เป็น identifier เดิม
- **Migration:** ปรับ validation, regex, routing หรือ table-name mapping ที่อนุมาน prefix ให้รองรับรหัสใหม่ `W2001`, `W2002`, ... พร้อมคงการรองรับ `Pxxxx` เดิม
- **Old contract:** จุด WPMS ที่ backend ออกให้อัตโนมัติใช้ `P0001`, `P0002`, ...
- **New contract:** จุด WPMS ที่ backend ออกให้อัตโนมัติเริ่มขั้นต่ำที่ `W2001` และเรียงต่อไป; จุด CEMS เริ่มขั้นต่ำที่ `S2001`

## Entry Format

```md
## YYYY-MM-DD — <ชื่อการเปลี่ยน>

- **Affected menu:** [<ชื่อเมนู>](./menus/<menu-slug>/README.md)
- **Impact:** <สิ่งที่ client เดิมจะพบ>
- **Migration:** <ขั้นตอนที่ client ต้องทำ>
- **Old contract:** <field/path/behavior เดิม>
- **New contract:** <field/path/behavior ใหม่>
```

ห้ามใช้ไฟล์นี้แทนรายละเอียด contract ปัจจุบัน รายการทุกอันต้องลิงก์ไปยัง canonical page ที่อัปเดตแล้ว
