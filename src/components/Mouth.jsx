import './mouth.css';

const INK = '#1b1424';

// A face's mouth that can talk: the drawn line (`d`) while it's shut, and a
// dark opening centred on (cx, cy), `rx` wide, that opens as --mouth goes
// from 0 to 1. --mouth is set on an element round the face (lib/mouth.js's
// useMouth); without it the mouth just stays shut, as it was drawn.
export default function Mouth({ d, cx, cy, rx = 6, stroke = INK, strokeWidth = 2, linecap = 'round' }) {
  return (
    <g>
      <path className="face-mouth-shut" d={d} fill="none" stroke={stroke} strokeWidth={strokeWidth} strokeLinecap={linecap} />
      <ellipse className="face-mouth-open" cx={cx} cy={cy + rx * 0.35} rx={rx} ry={rx * 0.8} fill="#3b1622" stroke={stroke} strokeWidth="1.6" />
    </g>
  );
}
