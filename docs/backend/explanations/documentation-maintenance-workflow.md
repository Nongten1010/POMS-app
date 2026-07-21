# Backend Documentation Maintenance Workflow

> สถานะ: แบบออกแบบยืนยันแล้ว; CI implementation ยังเป็น backlog

## Goal

ทำให้เอกสาร backend ที่ยังใช้งานมีตำแหน่ง canonical เพียงแห่งเดียว ค้นพบได้จาก index และเปลี่ยนตาม backend contract โดยไม่สร้างสำเนาให้ frontend หรือ QA ต้องเดาว่าไฟล์ใดใหม่ที่สุด

Backend เป็น document owner เอกสารต้องรองรับทั้ง frontend consumer ที่ต้องการ contract พร้อมใช้ และ backend maintainer ที่ต้องย้อนหา implementation, tests, explanations และ evidence โดยไม่ทำสำเนา contract

## Canonical Location

เอกสาร backend ที่ยังใช้งานต้องอยู่ใต้ `docs/backend/` และมีหน้าที่หลักเพียงหมวดเดียว:

- `api/` สำหรับ request, response, authentication, permission, validation และ error contract
- `explanations/` สำหรับ architecture, schema, workflow และ business rules
- `guides/` สำหรับขั้นตอน setup, testing, deployment และ integration
- `evidence/` สำหรับ TDD notes, checklist และผลยิง API จริง
- `archive/` สำหรับประวัติที่ห้ามใช้อ้างอิง contract ปัจจุบัน

ภายใน `api/` ให้จัดหน้าเอกสารตาม user-facing menu หรือ business capability ไม่ใช่ชื่อ backend module หน้าเดียวสามารถรวมหลาย route groups ได้เมื่อทั้งหมดรองรับงานในเมนูเดียวกัน และต้องมี source links กลับไปยัง modules ที่เกี่ยวข้อง

API navigation แบ่งเป็น `menus/` สำหรับหน้าเมนู, `shared/` สำหรับ contract ที่หลายเมนูใช้ร่วมกัน และ `integrations/` สำหรับระบบภายนอก เอกสารทุกไฟล์ต้องเดินทางมาถึงได้จาก `docs/backend/README.md` ผ่าน category indexes

ทุกเมนูที่ documented ต้องมี stable landing page ที่ `menus/<menu-slug>/README.md` เมนูเล็กเก็บ contract ในหน้าเดียวได้ ส่วนเมนูใหญ่แตก focused subpages และต้องลิงก์ทุก subpage จาก landing page

Menu landing page ต้องรองรับผู้อ่านสองกลุ่มจาก contract ชุดเดียว โดยเรียงเนื้อหาดังนี้:

1. frontend quick start
2. endpoint summary
3. request, response, authentication, permission, validation และ error contract หรือ focused-subpage links
4. business-flow และ explanation links
5. backend maintainer links ไปยัง routes, validators, types, tests และ evidence

Directory และ filename ใช้ English kebab-case, display heading และ prose ใช้ภาษาไทย และ technical identifiers ใช้ค่าตาม code ห้ามสร้าง full-page translation ที่ทำให้เกิด contract สองสำเนา

ทุก endpoint ต้องมี field tables และ minimal request/response JSON อย่างละหนึ่งชุด วาง copy-paste curl เฉพาะ flow หลักใน menu quick start และกรณีพิเศษ เช่น upload หรือ complex authentication ส่วน shared error envelope อธิบายครั้งเดียวแล้วใช้ลิงก์อ้างอิง

ไม่ใช้ manual `Last updated` หรือ per-file changelog การเปลี่ยนทั่วไปอาศัย Git history ส่วน breaking API change ต้องเพิ่มรายการใน `docs/backend/api/CHANGELOG.md` พร้อม impact, migration steps และ links ไปยัง canonical menu pages

ชื่อเมนู canonical ต้องตรงกับ label ที่ผู้ใช้เห็นใน frontend โดยชื่อที่ยืนยันแล้วคือ `แจ้งแบบ กวภ. 01 - กวภ. 05`; ห้ามใช้ `กวก` หรือชื่อย่ออื่นแทนใน navigation และชื่อเอกสาร

## Confirmed Guardrails

1. `AGENTS.md` บังคับตำแหน่งเอกสารสำหรับคนและ AI agent
2. เอกสาร active ทุกไฟล์ต้องมีลิงก์จาก `docs/backend/README.md`
3. ใช้ลิงก์ข้ามเอกสารแทนการคัดลอกเนื้อหา
4. CI docs guard ต้องตรวจ placement, links และ API documentation impact ก่อน merge

Implementation contract ของ guard อยู่ที่ [CI documentation guard specification](../guides/documentation/docs-guard-spec.md)

## Endpoint Registry

`docs/backend/api/ENDPOINTS.md` เป็นสารบัญกลางของ mounted HTTP endpoints โดยหนึ่ง endpoint มีหนึ่งแถวที่ระบุอย่างน้อย `Method`, full `Path` และ canonical document owner

- Backend route source เป็นแหล่งข้อมูลสำหรับชุด `Method + Path` ที่รันจริง
- คนเป็นผู้เลือก canonical owner เพราะ owner สะท้อนเมนูหรือ business capability ซึ่ง CI เดาจากชื่อ module ไม่ได้
- CI อ่าน mounted routes แล้วเทียบกับ registry แบบสองทาง
  - มี route จริงแต่ไม่มีแถวใน registry ให้ fail
  - มีแถวใน registryแต่ไม่มี route จริงแล้ว ให้ fail
  - มี `Method + Path` ซ้ำใน registry ให้ fail
- การย้าย endpoint ไปหน้า owner อื่นเป็นการแก้ registry โดยคน และ canonical page ปลายทางต้องมีอยู่จริง
- Registry เก็บเพียงข้อมูลค้นหาและ ownership ห้ามคัดลอก request/response contract จาก canonical pages มาไว้ซ้ำ

ตัวอย่าง ownership:

```text
POST /api/v1/cems-wpms-requests
-> api/menus/connection-requests/
```

CI ตรวจได้ว่า endpoint มีอยู่ทั้งใน code และ registry แต่ไม่เปลี่ยน owner ให้อัตโนมัติ

## Trigger

- CI docs guard รันเมื่อเกิด pull request ทุกครั้ง เพื่อจับ Markdown ที่ถูกเพิ่มผิดตำแหน่งแม้ PR นั้นไม่แตะ backend
- Documentation impact assessment ทำงานเมื่อ change set แตะ path ใดก็ตามใต้ `backend/`
- Trigger ครอบคลุม code, tests, migrations, configuration และเอกสารเดิมใต้ `backend/` เพราะ contract หรือ behavior อาจเปลี่ยนนอก route file

`main` ต้องเป็น protected branch และ backend changes ต้องเข้าผ่าน pull request หลัง required code/docs checks ผ่านแล้วเท่านั้น Existing production deployment จึงเริ่มหลัง merge จาก push event บน `main`

## Enforcement Phases

### Transition Mode

- บังคับ machine-readable PR impact block
- ปฏิเสธ Markdown ใหม่ใน legacy backend-documentation locations
- ตรวจ placement, index reachability และ relative links ใต้ `docs/backend/`
- ตรวจ mounted `Method + Path` เทียบกับ `docs/backend/api/ENDPOINTS.md`
- ไม่ fail เพราะ untouched legacy files ที่มีอยู่ก่อนเริ่ม migration
- อนุญาตให้แก้ legacy file เฉพาะเพื่อรวมเนื้อหา, เปลี่ยนเป็น pointer หรือย้ายตาม migration mapping

### Strict Mode

เปิดเมื่อ migration mapping เสร็จและ legacy pointers ครบหนึ่ง deployment cycle แล้ว:

- ตรวจ active backend documentation ทั้ง repository
- ปฏิเสธ active backend contract นอก `docs/backend/`
- ตรวจ orphan documents และ relative links ใน canonical tree ทั้งหมด
- คงข้อยกเว้นเฉพาะ repository-level `README.md`, `AGENTS.md` และเอกสารที่ไม่ใช่ backend documentation ตาม allowlist ที่ระบุชัด

### Transition-to-strict Gate

ต้องผ่านทุกข้อก่อนเปลี่ยน mode:

1. Mounted endpoints ทุกตัวถูกลงทะเบียนใน menu, shared หรือ integration index
2. In-scope legacy docs ถูกย้ายครบและ pointers ผ่าน 1 deployment cycle
3. ไม่มี repository link ชี้ legacy paths ที่กำลังจะลบ
4. Canonical documents ทุกไฟล์ reachable จาก hub และไม่มี broken relative links
5. Parameter-value auth, permission vocabulary และ connection-workflow conflicts ถูกตรวจเทียบกับ code/tests แล้ว
6. Frozen `frontend/md` paths ไม่เปลี่ยน และ skill-managed `NOTES.md`/`workflows/*.md` อยู่ใน explicit allowlist
7. PR docs guard ผ่านและ `main` เปิด branch protection พร้อม required checks แล้ว

## Required Impact Declaration

ผู้ส่ง change ต้องระบุผลลัพธ์หนึ่งแบบใน PR หรือ change summary:

- `Docs impact: updated` พร้อมลิงก์ไปยังเอกสาร canonical ใต้ `docs/backend/` ที่แก้แล้ว
- `Docs impact: none` พร้อมเหตุผลเฉพาะเจาะจง เช่น internal refactor ที่ request, response, permission, validation, error และ observable behavior ไม่เปลี่ยน

ห้ามปล่อย declaration ว่างหรือใช้เหตุผลทั่วไปที่ reviewer ตรวจสอบไม่ได้

PR body ต้องมี machine-readable block นี้โดยคงชื่อ field และใช้ค่าเดียวต่อ field:

```text
Docs impact: updated | none
Canonical docs: <links หรือ N/A>
Reason: <เหตุผล โดยเฉพาะเมื่อเป็น none>
Client impact: none | frontend | integration
Breaking change: yes | no
```

`Breaking change: yes` ต้องใช้ `Docs impact: updated` และอ้างรายการที่เพิ่มใน `docs/backend/api/CHANGELOG.md`

### `Docs impact: updated` is required

ต้องอัปเดตเอกสารเมื่อมี client-visible change ทุกชนิด รวมถึงการเปลี่ยนที่ backward compatible:

- เพิ่ม แก้ หรือลบ endpoint
- เพิ่ม แก้ หรือลบ request, query, path หรือ response field
- เปลี่ยน authentication, permission หรือ data scope
- เปลี่ยน validation, status, error code หรือ error shape
- เปลี่ยน observable behavior, ordering, filtering, pagination หรือ default value

### `Docs impact: none` is allowed

ใช้ `none` ได้เมื่อ request, response, authentication, permission, validation, status, error และ observable behavior ไม่เปลี่ยน เช่น:

- test-only change
- formatting หรือ comment correction ใน code
- internal refactor ที่รักษา behavior เดิม
- performance optimization ที่ไม่เปลี่ยนผลลัพธ์หรือ ordering
- development tooling change ที่ไม่กระทบวิธี setup, test หรือ deploy

Backend owner เป็นผู้ยืนยันเหตุผล `none` ด้วย self-review; CI มีหน้าที่แสดง sensitive paths และเหตุผลใน brief แต่ไม่ตัดสิน semantic impact แทนคน

## Contract Consistency

- Canonical API documents เป็น published contract สำหรับ frontend และ integration clients
- Backend code และ tests เป็น executable behavior
- Live responses และ test artifacts เป็น evidence ไม่ใช่ contract
- หาก published contract และ executable behavior ไม่ตรงกัน change ต้องถูก block จนกว่าจะแก้ code, tests และ docs ให้สอดคล้องกัน หรือมีการยืนยัน requirement ใหม่แล้วอัปเดตทุกส่วนใน change เดียวกัน
- ห้ามให้ client เลือกเองว่าจะเชื่อสำเนาใดหรือ behavior ใด

## Draft Runtime Flow

1. CI ตรวจ path ที่เปลี่ยนและตำแหน่ง Markdown
2. CI อ่าน mounted routes แล้วเทียบ `Method + Path` กับ endpoint registry แบบสองทาง
3. ถ้า change set แตะ `backend/` ให้ตรวจ impact declaration
4. ถ้าเป็น `updated` ให้ตรวจว่าไฟล์ canonical มีอยู่และถูกลิงก์จาก `docs/backend/README.md`
5. ถ้าเป็น `none` ให้ส่งเหตุผลไปยัง human checkpoint พร้อมรายการ backend paths ที่เปลี่ยน
6. CI ตรวจ relative links และรายงานผลแบบ decision-ready ก่อน checkpoint

## Human Checkpoint

- Backend มี owner คนเดียว จึงใช้ required CI checks ตามด้วย backend-owner self-review เพื่อยืนยันว่า impact declaration สอดคล้องกับ diff โดยไม่บังคับ backend approval คนที่สอง
- เมื่อ request, response, authentication, permission, validation, status, error หรือ observable API behavior ที่ frontend ใช้เปลี่ยน ต้องเพิ่ม frontend reviewer
- เมื่อ contract สำหรับระบบภายนอกเปลี่ยน ต้องเพิ่ม integration owner ของระบบนั้นแทน frontend reviewer
- `Docs impact: none` ใช้ backend-owner self-review ยืนยันได้โดยไม่เรียก client owner เพิ่ม

Checkpoint ถูก push ไปไว้หลังการตรวจอัตโนมัติทั้งหมด เพื่อให้ reviewer ตัดสินใจครั้งเดียวจากข้อมูลที่พร้อมแล้ว

## Checkpoint Brief

CI ต้องเตรียม brief ที่มี:

- backend paths ที่เปลี่ยน
- impact declaration และเหตุผล
- สรุป contract ที่เปลี่ยน ถ้ามี
- ลิงก์ canonical documents ที่แก้
- ผลตรวจ placement, index registration และ relative links
- ประเภท reviewer ที่ต้องเพิ่ม: none, frontend หรือ integration owner

## Legacy Migration

สำหรับเอกสาร active ที่อยู่นอก `docs/backend/`:

1. ตรวจทุกสำเนากับ implementation และรวมเฉพาะเนื้อหาที่ยังถูกต้องเข้า canonical document
2. แทน legacy file ด้วย pointer สั้น ๆ ที่มีลิงก์ไปยัง canonical document โดยไม่คัดลอก contract
3. คง pointer ไว้ 1 deployment cycle เพื่อให้ทีมแก้ bookmark และ inbound links
4. เมื่อ link check ยืนยันว่าไม่มี repository link ชี้เข้า legacy path ให้ลบ pointer ใน change ถัดไป
5. ไม่ย้ายสำเนาที่ซ้ำเข้า `archive/`; ใช้ Git history เมื่อต้องการดูเนื้อหาเดิม
6. ย้ายเข้า `archive/` เฉพาะเอกสารที่มี historical value และไม่มีเนื้อหาซ้ำกับ active documentation

## Current State

- กำหนด canonical root และหมวดเอกสารแล้ว
- เพิ่ม repository policy ใน `AGENTS.md` แล้ว
- กำหนด trigger และ docs impact declaration แล้ว
- กำหนด human checkpoint และ brief แล้ว
- กำหนด legacy migration policy แล้ว
- กำหนดขอบเขต `Docs impact: updated` และ `Docs impact: none` แล้ว
- กำหนด contract consistency rule แล้ว
- กำหนดให้ API navigation จัดตามเมนูงานที่ผู้ใช้เห็นแล้ว
- กำหนดกลุ่มย่อย `menus`, `shared` และ `integrations` แล้ว
- กำหนด menu landing page และ subpage pattern แล้ว
- กำหนดโครงหน้า menu สำหรับ frontend consumer และ backend maintainer แล้ว
- กำหนด language และ naming convention แล้ว
- กำหนด example policy และ documentation templates แล้ว
- กำหนด change-history policy แล้ว
- กำหนด PR-gated delivery และ protected `main` แล้ว
- กำหนด solo-backend-owner review model แล้ว
- กำหนด machine-readable PR impact block แล้ว
- กำหนด transition และ strict enforcement phases แล้ว
- กำหนด canonical menu map 7 หน้าแล้ว
- กำหนด transition-to-strict completion gate แล้ว
- กำหนด endpoint registry และการเทียบ mounted `Method + Path` แบบสองทางแล้ว
- กำหนด file-by-file migration map แล้ว
- กำหนด CI docs guard specification และ acceptance tests แล้ว
- ยังไม่ย้าย legacy documents และยังไม่สร้าง CI docs guard
- Repository history ปัจจุบันยังเป็น direct-push pattern และ production workflow ทำงานเมื่อ push เข้า `main`; ต้องเปลี่ยน branch protection และเพิ่ม PR checks ก่อน workflow target นี้จะมีผลจริง

## Implementation Backlog

- ย้ายเอกสารตาม [migration map](./documentation-migration-map.md) ทีละ batch
- implement route extractor และ CI workflow ตาม [docs guard specification](../guides/documentation/docs-guard-spec.md)
- เปิด branch protection และ required checks หลัง transition-mode guard ผ่านใน repository จริง
