# ผลส่งและเปิดใช้สิทธิ์ผู้ประกอบการรายโรงงานบน production

[กลับสารบัญหลักฐาน](../README.md) · [สัญญา API](../../api/menus/eligible-factories/operator-access.md) · [คู่มือเปิดใช้](../../guides/operator-eligible-factory-access.md)

บันทึกการส่ง backend และการเปิดฟีเจอร์วันที่ 9 พฤศจิกายน 2569 ตาม `Asia/Bangkok` แยกผลก่อนและหลังเปิด flags ไว้ด้านล่าง หลักฐานยืนยันเฉพาะรุ่นและรอบตรวจที่ระบุ ไม่ใช้แทน contract ปัจจุบัน

## รุ่นและผลตรวจ

| รายการ | ผลที่ยืนยัน |
| --- | --- |
| Release commit | `076414a4a1e7008beb400e528672d170f085b96b` บน `main` |
| Workflow | [Deploy POMS — 42592404989](https://github.com/Nongten1010/POMS-app/actions/runs/42592404989) สำเร็จ |
| ขอบเขต deploy | Backend เท่านั้น; งาน build/deploy frontend ถูกข้าม |
| Hosted CI | Build ผ่าน; Jest ผ่าน 5,741 รายการ ข้าม 18 รายการ; 415 suites ผ่าน และ 2 suites ข้าม |
| Deployment helpers | ผ่าน 18 รายการ รวมการ backup/stash source และเก็บ untracked helper ก่อน fast-forward |
| Migration | `0158_create_eligible_operator_access` ผ่าน; workflow รายงาน `Batch 128 run: 1 migrations` |
| Server checkout | Workflow ยืนยัน HEAD ตรงกับ release commit ก่อนติดตั้ง |
| Backend health | HTTP 200, `success: true`, `status: ok`; timestamp `2026-11-09T09:23:29.278Z` |
| Factory profile mode | `legacy` ตาม preflight ของ production |

## การเก็บ source เดิมบน production

ก่อน sync พบ tracked edits 5 ไฟล์เกี่ยวกับจังหวัดโรงงาน และ untracked helper `backend/src/shared/services/factory-source-provinces.ts` จึงเก็บ source ที่ตรวจแล้วรวม 11 paths พร้อม SHA-256 ตาม [audit run 42590613718](https://github.com/Nongten1010/POMS-app/actions/runs/42590613718)

นำการแก้เดิมกลับเข้า Git ก่อนติดตั้ง ตรวจ executable tokens ของ provider, provider factory, eligible-factory service และ province helper ว่าตรงกับ source ใน snapshot เมื่อไม่นับรูปแบบ whitespace/quote พร้อมปรับ canonical docs และ tests ของจังหวัดต้นทาง

Workflow ตรวจ hash/HEAD/status ซ้ำก่อนเปลี่ยน checkout เก็บ backup นอก webroot และ stash เฉพาะ source ที่ตรวจแล้ว ไม่ใช้ reset/clean ล้าง source บน production และไม่ stash-pop ทับรุ่นใหม่

- Backup: `C:\apps\POMS-backups\20261109T092236949Z-4993439fa4dddfd3`
- Stash: `fdebdb270a946adfd268ccb54e6dc45ac8db22f8`
- HEAD เดิม: `1cb80f41c11fd91788b1335ae0720dc9f7b21407`
- ไม่เก็บไฟล์ `.env`, token, password หรือ production credentials ในหลักฐานนี้

## การตรวจ HTTP หลังติดตั้ง

อ่านจาก production โดยไม่ใช้ token และไม่ส่งข้อมูลบุคคลจริง:

| การตรวจ | ผล |
| --- | --- |
| [OpenAPI](https://d-poms.diw.go.th/api/v1/openapi.json) | HTTP 200; 164 canonical endpoints / 173 operations |
| [Swagger](https://d-poms.diw.go.th/api/v1/docs/) | HTTP 200 |
| Operator-access contract | พบ GET snapshot, GET candidates, POST grant และ POST revoke ครบ; ระบุ `eligible_factories:view` และ admin |
| เหตุผลเพิ่ม/ยกเลิก | Schema ไม่บังคับ `reason`; เพิ่มบังคับเฉพาะ `userId` |
| ไม่ส่ง token ไป operator-access | HTTP 401, `success: false`, `error.code = UNAUTHORIZED` |
| จังหวัดจาก Fac60k | Contract ของ login ยังคง `503 FACTORY_PROVINCE_UNAVAILABLE` จากการแก้เดิม |

## สถานะหลังส่ง backend ก่อนเปิดฟีเจอร์

Runtime OpenAPI ของ process ที่ deploy ยืนยัน:

```json
{
  "x-poms-eligible-operator-access-enabled": false,
  "x-poms-factory-status-sync-enabled": false
}
```

Release นี้ลง code, schema และ contract แล้ว โดยยังไม่เปิดการให้สิทธิ์หรือเริ่มงาน sync รายวัน ไม่เปลี่ยน frontend flag และไม่มีการสร้างสิทธิ์จริงระหว่างตรวจ การทดสอบนี้จึงไม่ใช่หลักฐานว่า authenticated CRUD, การรวมโรงงานหลัง login และทุกธุรกรรมผ่าน end-to-end บน production แล้ว

ก่อนเปิด flags ให้ตรวจ frontend adapter/flow, การปิดบัง query ใน production access logs และค่ารอบ/ความสดของต้นทางตามคู่มือเปิดใช้ พร้อมทดสอบกรณี 0→1/2/3 และการเพิกถอนด้วย token เดิม

## ผลเปิดใช้วันที่ 9 พฤศจิกายน 2569

ผู้ดูแลสั่งตรวจ frontend/access logs และเปิดฟีเจอร์บน production โดยตรง จึงเปิด backend และ frontend configuration ผ่าน workflow ใน Git โดยไม่แก้ frontend source และไม่สร้างสิทธิ์ให้ผู้ใช้รายใดระหว่างตรวจ

| รายการ | ผลที่ยืนยัน |
| --- | --- |
| ตรวจความพร้อม | [42594406551](https://github.com/Nongten1010/POMS-app/actions/runs/42594406551): backend ทำงาน, Fac60k เชื่อมต่อได้, โรงงานเข้าข่าย 937 รายการ, ไม่มีรายการผูกเดิม |
| เปิด configuration | [42595145744](https://github.com/Nongten1010/POMS-app/actions/runs/42595145744) สำเร็จ; control scripts รุ่น `954804fa8b4d21a26bb1d5f48ba21f1cf78a8e98` |
| Backend application | ยังคง release `076414a4a1e7008beb400e528672d170f085b96b`; restart แล้ว health และ runtime flags ผ่าน |
| ตรวจรอบแรก | [42595467353](https://github.com/Nongten1010/POMS-app/actions/runs/42595467353): flags และ private logging ผ่าน; daily run เป็น `complete` |
| Frontend build/deploy | [42595625750](https://github.com/Nongten1010/POMS-app/actions/runs/42595625750) สำเร็จ; Vite build ผ่าน; backend build/install ถูกข้ามตาม target |
| Frontend marker | `sha=954804fa8b4d21a26bb1d5f48ba21f1cf78a8e98`, `run_id=42595625750`, `deployed_at=2026-11-09T09:45:10.7368261Z` |
| Bundle ที่ browser โหลดจริง | adapter call เปลี่ยนจาก `enabled:!1` เป็น `enabled:!0`; `isDevelopment:!1` จึงใช้ `/api/v1` |
| Browser smoke | หน้าแรกและ login แสดงได้หลัง deploy; Swagger HTTP 200; operator-access ที่ไม่มี token ยัง HTTP 401 / `UNAUTHORIZED` |
| ตรวจหลัง frontend deploy | [42595941895](https://github.com/Nongten1010/POMS-app/actions/runs/42595941895): flags ยังเปิด, private logging ผ่าน และ daily run ยังเป็นรอบ complete เดิม ไม่มีการรันซ้ำ |

ค่าที่เปิดใน environment บนเซิร์ฟเวอร์:

```dotenv
ELIGIBLE_OPERATOR_ACCESS_ENABLED=true
FACTORY_STATUS_SYNC_ENABLED=true
FACTORY_STATUS_SYNC_HOUR=2
FACTORY_STATUS_MAX_AGE_SECONDS=3600
VITE_ELIGIBLE_OPERATOR_ACCESS_ENABLED=true
```

Public runtime OpenAPI ยืนยัน backend flags ทั้งสองเป็น `true` หลัง restart และหลัง frontend deploy ส่วน frontend flag ยืนยันจาก bundle ที่ browser ดาวน์โหลดจริง ไม่ใช่อาศัยการอ่าน environment อย่างเดียว

### ผล sync รอบแรกบน SQL Server จริง

วันงาน `2026-11-09`, `status=complete`, `checked_count=937`, `failed_count=0`, `finished_at=2026-11-09T09:41:17.083Z` หรือ 16:41:17 น. เวลาไทย:

| FFLAG | สถานะ | จำนวน |
| --- | --- | ---: |
| `0` | ยังไม่แจ้งประกอบ | 5 |
| `1` | แจ้งประกอบแล้ว | 915 |
| `2` | จำหน่ายทะเบียน | 1 |
| `3` | หยุดชั่วคราว | 16 |

ทุกรายการมี `error_code=null` และจำนวนรายการผูกยังเป็นศูนย์ งานประจำวันเริ่มที่ 02:00 น. `Asia/Bangkok`; วันเปิดใช้เริ่มรอบแรกทันทีเพราะเลยชั่วโมงที่ตั้งไว้แล้ว งานที่ complete ใช้ผลร่วมจากฐานข้อมูล ไม่เริ่มใหม่ในวันเดิม การตรวจสิทธิ์พิเศษยัง refresh ผลต้นทางเมื่อเกินอายุ 3,600 วินาทีตาม contract

### Access logs และการสำรอง

ก่อนเปิดพบ `cs-uri-query` และข้อความ canary ใน IIS log จริง จึงลบ `UriQuery` และ `Referer` จาก W3C fields เฉพาะไซต์ `POMS` ผ่าน Microsoft.Web.Administration โดยยังเก็บ path, method, status, IP, bytes และเวลาตอบสนอง; ไม่ลบหรือแก้ log เก่า การตั้ง fields ระดับไซต์มีผลกับทั้งไซต์ POMS ตาม [IIS logFile contract](https://learn.microsoft.com/en-us/iis/configuration/system.applicationhost/sites/site/logfile/?view=iis-10.0)

ตรวจว่าใช้ site logging, ไม่มี custom fields และไม่ได้เปิด failed-request tracing ก่อนเปลี่ยน configuration แล้วส่ง query/Referer canary ที่ไม่มีข้อมูลบุคคลจริง ตรวจ log segment ใหม่พบ path กับ 401 และไม่พบ canary ทั้งก่อนและหลังเปิด flags

สำรอง environment และ `applicationHost.config` ไว้ที่ `C:\apps\POMS-backups\operator-access-42595145744-20261109164038` โดยจำกัด ACL ให้ SYSTEM/Administrators ไม่มี environment หรือเนื้อหา access log ที่มีข้อมูลผู้ใช้ถูกส่งขึ้น artifact หรือ Git

### การตรวจและข้อจำกัด

- Frontend adapter ผ่าน 5 tests; การตรวจ admin/capability, การส่ง eligible row ID, optional reason, masking และการจัดการ response ที่ยืนยันผลไม่ได้ผ่าน
- Backend feature ผ่าน 20 tests รวม grant/revoke, token เดิม, ไม่มี master, FID เปลี่ยน, `0→1/2/3`, source เก่าหรืออ่านไม่ได้ และ retry งานรายวัน; เป็น SQL/provider fixtures ไม่ใช่บัญชี production
- Environment patch helper ผ่าน 3 tests และ PowerShell parser ผ่านบน runner ก่อนเปลี่ยนค่า; มี backup และคืน environment เดิมเมื่อ restart/runtime flags ไม่ผ่าน
- ตรวจ browser แบบไม่ได้ login จึงยังไม่ได้ทดสอบ authenticated grant/revoke และการรวมรายชื่อหลัง login ด้วยบัญชีจริงบน production และไม่ได้ทำ load/concurrency test หลาย process บน production

วิธีปิด flags และ deploy frontend ให้กลับตามค่าปิดอยู่ใน [คู่มือเปิดใช้](../../guides/operator-eligible-factory-access.md) โดยเก็บ schema และประวัติไว้
