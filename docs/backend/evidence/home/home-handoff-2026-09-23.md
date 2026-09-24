# แผนและหลักฐานงานหน้าหลักตาม handoff 23 กันยายน 2026

## ขอบเขต

ใช้ [handoff](https://github.com/Nongten1010/POMS-app/blob/main/frontend/md/frontend-handoff-23092026.md) เป็น requirement สำหรับ dashboard, public map, measurement statistics และ calendar ของหน้าหลักเท่านั้น อ้างอิงสัญญาหลักที่ [หน้าหลัก](../../api/menus/home/README.md) และ [จุดตรวจวัดที่เชื่อมต่อแล้ว](../../api/shared/connected-measurement-points/README.md)

ใช้ `contract-first` กำหนดสัญญา, `diagnosing-bugs` พิสูจน์ปัญหา, `ai-regression-testing` ป้องกันผลกระทบ และ `verification-loop` ตรวจผล ไม่แก้ frontend ไม่แก้ข้อมูล production และไม่เปลี่ยน API ของเมนูอื่น

## แผนดำเนินงาน

1. ตรวจ code path, consumers และ tests ของ API เป้าหมาย เก็บ baseline ของงานที่แก้ค้างไว้
2. ยืนยันความหมายที่ยังเปิดอยู่ด้านล่าง และอัปเดต canonical contract/OpenAPI ก่อน implementation ที่เกี่ยวข้อง
3. เพิ่มกรณีทดสอบเวลาไทย 10:30, เที่ยงคืน, ข้อมูลส่งช้า และข้อมูลครบเฉพาะชั่วโมงที่จบแล้ว แล้วแก้ calculation ของหน้าหลัก
4. กรองรายการยกเว้นทั้งหมดและ visibility ก่อน response/summary; ตรวจการจับคู่ข้อมูลนิคมและ popup
5. ตรวจสถานะ `lateData` และลำดับ `exceeded > warning > lateData > normal` พร้อมคงกฎ `insufficient`, `noData`, `invalid`
6. ตรวจจำนวนวันต่ำกว่า 80% แบบต่อเนื่อง และวันเกินมาตรฐานแบบไม่ซ้ำจากต้นปีถึงวันสิ้นสุดที่เลือก
7. รัน tests ที่เกี่ยวข้อง, typecheck, ตรวจ diff และ docs guard; บันทึกผลจริงก่อนปิดงาน

## ข้อสรุปที่ผู้ใช้ยืนยัน

- หลังกรองทุกเงื่อนไข หากไม่มีจุดตรวจวัดเหลือ ให้ตัดโรงงานออกจาก dashboard/public map และยอดสรุป
- นับเปอร์เซ็นต์เป็นคู่พารามิเตอร์ที่แสดง–ชั่วโมง จึงแยกกรณีพารามิเตอร์ส่งต่างเวลากันได้
- popup แสดงทุกพารามิเตอร์ที่เปิดใช้จากชั่วโมงล่าสุดที่จบแล้ว; พารามิเตอร์ไม่มีค่าคืน `noData` และไม่ย้อนใช้ค่าเก่า
- source row `00:00` เป็นชั่วโมงแรกของวัน แม้ข้อความหน้าจอเขียน `00:01`
- `cdate`/`ctime` เป็นเวลาตรวจวัดหน้าเครื่อง และ `udate`/`utime` เป็นเวลาที่เครื่องส่งข้อมูล ผู้ใช้ยืนยันว่าปรับ timezone ต้นทางแล้ว ใช้ค่าทั้งสองชุดตาม `Asia/Bangkok` โดยไม่บวก/ลบ offset เพิ่มใน Backend

## กรณีสำคัญที่ตรวจพบระหว่างทำ

- Repro เวลาไทย 10:30 มีข้อมูล 00–09 ครบ แต่ calculation เดิมคืน 91% และนำ row ชั่วโมง 10 ไปตัดสินมลพิษ
- ต้องแยก visibility ของหน้าหลักจากเมนูจัดการ เพื่อให้ผู้มีสิทธิ์ยังเห็นรายการที่ซ่อนและเปลี่ยนกลับได้
- วันเริ่มอ่านประวัติใช้วันที่เก่ากว่าระหว่างวันเชื่อมต่อและ source แรก เพื่อไม่ให้การเพิ่มพารามิเตอร์ภายหลังทำให้ประวัติต้นปีหาย
- Popup ต้องอ่านทุก row ในชั่วโมงเป้าหมายและใช้ตัวเลือกค่ารายพารามิเตอร์ร่วมกับตาราง รวม explicit `noData`
- เกณฑ์ต่ำกว่า 80% ต้องไม่ผ่านเพราะการปัดเศษจำนวนคู่พารามิเตอร์–ชั่วโมง

## หลักฐานและสถานะ

ตรวจ implementation และ regression tests ในเครื่องแล้ว ไม่ใช้ผลทดสอบในเครื่องเป็นหลักฐานการ deploy

| การตรวจ | ผล |
| --- | --- |
| Targeted regression รวม home, parameter-values, connection requests, CSV และ integration dashboard | 26 suites / 536 tests ผ่าน |
| ตรวจยืนยันเวลาส่งหลังผู้ใช้แก้ timezone: calculation, parameter-values service, dashboard/popup และ OpenAPI | 4 suites / 94 tests ผ่าน; เพิ่ม 4 กรณีสิ้นชั่วโมง ข้ามวัน วันถัดไปเวลาเท่าเดิม และข้ามปี |
| `npm run typecheck` | ผ่าน |
| `npm run build` | ผ่าน |
| ESLint เฉพาะไฟล์ที่แตะ | ไม่มี error; คง warning รูปแบบเดิมของ `mergeAddedParameterInstruments` ที่มีอยู่ก่อนงานนี้ |
| Independent code review | แก้ findings เรื่องประวัติเดิม, source completeness, explicit `NoData`, การเลือกทุก row ในชั่วโมง และการปัดเปอร์เซ็นต์แล้ว |
| ขอบเขต diff | ไม่แก้ frontend และคง user changes เดิม |

คำสั่ง regression รวม:

```bash
cd backend
npm test -- --runInBand --testPathPatterns='parameter-values|home-|connected-measurement-points|connection-requests\.(service|factory-status|canonical-reads|operator-factories|current-factory-profile)|integration-factory-dashboard|api-docs\.(openapi|route)|measurement-csv-export'
```

Tests หลัก: [calculation](../../../../backend/tests/unit/parameter-values.home-handoff.test.ts), [visibility/popup/IN_ESTATE](../../../../backend/tests/unit/home-dashboard-visibility.test.ts), [direct station access](../../../../backend/tests/unit/home-measurement-access.test.ts), [endDate](../../../../backend/tests/unit/parameter-values.home-query.test.ts), [OpenAPI](../../../../backend/tests/unit/home-handoff.openapi.test.ts)

การยืนยัน timezone พบว่าสูตรเดิมเปรียบเทียบวันและชั่วโมงครบทั้งสองชุดอยู่แล้ว จึงปรับชื่อภายในและคำอธิบายให้ตรงกับเวลาส่งจากเครื่อง พร้อมแก้ canonical docs/OpenAPI และเพิ่ม tests โดยไม่เปลี่ยนสูตรหรือชดเชยเวลาข้อมูลเก่า ก่อนแก้ OpenAPI การตรวจ contract ล้มเหลว 8 routes เพราะคำอธิบายขาด `cdate`/`udate`; หลังแก้ผ่านทั้ง 8 routes และ calculation ใหม่ทั้ง 4 กรณี `typecheck`, `build` และ ESLint เฉพาะ 4 ไฟล์ TypeScript ที่แตะในรอบนี้ผ่านทั้งหมด การทดสอบนี้ใช้ fixtures ไม่ได้อ่านข้อมูล production หลังแก้ timezone

คำสั่งตรวจยืนยัน timezone:

```bash
cd backend
npm test -- --runInBand --runTestsByPath tests/unit/parameter-values.home-handoff.test.ts tests/unit/parameter-values.service.test.ts tests/unit/home-dashboard-visibility.test.ts tests/unit/home-handoff.openapi.test.ts
```

การทดสอบ route ใช้พอร์ตชั่วคราวในเครื่องและผ่านหลังอนุญาตให้รันนอกข้อจำกัด listen ของ sandbox ไม่ได้เรียก production เพื่อเปลี่ยนข้อมูล

โครงการยังไม่มี docs guard implementation จึงตรวจ relative links และ reachability ของเอกสารงานนี้แทน: 194 ลิงก์และ 7/7 เอกสารผ่าน ไม่ครอบคลุม external URLs, anchors หรือ AST endpoint registry

## การตรวจชุด release

- เตรียม checkout แยกจาก production base `8a2d4319f91b4b96a7d1cedd6fed0e1202bcaf5e` และนำมาเฉพาะ delta ของงานนี้ 25 ไฟล์ โดยรักษางานล่าสุดบน `main` และไฟล์ใน workspace เดิม
- `npm ci` จาก lockfile ของ `main`, `npm run typecheck` และ `npm run build` ผ่าน; backend tests ทั้งหมดผ่าน 252 suites / 3,052 tests ด้วย credentials จำลอง, `PARAMETER_DB_SCHEMA=ingest` และ `PUBLIC_BASE_URL` ตาม fixtures
- ESLint ของ TypeScript ในชุด release ไม่มี error และเหลือ warning รูปแบบเดิม 1 จุด; `git diff --check`, relative links 194 รายการ และการเข้าถึงเอกสารทั้ง 7 ไฟล์ผ่าน
- ชุด release ไม่มีการเปลี่ยน frontend, dependencies หรือ database migrations เพิ่มเติม

## ขอบเขตที่ยังต้องตรวจตอน release

- ไม่ได้รัน against production SQL Server; query-level tests ใช้ Knex MSSQL builder และ fixtures
- หลักฐานข้างต้นเป็นผลตรวจก่อน deploy; หลัง deploy ต้องตรวจ workflow, healthcheck และ production `openapi.json` ให้ตรงกับชุด release
- Frontend ต้องรับ `lateData`, nullable percentages, `endDate`, `summary` และ `latestMeasurement` ตาม canonical contract; ไม่มีการแก้ frontend ในงานนี้

## Documentation impact

Docs impact: updated
Canonical docs: docs/backend/api/menus/home/README.md, docs/backend/api/shared/connected-measurement-points/README.md
Reason: เปลี่ยนการเลือกชั่วโมง การกรองรายการ และสถานะ/สรุปผลของหน้าหลักตาม handoff
Client impact: frontend
Breaking change: yes

Migration guidance: [API changelog งานหน้าหลัก](../../api/CHANGELOG.md#home-hourly-handoff-20260923)
