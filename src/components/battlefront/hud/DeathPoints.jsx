// Battle Points on death (UI/InGame/Death/DeathBattlepoints): what the life
// earned and the total, in the game's words.
export default function DeathPoints({ earned = 0, total = 0, label = 'BATTLE POINTS EARNED', totalLabel = 'TOTAL BATTLE POINTS' }) {
  return (
    <div className="bf-deathpoints bf-glass">
      <div>
        {label} <span className="bf-num">{earned.toLocaleString('en-GB')}</span>
      </div>
      <div>
        {totalLabel} <span className="bf-num">{total.toLocaleString('en-GB')}</span>
      </div>
    </div>
  );
}
