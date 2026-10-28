// Tier 7, the workflows that hand the desktop's GPU out: a careless edit
// must not hand the self-hosted runner to a fork's pull request, a
// stranger's issue or a job with no end. Every job on [self-hosted, gpu]
// has a time limit, a concurrency group and a condition (or a trigger that
// can only be a person with write access); the queue and check jobs, and
// all of CI, stay on GitHub's own runners.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import { describe, expect, it } from 'vitest';
import { REPO } from '../contract/repo.mjs';

const DIR = join(REPO, '.github', 'workflows');
const FLOWS = Object.fromEntries(readdirSync(DIR).filter((f) => /\.ya?ml$/.test(f)).map((f) => [f, parse(readFileSync(join(DIR, f), 'utf8'))]));
const gpu = (job) => [job['runs-on']].flat().includes('gpu');
// the triggers only someone with write access to the repository can fire (repository_dispatch: a POST to the
// repository's dispatches endpoint, which takes a token with write access to it, as bf2-web's notify workflow holds)
const TRUSTED_ONLY = ['workflow_dispatch', 'schedule', 'repository_dispatch'];
const TRUSTED = /OWNER.*MEMBER.*COLLABORATOR|author_association/;

describe('the workflows that use the desktop’s GPU', () => {
  const jobs = Object.entries(FLOWS).flatMap(([f, w]) => Object.entries(w.jobs).filter(([, j]) => gpu(j)).map(([name, j]) => [`${f} ${name}`, j, w]));

  it('are the ones expected', () => {
    expect(jobs.map(([n]) => n).sort()).toEqual(['ai-health.yml gpu', 'bf2017-desktop.yml make', 'bf2017-desktop.yml stream', 'bf2web.yml build', 'desktop-doctor.yml doctor', 'gen3d.yml make', 'motion.yml make', 'voices.yml make']);
  });

  it.each(jobs)('%s runs only on the self-hosted gpu runner, with a time limit', (name, job) => {
    expect([job['runs-on']].flat()).toEqual(['self-hosted', 'gpu']);
    expect(job['timeout-minutes'], name).toBeGreaterThan(0);
    // (the longest a job is meant to take: voices' six hours, scripts/desktop/README.md)
    expect(job['timeout-minutes'], name).toBeLessThanOrEqual(360);
  });

  it.each(jobs)('%s runs one at a time, or only by hand', (name, job, w) => {
    const triggers = Object.keys(w.on ?? w[true] ?? {});
    if (triggers.every((t) => t === 'workflow_dispatch')) return; // a person, by hand
    expect(job.concurrency?.group, name).toBeTruthy();
  });

  it.each(jobs)('%s can only be started by someone trusted', (name, job, w) => {
    const triggers = Object.keys(w.on ?? w[true] ?? {});
    expect(triggers, name).not.toContain('pull_request');
    expect(triggers, name).not.toContain('pull_request_target');
    if (triggers.every((t) => TRUSTED_ONLY.includes(t))) return;
    // an issue event: the job's condition checks who opened it
    expect(String(job.if ?? ''), name).toMatch(TRUSTED);
  });
});

describe('the rest', () => {
  it('queue and check on GitHub’s own runners', () => {
    for (const f of ['gen3d.yml', 'voices.yml', 'motion.yml']) for (const name of ['queue', 'check']) expect(FLOWS[f].jobs[name]?.['runs-on'], `${f} ${name}`).toBe('ubuntu-latest');
  });
  it('and every job of CI, which runs on pull requests', () => {
    for (const [name, job] of Object.entries(FLOWS['ci.yml'].jobs)) expect(job['runs-on'], name).toBe('ubuntu-latest');
  });
  it('never run a pull request’s code on the desktop', () => {
    for (const [f, w] of Object.entries(FLOWS)) {
      const triggers = Object.keys(w.on ?? w[true] ?? {});
      if (triggers.includes('pull_request') || triggers.includes('pull_request_target')) for (const [name, job] of Object.entries(w.jobs)) expect(gpu(job), `${f} ${name}`).toBe(false);
    }
  });
});
