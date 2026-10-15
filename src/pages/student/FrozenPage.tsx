import { useEffect } from "react";
import StudentShell, { StatusOrb } from "../../components/StudentShell";
import { Spinner } from "../../components/ui";
import { useAttempt } from "../../stores/attempt";
import { refreshState } from "./routing";

export default function FrozenPage() {
  const score = useAttempt(s => s.violationScore);

  // WS asosiy kanal; uzilib qolsa — 15 s da bir holatni tekshiramiz
  useEffect(() => {
    const t = setInterval(() => refreshState().catch(() => {}), 15_000);
    return () => clearInterval(t);
  }, []);

  return (
    <StudentShell glow="sunset">
      <div className="text-center">
        <StatusOrb glow="sunset">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M9 6v12M15 6v12" strokeLinecap="round" /></svg>
        </StatusOrb>
        <h1 className="text-[28px] font-semibold leading-[34px] tracking-tight">Test to'xtatildi</h1>
        <p className="mt-2 text-ink-muted">Qoidabuzarlik ko'p bo'ldi. O'qituvchi tekshirmoqda — davom ettirish yoki to'xtatishni u hal qiladi.</p>
        <p className="mt-4 inline-flex rounded-full bg-surface-100 px-4 py-1.5 font-mono text-xs">Qoidabuzarlik bali: {score}</p>
        <div className="mt-6 flex items-center justify-center gap-2 text-[13px] text-ink-subtle">
          <Spinner className="h-3.5 w-3.5" /> Sahifani yopmang
        </div>
      </div>
    </StudentShell>
  );
}
