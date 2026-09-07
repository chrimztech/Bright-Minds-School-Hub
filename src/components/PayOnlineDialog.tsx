import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import type { GatewayTransaction, Invoice } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Smartphone } from "lucide-react";
import { money } from "@/lib/format";

const MOBILE_MONEY_OPERATORS = [
  { value: "airtel", label: "Airtel Money" },
  { value: "mtn", label: "MTN Mobile Money" },
  { value: "zamtel", label: "Zamtel Kwacha" },
];

// Observed against the live API: a real MTN collection took ~3m17s to resolve (Airtel
// resolved in seconds) — 4 minutes gives real transactions room to complete before the UI
// falls back to manual "Check now" polling.
const POLL_TIMEOUT_MS = 4 * 60_000;

// Mobile money via Lenco — confirmed automatically once the gateway itself reports success,
// unlike a manual "I've paid" claim an admin has to review. checkStatus always re-queries Lenco
// live, so polling here just repeatedly asks "has it happened yet?" rather than trusting any
// locally-cached status. Shared between the parent portal (guardian-initiated) and the admin
// pupil/fees views (staff-initiated on a parent's behalf) — only the API calls differ.
export function PayOnlineDialog({
  invoice,
  defaultPhone,
  initiate: initiateFn,
  checkStatus,
  onSuccess,
}: {
  invoice: Invoice;
  defaultPhone?: string;
  initiate: (data: {
    amount: number;
    phone: string;
    operator: string;
  }) => Promise<GatewayTransaction>;
  checkStatus: (reference: string) => Promise<GatewayTransaction>;
  onSuccess?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const balance = Number(invoice.total) - Number(invoice.paid);
  const [f, setF] = useState({ amount: balance, phone: defaultPhone ?? "", operator: "airtel" });
  const [reference, setReference] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);

  const initiate = useMutation({
    mutationFn: () => initiateFn({ amount: f.amount, phone: f.phone, operator: f.operator }),
    onSuccess: (tx) => {
      setReference(tx.reference);
      setStartedAt(Date.now());
    },
    onError: (e: any) => toast.error(e.message),
  });

  const timedOut = startedAt != null && Date.now() - startedAt > POLL_TIMEOUT_MS;
  const { data: status, refetch: recheck } = useQuery({
    queryKey: ["lenco-status", reference],
    enabled: !!reference,
    queryFn: () => checkStatus(reference!),
    refetchInterval: (query) => {
      const s = query.state.data?.status;
      if (s === "SUCCESSFUL" || s === "FAILED") return false;
      if (startedAt != null && Date.now() - startedAt > POLL_TIMEOUT_MS) return false;
      return 3000;
    },
  });

  useEffect(() => {
    if (status?.status === "SUCCESSFUL" && reference) {
      toast.success("Payment received — thank you!");
      onSuccess?.();
      setReference(null);
      setStartedAt(null);
      setOpen(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status?.status, reference]);

  function reset() {
    setF({ amount: balance, phone: defaultPhone ?? "", operator: "airtel" });
    setReference(null);
    setStartedAt(null);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (v) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm">
          <Smartphone className="h-3.5 w-3.5 mr-1" /> Pay online
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Pay via mobile money</DialogTitle>
        </DialogHeader>

        {!reference ? (
          <>
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Invoice <span className="font-mono text-foreground">{invoice.invoiceNo}</span> —
                balance {money(balance)}. A payment prompt will be sent to the phone number below.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Phone number</Label>
                  <Input
                    value={f.phone}
                    onChange={(e) => setF({ ...f, phone: e.target.value })}
                    placeholder="09XXXXXXXX"
                  />
                </div>
                <div>
                  <Label>Network</Label>
                  <Select value={f.operator} onValueChange={(v) => setF({ ...f, operator: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MOBILE_MONEY_OPERATORS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>
                          {o.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Amount</Label>
                <Input
                  type="number"
                  max={balance}
                  value={f.amount}
                  onChange={(e) => setF({ ...f, amount: Number(e.target.value) })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                onClick={() => initiate.mutate()}
                disabled={
                  !f.phone || !f.amount || f.amount <= 0 || f.amount > balance || initiate.isPending
                }
              >
                {initiate.isPending ? "Sending prompt…" : "Send payment prompt"}
              </Button>
            </DialogFooter>
          </>
        ) : status?.status === "FAILED" ? (
          <div className="space-y-3">
            <p className="text-sm text-destructive">
              Payment failed{status.failureReason ? `: ${status.failureReason}` : "."}
            </p>
            <Button variant="outline" onClick={reset}>
              Try again
            </Button>
          </div>
        ) : (
          <div className="space-y-3 text-center py-4">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
            <p className="text-sm">
              A payment prompt was sent to <span className="font-medium">{f.phone}</span> — approve
              it on your phone to complete the payment.
            </p>
            {timedOut && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  Still waiting — you can check back later, we'll keep confirming in the background.
                </p>
                <Button variant="outline" size="sm" onClick={() => recheck()}>
                  Check now
                </Button>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
