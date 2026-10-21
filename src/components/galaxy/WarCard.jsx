import { Link } from 'react-router-dom';
import { RiSwordFill } from 'react-icons/ri';
import Emblem from './Emblem';
import { SIDES, WARS } from './sides';
import { ago, areaLines, battleLine, campaignLine, feedOf, newsLine, nextOpLine, oathOf, orderAim, orderLeft, orderLine, partLine, recordLine, resultLine, standing, whose } from './warText';
import { nearestBattle } from './warMap';
import { templateFor } from './battles';
import { groundBattle } from './gameLevels';
import { jumpSeconds, systemById } from './systems';

// The galaxy's wars on the holotable (HoloMap.jsx) and the panel
// (GalaxyPanel.jsx). On the holotable, the war card for the war the map
// shows: the oath to one of its two sides (the one sworn pressed, the one
// your crew or hero would pick outlined) and your rank, record and part in
// it, and a way to fight in it if it isn't your war already; then its phase
// and the next offensive, the campaign's result once it's in (or the one
// before's, early in the next), each side's order and its deadline (one card
// where both name the same system), the nearest battle to join, the latest of
// what's happened (what's new since you last looked marked; the rest folded
// away), and, folded under 'The war in full', the battles on now and who holds
// each area. And, for one system, its place in the war with the battle on
// there and the ground battle to fight it on. The words are warText.js's; the
// page keeps the oath (allegiance.js).

const FEED_SHOWN = 3; // (what's happened, the latest: the rest under a fold)

// the oath to a side of a war, for both
export function Oath({ oath, suggested, record, onSwear }) {
  const card = oathOf(oath.war, oath, suggested);
  const rec = recordLine(oath.side, record);
  return (
    <div className="galaxy-oath">
      <div className="galaxy-oath-sides" role="group" aria-label={`Swear to a side of ${WARS[oath.war].name}`}>
        {card.sides.map((s) => (
          <button key={s.id} type="button" aria-pressed={s.sworn} data-suggested={s.suggested && !oath.side ? '' : undefined} style={{ '--side': s.colour }} onClick={() => onSwear?.(s.id)}>
            {s.sworn ? `Sworn to the ${s.name}` : `Fly for the ${s.name}`}
          </button>
        ))}
      </div>
      <p className="galaxy-oath-n">{oath.side ? `${rec}${oath.turncoat ? ' · a turncoat' : ''}` : 'Sworn to nobody: in a battle, nobody’s sights are on you, and nothing you do counts.'}</p>
    </div>
  );
}

// what's pushing at a system, and how far it's got (for an order's bar)
function pushOf(row, liberator) {
  const by = row.attack ? row.attack.by : row.front && row.owner !== liberator ? liberator : null;
  return { '--held': SIDES[row.owner].colour, '--by': SIDES[by ?? row.owner].colour, '--take': by ? 1 - row.control : 0 };
}

export default function WarCard({ table, now, oath, viewOath, suggested, record, seen, onSwear, onTheatre, onPick, onGo, current }) {
  const byId = Object.fromEntries(table.systems.map((r) => [r.id, r]));
  const battles = table.systems.filter((r) => r.battle).sort((a, b) => (b.major ? 1 : 0) - (a.major ? 1 : 0) || (a.attack ? -1 : 0) - (b.attack ? -1 : 0));
  const w = WARS[table.war];
  const yours = table.war === oath.war;
  const side = viewOath.side;
  const result = resultLine(table);
  // (who leads in the last step, who won once it's over, or the campaign before's at the start of the next)
  const outcome = table.result ?? table.previous ?? null;
  const next = nextOpLine(table, now);
  const part = partLine(record);
  const near = yours ? nearestBattle(table, current, side) : null;
  const feed = feedOf(table.events);
  const fresh = seen == null ? 0 : feed.filter((e) => e.at > seen).length;
  // each side's order, and whether the two name one system (their card one, its bar and its standing once)
  const orders = [w.liberator, w.raider].flatMap((s) => {
    const o = table.orders?.[s];
    return o && byId[o.sys] ? [{ s, o, row: byId[o.sys] }] : [];
  });
  const shared = orders.length === 2 && orders[0].o.sys === orders[1].o.sys;
  const sameTime = shared && Math.abs(orders[0].o.until - orders[1].o.until) < 60e3;
  const news = (e) => {
    const line = (
      <>
        <span>{newsLine(e)}</span>
        <time dateTime={new Date(e.at).toISOString()}>{ago(now - e.at)}</time>
      </>
    );
    return (
      <li key={`${e.k}:${e.type}:${e.sys ?? e.area ?? e.phase}`} data-new={(seen != null && e.at > seen) || undefined} style={{ '--side': SIDES[e.by]?.colour }}>
        {e.sys && byId[e.sys] ? (
          <button type="button" onClick={() => onPick(e.sys)}>
            {line}
          </button>
        ) : (
          <p>{line}</p>
        )}
      </li>
    );
  };
  return (
    <section className="holomap-warcard" aria-label={w.name}>
      <Oath oath={viewOath} suggested={yours ? suggested : null} record={record} onSwear={onSwear} />
      {part && <p className="holomap-part">{part}</p>}
      {!yours && (
        <div className="holomap-theatre">
          <p>You fight in {WARS[oath.war].name}; this map’s just for looking.</p>
          <button type="button" className="btn btn-ghost" onClick={() => onTheatre?.(table.war)}>
            Fight in this war
          </button>
        </div>
      )}

      <div className="holomap-campaign">
        <p className="holomap-kicker">
          {w.name} · campaign {table.campaign + 1}
        </p>
        <p className="holomap-campaign-n">{campaignLine(table, now)}</p>
        {next && <p className="holomap-campaign-next">{next}</p>}
      </div>
      {result && (
        <div className="holomap-result" role="status" data-previous={!table.result || undefined} style={{ '--side': SIDES[outcome.winner].colour }}>
          <Emblem side={outcome.winner} />
          <p>{result}</p>
        </div>
      )}

      {shared && (
        <ul className="holomap-orders" aria-label="Each side’s order">
          <li data-yours={orders.some((x) => x.s === side) || undefined}>
            <button type="button" className="holomap-order" onClick={() => onPick(orders[0].row.id)} style={pushOf(orders[0].row, w.liberator)}>
              <span className="holomap-order-k">{orders[0].row.major ? '★ Both sides’ major order' : 'Both sides’ order'}</span>
              {orders.map(({ s, o }) => (
                <span key={s} className="holomap-order-t holomap-order-side" data-yours={s === side || undefined} style={{ '--side': SIDES[s].colour }}>
                  <Emblem side={s} />
                  <span className="sr-only">{s === side ? 'Your order' : `${whose(s)} order`}: </span>
                  {sameTime ? orderAim(o) : orderLine(o, now)}
                </span>
              ))}
              {sameTime && <span className="holomap-order-n">{orderLeft(orders[0].o, now)}</span>}
              <span className="holomap-order-bar" aria-hidden="true">
                <span />
              </span>
              <span className="holomap-order-n">{standing(orders[0].row, now)}</span>
            </button>
          </li>
        </ul>
      )}
      {!shared && orders.length > 0 && (
        <ul className="holomap-orders" aria-label="Each side’s order">
          {orders.map(({ s, o, row }) => (
            <li key={s} data-yours={s === side || undefined}>
              <button type="button" className="holomap-order" onClick={() => onPick(row.id)} style={pushOf(row, w.liberator)}>
                <span className="holomap-order-k" style={{ '--side': SIDES[s].colour }}>
                  <Emblem side={s} /> {s === side ? 'Your order' : `${whose(s)} order`}
                  {row.major && ' · ★ major order'}
                </span>
                <span className="holomap-order-t">{orderLine(o, now)}</span>
                <span className="holomap-order-bar" aria-hidden="true">
                  <span />
                </span>
                <span className="holomap-order-n">{standing(row, now)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {near && (
        <button type="button" className="btn btn-primary holomap-join" onClick={() => onGo(near.id)}>
          <RiSwordFill className="h-4 w-4" aria-hidden="true" />
          <span>
            {near.id === current ? 'Join the battle here' : 'Join the nearest battle'}
            <small>
              {templateFor(near.id, table.war).name}
              {near.id === current ? '' : ` · a ${near.seconds.toFixed(1)} s jump`}
            </small>
          </span>
        </button>
      )}

      {feed.length > 0 && (
        <section className="holomap-feed" aria-label="What’s happened">
          <p className="holomap-kicker">
            What’s happened{fresh > 0 && <span className="holomap-new">{fresh} new since you last looked</span>}
          </p>
          <ol aria-live="polite" aria-relevant="additions">
            {feed.slice(0, FEED_SHOWN).map(news)}
          </ol>
          {feed.length > FEED_SHOWN && (
            <details className="holomap-fold">
              <summary>{feed.length - FEED_SHOWN} earlier</summary>
              <ol>{feed.slice(FEED_SHOWN).map(news)}</ol>
            </details>
          )}
        </section>
      )}

      <details className="holomap-fold holomap-full">
        <summary>The war in full</summary>
        {battles.length > 0 && (
          <ul className="holomap-battles" aria-label="The battles on now">
            {battles.map((row) => (
              <li key={row.id} data-attack={row.attack ? '' : undefined}>
                <button type="button" onClick={() => onGo(row.id)}>
                  <span className="holomap-battles-t">
                    {templateFor(row.id, table.war).name}
                    {row.id === current ? ' (here)' : yours ? ` · ${jumpSeconds(systemById(current), systemById(row.id)).toFixed(1)} s` : ''}
                  </span>
                  <span className="holomap-battles-n">{battleLine(row, now, side)}</span>
                  <span className="holomap-battles-n">{standing(row, now)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
        <ul className="galaxy-areas" aria-label="Who holds each area">
          {areaLines(table.areas, side).map((a) => (
            <li key={a.id} data-yours={a.yours || undefined}>
              <span>{a.name}</span> <span>{a.text}</span>
            </li>
          ))}
        </ul>
        <p className="holomap-meta">What you do in a battle counts for the side you swore to, here, for everyone online.</p>
      </details>
    </section>
  );
}

// one system's place in the war: who holds it, the battle on there, and the
// ground battle to fight it on where it has one (in the war you fight in:
// the ground's battle is your theatre's)
export function SystemWar({ row, war, now, side, yours = true }) {
  if (!row) return null;
  const sys = systemById(row.id);
  const ground = groundBattle(sys);
  return (
    <>
      <div>
        <dt>{WARS[war].short}</dt>
        <dd>{standing(row, now)}</dd>
      </div>
      {row.battle && (
        <div>
          <dt>{templateFor(row.id, war).name}</dt>
          <dd>{battleLine(row, now, side)}</dd>
        </div>
      )}
      {ground && row.battle && yours && (
        <div>
          <dt>On the ground</dt>
          <dd>
            <Link to={ground}>Fight it on the ground</Link>
          </dd>
        </div>
      )}
    </>
  );
}
