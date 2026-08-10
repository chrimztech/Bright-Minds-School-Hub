import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { money } from "@/lib/format";
import { EmptyState } from "@/components/EmptyState";

const CATEGORIES = ["Salaries", "Utilities", "Maintenance", "Supplies", "Transport", "Food", "Events", "Other"];

export const Route = createFileRoute("/_authenticated/accounts")({
  head: () => ({ meta: [{ title: "Accounts" }] }),
  component: AccountsPage,
});

function AccountsPage() {
  return (
    <>
      <PageHeader title="Accounts" description="Income, expenses and financial summary" />
      <div className="p-6 space-y-6">
        <Summary />
        <Tabs defaultValue="expenses">
          <TabsList><TabsTrigger value="expenses">Expenses</TabsTrigger><TabsTrigger value="income">Income (fee receipts)</TabsTrigger></TabsList>
          <TabsContent value="expenses"><Expenses /></TabsContent>
          <TabsContent value="income"><Income /></TabsContent>
        </Tabs>
      </div>
    </>
  );
}

function Summary() {
  const { data: expenses = [] } = useQuery({ queryKey: ["expenses"], queryFn: () => api.accounts.expenses.list() });
  const { data: payments = [] } = useQuery({ queryKey: ["payments"], queryFn: () => api.fees.payments.list() });
  const expense = expenses.reduce((a, r) => a + Number(r.amount), 0);
  const income = payments.reduce((a, r) => a + Number(r.amount), 0);
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Total income</p><p className="text-2xl font-semibold text-emerald-600">{money(income)}</p></CardContent></Card>
      <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Total expenses</p><p className="text-2xl font-semibold text-rose-600">{money(expense)}</p></CardContent></Card>
      <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Net</p><p className="text-2xl font-semibold">{money(income - expense)}</p></CardContent></Card>
    </div>
  );
}

function Expenses() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const { data = [] } = useQuery({ queryKey: ["expenses"], queryFn: () => api.accounts.expenses.list() });
  const create = useMutation({
    mutationFn: (f: any) => api.accounts.expenses.create(f),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["expenses"] }); toast.success("Expense recorded"); setOpen(false); },
    onError: (e: any) => toast.error(e.message),
  });
  return (
    <div className="space-y-3 mt-4">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" /> New expense</Button></DialogTrigger>
        <ExpenseForm onSubmit={(f: any) => create.mutate(f)} />
      </Dialog>
      <div className="rounded-lg border bg-card"><Table>
        <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Category</TableHead><TableHead>Payee</TableHead><TableHead>Description</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
        <TableBody>
          {data.length === 0 ? <TableRow><TableCell colSpan={5}><EmptyState /></TableCell></TableRow> : data.map((e) => (
            <TableRow key={e.id}>
              <TableCell>{e.spentOn}</TableCell>
              <TableCell>{e.category}</TableCell>
              <TableCell>{e.payee ?? "—"}</TableCell>
              <TableCell className="max-w-[280px] truncate">{e.description}</TableCell>
              <TableCell className="text-right">{money(e.amount)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table></div>
    </div>
  );
}

function ExpenseForm({ onSubmit }: any) {
  const [f, setF] = useState({ spentOn: new Date().toISOString().slice(0, 10), category: "Supplies", payee: "", description: "", amount: 0, paymentMethod: "CASH", refNo: "" });
  return (
    <DialogContent>
      <DialogHeader><DialogTitle>Record expense</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Date</Label><Input type="date" value={f.spentOn} onChange={(e) => setF({ ...f, spentOn: e.target.value })} /></div>
          <div><Label>Amount</Label><Input type="number" step="0.01" value={f.amount} onChange={(e) => setF({ ...f, amount: Number(e.target.value) })} /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Category</Label>
            <Select value={f.category} onValueChange={(v) => setF({ ...f, category: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Method</Label>
            <Select value={f.paymentMethod} onValueChange={(v) => setF({ ...f, paymentMethod: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{["CASH","BANK","MOBILE_MONEY","CHEQUE","CARD"].map((m) => <SelectItem key={m} value={m}>{m.replace("_", " ")}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Payee</Label><Input value={f.payee} onChange={(e) => setF({ ...f, payee: e.target.value })} /></div>
          <div><Label>Ref no.</Label><Input value={f.refNo} onChange={(e) => setF({ ...f, refNo: e.target.value })} /></div>
        </div>
        <div><Label>Description</Label><Textarea value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></div>
      </div>
      <DialogFooter><Button onClick={() => onSubmit(f)} disabled={!f.amount}>Save</Button></DialogFooter>
    </DialogContent>
  );
}

function Income() {
  const { data = [] } = useQuery({ queryKey: ["fee-payments"], queryFn: () => api.fees.payments.list() });
  return (
    <div className="mt-4 rounded-lg border bg-card"><Table>
      <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Pupil</TableHead><TableHead>Method</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
      <TableBody>
        {data.length === 0 ? <TableRow><TableCell colSpan={4}><EmptyState /></TableCell></TableRow> : data.map((p) => (
          <TableRow key={p.id}>
            <TableCell>{p.paidOn}</TableCell>
            <TableCell>{p.pupil?.fullName ?? "—"}</TableCell>
            <TableCell>{p.method}</TableCell>
            <TableCell className="text-right text-emerald-600">{money(p.amount)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table></div>
  );
}
