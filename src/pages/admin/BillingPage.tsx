import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { addMember, listMembers, listPayments, removeMember } from "../../api/admin";
import { errMsg } from "../../api/errors";
import type { BillingInfo, Payment, PaymentStatus, Plan } from "../../api/types";
import Crown from "../../components/Crown";
import { toast } from "../../components/toast";
import { Badge, Button, Card, ErrorBox, FullPageSpinner, Input, type Tone } from "../../components/ui";
import { usePlans, usePremium } from "../../hooks/useBilling";
import { daysLeft, fmtDate, fmtSum } from "../../lib/format";
import { PLANS, planInfo, planPrice } from "../../lib/plans";
import { usePayModal } from "../../stores/payModal";

/** Pullik obuna faol bo'lganda — bayramona "Premium" kartasi */
function PremiumCard({ b, title }: { b: BillingInfo; title: string }) {
  const left = daysLeft(b.access_until);
  const pct = Math.min(100, Math.round((left / 30) * 100));
  return (
    <div className="relative overflow-hidden rounded-xl border border-border bg-bg p-6 shadow-md">
      <div aria-hidden className="gradient-aurora pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full opacity-70 blur-2xl" />
      <div className="relative flex items-start gap-4">
        <span className="gradient-aurora flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl shadow-md ring-4 ring-bg">
          <Crown className="h-7 w-7 text-warning drop-shadow" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-medium uppercase tracking-[0.2em] text-ink-muted">Premium faol</p>
          <h3 className="text-xl font-semibold tracking-tight">{title}</h3>
          <p className="mt-0.5 text-sm text-ink-muted">
            {fmtDate(b.access_until)} gacha
            {b.center && <> · O'quv markaz: <b className="text-ink">{b.center.name}</b></>}
          </p>
        </div>
        <Badge tone={left <= 3 ? "warning" : "success"} dot>{left} kun</Badge>
      </div>
      <div className="relative mt-5 h-2 overflow-hidden rounded-full bg-surface-100">
        <div className="gradient-aurora h-full rounded-full transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function StatusCard({ b }: { b: BillingInfo }) {
  const source = b.center && b.center.until === b.access_until ? "center"
    : b.paid_until && b.paid_until === b.access_until ? "paid" : "trial";
  const title = source === "center" ? "O'quv markaz obunasi" : source === "paid" ? `${planInfo(b.plan).title} tarifi` : "Bepul sinov muddati";
  const left = daysLeft(b.access_until);
  if (!b.has_access)
    return <Card title="Obuna muddati tugagan" description="Testlarni yaratish va eski natijalarni ko'rish mumkin, lekin yangi testni nashr qilish uchun tarifni to'lang." />;
  if (source !== "trial") return <PremiumCard b={b} title={title} />;
  return (
    <Card>
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-lg font-semibold tracking-tight">{title}</h3>
        <Badge tone={left <= 3 ? "warning" : "success"} dot>{left} kun qoldi</Badge>
      </div>
      <p className="mt-1 text-ink-muted">{fmtDate(b.access_until)} gacha faol.</p>
    </Card>
  );
}

const STATUS: Record<PaymentStatus, { label: string; tone: Tone }> = {
  pending: { label: "Tekshirilmoqda", tone: "warning" },
  approved: { label: "Tasdiqlandi", tone: "success" },
  rejected: { label: "Rad etildi", tone: "danger" },
};

function PendingCard({ p }: { p: Payment }) {
  return (
    <div className="rounded-xl border border-border bg-bg p-5">
      <div className="flex items-start gap-3">
        <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-warning motion-safe:animate-pulse" />
        <div className="min-w-0 flex-1">
          <p className="font-semibold">Chekingiz tekshirilmoqda</p>
          <p className="mt-0.5 text-sm text-ink-muted">Tasdiqlangach Premium avtomatik ochiladi. Odatda 1 soat ichida tekshiriladi.</p>
          <p className="mt-2 text-[13px] text-ink-subtle">
            {planInfo(p.plan).title} tarifi · {fmtSum(p.amount)} · {fmtDate(p.created_at)}{p.center_name ? ` · ${p.center_name}` : ""}
          </p>
        </div>
      </div>
    </div>
  );
}

function RejectedCard({ p, onRetry }: { p: Payment; onRetry: () => void }) {
  return (
    <div className="rounded-xl border border-border bg-blush/30 p-5">
      <p className="font-semibold">Oxirgi chek qabul qilinmadi</p>
      <p className="mt-1 text-sm text-ink-muted">
        <b className="text-ink">Sabab:</b> {p.admin_note?.trim() || "To'lov topilmadi yoki summa mos kelmadi."}
      </p>
      <p className="mt-1 text-[13px] text-ink-subtle">{planInfo(p.plan).title} · {fmtSum(p.amount)} · {fmtDate(p.created_at)}</p>
      <Button className="mt-4" size="sm" onClick={onRetry}>Qayta yuborish</Button>
    </div>
  );
}

function PayCard({ b }: { b: BillingInfo }) {
  const [params] = useSearchParams();
  const fromUrl = params.get("plan");
  const [plan, setPlan] = useState<Plan>(fromUrl === "teacher" || fromUrl === "center" ? fromUrl : b.plan);
  const plans = usePlans().data;
  const openPay = usePayModal(s => s.open);

  return (
    <Card title={b.has_access ? "Obunani uzaytirish" : "Tarifni tanlang"} description="Kartaga o'tkazma qiling va chekni yuklang. Premium 30 kunga ochiladi.">
      <div className="grid gap-3 sm:grid-cols-2">
        {PLANS.map(p => (
          <button key={p.id} type="button" onClick={() => setPlan(p.id)} aria-pressed={plan === p.id}
            className={`rounded-lg border p-4 text-left transition ${plan === p.id ? "border-ink shadow-md" : "border-border hover:border-border-strong"}`}>
            <p className="font-semibold">{p.title}</p>
            <p className="text-[13px] text-ink-muted">{p.text}</p>
            <p className="mt-3 text-2xl font-semibold tracking-tight">{fmtSum(planPrice(p.id, plans, b))}<span className="text-sm font-normal text-ink-muted"> / 30 kun</span></p>
            <ul className="mt-3 space-y-1 text-[13px] text-ink-muted">{p.features.map(f => <li key={f}>✓ {f}</li>)}</ul>
          </button>
        ))}
      </div>
      <div className="mt-6 space-y-3">
        <Button size="lg" className="w-full sm:w-auto" onClick={() => openPay(plan)}>{fmtSum(planPrice(plan, plans, b))} to'lash</Button>
        <p className="text-[13px] text-ink-muted">Chek odatda 1 soat ichida tekshiriladi.</p>
      </div>
    </Card>
  );
}

function HistoryCard() {
  const q = useQuery({ queryKey: ["billing", "payments"], queryFn: listPayments });
  const items = q.data ?? [];
  if (q.isLoading || items.length === 0) return null;
  return (
    <Card title="To'lovlar tarixi">
      <ul className="divide-y divide-border rounded-md border border-border">
        {items.slice(0, 10).map(p => (
          <li key={p.id} className="flex items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{planInfo(p.plan).title} · {fmtSum(p.amount)}</p>
              <p className="truncate text-[13px] text-ink-muted">
                {fmtDate(p.created_at)}{p.status === "rejected" && p.admin_note ? ` · ${p.admin_note}` : ""}
              </p>
            </div>
            <Badge tone={STATUS[p.status].tone} dot>{STATUS[p.status].label}</Badge>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function MembersCard({ max }: { max: number }) {
  const qc = useQueryClient();
  const [email, setEmail] = useState("");
  const q = useQuery({ queryKey: ["billing", "members"], queryFn: listMembers });
  const add = useMutation({
    mutationFn: () => addMember(email.trim()),
    onSuccess: () => { setEmail(""); qc.invalidateQueries({ queryKey: ["billing", "members"] }); toast("O'qituvchi qo'shildi", "success"); },
    onError: e => toast(errMsg(e), "error"),
  });
  const del = useMutation({
    mutationFn: (id: number) => removeMember(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["billing", "members"] }),
    onError: e => toast(errMsg(e), "error"),
  });
  const members = q.data ?? [];

  return (
    <Card title={`O'qituvchilar (${members.length}/${max})`} description="Qo'shilgan o'qituvchi shu email bilan Google orqali kirib, markaz obunasida test nashr qila oladi.">
      <form className="flex gap-2" onSubmit={e => { e.preventDefault(); if (email.trim()) add.mutate(); }}>
        <Input type="email" placeholder="oqituvchi@gmail.com" value={email} onChange={e => setEmail(e.target.value)} />
        <Button type="submit" loading={add.isPending} disabled={!email.trim() || members.length >= max}>Qo'shish</Button>
      </form>
      {members.length > 0 && (
        <ul className="mt-4 divide-y divide-border rounded-md border border-border">
          {members.map(m => (
            <li key={m.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{m.full_name || m.email}</p>
                {m.full_name && <p className="truncate text-[13px] text-ink-muted">{m.email}</p>}
              </div>
              <Button size="sm" variant="ghost" loading={del.isPending && del.variables === m.id} onClick={() => del.mutate(m.id)}>Chiqarish</Button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export default function BillingPage() {
  const { query: q, isSuper } = usePremium();
  const openPay = usePayModal(s => s.open);
  if (isSuper) return <ErrorBox>Superadmin uchun tarif sahifasi yo'q.</ErrorBox>;
  if (q.isLoading || q.isPending) return <FullPageSpinner />;
  if (q.error || !q.data) return <ErrorBox>{errMsg(q.error)}</ErrorBox>;
  const b = q.data;
  const lastRejected = !b.pending_payment && b.last_payment?.status === "rejected" ? b.last_payment : null;
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-[28px] font-semibold tracking-tight">Tarif</h1>
      <StatusCard b={b} />
      {b.pending_payment && <PendingCard p={b.pending_payment} />}
      {lastRejected && <RejectedCard p={lastRejected} onRetry={() => openPay(lastRejected.plan)} />}
      {!b.pending_payment && <PayCard b={b} />}
      {b.is_center_owner && <MembersCard max={b.max_teachers} />}
      <HistoryCard />
    </div>
  );
}
