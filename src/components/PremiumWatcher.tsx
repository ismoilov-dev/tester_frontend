import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { BillingInfo, Payment } from "../api/types";
import { fmtDate } from "../lib/format";
import { planInfo } from "../lib/plans";
import { usePayModal } from "../stores/payModal";
import Confetti from "./Confetti";
import Crown from "./Crown";
import { Button, Modal } from "./ui";

const SEEN_APPROVED = "tester.premium.seen";
const SEEN_REJECTED = "tester.premium.seenRejected";
const FRESH_MS = 7 * 86_400_000;

function readKey(k: string) { try { return localStorage.getItem(k); } catch { return null; } }
function writeKey(k: string, v: string) { try { localStorage.setItem(k, v); } catch { /* storage yo'q */ } }

/**
 * Chek tasdiqlansa — tabrik + konfetti, rad etilsa — sabab bilan modal.
 * Har bir to'lov uchun bir marta (localStorage). 7 kundan eski to'lovlar jimgina "ko'rilgan" bo'ladi.
 */
export default function PremiumWatcher({ billing }: { billing: BillingInfo | undefined }) {
  const nav = useNavigate();
  const openPay = usePayModal(s => s.open);
  const [approved, setApproved] = useState<Payment | null>(null);
  const [rejected, setRejected] = useState<Payment | null>(null);
  const [fire, setFire] = useState(0);
  const last = billing?.last_payment;

  useEffect(() => {
    if (!last || billing?.pending_payment) return;
    const key = last.status === "approved" ? SEEN_APPROVED : last.status === "rejected" ? SEEN_REJECTED : null;
    if (!key || readKey(key) === String(last.id)) return;
    const fresh = Date.now() - new Date(last.reviewed_at ?? last.created_at).getTime() < FRESH_MS;
    if (!fresh) { writeKey(key, String(last.id)); return; }
    if (last.status === "approved") { setApproved(last); setFire(Date.now()); }
    else setRejected(last);
  }, [last, billing?.pending_payment]);

  function closeApproved() { if (approved) writeKey(SEEN_APPROVED, String(approved.id)); setApproved(null); }
  function closeRejected() { if (rejected) writeKey(SEEN_REJECTED, String(rejected.id)); setRejected(null); }

  const info = approved ? planInfo(approved.plan) : null;
  return (
    <>
      <Confetti fire={fire} />
      <Modal open={!!approved} onClose={closeApproved}>
        {approved && info && (
          <div className="relative -mx-6 -mt-4 overflow-hidden px-6 pb-2 pt-8 text-center">
            <div aria-hidden className="gradient-aurora pointer-events-none absolute -top-24 left-1/2 h-56 w-[140%] -translate-x-1/2 rounded-full opacity-60 blur-2xl" />
            <div className="relative">
              <div className="relative mx-auto flex h-20 w-20 items-center justify-center">
                <span className="gradient-aurora absolute inset-0 rounded-full opacity-40 motion-safe:animate-ping" />
                <span className="gradient-aurora relative flex h-20 w-20 items-center justify-center rounded-full shadow-lg ring-4 ring-bg">
                  <Crown className="h-10 w-10 text-warning drop-shadow" />
                </span>
              </div>
              <p className="mt-5 text-[13px] font-medium uppercase tracking-[0.2em] text-ink-muted">Premium faollashtirildi</p>
              <h3 className="mt-1 text-[28px] font-semibold leading-tight tracking-tight">Tabriklaymiz! 🎉</h3>
              <p className="mt-2 text-ink-muted">
                <b className="text-ink">{info.title}</b> tarifi{" "}
                {billing?.access_until ? <><b className="text-ink">{fmtDate(billing.access_until)}</b> gacha</> : "30 kunga"} faol.
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
              <div className="mt-6 flex flex-col-reverse justify-center gap-2 sm:flex-row">
                <Button variant="secondary" onClick={closeApproved}>Yopish</Button>
                <Button onClick={() => { const c = approved.plan === "center"; closeApproved(); nav(c ? "/admin/billing" : "/admin"); }}>
                  {approved.plan === "center" ? "O'qituvchilarni qo'shish" : "Test yaratish"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={!!rejected} onClose={closeRejected} title="Chekingiz qabul qilinmadi"
        footer={<>
          <Button variant="secondary" onClick={closeRejected}>Yopish</Button>
          <Button onClick={() => { const p = rejected?.plan; closeRejected(); openPay(p); }}>Qayta yuborish</Button>
        </>}>
        <p className="text-ink-muted">{fmtDate(rejected?.created_at)} kuni yuborilgan chek tasdiqlanmadi.</p>
        <div className="mt-3 rounded-md border border-border bg-peach/40 px-4 py-3 text-sm">
          <b>Sabab:</b> {rejected?.admin_note?.trim() || "To'lov topilmadi yoki summa mos kelmadi. Chekni tekshirib, qayta yuboring."}
        </div>
      </Modal>
    </>
  );
}
