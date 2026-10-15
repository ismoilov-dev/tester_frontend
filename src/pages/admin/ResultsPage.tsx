import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { downloadResults, getResults } from "../../api/admin";
import { errMsg } from "../../api/errors";
import { toast } from "../../components/toast";
import { Badge, Button, EmptyState, ErrorBox, FullPageSpinner, Stat } from "../../components/ui";
import { fmtDateTime, fmtNum, num } from "../../lib/format";
import { STATUS_HINTS, STATUS_LABELS, STATUS_TONES } from "../../lib/labels";
import { useExam } from "./ExamLayout";

export default function ResultsPage() {
  const { exam } = useExam();
  const q = useQuery({ queryKey: ["results", exam.id], queryFn: () => getResults(exam.id), refetchInterval: exam.status === "open" ? 15_000 : false });
  const [downloading, setDownloading] = useState(false);

  const summary = useMemo(() => {
    const rows = q.data ?? [];
    const done = rows.filter(r => r.status === "submitted");
    const pcts = done.map(r => r.percent ?? (num(r.max_score) ? (num(r.score) / num(r.max_score)) * 100 : 0));
    return {
      done: done.length,
      total: rows.length,
      avg: pcts.length ? Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length) : null,
      flagged: rows.filter(r => r.violation_score > 0).length,
    };
  }, [q.data]);

  async function onExport() {
    setDownloading(true);
    try { await downloadResults(exam.id, exam.code); } catch (e) { toast(errMsg(e), "error"); }
    setDownloading(false);
  }

  if (q.isLoading) return <FullPageSpinner />;
  if (q.isError) return <ErrorBox>{errMsg(q.error)}</ErrorBox>;
  const rows = q.data!;

  if (rows.length === 0) {
    return <EmptyState title="Hali natija yo'q" text="O'quvchilar testni topshirgach, natijalar shu yerda paydo bo'ladi." />;
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Topshirgan" value={`${summary.done} / ${summary.total}`} />
        <Stat label="O'rtacha natija" value={summary.avg === null ? "—" : `${summary.avg}%`} />
        <Stat label="Qoidabuzarlik bilan" value={summary.flagged} tone={summary.flagged ? "warning" : undefined} hint="tekshirib ko'ring" />
        <div className="flex flex-col justify-center gap-2 rounded-lg border border-border px-5 py-4">
          <Button loading={downloading} onClick={onExport}>Excel yuklab olish</Button>
          <p className="text-center text-[13px] text-ink-subtle">.xlsx fayl</p>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full min-w-[820px] text-sm">
          <thead>
            <tr className="text-left text-[13px] text-ink-muted">
              <th className="px-4 py-3 font-medium">#</th>
              <th className="px-4 py-3 font-medium">O'quvchi</th>
              <th className="px-4 py-3 font-medium">Ball</th>
              <th className="px-4 py-3 font-medium">Qoidabuzarlik</th>
              <th className="px-4 py-3 font-medium">Holat</th>
              <th className="px-4 py-3 font-medium">Topshirgan vaqti</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const pct = r.percent ?? (num(r.max_score) ? (num(r.score) / num(r.max_score)) * 100 : null);
              return (
                <tr key={r.id} className="border-t border-border hover:bg-surface-100">
                  <td className="px-4 py-3 font-mono text-xs text-ink-subtle">{i + 1}</td>
                  <td className="px-4 py-3">
                    <Link to={`/admin/participants/${r.id}`} className="font-medium hover:underline">{r.full_name}</Link>
                    <div className="flex items-center gap-1.5 text-[13px] text-ink-muted">
                      {r.group || "—"}
                      {r.is_duplicate && <Badge tone="peach" className="h-5">takror kirgan</Badge>}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-semibold tabular-nums">{fmtNum(r.score)}</span>
                    <span className="text-ink-muted tabular-nums"> / {fmtNum(r.max_score)}</span>
                    {pct !== null && <span className="ml-2 text-[13px] text-ink-subtle tabular-nums">{Math.round(pct)}%</span>}
                  </td>
                  <td className="px-4 py-3 tabular-nums">
                    {r.violation_score > 0
                      ? <span className="text-warning">{r.violation_score} ball{r.warnings_count ? ` · ${r.warnings_count} ogohl.` : ""}</span>
                      : <span className="text-ink-subtle">yo'q</span>}
                  </td>
                  <td className="px-4 py-3">
                    {r.decision ? (
                      <Badge tone={r.decision === "accepted" ? "success" : "danger"} dot>{r.decision === "accepted" ? "Qabul qilingan" : "Rad etilgan"}</Badge>
                    ) : <span title={STATUS_HINTS[r.status]}><Badge tone={STATUS_TONES[r.status]} dot>{STATUS_LABELS[r.status]}</Badge></span>}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-ink-muted">{fmtDateTime(r.submitted_at)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
