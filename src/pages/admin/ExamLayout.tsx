import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, Outlet, useNavigate, useOutletContext, useParams } from "react-router-dom";
import { archiveExam, closeExam, deleteExam, duplicateExam, getExam, publishExam } from "../../api/admin";
import { errMsg, toApiError } from "../../api/errors";
import type { ExamDetail, PublishResponse } from "../../api/types";
import PublishModal from "../../components/PublishModal";
import { toast } from "../../components/toast";
import { Badge, Button, ConfirmModal, ErrorBox, FullPageSpinner, Menu, TabNav } from "../../components/ui";
import { copyText, fmtMinutes, fmtNum } from "../../lib/format";
import { EXAM_STATUS_HINTS, EXAM_STATUS_LABELS, EXAM_STATUS_TONES } from "../../lib/labels";

export type PublishErrors = { byId: Record<number, string[]>; general: string[] };
export interface ExamCtx { exam: ExamDetail; refetch: () => void; pubErrors: PublishErrors | null; }
export const useExam = () => useOutletContext<ExamCtx>();

/** 422 PUBLISH_VALIDATION details.questions[] -> savol id (yoki index) bo'yicha xabarlar */
function parsePublishErrors(details: any, exam: ExamDetail): PublishErrors {
  const byId: Record<number, string[]> = {};
  const general: string[] = [];
  const toList = (v: any): string[] =>
    v == null ? [] : Array.isArray(v) ? v.flatMap(toList) : typeof v === "object" ? Object.values(v).flatMap(toList) : [String(v)];
  for (const item of details?.questions ?? []) {
    const id = item?.id ?? item?.question_id ?? (typeof item?.index === "number" ? exam.questions[item.index]?.id : undefined);
    const msgs = toList(item?.errors ?? item?.message ?? item?.messages ?? item?.error ?? item);
    if (id) (byId[id] ??= []).push(...msgs); else general.push(...msgs);
  }
  for (const [k, v] of Object.entries(details ?? {})) if (k !== "questions") general.push(...toList(v));
  return { byId, general };
}

type Confirm = "close" | "archive" | "delete" | null;

export default function ExamLayout() {
  const { id } = useParams();
  const qc = useQueryClient();
  const nav = useNavigate();
  const q = useQuery({ queryKey: ["exam", id], queryFn: () => getExam(id!) });
  const [published, setPublished] = useState<PublishResponse | null>(null);
  const [pubErrors, setPubErrors] = useState<PublishErrors | null>(null);
  const [confirm, setConfirm] = useState<Confirm>(null);

  const refetch = () => { qc.invalidateQueries({ queryKey: ["exam", id] }); qc.invalidateQueries({ queryKey: ["exams"] }); };

  const publish = useMutation({
    mutationFn: () => publishExam(id!),
    onSuccess: r => { setPubErrors(null); setPublished(r); refetch(); },
    onError: e => {
      const err = toApiError(e);
      if (err.code === "PUBLISH_VALIDATION" && q.data) {
        setPubErrors(parsePublishErrors(err.details, q.data));
        toast("Nashr qilib bo'lmadi — qizil belgilangan savollarni tuzating", "error");
        nav(`/admin/exams/${id}`);
      } else toast(err.message, "error");
    },
  });
  const action = useMutation({
    mutationFn: (a: Exclude<Confirm, null>) =>
      a === "close" ? closeExam(id!) : a === "archive" ? archiveExam(id!) : deleteExam(id!),
    onSuccess: (_, a) => {
      setConfirm(null);
      if (a === "delete") { qc.invalidateQueries({ queryKey: ["exams"] }); nav("/admin"); return; }
      refetch();
      toast(a === "close" ? "Test yopildi" : "Arxivlandi", "success");
    },
    onError: e => { setConfirm(null); toast(errMsg(e), "error"); },
  });
  const dup = useMutation({
    mutationFn: () => duplicateExam(id!),
    onSuccess: e => { qc.invalidateQueries({ queryKey: ["exams"] }); toast("Nusxa yaratildi — bu yangi qoralama", "success"); nav(`/admin/exams/${e.id}`); },
    onError: e => toast(errMsg(e), "error"),
  });

  if (q.isLoading) return <FullPageSpinner />;
  if (q.isError) return <ErrorBox>{errMsg(q.error)}</ErrorBox>;
  const exam = q.data!;
  const st = exam.status;
  const noQuestions = exam.questions.length === 0;
  const base = `/admin/exams/${exam.id}`;

  // Holatga qarab bitta asosiy harakat
  const primary =
    st === "draft" ? (
      <Button size="md" loading={publish.isPending} disabled={noQuestions} onClick={() => publish.mutate()}
        title={noQuestions ? "Avval kamida bitta savol qo'shing" : undefined}>
        Nashr qilish
      </Button>
    ) : st === "open" && exam.code && exam.share_url ? (
      <Button onClick={() => setPublished({ id: exam.id, code: exam.code!, share_url: exam.share_url!, status: st })}>Linkni ulashish</Button>
    ) : null;

  return (
    <div>
      <Link to="/admin" className="text-[13px] text-ink-muted hover:text-ink">← Barcha testlar</Link>

      <header className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-[28px] font-semibold leading-[34px] tracking-tight">{exam.title}</h1>
            <Badge tone={EXAM_STATUS_TONES[st]} dot>{EXAM_STATUS_LABELS[st]}</Badge>
          </div>
          <p className="mt-1 text-ink-muted">{EXAM_STATUS_HINTS[st]}</p>
          <p className="mt-2 text-[13px] text-ink-subtle">
            {exam.question_count} ta savol · {fmtNum(exam.total_points)} ball · {fmtMinutes(exam.estimated_time_sec)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {st === "open" && exam.code && (
            <button
              onClick={async () => toast(await copyText(exam.share_url ?? exam.code!) ? "Link nusxalandi" : "Nusxalab bo'lmadi")}
              className="h-10 rounded-full bg-surface-100 px-4 font-mono text-sm tracking-wider transition hover:bg-surface-200"
              title="Linkni nusxalash">
              {exam.code}
            </button>
          )}
          {primary}
          <Menu items={[
            { label: "Nusxa olish", onClick: () => dup.mutate() },
            { label: "Testni yopish", onClick: () => setConfirm("close"), hidden: st !== "open", danger: true },
            { label: "Arxivlash", onClick: () => setConfirm("archive"), hidden: st !== "closed" },
            { label: "O'chirish", onClick: () => setConfirm("delete"), hidden: st !== "draft", danger: true },
          ]} />
        </div>
      </header>

      {st === "draft" && <DraftSteps hasQuestions={!noQuestions} />}
      {pubErrors?.general.length ? <div className="mt-4"><ErrorBox>{pubErrors.general.map((m, i) => <p key={i}>{m}</p>)}</ErrorBox></div> : null}

      <div className="mt-6">
        <TabNav tabs={[
          { to: base, end: true, label: "Savollar", badge: <span className="text-ink-subtle">{exam.questions.length}</span> },
          { to: `${base}/settings`, label: "Sozlamalar" },
          ...(st !== "draft" ? [
            { to: `${base}/live`, label: "Live", badge: st === "open" ? <span className="h-2 w-2 animate-pulse rounded-full bg-success" /> : undefined },
            { to: `${base}/results`, label: "Natijalar" },
          ] : []),
        ]} />
      </div>

      <div className="mt-6">
        <Outlet context={{ exam, refetch, pubErrors } satisfies ExamCtx} />
      </div>

      {published && <PublishModal open onClose={() => setPublished(null)} code={published.code} shareUrl={published.share_url} />}
      <ConfirmModal open={confirm === "close"} onClose={() => setConfirm(null)} danger title="Testni yopish"
        text="Test hozir ishlayotganlar uchun ham yakunlanadi — javoblari shu holatda topshiriladi. Yangi kirish yopiladi."
        confirmText="Yopish" loading={action.isPending} onConfirm={() => action.mutate("close")} />
      <ConfirmModal open={confirm === "archive"} onClose={() => setConfirm(null)} title="Arxivlash"
        text="Test ro'yxatda «Arxiv» bo'limiga o'tadi. Natijalar saqlanib qoladi." confirmText="Arxivlash"
        loading={action.isPending} onConfirm={() => action.mutate("archive")} />
      <ConfirmModal open={confirm === "delete"} onClose={() => setConfirm(null)} danger title="Testni o'chirish"
        text="Qoralama butunlay o'chiriladi." confirmText="O'chirish"
        loading={action.isPending} onConfirm={() => action.mutate("delete")} />
    </div>
  );
}

/** Qoralama uchun: keyingi qadamlar ketma-ketligi. */
function DraftSteps({ hasQuestions }: { hasQuestions: boolean }) {
  const steps = [
    { done: hasQuestions, text: "Savollar qo'shing" },
    { done: false, text: "Sozlamalarni tekshiring" },
    { done: false, text: "«Nashr qilish» ni bosing va kodni o'quvchilarga yuboring" },
  ];
  return (
    <ol className="gradient-aurora mt-5 flex flex-col gap-2 rounded-lg px-5 py-4 text-sm sm:flex-row sm:gap-6">
      {steps.map((s, i) => (
        <li key={i} className="flex items-center gap-2">
          <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${s.done ? "bg-primary text-on-primary" : "bg-bg/70 text-ink"}`}>
            {s.done ? "✓" : i + 1}
          </span>
          <span className={s.done ? "text-ink-muted line-through" : ""}>{s.text}</span>
        </li>
      ))}
    </ol>
  );
}
