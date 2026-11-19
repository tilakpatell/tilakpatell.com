import { useEconomy } from '../EconomyProvider';
import { headOf } from '../../hangar/hangarHead';

// The flight menu's Cargo tab: the money and the hold. The credits (one purse
// on both maps and in every world: economy.js), the level and how far to the
// next, what's been earned and spent and what for, and the hold, a slot a
// thing carried. The hold's goods come with the market (the ships, economy
// and exploration session's shipSheet: `hold` is its { used, room, goods });
// until then it's empty, and says so.

const HOLD = 12; // (the slots drawn while there's no sheet to say the room)
const n = (v) => (Number.isFinite(v) ? Math.round(v).toLocaleString('en-GB') : '0');

export default function CargoTab({ hold = null }) {
  const { economy } = useEconomy();
  const r = economy?.record?.() ?? null;
  const head = headOf(r);
  const goods = hold?.goods ?? [];
  const room = hold?.room ?? HOLD;
  const empty = Math.max(0, Math.min(room, 48) - goods.length);
  const stats = [
    ['Earned', `${n(r?.earned)} cr`],
    ['Spent', `${n(r?.spent)} cr`],
    ['Kills', n(r?.kills)],
    ['Rescues', n(r?.rescues)],
    ['Battles won', n(r?.wins)],
    ['Jobs done', n(r?.quests)],
  ];
  return (
    <div className="fm-cargo">
      <section className="fm-money" aria-label="Credits">
        <p className="fm-h">Credits</p>
        <p className="fm-big">{n(head.credits)}</p>
        <p className="fm-sub">
          Level {head.level} · {head.title}
        </p>
        <span className="fm-bar" role="img" aria-label={`${Math.round(head.toNext * 100)}% of the way to the next level`}>
          <span style={{ '--v': head.toNext }} />
        </span>
        <dl className="fm-stats">
          {stats.map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
      </section>
      <section className="fm-hold" aria-label="The hold">
        <div className="fm-hold-head">
          <h3 className="fm-h">The hold</h3>
          <span className="fm-muted">{hold ? `${n(hold.used)} of ${n(room)} room` : 'Empty'}</span>
        </div>
        <div className="fm-hold-grid">
          {goods.map((g) => (
            <div key={g.id} className="fm-slot" title={`${g.name}: ${g.n}, worth ${n(g.value)} credits`}>
              <span className="fm-slot-key">×{g.n}</span>
              <span className="fm-slot-name">{g.name}</span>
            </div>
          ))}
          {Array.from({ length: empty }, (_, i) => (
            <div key={`e${i}`} className="fm-slot" data-empty="" aria-hidden="true" />
          ))}
        </div>
        {!goods.length && <p className="fm-text fm-muted">Nothing in the hold. What you pick up and buy to trade is kept here.</p>}
      </section>
    </div>
  );
}
