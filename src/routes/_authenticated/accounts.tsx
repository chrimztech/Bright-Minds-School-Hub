import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api, type Payment } from "@/lib/api";
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
import { Plus, Pencil, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { money } from "@/lib/format";
import { EmptyState } from "@/components/EmptyState";
import { useAuth, hasAny, ADMIN_ROLES } from "@/lib/auth";

const CATEGORIES = ["Salaries", "Utilities", "Maintenance", "Supplies", "Transport", "Food", "Events", "Other"];

const INCOME_FILTERS = [
  { value: "ALL", label: "All payments" },
  { value: "SCHOOL_FEE", label: "School fees" },
  { value: "TRANSPORT", label: "Transport" },
  { value: "FOOD", label: "Food" },
  { value: "UNIFORM", label: "Uniform" },
  { value: "ADMIN_FEE", label: "Administrative fee" },
  { value: "REGISTRATION", label: "Registration" },
  { value: "LATE_FEE", label: "Late fee" },
  { value: "OTHER", label: "Other" },
];
// Any category not covered by a dedicated filter (Examination, Activity, …) is bucketed
// under "Other" so every payment always lands in exactly one filter.
function incomeCategory(p: Payment) {
  const cat = p.invoice?.feeItem?.category ?? "SCHOOL_FEE";
  return INCOME_FILTERS.some((f) => f.value === cat) ? cat : "OTHER";
}

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
  // Canteen sales are recorded as their own point-of-sale entity (not a Payment against an
  // invoice), so they're pulled in separately here — otherwise food income never counted
  // toward the total at all.
  const { data: canteenSales = [] } = useQuery({ queryKey: ["canteen-sales-accounts"], queryFn: () => api.canteen.sales.list() });
  // Admission registration fees are income the moment they're collected, independent of
  // whether the applicant is ever enrolled as a pupil — also pulled in separately.
  const { data: admissions = [] } = useQuery({ queryKey: ["admissions-accounts"], queryFn: () => api.admissions.list() });
  const expense = expenses.reduce((a, r) => a + Number(r.amount), 0);
  // Only CONFIRMED payments are actual received income — a parent's self-submitted
  // claim sits as PENDING until an admin confirms it, and REJECTED ones never happened.
  const income = payments.filter((p) => p.status === "CONFIRMED").reduce((a, r) => a + Number(r.amount), 0)
    + canteenSales.reduce((a, s) => a + Number(s.total), 0)
    + admissions.reduce((a, ad) => a + Number(ad.regFeePaid ?? 0), 0);
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
  const { roles } = useAuth();
  // accounts:reverse (correcting/deleting a recorded expense) is admin-tier only by default.
  const canReverse = hasAny(roles, ADMIN_ROLES);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const { data = [] } = useQuery({ queryKey: ["expenses"], queryFn: () => api.accounts.expenses.list() });
  const create = useMutation({
    mutationFn: (f: any) => api.accounts.expenses.create(f),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["expenses"] }); toast.success("Expense recorded"); setOpen(false); },
    onError: (e: any) => toast.error(e.message),
  });
  const update = useMutation({
    mutationFn: ({ id, ...f }: any) => api.accounts.expenses.update(id, f),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["expenses"] }); toast.success("Expense corrected"); setEditing(null); },
    onError: (e: any) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.accounts.expenses.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["expenses"] }); toast.success("Expense reversed"); },
    onError: (e: any) => toast.error(e.message),
  });
  return (
    <div className="space-y-3 mt-4">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" /> New expense</Button></DialogTrigger>
        <ExpenseForm onSubmit={(f: any) => create.mutate(f)} />
      </Dialog>
      <div className="rounded-lg border bg-card"><Table>
        <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Category</TableHead><TableHead>Payee</TableHead><TableHead>Description</TableHead><TableHead className="text-right">Amount</TableHead><TableHead></TableHead></TableRow></TableHeader>
        <TableBody>
          {data.length === 0 ? <TableRow><TableCell colSpan={6}><EmptyState /></TableCell></TableRow> : data.map((e) => (
            <TableRow key={e.id}>
              <TableCell>{e.spentOn}</TableCell>
              <TableCell>{e.category}</TableCell>
              <TableCell>{e.payee ?? "—"}</TableCell>
              <TableCell className="max-w-[280px] truncate">{e.description}</TableCell>
              <TableCell className="text-right">{money(e.amount)}</TableCell>
              <TableCell className="text-right whitespace-nowrap">
                {canReverse && (
                  <>
                    <Button size="sm" variant="ghost" onClick={() => setEditing(e)} title="Correct this expense"><Pencil className="h-4 w-4 mr-1" /> Correct</Button>
                    <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive"
                      onClick={() => { if (confirm(`Reverse this expense of ${money(e.amount)}? It will be removed.`)) remove.mutate(e.id); }}
                      title="Reverse — remove this expense">
                      <RotateCcw className="h-4 w-4 mr-1" /> Reverse
                    </Button>
                  </>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table></div>
      {editing && (
        <Dialog open onOpenChange={() => setEditing(null)}>
          <ExpenseForm initial={editing} onSubmit={(f: any) => update.mutate({ id: editing.id, ...f })} />
        </Dialog>
      )}
    </div>
  );
}

function ExpenseForm({ onSubmit, initial }: any) {
  const [f, setF] = useState({
    spentOn: initial?.spentOn ?? new Date().toISOString().slice(0, 10),
    category: initial?.category ?? "Supplies", payee: initial?.payee ?? "",
    description: initial?.description ?? "", amount: initial?.amount ?? 0,
    paymentMethod: initial?.paymentMethod ?? "CASH", refNo: initial?.refNo ?? "",
  });
  return (
    <DialogContent>
      <DialogHeader><DialogTitle>{initial ? "Correct expense" : "Record expense"}</DialogTitle></DialogHeader>
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
  const [filter, setFilter] = useState("ALL");
  const [classId, setClassId] = useState("");
  const [termId, setTermId] = useState("");
  const [academicYearId, setAcademicYearId] = useState("");
  const [pupilId, setPupilId] = useState("");

  const { data: classes = [] } = useQuery({ queryKey: ["classes-accounts"], queryFn: () => api.classes.list() });
  const { data: terms = [] } = useQuery({ queryKey: ["terms-accounts"], queryFn: () => api.academicYears.terms.all() });
  const { data: years = [] } = useQuery({ queryKey: ["years-accounts"], queryFn: () => api.academicYears.list() });
  const { data: pupils = [] } = useQuery({ queryKey: ["pupils-accounts"], queryFn: () => api.pupils.all() });
  // Every payment is accumulative to total income regardless of filter — filters here only
  // narrow what's *displayed*, they never change what counts toward the school's income.
  const { data = [] } = useQuery({
    queryKey: ["fee-payments", classId, termId, academicYearId, pupilId],
    queryFn: () => api.fees.payments.list({
      classId: classId || undefined,
      termId: termId || undefined,
      academicYearId: academicYearId || undefined,
      pupilId: pupilId || undefined,
    }),
  });
  // Canteen sales are their own point-of-sale entity, not a Payment against an invoice, so
  // they never showed up here before — pulled in and normalized alongside fee payments so
  // "Food" income is actually visible and counted. They have no term, so they're only shown
  // when no term/year filter narrows the view to something they can't answer.
  const { data: canteenSales = [] } = useQuery({ queryKey: ["canteen-sales-income"], queryFn: () => api.canteen.sales.list() });
  // Registration fees are collected at application stage, before there's necessarily a pupil
  // or class to attach to — counted the moment they're recorded, not deferred to enrollment.
  const { data: admissions = [] } = useQuery({ queryKey: ["admissions-income"], queryFn: () => api.admissions.list() });

  type IncomeRow = { id: string; paidOn: string; pupilName: string; classId?: string; className?: string; category: string; method: string; amount: number };
  const feeRows: IncomeRow[] = data.filter((p) => p.status === "CONFIRMED").map((p) => ({
    id: p.id, paidOn: p.paidOn, pupilName: p.pupil?.fullName ?? "—",
    classId: p.pupil?.schoolClass?.id, className: p.pupil?.schoolClass?.name,
    category: incomeCategory(p), method: p.method, amount: Number(p.amount),
  }));
  const canteenRows: IncomeRow[] = !termId && !academicYearId ? canteenSales
    .filter((s) => (!classId || s.pupil?.schoolClass?.id === classId) && (!pupilId || s.pupilId === pupilId || s.pupil?.id === pupilId))
    .map((s) => ({
      id: s.id, paidOn: s.servedOn, pupilName: s.pupil?.fullName ?? "Walk-in",
      classId: s.pupil?.schoolClass?.id, className: s.pupil?.schoolClass?.name,
      category: "FOOD", method: s.paymentMethod ?? "cash", amount: Number(s.total),
    })) : [];
  const admissionRows: IncomeRow[] = !termId && !academicYearId ? admissions
    .filter((a) => Number(a.regFeePaid ?? 0) > 0)
    .filter((a) => (!classId || a.pupil?.schoolClass?.id === classId) && (!pupilId || a.pupil?.id === pupilId))
    .map((a) => ({
      id: a.id, paidOn: a.regFeePaidOn ?? a.interviewDate ?? "—", pupilName: a.fullName + (a.pupil ? "" : " (applicant)"),
      classId: a.pupil?.schoolClass?.id, className: a.pupil?.schoolClass?.name ?? a.targetClass?.name,
      category: "REGISTRATION", method: a.regFeePaymentMethod ?? "cash", amount: Number(a.regFeePaid),
    })) : [];
  const confirmed = [...feeRows, ...canteenRows, ...admissionRows].sort((a, b) => b.paidOn.localeCompare(a.paidOn));
  const visible = filter === "ALL" ? confirmed : confirmed.filter((r) => r.category === filter);
  const total = visible.reduce((a, r) => a + r.amount, 0);

  const breakdown = INCOME_FILTERS.filter((f) => f.value !== "ALL").map((f) => ({
    ...f,
    total: confirmed.filter((r) => r.category === f.value).reduce((a, r) => a + r.amount, 0),
  })).filter((f) => f.total > 0);

  const filtersActive = classId || termId || academicYearId || pupilId;

  return (
    <div className="mt-4 space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <Label className="text-sm">Class</Label>
          <Select value={classId} onValueChange={setClassId}>
            <SelectTrigger className="w-44"><SelectValue placeholder="All classes" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="">All classes</SelectItem>
              {classes.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}{c.stream ? " " + c.stream : ""}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-sm">Term</Label>
          <Select value={termId} onValueChange={setTermId}>
            <SelectTrigger className="w-48"><SelectValue placeholder="All terms" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="">All terms</SelectItem>
              {terms.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}{t.academicYear ? ` — ${t.academicYear.name}` : ""}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-sm">Year</Label>
          <Select value={academicYearId} onValueChange={setAcademicYearId}>
            <SelectTrigger className="w-36"><SelectValue placeholder="All years" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="">All years</SelectItem>
              {years.map((y) => <SelectItem key={y.id} value={y.id}>{y.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-sm">Pupil</Label>
          <Select value={pupilId} onValueChange={setPupilId}>
            <SelectTrigger className="w-56"><SelectValue placeholder="All pupils" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="">All pupils</SelectItem>
              {pupils.map((p) => <SelectItem key={p.id} value={p.id}>{p.fullName} ({p.admissionNo})</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        {filtersActive && (
          <Button variant="ghost" size="sm" onClick={() => { setClassId(""); setTermId(""); setAcademicYearId(""); setPupilId(""); }}>Clear filters</Button>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {INCOME_FILTERS.map((f) => (
          <button key={f.value} onClick={() => setFilter(f.value)}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${filter === f.value ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`}>
            {f.label}
          </button>
        ))}
        <span className="ml-auto text-sm text-muted-foreground self-center">{visible.length} payment{visible.length !== 1 ? "s" : ""} · {money(total)}</span>
      </div>

      {breakdown.length > 0 && (
        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
          {breakdown.map((b) => (
            <span key={b.value} className="rounded-md border px-2.5 py-1">{b.label}: <span className="font-medium text-foreground">{money(b.total)}</span></span>
          ))}
        </div>
      )}

      <div className="rounded-lg border bg-card"><Table>
        <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Pupil</TableHead><TableHead>Class</TableHead><TableHead>Category</TableHead><TableHead>Method</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
        <TableBody>
          {visible.length === 0 ? <TableRow><TableCell colSpan={6}><EmptyState /></TableCell></TableRow> : visible.map((r) => (
            <TableRow key={r.id}>
              <TableCell>{r.paidOn}</TableCell>
              <TableCell>{r.pupilName}</TableCell>
              <TableCell>{r.className ?? "—"}</TableCell>
              <TableCell>{INCOME_FILTERS.find((f) => f.value === r.category)?.label ?? "Other"}</TableCell>
              <TableCell>{r.method}</TableCell>
              <TableCell className="text-right text-emerald-600">{money(r.amount)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table></div>
    </div>
  );
}
