// Existing authorization fixtures exercise strict enforcement. Bypass regression
// tests explicitly disable the switch to exercise the temporary runtime default.
process.env.OFFICER_PERMISSION_CHECKS_ENABLED = 'true';
