# API Breaking Changes

ไฟล์นี้บันทึกเฉพาะการเปลี่ยน API ที่ทำให้ client ต้องแก้ตาม การเปลี่ยนทั่วไปและประวัติรายละเอียดดูจาก Git history

## 2026-08-02 — Integration Alert Events รับเวลาเริ่มชั่วโมงเพียงค่าเดียว

- **Affected integration:** [Integration Alert Events](./integrations/alert-events/README.md)
- **Impact:** `POST /api/v1/integrations/alert-events` ไม่รับ `events[].startTime` และ `events[].endTime`; strict validation จะตอบ `400 VALIDATION_ERROR` หาก client ยังส่ง field เดิม
- **Migration:** เปลี่ยนเป็นส่ง `events[].time` รูปแบบ `HH:00` โดยใช้เวลาเริ่มของชั่วโมงที่พบค่าเกิน เช่น `20:00`; backend จะสร้างช่วง `20:00:00` ถึง `20:59:59` ใน timezone `+07:00` ให้เอง
- **Old contract:** แต่ละ event ต้องส่ง `eventDate`, `startTime` รูปแบบ `HH:mm` และ `endTime` รูปแบบ `HH:mm`
- **New contract:** แต่ละ event ต้องส่ง `eventDate` และ `time` รูปแบบต้นชั่วโมง `HH:00`; response ยังคงมี `startedAt`, `endedAt` และ `timeRange`

## 2026-07-31 — Integration Device Config ส่ง database password จริงให้ Worker

- **Affected integration:** [Integration Device Config](./integrations/device-configs/README.md)
- **Impact:** `GET /api/v1/integrations/device-configs/:stationId` เปลี่ยนความหมายของ `deviceConfigs[].dbPass` จาก masked placeholder เป็น database password จริงเมื่อมีการตั้งค่า จึงเป็นข้อมูลลับที่ห้าม cache หรือบันทึกลง log
- **Migration:** จำกัด `DEVICE_CONFIG_API_KEYS` เฉพาะ Worker ที่จำเป็น เรียกผ่าน HTTPS ตรวจว่า client ไม่ log header/response และใช้ค่าจาก `dbPass` เป็น credential จริง; response มี `Cache-Control: no-store`
- **Old contract:** `dbPass` เป็น `********` เมื่อมีค่า และเป็น `null` เมื่อไม่ได้ตั้ง
- **New contract:** `dbPass` เป็น password จริงเมื่อมีค่า และเป็น `null` เมื่อไม่ได้ตั้ง โดย endpoint อื่นยังคง mask password

## 2026-07-24 — เปลี่ยนรูปแบบเลขรายงานความคลาดเคลื่อน BOD/COD และแยก running ตามภาคกับปี

- **Affected menu:** [รายงานค่าความคลาดเคลื่อน BOD/COD Online](./menus/bod-cod-deviation-reports/README.md)
- **Impact:** `reportNo` ของรายงานที่สร้างใหม่มี `/` และเปลี่ยนรูปแบบ; client ที่ validate, sort หรือแยกส่วนเลขตามรูปแบบเดิมต้องปรับให้ใช้เป็น opaque string
- **Migration:** รองรับ `BODCOD-YYYY-NNNN` สำหรับข้อมูลเดิมและ `Error-RR-NNNN/YYYY` สำหรับข้อมูลใหม่ ไม่ต้องส่ง `regionCode` เพิ่มเพราะ backend หา region จากข้อมูลโรงงาน และต้อง URL-encode หากนำเลขไปใช้เป็น path/query value
- **Old contract:** รายงานใหม่ใช้ running รวมรายปีรูปแบบ `BODCOD-2569-0001`
- **New contract:** รายงานใหม่ใช้ `Error-02-0001/2569` เป็นต้น โดย running แยกตาม `ภาค + ปีรายงาน พ.ศ.` ใช้ร่วมกันระหว่าง BOD/COD และรอบ 1-2 และจำกัดลำดับที่ `0001`-`9999`

## 2026-07-24 — เปลี่ยนรูปแบบเลขคำขอ กวภ. และแยก running ตามแบบ ภาค และปี

- **Affected menu:** [แจ้งแบบ กวภ. 01 - กวภ. 05](./menus/kwp-forms/README.md)
- **Impact:** ค่า `requestNo` ของคำขอที่สร้างใหม่มี `/` และเปลี่ยนรูปแบบ; client ที่ validate, sort หรือแยกส่วนเลขตามรูปแบบเดิมต้องปรับให้ใช้เป็น opaque string
- **Migration:** รองรับทั้ง `KWP-YY-NNNNN` สำหรับข้อมูลเดิมและ `FNN-RR-NNNN/YYYY` สำหรับข้อมูลใหม่ ไม่ต้องส่ง `regionCode` เพิ่มเพราะ backend หา region จากข้อมูลโรงงาน
- **Old contract:** กวภ.01-กวภ.05 ใช้ running รวมรายปีรูปแบบ `KWP-69-00001`
- **New contract:** ใช้ `F01-04-0001/2569` เป็นต้น โดย running แยกตาม `แบบ + ภาค + ปี พ.ศ.` และจำกัดลำดับที่ `0001`-`9999`

## 2026-07-24 — เปลี่ยนรหัสจุดตรวจวัดที่ออกใหม่เป็นลำดับรายปี

- **Affected menu:** [ขอเชื่อมต่อ](./menus/connection-requests/README.md)
- **Impact:** `measurementPoints[].pointCode` ที่ backend ออกใหม่หลังอนุมัติแบบเปลี่ยนรูปแบบ และมี `/` อยู่ใน identifier; client ที่ส่งรหัสผ่าน path parameter ต้อง URL-encode path segment.
- **Migration:** รองรับ `CEMS-NNNN/YYYY` และ `WEMS-NNNN/YYYY`, ใช้ `encodeURIComponent(pointCode)` เมื่อนำไปวางใน path และยังคงรับรหัสเดิมเป็น opaque identifier โดยไม่แปลงค่า.
- **Old contract:** CEMS ออก `S2001`, `S2002`, ... และ WPMS ออก `W2001`, `W2002`, ... โดยใช้ลำดับต่อเนื่องแยกตามระบบแต่ไม่แยกปี.
- **New contract:** CEMS ออก `CEMS-0001/2569`, `CEMS-0002/2569`, ... และ WPMS ออก `WEMS-0001/2569`, `WEMS-0002/2569`, ... โดยแยกลำดับตามระบบและปี พ.ศ. และเริ่มใหม่ที่ `0001` เมื่อขึ้นปีใหม่.

## 2026-07-22 — จำกัดรายชื่อโรงงานของผู้ประกอบการไว้ที่โรงงานเข้าข่าย

- **Affected menu:** [ขอเชื่อมต่อ](./menus/connection-requests/README.md)
- **Impact:** `GET /api/v1/cems-wpms-requests/operator-factories` จะไม่ส่งโรงงานที่ user เข้าถึงได้แต่ไม่มี active `eligible_factories` อีกต่อไป และค่า descriptive fields อาจเปลี่ยนเป็นค่าล่าสุดจากโรงงานเข้าข่าย
- **Migration:** client ต้องไม่ใช้ endpoint นี้เป็นรายการโรงงานทั้งหมดของ user หรือคาดหวัง action สำหรับโรงงานไม่เข้าข่าย; หากต้องมี workflow แจ้งความประสงค์สำหรับโรงงานไม่เข้าข่าย ให้ใช้ contract แยกต่างหาก
- **Old contract:** ใช้ `factories` เป็นฐานข้อมูลโรงงานและ left join `eligible_factories` เพื่อเสริมข้อมูล จึงอาจส่งโรงงานไม่เข้าข่ายและใช้ชื่อจาก `factories.name`
- **New contract:** ใช้ `factories` เฉพาะตรวจสิทธิ์/ความสัมพันธ์ของ user รับเฉพาะ active `eligible_factories` และส่งชื่อ เลขทะเบียน ประเภทโรงงาน การประกอบกิจการ ที่อยู่ จังหวัด พิกัด EIA และชื่อโครงการจาก `eligible_factories`

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
