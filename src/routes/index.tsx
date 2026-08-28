import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  ArrowDown,
  MapPin,
  Phone,
  Mail,
  Globe,
  Send,
  CheckCircle2,
  ShieldCheck,
  Sparkles,
  BookOpenCheck,
  Palette,
  Trophy,
  Quote,
  CalendarCheck,
  Wallet,
  FileCheck2,
  Banknote,
  BookOpen,
  Bus,
  Facebook,
  MessageCircle,
} from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { useReveal } from "@/hooks/use-reveal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

// The school's own crest — used as the default logo everywhere on this page (nav, hero,
// footer) until an admin uploads a custom one via Settings, matching how /auth already
// falls back to it rather than a generic icon.
const DEFAULT_LOGO = "/logo.png";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Chaz Crestview Academy" },
      {
        name: "description",
        content: "For Premium Education — all-in-one school management system.",
      },
    ],
  }),
  component: LandingPage,
});

function parseImages(raw?: string): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((u) => typeof u === "string" && u) : [];
  } catch {
    return [];
  }
}

// Builds a wa.me deep link from whatever's in the phone field — which may hold more than one
// number ("0977192139 / 0977519221") since that's how schools naturally type it in; only the
// first is usable as a single WhatsApp target. wa.me needs the full international number with
// no leading zero, so a local Zambian-format number (0XXXXXXXXX) gets its leading 0 swapped
// for the country code; a number already given in international form is left alone.
function whatsAppLink(phone: string): string {
  const first = phone.split(/[/,]/)[0].trim();
  let digits = first.replace(/\D/g, "");
  if (digits.startsWith("0")) digits = "260" + digits.slice(1);
  return `https://wa.me/${digits}`;
}

// Fades + slides a section up the first time it scrolls into view.
function Reveal({
  children,
  className = "",
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  const { ref, visible } = useReveal<HTMLDivElement>();
  return (
    <div
      ref={ref}
      className={`transition-all duration-700 ease-out ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"} ${className}`}
      style={{ transitionDelay: visible ? `${delay}ms` : "0ms" }}
    >
      {children}
    </div>
  );
}

function HeroCarousel({ images, logoSrc }: { images: string[]; logoSrc: string }) {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (images.length < 2) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % images.length), 6000);
    return () => clearInterval(id);
  }, [images.length]);

  return (
    <div className="absolute inset-0 overflow-hidden bg-brand-ink">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.05]"
        style={{
          backgroundImage:
            "linear-gradient(oklch(1 0 0) 1px,transparent 1px),linear-gradient(90deg,oklch(1 0 0) 1px,transparent 1px)",
          backgroundSize: "56px 56px",
        }}
      />
      {images.length === 0 ? (
        <div className="absolute inset-0" style={{ background: "var(--gradient-hero)" }}>
          <div className="pointer-events-none absolute -left-24 -top-32 h-[36rem] w-[36rem] rounded-full bg-blue-500/20 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-40 right-[-6rem] h-[32rem] w-[32rem] rounded-full bg-brand-gold/15 blur-3xl" />
          {/* A faint, oversized crest grounds the gradient in the school's own identity
              instead of leaving it a generic color wash when there's no hero photo yet. */}
          <img
            src={logoSrc}
            alt=""
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-24 -right-24 h-[34rem] w-[34rem] object-contain opacity-[0.07] mix-blend-screen"
          />
        </div>
      ) : (
        images.map((src, i) => (
          <img
            key={src + i}
            src={src}
            alt=""
            className="absolute inset-0 h-full w-full object-cover transition-opacity duration-[2000ms] ease-in-out"
            style={{
              opacity: i === index ? 1 : 0,
              animation: i === index ? "kenburns 9s ease-out forwards" : undefined,
            }}
          />
        ))
      )}
      {/* The heavier readability overlay only earns its keep over an actual photo — the
          brand gradient fallback is dark enough on its own, and piling this on top of it
          just muddies the decorative color blobs above without a photo to read text over. */}
      {images.length > 0 && (
        <>
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/50 to-black/25" />
          <div className="absolute inset-0 bg-gradient-to-r from-black/40 via-transparent to-transparent" />
        </>
      )}
      {images.length > 1 && (
        <div className="absolute bottom-7 left-1/2 z-10 flex -translate-x-1/2 gap-1.5">
          {images.map((_, i) => (
            <button
              key={i}
              aria-label={`Show slide ${i + 1}`}
              onClick={() => setIndex(i)}
              className={`h-1.5 rounded-full transition-all duration-500 ${i === index ? "w-7 bg-white" : "w-1.5 bg-white/40 hover:bg-white/60"}`}
            />
          ))}
        </div>
      )}
      <style>{`
        @keyframes kenburns {
          0% { transform: scale(1.0); }
          100% { transform: scale(1.08); }
        }
      `}</style>
    </div>
  );
}

// The system's own module list (mirrors the capability tags shown on /auth) — genuine,
// truthful content about what the platform actually does, used here to keep the hero card
// and the "platform" section substantive even on a fresh install with no school data yet.
const CAPABILITIES = [
  { icon: CalendarCheck, label: "Attendance" },
  { icon: Wallet, label: "Fees & billing" },
  { icon: FileCheck2, label: "Exams & marks" },
  { icon: Banknote, label: "Payroll" },
  { icon: BookOpen, label: "Library" },
  { icon: Bus, label: "Transport" },
];

const PROGRAMS = [
  {
    icon: BookOpenCheck,
    title: "Academic Excellence",
    body: "A rigorous, well-rounded curriculum that stretches every learner and prepares them for what's next.",
  },
  {
    icon: Trophy,
    title: "Sport & Athletics",
    body: "Competitive and recreational sport that builds discipline, teamwork and healthy habits for life.",
  },
  {
    icon: Palette,
    title: "Arts & Creativity",
    body: "Music, drama and visual arts programs that give every pupil a way to express themselves.",
  },
  {
    icon: ShieldCheck,
    title: "Character & Values",
    body: "A safe, nurturing environment grounded in discipline, respect and strong personal values.",
  },
];

function LandingPage() {
  const { user } = useAuth();
  const { data: landing } = useQuery({
    queryKey: ["public-landing"],
    queryFn: () => api.public.landing(),
  });
  const heroImages = parseImages(landing?.heroImages);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const [form, setForm] = useState({ fullName: "", email: "", phone: "", message: "" });
  const [sent, setSent] = useState(false);
  const submit = useMutation({
    mutationFn: () => api.public.submitInquiry(form),
    onSuccess: () => {
      setSent(true);
      setForm({ fullName: "", email: "", phone: "", message: "" });
      toast.success("Thank you — we've received your message.");
    },
    onError: (e: any) => toast.error(e.message ?? "Could not send your message. Please try again."),
  });

  const schoolName = landing?.name ?? "Chaz Crestview Academy";
  const year = new Date().getFullYear();

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* ── Nav ─────────────────────────────────────────────────────────── */}
      {/* Fixed (not sticky) so it floats transparently over the hero image/gradient rather
          than pushing the hero down and appearing as an opaque bar above it. */}
      <header
        className={`fixed inset-x-0 top-0 z-40 border-b transition-all duration-300 ${
          scrolled
            ? "border-border/60 bg-background/90 shadow-sm backdrop-blur-md"
            : "border-transparent bg-transparent"
        }`}
      >
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3.5 sm:px-8">
          <div className="flex items-center gap-2.5">
            <img
              src={landing?.logoUrl || DEFAULT_LOGO}
              alt={schoolName}
              className="h-10 w-10 rounded-xl object-contain border border-border/60 bg-white p-1 shadow-sm"
            />
            <span
              className={`font-display text-[15px] font-semibold tracking-tight transition-colors ${scrolled ? "text-foreground" : "text-white drop-shadow-sm"}`}
            >
              {schoolName}
            </span>
          </div>
          <nav
            className={`mr-auto hidden items-center gap-6 pl-10 text-[11px] font-bold uppercase tracking-[0.16em] lg:flex ${scrolled ? "text-muted-foreground" : "text-white/70"}`}
          >
            <a href="#about" className="transition-colors hover:text-brand-gold">
              The school
            </a>
            <a href="#inquiries" className="transition-colors hover:text-brand-gold">
              Admissions
            </a>
          </nav>
          <div className="flex items-center gap-2">
            {user && (
              <Link to="/dashboard" className="hidden sm:block">
                <Button
                  variant={scrolled ? "ghost" : "outline"}
                  size="sm"
                  className={
                    scrolled
                      ? ""
                      : "border-white/25 bg-white/5 text-white hover:bg-white/15 hover:text-white"
                  }
                >
                  Go to workspace
                </Button>
              </Link>
            )}
            <Link to="/auth">
              <Button size="sm" className="rounded-full shadow-md">
                Sign in <ArrowRight className="h-3.5 w-3.5 ml-1" />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* ── Hero ────────────────────────────────────────────────────────── */}
      <section className="relative flex min-h-[88vh] items-center overflow-hidden">
        <HeroCarousel images={heroImages} logoSrc={landing?.logoUrl || DEFAULT_LOGO} />
        <div className="relative mx-auto grid w-full max-w-6xl gap-12 px-5 py-32 sm:px-8 lg:grid-cols-[1.08fr_0.92fr] lg:items-center lg:gap-20">
          <div className="max-w-2xl animate-fade-up">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.07] px-4 py-1.5 text-[10.5px] font-bold uppercase tracking-[0.18em] text-white/85 backdrop-blur-sm">
              <Sparkles className="h-3.5 w-3.5 text-brand-gold" />
              {landing?.motto || "For Premium Education"}
            </div>
            <h1 className="font-display max-w-3xl text-[clamp(2.7rem,5.8vw,5.1rem)] font-semibold leading-[0.98] tracking-tight text-white">
              {landing?.heroHeading || `Welcome to ${schoolName}`}
            </h1>
            <p className="mt-7 max-w-xl text-[16px] leading-relaxed text-white/78 sm:text-[17px]">
              {landing?.heroSubtext ||
                "Nurturing academic excellence, character and community — a connected school experience for pupils, parents and staff."}
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-3.5">
              <Link to="/auth">
                <Button size="lg" className="rounded-full px-8 shadow-xl shadow-black/20">
                  Sign in to workspace <ArrowRight className="h-4 w-4 ml-1.5" />
                </Button>
              </Link>
              <a href="#inquiries">
                <Button
                  size="lg"
                  variant="outline"
                  className="rounded-full border-white/25 bg-white/5 px-8 text-white hover:bg-white/15 hover:text-white"
                >
                  Make an inquiry
                </Button>
              </a>
            </div>
          </div>
          <Reveal className="hidden lg:block" delay={220}>
            <div className="relative overflow-hidden border border-white/20 bg-black/20 p-6 shadow-2xl shadow-black/20 backdrop-blur-md">
              <div className="absolute right-0 top-0 h-24 w-24 border-l border-b border-brand-gold/40" />
              <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-brand-gold">
                A connected school experience
              </p>
              <p className="mt-5 max-w-xs font-display text-3xl leading-tight text-white">
                Where every learner gets room to rise.
              </p>
              <ul className="mt-7 space-y-3">
                {[
                  "Real-time attendance & fee tracking",
                  "Exams, report cards & communication",
                  "One login for pupils, parents and staff",
                ].map((line) => (
                  <li key={line} className="flex items-start gap-2.5 text-sm text-white/80">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-brand-gold" />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-6 flex items-center gap-2 text-xs text-white/65">
                <ShieldCheck className="h-4 w-4 text-brand-gold" />
                <span>Secure, role-protected access for every user</span>
              </div>
            </div>
          </Reveal>
        </div>
        <a
          href="#about"
          aria-label="Scroll to learn more"
          className="absolute bottom-7 right-7 z-10 hidden h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-white/5 text-white backdrop-blur-sm transition-all hover:bg-white/15 sm:flex animate-bounce-slow"
        >
          <ArrowDown className="h-4 w-4" />
        </a>
      </section>

      {/* ── Platform capabilities ──────────────────────────────────────────
          Genuine, factual content about what the software itself does — keeps the page
          substantive on a fresh install where school-specific data (photos, stats,
          testimonials) doesn't exist yet, without inventing anything about the school. */}
      <section className="border-b border-border/60 bg-background py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-5 sm:px-8">
          <Reveal className="mx-auto max-w-2xl text-center">
            <p className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-primary/70">
              One connected workspace
            </p>
            <h2 className="mt-3 font-display text-[clamp(1.6rem,2.8vw,2.15rem)] font-semibold tracking-tight">
              Everything the school runs on, in one place
            </h2>
          </Reveal>
          <div className="mt-11 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {CAPABILITIES.map((c, i) => (
              <Reveal key={c.label} delay={i * 70}>
                <div className="flex h-full flex-col items-center gap-2.5 rounded-2xl border border-border/70 bg-card px-3 py-6 text-center shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <c.icon className="h-5 w-5" />
                  </div>
                  <p className="text-[12.5px] font-semibold leading-tight">{c.label}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── About ───────────────────────────────────────────────────────── */}
      <section id="about" className="relative overflow-hidden py-24 sm:py-28">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-primary/[0.06] to-transparent" />
        <div className="mx-auto max-w-6xl px-5 sm:px-8">
          <div className="grid gap-14 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
            <Reveal>
              <p className="mb-3 text-[11px] font-extrabold uppercase tracking-[0.22em] text-primary/70">
                About us
              </p>
              <h2 className="font-display text-[clamp(1.9rem,3.4vw,2.75rem)] font-semibold leading-tight tracking-tight">
                {landing?.aboutTitle || `About ${schoolName}`}
              </h2>
              <p className="mt-6 whitespace-pre-line text-[15.5px] leading-[1.75] text-muted-foreground">
                {landing?.aboutBody ||
                  "We are committed to providing a nurturing, disciplined and academically rigorous environment where every learner is equipped to excel — in the classroom and beyond."}
              </p>
              {landing?.headTeacher ? (
                <div className="mt-8 flex items-center gap-3 rounded-2xl border border-border/70 bg-card p-4 shadow-sm">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <Quote className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold leading-tight">{landing.headTeacher}</p>
                    <p className="text-xs text-muted-foreground">Head Teacher</p>
                  </div>
                </div>
              ) : (
                <div className="mt-8 flex items-center gap-4 rounded-2xl border border-border/70 bg-card p-5 shadow-sm">
                  <img
                    src={landing?.logoUrl || DEFAULT_LOGO}
                    alt=""
                    className="h-14 w-14 shrink-0 rounded-xl border border-border/60 bg-white object-contain p-1.5"
                  />
                  <div>
                    <p className="text-sm font-semibold leading-tight">
                      {landing?.motto || "For Premium Education"}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Our promise to every family we welcome.
                    </p>
                  </div>
                </div>
              )}
            </Reveal>

            <div className="grid grid-cols-2 gap-4">
              {PROGRAMS.map((p, i) => (
                <Reveal key={p.title} delay={i * 100}>
                  <div className="group h-full rounded-2xl border border-border/70 bg-card p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-primary/5">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
                      <p.icon className="h-5 w-5" />
                    </div>
                    <p className="mt-3.5 text-sm font-semibold">{p.title}</p>
                    <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted-foreground">
                      {p.body}
                    </p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Inquiries ───────────────────────────────────────────────────── */}
      <section id="inquiries" className="relative overflow-hidden border-t border-border/60">
        <div className="grid lg:grid-cols-2">
          <div
            className="relative flex flex-col justify-center overflow-hidden px-5 py-20 sm:px-8 lg:px-14"
            style={{ background: "var(--gradient-hero)" }}
          >
            <div className="pointer-events-none absolute -left-16 -top-16 h-72 w-72 rounded-full bg-blue-500/20 blur-3xl" />
            <div className="pointer-events-none absolute bottom-[-4rem] right-[-2rem] h-64 w-64 rounded-full bg-brand-gold/15 blur-3xl" />
            <Reveal className="relative mx-auto max-w-md lg:mx-0">
              <p className="mb-2 text-[11px] font-extrabold uppercase tracking-[0.22em] text-brand-gold/85">
                Get in touch
              </p>
              <h2 className="font-display text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                We'd love to hear from you
              </h2>
              <p className="mt-4 text-[15px] leading-relaxed text-white/70">
                Have a question about admissions, fees, or anything else? Send us a message and our
                team will get back to you.
              </p>
              <div className="mt-9 space-y-4 text-sm">
                {landing?.address &&
                  (landing.mapUrl ? (
                    <a
                      href={landing.mapUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-start gap-3 text-white/80 transition-colors hover:text-white"
                    >
                      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/10">
                        <MapPin className="h-4 w-4" />
                      </span>
                      <span className="pt-1 underline decoration-white/30 underline-offset-2">
                        {[landing.address, landing.city, landing.province]
                          .filter(Boolean)
                          .join(", ")}
                      </span>
                    </a>
                  ) : (
                    <div className="flex items-start gap-3 text-white/80">
                      <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/10">
                        <MapPin className="h-4 w-4" />
                      </span>
                      <span className="pt-1">
                        {[landing.address, landing.city, landing.province]
                          .filter(Boolean)
                          .join(", ")}
                      </span>
                    </div>
                  ))}
                {landing?.phone && (
                  <a
                    href={`tel:${landing.phone.split(/[/,]/)[0].trim().replace(/\D/g, "")}`}
                    className="flex items-center gap-3 text-white/80 transition-colors hover:text-white"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/10">
                      <Phone className="h-4 w-4" />
                    </span>
                    <span>{landing.phone}</span>
                  </a>
                )}
                {landing?.phone && (
                  <a
                    href={whatsAppLink(landing.phone)}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-3 text-white/80 transition-colors hover:text-white"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/10">
                      <MessageCircle className="h-4 w-4" />
                    </span>
                    <span>Chat on WhatsApp</span>
                  </a>
                )}
                {landing?.email && (
                  <a
                    href={`mailto:${landing.email}`}
                    className="flex items-center gap-3 text-white/80 transition-colors hover:text-white"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/10">
                      <Mail className="h-4 w-4" />
                    </span>
                    <span>{landing.email}</span>
                  </a>
                )}
                {landing?.facebookUrl && (
                  <a
                    href={landing.facebookUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-3 text-white/80 transition-colors hover:text-white"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/10">
                      <Facebook className="h-4 w-4" />
                    </span>
                    <span>Find us on Facebook</span>
                  </a>
                )}
              </div>
            </Reveal>
          </div>

          <div className="flex items-center justify-center bg-muted/25 px-5 py-20 sm:px-8 lg:px-14">
            <Reveal className="w-full max-w-md">
              <div className="rounded-3xl border border-border/70 bg-card p-7 shadow-xl shadow-black/[0.03] sm:p-8">
                {sent ? (
                  <div className="flex flex-col items-center justify-center py-10 text-center">
                    <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600">
                      <CheckCircle2 className="h-7 w-7" />
                    </div>
                    <p className="font-display text-lg font-semibold">Message sent</p>
                    <p className="mt-1.5 text-sm text-muted-foreground">We'll be in touch soon.</p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-6"
                      onClick={() => setSent(false)}
                    >
                      Send another
                    </Button>
                  </div>
                ) : (
                  <form
                    className="space-y-4"
                    onSubmit={(e) => {
                      e.preventDefault();
                      submit.mutate();
                    }}
                  >
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label>Full name *</Label>
                        <Input
                          required
                          value={form.fullName}
                          onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                          className="mt-1.5 h-11 rounded-xl"
                        />
                      </div>
                      <div>
                        <Label>Phone</Label>
                        <Input
                          value={form.phone}
                          onChange={(e) => setForm({ ...form, phone: e.target.value })}
                          className="mt-1.5 h-11 rounded-xl"
                        />
                      </div>
                    </div>
                    <div>
                      <Label>Email</Label>
                      <Input
                        type="email"
                        value={form.email}
                        onChange={(e) => setForm({ ...form, email: e.target.value })}
                        className="mt-1.5 h-11 rounded-xl"
                      />
                    </div>
                    <div>
                      <Label>Message *</Label>
                      <Textarea
                        required
                        rows={4}
                        value={form.message}
                        onChange={(e) => setForm({ ...form, message: e.target.value })}
                        className="mt-1.5 rounded-xl"
                      />
                    </div>
                    <Button
                      type="submit"
                      size="lg"
                      className="w-full rounded-xl shadow-md"
                      disabled={submit.isPending || !form.fullName || !form.message}
                    >
                      {submit.isPending ? (
                        "Sending…"
                      ) : (
                        <>
                          Send message <Send className="h-4 w-4 ml-1.5" />
                        </>
                      )}
                    </Button>
                  </form>
                )}
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <footer className="relative overflow-hidden bg-brand-ink text-white/70">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              "linear-gradient(oklch(1 0 0) 1px,transparent 1px),linear-gradient(90deg,oklch(1 0 0) 1px,transparent 1px)",
            backgroundSize: "52px 52px",
          }}
        />
        <div className="pointer-events-none absolute -left-24 bottom-[-8rem] h-80 w-80 rounded-full bg-blue-500/10 blur-3xl" />
        <div className="relative mx-auto max-w-6xl px-5 py-16 sm:px-8">
          <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <div className="flex items-center gap-2.5">
                <img
                  src={landing?.logoUrl || DEFAULT_LOGO}
                  alt=""
                  className="h-10 w-10 rounded-xl object-contain border border-white/15 bg-white p-1"
                />
                <span className="font-display text-sm font-semibold text-white">{schoolName}</span>
              </div>
              <p className="mt-3.5 text-[13px] leading-relaxed text-white/50">
                {landing?.motto || "For Premium Education"}
              </p>
            </div>

            <div>
              <p className="text-[10.5px] font-extrabold uppercase tracking-[0.16em] text-brand-gold/75">
                Navigate
              </p>
              <div className="mt-3.5 flex flex-col gap-2.5 text-sm">
                <a href="#about" className="transition-colors hover:text-white">
                  About us
                </a>
                <a href="#inquiries" className="transition-colors hover:text-white">
                  Make an inquiry
                </a>
                <Link to="/auth" className="transition-colors hover:text-white">
                  Sign in
                </Link>
              </div>
            </div>

            <div>
              <p className="text-[10.5px] font-extrabold uppercase tracking-[0.16em] text-brand-gold/75">
                Contact
              </p>
              <div className="mt-3.5 flex flex-col gap-2.5 text-sm">
                {landing?.phone && (
                  <a
                    href={`tel:${landing.phone.split(/[/,]/)[0].trim().replace(/\D/g, "")}`}
                    className="flex items-center gap-2 transition-colors hover:text-white"
                  >
                    <Phone className="h-3.5 w-3.5 shrink-0" />
                    {landing.phone}
                  </a>
                )}
                {landing?.phone && (
                  <a
                    href={whatsAppLink(landing.phone)}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-2 transition-colors hover:text-white"
                  >
                    <MessageCircle className="h-3.5 w-3.5 shrink-0" />
                    WhatsApp
                  </a>
                )}
                {landing?.email && (
                  <a
                    href={`mailto:${landing.email}`}
                    className="flex items-center gap-2 transition-colors hover:text-white"
                  >
                    <Mail className="h-3.5 w-3.5 shrink-0" />
                    {landing.email}
                  </a>
                )}
                {landing?.website && (
                  <a
                    href={landing.website}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-2 transition-colors hover:text-white"
                  >
                    <Globe className="h-3.5 w-3.5 shrink-0" />
                    {landing.website.replace(/^https?:\/\//, "")}
                  </a>
                )}
                {landing?.facebookUrl && (
                  <a
                    href={landing.facebookUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-2 transition-colors hover:text-white"
                  >
                    <Facebook className="h-3.5 w-3.5 shrink-0" />
                    Facebook
                  </a>
                )}
                {!landing?.phone &&
                  !landing?.email &&
                  !landing?.website &&
                  !landing?.facebookUrl && (
                    <span className="text-white/35">Reach us via the inquiry form</span>
                  )}
              </div>
            </div>

            <div>
              <p className="text-[10.5px] font-extrabold uppercase tracking-[0.16em] text-brand-gold/75">
                Location
              </p>
              {landing?.mapUrl ? (
                <a
                  href={landing.mapUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3.5 flex items-start gap-2 text-sm transition-colors hover:text-white"
                >
                  <MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                  <span className="underline decoration-white/20 underline-offset-2">
                    {[landing?.address, landing?.city, landing?.province, landing?.country]
                      .filter(Boolean)
                      .join(", ") || "—"}
                  </span>
                </a>
              ) : (
                <p className="mt-3.5 flex items-start gap-2 text-sm">
                  <MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                  <span>
                    {[landing?.address, landing?.city, landing?.province, landing?.country]
                      .filter(Boolean)
                      .join(", ") || "—"}
                  </span>
                </p>
              )}
            </div>
          </div>
          <div className="mt-12 flex flex-col items-center justify-between gap-3 border-t border-white/10 pt-7 text-xs text-white/40 sm:flex-row">
            <span>
              © {year} {schoolName}. All rights reserved.
            </span>
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5" /> Secure, role-protected access
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
