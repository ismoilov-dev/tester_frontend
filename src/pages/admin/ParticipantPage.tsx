import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { getParticipant } from "../../api/admin";
import { errMsg } from "../../api/errors";
import { useParticipantAction } from "../../components/ParticipantActions";
import { Badge, Button, ErrorBox, FullPageSpinner, Modal, Stat } from "../../components/ui";
import { fmtDateTime, fmtNum } from "../../lib/format";
import { EVENT_LABELS, STATUS_HINTS, STATUS_LABELS, STATUS_TONES } from "../../lib/labels";

const INFO_LABELS: Record<string, string> = { ua: "Brauzer", screen: "Ekran", tz: "Vaqt zonasi", cores: "Protsessor yadrolari", lang: "Til" };

export default function ParticipantPage() {
  const { pid } = useParams();
  const nav = useNavigate();
  // screenshot_url 10 daqiqa amal qiladi — 5 daqiqada yangilab turamiz
  const q = useQuery({ queryKey: ["participant", pid], queryFn: () => getParticipant(pid!), staleTime: 5 * 60_000, refetchInterval: 5 * 60_000 });
  const actions = useParticipantAction(() => q.refetch());
  const [shot, setShot] = useState<string | null>(null);
  const [showDevice, setShowDevice] = useState(false);

  if (q.isLoading) return <FullPageSpinner />;
  if (q.isError) return <ErrorBox>{errMsg(q.error)}</ErrorBox>;
  const p = q.data!;
  const qIndex = new Map(p.answers.map((a, i) => [a.question_id, i + 1]));
  const correct = p.answers.filter(a => a.is_correct).length;
  const penalized = p.events.filter(e => e.points > 0);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <button onClick={() => nav(-1)} className="text-[13px] text-ink-muted hover:text-ink">← Orqaga</button>

      {/* Sarlavha + qaror */}
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-[28px] font-semibold leading-[34px] tracking-tight">{p.full_name}</h1>
            <Badge tone={STATUS_TONES[p.status]} dot>{STATUS_LABELS[p.status]}</Badge>
            {p.is_duplicate && <Badge tone="peach">takror kirgan</Badge>}
          </div>
          <p className="mt-1 text-ink-muted">{p.group || "Guruhsiz"} · {STATUS_HINTS[p.status]}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {p.status === "frozen" ? (
            <>
              <Button variant="secondary" className="text-danger" onClick={() => actions.run(p.id, p.full_name, "reject")}>Rad etish</Button>
              <Button onClick={() => actions.run(p.id, p.full_name, "resume")}>Davom ettirish</Button>
            </>
          ) : (
            <>
              <Button variant="secondary" className="text-danger" disabled={p.decision === "rejected"} onClick={() => actions.run(p.id, p.full_name, "reject")}>Rad etish</Button>
              <Button disabled={p.decision === "accepted"} onClick={() => actions.run(p.id, p.full_name, "accept")}>Qabul qilish</Button>
            </>
          )}
        </div>
      </header>

      {p.decision && (
        <div className={`rounded-lg px-5 py-4 ${p.decision === "accepted" ? "bg-mint/60" : "bg-blush/60"}`}>
          <p className="font-medium">{p.decision === "accepted" ? "Natija qabul qilingan" : "Natija rad etilgan"}</p>
          {p.decision_note && <p className="text-sm text-ink-muted">{p.decision_note}</p>}
          <p className="mt-1 text-[13px] text-ink-muted">Qarorni yuqoridagi tugmalar bilan o'zgartirishingiz mumkin.</p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Ball" value={`${fmtNum(p.score)} / ${fmtNum(p.max_score)}`} hint={p.percent !== null ? `${Math.round(p.percent)}%` : undefined} />
        <Stat label="To'g'ri javoblar" value={`${correct} / ${p.answers.length}`} />
        <Stat label="Qoidabuzarlik" value={p.violation_score} tone={p.violation_score ? "warning" : undefined} hint={`${penalized.length} ta holat`} />
        <Stat label="Topshirgan" value={<span className="text-lg">{fmtDateTime(p.submitted_at)}</span>} hint={p.finish_reason || undefined} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Qoidabuzarliklar */}
        <section className="rounded-xl border border-border p-6">
          <h2 className="text-lg font-semibold tracking-tight">Qoidabuzarliklar</h2>
          <p className="mb-4 text-[13px] text-ink-muted">Vaqt bo'yicha. Rasmni kattalashtirish uchun bosing.</p>
          {p.events.length === 0 ? <p className="text-sm text-ink-subtle">Hech narsa qayd etilmagan ✓</p> : (
            <ol className="space-y-3">
              {p.events.map(e => (
                <li key={e.id} className="flex gap-3">
                  <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${e.points > 0 ? "bg-danger" : "bg-border-strong"}`} />
                  <div className="min-w-0 flex-1 text-sm">
                    <p className="font-medium">{EVENT_LABELS[e.type] ?? e.type}
                      {e.points > 0 && <span className="ml-1.5 text-danger">+{e.points}</span>}
                    </p>
                    <p className="font-mono text-xs text-ink-subtle">
                      {fmtDateTime(e.client_ts ?? e.created_at)}
                      {e.duration_ms ? ` · ${(e.duration_ms / 1000).toFixed(1)} s` : ""}
                      {e.question_id && qIndex.get(e.question_id) ? ` · ${qIndex.get(e.question_id)}-savol` : ""}
                    </p>
                  </div>
                  {e.screenshot_url && (
                    <img src={e.screenshot_url} alt="" onClick={() => setShot(e.screenshot_url)} onError={() => q.refetch()}
                      className="h-14 w-20 shrink-0 cursor-zoom-in rounded-sm object-cover" />
                  )}
                </li>
              ))}
            </ol>
          )}
        </section>

        {/* Javoblar */}
        <section className="rounded-xl border border-border p-6">
          <h2 className="text-lg font-semibold tracking-tight">Javoblar</h2>
          <p className="mb-4 text-[13px] text-ink-muted">{correct} ta to'g'ri, {p.answers.length - correct} ta noto'g'ri yoki javobsiz</p>
          {p.answers.length === 0 ? <p className="text-sm text-ink-subtle">Javob yo'q</p> : (
            <div className="space-y-2">
              {p.answers.map((a, i) => (
                <div key={a.question_id} className="rounded-md bg-surface-100 px-4 py-3 text-sm">
                  <div className="flex justify-between gap-3">
                    <p className="font-medium">{i + 1}. {a.question_text}</p>
                    <span className={`shrink-0 font-semibold ${a.is_correct ? "text-success" : "text-danger"}`}>{a.is_correct ? "✓" : "✗"}</span>
                  </div>
                  <p className="mt-1 text-ink-muted">
                    {a.option_text ?? <i>javob bermagan</i>}
                    <span className="ml-2 font-mono text-xs text-ink-subtle">{(a.time_spent_ms / 1000).toFixed(1)} s</span>
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <section className="rounded-xl border border-border">
        <button className="flex w-full items-center justify-between px-6 py-4 text-left" onClick={() => setShowDevice(s => !s)}>
          <span className="font-medium">Qurilma va texnik ma'lumot</span>
          <span className="text-ink-subtle">{showDevice ? "▾" : "▸"}</span>
        </button>
        {showDevice && (
          <dl className="grid gap-x-6 gap-y-2 border-t border-border px-6 py-4 text-sm sm:grid-cols-[180px_1fr]">
            <dt className="text-ink-muted">IP</dt><dd className="font-mono text-xs">{p.ip ?? "—"}</dd>
            {Object.entries(p.client_info ?? {}).map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="text-ink-muted">{INFO_LABELS[k] ?? k}</dt>
                <dd className="break-all font-mono text-xs">{String(v)}</dd>
              </div>
            ))}
            <dt className="text-ink-muted">Rozilik bergan</dt><dd className="font-mono text-xs">{fmtDateTime(p.consent_at)}</dd>
            <dt className="text-ink-muted">Kirgan</dt><dd className="font-mono text-xs">{fmtDateTime(p.joined_at)}</dd>
            <dt className="text-ink-muted">Boshlagan</dt><dd className="font-mono text-xs">{fmtDateTime(p.started_at)}</dd>
          </dl>
        )}
      </section>

      {actions.modals}
      <Modal open={!!shot} onClose={() => setShot(null)} wide>
        {shot && <img src={shot} alt="" className="w-full rounded-md" />}
      </Modal>
    </div>
  );
}
