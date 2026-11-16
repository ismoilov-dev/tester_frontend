import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getBilling, payOnline, type PayProvider } from "../api/admin";
import { errMsg } from "../api/errors";
import type { Plan } from "../api/types";
import { fmtDate, fmtSum } from "../lib/format";
import { PLANS } from "../lib/plans";
import Confetti from "./Confetti";
import { Badge, Button, ErrorBox, Input, Label, Modal } from "./ui";

type Step = "provider" | "card" | "sms" | "processing" | "done";

const PROVIDERS: { id: PayProvider; name: string; text: string; dot: string }[] = [
  { id: "click", name: "Click", text: "Uzcard / Humo karta orqali", dot: "bg-sky-500" },
  { id: "payme", name: "Payme", text: "Uzcard / Humo karta orqali", dot: "bg-teal-500" },
];

const digits = (v: string) => v.replace(/\D/g, "");
const fmtCard = (v: string) => digits(v).slice(0, 16).replace(/(\d{4})(?=\d)/g, "$1 ");
function fmtExp(v: string) {
  const d = digits(v).slice(0, 4);
  return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
}
const expValid = (v: string) => { const m = Number(v.slice(0, 2)); return /^\d{2}\/\d{2}$/.test(v) && m >= 1 && m <= 12; };

export default function OnlinePayModal({ open, onClose, plan }: { open: boolean; onClose: () => void; plan: Plan }) {
  const qc = useQueryClient();
  const nav = useNavigate();
  const info = PLANS.find(p => p.id === plan)!;
  const [step, setStep] = useState<Step>("provider");
  const [provider, setProvider] = useState<PayProvider>("click");
  const [card, setCard] = useState("");
  const [exp, setExp] = useState("");
  const [code, setCode] = useState("");
  const [resendIn, setResendIn] = useState(0);
  const [error, setError] = useState("");
  const [paidUntil, setPaidUntil] = useState<string | null>(null);
  const [celebrate, setCelebrate] = useState(0);

  // Har ochilganda boshidan
  useEffect(() => {
    if (!open) return;
    setStep("provider"); setCard(""); setExp(""); setCode(""); setError("");
  }, [open]);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn(n => n - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  const providerName = PROVIDERS.find(p => p.id === provider)!.name;
  const cardOk = digits(card).length === 16 && expValid(exp);
  const busy = step === "processing";

  async function confirm() {
    setError("");
    setStep("processing");
    try {
      await new Promise(r => setTimeout(r, 1500));
      await payOnline(plan, provider);
      const fresh = await getBilling();
      qc.setQueryData(["billing"], fresh);
      await qc.invalidateQueries({ queryKey: ["billing"] });
      setPaidUntil(fresh.paid_until);
      setStep("done");
      setCelebrate(Date.now());
    } catch (e) {
      setError(errMsg(e));
      setStep("sms");
    }
  }

  const close = () => { if (!busy) onClose(); };

  return (
    <>
    <Confetti fire={celebrate} />
    <Modal open={open} onClose={close} title={step === "done" ? undefined : `${step === "provider" ? "To'lov" : providerName} · ${info.title} tarifi`}>
      {step !== "done" && (
        <div className="mb-4 flex items-center justify-between rounded-lg bg-surface-100 px-4 py-3">
          <div>
            <p className="text-[13px] text-ink-muted">To'lov summasi · 30 kun</p>
            <p className="text-xl font-semibold tracking-tight">{fmtSum(info.price)}</p>
          </div>
          <Badge tone="warning">Test rejimi</Badge>
        </div>
      )}

      {step === "provider" && (
        <div className="space-y-3">
          <Label>To'lov usulini tanlang</Label>
          {PROVIDERS.map(p => (
            <button key={p.id} type="button" onClick={() => setProvider(p.id)}
              className={`flex w-full items-center gap-3 rounded-lg border p-4 text-left transition ${provider === p.id ? "border-ink shadow-md" : "border-border hover:border-border-strong"}`}>
              <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white ${p.dot}`}>{p.name[0]}</span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">{p.name}</span>
                <span className="block text-[13px] text-ink-muted">{p.text}</span>
              </span>
              <span className={`h-4 w-4 shrink-0 rounded-full border-2 ${provider === p.id ? "border-ink bg-ink" : "border-border-strong"}`} />
            </button>
          ))}
          <Button className="mt-2 w-full" size="lg" onClick={() => setStep("card")}>Davom etish</Button>
        </div>
      )}

      {step === "card" && (
        <form className="space-y-4" onSubmit={e => { e.preventDefault(); if (cardOk) { setStep("sms"); setResendIn(60); } }}>
          <div>
            <Label>Karta raqami</Label>
            <Input autoFocus inputMode="numeric" autoComplete="off" placeholder="8600 0000 0000 0000"
              value={card} onChange={e => setCard(fmtCard(e.target.value))} className="font-mono tracking-wider" />
          </div>
          <div className="w-32">
            <Label>Amal qilish muddati</Label>
            <Input inputMode="numeric" autoComplete="off" placeholder="MM/YY"
              value={exp} onChange={e => setExp(fmtExp(e.target.value))} aria-invalid={exp.length === 5 && !expValid(exp)} className="font-mono" />
          </div>
          <p className="text-[13px] text-ink-muted">Test rejimi: istalgan 16 xonali raqam va muddatni kiriting — pul yechilmaydi.</p>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setStep("provider")}>Orqaga</Button>
            <Button type="submit" className="flex-1" disabled={!cardOk}>Kod olish</Button>
          </div>
        </form>
      )}

      {(step === "sms" || step === "processing") && (
        <form className="space-y-4" onSubmit={e => { e.preventDefault(); if (code.length === 6) confirm(); }}>
          <p className="text-sm text-ink-muted">
            Karta <span className="font-mono">•••• {digits(card).slice(-4)}</span> ga bog'langan <b>+998 ** *** ** {digits(card).slice(-2)}</b> raqamiga SMS kod yuborildi.
          </p>
          <div>
            <Label>SMS kod</Label>
            <Input autoFocus inputMode="numeric" autoComplete="one-time-code" placeholder="••••••" disabled={busy}
              value={code} onChange={e => setCode(digits(e.target.value).slice(0, 6))} className="h-12 text-center font-mono text-xl tracking-[0.4em]" />
            <div className="mt-2 flex items-center justify-between text-[13px] text-ink-muted">
              <span>Test rejimi: istalgan 6 ta raqam</span>
              {resendIn > 0
                ? <span>Qayta yuborish: {resendIn} s</span>
                : <button type="button" className="font-medium text-ink hover:underline" onClick={() => setResendIn(60)}>Kodni qayta yuborish</button>}
            </div>
          </div>
          {error && <ErrorBox>{error}</ErrorBox>}
          <div className="flex gap-2">
            <Button variant="secondary" disabled={busy} onClick={() => { setCode(""); setStep("card"); }}>Orqaga</Button>
            <Button type="submit" className="flex-1" loading={busy} disabled={code.length !== 6}>
              {busy ? "To'lov amalga oshirilmoqda…" : `${fmtSum(info.price)} to'lash`}
            </Button>
          </div>
        </form>
      )}

      {step === "done" && (
        <div className="relative -mx-6 -mt-4 overflow-hidden px-6 pb-2 pt-8 text-center">
          <div aria-hidden className="gradient-aurora pointer-events-none absolute -top-24 left-1/2 h-56 w-[140%] -translate-x-1/2 rounded-full opacity-60 blur-2xl" />
          <div className="relative">
            <div className="relative mx-auto flex h-20 w-20 items-center justify-center">
              <span className="gradient-aurora absolute inset-0 animate-ping rounded-full opacity-40" />
              <span className="gradient-aurora relative flex h-20 w-20 items-center justify-center rounded-full shadow-lg ring-4 ring-bg">
                <svg aria-hidden viewBox="0 0 24 24" className="h-10 w-10 text-warning drop-shadow" fill="currentColor">
                  <path d="M3 7.5 7.5 11 12 4l4.5 7L21 7.5 19 18H5L3 7.5Z" />
                  <rect x="5" y="19.5" width="14" height="2" rx="1" />
                </svg>
              </span>
            </div>
            <p className="mt-5 text-[13px] font-medium uppercase tracking-[0.2em] text-ink-muted">Premium faollashtirildi</p>
            <h3 className="mt-1 text-[28px] font-semibold leading-tight tracking-tight">Tabriklaymiz! 🎉</h3>
            <p className="mt-2 text-ink-muted">
              <b className="text-ink">{info.title}</b> tarifi {paidUntil ? <><b className="text-ink">{fmtDate(paidUntil)}</b> gacha</> : "30 kunga"} faol.
              {" "}{providerName} orqali {fmtSum(info.price)} to'landi.
            </p>
            <ul className="mx-auto mt-5 max-w-xs space-y-2 rounded-lg border border-border bg-bg/80 p-4 text-left text-sm backdrop-blur">
              {info.features.map(f => (
                <li key={f} className="flex items-start gap-2">
                  <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-success/15 text-success">
                    <svg aria-hidden viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round"><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>
                  </span>
                  {f}
                </li>
              ))}
            </ul>
            {plan === "center" && (
              <p className="mt-4 text-sm text-ink-muted">Endi o'qituvchilaringizni email orqali markaz obunasiga qo'shishingiz mumkin.</p>
            )}
            <div className="mt-6 flex flex-col-reverse justify-center gap-2 sm:flex-row">
              <Button variant="secondary" onClick={onClose}>Yopish</Button>
              <Button onClick={() => { onClose(); nav("/admin/billing?welcome=1"); }}>
                {plan === "center" ? "O'qituvchilarni qo'shish" : "Obunani ko'rish"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </Modal>
    </>
  );
}
