# Backend Endpoint Registry

<!-- endpoint-registry:v1 -->

หน้านี้เป็นสารบัญกลางของ explicit HTTP endpoints ที่ mount อยู่ใน backend ปัจจุบัน และเป็นข้อมูลที่ CI ใช้เทียบกับ route source แบบสองทาง

- หนึ่ง `Method + Path` ต้องมีเพียงหนึ่งแถว
- `Canonical owner` ระบุหน้าที่ต้องเก็บ contract ฉบับเต็ม คนเป็นผู้เลือก owner ตามเมนูหรือ business capability
- CI ตรวจเฉพาะความตรงกันของ mounted `Method + Path`; CI ไม่ย้าย owner ให้อัตโนมัติ
- Path ถูก normalize โดยตัด trailing slash
- ไม่รวม `express.static`, 404 fallback และ middleware-only surfaces
- Registry นี้ไม่เก็บ request/response body เพื่อไม่ให้เกิด contract ซ้ำ

จำนวน explicit endpoints: **105**

| Method | Full path | Canonical owner | Guard | Route source |
| --- | --- | --- | --- | --- |
| `GET` | `/health` | `docs/backend/api/shared/common-api/` | `public` | `backend/src/app.ts` |
| `GET` | `/api/v1` | `docs/backend/api/shared/common-api/` | `public` | `backend/src/app.ts` |
| `POST` | `/api/v1/auth/login` | `docs/backend/api/shared/authentication/` | `public + loginRateLimiter` | `backend/src/modules/auth/auth.routes.ts` |
| `GET` | `/api/v1/auth/me` | `docs/backend/api/shared/authentication/` | `authenticate` | `backend/src/modules/auth/auth.routes.ts` |
| `GET` | `/api/v1/users` | `docs/backend/api/menus/permissions/` | `authenticate + authorize(users:view, permissions:manage)` | `backend/src/modules/users/users.routes.ts` |
| `GET` | `/api/v1/users/:id/permissions` | `docs/backend/api/menus/permissions/` | `authenticate + authorize(permissions:manage)` | `backend/src/modules/users/users.routes.ts` |
| `PUT` | `/api/v1/users/:id/permissions` | `docs/backend/api/menus/permissions/` | `authenticate + authorize(permissions:manage)` | `backend/src/modules/users/users.routes.ts` |
| `GET` | `/api/v1/users/:id` | `docs/backend/api/menus/permissions/` | `authenticate + authorize(users:view, permissions:manage)` | `backend/src/modules/users/users.routes.ts` |
| `POST` | `/api/v1/users/local-accounts` | `docs/backend/api/menus/permissions/` | `authenticate + authorize(users:edit, permissions:manage)` | `backend/src/modules/users/users.routes.ts` |
| `POST` | `/api/v1/users` | `docs/backend/api/menus/permissions/` | `authenticate + authorize(users:edit, permissions:manage)` | `backend/src/modules/users/users.routes.ts` |
| `PATCH` | `/api/v1/users/:id` | `docs/backend/api/menus/permissions/` | `authenticate + authorize(users:edit, permissions:manage)` | `backend/src/modules/users/users.routes.ts` |
| `DELETE` | `/api/v1/users/:id` | `docs/backend/api/menus/permissions/` | `authenticate + authorize(users:edit, permissions:manage)` | `backend/src/modules/users/users.routes.ts` |
| `GET` | `/api/v1/eligible-factories/candidates` | `docs/backend/api/menus/eligible-factories/` | `authenticate + authorize(eligible_factories:manage)` | `backend/src/modules/eligible-factories/eligible-factories.routes.ts` |
| `GET` | `/api/v1/eligible-factories` | `docs/backend/api/menus/eligible-factories/` | `authenticate + authorize(eligible_factories:manage)` | `backend/src/modules/eligible-factories/eligible-factories.routes.ts` |
| `POST` | `/api/v1/eligible-factories` | `docs/backend/api/menus/eligible-factories/` | `authenticate + authorize(eligible_factories:manage)` | `backend/src/modules/eligible-factories/eligible-factories.routes.ts` |
| `DELETE` | `/api/v1/eligible-factories/:id` | `docs/backend/api/menus/eligible-factories/` | `authenticate + authorize(eligible_factories:manage)` | `backend/src/modules/eligible-factories/eligible-factories.routes.ts` |
| `GET` | `/api/v1/connected-measurement-points` | `docs/backend/api/shared/connected-measurement-points/` | `authenticate + authorize(cems_wpms_requests:view)` | `backend/src/modules/connection-requests/connected-measurement-points.routes.ts` |
| `GET` | `/api/v1/connected-measurement-points/factories/:factoryId` | `docs/backend/api/shared/connected-measurement-points/` | `authenticate + authorize(cems_wpms_requests:view)` | `backend/src/modules/connection-requests/connected-measurement-points.routes.ts` |
| `GET` | `/api/v1/connected-measurement-points/:stationId/requests` | `docs/backend/api/shared/connected-measurement-points/` | `authenticate + authorize(cems_wpms_requests:view)` | `backend/src/modules/connection-requests/connected-measurement-points.routes.ts` |
| `GET` | `/api/v1/connected-measurement-points/:stationId/parameter-form` | `docs/backend/api/shared/connected-measurement-points/` | `authenticate + authorize(cems_wpms_requests:view)` | `backend/src/modules/connection-requests/connected-measurement-points.routes.ts` |
| `GET` | `/api/v1/connected-measurement-points/:stationId/device-configs` | `docs/backend/api/shared/connected-measurement-points/` | `authenticate + authorize(cems_wpms_requests:view)` | `backend/src/modules/connection-requests/connected-measurement-points.routes.ts` |
| `GET` | `/api/v1/connected-measurement-points/:stationId/measurement-statistics` | `docs/backend/api/shared/connected-measurement-points/` | `authenticate + authorize(dashboard.stats:view)` | `backend/src/modules/connection-requests/connected-measurement-points.routes.ts` |
| `GET` | `/api/v1/connected-measurement-points/:stationId/calendar-status` | `docs/backend/api/shared/connected-measurement-points/` | `authenticate + authorize(dashboard.stats:view)` | `backend/src/modules/connection-requests/connected-measurement-points.routes.ts` |
| `POST` | `/api/v1/connected-measurement-points/:stationId/device-configs` | `docs/backend/api/shared/connected-measurement-points/` | `authenticate + authorize(cems_wpms_requests:edit)` | `backend/src/modules/connection-requests/connected-measurement-points.routes.ts` |
| `GET` | `/api/v1/public/factory-map-points` | `docs/backend/api/menus/home/` | `public` | `backend/src/modules/connection-requests/connection-requests.routes.ts` |
| `GET` | `/api/v1/operator-factory-dashboard` | `docs/backend/api/menus/home/` | `authenticate + authorize(dashboard:view)` | `backend/src/modules/connection-requests/connection-requests.routes.ts` |
| `PUT` | `/api/v1/operator-factories/:factoryId/favorite` | `docs/backend/api/menus/home/` | `authenticate + authorize(factories:view) + authorize(dashboard.alerts:view)` | `backend/src/modules/connection-requests/connection-requests.routes.ts` |
| `GET` | `/api/v1/cems-wpms-requests` | `docs/backend/api/menus/connection-requests/` | `authenticate + authorize(cems_wpms_requests:view)` | `backend/src/modules/connection-requests/connection-requests.routes.ts` |
| `GET` | `/api/v1/cems-wpms-requests/table-rows` | `docs/backend/api/menus/connection-requests/` | `authenticate + authorize(cems_wpms_requests:view)` | `backend/src/modules/connection-requests/connection-requests.routes.ts` |
| `GET` | `/api/v1/cems-wpms-requests/operator-factories` | `docs/backend/api/menus/connection-requests/` | `authenticate + authorize(factories:view)` | `backend/src/modules/connection-requests/connection-requests.routes.ts` |
| `GET` | `/api/v1/cems-wpms-requests/eligible-factories` | `docs/backend/api/menus/connection-requests/` | `authenticate + authorize(cems_wpms_requests:view)` | `backend/src/modules/connection-requests/connection-requests.routes.ts` |
| `GET` | `/api/v1/cems-wpms-requests/operator-factory-dashboard` | `docs/backend/api/menus/connection-requests/` | `authenticate; compatibility endpoint returning 404` | `backend/src/modules/connection-requests/connection-requests.routes.ts` |
| `GET` | `/api/v1/cems-wpms-requests/factories/:factoryId/general` | `docs/backend/api/menus/connection-requests/` | `authenticate + authorize(factories:view)` | `backend/src/modules/connection-requests/connection-requests.routes.ts` |
| `GET` | `/api/v1/cems-wpms-requests/connected-measurement-points` | `docs/backend/api/menus/connection-requests/` | `authenticate + authorize(cems_wpms_requests:view)` | `backend/src/modules/connection-requests/connection-requests.routes.ts` |
| `POST` | `/api/v1/cems-wpms-requests/measurement-points` | `docs/backend/api/menus/connection-requests/` | `authenticate + authorize(cems_wpms_requests:edit)` | `backend/src/modules/connection-requests/connection-requests.routes.ts` |
| `POST` | `/api/v1/cems-wpms-requests/direct-connections` | `docs/backend/api/menus/connection-requests/` | `authenticate + authorize(cems_wpms_requests:direct_connect)` | `backend/src/modules/connection-requests/connection-requests.routes.ts` |
| `POST` | `/api/v1/cems-wpms-requests/document-images` | `docs/backend/api/menus/connection-requests/` | `authenticate + authorize(cems_wpms_requests:edit)` | `backend/src/modules/connection-requests/connection-requests.routes.ts` |
| `POST` | `/api/v1/cems-wpms-requests/parameters` | `docs/backend/api/menus/connection-requests/` | `authenticate + authorize(cems_wpms_requests:edit)` | `backend/src/modules/connection-requests/connection-requests.routes.ts` |
| `GET` | `/api/v1/cems-wpms-requests/:id` | `docs/backend/api/menus/connection-requests/` | `authenticate + authorize(cems_wpms_requests:view)` | `backend/src/modules/connection-requests/connection-requests.routes.ts` |
| `GET` | `/api/v1/cems-wpms-requests/:id/detail` | `docs/backend/api/menus/connection-requests/` | `authenticate + authorize(cems_wpms_requests:view)` | `backend/src/modules/connection-requests/connection-requests.routes.ts` |
| `GET` | `/api/v1/cems-wpms-requests/:id/device-configs` | `docs/backend/api/menus/connection-requests/` | `authenticate + authorize(cems_wpms_requests:view)` | `backend/src/modules/connection-requests/connection-requests.routes.ts` |
| `GET` | `/api/v1/cems-wpms-requests/:id/device-configs/:configId` | `docs/backend/api/menus/connection-requests/` | `authenticate + authorize(cems_wpms_requests:view)` | `backend/src/modules/connection-requests/connection-requests.routes.ts` |
| `POST` | `/api/v1/cems-wpms-requests` | `docs/backend/api/menus/connection-requests/` | `authenticate + authorize(cems_wpms_requests:edit)` | `backend/src/modules/connection-requests/connection-requests.routes.ts` |
| `PUT` | `/api/v1/cems-wpms-requests/:id/form` | `docs/backend/api/menus/connection-requests/` | `authenticate + authorize(cems_wpms_requests:edit)` | `backend/src/modules/connection-requests/connection-requests.routes.ts` |
| `POST` | `/api/v1/cems-wpms-requests/:id/review` | `docs/backend/api/menus/connection-requests/` | `authenticate + authorize(cems_wpms_requests:approve)` | `backend/src/modules/connection-requests/connection-requests.routes.ts` |
| `POST` | `/api/v1/cems-wpms-requests/:id/status` | `docs/backend/api/menus/connection-requests/` | `authenticate + authorize(cems_wpms_requests:approve)` | `backend/src/modules/connection-requests/connection-requests.routes.ts` |
| `POST` | `/api/v1/cems-wpms-requests/:id/device-configs` | `docs/backend/api/menus/connection-requests/` | `authenticate + authorize(cems_wpms_requests:edit)` | `backend/src/modules/connection-requests/connection-requests.routes.ts` |
| `POST` | `/api/v1/cems-wpms-requests/:id/confirm-connection` | `docs/backend/api/menus/connection-requests/` | `authenticate + authorize(cems_wpms_requests:edit)` | `backend/src/modules/connection-requests/connection-requests.routes.ts` |
| `POST` | `/api/v1/cems-wpms-requests/:id/verify-connection` | `docs/backend/api/menus/connection-requests/` | `authenticate + authorize(cems_wpms_requests:approve)` | `backend/src/modules/connection-requests/connection-requests.routes.ts` |
| `GET` | `/api/v1/device-connections` | `docs/backend/api/integrations/device-connections/` | `public by middleware order` | `backend/src/modules/device-connections/device-connections.routes.ts` |
| `GET` | `/api/v1/device-connections/:id` | `docs/backend/api/integrations/device-connections/` | `public by middleware order` | `backend/src/modules/device-connections/device-connections.routes.ts` |
| `POST` | `/api/v1/device-connections` | `docs/backend/api/integrations/device-connections/` | `authenticate + authorize(cems_wpms_requests:edit)` | `backend/src/modules/device-connections/device-connections.routes.ts` |
| `POST` | `/api/v1/device-connections/test-connection` | `docs/backend/api/integrations/device-connections/` | `authenticate + authorize(cems_wpms_requests:edit)` | `backend/src/modules/device-connections/device-connections.routes.ts` |
| `GET` | `/api/v1/parameter-values/tables` | `docs/backend/api/menus/connection-requests/parameter-values.md` | `authenticate + authorize(cems_wpms_requests:view)` | `backend/src/modules/parameter-values/parameter-values.routes.ts` |
| `GET` | `/api/v1/parameter-values/connection-test` | `docs/backend/api/menus/connection-requests/parameter-values.md` | `authenticate + authorize(cems_wpms_requests:view)` | `backend/src/modules/parameter-values/parameter-values.routes.ts` |
| `GET` | `/api/v1/parameter-values/latest` | `docs/backend/api/menus/connection-requests/parameter-values.md` | `authenticate + authorize(cems_wpms_requests:view)` | `backend/src/modules/parameter-values/parameter-values.routes.ts` |
| `GET` | `/api/v1/parameter-values` | `docs/backend/api/menus/connection-requests/parameter-values.md` | `authenticate + authorize(cems_wpms_requests:view)` | `backend/src/modules/parameter-values/parameter-values.routes.ts` |
| `GET` | `/api/v1/monitoring-point-forms` | `docs/backend/api/menus/eligible-factories/` | `authenticate + authorize(cems_wpms_requests:view)` | `backend/src/modules/monitoring-point-forms/monitoring-point-forms.routes.ts` |
| `GET` | `/api/v1/monitoring-point-forms/:id` | `docs/backend/api/menus/eligible-factories/` | `authenticate + authorize(cems_wpms_requests:view)` | `backend/src/modules/monitoring-point-forms/monitoring-point-forms.routes.ts` |
| `POST` | `/api/v1/monitoring-point-forms` | `docs/backend/api/menus/eligible-factories/` | `authenticate + authorize(cems_wpms_requests:edit)` | `backend/src/modules/monitoring-point-forms/monitoring-point-forms.routes.ts` |
| `POST` | `/api/v1/monitoring-point-forms/:id/select-eligible` | `docs/backend/api/menus/eligible-factories/` | `authenticate + authorize(eligible_factories:manage)` | `backend/src/modules/monitoring-point-forms/monitoring-point-forms.routes.ts` |
| `PUT` | `/api/v1/monitoring-point-forms/:id` | `docs/backend/api/menus/eligible-factories/` | `authenticate + authorize(cems_wpms_requests:edit)` | `backend/src/modules/monitoring-point-forms/monitoring-point-forms.routes.ts` |
| `POST` | `/api/v1/bod-cod-deviation-reports/attachments` | `docs/backend/api/menus/bod-cod-deviation-reports/` | `authenticate + authorize(bod_cod_errors:edit)` | `backend/src/modules/bod-cod-deviations/bod-cod-deviation-reports.routes.ts` |
| `GET` | `/api/v1/bod-cod-deviation-reports/factories` | `docs/backend/api/menus/bod-cod-deviation-reports/` | `authenticate + authorize(bod_cod_errors:view)` | `backend/src/modules/bod-cod-deviations/bod-cod-deviation-reports.routes.ts` |
| `PUT` | `/api/v1/bod-cod-deviation-reports/:id/resubmission` | `docs/backend/api/menus/bod-cod-deviation-reports/` | `authenticate + authorize(bod_cod_errors:edit)` | `backend/src/modules/bod-cod-deviations/bod-cod-deviation-reports.routes.ts` |
| `POST` | `/api/v1/bod-cod-deviation-reports/:id/workflow-actions` | `docs/backend/api/menus/bod-cod-deviation-reports/` | `authenticate + authorize(bod_cod_errors:approve)` | `backend/src/modules/bod-cod-deviations/bod-cod-deviation-reports.routes.ts` |
| `POST` | `/api/v1/bod-cod-deviation-reports/:id/result-notice` | `docs/backend/api/menus/bod-cod-deviation-reports/` | `authenticate + authorize(bod_cod_errors:approve)` | `backend/src/modules/bod-cod-deviations/bod-cod-deviation-reports.routes.ts` |
| `PUT` | `/api/v1/bod-cod-deviation-reports/:id/result-notice` | `docs/backend/api/menus/bod-cod-deviation-reports/` | `authenticate + authorize(bod_cod_errors:approve)` | `backend/src/modules/bod-cod-deviations/bod-cod-deviation-reports.routes.ts` |
| `GET` | `/api/v1/bod-cod-deviation-reports/:id` | `docs/backend/api/menus/bod-cod-deviation-reports/` | `authenticate + authorize(bod_cod_errors:view)` | `backend/src/modules/bod-cod-deviations/bod-cod-deviation-reports.routes.ts` |
| `POST` | `/api/v1/bod-cod-deviation-reports` | `docs/backend/api/menus/bod-cod-deviation-reports/` | `authenticate + authorize(bod_cod_errors:edit)` | `backend/src/modules/bod-cod-deviations/bod-cod-deviation-reports.routes.ts` |
| `GET` | `/api/v1/bod-cod-deviation-reports` | `docs/backend/api/menus/bod-cod-deviation-reports/` | `authenticate + authorize(bod_cod_errors:view)` | `backend/src/modules/bod-cod-deviations/bod-cod-deviation-reports.routes.ts` |
| `GET` | `/api/v1/kwp-form-reports/factories` | `docs/backend/api/menus/kwp-forms/` | `authenticate + authorize(kwp_forms:view)` | `backend/src/modules/kwp-form-reports/kwp-form-reports.routes.ts` |
| `GET` | `/api/v1/kwp-form-reports/requests` | `docs/backend/api/menus/kwp-forms/` | `authenticate + authorize(kwp_forms:view)` | `backend/src/modules/kwp-form-reports/kwp-form-reports.routes.ts` |
| `POST` | `/api/v1/kwp-form-submissions/attachments` | `docs/backend/api/menus/kwp-forms/` | `authenticate + authorize(kwp_forms:edit)` | `backend/src/modules/kwp-form-submissions/kwp-form-submissions.routes.ts` |
| `POST` | `/api/v1/kwp-form-submissions/kwp01` | `docs/backend/api/menus/kwp-forms/` | `authenticate + authorize(kwp_forms:edit)` | `backend/src/modules/kwp-form-submissions/kwp-form-submissions.routes.ts` |
| `POST` | `/api/v1/kwp-form-submissions/kwp02` | `docs/backend/api/menus/kwp-forms/` | `authenticate + authorize(kwp_forms:edit)` | `backend/src/modules/kwp-form-submissions/kwp-form-submissions.routes.ts` |
| `POST` | `/api/v1/kwp-form-submissions/kwp03` | `docs/backend/api/menus/kwp-forms/` | `authenticate + authorize(kwp_forms:edit)` | `backend/src/modules/kwp-form-submissions/kwp-form-submissions.routes.ts` |
| `POST` | `/api/v1/kwp-form-submissions/kwp04` | `docs/backend/api/menus/kwp-forms/` | `authenticate + authorize(kwp_forms:edit)` | `backend/src/modules/kwp-form-submissions/kwp-form-submissions.routes.ts` |
| `POST` | `/api/v1/kwp-form-submissions/kwp05` | `docs/backend/api/menus/kwp-forms/` | `authenticate + authorize(kwp_forms:edit)` | `backend/src/modules/kwp-form-submissions/kwp-form-submissions.routes.ts` |
| `PATCH` | `/api/v1/kwp-form-submissions/kwp01/:id` | `docs/backend/api/menus/kwp-forms/` | `authenticate + authorize(kwp_forms:edit)` | `backend/src/modules/kwp-form-submissions/kwp-form-submissions.routes.ts` |
| `PATCH` | `/api/v1/kwp-form-submissions/kwp02/:id` | `docs/backend/api/menus/kwp-forms/` | `authenticate + authorize(kwp_forms:edit)` | `backend/src/modules/kwp-form-submissions/kwp-form-submissions.routes.ts` |
| `PATCH` | `/api/v1/kwp-form-submissions/kwp03/:id` | `docs/backend/api/menus/kwp-forms/` | `authenticate + authorize(kwp_forms:edit)` | `backend/src/modules/kwp-form-submissions/kwp-form-submissions.routes.ts` |
| `PATCH` | `/api/v1/kwp-form-submissions/kwp04/:id` | `docs/backend/api/menus/kwp-forms/` | `authenticate + authorize(kwp_forms:edit)` | `backend/src/modules/kwp-form-submissions/kwp-form-submissions.routes.ts` |
| `PATCH` | `/api/v1/kwp-form-submissions/kwp05/:id` | `docs/backend/api/menus/kwp-forms/` | `authenticate + authorize(kwp_forms:edit)` | `backend/src/modules/kwp-form-submissions/kwp-form-submissions.routes.ts` |
| `POST` | `/api/v1/kwp-form-submissions/kwp01/:id/resubmit` | `docs/backend/api/menus/kwp-forms/` | `authenticate + authorize(kwp_forms:edit)` | `backend/src/modules/kwp-form-submissions/kwp-form-submissions.routes.ts` |
| `POST` | `/api/v1/kwp-form-submissions/kwp02/:id/resubmit` | `docs/backend/api/menus/kwp-forms/` | `authenticate + authorize(kwp_forms:edit)` | `backend/src/modules/kwp-form-submissions/kwp-form-submissions.routes.ts` |
| `POST` | `/api/v1/kwp-form-submissions/kwp03/:id/resubmit` | `docs/backend/api/menus/kwp-forms/` | `authenticate + authorize(kwp_forms:edit)` | `backend/src/modules/kwp-form-submissions/kwp-form-submissions.routes.ts` |
| `POST` | `/api/v1/kwp-form-submissions/kwp04/:id/resubmit` | `docs/backend/api/menus/kwp-forms/` | `authenticate + authorize(kwp_forms:edit)` | `backend/src/modules/kwp-form-submissions/kwp-form-submissions.routes.ts` |
| `POST` | `/api/v1/kwp-form-submissions/kwp05/:id/resubmit` | `docs/backend/api/menus/kwp-forms/` | `authenticate + authorize(kwp_forms:edit)` | `backend/src/modules/kwp-form-submissions/kwp-form-submissions.routes.ts` |
| `GET` | `/api/v1/kwp-form-submissions/:id/workflow` | `docs/backend/api/menus/kwp-forms/` | `authenticate + authorize(kwp_forms:view)` | `backend/src/modules/kwp-form-submissions/kwp-form-submissions.routes.ts` |
| `POST` | `/api/v1/kwp-form-submissions/:id/workflow-actions` | `docs/backend/api/menus/kwp-forms/` | `authenticate + authorize(kwp_forms:approve)` | `backend/src/modules/kwp-form-submissions/kwp-form-submissions.routes.ts` |
| `GET` | `/api/v1/kwp-form-submissions/kwp01/:id` | `docs/backend/api/menus/kwp-forms/` | `authenticate + authorize(kwp_forms:view)` | `backend/src/modules/kwp-form-submissions/kwp-form-submissions.routes.ts` |
| `GET` | `/api/v1/kwp-form-submissions/kwp02/:id` | `docs/backend/api/menus/kwp-forms/` | `authenticate + authorize(kwp_forms:view)` | `backend/src/modules/kwp-form-submissions/kwp-form-submissions.routes.ts` |
| `GET` | `/api/v1/kwp-form-submissions/kwp03/:id` | `docs/backend/api/menus/kwp-forms/` | `authenticate + authorize(kwp_forms:view)` | `backend/src/modules/kwp-form-submissions/kwp-form-submissions.routes.ts` |
| `GET` | `/api/v1/kwp-form-submissions/kwp04/:id` | `docs/backend/api/menus/kwp-forms/` | `authenticate + authorize(kwp_forms:view)` | `backend/src/modules/kwp-form-submissions/kwp-form-submissions.routes.ts` |
| `GET` | `/api/v1/kwp-form-submissions/kwp05/:id` | `docs/backend/api/menus/kwp-forms/` | `authenticate + authorize(kwp_forms:view)` | `backend/src/modules/kwp-form-submissions/kwp-form-submissions.routes.ts` |
| `GET` | `/api/v1/integrations/device-configs/:stationId` | `docs/backend/api/integrations/device-configs/` | `authenticateDeviceConfigApiKey` | `backend/src/modules/integrations/integrations.routes.ts` |
| `POST` | `/api/v1/integrations/alert-events` | `docs/backend/api/integrations/alert-events/` | `authenticateAlertEventApiKey` | `backend/src/modules/integrations/integrations.routes.ts` |
| `GET` | `/api/v1/alert-events` | `docs/backend/api/menus/notifications/` | `authenticate + authorize(cems_wpms_requests:view)` | `backend/src/modules/alert-events/alert-events.routes.ts` |
| `GET` | `/api/v1/alert-events/:id` | `docs/backend/api/menus/notifications/` | `authenticate + authorize(cems_wpms_requests:view)` | `backend/src/modules/alert-events/alert-events.routes.ts` |
| `PATCH` | `/api/v1/alert-events/:id/status` | `docs/backend/api/menus/notifications/` | `authenticate + authorize(cems_wpms_requests:edit)` | `backend/src/modules/alert-events/alert-events.routes.ts` |
| `POST` | `/api/v1/email-test/send` | `docs/backend/api/shared/internal-tools/` | `authenticate` | `backend/src/modules/email-test/email-test.routes.ts` |
| `GET` | `/api/v1/officer-notification-email-recipients` | `docs/backend/api/shared/notification-recipients/` | `authenticate + authorize(notifications:edit)` | `backend/src/modules/officer-notification-email-recipients/officer-notification-email-recipients.routes.ts` |
| `POST` | `/api/v1/officer-notification-email-recipients` | `docs/backend/api/shared/notification-recipients/` | `authenticate + authorize(notifications:edit)` | `backend/src/modules/officer-notification-email-recipients/officer-notification-email-recipients.routes.ts` |
| `POST` | `/api/v1/officer-notification-email-recipients/:id/emails` | `docs/backend/api/shared/notification-recipients/` | `authenticate + authorize(notifications:edit)` | `backend/src/modules/officer-notification-email-recipients/officer-notification-email-recipients.routes.ts` |

## ข้อสังเกตที่ต้องแก้ระหว่าง migration

- `GET /api/v1/device-connections` และ `GET /api/v1/device-connections/:id` เป็น public ตามลำดับ middleware ปัจจุบัน ต้องยืนยันว่าเป็น behavior ที่ตั้งใจ
- `GET /api/v1/cems-wpms-requests/operator-factory-dashboard` เป็น compatibility endpoint ที่ตอบ `404` และชี้ไป `GET /api/v1/operator-factory-dashboard`
- เอกสาร legacy ระบุว่า `parameter-values` เป็น public แต่ route ปัจจุบันใช้ `authenticate` และ `authorize('cems_wpms_requests:view')`; canonical contract ต้องยึด behavior ที่ยืนยันจาก code และ tests
- Canonical owner paths ที่ยังไม่มีหน้าเอกสารเป็น migration targets ไม่ใช่ broken links จนกว่าจะสร้าง landing pages ใน migration batch ที่กำหนด
