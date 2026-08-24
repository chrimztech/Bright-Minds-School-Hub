import { createFileRoute, Link } from "@tanstack/react-router";
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
import { useAuth, hasAny, ADMIN_ROLES } from "@/lib/auth";
import { ImageUploadField } from "@/components/ImageUploadField";
import { usePagination } from "@/hooks/use-pagination";
import { PaginationBar } from "@/components/PaginationBar";

export const Route = createFileRoute("/_authenticated/pupils")({
  head: () => ({ meta: [{ title: "Pupils" }] }),
  component: Pupils,
});

function Pupils() {
  const { roles } = useAuth();
  const isAdmin = hasAny(roles, ADMIN_ROLES);
  const isTeacher = roles.includes("TEACHER") && !isAdmin;
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editing, setEditing] = useState<Pupil | null>(null);

  const { data: classes = [] } = useQuery({ queryKey: ["classes"], queryFn: () => api.classes.list() });
  const { data: guardians = [] } = useQuery({ queryKey: ["guardians-pick"], queryFn: () => api.guardians.list() });
  const { data: transportRoutes = [] } = useQuery({ queryKey: ["transport-routes"], queryFn: () => api.transport.routes.list() });

  // Teachers only see pupils in the class(es) they're the class teacher for, not the
  // whole school — matches the same "my classes" scoping used on Attendance/Marks.
  const { data: myClasses = [] } = useQuery({ queryKey: ["my-classes"], enabled: isTeacher, queryFn: () => api.classes.myClasses() });
  const { data: myClassPupils = [], isLoading: myPupilsLoading } = useQuery({
    queryKey: ["teacher-pupils", myClasses.map((c) => c.id)],
    enabled: isTeacher && myClasses.length > 0,
    queryFn: async () => (await Promise.all(myClasses.map((c) => api.pupils.byClass(c.id)))).flat(),
  });

  // The paginated GET /pupils (default size=50, no page-2+ control anywhere in this UI) was
  // silently hard-capping every non-teacher role at the first 50 pupils in the school — admin,
  // head teacher and accountant all saw an incomplete list with no indication anything was
  // missing, while teachers only ever appeared unaffected because their own scoped view already
  // used the unpaginated per-class endpoint below. Switched to the same unpaginated /pupils/all
  // + client-side search every other admin list (guardians, staff, classes) already uses.
  const { data: allPupils = [], isLoading: allPupilsLoading } = useQuery({
    queryKey: ["pupils-all"],
    enabled: !isTeacher,
    queryFn: () => api.pupils.all(),
  });
  const isLoading = isTeacher ? (myClasses.length > 0 && myPupilsLoading) : allPupilsLoading;
  const [classFilter, setClassFilter] = useState("ALL");
  const [genderFilter, setGenderFilter] = useState("ALL");
  const searchedPupils = (isTeacher ? myClassPupils : allPupils).filter((p) => {
    const s = q.toLowerCase().trim();
    return !s || p.fullName.toLowerCase().includes(s) || p.admissionNo.toLowerCase().includes(s);
  });
  const pupils = searchedPupils.filter((p) =>
    (classFilter === "ALL" || p.schoolClass?.id === classFilter) &&
    (genderFilter === "ALL" || p.gender === genderFilter));
  const { pageItems: pagedPupils, page, setPage, totalPages, pageSize, total } =
    usePagination(pupils, 25, `${q}-${classFilter}-${genderFilter}`);

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
      if (form.routeId) {
        await api.transport.assignments.create({
          pupilId: pupil.id,
          routeId: form.routeId,
          pickupPointId: form.pickupPointId || undefined,
        });
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["pupils-all"] }); toast.success("Pupil added"); setOpen(false); },
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
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["pupils-all"] }); toast.success("Pupil updated"); setEditing(null); },
    onError: (e: any) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.pupils.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["pupils-all"] }); toast.success("Pupil deleted"); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <>
      <PageHeader title="Pupils" description={isTeacher ? "Pupils in your class" : "Manage enrolled pupils"}
        actions={
          isTeacher ? undefined : (
            <>
              <Button variant="outline" onClick={() => setImportOpen(true)}><Upload className="h-4 w-4 mr-1" /> Bulk import</Button>
              <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" /> Add pupil</Button></DialogTrigger>
                <PupilForm onSubmit={(f: any) => create.mutate(f)} isSubmitting={create.isPending} classes={classes} guardians={guardians} transportRoutes={transportRoutes} />
              </Dialog>
            </>
          )
        } />
      <BulkImport open={importOpen} onClose={() => setImportOpen(false)} classes={classes} onDone={() => qc.invalidateQueries({ queryKey: ["pupils-all"] })} />
      <div className="p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="relative flex-1 max-w-sm">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <Input className="pl-9" placeholder="Search name or admission no…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <Select value={classFilter} onValueChange={setClassFilter}>
            <SelectTrigger className="w-[160px]"><SelectValue placeholder="All classes" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All classes</SelectItem>
              {(isTeacher ? myClasses : classes).map((c) => <SelectItem key={c.id} value={c.id}>{c.name}{c.stream ? ` ${c.stream}` : ""}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={genderFilter} onValueChange={setGenderFilter}>
            <SelectTrigger className="w-[140px]"><SelectValue placeholder="All genders" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All genders</SelectItem>
              <SelectItem value="Male">Male</SelectItem>
              <SelectItem value="Female">Female</SelectItem>
            </SelectContent>
          </Select>
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
                pagedPupils.map((p) => {
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
                      <TableCell className="font-medium py-2.5">
                        <Link to="/pupils/$pupilId" params={{ pupilId: p.id }} className="hover:underline">{p.fullName}</Link>
                      </TableCell>
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
        <PaginationBar page={page} totalPages={totalPages} total={total} pageSize={pageSize} onPageChange={setPage} />
      </div>
      {editing && (
        <Dialog open onOpenChange={() => setEditing(null)}>
          <PupilEditForm pupil={editing} classes={classes} isSubmitting={update.isPending} onSubmit={(f: any) => update.mutate({ id: editing.id, ...f })} />
        </Dialog>
      )}
    </>
  );
}

function PupilForm({ onSubmit, isSubmitting, classes, guardians, transportRoutes = [] }: any) {
  const [form, setForm] = useState({
    admissionNo: "", fullName: "", gender: "", dob: "", classId: "",
    address: "", bloodGroup: "", allergies: "", medicalInfo: "", photoUrl: "",
    gMode: "existing" as "new" | "existing",
    gExistingId: "", gFullName: "", gRelationship: "", gPhone: "", gEmail: "", gTemporaryPassword: "",
    routeId: "", pickupPointId: "",
  });
  const set = (k: string, v: any) => setForm({ ...form, [k]: v });
  const set2 = (patch: any) => setForm({ ...form, ...patch });
  const { data: routePoints = [] } = useQuery({
    queryKey: ["route-points", form.routeId],
    enabled: !!form.routeId,
    queryFn: () => api.transport.points.list(form.routeId),
  });
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
        <TabsList className="grid grid-cols-5 w-full">
          <TabsTrigger value="bio">Bio</TabsTrigger>
          <TabsTrigger value="academic">Academic</TabsTrigger>
          <TabsTrigger value="guardian">Guardian</TabsTrigger>
          <TabsTrigger value="transport">Transport</TabsTrigger>
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
          <div><Label>Photo</Label><ImageUploadField value={form.photoUrl} onChange={(url) => set("photoUrl", url)} /></div>
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
        <TabsContent value="transport" className="space-y-3 pt-2">
          <div><Label>Route</Label>
            <Select value={form.routeId} onValueChange={(v) => set2({ routeId: v, pickupPointId: "" })}>
              <SelectTrigger><SelectValue placeholder="No transport needed" /></SelectTrigger>
              <SelectContent>{transportRoutes.map((r: any) => <SelectItem key={r.id} value={r.id}>{r.name}{r.fee ? ` — ${r.fee}` : ""}</SelectItem>)}</SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">Assigning a route bills the pickup point's transport fee (or the route's base fee if no point is picked) to this pupil automatically.</p>
          </div>
          {form.routeId && (
            <div>
              <Label>Pickup point</Label>
              <Select value={form.pickupPointId} onValueChange={(v) => set("pickupPointId", v)}>
                <SelectTrigger><SelectValue placeholder={`Route base fee — ${transportRoutes.find((r: any) => r.id === form.routeId)?.fee ?? 0}`} /></SelectTrigger>
                <SelectContent>{routePoints.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name} — {p.fee}</SelectItem>)}</SelectContent>
              </Select>
              {routePoints.length === 0 && <p className="text-xs text-muted-foreground mt-1">No priced pickup points set up for this route yet — the route's base fee will be billed.</p>}
            </div>
          )}
        </TabsContent>
        <TabsContent value="welfare" className="space-y-3 pt-2">
          <div><Label>Medical info</Label><Textarea rows={2} value={form.medicalInfo} onChange={(e) => set("medicalInfo", e.target.value)} /></div>
          <div><Label>Allergies</Label><Input value={form.allergies} onChange={(e) => set("allergies", e.target.value)} /></div>
        </TabsContent>
      </Tabs>
      <DialogFooter><Button onClick={() => onSubmit(form)} disabled={!form.fullName || isSubmitting}>{isSubmitting ? "Admitting…" : "Admit pupil"}</Button></DialogFooter>
    </DialogContent>
  );
}

function PupilEditForm({ pupil, classes, isSubmitting, onSubmit }: any) {
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
          <div><Label>Photo</Label><ImageUploadField value={form.photoUrl} onChange={(url) => set("photoUrl", url)} /></div>
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
      <DialogFooter><Button onClick={() => onSubmit(form)} disabled={!form.fullName || isSubmitting}>{isSubmitting ? "Saving…" : "Save changes"}</Button></DialogFooter>
    </DialogContent>
  );
}

function BulkImport({ open, onClose, classes, onDone }: any) {
  const [rows, setRows] = useState<any[]>([]);
  const [defaultClass, setDefaultClass] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0, errors: 0 });
  const [failures, setFailures] = useState<{ row: number; name: string; reason: string }[]>([]);
  const [parseWarning, setParseWarning] = useState("");

  // A naive line.split(",") breaks the moment any field contains a comma (an address, or a
  // name written "Last, First") — every column after it silently shifts, so a class name
  // ends up in the gender column, admission numbers look wrong, and the row fails with a
  // confusing error or imports into the wrong class. This is a minimal RFC4180-style parser:
  // it respects "quoted, fields" and doubled "" escapes, which any real CSV export (Excel,
  // Google Sheets) uses for exactly this case.
  function parseCsvLine(line: string): string[] {
    const cells: string[] = [];
    let cur = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"') {
          if (line[i + 1] === '"') { cur += '"'; i++; } else { inQuotes = false; }
        } else {
          cur += ch;
        }
      } else if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        cells.push(cur.trim());
        cur = "";
      } else {
        cur += ch;
      }
    }
    cells.push(cur.trim());
    return cells;
  }

  function parseCsv(text: string) {
    // Excel's "CSV UTF-8" export prepends a BOM to the file; left in place, it silently
    // attaches itself to the first header ("full_name" becomes "﻿full_name"), which never
    // matches, so every row's name comes through blank — imported as ghost pupils rather than
    // failing loudly.
    const clean = text.replace(/^﻿/, "");
    const lines = clean.split(/\r?\n/).filter((l) => l.trim());
    if (lines.length === 0) return [];
    const headers = parseCsvLine(lines[0]).map((h) => h.trim().toLowerCase());
    return lines.slice(1).map((line, idx) => {
      const cells = parseCsvLine(line);
      const r: any = { __line: idx + 2 }; // +2: 1-indexed, plus the header row itself
      headers.forEach((h, i) => (r[h] = cells[i] ?? ""));
      return r;
    });
  }
  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    const text = await file.text();
    const parsed = parseCsv(text);
    setRows(parsed);
    setFailures([]);
    setParseWarning(parsed.length === 0 ? "No data rows found — check the file has a header row plus at least one pupil." : "");
  }
  async function run() {
    setBusy(true);
    let done = 0, errors = 0;
    const rowFailures: typeof failures = [];
    setProgress({ done: 0, total: rows.length, errors: 0 });
    for (const r of rows) {
      const fullName = (r.full_name || r.name || "").trim();
      const className = (r.class ?? "").toLowerCase();
      const cls = classes.find((c: any) => `${c.name}${c.stream ? " " + c.stream : ""}`.toLowerCase() === className);
      if (!fullName) {
        errors++;
        rowFailures.push({ row: r.__line, name: "(blank)", reason: "Missing full_name — row skipped" });
        done++;
        setProgress({ done, total: rows.length, errors });
        continue;
      }
      try {
        await api.pupils.create({ fullName, admissionNo: r.admission_no || undefined, gender: r.gender || undefined, dob: r.dob || undefined, classId: cls?.id ?? defaultClass ?? undefined });
      } catch (e: any) {
        errors++;
        rowFailures.push({ row: r.__line, name: fullName, reason: e?.message ?? "Import failed" });
      }
      done++;
      setProgress({ done, total: rows.length, errors });
    }
    setBusy(false);
    setFailures(rowFailures);
    if (errors === 0) {
      toast.success(`Imported all ${done} pupils`);
      onDone(); setRows([]); onClose();
    } else {
      // Leave the dialog open with the failure list visible instead of closing it — a silent
      // "N failed" toast gave no way to tell which rows didn't make it in or why, which is
      // exactly what made a partial import look like pupils had vanished. Narrow `rows` down
      // to just the failed ones so clicking Import again (after fixing the CSV, or picking a
      // default class) retries only those instead of re-creating the ones that already succeeded.
      const failedLines = new Set(rowFailures.map((f) => f.row));
      setRows((prev) => prev.filter((r) => failedLines.has(r.__line)));
      toast.error(`Imported ${done - errors} of ${done} — ${errors} row${errors === 1 ? "" : "s"} failed, see details below`);
      onDone();
    }
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
          {parseWarning && <p className="text-xs text-destructive">{parseWarning}</p>}
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
          {failures.length > 0 && (
            <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm space-y-1.5 max-h-48 overflow-y-auto">
              <p className="font-medium text-destructive">{failures.length} row{failures.length === 1 ? "" : "s"} did not import:</p>
              {failures.map((f, i) => (
                <p key={i} className="text-xs text-muted-foreground">
                  Row {f.row} <span className="font-medium text-foreground">({f.name})</span> — {f.reason}
                </p>
              ))}
              <p className="text-xs text-muted-foreground pt-1">Fix these rows in your CSV and re-import just those — pupils already imported above won't be duplicated as long as you remove them from the file first.</p>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={() => { setRows([]); setFailures([]); setParseWarning(""); onClose(); }} disabled={busy}>
            {failures.length > 0 ? "Close" : "Cancel"}
          </Button>
          <Button onClick={run} disabled={!rows.length || busy}>{busy ? "Importing…" : `Import ${rows.length}`}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
