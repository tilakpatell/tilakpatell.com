// The soldier's health (UI/InGame/Hud/Health: PlayerHealth, HealthBar): the
// number in the game's numeric face over the bar.
export default function Health({ hp = 0, hpMax = 1 }) {
  const share = Math.max(0, Math.min(1, hp / (hpMax || 1)));
  return (
    <div className="bf-health bf-glass">
      <div className="bf-health-num bf-num">{Math.ceil(hp)}</div>
      <div className="bf-health-bar">
        <span style={{ width: `${share * 100}%` }} />
      </div>
    </div>
  );
}
