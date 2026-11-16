import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { Link, Outlet, useNavigate } from "react-router-dom";
import { logout, me } from "../api/admin";
import { daysLeft } from "../lib/format";
import { useAuth } from "../stores/auth";
import { useFeedbackPrompt } from "../stores/feedback";
import FeedbackModal from "./FeedbackModal";
import { Button } from "./ui";

export default function AdminLayout() {
  const user = useAuth(s => s.user);
  const nav = useNavigate();
  // feedback_due backenddan — sahifa yangilansa ham to'g'ri holat
  const meQ = useQuery({ queryKey: ["me"], queryFn: me, retry: false, staleTime: 60_000 });
  const feedbackDue = meQ.data?.feedback_due;
  const isSuper = meQ.data?.role === "superadmin";
  const left = daysLeft(meQ.data?.access_until);
  const showBanner = meQ.data && meQ.data.has_access !== undefined && !isSuper && (!meQ.data.has_access || left <= 3);
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
            <span className="gradient-aurora h-7 w-7 rounded-full" />
            Tester
          </Link>
          <div className="flex items-center gap-2">
            <Link to="/admin/premium" aria-label="Premium" title="Tariflar"
              className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-sm font-medium transition hover:border-border-strong hover:bg-surface-100">
              <svg aria-hidden viewBox="0 0 24 24" className="h-4 w-4 text-warning" fill="currentColor">
                <path d="M3 7.5 7.5 11 12 4l4.5 7L21 7.5 19 18H5L3 7.5Z" />
                <rect x="5" y="19.5" width="14" height="2" rx="1" />
              </svg>
              <span className="hidden sm:inline">Premium</span>
            </Link>
            <span className="hidden text-sm text-ink-muted sm:inline">{user?.full_name || user?.email}</span>
            <Button variant="ghost" size="sm" onClick={onLogout}>Chiqish</Button>
          </div>
        </div>
      </header>
      {showBanner && (
        <Link to="/admin/billing" className="block border-b border-border bg-peach/50 px-4 py-2.5 text-center text-sm transition hover:bg-peach/70">
          {meQ.data!.has_access
            ? <>Obuna muddati tugashiga <b>{left} kun</b> qoldi — tarifni uzaytiring</>
            : <>Obuna muddati tugagan: yangi testlarni nashr qilish uchun <b>tarifni to'lang</b></>}
        </Link>
      )}
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <Outlet />
      </main>
      <FeedbackModal />
    </div>
  );
}
