// The one case table for release-deviations.mjs, byte-identical in bf2-web (tools/gates/release-deviations.cases.mjs, run by
// tools/gates/release-deviations.test.mjs under node:test) and the site repo (scripts/lib/bf2web-deviations.cases.mjs, run by
// scripts/desktop/bf2web-publish.test.mjs under vitest). Each case: a build receipt, the files the check may read (in memory),
// and either finished with the accepted lines or the refusal's text. The log text is r1071 7853dec0's real solutions-gate log
// shape (C:/bf2-sites/rc1057f-7853dec0.solutions-gate.log), shortened.
export const SITE = '/sites/rc1057f-7853dec0', DIR = '/sites/s-quality';
export const SHA = '7853dec04845dd16c675e8646f7079c9510541b1';
export const RULED = 'WebPort/Retail/Permutation133000006 Mesh/305c2929PrevWorldTransform4x3FloatInstanceData4x2Half mode 9 instancing 6 lighting 0';
const OTHER = 'WebPort/Retail/Permutation1 Mesh/00000000Other mode 0 instancing 0 lighting 0';
const gateLog = (missing, { noProgram = 0, close = true } = {}) => [
  'skinned states 1520, not in the database 0; forward-only surfaces with no state 0; transparent subsets with no forward-only variant 0',
  JSON.stringify({ meshes: 1130, retailSubsets: 7250, authoredSubsets: 100, noProgram, states: 1670, missing: missing.length, surfacesMissing: missing.length }),
  JSON.stringify({ terrainSurfaces: 117, terrainDerivedFromTree: 9, terrainNotDerived: 0 }),
  ...missing.map((line) => 'missing ' + line),
  JSON.stringify({ programs: 3225, byClass: { retail: 3170, 'source-compiled': 47, authored: 8 }, retailOnly: false }),
  ...(close ? ['placed-surface-requests: ' + missing.length + ' derived states have no solution in this site: those draws are skipped'] : []),
].join('\r\n') + '\r\n';
const STEP_NAMES = ['prepare', 'physics', 'world', 'export', 'solutions-gate', 'verify', 'direct-check'];
const receipt = ({ passed = false, failed = ['solutions-gate'], commit = SHA, ...rest } = {}) => ({
  schema: 'bf2-play-site-build/1', commit, out: SITE, passed,
  steps: STEP_NAMES.map((name) => ({ name, ok: !failed.includes(name), log: SITE + '.' + name + '.log' })),
  failures: failed.map((name) => ({ name, ok: false, status: 'failed' })), blocked: [], modsFailed: [], ...rest,
});
const file = (lines, step = 'solutions-gate') => JSON.stringify([{ step, lines }]);
const ruledFile = { ['release-deviations-1071-7853dec0.json']: file([RULED]) };
const logs = (missing = [RULED], options) => ({ [SITE + '.solutions-gate.log']: gateLog(missing, options) });

export const CASES = [
  { name: 'a clean build passes as before, and no file is read', build: receipt({ passed: true, failed: [] }), dir: {}, files: {}, finished: true, lines: [] },
  { name: 'the listed solutions-gate deviation passes, and its line is printed', build: receipt(), dir: ruledFile, files: logs(), finished: true, lines: [RULED] },
  { name: 'an unlisted failed step refuses', build: receipt({ failed: ['solutions-gate', 'verify'] }), dir: ruledFile, files: logs(), refuses: /failed steps not listed in release-deviations-1071-7853dec0\.json: verify/ },
  { name: 'an extra listed line refuses', build: receipt(), dir: { ['release-deviations-1071-7853dec0.json']: file([RULED, OTHER]) }, files: logs(), refuses: /lines differ.*listed, not in the log: WebPort\/Retail\/Permutation1 / },
  { name: 'a log line that is not listed refuses', build: receipt(), dir: ruledFile, files: logs([RULED, OTHER]), refuses: /lines differ.*in the log, not listed: WebPort\/Retail\/Permutation1 / },
  { name: 'a wrong sha refuses: the only file is another build\'s', build: receipt(), dir: { ['release-deviations-1071-05988eb8.json']: file([RULED]) }, files: logs(), refuses: /no deviations file release-deviations-<N>-7853dec0\.json/ },
  { name: 'a missing file refuses', build: receipt(), dir: {}, files: logs(), refuses: /no deviations file/ },
  { name: 'two files for one sha refuse', build: receipt(), dir: { ...ruledFile, ['release-deviations-1072-7853dec0.json']: file([RULED]) }, files: logs(), refuses: /more than one deviations file/ },
  { name: 'a listed step with no exact-line check refuses', build: receipt({ failed: ['solutions-gate', 'verify'] }), dir: { ['release-deviations-1071-7853dec0.json']: JSON.stringify([{ step: 'solutions-gate', lines: [RULED] }, { step: 'verify', lines: ['x'] }]) }, files: logs(), refuses: /no exact-line check for listed step verify/ },
  { name: 'a listed step that did not fail refuses', build: receipt({ passed: false, failed: ['verify'] }), dir: ruledFile, files: logs(), refuses: /failed steps not listed.*verify|lists steps that did not fail/ },
  { name: 'a gate that also failed for a subset with no program refuses', build: receipt(), dir: ruledFile, files: logs([RULED], { noProgram: 1 }), refuses: /subsets with no program/ },
  { name: 'a gate log that does not end on the missing-state exit refuses', build: receipt(), dir: ruledFile, files: logs([RULED], { close: false }), refuses: /does not end on its missing-state exit/ },
  { name: 'a blocked step refuses', build: receipt({ blocked: [{ name: 'direct-check' }] }), dir: ruledFile, files: logs(), refuses: /blocked steps are not deviations/ },
  { name: 'a receipt for another directory refuses', build: { ...receipt(), out: '/sites/elsewhere' }, dir: ruledFile, files: logs(), refuses: /another export directory/ },
  { name: 'a malformed entry refuses', build: receipt(), dir: { ['release-deviations-1071-7853dec0.json']: JSON.stringify([{ step: 'solutions-gate', lines: [RULED], note: 'x' }]) }, files: logs(), refuses: /each entry is \{step, lines\[\]\}/ },
];

// Runs one case through finishedReceipt with in-memory files; returns what the case expects to compare.
export function runCase(finishedReceipt, c) {
  const readText = (name) => {
    const base = name.replaceAll('\\', '/');
    for (const [key, text] of Object.entries(c.files)) if (key === base) return text;
    for (const [key, text] of Object.entries(c.dir)) if (base === DIR + '/' + key) return text;
    throw new Error('ENOENT ' + base);
  };
  return finishedReceipt({ build: c.build, site: SITE, dir: DIR, readText, list: () => Object.keys(c.dir) });
}
