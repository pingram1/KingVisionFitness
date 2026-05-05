#!/usr/bin/env node
/**
 * Fast smoke gate (no Jest worker). Validates app entry wiring + auth secret storage refactor.
 * Use `npm run test:jest` for Jest (prefer Node 20 LTS locally; some Node versions hang on Jest workers).
 */

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

// --- index.js registers App ---
const indexPath = path.join(root, 'index.js');
assert.ok(fs.existsSync(indexPath), 'frontend/index.js must exist');
const indexSrc = fs.readFileSync(indexPath, 'utf8');
assert.match(indexSrc, /registerRootComponent/);

// --- Auth uses secure abstraction, not AsyncStorage for tokens ---
const authPath = path.join(root, 'src', 'context', 'AuthContext.tsx');
const apiPath = path.join(root, 'src', 'services', 'api.ts');
const authSrc = fs.readFileSync(authPath, 'utf8');
const apiSrc = fs.readFileSync(apiPath, 'utf8');
assert.match(authSrc, /authTokenStorage/);
assert.match(apiSrc, /authTokenStorage/);
assert.ok(!/\bAsyncStorage\b/.test(authSrc), 'AuthContext should use authTokenStorage, not AsyncStorage');
assert.ok(!/\bAsyncStorage\b/.test(apiSrc), 'api client should use authTokenStorage, not AsyncStorage');

// --- abstraction present ---
const absPath = path.join(root, 'src', 'storage', 'authTokenStorage.ts');
assert.ok(fs.existsSync(absPath), 'authTokenStorage.ts must exist');
const absSrc = fs.readFileSync(absPath, 'utf8');
assert.match(absSrc, /expo-secure-store/);
assert.match(absSrc, /WHEN_UNLOCKED|keychainAccessible/);

console.log('frontend smoke-tests: ok');
