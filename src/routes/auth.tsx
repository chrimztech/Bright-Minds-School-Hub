import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight, Eye, EyeOff, Lock, Mail, ShieldCheck, Sparkles } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Sign in — Chaz Crestview Academy" }] }),
  component: AuthPage,
});

const capabilities = ["Attendance", "Fees & billing", "Exams & marks", "Payroll", "Library", "Transport"];

function AuthPage() {
  const { user, loading, login } = useAuth();
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (!loading && user) navigate({ to: "/dashboard", replace: true });
  }, [user, loading, navigate]);

  async function signIn(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const { mustChangePassword } = await login(identifier, password);
      navigate({ to: mustChangePassword ? "/change-password" : "/dashboard", replace: true });
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : "Invalid credentials");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen bg-brand-ink">
      <section className="sidebar-surface relative hidden w-[54%] overflow-hidden lg:flex lg:flex-col">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.055]"
          style={{
            backgroundImage:
              "linear-gradient(oklch(1 0 0) 1px,transparent 1px),linear-gradient(90deg,oklch(1 0 0) 1px,transparent 1px)",
            backgroundSize: "52px 52px",
          }}
        />
        <div className="pointer-events-none absolute -left-28 -top-36 h-[34rem] w-[34rem] rounded-full bg-blue-500/18 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-40 right-[-8rem] h-[32rem] w-[32rem] rounded-full bg-brand-gold/10 blur-3xl" />
        <div className="pointer-events-none absolute left-[12%] top-[22%] h-px w-[76%] bg-gradient-to-r from-transparent via-white/8 to-transparent" />

        <div className="relative flex h-full flex-col px-10 py-8 xl:px-16 xl:py-10">
          <div className="flex items-center gap-2 text-[9px] font-extrabold uppercase tracking-[0.22em] text-brand-gold/75">
            <span className="h-px w-7 bg-brand-gold/65" />
            School Management Suite
          </div>

          <div className="flex flex-1 flex-col items-center justify-center gap-7 pb-6 text-center">
            <div className="relative">
              <div className="absolute inset-0 scale-125 rounded-[2.5rem] bg-blue-500/25 blur-3xl" />
              <div className="relative rounded-[2.2rem] bg-gradient-to-br from-brand-gold/85 via-white/20 to-brand-sky/75 p-[2px] shadow-2xl shadow-black/35">
                <div className="rounded-[2.05rem] bg-brand-ink/95 p-2">
                  <div className="h-40 w-40 overflow-hidden rounded-[1.7rem] bg-white p-1 xl:h-44 xl:w-44">
                    <img
                      src="/logo.png"
                      alt="Chaz Crestview Academy"
                      className="h-full w-full object-contain"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <h1 className="font-display text-[clamp(1.75rem,2.6vw,2.45rem)] font-semibold leading-tight tracking-[0.045em] text-white">
                CHAZ CRESTVIEW ACADEMY
              </h1>
              <div className="flex items-center justify-center gap-3">
                <span className="h-px w-10 bg-gradient-to-r from-transparent to-brand-gold/70" />
                <p className="text-[10px] font-bold uppercase tracking-[0.35em] text-brand-gold/85">
                  For Premium Education
                </p>
                <span className="h-px w-10 bg-gradient-to-l from-transparent to-brand-gold/70" />
              </div>
            </div>

            <p className="max-w-md text-sm leading-6 text-white/48">
              One connected workspace for academic excellence, school operations and meaningful
              parent engagement.
            </p>

            <div className="flex max-w-lg flex-wrap justify-center gap-2">
              {capabilities.map((capability) => (
                <span
                  key={capability}
                  className="rounded-full border border-white/10 bg-white/[0.045] px-3 py-1.5 text-[9px] font-bold uppercase tracking-[0.09em] text-brand-sky/80 backdrop-blur-sm"
                >
                  {capability}
                </span>
              ))}
            </div>
          </div>

          <footer className="flex items-center justify-between text-[10px] text-white/28">
            <span>© {new Date().getFullYear()} Chaz Crestview Academy</span>
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-brand-gold/55" />
              Secure, role-protected access
            </span>
          </footer>
        </div>
      </section>

      <section className="auth-panel flex flex-1 items-center justify-center p-5 sm:p-8 lg:p-12">
        <div className="w-full max-w-[440px] animate-fade-up">
          <div className="mb-8 flex items-center justify-between">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/10 bg-primary/6 px-3 py-1.5 text-[9.5px] font-extrabold uppercase tracking-[0.15em] text-primary">
              <Sparkles className="h-3.5 w-3.5 text-brand-gold" />
              Academy workspace
            </div>
            <div className="flex items-center gap-2 text-[10px] font-semibold text-muted-foreground">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              Secure access
            </div>
          </div>

          <div className="mb-7 flex items-center gap-4 lg:hidden">
            <div className="h-16 w-16 overflow-hidden rounded-2xl border border-border bg-white p-1 shadow-depth">
              <img src="/logo.png" alt="Chaz Crestview Academy" className="h-full w-full object-contain" />
            </div>
            <div>
              <p className="text-sm font-extrabold tracking-[0.05em] text-foreground">CHAZ CRESTVIEW</p>
              <p className="text-sm font-extrabold tracking-[0.05em] text-foreground">ACADEMY</p>
              <p className="mt-1 text-[8.5px] font-bold uppercase tracking-[0.2em] text-brand-gold">
                For Premium Education
              </p>
            </div>
          </div>

          <div className="mb-8">
            <p className="mb-2 text-[10px] font-extrabold uppercase tracking-[0.2em] text-primary/60">
              Welcome to your portal
            </p>
            <h2 className="font-display text-4xl font-semibold leading-none tracking-tight text-foreground sm:text-[2.75rem]">
              Welcome back
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Sign in with your school account to continue to the management workspace.
            </p>
          </div>

          <form onSubmit={signIn} className="space-y-5">
            <div className="space-y-2">
              <Label className="text-[11px] font-bold uppercase tracking-[0.08em] text-foreground/75">
                Email or phone number
              </Label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/65" />
                <Input
                  type="text"
                  value={identifier}
                  onChange={(event) => setIdentifier(event.target.value)}
                  required
                  autoComplete="username"
                  placeholder="you@school.ac.zm or phone number"
                  className="h-12 rounded-2xl bg-card/80 pl-11 shadow-sm"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-[11px] font-bold uppercase tracking-[0.08em] text-foreground/75">
                Password
              </Label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/65" />
                <Input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="h-12 rounded-2xl bg-card/80 pl-11 pr-12 shadow-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((visible) => !visible)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-3 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button type="submit" disabled={busy} className="h-12 w-full rounded-2xl text-sm">
              {busy ? (
                <span className="flex items-center gap-2">
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Signing in…
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  Sign in to workspace
                  <ArrowRight className="h-4 w-4" />
                </span>
              )}
            </Button>
          </form>

          <div className="mt-8 flex items-start gap-3 rounded-2xl border border-border/65 bg-card/45 px-4 py-3.5">
            <div className="mt-0.5 rounded-lg bg-primary/8 p-1.5 text-primary">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs font-semibold text-foreground">Protected school access</p>
              <p className="mt-0.5 text-[10.5px] leading-relaxed text-muted-foreground">
                Accounts and permissions are managed by your school administrator.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
