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
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/EmptyState";

export const Route = createFileRoute("/_authenticated/admissions")({
  head: () => ({ meta: [{ title: "Admissions" }] }),
  component: AdmissionsPage,
});

const STATUSES = ["APPLIED", "REVIEWING", "INTERVIEWED", "ADMITTED", "REJECTED", "WAITLISTED", "ENROLLED"];

function AdmissionsPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const { data: classes = [] } = useQuery({ queryKey: ["classes-min"], queryFn: () => api.classes.list() });
  const { data = [] } = useQuery({ queryKey: ["admissions"], queryFn: () => api.admissions.list() });
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
  const enrol = useMutation({
    mutationFn: (id: string) => api.admissions.updateStatus(id, "ENROLLED"),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admissions"] }); qc.invalidateQueries({ queryKey: ["pupils"] }); toast.success("Pupil enrolled"); },
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
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" /> New application</Button></DialogTrigger>
            <ApplicationForm classes={classes} onSubmit={(f: any) => create.mutate(f)} />
          </Dialog>
        } />
      <div className="p-6">
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader><TableRow>
              <TableHead>Ref</TableHead><TableHead>Name</TableHead><TableHead>Target class</TableHead>
              <TableHead>Parent</TableHead><TableHead>Status</TableHead><TableHead></TableHead>
            </TableRow></TableHeader>
            <TableBody>
              {data.length === 0 ? <TableRow><TableCell colSpan={6}><EmptyState /></TableCell></TableRow>
                : data.map((a) => (
                  <TableRow key={a.id}>
                    <TableCell className="font-mono text-xs">{a.applicationNo}</TableCell>
                    <TableCell className="font-medium">{a.fullName}</TableCell>
                    <TableCell>{a.targetClass ? `${a.targetClass.name}${a.targetClass.stream ? " " + a.targetClass.stream : ""}` : "—"}</TableCell>
                    <TableCell>{a.parentName ?? "—"}<div className="text-xs text-muted-foreground">{a.parentPhone ?? ""}</div></TableCell>
                    <TableCell>
                      <Select value={a.status} onValueChange={(v) => setStatus.mutate({ id: a.id, status: v })}>
                        <SelectTrigger className="h-8 w-36"><SelectValue /></SelectTrigger>
                        <SelectContent>{STATUSES.map((s) => <SelectItem key={s} value={s}>{s.toLowerCase()}</SelectItem>)}</SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="flex items-center gap-2">
                      {a.status === "ADMITTED" && <Button size="sm" variant="secondary" onClick={() => enrol.mutate(a.id)}>Enrol</Button>}
                      {a.status === "ENROLLED" && <Badge>Enrolled</Badge>}
                      <Button variant="ghost" size="icon" onClick={() => { if (confirm(`Delete application ${a.applicationNo}?`)) remove.mutate(a.id); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </>
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