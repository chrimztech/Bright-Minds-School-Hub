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
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/EmptyState";
import { useAuth, hasPermission } from "@/lib/auth";
import { usePagination } from "@/hooks/use-pagination";
import { PaginationBar } from "@/components/PaginationBar";

const KINDS = ["INCIDENT", "MERIT", "DEMERIT", "REWARD", "WARNING"];

export const Route = createFileRoute("/_authenticated/discipline")({
  head: () => ({ meta: [{ title: "Discipline" }] }),
  component: DisciplinePage,
});

function DisciplinePage() {
  const qc = useQueryClient();
  const { permissions } = useAuth();
  const canManage = hasPermission(permissions, "discipline:manage");
  const [open, setOpen] = useState(false);
  // Only needed for the New-record dialog's pupil picker, which never renders without
  // discipline:manage — fetching it unconditionally 403'd (and console-errored) for every
  // view-only user on every page load, even though the dialog was already correctly hidden.
  const { data: pupils = [] } = useQuery({ queryKey: ["pupils-min"], enabled: canManage, queryFn: () => api.pupils.all() });
  const { data = [] } = useQuery({ queryKey: ["discipline"], queryFn: () => api.discipline.list() });
  const { pageItems: pagedDiscipline, page, setPage, totalPages, pageSize, total } = usePagination(data, 25);
  const create = useMutation({
    mutationFn: (f: any) => api.discipline.create(f),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["discipline"] }); toast.success("Record added"); setOpen(false); },
    onError: (e: any) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.discipline.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["discipline"] }); toast.success("Deleted"); },
    onError: (e: any) => toast.error(e.message),
  });
  return (
    <>
      <PageHeader title="Discipline & behaviour" description="Incidents, merits, rewards and follow-ups"
        actions={
          canManage ? (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" /> New record</Button></DialogTrigger>
              <DiscForm pupils={pupils} onSubmit={(f: any) => create.mutate(f)} />
            </Dialog>
          ) : undefined
        } />
      <div className="p-6"><div className="rounded-lg border bg-card"><Table>
        <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Pupil</TableHead><TableHead>Kind</TableHead><TableHead>Description</TableHead><TableHead>Action</TableHead><TableHead></TableHead></TableRow></TableHeader>
        <TableBody>
          {data.length === 0 ? <TableRow><TableCell colSpan={6}><EmptyState /></TableCell></TableRow> : pagedDiscipline.map((d) => (
            <TableRow key={d.id}>
              <TableCell>{d.occurredOn}</TableCell>
              <TableCell>{d.pupil?.fullName}</TableCell>
              <TableCell><Badge variant={d.kind === "REWARD" || d.kind === "MERIT" ? "default" : d.kind === "DEMERIT" || d.kind === "INCIDENT" ? "destructive" : "secondary"}>{d.kind.toLowerCase()}</Badge></TableCell>
              <TableCell className="max-w-[260px] truncate">{d.description}</TableCell>
              <TableCell className="max-w-[200px] truncate">{d.actionTaken ?? "—"}</TableCell>
              <TableCell className="text-right">{canManage && <Button variant="ghost" size="icon" onClick={() => { if (confirm("Delete this record?")) remove.mutate(d.id); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table></div>
      <PaginationBar page={page} totalPages={totalPages} total={total} pageSize={pageSize} onPageChange={setPage} />
      </div>
    </>
  );
}

function DiscForm({ pupils, onSubmit }: any) {
  const [f, setF] = useState({ pupilId: "", kind: "INCIDENT", occurredOn: new Date().toISOString().slice(0, 10), description: "", actionTaken: "", points: 0 });
  return (
    <DialogContent><DialogHeader><DialogTitle>New record</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div><Label>Pupil</Label>
          <Select value={f.pupilId} onValueChange={(v) => setF({ ...f, pupilId: v })}>
            <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
            <SelectContent>{pupils.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.fullName}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Kind</Label>
            <Select value={f.kind} onValueChange={(v) => setF({ ...f, kind: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{KINDS.map((k) => <SelectItem key={k} value={k}>{k.toLowerCase()}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Date</Label><Input type="date" value={f.occurredOn} onChange={(e) => setF({ ...f, occurredOn: e.target.value })} /></div>
        </div>
        <div><Label>Description</Label><Textarea value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></div>
        <div><Label>Action taken</Label><Textarea value={f.actionTaken} onChange={(e) => setF({ ...f, actionTaken: e.target.value })} /></div>
        <div><Label>Points</Label><Input type="number" value={f.points} onChange={(e) => setF({ ...f, points: Number(e.target.value) })} /></div>
      </div>
      <DialogFooter><Button onClick={() => onSubmit(f)} disabled={!f.pupilId || !f.description}>Save</Button></DialogFooter>
    </DialogContent>
  );
}
