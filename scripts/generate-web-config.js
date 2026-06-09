const fs = require('fs');
const path = require('path');

const apiBase =
  process.env.API_BASE_URL?.trim() ||
  'https://chatpay-listener-production.up.railway.app';

const outPath = path.join(__dirname, '../web/config.js');
fs.writeFileSync(
  outPath,
  `window.WAYL_CONFIG={apiBase:${JSON.stringify(apiBase.replace(/\/$/, ''))}};\n`,
);
console.log('Wrote', outPath, 'apiBase=', apiBase);
