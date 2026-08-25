import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, CheckCircle2, Mail } from "lucide-react";

export const Route = createFileRoute("/forgot-password")({
  ssr: false,
  head: () => ({ meta: [{ title: "Reset your password" }] }),
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const submit = useMutation({
    mutationFn: () => api.public.forgotPassword(email),
    // Always shows the same success state regardless of whether the email matched an
    // account — matching the backend's own "never reveal which emails exist" behavior.
    onSuccess: () => setSent(true),
    onError: () => setSent(true),
  });

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-background">
      <Card className="w-full max-w-md border-border/60 shadow-xl">
        <CardHeader>
          <div className="rounded-xl p-2.5 w-fit mb-2" style={{ background: "var(--gradient-brand)" }}>
            <Mail className="h-5 w-5 text-white" />
          </div>
          <CardTitle className="font-display text-2xl">Forgot your password?</CardTitle>
          <CardDescription>Enter your account email and we'll send you a reset link.</CardDescription>
        </CardHeader>
        <CardContent>
          {sent ? (
            <div className="flex flex-col items-center py-4 text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <p className="font-medium">Check your email</p>
              <p className="mt-1.5 text-sm text-muted-foreground">
                If an account exists for <strong>{email}</strong>, a reset link is on its way. It's valid for 1 hour.
              </p>
              <Link to="/auth" className="mt-6 inline-flex items-center gap-1.5 text-sm text-primary hover:underline">
                <ArrowLeft className="h-3.5 w-3.5" /> Back to sign in
              </Link>
            </div>
          ) : (
            <form
              className="space-y-4"
              onSubmit={(e) => { e.preventDefault(); submit.mutate(); }}
            >
              <div>
                <Label>Email</Label>
                <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@school.ac.zm" />
              </div>
              <Button type="submit" className="w-full" disabled={submit.isPending || !email}>
                {submit.isPending ? "Sending…" : "Send reset link"}
              </Button>
              <Link to="/auth" className="flex items-center justify-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
                <ArrowLeft className="h-3.5 w-3.5" /> Back to sign in
              </Link>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
