import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { ArrowLeft, Eye, EyeOff, KeyRound } from "lucide-react";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  validateSearch: (search: Record<string, unknown>) => ({
    token: typeof search.token === "string" ? search.token : "",
  }),
  head: () => ({ meta: [{ title: "Reset your password" }] }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const { token } = Route.useSearch();
  const navigate = useNavigate();
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pw.length < 8) return toast.error("Password must be at least 8 characters");
    if (pw !== confirm) return toast.error("Passwords do not match");
    setBusy(true);
    try {
      await api.public.resetPassword(token, pw);
      toast.success("Password reset — you can now sign in.");
      navigate({ to: "/auth", replace: true });
    } catch (err: any) {
      toast.error(err.message ?? "Could not reset your password. The link may have expired.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <Card className="w-full max-w-md border-border/60 shadow-xl">
        <CardHeader>
          <div className="rounded-xl p-2.5 w-fit mb-2" style={{ background: "var(--gradient-brand)" }}><KeyRound className="h-5 w-5 text-white" /></div>
          <CardTitle className="font-display text-2xl">Choose a new password</CardTitle>
          <CardDescription>Set a new password for your account.</CardDescription>
        </CardHeader>
        <CardContent>
          {!token ? (
            <div className="text-center py-4">
              <p className="text-sm text-muted-foreground">This reset link is missing or invalid.</p>
              <Link to="/forgot-password" className="mt-4 inline-flex items-center gap-1.5 text-sm text-primary hover:underline">
                <ArrowLeft className="h-3.5 w-3.5" /> Request a new link
              </Link>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-3">
              <div>
                <Label>New password</Label>
                <div className="relative">
                  <Input type={show ? "text" : "password"} value={pw} onChange={(e) => setPw(e.target.value)} required minLength={8} className="pr-10" />
                  <button type="button" onClick={() => setShow((s) => !s)} className="absolute inset-y-0 right-0 px-3 text-muted-foreground hover:text-foreground" aria-label={show ? "Hide" : "Show"}>
                    {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div>
                <Label>Confirm password</Label>
                <Input type={show ? "text" : "password"} value={confirm} onChange={(e) => setConfirm(e.target.value)} required minLength={8} />
              </div>
              <Button disabled={busy} className="w-full">{busy ? "Saving…" : "Reset password"}</Button>
              <p className="text-xs text-muted-foreground">Minimum 8 characters.</p>
              <Link to="/auth" className="flex items-center justify-center gap-1.5 text-sm text-muted-foreground hover:text-foreground pt-1">
                <ArrowLeft className="h-3.5 w-3.5" /> Back to sign in
              </Link>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
