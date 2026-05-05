/**
 * eslint-plugin-expo@0.0.1 on npm is missing build/index.js (main entry).
 * ESLint then reports the plugin as "not found". Recreate the entry after install.
 */
const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, '..', 'node_modules', 'eslint-plugin-expo', 'build');
const entry = path.join(dir, 'index.js');
if (!fs.existsSync(entry)) {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    entry,
    `"use strict";
const { rules } = require("./rules");
module.exports = { rules };
`
  );
  // eslint-disable-next-line no-console
  console.log('patched: eslint-plugin-expo/build/index.js (missing from npm package)');
}
