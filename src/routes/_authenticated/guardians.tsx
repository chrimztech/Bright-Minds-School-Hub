import { createFileRoute } from "@tanstack/react-router";
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
import { Plus, Link2, KeyRound } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/guardians")({
  head: () => ({ meta: [{ title: "Parents & guardians" }] }),
  component: Guardians,
});

function Guardians() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [linkFor, setLinkFor] = useState<string | null>(null);
  const [accountFor, setAccountFor] = useState<Guardian | null>(null);

  const { data: guardians = [] } = useQuery({
    queryKey: ["guardians"],
    queryFn: () => api.guardians.list(),
  });

  const create = useMutation({
    mutationFn: (f: any) => api.guardians.create(f),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["guardians"] }); toast.success("Parent added"); setOpen(false); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <>
      <PageHeader title="Parents & guardians" actions={
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" /> Add parent</Button></DialogTrigger>
          <GuardianForm onSubmit={(f: any) => create.mutate(f)} />
        </Dialog>
      } />
      <div className="p-6">
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Relationship</TableHead><TableHead>Phone</TableHead><TableHead>Email</TableHead><TableHead>Login</TableHead><TableHead></TableHead></TableRow></TableHeader>
            <TableBody>
              {guardians.length === 0 ? <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No parents yet.</TableCell></TableRow>
                : guardians.map((g) => (
                  <TableRow key={g.id}>
                    <TableCell className="font-medium">{g.fullName}</TableCell>
                    <TableCell>{g.relationship ?? "—"}</TableCell>
                    <TableCell>{g.phone ?? "—"}</TableCell>
                    <TableCell>{g.email ?? "—"}</TableCell>
                    <TableCell>
                      <span className={`text-xs font-medium ${g.userId ? "text-green-600" : "text-muted-foreground"}`}>
                        {g.userId ? "Active" : "Not created"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => setLinkFor(g.id)}><Link2 className="h-4 w-4 mr-1" /> Link pupil</Button>
                        <Button variant="ghost" size="sm" disabled={!g.email} onClick={() => setAccountFor(g)}>
                          <KeyRound className="h-4 w-4 mr-1" /> {g.userId ? "Reset login" : "Create login"}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </div>
      </div>
      {linkFor && <LinkPupilDialog guardianId={linkFor} onClose={() => { setLinkFor(null); qc.invalidateQueries({ queryKey: ["guardians"] }); }} />}
      {accountFor && <ParentAccountDialog guardian={accountFor} onClose={() => { setAccountFor(null); qc.invalidateQueries({ queryKey: ["guardians"] }); }} />}
    </>
  );
}

function GuardianForm({ onSubmit }: any) {
  const [f, setF] = useState({ fullName: "", relationship: "Father", phone: "", email: "", address: "", temporaryPassword: "" });
  const set = (k: string, v: any) => setF({ ...f, [k]: v });
  return (
    <DialogContent className="max-w-xl">
      <DialogHeader><DialogTitle>New parent / guardian</DialogTitle></DialogHeader>
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
        <div>
          <Label>Temporary login password</Label>
          <Input type="password" value={f.temporaryPassword} onChange={(e) => set("temporaryPassword", e.target.value)} placeholder="At least 8 characters (optional)" />
          <p className="text-xs text-muted-foreground mt-1">When supplied, a parent login is created and the parent will be asked to change it.</p>
        </div>
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
