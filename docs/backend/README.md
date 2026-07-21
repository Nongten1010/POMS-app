# Backend Documentation Hub

> สถานะ: โครงสร้างเอกสารยืนยันแล้ว; legacy migration และ CI guard implementation เป็นงานถัดไป

โฟลเดอร์ `docs/backend/` คือปลายทางกลางสำหรับเอกสาร backend ที่ยังใช้งาน และเป็นจุดเริ่มอ่านเพียงแห่งเดียวสำหรับ frontend, backend และ QA

Backend เป็นเจ้าของและดูแลเอกสารชุดนี้ โดยมีผู้อ่านหลักสองกลุ่ม:

- Frontend อ่านเพื่อเข้าใจ endpoint และ contract ที่ต้องเชื่อมต่อ
- Backend maintainer อ่านเพื่อทบทวนพฤติกรรมปัจจุบันและตามต่อไปยัง source code, tests, explanations และ evidence

ชื่อเมนูเป็นภาษานำทางร่วม ไม่ได้ทำให้เอกสารชุดนี้เป็น frontend documentation หรือ frontend progress tracker

## Skill-managed Workspace

ไฟล์ต่อไปนี้คงอยู่ที่ repository root ตามข้อกำหนดของ `loop-me` และไม่ใช่ published API contract:

- [Workspace notes](../../NOTES.md)
- [Officer direct connection workflow](../../workflows/officer-direct-connection-request.md)
- [KWP form step workflow](../../workflows/kwp-form-step-workflow.md)
- [Permission menu location-scope workflow](../../workflows/permission-menu-location-scope.md)

## ข้อตกลงที่ยืนยันแล้ว

- เอกสาร backend/API ที่ยังใช้งานต้องอยู่ภายใต้ `docs/backend/`
- ตำแหน่งเดิมนอกโฟลเดอร์นี้จะเป็นเพียง archive หรือทางชี้ชั่วคราวระหว่างการย้าย ไม่ใช่ canonical documentation home
- ยังไม่ย้ายหรือลบเอกสารเดิมจนกว่าจะสรุปหมวด ปลายทาง และกติกาการดูแลครบ

## โครงสร้างหลัก

```text
docs/backend/
├── api/           สัญญา API ที่ client ใช้เชื่อมต่อ
├── explanations/ คำอธิบาย architecture, schema, permission, workflow และ business rules
├── guides/        วิธี setup, ทดสอบ, deploy และเชื่อมระบบภายนอก
├── evidence/      TDD notes, checklist และผลยิง API จริง
└── archive/       เอกสารเก่าที่ไม่ใช่ contract ปัจจุบัน
```

### กติกาเลือกหมวด

| คำถามที่เอกสารตอบ | หมวด |
| --- | --- |
| Client ต้องส่งอะไรและจะได้รับอะไร | `api/` |
| ระบบทำงานแบบนี้เพราะอะไร หรือมี business rule อะไร | `explanations/` |
| ต้องทำตามขั้นตอนใดเพื่อ setup, ทดสอบ, deploy หรือ integrate | `guides/` |
| มีหลักฐานใดว่าพฤติกรรมที่บันทึกไว้ถูกตรวจแล้ว | `evidence/` |
| เก็บเพื่อประวัติและห้ามใช้อ้างอิงงานปัจจุบัน | `archive/` |

เอกสารหนึ่งไฟล์ต้องมีหน้าที่หลักเพียงหมวดเดียว หากเนื้อหาต้องอ้างถึงอีกหมวดให้ใช้ลิงก์แทนการคัดลอกเนื้อหา

### การจัดหน้า API

จัดเอกสาร `api/` ตามเมนูงานหรือ business capability ที่ผู้ใช้เห็น ไม่จัดตามชื่อ technical module ใน backend หน้าเอกสารของหนึ่งเมนูสามารถรวม endpoint จากหลาย modules ได้ และต้องลิงก์กลับไปยัง implementation sources ที่เกี่ยวข้อง

```text
api/
├── menus/         API ตามเมนูงานที่ผู้ใช้เห็น
├── shared/        API กลางที่หลายเมนูใช้ร่วมกัน
└── integrations/  API contract สำหรับระบบภายนอก
```

ทุกเมนูที่มีเอกสารใช้โฟลเดอร์ของตนเองและมี `README.md` เป็น landing page ที่ลิงก์คงที่ เมนูเล็กเก็บ contract ใน landing page ได้ ส่วนเมนูใหญ่แตก subpages ตามงานย่อยและลิงก์กลับจาก landing page

## กติกาป้องกันเอกสารกระจาย

ใช้การควบคุมร่วมกันสามชั้น:

1. `AGENTS.md` กำหนดตำแหน่ง canonical และห้ามสร้างสำเนา backend contract นอก `docs/backend/`
2. Index และ template กำหนดว่าเอกสารใหม่ต้องอยู่หมวดใดและต้องถูกลิงก์จากหน้านี้
3. CI docs guard ตรวจตำแหน่งไฟล์ ลิงก์ และผลกระทบต่อ API contract ก่อน merge

CI docs guard ต้องรันกับทุก PR ส่วน PR ที่แตะ `backend/` ต้องระบุอย่างใดอย่างหนึ่ง:

- `Docs impact: updated` พร้อมลิงก์เอกสาร canonical ที่แก้
- `Docs impact: none` พร้อมเหตุผลที่ตรวจสอบได้

การเปลี่ยน contract ที่ client มองเห็นต้องใช้ `updated` เสมอ แม้เป็น backward-compatible addition เช่น optional field, endpoint หรือ error code ใหม่ ส่วน `none` ใช้ได้เมื่อ observable contract และ behavior ไม่เปลี่ยนเท่านั้น

PR ใช้ machine-readable fields: `Docs impact`, `Canonical docs`, `Reason`, `Client impact` และ `Breaking change`; ดูรูปแบบที่ [PR documentation-impact block](./guides/documentation/pr-documentation-impact-template.md)

CI docs guard ยังไม่ได้ implement แต่ข้อกำหนด, checkpoint, transition allowlists และ acceptance fixtures ถูกสรุปไว้ใน [CI documentation guard specification](./guides/documentation/docs-guard-spec.md)

Backend delivery target คือ feature branch → pull request → code/docs checks → merge เข้า protected `main` → production deploy ห้ามใช้ direct push เข้า `main` สำหรับ backend changes

### CI enforcement phases

- `Transition mode`: บังคับ PR declaration, ห้ามเพิ่ม Markdown ใหม่ใน legacy locations และตรวจ links/orphans ใต้ `docs/backend/` โดยไม่ fail จาก legacy files ที่ยังไม่ถูกแตะ
- `Strict mode`: เปิดหลัง migration เสร็จและตรวจ placement ของ active backend documentation ทั้ง repository

เปิด strict mode ได้เมื่อ endpoint coverage ครบ, legacy pointers ผ่านหนึ่ง deployment cycle, repository links ไม่ชี้ legacy paths ที่จะลบ, canonical tree ไม่มี orphan/broken links, high-risk conflicts ถูกตรวจเทียบกับ code/tests, frozen frontend files ไม่เปลี่ยน และ protected `main` พร้อม required docs guard ทำงานแล้ว

### Review checkpoint

- Backend owner ทำ self-review impact declaration หลัง CI ผ่าน โดยไม่บังคับ backend approval คนที่สอง
- เพิ่ม frontend reviewer เฉพาะเมื่อ contract ที่ frontend ใช้เปลี่ยน
- เพิ่ม integration owner เฉพาะเมื่อ contract ของระบบภายนอกเปลี่ยน
- Reviewer ต้องได้รับสรุปผลตรวจและลิงก์ canonical document ไม่ใช่สำเนาเอกสารใน PR

### Contract consistency

- Canonical API document คือ published contract ที่ client ใช้อ้างอิง
- Code และ tests คือ executable behavior ของระบบ
- ถ้าสองส่วนนี้ไม่ตรงกันให้ถือเป็น defect และหยุด merge จนกว่าจะแก้ให้ตรงกันหรือยืนยัน requirement ใหม่อย่างชัดเจน
- Live response และ test evidence ช่วยพิสูจน์พฤติกรรม แต่ไม่แทน canonical contract

### การย้ายเอกสารเดิม

1. รวมเฉพาะเนื้อหาที่ยังถูกต้องเข้า canonical document
2. แทนไฟล์เดิมด้วย pointer สั้น ๆ ไปยัง canonical document เป็นเวลา 1 deployment cycle
3. แก้ inbound links ทั้งหมดแล้วจึงลบ pointer ในรอบถัดไป
4. ไม่เก็บไฟล์ซ้ำใน `archive/` เพราะประวัติยังค้นได้จาก Git
5. ใช้ `archive/` เฉพาะเอกสารที่มีคุณค่าทางประวัติและไม่มีเนื้อหาซ้ำกับเอกสาร active

Migration นี้ไม่แก้ไฟล์ใด ๆ ใต้ `frontend/` ตามขอบเขตที่ยืนยันแล้ว Backend canonical docs จะรวมอยู่ใต้ `docs/backend/` แต่ legacy copies ใน `frontend/md/` จะยังคงอยู่จนกว่าจะมีงาน frontend แยกต่างหาก

CI ต้อง freeze เฉพาะ known backend-contract copies ใต้ `frontend/md/` ไม่แก้เนื้อหาและไม่ขวาง frontend-only documents รายชื่อ exact paths อยู่ใน migration workflow

## Workflow การดูแลเอกสาร

- [API Documentation by Menu](./api/README.md)
- [Backend Guides](./guides/README.md)
- [Backend Evidence](./evidence/README.md)
- [Backend Documentation Maintenance Workflow](./explanations/documentation-maintenance-workflow.md)
- [Backend Documentation Migration Workflow](./explanations/documentation-migration-workflow.md)
- [Backend Documentation Migration Map](./explanations/documentation-migration-map.md)
- [Archive Policy](./archive/README.md)

## สถานะการออกแบบ

Information architecture, ownership, endpoint registry, maintenance rules, migration map และ CI guard specification ยืนยันแล้ว งานนี้ยังไม่ย้าย legacy documents ไม่แก้ `frontend/md/` และไม่เพิ่ม CI application code
