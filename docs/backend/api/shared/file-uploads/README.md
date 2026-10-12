# นโยบายอัปโหลดไฟล์ทั่วไป

> Owner: Backend

## เริ่มใช้งานสำหรับ Frontend

ส่ง `multipart/form-data` ไป endpoint ของเมนูเดิม ใช้ field `file` หรือ `files` ตาม contract ของแต่ละเมนู พร้อม Bearer token และ permission เดิม นโยบายนี้ใช้ร่วมกันกับขอเชื่อมต่อ โรงงานในระบบ โรงงานที่เข้าข่าย กวภ. รายงาน BOD/COD กฎหมาย และ FAQ

1. ส่งไฟล์ที่มีนามสกุลและมีข้อมูล โดยใช้เพดานเดิมในตารางด้านล่าง
2. ใช้ metadata จาก upload response ตามเดิม ไม่สร้าง MIME, storagePath หรือ token เอง
3. หาก API ปฏิเสธไฟล์ ให้แสดง error ของเมนูและให้เลือกไฟล์ใหม่ การผ่านตัวกรองไม่ใช่ผลตรวจไวรัส

ตัวอย่าง upload TXT สำหรับขอเชื่อมต่อ:

```bash
curl --request POST \
  --url '<BASE_URL>/api/v1/cems-wpms-requests/document-images' \
  --header 'Authorization: Bearer <ACCESS_TOKEN>' \
  --form 'file=@./notes.txt;type=text/plain'
```

## Endpoint และขนาดเดิม

| Endpoint | Field | ขนาดต่อไฟล์ | Canonical contract |
| --- | --- | --- | --- |
| `POST /api/v1/cems-wpms-requests/document-images` | `file` | 1 byte–5 MiB | [ขอเชื่อมต่อ](../../menus/connection-requests/README.md) |
| `POST /api/v1/poms-factories/document-images` | `file` | 1 byte–5 MiB | [โรงงานในระบบ](../../menus/master-data/factory-edit-requests.md) |
| `POST /api/v1/monitoring-point-forms/attachments` | `file` | 1 byte–10 MiB | [โรงงานที่เข้าข่าย](../../menus/eligible-factories/README.md) |
| `POST /api/v1/bod-cod-deviation-reports/attachments` | `file` | 1 byte–5 MiB | [รายงาน BOD/COD](../../menus/bod-cod-deviation-reports/README.md) |
| `POST /api/v1/kwp-form-submissions/attachments` | `file` | 1 byte–10 MiB เมื่อ `attachmentType` เป็น `GENERAL`, `RATA_REPORT`, `CALIBRATION_PHOTO`; ประเภทอื่นหรือไม่ส่งเป็น 5 MiB | [กวภ.](../../menus/kwp-forms/README.md) |
| `POST /api/v1/laws`, `PUT /api/v1/laws/:id` | `file` | 1 byte–10 MiB | [กฎหมาย](../../menus/laws/README.md) |
| `POST /api/v1/faqs`, `PUT /api/v1/faqs/:id` | `files` | 1 byte–10 MiB; รวมกับไฟล์เดิมไม่เกิน 10 ไฟล์ | [FAQ](../../menus/faqs/README.md) |

`MiB` เท่ากับ `1024 × 1024` bytes; จำนวนไฟล์ text fields, authentication, permissions, upload-token lifetime และ signed URL lifetime ใช้ค่าเดิมของเมนู

## Contract ร่วม

| รายการ | กติกา |
| --- | --- |
| ไฟล์ทั่วไป | รับ PDF, รูปภาพ, DOCX/XLSX/PPTX, ODT/ODS/ODP, TXT/CSV/JSON/XML, เสียง/วิดีโอ, ZIP และนามสกุลอื่นที่ไม่อยู่ในกลุ่มบล็อก |
| ชื่อไฟล์ | ต้องมีนามสกุลตัวอักษรอังกฤษ/ตัวเลข 1–16 ตัว; ชื่อส่วน basename ไม่เกิน 1024 ตัวอักษร; ชื่อที่คืนใน metadata ใช้ข้อจำกัดเดิมของเมนู ไม่รับ control characters, `:`, จุด/ช่องว่างท้ายชื่อ; ตรวจ suffix ทุกส่วน เช่น `payload.exe.txt` ถูกปฏิเสธ |
| โปรแกรมและสคริปต์ | บล็อกกลุ่ม EXE/DLL/MSI/COM/APK/JAR/WASM, BAT/CMD/PS1/SH/JS/PHP/PY และกลุ่มที่เทียบเท่า รวม HTML/SVG, shortcut และ config ที่รันคำสั่งได้; ตรวจ MIME เสี่ยง ลายเซ็นโปรแกรม และ script/active-content markers ที่รู้จักด้วย |
| Macro | บล็อกนามสกุล macro เช่น DOCM/XLSM/XLSB/PPTM และตรวจเนื้อหา ZIP/Office ที่ซ่อน `vbaProject`, macro-enabled content types, Excel macro sheets, Scripts/Basic หรือ embedded objects แม้เปลี่ยนชื่อเป็น DOCX/XLSX |
| Office รุ่นเก่าและ Access | ปฏิเสธ DOC/XLS/PPT/RTF, MDB/ACCDB และรูปแบบ macro ที่เกี่ยวข้อง และไฟล์ OLE แม้เปลี่ยนนามสกุล เพราะขั้นนี้ตรวจ macro ภายในรูปแบบเหล่านี้ไม่ได้ ใช้ DOCX/XLSX/PPTX ที่ไม่มี macro หรือ PDF แทน |
| Archive | รับ ZIP ที่ตรวจทุก entry ได้ รวม Office ZIP; ไม่รับ ZIP เข้ารหัส, symlink, traversal, ชื่อซ้ำ, local/central header ไม่ตรงกัน หรือ entry ที่เสี่ยง; ปฏิเสธ RAR/7Z/GZIP/TAR และ archive อื่นที่ยังตรวจไม่ได้ |
| ข้อจำกัดการตรวจ ZIP | รวมทุกชั้นไม่เกิน 256 entries, ขนาดหลังแตกไฟล์รวมไม่เกิน 25 MiB, ต่อ entry ไม่เกิน 10 MiB; ZIP ซ้อนภายในได้ 2 ชั้น; ไม่แตกไฟล์ลง disk |
| MIME response | กำหนดตามนามสกุล/ชนิดไฟล์ที่ตรวจ ไม่เชื่อ MIME ที่ client ส่ง; ชนิดไม่รู้จักเป็น `application/octet-stream`; client ต้องรับ MIME เป็น string ไม่จำกัด enum เดิม |
| ดาวน์โหลด | รูป JPEG/PNG และ PDF ยังคง preview แบบ `inline` ได้; ไฟล์อื่นเป็น `attachment` พร้อม `nosniff`. URL `/uploads/...` ส่งชนิดใหม่เป็น `application/octet-stream`; กฎหมาย/FAQ เป็น `attachment` ทุกชนิดอยู่แล้ว |
| ข้อจำกัดความปลอดภัย | ยังไม่มี antivirus หรือ CDR การตรวจ signature/markers ไม่สามารถรับรองว่าไฟล์ไม่มีมัลแวร์หรือโค้ดอันตรายทุกแบบได้ |

ตัวอย่าง response ขนาด 5 bytes:

```json
{
  "success": true,
  "data": {
    "title": "เอกสารและรูปภาพ",
    "description": null,
    "link": null,
    "fileName": "notes.txt",
    "fileUrl": "https://example.com/uploads/cems-wpms/document-images/2026/10/550e8400-e29b-41d4-a716-446655440000.txt",
    "fileType": "text/plain",
    "fileSize": 5
  }
}
```

รูปแบบ response และ error envelope ไม่เปลี่ยน: validation ใช้ `400 BAD_REQUEST` ใน upload ทั่วไป และ `400 VALIDATION_ERROR` พร้อม field details ในกฎหมาย/FAQ; multipart limits ใช้ `UPLOAD_ERROR` หรือ `FILE_UPLOAD_FAILED` ตามเมนู ดู [shared errors](../common-api/README.md)

## สำหรับ Backend Maintainer

| ส่วน | Implementation / Tests |
| --- | --- |
| กฎและรายการบล็อกที่ใช้จริง | [upload-file-policy.ts](../../../../../backend/src/shared/utils/upload-file-policy.ts) |
| ทดสอบการเปลี่ยนชื่อ สคริปต์ macro และ ZIP limits | [upload-file-policy.test.ts](../../../../../backend/tests/unit/upload-file-policy.test.ts) |
| Runtime OpenAPI | [upload-policy.openapi.ts](../../../../../backend/src/modules/api-docs/upload-policy.openapi.ts), [poms.openapi.ts](../../../../../backend/src/modules/api-docs/poms.openapi.ts) |
| ฐานข้อมูล | [0137_allow_general_attachment_file_types.ts](../../../../../backend/src/db/migrations/0137_allow_general_attachment_file_types.ts) |

ก่อนเปิด Backend รุ่นนี้ต้องรัน migration `0137` เพื่อคลาย MIME constraints ของ `factory_monitoring_point_attachments` และ `laws` พร้อมขยาย MIME column ของไฟล์แนบจุดตรวจวัดเป็น 128 ตัวอักษร; ขนาดไฟล์และ metadata เดิมไม่เปลี่ยน ไม่ต้องติดตั้ง antivirus บน server ในขั้นนี้ การ rollback จะปฏิเสธหากยังมีชนิดไฟล์ใหม่อยู่ โดยไม่ลบหรือแก้ไฟล์เดิม หลัง deploy ตรวจ runtime `/api/v1/openapi.json` ว่าแสดงนโยบายเดียวกัน
