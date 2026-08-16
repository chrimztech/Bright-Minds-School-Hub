import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api, type Payment } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Printer, Trash2, Receipt } from "lucide-react";
import { toast } from "sonner";
import { money } from "@/lib/format";
import { PrintOverlay, DocHeader, useSchool } from "@/components/PrintableDoc";

export const Route = createFileRoute("/_authenticated/fees")({
  head: () => ({ meta: [{ title: "Fees & payments" }] }),
  component: Fees,
});

function Fees() {
  const { data: pending = [] } = useQuery({ queryKey: ["payments-pending"], queryFn: () => api.fees.payments.pending() });
  return (
    <>
      <PageHeader title="Fees & payments" description="Manage invoices, record payments, track balances" />
      <div className="p-6">
        <Tabs defaultValue="invoices">
          <TabsList>
            <TabsTrigger value="invoices">Invoices</TabsTrigger>
            <TabsTrigger value="payments">Payments</TabsTrigger>
            <TabsTrigger value="pending">
              Pending confirmations{pending.length > 0 && <Badge className="ml-1.5" variant="secondary">{pending.length}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="items">Fee items</TabsTrigger>
          </TabsList>
          <TabsContent value="invoices"><InvoicesTab /></TabsContent>
          <TabsContent value="payments"><PaymentsTab /></TabsContent>
          <TabsContent value="pending"><PendingPaymentsTab /></TabsContent>
          <TabsContent value="items"><FeeItemsTab /></TabsContent>
        </Tabs>
      </div>
    </>
  );
}

function InvoicesTab() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [printId, setPrintId] = useState<string | null>(null);
  const [termFilter, setTermFilter] = useState("");
  const [gradeFilter, setGradeFilter] = useState("");
  const [classFilter, setClassFilter] = useState("");
  const [pupilFilter, setPupilFilter] = useState("");
  const { data: terms = [] } = useQuery({ queryKey: ["terms-all"], queryFn: () => api.academicYears.terms.all() });
  const { data: classes = [] } = useQuery({ queryKey: ["classes-fee-filter"], queryFn: () => api.classes.list() });
  const grades = Array.from(new Map(classes.map((c) => [c.name, c])).values());
  const classesInGrade = gradeFilter ? classes.filter((c) => c.name === gradeFilter) : classes;
  const { data = [] } = useQuery({
    queryKey: ["invoices", termFilter, gradeFilter, classFilter, pupilFilter],
    queryFn: () => api.fees.invoices.list({
      termId: termFilter || undefined,
      grade: gradeFilter || undefined,
      classId: classFilter || undefined,
      pupilId: pupilFilter || undefined,
    }),
  });
  const { data: pupils = [] } = useQuery({ queryKey: ["pupils-pick2"], queryFn: () => api.pupils.all() });
  const create = useMutation({
    mutationFn: (f: any) => api.fees.invoices.create({ pupilId: f.pupilId, description: f.description, total: f.total, dueDate: f.dueDate || undefined }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["invoices"] }); toast.success("Invoice created"); setOpen(false); },
    onError: (e: any) => toast.error(e.message),
  });
  const applyLateFees = useMutation({
    mutationFn: () => api.fees.invoices.applyLateFees(),
    onSuccess: (created) => {
      qc.invalidateQueries({ queryKey: ["invoices"] });
      toast.success(created.length === 0 ? "No overdue invoices needed a late fee" : `Charged K35 administrative fee on ${created.length} overdue invoice${created.length !== 1 ? "s" : ""}`);
    },
    onError: (e: any) => toast.error(e.message),
  });
  const [f, setF] = useState({ pupilId: "", description: "", total: 0, dueDate: "" });
  return (
    <div className="space-y-3 pt-4">
      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <Label className="text-sm">Term</Label>
          <Select value={termFilter} onValueChange={setTermFilter}>
            <SelectTrigger className="w-48"><SelectValue placeholder="All terms" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="">All terms</SelectItem>
              {terms.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name}{t.academicYear ? ` — ${t.academicYear.name}` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-sm">Grade</Label>
          <Select value={gradeFilter} onValueChange={(v) => { setGradeFilter(v); setClassFilter(""); }}>
            <SelectTrigger className="w-40"><SelectValue placeholder="All grades" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="">All grades</SelectItem>
              {grades.map((c) => <SelectItem key={c.name} value={c.name}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-sm">Class</Label>
          <Select value={classFilter} onValueChange={setClassFilter}>
            <SelectTrigger className="w-48"><SelectValue placeholder="All classes" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="">All classes</SelectItem>
              {classesInGrade.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}{c.stream ? " " + c.stream : ""}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-sm">Pupil</Label>
          <Select value={pupilFilter} onValueChange={setPupilFilter}>
            <SelectTrigger className="w-56"><SelectValue placeholder="All pupils" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="">All pupils</SelectItem>
              {pupils.map((p) => <SelectItem key={p.id} value={p.id}>{p.fullName} ({p.admissionNo})</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        {(termFilter || gradeFilter || classFilter || pupilFilter) && (
          <Button variant="ghost" size="sm" onClick={() => { setTermFilter(""); setGradeFilter(""); setClassFilter(""); setPupilFilter(""); }}>Clear filters</Button>
        )}
        <span className="ml-auto text-sm text-muted-foreground">{data.length} invoice{data.length !== 1 ? "s" : ""}</span>
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => applyLateFees.mutate()} disabled={applyLateFees.isPending} title="Charges a K35 administrative fee on invoices past their due date that haven't been fully paid">
          {applyLateFees.isPending ? "Checking…" : "Apply late fees"}
        </Button>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" />New invoice</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New invoice</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Pupil</Label>
                <Select value={f.pupilId} onValueChange={(v) => setF({ ...f, pupilId: v })}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>{pupils.map((p) => <SelectItem key={p.id} value={p.id}>{p.fullName} ({p.admissionNo})</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Description</Label><Input value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Amount</Label><Input type="number" value={f.total} onChange={(e) => setF({ ...f, total: Number(e.target.value) })} /></div>
                <div><Label>Due date</Label><Input type="date" value={f.dueDate} onChange={(e) => setF({ ...f, dueDate: e.target.value })} /></div>
              </div>
            </div>
            <DialogFooter><Button onClick={() => create.mutate(f)} disabled={!f.pupilId || !f.total}>Create</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader><TableRow><TableHead>Invoice</TableHead><TableHead>Pupil</TableHead><TableHead>Description</TableHead><TableHead>Total</TableHead><TableHead>Paid</TableHead><TableHead>Balance</TableHead><TableHead>Status</TableHead><TableHead></TableHead></TableRow></TableHeader>
          <TableBody>
            {data.length === 0 ? <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">No invoices.</TableCell></TableRow>
              : data.map((i) => (
                <TableRow key={i.id}>
                  <TableCell className="font-mono text-xs">{i.invoiceNo}</TableCell>
                  <TableCell>{i.pupil?.fullName}</TableCell>
                  <TableCell>{i.description ?? "—"}</TableCell>
                  <TableCell>{money(i.total)}</TableCell>
                  <TableCell>{money(i.paid)}</TableCell>
                  <TableCell>{money(Number(i.total) - Number(i.paid))}</TableCell>
                  <TableCell><Badge variant={i.status === "PAID" ? "default" : i.status === "PARTIAL" ? "secondary" : "destructive"}>{i.status}</Badge></TableCell>
                  <TableCell><Button size="icon" variant="ghost" onClick={() => setPrintId(i.id)}><Printer className="h-4 w-4" /></Button></TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </div>
      {printId && <InvoicePrint id={printId} onClose={() => setPrintId(null)} />}
    </div>
  );
}

function InvoicePrint({ id, onClose }: { id: string; onClose: () => void }) {
  const { data: school } = useSchool();
  const { data: inv } = useQuery({ queryKey: ["invoice-print", id], queryFn: () => api.fees.invoices.get(id) });
  const { data: payments = [] } = useQuery({ queryKey: ["invoice-pays", id], queryFn: () => api.fees.payments.list({ invoiceId: id }) });
  if (!inv) return null;
  const balance = Number(inv.total) - Number(inv.paid);
  return (
    <PrintOverlay onClose={onClose}>
      <div className="p-10 font-sans">
        <DocHeader school={{ ...school, logoUrl: school?.logoUrl ?? "/logo.png" }} title="Invoice" />
        <div className="grid grid-cols-2 gap-8 text-sm mb-8">
          <div>
            <p className="uppercase text-[10px] tracking-widest text-gray-500 mb-1">Billed to</p>
            <p className="font-semibold text-lg">{inv.pupil?.fullName}</p>
            <p className="text-gray-600">Adm #: {inv.pupil?.admissionNo}</p>
            <p className="text-gray-600">{inv.pupil?.schoolClass?.name ?? ""} {inv.pupil?.schoolClass?.stream ?? ""}</p>
          </div>
          <div className="text-right">
            <p><span className="text-gray-500">Invoice no:</span> <span className="font-mono">{inv.invoiceNo}</span></p>
            {inv.createdAt && <p><span className="text-gray-500">Issued:</span> {new Date(inv.createdAt).toLocaleDateString()}</p>}
            {inv.dueDate && <p><span className="text-gray-500">Due:</span> {inv.dueDate}</p>}
            <p className="mt-2 inline-block px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-wider"
               style={{ background: inv.status === "PAID" ? "#dcfce7" : inv.status === "PARTIAL" ? "#fef3c7" : "#fee2e2",
                        color: inv.status === "PAID" ? "#166534" : inv.status === "PARTIAL" ? "#92400e" : "#991b1b" }}>
              {inv.status}
            </p>
          </div>
        </div>
        <table className="w-full text-sm border-collapse mb-8">
          <thead><tr className="border-b-2 border-black text-left">
            <th className="py-2">Description</th>
            <th className="py-2 text-right">Amount</th>
          </tr></thead>
          <tbody>
            <tr className="border-b border-gray-200"><td className="py-3">{inv.description || "School fees"}</td><td className="py-3 text-right">{money(inv.total)}</td></tr>
          </tbody>
          <tfoot>
            <tr><td className="pt-4 text-right text-gray-500">Subtotal</td><td className="pt-4 text-right">{money(inv.total)}</td></tr>
            <tr><td className="text-right text-gray-500">Paid</td><td className="text-right">{money(inv.paid)}</td></tr>
            <tr className="text-lg font-bold"><td className="pt-2 text-right">Balance due</td><td className="pt-2 text-right">{money(balance)}</td></tr>
          </tfoot>
        </table>
        {payments.length > 0 && (
          <div className="mb-8">
            <p className="uppercase text-[10px] tracking-widest text-gray-500 mb-2">Payment history</p>
            <table className="w-full text-xs border-collapse">
              <thead><tr className="border-b border-gray-300 text-left text-gray-500"><th className="py-1">Date</th><th>Receipt</th><th>Method</th><th>Reference</th><th className="text-right">Amount</th></tr></thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p.id} className="border-b border-gray-100">
                    <td className="py-1">{p.paidOn}</td>
                    <td className="font-mono">{p.receiptNo}</td>
                    <td>{p.method}</td>
                    <td>{p.reference ?? "—"}</td>
                    <td className="text-right">{money(p.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="border-t border-gray-300 pt-6 text-xs text-gray-500 flex justify-between">
          <p>Thank you for partnering with us in your child's education.</p>
          <p>Generated {new Date().toLocaleString()}</p>
        </div>
      </div>
    </PrintOverlay>
  );
}

function PaymentsTab() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [receiptFor, setReceiptFor] = useState<Payment | null>(null);
  const [pupilFilter, setPupilFilter] = useState("");
  const [gradeFilter, setGradeFilter] = useState("");
  const [classFilter, setClassFilter] = useState("");
  const { data: allPupils = [] } = useQuery({ queryKey: ["pupils-pay-filter"], queryFn: () => api.pupils.all() });
  const { data: classes = [] } = useQuery({ queryKey: ["classes-fee-filter"], queryFn: () => api.classes.list() });
  const grades = Array.from(new Map(classes.map((c) => [c.name, c])).values());
  const classesInGrade = gradeFilter ? classes.filter((c) => c.name === gradeFilter) : classes;
  const { data = [] } = useQuery({
    queryKey: ["payments", pupilFilter, gradeFilter, classFilter],
    queryFn: () => api.fees.payments.list({
      pupilId: pupilFilter || undefined,
      grade: gradeFilter || undefined,
      classId: classFilter || undefined,
    }),
  });
  const { data: invoices = [] } = useQuery({ queryKey: ["invoices-open"], queryFn: () => api.fees.invoices.list() });
  const openInvoices = invoices.filter((i) => i.status !== "PAID" && i.status !== "CANCELLED");
  const create = useMutation({
    mutationFn: (f: any) => api.fees.payments.create({ invoiceId: f.invoiceId, amount: f.amount, method: f.method, reference: f.reference || undefined }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["payments"] }); qc.invalidateQueries({ queryKey: ["invoices"] }); toast.success("Payment recorded"); setOpen(false); },
    onError: (e: any) => toast.error(e.message),
  });
  const [f, setF] = useState({ invoiceId: "", amount: 0, method: "CASH", reference: "" });
  return (
    <div className="space-y-3 pt-4">
      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <Label className="text-sm">Grade</Label>
          <Select value={gradeFilter} onValueChange={(v) => { setGradeFilter(v); setClassFilter(""); }}>
            <SelectTrigger className="w-40"><SelectValue placeholder="All grades" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="">All grades</SelectItem>
              {grades.map((c) => <SelectItem key={c.name} value={c.name}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-sm">Class</Label>
          <Select value={classFilter} onValueChange={setClassFilter}>
            <SelectTrigger className="w-48"><SelectValue placeholder="All classes" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="">All classes</SelectItem>
              {classesInGrade.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}{c.stream ? " " + c.stream : ""}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-sm">Pupil</Label>
          <Select value={pupilFilter} onValueChange={setPupilFilter}>
            <SelectTrigger className="w-64"><SelectValue placeholder="All pupils" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="">All pupils</SelectItem>
              {allPupils.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.fullName} ({p.admissionNo})</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {(pupilFilter || gradeFilter || classFilter) && (
          <Button variant="ghost" size="sm" onClick={() => { setPupilFilter(""); setGradeFilter(""); setClassFilter(""); }}>Clear filters</Button>
        )}
        <span className="ml-auto text-sm text-muted-foreground">{data.length} payment{data.length !== 1 ? "s" : ""}</span>
      </div>
      <div className="flex justify-end">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" />Record payment</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New payment</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Invoice</Label>
                <Select value={f.invoiceId} onValueChange={(v) => setF({ ...f, invoiceId: v })}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>{openInvoices.map((i) => <SelectItem key={i.id} value={i.id}>{i.invoiceNo} — {i.pupil?.fullName} ({money(Number(i.total) - Number(i.paid))} due)</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Amount</Label><Input type="number" value={f.amount} onChange={(e) => setF({ ...f, amount: Number(e.target.value) })} /></div>
                <div><Label>Method</Label>
                  <Select value={f.method} onValueChange={(v) => setF({ ...f, method: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{["CASH","BANK","MOBILE_MONEY","CARD","CHEQUE","ONLINE"].map((m) => <SelectItem key={m} value={m}>{m.replace("_", " ")}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div><Label>Reference</Label><Input value={f.reference} onChange={(e) => setF({ ...f, reference: e.target.value })} /></div>
            </div>
            <DialogFooter><Button onClick={() => create.mutate(f)} disabled={!f.invoiceId || !f.amount}>Save</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader><TableRow><TableHead>Receipt</TableHead><TableHead>Date</TableHead><TableHead>Pupil</TableHead><TableHead>Invoice</TableHead><TableHead>Method</TableHead><TableHead>Amount</TableHead><TableHead>Status</TableHead><TableHead></TableHead></TableRow></TableHeader>
          <TableBody>
            {data.length === 0 ? <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">No payments yet.</TableCell></TableRow>
              : data.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-mono text-xs">{p.receiptNo}</TableCell>
                  <TableCell>{p.paidOn}</TableCell>
                  <TableCell>{p.pupil?.fullName}</TableCell>
                  <TableCell className="font-mono text-xs">{p.invoice?.invoiceNo ?? "—"}</TableCell>
                  <TableCell>{p.method}</TableCell>
                  <TableCell className="font-semibold">{money(p.amount)}</TableCell>
                  <TableCell>
                    <Badge variant={p.status === "CONFIRMED" ? "default" : p.status === "REJECTED" ? "destructive" : "secondary"}>{p.status}</Badge>
                  </TableCell>
                  <TableCell><Button size="icon" variant="ghost" onClick={() => setReceiptFor(p)}><Printer className="h-4 w-4" /></Button></TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </div>
      {receiptFor && <ReceiptPrint payment={receiptFor} onClose={() => setReceiptFor(null)} />}
    </div>
  );
}

function PendingPaymentsTab() {
  const qc = useQueryClient();
  const { data = [], isLoading } = useQuery({ queryKey: ["payments-pending"], queryFn: () => api.fees.payments.pending() });
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["payments-pending"] });
    qc.invalidateQueries({ queryKey: ["payments"] });
    qc.invalidateQueries({ queryKey: ["invoices"] });
  };
  const confirm = useMutation({
    mutationFn: (id: string) => api.fees.payments.confirm(id),
    onSuccess: () => { invalidate(); toast.success("Payment confirmed and applied to invoice"); },
    onError: (e: any) => toast.error(e.message),
  });
  const reject = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) => api.fees.payments.reject(id, reason),
    onSuccess: () => { invalidate(); toast.success("Payment rejected"); },
    onError: (e: any) => toast.error(e.message),
  });
  return (
    <div className="space-y-3 pt-4">
      <p className="text-sm text-muted-foreground">Payments parents have submitted from the portal, awaiting confirmation. Confirming applies the amount to the invoice; rejecting discards it.</p>
      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader><TableRow><TableHead>Submitted</TableHead><TableHead>Pupil</TableHead><TableHead>Guardian</TableHead><TableHead>Invoice</TableHead><TableHead>Method</TableHead><TableHead>Reference</TableHead><TableHead className="text-right">Amount</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
          <TableBody>
            {!isLoading && data.length === 0 ? (
              <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">No pending payment submissions.</TableCell></TableRow>
            ) : (
              data.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>{p.paidOn}</TableCell>
                  <TableCell className="font-medium">{p.pupil?.fullName}</TableCell>
                  <TableCell>{p.submittedBy?.fullName ?? "—"}</TableCell>
                  <TableCell className="font-mono text-xs">{p.invoice?.invoiceNo ?? "—"}</TableCell>
                  <TableCell>{p.method.replace("_", " ")}</TableCell>
                  <TableCell>{p.reference ?? "—"}</TableCell>
                  <TableCell className="text-right font-semibold">{money(p.amount)}</TableCell>
                  <TableCell className="text-right">
                    <Button size="sm" onClick={() => confirm.mutate(p.id)} disabled={confirm.isPending || reject.isPending}>Confirm</Button>
                    <Button size="sm" variant="ghost" className="text-destructive"
                      onClick={() => { const reason = prompt("Reason for rejecting (optional):") ?? undefined; reject.mutate({ id: p.id, reason }); }}
                      disabled={confirm.isPending || reject.isPending}>
                      Reject
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function ReceiptPrint({ payment, onClose }: { payment: Payment; onClose: () => void }) {
  const { data: school } = useSchool();
  const inv = payment.invoice;
  const balance = inv ? Number(inv.total) - Number(inv.paid) : null;
  return (
    <PrintOverlay onClose={onClose}>
      <div className="p-10 font-sans">
        <DocHeader school={{ ...school, logoUrl: school?.logoUrl ?? "/logo.png" }} title="Receipt" />
        <div className="grid grid-cols-2 gap-8 text-sm mb-8">
          <div>
            <p className="uppercase text-[10px] tracking-widest text-gray-500 mb-1">Received from</p>
            <p className="font-semibold text-lg">{payment.pupil?.fullName}</p>
            <p className="text-gray-600">Adm #: {payment.pupil?.admissionNo}</p>
          </div>
          <div className="text-right">
            <p><span className="text-gray-500">Receipt no:</span> <span className="font-mono">{payment.receiptNo}</span></p>
            <p><span className="text-gray-500">Date:</span> {payment.paidOn}</p>
            <p><span className="text-gray-500">Method:</span> {payment.method.replace("_", " ")}</p>
            {payment.reference && <p><span className="text-gray-500">Reference:</span> {payment.reference}</p>}
          </div>
        </div>
        <table className="w-full text-sm border-collapse mb-8">
          <thead><tr className="border-b-2 border-black text-left">
            <th className="py-2">Description</th>
            <th className="py-2 text-right">Amount</th>
          </tr></thead>
          <tbody>
            <tr className="border-b border-gray-200">
              <td className="py-3">{inv ? `Payment towards invoice ${inv.invoiceNo}${inv.description ? " — " + inv.description : ""}` : "School fee payment"}</td>
              <td className="py-3 text-right">{money(payment.amount)}</td>
            </tr>
          </tbody>
          {inv && (
            <tfoot>
              <tr><td className="pt-4 text-right text-gray-500">Invoice total</td><td className="pt-4 text-right">{money(inv.total)}</td></tr>
              <tr><td className="text-right text-gray-500">Total paid to date</td><td className="text-right">{money(inv.paid)}</td></tr>
              <tr className="text-lg font-bold"><td className="pt-2 text-right">Balance remaining</td><td className="pt-2 text-right">{money(balance ?? 0)}</td></tr>
            </tfoot>
          )}
        </table>
        <div className="border-t border-gray-300 pt-6 text-xs text-gray-500 flex justify-between">
          <p>Thank you for partnering with us in your child's education.</p>
          <p>Generated {new Date().toLocaleString()}</p>
        </div>
      </div>
    </PrintOverlay>
  );
}

const FEE_CATEGORIES = [
  { value: "SCHOOL_FEE", label: "School Fee" },
  { value: "TRANSPORT", label: "Transport" },
  { value: "FOOD", label: "Food / Canteen" },
  { value: "UNIFORM", label: "Uniform" },
  { value: "EXAM", label: "Examination" },
  { value: "ACTIVITY", label: "Activity / Trips" },
  { value: "OTHER", label: "Other" },
];

function categoryLabel(cat: string) {
  return FEE_CATEGORIES.find((c) => c.value === cat)?.label ?? cat;
}

function FeeItemsTab() {
  const qc = useQueryClient();
  const [f, setF] = useState<any>({ name: "", category: "SCHOOL_FEE", amount: 0, classId: "", termId: "", isRecurring: true });
  const [billOpen, setBillOpen] = useState(false);
  const [filterCat, setFilterCat] = useState("ALL");
  const { data = [] } = useQuery({ queryKey: ["fee_items"], queryFn: () => api.fees.items.list() });
  const { data: classes = [] } = useQuery({ queryKey: ["classes-pick"], queryFn: () => api.classes.list() });
  const { data: terms = [] } = useQuery({ queryKey: ["terms-pick"], queryFn: () => api.academicYears.terms.all() });
  const create = useMutation({
    mutationFn: () => api.fees.items.create({ name: f.name, category: f.category, amount: f.amount, classId: f.classId || undefined, termId: f.termId || undefined, isRecurring: f.isRecurring }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["fee_items"] }); toast.success("Fee item added"); setF({ name: "", category: "SCHOOL_FEE", amount: 0, classId: "", termId: "", isRecurring: true }); },
    onError: (e: any) => toast.error(e.message),
  });
  const update = useMutation({
    mutationFn: ({ id, amount }: any) => api.fees.items.update(id, { amount }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["fee_items"] }); toast.success("Amount updated"); },
    onError: (e: any) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.fees.items.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["fee_items"] }); toast.success("Removed"); },
    onError: (e: any) => toast.error(e.message),
  });

  const visible = filterCat === "ALL" ? data : data.filter((i) => i.category === filterCat);

  return (
    <div className="space-y-4 pt-4">
      <div className="rounded-lg border bg-card p-4 space-y-3">
        <p className="font-medium text-sm">Add a fee item</p>
        <div className="grid grid-cols-2 lg:grid-cols-7 gap-2 items-end">
          <div className="lg:col-span-2"><Label>Name</Label><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="e.g. Tuition, Transport fee…" /></div>
          <div><Label>Category</Label>
            <Select value={f.category} onValueChange={(v) => setF({ ...f, category: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{FEE_CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Amount</Label><Input type="number" value={f.amount} onChange={(e) => setF({ ...f, amount: Number(e.target.value) })} /></div>
          <div><Label>Class</Label>
            <Select value={f.classId} onValueChange={(v) => setF({ ...f, classId: v })}>
              <SelectTrigger><SelectValue placeholder="All classes" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="">All classes</SelectItem>
                {classes.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}{c.stream ? " " + c.stream : ""}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div><Label>Term</Label>
            <Select value={f.termId} onValueChange={(v) => setF({ ...f, termId: v })}>
              <SelectTrigger><SelectValue placeholder="All terms" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="">All terms</SelectItem>
                {terms.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}{t.academicYear ? ` (${t.academicYear.name})` : ""}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={() => create.mutate()} disabled={!f.name || !f.amount}><Plus className="h-4 w-4 mr-1" /> Add</Button>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex gap-2 flex-wrap">
          {[{ value: "ALL", label: "All" }, ...FEE_CATEGORIES].map((c) => (
            <button key={c.value} onClick={() => setFilterCat(c.value)}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${filterCat === c.value ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`}>
              {c.label}
            </button>
          ))}
        </div>
        <Button variant="default" onClick={() => setBillOpen(true)}><Receipt className="h-4 w-4 mr-1" /> Bill a class</Button>
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Category</TableHead><TableHead>Class</TableHead><TableHead>Term</TableHead><TableHead>Amount</TableHead><TableHead></TableHead></TableRow></TableHeader>
          <TableBody>
            {visible.length === 0 ? <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No fee items.</TableCell></TableRow>
              : visible.map((i) => (
                <TableRow key={i.id}>
                  <TableCell className="font-medium">{i.name}</TableCell>
                  <TableCell><Badge variant="outline">{categoryLabel(i.category ?? "OTHER")}</Badge></TableCell>
                  <TableCell>{i.schoolClass ? `${i.schoolClass.name}${i.schoolClass.stream ? " " + i.schoolClass.stream : ""}` : "All"}</TableCell>
                  <TableCell>{i.term?.name ?? "—"}</TableCell>
                  <TableCell>
                    <Input type="number" defaultValue={i.amount} className="h-8 w-28"
                      onBlur={(e) => { const v = Number(e.target.value); if (v !== Number(i.amount)) update.mutate({ id: i.id, amount: v }); }} />
                  </TableCell>
                  <TableCell className="text-right">
                    <Button size="icon" variant="ghost" onClick={() => { if (confirm("Delete this fee item?")) remove.mutate(i.id); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </div>
      {billOpen && <BillClassDialog onClose={() => { setBillOpen(false); qc.invalidateQueries({ queryKey: ["invoices"] }); }} feeItems={data} classes={classes} terms={terms} />}
    </div>
  );
}

function BillClassDialog({ onClose, feeItems, classes, terms }: any) {
  const [mode, setMode] = useState<"class" | "pupils">("class");
  const [classId, setClassId] = useState("");
  const [termId, setTermId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [selected, setSelected] = useState<Record<string, number>>({});
  const [pupilSearch, setPupilSearch] = useState("");
  const [pupilIds, setPupilIds] = useState<Set<string>>(new Set());

  const { data: classPupils = [] } = useQuery({
    queryKey: ["bill-pupils", classId],
    enabled: mode === "class" && !!classId,
    queryFn: () => api.pupils.byClass(classId),
  });
  const { data: allPupils = [] } = useQuery({ queryKey: ["pupils-pick2"], queryFn: () => api.pupils.all() });

  const pupils = mode === "class" ? classPupils : allPupils.filter((p) => pupilIds.has(p.id));
  const eligible = mode === "class" ? feeItems.filter((i: any) => !i.classId || i.classId === classId) : feeItems;
  const total = Object.values(selected).reduce((s, v) => s + Number(v || 0), 0);
  const selectedItemIds = Object.keys(selected);
  const [busy, setBusy] = useState(false);

  const filteredPupils = allPupils.filter((p) => {
    const s = pupilSearch.toLowerCase().trim();
    return !s || p.fullName.toLowerCase().includes(s) || p.admissionNo.toLowerCase().includes(s);
  });

  async function bill() {
    if (!pupils.length || total <= 0) return;
    setBusy(true);
    try {
      const desc = eligible.filter((i: any) => selected[i.id]).map((i: any) => `${i.name}: ${money(selected[i.id])}`).join(" • ");
      // Tag the invoice with the fee item when exactly one is selected, so it carries a
      // clear category (Transport/Food/Uniform/…) for filtering — a combined multi-item
      // bill has no single category and is left untagged (defaults to "School fees").
      const feeItemId = selectedItemIds.length === 1 ? selectedItemIds[0] : undefined;
      const rows = pupils.map((p) => ({
        pupilId: p.id,
        termId: termId || undefined,
        feeItemId,
        description: desc || "School fees",
        total,
        dueDate: dueDate || undefined,
      }));
      await api.fees.invoices.bulkCreate(rows);
      toast.success(`Created ${rows.length} invoices`);
      onClose();
    } catch (e: any) { toast.error(e.message); } finally { setBusy(false); }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Bill pupils</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="flex gap-2">
            <button type="button" onClick={() => setMode("class")}
              className={`px-3 py-1.5 rounded-md text-sm font-medium border transition-colors ${mode === "class" ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`}>
              By class
            </button>
            <button type="button" onClick={() => setMode("pupils")}
              className={`px-3 py-1.5 rounded-md text-sm font-medium border transition-colors ${mode === "pupils" ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"}`}>
              By individual pupil(s)
            </button>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {mode === "class" ? (
              <div><Label>Class</Label>
                <Select value={classId} onValueChange={setClassId}>
                  <SelectTrigger><SelectValue placeholder="Select class" /></SelectTrigger>
                  <SelectContent>{classes.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}{c.stream ? " " + c.stream : ""}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            ) : (
              <div className="col-span-1"><Label>Pupils selected</Label>
                <div className="h-9 flex items-center px-3 rounded-md border bg-muted text-sm font-medium">{pupilIds.size}</div>
              </div>
            )}
            <div><Label>Term</Label>
              <Select value={termId} onValueChange={setTermId}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>{terms.map((t: any) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Due date</Label><Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></div>
          </div>

          {mode === "pupils" && (
            <div>
              <Input placeholder="Search name or admission no…" value={pupilSearch} onChange={(e) => setPupilSearch(e.target.value)} className="mb-1.5" />
              <div className="rounded border max-h-40 overflow-auto">
                <Table>
                  <TableBody>
                    {filteredPupils.slice(0, 50).map((p) => (
                      <TableRow key={p.id} className="cursor-pointer" onClick={() => setPupilIds((s) => {
                        const n = new Set(s); if (n.has(p.id)) n.delete(p.id); else n.add(p.id); return n;
                      })}>
                        <TableCell className="w-8 py-1.5"><input type="checkbox" checked={pupilIds.has(p.id)} readOnly /></TableCell>
                        <TableCell className="py-1.5 font-medium">{p.fullName}</TableCell>
                        <TableCell className="py-1.5 text-xs text-muted-foreground">{p.admissionNo}</TableCell>
                        <TableCell className="py-1.5 text-xs text-muted-foreground">{p.schoolClass ? `${p.schoolClass.name}${p.schoolClass.stream ? " " + p.schoolClass.stream : ""}` : "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          {(mode === "class" ? !!classId : pupilIds.size > 0) && (
            <div className="rounded border max-h-72 overflow-auto">
              <Table>
                <TableHeader><TableRow><TableHead className="w-10"></TableHead><TableHead>Fee item</TableHead><TableHead className="w-40">Amount (editable)</TableHead></TableRow></TableHeader>
                <TableBody>
                  {eligible.length === 0 ? <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-4">No fee items defined.</TableCell></TableRow>
                    : eligible.map((i: any) => (
                      <TableRow key={i.id}>
                        <TableCell><input type="checkbox" checked={i.id in selected} onChange={(e) => {
                          setSelected((s) => { const n = { ...s }; if (e.target.checked) n[i.id] = Number(i.amount); else delete n[i.id]; return n; });
                        }} /></TableCell>
                        <TableCell>{i.name} <span className="text-xs text-muted-foreground">({i.category})</span></TableCell>
                        <TableCell>
                          <Input type="number" disabled={!(i.id in selected)} value={selected[i.id] ?? i.amount}
                            onChange={(e) => setSelected((s) => ({ ...s, [i.id]: Number(e.target.value) }))} className="h-8" />
                        </TableCell>
                      </TableRow>
                    ))}
                </TableBody>
              </Table>
            </div>
          )}
          <div className="flex justify-between text-sm border-t pt-3">
            <span className="text-muted-foreground">Pupils to bill: <span className="font-semibold text-foreground">{pupils.length}</span></span>
            <span className="font-semibold">Each invoice total: {money(total)}</span>
          </div>
        </div>
        <DialogFooter><Button onClick={bill} disabled={total <= 0 || pupils.length === 0 || busy}>{busy ? "Creating…" : `Create ${pupils.length} invoices`}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
