# Export Connected Measurement CSV Workflow

> Status: Completed

## Trigger

ผู้ใช้เปิดรายละเอียดโรงงานจากหน้า Home เปิด dialog `ส่งออกรายงาน` เลือกเงื่อนไข แล้วกด `ส่งออก CSV`.

## Goal

ให้ผู้ใช้ดาวน์โหลดข้อมูลตรวจวัดของจุดที่ตนมีสิทธิ์เข้าถึงเป็นไฟล์ CSV ตามช่วงวันที่ ความถี่ และพารามิเตอร์ที่เลือก โดย backend เป็นผู้ตรวจสิทธิ์ อ่านข้อมูลจริง และสร้างไฟล์.

## Observed Frontend Input

- ชื่อโรงงานและเลขทะเบียนโรงงานเป็นข้อมูล read-only สำหรับแสดงผล.
- `reportType`: `CEMS` หรือ `WPMS`.
- `measurementPoint`: ใช้ `stationId` ก่อน แล้ว fallback เป็น `pointCode`.
- `selectedParameters`: `all` หรือรายการชื่อพารามิเตอร์ที่แสดงพร้อมหน่วย.
- `frequency`: `hourly`, `daily`, `monthly`, หรือ `yearly`.
- `startDate` และ `endDate`: เลือกจาก date picker.
- ปุ่ม `ส่งออก CSV` ยังไม่ได้เรียก backend.

## Available Backend Capability

- Connected-point routes ตรวจ authentication และ data scope ได้จาก `stationId`.
- Permission `dashboard.stats:export` มีอยู่ใน permission model.
- Parameter source รองรับ interval `60m` และ `1day` โดยตรง.
- Backend มี logic จำกัดข้อมูลตาม registered parameters และตรวจ station access อยู่แล้ว.

## Sample CSV Evidence

- Encoding: UTF-8 with BOM.
- Header: `date_time,factory_name,meas_code,_co_,_flow_,_nox_,_o2_,_temp__`.
- 19 data rows ของ `2026-08-09 00:00:00` ถึง `2026-08-09 18:00:00`.
- แต่ละ row มีชื่อโรงงาน `โรงไฟฟ้าพระนครเหนือ ชุดที่ 2`, จุด `S0199`, และค่าพารามิเตอร์ตัวเลข.
- ตัวอย่างคืนเฉพาะเวลาที่มีข้อมูล ไม่เติมช่วง `19:00:00` ถึง `23:00:00`.

## Confirmed Interface Direction

`GET /api/v1/connected-measurement-points/:stationId/measurement-export.csv`

Query fields:

- `frequency`: `hourly` หรือ `daily`
- `startDate`: `YYYY-MM-DD`, inclusive
- `endDate`: `YYYY-MM-DD`, inclusive
- `parameters=all` หรือ repeated query key ที่เป็น human-readable parameter label พร้อมหน่วย เช่น `parameters=CO (ppm)&parameters=Flow Rate (m3/hr)`

เมื่อระบุหลาย parameter ลำดับคอลัมน์ต้องตรงกับลำดับ request. เมื่อใช้ `all` ให้ใช้ลำดับ registered parameters ของจุดตรวจวัด.

Frontend ไม่ส่ง `factoryId`, ชื่อโรงงาน หรือ `reportType` เป็น source of truth. Backend resolve โรงงาน ประเภทระบบ permission และ data scope จาก connected `stationId`.

Response:

- `200 OK`
- `Content-Type: text/csv; charset=utf-8`
- `Content-Disposition: attachment; filename="...csv"`
- stream CSV จาก backend โดยไม่สร้างไฟล์ถาวร

## Confirmed CSV Contract Direction

- Encoding เป็น UTF-8 with BOM เพื่อรองรับภาษาไทยใน Excel.
- คง identity columns `date_time`, `factory_name`, และ `meas_code`.
- Parameter columns ใช้ human-readable label พร้อมหน่วย เช่น `CO (ppm)` และ `Flow Rate (m3/hr)`; ไม่ใช้ `_co_` หรือ `_flow_` จาก sample เป็น canonical header.
- ใช้หนึ่งคอลัมน์ต่อพารามิเตอร์และไม่เพิ่ม status column แยก.
- ค่า measurement ที่ source status ไม่ปกติต้องถูกแทนด้วยชื่อ operational status ใน cell เดียวกัน ไม่ส่ง raw numeric value ที่อาจทำให้เข้าใจผิด.
- Export เฉพาะ source rows ที่มีอยู่ ไม่เติมช่วงเวลาที่ไม่มี row.
- แต่ละพารามิเตอร์มีเพียง `<Parameter>`; cell เป็นตัวเลขเมื่อ status คือ `Normal`, `Ok` หรือ StatusCode `1`.
- Status ที่ไม่ปกติแทนค่าตัวเลขด้วย `NoData`, `Calibration`, `Defective`, `Maintenance`, `Start up`, `Shut Down`, `Turnaround`, `Etc.` หรือ `No Discharge`.
- `date_time` ใช้ปีคริสต์ศักราชและเวลา Asia/Bangkok รูปแบบ `YYYY-MM-DD HH:mm:ss`.
- Measurement value ใช้เลขทศนิยมสองตำแหน่ง ไม่มี thousands separator.
- ใช้ RFC 4180 quoting/escaping และป้องกัน CSV formula injection ใน string cells.
- Filename ใช้ `measurement-{stationId}-{frequency}-{startDate}-{endDate}.csv` หลัง sanitize `stationId`.
- เรียง rows ตาม `cdate`, `ctime` จากเก่าไปใหม่.
- หาก source มีหลาย rows ที่ timestamp เดียวกัน ให้รักษาและส่งออกทุก row; ห้าม deduplicate โดยไม่มีกฎทางธุรกิจ.
- Daily row ที่ไม่มี `ctime` ใช้ `00:00:00`.
- ข้อความที่แทนค่าเป็น operational status ไม่ใช่ pollution threshold classification (`warning`/`exceeded`).
- Numeric value ที่ใช้ได้ไม่ส่งคำว่า `Normal`; source status ที่ไม่ปกติส่งชื่อสถานะแทน numeric value.
- ถ้ามี completeness field และค่าต่ำกว่า 80% ให้ parameter cell ว่าง แม้มี operational status.
- หากไม่มี completeness field ให้ถือว่า 100% เมื่อ row มี numeric value ทั้ง `hourly` และ `daily`.
- Source status เป็น `null`/ค่าว่างและมี numeric value ให้ถือเป็น `Normal`; source status ที่ไม่รู้จักและไม่ว่างให้ส่ง `Etc.` แทน numeric value.
- Parameter matching ต้อง trim และเทียบแบบ case-insensitive แต่ unit ในวงเล็บต้องตรงกับ registered parameter.
- Parameter ที่ซ้ำหลัง normalize ให้เก็บตำแหน่งแรก; parameter ที่ไม่ตรง registered parameters ตอบ `400 Bad Request`.

## Confirmed Frequency Scope

- `hourly`: อ่าน interval `60m`.
- `daily`: อ่าน interval `1day`.
- รุ่นแรกยังไม่รองรับ `monthly` และ `yearly` เพราะไม่มี aggregation rule ที่ยืนยัน; backend ต้อง reject ค่าเหล่านี้อย่างชัดเจน และ frontend handoff ต้องระบุให้ซ่อนหรือ disable ตัวเลือก.
- `hourly` จำกัดช่วง inclusive ไม่เกิน 366 วัน.
- `daily` จำกัดช่วง inclusive ไม่เกิน 10 ปี.

## Confirmed Authorization And Delivery

- Authentication: Bearer token required.
- Permission: `dashboard.stats:export`.
- Data scope: ใช้ scope ของ `dashboard.stats:export` โดยตรง.
- Backend stream CSV กลับใน response เดียว.
- ไม่สร้างไฟล์ถาวร ไม่สร้าง signed URL และไม่บันทึกประวัติ export.
- ไม่เปลี่ยน default role grants ของ `dashboard.stats:export` ในงานนี้.
- `admin` ยังคงได้รับทุก permission จาก seed; role/user อื่นต้องได้รับ export permission ผ่าน permission management.

## Confirmed Error Contract

- `400 Bad Request`: validation ผิด, `monthly`/`yearly`, ช่วงวันที่เกิน limit หรือ parameter ไม่ได้ลงทะเบียนกับจุดตรวจวัด.
- `401 Unauthorized`: ไม่มี bearer token ที่ถูกต้อง.
- `403 Forbidden`: ไม่มี `dashboard.stats:export` หรือ station อยู่นอก data scope.
- `404 Not Found`: ไม่พบ connected station, ไม่พบ source table หรือไม่มีข้อมูลในช่วงที่เลือก.
- กรณีไม่มีข้อมูลใช้ error code `NO_EXPORT_DATA` และไม่เริ่มส่ง CSV headers/body.

## TDD Seams

1. **HTTP seam** ผ่าน Express/Supertest: ตรวจ authentication, `dashboard.stats:export`, data scope, query validation, response headers, UTF-8 BOM, exact CSV body และ error envelopes.
2. **CSV export module interface**: รับ factory/station metadata, resolved parameter definitions และ known source rows แล้วคืน filename, content type และ CSV stream. ใช้ golden literal assertions สำหรับ column order, status mapping, two-decimal formatting, CRLF escaping และ formula-injection protection.

Tests mock ได้เฉพาะ database adapters ซึ่งเป็น system boundary. ห้ามทดสอบ private helpers, service call counts หรือ controller-to-service wiring เป็นพฤติกรรมหลัก.

ทำ TDD เป็น vertical slices ทีละข้อ:

1. Authorized hourly export คืน golden CSV ที่ถูกต้อง.
2. Parameter selection/order และ `all`.
3. Operational status/completeness mapping.
4. Daily export, missing `ctime`, ascending rows และ duplicate timestamps.
5. Authentication, permission, scope และ validation errors.
6. Missing station/table/data errors และ response streaming headers.

## Implementation Scope

- แก้เฉพาะ `backend/` และ canonical backend Markdown documentation.
- ไม่แก้ `frontend/`; frontend handoff ต้องระบุ endpoint, query, file response, error handling และให้ซ่อน/disable `monthly`/`yearly`.
- ไม่แก้ role seed grants.
- ไม่เพิ่ม export history table, stored file, signed URL หรือ background job.

## Runtime Checkpoint

ไม่มี checkpoint เพิ่มหลังผู้ใช้กด export; backend ต้อง validate request และตอบไฟล์หรือ error ที่ frontend แสดงได้ทันที.

## Definition Of Done

ผู้ใช้ยืนยัน shared understanding แล้ว. Backend implementation, focused/full verification และ canonical documentation ผ่านตาม TDD seams ในเอกสารนี้.
