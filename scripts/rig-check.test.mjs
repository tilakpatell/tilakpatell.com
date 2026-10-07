import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { ROOT, checkFile, checkFiles, committed, loadAllow, readGltf, table } from './rig-check.mjs';

// a GLB of only its JSON chunk (what the check reads)
const glb = (json) => {
  let body = Buffer.from(JSON.stringify(json));
  body = Buffer.concat([body, Buffer.alloc((4 - (body.length % 4)) % 4, 0x20)]);
  const head = Buffer.alloc(20);
  head.writeUInt32LE(0x46546c67, 0);
  head.writeUInt32LE(2, 4);
  head.writeUInt32LE(20 + body.length, 8);
  head.writeUInt32LE(body.length, 12);
  head.writeUInt32LE(0x4e4f534a, 16);
  return Buffer.concat([head, body]);
};
const MESHY = ['Hips', 'Spine', 'Head', 'LeftArm', 'LeftForeArm', 'LeftHand', 'RightArm', 'RightForeArm', 'RightHand', 'LeftUpLeg', 'LeftLeg', 'LeftFoot', 'LeftToeBase', 'RightUpLeg', 'RightLeg', 'RightFoot', 'RightToeBase'];
// a skinned figure of these bones, with a clip moving `tracks` ([bone, path])
const figure = (names, tracks = []) => ({
  asset: { version: '2.0' },
  nodes: names.map((name, i) => ({ name, ...(i === 0 ? { translation: [0, 95, 0] } : {}) })),
  skins: [{ joints: names.map((_, i) => i) }],
  animations: tracks.length ? [{ name: 'walk', channels: tracks.map(([n, path]) => ({ target: { node: Math.max(0, names.indexOf(n)), path } })), samplers: [] }] : [],
});

const scratch = mkdtempSync(join(tmpdir(), 'rig-check-'));
afterAll(() => rmSync(scratch, { recursive: true, force: true }));
const run = (...args) => spawnSync(process.execPath, [join(ROOT, 'scripts/rig-check.mjs'), ...args], { cwd: ROOT, encoding: 'utf8' });

describe('the rig check', () => {
  it('every committed rig and clip passes --check', () => {
    const paths = committed();
    // the four sets the spec names, each there
    for (const re of [/games\/meshy\/rick-/, /games\/meshy\/clips-/, /games\/meshy\/ual-/, /models\/galaxy\/troops\//]) expect(paths.some((p) => re.test(p)), String(re)).toBe(true);
    const allow = loadAllow();
    for (const [p, why] of Object.entries(allow)) expect(typeof why === 'string' && why.length > 0, p).toBe(true);
    const rows = checkFiles(paths, { allow });
    const bad = rows.filter((r) => !r.ok && !r.allowed);
    expect(bad.map((r) => `${r.file}: ${r.failures.join('; ')}`)).toEqual([]);
    // and the CLI says so
    const cli = run('--check');
    expect(cli.status, cli.stdout + cli.stderr).toBe(0);
    expect(cli.stdout).toMatch(/troops\/stormtrooper\.glb\s+meshy\s+24\s+yes/);
  });

  it('fails a figure missing its toes, and a clip moving a bone the figure lacks', () => {
    const noToes = checkFile(figure(MESHY.filter((n) => !/ToeBase/.test(n))));
    expect(noToes.failures).toEqual(['missing toeL, toeR']);
    const tail = checkFile(figure(MESHY, [['Hips', 'translation'], ['Hips', 'rotation']]));
    expect(tail.failures).toEqual([]);
    expect(tail.clips[0].root).toBe('Hips');
    expect(tail.hips).toBe(95);
    const json = figure(MESHY, [['Hips', 'rotation']]);
    json.nodes.push({ name: 'Tail' });
    json.animations[0].channels.push({ target: { node: json.nodes.length - 1, path: 'rotation' } });
    expect(checkFile(json).failures).toEqual(['walk: 1 unresolved (Tail.quaternion)']);
  });

  it('checks a clip file against a figure of its family, and fails one with none', () => {
    const clip = { asset: { version: '2.0' }, nodes: [{ name: 'Hips', translation: [0, 90, 0] }, { name: 'Wing' }], animations: [{ name: 'flap', extras: { hips: 91.5 }, channels: [{ target: { node: 0, path: 'translation' } }, { target: { node: 1, path: 'rotation' } }], samplers: [] }] };
    const r = checkFile(clip, { figures: { meshy: MESHY } });
    expect(r.family).toBe('meshy');
    expect(r.hips).toBe(91.5); // (the bake's extras ahead of the node)
    expect(r.failures).toEqual(['flap: 1 unresolved (Wing.quaternion)']);
    expect(checkFile(clip).failures).toEqual(['flap: no meshy figure to play on']);
  });

  it('exits 1 under --check on a failure, unless the allow list gives its reason', () => {
    const bad = join(scratch, 'notoes.glb');
    writeFileSync(bad, glb(figure(MESHY.filter((n) => !/ToeBase/.test(n)))));
    expect(readGltf(glb({ asset: { version: '2.0' } })).asset.version).toBe('2.0');
    expect(run(bad).status).toBe(0); // (without --check, a report)
    const failed = run('--check', bad);
    expect(failed.status).toBe(1);
    expect(failed.stdout).toMatch(/FAIL: missing toeL, toeR/);
    const file = relative(ROOT, bad).split('\\').join('/');
    const [row] = checkFiles([file], { allow: { [file]: 'a test figure without toes' } });
    expect(row.allowed).toBe('a test figure without toes');
    expect(table([row])).toMatch(/allowed: a test figure without toes/);
  });
});
