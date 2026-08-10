import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api, type Pupil } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Upload, Download, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/pupils")({
  head: () => ({ meta: [{ title: "Pupils" }] }),
  component: Pupils,
});

function Pupils() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editing, setEditing] = useState<Pupil | null>(null);

  const { data: classes = [] } = useQuery({ queryKey: ["classes"], queryFn: () => api.classes.list() });
  const { data: guardians = [] } = useQuery({ queryKey: ["guardians-pick"], queryFn: () => api.guardians.list() });

  const { data: page, isLoading } = useQuery({
    queryKey: ["pupils", q],
    queryFn: () => api.pupils.list(q || undefined),
  });
  const pupils = page?.content ?? [];

  const create = useMutation({
    mutationFn: async (form: any) => {
      const pupil = await api.pupils.create({
        admissionNo: form.admissionNo || undefined,
        fullName: form.fullName,
        gender: form.gender || undefined,
        dob: form.dob || undefined,
        classId: form.classId || undefined,
        address: form.address || undefined,
        bloodGroup: form.bloodGroup || undefined,
        allergies: form.allergies || undefined,
        medicalInfo: form.medicalInfo || undefined,
        photoUrl: form.photoUrl || undefined,
      });
      if (form.gMode === "existing" && form.gExistingId) {
        await api.guardians.link(form.gExistingId, pupil.id, true);
      } else if (form.gFullName?.trim()) {
        const guardian = await api.guardians.create({
          fullName: form.gFullName,
          relationship: form.gRelationship || undefined,
          phone: form.gPhone || undefined,
          email: form.gEmail || undefined,
          temporaryPassword: form.gTemporaryPassword || undefined,
        });
        await api.guardians.link(guardian.id, pupil.id, true);
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["pupils"] }); toast.success("Pupil added"); setOpen(false); },
    onError: (e: any) => toast.error(e.message),
  });

  const update = useMutation({
    mutationFn: ({ id, ...form }: any) => api.pupils.update(id, {
      admissionNo: form.admissionNo || undefined,
      fullName: form.fullName,
      gender: form.gender || undefined,
      dob: form.dob || undefined,
      classId: form.classId || undefined,
      address: form.address || undefined,
      bloodGroup: form.bloodGroup || undefined,
      allergies: form.allergies || undefined,
      medicalInfo: form.medicalInfo || undefined,
      photoUrl: form.photoUrl || undefined,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["pupils"] }); toast.success("Pupil updated"); setEditing(null); },
    onError: (e: any) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.pupils.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["pupils"] }); toast.success("Pupil deleted"); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <>
      <PageHeader title="Pupils" description="Manage enrolled pupils"
        actions={
          <>
            <Button variant="outline" onClick={() => setImportOpen(true)}><Upload className="h-4 w-4 mr-1" /> Bulk import</Button>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" /> Add pupil</Button></DialogTrigger>
              <PupilForm onSubmit={(f: any) => create.mutate(f)} classes={classes} guardians={guardians} />
            </Dialog>
          </>
        } />
      <BulkImport open={importOpen} onClose={() => setImportOpen(false)} classes={classes} onDone={() => qc.invalidateQueries({ queryKey: ["pupils"] })} />
      <div className="p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <Input className="pl-9" placeholder="Search name or admission no…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          {!isLoading && (
            <span className="text-[12px] text-muted-foreground shrink-0">
              {pupils.length.toLocaleString()} {pupils.length === 1 ? "pupil" : "pupils"}
            </span>
          )}
        </div>
        <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead className="w-10" />
                <TableHead>Name</TableHead>
                <TableHead>Admission</TableHead>
                <TableHead>Class</TableHead>
                <TableHead>Gender</TableHead>
                <TableHead>Date of birth</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell><div className="h-8 w-8 rounded-full bg-muted animate-pulse" /></TableCell>
                    <TableCell><div className="h-4 w-36 rounded bg-muted animate-pulse" /></TableCell>
                    <TableCell><div className="h-4 w-20 rounded bg-muted animate-pulse" /></TableCell>
                    <TableCell><div className="h-4 w-16 rounded bg-muted animate-pulse" /></TableCell>
                    <TableCell><div className="h-4 w-12 rounded bg-muted animate-pulse" /></TableCell>
                    <TableCell><div className="h-4 w-20 rounded bg-muted animate-pulse" /></TableCell>
                    <TableCell><div className="h-5 w-14 rounded-full bg-muted animate-pulse" /></TableCell>
                  </TableRow>
                ))
              ) : pupils.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-12">
                    No pupils found.
                  </TableCell>
                </TableRow>
              ) : (
                pupils.map((p) => {
                  const initials = p.fullName
                    .split(" ")
                    .slice(0, 2)
                    .map((n) => n[0])
                    .join("")
                    .toUpperCase();
                  const hue = (p.fullName.charCodeAt(0) * 37 + (p.fullName.charCodeAt(1) ?? 0) * 13) % 360;
                  const statusVariant =
                    p.status === "ACTIVE" ? "success"
                    : p.status === "INACTIVE" ? "secondary"
                    : p.status === "SUSPENDED" ? "warning"
                    : p.status === "EXPELLED" ? "destructive"
                    : "outline";
                  const classLabel = p.schoolClass
                    ? `${p.schoolClass.name}${p.schoolClass.stream ? " " + p.schoolClass.stream : ""}`
                    : null;
                  return (
                    <TableRow key={p.id} className="group hover:bg-muted/30 transition-colors">
                      <TableCell className="py-2.5">
                        {p.photoUrl ? (
                          <img
                            src={p.photoUrl}
                            alt={p.fullName}
                            className="h-8 w-8 rounded-full object-cover border border-border/50"
                          />
                        ) : (
                          <div
                            className="h-8 w-8 rounded-full flex items-center justify-center text-[11px] font-bold text-white shrink-0 select-none"
                            style={{ background: `oklch(0.62 0.14 ${hue}deg)` }}
                          >
                            {initials}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="font-medium py-2.5">{p.fullName}</TableCell>
                      <TableCell className="font-mono text-[11.5px] text-muted-foreground py-2.5">
                        {p.admissionNo}
                      </TableCell>
                      <TableCell className="py-2.5">
                        {classLabel ? (
                          <span className="inline-flex items-center rounded-md bg-primary/7 px-2 py-0.5 text-[11.5px] font-medium text-primary/80 border border-primary/10">
                            {classLabel}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-[13px] py-2.5">{p.gender ?? "—"}</TableCell>
                      <TableCell className="text-[13px] py-2.5">
                        {p.dob
                          ? new Date(p.dob).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })
                          : "—"}
                      </TableCell>
                      <TableCell className="py-2.5">
                        <Badge variant={statusVariant as any}>
                          {p.status.charAt(0) + p.status.slice(1).toLowerCase()}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right py-2.5">
                        <Button variant="ghost" size="sm" onClick={() => setEditing(p)}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="sm" onClick={() => { if (confirm(`Delete pupil "${p.fullName}"?`)) remove.mutate(p.id); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </div>
      {editing && (
        <Dialog open onOpenChange={() => setEditing(null)}>
          <PupilEditForm pupil={editing} classes={classes} onSubmit={(f: any) => update.mutate({ id: editing.id, ...f })} />
        </Dialog>
      )}
    </>
  );
}

function PupilForm({ onSubmit, classes, guardians }: any) {
  const [form, setForm] = useState({
    admissionNo: "", fullName: "", gender: "", dob: "", classId: "",
    address: "", bloodGroup: "", allergies: "", medicalInfo: "", photoUrl: "",
    gMode: "existing" as "new" | "existing",
    gExistingId: "", gFullName: "", gRelationship: "", gPhone: "", gEmail: "", gTemporaryPassword: "",
  });
  const set = (k: string, v: any) => setForm({ ...form, [k]: v });
  const [gSearch, setGSearch] = useState("");
  const filtered = guardians.filter((g: any) => {
    const s = gSearch.toLowerCase().trim();
    return !s || (g.fullName || "").toLowerCase().includes(s) || (g.phone || "").toLowerCase().includes(s);
  });
  const effectiveMode = guardians.length === 0 ? "new" : form.gMode;
  return (
    <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
      <DialogHeader><DialogTitle>Admit a new pupil</DialogTitle></DialogHeader>
      <Tabs defaultValue="bio" className="w-full">
        <TabsList className="grid grid-cols-4 w-full">
          <TabsTrigger value="bio">Bio</TabsTrigger>
          <TabsTrigger value="academic">Academic</TabsTrigger>
          <TabsTrigger value="guardian">Guardian</TabsTrigger>
          <TabsTrigger value="welfare">Welfare</TabsTrigger>
        </TabsList>
        <TabsContent value="bio" className="space-y-3 pt-2">
          <div><Label>Full name *</Label><Input value={form.fullName} onChange={(e) => set("fullName", e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Date of birth</Label><Input type="date" value={form.dob} onChange={(e) => set("dob", e.target.value)} /></div>
            <div><Label>Gender</Label>
              <Select value={form.gender} onValueChange={(v) => set("gender", v)}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent><SelectItem value="Male">Male</SelectItem><SelectItem value="Female">Female</SelectItem></SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Admission no</Label><Input placeholder="auto-generated" value={form.admissionNo} onChange={(e) => set("admissionNo", e.target.value)} /></div>
            <div><Label>Blood group</Label>
              <Select value={form.bloodGroup} onValueChange={(v) => set("bloodGroup", v)}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>{["A+","A-","B+","B-","AB+","AB-","O+","O-","Unknown"].map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div><Label>Address</Label><Textarea rows={2} value={form.address} onChange={(e) => set("address", e.target.value)} /></div>
          <div><Label>Photo URL</Label><Input placeholder="https://…" value={form.photoUrl} onChange={(e) => set("photoUrl", e.target.value)} /></div>
        </TabsContent>
        <TabsContent value="academic" className="space-y-3 pt-2">
          <div><Label>Class</Label>
            <Select value={form.classId} onValueChange={(v) => set("classId", v)}>
              <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>{classes.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}{c.stream ? " " + c.stream : ""}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </TabsContent>
        <TabsContent value="guardian" className="space-y-3 pt-2">
          <div className="flex gap-2">
            <Button type="button" size="sm" variant={effectiveMode === "existing" ? "default" : "outline"} onClick={() => set("gMode", "existing")} disabled={guardians.length === 0}>Link existing parent</Button>
            <Button type="button" size="sm" variant={effectiveMode === "new" ? "default" : "outline"} onClick={() => set("gMode", "new")}>Create new parent</Button>
          </div>
          {effectiveMode === "existing" ? (
            <div className="space-y-2">
              <Input placeholder="Search parent…" value={gSearch} onChange={(e) => setGSearch(e.target.value)} />
              <Select value={form.gExistingId} onValueChange={(v) => set("gExistingId", v)}>
                <SelectTrigger><SelectValue placeholder={`Pick from ${filtered.length} parents…`} /></SelectTrigger>
                <SelectContent>{filtered.map((g: any) => <SelectItem key={g.id} value={g.id}>{g.fullName}{g.phone ? ` · ${g.phone}` : ""}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Full name</Label><Input value={form.gFullName} onChange={(e) => set("gFullName", e.target.value)} /></div>
                <div><Label>Relationship</Label>
                  <Select value={form.gRelationship} onValueChange={(v) => set("gRelationship", v)}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>{["Father","Mother","Guardian","Grandparent","Uncle","Aunt","Sibling","Other"].map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Phone</Label><Input value={form.gPhone} onChange={(e) => set("gPhone", e.target.value)} /></div>
                <div><Label>Email</Label><Input type="email" value={form.gEmail} onChange={(e) => set("gEmail", e.target.value)} /></div>
              </div>
              <div>
                <Label>Temporary parent login password</Label>
                <Input type="password" value={form.gTemporaryPassword} onChange={(e) => set("gTemporaryPassword", e.target.value)} placeholder="At least 8 characters (optional)" />
                <p className="text-xs text-muted-foreground mt-1">Provide this to create the parent's portal login immediately.</p>
              </div>
            </>
          )}
        </TabsContent>
        <TabsContent value="welfare" className="space-y-3 pt-2">
          <div><Label>Medical info</Label><Textarea rows={2} value={form.medicalInfo} onChange={(e) => set("medicalInfo", e.target.value)} /></div>
          <div><Label>Allergies</Label><Input value={form.allergies} onChange={(e) => set("allergies", e.target.value)} /></div>
        </TabsContent>
      </Tabs>
      <DialogFooter><Button onClick={() => onSubmit(form)} disabled={!form.fullName}>Admit pupil</Button></DialogFooter>
    </DialogContent>
  );
}

function PupilEditForm({ pupil, classes, onSubmit }: any) {
  const [form, setForm] = useState({
    admissionNo: pupil.admissionNo ?? "",
    fullName: pupil.fullName ?? "",
    gender: pupil.gender ?? "",
    dob: pupil.dob ?? "",
    classId: pupil.schoolClass?.id ?? pupil.classId ?? "",
    address: pupil.address ?? "",
    bloodGroup: pupil.bloodGroup ?? "",
    allergies: pupil.allergies ?? "",
    medicalInfo: pupil.medicalInfo ?? "",
    photoUrl: pupil.photoUrl ?? "",
  });
  const set = (k: string, v: any) => setForm({ ...form, [k]: v });
  return (
    <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
      <DialogHeader><DialogTitle>Edit pupil</DialogTitle></DialogHeader>
      <Tabs defaultValue="bio" className="w-full">
        <TabsList className="grid grid-cols-3 w-full">
          <TabsTrigger value="bio">Bio</TabsTrigger>
          <TabsTrigger value="academic">Academic</TabsTrigger>
          <TabsTrigger value="welfare">Welfare</TabsTrigger>
        </TabsList>
        <TabsContent value="bio" className="space-y-3 pt-2">
          <div><Label>Full name *</Label><Input value={form.fullName} onChange={(e) => set("fullName", e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Date of birth</Label><Input type="date" value={form.dob} onChange={(e) => set("dob", e.target.value)} /></div>
            <div><Label>Gender</Label>
              <Select value={form.gender} onValueChange={(v) => set("gender", v)}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent><SelectItem value="Male">Male</SelectItem><SelectItem value="Female">Female</SelectItem></SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Admission no</Label><Input value={form.admissionNo} onChange={(e) => set("admissionNo", e.target.value)} /></div>
            <div><Label>Blood group</Label>
              <Select value={form.bloodGroup} onValueChange={(v) => set("bloodGroup", v)}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>{["A+","A-","B+","B-","AB+","AB-","O+","O-","Unknown"].map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div><Label>Address</Label><Textarea rows={2} value={form.address} onChange={(e) => set("address", e.target.value)} /></div>
          <div><Label>Photo URL</Label><Input placeholder="https://…" value={form.photoUrl} onChange={(e) => set("photoUrl", e.target.value)} /></div>
        </TabsContent>
        <TabsContent value="academic" className="space-y-3 pt-2">
          <div><Label>Class</Label>
            <Select value={form.classId} onValueChange={(v) => set("classId", v)}>
              <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>{classes.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}{c.stream ? " " + c.stream : ""}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </TabsContent>
        <TabsContent value="welfare" className="space-y-3 pt-2">
          <div><Label>Medical info</Label><Textarea rows={2} value={form.medicalInfo} onChange={(e) => set("medicalInfo", e.target.value)} /></div>
          <div><Label>Allergies</Label><Input value={form.allergies} onChange={(e) => set("allergies", e.target.value)} /></div>
        </TabsContent>
      </Tabs>
      <DialogFooter><Button onClick={() => onSubmit(form)} disabled={!form.fullName}>Save changes</Button></DialogFooter>
    </DialogContent>
  );
}

function BulkImport({ open, onClose, classes, onDone }: any) {
  const [rows, setRows] = useState<any[]>([]);
  const [defaultClass, setDefaultClass] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0, errors: 0 });

  function parseCsv(text: string) {
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    if (lines.length === 0) return [];
    const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
    return lines.slice(1).map((line) => {
      const cells = line.split(",").map((c) => c.trim());
      const r: any = {};
      headers.forEach((h, i) => (r[h] = cells[i] ?? ""));
      return r;
    });
  }
  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    const text = await file.text();
    setRows(parseCsv(text));
  }
  async function run() {
    setBusy(true);
    let done = 0, errors = 0;
    setProgress({ done: 0, total: rows.length, errors: 0 });
    for (const r of rows) {
      const className = (r.class ?? "").toLowerCase();
      const cls = classes.find((c: any) => `${c.name}${c.stream ? " " + c.stream : ""}`.toLowerCase() === className);
      try {
        await api.pupils.create({ fullName: r.full_name || r.name || "", admissionNo: r.admission_no || undefined, gender: r.gender || undefined, dob: r.dob || undefined, classId: cls?.id ?? defaultClass ?? undefined });
      } catch { errors++; }
      done++;
      setProgress({ done, total: rows.length, errors });
    }
    setBusy(false);
    toast.success(`Imported ${done - errors} pupils${errors ? `, ${errors} failed` : ""}`);
    onDone(); setRows([]); onClose();
  }
  function downloadTemplate() {
    const csv = "full_name,admission_no,gender,dob,class\nJane Doe,,Female,2015-04-12,Grade 3 A\n";
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "pupils-template.csv"; a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader><DialogTitle>Bulk import pupils</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-2 text-sm">
            <p className="text-muted-foreground">Upload a CSV: <code className="font-mono">full_name, admission_no, gender, dob, class</code></p>
            <Button variant="outline" size="sm" onClick={downloadTemplate}><Download className="h-4 w-4 mr-1" /> Template</Button>
          </div>
          <Input type="file" accept=".csv" onChange={onFile} />
          <div>
            <Label>Default class</Label>
            <Select value={defaultClass} onValueChange={setDefaultClass}>
              <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
              <SelectContent>{classes.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}{c.stream ? " " + c.stream : ""}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          {rows.length > 0 && (
            <div className="rounded-md border bg-muted/40 p-3 text-sm">
              <p className="font-medium">{rows.length} rows ready</p>
              {busy && <p className="text-xs mt-1">Importing {progress.done}/{progress.total} ({progress.errors} errors)</p>}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button onClick={run} disabled={!rows.length || busy}>{busy ? "Importing…" : `Import ${rows.length}`}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
