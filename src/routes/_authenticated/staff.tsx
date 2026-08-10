import { createFileRoute } from "@tanstack/react-router";
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
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { money } from "@/lib/format";

export const Route = createFileRoute("/_authenticated/staff")({
  head: () => ({ meta: [{ title: "Staff" }] }),
  component: Staff,
});

function Staff() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Staff | null>(null);
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
            <TableHeader><TableRow><TableHead>Staff #</TableHead><TableHead>Name</TableHead><TableHead>Role</TableHead><TableHead>Phone</TableHead><TableHead>Salary</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
            <TableBody>
              {staff.length === 0 ? <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No staff yet.</TableCell></TableRow>
                : staff.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-mono text-xs">{s.staffNo}</TableCell>
                    <TableCell className="font-medium">{s.fullName}</TableCell>
                    <TableCell>{s.isTeacher ? "Teacher" : "Staff"}</TableCell>
                    <TableCell>{s.phone ?? "—"}</TableCell>
                    <TableCell>{money(s.basicSalary ?? 0)}</TableCell>
                    <TableCell><Badge variant={s.status === "ACTIVE" ? "default" : "secondary"}>{s.status}</Badge></TableCell>
                    <TableCell className="text-right">
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
    </>
  );
}

function StaffForm({ onSubmit, initial }: any) {
  const [f, setF] = useState({
    fullName: initial?.fullName ?? "", staffNo: initial?.staffNo ?? "", email: initial?.email ?? "", phone: initial?.phone ?? "",
    gender: initial?.gender ?? "", dob: initial?.dob ?? "", address: initial?.address ?? "",
    qualifications: initial?.qualifications ?? "", employmentType: initial?.employmentType ?? "FULL_TIME",
    dateJoined: initial?.dateJoined ?? new Date().toISOString().slice(0, 10),
    basicSalary: initial?.basicSalary ?? 0, bankName: initial?.bankName ?? "", bankAccount: initial?.bankAccount ?? "",
    nextOfKin: initial?.nextOfKin ?? "", photoUrl: initial?.photoUrl ?? "", isTeacher: initial?.isTeacher ?? true,
  });
  const set = (k: string, v: any) => setF({ ...f, [k]: v });
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
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Next of kin</Label><Input placeholder="Name & phone" value={f.nextOfKin} onChange={(e) => set("nextOfKin", e.target.value)} /></div>
            <div><Label>Photo URL</Label><Input placeholder="https://…" value={f.photoUrl} onChange={(e) => set("photoUrl", e.target.value)} /></div>
          </div>
        </TabsContent>
        <TabsContent value="employment" className="space-y-3">
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
      <DialogFooter><Button onClick={() => onSubmit(f)} disabled={!f.fullName}>Save</Button></DialogFooter>
    </DialogContent>
  );
}
