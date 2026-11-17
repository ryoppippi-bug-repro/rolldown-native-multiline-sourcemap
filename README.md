# Native renderChunk maps lose original lines in multiline JavaScript

This reproduces the sourcemap-resolution bug fixed by [Rolldown PR #11628](https://github.com/rolldown/rolldown/pull/11628). The [upstream reproduction report](https://github.com/rolldown/rolldown/pull/11628#issuecomment-6963780192) includes the trace results. Rolldown 1.2.16 fails; 1.3.2 passes. Verified on 2026-11-17 with Node.js 24.21.0, pnpm 12.16.1 and macOS arm64.

## Steps

```sh
pnpm install --frozen-lockfile
pnpm repro:official
pnpm repro
```

`pnpm repro:official` passes. `pnpm repro` exits with an assertion failure on the pinned Rolldown 1.2.16.

The entire input is plain JavaScript:

```js
console.log(
  globalThis.target()
);
```

The plugin prepends `/* banner */` in `renderChunk`. The baseline returns a string and a JS `magic-string` map with `hires: 'boundary'`. With `NATIVE=1`, it returns `{ code: meta.magicString }` without an explicit map.

## Expected

The baseline maps `globalThis.target` to its original line 2, column 2 (columns are zero-based):

```text
Rolldown 1.2.16
globalThis.target: expected 2:2, actual 2:2
```

Both modes emit identical JavaScript:

```js
/* banner */// input.js
console.log(globalThis.target());

//# sourceMappingURL=input.js.map
```

## Actual

The implicit native map points to line 1, column 0:

```text
Rolldown 1.2.16
globalThis.target: expected 2:2, actual 1:0
```

`pnpm compare` checks both with and without minification, verifies that emitted JavaScript is byte-identical, and prints:

```text
Rolldown 1.2.16, minify=false
expected: 2:2
JS, flag off: 2:2
JS, flag on:  2:2
native:       1:0
Emitted JS: byte-identical
Rolldown 1.2.16, minify=true
expected: 2:2
JS, flag off: 2:2
JS, flag on:  2:2
native:       1:0
Emitted JS: byte-identical
```

## Analysis

The likely cause is the implicit line-level map: the bundler combines the three input lines into one generated statement, and the native hook's map then loses the column information needed to recover the second original line. The resulting symptom therefore includes incorrect original **lines**, as well as columns.

Source inspected: [`packages/rolldown/src/plugin/bindingify-output-hooks.ts` at fix commit `8eb42131e481d34c95797e7ac75e6c224542e80a`](https://github.com/rolldown/rolldown/blob/8eb42131e481d34c95797e7ac75e6c224542e80a/packages/rolldown/src/plugin/bindingify-output-hooks.ts). That change makes the implicit map use `hires: 'boundary'`. No upstream source was patched or rebuilt during this reproduction.

Latest release verified on 2026-11-17:

```sh
pnpm repro:latest
```

```text
Rolldown 1.3.2
globalThis.target: expected 2:2, actual 2:2
```

The same harness also passed with and without minification against the official main-branch preview `https://pkg.pr.new/rolldown@4035198` (`VERSION: 1.3.2+commit.40351984`, full commit `40351984849dfc4b9b7354c9e8e96fa9612a737c`). This preview is not needed to run the reproduction and is not a dependency of this repository.

The stronger claim that enabling the flag alone breaks maps when all hooks return ordinary JS strings was **not reproduced**. `pnpm repro:js-flag-on` passes on 1.2.16. This repository demonstrates only the confirmed native-return case.

## How it was found

A Vite 8.3.6 client build using Rolldown 1.2.16 showed incorrect original-line mappings in TSX when enabling `build.rolldownOptions.experimental.nativeMagicString`. The emitted JavaScript was unchanged. Reduction confirmed the native hook's implicit-map failure; the broader flag-only observation was not confirmed. Neither Vite nor TSX, JSX transformation, React, multiple modules, or minification is required for this reproduction.

## Files

- `input.js`: three-line input containing the probe.
- `build.js`: the banner plugin and source-position tracing through `@jridgewell/trace-mapping` 0.3.31; `NATIVE=1` enables native MagicString, `JS=1` forces JS `magic-string` 0.30.21, and `ROLLDOWN` selects the exact package to import.
- `repro.js`: asserts that the original line and column are preserved. `pnpm run show` and `pnpm run show:official` also print generated code.
- `compare.js`: asserts byte-identical JavaScript and correct baseline mappings, then reports both minification modes.
- `package.json` and `pnpm-lock.yaml`: exact dependencies, including the fixed 1.3.2 release as `rolldown-latest`.
