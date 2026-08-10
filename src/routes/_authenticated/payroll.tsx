import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Printer } from "lucide-react";
import { toast } from "sonner";
import { money } from "@/lib/format";
import { EmptyState } from "@/components/EmptyState";
import { PrintOverlay, DocHeader, useSchool } from "@/components/PrintableDoc";

export const Route = createFileRoute("/_authenticated/payroll")({
  head: () => ({ meta: [{ title: "Payroll" }] }),
  component: PayrollPage,
});

function PayrollPage() {
  const qc = useQueryClient();
  const [periodId, setPeriodId] = useState<string>("");
  const [openP, setOpenP] = useState(false);
  const [openS, setOpenS] = useState(false);
  const [printSlip, setPrintSlip] = useState<any | null>(null);

  const { data: periods = [] } = useQuery({
    queryKey: ["periods"],
    queryFn: () => api.payroll.periods.list(),
  });

  useEffect(() => {
    if (periods.length && !periodId) setPeriodId(periods[0].id);
  }, [periods]);
  const { data: staff = [] } = useQuery({ queryKey: ["staff-min"], queryFn: () => api.staff.all() });
  const { data: slips = [] } = useQuery({
    queryKey: ["payslips", periodId],
    enabled: !!periodId,
    queryFn: () => api.payroll.payslips.list(periodId),
  });

  const newPeriod = useMutation({
    mutationFn: (f: any) => api.payroll.periods.create(f),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["periods"] }); toast.success("Period added"); setOpenP(false); },
    onError: (e: any) => toast.error(e.message),
  });
  const addSlip = useMutation({
    mutationFn: (f: any) => api.payroll.payslips.create({ ...f, periodId }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["payslips"] }); toast.success("Payslip added"); setOpenS(false); },
    onError: (e: any) => toast.error(e.message),
  });
  const approvePeriod = useMutation({
    mutationFn: () => api.payroll.periods.approve(periodId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["periods"] }),
  });
  const markPaid = useMutation({
    mutationFn: () => api.payroll.periods.markPaid(periodId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["periods"] }),
  });

  const totalNet = slips.reduce((a, s) => a + Number(s.netPay), 0);
  const period = periods.find((p) => p.id === periodId);

  return (
    <>
      <PageHeader title="Payroll" description="Staff salaries, allowances and payslips"
        actions={
          <Dialog open={openP} onOpenChange={setOpenP}>
            <DialogTrigger asChild><Button variant="outline"><Plus className="h-4 w-4 mr-1" /> New period</Button></DialogTrigger>
            <PeriodForm onSubmit={(f: any) => newPeriod.mutate(f)} />
          </Dialog>
        } />
      <div className="p-6 space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <Label>Period</Label>
            <Select value={periodId} onValueChange={setPeriodId}>
              <SelectTrigger className="w-56"><SelectValue placeholder="Select period" /></SelectTrigger>
              <SelectContent>{periods.map((p) => <SelectItem key={p.id} value={p.id}>{p.periodLabel}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          {period && <Badge variant={period.status === "PAID" ? "default" : "secondary"}>{period.status.toLowerCase()}</Badge>}
          <div className="ml-auto flex gap-2">
            <Dialog open={openS} onOpenChange={setOpenS}>
              <DialogTrigger asChild><Button disabled={!periodId}><Plus className="h-4 w-4 mr-1" /> Add payslip</Button></DialogTrigger>
              <SlipForm staff={staff} onSubmit={(f: any) => addSlip.mutate(f)} />
            </Dialog>
            {period?.status === "DRAFT" && <Button variant="secondary" onClick={() => approvePeriod.mutate()}>Approve</Button>}
            {period?.status === "APPROVED" && <Button onClick={() => markPaid.mutate()}>Mark paid</Button>}
          </div>
        </div>
        <div className="rounded-lg border bg-card"><Table>
          <TableHeader><TableRow><TableHead>Staff</TableHead><TableHead className="text-right">Basic</TableHead><TableHead className="text-right">Allowances</TableHead><TableHead className="text-right">Deductions</TableHead><TableHead className="text-right">Tax</TableHead><TableHead className="text-right">Net</TableHead><TableHead></TableHead></TableRow></TableHeader>
          <TableBody>
            {slips.length === 0 ? <TableRow><TableCell colSpan={7}><EmptyState message="No payslips for this period." /></TableCell></TableRow> : slips.map((s) => (
              <TableRow key={s.id}>
                <TableCell>{s.staff?.fullName}</TableCell>
                <TableCell className="text-right">{money(s.basic)}</TableCell>
                <TableCell className="text-right">{money(s.allowances)}</TableCell>
                <TableCell className="text-right">{money(s.deductions)}</TableCell>
                <TableCell className="text-right">{money(s.tax)}</TableCell>
                <TableCell className="text-right font-semibold">{money(s.netPay)}</TableCell>
                <TableCell><Button size="icon" variant="ghost" onClick={() => setPrintSlip({ ...s, period })}><Printer className="h-4 w-4" /></Button></TableCell>
              </TableRow>
            ))}
            {slips.length > 0 && <TableRow><TableCell colSpan={5} className="text-right font-semibold">Total net</TableCell><TableCell className="text-right font-bold">{money(totalNet)}</TableCell><TableCell /></TableRow>}
          </TableBody>
        </Table></div>
      </div>
      {printSlip && <PayslipPrint slip={printSlip} onClose={() => setPrintSlip(null)} />}
    </>
  );
}

function PayslipPrint({ slip, onClose }: { slip: any; onClose: () => void }) {
  const { data: school } = useSchool();
  const gross = Number(slip.basic) + Number(slip.allowances);
  return (
    <PrintOverlay onClose={onClose}>
      <div className="p-10 font-sans">
        <DocHeader school={school} title="Payslip" />
        <div className="grid grid-cols-2 gap-8 text-sm mb-8">
          <div>
            <p className="uppercase text-[10px] tracking-widest text-gray-500 mb-1">Employee</p>
            <p className="font-semibold text-lg">{slip.staff?.fullName}</p>
          </div>
          <div className="text-right">
            <p><span className="text-gray-500">Period:</span> {slip.period?.periodLabel}</p>
            <p><span className="text-gray-500">From:</span> {slip.period?.periodStart}</p>
            <p><span className="text-gray-500">To:</span> {slip.period?.periodEnd}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-6 mb-8">
          <div>
            <p className="uppercase text-[10px] tracking-widest text-gray-500 mb-2">Earnings</p>
            <table className="w-full text-sm">
              <tbody>
                <tr className="border-b border-gray-200"><td className="py-2">Basic salary</td><td className="py-2 text-right">{money(slip.basic)}</td></tr>
                <tr className="border-b border-gray-200"><td className="py-2">Allowances</td><td className="py-2 text-right">{money(slip.allowances)}</td></tr>
                <tr className="font-semibold"><td className="py-2">Gross</td><td className="py-2 text-right">{money(gross)}</td></tr>
              </tbody>
            </table>
          </div>
          <div>
            <p className="uppercase text-[10px] tracking-widest text-gray-500 mb-2">Deductions</p>
            <table className="w-full text-sm">
              <tbody>
                <tr className="border-b border-gray-200"><td className="py-2">Tax (PAYE)</td><td className="py-2 text-right">{money(slip.tax)}</td></tr>
                <tr className="border-b border-gray-200"><td className="py-2">Other</td><td className="py-2 text-right">{money(slip.deductions)}</td></tr>
                <tr className="font-semibold"><td className="py-2">Total</td><td className="py-2 text-right">{money(Number(slip.tax) + Number(slip.deductions))}</td></tr>
              </tbody>
            </table>
          </div>
        </div>
        <div className="border-t-2 border-black pt-4 flex justify-between items-end">
          <div>
            <p className="uppercase text-[10px] tracking-widest text-gray-500">Net pay</p>
            <p className="font-display text-4xl">{money(slip.netPay)}</p>
          </div>
          <div className="text-xs text-gray-500 text-right">
            <p>Computer-generated payslip.</p>
            <p>Generated {new Date().toLocaleString()}</p>
          </div>
        </div>
      </div>
    </PrintOverlay>
  );
}

function PeriodForm({ onSubmit }: any) {
  const [f, setF] = useState({ periodLabel: "", periodStart: "", periodEnd: "" });
  return (
    <DialogContent><DialogHeader><DialogTitle>New payroll period</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div><Label>Label</Label><Input placeholder="e.g. Jun 2026" value={f.periodLabel} onChange={(e) => setF({ ...f, periodLabel: e.target.value })} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Start</Label><Input type="date" value={f.periodStart} onChange={(e) => setF({ ...f, periodStart: e.target.value })} /></div>
          <div><Label>End</Label><Input type="date" value={f.periodEnd} onChange={(e) => setF({ ...f, periodEnd: e.target.value })} /></div>
        </div>
      </div>
      <DialogFooter><Button onClick={() => onSubmit(f)} disabled={!f.periodLabel || !f.periodStart || !f.periodEnd}>Save</Button></DialogFooter>
    </DialogContent>
  );
}

function SlipForm({ staff, onSubmit }: any) {
  const [f, setF] = useState({ staffId: "", basic: 0, allowances: 0, deductions: 0, tax: 0 });
  return (
    <DialogContent><DialogHeader><DialogTitle>Add payslip</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div><Label>Staff</Label>
          <Select value={f.staffId} onValueChange={(v) => {
            const s = staff.find((x: any) => x.id === v);
            setF({ ...f, staffId: v, basic: Number(s?.basicSalary ?? 0) });
          }}>
            <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
            <SelectContent>{staff.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.fullName}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Basic</Label><Input type="number" value={f.basic} onChange={(e) => setF({ ...f, basic: Number(e.target.value) })} /></div>
          <div><Label>Allowances</Label><Input type="number" value={f.allowances} onChange={(e) => setF({ ...f, allowances: Number(e.target.value) })} /></div>
          <div><Label>Deductions</Label><Input type="number" value={f.deductions} onChange={(e) => setF({ ...f, deductions: Number(e.target.value) })} /></div>
          <div><Label>Tax</Label><Input type="number" value={f.tax} onChange={(e) => setF({ ...f, tax: Number(e.target.value) })} /></div>
        </div>
        <p className="text-sm text-muted-foreground">Net: {money(Number(f.basic) + Number(f.allowances) - Number(f.deductions) - Number(f.tax))}</p>
      </div>
      <DialogFooter><Button onClick={() => onSubmit(f)} disabled={!f.staffId}>Save</Button></DialogFooter>
    </DialogContent>
  );
}
