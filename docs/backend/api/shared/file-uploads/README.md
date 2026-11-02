# นโยบายอัปโหลดไฟล์ทั่วไป

> Owner: Backend

## เริ่มใช้งานสำหรับ Frontend

ส่ง `multipart/form-data` ไป endpoint ของเมนูเดิม ใช้ field `file` หรือ `files` ตาม contract ของแต่ละเมนู พร้อม Bearer token และ permission เดิม นโยบายนี้ใช้ร่วมกันกับขอเชื่อมต่อ โรงงานในระบบ โรงงานที่เข้าข่าย กวภ. รายงาน BOD/COD กฎหมาย และ FAQ

1. ส่งไฟล์ที่มีนามสกุลและมีข้อมูล โดยใช้เพดานเดิมในตารางด้านล่าง
2. ใช้ metadata จาก upload response ตามเดิม ไม่สร้าง MIME, storagePath หรือ token เอง
3. หาก API ปฏิเสธไฟล์ ให้แสดง error ของเมนูและให้เลือกไฟล์ใหม่ การผ่านตัวกรองไม่ใช่ผลตรวจไวรัส

สำหรับรูปภาพ ให้ยึด `fileType` หรือ `mimeType` และ URL ที่ API คืน แทนการเดาชนิดจากชื่อไฟล์เดิม เช่น รูปชื่อ `photo.png` ที่มีเนื้อหา JPEG สามารถคืน MIME `image/jpeg` และ URL ลงท้าย `.jpg` โดยชื่อที่แสดงยังเป็น `photo.png`.

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
| PDF | ตรวจโครงสร้างออบเจ็กต์ รวมชื่อแบบ `#xx` และออบเจ็กต์บีบอัด; รับข้อความ/comment/ข้อมูลรูปภาพที่มีคำคล้าย `/JS` แต่บล็อก JavaScript, Launch, RichMedia และไฟล์ฝังจริง; ไม่รับ PDF ที่เสีย เข้ารหัส หรืออ่านตรวจไม่ได้ ดู [การตรวจ PDF](#การตรวจ-pdf) |
| ภาพ JPEG/PNG/GIF/WebP | ตรวจลายเซ็นภาพ รวม JPEG ที่ใช้ชื่อ `.jfif`; ไม่ตีความข้อมูล binary หรือ metadata ภายในภาพเป็นข้อความสคริปต์หรือ PDF เพียงเพราะมี marker คล้ายกัน หากชื่ออยู่ในกลุ่ม `.jpg`/`.jpeg`/`.jfif`/`.png`/`.gif`/`.webp` แต่ชนิดภาพจริงไม่ตรงชื่อ ให้รับและกำหนด MIME กับนามสกุลจัดเก็บตามชนิดภาพจริงใน storage ที่ใช้นามสกุล โดยคงชื่อเดิมสำหรับแสดงผล; `.jfif` ใช้นามสกุลจัดเก็บ `.jpg`; ไม่รับ PDF, HTML หรือโปรแกรมที่เปลี่ยนชื่อเป็นภาพ การตรวจนี้ไม่ใช่การ decode/re-encode ภาพหรือผลตรวจ antivirus |
| ชื่อไฟล์ | ต้องมีนามสกุลตัวอักษรอังกฤษ/ตัวเลข 1–16 ตัว; ชื่อส่วน basename ไม่เกิน 1024 ตัวอักษร; ชื่อที่คืนใน metadata ใช้ข้อจำกัดเดิมของเมนู ไม่รับ control characters, `:`, จุด/ช่องว่างท้ายชื่อ; ตรวจ suffix หลังจุดทุกส่วน เช่น `payload.exe.txt` ถูกปฏิเสธ โดยไม่ถือชื่อฐานก่อนจุดแรกเป็นนามสกุล เช่น `doc.pdf` และ `r.pdf` ใช้ได้เมื่อเนื้อหาผ่านการตรวจ |
| ชื่อ PDF ที่แปลงจาก Office | รับ suffix `.doc`, `.xls` หรือ `.ppt` ก่อนนามสกุลสุดท้าย `.pdf` เช่น `report.doc.pdf` เมื่อเนื้อหาเป็น PDF จริงและผ่านการตรวจโครงสร้างเดิม รวมถึงไฟล์ภายใน ZIP; ไม่รับ `.exe.pdf`, `.docm.pdf`, `.pdf.exe` หรือไฟล์ OLE/โปรแกรมที่เปลี่ยนชื่อให้ลงท้าย `.pdf` |
| TXT | ต้องเป็น UTF-8 และไม่มี NUL; รับข้อความอธิบายที่มีตัวอย่างแท็ก `<script>` หรือ `<svg>` อยู่ภายใน แต่ยังปฏิเสธเนื้อหาที่เริ่มเป็น active markup หรือสคริปต์ที่ตัวตรวจรู้จัก รวม BOM/ช่องว่างนำหน้า; ข้อยกเว้นข้อความอธิบายนี้ใช้เฉพาะ `.txt` และไม่มีผลกับ XML หรือไฟล์ชนิดอื่น |
| โปรแกรมและสคริปต์ | บล็อกกลุ่ม EXE/DLL/MSI/COM/APK/JAR/WASM, BAT/CMD/PS1/SH/JS/PHP/PY และกลุ่มที่เทียบเท่า รวม HTML/SVG, shortcut และ config ที่รันคำสั่งได้; ตรวจ MIME เสี่ยง ลายเซ็นโปรแกรม และ script/active-content markers ที่รู้จักด้วย |
| Macro | บล็อกนามสกุล macro เช่น DOCM/XLSM/XLSB/PPTM และตรวจเนื้อหา ZIP/Office ที่ซ่อน `vbaProject`, macro-enabled content types, Excel macro sheets, Scripts/Basic หรือ embedded objects แม้เปลี่ยนชื่อเป็น DOCX/XLSX |
| Office รุ่นเก่าและ Access | ปฏิเสธ DOC/XLS/PPT/RTF, MDB/ACCDB และรูปแบบ macro ที่เกี่ยวข้อง และไฟล์ OLE แม้เปลี่ยนนามสกุล เพราะขั้นนี้ตรวจ macro ภายในรูปแบบเหล่านี้ไม่ได้ ใช้ DOCX/XLSX/PPTX ที่ไม่มี macro หรือ PDF แทน |
| Archive | รับ ZIP ที่ตรวจทุก entry ได้ รวม Office ZIP; อ่านผ่านโครงสร้าง container โดยไม่ตีความ bytes ภายนอกของ ZIP เป็นข้อความสคริปต์หรือ PDF แต่ยังตรวจเนื้อหาของทุก entry; ไม่รับ ZIP เข้ารหัส, symlink, traversal, ชื่อซ้ำ, local/central header ไม่ตรงกัน หรือ entry ที่เสี่ยง; ปฏิเสธ RAR/7Z/GZIP/TAR และ archive อื่นที่ยังตรวจไม่ได้ |
| ข้อจำกัดการตรวจ ZIP | รวมทุกชั้นไม่เกิน 256 entries, ขนาดหลังแตกไฟล์รวมไม่เกิน 25 MiB, ต่อ entry ไม่เกิน 10 MiB; ZIP ซ้อนภายในได้ 2 ชั้น; ไม่แตกไฟล์ลง disk |
| MIME response | ภาพ JPEG/PNG/GIF/WebP ในกลุ่มนามสกุลภาพข้างต้นใช้ชนิดจริงที่ตรวจพบ; ไฟล์อื่นกำหนดตามนามสกุล/ชนิดไฟล์ที่ตรวจ ไม่เชื่อ MIME ที่ client ส่ง; ชนิดไม่รู้จักเป็น `application/octet-stream`; client ต้องรับ MIME เป็น string ไม่จำกัด enum เดิม |
| ดาวน์โหลด | รูป JPEG/PNG และ PDF ยังคง preview แบบ `inline` ได้; ไฟล์อื่นรวม TXT เป็น `attachment` พร้อม `nosniff`. URL `/uploads/...` ส่งชนิดใหม่เป็น `application/octet-stream`; กฎหมาย/FAQ เป็น `attachment` ทุกชนิดอยู่แล้ว; client ต้องใช้ URL ดาวน์โหลดที่ API คืน และแสดง TXT เป็นข้อความธรรมดาเมื่อจำเป็นต้องอ่าน ไม่ตีความเนื้อหาเป็น HTML |
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

## การตรวจ PDF

Backend อ่านโครงสร้าง PDF ก่อนจัดเก็บ โดยไม่รัน JavaScript และไม่แก้หรือเขียน PDF ใหม่ การตรวจใช้กับ PDF ที่พบจากเนื้อหาแม้เปลี่ยนนามสกุล รวมถึง PDF ภายใน ZIP ที่อนุญาต เพดานขนาด จำนวนไฟล์ สิทธิ์ และรูปแบบ multipart ของแต่ละเมนูคงเดิม

ข้อความใน literal/hex string, comment และข้อมูลใน image/font/content stream ไม่ถูกตีความเป็นชื่อคำสั่ง PDF เช่น ลำดับไบต์ `/Js` ในรูปภาพไม่ทำให้ถูกปฏิเสธ การตรวจออบเจ็กต์ครอบคลุม indirect objects, ชื่อที่เขียนแบบ escape และ compressed object streams; ส่วนที่ parser อ่านตรวจไม่ได้จะถูกปฏิเสธ และจำกัดจำนวนออบเจ็กต์ที่ตรวจไม่เกิน 100,000 รายการ

ฟอร์ม AcroForm ที่ไม่มีสคริปต์ยังรับได้ แต่ปฏิเสธฟอร์ม XFA ทั้งหมดเพราะอาจมีสคริปต์ใน XML packets ที่ตัวตรวจนี้ยังอ่านตรวจไม่ได้ และบล็อก JavaScript ของ 3D ผ่าน `OnInstantiate` ตาม [Adobe 3D stream reference](https://opensource.adobe.com/dc-acrobat-sdk-docs/library/plugin/Plugins_3D_samples.html)

| ผลตรวจ | HTTP | ข้อความจากตัวตรวจ |
| --- | --- | --- |
| พบโครงสร้าง JavaScript, Launch, RichMedia หรือไฟล์ฝัง เช่น `/JS`, `/S /JavaScript`, `/OnInstantiate`, `/Type /EmbeddedFile`, `/EmbeddedFiles`, `/EF` | `400` | `PDF active content or embedded files are not allowed` |
| PDF เสีย เข้ารหัส ไม่มี catalog มีฟอร์ม XFA หรือมีโครงสร้างที่อ่านตรวจไม่ได้/เกินเพดานตรวจ | `400` | `Invalid, encrypted or unsupported PDF file` |

FAQ ใช้ `VALIDATION_ERROR` และ `details.files` ตามเดิม ตัวอย่างเมื่อพบ active content:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "PDF active content or embedded files are not allowed",
    "details": {
      "files": "PDF active content or embedded files are not allowed"
    }
  }
}
```

สำหรับ upload ทั่วไปใช้ `BAD_REQUEST`; กฎหมายยังใช้ validation envelope ของเมนู การตรวจนี้เป็น risk filter ตามข้อจำกัดข้างต้น ไม่ใช่ผลตรวจ antivirus

## การตรวจสอบคำขอที่อัปโหลดไม่ผ่าน

Backend บันทึก structured event `upload.rejected` เฉพาะคำขออัปโหลดที่ตอบสถานะตั้งแต่ `400` หรือถูกตัดก่อนตอบครบ ใช้ค้นใน app log ของ backend โดยเทียบเวลาและ endpoint ของเหตุการณ์ที่ผู้ใช้แจ้ง ไม่บันทึกเหตุการณ์นี้สำหรับคำขอที่สำเร็จ และไม่เปลี่ยน response หรือ error envelope ของ API.

ครอบคลุมเฉพาะคำขอที่มาถึง backend; หาก IIS หรือ gateway ปฏิเสธก่อนส่งต่อ ต้องตรวจ log ของชั้นนั้นแยกต่างหาก.

Event นี้ใช้ระดับ `warn`; การเก็บ log ต้องตั้ง `LOG_LEVEL` ให้รับระดับนี้ เช่น `info` หรือ `warn` และให้ log transport เขียนไฟล์ได้ตามปกติ.

| Field ใน log | ความหมาย |
| --- | --- |
| `endpoint`, `method` | เส้นทางอัปโหลดที่ normalize แล้ว; รหัสรายการในกฎหมาย/FAQ ถูกแทนด้วย `:id` และไม่มี query string |
| `status` | HTTP status; เป็น `null` เมื่อคำขอถูกตัดก่อนส่งคำตอบครบ |
| `reasonCode`, `errorCode` | เหตุผลจากชุดรหัสที่กำหนด เช่น `BLOCKED_FILE_TYPE`, `ACTIVE_WEB_CONTENT`, `FILE_TYPE_MISMATCH`, `PDF_ACTIVE_CONTENT`, `PDF_UNREADABLE`, `LIMIT_FILE_SIZE` หรือ `REQUEST_ABORTED`; กรณีจำแนกไม่ได้ใช้ `UPLOAD_REJECTED` |
| `fileExtension`, `declaredMimeType` | นามสกุลและ MIME ที่รับจาก client หลังจำกัดรูปแบบ; MIME ที่ไม่รู้จักเป็น `other` ข้อมูลนี้เป็นชนิดที่ client แจ้ง ไม่ใช่ผลยืนยันชนิดเนื้อหา |
| `fileSize`, `declaredRequestBytes` | ขนาดไฟล์เมื่อ Multer อ่านได้แล้ว และขนาดคำขอที่ client ประกาศผ่าน `Content-Length`; อาจเป็น `null` หากปฏิเสธก่อนอ่านไฟล์ครบ และไม่ใช้ค่าที่ประกาศแทนการตรวจขนาดจริง |
| `fileCount`, `files` | จำนวนไฟล์ที่อ่าน metadata ได้และ metadata ที่จำกัดจำนวน; FAQ หลายไฟล์ใช้ `files` โดยไม่สรุปว่าไฟล์สุดท้ายเป็นไฟล์ที่ถูกปฏิเสธ |

Log นี้ไม่เก็บชื่อไฟล์เต็ม, URL ไฟล์, storage path, เนื้อหาเอกสาร, multipart body, query, Authorization, cookie หรือข้อมูลระบุตัวบุคคล จึงใช้จำแนกเหตุผลปฏิเสธได้โดยไม่สร้างสำเนาเอกสารที่อัปโหลดไม่ผ่าน. ข้อมูลเริ่มมีหลังนำ backend รุ่นนี้ขึ้นใช้งาน; ใช้กู้เหตุผลหรือชนิดไฟล์ของคำขอเก่าที่ไม่เคยบันทึกไว้ไม่ได้.

## สำหรับ Backend Maintainer

| ส่วน | Implementation / Tests |
| --- | --- |
| กฎและรายการบล็อกที่ใช้จริง | [upload-file-policy.ts](../../../../../backend/src/shared/utils/upload-file-policy.ts) |
| ตรวจโครงสร้าง PDF และ regression ของข้อมูลรูปภาพ/JavaScript/ไฟล์ฝัง | [pdf-upload-policy.ts](../../../../../backend/src/shared/utils/pdf-upload-policy.ts), [pdf-upload-policy.test.ts](../../../../../backend/tests/unit/pdf-upload-policy.test.ts) |
| ทดสอบการเปลี่ยนชื่อ สคริปต์ macro และ ZIP limits | [upload-file-policy.test.ts](../../../../../backend/tests/unit/upload-file-policy.test.ts) |
| Regression ของ PDF ที่มี suffix Office และ TXT ที่มีตัวอย่างแท็ก ผ่าน multipart/storage/download จริง | [connection-request-upload-compatibility.route.test.ts](../../../../../backend/tests/unit/connection-request-upload-compatibility.route.test.ts) |
| บันทึกเหตุผลอัปโหลดไม่ผ่านโดยไม่เก็บเอกสารหรือข้อมูลลับ | [upload-rejection-observer.ts](../../../../../backend/src/shared/middlewares/upload-rejection-observer.ts), [upload-rejection-observer.route.test.ts](../../../../../backend/tests/unit/upload-rejection-observer.route.test.ts) |
| Runtime OpenAPI | [upload-policy.openapi.ts](../../../../../backend/src/modules/api-docs/upload-policy.openapi.ts), [poms.openapi.ts](../../../../../backend/src/modules/api-docs/poms.openapi.ts) |
| ฐานข้อมูล | [0137_allow_general_attachment_file_types.ts](../../../../../backend/src/db/migrations/0137_allow_general_attachment_file_types.ts) |

ก่อนเปิด Backend รุ่นนี้ต้องรัน migration `0137` เพื่อคลาย MIME constraints ของ `factory_monitoring_point_attachments` และ `laws` พร้อมขยาย MIME column ของไฟล์แนบจุดตรวจวัดเป็น 128 ตัวอักษร; ขนาดไฟล์และ metadata เดิมไม่เปลี่ยน ไม่ต้องติดตั้ง antivirus บน server ในขั้นนี้ การ rollback จะปฏิเสธหากยังมีชนิดไฟล์ใหม่อยู่ โดยไม่ลบหรือแก้ไฟล์เดิม หลัง deploy ตรวจ runtime `/api/v1/openapi.json` ว่าแสดงนโยบายเดียวกัน
