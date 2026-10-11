// The receiver’s input put into a native window on Windows, for lane R2’s
// second source (the game’s own window): one PowerShell process holding
// user32’s SendInput, fed a line an event. Keys go as scan codes (games read
// the hardware’s codes through raw input, not the characters), the mouse as
// relative moves (a game’s camera) and buttons, the wheel in notches. It
// types into whatever window has the focus: the game, brought to the front
// by the owner. No package: PowerShell and user32 ship with Windows.
//
// SCAN[code] → [scan code, extended]; injectLine(e) → 'K 17 0 1' | 'M dx dy'
//   | 'B left 1' | 'W 120' | null; startInjector() → { send(e), stop() } | null
//   (null off Windows)
import { spawn } from 'node:child_process';

// KeyboardEvent.code → the set-1 scan code and whether it is an extended key
export const SCAN = {
  Escape: [0x01, 0], Digit1: [0x02, 0], Digit2: [0x03, 0], Digit3: [0x04, 0], Digit4: [0x05, 0], Digit5: [0x06, 0],
  Digit6: [0x07, 0], Digit7: [0x08, 0], Digit8: [0x09, 0], Digit9: [0x0a, 0], Digit0: [0x0b, 0], Minus: [0x0c, 0],
  Equal: [0x0d, 0], Backspace: [0x0e, 0], Tab: [0x0f, 0], KeyQ: [0x10, 0], KeyW: [0x11, 0], KeyE: [0x12, 0],
  KeyR: [0x13, 0], KeyT: [0x14, 0], KeyY: [0x15, 0], KeyU: [0x16, 0], KeyI: [0x17, 0], KeyO: [0x18, 0],
  KeyP: [0x19, 0], BracketLeft: [0x1a, 0], BracketRight: [0x1b, 0], Enter: [0x1c, 0], ControlLeft: [0x1d, 0],
  KeyA: [0x1e, 0], KeyS: [0x1f, 0], KeyD: [0x20, 0], KeyF: [0x21, 0], KeyG: [0x22, 0], KeyH: [0x23, 0],
  KeyJ: [0x24, 0], KeyK: [0x25, 0], KeyL: [0x26, 0], Semicolon: [0x27, 0], Quote: [0x28, 0], Backquote: [0x29, 0],
  ShiftLeft: [0x2a, 0], Backslash: [0x2b, 0], KeyZ: [0x2c, 0], KeyX: [0x2d, 0], KeyC: [0x2e, 0], KeyV: [0x2f, 0],
  KeyB: [0x30, 0], KeyN: [0x31, 0], KeyM: [0x32, 0], Comma: [0x33, 0], Period: [0x34, 0], Slash: [0x35, 0],
  ShiftRight: [0x36, 0], AltLeft: [0x38, 0], Space: [0x39, 0], CapsLock: [0x3a, 0],
  F1: [0x3b, 0], F2: [0x3c, 0], F3: [0x3d, 0], F4: [0x3e, 0], F5: [0x3f, 0], F6: [0x40, 0], F7: [0x41, 0],
  F8: [0x42, 0], F9: [0x43, 0], F10: [0x44, 0], F11: [0x57, 0], F12: [0x58, 0],
  ControlRight: [0x1d, 1], AltRight: [0x38, 1], Home: [0x47, 1], ArrowUp: [0x48, 1], PageUp: [0x49, 1],
  ArrowLeft: [0x4b, 1], ArrowRight: [0x4d, 1], End: [0x4f, 1], ArrowDown: [0x50, 1], PageDown: [0x51, 1],
  Insert: [0x52, 1], Delete: [0x53, 1],
};

const BUTTONS = ['left', 'middle', 'right'];

export function injectLine(e) {
  if (e.t === 'key') {
    const sc = SCAN[e.code];
    return sc ? `K ${sc[0]} ${sc[1]} ${e.down ? 1 : 0}` : null;
  }
  if (e.t !== 'pointer') return null;
  if (e.kind === 'move') return e.dx || e.dy ? `M ${e.dx ?? 0} ${e.dy ?? 0}` : null;
  if (e.kind === 'wheel') return `W ${Math.round(-(e.dy ?? 0))}`;
  return `B ${BUTTONS[e.button] ?? 'left'} ${e.kind === 'down' ? 1 : 0}`;
}

// INPUT is 40 bytes on 64-bit Windows: type (4), padding (4), then the union
// (MOUSEINPUT is the largest, 32); KEYBDINPUT and MOUSEINPUT are laid over it
export const INJECT_PS = `
$ErrorActionPreference = 'Stop'
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class Inj {
  [StructLayout(LayoutKind.Explicit, Size = 40)]
  struct INPUT {
    [FieldOffset(0)] public uint type;
    [FieldOffset(8)] public int dx;
    [FieldOffset(12)] public int dy;
    [FieldOffset(16)] public uint mouseData;
    [FieldOffset(20)] public uint mflags;
    [FieldOffset(8)] public ushort vk;
    [FieldOffset(10)] public ushort scan;
    [FieldOffset(12)] public uint kflags;
  }
  [DllImport("user32.dll", SetLastError = true)]
  static extern uint SendInput(uint n, INPUT[] inputs, int size);
  static void One(INPUT i) { SendInput(1, new[] { i }, Marshal.SizeOf(typeof(INPUT))); }
  public static void Key(ushort scan, bool ext, bool down) {
    var i = new INPUT(); i.type = 1; i.scan = scan;
    i.kflags = 0x0008u | (ext ? 0x0001u : 0) | (down ? 0 : 0x0002u); One(i);
  }
  public static void Move(int dx, int dy) { var i = new INPUT(); i.type = 0; i.dx = dx; i.dy = dy; i.mflags = 0x0001; One(i); }
  public static void Button(string b, bool down) {
    uint f = b == "right" ? (down ? 0x0008u : 0x0010u) : b == "middle" ? (down ? 0x0020u : 0x0040u) : (down ? 0x0002u : 0x0004u);
    var i = new INPUT(); i.type = 0; i.mflags = f; One(i);
  }
  public static void Wheel(int d) { var i = new INPUT(); i.type = 0; i.mouseData = unchecked((uint)d); i.mflags = 0x0800; One(i); }
}
'@
while ($null -ne ($line = [Console]::In.ReadLine())) {
  $p = $line.Split(' ')
  switch ($p[0]) {
    'K' { [Inj]::Key([uint16]$p[1], $p[2] -eq '1', $p[3] -eq '1') }
    'M' { [Inj]::Move([int]$p[1], [int]$p[2]) }
    'B' { [Inj]::Button($p[1], $p[2] -eq '1') }
    'W' { [Inj]::Wheel([int]$p[1]) }
  }
}
`;

export function startInjector({ platform = process.platform, log = console.log } = {}) {
  if (platform !== 'win32') return null;
  const ps = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', '-'], { stdio: ['pipe', 'ignore', 'pipe'] });
  ps.stderr.on('data', (d) => log(`injector: ${String(d).trim().slice(0, 200)}`));
  ps.stdin.write(`${INJECT_PS}\n`);
  return {
    send(e) {
      const line = injectLine(e);
      if (line) ps.stdin.write(`${line}\n`);
      return Boolean(line);
    },
    stop() {
      ps.stdin.end();
      ps.kill();
    },
  };
}
