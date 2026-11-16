import type { BillingInfo, Plan, PlansResponse } from "../api/types";

export interface PlanInfo { id: Plan; title: string; text: string; price: number; features: string[] }

/** Tariflar: ochiq Premium sahifa va Tarif sahifasi uchun yagona manba.
 *  `price` — faqat zaxira: ekranda backend narxi (/billing/plans/ yoki /billing/me/ -> prices) ustun. */
export const PLANS: PlanInfo[] = [
  { id: "teacher", title: "O'qituvchi", text: "Bitta o'qituvchi uchun", price: 49_000,
    features: ["Cheksiz testlar", "Anti-cheat kuzatuv", "Natijalarni Excel'ga yuklash"] },
  { id: "center", title: "O'quv markaz", text: "Bir nechta o'qituvchi bitta obunada", price: 300_000,
    features: ["O'qituvchi tarifidagi hamma narsa", "O'qituvchilarni email bo'yicha qo'shish", "Bitta to'lov — butun jamoa"] },
];

export const planInfo = (id: Plan) => PLANS.find(p => p.id === id) ?? PLANS[0];

/** Narx: /billing/plans/ -> /billing/me/ prices -> zaxira PLANS */
export function planPrice(id: Plan, plans?: PlansResponse | null, billing?: BillingInfo | null) {
  return plans?.plans.find(p => p.code === id)?.price ?? billing?.prices?.[id] ?? planInfo(id).price;
}
