import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { RECORDS, groupCode, recordCode } from '../data-slice.mjs';
import { identOf, keysReadBy, sliceFor, walksWhole } from './data-slice.mjs';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const read = (p) => readFileSync(join(ROOT, p), 'utf8');

describe('keysReadBy', () => {
  it('reads dotted, quoted and destructured keys, once each', () => {
    expect(keysReadBy('const x = ai.soldier; ai["hero"]; const { squad } = ai; ai.soldier;', 'ai')).toEqual(['soldier', 'hero', 'squad']);
  });

  it('takes a destructure’s key, not its new name', () => {
    expect(keysReadBy('const { rows: r, ok } = ai;', 'ai')).toEqual(['rows', 'ok']);
  });

  it('is blind to a longer name that starts the same', () => {
    expect(keysReadBy('aim.x; plain.ai; ai.y', 'ai')).toEqual(['y']);
  });
});

describe('walksWhole', () => {
  it('is true on a key read by a runtime value', () => {
    expect(walksWhole('ai[name]', 'ai')).toBe(true);
  });

  it('is true on the ways a record is walked or handed on', () => {
    for (const src of ['Object.keys(ai)', 'Object.entries(ai.rows)', 'for (const k in ai) {}', 'for (const r of ai) {}', 'ai.map((r) => r)', '({ ...ai })', 'use(ai)', 'const t = ai;', 'const ROWS = ai.rows;', 'export default { ai: ai.rows }', 'f(ai.rows, 1)']) {
      expect(walksWhole(src, 'ai'), src).toBe(true);
    }
  });

  it('is true on a destructure it cannot read exactly (a rest, a default, a quoted or computed key)', () => {
    for (const src of ['const { a, ...rest } = ai;', 'const { rows = null } = ai;', 'const { "rows": r } = ai;', 'const { [k]: v } = ai;']) {
      expect(walksWhole(src, 'ai'), src).toBe(true);
    }
  });

  it('is not fooled by a // inside a string', () => {
    expect(walksWhole('const p = "a//b"; const v = ai[k];', 'ai')).toBe(true);
  });

  it('reads a reader written without semicolons', () => {
    const src = 'import ai from "virtual:bf2017-ai"\nimport x from "y"\nconst v = Object.keys(ai)\nconst w = ai.rows.x;';
    expect(walksWhole(src, 'ai')).toBe(true);
    expect(keysReadBy(src, 'ai')).toEqual(['rows']);
  });

  it('is false when every read is a literal key, read on', () => {
    expect(walksWhole('const a = ai.rows.cover; const b = ai["rows"].tactics; ai.rows.system.x', 'ai')).toBe(false);
  });
});

describe('sliceFor', () => {
  it('keeps the keys read and nothing else', () => {
    expect(sliceFor({ a: 1, b: 2 }, ['a'])).toEqual({ a: 1 });
  });

  it('leaves out a key the record does not have', () => {
    expect(sliceFor({ a: 1 }, ['a', 'z'])).toEqual({ a: 1 });
  });
});

describe('identOf', () => {
  it('finds the name a reader gives a record’s default import', () => {
    expect(identOf("import x from 'a';\nimport BOOK from 'virtual:bf2017-screens';", 'virtual:bf2017-screens')).toBe('BOOK');
  });

  it('is null when the reader does not import it', () => {
    expect(identOf("import BOOK from '../screens.json';", 'virtual:bf2017-screens')).toBe(null);
  });
});

describe('RECORDS, against the readers on disk', () => {
  it('names the three records the design takes out of the chunks', () => {
    for (const f of ['ai.json', 'screens.json', 'ui.json']) expect(RECORDS.map((r) => r.file)).toContain(`src/data/bf2017/${f}`);
  });

  it('serves no record another file imports as JSON itself (a chunk would carry it twice)', () => {
    const others = execFileSync('git', ['grep', '-l', '-E', 'data/bf2017/[a-zA-Z./]+\\.json', '--', 'src/*.js', 'src/*.jsx', ':!*.test.js', ':!*.test.jsx'], { cwd: ROOT }).toString().split('\n').filter(Boolean);
    for (const row of RECORDS) {
      const name = row.file.split('/').pop();
      const by = others.filter((f) => new RegExp(`from ['"][^'"]*/${name.replace(/\./g, '\\.')}['"]`).test(read(f)));
      expect(by, row.file).toEqual([]);
    }
  });

  it('gives each record a name a module can export', () => {
    for (const row of RECORDS) expect(row.name).toMatch(/^[A-Za-z_$][\w$]*$/);
    expect(new Set(RECORDS.map((r) => r.name)).size).toBe(RECORDS.length);
  });

  for (const row of RECORDS) {
    it(`${row.specifier}: each reader imports it, and the row is whole exactly when a reader walks it`, () => {
      const walked = row.readers.map((file) => {
        const src = read(file);
        const ident = identOf(src, row.specifier);
        expect(ident, `${file} imports ${row.specifier}`).not.toBe(null);
        return walksWhole(src, ident);
      });
      expect(Boolean(row.whole)).toBe(walked.some(Boolean));
    });
  }

  it('no reader still imports a record’s JSON itself', () => {
    for (const row of RECORDS) for (const file of row.readers) expect(read(file)).not.toMatch(new RegExp(`from ['"][^'"]*/${row.file.split('/').pop()}['"]`));
  });
});

describe('recordCode', () => {
  const row = RECORDS.find((r) => r.specifier === 'virtual:bf2017-ai');

  it('inlines the record where there is no page to fetch it (dev, Vitest, SSR)', async () => {
    const code = recordCode(row, { root: ROOT, fetch: false });
    expect(code.startsWith('export default ')).toBe(true);
    const value = JSON.parse(code.slice('export default '.length).replace(/;\s*$/, ''));
    expect(value).toEqual(JSON.parse(read(row.file)));
  });

  it('in the client build, waits on the record’s request from the shared module, before any reader runs', () => {
    const code = recordCode(row, { root: ROOT, fetch: true });
    expect(code).toBe(`import { ai } from ${JSON.stringify('\0bf2017-records')};\nexport default await ai;\n`);
  });

  it('keeps a record whose row says not to fetch it inline, even in the client build', () => {
    const ui = RECORDS.find((r) => r.specifier === 'virtual:bf2017-ui');
    expect(ui.fetch).toBe(false);
    const code = recordCode(ui, { root: ROOT, fetch: true });
    expect(JSON.parse(code.slice('export default '.length).replace(/;\s*$/, ''))).toEqual(JSON.parse(read(ui.file)));
  });
});

describe('groupCode', () => {
  const code = groupCode(RECORDS);

  it('makes every fetched record’s request at once, each from the file’s built URL', () => {
    for (const r of RECORDS.filter((x) => x.fetch)) expect(code).toContain(`import ${r.name}Url from "/${r.file}?url";`);
    expect(code).toContain('import screensUrl from "/src/data/bf2017/screens.json?url";');
    expect(code).toMatch(/^export const ai = get\("src\/data\/bf2017\/ai\.json", aiUrl\);$/m);
    expect(code).toMatch(/^export const screens = get\("src\/data\/bf2017\/screens\.json", screensUrl\);$/m);
    expect(code).not.toContain('ui.json');
    expect(code).not.toContain('await');
  });

  it('parses each as JSON and fails loudly on a bad answer', async () => {
    const fetched = RECORDS.filter((r) => r.fetch);
    const body = code.replace(/^import .*$/gm, '').replace(/^export /gm, '');
    const calls = [];
    const fake = async (url) => (calls.push(url), url === 'screens' ? { ok: false, status: 404 } : { ok: true, json: async () => ({ from: url }) });
    const run = new Function('fetch', ...fetched.map((r) => `${r.name}Url`), `${body}\nreturn { ${fetched.map((r) => r.name).join(', ')} };`);
    const out = run(fake, ...fetched.map((r) => r.name));
    expect(calls).toEqual(fetched.map((r) => r.name));
    await expect(out.ai).resolves.toEqual({ from: 'ai' });
    await expect(out.screens).rejects.toThrow('src/data/bf2017/screens.json: 404 from screens');
  });
});
