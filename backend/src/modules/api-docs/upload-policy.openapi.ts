export const generalUploadPolicyDescription =
  'รับไฟล์ทั่วไปที่มีนามสกุล เช่น PDF, รูปภาพ, DOCX/XLSX/PPTX, TXT/CSV/JSON/XML, เสียง/วิดีโอ และ ZIP ที่ตรวจภายในได้; ' +
  'บล็อกโปรแกรม สคริปต์ HTML/SVG, macro, Office รุ่นเก่า DOC/XLS/PPT/RTF, Access MDB/ACCDB และ archive ที่ตรวจไม่ได้ เช่น RAR/7Z/GZIP. ' +
  'ตรวจทั้งชื่อไฟล์ MIME เสี่ยง ลายเซ็นโปรแกรม และเนื้อหา ZIP/Office; ZIP อ่านผ่านโครงสร้าง container และตรวจทุก entry โดยไม่สแกน bytes ภายนอกเป็นข้อความ PDF/สคริปต์; ZIP ไม่รับไฟล์เข้ารหัส symlink ชื่อซ้ำ หรือ local/central header ไม่ตรงกัน; ' +
  'ภาพ JPEG/PNG/GIF/WebP ที่ตรวจลายเซ็นได้ รวมชื่อ .jfif ไม่ถูกสแกนข้อมูล binary/metadata แบบข้อความสคริปต์หรือ PDF; หากนามสกุลอยู่ในกลุ่ม .jpg/.jpeg/.jfif/.png/.gif/.webp แต่ไม่ตรงกับชนิดภาพจริง ให้รับและคืน MIME พร้อมนามสกุลไฟล์จัดเก็บตามชนิดที่ตรวจได้ โดยคงชื่อไฟล์เดิมสำหรับแสดงผล. PDF, HTML หรือโปรแกรมที่เปลี่ยนชื่อเป็นรูปยังถูกปฏิเสธ. ' +
  'ตรวจ suffix หลังจุดทุกส่วน โดยไม่ถือชื่อฐานก่อนจุดแรกเป็นนามสกุล เช่น doc.pdf และ r.pdf; รับ .doc/.xls/.ppt ก่อน .pdf เช่น report.doc.pdf เมื่อเนื้อหาเป็น PDF จริงและผ่านการตรวจโครงสร้างเดิม รวมไฟล์ใน ZIP; ยังคงบล็อก .exe.pdf, .docm.pdf, .pdf.exe และไฟล์ OLE/โปรแกรมที่เปลี่ยนนามสกุล. ' +
  'TXT ต้องเป็น UTF-8 และไม่มี NUL; รับข้อความอธิบายที่มีตัวอย่างแท็ก `<script>`/`<svg>` อยู่ภายใน แต่ยังบล็อก prefix ที่เป็น active markup หรือสคริปต์ที่ตัวตรวจรู้จัก รวม BOM/ช่องว่างนำหน้า; ข้อยกเว้นนี้ใช้เฉพาะ .txt ไม่รวม XML/ไฟล์ชนิดอื่น. TXT ดาวน์โหลดเป็น attachment พร้อม nosniff และ client ต้องไม่ตีความเนื้อหาเป็น HTML. ' +
  'PDF ตรวจโครงสร้างออบเจ็กต์ รวมชื่อแบบ #xx และออบเจ็กต์บีบอัด; รับข้อความ/comment/ข้อมูลรูปภาพที่มีคำคล้าย /JS โดยไม่ถือเป็นคำสั่ง. ' +
  'บล็อก JavaScript รวม OnInstantiate ของ 3D, Launch, RichMedia และไฟล์ฝังจริง; ใช้ข้อความ PDF active content or embedded files are not allowed. ' +
  'PDF ที่เสีย เข้ารหัส มีฟอร์ม XFA หรืออ่านตรวจไม่ได้ รวมกรณีเกิน 100000 ออบเจ็กต์ที่ตรวจ ตอบ 400 ด้วยข้อความ Invalid, encrypted or unsupported PDF file; ฟอร์ม AcroForm ที่ไม่มีสคริปต์ยังรับได้. ' +
  'FAQ คง VALIDATION_ERROR และ details.files ส่วน upload ทั่วไปคง BAD_REQUEST. ' +
  'จำกัดรวม 256 entries, ขนาดหลังแตกไฟล์รวม 25 MiB, ต่อ entry 10 MiB และ ZIP ซ้อนภายในได้ 2 ชั้น. ' +
  'MIME ใน response กำหนดจากชนิดที่ตรวจและนามสกุล; ชนิดที่ไม่รู้จักใช้ application/octet-stream. ' +
  'ขั้นนี้เป็นการกรองความเสี่ยง ยังไม่มี antivirus และไม่รับประกันว่าไฟล์ปราศจากมัลแวร์';
