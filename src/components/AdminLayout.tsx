import { Link, Outlet, useNavigate } from "react-router-dom";
import { logout } from "../api/admin";
import { useAuth } from "../stores/auth";
import { Button } from "./ui";

export default function AdminLayout() {
  const user = useAuth(s => s.user);
  const nav = useNavigate();

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
            <span className="hidden text-sm text-ink-muted sm:inline">{user?.full_name || user?.email}</span>
            <Button variant="ghost" size="sm" onClick={onLogout}>Chiqish</Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <Outlet />
      </main>
    </div>
  );
}
