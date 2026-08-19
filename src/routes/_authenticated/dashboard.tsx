import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useSchool } from "@/components/PrintableDoc";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Megaphone, ArrowUpRight } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard" }] }),
  component: Dashboard,
});

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

const TODAY_LONG = new Date().toLocaleDateString(undefined, {
  weekday: "long", day: "numeric", month: "long", year: "numeric",
});

function Dashboard() {
  const { user } = useAuth();
  const { data: school } = useSchool();
  const { data: announcements = [], isLoading } = useQuery({
    queryKey: ["ann"],
    queryFn: () => api.announcements.list(),
  });

  const firstName = (user?.fullName || user?.email || "").split(/[ @]/)[0];

  return (
    <>
      <PageHeader title="Dashboard" />

      <div className="space-y-6 p-4 sm:p-6 lg:px-8 lg:pb-8 max-w-4xl mx-auto">
        {/* Welcome hero */}
        <div
          className="relative overflow-hidden rounded-3xl border border-white/10 shadow-depth-lg"
          style={{ background: "var(--gradient-hero)" }}
        >
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.04]"
            style={{
              backgroundImage:
                "linear-gradient(rgba(255,255,255,1) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,1) 1px,transparent 1px)",
              backgroundSize: "40px 40px",
            }}
          />
          <div className="pointer-events-none absolute top-[-30%] right-[-5%] h-64 w-64 rounded-full bg-blue-500/20 blur-3xl" />
          <div className="pointer-events-none absolute bottom-[-30%] left-[10%] h-48 w-48 rounded-full bg-brand-gold/18 blur-3xl" />

          <div className="relative px-7 py-8 flex flex-col sm:flex-row sm:items-center gap-5">
            {school?.logoUrl && (
              <img src={school.logoUrl} alt="" className="h-16 w-16 rounded-2xl object-contain bg-white/10 p-1.5 border border-white/15 shrink-0" />
            )}
            <div>
              <p className="text-white/45 text-[10.5px] uppercase tracking-[0.2em] font-semibold mb-2">
                {TODAY_LONG}
              </p>
              <h2 className="text-white font-display text-[1.75rem] sm:text-[2rem] font-semibold leading-tight">
                {greeting()}{firstName ? `, ${firstName}` : ""}!
              </h2>
              <p className="text-white/45 text-sm mt-1.5 leading-relaxed">
                Welcome to {school?.name ?? "the school workspace"}.
              </p>
            </div>
          </div>
        </div>

        {/* Optional school photo — only shown once set under Settings */}
        {school?.bannerUrl && (
          <div className="overflow-hidden rounded-3xl border shadow-depth">
            <img src={school.bannerUrl} alt="" className="w-full max-h-64 object-cover" />
          </div>
        )}

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
            ) : announcements.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="h-11 w-11 rounded-xl bg-muted flex items-center justify-center mb-3">
                  <Megaphone className="h-5 w-5 text-muted-foreground/50" />
                </div>
                <p className="text-sm font-medium text-foreground/70">No announcements yet</p>
              </div>
            ) : (
              <ul className="space-y-1">
                {announcements.slice(0, 8).map((a, i) => (
                  <li
                    key={a.id}
                    className="flex items-start gap-3 py-2.5 border-b border-border/40 last:border-0 last:pb-0 first:pt-0"
                  >
                    <div className="h-8 w-8 rounded-lg bg-primary/8 flex items-center justify-center shrink-0 text-[10.5px] font-bold text-primary/50 border border-border/50">
                      {String(i + 1).padStart(2, "0")}
                    </div>
                    <div className="min-w-0 flex-1 pt-0.5">
                      <p className="text-[13px] font-medium text-foreground leading-snug">
                        {a.title}
                      </p>
                      <p className="text-sm text-muted-foreground mt-0.5 whitespace-pre-line line-clamp-2">
                        {a.body}
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-1">
                        {new Date(a.createdAt).toLocaleDateString(undefined, {
                          day: "numeric", month: "short", year: "numeric",
                        })}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
