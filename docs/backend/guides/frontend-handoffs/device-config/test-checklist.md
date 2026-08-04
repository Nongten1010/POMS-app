# Frontend handoff: Test checklist

[กลับไปหน้า handoff](./README.md)

Checklist นี้เป็น release gate ของ frontend สำหรับ dialog ตั้งค่าอุปกรณ์ ต้องทดสอบทั้ง context ของคำขอและจุดที่เชื่อมต่อแล้ว

## Status schedules

- [ ] เพิ่ม 2 ช่วงเวลาคนละพารามิเตอร์และบันทึกสำเร็จ
- [ ] เพิ่ม 2 ช่วงเวลาของพารามิเตอร์เดียวกันและบันทึกสำเร็จเมื่อไม่ทับกัน
- [ ] ช่วงติดกันที่ `first.endAt === second.startAt` บันทึกได้
- [ ] block เมื่อ `endAt <= startAt`
- [ ] block เมื่อช่วงของพารามิเตอร์เดียวกันทับกัน
- [ ] block เมื่อ `ทั้งหมด` ทับกับ schedule อื่น
- [ ] block รายการที่ 101
- [ ] payload ทุก `startAt`/`endAt` ใช้ `YYYY-MM-DD HH:mm:ss` และไม่มี `T`, `Z` หรือ timezone offset
- [ ] payload ไม่มี UI-only `id`
- [ ] payload และ dropdown รองรับ `No Discharge` ตรงกับ backend enum
- [ ] โหลดหน้าจอใหม่แล้วแปลง `YYYY-MM-DD HH:mm:ss` เป็นค่า `datetime-local` ได้และ schedules ครบ
- [ ] ลบหนึ่งรายการแล้ว GET หลัง POST ไม่คืนรายการที่ลบ
- [ ] ล้างทั้งหมดแล้วส่ง `statusManagement.schedules: []`

## Device settings และ channels

- [ ] MSSQL แสดงและ round-trip table names ทั้ง 3 fields
- [ ] MYSQL แสดงและ round-trip table names ทั้ง 3 fields
- [ ] settings ว่างส่ง `null` ตาม contract
- [ ] channel ที่มี `dataType` และ nullable fields บันทึกได้
- [ ] `addressId: null` บันทึกได้
- [ ] `valueRange: null` เมื่อ min/max ว่างทั้งคู่
- [ ] `valueFormat` mapping ตรงกับ dropdown ทุกค่า
- [ ] `encoding` mapping ตรงกับ dropdown ทุกค่า
- [ ] channel status รับเฉพาะ enum ที่ backend รองรับ
- [ ] หลายอุปกรณ์จับคู่ `deviceCode` กับ channel ถูกต้อง

## Endpoint matrix

- [ ] Request GET โหลด prefill ถูกต้อง
- [ ] Request POST ตอบ `201` และ GET ซ้ำได้ข้อมูลใหม่
- [ ] Connected-point GET โหลด current config ถูกต้อง
- [ ] Connected-point POST แทนที่ค่าแล้ว GET ซ้ำได้ข้อมูลใหม่
- [ ] station ID ที่มี `/` ถูก encode และ route อ่านได้
- [ ] ทดสอบทั้ง config เดี่ยวและ form payload ที่มีหลายอุปกรณ์ตาม flow ที่ UI ใช้

## Error handling

- [ ] `VALIDATION_ERROR` แสดงข้อความจาก `error.issues[]` ตรง field/row
- [ ] `BAD_REQUEST` ที่มี `error.details` แสดง context ที่ผู้ใช้แก้ได้
- [ ] `401`, `403`, `404` มี behavior ตามหน้าที่ของแต่ละ code
- [ ] form state ไม่หายเมื่อ POST ไม่สำเร็จ
- [ ] submit ซ้ำถูกป้องกันระหว่าง request
- [ ] browser console/network logging ของ application ไม่บันทึก token หรือ `dbPass`

## Known blocker ที่ต้องปิดก่อนประกาศครบถ้วน

- [x] `POMS Box` ใช้ `POMS_BOX` ผ่าน Device Config API โดย backend รองรับ schema, persistence และ prefill แล้ว

## หลักฐาน backend ที่ใช้ประกอบ

- [`connection-requests.create.route.test.ts`](../../../../../backend/tests/unit/connection-requests.create.route.test.ts): multi schedule, datetime format, legacy normalization, enum, order, limit และ overlap
- [`connection-requests.service.test.ts`](../../../../../backend/tests/unit/connection-requests.service.test.ts): parameter membership และ response mapping
- [`integration-device-configs.service.test.ts`](../../../../../backend/tests/unit/integration-device-configs.service.test.ts): external API flatten/expand/sort schedules
