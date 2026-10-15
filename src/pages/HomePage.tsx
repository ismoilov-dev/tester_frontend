import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button, Input } from "../components/ui";

export const CODE_RE = /^[a-z]{3}-[a-z]{4}-[a-z]{3}$/;

/** "dqnrfabteu", "DQN RFAB TEU" yoki to'liq havola -> "dqn-rfab-teu" */
export function normalizeCode(raw: string) {
  const last = raw.trim().split("/").filter(Boolean).pop() ?? "";
  const letters = last.toLowerCase().replace(/[^a-z]/g, "");
  if (letters.length !== 10) return last.toLowerCase();
  return `${letters.slice(0, 3)}-${letters.slice(3, 7)}-${letters.slice(7)}`;
}

export default function HomePage() {
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const nav = useNavigate();

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const code = normalizeCode(value);
    if (!CODE_RE.test(code)) return setError("Kod formati: abc-defg-hij");
    nav(`/${code}`);
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-bg px-4">
      {/* yumshoq fon "orb" */}
      <div aria-hidden className="gradient-aurora pointer-events-none absolute -top-40 left-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full opacity-70 blur-3xl" />
      <div className="relative w-full max-w-md text-center">
        <h1 className="text-[44px] font-semibold leading-[48px] tracking-[-0.03em]">Testga kirish</h1>
        <p className="mt-3 text-[17px] leading-7 text-ink-muted">O'qituvchingiz bergan kodni kiriting</p>
        <form onSubmit={onSubmit} className="mt-10 space-y-3 rounded-xl border border-border bg-bg/90 p-6 text-left backdrop-blur">
          <Input
            autoFocus
            value={value}
            onChange={e => { setValue(e.target.value); setError(""); }}
            placeholder="abc-defg-hij"
            aria-invalid={!!error}
            className="h-14 text-center font-mono text-xl tracking-[0.2em]"
          />
          {error && <p className="text-center text-[13px] text-danger">{error}</p>}
          <Button type="submit" size="lg" className="w-full">Davom etish</Button>
        </form>
      </div>
      <Link to="/admin/login" className="relative mt-8 text-[13px] text-ink-muted hover:text-ink">Admin sifatida kirish →</Link>
    </div>
  );
}
