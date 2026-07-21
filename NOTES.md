# Workspace Notes

## Canonical Terms

- **คำขอปกติของผู้ประกอบการ**: คำขอ CEMS/WPMS ที่เริ่มจากผู้ประกอบการและเดินสถานะตรวจแบบ ตั้งค่า ยืนยัน และตรวจสอบก่อนเป็น `CONNECTED`.
- **การเชื่อมต่อโดยเจ้าหน้าที่โดยตรง**: เจ้าหน้าที่กรอกคำขอเพิ่มจุดตรวจวัดผ่าน API เฉพาะ โดยกำหนดรหัสจุดตรวจวัดเองและให้ระบบบันทึกเป็น `CONNECTED` ทันที.
- **เลขคำขอปกติ**: `CEMS-YY-#####` หรือ `WPMS-YY-#####`.
- **เลขคำขอเจ้าหน้าที่โดยตรง**: `OLDC-YY-#####` สำหรับ CEMS และ `OLDW-YY-#####` สำหรับ WPMS โดยแยกลำดับจากคำขอปกติ.
- **รหัสจุดตรวจวัด**: `measurementPoints[].pointCode` ที่เจ้าหน้าที่เป็นผู้กรอกใน flow โดยตรง.
- **รหัสจุดตรวจวัดคำขอปกติ**: รหัสที่ backend ออกเมื่ออนุมัติแบบเข้าสู่ `WAITING_CONNECTION`; CEMS เริ่มขั้นต่ำที่ `S2001` และ WPMS เริ่มขั้นต่ำที่ `W2001` โดยแยกลำดับกัน.
- **ข้อมูลปัจจุบัน/Live**: แถวที่ใช้งานอยู่ใน `cems_wpms_connected_measurement_points` และถูกใช้โดย API จุดตรวจวัดที่เชื่อมต่อแล้ว.
- **โรงงานในระบบ POMS / ข้อมูลโรงงานระบบ POMS**: ข้อมูลโรงงาน current/live หลังเชื่อมต่อสำเร็จ ซึ่งปัจจุบันแสดงผ่าน active rows ใน `cems_wpms_connected_measurement_points`; ไม่ได้หมายถึงตาราง master `factories`.
- **โรงงานที่เข้าข่าย / ข้อมูลโรงงานที่เข้าข่าย**: ข้อมูลโรงงานที่ถูกคัดเลือกและเก็บใน `eligible_factories` แยกจากข้อมูล current/live ของ POMS.
- **ตาราง `factories`**: master สำหรับตัวตนโรงงาน การอ้างอิง และสิทธิ์เข้าถึง; ไม่ใช่ชุดโรงงานที่เชื่อมต่อแล้วในความหมายทางธุรกิจ.
- **Connection-request eligibility invariant**: โรงงานต้องมี active row ใน `eligible_factories` ก่อนจึงจะส่งคำขอเชื่อมต่อได้; request workflow และการเชื่อมต่อห้ามสร้าง eligible row โดยอัตโนมัติ.
- **POMS eligibility invariant**: ข้อมูล current/live ใน POMS ต้องสืบทอดความสัมพันธ์ `eligible_factory_id` จากคำขอที่ผ่าน eligibility precondition แล้ว.
- **พิกัดโรงงาน**: `latitude` / `longitude` ระดับ factory profile จากคำขอ ซึ่ง sync ไปยัง `cems_wpms_connected_measurement_points.factory_latitude` / `factory_longitude` และ `eligible_factories.latitude` / `longitude`; ไม่ใช่พิกัดจุดตรวจวัดใน `cems_wpms_measurement_points.latitude` / `longitude`.

## Confirmed Context

- งานรอบนี้เป็น backend และเอกสารเท่านั้น ไม่แก้ `frontend/`.
- การเชื่อมต่อโดยเจ้าหน้าที่โดยตรงต้องเก็บในโครงสร้างคำขอหลักเดียวกับ flow ผู้ประกอบการ เพื่อให้รายการคำขอ รายละเอียด ประวัติ และ API จุดเชื่อมต่อเดิมมองเห็นข้อมูลได้.
- Flow โดยตรงไม่เดินผ่าน `PENDING_DESIGN_REVIEW`, `WAITING_CONNECTION` หรือ `CONNECTION_CONFIRMED`; สถานะแรกและสถานะปลายทางคือ `CONNECTED`.
- ต้องเก็บแหล่งที่มาแยกจากคำขอปกติ เช่น `OFFICER_DIRECT_API` และคง audit ผู้ดำเนินการ.
- สิทธิ์ Direct Connect รอบแรกให้เฉพาะ role `monitoring_kpm` และ `admin` ผ่าน permission เฉพาะ; role เจ้าหน้าที่อื่นไม่ได้สิทธิ์โดยอัตโนมัติ.
- รหัสจุดตรวจวัดของ Direct Connect ไม่มี prefix หรือรูปแบบตามชนิดระบบ เจ้าหน้าที่กำหนดค่าเอง; backend บังคับเฉพาะค่าที่ไม่ว่างหลัง trim และความยาวตามฐานข้อมูล.
- หากรหัสจุดตรวจวัดซ้ำกับจุด active ระบบต้องตอบ `409 Conflict`, rollback ทั้งคำขอ และไม่แทนที่หรือย้ายข้อมูลเดิม.
- Direct Connect หนึ่งคำขอสร้างจุดตรวจวัดได้ exactly หนึ่งจุด เพื่อให้เลขคำขอ ประวัติ และ conflict boundary แยกรายจุด.
- Direct Connect ไม่สร้าง `device_connection_configs` หรือ measurement channels; การตั้งค่าอุปกรณ์ยังใช้ operation แยก.
- การเปลี่ยนลำดับรหัสคำขอปกติไม่ migrate รหัสเดิม `Sxxxx`/`Pxxxx`; หากมี `Sxxxx` หรือ `Wxxxx` สูงกว่าเลขตั้งต้น ระบบออกต่อจากเลขสูงสุดของ prefix เดียวกัน.
- เมื่อผู้ใช้ขอให้อัปเดตทั้ง “โรงงานในระบบ POMS” และ “โรงงานที่เข้าข่าย” หลังเชื่อมต่อ ให้ตีความว่า sync ไปยัง current/live connected POMS data และ `eligible_factories`; ไม่อัปเดต `factories` เว้นแต่ผู้ใช้ระบุชื่อตารางนั้นโดยตรง.
- การ sync พิกัดโรงงานหลังเชื่อมต่อห้ามแก้พิกัดเฉพาะจุดตรวจวัดเดิมหรือจุดตรวจวัดใหม่.
- การ sync factory profile หลังเชื่อมต่อใช้ patch semantics: ค่า optional ที่เป็น `null` หรือไม่ได้ส่งต้องเก็บค่าปัจจุบันไว้ ไม่ล้างข้อมูลเดิม.
- พิกัดโรงงานเป็นข้อมูลหนึ่งคู่; อัปเดตเมื่อคำขอมีทั้ง latitude และ longitude เท่านั้น หากขาดค่าหนึ่งให้คงพิกัดเดิมทั้งคู่.
- รูปหน้าโรงงานและโลโก้เป็นอิสระจากกัน; หากคำขอใหม่ไม่มี document title ของชนิดใด ให้คงรูปชนิดนั้นจาก POMS ไว้.
- ก่อนสร้างคำขอเชื่อมต่อทุกชนิดต้อง resolve active โรงงานเข้าข่ายจาก identifier aliases ให้สำเร็จ หากไม่พบให้ปฏิเสธ submission โดยไม่สร้าง request, history, measurement point หรือ POMS data.
- ก่อนเข้าสู่ `CONNECTED` ต้องตรวจว่า `eligible_factory_id` ของคำขอยังเป็น active eligible factory; หากถูกถอด/soft-delete ให้ตอบ `409 Conflict`, คงสถานะคำขอเดิม และไม่แก้ POMS current/live.
- Migration ต้องหยุดและ rollback หาก active POMS data เดิมจับคู่กับ active `eligible_factories` ไม่ได้; ห้ามลบ POMS row หรือสร้าง eligible row อัตโนมัติเพื่อให้ migration ผ่าน.
- โรงงานที่มี active POMS connected point ห้ามถูก soft-delete ออกจาก `eligible_factories`; endpoint ต้องตอบ `409 Conflict` เพื่อรักษา POMS eligibility invariant.
- งานรอบนี้เตรียม migration `0076_sync_connected_factory_profiles_with_eligible_factories.ts` และทดสอบ SQL แบบ static เท่านั้น โดยไม่ได้สั่งรัน migration กับฐานข้อมูลจริง.
