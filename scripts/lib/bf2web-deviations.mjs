// A build receipt with passed:false counts as finished only through the orchestrator's ruled deviations (tilak-06, 12 Nov 2026,
// r1071 7853dec0: solutions-gate failed on exactly one ruled missing state). ONE function, read in two places: bf2-web's
// tools/gate-all.mjs (the receipt precondition) and the site repo's scripts/desktop/bf2web-publish.mjs (the publish check). This
// file is byte-identical in both repos (bf2-web tools/gates/release-deviations.mjs, site scripts/lib/bf2web-deviations.mjs) and
// each repo's test pins its sha256 and runs the same cases (release-deviations.cases.mjs / bf2web-deviations.cases.mjs).
//
// The file: <dir>/release-deviations-<N>-<sha8>.json, <sha8> the first 8 hex digits of build.json's commit, written by the
// orchestrator: [{"step":"solutions-gate","lines":["<the gate log's missing-state line without its 'missing ' prefix>", ...]}].
// A receipt with passed:false is finished when, and only when:
//   - exactly one such file exists for the build's sha8 (none, two, or only another sha's file refuses);
//   - every failed step in build.json (steps with ok !== true, failures[]) is listed, no listed step passed, nothing is blocked, no
//     mod failed;
//   - each listed step has an exact-line check (only solutions-gate has one), and for solutions-gate the gate log
//     (<site>.solutions-gate.log, the path build.json names) failed only for missing states (noProgram 0, its closing line the
//     missing-state exit), and its missing-state lines equal the listed lines exactly (an extra or absent line refuses).
// A receipt with passed:true is finished as before, and no file is read.
// No dependencies but node's fs and path; every refusal says why.
import fs from 'node:fs';
import path from 'node:path';

export const DEVIATIONS_DIR = 'C:/bf2-sites/s-quality';
const NAME = /^release-deviations-(\d+)-([0-9a-f]{8})\.json$/;
const samePath = (a, b) => typeof a === 'string' && typeof b === 'string' &&
  (process.platform === 'win32' ? path.resolve(a).toLowerCase() === path.resolve(b).toLowerCase() : path.resolve(a) === path.resolve(b));

// The gate log's missing-state lines, or the reason the log is not only a missing-state failure.
export function solutionsGateMissing(text) {
  const lines = String(text).split(/\r?\n/).map((line) => line.trimEnd()).filter((line) => line.length);
  const coverage = lines.filter((line) => line.startsWith('{') && line.includes('"surfacesMissing"')).map((line) => JSON.parse(line));
  if (coverage.length !== 1) return { reason: 'the solutions-gate log has ' + coverage.length + ' coverage lines, not one' };
  const missing = lines.filter((line) => line.startsWith('missing ')).map((line) => line.slice('missing '.length));
  const { missing: count, noProgram } = coverage[0];
  if (noProgram !== 0) return { reason: 'the solutions-gate log has ' + noProgram + ' subsets with no program' };
  if (count !== missing.length) return { reason: 'the solutions-gate log counts ' + count + ' missing states and lists ' + missing.length };
  const close = 'placed-surface-requests: ' + count + ' derived states have no solution in this site: those draws are skipped';
  if (lines.at(-1) !== close) return { reason: 'the solutions-gate log does not end on its missing-state exit: ' + JSON.stringify(lines.at(-1) ?? '') };
  return { missing };
}

const LINE_CHECKS = {
  'solutions-gate': ({ site, step, readText }) => {
    const expected = site + '.solutions-gate.log';
    if (!samePath(step.log, expected)) return { reason: 'solutions-gate names log ' + JSON.stringify(step.log) + ', not ' + expected };
    let text; try { text = readText(expected); } catch (error) { return { reason: 'the solutions-gate log cannot be read: ' + error.message }; }
    return solutionsGateMissing(text);
  },
};

const refuse = (reason) => ({ finished: false, reason, deviations: [] });

export function finishedReceipt({ build, site, dir = DEVIATIONS_DIR, readText = (file) => fs.readFileSync(file, 'utf8'), list = (d) => fs.readdirSync(d) }) {
  if (build?.passed === true) return { finished: true, deviations: [] };
  if (build?.passed !== false) return refuse('the build receipt has no passed field');
  if (!/^[0-9a-f]{40}$/.test(build.commit ?? '')) return refuse('the build receipt has no full commit');
  if (!samePath(site, build.out)) return refuse('the build receipt belongs to another export directory');
  const sha8 = build.commit.slice(0, 8);
  let names; try { names = list(dir); } catch (error) { return refuse('no deviations directory ' + dir + ': ' + error.message); }
  const matches = names.filter((name) => NAME.exec(name)?.[2] === sha8);
  if (matches.length !== 1) return refuse(matches.length ? 'more than one deviations file for ' + sha8 + ' in ' + dir + ': ' + matches.join(', ') : 'no deviations file release-deviations-<N>-' + sha8 + '.json in ' + dir);
  const file = path.join(dir, matches[0]);
  let listed; try { listed = JSON.parse(readText(file)); } catch (error) { return refuse(matches[0] + ' is not JSON: ' + error.message); }
  if (!Array.isArray(listed) || !listed.length) return refuse(matches[0] + ' is not a non-empty array');
  for (const entry of listed) {
    if (!entry || typeof entry !== 'object' || Object.keys(entry).sort().join() !== 'lines,step' || typeof entry.step !== 'string' ||
      !Array.isArray(entry.lines) || !entry.lines.length || !entry.lines.every((line) => typeof line === 'string' && line.length))
      return refuse(matches[0] + ': each entry is {step, lines[]} with non-empty string lines: ' + JSON.stringify(entry));
  }
  const steps = listed.map((entry) => entry.step);
  if (new Set(steps).size !== steps.length) return refuse(matches[0] + ' lists a step twice');
  if (!Array.isArray(build.steps)) return refuse('the build receipt has no steps');
  if ((build.blocked ?? []).length) return refuse('blocked steps are not deviations: ' + JSON.stringify(build.blocked));
  if ((build.modsFailed ?? []).length) return refuse('failed mods are not deviations: ' + JSON.stringify(build.modsFailed));
  const failed = [...new Set([...build.steps.filter((step) => step.ok !== true).map((step) => step.name), ...(build.failures ?? []).map((f) => f.name)])];
  if (!failed.length) return refuse('the build did not pass but no step failed');
  const unlisted = failed.filter((name) => !steps.includes(name));
  if (unlisted.length) return refuse('failed steps not listed in ' + matches[0] + ': ' + unlisted.join(', '));
  const notFailed = steps.filter((name) => !failed.includes(name));
  if (notFailed.length) return refuse(matches[0] + ' lists steps that did not fail: ' + notFailed.join(', '));
  for (const entry of listed) {
    const check = LINE_CHECKS[entry.step];
    if (!check) return refuse('no exact-line check for listed step ' + entry.step + ': only ' + Object.keys(LINE_CHECKS).join(', ') + ' can be a deviation');
    const rows = build.steps.filter((step) => step.name === entry.step);
    if (rows.length !== 1) return refuse('the build receipt has ' + rows.length + ' rows for ' + entry.step);
    const seen = check({ site, step: rows[0], readText });
    if (seen.reason) return refuse(seen.reason);
    const a = [...seen.missing].sort(), b = [...entry.lines].sort();
    const extra = b.filter((line, i) => b.indexOf(line) === i && b.filter((x) => x === line).length > a.filter((x) => x === line).length);
    const absent = a.filter((line, i) => a.indexOf(line) === i && a.filter((x) => x === line).length > b.filter((x) => x === line).length);
    if (extra.length || absent.length) return refuse(entry.step + ' lines differ from ' + matches[0] + ': ' +
      [...extra.map((line) => 'listed, not in the log: ' + line), ...absent.map((line) => 'in the log, not listed: ' + line)].join('; '));
  }
  return { finished: true, file, deviations: listed.map((entry) => ({ step: entry.step, lines: [...entry.lines] })) };
}

// The lines printed into the gate report and the publish log: never silent.
export const deviationLines = (receipt) => receipt.deviations.flatMap((entry) => entry.lines.map((line) => 'DEVIATION ' + entry.step + ': ' + line + ' (' + path.basename(receipt.file) + ')'));
