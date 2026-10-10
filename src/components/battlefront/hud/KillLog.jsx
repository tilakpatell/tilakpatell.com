// The kill log (UI/InGame/Hud/KillLog: KillLogScreen) and the kill message
// (KillMessage: who, with what, the Battle Points): the last few, friend in
// blue, foe in red.
//
//   <KillLog entries={[{ id, killer, killerTeam, victim, victimTeam, weapon }]} mine={team} />
const side = (team, mine) => (team === mine ? 'bf-friend' : 'bf-foe');
export default function KillLog({ entries = [], mine = 2, message = null }) {
  return (
    <>
      <div className="bf-killlog" aria-live="polite">
        {entries.slice(-5).map((e) => (
          <div key={e.id} className="bf-glass">
            <span className={side(e.killerTeam, mine)}>{e.killer}</span> {e.weapon ? <span className="bf-muted">[{e.weapon}]</span> : '›'} <span className={side(e.victimTeam, mine)}>{e.victim}</span>
          </div>
        ))}
      </div>
      {message && (
        <div className="bf-deathpoints bf-glass" style={{ bottom: '34%' }}>
          {message.text} <span className="bf-num">+{message.points}</span>
        </div>
      )}
    </>
  );
}
