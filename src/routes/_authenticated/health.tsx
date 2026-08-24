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
import { Plus, Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/EmptyState";
import { useAuth, hasPermission } from "@/lib/auth";
import { usePagination } from "@/hooks/use-pagination";
import { PaginationBar } from "@/components/PaginationBar";

export const Route = createFileRoute("/_authenticated/health")({
  head: () => ({ meta: [{ title: "Health records" }] }),
  component: HealthPage,
});

function HealthPage() {
  const qc = useQueryClient();
  const { permissions } = useAuth();
  const canManage = hasPermission(permissions, "health:manage");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  // Only feeds the Log-visit dialog, which never renders without health:manage.
  const { data: pupils = [] } = useQuery({ queryKey: ["pupils-min"], enabled: canManage, queryFn: () => api.pupils.all() });
  const { data = [] } = useQuery({ queryKey: ["health"], queryFn: () => api.health.list() });
  const { pageItems: pagedHealth, page, setPage, totalPages, pageSize, total } = usePagination(data, 25);
  const create = useMutation({
    mutationFn: (f: any) => api.health.create(f),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["health"] }); toast.success("Visit logged"); setOpen(false); },
    onError: (e: any) => toast.error(e.message),
  });
  const update = useMutation({
    mutationFn: (f: any) => api.health.update(editing.id, f),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["health"] }); toast.success("Visit updated"); setEditing(null); },
    onError: (e: any) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.health.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["health"] }); toast.success("Deleted"); },
    onError: (e: any) => toast.error(e.message),
  });
  return (
    <>
      <PageHeader title="Health records" description="Clinic visits, injuries and medication"
        actions={
          canManage ? (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" /> Log visit</Button></DialogTrigger>
              <HealthForm pupils={pupils} onSubmit={(f: any) => create.mutate(f)} />
            </Dialog>
          ) : undefined
        } />
      <div className="p-6"><div className="rounded-lg border bg-card"><Table>
        <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Pupil</TableHead><TableHead>Complaint</TableHead><TableHead>Diagnosis</TableHead><TableHead>Treatment</TableHead><TableHead>Attended by</TableHead><TableHead></TableHead></TableRow></TableHeader>
        <TableBody>
          {data.length === 0 ? <TableRow><TableCell colSpan={7}><EmptyState /></TableCell></TableRow> : pagedHealth.map((h) => (
            <TableRow key={h.id}>
              <TableCell>{h.visitDate}</TableCell>
              <TableCell>{h.pupil?.fullName}</TableCell>
              <TableCell className="max-w-[200px] truncate">{h.complaint}</TableCell>
              <TableCell className="max-w-[200px] truncate">{h.diagnosis ?? "—"}</TableCell>
              <TableCell className="max-w-[200px] truncate">{h.treatment ?? "—"}</TableCell>
              <TableCell>{h.attendedBy ?? "—"}</TableCell>
              <TableCell className="text-right">
                {canManage && (
                  <>
                    <Button variant="ghost" size="icon" onClick={() => setEditing(h)}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => { if (confirm("Delete this visit?")) remove.mutate(h.id); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table></div>
      <PaginationBar page={page} totalPages={totalPages} total={total} pageSize={pageSize} onPageChange={setPage} />
      </div>

      {editing && (
        <Dialog open onOpenChange={(o) => { if (!o) setEditing(null); }}>
          <HealthForm pupils={pupils} initial={editing} title="Edit clinic visit" onSubmit={(f: any) => update.mutate(f)} />
        </Dialog>
      )}
    </>
  );
}

function HealthForm({ pupils, initial, title, onSubmit }: any) {
  const [f, setF] = useState(() => initial
    ? { pupilId: initial.pupil?.id ?? "", visitDate: initial.visitDate, complaint: initial.complaint ?? "", diagnosis: initial.diagnosis ?? "", treatment: initial.treatment ?? "", medication: initial.medication ?? "", attendedBy: initial.attendedBy ?? "", notes: initial.notes ?? "" }
    : { pupilId: "", visitDate: new Date().toISOString().slice(0, 10), complaint: "", diagnosis: "", treatment: "", medication: "", attendedBy: "", notes: "" });
  return (
    <DialogContent><DialogHeader><DialogTitle>{title ?? "Clinic visit"}</DialogTitle></DialogHeader>
      <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
        <div><Label>Pupil</Label>
          <Select value={f.pupilId} onValueChange={(v) => setF({ ...f, pupilId: v })}>
            <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
            <SelectContent>{pupils.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.fullName}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div><Label>Date</Label><Input type="date" value={f.visitDate} onChange={(e) => setF({ ...f, visitDate: e.target.value })} /></div>
        <div><Label>Complaint</Label><Textarea value={f.complaint} onChange={(e) => setF({ ...f, complaint: e.target.value })} /></div>
        <div><Label>Diagnosis</Label><Textarea value={f.diagnosis} onChange={(e) => setF({ ...f, diagnosis: e.target.value })} /></div>
        <div><Label>Treatment</Label><Textarea value={f.treatment} onChange={(e) => setF({ ...f, treatment: e.target.value })} /></div>
        <div><Label>Medication</Label><Input value={f.medication} onChange={(e) => setF({ ...f, medication: e.target.value })} /></div>
        <div><Label>Attended by</Label><Input value={f.attendedBy} onChange={(e) => setF({ ...f, attendedBy: e.target.value })} /></div>
        <div><Label>Notes</Label><Textarea value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></div>
      </div>
      <DialogFooter><Button onClick={() => onSubmit(f)} disabled={!f.pupilId || !f.complaint}>Save</Button></DialogFooter>
    </DialogContent>
  );
}
