import { useCallback, useEffect, useRef, useState } from "react";
import { answer, gotoQuestion, submitAttempt } from "../../api/student";
import { toApiError, type ApiError } from "../../api/errors";
import type { AnswerOut } from "../../api/types";
import { DebugPanel, DetectionAlert, LiveIndicator } from "../../components/LiveProctorStatus";
import Timer from "../../components/Timer";
import { toast } from "../../components/toast";
import { StatusOrb } from "../../components/StudentShell";
import { Button, ConfirmModal, Modal } from "../../components/ui";
import ViolationBar from "../../components/ViolationBar";
import { syncClock } from "../../lib/clock";
import { enterFullscreen, mediaErrorText, requestMedia } from "../../lib/media";
import { getAudioContext } from "../../proctoring/voiceMonitor";
import { useAttempt } from "../../stores/attempt";
import { goResult, refreshState } from "./routing";

interface Props {
  onVideo: (el: HTMLVideoElement | null) => void;
  media: { camera: boolean; mic: boolean };
  fullscreenLost: boolean;
  onFullscreenRestored: () => void;
  wsOpen: boolean;
}

const RETRY_DELAYS = [1000, 2000, 4000, 8000];
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

export default function ExamPage({ onVideo, media, fullscreenLost, onFullscreenRestored, wsOpen }: Props) {
  const state = useAttempt(s => s.state)!;
  const question = useAttempt(s => s.question);
  const stream = useAttempt(s => s.stream);
  const violationScore = useAttempt(s => s.violationScore);
  const warning = useAttempt(s => s.warning);
  const cfg = state.exam.proctoring;
  const totalMode = state.exam.timing_mode === "total";
  const canGoBack = totalMode && state.exam.allow_back;

  const [selected, setSelected] = useState<number | null>(question?.selected_option_id ?? null);
  const [pending, setPending] = useState(false);
  const [offline, setOffline] = useState(false);
  const [confirmSubmit, setConfirmSubmit] = useState(false);
  const [answered, setAnswered] = useState<Set<number>>(new Set());
  const [mediaError, setMediaError] = useState("");
  const [needFsAtStart, setNeedFsAtStart] = useState(() => cfg.fullscreen && !document.fullscreenElement);
  const timedOutFor = useRef<number | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const needMedia = (cfg.camera || cfg.microphone) && !stream; // sahifa yangilangandan keyin
  const blocked = needMedia || needFsAtStart || fullscreenLost || (cfg.camera && !media.camera);

  // Savol o'zgarganda tanlovni yangilash
  useEffect(() => { setSelected(question?.selected_option_id ?? null); }, [question?.id, question?.selected_option_id]);

  // Video elementni StudentFlow'ga (yuz kuzatuvi uchun) uzatish
  const setVideo = useCallback((el: HTMLVideoElement | null) => {
    videoRef.current = el;
    if (el && stream) el.srcObject = stream;
    onVideo(el);
  }, [stream, onVideo]);
  useEffect(() => () => onVideo(null), [onVideo]);

  // ---- Server xatolarini ishlash ----
  const handleError = useCallback(async (err: ApiError) => {
    switch (err.code) {
      case "WRONG_QUESTION": await refreshState().catch(() => {}); break;
      case "ATTEMPT_FROZEN": useAttempt.getState().set({ phase: "frozen" }); break;
      case "ATTEMPT_FINISHED":
      case "NOT_STARTED": await refreshState().catch(() => goResult("submitted")); break;
      default:
        if (err.status === 423) useAttempt.getState().set({ phase: "frozen" });
        else if (err.status === 410) await refreshState().catch(() => goResult("submitted"));
        else toast(err.message, "error");
    }
  }, []);

  /** Tarmoq xatosida 1-2-4-8 s bilan qayta urinadi; javob yo'qolmaydi. */
  async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
    for (let i = 0; ; i++) {
      try {
        const r = await fn();
        setOffline(false);
        return r;
      } catch (e) {
        const err = toApiError(e);
        if (err.code !== "NETWORK") { setOffline(false); throw err; }
        setOffline(true);
        await sleep(RETRY_DELAYS[Math.min(i, RETRY_DELAYS.length - 1)]);
      }
    }
  }

  function applyAnswer(r: AnswerOut, index: number) {
    syncClock(r.server_time);
    if (!r.accepted) toast("Vaqt tugagan edi", "warning");
    setAnswered(s => new Set(s).add(index));
    if (r.finished) {
      goResult("submitted", { result: r.result ?? null });
      return;
    }
    if (r.next_question) useAttempt.getState().set({ question: r.next_question });
  }

  async function sendAnswer(optionId: number | null) {
    if (!question || pending) return;
    const { id: qid, index } = question;
    setPending(true);
    try {
      const r = await withRetry(() => answer(qid, optionId));
      applyAnswer(r, index);
    } catch (e) {
      await handleError(toApiError(e));
    } finally {
      setPending(false);
    }
  }

  // Taymer 0 — faqat bir marta
  function onExpire() {
    if (!question || timedOutFor.current === question.id) return;
    timedOutFor.current = question.id;
    // per_question: javobsiz (null); total: tanlanganini yuboramiz — server qolganini o'zi yopadi
    sendAnswer(totalMode ? selected : null);
  }

  async function onGoto(index: number) {
    if (pending || !question || index === question.index) return;
    setPending(true);
    try {
      // tanlangan javobni avval saqlaymiz
      if (selected !== null && selected !== question.selected_option_id) {
        await withRetry(() => answer(question.id, selected));
        setAnswered(s => new Set(s).add(question.index));
      }
      const r = await withRetry(() => gotoQuestion(index));
      syncClock(r.server_time);
      useAttempt.getState().set({ question: r.question });
    } catch (e) {
      await handleError(toApiError(e));
    } finally {
      setPending(false);
    }
  }

  async function onSubmit() {
    setConfirmSubmit(false);
    setPending(true);
    try {
      if (question && selected !== null && selected !== question.selected_option_id) await withRetry(() => answer(question.id, selected));
      const r = await withRetry(() => submitAttempt());
      goResult("submitted", { result: r.result });
    } catch (e) {
      await handleError(toApiError(e));
    } finally {
      setPending(false);
    }
  }

  async function onResumeMedia() {
    setMediaError("");
    if (cfg.fullscreen) await enterFullscreen();
    try {
      if (cfg.microphone) getAudioContext();
      if (needMedia || !media.camera) {
        useAttempt.getState().stopStream();
        const s = await requestMedia(cfg.camera, cfg.microphone);
        useAttempt.getState().setStream(s);
      }
      setNeedFsAtStart(cfg.fullscreen && !document.fullscreenElement);
      if (document.fullscreenElement) onFullscreenRestored();
    } catch (e) {
      setMediaError(mediaErrorText(e));
    }
  }

  async function onRestoreFullscreen() {
    if (await enterFullscreen()) { setNeedFsAtStart(false); onFullscreenRestored(); }
  }

  if (!question) {
    return <div className="flex min-h-screen items-center justify-center text-ink-muted">Savol yuklanmoqda…</div>;
  }

  const isLast = question.index + 1 >= question.total;

  return (
    <div className="no-select min-h-screen">
      {/* Yuqori panel */}
      <header className="sticky top-0 z-20 border-b border-border bg-bg/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-3xl items-center gap-4 px-4">
          <span className="text-sm text-ink-muted"><b className="font-semibold text-ink">{question.index + 1}</b> / {question.total}</span>
          <div className="ml-auto flex items-center gap-3">
            <ViolationBar score={violationScore} freezeAt={state.freeze_at} warnAt={state.warn_at} />
            <Timer deadline={question.deadline} onExpire={onExpire} />
            {(cfg.camera || cfg.microphone) && <LiveIndicator camera={cfg.camera} microphone={cfg.microphone} />}
            {cfg.camera && (
              <video ref={setVideo} autoPlay muted playsInline
                className={`h-10 w-14 -scale-x-100 rounded-sm bg-ink object-cover ring-2 ${media.camera ? "ring-mint" : "ring-danger"}`} />
            )}
          </div>
        </div>
        <div className="h-0.5 bg-surface-200">
          <div className="h-full bg-ink transition-all" style={{ width: `${((question.index + 1) / question.total) * 100}%` }} />
        </div>
      </header>

      <DetectionAlert />
      <DebugPanel config={cfg} />

      {(offline || !wsOpen) && (
        <div className={`px-4 py-2 text-center text-[13px] ${offline ? "bg-blush text-ink" : "bg-peach/60 text-ink"}`}>
          {offline ? "Aloqa uzildi — qayta ulanmoqda… Javobingiz saqlanib turibdi." : "Server bilan real-time aloqa tiklanmoqda…"}
        </div>
      )}

      <main className="mx-auto max-w-3xl px-4 py-10">
        {canGoBack && (
          <div className="mb-5 flex flex-wrap gap-1.5">
            {Array.from({ length: question.total }, (_, i) => (
              <button key={i} disabled={pending} onClick={() => onGoto(i)}
                className={`h-9 w-9 rounded-full text-[13px] font-medium transition ${i === question.index ? "bg-primary text-on-primary" : answered.has(i) ? "bg-lilac text-ink" : "border border-border text-ink-muted hover:bg-surface-100"}`}>
                {i + 1}
              </button>
            ))}
          </div>
        )}

        {!blocked && (
          <div>
            <p className="mb-6 whitespace-pre-line text-[22px] font-semibold leading-8 tracking-tight">{question.text}</p>
            {question.image && <img src={question.image} alt="" draggable={false} className="mb-6 max-h-80 rounded-lg border border-border" />}
            <div className="space-y-3">
              {question.options.map((o, i) => (
                <label key={o.id}
                  className={`flex cursor-pointer items-center gap-4 rounded-lg border px-5 py-4 transition ${selected === o.id ? "border-ink bg-surface-100 shadow-[0_0_0_1px_var(--ink)]" : "border-border hover:border-border-strong hover:bg-surface-100"}`}>
                  <input type="radio" name="opt" className="sr-only" checked={selected === o.id} onChange={() => setSelected(o.id)} />
                  <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[13px] font-semibold transition ${selected === o.id ? "bg-primary text-on-primary" : "bg-surface-200 text-ink-muted"}`}>
                    {String.fromCharCode(65 + i)}
                  </span>
                  <span className="no-select">{o.text}</span>
                </label>
              ))}
            </div>
            <div className="mt-8 flex justify-end gap-2">
              {canGoBack && (
                <Button variant="ghost" size="lg" disabled={pending} onClick={() => setConfirmSubmit(true)}>Yakunlash</Button>
              )}
              {!(canGoBack && isLast) && (
                <Button size="lg" className="min-w-36" loading={pending} disabled={selected === null && !canGoBack}
                  onClick={() => (canGoBack ? onGoto(question.index + 1) : sendAnswer(selected))}>
                  {isLast && !canGoBack ? "Yakunlash" : "Keyingi →"}
                </Button>
              )}
              {canGoBack && isLast && (
                <Button size="lg" className="min-w-36" loading={pending} onClick={() => setConfirmSubmit(true)}>Yakunlash</Button>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Bloklovchi overlay'lar: savol yashirin */}
      {blocked && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-bg/95 px-4 text-center backdrop-blur-md">
          <div aria-hidden className="gradient-sunset pointer-events-none absolute left-1/2 top-1/4 h-80 w-80 -translate-x-1/2 rounded-full opacity-60 blur-3xl" />
          <div className="relative max-w-md">
            <StatusOrb glow="sunset">!</StatusOrb>
            {needMedia ? (
              <>
                <h2 className="text-[28px] font-semibold leading-[34px] tracking-tight">Testni davom ettirish</h2>
                <p className="mt-2 text-ink-muted">Kamera va mikrofonni qayta yoqish kerak.</p>
                <Button size="lg" className="mt-6" onClick={onResumeMedia}>Davom etish</Button>
              </>
            ) : cfg.camera && !media.camera ? (
              <>
                <h2 className="text-[28px] font-semibold leading-[34px] tracking-tight">Kamerani yoqing</h2>
                <p className="mt-2 text-ink-muted">Kamera o'chdi yoki uzildi. Testni davom ettirish uchun kamerani yoqing.</p>
                <Button size="lg" className="mt-6" onClick={onResumeMedia}>Kamerani yoqish</Button>
              </>
            ) : (
              <>
                <h2 className="text-[28px] font-semibold leading-[34px] tracking-tight">To'liq ekranga qayting</h2>
                <p className="mt-2 text-ink-muted">Test faqat to'liq ekran rejimida davom etadi.{fullscreenLost && " Chiqish qoidabuzarlik sifatida qayd etildi."}</p>
                <Button size="lg" className="mt-6" onClick={onRestoreFullscreen}>To'liq ekranga qaytish</Button>
              </>
            )}
            {mediaError && <p className="mt-4 text-sm text-danger">{mediaError}</p>}
            <p className="mt-6 text-[13px] text-ink-subtle">Savol yashirilgan. Vaqt to'xtamaydi.</p>
          </div>
        </div>
      )}

      <Modal open={!!warning} onClose={() => useAttempt.getState().set({ warning: null })} title="Ogohlantirish"
        footer={<Button onClick={() => useAttempt.getState().set({ warning: null })}>Tushundim</Button>}>
        <p className="text-ink">{warning}</p>
      </Modal>

      <ConfirmModal open={confirmSubmit} onClose={() => setConfirmSubmit(false)} title="Testni yakunlash"
        text={<>Javoblaringiz yuboriladi va qayta o'zgartirib bo'lmaydi. Javob berilmagan savollar hisobga olinmaydi.</>}
        confirmText="Yakunlash" onConfirm={onSubmit} />
    </div>
  );
}

