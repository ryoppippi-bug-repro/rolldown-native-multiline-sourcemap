import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { TraceMap, originalPositionFor } from '@jridgewell/trace-mapping';
import MagicString from 'magic-string';

const input = fileURLToPath(new URL('./input.js', import.meta.url));
const source = readFileSync(input, 'utf8');
const position = (text, offset) => ({
  line: text.slice(0, offset).split('\n').length,
  column: offset - text.lastIndexOf('\n', offset - 1) - 1,
});

export async function build({ nativeMagicString = false, js = false, minify = false } = {}) {
  const { rolldown, VERSION } = await import(process.env.ROLLDOWN || 'rolldown');
  const bundle = await rolldown({
    input,
    experimental: { nativeMagicString },
    plugins: [{
      name: 'banner',
      renderChunk(code, _chunk, _options, meta) {
        if (nativeMagicString && !js) {
          meta.magicString.prepend('/* banner */');
          return { code: meta.magicString };
        }
        const text = new MagicString(code);
        text.prepend('/* banner */');
        return { code: text.toString(), map: text.generateMap({ hires: 'boundary' }) };
      },
    }],
  });
  try {
    const { output: [chunk] } = await bundle.generate({ sourcemap: true, minify });
    const needle = 'globalThis.target';
    const generatedOffset = chunk.code.indexOf(needle);
    if (generatedOffset < 0) throw new Error('The generated code does not contain the probe');
    const expected = position(source, source.indexOf(needle));
    const generated = position(chunk.code, generatedOffset);
    const { line, column } = originalPositionFor(new TraceMap(chunk.map), generated);
    return { version: VERSION, code: chunk.code, expected, actual: { line, column } };
  } finally {
    await bundle.close();
  }
}
