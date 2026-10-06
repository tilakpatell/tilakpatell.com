// The crews' own voices for the lines nobody recorded: made on the owner's
// machine by scripts/voices (its README says how) from the clips the site
// already has, and kept out of the repository, so they're only heard where
// that folder was generated (npm run dev) or is served from behind the
// sign-in (VITE_VOICED_BASE). Anywhere else the manifest isn't there and the
// comms keep the blips in universe/sounds.js.

const BASE = (import.meta.env?.VITE_VOICED_BASE || '/audio/voiced').replace(/\/$/, '');

// A line's id: FNV-1a of who says it and what they say, so the same words
// from the same mouth find the same file wherever they appear (and an edited
// line gets a new one). scripts/voices/export-lines.mjs uses this too.
export function lineId(who, text) {
  let h = 0x811c9dc5;
  const s = `${who}|${text}`;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

let manifest = null;
function load() {
  if (!manifest)
    manifest = fetch(`${BASE}/manifest.json`)
      .then((r) => (r.ok ? r.json() : null))
      .then((m) => (m && typeof m.lines === 'object' ? m.lines : {}))
      .catch(() => ({})); // not generated here (or not signed in): the blips it is
  return manifest;
}

// Start fetching the manifest, so the first line isn't kept waiting for it.
export const preloadVoiced = () => {
  load();
};

// Where a line's generated recording is, or null if it has none.
export async function voicedSrc(who, text) {
  const lines = await load();
  const file = lines[lineId(who, text)];
  return typeof file === 'string' ? `${BASE}/${file}` : null;
}
