import type { BillingInfo, PlansResponse } from "../api/types";
import { fmtSum } from "../lib/format";
import { PLANS, planPrice } from "../lib/plans";
import { usePayModal } from "../stores/payModal";
import Crown from "./Crown";
import { Button, Modal } from "./ui";

/** Publish SUBSCRIPTION_REQUIRED qaytarganda */
export default function PaywallModal({ open, onClose, billing, plans }:
  { open: boolean; onClose: () => void; billing?: BillingInfo; plans?: PlansResponse }) {
  const openPay = usePayModal(s => s.open);
  return (
    <Modal open={open} onClose={onClose}>
      <div className="relative -mx-6 -mt-4 overflow-hidden px-6 pt-8 text-center">
        <div aria-hidden className="gradient-aurora pointer-events-none absolute -top-24 left-1/2 h-48 w-[140%] -translate-x-1/2 rounded-full opacity-50 blur-2xl" />
        <div className="relative">
          <span className="gradient-aurora mx-auto flex h-16 w-16 items-center justify-center rounded-full shadow-md ring-4 ring-bg">
            <Crown className="h-8 w-8 text-warning drop-shadow" />
          </span>
          <h3 className="mt-4 text-xl font-semibold tracking-tight">Testni nashr qilish uchun Premium kerak</h3>
          <p className="mt-2 text-sm text-ink-muted">Bepul sinov yoki obuna muddati tugagan. Test qoralama sifatida saqlandi — Premium ochilgach nashr qilasiz.</p>
        </div>
      </div>
      <div className="mt-5 grid grid-cols-2 gap-2">
        {PLANS.map(p => (
          <button key={p.id} type="button" onClick={() => { onClose(); openPay(p.id); }}
            className="rounded-lg border border-border p-3 text-left transition hover:border-ink">
            <p className="text-sm font-semibold">{p.title}</p>
            <p className="mt-1 text-lg font-semibold tracking-tight">{fmtSum(planPrice(p.id, plans, billing))}</p>
            <p className="text-[12px] text-ink-muted">30 kun</p>
          </button>
        ))}
      </div>
      <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button variant="secondary" onClick={onClose}>Keyinroq</Button>
        <Button onClick={() => { onClose(); openPay(); }}>Premium olish</Button>
      </div>
    </Modal>
  );
}
