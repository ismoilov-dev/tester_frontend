import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef, useState, type KeyboardEvent } from "react";
import { dismissFeedback, submitFeedback } from "../api/admin";
import { toApiError } from "../api/errors";
import type { User } from "../api/types";
import { useFeedbackPrompt } from "../stores/feedback";
import { toast } from "./toast";
import { Button, ErrorBox, Hint, Label, Modal, Textarea } from "./ui";

const MAX_COMMENT = 2000;
const RATING_HINTS = ["", "Juda yomon", "Yomon", "O'rtacha", "Yaxshi", "Ajoyib"];

/** Platforma haqida fikr: 1–5 yulduz + ixtiyoriy izoh. Ochilishini AdminLayout boshqaradi. */
export default function FeedbackModal() {
  const qc = useQueryClient();
  const { wanted, blocked, examId, close } = useFeedbackPrompt();
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Javob berildi yoki voz kechildi — backend endi so'ramaydi
  const finish = () => {
    qc.setQueryData<User>(["me"], u => (u ? { ...u, feedback_due: false } : u));
    close();
  };

  const send = useMutation({
    mutationFn: () => submitFeedback({
      rating,
      comment: comment.trim(),
      ...(examId != null ? { exam_id: examId } : {}),
    }),
    onSuccess: () => { toast("Rahmat! Fikringiz qabul qilindi", "success"); finish(); },
    onError: e => {
      const err = toApiError(e);
      if (err.code === "FEEDBACK_EXISTS") { finish(); return; }
      // Kiritilgan rating va izoh state'da qoladi — qayta yuborish mumkin
      const fields = Object.values(err.details ?? {}).flat().filter(v => typeof v === "string");
      setError(fields.length ? fields.join(" ") : err.status === 0 ? "Internet aloqasi yo'q. Qayta urinib ko'ring." : err.message);
    },
  });
  const skip = useMutation({
    mutationFn: dismissFeedback,
    onSuccess: finish,
    onError: e => {
      if (toApiError(e).code === "FEEDBACK_EXISTS") { finish(); return; }
      // Saqlanmadi — shu sessiyada yopamiz, keyingi kirishda backend yana so'raydi
      close();
    },
  });

  const busy = send.isPending || skip.isPending;
  const onClose = () => { if (!busy) close(); };

  return (
    <Modal open={wanted && !blocked} onClose={onClose} title="Fikringiz biz uchun muhim"
      footer={<>
        <Button variant="ghost" onClick={() => skip.mutate()} loading={skip.isPending} disabled={send.isPending}>O'tkazib yuborish</Button>
        <Button onClick={() => { setError(null); send.mutate(); }} loading={send.isPending} disabled={!rating || skip.isPending}>Yuborish</Button>
      </>}>
      <p className="text-ink-muted">Birinchi testingiz tayyor! Platformadan foydalanish qanday bo'ldi?</p>

      <div className="mt-5 flex flex-col items-center gap-1.5">
        <Stars value={rating} hover={hover} onHover={setHover} onChange={v => { setRating(v); setError(null); }} disabled={busy} />
        <p className="h-5 text-[13px] text-ink-muted" aria-live="polite">{RATING_HINTS[hover || rating]}</p>
      </div>

      <label className="mt-3 block">
        <Label hint="(ixtiyoriy)">Izoh</Label>
        <Textarea rows={4} maxLength={MAX_COMMENT} value={comment} disabled={busy}
          onChange={e => setComment(e.target.value)} placeholder="Nima yoqdi, nimani yaxshilash kerak?" />
      </label>
      <Hint>{comment.length} / {MAX_COMMENT}</Hint>

      {error && <div className="mt-3"><ErrorBox>{error}</ErrorBox></div>}
    </Modal>
  );
}

function Stars({ value, hover, onHover, onChange, disabled }:
  { value: number; hover: number; onHover: (v: number) => void; onChange: (v: number) => void; disabled?: boolean }) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const shown = hover || value;

  // Radio guruh kabi: strelkalar bilan tanlash, fokus tanlangan yulduzga ko'chadi
  const onKey = (e: KeyboardEvent, n: number) => {
    const next = e.key === "ArrowRight" || e.key === "ArrowUp" ? Math.min(5, n + 1)
      : e.key === "ArrowLeft" || e.key === "ArrowDown" ? Math.max(1, n - 1)
      : e.key === "Home" ? 1 : e.key === "End" ? 5 : null;
    if (next === null) return;
    e.preventDefault();
    onChange(next);
    refs.current[next - 1]?.focus();
  };

  return (
    <div role="radiogroup" aria-label="Baho" className="flex gap-1" onMouseLeave={() => onHover(0)}>
      {[1, 2, 3, 4, 5].map(n => (
        <button key={n} ref={el => { refs.current[n - 1] = el; }} type="button" role="radio"
          aria-checked={value === n} aria-label={`${n} yulduz`} disabled={disabled}
          tabIndex={value ? (value === n ? 0 : -1) : n === 1 ? 0 : -1}
          onClick={() => onChange(n)} onMouseEnter={() => onHover(n)} onFocus={() => onHover(0)} onKeyDown={e => onKey(e, n)}
          className={`rounded-full p-1 transition hover:scale-110 focus-visible:shadow-[0_0_0_3px_var(--focus)] focus-visible:outline-none disabled:cursor-not-allowed disabled:hover:scale-100 ${n <= shown ? "text-amber-400" : "text-ink-subtle/40"}`}>
          <svg width="36" height="36" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d="M12 2.5l2.94 5.96 6.58.96-4.76 4.64 1.12 6.55L12 17.52l-5.88 3.09 1.12-6.55L2.48 9.42l6.58-.96L12 2.5z" />
          </svg>
        </button>
      ))}
    </div>
  );
}
