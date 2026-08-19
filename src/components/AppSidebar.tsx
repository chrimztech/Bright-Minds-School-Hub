import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard, Users, UserSquare2, GraduationCap, School, BookOpen,
  ClipboardCheck, Wallet, FileText, BookMarked, CalendarDays, CalendarRange, Settings,
  LogOut, Megaphone, ScrollText, UserPlus, Library, Bus, HeartPulse,
  Shield, Boxes, Receipt, Briefcase, ClipboardList, FolderOpen, DatabaseBackup,
  UtensilsCrossed, BarChart3, Mail, FileSignature, History, Handshake, ChevronRight, X, ArrowUpCircle,
  type LucideIcon,
} from "lucide-react";
import { useAuth, hasAny, ADMIN_ROLES, FINANCE_ROLES, TEACHING_ROLES } from "@/lib/auth";
import { Button } from "@/components/ui/button";

type NavItem = { to: string; label: string; icon: LucideIcon; roles?: string[] };
type NavGroup = { label: string | null; items: NavItem[] };

const GROUPS: NavGroup[] = [
  {
    label: null,
    items: [
      { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
      { to: "/portal", label: "My children", icon: UserSquare2, roles: ["PARENT"] },
    ],
  },
  {
    label: "Academic",
    items: [
      { to: "/admissions", label: "Admissions", icon: UserPlus, roles: ADMIN_ROLES },
      { to: "/pupils", label: "Pupils", icon: Users },
      { to: "/guardians", label: "Parents", icon: UserSquare2, roles: ADMIN_ROLES },
      { to: "/staff", label: "Staff", icon: GraduationCap, roles: ADMIN_ROLES },
      { to: "/classes", label: "Classes", icon: School, roles: ADMIN_ROLES },
      { to: "/subjects", label: "Subjects", icon: BookOpen, roles: ADMIN_ROLES },
      { to: "/academic-years", label: "Academic years", icon: CalendarRange, roles: ADMIN_ROLES },
      { to: "/attendance", label: "Attendance", icon: ClipboardCheck, roles: TEACHING_ROLES },
      { to: "/timetable", label: "Timetable", icon: CalendarDays },
      { to: "/homework", label: "Homework", icon: BookMarked },
      { to: "/exams", label: "Exams", icon: ScrollText, roles: TEACHING_ROLES },
      { to: "/marks", label: "Marks", icon: FileText, roles: TEACHING_ROLES },
      { to: "/report-cards", label: "Report cards", icon: FileText },
      { to: "/promotions", label: "Promotions", icon: ArrowUpCircle, roles: ADMIN_ROLES },
    ],
  },
  {
    label: "Finance",
    items: [
      { to: "/fees", label: "Fees & payments", icon: Wallet, roles: FINANCE_ROLES },
      { to: "/accounts", label: "Accounts", icon: Receipt, roles: FINANCE_ROLES },
      { to: "/payroll", label: "Payroll", icon: Briefcase, roles: FINANCE_ROLES },
      { to: "/procurement", label: "Procurement", icon: ClipboardList, roles: ADMIN_ROLES },
    ],
  },
  {
    label: "Operations",
    items: [
      { to: "/library", label: "Library", icon: Library, roles: ADMIN_ROLES },
      { to: "/transport", label: "Transport", icon: Bus, roles: ADMIN_ROLES },
      { to: "/canteen", label: "Canteen", icon: UtensilsCrossed, roles: FINANCE_ROLES },
      { to: "/health", label: "Health", icon: HeartPulse, roles: ADMIN_ROLES },
      { to: "/inventory", label: "Inventory", icon: Boxes, roles: ADMIN_ROLES },
      { to: "/discipline", label: "Discipline", icon: Shield, roles: TEACHING_ROLES },
      { to: "/leave", label: "Leave", icon: FileSignature, roles: ADMIN_ROLES },
    ],
  },
  {
    label: "Community",
    items: [
      { to: "/meetings", label: "PTC Meetings", icon: Handshake },
      { to: "/calendar", label: "Calendar", icon: CalendarDays },
      { to: "/communication", label: "Messaging", icon: Mail },
      { to: "/announcements", label: "Announcements", icon: Megaphone },
      { to: "/documents", label: "Documents", icon: FolderOpen },
    ],
  },
  {
    label: "Admin",
    items: [
      { to: "/reports", label: "Reports", icon: BarChart3, roles: ADMIN_ROLES },
      { to: "/users", label: "Users & roles", icon: Users, roles: ADMIN_ROLES },
      { to: "/audit", label: "Audit log", icon: History, roles: ADMIN_ROLES },
      { to: "/backup", label: "Backup", icon: DatabaseBackup, roles: ADMIN_ROLES },
      { to: "/settings", label: "Settings", icon: Settings, roles: ADMIN_ROLES },
    ],
  },
];

const PARENT_ONLY = ["/portal", "/announcements", "/calendar", "/meetings"];

interface AppSidebarProps {
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

export function AppSidebar({ mobileOpen = false, onMobileClose }: AppSidebarProps) {
  const { roles, signOut, user } = useAuth();
  const pathname = useRouterState({ select: (r) => r.location.pathname });

  const isParentOnly = roles.length > 0 && roles.every((r) => r === "PARENT");

  function canSee(item: NavItem): boolean {
    if (isParentOnly) return PARENT_ONLY.includes(item.to);
    if (!item.roles) return true;
    return hasAny(roles, item.roles) || roles.includes("SUPER_ADMIN");
  }

  const groups = GROUPS
    .map((g) => ({ ...g, items: g.items.filter(canSee) }))
    .filter((g) => g.items.length > 0);

  const initial = (user?.email ?? "?").charAt(0).toUpperCase();

  const sidebarContent = (
    <aside className="sidebar-surface relative flex h-full w-[276px] flex-col overflow-hidden text-sidebar-foreground">

      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-brand-gold/80 to-transparent" />

      {/* ── Branding ─────────────────────────────────────────── */}
      <div className="flex shrink-0 items-center justify-between border-b border-sidebar-border/55 px-4 py-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="h-11 w-11 shrink-0 overflow-hidden rounded-2xl border border-white/15 bg-white p-0.5 shadow-lg shadow-black/20">
            <img src="/logo.png" alt="Chaz Crestview Academy" className="h-full w-full object-contain" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-[11px] font-extrabold leading-snug tracking-[0.08em] text-sidebar-foreground/95">
              CHAZ CRESTVIEW ACADEMY
            </p>
            <p className="mt-1 flex items-center gap-1.5 text-[8.5px] font-bold uppercase tracking-[0.17em] text-brand-gold/80">
              <span className="h-px w-3 bg-brand-gold/65" />
              For Premium Education
            </p>
          </div>
        </div>
        {/* Mobile close button */}
        <button
          onClick={onMobileClose}
          className="md:hidden p-1.5 rounded-lg text-sidebar-foreground/50 hover:text-sidebar-foreground hover:bg-sidebar-accent transition-colors shrink-0"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* ── Navigation ───────────────────────────────────────── */}
      <nav className="relative flex-1 overflow-y-auto px-3 py-4">
        {groups.map((group, gi) => (
          <div key={gi} className={gi > 0 ? "mt-5" : ""}>
            {group.label && (
              <p className="mb-2 px-2.5 text-[9px] font-extrabold uppercase tracking-[0.2em] text-sidebar-foreground/32 select-none">
                {group.label}
              </p>
            )}
            <div className="space-y-1">
              {group.items.map((item) => {
                const active =
                  pathname === item.to || pathname.startsWith(item.to + "/");
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={onMobileClose}
                    className={`group relative flex items-center gap-3 rounded-xl px-3 py-2 text-[12.5px] font-semibold transition-all duration-150 ${
                      active
                        ? "bg-white/[0.10] text-white shadow-[inset_0_0_0_1px_oklch(1_0_0/0.06),0_8px_20px_-14px_oklch(0_0_0/0.65)]"
                        : "text-sidebar-foreground/62 hover:translate-x-0.5 hover:bg-white/[0.055] hover:text-sidebar-accent-foreground"
                    }`}
                  >
                    {/* Left accent bar on active */}
                    {active && (
                      <span className="absolute bottom-2 left-0 top-2 w-[3px] rounded-r-full bg-brand-gold shadow-[0_0_14px_oklch(0.72_0.15_79/0.65)]" />
                    )}
                    <item.icon
                      className={`h-4 w-4 shrink-0 transition-all ${
                        active ? "text-brand-gold" : "opacity-55 group-hover:text-brand-sky group-hover:opacity-95"
                      }`}
                    />
                    <span className="truncate flex-1">{item.label}</span>
                    {active && (
                      <ChevronRight className="h-3 w-3 opacity-35 shrink-0" />
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* ── User footer ──────────────────────────────────────── */}
      <div className="relative shrink-0 border-t border-sidebar-border/55 px-3 pb-3 pt-3">
        <div className="mb-2 flex items-center gap-2.5 rounded-xl border border-white/[0.055] bg-white/[0.035] px-2.5 py-2.5">
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-sm font-extrabold text-white shadow-lg shadow-black/15"
            style={{
              background:
                "linear-gradient(135deg, oklch(0.50 0.17 248), oklch(0.68 0.14 228))",
            }}
          >
            {initial}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[11.5px] font-semibold leading-tight text-sidebar-foreground/85">
              {user?.fullName || user?.email}
            </p>
            <div className="flex flex-wrap gap-1 mt-0.5">
              {roles.slice(0, 2).map((r) => (
                <span
                  key={r}
                  className="rounded-full border border-brand-gold/15 bg-brand-gold/10 px-2 py-0.5 text-[8px] font-bold uppercase tracking-wider text-brand-gold/85"
                >
                  {r.replace(/_/g, " ")}
                </span>
              ))}
              {roles.length > 2 && (
                <span className="text-[9px] text-sidebar-foreground/35">
                  +{roles.length - 2}
                </span>
              )}
            </div>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-9 w-full justify-start px-2.5 text-[11.5px] font-semibold text-sidebar-foreground/45 hover:bg-white/[0.055] hover:text-sidebar-foreground"
          onClick={signOut}
        >
          <LogOut className="h-3.5 w-3.5 mr-2 shrink-0" />
          Sign out
        </Button>
      </div>
    </aside>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <div className="no-print sticky top-0 hidden h-screen w-[276px] shrink-0 border-r border-sidebar-border md:flex">
        {sidebarContent}
      </div>

      {/* Mobile overlay — always mounted, animated via CSS */}
      <div
        className={`md:hidden fixed inset-0 z-50 flex transition-[visibility] duration-200 ${
          mobileOpen ? "visible" : "invisible"
        }`}
      >
        {/* Backdrop */}
        <div
          className={`absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-200 ${
            mobileOpen ? "opacity-100" : "opacity-0"
          }`}
          onClick={onMobileClose}
        />
        {/* Drawer panel — slides in from left */}
        <div
          className={`relative w-[272px] max-w-[85vw] h-full shadow-2xl transition-transform duration-200 ease-out ${
            mobileOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          {sidebarContent}
        </div>
      </div>
    </>
  );
}
