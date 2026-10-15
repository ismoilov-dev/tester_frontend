import { useEffect, useRef, useState } from "react";
import { sendConsent, startAttempt } from "../../api/student";
import { toApiError } from "../../api/errors";
import StudentShell, { StatusOrb } from "../../components/StudentShell";
import { Button, ErrorBox, Spinner } from "../../components/ui";
import { syncClock } from "../../lib/clock";
import { clientInfo, enterFullscreen, isTouchDevice, mediaErrorText, requestMedia } from "../../lib/media";
import { analyzeFrame, loadLandmarker } from "../../proctoring/faceMonitor";
import { getAudioContext, LevelMeter } from "../../proctoring/voiceMonitor";
import { useAttempt } from "../../stores/attempt";
import { refreshState } from "./routing";

type Step = "consent" | "media" | "check" | "ready";
const CALIB_MS = 2000;

export default function LobbyPage() {
  const state = useAttempt(s => s.state)!;
  const room = useAttempt(s => s.room);
  const stream = useAttempt(s => s.stream);
  const cfg = state.exam.proctoring;
  const needMedia = cfg.camera || cfg.microphone;
  const retention = room?.retention_days ?? 30;

  const [step, setStep] = useState<Step>(state.consent ? (needMedia ? (stream ? "check" : "media") : "ready") : "consent");
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [consentSent, setConsentSent] = useState(state.consent);
  const [checkOk, setCheckOk] = useState(false);

  async function postConsent() {
    if (consentSent) return true;
    try {
      await sendConsent(clientInfo());
      setConsentSent(true);
      return true;
    } catch (e) {
      setError(toApiError(e).message);
      return false;
    }
  }

  async function onConsentNext() {
    setError("");
    if (needMedia) setStep("media");
    else { setBusy(true); if (await postConsent()) setStep("ready"); setBusy(false); }
  }

  async function onRequestMedia() {
    setError("");
    setBusy(true);
    try {
      if (cfg.microphone) getAudioContext(); // foydalanuvchi bosgan event ichida
      const s = await requestMedia(cfg.camera, cfg.microphone);
      useAttempt.getState().setStream(s);
      setStep("check");
    } catch (e) {
      setError(mediaErrorText(e));
    } finally {
      setBusy(false);
    }
  }

  async function onCheckDone() {
    setBusy(true);
    if (await postConsent()) setStep("ready");
    setBusy(false);
  }

  async function onStart() {
    setError("");
    // 1. fullscreen — darhol, undan oldin hech qanday await yo'q
    if (cfg.fullscreen) await enterFullscreen();
    setBusy(true);
    try {
      if (cfg.microphone) getAudioContext();
      const r = await startAttempt(); // 2.
      syncClock(r.server_time);
      const st = useAttempt.getState();
      st.set({ question: r.question, phase: "exam" }); // 3-4: anti-cheat va WS StudentFlow'da phase bo'yicha yoqiladi
      if (st.state) st.set({ state: { ...st.state, status: "in_progress" } });
    } catch (e) {
      const err = toApiError(e);
      if (err.code === "CONSENT_REQUIRED") { setConsentSent(false); setStep("consent"); setError("Avval rozilik bering"); }
      else if (err.code === "ALREADY_STARTED") await refreshState().catch(() => {});
      else setError(err.message);
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    } finally {
      setBusy(false);
    }
  }

  const steps: { key: Step; label: string }[] = [
    { key: "consent", label: "Rozilik" },
    ...(needMedia ? [{ key: "media" as Step, label: "Ruxsat" }, { key: "check" as Step, label: "Tekshiruv" }] : []),
    { key: "ready", label: "Boshlash" },
  ];
  const curIdx = steps.findIndex(s => s.key === step);

  return (
    <StudentShell width="max-w-xl">
        <p className="text-[13px] text-ink-muted">Salom, {state.full_name}</p>
        <h1 className="mb-6 mt-1 text-[28px] font-semibold leading-[34px] tracking-tight">{state.exam.title}</h1>

        {cfg.fullscreen && isTouchDevice() && (
          <div className="mb-5 rounded-md bg-peach/60 px-4 py-3 text-sm">
            Bu test kompyuter uchun mo'ljallangan. Iltimos, kompyuterdan kiring — telefonda to'liq ekran rejimi ishlamasligi mumkin.
          </div>
        )}

        <ol className="mb-7 flex items-center gap-2 text-[13px]">
          {steps.map((s, i) => (
            <li key={s.key} className="flex flex-1 items-center gap-2">
              <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full font-semibold ${i < curIdx ? "bg-mint text-ink" : i === curIdx ? "bg-primary text-on-primary" : "bg-surface-200 text-ink-muted"}`}>
                {i < curIdx ? "✓" : i + 1}
              </span>
              <span className={`${i === curIdx ? "font-medium" : "hidden text-ink-muted sm:inline"}`}>{s.label}</span>
              {i < steps.length - 1 && <span className="hidden h-px flex-1 bg-border sm:block" />}
            </li>
          ))}
        </ol>

        {step === "consent" && (
          <div className="space-y-4">
            <div className="rounded-lg bg-surface-100 p-5 text-sm leading-relaxed text-ink">
              {needMedia ? (
                <>Test davomida kamera va mikrofon ishlatiladi. Video va ovoz yozib olinmaydi, serverga yuborilmaydi. Faqat qoidabuzarlik paytida bitta rasm saqlanadi va {retention} kundan keyin o'chiriladi.</>
              ) : (
                <>Test davomida brauzerdagi harakatlaringiz (boshqa tabga o'tish, to'liq ekrandan chiqish va h.k.) kuzatiladi. Ma'lumotlar {retention} kundan keyin o'chiriladi.</>
              )}
              <ul className="mt-3 list-disc space-y-1 pl-5 text-ink-muted">
                <li>Boshqa tab yoki dasturga o'tmang</li>
                {cfg.fullscreen && <li>To'liq ekran rejimidan chiqmang</li>}
                {cfg.camera && <li>Yuzingiz doim kamerada ko'rinib tursin, chetga qaramang</li>}
                {cfg.microphone && <li>Gaplashmang</li>}
                {cfg.block_copy_paste && <li>Nusxalash/qo'yish bloklangan</li>}
              </ul>
            </div>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input type="checkbox" className="h-4 w-4 accent-[var(--ink)]" checked={agreed} onChange={e => setAgreed(e.target.checked)} />
              Qoidalar bilan tanishdim va roziman
            </label>
            <Button size="lg" className="w-full" disabled={!agreed} loading={busy} onClick={onConsentNext}>Davom etish</Button>
          </div>
        )}

        {step === "media" && (
          <div className="space-y-4 text-center">
            <StatusOrb>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round">
                {cfg.camera ? <><rect x="3" y="7" width="13" height="10" rx="2" /><path d="M16 11l5-3v8l-5-3" /></> : <><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0014 0M12 18v3" strokeLinecap="round" /></>}
              </svg>
            </StatusOrb>
            <p className="text-sm text-ink-muted">
              Brauzer {cfg.camera && cfg.microphone ? "kamera va mikrofon" : cfg.camera ? "kamera" : "mikrofon"}ga ruxsat so'raydi — «Ruxsat berish» ni bosing.
            </p>
            <Button size="lg" className="w-full" loading={busy} onClick={onRequestMedia}>{error ? "Qayta urinish" : "Ruxsat berish"}</Button>
          </div>
        )}

        {step === "check" && stream && (
          <MediaCheck camera={cfg.camera} microphone={cfg.microphone} stream={stream} onReady={setCheckOk}>
            <Button size="lg" className="w-full" disabled={!checkOk} loading={busy} onClick={onCheckDone}>Davom etish</Button>
          </MediaCheck>
        )}

        {step === "ready" && (
          <div className="space-y-4 text-center">
            <p className="text-ink-muted">
              {state.exam.questions_count} ta savol. {state.exam.timing_mode === "per_question" ? "Har bir savolga alohida vaqt beriladi." : "Butun test uchun umumiy vaqt beriladi — vaqt «Testni boshlash» bosilgandan boshlanadi."}
              {!state.exam.allow_back && " Oldingi savolga qaytib bo'lmaydi."}
            </p>
            {cfg.fullscreen && <p className="text-sm text-ink-muted">Boshlaganingizda ekran to'liq rejimga o'tadi.</p>}
            {stream && cfg.camera && <MiniPreview stream={stream} />}
            <Button size="lg" className="w-full" loading={busy} onClick={onStart}>Testni boshlash</Button>
          </div>
        )}

        {error && <div className="mt-4"><ErrorBox>{error}</ErrorBox></div>}
    </StudentShell>
  );
}

function MiniPreview({ stream }: { stream: MediaStream }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => { if (ref.current) ref.current.srcObject = stream; }, [stream]);
  return <video ref={ref} autoPlay muted playsInline className="mx-auto h-28 -scale-x-100 rounded-md bg-ink object-cover" />;
}

/** Video preview + yuz aniqlash + mikrofon darajasi + 2 s kalibrlash. */
function MediaCheck({ camera, microphone, stream, onReady, children }:
  { camera: boolean; microphone: boolean; stream: MediaStream; onReady: (ok: boolean) => void; children: React.ReactNode }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [modelState, setModelState] = useState<"loading" | "ok" | "error">(camera ? "loading" : "ok");
  const [faces, setFaces] = useState(0);
  const [level, setLevel] = useState(-100);
  const [calibProgress, setCalibProgress] = useState(0);
  const [calibrated, setCalibrated] = useState(false);

  useEffect(() => {
    if (videoRef.current) videoRef.current.srcObject = stream;
  }, [stream]);

  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    const meter = microphone ? new LevelMeter(stream) : null;
    const yaws: number[] = [], pitches: number[] = [], dbs: number[] = [];
    let faceSince: number | null = null;
    let done = false;
    const startedAt = performance.now();
    let lm: Awaited<ReturnType<typeof loadLandmarker>> | null = null;

    if (camera) {
      loadLandmarker().then(l => { if (alive) { lm = l; setModelState("ok"); } }).catch(() => alive && setModelState("error"));
    }

    const loop = () => {
      if (!alive) return;
      const now = performance.now();
      if (meter) {
        const db = meter.levelDb();
        setLevel(db);
        if (now - startedAt < CALIB_MS + 500) dbs.push(db);
      }
      let faceCount = camera ? 0 : 1;
      if (camera && lm && videoRef.current) {
        try {
          const info = analyzeFrame(lm, videoRef.current);
          if (info) {
            faceCount = info.faces;
            setFaces(info.faces);
            if (info.faces === 1 && info.yaw !== null && info.pitch !== null) {
              faceSince ??= now;
              yaws.push(info.yaw); pitches.push(info.pitch);
            } else { faceSince = null; yaws.length = 0; pitches.length = 0; }
          }
        } catch { /* kadr xatosi */ }
      }
      const faceDur = camera ? (faceSince ? now - faceSince : 0) : now - startedAt;
      const prog = Math.min(1, Math.min(faceDur, now - startedAt) / CALIB_MS);
      setCalibProgress(prog);
      if (!done && prog >= 1 && faceCount === 1) {
        done = true;
        const avg = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
        const sorted = [...dbs].sort((a, b) => a - b);
        const noiseFloor = sorted.length ? sorted[Math.floor(sorted.length / 2)] : null;
        useAttempt.getState().set({ calibration: { yaw0: avg(yaws), pitch0: avg(pitches), noiseFloor } });
        setCalibrated(true); // keyin ham ko'rsatkichlar yangilanib turadi
      }
      timer = setTimeout(loop, 125);
    };
    loop();
    return () => { alive = false; clearTimeout(timer); meter?.dispose(); };
  }, [camera, microphone, stream]);

  const faceOk = !camera || faces === 1;
  useEffect(() => { onReady(calibrated && faceOk && modelState !== "loading"); }, [calibrated, faceOk, modelState, onReady]);

  const levelPct = Math.max(0, Math.min(100, ((level + 70) / 60) * 100));

  const check = (ok: boolean, text: string, pending = false) => (
    <li className="flex items-center gap-3">
      <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${ok ? "bg-mint text-ink" : pending ? "bg-surface-200 text-ink-muted" : "bg-peach text-ink"}`}>
        {ok ? "✓" : pending ? "…" : "!"}
      </span>
      <span className={ok ? "" : "text-ink-muted"}>{text}</span>
    </li>
  );

  return (
    <div className="space-y-5">
      {camera && (
        <div className="relative mx-auto aspect-[4/3] w-full max-w-sm overflow-hidden rounded-lg bg-ink">
          <video ref={videoRef} autoPlay muted playsInline className="h-full w-full -scale-x-100 object-cover" />
          {modelState === "loading" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-ink/60 text-sm text-on-primary">
              <Spinner /> Yuz aniqlash yuklanmoqda…
            </div>
          )}
        </div>
      )}
      <ul className="space-y-2.5 text-sm">
        {camera && (modelState === "error"
          ? check(false, "Yuz aniqlash yuklanmadi — sahifani yangilang")
          : check(faces === 1, faces === 1 ? "Yuzingiz aniqlandi" : faces === 0 ? "Yuzingiz ko'rinmayapti — kameraga qarang" : "Kadrda bir nechta odam bor", modelState === "loading"))}
        {microphone && (
          <li className="flex items-center gap-3">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-surface-200 text-[11px] text-ink-muted">♪</span>
            <span className="text-ink-muted">Mikrofon</span>
            <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-200">
              <span className="block h-full rounded-full bg-ink transition-[width] duration-100" style={{ width: `${levelPct}%` }} />
            </span>
          </li>
        )}
        {calibrated ? check(true, "Kalibrlash tugadi") : (
          <li className="flex items-center gap-3">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-surface-200 text-[11px] text-ink-muted">…</span>
            <span className="text-ink-muted">Ekranga qarang va jim turing</span>
            <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-200">
              <span className="block h-full rounded-full bg-ink" style={{ width: `${calibProgress * 100}%` }} />
            </span>
          </li>
        )}
      </ul>
      {children}
    </div>
  );
}
