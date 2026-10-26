# หลักฐานการอ่าน config ตามสถานะคำขอ

Contract: [Integration device config](../../api/integrations/device-configs/README.md#สถานะคำขอและการเลือก-config)

## ขอบเขตหลักฐานและการ sync เข้า Git

ส่วนผล production deployment ด้านล่างเป็นหลักฐานของการ deploy โดยตรงเมื่อ 22 ตุลาคม 2569 ซึ่งยังไม่ได้ commit/push คุณสมบัตินี้เข้า Git ในรอบนั้น ส่วนผลทดสอบก่อนหน้านั้นมาจาก checkout พัฒนาเดิม ไม่ใช่ผลตรวจ production candidate รอบปัจจุบัน

รอบนี้นำ implementation, migration `0144` และสัญญา API กลับมารวมบน Git ชุดเดียวกับงานเลิกใช้ Test mode โดยรักษา `testMode: false` และการแก้สิทธิ์/ownership ที่ใหม่กว่า ต้องตรวจ candidate แล้ว push เข้า Git ก่อนให้ production workflow deploy จาก commit เดียวกัน ห้ามใช้หลักฐานเดิมสรุปว่ารอบ sync นี้ push/deploy หรือยืนยัน production OpenAPI แล้ว ผลหลัง Git push และ workflow สำเร็จต้องบันทึกแยกจาก snapshot เดิม

## ผล audit source บนเซิร์ฟเวอร์ก่อน sync

[Inspect production checkout run `40337096354`](https://github.com/Nongten1010/POMS-app/actions/runs/40337096354) สำเร็จบน commit `c84cc044` ที่ push แล้ว งานนี้อ่านอย่างเดียว ไม่เปลี่ยน checkout, ฐานข้อมูล หรือ service และ artifact มีเฉพาะ source 6 paths ที่กำหนด พร้อม manifest/patch ไม่มี `.env`

- Manifest ระบุ checkout HEAD บนเซิร์ฟเวอร์เป็น `baa5128c90d7fb4ac1e9354a0daec49ee72bb6b2` และมี tracked source เปลี่ยน 5 ไฟล์; migration `0144` รวมอยู่ใน source ที่ตรวจด้วย
- ตรวจ SHA-256 ของ source ทั้ง 6 ไฟล์ใน artifact กับ manifest แล้วตรงกัน จากนั้นเทียบเนื้อหาจริงกับ candidate ที่รวม integration feature แล้ว
- Controller, integration repository และ migration `0144` ตรงกับ candidate ส่วน device-config repository, integration service และ `poms.openapi.ts` ต่างเฉพาะการปรับ `testMode: false` และ response schemas ที่ตั้งใจเพิ่มในงานเลิกใช้ Test mode ไม่พบ live hotfix อื่นสูญหายใน source 6 ไฟล์ที่ตรวจ

ผลนี้ยืนยันความครบของการเทียบ source ในขอบเขตที่ตรวจเท่านั้น ยังไม่ใช่หลักฐานว่า integrated candidate ถูก push หรือ deploy สำเร็จ ขั้นถัดไปใช้ [วิธีส่ง production ผ่าน Git](../../guides/production-git-delivery.md), เก็บการแก้เดิมตาม manifest ก่อน fast-forward แล้วตรวจ tests, migration, health และ production OpenAPI ของ commit ที่ workflow ใช้ ผล final deployment ยังรอยืนยันแยกจาก audit รอบนี้

## ผลตรวจสัญญา API ของ candidate ในรอบ sync

ชุดรวมก่อน push ผ่าน `npm run build`, `npm run typecheck` และ `npm run lint` (0 errors, 355 warnings เดิมของชุด backend) พร้อมชุดทดสอบรวม 365 suites / 4,912 tests ผ่าน ไม่มี failure; 14 tests ข้ามตาม opt-in Coverage: statements 80.45%, lines 82.35%, functions 84.05%, branches 79.56%

Helper สำหรับปรับ checkout ตรวจด้วย Git repository จำลองจริง 9 กรณี รวม backup/stash/fast-forward, การรันซ้ำ, ไฟล์หรือ index เปลี่ยนหลัง snapshot, path ที่ไม่อนุญาต, target ผิด และการรักษา untracked deployment marker; syntax check ผ่าน ตรวจ workflow แล้ว reconciliation ปิดโดยค่าเริ่มต้นและเปิดได้เฉพาะ manual backend โดยส่ง manifest ผ่าน environment ไม่แทรก JSON เป็นคำสั่ง PowerShell

Candidate ตั้งต้นจาก `9a13dc0a` และรักษาสัญญาเลิกใช้ Test mode: response ยังคง `testMode: false` เสมอ ผลนี้ยังไม่ใช่หลักฐานว่า Git push หรือ production workflow สำเร็จ

```bash
cd backend
npm test -- --runInBand tests/unit/integration-device-configs.openapi.test.ts tests/unit/test-mode-retirement.openapi.test.ts tests/unit/api-docs.openapi.test.ts tests/unit/api-docs.route.test.ts
```

ใช้ environment สมมติสำหรับการทดสอบ โดยไม่ติดต่อฐาน production: 4 suites / 90 tests ผ่าน ทั้ง legacy/annual paths, scoped API key, cancellation/snapshot fallback, `404`, `no-store`, ข้อกำหนดไม่ log `dbPass` และ `testMode: false`. ต้องรวมผล runtime regression และ checks ของ candidate ทั้งชุดก่อน push/deploy แล้วตรวจ production OpenAPI ตาม commit ที่ workflow ใช้แยกอีกครั้ง

## อาการและสาเหตุ

การเรียก API สำหรับจุดที่บันทึก config แล้วแต่ยังไม่มี connected row ตอบ `404 Connected measurement point not found` ทั้งที่ worker ต้องอ่าน config ก่อนยืนยันเชื่อมต่อ การอ่าน current config เดิมไม่ตรวจสถานะคำขอต้นทาง และสำเนาที่คัดลอกจากคำขอไม่เก็บต้นทาง จึงยังมี config ที่ใช้งานได้ในระดับ storage หลังคำขอถูกยกเลิก

## Feedback loop

```bash
cd backend
npm test -- --runInBand --runTestsByPath tests/unit/integration-device-configs.request-status.test.ts
```

ก่อนแก้: `10 failed, 3 passed` โดยกรณี 7 สถานะที่อนุญาตตอบ not found และ reader ยังคืน config จากคำขอที่ยกเลิก จากนั้นเพิ่มกรณีขอบเขตและทดสอบซ้ำหลังแก้

ทดสอบ service และ repository จริงผ่าน SQL fixture; แทนเฉพาะขอบเขตฐานข้อมูลด้วย SQLite และแปลง SQL Server syntax ที่ fixture รองรับ ไม่ใช้ production database ใน regression suite ไม่ใช่หลักฐานการตรวจ concurrency หรือ DDL บน SQL Server จริง

## ขอบเขตทดสอบ

- ทุกสถานะยกเว้น `CANCELED` รวม `REJECTED` อ่าน config ได้โดยไม่มี connected row
- คำขอที่ยกเลิกทั้งกรณีไม่มีและยังมี connected row ไม่คืนจุดนั้น
- current copy ที่มีต้นทางยกเลิกไม่คืน devices, channels หรือ schedules ของคำขอนั้น; fallback ใช้ snapshot ล่าสุดที่ยัง active ของคำขอที่ใช้ได้ต่ออุปกรณ์เดียวกัน
- legacy current ที่ไม่รู้ต้นทางและมีคำขอยกเลิกไม่ถูกนำกลับมาใช้; current ที่บันทึกโดยตรงพร้อมข้อมูลต้นทางชัดเจนยังใช้ได้
- การบันทึกจริงเก็บ `source_request_id` / `source_recorded` บนสำเนา current และการยกเลิกมีผลโดยไม่ลบข้อมูล
- request ที่ถูกลบหรือหาไม่พบไม่เป็นแหล่ง config; การลบ device จาก current ไม่คืน snapshot เก่า
- snapshot-only config อ่านได้; station identifier ถูก bind เป็นค่า SQL
- OpenAPI ทั้ง legacy และ annual path ประกาศสถานะ, snapshot fallback, `404`, API key และการปกป้อง credentials ตรงกัน

## ผลตรวจ

| รายการ | ผล |
| --- | --- |
| `npm run build` | ผ่าน |
| `npm run typecheck` | ผ่าน |
| `npm run lint` | ผ่าน ไม่มี error; มี warning เดิมใน repository |
| ชุดทดสอบที่เกี่ยวข้อง 27 suites | ผ่าน 306/306 tests |
| Coverage ของ integration device-config และ device-config repository | statements 90.32%, branches 83.06%, lines 92.48% |
| Security | scoped API-key/validation tests ผ่าน, ไม่พบค่าความลับจาก environment ในไฟล์ที่เปลี่ยน, ไม่เพิ่ม debug logging |
| Diff | 19 ไฟล์ใน backend และ canonical docs; คงการแก้ไขเดิมของผู้ใช้, ไม่แตะ frontend |
| Docs transition checks | relative links และ reachability ของเอกสารที่เปลี่ยนทั้ง 5 ไฟล์ผ่าน; repository ยังไม่มี package script สำหรับ docs guard ตาม specification |

HTTP smoke test บน backend ที่รันบนเครื่องนี้ โดยอ่าน SQL Server จริงแบบ read-only และไม่รัน migration: ผ่านทั้ง `FACTORY_PROFILE_MODE=legacy` และ `canonical` จุด `P0437` / `P2008` คืน `200` พร้อม config, `P0267` ที่ยกเลิกคืน `404`, และ control `P0348` คืน `200` ทุกคำตอบรวม `404` มี `Cache-Control: no-store` เก็บเฉพาะ status, station และจำนวนรายการ ไม่เก็บ credentials หรือ response body เต็ม

## Deployment และเอกสาร

ต้องรัน [migration 0144](../../../../backend/src/db/migrations/0144_track_device_config_request_source.ts) ก่อนเริ่ม backend รุ่นใหม่ Migration เพิ่มเฉพาะ provenance columns ไม่แก้/ลบ config เก่า ข้อมูลเก่าที่ไม่ยืนยันต้นทางและมีประวัติคำขอที่ใช้ไม่ได้จะใช้เฉพาะ snapshot ที่ยืนยันได้ ไม่เดาจาก settings หรือ timestamp ที่เหมือนกัน

หลัง production deployment ต้องตรวจ `/api/v1/openapi.json` และ smoke test จุดก่อนเชื่อมต่อ, จุดที่เชื่อมต่อแล้ว และจุดที่ยกเลิก โดยไม่บันทึก API key หรือ response ที่มี `dbPass` ลง log

## ผล production deployment

ผู้ใช้อนุญาตให้ deploy backend และรัน migration บนเซิร์ฟเวอร์โดยตรงแล้ว Deploy สำเร็จวันที่ 22 ตุลาคม 2569 เวลา 18:03 น. (`Asia/Bangkok`) ผ่าน Windows App ที่เชื่อมต่อเซิร์ฟเวอร์ ไม่ commit หรือ push Git และไม่ deploy frontend

- รัน `npm run db:migrate -- --env production` บนเซิร์ฟเวอร์ หลังตรวจว่ามี pending migration เฉพาะ `0144_track_device_config_request_source.ts` บันทึกสำเร็จเป็น batch `118` และตรวจพบ columns `source_request_id` / `source_recorded` ในฐานข้อมูล `POMS`
- เทียบ source จริงก่อน deploy พบว่า OpenAPI บนเซิร์ฟเวอร์มีงานอื่นที่ใหม่กว่า workspace จึงสร้าง patch เฉพาะงานนี้บน source เซิร์ฟเวอร์ เก็บการเปลี่ยนแปลงอื่นไว้ทั้งหมด Source implementation อีก 4 ไฟล์ตรงกับชุดที่ผ่าน regression tests
- Deploy source 5 ไฟล์, JavaScript 5 ไฟล์, source maps 5 ไฟล์ และ migration 1 ไฟล์ ตรวจ SHA-256 ทั้งก่อนและหลังคัดลอก โดยสำรองไฟล์เดิมที่ `C:\apps\POMS-backups\device-config-20261022-180235`
- Release identity: `device-config-request-status-20261022`; archive SHA-256: `ebf8b565e29189a262ae1242ee66d46230e85eb9bbe43d93f051f5380e8589ee` บันทึก marker บนเซิร์ฟเวอร์ที่ `C:\apps\POMS-app\backend\DEVICE_CONFIG_DEPLOYMENT.json`
- Service `poms-app-backend` เป็น `Running` และ local health check ตอบ `200` ไม่เปลี่ยน service configuration หรือ credentials ปิดตัวรับส่งไฟล์ชั่วคราวผ่าน VPN หลังตรวจสำเร็จ

ผล HTTP ผ่าน `https://d-poms.diw.go.th/api/v1/integrations/device-configs/` หลัง deploy:

| Station | ผล | ข้อมูลที่ยืนยัน |
| --- | --- | --- |
| `P0437` | `200` | `P0437/01`, port `10502`, พารามิเตอร์ 4 รายการ: `BOD (mg/l)`, `COD (mg/l)`, `Flow rate (m3/hr)`, `Watt (kW/hr)` |
| `P0267` | `404 NOT_FOUND` | ไม่มี `data` หรือ config; message `Measurement point not found` |
| `P2008` | `200` | config 1 อุปกรณ์ / 4 พารามิเตอร์ ก่อนเชื่อมต่อ |
| `P0348` | `200` | control ที่เชื่อมต่อแล้ว ยังอ่าน config 1 อุปกรณ์ / 3 พารามิเตอร์ได้ |

ทุกคำตอบในตารางมี `Cache-Control: no-store` การไม่ส่ง API key และใช้ key ที่ไม่ถูกต้องยังตอบ `401` ตรวจสถานะคำขอจากฐานข้อมูลซ้ำแล้ว `P0437` ยังคง `CONNECTION_CONFIRMED` และ `P0267` ยังคง `CANCELED` ไม่ปรับสถานะเพื่อให้ทดสอบผ่าน

ตรวจ [production OpenAPI](https://d-poms.diw.go.th/api/v1/openapi.json) แล้วทั้ง legacy และ annual device-config paths ระบุทุกสถานะยกเว้น `CANCELED`, รวม `REJECTED`, snapshot fallback, scoped API key, `no-store` และตัวอย่าง `404` ตรงกับ behavior เปรียบเทียบ JSON ทั้งฉบับก่อน/หลังโดยตัดเฉพาะ 2 paths นี้ออกแล้วส่วนอื่นเท่ากันทั้งหมด [Swagger UI](https://d-poms.diw.go.th/api/v1/docs/) ตอบ `200`

```text
Docs impact: updated
Canonical docs: docs/backend/api/integrations/device-configs/README.md; docs/backend/api/menus/connection-requests/operator-cancel-request.md
Reason: อ่าน config ก่อนเชื่อมต่อและตัดค่าจากคำขอ CANCELED พร้อมติดตามต้นทาง
Client impact: integration
Breaking change: yes
```

Breaking-change entry: [device-config-request-status](../../api/CHANGELOG.md#device-config-request-status)
