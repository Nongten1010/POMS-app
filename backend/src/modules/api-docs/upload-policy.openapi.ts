export const generalUploadPolicyDescription =
  'รับไฟล์ทั่วไปที่มีนามสกุล เช่น PDF, รูปภาพ, DOCX/XLSX/PPTX, TXT/CSV/JSON/XML, เสียง/วิดีโอ และ ZIP ที่ตรวจภายในได้; ' +
  'บล็อกโปรแกรม สคริปต์ HTML/SVG, macro, Office รุ่นเก่า DOC/XLS/PPT/RTF, Access MDB/ACCDB และ archive ที่ตรวจไม่ได้ เช่น RAR/7Z/GZIP. ' +
  'ตรวจทั้งชื่อไฟล์ MIME เสี่ยง ลายเซ็นโปรแกรม และเนื้อหา ZIP/Office; ZIP ไม่รับไฟล์เข้ารหัส symlink ชื่อซ้ำ หรือ local/central header ไม่ตรงกัน; ' +
  'PDF ตรวจโครงสร้างออบเจ็กต์ รวมชื่อแบบ #xx และออบเจ็กต์บีบอัด; รับข้อความ/comment/ข้อมูลรูปภาพที่มีคำคล้าย /JS โดยไม่ถือเป็นคำสั่ง. ' +
  'บล็อก JavaScript รวม OnInstantiate ของ 3D, Launch, RichMedia และไฟล์ฝังจริง; ใช้ข้อความ PDF active content or embedded files are not allowed. ' +
  'PDF ที่เสีย เข้ารหัส มีฟอร์ม XFA หรืออ่านตรวจไม่ได้ รวมกรณีเกิน 100000 ออบเจ็กต์ที่ตรวจ ตอบ 400 ด้วยข้อความ Invalid, encrypted or unsupported PDF file; ฟอร์ม AcroForm ที่ไม่มีสคริปต์ยังรับได้. ' +
  'FAQ คง VALIDATION_ERROR และ details.files ส่วน upload ทั่วไปคง BAD_REQUEST. ' +
  'จำกัดรวม 256 entries, ขนาดหลังแตกไฟล์รวม 25 MiB, ต่อ entry 10 MiB และ ZIP ซ้อนภายในได้ 2 ชั้น. ' +
  'MIME ใน response กำหนดจากชนิดที่ตรวจและนามสกุล; ชนิดที่ไม่รู้จักใช้ application/octet-stream. ' +
  'ขั้นนี้เป็นการกรองความเสี่ยง ยังไม่มี antivirus และไม่รับประกันว่าไฟล์ปราศจากมัลแวร์';
