import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api, type SchoolClass } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/classes")({
  head: () => ({ meta: [{ title: "Classes" }] }),
  component: Classes,
});

function Classes() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<SchoolClass | null>(null);
  const { data = [] } = useQuery({
    queryKey: ["classes-list"],
    queryFn: () => api.classes.list(),
  });
  const { data: teachers = [] } = useQuery({
    queryKey: ["teachers"],
    queryFn: () => api.staff.teachers(),
  });
  const create = useMutation({
    mutationFn: (f: any) => api.classes.create(f),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["classes-list"] }); toast.success("Class added"); setOpen(false); },
    onError: (e: any) => toast.error(e.message),
  });
  const update = useMutation({
    mutationFn: ({ id, ...f }: any) => api.classes.update(id, f),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["classes-list"] }); toast.success("Class updated"); setEditing(null); },
    onError: (e: any) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.classes.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["classes-list"] }); toast.success("Class deleted"); },
    onError: (e: any) => toast.error(e.message),
  });
  const reassign = useMutation({
    mutationFn: ({ id, classTeacherId }: any) => api.classes.update(id, { classTeacherId: classTeacherId || undefined }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["classes-list"] }); toast.success("Teacher updated"); },
    onError: (e: any) => toast.error(e.message),
  });
  return (
    <>
      <PageHeader title="Classes & streams" actions={
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" /> Add class</Button></DialogTrigger>
          <DialogContent>
            <ClassForm teachers={teachers} onSubmit={(f: any) => create.mutate(f)} />
          </DialogContent>
        </Dialog>
      } />
      <div className="p-6">
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Stream</TableHead><TableHead>Order</TableHead><TableHead>Class teacher</TableHead><TableHead>Capacity</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
            <TableBody>
              {data.length === 0 ? <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No classes yet.</TableCell></TableRow>
                : data.map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell>{c.stream ?? "—"}</TableCell>
                    <TableCell>{c.levelOrder}</TableCell>
                    <TableCell>
                      <Select value={c.classTeacher?.id ?? "__none"} onValueChange={(v) => reassign.mutate({ id: c.id, classTeacherId: v === "__none" ? null : v })}>
                        <SelectTrigger className="h-8 w-[200px]"><SelectValue placeholder="Assign teacher" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none">— Unassigned —</SelectItem>
                          {teachers.map((t) => <SelectItem key={t.id} value={t.id}>{t.fullName}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>{c.capacity ?? "—"}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => setEditing(c)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="sm" onClick={() => { if (confirm(`Delete class "${c.name}"?`)) remove.mutate(c.id); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </div>
      </div>
      {editing && (
        <Dialog open onOpenChange={() => setEditing(null)}>
          <DialogContent>
            <ClassForm teachers={teachers} initial={editing} onSubmit={(f: any) => update.mutate({ id: editing.id, ...f })} />
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

function ClassForm({ teachers, onSubmit, initial }: any) {
  const [f, setF] = useState({
    name: initial?.name ?? "",
    stream: initial?.stream ?? "",
    levelOrder: initial?.levelOrder ?? 0,
    capacity: initial?.capacity ?? 30,
    classTeacherId: initial?.classTeacher?.id ?? "",
  });
  return (
    <>
      <DialogHeader><DialogTitle>{initial ? "Edit class" : "New class"}</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Name</Label><Input placeholder="Grade 1" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
          <div><Label>Stream</Label><Input placeholder="A (optional)" value={f.stream} onChange={(e) => setF({ ...f, stream: e.target.value })} /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Order</Label><Input type="number" value={f.levelOrder} onChange={(e) => setF({ ...f, levelOrder: Number(e.target.value) })} /></div>
          <div><Label>Capacity</Label><Input type="number" value={f.capacity} onChange={(e) => setF({ ...f, capacity: Number(e.target.value) })} /></div>
        </div>
        <div><Label>Class teacher</Label>
          <Select value={f.classTeacherId || "__none"} onValueChange={(v) => setF({ ...f, classTeacherId: v === "__none" ? "" : v })}>
            <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__none">— None —</SelectItem>
              {teachers.map((t: any) => <SelectItem key={t.id} value={t.id}>{t.fullName}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <DialogFooter><Button onClick={() => onSubmit({ ...f, stream: f.stream || null, classTeacherId: f.classTeacherId || null })} disabled={!f.name}>Save</Button></DialogFooter>
    </>
  );
}
