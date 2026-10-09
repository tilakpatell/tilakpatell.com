// The one Supabase client a page holds, or null. The URL and the public anon
// key come from the build's environment only (.env.local here, the
// repository's secrets in deploy.yml): a fork, a local run or CI has neither,
// and then there is no durable layer and the game plays without it. Nothing
// is read from localStorage but the client's own session, so a visitor keeps
// the anonymous id their builds are owned by across visits.
// Design: docs/superpowers/specs/2026-10-09-planet-flight-and-shared-world-design.md (Pillar 2).
//
// client({ url, key, make }) → SupabaseClient | null (made once, kept)
// signIn(client) → Promise<userId | null>: the session it has, else an anonymous one
import { createClient } from '@supabase/supabase-js';

let made = null;

export function client({
  url = import.meta.env.VITE_SUPABASE_URL,
  key = import.meta.env.VITE_SUPABASE_ANON_KEY,
  make = createClient,
} = {}) {
  if (!url || !key) return null;
  // one a page: two clients would hold two sessions and race to refresh them
  made ??= make(url, key, { auth: { persistSession: true } });
  return made;
}

export async function signIn(c) {
  if (!c) return null;
  const { data } = await c.auth.getSession();
  if (data?.session?.user?.id) return data.session.user.id;
  // refused (anonymous sign-ins off in the project): reading still works,
  // building does not, and the caller says so
  const { data: signed, error } = await c.auth.signInAnonymously();
  return error ? null : (signed?.user?.id ?? null);
}
