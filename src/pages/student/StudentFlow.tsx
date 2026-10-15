import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { getRoom } from "../../api/student";
import { toApiError } from "../../api/errors";
import type { EventOutcome, QuestionOut, Result } from "../../api/types";
import { toast } from "../../components/toast";
import StudentShell, { StatusOrb } from "../../components/StudentShell";
import { Button, FullPageSpinner } from "../../components/ui";
import { syncClock } from "../../lib/clock";
import { fmtDateTime } from "../../lib/format";
import { every } from "../../lib/ticker";
import { Socket, wsBase, type Msg } from "../../lib/ws";
import { pipe } from "../../proctoring/live";
import { useProctoring } from "../../proctoring/useProctoring";
import { useAttempt } from "../../stores/attempt";
import { CODE_RE } from "../HomePage";
import ExamPage from "./ExamPage";
import FrozenPage from "./FrozenPage";
import LobbyPage from "./LobbyPage";
import ResultPage from "./ResultPage";
import RoomPage from "./RoomPage";
import { goResult, refreshState } from "./routing";

const DEFAULT_PROCTORING = {
  camera: false, microphone: false, fullscreen: false, block_copy_paste: false, look_away_sec: 3, voice_sec: 2, voice_db: -35,
};

export default function StudentFlow() {
  const { code = "" } = useParams();
  const phase = useAttempt(s => s.phase);
  const error = useAttempt(s => s.error);
  const state = useAttempt(s => s.state);
  const stream = useAttempt(s => s.stream);
  const calibration = useAttempt(s => s.calibration);
  const [videoEl, setVideoEl] = useState<HTMLVideoElement | null>(null);
  const [media, setMedia] = useState({ camera: true, mic: true });
  const [fullscreenLost, setFullscreenLost] = useState(false);
  const [wsOpen, setWsOpen] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  // ---- 1. Kirish: token bor -> state, yo'q -> room ----
  useEffect(() => {
    const st = useAttempt.getState();
    st.init(code);
    if (!CODE_RE.test(code)) {
      st.set({ phase: "error", error: { code: "ROOM_NOT_FOUND", message: "Bunday test topilmadi" } });
      return;
    }
    let cancelled = false;
    (async () => {
      if (useAttempt.getState().token) {
        try {
          await refreshState();
          // lobby uchun retention_days kerak — fonda olamiz
          getRoom(code).then(room => !cancelled && useAttempt.getState().set({ room })).catch(() => {});
          return;
        } catch { /* 401 -> token o'chirildi; boshqa xato -> room orqali tekshiramiz */ }
      }
      try {
        const room = await getRoom(code);
        if (cancelled) return;
        useAttempt.getState().set({ room, phase: "join" });
      } catch (e) {
        if (cancelled) return;
        const err = toApiError(e);
        useAttempt.getState().set({ phase: "error", error: { code: err.code, message: err.message, details: err.details } });
      }
    })();
    return () => { cancelled = true; };
  }, [code]);

  // ---- 2. Natija ekranida hammasini tozalash ----
  useEffect(() => {
    if (phase !== "result") return;
    useAttempt.getState().stopStream();
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  }, [phase]);
  useEffect(() => () => {
    useAttempt.getState().stopStream();
    socketRef.current?.close();
  }, []);

  // ---- 3. Anti-cheat (faqat exam fazasida) ----
  const proctoringConfig = state?.exam.proctoring ?? DEFAULT_PROCTORING;
  const mediaRequired = proctoringConfig.camera || proctoringConfig.microphone;
  const proctorActive = phase === "exam" && (!mediaRequired || !!stream);

  const proctorRef = useProctoring(proctorActive, {
    config: proctoringConfig,
    stream,
    videoEl,
    calibration,
    wsSend: ev => socketRef.current?.send("proctor.event", ev) ?? false,
    onOutcome: (o: EventOutcome) => {
      useAttempt.getState().set({ violationScore: o.violation_score });
      if (o.status === "frozen") useAttempt.getState().set({ phase: "frozen" });
    },
    onFullscreenChange: full => setFullscreenLost(!full),
    onMediaChange: setMedia,
  });

  // ---- 4. WebSocket (exam + frozen) ----
  const wsActive = phase === "exam" || phase === "frozen";
  useEffect(() => {
    if (!wsActive) return;
    let opened = false;
    const sock = new Socket(
      () => `${wsBase}/attempt/?token=${encodeURIComponent(useAttempt.getState().token ?? "")}`,
      (m: Msg) => onMessage(m),
      (open, closeCode) => {
        setWsOpen(open);
        pipe(() => ({ ws: open }));
        console.info(`[ws] ${open ? "ulandi" : `uzildi (${closeCode})`}`);
        if (open) {
          if (opened) refreshState().catch(() => {}); // uzilish paytida savollar o'tib ketgan bo'lishi mumkin
          opened = true;
          proctorRef.current?.resend();
        } else if (closeCode === 4410) {
          refreshState().catch(() => goResult("submitted"));
        } else if (closeCode === 4401) {
          useAttempt.getState().dropToken();
          useAttempt.getState().set({ phase: "join" });
        }
      },
    );
    socketRef.current = sock;
    sock.connect();

    const stopHb = every(10_000, () => {
      const st = useAttempt.getState();
      const h = proctorRef.current?.health() ?? { camera: !!st.stream, mic: !!st.stream, face_engine: false, fps: 0 };
      sock.send("proctor.heartbeat", { question_index: st.question?.index ?? 0, ...h });
    });

    return () => {
      stopHb();
      sock.close();
      if (socketRef.current === sock) socketRef.current = null;
    };
  }, [wsActive]); // eslint-disable-line react-hooks/exhaustive-deps

  function onMessage(m: Msg) {
    const st = useAttempt.getState();
    const d = m.data ?? {};
    console.info("[ws] <-", m.type, d);
    switch (m.type) {
      case "proctor.ack":
        proctorRef.current?.handleOutcome(d as EventOutcome);
        if (typeof d.violation_score === "number") st.set({ violationScore: d.violation_score });
        break;
      case "proctor.warning": {
        const score = d.violation_score ?? st.violationScore;
        const freezeAt = d.freeze_at ?? st.state?.freeze_at;
        st.set({
          violationScore: score,
          warningsCount: d.warnings_count ?? st.warningsCount + 1,
          warning: `${d.message ?? "Qoidabuzarlik aniqlandi"}${freezeAt ? `. Yana ${Math.max(0, freezeAt - score)} ball to'plansa test to'xtatiladi.` : ""}`,
        });
        break;
      }
      case "attempt.frozen":
        st.set({ phase: "frozen", violationScore: d.violation_score ?? st.violationScore });
        break;
      case "attempt.resumed":
        syncClock(d.server_time);
        if (d.question) st.set({ question: d.question as QuestionOut });
        st.set({ phase: "exam", warning: null });
        if (!d.question) refreshState().catch(() => {});
        break;
      case "attempt.rejected":
        goResult("rejected", { note: d.note ?? "" });
        break;
      case "attempt.force_submit":
        goResult("force_submit", { result: (d.result as Result | null) ?? null });
        break;
      case "attempt.kicked":
        goResult("kicked");
        break;
      case "error":
        console.error("[ws] server xatosi:", d);
        pipe(() => ({ lastError: `WS ${d.code ?? ""}: ${d.message ?? JSON.stringify(d)}` }));
        toast(`Anti-cheat xatosi: ${d.message ?? d.code ?? "noma'lum"}`, "error", 6000);
        break;
    }
  }

  // ---- Render ----
  if (phase === "loading") return <FullPageSpinner text="Yuklanmoqda…" />;
  if (phase === "error") return <ErrorScreen code={error?.code} message={error?.message} details={error?.details} />;

  return (
    <div className="min-h-screen bg-bg">
      {phase === "join" && <RoomPage code={code} />}
      {phase === "lobby" && <LobbyPage />}
      {phase === "exam" && (
        <ExamPage
          onVideo={setVideoEl}
          media={media}
          fullscreenLost={fullscreenLost && proctoringConfig.fullscreen}
          onFullscreenRestored={() => setFullscreenLost(false)}
          wsOpen={wsOpen}
        />
      )}
      {phase === "frozen" && <FrozenPage />}
      {phase === "result" && <ResultPage />}
    </div>
  );
}

function ErrorScreen({ code, message, details }: { code?: string; message?: string; details?: any }) {
  let title = message ?? "Xatolik";
  let sub: string | null = null;
  if (code === "ROOM_NOT_FOUND") title = "Bunday test topilmadi";
  else if (code === "EXAM_NOT_OPEN") {
    title = "Test hali ochilmagan yoki yopilgan";
    if (details?.opens_at) sub = `Ochilish vaqti: ${fmtDateTime(details.opens_at)}`;
  } else if (code === "ROOM_FULL") title = "Joy qolmadi";
  else if (details?.retry_after_seconds) { title = "Biroz kuting"; sub = `${details.retry_after_seconds} soniyadan keyin qayta urinib ko'ring`; }
  return (
    <StudentShell glow="sunset">
      <div className="text-center">
        <StatusOrb glow="sunset">!</StatusOrb>
        <h1 className="text-[28px] font-semibold leading-[34px] tracking-tight">{title}</h1>
        {sub && <p className="mt-2 text-ink-muted">{sub}</p>}
        {code === "ROOM_NOT_FOUND" && <p className="mt-2 text-ink-muted">Kodni tekshirib, qaytadan kiriting.</p>}
        <div className="mt-6 flex justify-center gap-2">
          <Button variant="secondary" onClick={() => location.reload()}>Qayta urinish</Button>
          <Link to="/"><Button>Kodni kiritish</Button></Link>
        </div>
      </div>
    </StudentShell>
  );
}
