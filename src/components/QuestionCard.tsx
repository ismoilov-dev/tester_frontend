import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useMutation } from "@tanstack/react-query";
import { useRef, useState } from "react";
import {
  createQuestion, deleteQuestion, deleteQuestionImage, patchQuestion, uploadQuestionImage,
} from "../api/admin";
import { errMsg, toApiError } from "../api/errors";
import type { Question, QuestionInput, TimingMode } from "../api/types";
import { toast } from "./toast";
import { Badge, Button, ConfirmModal, Input, Textarea } from "./ui";

type Draft = QuestionInput;
const QUICK_TIMES = [15, 30, 60, 120];

export const emptyDraft = (): Draft => ({
  text: "", time_limit_sec: 30, points: "1",
  options: [{ text: "", is_correct: true }, { text: "", is_correct: false }],
});

const fromQuestion = (q: Question): Draft => ({
  text: q.text, time_limit_sec: q.time_limit_sec, points: String(Number(q.points)),
  options: [...q.options].sort((a, b) => a.order - b.order).map(o => ({ text: o.text, is_correct: o.is_correct })),
});

function validate(d: Draft): string | null {
  if (!d.text.trim()) return "Savol matni bo'sh";
  if (d.options.length < 2) return "Kamida 2 ta variant kerak";
  if (d.options.some(o => !o.text.trim())) return "Variant matni bo'sh";
  if (d.options.filter(o => o.is_correct).length !== 1) return "Bitta to'g'ri variantni belgilang";
  if (d.time_limit_sec < 10 || d.time_limit_sec > 1800) return "Vaqt 10–1800 soniya oralig'ida";
  if (!(Number(d.points) > 0)) return "Ball musbat bo'lishi kerak";
  return null;
}

interface Props {
  examId: number;
  index: number;
  question: Question | null; // null — yangi savol
  timingMode: TimingMode;
  readOnly: boolean;
  serverErrors?: string[];
  onSaved: () => void;
  onCancelNew?: () => void;
}

export default function QuestionCard({ examId, index, question, timingMode, readOnly, serverErrors, onSaved, onCancelNew }: Props) {
  const initial = question ? fromQuestion(question) : emptyDraft();
  const [draft, setDraft] = useState<Draft>(initial);
  const [base, setBase] = useState(JSON.stringify(initial));
  const [error, setError] = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const dirty = JSON.stringify(draft) !== base;

  const sortable = useSortable({ id: question?.id ?? `new-${index}`, disabled: !question || readOnly });
  const style = { transform: CSS.Transform.toString(sortable.transform), transition: sortable.transition };

  const onLockError = (e: unknown) => {
    const err = toApiError(e);
    const msg = err.code === "EXAM_LOCKED" ? "Test boshlangan, savollarni o'zgartirib bo'lmaydi" : err.message;
    setError(msg);
    toast(msg, "error");
  };

  const save = useMutation({
    mutationFn: () => {
      const payload = { ...draft, text: draft.text.trim(), options: draft.options.map(o => ({ ...o, text: o.text.trim() })) };
      // options yuborilsa to'liq almashtiriladi — hammasini yuboramiz
      return question ? patchQuestion(question.id, payload) : createQuestion(examId, payload);
    },
    onSuccess: q => {
      const d = fromQuestion(q);
      setDraft(d); setBase(JSON.stringify(d)); setError(null);
      toast("Saqlandi", "success");
      onSaved();
    },
    onError: onLockError,
  });
  const del = useMutation({
    mutationFn: () => deleteQuestion(question!.id),
    onSuccess: () => { setConfirmDel(false); onSaved(); },
    onError: e => { setConfirmDel(false); onLockError(e); },
  });
  const img = useMutation({
    mutationFn: async (f: File | null) => { if (f) await uploadQuestionImage(question!.id, f); else await deleteQuestionImage(question!.id); },
    onSuccess: () => onSaved(),
    onError: e => toast(errMsg(e), "error"),
  });

  function onSave() {
    const v = validate(draft);
    if (v) return setError(v);
    save.mutate();
  }

  function setOption(i: number, patch: Partial<Draft["options"][number]>) {
    setDraft(d => ({
      ...d,
      options: d.options.map((o, j) => (j === i ? { ...o, ...patch } : patch.is_correct ? { ...o, is_correct: false } : o)),
    }));
  }
  function moveOption(i: number, dir: -1 | 1) {
    setDraft(d => {
      const opts = [...d.options];
      const j = i + dir;
      if (j < 0 || j >= opts.length) return d;
      [opts[i], opts[j]] = [opts[j], opts[i]];
      return { ...d, options: opts };
    });
  }
  function removeOption(i: number) {
    setDraft(d => {
      const opts = d.options.filter((_, j) => j !== i);
      if (!opts.some(o => o.is_correct) && opts[0]) opts[0] = { ...opts[0], is_correct: true };
      return { ...d, options: opts };
    });
  }

  function onFile(f: File | undefined) {
    if (!f) return;
    if (f.size > 2 * 1024 * 1024) return toast("Rasm 2 MB dan oshmasin", "error");
    img.mutate(f);
  }

  const hasServerErrors = !!serverErrors?.length;

  return (
    <div ref={sortable.setNodeRef} style={style}
      className={`rounded-xl border bg-bg p-6 transition ${hasServerErrors ? "border-danger" : dirty || !question ? "border-ink" : "border-border"}`}>
      <div className="mb-3 flex items-center gap-2">
        {question && !readOnly && (
          <button {...sortable.attributes} {...sortable.listeners} className="cursor-grab touch-none px-1 text-ink-subtle hover:text-ink" title="Sudrab tartiblash">⋮⋮</button>
        )}
        <span className="text-sm font-semibold">{index + 1}-savol</span>
        {!question && <Badge tone="lilac">yangi</Badge>}
        {dirty && question && <Badge tone="warning">saqlanmagan</Badge>}
        <div className="ml-auto flex gap-1">
          {!readOnly && question && (
            <Button variant="ghost" size="sm" className="text-danger" onClick={() => setConfirmDel(true)}>O'chirish</Button>
          )}
          {!question && onCancelNew && (
            <Button variant="ghost" size="sm" onClick={onCancelNew}>Bekor qilish</Button>
          )}
        </div>
      </div>

      <Textarea rows={2} placeholder="Savol matni" value={draft.text} disabled={readOnly}
        onChange={e => setDraft(d => ({ ...d, text: e.target.value }))} />

      {question && (
        <div className="mt-2 flex flex-wrap items-center gap-3">
          {question.image && <img src={question.image} alt="" className="max-h-40 rounded-md border border-border" />}
          {!readOnly && (
            <div className="flex gap-2 text-sm">
              <input ref={fileRef} type="file" accept="image/*" hidden onChange={e => { onFile(e.target.files?.[0]); e.target.value = ""; }} />
              <Button variant="ghost" size="sm" loading={img.isPending} onClick={() => fileRef.current?.click()}>
                {question.image ? "Rasmni almashtirish" : "+ Rasm qo'shish"}
              </Button>
              {question.image && <Button variant="ghost" size="sm" className="text-danger" onClick={() => img.mutate(null)}>Rasmni o'chirish</Button>}
            </div>
          )}
        </div>
      )}

      <p className="mt-5 mb-2 text-[13px] text-ink-muted">Variantlar — to'g'ri javobni doira bilan belgilang</p>
      <div className="space-y-2">
        {draft.options.map((o, i) => (
          <div key={i} className="flex items-center gap-2">
            <input type="radio" className="h-4 w-4 accent-[var(--success)]" checked={o.is_correct} disabled={readOnly}
              onChange={() => setOption(i, { is_correct: true })} title="To'g'ri javob" />
            <Input value={o.text} placeholder={`Variant ${i + 1}`} disabled={readOnly}
              className={o.is_correct ? "border-success bg-mint/40" : ""}
              onChange={e => setOption(i, { text: e.target.value })} />
            {!readOnly && (
              <div className="flex shrink-0 text-ink-subtle">
                <button title="Yuqoriga" className="px-1.5 hover:text-ink disabled:opacity-30" disabled={i === 0} onClick={() => moveOption(i, -1)}>↑</button>
                <button title="Pastga" className="px-1.5 hover:text-ink disabled:opacity-30" disabled={i === draft.options.length - 1} onClick={() => moveOption(i, 1)}>↓</button>
                <button title="O'chirish" className="px-1.5 hover:text-danger disabled:opacity-30" disabled={draft.options.length <= 2} onClick={() => removeOption(i)}>✕</button>
              </div>
            )}
          </div>
        ))}
        {!readOnly && (
          <button className="text-sm font-medium text-ink-muted hover:text-ink"
            onClick={() => setDraft(d => ({ ...d, options: [...d.options, { text: "", is_correct: false }] }))}>
            + Variant qo'shish
          </button>
        )}
      </div>

      <div className="mt-5 flex flex-wrap items-end gap-4 border-t border-border pt-5">
        {timingMode === "per_question" && (
          <div>
            <span className="mb-1.5 block text-[13px] text-ink-muted">Vaqt (soniya)</span>
            <div className="flex items-center gap-1">
              <Input type="number" min={10} max={1800} className="h-9 w-20" value={draft.time_limit_sec} disabled={readOnly}
                onChange={e => setDraft(d => ({ ...d, time_limit_sec: Number(e.target.value) }))} />
              {!readOnly && QUICK_TIMES.map(t => (
                <button key={t} onClick={() => setDraft(d => ({ ...d, time_limit_sec: t }))}
                  className={`h-9 rounded-full px-3 text-xs font-medium transition ${draft.time_limit_sec === t ? "bg-primary text-on-primary" : "bg-surface-100 hover:bg-surface-200"}`}>{t}</button>
              ))}
            </div>
          </div>
        )}
        <div>
          <span className="mb-1.5 block text-[13px] text-ink-muted">Ball</span>
          <Input type="number" min={0.5} step={0.5} className="h-9 w-20" value={draft.points} disabled={readOnly}
            onChange={e => setDraft(d => ({ ...d, points: e.target.value }))} />
        </div>
        {!readOnly && (dirty || !question) && (
          <div className="ml-auto flex gap-2">
            {question && <Button variant="secondary" onClick={() => { setDraft(JSON.parse(base)); setError(null); }}>Bekor</Button>}
            <Button onClick={onSave} loading={save.isPending}>Saqlash</Button>
          </div>
        )}
      </div>

      {(error || hasServerErrors) && (
        <div className="mt-3 space-y-1 text-sm text-danger">
          {error && <p>{error}</p>}
          {serverErrors?.map((m, i) => <p key={i}>• {m}</p>)}
        </div>
      )}

      <ConfirmModal open={confirmDel} onClose={() => setConfirmDel(false)} danger title="Savolni o'chirish"
        text="Bu savol butunlay o'chiriladi." confirmText="O'chirish" loading={del.isPending} onConfirm={() => del.mutate()} />
    </div>
  );
}
