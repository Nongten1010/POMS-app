# CI Documentation Guard Specification

เอกสารนี้เป็น implementation contract สำหรับ CI guard ที่ป้องกัน backend Markdown กระจายและตรวจว่า endpoint registry ตรงกับ mounted routes ดู policy หลักที่ [documentation maintenance workflow](../../explanations/documentation-maintenance-workflow.md)

## Inputs

- Pull-request base และ head SHA
- Pull-request body สำหรับ documentation-impact block
- `backend/src/app.ts` และ mounted `*.routes.ts`
- `docs/backend/api/ENDPOINTS.md`
- Markdown ใต้ `docs/backend/`
- Legacy-path และ frozen-path allowlists จาก migration workflow

## Required Checks

### 1. PR impact block

เมื่อ diff แตะ `backend/` ต้อง parse fields ตาม [PR documentation-impact template](./pr-documentation-impact-template.md):

```text
Docs impact: updated | none
Canonical docs: <links หรือ N/A>
Reason: <เหตุผล>
Client impact: none | frontend | integration
Breaking change: yes | no
```

- `updated` ต้องมี canonical paths ใต้ `docs/backend/`
- `none` ต้องใช้ `Canonical docs: N/A` และมี reason ที่ไม่ใช่ placeholder
- `Breaking change: yes` ต้องใช้ `updated` และแก้ `docs/backend/api/CHANGELOG.md`

### 2. Endpoint extraction

ใช้ TypeScript compiler API หรือ parser ที่เข้าใจ AST ห้ามใช้ line-based regex เป็นตัวตัดสิน เพราะ route declarations อาจอยู่หลายบรรทัด

1. Parse `backend/src/app.ts`
2. หา router imports และ static `app.use(<mount>, <router>)` ที่ active จริง; ignore comments และ unmounted imports
3. Parse method calls `get`, `post`, `put`, `patch` และ `delete` บน mounted routers
4. รวม mount prefix กับ literal child path
5. รวม explicit `app.<method>` endpoints เช่น `/health`
6. Normalize path โดยตัด trailing slash ยกเว้น `/`
7. สร้าง unique key `<METHOD> <FULL_PATH>`

ไม่รวม `express.static`, middleware-only surfaces และ catch-all 404 handler ใน explicit endpoint set

### 3. Registry comparison

Parse เฉพาะ Markdown table ที่ตามหลัง marker `<!-- endpoint-registry:v1 -->` ใน [endpoint registry](../../api/ENDPOINTS.md)

- route มีจริงแต่ registry ไม่มี: fail พร้อม method, path และ source
- registry มีแต่ route ไม่มีจริง: fail พร้อม row number
- `Method + Path` ซ้ำ: fail
- method ไม่อยู่ใน allowlist หรือ path ไม่ขึ้นต้น `/`: fail
- route count ในข้อความสรุปไม่ตรงกับจำนวน rows: fail
- `Canonical owner` ว่างหรืออยู่นอก `docs/backend/api/`: fail

ใน transition mode owner อาจเป็น migration target ที่ยังไม่มีไฟล์ได้เฉพาะค่าที่ประกาศใน migration map ใน strict mode owner directory ต้องมี `README.md` หรือ owner file ต้องมีอยู่จริง

### 4. Placement and freeze

Transition mode:

- ปฏิเสธ Markdown ใหม่ใต้ `APIDoc/`, `docs/APIDoc/` และ `backend/docs/`
- อนุญาต legacy file เดิมเมื่อไม่ถูกแตะ หรือถูกแก้เป็น pointer ตาม migration map
- ปฏิเสธการแก้ frozen backend-contract copies ใต้ `frontend/md/`
- allowlist `README.md`, `AGENTS.md`, `NOTES.md` และ exact `workflows/*.md` ที่ backend hub ลิงก์ไว้

Strict mode เพิ่มการปฏิเสธ active backend documentation ทุกไฟล์ที่อยู่นอก `docs/backend/` และไม่ได้อยู่ใน explicit allowlist

### 5. Links and reachability

- ตรวจ relative Markdown links ใต้ `docs/backend/`
- ignore URL ภายนอก, anchors และ placeholders ภายใน template files
- active API, explanation, guide และ evidence documents ต้อง reachable จาก `docs/backend/README.md` ผ่าน category index
- archive documents ต้อง reachable จาก archive index แต่ไม่ถูกนับเป็น active contract

## Required Test Fixtures

Route extractor ต้องมี unit fixtures อย่างน้อย:

1. one-line route declaration
2. multi-line route declaration เช่น `POST /:id/cancel`
3. router-level middleware ก่อนและหลัง route
4. root child path `/` และ trailing-slash normalization
5. multiple routers จาก source file เดียวที่ mount คนละ prefix
6. commented หรือ unmounted router ที่ต้อง ignore
7. duplicate method/path
8. route missing from registry และ stale registry row
9. malformed registry row และ incorrect summary count

Docs checks ต้องมี fixtures สำหรับ `updated`, `none`, breaking change, frozen frontend path, legacy pointer, broken link และ orphan document

## CI Output

Guard ต้องจบด้วย non-zero exit code เมื่อ check ใด fail และพิมพ์ brief ที่มี:

- backend paths ที่เปลี่ยน
- parsed impact declaration
- missing, stale หรือ duplicate endpoints
- placement, freeze, link และ reachability errors
- canonical docs ที่ถูกแก้
- reviewer type: `none`, `frontend` หรือ `integration`

ห้ามแก้ registry หรือ Markdown อัตโนมัติใน CI เพราะ canonical ownership และ semantic contract ต้องได้รับการตัดสินโดยคน

## Definition Of Done

- รันได้จาก package script เดียว เช่น `npm run docs:check`
- รันใน pull-request workflow ทุก PR
- transition-mode fixtures ผ่านทั้งหมด
- ผลตรวจ deterministic ระหว่าง local และ CI
- required check ถูกเปิดใน branch protection ก่อนถือว่า guard ใช้งานจริง
