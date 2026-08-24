import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api, type Guardian } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Link2, KeyRound, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useQueries } from "@tanstack/react-query";
import { useAuth, hasPermission } from "@/lib/auth";
import { usePagination } from "@/hooks/use-pagination";
import { PaginationBar } from "@/components/PaginationBar";

export const Route = createFileRoute("/_authenticated/guardians")({
  head: () => ({ meta: [{ title: "Parents & guardians" }] }),
  component: Guardians,
});

function Guardians() {
  const qc = useQueryClient();
  const { permissions } = useAuth();
  const canManage = hasPermission(permissions, "guardians:manage");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Guardian | null>(null);
  const [linkFor, setLinkFor] = useState<string | null>(null);
  const [accountFor, setAccountFor] = useState<Guardian | null>(null);

  const { data: guardians = [] } = useQuery({
    queryKey: ["guardians"],
    queryFn: () => api.guardians.list(),
  });

  const { pageItems: pagedGuardians, page, setPage, totalPages, pageSize, total } = usePagination(guardians, 25);

  // Only fetch linked-pupils for the guardians actually shown on this page — this was firing
  // one request per guardian in the whole school on every load, which only stayed unnoticed
  // because no list here ever got large enough to make it visible.
  const pupilQueries = useQueries({
    queries: pagedGuardians.map((g) => ({
      queryKey: ["guardian-pupils", g.id],
      queryFn: () => api.guardians.pupilsFor(g.id),
      enabled: pagedGuardians.length > 0,
    })),
  });
  const pupilsByGuardian = new Map(pagedGuardians.map((g, i) => [g.id, pupilQueries[i]?.data ?? []]));

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["guardians"] });
    qc.invalidateQueries({ queryKey: ["guardian-pupils"] });
  };

  const create = useMutation({
    mutationFn: (f: any) => api.guardians.create(f),
    onSuccess: () => { invalidate(); toast.success("Parent added"); setOpen(false); },
    onError: (e: any) => toast.error(e.message),
  });
  const update = useMutation({
    mutationFn: ({ id, ...f }: any) => api.guardians.update(id, f),
    onSuccess: () => { invalidate(); toast.success("Parent updated"); setEditing(null); },
    onError: (e: any) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.guardians.delete(id),
    onSuccess: () => { invalidate(); toast.success("Parent deleted"); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <>
      <PageHeader title="Parents & guardians" actions={
        canManage ? (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" /> Add parent</Button></DialogTrigger>
            <GuardianForm onSubmit={(f: any) => create.mutate(f)} />
          </Dialog>
        ) : undefined
      } />
      <div className="p-6">
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Relationship</TableHead><TableHead>Phone</TableHead><TableHead>Email</TableHead><TableHead>Linked pupil(s)</TableHead><TableHead>Login</TableHead><TableHead></TableHead></TableRow></TableHeader>
            <TableBody>
              {guardians.length === 0 ? <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No parents yet.</TableCell></TableRow>
                : pagedGuardians.map((g) => {
                  const linkedPupils = pupilsByGuardian.get(g.id) ?? [];
                  return (
                    <TableRow key={g.id}>
                      <TableCell className="font-medium">
                        <Link to="/guardians/$guardianId" params={{ guardianId: g.id }} className="hover:underline">{g.fullName}</Link>
                      </TableCell>
                      <TableCell>{g.relationship ?? "—"}</TableCell>
                      <TableCell>{g.phone ?? "—"}</TableCell>
                      <TableCell>{g.email ?? "—"}</TableCell>
                      <TableCell>
                        {linkedPupils.length === 0 ? (
                          <span className="text-muted-foreground">—</span>
                        ) : (
                          <div className="flex flex-wrap gap-1">
                            {linkedPupils.map((p) => (
                              <span key={p.id} className="inline-flex items-center rounded-md bg-primary/7 px-2 py-0.5 text-[11.5px] font-medium text-primary/80 border border-primary/10">
                                {p.fullName}
                              </span>
                            ))}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className={`text-xs font-medium ${g.userId ? "text-green-600" : "text-muted-foreground"}`}>
                          {g.userId ? "Active" : "Not created"}
                        </span>
                      </TableCell>
                      <TableCell>
                        {canManage && (
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="sm" onClick={() => setLinkFor(g.id)}><Link2 className="h-4 w-4 mr-1" /> Link pupil</Button>
                            <Button variant="ghost" size="sm" disabled={!g.email} onClick={() => setAccountFor(g)}>
                              <KeyRound className="h-4 w-4 mr-1" /> {g.userId ? "Reset login" : "Create login"}
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => setEditing(g)}><Pencil className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="sm" onClick={() => { if (confirm(`Delete parent "${g.fullName}"?`)) remove.mutate(g.id); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
            </TableBody>
          </Table>
        </div>
        <PaginationBar page={page} totalPages={totalPages} total={total} pageSize={pageSize} onPageChange={setPage} />
      </div>
      {editing && (
        <Dialog open onOpenChange={() => setEditing(null)}>
          <GuardianForm initial={editing} onSubmit={(f: any) => update.mutate({ id: editing.id, ...f })} />
        </Dialog>
      )}
      {linkFor && <LinkPupilDialog guardianId={linkFor} onClose={() => { setLinkFor(null); invalidate(); }} />}
      {accountFor && <ParentAccountDialog guardian={accountFor} onClose={() => { setAccountFor(null); invalidate(); }} />}
    </>
  );
}

function GuardianForm({ onSubmit, initial }: any) {
  const [f, setF] = useState({
    fullName: initial?.fullName ?? "", relationship: initial?.relationship ?? "Father",
    phone: initial?.phone ?? "", email: initial?.email ?? "", address: initial?.address ?? "",
    occupation: initial?.occupation ?? "", nationalId: initial?.nationalId ?? "",
    temporaryPassword: "",
  });
  const set = (k: string, v: any) => setF({ ...f, [k]: v });
  return (
    <DialogContent className="max-w-xl">
      <DialogHeader><DialogTitle>{initial ? "Edit parent / guardian" : "New parent / guardian"}</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div><Label>Full name *</Label><Input value={f.fullName} onChange={(e) => set("fullName", e.target.value)} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Relationship</Label>
            <Select value={f.relationship} onValueChange={(v) => set("relationship", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {["Father","Mother","Guardian","Sibling","Other"].map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div><Label>Phone</Label><Input value={f.phone} onChange={(e) => set("phone", e.target.value)} /></div>
        </div>
        <div><Label>Email</Label><Input type="email" value={f.email} onChange={(e) => set("email", e.target.value)} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Occupation</Label><Input value={f.occupation} onChange={(e) => set("occupation", e.target.value)} /></div>
          <div><Label>National ID</Label><Input value={f.nationalId} onChange={(e) => set("nationalId", e.target.value)} /></div>
        </div>
        {!initial && (
          <div>
            <Label>Temporary login password</Label>
            <Input type="password" value={f.temporaryPassword} onChange={(e) => set("temporaryPassword", e.target.value)} placeholder="At least 8 characters (optional)" />
            <p className="text-xs text-muted-foreground mt-1">When supplied, a parent login is created and the parent will be asked to change it.</p>
          </div>
        )}
        <div><Label>Address</Label><Textarea rows={2} value={f.address} onChange={(e) => set("address", e.target.value)} /></div>
      </div>
      <DialogFooter><Button onClick={() => onSubmit(f)} disabled={!f.fullName}>Save</Button></DialogFooter>
    </DialogContent>
  );
}

function ParentAccountDialog({ guardian, onClose }: { guardian: Guardian; onClose: () => void }) {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true);
    try {
      await api.guardians.provisionAccount(guardian.id, password);
      toast.success(guardian.userId ? "Parent password reset" : "Parent login created");
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
        <DialogHeader><DialogTitle>{guardian.userId ? "Reset parent login" : "Create parent login"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">Login email: <span className="font-medium text-foreground">{guardian.email}</span></p>
          <div><Label>Temporary password</Label><Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" /></div>
          <p className="text-xs text-muted-foreground">The parent will be required to change this password after signing in.</p>
        </div>
        <DialogFooter><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={save} disabled={password.length < 8 || busy}>{busy ? "Saving…" : "Save login"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function LinkPupilDialog({ guardianId, onClose }: any) {
  const [pupilId, setPupilId] = useState("");
  const { data: pupils = [] } = useQuery({ queryKey: ["pupils-pick"], queryFn: () => api.pupils.all() });
  async function link() {
    try {
      await api.guardians.link(guardianId, pupilId, true);
      toast.success("Linked");
      onClose();
    } catch (e: any) { toast.error(e.message); }
  }
  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader><DialogTitle>Link a pupil</DialogTitle></DialogHeader>
        <Select value={pupilId} onValueChange={setPupilId}>
          <SelectTrigger><SelectValue placeholder="Select pupil" /></SelectTrigger>
          <SelectContent>{pupils.map((p) => <SelectItem key={p.id} value={p.id}>{p.fullName} ({p.admissionNo})</SelectItem>)}</SelectContent>
        </Select>
        <DialogFooter><Button onClick={link} disabled={!pupilId}>Link</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
