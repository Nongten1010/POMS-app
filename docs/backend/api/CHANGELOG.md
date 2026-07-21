# API Breaking Changes

ไฟล์นี้บันทึกเฉพาะการเปลี่ยน API ที่ทำให้ client ต้องแก้ตาม การเปลี่ยนทั่วไปและประวัติรายละเอียดดูจาก Git history

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
