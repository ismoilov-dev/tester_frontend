import { Badge, Button } from "../../components/ui";
import { usePlans, usePremium } from "../../hooks/useBilling";
import { fmtSum } from "../../lib/format";
import { PLANS, planPrice } from "../../lib/plans";
import { usePayModal } from "../../stores/payModal";

const FAQ: { q: string; a: string }[] = [
  { q: "Bepul sinab ko'rsa bo'ladimi?", a: "Ha. Google orqali birinchi marta kirganingizda bepul sinov muddati ochiladi — to'lovsiz test yaratib, nashr qilishingiz mumkin." },
  { q: "To'lov qanday amalga oshiriladi?", a: "«Boshlash» ni bosing: ko'rsatilgan kartaga aynan tarif summasini o'tkazasiz va chek rasmini yuklaysiz. Chek odatda 1 soat ichida tekshiriladi, tasdiqlangach Premium 30 kunga ochiladi." },
  { q: "Muddat tugamasdan to'lasam nima bo'ladi?", a: "Yangi 30 kun qolgan kunlar ustiga qo'shiladi — hech narsa yo'qolmaydi." },
  { q: "Chekim rad etilsa nima bo'ladi?", a: "Sababi ko'rsatiladi — chekni tekshirib, qayta yuborishingiz mumkin." },
  { q: "Obuna tugasa testlarim o'chib ketadimi?", a: "Yo'q. Testlar va eski natijalar saqlanib qoladi, faqat yangi testni nashr qilish uchun obunani uzaytirish kerak." },
];

export default function PremiumPage() {
  const { billing } = usePremium();
  const plans = usePlans().data;
  const openPay = usePayModal(s => s.open);
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
                {fmtSum(planPrice(p.id, plans, billing))}<span className="text-sm font-normal text-ink-muted"> / 30 kun</span>
              </p>
              <ul className="mt-5 flex-1 space-y-2 text-sm text-ink-muted">
                {p.features.map(f => <li key={f}>✓ {f}</li>)}
              </ul>
              <Button className="mt-6 w-full" size="lg" variant={featured ? "primary" : "secondary"} onClick={() => openPay(p.id)}>
                Boshlash
              </Button>
            </div>
          );
        })}
      </div>
      <p className="mt-4 text-center text-[13px] text-ink-muted">To'lov kartaga o'tkazma orqali, chek tasdiqlangach Premium 30 kunga ochiladi.</p>

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
    </div>
  );
}
