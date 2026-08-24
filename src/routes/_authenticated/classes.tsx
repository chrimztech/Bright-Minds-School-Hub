import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api, type SchoolClass, type Pupil } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Pencil, Trash2, Users, X, Printer } from "lucide-react";
import { toast } from "sonner";
import { PrintOverlay, DocHeader, useSchool } from "@/components/PrintableDoc";
import { useAuth, hasPermission } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/classes")({
  head: () => ({ meta: [{ title: "Classes" }] }),
  component: Classes,
});

function Classes() {
  const qc = useQueryClient();
  const { permissions } = useAuth();
  const canManage = hasPermission(permissions, "classes:manage");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<SchoolClass | null>(null);
  const [roster, setRoster] = useState<SchoolClass | null>(null);
  const { data = [] } = useQuery({
    queryKey: ["classes-list"],
    queryFn: () => api.classes.list(),
  });
  // Only feeds the class-teacher picker (Add/Edit class dialogs, and the reassign Select
  // in the table) — all gated by classes:manage.
  const { data: teachers = [] } = useQuery({
    queryKey: ["teachers"],
    enabled: canManage,
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
        canManage ? (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" /> Add class</Button></DialogTrigger>
            <DialogContent>
              <ClassForm teachers={teachers} onSubmit={(f: any) => create.mutate(f)} />
            </DialogContent>
          </Dialog>
        ) : undefined
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
                      {canManage ? (
                        <Select value={c.classTeacher?.id ?? "__none"} onValueChange={(v) => reassign.mutate({ id: c.id, classTeacherId: v === "__none" ? null : v })}>
                          <SelectTrigger className="h-8 w-[200px]"><SelectValue placeholder="Assign teacher" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none">— Unassigned —</SelectItem>
                            {teachers.map((t) => <SelectItem key={t.id} value={t.id}>{t.fullName}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      ) : (c.classTeacher?.fullName ?? "—")}
                    </TableCell>
                    <TableCell>{c.capacity ?? "—"}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => setRoster(c)}><Users className="h-4 w-4" /></Button>
                      {canManage && <Button variant="ghost" size="sm" onClick={() => setEditing(c)}><Pencil className="h-4 w-4" /></Button>}
                      {canManage && <Button variant="ghost" size="sm" onClick={() => { if (confirm(`Delete class "${c.name}"?`)) remove.mutate(c.id); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>}
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
      {roster && (
        <Dialog open onOpenChange={() => setRoster(null)}>
          <RosterDialog schoolClass={roster} />
        </Dialog>
      )}
    </>
  );
}

function RosterDialog({ schoolClass }: { schoolClass: SchoolClass }) {
  const qc = useQueryClient();
  const { permissions } = useAuth();
  const canEditPupils = hasPermission(permissions, "pupils:edit");
  const [addId, setAddId] = useState("");
  const [search, setSearch] = useState("");
  const [printOpen, setPrintOpen] = useState(false);
  const { data: school } = useSchool();

  const { data: inClass = [], isLoading } = useQuery({
    queryKey: ["pupils-by-class", schoolClass.id],
    queryFn: () => api.pupils.byClass(schoolClass.id),
  });
  // Only feeds the "add pupil to class" picker, which is itself gated by pupils:edit.
  const { data: allPupils = [] } = useQuery({ queryKey: ["pupils-all"], enabled: canEditPupils, queryFn: () => api.pupils.all() });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["pupils-by-class", schoolClass.id] });
    qc.invalidateQueries({ queryKey: ["pupils-all"] });
    qc.invalidateQueries({ queryKey: ["pupils-all"] });
  };

  const setClass = useMutation({
    mutationFn: ({ pupil, classId }: { pupil: Pupil; classId: string | null }) =>
      api.pupils.update(pupil.id, { fullName: pupil.fullName, ...({ classId } as any) }),
    onSuccess: invalidate,
    onError: (e: any) => toast.error(e.message),
  });

  const notInClass = allPupils.filter((p) => p.schoolClass?.id !== schoolClass.id);
  const filtered = notInClass.filter((p) => {
    const s = search.toLowerCase().trim();
    return !s || p.fullName.toLowerCase().includes(s) || p.admissionNo.toLowerCase().includes(s);
  });

  return (
    <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle className="flex items-center justify-between gap-2 pr-6">
          <span>{schoolClass.name}{schoolClass.stream ? " " + schoolClass.stream : ""} roster</span>
          <Button variant="outline" size="sm" onClick={() => setPrintOpen(true)} disabled={inClass.length === 0}>
            <Printer className="h-3.5 w-3.5 mr-1.5" />Print register
          </Button>
        </DialogTitle>
      </DialogHeader>
      <div className="space-y-4">
        {canEditPupils && (
          <div className="flex items-end gap-2">
            <div className="flex-1">
              <Label>Add pupil to class</Label>
              <Input placeholder="Search name or admission no…" value={search} onChange={(e) => setSearch(e.target.value)} className="mb-1.5" />
              <Select value={addId} onValueChange={setAddId}>
                <SelectTrigger><SelectValue placeholder={`Pick from ${filtered.length} pupils…`} /></SelectTrigger>
                <SelectContent>
                  {filtered.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.fullName}{p.schoolClass ? ` (currently ${p.schoolClass.name}${p.schoolClass.stream ? " " + p.schoolClass.stream : ""})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              disabled={!addId || setClass.isPending}
              onClick={() => {
                const pupil = allPupils.find((p) => p.id === addId);
                if (pupil) setClass.mutate({ pupil, classId: schoolClass.id });
                setAddId("");
              }}
            >
              Add
            </Button>
          </div>
        )}

        <div>
          <Label className="mb-1.5 block">Currently enrolled ({inClass.length})</Label>
          <div className="rounded-lg border bg-card">
            <Table>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell className="text-center text-muted-foreground py-6">Loading…</TableCell></TableRow>
                ) : inClass.length === 0 ? (
                  <TableRow><TableCell className="text-center text-muted-foreground py-6">No pupils in this class yet.</TableCell></TableRow>
                ) : (
                  inClass.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium py-2">{p.fullName}</TableCell>
                      <TableCell className="font-mono text-[11.5px] text-muted-foreground py-2">{p.admissionNo}</TableCell>
                      <TableCell className="text-right py-2">
                        {canEditPupils && (
                          <Button
                            variant="ghost" size="sm"
                            disabled={setClass.isPending}
                            onClick={() => setClass.mutate({ pupil: p, classId: null })}
                          >
                            <X className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
      {printOpen && (
        <PrintOverlay onClose={() => setPrintOpen(false)}>
          <ClassRegisterPrint school={school} schoolClass={schoolClass} pupils={inClass} />
        </PrintOverlay>
      )}
    </DialogContent>
  );
}

function ClassRegisterPrint({ school, schoolClass, pupils }: any) {
  return (
    <div className="p-8 bg-white text-black" style={{ minWidth: 700 }}>
      <DocHeader school={{ ...school, logoUrl: school?.logoUrl ?? "/logo.png" }} title="Class Register" />
      <p className="text-sm mb-4">
        Class: <span className="font-medium">{schoolClass.name}{schoolClass.stream ? " " + schoolClass.stream : ""}</span>
        {"   "}Class teacher: <span className="font-medium">{schoolClass.classTeacher?.fullName ?? "—"}</span>
        {"   "}Total pupils: <span className="font-medium">{pupils.length}</span>
      </p>
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr>
            <th className="border border-gray-300 p-1.5 w-8 text-left">#</th>
            <th className="border border-gray-300 p-1.5 text-left">Admission No.</th>
            <th className="border border-gray-300 p-1.5 text-left">Full name</th>
            <th className="border border-gray-300 p-1.5 text-left w-16">Gender</th>
            <th className="border border-gray-300 p-1.5 text-left w-24">Date of birth</th>
            <th className="border border-gray-300 p-1.5 text-left w-20">Status</th>
          </tr>
        </thead>
        <tbody>
          {pupils.map((p: Pupil, idx: number) => (
            <tr key={p.id}>
              <td className="border border-gray-300 p-1.5">{idx + 1}</td>
              <td className="border border-gray-300 p-1.5 font-mono">{p.admissionNo}</td>
              <td className="border border-gray-300 p-1.5">{p.fullName}</td>
              <td className="border border-gray-300 p-1.5">{p.gender ?? "—"}</td>
              <td className="border border-gray-300 p-1.5">{p.dob ?? "—"}</td>
              <td className="border border-gray-300 p-1.5">{p.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="grid grid-cols-2 gap-16 mt-10">
        <div className="border-t border-black pt-2"><p className="text-xs">Class Teacher signature</p></div>
        <div className="border-t border-black pt-2"><p className="text-xs">Head Teacher signature</p></div>
      </div>
    </div>
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
