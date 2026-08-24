# ข้อมูลพื้นฐาน

> Owner: Backend

## Frontend Quick Start

เมนูนี้รวม API สำหรับโรงงาน current/live และจุดตรวจวัดที่เชื่อมต่อในระบบ POMS รวมถึง workflow ที่ผู้ประกอบการเสนอแก้ไข profile แล้วให้เจ้าหน้าที่พิจารณาก่อนอัปเดตข้อมูลจริง

โรงงานในระบบ POMS หมายถึงโรงงานที่มี active row ใน `cems_wpms_connected_measurement_points` ไม่ใช่รายชื่อจากตาราง `factories` ส่วนข้อมูลโรงงานที่เข้าข่ายเก็บแยกใน `eligible_factories`

### Main Flow

1. อ่านรายชื่อและรายละเอียดโรงงานผ่าน `/api/v1/poms-factories`
2. แสดง `measurementPoints` current/live แบบ read-only
3. ผู้ประกอบการส่งคำขอแก้ไข profile ด้วย `factories:edit`
4. เจ้าหน้าที่ใช้ `factories:approve` เพื่ออนุมัติ ขอแก้ไข หรือปฏิเสธ
5. เมื่ออนุมัติ backend sync active `cems_wpms_connected_measurement_points` และ `eligible_factories` ใน transaction เดียวกัน โดยไม่อัปเดต `factories`

```bash
curl --request GET \
  --url '<BASE_URL>/api/v1/poms-factories' \
  --header 'Authorization: Bearer <ACCESS_TOKEN>' \
  --header 'Accept: application/json'

curl --request POST \
  --url '<BASE_URL>/api/v1/poms-factories/factory-001/edit-requests' \
  --header 'Authorization: Bearer <ACCESS_TOKEN>' \
  --header 'Content-Type: application/json' \
  --data '{"factoryName":"บริษัท ตัวอย่าง จำกัด (มหาชน)","note":"ปรับชื่อให้ตรงกับเอกสารล่าสุด"}'
```

## Endpoint Summary

เมนูข้อมูลพื้นฐานมี `13` canonical endpoints และแสดงเป็น `17` Swagger operations เพราะ connected-point endpoints เดิมมี annual path variants เพิ่ม `4` operations

### โรงงานและคำขอแก้ไข: 7 API

| งาน                        | Method | Path                                                    | Permission                             | Contract                                                                                               |
| -------------------------- | ------ | ------------------------------------------------------- | -------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| รายชื่อโรงงาน current/live | `GET`  | `/api/v1/poms-factories`                                | `factories:view`                       | [Factory edit workflow](./factory-edit-requests.md#get-apiv1poms-factories)                            |
| ข้อมูลโรงงานและจุดตรวจวัด  | `GET`  | `/api/v1/poms-factories/:factoryId`                     | `factories:view`                       | [Factory edit workflow](./factory-edit-requests.md#get-apiv1poms-factoriesfactoryid)                   |
| ส่งคำขอแก้ไข profile       | `POST` | `/api/v1/poms-factories/:factoryId/edit-requests`       | `factories:view` + `factories:edit`    | [Factory edit workflow](./factory-edit-requests.md#post-apiv1poms-factoriesfactoryidedit-requests)     |
| รายการคำขอแก้ไข            | `GET`  | `/api/v1/poms-factories/edit-requests`                  | `factories:view`                       | [Factory edit workflow](./factory-edit-requests.md#get-apiv1poms-factoriesedit-requests)               |
| รายละเอียดคำขอแก้ไข        | `GET`  | `/api/v1/poms-factories/edit-requests/:id`              | `factories:view`                       | [Factory edit workflow](./factory-edit-requests.md#get-apiv1poms-factoriesedit-requestsid)             |
| ส่งคำขอกลับเข้าพิจารณา     | `PUT`  | `/api/v1/poms-factories/edit-requests/:id/resubmission` | `factories:view` + `factories:edit`    | [Factory edit workflow](./factory-edit-requests.md#put-apiv1poms-factoriesedit-requestsidresubmission) |
| เจ้าหน้าที่พิจารณา         | `POST` | `/api/v1/poms-factories/edit-requests/:id/review`       | `factories:view` + `factories:approve` | [Factory edit workflow](./factory-edit-requests.md#post-apiv1poms-factoriesedit-requestsidreview)      |

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

- [โรงงานและคำขอแก้ไขข้อมูลในระบบ POMS](./factory-edit-requests.md) — field tables, JSON examples, permissions, workflow statuses, errors, concurrency, idempotency และ maintainer links
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
| Migration              | [`0100_create_poms_factory_edit_requests.ts`](../../../../../backend/src/db/migrations/0100_create_poms_factory_edit_requests.ts)                                                                                                                                                                                                                                                                                              |
| Tests                  | [`poms-factories.route.test.ts`](../../../../../backend/tests/unit/poms-factories.route.test.ts), [`poms-factories.service.test.ts`](../../../../../backend/tests/unit/poms-factories.service.test.ts), [`connected-measurement-points.route.test.ts`](../../../../../backend/tests/unit/connected-measurement-points.route.test.ts), [`api-docs.openapi.test.ts`](../../../../../backend/tests/unit/api-docs.openapi.test.ts) |
