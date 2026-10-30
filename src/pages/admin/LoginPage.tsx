import { useEffect, useRef, useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { googleLogin } from "../../api/admin";
import { toApiError } from "../../api/errors";
import { ErrorBox, Spinner } from "../../components/ui";
import { GOOGLE_CLIENT_ID, loadGsi } from "../../lib/google";
import { useAuth } from "../../stores/auth";

export default function LoginPage() {
  const nav = useNavigate();
  const loc = useLocation();
  const access = useAuth(s => s.access);
  const btnRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (access) return;
    let alive = true;

    async function onCredential(resp: GoogleCredentialResponse) {
      setError("");
      setBusy(true);
      try {
        const r = await googleLogin(resp.credential);
        useAuth.getState().setTokens(r.access, r.refresh, r.user);
        nav((loc.state as any)?.from ?? "/admin", { replace: true });
      } catch (e) {
        const err = toApiError(e);
        if (err.status === 401) setError("Google tokeni yaroqsiz. Qayta urinib ko'ring.");
        else if (err.status === 403) setError("Hisobingiz bloklangan.");
        else if (err.status === 429) setError(`Juda ko'p urinish. ${err.details?.retry_after_seconds ? `${err.details.retry_after_seconds} s dan keyin` : "Biroz kuting"}`);
        else setError(err.message);
      } finally {
        setBusy(false);
      }
    }

    loadGsi()
      .then(() => {
        if (!alive || !btnRef.current || !window.google) return;
        const gid = window.google.accounts.id;
        gid.initialize({ client_id: GOOGLE_CLIENT_ID, callback: onCredential, ux_mode: "popup" });
        gid.renderButton(btnRef.current, {
          theme: "outline", size: "large", text: "continue_with", shape: "pill", logo_alignment: "center",
          width: Math.min(btnRef.current.offsetWidth || 320, 340),
        });
        setReady(true);
      })
      .catch(e => alive && setError(e.message));

    return () => { alive = false; };
  }, [access]); // eslint-disable-line react-hooks/exhaustive-deps

  if (access) return <Navigate to="/admin" replace />;

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-bg px-4 py-16">
      {/* yumshoq fon "orb"lar */}
      <div aria-hidden className="gradient-aurora pointer-events-none absolute -top-48 left-1/2 h-[560px] w-[560px] -translate-x-1/2 rounded-full opacity-60 blur-3xl" />
      <div aria-hidden className="gradient-lagoon pointer-events-none absolute -bottom-56 -right-40 h-[440px] w-[440px] rounded-full opacity-50 blur-3xl" />

      <Link to="/" className="absolute left-4 top-5 text-[13px] text-ink-muted transition-colors hover:text-ink sm:left-8">← Bosh sahifa</Link>

      <div className="relative w-full max-w-[420px] rounded-xl border border-border bg-bg/85 p-8 text-center shadow-lg backdrop-blur sm:p-10">
        <div className="gradient-aurora mx-auto flex h-14 w-14 items-center justify-center rounded-2xl shadow-md">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6 text-ink">
            <path d="M12 3l7 3v5c0 4.5-3 8.3-7 10-4-1.7-7-5.5-7-10V6l7-3z" />
            <path d="M9 12l2 2 4-4" />
          </svg>
        </div>

        <span className="mt-6 inline-block rounded-full border border-border bg-surface-100 px-3 py-1 text-[12px] font-medium text-ink-muted">Admin panel</span>
        <h1 className="mt-3 text-[32px] font-semibold leading-[38px] tracking-[-0.03em]">Xush kelibsiz</h1>
        <p className="mx-auto mt-2 max-w-[300px] text-ink-muted">Testlar yaratish, jonli kuzatish va natijalarni ko'rish uchun Google hisobingiz bilan kiring.</p>

        <div className="relative mt-8 flex min-h-11 justify-center">
          <div ref={btnRef} className={`flex w-full justify-center ${busy ? "pointer-events-none opacity-50" : ""}`} />
          {(!ready || busy) && (
            <div className="absolute inset-0 flex items-center justify-center"><Spinner /></div>
          )}
        </div>
        {error && <div className="mt-4 text-left"><ErrorBox>{error}</ErrorBox></div>}

        <div className="mt-8 grid grid-cols-3 gap-2 border-t border-border pt-6 text-[12px] text-ink-muted">
          {FEATURES.map(f => (
            <div key={f.label} className="flex flex-col items-center gap-2">
              <span className={`${f.tint} flex h-9 w-9 items-center justify-center rounded-full text-[15px]`}>{f.icon}</span>
              {f.label}
            </div>
          ))}
        </div>
      </div>

      <p className="relative mt-6 max-w-[360px] text-center text-[12px] leading-5 text-ink-subtle">
        Birinchi kirishda admin hisobi avtomatik yaratiladi.
      </p>
    </div>
  );
}

const FEATURES = [
  { icon: "✎", label: "Test yaratish", tint: "bg-peach" },
  { icon: "◉", label: "Jonli nazorat", tint: "bg-lilac" },
  { icon: "▤", label: "Natijalar", tint: "bg-mint" },
];
