import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Wallet } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/EmptyState";
import { money } from "@/lib/format";
import { useAuth, hasPermission } from "@/lib/auth";
import { usePagination } from "@/hooks/use-pagination";
import { PaginationBar } from "@/components/PaginationBar";

export const Route = createFileRoute("/_authenticated/admissions")({
  head: () => ({ meta: [{ title: "Admissions" }] }),
  component: AdmissionsPage,
});

const STATUSES = ["APPLIED", "REVIEWING", "INTERVIEWED", "ADMITTED", "REJECTED", "WAITLISTED", "ENROLLED"];

function AdmissionsPage() {
  const qc = useQueryClient();
  const { permissions } = useAuth();
  const canManage = hasPermission(permissions, "admissions:manage");
  const [open, setOpen] = useState(false);
  const [feeFor, setFeeFor] = useState<any | null>(null);
  // Only feeds the New-application dialog, which never renders without admissions:manage.
  const { data: classes = [] } = useQuery({ queryKey: ["classes-min"], enabled: canManage, queryFn: () => api.classes.list() });
  const { data = [] } = useQuery({ queryKey: ["admissions"], queryFn: () => api.admissions.list() });
  const { pageItems: pagedAdmissions, page, setPage, totalPages, pageSize, total } = usePagination(data, 25);
  const create = useMutation({
    mutationFn: (f: any) => api.admissions.create(f),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admissions"] }); toast.success("Application saved"); setOpen(false); },
    onError: (e: any) => toast.error(e.message),
  });
  const setStatus = useMutation({
    mutationFn: ({ id, status }: any) => api.admissions.updateStatus(id, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admissions"] }),
    onError: (e: any) => toast.error(e.message),
  });
  // Actually creates a Pupil record (previously this just flipped a status label with no
  // real pupil ever created, so admissions never showed up anywhere else in the system).
  const enrol = useMutation({
    mutationFn: (id: string) => api.admissions.enroll(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admissions"] }); qc.invalidateQueries({ queryKey: ["pupils-all"] }); toast.success("Pupil enrolled"); },
    onError: (e: any) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.admissions.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admissions"] }); toast.success("Deleted"); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <>
      <PageHeader title="Admissions" description="Track applicants and convert to pupils"
        actions={
          canManage ? (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" /> New application</Button></DialogTrigger>
              <ApplicationForm classes={classes} onSubmit={(f: any) => create.mutate(f)} />
            </Dialog>
          ) : undefined
        } />
      <div className="p-6">
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Ref</TableHead><TableHead>Name</TableHead><TableHead>Target class</TableHead>
              <TableHead>Parent</TableHead><TableHead>Reg. fee</TableHead><TableHead>Status</TableHead><TableHead></TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {data.length === 0 ? <TableRow><TableCell colSpan={7}><EmptyState /></TableCell></TableRow>
                : pagedAdmissions.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-mono text-xs">{a.applicationNo}</TableCell>
                    <TableCell className="font-medium">{a.fullName}</TableCell>
                    <TableCell>{a.targetClass ? `${a.targetClass.name}${a.targetClass.stream ? " " + a.targetClass.stream : ""}` : "—"}</TableCell>
                    <TableCell>{a.parentName ?? "—"}<div className="text-xs text-muted-foreground">{a.parentPhone ?? ""}</div></TableCell>
                    <TableCell>
                      {a.regFeePaid ? (
                        <span className="text-emerald-600 font-medium text-sm">{money(a.regFeePaid)}</span>
                      ) : canManage ? (
                        <Button size="sm" variant="outline" onClick={() => setFeeFor(a)}><Wallet className="h-3.5 w-3.5 mr-1" /> Record fee</Button>
                      ) : "—"}
                    </TableCell>
                    <TableCell>
                      {canManage ? (
                        <Select value={a.status} onValueChange={(v) => setStatus.mutate({ id: a.id, status: v })}>
                          <SelectTrigger className="h-8 w-36"><SelectValue /></SelectTrigger>
                          <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{s.toLowerCase()}</SelectItem>)}</SelectContent>
                        </Select>
                      ) : <Badge variant="secondary">{a.status.toLowerCase()}</Badge>}
                    </TableCell>
                    <TableCell className="flex items-center gap-2">
                      {canManage && a.status === "ADMITTED" && !a.pupil && <Button size="sm" variant="secondary" onClick={() => enrol.mutate(a.id)} disabled={enrol.isPending}>Enrol</Button>}
                      {a.pupil && <Badge>Enrolled</Badge>}
                      {canManage && <Button variant="ghost" size="icon" onClick={() => { if (confirm(`Delete application ${a.applicationNo}?`)) remove.mutate(a.id); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>}
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </div>
        <PaginationBar page={page} totalPages={totalPages} total={total} pageSize={pageSize} onPageChange={setPage} />
      </div>
      {feeFor && (
        <Dialog open onOpenChange={(o) => !o && setFeeFor(null)}>
          <RegFeeDialog admission={feeFor} onClose={() => setFeeFor(null)} />
        </Dialog>
      )}
    </>
  );
}

function RegFeeDialog({ admission, onClose }: { admission: any; onClose: () => void }) {
  const qc = useQueryClient();
  const [f, setF] = useState({ regFeePaid: 0, regFeePaidOn: new Date().toISOString().slice(0, 10), regFeePaymentMethod: "CASH" });
  const save = useMutation({
    mutationFn: () => api.admissions.update(admission.id, f),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admissions"] }); toast.success("Registration fee recorded"); onClose(); },
    onError: (e: any) => toast.error(e.message),
  });
  return (
    <DialogContent>
      <DialogHeader><DialogTitle>Record registration fee — {admission.fullName}</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <p className="text-xs text-muted-foreground">This is tracked as income immediately — it doesn't wait for the applicant to be enrolled as a pupil.</p>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Amount paid</Label><Input type="number" step="0.01" value={f.regFeePaid} onChange={(e) => setF({ ...f, regFeePaid: Number(e.target.value) })} /></div>
          <div><Label>Date paid</Label><Input type="date" value={f.regFeePaidOn} onChange={(e) => setF({ ...f, regFeePaidOn: e.target.value })} /></div>
        </div>
        <div><Label>Method</Label>
          <Select value={f.regFeePaymentMethod} onValueChange={(v) => setF({ ...f, regFeePaymentMethod: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{["CASH", "BANK", "MOBILE_MONEY", "CARD", "CHEQUE"].map((m) => <SelectItem key={m} value={m}>{m.replace("_", " ")}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>
      <DialogFooter><Button onClick={() => save.mutate()} disabled={!f.regFeePaid || save.isPending}>{save.isPending ? "Saving…" : "Save"}</Button></DialogFooter>
    </DialogContent>
  );
}

function ApplicationForm({ classes, onSubmit }: any) {
  const [f, setF] = useState({ fullName: "", gender: "", dob: "", previousSchool: "", parentName: "", parentPhone: "", parentEmail: "", targetClassId: "", notes: "" });
  return (
    <DialogContent className="max-w-lg">
      <DialogHeader><DialogTitle>New application</DialogTitle></DialogHeader>
      <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
        <div><Label>Full name</Label><Input value={f.fullName} onChange={(e) => setF({ ...f, fullName: e.target.value })} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Gender</Label>
            <Select value={f.gender} onValueChange={(v) => setF({ ...f, gender: v })}>
              <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent><SelectItem value="MALE">Male</SelectItem><SelectItem value="FEMALE">Female</SelectItem></SelectContent>
            </Select>
          </div>
          <div><Label>Date of birth</Label><Input type="date" value={f.dob} onChange={(e) => setF({ ...f, dob: e.target.value })} /></div>
        </div>
        <div><Label>Previous school</Label><Input value={f.previousSchool} onChange={(e) => setF({ ...f, previousSchool: e.target.value })} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Parent name</Label><Input value={f.parentName} onChange={(e) => setF({ ...f, parentName: e.target.value })} /></div>
          <div><Label>Parent phone</Label><Input value={f.parentPhone} onChange={(e) => setF({ ...f, parentPhone: e.target.value })} /></div>
        </div>
        <div><Label>Parent email</Label><Input value={f.parentEmail} onChange={(e) => setF({ ...f, parentEmail: e.target.value })} /></div>
        <div><Label>Target class</Label>
          <Select value={f.targetClassId} onValueChange={(v) => setF({ ...f, targetClassId: v })}>
            <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
            <SelectContent>{classes.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}{c.stream ? " " + c.stream : ""}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div><Label>Notes</Label><Textarea value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></div>
      </div>
      <DialogFooter><Button onClick={() => onSubmit(f)} disabled={!f.fullName}>Save</Button></DialogFooter>
    </DialogContent>
  );
}