// What the scripts that drive a headless browser share: the console noise
// a sandbox or a software renderer always produces, which means nothing
// (scripts/autopilot-check.mjs, the AI render tier), and a free port for a
// server of their own.

import { createServer } from 'node:net';

export const NOISE = [
  /WebSocket|wss:\/\/|relay|nostr/i,
  /api\.github\.com|github-contributions|rate limit|\b40[39]\b|\b429\b/i,
  /net::ERR_|Failed to load resource|ERR_NAME_NOT_RESOLVED|ERR_CONNECTION/i,
  /SwiftShader|software WebGL|GPU stall|GL Driver Message|Automatic fallback|WebGL: too many errors|WebGL: INVALID_(ENUM|VALUE|OPERATION)/i,
  /THREE\.WebGLRenderer: Context Lost|KHR_parallel_shader_compile/i,
  /AudioContext was not allowed|The AudioContext was not allowed to start/i,
  /\[vite\]|preload|Preload/i,
  // (a browser with no WebGPU says so, and the runtime draws on WebGL 2: src/runtime/backend.js)
  /WebGPU is experimental on this platform|Failed to create WebGPU Context Provider|WebGPU is not available/i,
];

export const noisy = (text) => NOISE.some((n) => n.test(text));

// A port nothing is listening on (the system's pick, given back at once).
export const freePort = () =>
  new Promise((res, fail) => {
    const s = createServer();
    s.once('error', fail);
    s.listen(0, '127.0.0.1', () => {
      const p = s.address().port;
      s.close(() => res(p));
    });
  });
