// A pair of eyes for the pipeline: Claude, through Claude Code on this machine
// (`claude -p`, the owner's subscription, no API key), or else Qwen3-VL run by
// llama.cpp's server here (README.md: %LOCALAPPDATA%\llamacpp); either is
// asked to look at pictures and say what it sees as JSON. Used to pick the
// concept picture that looks most like the thing, and to judge a finished
// model's four-view sheet before it ships.
//
//   node scripts/gen3d/vlm.mjs ask "Is this an X-wing? Answer as JSON {score: 1-10, problems: [...]}" picture.png [more.png …]
//   ask(prompt, images) → the model's answer (a string); askJson(prompt, images) → parsed
//   pick(what, candidates) → { best: index, scores: [...] }   judge(what, sheet) → { score, problems, ok }

import { execFileSync, spawn } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { localDir } from '../desktop/lib.mjs';

const LLAMACPP = localDir('llamacpp'); // %LOCALAPPDATA%\llamacpp, or the Claude app's boxed copy (scripts/desktop/lib.mjs)
export const LLAMA = {
  exe: join(LLAMACPP, 'bin', 'llama-server.exe'),
  model: join(LLAMACPP, 'models', 'Qwen3-VL-8B-Instruct-Q8_0.gguf'),
  mmproj: join(LLAMACPP, 'models', 'mmproj-F16.gguf'),
  port: Number(process.env.VLM_PORT ?? 5355),
};
const qwenReady = () => existsSync(LLAMA.exe) && existsSync(LLAMA.model) && existsSync(LLAMA.mmproj);

// Claude Code's command line, if it's installed here (asked once); GEN3D_JUDGE=qwen skips it.
let cli;
export function claudeCode() {
  if (cli !== undefined) return cli;
  cli = null;
  if (process.env.GEN3D_JUDGE === 'qwen' || process.env.GEN3D_JUDGE === 'fake') return null;
  try {
    const lines = execFileSync(process.platform === 'win32' ? 'where' : 'which', ['claude'], { encoding: 'utf8', timeout: 10000 }).split(/\r?\n/).map((l) => l.trim());
    // `where` lists npm's extensionless sh shim first: the .cmd or .exe is the one that runs here
    const found = lines.find((l) => /\.(cmd|exe)$/i.test(l)) ?? lines.find((l) => /claude$/i.test(l));
    cli = found?.trim() || null;
    // on Windows `claude` is a .cmd shim round the package's own binary (or its cli.js): run that, so no shell is needed
    if (cli && /\.cmd$/i.test(cli)) {
      const pkg = join(dirname(cli), 'node_modules', '@anthropic-ai', 'claude-code');
      cli = [join(pkg, 'bin', 'claude.exe'), join(pkg, 'cli.js')].find((f) => existsSync(f)) ?? cli;
    }
    // installed but not logged in (the desktop app's login doesn't reach it: `claude` then `/login`, once): Qwen instead
    if (cli) {
      let probe;
      try {
        probe = runClaude(cli, ['-p', 'Reply with the word OK.', '--model', 'haiku', '--max-turns', '1', '--output-format', 'text'], 60000);
      } catch (e) {
        probe = `${e.stdout ?? ''}${e.stderr ?? ''}` || 'no output'; // it exits non-zero when not logged in (its message would quote the prompt's own OK)
      }
      if (!/^\s*OK\b/i.test(probe)) {
        console.warn(/not logged in/i.test(probe) ? 'Claude Code is here but not logged in (run `claude`, then /login, once); judging with Qwen3-VL' : `Claude Code did not answer (${probe.trim().slice(0, 120)}); judging with Qwen3-VL`);
        cli = null;
      }
    }
  } catch (e) {
    if (cli) console.warn(`Claude Code check failed (${e.message.slice(0, 120)}); judging with Qwen3-VL`);
    cli = null; /* not installed, or the check broke */
  }
  return cli;
}
export const which = () => (process.env.GEN3D_JUDGE === 'fake' ? 'fake' : claudeCode() ? 'claude' : qwenReady() ? 'qwen' : null);

// GEN3D_JUDGE=fake: the contract tests' judge, answering from a script
// (GEN3D_JUDGE_SCRIPT, a JSON array of { match, reply }): the first entry
// whose match is in the prompt or an image's path answers; a list of replies
// is given in turn across calls, even across processes, the last one held.
// Every call is written to calls.json beside the script, so a test can say
// how often the judge was asked and about what.
function askFake(prompt, images) {
  const file = process.env.GEN3D_JUDGE_SCRIPT;
  if (!file) throw new Error('GEN3D_JUDGE=fake needs GEN3D_JUDGE_SCRIPT');
  const script = JSON.parse(readFileSync(file, 'utf8'));
  const log = join(dirname(file), 'calls.json');
  const calls = existsSync(log) ? JSON.parse(readFileSync(log, 'utf8')) : [];
  const said = [prompt, ...images].join('\n');
  const entry = script.findIndex((e) => said.includes(e.match));
  calls.push({ prompt, images, entry });
  writeFileSync(log, JSON.stringify(calls, null, 1));
  if (entry < 0) throw new Error(`no scripted reply for "${prompt.slice(0, 80)}"`);
  const { reply } = script[entry];
  if (!Array.isArray(reply)) return reply;
  const before = calls.filter((c) => c.entry === entry).length - 1;
  return reply[Math.min(before, reply.length - 1)];
}
export const ready = () => which() !== null;

let server = null;
const base = () => `http://127.0.0.1:${LLAMA.port}`;

async function up() {
  try {
    return (await fetch(`${base()}/health`)).ok;
  } catch {
    return false;
  }
}

// The server, started on first use and kept for the process; `stop()` ends it.
export async function start() {
  if (await up()) return;
  if (!ready()) throw new Error('Qwen3-VL is not set up here: see scripts/gen3d/README.md');
  server = spawn(LLAMA.exe, ['-m', LLAMA.model, '--mmproj', LLAMA.mmproj, '--port', String(LLAMA.port), '-ngl', '99', '-c', '16384', '--temp', '0.1', '--log-disable'], { stdio: 'ignore' });
  for (let i = 0; i < 240; i++) {
    if (await up()) return;
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('llama-server did not come up');
}

export function stop() {
  server?.kill();
  server = null;
}

const mime = (f) => (/\.jpe?g$/i.test(f) ? 'image/jpeg' : /\.webp$/i.test(f) ? 'image/webp' : 'image/png');
const dataUrl = (f) => `data:${mime(f)};base64,${readFileSync(f).toString('base64')}`;

// Claude Code, non-interactive: told which files to look at (its Read tool shows it pictures), asked for the answer only.
function askClaudeCode(prompt, images) {
  const text = `${images.length ? `Read these picture files first, with the Read tool, and look at them carefully: ${images.map((f) => resolve(f)).join(' ; ')}\n\n` : ''}${prompt}\n\nReply with the answer only, no preamble.`;
  const args = ['-p', text, '--model', process.env.GEN3D_JUDGE_MODEL ?? 'opus', '--allowedTools', 'Read', '--max-turns', String(images.length + 3), '--output-format', 'text'];
  return runClaude(claudeCode(), args, 240000);
}

// the CLI run without a shell: node on its cli.js, or the binary itself
const runClaude = (cli, args, timeout) => {
  const [cmd, argv] = /\.js$/i.test(cli) ? [process.execPath, [cli, ...args]] : [cli, args];
  return execFileSync(cmd, argv, { encoding: 'utf8', timeout, maxBuffer: 8 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] }).trim();
};

export async function ask(prompt, images = [], { maxTokens = 600 } = {}) {
  if (which() === 'fake') return askFake(prompt, images);
  if (which() === 'claude') return askClaudeCode(prompt, images);
  await start();
  const content = [...images.map((f) => ({ type: 'image_url', image_url: { url: dataUrl(f) } })), { type: 'text', text: prompt }];
  // an answer takes seconds; one that hasn't come in minutes never will (a GPU shared with a voices batch hung it for two hours)
  const r = await fetch(`${base()}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ messages: [{ role: 'user', content }], max_tokens: maxTokens, temperature: 0.1 }),
    signal: AbortSignal.timeout(Number(process.env.VLM_TIMEOUT_MS) || 5 * 60000),
  });
  if (!r.ok) throw new Error(`llama-server: HTTP ${r.status} ${await r.text()}`);
  const j = await r.json();
  return j.choices?.[0]?.message?.content ?? '';
}

// The JSON object in an answer: the first whole one (the model may wrap it in prose or a code fence, or go on after it
// with more prose holding a brace, which a match from the first brace to the last took in: #1050's judge failed so).
export function parseJson(text) {
  for (let at = text.indexOf('{'); at >= 0; at = text.indexOf('{', at + 1)) {
    let depth = 0;
    let quoted = false;
    let escaped = false;
    for (let i = at; i < text.length; i++) {
      const c = text[i];
      if (quoted) {
        if (escaped) escaped = false;
        else if (c === '\\') escaped = true;
        else if (c === '"') quoted = false;
      } else if (c === '"') quoted = true;
      else if (c === '{') depth++;
      else if (c === '}' && --depth === 0) {
        try {
          return JSON.parse(text.slice(at, i + 1));
        } catch {
          break; // (not JSON from this brace: try the next)
        }
      }
    }
  }
  throw new Error(`no JSON in: ${text.slice(0, 200)}`);
}

const askJson = async (prompt, images, opts) => parseJson(await ask(prompt, images, opts));

export const SCALE = 'Score 10 only for a faithful, canonical likeness a fan would accept at once; 7 for right overall with small errors; 4 for the right kind of thing but wrong in shape or parts; 1 for something else.';

// Which of several concept pictures is most like the thing: each scored alone, so the scores compare.
export async function pick(what, candidates) {
  const scores = [];
  for (const file of candidates) {
    const j = await askJson(`This is meant to be ${what}. How faithfully does the picture show it? ${SCALE} Answer as JSON only: {"score": N, "problems": ["…"]}`, [file]);
    scores.push({ file, score: Number(j.score) || 0, problems: j.problems ?? [] });
  }
  const best = scores.reduce((b, s, i) => (s.score > scores[b].score ? i : b), 0);
  return { best, scores };
}

// A finished model's sheet (four views: three-quarter, front, side, top) judged against what it should be.
export async function judge(what, sheet, { pass = 7 } = {}) {
  const j = await askJson(`This sheet shows a 3D model from four sides: three-quarter, front, side, top (each row is one model; judge the last row). It is meant to be ${what}. Is the shape right (proportions, parts, where they are), and the colours and markings? ${SCALE} Answer as JSON only: {"score": N, "problems": ["…"], "fix": "one sentence on what a better reference picture or prompt would change"}`, [sheet], { maxTokens: 800 });
  return { score: Number(j.score) || 0, problems: j.problems ?? [], fix: j.fix ?? '', ok: (Number(j.score) || 0) >= pass };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [cmd, ...rest] = process.argv.slice(2);
  try {
    if (cmd === 'ask') {
      const [prompt, ...images] = rest;
      console.log(await ask(prompt, images.map((f) => resolve(f))));
    } else if (cmd === 'pick') {
      const [what, ...images] = rest;
      const r = await pick(what, images.map((f) => resolve(f)));
      r.scores.forEach((s, i) => console.log(`${i === r.best ? '*' : ' '} ${s.score}  ${s.file}  ${s.problems.join('; ')}`));
    } else if (cmd === 'judge') {
      const [what, sheet] = rest;
      console.log(JSON.stringify(await judge(what, resolve(sheet)), null, 2));
    } else throw new Error('usage: node scripts/gen3d/vlm.mjs ask "…" IMG… | pick "what" IMG… | judge "what" SHEET.png');
  } finally {
    stop();
  }
}
