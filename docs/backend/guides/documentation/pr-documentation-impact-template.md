# Documentation-impact Block

ใส่ block นี้ใน pull request body หรือ change summary ของ explicit direct push ที่แตะ path ใต้ `backend/` และแทนค่าหลัง `:` โดยคงชื่อ field เดิมเพื่อให้ CI อ่านได้

```text
Docs impact: updated | none
Canonical docs: <links หรือ N/A>
Reason: <เหตุผล โดยเฉพาะเมื่อเป็น none>
Client impact: none | frontend | integration
Breaking change: yes | no
```

## Validation Rules

- `Docs impact: updated` ต้องมี canonical links ใต้ `docs/backend/`
- `Docs impact: none` ต้องใช้ `Canonical docs: N/A` และมีเหตุผลเฉพาะเจาะจง
- `Client impact` รับเฉพาะ `none`, `frontend` หรือ `integration`
- `Breaking change: yes` ต้องใช้ `Docs impact: updated` และมีลิงก์รายการใน `docs/backend/api/CHANGELOG.md`
- ห้ามคง placeholder หรือใส่หลายค่าคั่นด้วย `|`
