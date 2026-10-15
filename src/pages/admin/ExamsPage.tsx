import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createExam, deleteExam, duplicateExam, listExams } from "../../api/admin";
import { errMsg } from "../../api/errors";
import type { Exam, ExamStatus } from "../../api/types";
import { toast } from "../../components/toast";
import { Badge, Button, ConfirmModal, EmptyState, ErrorBox, FullPageSpinner, Input, Label, Menu, Modal, Segmented } from "../../components/ui";
import { copyText, fmtMinutes } from "../../lib/format";
import { EXAM_STATUS_LABELS, EXAM_STATUS_TONES } from "../../lib/labels";

type Filter = "" | ExamStatus;
const FILTERS: { value: Filter; label: string }[] = [
  { value: "", label: "Hammasi" }, { value: "draft", label: "Qoralama" }, { value: "open", label: "Ochiq" },
  { value: "closed", label: "Yopilgan" }, { value: "archived", label: "Arxiv" },
];
const PAGE_SIZE = 20;

export default function ExamsPage() {
  const [status, setStatus] = useState<Filter>("");
  const [page, setPage] = useState(1);
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [toDelete, setToDelete] = useState<Exam | null>(null);
  const nav = useNavigate();
  const qc = useQueryClient();

  const q = useQuery({
    queryKey: ["exams", status, page],
    queryFn: () => listExams({ status: status || undefined, page }),
    placeholderData: keepPreviousData,
  });

  const create = useMutation({
    mutationFn: () => createExam(title.trim()),
    onSuccess: e => { qc.invalidateQueries({ queryKey: ["exams"] }); nav(`/admin/exams/${e.id}`); },
  });
  const dup = useMutation({
    mutationFn: (id: number) => duplicateExam(id),
    onSuccess: e => { qc.invalidateQueries({ queryKey: ["exams"] }); toast("Nusxa yaratildi — bu yangi qoralama", "success"); nav(`/admin/exams/${e.id}`); },
    onError: e => toast(errMsg(e), "error"),
  });
  const del = useMutation({
    mutationFn: (id: number) => deleteExam(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["exams"] }); setToDelete(null); toast("O'chirildi", "success"); },
    onError: e => toast(errMsg(e), "error"),
  });

  const pages = q.data ? Math.max(1, Math.ceil(q.data.count / PAGE_SIZE)) : 1;
  const openNew = () => { setTitle(""); setCreating(true); };

  return (
    <div>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-semibold leading-[34px] tracking-tight">Testlar</h1>
          <p className="mt-1 text-ink-muted">Test yarating, nashr qiling va o'quvchilarni real vaqtda kuzating.</p>
        </div>
        <Button onClick={openNew}>Yangi test</Button>
      </div>

      <div className="mb-6">
        <Segmented value={status} onChange={v => { setStatus(v); setPage(1); }} options={FILTERS} />
      </div>

      {q.isLoading ? <FullPageSpinner /> : q.isError ? <ErrorBox>{errMsg(q.error)}</ErrorBox> : q.data!.results.length === 0 ? (
        status ? <EmptyState title={`«${EXAM_STATUS_LABELS[status]}» bo'limida test yo'q`} />
          : <EmptyState title="Birinchi testingizni yarating" text="Nom bering, savollar qo'shing va nashr qiling — o'quvchilar kod orqali kiradi."
              action={<Button onClick={openNew}>Yangi test</Button>} />
      ) : (
        <>
          <div className="overflow-hidden rounded-xl border border-border">
            {q.data!.results.map((e, i) => (
              <ExamRow key={e.id} exam={e} first={i === 0}
                onOpen={path => nav(`/admin/exams/${e.id}${path}`)}
                onDuplicate={() => dup.mutate(e.id)} onDelete={() => setToDelete(e)} />
            ))}
          </div>
          {pages > 1 && (
            <div className="mt-6 flex items-center justify-center gap-3 text-sm">
              <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>← Oldingi</Button>
              <span className="text-ink-muted">{page} / {pages}</span>
              <Button variant="secondary" size="sm" disabled={page >= pages} onClick={() => setPage(p => p + 1)}>Keyingi →</Button>
            </div>
          )}
        </>
      )}

      <Modal open={creating} onClose={() => setCreating(false)} title="Yangi test"
        footer={<>
          <Button variant="secondary" onClick={() => setCreating(false)}>Bekor qilish</Button>
          <Button disabled={!title.trim()} loading={create.isPending} onClick={() => create.mutate()}>Yaratish</Button>
        </>}>
        <label className="block">
          <Label>Test nomi</Label>
          <Input autoFocus placeholder="Masalan: Matematika, 9-sinf" value={title} onChange={e => setTitle(e.target.value)}
            onKeyDown={e => e.key === "Enter" && title.trim() && create.mutate()} />
        </label>
        <p className="mt-2 text-[13px] text-ink-muted">Keyin savollar va sozlamalarni qo'shasiz.</p>
        {create.isError && <div className="mt-3"><ErrorBox>{errMsg(create.error)}</ErrorBox></div>}
      </Modal>

      <ConfirmModal open={!!toDelete} onClose={() => setToDelete(null)} danger title="Testni o'chirish"
        text={<>«{toDelete?.title}» butunlay o'chiriladi.</>} confirmText="O'chirish"
        loading={del.isPending} onConfirm={() => toDelete && del.mutate(toDelete.id)} />
    </div>
  );
}

/** Bir qator = bitta test: nomi, holati va holatga mos BITTA asosiy harakat. */
function ExamRow({ exam: e, first, onOpen, onDuplicate, onDelete }:
  { exam: Exam; first: boolean; onOpen: (path: string) => void; onDuplicate: () => void; onDelete: () => void }) {
  const main =
    e.status === "draft" ? { label: "Tahrirlash", path: "" }
      : e.status === "open" ? { label: "Live kuzatish", path: "/live" }
        : { label: "Natijalar", path: "/results" };

  return (
    <div onClick={() => onOpen(main.path)}
      className={`flex cursor-pointer flex-wrap items-center gap-x-6 gap-y-3 px-5 py-4 transition hover:bg-surface-100 ${first ? "" : "border-t border-border"}`}>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-3">
          <p className="truncate font-medium">{e.title}</p>
          <Badge tone={EXAM_STATUS_TONES[e.status]} dot>{EXAM_STATUS_LABELS[e.status]}</Badge>
        </div>
        <p className="mt-0.5 text-[13px] text-ink-muted">
          {e.question_count} ta savol · {fmtMinutes(e.estimated_time_sec)}
        </p>
      </div>
      {e.status === "open" && e.code && (
        <button onClick={async ev => { ev.stopPropagation(); toast(await copyText(e.share_url ?? e.code!) ? "Link nusxalandi" : "Nusxalab bo'lmadi"); }}
          className="rounded-full bg-surface-100 px-3 py-1 font-mono text-xs tracking-wider transition hover:bg-surface-200" title="Linkni nusxalash">
          {e.code}
        </button>
      )}
      <div className="flex items-center gap-1" onClick={ev => ev.stopPropagation()}>
        <Button variant="secondary" size="sm" onClick={() => onOpen(main.path)}>{main.label}</Button>
        <Menu items={[
          { label: "Savollar", onClick: () => onOpen(""), hidden: e.status === "draft" },
          { label: "Natijalar", onClick: () => onOpen("/results"), hidden: e.status === "draft" || main.path === "/results" },
          { label: "Nusxa olish", onClick: onDuplicate },
          { label: "O'chirish", onClick: onDelete, hidden: e.status !== "draft", danger: true },
        ]} />
      </div>
    </div>
  );
}
