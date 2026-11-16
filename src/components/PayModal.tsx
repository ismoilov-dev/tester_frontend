import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState, type DragEvent } from "react";
import { submitPayment } from "../api/admin";
import { isCode, toApiError } from "../api/errors";
import type { Plan } from "../api/types";
import { useBilling, usePlans } from "../hooks/useBilling";
import { copyText, fmtSum } from "../lib/format";
import { PLANS, planInfo, planPrice } from "../lib/plans";
import { fmtSize, prepareReceipt, RECEIPT_ACCEPT } from "../lib/receipt";
import { usePayModal } from "../stores/payModal";
import Crown from "./Crown";
import { toast } from "./toast";
import { Button, ErrorBox, Hint, Input, Label, Modal, Spinner } from "./ui";

type Step = "plan" | "transfer" | "upload" | "done";
const STEPS: Step[] = ["plan", "transfer", "upload"];
const STEP_TITLES: Record<Step, string> = { plan: "Tarifni tanlang", transfer: "Kartaga o'tkazing", upload: "Chekni yuklang", done: "" };

/** Backend details ichidan maydon xatosini oladi: { center_name: ["..."] } */
function fieldError(details: any, key: string): string | null {
  const v = details?.[key];
  if (!v) return null;
  return Array.isArray(v) ? String(v[0]) : String(v);
}

function CopyRow({ label, value, display, mono }: { label: string; value: string; display?: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-[12px] uppercase tracking-[0.14em] text-ink-muted">{label}</p>
        <p className={`truncate font-semibold ${mono ? "font-mono text-lg tracking-wider sm:text-xl" : "text-base"}`}>{display ?? value}</p>
      </div>
      <Button size="sm" variant="secondary" onClick={async () => toast(await copyText(value) ? "Nusxalandi" : "Nusxalab bo'lmadi", "success")}>
        Nusxalash
      </Button>
    </div>
  );
}

/** P2P to'lov: tarif -> kartaga o'tkazma -> chek yuklash -> yuborildi. Konfetti faqat tasdiqdan keyin (PremiumWatcher) */
export default function PayModal() {
  const { isOpen, plan: initialPlan, close } = usePayModal();
  const qc = useQueryClient();
  const billing = useBilling(isOpen).data;
  const plansQ = usePlans(isOpen);
  const [step, setStep] = useState<Step>("plan");
  const [plan, setPlan] = useState<Plan>("teacher");
  const [centerName, setCenterName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [fileError, setFileError] = useState("");
  const [nameError, setNameError] = useState("");
  const [drag, setDrag] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Har ochilganda boshidan
  useEffect(() => {
    if (!isOpen) return;
    setStep("plan");
    setPlan(initialPlan ?? billing?.plan ?? "teacher");
    setCenterName(billing?.center?.name ?? "");
    setFile(null); setError(""); setFileError(""); setNameError(""); setProgress(0);
  }, [isOpen, initialPlan]);

  useEffect(() => {
    if (!file || !file.type.startsWith("image/")) { setPreview(null); return; }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const price = planPrice(plan, plansQ.data, billing);
  const card = plansQ.data?.card ?? billing?.card;
  const info = planInfo(plan);
  const nameOk = plan !== "center" || (centerName.trim().length > 0 && centerName.trim().length <= 150);

  async function pick(f: File | undefined | null) {
    if (!f) return;
    setFileError(""); setError("");
    setPreparing(true);
    try { setFile(await prepareReceipt(f)); }
    catch (e) { setFile(null); setFileError((e as Error).message); }
    finally { setPreparing(false); }
  }

  function onDrop(e: DragEvent) {
    e.preventDefault(); setDrag(false);
    pick(e.dataTransfer.files?.[0]);
  }

  async function send() {
    if (!file || !nameOk) return;
    setError(""); setFileError(""); setNameError("");
    setSending(true); setProgress(0);
    try {
      await submitPayment(plan, file, centerName, setProgress);
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["billing"] }),
        qc.invalidateQueries({ queryKey: ["me"] }),
      ]);
      setStep("done");
    } catch (e) {
      const err = toApiError(e);
      if (isCode(err, "PAYMENT_PENDING") || err.status === 409) {
        qc.invalidateQueries({ queryKey: ["billing"] });
        close();
        toast("Sizda tekshirilayotgan chek bor — tasdiqlanishini kuting", "info");
      } else if (err.status === 413) {
        setFileError("Fayl juda katta (5 MB gacha)");
      } else if (err.status === 0) {
        setError("Internet aloqasi yo'q. Fayl saqlab qo'yildi — qayta urinib ko'ring.");
      } else {
        const nameErr = fieldError(err.details, "center_name");
        const recErr = fieldError(err.details, "receipt");
        if (nameErr) { setNameError(nameErr); setStep("plan"); }
        if (recErr) setFileError(recErr);
        if (!nameErr && !recErr) setError(err.message);
      }
    } finally {
      setSending(false);
    }
  }

  const onClose = () => { if (!sending) close(); };
  const stepIdx = STEPS.indexOf(step);

  return (
    <Modal open={isOpen} onClose={onClose} title={step === "done" ? undefined : (
      <div>
        <div className="flex items-center gap-2"><Crown className="h-5 w-5 text-warning" />{STEP_TITLES[step]}</div>
        <div className="mt-3 flex gap-1.5" aria-label={`${stepIdx + 1}-qadam, jami 3`}>
          {STEPS.map((s, i) => <span key={s} className={`h-1 flex-1 rounded-full ${i <= stepIdx ? "gradient-aurora" : "bg-surface-100"}`} />)}
        </div>
      </div>
    )}>
      {step === "plan" && (
        <div className="space-y-4">
          <div className="grid gap-2 sm:grid-cols-2">
            {PLANS.map(p => (
              <button key={p.id} type="button" onClick={() => setPlan(p.id)} aria-pressed={plan === p.id}
                className={`rounded-lg border p-3 text-left transition ${plan === p.id ? "border-ink shadow-md" : "border-border hover:border-border-strong"}`}>
                <p className="font-semibold">{p.title}</p>
                <p className="text-[12px] text-ink-muted">{p.text}</p>
                <p className="mt-2 text-lg font-semibold tracking-tight">{fmtSum(planPrice(p.id, plansQ.data, billing))}
                  <span className="text-[12px] font-normal text-ink-muted"> / 30 kun</span></p>
              </button>
            ))}
          </div>
          {plan === "center" && (
            <div>
              <Label>O'quv markaz nomi</Label>
              <Input value={centerName} maxLength={150} placeholder="Masalan: Bilim markazi"
                onChange={e => { setCenterName(e.target.value); setNameError(""); }} />
              {nameError ? <Hint error>{nameError}</Hint> : <Hint>O'qituvchilaringiz shu nom ostida ko'rinadi</Hint>}
            </div>
          )}
          <ul className="space-y-1 text-[13px] text-ink-muted">{info.features.map(f => <li key={f}>✓ {f}</li>)}</ul>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={onClose}>Bekor qilish</Button>
            <Button disabled={!nameOk} onClick={() => setStep("transfer")}>Davom etish</Button>
          </div>
        </div>
      )}

      {step === "transfer" && (
        <div className="space-y-4">
          <div className="relative overflow-hidden rounded-xl border border-border p-4">
            <div aria-hidden className="gradient-aurora pointer-events-none absolute -right-10 -top-12 h-32 w-32 rounded-full opacity-50 blur-2xl" />
            <div className="relative space-y-4">
              {card ? (
                <>
                  <CopyRow label="Karta raqami" value={card.number.replace(/\s/g, "")} display={card.number} mono />
                  <div>
                    <p className="text-[12px] uppercase tracking-[0.14em] text-ink-muted">Karta egasi</p>
                    <p className="font-semibold">{card.holder}</p>
                  </div>
                </>
              ) : plansQ.isLoading ? <div className="flex justify-center py-4"><Spinner /></div>
                : <ErrorBox>Karta ma'lumotini yuklab bo'lmadi. Sahifani yangilang.</ErrorBox>}
              <div className="border-t border-border pt-4">
                <CopyRow label="Aynan shu summani o'tkazing" value={String(price)} display={fmtSum(price)} />
              </div>
            </div>
          </div>
          <ol className="space-y-2 text-sm">
            {["Ko'rsatilgan kartaga aynan shu summani o'tkazing", "To'lov chekini skrinshot qiling", "Keyingi qadamda chekni yuklang"].map((t, i) => (
              <li key={t} className="flex items-center gap-2">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface-100 text-xs font-semibold">{i + 1}</span>{t}
              </li>
            ))}
          </ol>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={() => setStep("plan")}>Orqaga</Button>
            <Button disabled={!card} onClick={() => setStep("upload")}>O'tkazdim</Button>
          </div>
        </div>
      )}

      {step === "upload" && (
        <div className="space-y-4">
          <p className="text-sm text-ink-muted">{info.title} tarifi · <b className="text-ink">{fmtSum(price)}</b>
            {plan === "center" && centerName.trim() && <> · {centerName.trim()}</>}</p>
          <input ref={inputRef} type="file" accept={RECEIPT_ACCEPT} className="hidden"
            onChange={e => { pick(e.target.files?.[0]); e.target.value = ""; }} />
          {!file ? (
            <div onDragOver={e => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={onDrop}
              className={`flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-4 py-8 text-center transition ${drag ? "border-ink bg-surface-100" : "border-border"}`}>
              {preparing ? <Spinner /> : (
                <>
                  <p className="text-sm text-ink-muted"><span className="hidden sm:inline">Chekni shu yerga tashlang yoki </span>rasm yoki PDF, 5 MB gacha</p>
                  <Button variant="secondary" onClick={() => inputRef.current?.click()}>Chek rasmini tanlash</Button>
                </>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-3 rounded-xl border border-border p-3">
              {preview
                ? <img src={preview} alt="Chek" className="h-16 w-16 shrink-0 rounded-md object-cover" />
                : <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-md bg-surface-100 text-xs font-semibold">PDF</span>}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{file.name}</p>
                <p className="text-[13px] text-ink-muted">{fmtSize(file.size)}</p>
              </div>
              <Button size="sm" variant="ghost" disabled={sending} onClick={() => inputRef.current?.click()}>Almashtirish</Button>
            </div>
          )}
          {fileError && <Hint error>{fileError}</Hint>}
          {sending && (
            <div className="h-1.5 overflow-hidden rounded-full bg-surface-100">
              <div className="gradient-aurora h-full transition-all" style={{ width: `${Math.round(progress * 100)}%` }} />
            </div>
          )}
          {error && <ErrorBox>{error}</ErrorBox>}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" disabled={sending} onClick={() => setStep("transfer")}>Orqaga</Button>
            <Button loading={sending} disabled={!file || !nameOk || preparing} onClick={send}>{error ? "Qayta urinish" : "Yuborish"}</Button>
          </div>
        </div>
      )}

      {step === "done" && (
        <div className="py-4 text-center">
          <span className="gradient-aurora mx-auto flex h-16 w-16 items-center justify-center rounded-full ring-4 ring-bg">
            <svg aria-hidden viewBox="0 0 24 24" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>
          </span>
          <h3 className="mt-4 text-xl font-semibold tracking-tight">Chekingiz qabul qilindi</h3>
          <p className="mt-2 text-sm text-ink-muted">Odatda 1 soat ichida tekshiriladi. Tasdiqlangach Premium avtomatik ochiladi — shu sahifada xabar beramiz.</p>
          <Button className="mt-6" onClick={close}>Tushunarli</Button>
        </div>
      )}
    </Modal>
  );
}
