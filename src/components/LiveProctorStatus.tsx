import { useEffect, useState } from "react";
import { EVENT_LABELS } from "../lib/labels";
import type { StudentProctoring } from "../api/types";
import { useLive } from "../proctoring/live";

/** Kamera yonida: yuzlar soni va mikrofon darajasi — har kadrda yangilanadi. */
export function LiveIndicator({ camera, microphone }: { camera: boolean; microphone: boolean }) {
  const faces = useLive(s => s.faces);
  const db = useLive(s => s.db);
  const loud = useLive(s => s.loud);
  const pct = Math.max(0, Math.min(100, ((db + 70) / 60) * 100));
  return (
    <div className="flex flex-col gap-1.5 text-[11px] leading-none">
      {camera && (
        <span className={`inline-flex h-5 items-center rounded-full px-2 font-medium ${faces === 1 ? "bg-mint text-ink" : faces === null ? "bg-surface-200 text-ink-muted" : "bg-blush text-danger"}`}>
          {faces === null ? "kamera…" : faces === 1 ? "yuz ✓" : faces === 0 ? "yuz yo'q" : `${faces} kishi`}
        </span>
      )}
      {microphone && (
        <span className="h-1 w-14 overflow-hidden rounded-full bg-surface-200" title="Mikrofon darajasi">
          <span className={`block h-full rounded-full ${loud ? "bg-danger" : "bg-ink-subtle"}`} style={{ width: `${pct}%` }} />
        </span>
      )}
    </div>
  );
}

/** Qoidabuzarlik aniqlangan zahoti ekran tepasida qizil banner (server javobini kutmaydi). */
export function DetectionAlert() {
  const last = useLive(s => s.lastDetected);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!last) return;
    setVisible(true);
    const t = setTimeout(() => setVisible(false), 3500);
    return () => clearTimeout(t);
  }, [last]);
  if (!last || !visible) return null;
  return (
    <div className="fixed left-1/2 top-20 z-50 -translate-x-1/2 rounded-full bg-danger px-5 py-2.5 text-sm font-medium text-white shadow-lg">
      {EVENT_LABELS[last.type]} — qayd etildi
    </div>
  );
}

const DEBUG = typeof location !== "undefined" && new URLSearchParams(location.search).has("debug");

/** `?debug=1` — chegaralarni sozlash uchun xom raqamlar (o'ng pastda). */
export function DebugPanel({ config }: { config: StudentProctoring }) {
  const faces = useLive(s => s.faces);
  const db = useLive(s => s.db);
  const d = useLive(s => s.debug);
  const p = useLive(s => s.pipe);
  if (!DEBUG) return null;
  const row = (k: string, v: unknown, bad = false) => (
    <div className="flex justify-between gap-4"><span className="text-ink-subtle">{k}</span><span className={bad ? "text-danger" : ""}>{String(v ?? "—")}</span></div>
  );
  const on = (v: boolean) => (v ? "✓" : "✗ o'chiq");
  return (
    <div className="fixed bottom-3 right-3 z-50 w-60 rounded-lg bg-ink/90 p-3 font-mono text-[11px] text-white">
      <div className="mb-1 text-ink-subtle">Test sozlamasi:</div>
      {row("kamera", on(config.camera), !config.camera)}
      {row("mikrofon", on(config.microphone), !config.microphone)}
      {row("fullscreen", on(config.fullscreen), !config.fullscreen)}
      {row("copy-paste", on(config.block_copy_paste), !config.block_copy_paste)}
      <div className="my-1.5 border-t border-slate-700" />
      {row("faces", faces, faces !== 1)}
      {row("yaw Δ", d.yaw, Math.abs(d.yaw ?? 0) > 25)}
      {row("pitch Δ", d.pitch, Math.abs(d.pitch ?? 0) > 20)}
      {row("gaze", d.gaze, (d.gaze ?? 0) > 0.55)}
      {row("dB", Math.round(db), d.threshold !== null && db > d.threshold)}
      {row("dB chegara", d.threshold)}
      <div className="my-1.5 border-t border-slate-700" />
      {row("WS", p.ws ? "ulangan" : "yo'q", !p.ws)}
      {row("aniqlandi", p.detected)}
      {row("yuborildi", p.sent)}
      {row("server javobi", p.acked, p.sent > 0 && p.acked === 0)}
      {row("xato", p.failed, p.failed > 0)}
      {p.lastAck && <div className="mt-1 break-all text-emerald-300">{p.lastAck}</div>}
      {p.lastError && <div className="mt-1 break-all text-danger">{p.lastError}</div>}
    </div>
  );
}
