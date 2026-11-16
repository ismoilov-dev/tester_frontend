import { Link } from "react-router-dom";
import type { PremiumState } from "../hooks/useBilling";
import Crown from "./Crown";

/** Headerdagi premium belgisi: yo'q -> "Premiumga o'tish", kutilmoqda, faol -> "Premium · N kun" */
export default function PremiumPill({ state }: { state: PremiumState | null }) {
  const base = "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition";
  if (state?.status === "pending")
    return (
      <Link to="/admin/billing" title="Chek tekshirilmoqda" className={`${base} border border-border hover:bg-surface-100`}>
        <span className="h-2 w-2 rounded-full bg-warning motion-safe:animate-pulse" />
        <span className="hidden sm:inline">Chek tekshirilmoqda</span>
      </Link>
    );
  if (state?.isPremium) {
    const ending = state.left <= 3;
    return (
      <Link to="/admin/billing" title="Premium obuna" className={`${base} border border-border hover:border-border-strong hover:bg-surface-100`}>
        <span className="gradient-aurora flex h-6 w-6 items-center justify-center rounded-full ring-2 ring-bg">
          <Crown className="h-3.5 w-3.5 text-warning" />
        </span>
        <span className={ending ? "text-warning" : ""}>Premium<span className="hidden sm:inline"> · {state.left} kun</span></span>
      </Link>
    );
  }
  return (
    <Link to="/admin/premium" title="Tariflar" className={`${base} gradient-aurora shadow-sm hover:shadow-md motion-safe:animate-[breathe_3s_ease-in-out_infinite]`}>
      <Crown className="h-4 w-4 text-warning" />
      <span className="hidden sm:inline">Premiumga o'tish</span>
    </Link>
  );
}
