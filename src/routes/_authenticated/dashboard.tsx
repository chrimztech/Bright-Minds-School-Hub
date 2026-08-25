import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api, type DashboardLink } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useSchool } from "@/components/PrintableDoc";
import { PageHeader } from "@/components/PageHeader";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ImageUploadField } from "@/components/ImageUploadField";
import {
  Activity, ArrowUpRight, BookOpen, CheckCircle2, Clock3, GraduationCap,
  Link2, Megaphone, Pencil, Plus, ShieldCheck, Trash2, Users2,
} from "lucide-react";
import { toast } from "sonner";

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

function parseLinks(raw?: string): DashboardLink[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((l) => l && typeof l.label === "string" && typeof l.url === "string") : [];
  } catch {
    return [];
  }
}

function Dashboard() {
  const { user, roles } = useAuth();
  const isSuperAdmin = roles.includes("SUPER_ADMIN");
  const { data: school } = useSchool();
  const { data: announcements = [], isLoading } = useQuery({
    queryKey: ["ann"],
    queryFn: () => api.announcements.list(),
  });
  const { data: metrics, isLoading: metricsLoading } = useQuery({
    queryKey: ["dashboard-metrics"],
    queryFn: () => api.dashboard.get(),
  });

  const firstName = (user?.fullName || user?.email || "").split(/[ @]/)[0];
  const heroImage = school?.dashboardHeroImageUrl || school?.bannerUrl;
  const links = parseLinks(school?.dashboardLinks);

  return (
    <>
      <PageHeader
        title="Dashboard"
        description={`A clear view of ${school?.name ?? "your school"}'s activity, people and priorities.`}
        actions={isSuperAdmin ? (
          <>
            <LandingEditor school={school} />
            <DashboardEditor school={school} />
          </>
        ) : undefined}
      />

      <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6 lg:px-8 lg:pb-8">
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

          <div className="relative flex flex-col gap-6 px-7 py-8 sm:flex-row sm:items-center sm:justify-between">
            {school?.logoUrl && (
              <img src={school.logoUrl} alt="" className="h-16 w-16 rounded-2xl object-contain bg-white/10 p-1.5 border border-white/15 shrink-0" />
            )}
            <div className="min-w-0">
              <p className="text-white/45 text-[10.5px] uppercase tracking-[0.2em] font-semibold mb-2">
                {TODAY_LONG}
              </p>
              <h2 className="text-white font-display text-[1.75rem] sm:text-[2rem] font-semibold leading-tight">
                {school?.dashboardHeroHeading || `${greeting()}${firstName ? `, ${firstName}` : ""}!`}
              </h2>
              <p className="text-white/45 text-sm mt-1.5 leading-relaxed">
                {school?.dashboardHeroSubtext || `Welcome to ${school?.name ?? "the school workspace"}.`}
              </p>
              {school?.dashboardButtonUrl && school?.dashboardButtonLabel && (
                <a
                  href={school.dashboardButtonUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 mt-4 rounded-full bg-white/10 hover:bg-white/15 border border-white/15 px-4 py-2 text-xs font-medium text-white transition-colors"
                >
                  {school.dashboardButtonLabel} <ArrowUpRight className="h-3.5 w-3.5" />
                </a>
              )}
            </div>
            <div className="hidden shrink-0 border-l border-white/10 pl-8 text-right sm:block">
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40">Workspace status</p>
              <div className="mt-3 flex items-center justify-end gap-2 text-sm font-medium text-white/80">
                <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_12px_oklch(0.75_0.17_155/0.8)]" />
                All systems operational
              </div>
              <p className="mt-1 text-xs text-white/40">Live school overview</p>
            </div>
          </div>
        </div>

        <section aria-label="School metrics" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { label: "Total pupils", value: metrics?.totalPupils, icon: Users2, tone: "text-primary", bg: "bg-primary/10" },
            { label: "Active staff", value: metrics?.activeStaff, icon: GraduationCap, tone: "text-sky-600", bg: "bg-sky-500/10" },
            { label: "Classes", value: metrics?.totalClasses, icon: BookOpen, tone: "text-violet-600", bg: "bg-violet-500/10" },
            { label: "Present today", value: metrics?.presentToday, icon: CheckCircle2, tone: "text-emerald-600", bg: "bg-emerald-500/10" },
          ].map((metric) => (
            <Card key={metric.label} className="relative overflow-hidden transition-shadow hover:shadow-depth">
              <CardContent className="flex items-center gap-3 p-4 sm:p-5">
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${metric.bg} ${metric.tone}`}>
                  <metric.icon className="h-4.5 w-4.5" />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">{metric.label}</p>
                  <p className="mt-1 font-display text-2xl font-semibold leading-none text-foreground">
                    {metricsLoading ? <Skeleton className="h-6 w-16" /> : (metric.value ?? 0).toLocaleString()}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </section>

        {/* Optional hero photo — set via the dashboard editor (superadmin) or Settings banner */}
        {heroImage && (
          <div className="overflow-hidden rounded-3xl border shadow-depth">
            <img src={heroImage} alt="" className="w-full max-h-64 object-cover" />
          </div>
        )}

        {/* Quick links — configurable by superadmin */}
        {links.length > 0 && (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {links.map((l, i) => (
              <a
                key={i}
                href={l.url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-3 rounded-2xl border bg-card px-4 py-3.5 hover:shadow-depth transition-shadow"
              >
                <div className="rounded-lg bg-primary/8 p-2 shrink-0">
                  <Link2 className="h-4 w-4 text-primary/60" />
                </div>
                <span className="text-sm font-medium flex-1 truncate">{l.label}</span>
                <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              </a>
            ))}
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[1.35fr_0.65fr]">
        {/* Announcements */}
        <Card className="overflow-hidden">
          <CardHeader className="pb-3 flex-row items-center justify-between space-y-0">
            <CardTitle className="flex items-center gap-2 text-[15px]">
              <div className="rounded-lg bg-orange-500/10 p-1.5">
                <Megaphone className="h-4 w-4 text-orange-600" />
              </div>
              <span>Announcements</span>
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

        <Card className="overflow-hidden">
          <CardHeader className="border-b border-border/50 pb-4">
            <CardTitle className="flex items-center gap-2 text-[15px]">
              <div className="rounded-lg bg-emerald-500/10 p-1.5"><Activity className="h-4 w-4 text-emerald-600" /></div>
              Daily pulse
            </CardTitle>
            <CardDescription>Attendance snapshot for today</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 pt-6">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="font-display text-4xl font-semibold text-foreground">
                  {metricsLoading ? "—" : metrics?.totalPupils ? `${Math.round((metrics.presentToday / metrics.totalPupils) * 100)}%` : "0%"}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">Pupil attendance</p>
              </div>
              <div className="rounded-xl bg-emerald-500/10 px-3 py-2 text-right text-xs font-semibold text-emerald-700">
                {metrics?.presentToday ?? 0} present
              </div>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all duration-1000"
                style={{ width: `${metrics?.totalPupils ? Math.min(100, (metrics.presentToday / metrics.totalPupils) * 100) : 0}%` }}
              />
            </div>
            <div className="grid grid-cols-2 gap-3 border-t border-border/50 pt-5">
              <div className="flex items-center gap-2"><Clock3 className="h-4 w-4 text-muted-foreground" /><span className="text-xs text-muted-foreground">Updated today</span></div>
              <div className="flex items-center justify-end gap-2"><ShieldCheck className="h-4 w-4 text-primary" /><span className="text-xs font-medium text-foreground">Live data</span></div>
            </div>
          </CardContent>
        </Card>
        </div>
      </div>
    </>
  );
}

// Superadmin-only editor for the public landing page ("/", before Sign in) — hero image
// carousel, heading/subtext override, and the About section. Same SUPER_ADMIN-hardcoded
// rationale as DashboardEditor below: this is public-facing branding, not something a
// delegated role should be able to touch via Roles & Permissions.
function LandingEditor({ school }: { school?: { landingHeroHeading?: string; landingHeroSubtext?: string; landingHeroImages?: string; landingAboutTitle?: string; landingAboutBody?: string } }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [heroHeading, setHeroHeading] = useState("");
  const [heroSubtext, setHeroSubtext] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [aboutTitle, setAboutTitle] = useState("");
  const [aboutBody, setAboutBody] = useState("");

  function openEditor() {
    setHeroHeading(school?.landingHeroHeading ?? "");
    setHeroSubtext(school?.landingHeroSubtext ?? "");
    setImages(parseImages(school?.landingHeroImages));
    setAboutTitle(school?.landingAboutTitle ?? "");
    setAboutBody(school?.landingAboutBody ?? "");
    setOpen(true);
  }

  const save = useMutation({
    mutationFn: () =>
      api.settings.updateLanding({
        heroHeading: heroHeading || undefined,
        heroSubtext: heroSubtext || undefined,
        heroImages: JSON.stringify(images.filter(Boolean)),
        aboutTitle: aboutTitle || undefined,
        aboutBody: aboutBody || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["school-settings-print"] });
      // The public landing page ("/") reads from its own query key, not
      // school-settings-print — without this, edits here (including deleting a hero
      // image) keep showing the stale version on "/" until a hard reload clears the cache.
      qc.invalidateQueries({ queryKey: ["public-landing"] });
      toast.success("Landing page updated");
      setOpen(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => { if (o) openEditor(); else setOpen(false); }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm"><Pencil className="h-3.5 w-3.5 mr-1.5" /> Edit landing page</Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Edit public landing page</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="pt-1">
            <div className="flex items-center justify-between mb-2">
              <Label>Hero images</Label>
              <Button type="button" size="sm" variant="outline" onClick={() => setImages((prev) => [...prev, ""])}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Add image
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mb-2">Shown as a rotating background on the sign-in landing page. Add more than one for a slideshow.</p>
            <div className="space-y-2">
              {images.map((url, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="flex-1">
                    <ImageUploadField value={url} onChange={(u) => setImages((prev) => prev.map((v, idx) => (idx === i ? u : v)))} />
                  </div>
                  <Button type="button" size="icon" variant="ghost" onClick={() => setImages((prev) => prev.filter((_, idx) => idx !== i))}>
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
              ))}
              {images.length === 0 && <p className="text-xs text-muted-foreground">No hero images yet — a default gradient background is used.</p>}
            </div>
          </div>
          <div>
            <Label>Hero heading</Label>
            <Input placeholder="Leave blank for the default welcome heading" value={heroHeading} onChange={(e) => setHeroHeading(e.target.value)} />
          </div>
          <div>
            <Label>Hero subtext</Label>
            <Textarea rows={2} placeholder="Leave blank for the default subtext" value={heroSubtext} onChange={(e) => setHeroSubtext(e.target.value)} />
          </div>
          <div className="pt-2 border-t">
            <Label>About section title</Label>
            <Input placeholder={`Leave blank for "About <school name>"`} value={aboutTitle} onChange={(e) => setAboutTitle(e.target.value)} />
          </div>
          <div>
            <Label>About section body</Label>
            <Textarea rows={4} placeholder="Leave blank for the default description" value={aboutBody} onChange={(e) => setAboutBody(e.target.value)} />
          </div>
          <Button className="w-full" disabled={save.isPending} onClick={() => save.mutate()}>
            {save.isPending ? "Saving…" : "Save landing page"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function parseImages(raw?: string): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((u) => typeof u === "string") : [];
  } catch {
    return [];
  }
}

// Superadmin-only dashboard content editor. Deliberately hardcoded to the SUPER_ADMIN role
// (see backend PUT /settings/dashboard) rather than a revocable permission, so branding
// can't be delegated away by accident through the Roles & Permissions page.
function DashboardEditor({ school }: { school?: { dashboardHeroHeading?: string; dashboardHeroSubtext?: string; dashboardHeroImageUrl?: string; dashboardButtonLabel?: string; dashboardButtonUrl?: string; dashboardLinks?: string; loginButtonLabel?: string; loginButtonUrl?: string } }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [heroHeading, setHeroHeading] = useState("");
  const [heroSubtext, setHeroSubtext] = useState("");
  const [heroImageUrl, setHeroImageUrl] = useState("");
  const [buttonLabel, setButtonLabel] = useState("");
  const [buttonUrl, setButtonUrl] = useState("");
  const [links, setLinks] = useState<DashboardLink[]>([]);
  const [loginButtonLabel, setLoginButtonLabel] = useState("");
  const [loginButtonUrl, setLoginButtonUrl] = useState("");

  function openEditor() {
    setHeroHeading(school?.dashboardHeroHeading ?? "");
    setHeroSubtext(school?.dashboardHeroSubtext ?? "");
    setHeroImageUrl(school?.dashboardHeroImageUrl ?? "");
    setButtonLabel(school?.dashboardButtonLabel ?? "");
    setButtonUrl(school?.dashboardButtonUrl ?? "");
    setLinks(parseLinks(school?.dashboardLinks));
    setLoginButtonLabel(school?.loginButtonLabel ?? "");
    setLoginButtonUrl(school?.loginButtonUrl ?? "");
    setOpen(true);
  }

  const save = useMutation({
    mutationFn: () =>
      api.settings.updateDashboard({
        heroHeading: heroHeading || undefined,
        heroSubtext: heroSubtext || undefined,
        heroImageUrl: heroImageUrl || undefined,
        buttonLabel: buttonLabel || undefined,
        buttonUrl: buttonUrl || undefined,
        links: JSON.stringify(links.filter((l) => l.label && l.url)),
        loginButtonLabel: loginButtonLabel || undefined,
        loginButtonUrl: loginButtonUrl || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["school-settings-print"] });
      toast.success("Dashboard updated");
      setOpen(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  function updateLink(i: number, patch: Partial<DashboardLink>) {
    setLinks((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (o) openEditor(); else setOpen(false); }}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm"><Pencil className="h-3.5 w-3.5 mr-1.5" /> Edit dashboard</Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Edit dashboard</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Hero image</Label>
            <p className="text-xs text-muted-foreground mb-1.5">Shown as a full-width banner below the welcome card. Leave blank to use the school banner from Settings.</p>
            <ImageUploadField value={heroImageUrl} onChange={setHeroImageUrl} />
          </div>
          <div>
            <Label>Heading</Label>
            <Input placeholder="Leave blank for the default greeting" value={heroHeading} onChange={(e) => setHeroHeading(e.target.value)} />
          </div>
          <div>
            <Label>Subtext</Label>
            <Textarea rows={2} placeholder="Leave blank for the default welcome message" value={heroSubtext} onChange={(e) => setHeroSubtext(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Button label</Label>
              <Input placeholder="e.g. Visit our website" value={buttonLabel} onChange={(e) => setButtonLabel(e.target.value)} />
            </div>
            <div>
              <Label>Button link</Label>
              <Input placeholder="https://…" value={buttonUrl} onChange={(e) => setButtonUrl(e.target.value)} />
            </div>
          </div>

          <div className="pt-2 border-t">
            <div className="flex items-center justify-between mb-2">
              <Label>Quick links</Label>
              <Button type="button" size="sm" variant="outline" onClick={() => setLinks((prev) => [...prev, { label: "", url: "" }])}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Add link
              </Button>
            </div>
            <div className="space-y-2">
              {links.map((l, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input placeholder="Label" value={l.label} onChange={(e) => updateLink(i, { label: e.target.value })} className="w-32" />
                  <Input placeholder="https://…" value={l.url} onChange={(e) => updateLink(i, { url: e.target.value })} className="flex-1" />
                  <Button type="button" size="icon" variant="ghost" onClick={() => setLinks((prev) => prev.filter((_, idx) => idx !== i))}>
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
              ))}
              {links.length === 0 && <p className="text-xs text-muted-foreground">No quick links yet.</p>}
            </div>
          </div>

          <div className="pt-2 border-t">
            <Label>Login page button</Label>
            <p className="text-xs text-muted-foreground mb-2">Shown on the sign-in screen, before anyone logs in — e.g. a link to your public website or admissions page. Leave both fields blank to remove it.</p>
            <div className="grid grid-cols-2 gap-3">
              <Input placeholder="Button label (e.g. Visit our website)" value={loginButtonLabel} onChange={(e) => setLoginButtonLabel(e.target.value)} />
              <Input placeholder="https://…" value={loginButtonUrl} onChange={(e) => setLoginButtonUrl(e.target.value)} />
            </div>
          </div>

          <Button className="w-full" disabled={save.isPending} onClick={() => save.mutate()}>
            {save.isPending ? "Saving…" : "Save dashboard"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
