// The scoreboard (UI/InGame/Scoreboard: ScoreboardWidget, its cells), held
// open on Tab: each team's soldiers by score.
//
//   <Scoreboard teams={{ 1: { name, rows: [{ id, name, kills, deaths, points }] }, 2: … }} bare? />
// (`bare`: the tables alone, for the end of round's panel)
export default function Scoreboard({ teams = {}, title = 'Scoreboard', bare = false }) {
  const tables = Object.entries(teams).map(([t, team]) => (
          <table key={t} className="bf-table">
            <caption className="bf-stage-name">{team.name}</caption>
            <thead>
              <tr>
                <th scope="col">Name</th>
                <th scope="col">Kills</th>
                <th scope="col">Deaths</th>
                <th scope="col">Points</th>
              </tr>
            </thead>
            <tbody>
              {[...team.rows]
                .sort((a, b) => b.points - a.points)
                .map((r) => (
                  <tr key={r.id}>
                    <td>{r.name}</td>
                    <td className="bf-num">{r.kills}</td>
                    <td className="bf-num">{r.deaths}</td>
                    <td className="bf-num">{r.points}</td>
                  </tr>
                ))}
            </tbody>
          </table>
  ));
  if (bare) return tables;
  return (
    <div className="bf-screen" role="dialog" aria-label={title}>
      <div className="bf-panel">{tables}</div>
    </div>
  );
}
