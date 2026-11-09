# ผลส่งสิทธิ์ผู้ประกอบการรายโรงงานขึ้น production

[กลับสารบัญหลักฐาน](../README.md) · [สัญญา API](../../api/menus/eligible-factories/operator-access.md) · [คู่มือเปิดใช้](../../guides/operator-eligible-factory-access.md)

หลักฐานของการส่ง backend วันที่ 9 พฤศจิกายน 2569 ตรวจ health สำเร็จเวลา 16:23 น. ตาม `Asia/Bangkok` ผลนี้ยืนยันเฉพาะ release ที่ระบุ ไม่ใช้แทน contract ปัจจุบัน

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

## สถานะการเปิดใช้งาน

Runtime OpenAPI ของ process ที่ deploy ยืนยัน:

```json
{
  "x-poms-eligible-operator-access-enabled": false,
  "x-poms-factory-status-sync-enabled": false
}
```

Release นี้ลง code, schema และ contract แล้ว โดยยังไม่เปิดการให้สิทธิ์หรือเริ่มงาน sync รายวัน ไม่เปลี่ยน frontend flag และไม่มีการสร้างสิทธิ์จริงระหว่างตรวจ การทดสอบนี้จึงไม่ใช่หลักฐานว่า authenticated CRUD, การรวมโรงงานหลัง login และทุกธุรกรรมผ่าน end-to-end บน production แล้ว

ก่อนเปิด flags ให้ตรวจ frontend adapter/flow, การปิดบัง query ใน production access logs และค่ารอบ/ความสดของต้นทางตามคู่มือเปิดใช้ พร้อมทดสอบกรณี 0→1/2/3 และการเพิกถอนด้วย token เดิม
