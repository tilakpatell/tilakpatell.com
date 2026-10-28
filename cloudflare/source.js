// A function the Worker sends as its source text, for the page or a service worker to run (playReturn.js's script,
// engineCache.js's worker). Wrangler bundles the Worker with esbuild's keepNames, which wraps a named inner function
// in __name(fn, 'name'), a helper of the bundle's own; sent as text, the function then calls a __name its new home
// hasn't got, and throws (2026-10-28: the engine page's script stopped after the way back's link, before the Quit,
// the failed round's box and the worker's registration, and the worker never evaluated). So the text runs with a
// stand-in that hands the function back, in a scope of its own.
//
//   sourceOf(code) → the code, run once in its own scope with __name stood in for

export const sourceOf = (code) => `(() => {\nconst __name = (f) => f;\n${code}\n})();\n`;
