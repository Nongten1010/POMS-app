'use strict';
const fs = require('node:fs');
const settings = {
  backend: { ELIGIBLE_OPERATOR_ACCESS_ENABLED: 'true', FACTORY_STATUS_SYNC_ENABLED: 'true', FACTORY_STATUS_SYNC_HOUR: '2', FACTORY_STATUS_MAX_AGE_SECONDS: '3600' },
  frontend: { VITE_ELIGIBLE_OPERATOR_ACCESS_ENABLED: 'true' },
  'disable-backend': { ELIGIBLE_OPERATOR_ACCESS_ENABLED: 'false', FACTORY_STATUS_SYNC_ENABLED: 'false' },
  'disable-frontend': { VITE_ELIGIBLE_OPERATOR_ACCESS_ENABLED: 'false' },
};
function patch(text, mode) {
  const values = settings[mode];
  if (!values) throw new Error('Unsupported configuration mode');
  const newline = text.includes('\r\n') ? '\r\n' : '\n';
  for (const [key, value] of Object.entries(values)) {
    const regex = new RegExp(`^(?:\\uFEFF)?[ \\t]*(?:export[ \\t]+)?${key}[ \\t]*=[^\\r\\n]*`, 'gm');
    const matches = [...text.matchAll(regex)];
    if (matches.length > 1) throw new Error(`Duplicate allowlisted setting: ${key}`);
    if (matches.length) text = text.replace(regex, (old) => `${old.startsWith('\uFEFF') ? '\uFEFF' : ''}${key}=${value}`);
    else text += `${text && !text.endsWith('\n') ? newline : ''}${key}=${value}${newline}`;
  }
  return text;
}
module.exports = { patch };
if (require.main === module) {
  const [mode, file] = process.argv.slice(2);
  const original = fs.readFileSync(file, 'utf8');
  const next = patch(original, mode);
  // The caller creates a protected backup before this write. Preserve the existing ACL.
  fs.writeFileSync(file, next, 'utf8');
  console.log(`Updated allowlisted ${mode} configuration; values and other settings withheld.`);
}
