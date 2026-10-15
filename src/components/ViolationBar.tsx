/** Qoidabuzarlik bali to'xtatish chegarasiga qanchalik yaqin. */
export default function ViolationBar({ score, freezeAt, warnAt, compact }: { score: number; freezeAt: number; warnAt?: number; compact?: boolean }) {
  const pct = freezeAt > 0 ? Math.min(100, (score / freezeAt) * 100) : 0;
  const color = pct >= 100 ? "bg-danger" : warnAt && score >= warnAt ? "bg-warning" : pct > 0 ? "bg-ink-subtle" : "bg-success";
  return (
    <div className={compact ? "w-28" : "w-32"} title={`Qoidabuzarlik: ${score} ball. ${freezeAt} ballda test to'xtatiladi.`}>
      {!compact && <div className="mb-1 flex justify-between text-[11px] text-ink-muted"><span>Qoidabuzarlik</span><span className="tabular-nums">{score}/{freezeAt || "—"}</span></div>}
      <div className="h-1.5 overflow-hidden rounded-full bg-surface-200">
        <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${Math.max(pct, score > 0 ? 4 : 0)}%` }} />
      </div>
      {compact && <div className="mt-1 text-[13px] tabular-nums text-ink-muted">{score} / {freezeAt || "—"} ball</div>}
    </div>
  );
}
