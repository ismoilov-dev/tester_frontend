/**
 * VAQTINCHALIK: backendda /billing/* hali deploy qilinmagan (404).
 * Shu vaqtgacha tarif sahifasi brauzerdagi soxta (fake) ma'lumotlar bilan ishlaydi.
 * Backend tayyor bo'lgach admin.ts dagi fallback o'z-o'zidan ishlamay qoladi.
 */
import { PLANS } from "../lib/plans";
import { ApiError } from "./errors";
import type { BillingInfo, CenterMember, Payment, Plan } from "./types";

/** Keyinchalik haqiqiy karta bilan almashtiriladi */
export const MOCK_CARD = { number: "8600 1234 5678 9012", holder: "TESTER PLATFORM" };
const MAX_TEACHERS = 10;
const TRIAL_DAYS = 7;
/** Soxta rejimda chek shuncha vaqtdan keyin "tasdiqlanadi" */
const AUTO_APPROVE_MS = 15_000;
const DAY = 86_400_000;
const KEY = "tester.billingMock.v1";

interface State {
  trial_until: string;
  paid_until: string | null;
  plan: Plan;
  payments: Payment[];
  members: CenterMember[];
}

function load(): State {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* storage yo'q — yangi holat */ }
  return { trial_until: new Date(Date.now() + TRIAL_DAYS * DAY).toISOString(), paid_until: null, plan: "teacher", payments: [], members: [] };
}
function save(s: State) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* e'tiborsiz */ }
}
const delay = <T,>(v: T) => new Promise<T>(r => setTimeout(() => r(v), 400));

/** Obunani 30 kunga uzaytiradi (qolgan kunlar ustiga) */
function extend(s: State, plan: Plan) {
  const base = Math.max(Date.now(), s.paid_until ? new Date(s.paid_until).getTime() : 0, new Date(s.trial_until).getTime());
  s.paid_until = new Date(base + 30 * DAY).toISOString();
  s.plan = plan;
}

/** Kutilayotgan cheklarni vaqt o'tgach tasdiqlaydi va muddatni uzaytiradi */
function settle(s: State) {
  for (const p of s.payments) {
    if (p.status !== "pending" || Date.now() - new Date(p.created_at).getTime() < AUTO_APPROVE_MS) continue;
    extend(s, p.plan);
    p.status = "approved";
    p.reviewed_at = new Date().toISOString();
  }
}

export async function mockGetBilling(): Promise<BillingInfo> {
  const s = load();
  settle(s);
  save(s);
  const until = [s.trial_until, s.paid_until].filter(Boolean).sort().pop() ?? null;
  const last = s.payments[s.payments.length - 1] ?? null;
  return delay({
    plan: s.plan,
    has_access: !!until && new Date(until).getTime() > Date.now(),
    access_until: until,
    trial_until: s.trial_until,
    paid_until: s.paid_until,
    is_center_owner: s.plan === "center" && !!s.paid_until,
    center: null,
    pending_payment: s.payments.find(p => p.status === "pending") ?? null,
    last_payment: last,
    prices: { teacher: PLANS[0].price, center: PLANS[1].price },
    card: MOCK_CARD,
    max_teachers: MAX_TEACHERS,
  });
}

export async function mockSubmitPayment(plan: Plan, _receipt: File): Promise<Payment> {
  const s = load();
  const p: Payment = {
    id: Date.now(), plan, amount: PLANS.find(x => x.id === plan)!.price, status: "pending",
    admin_note: "", created_at: new Date().toISOString(), reviewed_at: null,
  };
  s.payments.push(p);
  save(s);
  return delay(p);
}

export async function mockListMembers() { return delay(load().members); }

export async function mockAddMember(email: string): Promise<CenterMember> {
  const s = load();
  if (s.members.some(m => m.email === email)) throw new ApiError(400, "DUPLICATE", "Bu o'qituvchi allaqachon qo'shilgan");
  if (s.members.length >= MAX_TEACHERS) throw new ApiError(400, "LIMIT", "O'qituvchilar soni chegarasiga yetildi");
  const m: CenterMember = { id: Date.now(), email, full_name: "", added_at: new Date().toISOString() };
  s.members.push(m);
  save(s);
  return delay(m);
}

export async function mockRemoveMember(id: number) {
  const s = load();
  s.members = s.members.filter(m => m.id !== id);
  save(s);
  return delay(undefined);
}

/** Onlayn to'lov (Click / Payme) — soxta rejimda darhol tasdiqlanadi */
export async function mockPayOnline(plan: Plan, provider: string): Promise<Payment> {
  const s = load();
  const now = new Date().toISOString();
  const p: Payment = {
    id: Date.now(), plan, amount: PLANS.find(x => x.id === plan)!.price, status: "approved",
    admin_note: provider, created_at: now, reviewed_at: now,
  };
  s.payments.push(p);
  extend(s, plan);
  save(s);
  return delay(p);
}
