import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { addMember, getBilling, isBillingMock, listMembers, removeMember } from "../../api/admin";
import { errMsg } from "../../api/errors";
import type { BillingInfo, Plan } from "../../api/types";
import Confetti from "../../components/Confetti";
import OnlinePayModal from "../../components/OnlinePayModal";
import { toast } from "../../components/toast";
import { Badge, Button, Card, ErrorBox, FullPageSpinner, Input } from "../../components/ui";
import { daysLeft, fmtDate, fmtSum } from "../../lib/format";
import { PLANS } from "../../lib/plans";

function Crown({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M3 7.5 7.5 11 12 4l4.5 7L21 7.5 19 18H5L3 7.5Z" />
      <rect x="5" y="19.5" width="14" height="2" rx="1" />
    </svg>
  );
}

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
  const title = source === "center" ? "O'quv markaz obunasi" : source === "paid" ? `${PLANS.find(p => p.id === b.plan)?.title} tarifi` : "Bepul sinov muddati";
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

/** To'lovdan keyin panelga birinchi kirishda — tabrik */
function WelcomeBanner({ b, onClose }: { b: BillingInfo; onClose: () => void }) {
  const info = PLANS.find(p => p.id === b.plan)!;
  return (
    <div className="relative overflow-hidden rounded-xl border border-border bg-bg p-5">
      <div aria-hidden className="gradient-aurora pointer-events-none absolute inset-0 opacity-30" />
      <div className="relative flex items-start gap-3">
        <span className="text-3xl leading-none">🎉</span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">Xush kelibsiz, Premium a'zo!</p>
          <p className="mt-0.5 text-sm text-ink-muted">
            {b.plan === "center"
              ? "O'quv markaz tarifi faol. Quyida o'qituvchilaringizni qo'shing — ular ham cheksiz test nashr qila oladi."
              : `${info.title} tarifi faol: cheksiz testlar, anti-cheat kuzatuv va Excel hisobotlar sizniki.`}
          </p>
        </div>
        <button type="button" aria-label="Yopish" onClick={onClose} className="text-ink-muted hover:text-ink">✕</button>
      </div>
    </div>
  );
}

function PayCard({ b }: { b: BillingInfo }) {
  const [params] = useSearchParams();
  const fromUrl = params.get("plan");
  const [plan, setPlan] = useState<Plan>(fromUrl === "teacher" || fromUrl === "center" ? fromUrl : b.plan);
  const [payOpen, setPayOpen] = useState(false);

  if (b.pending_payment)
    return (
      <Card title="To'lovingiz tekshirilmoqda"
        description={`${PLANS.find(p => p.id === b.pending_payment!.plan)?.title} tarifi · ${fmtSum(b.pending_payment.amount)} · ${fmtDate(b.pending_payment.created_at)}.`} />
    );

  return (
    <Card title={b.has_access ? "Obunani uzaytirish" : "Tarifni tanlang"} description="To'lov 30 kunga. Muddat tugamasdan to'lasangiz, kunlar ustiga qo'shiladi.">
      <div className="grid gap-3 sm:grid-cols-2">
        {PLANS.map(p => (
          <button key={p.id} type="button" onClick={() => setPlan(p.id)}
            className={`rounded-lg border p-4 text-left transition ${plan === p.id ? "border-ink shadow-md" : "border-border hover:border-border-strong"}`}>
            <p className="font-semibold">{p.title}</p>
            <p className="text-[13px] text-ink-muted">{p.text}</p>
            <p className="mt-3 text-2xl font-semibold tracking-tight">{fmtSum(b.prices[p.id])}<span className="text-sm font-normal text-ink-muted"> / oy</span></p>
            <ul className="mt-3 space-y-1 text-[13px] text-ink-muted">{p.features.map(f => <li key={f}>✓ {f}</li>)}</ul>
          </button>
        ))}
      </div>
      <div className="mt-6 space-y-3">
        <Button size="lg" className="w-full sm:w-auto" onClick={() => setPayOpen(true)}>Click yoki Payme orqali {fmtSum(b.prices[plan])} to'lash</Button>
        <p className="text-[13px] text-ink-muted">Karta orqali to'lov — darhol tasdiqlanadi.</p>
      </div>
      <OnlinePayModal open={payOpen} onClose={() => setPayOpen(false)} plan={plan} />
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
  const [params, setParams] = useSearchParams();
  const [welcome, setWelcome] = useState(params.get("welcome") === "1");
  const [celebrate, setCelebrate] = useState(0);
  // ?welcome=1 bir martalik: URL'dan olib tashlab, konfetti otamiz
  useEffect(() => {
    if (params.get("welcome") !== "1") return;
    setWelcome(true);
    setCelebrate(Date.now());
    const next = new URLSearchParams(params); next.delete("welcome");
    setParams(next, { replace: true });
  }, [params, setParams]);
  const q = useQuery({
    queryKey: ["billing"], queryFn: getBilling,
    // chek tekshirilayotganda holatni avtomatik yangilab turish
    refetchInterval: query => (query.state.data?.pending_payment ? 5_000 : false),
  });
  if (q.isLoading) return <FullPageSpinner />;
  if (q.error || !q.data) return <ErrorBox>{errMsg(q.error)}</ErrorBox>;
  const b = q.data;
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-[28px] font-semibold tracking-tight">Tarif</h1>
      {isBillingMock() && (
        <div className="rounded-lg border border-border bg-peach/40 px-4 py-3 text-sm">
          <b>Test rejimi.</b> To'lov tizimi hali serverga ulanmagan — istalgan karta raqami va SMS kod bilan to'lash mumkin, haqiqiy pul yechilmaydi.
        </div>
      )}
      <Confetti fire={celebrate} />
      {welcome && b.has_access && b.paid_until && <WelcomeBanner b={b} onClose={() => setWelcome(false)} />}
      <StatusCard b={b} />
      <PayCard b={b} />
      {b.is_center_owner && <MembersCard max={b.max_teachers} />}
    </div>
  );
}
