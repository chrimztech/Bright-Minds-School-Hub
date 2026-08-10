import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { FINANCE_ROLES, TEACHING_ROLES, hasAny, useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Users, GraduationCap, School, Wallet, ClipboardCheck, Megaphone,
  UserPlus, BookOpen, CalendarDays, Receipt, ArrowRight, ArrowUpRight,
  type LucideIcon,
} from "lucide-react";
import { money } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard" }] }),
  component: Dashboard,
});

/* ── Attendance ring (SVG) ────────────────────────────────────── */
function AttendanceRing({
  present,
  total,
  loading,
}: {
  present: number;
  total: number;
  loading: boolean;
}) {
  const pct = total > 0 ? Math.min(present / total, 1) : 0;
  const R = 52;
  const circ = 2 * Math.PI * R;
  const offset = circ * (1 - pct);
  const deg = Math.round(pct * 100);
  const absent = Math.max(total - present, 0);

  return (
    <div className="flex flex-col items-center gap-5">
      {/* Ring */}
      <div className="relative w-40 h-40">
        <svg className="w-full h-full" viewBox="0 0 120 120">
          {/* Track */}
          <circle
            cx="60" cy="60" r={R} fill="none"
            stroke="oklch(0.92 0.014 248)" strokeWidth="11"
          />
          {/* Progress */}
          <circle
            cx="60" cy="60" r={R} fill="none"
            stroke="oklch(0.50 0.17 248)" strokeWidth="11"
            strokeLinecap="round"
            strokeDasharray={circ}
            strokeDashoffset={loading ? circ : offset}
            transform="rotate(-90 60 60)"
            style={{ transition: "stroke-dashoffset 0.8s cubic-bezier(.4,0,.2,1)" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          {loading ? (
            <Skeleton className="h-8 w-14" />
          ) : (
            <>
              <span className="text-[2rem] font-black text-foreground leading-none tabular">
                {deg}%
              </span>
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground mt-0.5">
                present
              </span>
            </>
          )}
        </div>
      </div>

      {/* Stat rows */}
      <div className="w-full space-y-2.5">
        {[
          { label: "Present", value: present, color: "bg-blue-600" },
          { label: "Absent", value: absent, color: "bg-red-400" },
          { label: "Total enrolled", value: total, color: "bg-slate-300" },
        ].map(({ label, value, color }) => (
          <div key={label} className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className={`h-2 w-2 rounded-full ${color} shrink-0`} />
              <span className="text-[12px] text-muted-foreground">{label}</span>
            </div>
            {loading ? (
              <Skeleton className="h-4 w-10" />
            ) : (
              <span className="text-[12px] font-semibold text-foreground tabular">
                {value.toLocaleString()}
              </span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── KPI card ─────────────────────────────────────────────────── */
interface KpiConfig {
  icon: LucideIcon;
  label: string;
  value: string;
  iconBg: string;
  orbColor: string;
  cardBg: string;
  borderColor: string;
}

function KpiCard({ cfg, loading }: { cfg: KpiConfig; loading: boolean }) {
  return (
    <div
      className={`group relative overflow-hidden rounded-3xl border p-5 shadow-depth-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-depth ${cfg.cardBg} ${cfg.borderColor}`}
    >
      {/* Decorative orb */}
      <div
        className={`pointer-events-none absolute -top-6 -right-6 h-24 w-24 rounded-full opacity-25 blur-2xl ${cfg.orbColor}`}
      />
      {/* Icon */}
      <div className={`mb-5 inline-flex rounded-2xl p-2.5 shadow-sm transition-transform duration-200 group-hover:scale-105 ${cfg.iconBg}`}>
        <cfg.icon className="h-4 w-4 text-white" />
      </div>
      {/* Label */}
      <p className="text-[10.5px] font-bold uppercase tracking-[0.14em] text-foreground/45 mb-1.5">
        {cfg.label}
      </p>
      {/* Value */}
      {loading ? (
        <Skeleton className="h-9 w-24" />
      ) : (
        <p className="whitespace-nowrap text-[2.1rem] font-extrabold leading-none tracking-[-0.04em] text-foreground tabular xl:text-[clamp(1.35rem,1.65vw,2.1rem)]">
          {cfg.value}
        </p>
      )}
    </div>
  );
}

/* ── Quick actions ────────────────────────────────────────────── */
const QUICK_ACTIONS = [
  { label: "Add pupil", to: "/pupils", icon: UserPlus, roles: TEACHING_ROLES, cls: "bg-blue-50 text-blue-700 hover:bg-blue-100 border-blue-100 dark:bg-blue-950/30 dark:text-blue-300 dark:border-blue-900/50 dark:hover:bg-blue-950/50" },
  { label: "Record attendance", to: "/attendance", icon: ClipboardCheck, roles: TEACHING_ROLES, cls: "bg-sky-50 text-sky-700 hover:bg-sky-100 border-sky-100 dark:bg-sky-950/30 dark:text-sky-300 dark:border-sky-900/50 dark:hover:bg-sky-950/50" },
  { label: "New invoice", to: "/fees", icon: Receipt, roles: FINANCE_ROLES, cls: "bg-amber-50 text-amber-700 hover:bg-amber-100 border-amber-100 dark:bg-amber-950/25 dark:text-amber-300 dark:border-amber-900/45 dark:hover:bg-amber-950/45" },
  { label: "Calendar", to: "/calendar", icon: CalendarDays, cls: "bg-violet-50 text-violet-700 hover:bg-violet-100 border-violet-100 dark:bg-violet-950/25 dark:text-violet-300 dark:border-violet-900/45 dark:hover:bg-violet-950/45" },
  { label: "Library", to: "/library", icon: BookOpen, cls: "bg-cyan-50 text-cyan-700 hover:bg-cyan-100 border-cyan-100 dark:bg-cyan-950/25 dark:text-cyan-300 dark:border-cyan-900/45 dark:hover:bg-cyan-950/45" },
];

/* ── Helpers ──────────────────────────────────────────────────── */
function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

const TODAY_LONG = new Date().toLocaleDateString(undefined, {
  weekday: "long", day: "numeric", month: "long", year: "numeric",
});

const TODAY_SHORT = new Date().toLocaleDateString(undefined, {
  day: "numeric", month: "short", year: "numeric",
});

/* ── Main ─────────────────────────────────────────────────────── */
function Dashboard() {
  const { user, roles } = useAuth();
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => api.dashboard.get(),
  });

  const firstName = (user?.fullName || user?.email || "").split(/[ @]/)[0];
  const quickActions = QUICK_ACTIONS.filter(
    (action) => !action.roles || hasAny(roles, action.roles),
  );

  const kpis: KpiConfig[] = [
    {
      icon: Users,
      label: "Active pupils",
      value: (data?.totalPupils ?? 0).toLocaleString(),
      iconBg: "bg-blue-500",
      orbColor: "bg-blue-400",
      cardBg: "bg-gradient-to-br from-blue-50/80 to-white dark:from-blue-950/35 dark:to-card",
      borderColor: "border-blue-100/80",
    },
    {
      icon: GraduationCap,
      label: "Active staff",
      value: (data?.activeStaff ?? 0).toLocaleString(),
      iconBg: "bg-violet-500",
      orbColor: "bg-violet-400",
      cardBg: "bg-gradient-to-br from-violet-50/75 to-white dark:from-violet-950/30 dark:to-card",
      borderColor: "border-violet-100/80",
    },
    {
      icon: School,
      label: "Classes",
      value: (data?.totalClasses ?? 0).toLocaleString(),
      iconBg: "bg-sky-500",
      orbColor: "bg-sky-400",
      cardBg: "bg-gradient-to-br from-sky-50/80 to-white dark:from-sky-950/30 dark:to-card",
      borderColor: "border-sky-100/80",
    },
    {
      icon: ClipboardCheck,
      label: "Present today",
      value: (data?.presentToday ?? 0).toLocaleString(),
      iconBg: "bg-cyan-600",
      orbColor: "bg-cyan-400",
      cardBg: "bg-gradient-to-br from-cyan-50/75 to-white dark:from-cyan-950/30 dark:to-card",
      borderColor: "border-cyan-100/80 dark:border-cyan-900/45",
    },
    {
      icon: Wallet,
      label: "Collected this month",
      value: money(data?.collectedThisMonth ?? 0),
      iconBg: "bg-amber-500",
      orbColor: "bg-amber-400",
      cardBg: "bg-gradient-to-br from-amber-50/80 to-white dark:from-amber-950/25 dark:to-card",
      borderColor: "border-amber-100/80",
    },
  ];

  return (
    <>
      <PageHeader title="Dashboard" description="Live overview of school activity" />

      <div className="space-y-6 p-4 sm:p-6 lg:px-8 lg:pb-8">

        {/* ── Hero ────────────────────────────────────────────── */}
        <div
          className="relative overflow-hidden rounded-3xl border border-white/10 shadow-depth-lg"
          style={{ background: "var(--gradient-hero)" }}
        >
          {/* Subtle grid pattern */}
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.04]"
            style={{
              backgroundImage:
                "linear-gradient(rgba(255,255,255,1) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,1) 1px,transparent 1px)",
              backgroundSize: "40px 40px",
            }}
          />
          {/* Decorative blobs */}
          <div className="pointer-events-none absolute top-[-30%] right-[-5%] h-64 w-64 rounded-full bg-blue-500/20 blur-3xl" />
          <div className="pointer-events-none absolute bottom-[-30%] left-[10%] h-48 w-48 rounded-full bg-brand-gold/18 blur-3xl" />

          <div className="relative px-7 py-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5">
            <div>
              <p className="text-white/45 text-[10.5px] uppercase tracking-[0.2em] font-semibold mb-2">
                {TODAY_LONG}
              </p>
              <h2 className="text-white font-display text-[1.75rem] sm:text-[2rem] font-semibold leading-tight">
                {greeting()}{firstName ? `, ${firstName}` : ""}!
              </h2>
              <p className="text-white/45 text-sm mt-1.5 leading-relaxed">
                Here's what's happening at Chaz Crestview Academy today.
              </p>
            </div>

            {/* Attendance snapshot panel */}
            <div className="flex items-stretch gap-5 shrink-0 bg-white/10 backdrop-blur-sm rounded-2xl border border-white/15 px-5 py-4 self-start sm:self-auto">
              {[
                {
                  label: "Attendance",
                  value: isLoading
                    ? null
                    : data?.totalPupils
                    ? `${Math.round((data.presentToday / data.totalPupils) * 100)}%`
                    : "—",
                },
                { label: "Present", value: isLoading ? null : (data?.presentToday ?? 0).toLocaleString() },
                { label: "Total", value: isLoading ? null : (data?.totalPupils ?? 0).toLocaleString() },
              ].map(({ label, value }, i, arr) => (
                <div key={label} className="flex items-stretch gap-5">
                  <div className="text-center">
                    <p className="text-white/40 text-[9.5px] uppercase tracking-widest font-semibold mb-1.5">
                      {label}
                    </p>
                    {value === null ? (
                      <Skeleton className="h-7 w-12 bg-white/20 mx-auto" />
                    ) : (
                      <p className="text-white font-black text-[1.5rem] tabular leading-none">
                        {value}
                      </p>
                    )}
                  </div>
                  {i < arr.length - 1 && (
                    <div className="w-px bg-white/15 self-stretch" />
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── KPI row ─────────────────────────────────────────── */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {kpis.map((cfg) => (
            <KpiCard key={cfg.label} cfg={cfg} loading={isLoading} />
          ))}
        </div>

        {/* ── Bottom 3 columns ────────────────────────────────── */}
        <div className="grid gap-5 lg:grid-cols-3">

          {/* Attendance ring */}
          <Card className="overflow-hidden">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-[15px]">
                <div className="rounded-xl bg-blue-500/10 p-2">
                  <ClipboardCheck className="h-4 w-4 text-blue-600" />
                </div>
                Today's Attendance
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-2 pb-5 flex justify-center">
              <AttendanceRing
                present={data?.presentToday ?? 0}
                total={data?.totalPupils ?? 0}
                loading={isLoading}
              />
            </CardContent>
          </Card>

          {/* Announcements */}
          <Card className="overflow-hidden">
            <CardHeader className="pb-3 flex-row items-center justify-between space-y-0">
              <CardTitle className="flex items-center gap-2 text-[15px]">
                <div className="rounded-lg bg-orange-500/10 p-1.5">
                  <Megaphone className="h-4 w-4 text-orange-600" />
                </div>
                Announcements
              </CardTitle>
              <Link
                to="/announcements"
                className="flex items-center gap-1 text-[11.5px] text-muted-foreground hover:text-foreground transition-colors font-medium"
              >
                All <ArrowUpRight className="h-3 w-3" />
              </Link>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex items-start gap-3">
                      <Skeleton className="h-8 w-8 rounded-lg shrink-0" />
                      <div className="flex-1 space-y-1.5 pt-0.5">
                        <Skeleton className="h-3.5 w-3/4" />
                        <Skeleton className="h-3 w-1/3" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (data?.recentAnnouncements ?? []).length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <div className="h-11 w-11 rounded-xl bg-muted flex items-center justify-center mb-3">
                    <Megaphone className="h-5 w-5 text-muted-foreground/50" />
                  </div>
                  <p className="text-sm font-medium text-foreground/70">No announcements yet</p>
                </div>
              ) : (
                <ul className="space-y-1">
                  {data!.recentAnnouncements.map((a, i) => (
                    <li
                      key={a.id}
                      className="flex items-start gap-3 py-2.5 border-b border-border/40 last:border-0 last:pb-0 first:pt-0"
                    >
                      <div className="h-8 w-8 rounded-lg bg-primary/8 flex items-center justify-center shrink-0 text-[10.5px] font-bold text-primary/50 border border-border/50">
                        {String(i + 1).padStart(2, "0")}
                      </div>
                      <div className="min-w-0 flex-1 pt-0.5">
                        <p className="text-[13px] font-medium text-foreground leading-snug line-clamp-1">
                          {a.title}
                        </p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {new Date(a.createdAt).toLocaleDateString(undefined, {
                            day: "numeric",
                            month: "short",
                          })}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* Quick actions */}
          <Card className="overflow-hidden">
            <CardHeader className="pb-3">
              <CardTitle className="text-[15px]">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {quickActions.map((action) => (
                <Link
                  key={action.to}
                  to={action.to}
                  className={`flex items-center gap-3 rounded-2xl border px-3.5 py-2.5 text-[13px] font-semibold transition-all hover:translate-x-0.5 ${action.cls}`}
                >
                  <div className="rounded-lg bg-current/10 p-1.5">
                    <action.icon className="h-3.5 w-3.5" />
                  </div>
                  <span className="flex-1">{action.label}</span>
                  <ArrowRight className="h-3.5 w-3.5 opacity-40 shrink-0" />
                </Link>
              ))}

              {/* Today's date footer */}
              <div className="pt-2 mt-1 border-t border-border/50 text-center">
                <p className="text-[11px] text-muted-foreground">{TODAY_SHORT}</p>
              </div>
            </CardContent>
          </Card>

        </div>
      </div>
    </>
  );
}
