import assert from 'node:assert/strict';
import { build } from './build.js';

const result = await build({ nativeMagicString: process.env.NATIVE === '1', js: process.env.JS === '1' });
console.log(`Rolldown ${result.version}`);
if (process.argv.includes('--show')) console.log(result.code);
console.log(`globalThis.target: expected ${result.expected.line}:${result.expected.column}, actual ${result.actual.line}:${result.actual.column}`);
assert.deepEqual(result.actual, result.expected);
