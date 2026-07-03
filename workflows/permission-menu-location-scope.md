# Permission Menu Location Scope Workflow

## Trigger

An admin saves the permission-management form for a user.

## Goal

Persist data-visibility scope per menu, including optional region or province selection, then return the same effective values so the edit form can reopen without losing the user's choices.

## Input

- User profile fields such as `fullName`, `username`, `department`, `roles`, and `isActive`.
- `permissions.<module>.data` with one of `ALL`, `IN_REGION`, `IN_PROVINCE`, `IN_ESTATE`, `OWN_FACTORY`, or `null`.
- `permissions.<module>.region` when `data = IN_REGION`.
- `permissions.<module>.province` when `data = IN_PROVINCE`.
- Boolean action flags such as `view`, `edit`, `approve`, `search`, and `export`.

## Processing

1. Validate the permission scope value.
2. Convert enabled action flags into permission override rows.
3. For `IN_REGION`, require and store `region` in `user_permissions.region_name`.
4. For `IN_PROVINCE`, require `province`, resolve it by `provinces.id` or `provinces.name_th`, and store `user_permissions.province_id`.
5. Clear region/province fields when the selected data scope does not use them.
6. Read permission overrides back and group them by frontend module key.

## Output

`GET /api/v1/users/:id` returns:

- `permissions.<module>.data`
- `permissions.<module>.region`
- `permissions.<module>.province`
- enabled action flags

## Checkpoint

No human checkpoint is required during runtime. The admin reviews the resulting form state by reopening the user permission dialog.
