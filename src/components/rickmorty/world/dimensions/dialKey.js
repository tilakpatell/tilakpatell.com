// What a key does at the portal gun's dial (./DimensionDial.jsx): 'down' or
// 'up' moves it a row, 'pick' dials the row it's on, 'close' puts the gun
// down, 'ignore' is the dial's key but does nothing, and null isn't the
// dial's at all (it's left to the page). A pick or a close is a press, not a
// key held down: E or Enter held from opening it would otherwise pick the row
// it opened on. The arrows repeat.
export function dialKey(e) {
  if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') return 'down';
  if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') return 'up';
  if (e.key === 'Enter' || e.key === 'e' || e.key === 'E') return e.repeat ? 'ignore' : 'pick';
  if (e.key === 'Escape') return e.repeat ? 'ignore' : 'close';
  return null;
}

// …and a controller's presses there (../../games/pad.js's readings, this
// frame's and the last), as the keys they stand for: the d-pad or the stick
// turns it, A sets it, B puts the gun down (RmWorld hands them to the dial)
const STICK = 0.5;
export function dialPad(now, before) {
  if (!now) return [];
  const was = before ?? {};
  const out = [];
  if ((now.down && !was.down) || (now.ly > STICK && !(was.ly > STICK))) out.push('ArrowDown');
  if ((now.up && !was.up) || (now.ly < -STICK && !(was.ly < -STICK))) out.push('ArrowUp');
  if (now.a && !was.a) out.push('Enter');
  if (now.b && !was.b) out.push('Escape');
  return out;
}

// …and on a touch screen, with none of these keys, what the dial's foot says
// in their place (RmHud passes it there; a keyboard keeps the dial's own, or
// Rick's rooms'): a tap picks a row, the × at the top puts it away
export const TOUCH_FOOT = { gun: 'Tap a place to set the dial, or × to put the gun down', rooms: 'Tap one to pick it, or × to back out' };
