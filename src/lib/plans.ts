import type { Plan } from "../api/types";

export interface PlanInfo { id: Plan; title: string; text: string; price: number; features: string[] }

/** Tariflar: ochiq Premium sahifa va Tarif sahifasi uchun yagona manba.
 *  Haqiqiy to'lov summasi backenddan (/billing/me/ -> prices) keladi. */
export const PLANS: PlanInfo[] = [
  { id: "teacher", title: "O'qituvchi", text: "Bitta o'qituvchi uchun", price: 49_000,
    features: ["Cheksiz testlar", "Anti-cheat kuzatuv", "Natijalarni Excel'ga yuklash"] },
  { id: "center", title: "O'quv markaz", text: "Bir nechta o'qituvchi bitta obunada", price: 400_000,
    features: ["O'qituvchi tarifidagi hamma narsa", "O'qituvchilarni email bo'yicha qo'shish", "Bitta to'lov — butun jamoa"] },
];
