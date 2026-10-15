import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { getExam, listParticipants } from "../../api/admin";
import { refreshAccess } from "../../api/client";
import { errMsg } from "../../api/errors";
import type { EventType, ParticipantRow, ParticipantStatus } from "../../api/types";
import { useParticipantAction } from "../../components/ParticipantActions";
import { Badge, Button, EmptyState, ErrorBox, FullPageSpinner, Input, Menu, Modal, Segmented, Stat } from "../../components/ui";
import ViolationBar from "../../components/ViolationBar";
import { fmtNum } from "../../lib/format";
import { EVENT_LABELS, STATUS_HINTS, STATUS_LABELS, STATUS_TONES } from "../../lib/labels";
import { Socket, wsBase, type Msg } from "../../lib/ws";
import { useAuth } from "../../stores/auth";

interface Health { camera?: boolean; mic?: boolean; face_engine?: boolean; fps?: number; }
interface FeedItem {
  key: string; pid: string; name: string; type: EventType; points: number; duration_ms: number | null;
  screenshot_url: string | null; at: number;
}

const ROW_KEYS: (keyof ParticipantRow)[] = [
  "full_name", "group", "status", "is_duplicate", "ip", "question_index", "total", "score", "raw_score", "max_score", "percent",
  "violation_score", "warnings_count", "decision", "decision_note", "finish_reason", "joined_at", "started_at", "submitted_at", "last_seen_at",
];
const ACTIVE: ParticipantStatus[] = ["lobby", "in_progress", "frozen", "disconnected"];
type Filter = "all" | "problems" | "in_progress" | "submitted";

function beep() {
  try {
    const ac = new AudioContext();
    const o = ac.createOscillator(), g = ac.createGain();
    o.frequency.value = 880; g.gain.value = 0.08;
    o.connect(g).connect(ac.destination);
    o.start(); o.stop(ac.currentTime + 0.2);
    o.onended = () => ac.close();
  } catch { /* ovoz ixtiyoriy */ }
}

export default function LivePage() {
  const { id } = useParams();
  const nav = useNavigate();
  const examQ = useQuery({ queryKey: ["exam", id], queryFn: () => getExam(id!) });
  const [rows, setRows] = useState<Map<string, ParticipantRow>>(new Map());
  const [health, setHealth] = useState<Record<string, Health>>({});
  const [lost, setLost] = useState<Record<string, boolean>>({});
  const [flash, setFlash] = useState<Record<string, number>>({});
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [wsOpen, setWsOpen] = useState(false);
  const [bigShot, setBigShot] = useState<string | null>(null);
  const [, setNow] = useState(Date.now());
  const sockRef = useRef<Socket | null>(null);
  const rowsRef = useRef(rows);
  rowsRef.current = rows;
  const actions = useParticipantAction(() => sockRef.current?.send("refresh"));

  // REST: dastlabki ro'yxat + har 5 s da yangilash (WS xabarlari mos kelmasa ham jadval to'g'ri bo'ladi)
  useEffect(() => {
    const load = () => listParticipants(id!).then(list => setRows(prev => {
      const next = new Map(prev);
      for (const r of list) {
        const cur = next.get(r.id);
        if (cur && r.status === "frozen" && cur.status !== "frozen") beep();
        next.set(r.id, { ...cur, ...r });
      }
      return next;
    })).catch(() => {});
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [id]);

  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);

  // ---- WebSocket ----
  useEffect(() => {
    const sock = new Socket(
      () => `${wsBase}/admin/exams/${id}/?token=${encodeURIComponent(useAuth.getState().access ?? "")}`,
      onMessage,
      async (open, code) => {
        setWsOpen(open);
        if (code === 4401) {
          // access eskirdi — yangilab qayta ulanamiz (url funksiya har safar yangi token oladi)
          if (await refreshAccess()) sock.connect();
        }
      },
    );
    sockRef.current = sock;
    sock.connect();
    return () => sock.close();
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  function mergeRow(pid: string, d: any) {
    const src0 = d.participant ?? d;
    if (src0.status === "frozen" && rowsRef.current.get(pid)?.status !== "frozen") beep();
    setRows(prev => {
      const next = new Map(prev);
      const cur = next.get(pid) ?? ({ id: pid } as ParticipantRow);
      const src = d.participant ?? d;
      const patch: Partial<ParticipantRow> = {};
      for (const k of ROW_KEYS) if (src[k] !== undefined) (patch as any)[k] = src[k];
      next.set(pid, { ...cur, ...patch });
      return next;
    });
  }

  /** Xabar nomiga bog'lanmagan ishlov: ma'lumot ichidagi maydonlarga qarab qaror qilinadi. */
  function onMessage(m: Msg) {
    const d = m.data ?? {};
    const t = m.type ?? "";
    console.info("[admin ws] <-", t, d);

    if (t.includes("snapshot")) {
      const list: ParticipantRow[] = Array.isArray(d) ? d : d.participants ?? d.results ?? [];
      setRows(new Map(list.map(r => [r.id, r])));
      const h: Record<string, Health> = {};
      for (const r of list as any[]) if (r.health) h[r.id] = r.health;
      setHealth(h);
      setLost({});
      return;
    }

    const p = d.participant ?? {};
    const pid: string | undefined = d.participant_id ?? p.id ?? d.pid ?? (d.full_name || d.status ? d.id : undefined);
    if (!pid) return;

    // Qoidabuzarlik: data.event yoki data ning o'zi event bo'lsa
    const ev = d.event ?? d.violation ?? (d.type in EVENT_LABELS ? d : null) ?? (/violation|event/.test(t) ? d : null);
    if (ev && ev.type in EVENT_LABELS) {
      setFlash(f => ({ ...f, [pid]: Date.now() }));
      const name = rowsRef.current.get(pid)?.full_name ?? d.full_name ?? p.full_name ?? "";
      const key = ev.id ?? ev.event_id ?? `${pid}-${Date.now()}`;
      setFeed(list => (list.some(f => f.key === key) ? list : [{
        key, pid, name, type: ev.type, points: ev.points ?? 0,
        duration_ms: ev.duration_ms ?? null, screenshot_url: ev.screenshot_url ?? null, at: Date.now(),
      }, ...list].slice(0, 100)));
    }

    // Screenshot keyinroq kelishi mumkin
    const shotUrl = d.screenshot_url ?? (t.includes("screenshot") ? d.url : undefined);
    if (shotUrl && d.event_id) setFeed(list => list.map(f => (f.key === d.event_id ? { ...f, screenshot_url: shotUrl } : f)));

    // Salomatlik / heartbeat
    if (d.health || /health|heartbeat/.test(t)) {
      if (/lost/.test(t)) setLost(l => ({ ...l, [pid]: true }));
      else {
        const h = d.health ?? d;
        setHealth(prev => ({ ...prev, [pid]: { ...prev[pid], camera: h.camera, mic: h.mic, face_engine: h.face_engine, fps: h.fps } }));
        setLost(l => ({ ...l, [pid]: false }));
      }
    } else if (/lost|disconnect/.test(t)) {
      setLost(l => ({ ...l, [pid]: true }));
    }

    // Har qanday xabardagi qator maydonlari (status, progress, violation_score, ...)
    mergeRow(pid, { ...d, ...p });
  }

  const list = useMemo(() => {
    const q = search.trim().toLowerCase();
    return [...rows.values()]
      .filter(r => !q || r.full_name?.toLowerCase().includes(q) || r.group?.toLowerCase().includes(q))
      .filter(r => filter === "all" ? true
        : filter === "problems" ? r.status === "frozen" || r.status === "disconnected" || r.violation_score > 0 || r.is_duplicate || lost[r.id]
        : filter === "in_progress" ? r.status === "in_progress" || r.status === "disconnected"
        : r.status === filter)
      .sort((a, b) => Number(b.status === "frozen") - Number(a.status === "frozen") || b.violation_score - a.violation_score || (a.full_name ?? "").localeCompare(b.full_name ?? ""));
  }, [rows, filter, search, lost]);

  const stats = useMemo(() => {
    const s = { lobby: 0, in_progress: 0, frozen: 0, submitted: 0 };
    for (const r of rows.values()) {
      if (r.status === "lobby") s.lobby++;
      else if (r.status === "in_progress" || r.status === "disconnected") s.in_progress++;
      else if (r.status === "frozen") s.frozen++;
      else if (r.status === "submitted") s.submitted++;
    }
    return s;
  }, [rows]);

  if (examQ.isLoading) return <FullPageSpinner />;
  if (examQ.isError) return <ErrorBox>{errMsg(examQ.error)}</ErrorBox>;
  const exam = examQ.data!;
  const freezeAt = exam.proctoring?.freeze_at ?? 0;
  const waiting = list.filter(r => r.status === "frozen");
  const total = rows.size;

  return (
    <div className="space-y-6">
      {/* Holat qatori */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-sm text-ink-muted">
          <span className={`h-2 w-2 rounded-full ${wsOpen ? "animate-pulse bg-success" : "bg-warning"}`} />
          {wsOpen ? "Real vaqtda yangilanmoqda" : "Ulanmoqda… (har 5 s da yangilanadi)"}
        </p>
        <Button variant="ghost" size="sm" onClick={() => sockRef.current?.send("refresh")}>↻ Yangilash</Button>
      </div>

      {/* Asosiy raqamlar */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Kutmoqda" value={stats.lobby} hint="kirdi, boshlamadi" />
        <Stat label="Yechyapti" value={stats.in_progress} />
        <Stat label="Qaror kutmoqda" value={stats.frozen} tone={stats.frozen ? "danger" : undefined} hint="to'xtatilgan" />
        <Stat label="Tugatdi" value={stats.submitted} tone={stats.submitted ? "success" : undefined} />
      </div>

      {/* Eng muhimi: admin qarorini kutayotganlar */}
      {waiting.length > 0 && (
        <section className="rounded-xl border border-danger/40 bg-blush/40 p-5">
          <h2 className="text-lg font-semibold tracking-tight">Qaroringizni kutmoqda · {waiting.length}</h2>
          <p className="text-sm text-ink-muted">Qoidabuzarlik ko'p bo'lgani uchun test to'xtatildi. Davom ettiring yoki rad eting.</p>
          <div className="mt-4 space-y-2">
            {waiting.map(r => (
              <div key={r.id} className="flex flex-wrap items-center gap-3 rounded-lg bg-bg px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{r.full_name}</p>
                  <p className="text-[13px] text-ink-muted">{r.group || "—"} · {r.violation_score} ball qoidabuzarlik</p>
                </div>
                <Link to={`/admin/participants/${r.id}`}><Button variant="ghost" size="sm">Batafsil</Button></Link>
                <Button variant="secondary" size="sm" className="text-danger" onClick={() => actions.run(r.id, r.full_name, "reject")}>Rad etish</Button>
                <Button size="sm" onClick={() => actions.run(r.id, r.full_name, "resume")}>Davom ettirish</Button>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
        {/* Ishtirokchilar */}
        <section>
          <div className="mb-3 flex flex-wrap items-center gap-3">
            <Segmented value={filter} onChange={setFilter} options={[
              { value: "all", label: `Hammasi ${total}` },
              { value: "problems", label: "Muammolilar" },
              { value: "in_progress", label: "Yechyapti" },
              { value: "submitted", label: "Tugatdi" },
            ]} />
            <Input placeholder="Ism yoki guruh…" className="h-9 max-w-56" value={search} onChange={e => setSearch(e.target.value)} />
          </div>

          {total === 0 ? (
            <EmptyState title="Hali hech kim kirmadi" text={exam.code ? <>O'quvchilar <span className="font-mono">{exam.code}</span> kodi bilan kiradi — ular shu yerda darhol paydo bo'ladi.</> : undefined} />
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border">
              <table className="w-full min-w-[760px] text-sm">
                <thead>
                  <tr className="text-left text-[13px] text-ink-muted">
                    <th className="px-4 py-3 font-medium">O'quvchi</th>
                    <th className="px-4 py-3 font-medium">Holat</th>
                    <th className="px-4 py-3 font-medium">Jarayon</th>
                    <th className="px-4 py-3 font-medium">Qoidabuzarlik</th>
                    <th className="px-4 py-3 font-medium">Aloqa</th>
                    <th className="px-2 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {list.length === 0 && <tr><td colSpan={6} className="border-t border-border py-10 text-center text-ink-muted">Hech kim topilmadi</td></tr>}
                  {list.map(r => {
                    const h = health[r.id];
                    const flashing = flash[r.id] && Date.now() - flash[r.id] < 2000;
                    const seenAgo = r.last_seen_at ? Math.round((Date.now() - new Date(r.last_seen_at).getTime()) / 1000) : null;
                    const active = ACTIVE.includes(r.status) && r.status !== "lobby";
                    const offline = active && (lost[r.id] || r.status === "disconnected");
                    const deviceIssues = active ? [
                      exam.proctoring?.camera && h?.camera === false && "kamera o'chiq",
                      exam.proctoring?.microphone && h?.mic === false && "mikrofon o'chiq",
                      exam.proctoring?.camera && h?.face_engine === false && "yuz kuzatuvi ishlamayapti",
                    ].filter(Boolean) as string[] : [];
                    const progress = r.total ? Math.min(r.question_index + (r.status === "submitted" ? 1 : 0), r.total) / r.total : 0;
                    return (
                      <tr key={r.id} className={`border-t border-border transition-colors ${flashing ? "bg-peach/50" : "hover:bg-surface-100"}`}>
                        <td className="px-4 py-3">
                          <Link to={`/admin/participants/${r.id}`} className="font-medium hover:underline">{r.full_name}</Link>
                          <div className="flex items-center gap-1.5 text-[13px] text-ink-muted">
                            {r.group || "—"}
                            {r.is_duplicate && <Badge tone="peach" className="h-5">takror kirgan</Badge>}
                          </div>
                        </td>
                        <td className="px-4 py-3" title={STATUS_HINTS[r.status]}>
                          <Badge tone={STATUS_TONES[r.status]} dot>{STATUS_LABELS[r.status]}</Badge>
                        </td>
                        <td className="px-4 py-3">
                          {r.status === "submitted" ? (
                            <span className="font-medium tabular-nums">{fmtNum(r.score)} / {fmtNum(r.max_score)} ball</span>
                          ) : r.total ? (
                            <div className="w-32">
                              <div className="mb-1 text-[13px] tabular-nums text-ink-muted">{Math.min(r.question_index + 1, r.total)} / {r.total} savol</div>
                              <div className="h-1.5 overflow-hidden rounded-full bg-surface-200"><div className="h-full rounded-full bg-ink" style={{ width: `${progress * 100}%` }} /></div>
                            </div>
                          ) : <span className="text-ink-subtle">—</span>}
                        </td>
                        <td className="px-4 py-3">
                          {r.violation_score > 0
                            ? <ViolationBar compact score={r.violation_score} freezeAt={freezeAt} warnAt={exam.proctoring?.warn_at} />
                            : <span className="text-[13px] text-ink-subtle">yo'q</span>}
                        </td>
                        <td className="px-4 py-3 text-[13px]">
                          {offline ? <span className="font-medium text-danger">uzilgan{seenAgo !== null ? ` · ${seenAgo} s` : ""}</span>
                            : deviceIssues.length ? <span className="text-warning">{deviceIssues.join(", ")}</span>
                              : active ? <span className="text-success">yaxshi</span>
                                : <span className="text-ink-subtle">—</span>}
                        </td>
                        <td className="px-2 py-3 text-right">
                          <Menu items={[
                            { label: "Batafsil ko'rish", onClick: () => nav(`/admin/participants/${r.id}`) },
                            { label: "Davom ettirish", onClick: () => actions.run(r.id, r.full_name, "resume"), hidden: r.status !== "frozen" },
                            { label: "Rad etish", onClick: () => actions.run(r.id, r.full_name, "reject"), hidden: r.status !== "frozen", danger: true },
                            { label: "Testdan chiqarish", onClick: () => actions.run(r.id, r.full_name, "kick"), hidden: !ACTIVE.includes(r.status), danger: true },
                          ]} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Qoidabuzarliklar lentasi */}
        <aside className="h-fit rounded-xl border border-border">
          <div className="px-5 pt-5 pb-3">
            <h2 className="text-lg font-semibold tracking-tight">Qoidabuzarliklar</h2>
            <p className="text-[13px] text-ink-muted">Sodir bo'lishi bilan shu yerda chiqadi</p>
          </div>
          <div className="max-h-[70vh] overflow-y-auto pb-2">
            {feed.length === 0 && <p className="px-5 py-8 text-center text-sm text-ink-subtle">Hozircha hammasi joyida</p>}
            {feed.map(f => (
              <div key={f.key} className="flex gap-3 border-t border-border px-5 py-3 text-sm">
                {f.screenshot_url && (
                  <img src={f.screenshot_url} alt="" onClick={() => setBigShot(f.screenshot_url)}
                    className="h-12 w-16 shrink-0 cursor-zoom-in rounded-sm object-cover" />
                )}
                <div className="min-w-0">
                  <p>
                    <Link to={`/admin/participants/${f.pid}`} className="font-medium hover:underline">{f.name || "O'quvchi"}</Link>
                    <span className="text-ink-muted"> — {EVENT_LABELS[f.type] ?? f.type}</span>
                    {f.duration_ms ? <span className="text-ink-muted"> ({(f.duration_ms / 1000).toFixed(1)} s)</span> : null}
                  </p>
                  <p className="font-mono text-xs text-ink-subtle">
                    {new Date(f.at).toLocaleTimeString("uz-UZ")}{f.points ? <span className="text-danger"> · +{f.points} ball</span> : null}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </aside>
      </div>

      {actions.modals}
      <Modal open={!!bigShot} onClose={() => setBigShot(null)} wide>
        {bigShot && <img src={bigShot} alt="" className="w-full rounded-md" />}
      </Modal>
    </div>
  );
}
