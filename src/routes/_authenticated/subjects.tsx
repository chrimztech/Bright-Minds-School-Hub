import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth, hasPermission } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/subjects")({
  head: () => ({ meta: [{ title: "Subjects" }] }),
  component: Subjects,
});

function Subjects() {
  const qc = useQueryClient();
  const { permissions } = useAuth();
  const canManage = hasPermission(permissions, "subjects:manage");
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ name: "", code: "" });
  const { data = [] } = useQuery({ queryKey: ["subjects"], queryFn: () => api.subjects.list() });
  const create = useMutation({
    mutationFn: () => api.subjects.create({ name: f.name, code: f.code || undefined }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["subjects"] }); toast.success("Subject added"); setOpen(false); setF({ name: "", code: "" }); },
    onError: (e: any) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.subjects.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["subjects"] }); toast.success("Deleted"); },
    onError: (e: any) => toast.error(e.message),
  });
  return (
    <>
      <PageHeader title="Subjects" actions={
        canManage ? (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" /> Add subject</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>New subject</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Name</Label><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
                <div><Label>Code</Label><Input value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} /></div>
              </div>
              <DialogFooter><Button onClick={() => create.mutate()} disabled={!f.name}>Save</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        ) : undefined
      } />
      <div className="p-6">
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Code</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
            <TableBody>
              {data.length === 0 ? <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-8">No subjects yet.</TableCell></TableRow>
                : data.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.name}</TableCell>
                    <TableCell>{s.code ?? "—"}</TableCell>
                    <TableCell className="text-right">
                      {canManage && <Button variant="ghost" size="icon" onClick={() => { if (confirm(`Delete ${s.name}?`)) remove.mutate(s.id); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>}
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </>
  );
}
