import StudentShell, { StatusOrb } from "../../components/StudentShell";
import { fmtNum } from "../../lib/format";
import { useAttempt } from "../../stores/attempt";

export default function ResultPage() {
  const kind = useAttempt(s => s.resultKind);
  const result = useAttempt(s => s.result);
  const note = useAttempt(s => s.note);
  const name = useAttempt(s => s.state?.full_name);
  const title = useAttempt(s => s.state?.exam.title);

  const icon = (d: string) => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>;
  let body;
  if (kind === "rejected") {
    body = (
      <>
        <StatusOrb glow="sunset">{icon("M6 6l12 12M18 6L6 18")}</StatusOrb>
        <h1 className="text-[28px] font-semibold leading-[34px] tracking-tight">Test rad etildi</h1>
        {note ? <p className="mt-4 rounded-md bg-blush/60 px-4 py-3 text-left text-sm">{note}</p>
          : <p className="mt-2 text-ink-muted">O'qituvchi natijangizni bekor qildi.</p>}
      </>
    );
  } else if (kind === "kicked") {
    body = (
      <>
        <StatusOrb glow="sunset">{icon("M15 12H4m0 0l4-4m-4 4l4 4M14 5h5v14h-5")}</StatusOrb>
        <h1 className="text-[28px] font-semibold leading-[34px] tracking-tight">Siz testdan chiqarildingiz</h1>
        <p className="mt-2 text-ink-muted">Savollar bo'lsa, o'qituvchingizga murojaat qiling.</p>
      </>
    );
  } else {
    const pct = result && result.max > 0 ? Math.round((result.score / result.max) * 100) : null;
    body = (
      <>
        <StatusOrb glow="lagoon">{icon("M5 12.5l4.5 4.5L19 7.5")}</StatusOrb>
        <h1 className="text-[28px] font-semibold leading-[34px] tracking-tight">
          {kind === "force_submit" ? "Test o'qituvchi tomonidan yakunlandi" : "Test yakunlandi"}
        </h1>
        {result ? (
          <div className="mt-6">
            <p className="text-[64px] font-semibold leading-[64px] tracking-[-0.035em] tabular-nums">
              {fmtNum(result.score)}<span className="text-[28px] text-ink-subtle"> / {fmtNum(result.max)}</span>
            </p>
            {pct !== null && <p className="mt-2 text-ink-muted">{pct}% to'g'ri</p>}
          </div>
        ) : (
          <p className="mt-2 text-ink-muted">Javoblaringiz qabul qilindi. Natijani o'qituvchingiz e'lon qiladi.</p>
        )}
      </>
    );
  }

  return (
    <StudentShell glow={kind === "submitted" || kind === "force_submit" ? "lagoon" : "sunset"}>
      <div className="text-center">
        {title && <p className="mb-6 text-[13px] text-ink-subtle">{title}{name ? ` · ${name}` : ""}</p>}
        {body}
      </div>
    </StudentShell>
  );
}
