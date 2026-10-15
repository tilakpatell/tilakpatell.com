import { killLogRows, killMessageOf } from './widgets.js';

// The kill log (UI/InGame/Hud/KillLog/KillLogScreen: a stack at the top
// right, 85 in and 58 down, 350 wide; KillLogWidget: 10 rows of 30, each
// shown 5 s) and the kill message (KillMessage, 768 × 80 at the middle
// 170 down, 5 s). A row is KillEventRow: the killer, "defeated"
// (string C998664F, palette 54), the victim, in Univers 520 Medium 18 px,
// the names in their side's colour (the friendly blue, palette 13, the
// enemy red, palette 11), right-aligned. The message is "DEFEATED"
// (ID_HUD_KILLED) and the victim's name in the enemy red, Univers 520
// Medium 36 px.
//
//   <KillLog entries={[{ id, killer, killerTeam, victim, victimTeam, t }]} mine={team} now={s} words={{ defeated, killed }} />
const side = (team, mine) => (team === mine ? 'bf-friend' : 'bf-foe');
export default function KillLog({ entries = [], mine = 2, now = Infinity, me = 'You', words = { defeated: 'defeated', killed: 'DEFEATED' } }) {
  const rows = killLogRows(entries, now);
  const message = killMessageOf(entries, now, { mine: me });
  return (
    <>
      <div className="bf-killlog" aria-live="polite">
        {rows.map((e) => (
          <div key={e.id} className="bf-kill">
            <span className={side(e.killerTeam, mine)}>{e.killer}</span> <span className="bf-kill-verb">{words.defeated}</span> <span className={side(e.victimTeam, mine)}>{e.victim}</span>
          </div>
        ))}
      </div>
      {message && (
        <div className="bf-killmessage" role="status">
          <span className="bf-kill-verb">{words.killed}</span> <span className="bf-foe">{message.victim}</span>
        </div>
      )}
    </>
  );
}
