import { describe, expect, it, vi } from 'vitest';
import { createProbeEnv, faceUrl } from './probeEnv';

function fakes() {
  const made = [];
  const cube = () => ({ dispose: vi.fn() });
  const pmrem = { fromCubemap: vi.fn(() => { const t = { dispose: vi.fn() }; made.push(t); return { texture: t }; }), dispose: vi.fn() };
  let release = [];
  const load = vi.fn(() => new Promise((res) => release.push(() => res(cube()))));
  const go = () => { const r = release; release = []; r.forEach((f) => f()); };
  return { made, pmrem, load, go };
}

describe('the probe as the environment', () => {
  it('gives an environment and disposes the last on the next', async () => {
    const f = fakes();
    const probes = createProbeEnv({ load: f.load, pmrem: f.pmrem });
    const a = probes.load(['a']); f.go(); const envA = await a;
    expect(envA).toBe(f.made[0]);
    const b = probes.load(['b']); f.go(); const envB = await b;
    expect(envB).toBe(f.made[1]);
    expect(f.made[0].dispose).toHaveBeenCalledTimes(1);
    expect(f.made[1].dispose).not.toHaveBeenCalled();
    probes.dispose();
    expect(f.made[1].dispose).toHaveBeenCalledTimes(1);
    expect(f.pmrem.dispose).toHaveBeenCalledTimes(1);
  });

  it('never keeps two alive when loads cross', async () => {
    const f = fakes();
    const probes = createProbeEnv({ load: f.load, pmrem: f.pmrem });
    const a = probes.load(['a']);
    const b = probes.load(['b']);
    f.go();
    expect(await a).toBeNull();
    expect(await b).toBe(f.made[1]);
    expect(f.made[0].dispose).toHaveBeenCalledTimes(1);
    expect(probes.current()).toBe(f.made[1]);
  });

  it('reuses the one it has for the same probe', async () => {
    const f = fakes();
    const probes = createProbeEnv({ load: f.load, pmrem: f.pmrem });
    const a = probes.load(['a']); f.go(); await a;
    expect(await probes.load(['a'])).toBe(f.made[0]);
    expect(f.load).toHaveBeenCalledTimes(1);
  });
});

describe('a probe asked for again while another is on its way', () => {
  it('keeps the one asked for last, throwing the late one away', async () => {
    const f = fakes();
    const probes = createProbeEnv({ load: f.load, pmrem: f.pmrem });
    const a = probes.load(['out']);
    f.go();
    await a;
    // in (still loading), then straight back out (the one it has)
    const inside = probes.load(['in']);
    expect(await probes.load(['out'])).toBe(f.made[0]);
    f.go();
    expect(await inside).toBeNull();
    expect(probes.current()).toBe(f.made[0]);
    expect(f.made[1].dispose).toHaveBeenCalledTimes(1);
  });
});

describe('faceUrl', () => {
  const answer = (status, type) => async () => ({ ok: status < 400, status, headers: new Headers({ 'content-type': type }), arrayBuffer: async () => new ArrayBuffer(4) });
  it('gives a face’s bytes as a URL the loader reads', async () => {
    expect(await faceUrl('/probes/a.px.hdr', answer(200, 'application/octet-stream'))).toMatch(/^blob:/);
  });
  it('fails on a 404 and on a page in a face’s place, a load that failed rather than a bad HDR', async () => {
    await expect(faceUrl('/probes/a.px.hdr', answer(404, 'text/plain'))).rejects.toThrow(/404/);
    await expect(faceUrl('/probes/a.px.hdr', answer(200, 'text/html'))).rejects.toThrow(/page/);
  });
});
