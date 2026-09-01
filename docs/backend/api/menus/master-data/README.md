# ข้อมูลพื้นฐาน

> Owner: Backend

## Frontend Quick Start

เมนูนี้รวม API สำหรับโรงงาน current/live และจุดตรวจวัดที่เชื่อมต่อในระบบ POMS รวมถึง workflow ที่ผู้ประกอบการเสนอแก้ไขข้อมูลผ่าน 2 แบบฟอร์มคือ `BASIC_INFO` และ `MEASUREMENT_POINTS` แล้วให้ admin พิจารณาก่อนอัปเดตข้อมูลจริง

โรงงานในระบบ POMS หมายถึงโรงงานที่มี active row ใน `cems_wpms_connected_measurement_points` ไม่ใช่รายชื่อจากตาราง `factories` ส่วนข้อมูลโรงงานที่เข้าข่ายเก็บแยกใน `eligible_factories`

### Main Flow

1. อ่านรายชื่อและรายละเอียดโรงงานผ่าน `/api/v1/poms-factories`
2. แสดง `measurementPoints` current/live และใช้เป็นต้นทางของฟอร์มแก้ไขข้อมูลจุดตรวจวัด
3. ผู้ประกอบการส่งคำขอแก้ไขด้วย `factories:edit` โดยระบุ `formType` เป็น `BASIC_INFO` หรือ `MEASUREMENT_POINTS`
4. admin ใช้ `factories:approve` เพื่ออนุมัติ ขอแก้ไข หรือปฏิเสธ
5. เมื่ออนุมัติ backend sync ข้อมูล current/live ตาม `formType`: `BASIC_INFO` อัปเดต active `cems_wpms_connected_measurement_points` และ `eligible_factories`, ส่วน `MEASUREMENT_POINTS` อัปเดต active `cems_wpms_connected_measurement_points` เท่านั้น โดยไม่อัปเดต `factories`

```bash
curl --request GET \
  --url '<BASE_URL>/api/v1/poms-factories' \
  --header 'Authorization: Bearer <ACCESS_TOKEN>' \
  --header 'Accept: application/json'

curl --request POST \
  --url '<BASE_URL>/api/v1/poms-factories/factory-001/edit-requests' \
  --header 'Authorization: Bearer <ACCESS_TOKEN>' \
  --header 'Content-Type: application/json' \
  --data '{"formType":"BASIC_INFO","factoryName":"บริษัท ตัวอย่าง จำกัด (มหาชน)","note":"ปรับชื่อให้ตรงกับเอกสารล่าสุด"}'
```

## Endpoint Summary

เมนูข้อมูลพื้นฐานมี `13` canonical endpoints และแสดงเป็น `17` Swagger operations เพราะ connected-point endpoints เดิมมี annual path variants เพิ่ม `4` operations

### โรงงานและคำขอแก้ไข: 7 API

| งาน                        | Method | Path                                                    | Permission                             | Contract                                                                                               |
| -------------------------- | ------ | ------------------------------------------------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| รายชื่อโรงงาน current/live | `GET`  | `/api/v1/poms-factories`                                | `factories:view`                       | [Factory edit workflow](./factory-edit-requests.md#get-apiv1poms-factories)                            |
| ข้อมูลโรงงานและจุดตรวจวัด  | `GET`  | `/api/v1/poms-factories/:factoryId`                     | `factories:view`                       | [Factory edit workflow](./factory-edit-requests.md#get-apiv1poms-factoriesfactoryid)                   |
| ส่งคำขอแก้ไขข้อมูล         | `POST` | `/api/v1/poms-factories/:factoryId/edit-requests`       | `factories:view` + `factories:edit`    | [Factory edit workflow](./factory-edit-requests.md#post-apiv1poms-factoriesfactoryidedit-requests)     |
| รายการคำขอแก้ไข            | `GET`  | `/api/v1/poms-factories/edit-requests`                  | `factories:view`                       | [Factory edit workflow](./factory-edit-requests.md#get-apiv1poms-factoriesedit-requests)               |
| รายละเอียดคำขอแก้ไข        | `GET`  | `/api/v1/poms-factories/edit-requests/:id`              | `factories:view`                       | [Factory edit workflow](./factory-edit-requests.md#get-apiv1poms-factoriesedit-requestsid)             |
| ส่งคำขอกลับเข้าพิจารณา     | `PUT`  | `/api/v1/poms-factories/edit-requests/:id/resubmission` | `factories:view` + `factories:edit`    | [Factory edit workflow](./factory-edit-requests.md#put-apiv1poms-factoriesedit-requestsidresubmission) |
| Admin พิจารณา              | `POST` | `/api/v1/poms-factories/edit-requests/:id/review`       | `factories:view` + `factories:approve` | [Factory edit workflow](./factory-edit-requests.md#post-apiv1poms-factoriesedit-requestsidreview)      |

### Connected-point และ device configuration เดิม: 6 API

| งาน                           | Method | Path                                                             | Permission                | Contract                                                                                                                               |
| ----------------------------- | ------ | ---------------------------------------------------------------- | ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| อ่านจุดที่เชื่อมต่อแล้ว       | `GET`  | `/api/v1/connected-measurement-points`                           | `cems_wpms_requests:view` | [Shared connected points](../../shared/connected-measurement-points/README.md)                                                         |
| อ่านจุดของโรงงาน              | `GET`  | `/api/v1/connected-measurement-points/factories/:factoryId`      | `cems_wpms_requests:view` | [Shared connected points](../../shared/connected-measurement-points/README.md#get-apiv1connected-measurement-pointsfactoriesfactoryid) |
| อ่านประวัติคำขอของจุด         | `GET`  | `/api/v1/connected-measurement-points/:stationId/requests`       | `cems_wpms_requests:view` | [Shared connected points](../../shared/connected-measurement-points/README.md#get-apiv1connected-measurement-pointsstationidrequests)  |
| อ่าน prefill เพิ่มพารามิเตอร์ | `GET`  | `/api/v1/connected-measurement-points/:stationId/parameter-form` | `cems_wpms_requests:view` | [ขอเชื่อมต่อ](../connection-requests/README.md#add-parameter-prefill)                                                                  |
| อ่าน config ปัจจุบัน          | `GET`  | `/api/v1/connected-measurement-points/:stationId/device-configs` | `cems_wpms_requests:view` | [Device configs](../connection-requests/device-configs.md)                                                                             |
| แทนที่ config ปัจจุบัน        | `POST` | `/api/v1/connected-measurement-points/:stationId/device-configs` | `cems_wpms_requests:edit` | [Device configs](../connection-requests/device-configs.md)                                                                             |

## Contracts

- [โรงงานและคำขอแก้ไขข้อมูลในระบบ POMS](./factory-edit-requests.md) — field tables, JSON examples, `formType` ของทั้ง 2 แบบฟอร์ม, permissions, workflow statuses, errors, concurrency, idempotency และ maintainer links
- [จุดตรวจวัดที่เชื่อมต่อแล้ว](../../shared/connected-measurement-points/README.md) — point/history/statistics contract ที่ใช้ร่วมหลายเมนู
- [Device configuration](../connection-requests/device-configs.md) — config ปัจจุบันและการแทนที่ config

## Business Flow And Explanations

- [Connected factory profile sync workflow](../../../../../workflows/connected-factory-profile-sync.md)
- [โรงงานที่เข้าข่าย](../eligible-factories/README.md)

## Backend Maintainer Map

| Concern                | Canonical source                                                                                                                                                                                                                                                                                                                                                                                                               |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| POMS factory routes    | [`poms-factories.routes.ts`](../../../../../backend/src/modules/poms-factories/poms-factories.routes.ts)                                                                                                                                                                                                                                                                                                                       |
| Connected-point routes | [`connected-measurement-points.routes.ts`](../../../../../backend/src/modules/connection-requests/connected-measurement-points.routes.ts)                                                                                                                                                                                                                                                                                      |
| Runtime OpenAPI        | [`poms.openapi.ts`](../../../../../backend/src/modules/api-docs/poms.openapi.ts), [`connection-requests.openapi.ts`](../../../../../backend/src/modules/api-docs/connection-requests.openapi.ts)                                                                                                                                                                                                                               |
| Migration              | [`0100_create_poms_factory_edit_requests.ts`](../../../../../backend/src/db/migrations/0100_create_poms_factory_edit_requests.ts), [`0106_extend_poms_factory_edit_requests_for_measurement_points.ts`](../../../../../backend/src/db/migrations/0106_extend_poms_factory_edit_requests_for_measurement_points.ts), [`0107_enforce_admin_only_factory_approval.ts`](../../../../../backend/src/db/migrations/0107_enforce_admin_only_factory_approval.ts) |
| Tests                  | [`poms-factories.route.test.ts`](../../../../../backend/tests/unit/poms-factories.route.test.ts), [`poms-factories.service.test.ts`](../../../../../backend/tests/unit/poms-factories.service.test.ts), [`poms-factories.repository.test.ts`](../../../../../backend/tests/unit/poms-factories.repository.test.ts), [`poms-factories.openapi.test.ts`](../../../../../backend/tests/unit/poms-factories.openapi.test.ts), [`poms-measurement-point-edit-requests.validator.test.ts`](../../../../../backend/tests/unit/poms-measurement-point-edit-requests.validator.test.ts), [`poms-measurement-point-edit-requests.migration.test.ts`](../../../../../backend/tests/unit/poms-measurement-point-edit-requests.migration.test.ts), [`factory-approval-admin-only-migration.test.ts`](../../../../../backend/tests/unit/factory-approval-admin-only-migration.test.ts) |
