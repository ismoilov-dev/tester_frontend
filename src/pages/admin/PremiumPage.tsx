import { useState } from "react";
import OnlinePayModal from "../../components/OnlinePayModal";
import type { Plan } from "../../api/types";
import { Badge, Button } from "../../components/ui";
import { fmtSum } from "../../lib/format";
import { PLANS } from "../../lib/plans";

const FAQ: { q: string; a: string }[] = [
  { q: "Bepul sinab ko'rsa bo'ladimi?", a: "Ha. Google orqali birinchi marta kirganingizda bepul sinov muddati ochiladi — to'lovsiz test yaratib, nashr qilishingiz mumkin." },
  { q: "To'lov qanday amalga oshiriladi?", a: "Tarif sahifasida ko'rsatilgan kartaga pul o'tkazasiz va chek rasmini yuklaysiz. Tasdiqlangach obuna 30 kunga ochiladi." },
  { q: "Muddat tugamasdan to'lasam nima bo'ladi?", a: "Yangi 30 kun qolgan kunlar ustiga qo'shiladi — hech narsa yo'qolmaydi." },
  { q: "Obuna tugasa testlarim o'chib ketadimi?", a: "Yo'q. Testlar va eski natijalar saqlanib qoladi, faqat yangi testni nashr qilish uchun obunani uzaytirish kerak." },
];

export default function PremiumPage() {
  const [payPlan, setPayPlan] = useState<Plan | null>(null);
  return (
    <div className="mx-auto max-w-4xl">
      <header className="mx-auto max-w-xl text-center">
        <h1 className="text-[28px] font-semibold tracking-tight sm:text-[34px]">Tariflar</h1>
        <p className="mt-2 text-ink-muted">Anti-cheat onlayn testlar: kamera, mikrofon va tab almashtirish kuzatuvi bilan.</p>
      </header>

      <div className="mt-10 grid gap-5 sm:grid-cols-2">
        {PLANS.map(p => {
          const featured = p.id === "teacher";
          return (
            <div key={p.id} className={`flex flex-col rounded-xl border bg-bg p-6 ${featured ? "border-ink shadow-md" : "border-border"}`}>
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-lg font-semibold tracking-tight">{p.title}</h2>
                {featured && <Badge>Ommabop</Badge>}
              </div>
              <p className="text-[13px] text-ink-muted">{p.text}</p>
              <p className="mt-5 text-[34px] font-semibold tracking-tight">
                {fmtSum(p.price)}<span className="text-sm font-normal text-ink-muted"> / oy</span>
              </p>
              <ul className="mt-5 flex-1 space-y-2 text-sm text-ink-muted">
                {p.features.map(f => <li key={f}>✓ {f}</li>)}
              </ul>
              <Button className="mt-6 w-full" size="lg" variant={featured ? "primary" : "secondary"} onClick={() => setPayPlan(p.id)}>
                Boshlash
              </Button>
            </div>
          );
        })}
      </div>
      <p className="mt-4 text-center text-[13px] text-ink-muted">Narxlar 30 kunlik obuna uchun. Ikkala tarif ham Click yoki Payme orqali karta bilan to'lanadi.</p>

      <section className="mx-auto mt-14 max-w-2xl">
        <h2 className="text-center text-2xl font-semibold tracking-tight">Ko'p beriladigan savollar</h2>
        <div className="mt-6 divide-y divide-border rounded-xl border border-border bg-bg">
          {FAQ.map(f => (
            <details key={f.q} className="group px-5 py-4">
              <summary className="cursor-pointer list-none font-medium marker:hidden">
                <span className="flex items-center justify-between gap-3">{f.q}<span className="text-ink-muted transition group-open:rotate-45">+</span></span>
              </summary>
              <p className="mt-2 text-sm text-ink-muted">{f.a}</p>
            </details>
          ))}
        </div>
      </section>
      <OnlinePayModal open={!!payPlan} onClose={() => setPayPlan(null)} plan={payPlan ?? "teacher"} />
    </div>
  );
}
