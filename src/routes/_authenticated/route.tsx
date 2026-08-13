import { createFileRoute, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { CalendarDays, ChevronDown, LogOut, Menu } from "lucide-react";

import { AppSidebar } from "@/components/AppSidebar";
import { ThemeToggle } from "@/components/ThemeToggle";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  component: AuthedShell,
});

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function pageTitle(pathname: string): string {
  const segments = pathname.split("/").filter(Boolean);
  let last = segments.pop() ?? "";
  if (UUID_RE.test(last)) last = segments.pop() ?? last;
  if (!last || last === "dashboard") return "Dashboard";
  return last
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

const today = new Date().toLocaleDateString(undefined, {
  weekday: "short",
  day: "numeric",
  month: "short",
});

function AuthedShell() {
  const { user, loading, roles, signOut } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [avatarMenuOpen, setAvatarMenuOpen] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/auth", replace: true });
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!user || loading) return;
    const parentOnly = roles.length > 0 && roles.every((role) => role === "PARENT");
    const allowed = ["/portal", "/announcements", "/calendar", "/meetings", "/change-password"];
    if (parentOnly && !allowed.some((path) => pathname.startsWith(path))) {
      navigate({ to: "/portal", replace: true });
    }
  }, [user, loading, roles, pathname, navigate]);

  useEffect(() => {
    setSidebarOpen(false);
    setAvatarMenuOpen(false);
  }, [pathname]);

  if (loading || !user) {
    return (
      <div className="app-canvas flex min-h-screen items-center justify-center px-6">
        <div className="flex flex-col items-center gap-5 text-center animate-fade-in">
          <div className="relative h-16 w-16 overflow-hidden rounded-2xl border border-border/70 bg-white p-1 shadow-depth">
            <img src="/logo.png" alt="Chaz Crestview Academy" className="h-full w-full object-contain" />
            <span className="absolute inset-0 rounded-2xl border-2 border-primary/15 animate-pulse" />
          </div>
          <div>
            <p className="font-display text-xl font-semibold text-foreground">Preparing your workspace</p>
            <p className="mt-1 text-xs text-muted-foreground">Loading school operations securely…</p>
          </div>
          <div className="h-1 w-28 overflow-hidden rounded-full bg-primary/10">
            <div className="h-full w-1/2 rounded-full bg-primary animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  const initial = (user.fullName || user.email || "?").charAt(0).toUpperCase();
  const title = pageTitle(pathname);
  const primaryRole = roles[0]?.replace(/_/g, " ") ?? "Team member";

  return (
    <div className="flex min-h-screen bg-background">
      <AppSidebar mobileOpen={sidebarOpen} onMobileClose={() => setSidebarOpen(false)} />

      <div className="flex min-w-0 flex-1 flex-col overflow-x-hidden">
        <header className="workspace-bar no-print sticky top-0 z-30 shrink-0 border-b border-border/60">
          <div className="flex h-16 items-center gap-3 px-3 sm:px-5 lg:px-7">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border/70 bg-card/70 text-muted-foreground shadow-sm transition-colors hover:bg-accent hover:text-foreground md:hidden"
              aria-label="Open navigation"
            >
              <Menu className="h-[18px] w-[18px]" />
            </button>

            <div className="min-w-0 flex-1">
              <div className="hidden items-center gap-2 text-[10px] font-bold uppercase tracking-[0.17em] text-muted-foreground sm:flex">
                <span>Chaz Crestview</span>
                <span className="h-1 w-1 rounded-full bg-brand-gold" />
                <span className="text-primary/70">Workspace</span>
              </div>
              <p className="truncate text-sm font-semibold tracking-[-0.01em] text-foreground sm:mt-0.5 sm:text-base">
                {title}
              </p>
            </div>

            <div className="hidden items-center gap-2 rounded-xl border border-border/60 bg-card/55 px-3 py-2 text-xs text-muted-foreground xl:flex">
              <CalendarDays className="h-3.5 w-3.5 text-primary/65" />
              <span>{today}</span>
            </div>

            <ThemeToggle />

            <div className="relative">
              <button
                type="button"
                onClick={() => setAvatarMenuOpen((open) => !open)}
                className="flex h-10 items-center gap-2 rounded-xl border border-border/70 bg-card/75 p-1 pr-2 shadow-sm transition-all hover:border-primary/20 hover:shadow-md"
                aria-expanded={avatarMenuOpen}
                aria-label="Open account menu"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-brand-sky text-xs font-extrabold text-white shadow-sm">
                  {initial}
                </span>
                <span className="hidden max-w-36 text-left lg:block">
                  <span className="block truncate text-[11.5px] font-semibold leading-tight text-foreground">
                    {user.fullName || user.email}
                  </span>
                  <span className="mt-0.5 block truncate text-[9px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
                    {primaryRole}
                  </span>
                </span>
                <ChevronDown className="hidden h-3.5 w-3.5 text-muted-foreground lg:block" />
              </button>

              {avatarMenuOpen && (
                <>
                  <button
                    type="button"
                    className="fixed inset-0 z-40 cursor-default"
                    onClick={() => setAvatarMenuOpen(false)}
                    aria-label="Close account menu"
                  />
                  <div className="surface-panel absolute right-0 top-12 z-50 w-64 rounded-2xl p-2 animate-scale-in">
                    <div className="rounded-xl bg-muted/55 px-3 py-3">
                      <p className="truncate text-sm font-semibold text-foreground">
                        {user.fullName || "School team member"}
                      </p>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">{user.email}</p>
                      <div className="mt-2 flex flex-wrap gap-1">
                        {roles.slice(0, 3).map((role) => (
                          <span
                            key={role}
                            className="rounded-full border border-primary/10 bg-primary/8 px-2 py-0.5 text-[8.5px] font-bold uppercase tracking-wider text-primary"
                          >
                            {role.replace(/_/g, " ")}
                          </span>
                        ))}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={signOut}
                      className="mt-1 flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-[13px] font-medium text-destructive transition-colors hover:bg-destructive/8"
                    >
                      <LogOut className="h-4 w-4" />
                      Sign out securely
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        <main className="app-canvas min-h-0 flex-1 overflow-x-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
