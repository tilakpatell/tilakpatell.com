import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
// eslint's own parser (through its Linter, so nothing undeclared is
// imported): the test reads the source as the browser would, so a word in a
// comment or a class list never counts
import { Linter } from 'eslint';
import { ALLOW, RETIRED, WORDS, retiredIn, wayOut } from './words';

const SRC = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, SRC), 'utf8');
const list = (dir, re) =>
  readdirSync(new URL(dir, SRC))
    .filter((n) => re.test(n) && !/\.test\./.test(n))
    .map((n) => `${dir}${n}`);

// The shell and the universe map's HUD: where system text lives (spec 5.6).
const FILES = [
  ...list('components/', /\.jsx$/),
  ...list('components/guide/', /\.jsx?$/),
  ...list('components/tour/', /\.jsx?$/),
  ...list('components/feed/', /\.jsx$/),
  ...['Home', 'Experience', 'Projects', 'Resume', 'Contact', 'Travel', 'Changes', 'Terminal'].map((p) => `pages/${p}.jsx`),
  ...['UniversePanel', 'UniverseMap', 'NavMap', 'MiniMap', 'Hangar', 'FlightSettings', 'StartChoice'].map((f) => `components/universe/${f}.jsx`),
  ...list('components/universe/online/', /\.jsx$/),
  ...list('components/universe/chart/', /\.jsx$/),
  'components/cockpit/Welcome.jsx', // a first visit's one question
  'components/universe/nav.js',
  'components/universe/scene.js',
];

// Files whose wording is still being brought onto the glossary, one pull
// request at a time; each comes off as its pull request lands, and the test
// below fails if a file here is already clean, so the list only shrinks.
const PENDING = new Set([]);
// Files another stream is rewriting: skipped, without the shrink check, so
// their cleaning up doesn't turn this test red. (None now: the tour's copy
// reads the glossary's words.)
const ELSEWHERE = new Set();

// Attributes that hold code, not words.
const CODE_ATTRS = /^(className|class|id|key|href|to|src|type|role|rel|target|name|htmlFor|style|viewBox|d|fill|stroke|inputMode|autoComplete|method|action|as|lang|dir|aria-(controls|labelledby|describedby|owns|current|haspopup)|data-[\w-]+)$/;

// The strings a visitor can read: string literals, template text and JSX
// text. A literal that is one lower-case word (a value, a key name) or a
// list of classes is code; so is anything compared against, imported, or
// used as an object's key.
function userStrings(source) {
  const linter = new Linter();
  const errors = linter.verify(source, { languageOptions: { ecmaVersion: 'latest', sourceType: 'module', parserOptions: { ecmaFeatures: { jsx: true } } } });
  if (errors.some((e) => e.fatal)) throw new Error(errors[0].message);
  const ast = linter.getSourceCode().ast;
  const out = [];
  const add = (text, node) => {
    const t = String(text).replace(/\s+/g, ' ').trim();
    if (t && /[A-Za-z]/.test(t)) out.push({ text: t, line: node.loc.start.line });
  };
  const words = (s) => /\s/.test(s.trim()) || /^[A-Z]/.test(s);
  const classList = (s) => /^[a-z0-9:[\]\-/.!%&_()#,>=*+ ]+$/.test(s) && /[-:]/.test(s);
  const visit = (node, parent) => {
    if (!node || typeof node.type !== 'string') return;
    if (node.type === 'ImportDeclaration' || node.type === 'ExportAllDeclaration') return;
    if (node.type === 'JSXAttribute' && CODE_ATTRS.test(node.name.name ?? '')) return;
    if (node.type === 'Literal' && typeof node.value === 'string') {
      const isKey = parent?.type === 'Property' && parent.key === node && !parent.computed;
      // a palette item's search words are matched, never shown
      const searchWords = parent?.type === 'Property' && parent.value === node && parent.key?.name === 'keywords';
      // (a + joins words a visitor reads; == and friends test a value)
      const compared = (parent?.type === 'BinaryExpression' && /^(={2,3}|!={1,2}|in)$/.test(parent.operator)) || parent?.type === 'SwitchCase';
      // a piece of a sentence joined with + is words, however short
      const joined = parent?.type === 'BinaryExpression' && parent.operator === '+';
      if (!isKey && !compared && !searchWords && (joined || words(node.value)) && !classList(node.value)) add(node.value, node);
      return;
    }
    if (node.type === 'TemplateLiteral' && !(parent?.type === 'Property' && parent.key?.name === 'keywords')) {
      const s = node.quasis.map((q) => q.value.cooked).join(' … ');
      if (words(s) && !classList(s)) add(s, node);
    }
    if (node.type === 'JSXText') {
      add(node.value, node);
      return;
    }
    for (const [k, v] of Object.entries(node)) {
      // (eslint's tree also keeps the raw tokens and comments: not words)
      if (k === 'parent' || k === 'loc' || k === 'range' || k === 'tokens' || k === 'comments') continue;
      if (Array.isArray(v)) v.forEach((c) => visit(c, node));
      else if (v && typeof v === 'object') visit(v, node);
    }
  };
  visit(ast, null);
  return out;
}

const found = (path) => retiredIn(userStrings(read(path)), path);
const say = (path, hits) => hits.map((h) => `${path}:${h.line} “${h.word}” → ${h.use} (${h.text})`).join('\n');

describe('the glossary', () => {
  it('names every retired word’s replacement', () => {
    for (const r of RETIRED) expect(r.use, String(r.re)).toBeTruthy();
  });

  it('sends a world’s way out to the view the visitor came from', () => {
    expect(wayOut('classic')).toBe('Classic site');
    expect(wayOut('universe')).toBe('Universe map');
    expect(wayOut(undefined)).toBe(WORDS.universeMap);
  });
});

describe('reading a file’s words', () => {
  it('reads labels, sentences and JSX text, and skips code', () => {
    const src = `
      // the nav computer, in a comment
      import x from 'the hyperdrive';
      const KEYS = { 'Plain pages': 1, keywords: 'theme colors' };
      if (e.key === 'Escape') close();
      const hint = 'Open the ' + n + ' hyperdrive';
      export default () => (
        <div className="transition-colors text-sm" aria-label="Site colors">
          Open the nav computer
          <p title={\`Restart the site\`}>{'back to the intro'}</p>
        </div>
      );`;
    const words = userStrings(src).map((s) => s.text);
    expect(words).toEqual(['Open the', 'hyperdrive', 'Site colors', 'Open the nav computer', 'Restart the site', 'back to the intro']);
  });

  it('fails a retired word in system text and passes the same word in a crew line', () => {
    const line = [{ text: 'Punch the hyperdrive!', line: 3 }];
    expect(retiredIn(line, 'components/universe/UniversePanel.jsx')).toHaveLength(1);
    expect(retiredIn(line, 'components/universe/crews.js')).toHaveLength(0);
  });

  it('takes Escape as a key name and esc in prose as a word', () => {
    expect(retiredIn([{ text: 'Escape', line: 1 }])).toHaveLength(0);
    expect(retiredIn([{ text: 'Escape stops it', line: 1 }])).toHaveLength(1);
    expect(retiredIn([{ text: 'esc', line: 1 }])).toHaveLength(1);
  });

  it('keeps “color” in a class or a value and catches it in words', () => {
    expect(retiredIn([{ text: 'Pick any color', line: 1 }])).toHaveLength(1);
    expect(retiredIn([{ text: 'transition-colors duration-200', line: 1 }])).toHaveLength(0);
  });

  it('has an allow-list that says why', () => {
    for (const a of ALLOW) expect(a.why, String(a.file)).toBeTruthy();
  });
});

describe('the shell and the universe map', () => {
  it.each(FILES.filter((f) => !PENDING.has(f) && !ELSEWHERE.has(f)))('%s uses no retired word', (path) => {
    const hits = found(path);
    expect(hits, say(path, hits)).toEqual([]);
  });

  it.each([...PENDING])('%s is still pending (take it off the list once it’s clean)', (path) => {
    expect(found(path).length).toBeGreaterThan(0);
  });
});
