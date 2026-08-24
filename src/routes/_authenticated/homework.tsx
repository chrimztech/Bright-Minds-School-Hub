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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, BookMarked, Trash2, Pencil } from "lucide-react";
import { toast } from "sonner";
import { useAuth, hasAny, ADMIN_ROLES } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/homework")({
  head: () => ({ meta: [{ title: "Homework" }] }),
  component: Homework,
});

function Homework() {
  const { roles } = useAuth();
  const isAdmin = hasAny(roles, ADMIN_ROLES);
  const isTeacher = roles.includes("TEACHER") && !isAdmin;
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [f, setF] = useState({ title: "", description: "", classId: "", subjectId: "", dueDate: "" });
  // The backend already scopes GET /homework to the caller's assigned class(es) for a
  // TEACHER-tier role (see ClassScopeService), so this list is never re-filtered client-side.
  const { data = [] } = useQuery({ queryKey: ["homework"], queryFn: () => api.homework.list() });
  const { data: myClasses = [] } = useQuery({ queryKey: ["my-classes"], enabled: isTeacher, queryFn: () => api.classes.myClasses() });
  const { data: allClasses = [] } = useQuery({ queryKey: ["classes-hw"], enabled: !isTeacher, queryFn: () => api.classes.list() });
  const classes = isTeacher ? myClasses : allClasses;
  const { data: subjects = [] } = useQuery({ queryKey: ["subjects-hw"], queryFn: () => api.subjects.list() });
  const create = useMutation({
    mutationFn: () => api.homework.create({ title: f.title, description: f.description || undefined, classId: f.classId || undefined, subjectId: f.subjectId || undefined, dueDate: f.dueDate || undefined }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["homework"] }); toast.success("Homework posted"); setOpen(false); },
    onError: (e: any) => toast.error(e.message),
  });
  const update = useMutation({
    mutationFn: () => api.homework.update(editing.id, { title: f.title, description: f.description || undefined, classId: f.classId || undefined, subjectId: f.subjectId || undefined, dueDate: f.dueDate || undefined }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["homework"] }); toast.success("Homework updated"); setEditing(null); },
    onError: (e: any) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.homework.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["homework"] }); toast.success("Deleted"); },
    onError: (e: any) => toast.error(e.message),
  });
  function openEdit(h: any) {
    setEditing(h);
    setF({ title: h.title, description: h.description ?? "", classId: h.schoolClass?.id ?? "", subjectId: h.subject?.id ?? "", dueDate: h.dueDate ?? "" });
  }
  return (
    <>
      <PageHeader title="Homework" actions={
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (o) setF({ title: "", description: "", classId: "", subjectId: "", dueDate: "" }); }}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" /> Assign</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New homework</DialogTitle></DialogHeader>
            <HomeworkFormFields f={f} setF={setF} classes={classes} subjects={subjects} />
            <DialogFooter><Button onClick={() => create.mutate()} disabled={!f.title}>Post</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      } />
      <div className="p-6 grid gap-4 md:grid-cols-2">
        {data.length === 0 ? <p className="text-muted-foreground">No homework assigned yet.</p>
          : data.map((h) => (
            <Card key={h.id}>
              <CardHeader><CardTitle className="flex items-center justify-between gap-2 text-base">
                <span className="flex items-center gap-2"><BookMarked className="h-4 w-4 text-primary" /> {h.title}</span>
                <span className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(h)}><Pencil className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => { if (confirm("Delete this homework?")) remove.mutate(h.id); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </span>
              </CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="text-muted-foreground">
                  {h.schoolClass?.name ?? "All classes"}{h.subject?.name ? ` · ${h.subject.name}` : ""}{h.dueDate ? ` · due ${h.dueDate}` : ""}
                </div>
                <p className="whitespace-pre-wrap">{h.description}</p>
              </CardContent>
            </Card>
          ))}
      </div>

      <Dialog open={!!editing} onOpenChange={(o) => { if (!o) setEditing(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit homework</DialogTitle></DialogHeader>
          <HomeworkFormFields f={f} setF={setF} classes={classes} subjects={subjects} />
          <DialogFooter><Button onClick={() => update.mutate()} disabled={!f.title || update.isPending}>{update.isPending ? "Saving…" : "Save"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function HomeworkFormFields({ f, setF, classes, subjects }: { f: any; setF: (f: any) => void; classes: any[]; subjects: any[] }) {
  return (
    <div className="space-y-3">
      <div><Label>Title</Label><Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></div>
      <div><Label>Instructions</Label><Textarea rows={4} value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></div>
      <div className="grid grid-cols-3 gap-3">
        <div><Label>Class</Label>
          <Select value={f.classId} onValueChange={(v) => setF({ ...f, classId: v })}>
            <SelectTrigger><SelectValue placeholder="Class" /></SelectTrigger>
            <SelectContent>{classes.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}{c.stream ? " " + c.stream : ""}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div><Label>Subject</Label>
          <Select value={f.subjectId} onValueChange={(v) => setF({ ...f, subjectId: v })}>
            <SelectTrigger><SelectValue placeholder="Subject" /></SelectTrigger>
            <SelectContent>{subjects.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div><Label>Due</Label><Input type="date" value={f.dueDate} onChange={(e) => setF({ ...f, dueDate: e.target.value })} /></div>
      </div>
    </div>
  );
}
