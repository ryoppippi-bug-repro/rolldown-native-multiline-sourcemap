import assert from 'node:assert/strict';
import { build } from './build.js';

for (const minify of [false, true]) {
  const baseline = await build({ minify });
  const flagOnly = await build({ minify, nativeMagicString: true, js: true });
  const native = await build({ minify, nativeMagicString: true });
  assert.equal(native.code, baseline.code);
  assert.equal(flagOnly.code, baseline.code);
  assert.deepEqual(baseline.actual, baseline.expected);
  assert.deepEqual(flagOnly.actual, flagOnly.expected);
  const format = ({ line, column }) => `${line}:${column}`;
  console.log(`Rolldown ${baseline.version}, minify=${minify}`);
  console.log(`expected: ${format(baseline.expected)}`);
  console.log(`JS, flag off: ${format(baseline.actual)}`);
  console.log(`JS, flag on:  ${format(flagOnly.actual)}`);
  console.log(`native:       ${format(native.actual)}`);
  console.log('Emitted JS: byte-identical');
}
