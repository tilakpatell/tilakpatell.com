import { describe, expect, it } from 'vitest';
import { createJobs } from './jobPlay';
import { siteOf } from './sites/index';
import { seeded } from '../../../lib/seeded';

const make = (o = {}) => {
  const site = siteOf('tatooine');
  const heard = [];
  const jobs = createJobs({ site, on: true, home: site.land.at, ok: () => true, emit: (e) => heard.push(e), rand: seeded(5), ...o });
  return { site, jobs, heard };
};

describe('the job board the scene keeps', () => {
  it('makes its first board once, on your feet, and tells the page', () => {
    const { site, jobs, heard } = make();
    jobs.ready(site.land.at);
    jobs.ready(site.land.at);
    expect(heard.length).toBe(1);
    expect(heard[0].type).toBe('jobs');
    expect(heard[0].list.length).toBe(3);
    expect(heard[0].list[0]).toEqual({ id: jobs.list[0].id, job: jobs.list[0].job, name: jobs.list[0].name, about: jobs.list[0].about, pay: jobs.list[0].pay });
    expect(jobs.of(jobs.list[1].id)).toBe(jobs.list[1]);
    expect(jobs.of('nope')).toBeNull();
  });

  it('puts up a new board, of new jobs, once one’s done; nothing for a quest of the world’s own', () => {
    const { site, jobs, heard } = make();
    jobs.ready(site.land.at);
    const was = jobs.list.map((j) => j.id);
    jobs.done({ id: 'kraytcall' }, site.land.at);
    expect(heard.length).toBe(1);
    jobs.done(jobs.list[0], site.land.at);
    expect(heard.length).toBe(2);
    expect(jobs.list.some((j) => was.includes(j.id))).toBe(false);
  });

  it('has nothing where there’s no work', () => {
    const { site, jobs, heard } = make({ on: false });
    jobs.ready(site.land.at);
    expect(heard).toEqual([]);
    expect(jobs.list).toEqual([]);
  });
});
