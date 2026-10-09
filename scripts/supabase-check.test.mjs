import { describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { parseEnv, projectFrom } from './supabase-check.mjs';

const SCRIPT = fileURLToPath(new URL('./supabase-check.mjs', import.meta.url));

describe('the Supabase check', () => {
  it('reads an env file as Vite does', () => {
    const env = parseEnv('# a comment\nVITE_SUPABASE_URL="https://x.supabase.co"\n\nVITE_SUPABASE_ANON_KEY = k\nOTHER=1');
    expect(env).toEqual({ VITE_SUPABASE_URL: 'https://x.supabase.co', VITE_SUPABASE_ANON_KEY: 'k', OTHER: '1' });
  });

  it('wants both names, and takes nothing from any other', () => {
    expect(projectFrom(null, { VITE_SUPABASE_URL: 'u' })).toBeNull();
    expect(projectFrom(null, { VITE_SUPABASE_URL: 'u', SUPABASE_KEY: 'k' })).toBeNull();
    expect(projectFrom(null, { VITE_SUPABASE_URL: 'u', VITE_SUPABASE_ANON_KEY: 'k' })).toEqual({ url: 'u', key: 'k' });
  });

  it('without a project, says what to set and exits 2', () => {
    const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => !k.startsWith('VITE_SUPABASE')));
    const run = spawnSync(process.execPath, [SCRIPT, '--env', '/nonexistent/.env.local'], { env, encoding: 'utf8' });
    expect(run.status).toBe(2);
    expect(run.stdout.trim()).toBe('no project linked: set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local');
  });
});
