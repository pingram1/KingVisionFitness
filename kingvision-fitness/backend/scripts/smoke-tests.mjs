#!/usr/bin/env node
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

const bubblePath = path.join(root, 'src', 'models', 'Bubble.ts');
const groupPath = path.join(root, 'src', 'models', 'Group.ts');
assert.ok(fs.existsSync(bubblePath), 'Bubble.ts must exist');
assert.ok(fs.existsSync(groupPath), 'Group.ts must exist');

const bubble = fs.readFileSync(bubblePath, 'utf8');
const group = fs.readFileSync(groupPath, 'utf8');

assert.match(bubble, /IBubble/, 'Bubble model should expose IBubble');
assert.match(group, /bubbleId/, 'Group should declare bubble tenancy');
assert.match(group, /bubbleIsolation/, 'Group should declare private-bubble isolation');
assert.match(group, /findGroupsInBubble/, 'Group should expose bubble-scoped query helper');

console.log('backend smoke-tests: ok');
