// Existing fixtures verify enforced permissions. Dedicated write-policy tests
// explicitly disable this switch to cover the runtime default.
process.env.OFFICER_WRITE_PERMISSION_CHECKS_ENABLED = 'true';
