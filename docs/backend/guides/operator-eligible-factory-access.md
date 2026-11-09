# เปิดใช้สิทธิ์ผู้ประกอบการสำหรับโรงงานที่ยังไม่แจ้งประกอบ

[กลับไปคู่มือ Backend](./README.md) · [สัญญา API และกติกาสิทธิ์](../api/menus/eligible-factories/operator-access.md)

> มี source implementation ใน change นี้ ยังไม่ได้รัน migration บน SQL Server จริง ไม่ได้ตั้งค่าหรือเปิด worker บน production และยังไม่ได้ยืนยัน frontend end-to-end

## ขอบเขตที่พัฒนา

รองรับแผนผูกบัญชีที่เคยยืนยันตัวตนผ่าน i-industry กับ `eligible_factories` เฉพาะสถานะยังไม่แจ้งประกอบ รวมรายชื่อหลัง login และตรวจสถานะจาก Fac60k ทุกวัน รุ่นนี้ใช้ admin เท่านั้น เหตุผลเพิ่ม/ยกเลิกไม่บังคับ และไม่มี upload หลักฐาน ตาม handoff ของ frontend

กติกาสิทธิ์ request/response และ errors อยู่ในหน้าสัญญาที่ลิงก์ด้านบน ใช้หน้านั้นเป็นแหล่งเดียวสำหรับ frontend

## การจัดเก็บและความเข้ากันได้

Migration `0158_create_eligible_operator_access` เพิ่มตารางรายการผูก เหตุการณ์สิทธิ์ สถานะต้นทาง เหตุการณ์สถานะ และผลรอบงาน โดยไม่ backfill สิทธิ์หรือเปลี่ยนข้อมูลจริงให้ผู้ใช้รายใด

`factory_access_identities` เป็น read-only view รวม supporting master จริงกับ identity จากโรงงานเข้าข่ายที่มีรายการผูกเปิดอยู่และยังไม่มี master ใช้เลขทะเบียนใหม่จริง ไม่เพิ่มแถวจำลองใน `factories` หรือ `juristics` และไม่เปลี่ยนชนิด/ความหมาย `ownedFactoryIds` ช่องทางเขียน master จาก i-industry ยังคงเขียนตารางจริงตามเดิม

เมื่อปิด backend flag จะใช้ query และสิทธิ์เดิม ไม่อ่านตารางใหม่ เมื่อเปิด flag การตรวจ OWN_FACTORY ใช้รายการผูกที่ active, ไม่สิ้นสุด, โรงงานไม่ถูกลบ, ผล Fac60k เป็น 0 และเวลาตรวจยังไม่เกินอายุที่กำหนด ร่วมกับสิทธิ์เดิมแบบ OR โดยไม่ขยายสิทธิ์ไปทั้งนิติบุคคล

## การตั้งค่า

| ตัวแปร | Default | ความหมาย |
| --- | --- | --- |
| `ELIGIBLE_OPERATOR_ACCESS_ENABLED` | `false` | เปิด API และการรวมสิทธิ์หลัง migration |
| `FACTORY_STATUS_SYNC_ENABLED` | `false` | เปิด worker รายวัน ต้องเปิดตัวแรกด้วย |
| `FACTORY_STATUS_MAX_AGE_SECONDS` | `3600` | อายุผลตรวจสำเร็จ 60–86400 วินาที; ตอน login/ใช้ token จะ refresh โรงงานที่มีรายการผูกเปิดอยู่เมื่อผลเก่า |
| `FACTORY_STATUS_SYNC_HOUR` | `2` | ชั่วโมงเริ่มงาน 0–23 ตาม `Asia/Bangkok`; ข้อเสนอเริ่มต้น ต้องปรับหลังทราบรอบต้นทาง |

เวลา default และอายุข้อมูลเป็นค่าตั้งต้นสำหรับ deployment ไม่ใช่ข้อรับรองว่า Fac60k ต้นทางอัปเดตทุกชั่วโมง ผลตรวจสำเร็จยืนยันข้อมูลที่ต้นทางมีในเวลานั้นเท่านั้น

## งานตรวจรายวัน

Server เริ่ม timer ตรวจทุกนาที ไม่มี polling จาก browser เมื่อถึงชั่วโมงที่กำหนดจะ claim งานของวันไทยจากฐานข้อมูลด้วย application lock และ lease/token หลาย process จึงใช้รอบงานร่วมกัน งาน complete ไม่รันซ้ำในวันเดียวกัน งาน failed หรือ lease หมดอายุ retry ได้หลัง process กลับมาทำงาน โดยข้ามรายการที่ตรวจสำเร็จในรอบวันเดียวกันแล้ว

อ่านโรงงานเข้าข่ายที่ยังไม่ถูกลบเป็นชุดละ 100 รายการ และอ่าน Fac60k ด้วย FID แบบ batch โดยไม่กรอง FFLAG จึงตรวจพบสถานะจำหน่ายทะเบียน `2` ได้ การอ่านเฉพาะรายตอนให้สิทธิ์ใช้ lookup FID เดียว timeout 10 วินาที

แต่ละโรงงาน lock แถวและตรวจ identity ก่อนบันทึก ป้องกันผลตรวจเก่าเขียนย้อนใหม่ การรันซ้ำไม่เพิ่ม status event ถ้า flag ไม่เปลี่ยน เก็บ `last_attempt_at` แยก `last_success_at` และบันทึกเหตุ SOURCE_NOT_FOUND/SOURCE_AMBIGUOUS/SOURCE_STATUS_UNKNOWN/SOURCE_UNAVAILABLE โดยไม่เดาหรือล้างสถานะที่ยืนยันแล้ว

อัปเดตเฉพาะ `eligible_factories.operation_status` เมื่อได้ flag ที่รู้จัก และเหตุการณ์/ผลรอบงาน/รายการผูกที่เกี่ยวข้อง สถานะประกอบกิจการนี้อยู่นอก canonical factory profile และ current eligible view อ่านจากแถวเข้าข่ายเดิม จึงไม่เขียน profile revision หรือเปลี่ยนข้อมูลทั่วไปที่อนุมัติแล้ว

ไม่เขียนชื่อ ที่อยู่ พิกัด EIA โครงการ ผู้ติดต่อ เอกสาร การเลือกเข้าข่าย supporting master สถานะคำขอ หรือ active connected points จากงานนี้

## ขั้นตอนก่อนเปิดใช้งานจริง

1. ตรวจ diff และรัน backend typecheck/tests รวมชุดสิทธิ์ใหม่ ทดสอบ migration และ concurrency ด้วย SQL Server ทดสอบที่แยกจาก production
2. ตรวจแผน query/index และภาระงานด้วยปริมาณโรงงานเข้าข่ายจริง ทดสอบหลาย process claim งานและแข่งกัน grant/revoke/sync
3. ทดสอบ error ของ source, ข้อมูลซ้ำ, identity เปลี่ยน และ timeout; ยืนยันนโยบายอายุข้อมูลและรอบต้นทางก่อนเลือกค่าจริง
4. ตั้ง reverse-proxy/access logs ไม่เก็บ query สำหรับ `/eligible-factories/*/operator-access/candidates`; application ตัด query ใน error logs แล้ว แต่ไม่ควบคุม proxy logs
5. รัน migration ผ่านวิธี release ของโครงการ แล้ว deploy backend โดยยังปิด flags
6. เปิด backend access flag และ sync flag หลังตรวจ schema/source connectivity แล้ว ตรวจผลรอบงานและรายการสถานะที่เปลี่ยน
7. ให้ frontend ตรวจ adapter กับ contract และทดสอบทุกธุรกรรมที่ใช้สิทธิ์ รวมกรณีไม่มี factory master, ไม่ส่ง juristics, token เก่า, `0 → 1/2/3` ก่อนเปิด frontend flag
8. ตรวจ runtime `/api/v1/openapi.json` และ `/api/v1/docs/` ให้ตรงกับ source contract หลัง production deployment โดยอ่าน `x-poms-eligible-operator-access-enabled` และ `x-poms-factory-status-sync-enabled` เพื่อยืนยัน flags ที่ process ใช้จริง

เอกสารนี้ไม่อนุญาตให้รัน migration, deploy หรือเปลี่ยน production configuration โดยอัตโนมัติ

## ตรวจผลและการหยุดใช้

ตรวจ `eligible_factory_status_runs` เพื่อดูสถานะงาน จำนวนตรวจ/ล้มเหลวและ lease; ตรวจ `eligible_factory_source_status` เพื่อแยกเวลาลองกับเวลาสำเร็จ; ตรวจ `eligible_factory_status_events` เพื่อดู flag เดิม/ใหม่และเวลาตรวจพบ ไม่ใช้เป็นเวลาเปลี่ยนทะเบียนจริงถ้าต้นทางไม่ได้ให้มา

หยุด feature ได้ด้วย flags แล้ว restart ตามกระบวนการ release สิทธิ์เดิมจากแหล่งอื่นไม่ถูกเพิกถอน แต่สิทธิ์พิเศษจากรายการผูกจะไม่ถูกนำมาใช้ เก็บ schema และประวัติไว้ ไม่ drop ตารางที่มีข้อมูล การ rollback schema ที่มีประวัติต้องใช้ forward migration; migration down ปฏิเสธหากมีรายการผูกหรือ status events

## หลักฐานที่ยังต้องเก็บก่อน release

Tests ใน change นี้ใช้ query จริงผ่าน SQL fixture ที่แปลงเฉพาะ dialect และ fixture ของ provider จึงไม่ใช่หลักฐานการรัน MSSQL locks, view, filtered unique index หรือ lease concurrency บน server จริง ต้องบันทึกผล SQL Server และ frontend end-to-end ก่อนกล่าวว่า production พร้อมเปิดใช้

สิทธิ์และผลตรวจต้นทางบันทึก FID ที่ยืนยันไว้ด้วย หากเลขทะเบียนใหม่ของแถวเข้าข่ายเปลี่ยน จะใช้ cache/สิทธิ์จากเลขเดิมกับเลขใหม่ไม่ได้ รายการผูกเดิมสิ้นสุดพร้อมเหตุผล `FACTORY_IDENTITY_CHANGED` และต้องให้แอดมินอนุมัติใหม่หลังยืนยันต้นทาง ไม่สร้างหรือซ่อม identity อัตโนมัติ
