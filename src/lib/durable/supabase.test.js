import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// supabase.js keeps the one client it made for the page; a fresh module per
// test keeps one test's client out of the next. The env is stubbed empty, so
// a machine with a .env.local tests the same as CI
let client;
let signIn;
beforeEach(async () => {
  vi.stubEnv('VITE_SUPABASE_URL', '');
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', '');
  vi.resetModules();
  ({ client, signIn } = await import('./supabase'));
});
afterEach(() => vi.unstubAllEnvs());

describe('the durable client', () => {
  it('is null without a URL or a key, and makes nothing', () => {
    const make = vi.fn();
    expect(client({ url: '', key: 'k', make })).toBeNull();
    expect(client({ url: 'https://x.supabase.co', key: undefined, make })).toBeNull();
    expect(make).not.toHaveBeenCalled();
  });

  it('is null in a build with no environment', () => {
    expect(client({ make: vi.fn() })).toBeNull();
  });

  it('is made once a page, keeping its session', () => {
    const made = { tag: 'client' };
    const make = vi.fn(() => made);
    expect(client({ url: 'https://x.supabase.co', key: 'k', make })).toBe(made);
    expect(client({ url: 'https://x.supabase.co', key: 'k', make })).toBe(made);
    expect(make).toHaveBeenCalledTimes(1);
    expect(make).toHaveBeenCalledWith('https://x.supabase.co', 'k', { auth: { persistSession: true } });
  });
});

describe('signing in', () => {
  const fake = (session) => ({
    auth: {
      getSession: vi.fn(async () => ({ data: { session }, error: null })),
      signInAnonymously: vi.fn(async () => ({ data: { user: { id: 'new' } }, error: null })),
    },
  });

  it('keeps the session it has', async () => {
    const c = fake({ user: { id: 'kept' } });
    expect(await signIn(c)).toBe('kept');
    expect(c.auth.signInAnonymously).not.toHaveBeenCalled();
  });

  it('signs in anonymously when there is none', async () => {
    const c = fake(null);
    expect(await signIn(c)).toBe('new');
    expect(c.auth.signInAnonymously).toHaveBeenCalledTimes(1);
  });

  it('answers null without a client, or when the sign-in is refused', async () => {
    expect(await signIn(null)).toBeNull();
    const c = fake(null);
    c.auth.signInAnonymously.mockResolvedValue({ data: { user: null }, error: { message: 'anonymous sign-ins are disabled' } });
    expect(await signIn(c)).toBeNull();
  });
});
