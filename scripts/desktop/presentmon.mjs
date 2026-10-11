// The game’s own frame time on the desktop, for lane R2’s second source:
// Intel’s PresentMon (a free command-line tool the owner installs; its path
// in PRESENTMON) records every frame a process presents to a CSV, and this
// sums it. Nothing is read from the game but the times its frames reach the
// screen.
//
// frameTimes(csv) → { n, p50, p95, fps } | null  (PresentMon 1.x’s
//   MsBetweenPresents or 2.x’s FrameTime column)
// startPresentMon({ exe, process, out }) → { stop() } | null
import { spawn } from 'node:child_process';

const pct = (xs, p) => xs[Math.min(xs.length - 1, Math.max(0, Math.ceil(p * xs.length) - 1))];
const round = (n) => Math.round(n * 10) / 10;

export function frameTimes(csv) {
  const rows = String(csv ?? '').trim().split(/\r?\n/);
  if (rows.length < 2) return null;
  const head = rows[0].split(',').map((h) => h.trim());
  const col = head.findIndex((h) => h === 'MsBetweenPresents' || h === 'FrameTime');
  if (col < 0) return null;
  const ms = rows
    .slice(1)
    .map((r) => Number(r.split(',')[col]))
    .filter((v) => Number.isFinite(v) && v > 0)
    .sort((a, b) => a - b);
  if (!ms.length) return null;
  const mean = ms.reduce((a, b) => a + b, 0) / ms.length;
  return { n: ms.length, p50: round(pct(ms, 0.5)), p95: round(pct(ms, 0.95)), fps: round(1000 / mean) };
}

export function startPresentMon({ exe = process.env.PRESENTMON, process: name, out }) {
  if (!exe || !name) return null;
  const pm = spawn(exe, ['--process_name', name, '--output_file', out, '--terminate_on_proc_exit', '--stop_existing_session'], { stdio: 'ignore' });
  return { stop: () => pm.kill() };
}
