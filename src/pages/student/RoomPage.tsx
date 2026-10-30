import { useEffect, useRef, useState } from "react";
import { joinRoom } from "../../api/student";
import { toApiError } from "../../api/errors";
import StudentShell from "../../components/StudentShell";
import { Badge, ErrorBox, Spinner } from "../../components/ui";
import { fmtMinutes } from "../../lib/format";
import { decodeGoogleCredential, GOOGLE_CLIENT_ID, loadGsi } from "../../lib/google";
import { useAttempt } from "../../stores/attempt";
import { refreshState } from "./routing";

export default function RoomPage({ code }: { code: string }) {
  const room = useAttempt(s => s.room);
  const btnRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState("");
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;

    async function onCredential(resp: GoogleCredentialResponse) {
      setError("");
      let name = "";
      try { name = decodeGoogleCredential(resp.credential).name; } catch { /* pastda tekshiriladi */ }
      if (name.length < 2) { setError("Google hisobingizda ism topilmadi. Boshqa hisob bilan urinib ko'ring."); return; }
      setBusy(true);
      try {
        const r = await joinRoom(code, name.slice(0, 120), "", resp.credential);
        useAttempt.getState().setToken(r.participant_token);
        await refreshState();
      } catch (e) {
        const err = toApiError(e);
        if (err.code === "ROOM_FULL") setError("Joy qolmadi");
        else if (err.code === "EXAM_NOT_OPEN") setError("Test hali ochilmagan yoki yopilgan");
        else if (err.status === 429) setError(`Biroz kuting${err.details?.retry_after_seconds ? ` (${err.details.retry_after_seconds} s)` : ""}`);
        else setError(err.message);
      } finally {
        if (alive) setBusy(false);
      }
    }

    loadGsi()
      .then(() => {
        if (!alive || !btnRef.current || !window.google) return;
        const gid = window.google.accounts.id;
        gid.initialize({ client_id: GOOGLE_CLIENT_ID, callback: onCredential, ux_mode: "popup" });
        gid.renderButton(btnRef.current, {
          theme: "outline", size: "large", text: "continue_with", shape: "pill", logo_alignment: "center",
          width: Math.min(btnRef.current.offsetWidth || 320, 400),
        });
        setReady(true);
      })
      .catch(e => alive && setError(e.message));

    return () => { alive = false; };
  }, [code]);

  return (
    <StudentShell>
      {room && (
        <div className="mb-7">
          <h1 className="text-[28px] font-semibold leading-[34px] tracking-tight">{room.title}</h1>
          {room.description && <p className="mt-2 whitespace-pre-line text-ink-muted">{room.description}</p>}
          <div className="mt-4 flex flex-wrap gap-2">
            <Badge>{room.questions_count} ta savol</Badge>
            <Badge>{fmtMinutes(room.estimated_time_sec)}</Badge>
            {room.proctoring?.camera && <Badge tone="lilac">Kamera kerak</Badge>}
            {room.proctoring?.microphone && <Badge tone="sky">Mikrofon kerak</Badge>}
            {room.proctoring?.fullscreen && <Badge tone="peach">To'liq ekran</Badge>}
          </div>
        </div>
      )}
      <div className="space-y-4">
        <div className="relative flex min-h-11 justify-center pt-2">
          <div ref={btnRef} className={`flex w-full justify-center ${busy ? "pointer-events-none opacity-50" : ""}`} />
          {(!ready || busy) && (
            <div className="absolute inset-0 flex items-center justify-center"><Spinner /></div>
          )}
        </div>
        <p className="text-center text-[12px] text-ink-subtle">Ism familiyangiz Google hisobingizdan olinadi.</p>
        <ErrorBox>{error}</ErrorBox>
      </div>
    </StudentShell>
  );
}
