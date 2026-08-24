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
import { Badge } from "@/components/ui/badge";
import { Plus, Check, X, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/EmptyState";
import { useAuth, hasPermission } from "@/lib/auth";
import { usePagination } from "@/hooks/use-pagination";
import { PaginationBar } from "@/components/PaginationBar";

const LEAVE_TYPES = ["Sick", "Annual", "Maternity", "Paternity", "Compassionate", "Unpaid"];

export const Route = createFileRoute("/_authenticated/leave")({
  head: () => ({ meta: [{ title: "Staff leave" }] }),
  component: LeavePage,
});

function LeavePage() {
  const qc = useQueryClient();
  const { permissions } = useAuth();
  const canManage = hasPermission(permissions, "leave:manage");
  const [open, setOpen] = useState(false);
  // Only feeds the New-request dialog, which never renders without leave:manage.
  const { data: staff = [] } = useQuery({ queryKey: ["staff-min"], enabled: canManage, queryFn: () => api.staff.all() });
  const { data = [] } = useQuery({ queryKey: ["leave"], queryFn: () => api.leave.list() });
  const { pageItems: pagedLeave, page, setPage, totalPages, pageSize, total } = usePagination(data, 25);
  const create = useMutation({
    mutationFn: (f: any) => api.leave.create(f),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["leave"] }); toast.success("Request submitted"); setOpen(false); },
    onError: (e: any) => toast.error(e.message),
  });
  const approve = useMutation({
    mutationFn: (id: string) => api.leave.approve(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["leave"] }),
  });
  const reject = useMutation({
    mutationFn: (id: string) => api.leave.reject(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["leave"] }),
  });
  // The API already supported deleting a request, but no UI ever called it — once a request
  // was approved/rejected, the Approve/Reject icons disappeared and it was stuck forever.
  const remove = useMutation({
    mutationFn: (id: string) => api.leave.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["leave"] }); toast.success("Request deleted"); },
    onError: (e: any) => toast.error(e.message),
  });
  return (
    <>
      <PageHeader title="Staff leave" description="Applications, approvals and balances"
        actions={
          canManage ? (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" /> New request</Button></DialogTrigger>
              <LeaveForm staff={staff} onSubmit={(f: any) => create.mutate(f)} />
            </Dialog>
          ) : undefined
        } />
      <div className="p-6"><div className="rounded-lg border bg-card"><Table>
        <TableHeader><TableRow><TableHead>Staff</TableHead><TableHead>Type</TableHead><TableHead>From</TableHead><TableHead>To</TableHead><TableHead>Reason</TableHead><TableHead>Status</TableHead><TableHead></TableHead></TableRow></TableHeader>
        <TableBody>
          {data.length === 0 ? <TableRow><TableCell colSpan={7}><EmptyState /></TableCell></TableRow> : pagedLeave.map((l) => (
            <TableRow key={l.id}>
              <TableCell>{l.staff?.fullName}</TableCell>
              <TableCell>{l.leaveType}</TableCell>
              <TableCell>{l.startDate}</TableCell>
              <TableCell>{l.endDate}</TableCell>
              <TableCell className="max-w-[240px] truncate">{l.reason}</TableCell>
              <TableCell><Badge variant={l.status === "APPROVED" ? "default" : l.status === "REJECTED" ? "destructive" : "secondary"}>{l.status.toLowerCase()}</Badge></TableCell>
              <TableCell className="flex gap-1">
                {canManage && l.status === "PENDING" && <>
                  <Button size="icon" variant="ghost" onClick={() => approve.mutate(l.id)}><Check className="h-4 w-4" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => reject.mutate(l.id)}><X className="h-4 w-4" /></Button>
                </>}
                {canManage && (
                  <Button size="icon" variant="ghost" title="Delete this request"
                    onClick={() => { if (confirm(`Delete this leave request for ${l.staff?.fullName}?`)) remove.mutate(l.id); }}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table></div>
      <PaginationBar page={page} totalPages={totalPages} total={total} pageSize={pageSize} onPageChange={setPage} />
      </div>
    </>
  );
}

function LeaveForm({ staff, onSubmit }: any) {
  const [f, setF] = useState({ staffId: "", leaveType: "Sick", startDate: "", endDate: "", reason: "" });
  return (
    <DialogContent>
      <DialogHeader><DialogTitle>Leave request</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div><Label>Staff</Label>
          <Select value={f.staffId} onValueChange={(v) => setF({ ...f, staffId: v })}>
            <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
            <SelectContent>{staff.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.fullName}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div><Label>Type</Label>
          <Select value={f.leaveType} onValueChange={(v) => setF({ ...f, leaveType: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{LEAVE_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>From</Label><Input type="date" value={f.startDate} onChange={(e) => setF({ ...f, startDate: e.target.value })} /></div>
          <div><Label>To</Label><Input type="date" value={f.endDate} onChange={(e) => setF({ ...f, endDate: e.target.value })} /></div>
        </div>
        <div><Label>Reason</Label><Textarea value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} /></div>
      </div>
      <DialogFooter><Button onClick={() => onSubmit(f)} disabled={!f.staffId || !f.startDate || !f.endDate}>Submit</Button></DialogFooter>
    </DialogContent>
  );
}
