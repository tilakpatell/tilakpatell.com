// The rule behind scripts/data-slice.mjs (lane FL1 of the engine floor):
// what a reader of a game record reads of it, read off the reader’s source,
// so a record is served as the keys its readers read, or, when a reader
// walks it or hands it on whole, fetched as JSON instead of parsed as
// JavaScript in a chunk.
//
//   identOf(source, specifier) → the name the reader gives the record’s
//     default import, else null
//   keysReadBy(source, ident) → the top-level keys read as `ident.k`,
//     `ident['k']` or `const { k } = ident`, in the order first read
//   walksWhole(source, ident) → true when no slice below the whole record can
//     be proven complete: a key read by a runtime value (`ident[k]`), the
//     record or a top-level value of it walked, called on, spread, passed or
//     bound to another name (`Object.keys(ident)`, `ident.map(…)`,
//     `const ROWS = ident.rows`)
//   sliceFor(record, keys) → the record with those keys and no others
//
// When in doubt the answer is “whole”: a destructure with a rest, a default
// or a quoted or computed key, a name in a comment. A property that happens
// to share the name (`rb.ui`, `{ ui: … }`) is not the record.

const esc = (s) => s.replace(/[$]/g, '\\$');
const LIT = /^\s*\[\s*(['"])([^'"\\]*)\1\s*\]/;
const DOT = /^\s*\??\.\s*([A-Za-z_$][\w$]*)/;

// the source with its one-line imports left out (a name in an import is not a
// read); comments stay in, since a name they mention can only make a reader
// read as walking more of the record, never less
const code = (source) => source.replace(/^[ \t]*import\s[^\n]*$/gm, '');

export function identOf(source, specifier) {
  const m = source.match(new RegExp(`^\\s*import\\s+([A-Za-z_$][\\w$]*)\\s+from\\s+['"]${specifier.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}['"]`, 'm'));
  return m ? m[1] : null;
}

// each use of the name: the chain of literal keys after it and what follows
function* uses(source, ident) {
  const src = code(source);
  const re = new RegExp(`(?<![\\w$])${esc(ident)}(?![\\w$])`, 'g');
  for (const m of src.matchAll(re)) {
    if (src[m.index - 1] === '.' && src.slice(m.index - 3, m.index) !== '...') continue; // a property of something else
    let rest = src.slice(m.index + ident.length);
    if (/^\s*:(?!:)/.test(rest) && /[{,]\s*$/.test(src.slice(0, m.index))) continue; // a key in an object literal
    const keys = [];
    for (;;) {
      const d = rest.match(DOT) ?? rest.match(LIT);
      if (!d) break;
      keys.push(d[2] ?? d[1]);
      rest = rest.slice(d[0].length);
    }
    yield { keys, rest, before: src.slice(0, m.index) };
  }
}

// the keys of `const { a, b: c } = ident`, or null when a part is anything else
const destructured = (before) => {
  const m = before.match(/\{([^{}]*)\}\s*=\s*$/);
  if (!m) return null;
  const parts = m[1].split(',').map((p) => p.trim()).filter(Boolean);
  if (!parts.every((p) => /^[A-Za-z_$][\w$]*(\s*:\s*[A-Za-z_$][\w$]*)?$/.test(p))) return null;
  return parts.map((p) => p.split(/\s*:\s*/)[0]);
};

export function keysReadBy(source, ident) {
  const out = [];
  const add = (k) => { if (!out.includes(k)) out.push(k); };
  for (const u of uses(source, ident)) {
    if (u.keys.length) add(u.keys[0]);
    else for (const k of destructured(u.before) ?? []) add(k);
  }
  return out;
}

export function walksWhole(source, ident) {
  for (const u of uses(source, ident)) {
    if (/^\s*\??\.?\[/.test(u.rest)) return true; // a key read by a runtime value
    if (/^\s*\??\.?\(/.test(u.rest)) return true; // called on: ident.map(…), ident.rows.forEach(…)
    if (u.keys.length >= 2) continue; // read below a top-level key: the slice keeps that key
    if (u.keys.length === 0 && destructured(u.before)) continue;
    return true; // the record, or a top-level value of it, goes on whole
  }
  return false;
}

export function sliceFor(record, keys) {
  const out = {};
  for (const k of keys) if (Object.hasOwn(record ?? {}, k)) out[k] = record[k];
  return out;
}
