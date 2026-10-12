export const generalUploadPolicyDescription =
  'รับไฟล์ทั่วไปที่มีนามสกุล เช่น PDF, รูปภาพ, DOCX/XLSX/PPTX, TXT/CSV/JSON/XML, เสียง/วิดีโอ และ ZIP ที่ตรวจภายในได้; ' +
  'บล็อกโปรแกรม สคริปต์ HTML/SVG, macro, Office รุ่นเก่า DOC/XLS/PPT/RTF, Access MDB/ACCDB และ archive ที่ตรวจไม่ได้ เช่น RAR/7Z/GZIP. ' +
  'ตรวจทั้งชื่อไฟล์ MIME เสี่ยง ลายเซ็นโปรแกรม และเนื้อหา ZIP/Office; ZIP ไม่รับไฟล์เข้ารหัส symlink ชื่อซ้ำ หรือ local/central header ไม่ตรงกัน; ' +
  'จำกัดรวม 256 entries, ขนาดหลังแตกไฟล์รวม 25 MiB, ต่อ entry 10 MiB และ ZIP ซ้อนภายในได้ 2 ชั้น. ' +
  'MIME ใน response กำหนดจากชนิดที่ตรวจและนามสกุล; ชนิดที่ไม่รู้จักใช้ application/octet-stream. ' +
  'ขั้นนี้เป็นการกรองความเสี่ยง ยังไม่มี antivirus และไม่รับประกันว่าไฟล์ปราศจากมัลแวร์';
