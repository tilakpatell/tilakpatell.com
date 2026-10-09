import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FADE, GAP, REST, WAIT, createSpeech } from './speech';

// A line the test can end: start() resolves to a handle like lib/clips' playFile's.
function line(log, name) {
  return async (alive) => {
    if (!alive()) return null;
    let end;
    const h = {
      name,
      stopped: false,
      length: 2,
      ended: new Promise((r) => (end = r)),
      stop() {
        h.stopped = true;
        end();
      },
      finish: () => end(),
    };
    log.push(h);
    return h;
  };
}
const tick = () => vi.advanceTimersByTimeAsync(0);

describe('one voice at a time', () => {
  let log;
  let input;
  let speech;
  beforeEach(() => {
    vi.useFakeTimers();
    log = [];
    input = false;
    speech = createSpeech({ now: () => Date.now(), recentInput: () => input });
  });
  afterEach(() => vi.useRealTimers());

  it('plays a line straight away when nobody is talking', async () => {
    const h = await speech.say('a', line(log, 'a'), { mode: 'queue' });
    expect(h.name).toBe('a');
    expect(speech.busy()).toBe(true);
  });

  it('lets a line the visitor asked for cut in, once the last has faded', async () => {
    const a = await speech.say('a', line(log, 'a'), { mode: 'queue' });
    const b = speech.say('b', line(log, 'b'), { mode: 'cut' });
    expect(a.stopped).toBe(true);
    await tick();
    expect(log.map((h) => h.name)).toEqual(['a']); // b waits out a's fade
    await vi.advanceTimersByTimeAsync(FADE);
    expect((await b).name).toBe('b');
  });

  it('keeps a line that comes by itself waiting until the one being said is done', async () => {
    const a = await speech.say('a', line(log, 'a'), { mode: 'queue' });
    const b = speech.say('b', line(log, 'b'), { mode: 'queue' });
    await vi.advanceTimersByTimeAsync(1000);
    expect(a.stopped).toBe(false);
    expect(log).toHaveLength(1);
    a.finish();
    await tick();
    expect(log).toHaveLength(1); // a breath between them
    await vi.advanceTimersByTimeAsync(GAP);
    expect((await b).name).toBe('b');
  });

  it('keeps only the newest of the lines waiting', async () => {
    const a = await speech.say('a', line(log, 'a'), { mode: 'queue' });
    const b = speech.say('b', line(log, 'b'), { mode: 'queue' });
    const c = speech.say('c', line(log, 'c'), { mode: 'queue' });
    await expect(b).resolves.toBeNull();
    a.finish();
    await vi.advanceTimersByTimeAsync(GAP);
    expect((await c).name).toBe('c');
    expect(log.map((h) => h.name)).toEqual(['a', 'c']);
  });

  it('drops a waiting line that has gone stale', async () => {
    const a = await speech.say('a', line(log, 'a'), { mode: 'queue' });
    const b = speech.say('b', line(log, 'b'), { mode: 'queue' });
    await vi.advanceTimersByTimeAsync(WAIT + 1);
    await expect(b).resolves.toBeNull();
    a.finish();
    await vi.advanceTimersByTimeAsync(GAP * 2);
    expect(log.map((h) => h.name)).toEqual(['a']);
  });

  it('says a passing remark only into a quiet that has lasted', async () => {
    const a = await speech.say('a', line(log, 'a'), { mode: 'queue' });
    await expect(speech.say('b', line(log, 'b'), { mode: 'ambient' })).resolves.toBeNull();
    a.finish();
    await tick();
    await expect(speech.say('c', line(log, 'c'), { mode: 'ambient' })).resolves.toBeNull();
    await vi.advanceTimersByTimeAsync(REST);
    expect((await speech.say('d', line(log, 'd'), { mode: 'ambient' })).name).toBe('d');
  });

  it('cuts in when the visitor has just pressed something, and waits otherwise', async () => {
    const a = await speech.say('a', line(log, 'a'));
    expect(speech.mode()).toBe('queue');
    speech.say('b', line(log, 'b'));
    expect(a.stopped).toBe(false);
    input = true;
    expect(speech.mode()).toBe('cut');
    speech.say('c', line(log, 'c'));
    expect(a.stopped).toBe(true);
  });

  it('says the same line once, however often it is asked for', async () => {
    const a = await speech.say('a', line(log, 'a'), { mode: 'queue' });
    expect(await speech.say('a', line(log, 'a'), { mode: 'cut' })).toBe(a);
    expect(a.stopped).toBe(false);
    expect(log).toHaveLength(1);
  });

  it('never starts a line that was overtaken while it loaded', async () => {
    let loaded;
    const slow = (alive) => new Promise((r) => (loaded = () => r(alive() ? line(log, 'slow')(alive) : null)));
    const a = speech.say('slow', slow, { mode: 'cut' });
    await tick();
    const b = speech.say('b', line(log, 'b'), { mode: 'cut' });
    loaded();
    await expect(a).resolves.toBeNull();
    await vi.advanceTimersByTimeAsync(FADE);
    expect((await b).name).toBe('b');
    expect(log.map((h) => h.name)).toEqual(['b']);
  });

  it('lets a line’s owner stop it, waiting or playing', async () => {
    const a = speech.say('a', line(log, 'a'), { mode: 'queue' });
    const b = speech.say('b', line(log, 'b'), { mode: 'queue' });
    b.stop();
    await expect(b).resolves.toBeNull();
    (await a) && a.stop();
    expect((await a).stopped).toBe(true);
    expect(speech.busy()).toBe(false);
  });

  it('stops only the lines of one kind when asked', async () => {
    const a = await speech.say('a', line(log, 'a'), { mode: 'queue', tag: 'comms' });
    speech.stop('voiced');
    expect(a.stopped).toBe(false);
    speech.stop('comms');
    expect(a.stopped).toBe(true);
  });

  it('leaves the lines that go on across pages, and stops the rest, on a new page', async () => {
    const a = await speech.say('a', line(log, 'a'), { mode: 'queue', keep: true });
    const b = speech.say('b', line(log, 'b'), { mode: 'queue' });
    speech.stopPage();
    await expect(b).resolves.toBeNull();
    expect(a.stopped).toBe(false);
  });

  it('says nothing while the voices are off', async () => {
    const quiet = createSpeech({ now: () => Date.now(), muted: () => true });
    await expect(quiet.say('a', line(log, 'a'))).resolves.toBeNull();
    expect(log).toHaveLength(0);
  });

  it('lets the next line go when one fails to load', async () => {
    await expect(speech.say('x', async () => null, { mode: 'queue' })).resolves.toBeNull();
    expect(speech.busy()).toBe(false);
    expect((await speech.say('a', line(log, 'a'), { mode: 'ambient' })).name).toBe('a');
  });
});
