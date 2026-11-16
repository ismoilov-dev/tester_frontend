import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { getBilling, getPlans, me } from "../api/admin";
import type { BillingInfo } from "../api/types";
import { daysLeft } from "../lib/format";

/**
 * /billing/me/. Chek tekshirilayotganda 15 s da bir yangilanadi, oynaga qaytganda ham —
 * foydalanuvchi qaysi sahifada bo'lmasin tasdiqni darhol bilib oladi.
 */
export function useBilling(enabled = true) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["billing"],
    queryFn: getBilling,
    enabled,
    retry: 1,
    refetchOnWindowFocus: true,
    refetchInterval: query => (query.state.data?.pending_payment ? 15_000 : false),
  });
  // pending -> approved/rejected: /auth/me/ dagi has_access ham yangilansin
  const pendingId = q.data?.pending_payment?.id ?? null;
  const prev = useRef<number | null>(null);
  useEffect(() => {
    if (prev.current !== null && pendingId === null) {
      qc.invalidateQueries({ queryKey: ["me"] });
      qc.invalidateQueries({ queryKey: ["billing", "payments"] });
    }
    prev.current = pendingId;
  }, [pendingId, qc]);
  return q;
}

/** Narxlar va to'lov kartasi */
export const usePlans = (enabled = true) =>
  useQuery({ queryKey: ["billing", "plans"], queryFn: getPlans, enabled, staleTime: 5 * 60_000 });

export type PremiumStatus = "trial" | "trial_ending" | "expired" | "pending" | "premium" | "premium_ending";
export interface PremiumState {
  status: PremiumStatus;
  /** Pullik obuna yoki markaz obunasi faol */
  isPremium: boolean;
  left: number;
}

/** Obuna holati: header, bannerlar va upsell kartalari shu bitta funksiyaga tayanadi */
export function getPremiumState(b: BillingInfo | undefined | null): PremiumState | null {
  if (!b) return null;
  const left = daysLeft(b.access_until);
  const paidActive = daysLeft(b.paid_until) > 0;
  const centerActive = daysLeft(b.center?.until) > 0;
  const isPremium = b.has_access && (paidActive || centerActive);
  if (b.pending_payment) return { status: "pending", isPremium, left };
  if (!b.has_access) return { status: "expired", isPremium: false, left: 0 };
  if (isPremium) return { status: left <= 3 ? "premium_ending" : "premium", isPremium, left };
  return { status: left <= 3 ? "trial_ending" : "trial", isPremium: false, left };
}

/** Joriy foydalanuvchining premium holati. Superadmin uchun billing so'ralmaydi va state = null */
export function usePremium() {
  const meQ = useQuery({ queryKey: ["me"], queryFn: me, retry: false, staleTime: 60_000 });
  const isSuper = meQ.data?.role === "superadmin";
  const q = useBilling(!!meQ.data && !isSuper);
  return { billing: q.data, state: isSuper ? null : getPremiumState(q.data), isSuper, query: q };
}
