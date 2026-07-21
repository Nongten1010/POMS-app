# <ชื่อเมนูภาษาไทย>

> Owner: Backend

## Frontend Quick Start

อธิบายสั้น ๆ ว่าเมนูนี้ทำงานอะไร ใครเรียก API และต้องมี authentication หรือ permission ใด

### Main Flow

1. `<งานแรก>`
2. `<งานถัดไป>`
3. `<ผลลัพธ์>`

```bash
curl --request <METHOD> \
  --url '<BASE_URL>/<PATH>' \
  --header 'Authorization: Bearer <ACCESS_TOKEN>'
```

## Endpoint Summary

| งาน | Method | Path | Auth | Permission | Contract |
| --- | --- | --- | --- | --- | --- |
| `<ชื่องาน>` | `<METHOD>` | `<PATH>` | `<Yes/No>` | `<permission หรือ ->` | `<section หรือ subpage link>` |

## Contracts

สำหรับเมนูเล็กให้เขียน endpoint contracts ต่อในไฟล์นี้ สำหรับเมนูใหญ่ให้ลิงก์ focused subpages ที่สร้างจาก endpoint contract template

## Business Flow And Explanations

- `<ลิงก์ไป workflow หรือ explanation canonical>`

## Backend Maintainer Map

| Concern | Canonical source |
| --- | --- |
| Routes | `<relative source link>` |
| Validators | `<relative source link>` |
| Public types | `<relative source link>` |
| Tests | `<relative test link>` |
| Explanations | `<relative explanation link>` |
| Evidence | `<relative evidence link>` |
