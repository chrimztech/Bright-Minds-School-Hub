import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api, type Staff } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ImageUploadField } from "@/components/ImageUploadField";
import { Plus, Pencil, Trash2, KeyRound } from "lucide-react";
import { toast } from "sonner";
import { money } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/staff")({
  head: () => ({ meta: [{ title: "Staff" }] }),
  component: Staff,
});

const ROLE_CATEGORIES = [
  "Head Teacher", "Deputy Head", "Teacher", "Executive Director", "Manager",
  "Financial Officer", "Administrator", "Librarian", "Driver", "Cook",
  "Cleaner", "Security Guard", "Nurse", "General Worker", "Other",
];

function Staff() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Staff | null>(null);
  const [accountFor, setAccountFor] = useState<Staff | null>(null);
  const { data: staff = [] } = useQuery({
    queryKey: ["staff"],
    queryFn: () => api.staff.all(),
  });
  const create = useMutation({
    mutationFn: (f: any) => api.staff.create(f),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["staff"] }); toast.success("Staff added"); setOpen(false); },
    onError: (e: any) => toast.error(e.message),
  });
  const update = useMutation({
    mutationFn: ({ id, ...f }: any) => api.staff.update(id, f),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["staff"] }); toast.success("Staff updated"); setEditing(null); },
    onError: (e: any) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.staff.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["staff"] }); toast.success("Staff deleted"); },
    onError: (e: any) => toast.error(e.message),
  });
  return (
    <>
      <PageHeader title="Teachers & staff" actions={
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" /> Add staff</Button></DialogTrigger>
          <StaffForm onSubmit={(f: any) => create.mutate(f)} />
        </Dialog>
      } />
      <div className="p-6">
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader><TableRow><TableHead>Staff #</TableHead><TableHead>Name</TableHead><TableHead>Role</TableHead><TableHead>Contract end</TableHead><TableHead>Phone</TableHead><TableHead>Salary</TableHead><TableHead>Login</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
            <TableBody>
              {staff.length === 0 ? <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground py-8">No staff yet.</TableCell></TableRow>
                : staff.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-mono text-xs">{s.staffNo}</TableCell>
                    <TableCell className="font-medium">
                      <Link to="/staff/$staffId" params={{ staffId: s.id }} className="hover:underline">{s.fullName}</Link>
                    </TableCell>
                    <TableCell>{s.roleCategory ?? (s.isTeacher ? "Teacher" : "—")}</TableCell>
                    <TableCell>{s.employmentType === "CONTRACT" && s.contractEndDate ? new Date(s.contractEndDate).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "—"}</TableCell>
                    <TableCell>{s.phone ?? "—"}</TableCell>
                    <TableCell>{money(s.basicSalary ?? 0)}</TableCell>
                    <TableCell>
                      <span className={`text-xs font-medium ${s.userId ? "text-green-600" : "text-muted-foreground"}`}>
                        {s.userId ? "Active" : "Not created"}
                      </span>
                    </TableCell>
                    <TableCell><Badge variant={s.status === "ACTIVE" ? "default" : "secondary"}>{s.status}</Badge></TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" disabled={!s.email} onClick={() => setAccountFor(s)}>
                        <KeyRound className="h-4 w-4 mr-1" /> {s.userId ? "Reset login" : "Create login"}
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setEditing(s)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="sm" onClick={() => { if (confirm(`Delete staff "${s.fullName}"?`)) remove.mutate(s.id); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </div>
      </div>
      {editing && (
        <Dialog open onOpenChange={() => setEditing(null)}>
          <StaffForm initial={editing} onSubmit={(f: any) => update.mutate({ id: editing.id, ...f })} />
        </Dialog>
      )}
      {accountFor && (
        <StaffAccountDialog staff={accountFor} onClose={() => { setAccountFor(null); qc.invalidateQueries({ queryKey: ["staff"] }); }} />
      )}
    </>
  );
}

function StaffAccountDialog({ staff, onClose }: { staff: Staff; onClose: () => void }) {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true);
    try {
      await api.staff.provisionAccount(staff.id, password);
      toast.success(staff.userId ? "Login reset" : `Login created${staff.isTeacher ? " with TEACHER access" : ""}`);
      onClose();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>{staff.userId ? "Reset staff login" : "Create staff login"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">Login email: <span className="font-medium text-foreground">{staff.email}</span></p>
          {!staff.userId && (
            <p className="text-xs text-muted-foreground">
              {staff.isTeacher
                ? "This will create a login with TEACHER access, so they can sign in and see classes assigned to them."
                : "This creates a login with no role yet — assign one afterwards under Users & Roles."}
            </p>
          )}
          <div><Label>Temporary password</Label><Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" /></div>
          <p className="text-xs text-muted-foreground">The staff member will be required to change this password after signing in.</p>
        </div>
        <DialogFooter><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={save} disabled={password.length < 8 || busy}>{busy ? "Saving…" : "Save login"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function StaffForm({ onSubmit, initial }: any) {
  const initialCategory = initial?.roleCategory ?? "";
  const isKnownCategory = ROLE_CATEGORIES.slice(0, -1).includes(initialCategory);
  const [f, setF] = useState({
    fullName: initial?.fullName ?? "", staffNo: initial?.staffNo ?? "", email: initial?.email ?? "", phone: initial?.phone ?? "",
    gender: initial?.gender ?? "", dob: initial?.dob ?? "", address: initial?.address ?? "",
    qualifications: initial?.qualifications ?? "", employmentType: initial?.employmentType ?? "FULL_TIME",
    contractEndDate: initial?.contractEndDate ?? "",
    dateJoined: initial?.dateJoined ?? new Date().toISOString().slice(0, 10),
    basicSalary: initial?.basicSalary ?? 0, bankName: initial?.bankName ?? "", bankAccount: initial?.bankAccount ?? "",
    nextOfKin: initial?.nextOfKin ?? "", photoUrl: initial?.photoUrl ?? "", signatureUrl: initial?.signatureUrl ?? "", isTeacher: initial?.isTeacher ?? true,
    roleCategory: isKnownCategory ? initialCategory : (initialCategory ? "Other" : ""),
    roleCategoryOther: isKnownCategory ? "" : initialCategory,
    temporaryPassword: "",
  });
  const set = (k: string, v: any) => setF({ ...f, [k]: v });
  const submit = () => {
    const { roleCategoryOther, temporaryPassword, ...rest } = f;
    onSubmit({
      ...rest,
      roleCategory: f.roleCategory === "Other" ? roleCategoryOther : f.roleCategory || undefined,
      dob: f.dob || undefined,
      dateJoined: f.dateJoined || undefined,
      contractEndDate: f.contractEndDate || undefined,
      temporaryPassword: temporaryPassword || undefined,
    });
  };
  return (
    <DialogContent className="max-w-2xl">
      <DialogHeader><DialogTitle>{initial ? "Edit staff member" : "New staff member"}</DialogTitle></DialogHeader>
      <Tabs defaultValue="bio" className="w-full">
        <TabsList className="grid grid-cols-3 w-full">
          <TabsTrigger value="bio">Personal</TabsTrigger>
          <TabsTrigger value="employment">Employment</TabsTrigger>
          <TabsTrigger value="payroll">Payroll & Bank</TabsTrigger>
        </TabsList>
        <TabsContent value="bio" className="space-y-3">
          <div><Label>Full name *</Label><Input value={f.fullName} onChange={(e) => set("fullName", e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Staff #</Label><Input placeholder="auto" value={f.staffNo} onChange={(e) => set("staffNo", e.target.value)} /></div>
            <div><Label>Date of birth</Label><Input type="date" value={f.dob} onChange={(e) => set("dob", e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Gender</Label>
              <Select value={f.gender} onValueChange={(v) => set("gender", v)}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent><SelectItem value="Male">Male</SelectItem><SelectItem value="Female">Female</SelectItem></SelectContent>
              </Select>
            </div>
            <div><Label>Phone</Label><Input value={f.phone} onChange={(e) => set("phone", e.target.value)} /></div>
          </div>
          <div><Label>Email</Label><Input type="email" value={f.email} onChange={(e) => set("email", e.target.value)} /></div>
          <div><Label>Address</Label><Input value={f.address} onChange={(e) => set("address", e.target.value)} /></div>
          <div><Label>Next of kin</Label><Input placeholder="Name & phone" value={f.nextOfKin} onChange={(e) => set("nextOfKin", e.target.value)} /></div>
          <div>
            <Label>Photo</Label>
            <ImageUploadField value={f.photoUrl} onChange={(url) => set("photoUrl", url)} />
          </div>
          <div>
            <Label>Signature</Label>
            <ImageUploadField value={f.signatureUrl} onChange={(url) => set("signatureUrl", url)} placeholder="https://… (image of their signature)" />
            <p className="text-xs text-muted-foreground mt-1">Used to stamp their signature on report cards when they're a class teacher.</p>
          </div>
          {!initial && (
            <div>
              <Label>Temporary login password</Label>
              <Input type="password" value={f.temporaryPassword} onChange={(e) => set("temporaryPassword", e.target.value)} placeholder="At least 8 characters (optional)" />
              <p className="text-xs text-muted-foreground mt-1">Requires an email above. When supplied, a login is created immediately — teachers get access to their assigned classes.</p>
            </div>
          )}
        </TabsContent>
        <TabsContent value="employment" className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Role / position</Label>
              <Select value={f.roleCategory} onValueChange={(v) => set("roleCategory", v)}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>{ROLE_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {f.roleCategory === "Other" && (
              <div><Label>Specify role</Label><Input value={f.roleCategoryOther} onChange={(e) => set("roleCategoryOther", e.target.value)} /></div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Employment type</Label>
              <Select value={f.employmentType} onValueChange={(v) => set("employmentType", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="FULL_TIME">Full time</SelectItem>
                  <SelectItem value="PART_TIME">Part time</SelectItem>
                  <SelectItem value="CONTRACT">Contract</SelectItem>
                  <SelectItem value="INTERN">Intern</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Date joined</Label><Input type="date" value={f.dateJoined} onChange={(e) => set("dateJoined", e.target.value)} /></div>
          </div>
          {f.employmentType === "CONTRACT" && (
            <div><Label>Contract end date</Label><Input type="date" value={f.contractEndDate} onChange={(e) => set("contractEndDate", e.target.value)} /></div>
          )}
          <div><Label>Qualifications</Label><Textarea rows={2} value={f.qualifications} onChange={(e) => set("qualifications", e.target.value)} /></div>
          <div className="flex items-center gap-2 pt-2"><Switch checked={f.isTeacher} onCheckedChange={(v) => set("isTeacher", v)} /><Label>Is teacher</Label></div>
        </TabsContent>
        <TabsContent value="payroll" className="space-y-3">
          <div><Label>Basic salary</Label><Input type="number" value={f.basicSalary} onChange={(e) => set("basicSalary", Number(e.target.value))} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Bank name</Label><Input value={f.bankName} onChange={(e) => set("bankName", e.target.value)} /></div>
            <div><Label>Bank account</Label><Input value={f.bankAccount} onChange={(e) => set("bankAccount", e.target.value)} /></div>
          </div>
        </TabsContent>
      </Tabs>
      <DialogFooter><Button onClick={submit} disabled={!f.fullName}>Save</Button></DialogFooter>
    </DialogContent>
  );
}
