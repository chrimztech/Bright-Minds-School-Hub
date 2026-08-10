import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/timetable")({
  head: () => ({ meta: [{ title: "Timetable" }] }),
  component: Timetable,
});

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"];

function Timetable() {
  const qc = useQueryClient();
  const [classId, setClassId] = useState("");
  const [open, setOpen] = useState(false);
  const { data: classes = [] } = useQuery({ queryKey: ["classes-tt"], queryFn: () => api.classes.list() });
  const { data: subjects = [] } = useQuery({ queryKey: ["subjects-tt"], queryFn: () => api.subjects.list() });
  const { data: teachers = [] } = useQuery({ queryKey: ["teachers-tt"], queryFn: () => api.staff.teachers() });
  const { data: slots = [] } = useQuery({
    queryKey: ["tt", classId],
    enabled: !!classId,
    queryFn: () => api.timetable.list(classId),
  });
  const [f, setF] = useState({ dayOfWeek: 1, startTime: "08:00", endTime: "08:40", subjectId: "", teacherId: "", room: "" });
  const create = useMutation({
    mutationFn: () => api.timetable.create({ ...f, classId, subjectId: f.subjectId || undefined, teacherId: f.teacherId || undefined }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["tt"] }); toast.success("Slot added"); setOpen(false); },
    onError: (e: any) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.timetable.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["tt"] }); toast.success("Deleted"); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <>
      <PageHeader title="Timetable" actions={classId ? (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" /> Add slot</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New slot</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-3">
                <div><Label>Day</Label><Select value={String(f.dayOfWeek)} onValueChange={(v) => setF({ ...f, dayOfWeek: Number(v) })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{DAYS.map((d, i) => <SelectItem key={d} value={String(i + 1)}>{d}</SelectItem>)}</SelectContent></Select></div>
                <div><Label>Start</Label><Input type="time" value={f.startTime} onChange={(e) => setF({ ...f, startTime: e.target.value })} /></div>
                <div><Label>End</Label><Input type="time" value={f.endTime} onChange={(e) => setF({ ...f, endTime: e.target.value })} /></div>
              </div>
              <div><Label>Subject</Label><Select value={f.subjectId} onValueChange={(v) => setF({ ...f, subjectId: v })}><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger><SelectContent>{subjects.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent></Select></div>
              <div><Label>Teacher</Label><Select value={f.teacherId} onValueChange={(v) => setF({ ...f, teacherId: v })}><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger><SelectContent>{teachers.map((t) => <SelectItem key={t.id} value={t.id}>{t.fullName}</SelectItem>)}</SelectContent></Select></div>
              <div><Label>Room</Label><Input value={f.room} onChange={(e) => setF({ ...f, room: e.target.value })} /></div>
            </div>
            <DialogFooter><Button onClick={() => create.mutate()}>Save</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      ) : null} />
      <div className="p-6 space-y-4">
        <Select value={classId} onValueChange={setClassId}><SelectTrigger className="w-72"><SelectValue placeholder="Select class" /></SelectTrigger><SelectContent>{classes.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}{c.stream ? " " + c.stream : ""}</SelectItem>)}</SelectContent></Select>
        {classId && (
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            {DAYS.map((d, i) => (
              <div key={d} className="rounded-lg border bg-card p-3">
                <h3 className="font-semibold text-sm mb-2">{d}</h3>
                <div className="space-y-2">
                  {slots.filter((s) => s.dayOfWeek === i + 1).map((s) => (
                    <div key={s.id} className="text-xs rounded bg-secondary p-2 group relative">
                      <div className="font-medium">{s.startTime?.slice(0,5)}–{s.endTime?.slice(0,5)}</div>
                      <div>{s.subject?.name ?? "—"}</div>
                      <div className="text-muted-foreground">{s.teacher?.fullName ?? ""} {s.room ? `· ${s.room}` : ""}</div>
                      <button className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition" onClick={() => { if (confirm("Delete this slot?")) remove.mutate(s.id); }}><Trash2 className="h-3 w-3 text-destructive" /></button>
                    </div>
                  ))}
                  {slots.filter((s) => s.dayOfWeek === i + 1).length === 0 && <p className="text-xs text-muted-foreground">No slots</p>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}