import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Link, Outlet, useNavigate } from "react-router-dom";
import { logout, me } from "../api/admin";
import { usePlans, usePremium } from "../hooks/useBilling";
import { daysLeft, fmtSum } from "../lib/format";
import { planPrice } from "../lib/plans";
import { useAuth } from "../stores/auth";
import { useFeedbackPrompt } from "../stores/feedback";
import Crown from "./Crown";
import FeedbackModal from "./FeedbackModal";
import PayModal from "./PayModal";
import PremiumPill from "./PremiumPill";
import PremiumWatcher from "./PremiumWatcher";
import { Button } from "./ui";

const BANNER_KEY = "tester.premium.bannerHidden";
function readSession(k: string) { try { return sessionStorage.getItem(k); } catch { return null; } }
function writeSession(k: string, v: string) { try { sessionStorage.setItem(k, v); } catch { /* storage yo'q */ } }

export default function AdminLayout() {
  const user = useAuth(s => s.user);
  const nav = useNavigate();
  // feedback_due backenddan — sahifa yangilansa ham to'g'ri holat
  const meQ = useQuery({ queryKey: ["me"], queryFn: me, retry: false, staleTime: 60_000 });
  const feedbackDue = meQ.data?.feedback_due;
  const isSuper = meQ.data?.role === "superadmin";
  const { billing, state } = usePremium();
  const plans = usePlans(!!billing).data;
  const left = state?.left ?? daysLeft(meQ.data?.access_until);
  const hasAccess = billing?.has_access ?? meQ.data?.has_access;
  const [bannerHidden, setBannerHidden] = useState(() => readSession(BANNER_KEY) === "1");
  const showBanner = !isSuper && !bannerHidden && hasAccess !== undefined && state?.status !== "pending" && (!hasAccess || left <= 3);
  const minPrice = fmtSum(planPrice("teacher", plans, billing));
  useEffect(() => { if (feedbackDue) useFeedbackPrompt.getState().ask(); }, [feedbackDue]);

  async function onLogout() {
    const refresh = useAuth.getState().refresh;
    if (refresh) await logout(refresh).catch(() => {});
    useAuth.getState().clear();
    nav("/admin/login", { replace: true });
  }

  return (
    <div className="min-h-screen bg-bg">
      <header className="sticky top-0 z-30 border-b border-border bg-bg/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link to="/admin" className="flex items-center gap-2.5 text-[17px] font-semibold tracking-tight">
            <span className="gradient-aurora relative h-7 w-7 rounded-full">
              {state?.isPremium && (
                <span title="Premium" className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-bg shadow-sm ring-1 ring-border">
                  <Crown className="h-2.5 w-2.5 text-warning" />
                </span>
              )}
            </span>
            Tester
          </Link>
          <div className="flex items-center gap-2">
            {!isSuper && <PremiumPill state={state} />}
            <span className="hidden text-sm text-ink-muted sm:inline">{user?.full_name || user?.email}</span>
            <Button variant="ghost" size="sm" onClick={onLogout}>Chiqish</Button>
          </div>
        </div>
      </header>
      {showBanner && (
        <div className={`flex items-center justify-center gap-3 border-b border-border px-4 py-2.5 text-sm ${hasAccess ? "bg-peach/50" : "bg-blush/50"}`}>
          <p className="text-center">
            {!hasAccess
              ? <>Obuna muddati tugagan: yangi testlarni nashr qilish uchun Premium kerak. Premium {minPrice} dan.</>
              : state?.isPremium
                ? <>Premium tugashiga <b>{left} kun</b> qoldi.</>
                : <>Sinov muddati <b>{left} kunda</b> tugaydi. Premium {minPrice} dan.</>}
            {" "}
            <Link to={state?.isPremium ? "/admin/billing" : "/admin/premium"} className="font-semibold underline underline-offset-2">
              {state?.isPremium ? "Uzaytirish" : "Tarifni ko'rish"}
            </Link>
          </p>
          <button type="button" aria-label="Yopish" className="text-ink-muted hover:text-ink"
            onClick={() => { writeSession(BANNER_KEY, "1"); setBannerHidden(true); }}>✕</button>
        </div>
      )}
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <Outlet />
      </main>
      <FeedbackModal />
      {!isSuper && <><PayModal /><PremiumWatcher billing={billing} /></>}
    </div>
  );
}
