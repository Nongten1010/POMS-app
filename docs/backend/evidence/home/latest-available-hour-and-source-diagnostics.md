# ข้อมูลรายชั่วโมงล่าสุดและการตรวจต้นทาง P0389/S1105

> Owner: Backend

## ขอบเขตและสัญญาที่ใช้อ้างอิง

แก้เฉพาะ backend, runtime OpenAPI และเอกสาร ไม่แก้ frontend และไม่เขียนฐานข้อมูลจริง ผลทดสอบกับฐานจริงใช้โค้ดใน workspace ไม่ใช่ผลหลัง deploy

- [สัญญาหน้าหลักและสถานะอายุข้อมูล](../../api/menus/home/README.md#latest-available-hour)
- [Integration dashboard](../../api/integrations/factory-dashboard/README.md)
- [Breaking change และวิธีย้าย client](../../api/CHANGELOG.md#home-latest-available-hour)

## การทำซ้ำและตรวจการแก้ไข

ก่อนแก้ ชุดทดสอบเรียก `parameterValuesService.latestHourly(..., { homeHour: true })` ด้วยข้อมูลเก่าข้ามวันแล้วได้ `[]` และ dashboard/map ตัดข้อมูลเก่าทิ้ง อีกกรณีไม่มีแถวก็ยังใส่วันเวลาชั่วโมงเป้าหมายใน `latestMeasurement`

หลังแก้ เลือกชั่วโมงเดียวล่าสุดที่มีและจบแล้วต่อจุด เก็บทุกแถวพารามิเตอร์/หน่วยในชั่วโมงนั้น คืนเวลาจริงและ `freshness` ไม่ข้าม source `NoData` ไปเอาค่าปกติเก่า และไม่เปลี่ยนสถิติ/ปฏิทิน/CSV หรือ `operator-factories`

| การตรวจ | หลักฐาน |
| --- | --- |
| RED: ชุดทดสอบข้อมูลเก่าข้ามวัน | ก่อนแก้ คาด `23:40:00`, `23:05:00` แต่ได้ `[]` |
| RED: dashboard/map | ก่อนแก้ ข้อมูลเก่าถูกตัดออก ทั้งสอง surface และไม่มี `freshness` |
| GREEN: service และ OpenAPI | ทดสอบเลือกวัน/ชั่วโมงล่าสุด, กันชั่วโมงที่ยังไม่จบ, คง source `NoData`, คงสถานะมลพิษ, เวลาว่างเป็น `null` และ contract ของ integration |
| อ่านฐานจริงผ่าน dashboard service หลังแก้ | ผลด้านล่าง ครบ 4 โรงงาน/5 จุด โดยไม่เขียนฐานข้อมูล |

ผลตรวจ: ชุดทดสอบที่เกี่ยวข้อง 12 ชุด รวม 406 tests ผ่าน, `npm run typecheck` ผ่าน, ESLint ของไฟล์ที่แตะไม่มี error (มี formatting warning เดิม 1 จุดใน `poms.openapi.ts` ที่อยู่นอกการแก้ไข) และตรวจ relative links/JSON examples ในเอกสารที่แตะผ่าน

คำสั่งทดสอบหลัก:

```bash
cd backend
npm test -- --runInBand --runTestsByPath \
  tests/unit/parameter-values.home-handoff.test.ts \
  tests/unit/home-dashboard-visibility.test.ts \
  tests/unit/home-handoff.openapi.test.ts \
  tests/unit/integration-factory-dashboard.openapi.test.ts \
  tests/unit/connection-requests.service.test.ts \
  tests/unit/parameter-values.service.test.ts
npm run typecheck
```

## ผลอ่านฐานจริงวันที่ 19 ตุลาคม 2026

วันเวลาข้อมูลต่อไปนี้เป็น `cdate`/`ctime` ที่ต้นทางเก็บตาม `Asia/Bangkok` โดยไม่ชดเชย timezone ซ้ำ

| เลขทะเบียน | จุด | วันเวลารายชั่วโมงล่าสุด | ผลโค้ดใหม่ |
| --- | --- | --- | --- |
| `10120000325542` | `S1125` | `2026-10-14 04:00:00` | `data` 1 แถว, `freshness: stale` |
| `10240000825596` | `P0389` | `2026-10-16 15:00:00` | `data` 1 แถว, `freshness: stale` |
| `10740120925630` | `S1105` | ไม่พบตาราง `ingest.S1105_data_60m` | `data: []`, `freshness: noData`, `date/time: null` |
| `10210100425571` | `S2002`, `S2003` | `2026-10-15 23:00:00` ทั้งสองจุด | จุดละ 1 แถว, `freshness: stale` |

ทุกโรงงานยังมี active connected point และผล visibility ของทั้ง 5 จุดเป็น `factoryVisible: true`, `pointVisible: true`, `fullyExempt: false` ค่าของ `S1125` ที่เกินเกณฑ์ยังเป็น `exceeded` แม้ snapshot เป็น `stale` และ `hasLatestHourlyMeasurement` ยังคง `false` ตามอายุข้อมูล

`P0389` มี `Watt` ในแถวรายชั่วโมงเก่าที่ใช้หน่วย `kW` ขณะที่พารามิเตอร์ปัจจุบันเป็น `Watt (kW/hr)` จึงไม่แปลงหรือย้ายค่าระหว่างหน่วยโดยอัตโนมัติ ค่านั้นยังเป็น `noData` ส่วน `BOD (mg/l)` และ `Flow Rate (m3/hr)` แสดงค่าเก่าได้

## ต้นทาง P0389

ข้อเท็จจริงจากการอ่านตาราง:

- รายชั่วโมงล่าสุด: ตรวจวัด `2026-10-16 15:00:00`, ส่ง `2026-10-16 16:07:03`
- ข้อมูล 5 นาทีล่าสุด: ตรวจวัด `2026-10-16 15:35:00`, ส่ง `2026-10-16 15:44:03`
- รายชั่วโมงวันที่ 16 ตุลาคมมี 16 แถว (`00:00` ถึง `15:00`) และไม่มีแถววันที่ 17–19 ตุลาคม
- รายละเอียดยืนยันว่ารายนาทียังทำงาน: วันที่ 17 และ 18 ตุลาคมมีวันละ 1,437 แถว และวันที่ 19 ยังเพิ่มต่อเนื่องระหว่างตรวจ จึงไม่ใช่การหยุดรับข้อมูลทุกความถี่
- ตาราง `ingest.P0389_data_60m` ยังอยู่ สร้างวันที่ 5 สิงหาคม 2026 วันสร้าง/แก้ schema ไม่ใช่เวลาที่ข้อมูลหยุดอัปเดต
- config ที่ยังใช้งานมี 2 ชุด: ID `152` เปิด `test_mode` ทุกช่อง และ ID `183` ปิด `test_mode` ทุกช่อง ทั้งคู่ใช้ `POMS_BOX` มีช่อง BOD/Watt/Flow สถานะ `Normal` ข้อเท็จจริงนี้ยังไม่ยืนยันว่า config เป็นสาเหตุ เพราะต้องตรวจพฤติกรรมการเลือก device ของตัวประมวลผล

## ต้นทาง S1105

- ตารางที่พบคือ `ingest.S1105_data_1m` และ `ingest.S1105_data_5m` สร้างวันที่ 14 กันยายน 2026 ไม่พบ `S1105_data_60m` ใน metadata ของตารางทุก schema ที่บัญชีมองเห็น
- ตรวจยืนยันด้วย `SELECT TOP 1 cdate, ctime FROM ingest.S1105_data_60m` แล้วได้ `Invalid object name 'ingest.S1105_data_60m'` จึงไม่ใช่เพียงการไม่พบชื่อใน metadata
- รายละเอียด 5 นาทีล่าสุดคือ `2026-09-15 22:05:00` ไม่มีแถว 5 นาทีในช่วง 14–19 ตุลาคม
- รายละเอียดรายนาทีเริ่มมีข้อมูลในช่วงตรวจวันที่ 16 ตุลาคม เวลา `14:41`; วันที่ 17 มี 1,438 แถว และวันที่ 18 มี 1,437 แถว วันที่ 19 ยังเพิ่มต่อเนื่องระหว่างตรวจ
- config ปัจจุบัน ID `210` และ `211` ใช้ `POMS_BOX` ทุกช่องปิด `test_mode` และมีสถานะ `Normal` ไม่ใช่กรณีที่ไม่มี active config
- พิสูจน์ได้ว่าตารางรายชั่วโมงไม่มีอยู่ขณะตรวจ แต่ยังพิสูจน์ไม่ได้ว่าไม่เคยสร้างหรือถูกลบมาก่อน

## ข้อจำกัดและขั้นตอนตรวจต่อ

backend ใน repository นี้อ่านตารางตรวจวัด และส่ง device config ให้ระบบ integration ไม่พบเส้นทางสร้างตารางรายชั่วโมงหรือรวมค่ารายนาทีในเส้นทางที่เกี่ยวข้อง การคืนค่าล่าสุดแก้การแสดงผล แต่ไม่ได้ทำให้ข้อมูลรายชั่วโมงต้นทางกลับมาอัปเดต

บัญชีฐานข้อมูลที่โครงการใช้อยู่มี `VIEW DEFINITION = 0` และการอ่าน `msdb.dbo.sysjobsteps` ถูก SQL Server ปฏิเสธด้วย `SELECT permission denied` จึงยังระบุชื่อ job, ข้อผิดพลาดใน worker หรือเหตุที่หยุดรวมข้อมูลไม่ได้ ผลค้นหา module/trigger ที่ว่างไม่ใช่หลักฐานว่าไม่มี worker เพราะ metadata visibility ถูกจำกัด

สิ่งที่ต้องตรวจจากเจ้าของระบบรับ/ประมวลผลข้อมูล:

1. log ของ worker หรือ SQL Agent รอบ `2026-10-16 15:35–16:10` ตามเวลาไทยสำหรับ `P0389` รวมขั้นตอน 5 นาทีและ 60 นาที
2. การเลือก config/device เมื่อ `P0389` มีชุดทดสอบและชุดจริงพร้อมกัน โดยเทียบ ID `152`/`183` และไม่สรุปจาก Test Mode อย่างเดียว
3. ขั้นตอน provision ตาราง/ลงทะเบียน aggregate ของ `S1105` โดยตรวจ startup และ error log รอบเริ่มรับรายนาทีวันที่ 16 ตุลาคม

ยังไม่ได้สร้างตาราง ปรับ config เปิด job หรือเปลี่ยนสิทธิ์ฐานข้อมูล การดำเนินการเหล่านั้นต้องมีหลักฐานสาเหตุก่อนและอนุมัติการเปลี่ยนระบบจริงแยกต่างหาก

## Documentation impact

```text
Docs impact: updated
Canonical docs:
- docs/backend/api/menus/home/README.md#latest-available-hour
- docs/backend/api/integrations/factory-dashboard/README.md
Reason: แสดงข้อมูลรายชั่วโมงล่าสุดที่มีพร้อมเวลาจริงและสถานะอายุข้อมูล
Client impact: รองรับ freshness และ date/time ที่เป็น null; ไม่ซ่อนค่าด้วย hasLatestHourlyMeasurement=false
Breaking change: yes — docs/backend/api/CHANGELOG.md#home-latest-available-hour
```

ก่อน release ต้องให้ผู้รับผิดชอบ frontend/integration review contract และหลังอนุมัติ deploy จึงตรวจ runtime `/api/v1/openapi.json` กับ response จริงอีกครั้ง
