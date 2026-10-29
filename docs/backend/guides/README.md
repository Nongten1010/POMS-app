# Backend Guides

คู่มือในหมวดนี้อธิบายวิธีทำงาน เช่น setup, testing, deployment, integration และการเขียนเอกสาร backend

## Documentation

- [Documentation templates](./documentation/README.md)

## Frontend Handoffs

- [ขอเชื่อมต่อ: ชื่อนิคมในรายการโรงงานผู้ประกอบการและเจ้าหน้าที่](./frontend-handoffs/connection-factory-estate-name/README.md)
- [ตารางคำขอแก้ไขโรงงาน: ใช้ข้อมูลสรุปและจุดเป้าหมาย พร้อมรายการตรวจรับ](./frontend-handoffs/edit-request-list-summary/README.md)
- [แก้ไขจุดตรวจวัด: เปิดแก้ข้อมูลทั่วไปโรงงาน พร้อม payload และรายการตรวจรับ](./frontend-handoffs/measurement-point-general-info/README.md)

- [แก้ไขข้อมูลทั่วไปโรงงาน: 7 fields, payload และรายการตรวจรับของ frontend](./frontend-handoffs/factory-basic-info/README.md)
- [ตั้งค่าอุปกรณ์: งานที่ frontend ต้องแก้และ test checklist](./frontend-handoffs/device-config/README.md)
- [กฎหมายและคำถามที่พบบ่อย: เชื่อม frontend กับ API production](./frontend-handoffs/laws-and-faqs/README.md)

## Database operations

- [ตรวจคอลัมน์และ receipt ก่อนเปิดใช้การล้างเฉพาะพารามิเตอร์](./parameter-measurement-cleanup-audit.md)
- [ข้อมูลทั่วไปโรงงานเข้าข่ายและ POMS ชุดเดียวกัน: โครงสร้างและการเปิดใช้](./factory-profile-consistency-rollout.md)

- [ล้างข้อมูลทดสอบด้วย SQL](./test-data-cleanup.md)
- [ล้างจุดที่ยังไม่เชื่อมต่อและคืนรหัสค้าง: กรณี S0527](./cleanup-unconnected-point-code.md)

## Production delivery

- [ส่ง backend ขึ้น production ผ่าน Git และเก็บการแก้เดิมบนเซิร์ฟเวอร์ก่อน sync](./production-git-delivery.md)

## Integrations

- [คู่มือการเชื่อมโยง Integration Device Config API (PDF)](./integrations/integration-device-config-api-user-guide.pdf) — สำหรับโปรแกรมส่งค่า; รวม `16bit`, Scale/Gain, Modbus read function/Quantity, Serial ASCII และกติกาสถานะคำขอ; อ้างอิง [contract หลัก](../api/integrations/device-configs/README.md)
- [คู่มือการเชื่อมโยง Integration Alert Events API และผลทดสอบ Production (PDF)](./integrations/integration-alert-events-production-test-guide.pdf)

## Notifications

- [อีเมลแจ้งเตือนมลพิษ: รอบ ผู้รับ นโยบาย และผล SMTP](./alert-email-operations.md)
- [ลองอีเมลครบหกแบบในเครื่อง: ชุดจำลองและรายงานผล](./alert-email-test.md)
