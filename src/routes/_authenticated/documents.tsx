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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, ExternalLink, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/EmptyState";
import { useAuth, hasPermission } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/documents")({
  head: () => ({ meta: [{ title: "Documents" }] }),
  component: DocumentsPage,
});

function DocumentsPage() {
  const qc = useQueryClient();
  const { permissions } = useAuth();
  const canManage = hasPermission(permissions, "documents:manage");
  const [open, setOpen] = useState(false);
  const { data = [] } = useQuery({ queryKey: ["docs"], queryFn: () => api.documents.list() });
  const create = useMutation({
    mutationFn: (f: any) => api.documents.create(f),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["docs"] }); toast.success("Document linked"); setOpen(false); },
    onError: (e: any) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.documents.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["docs"] }); toast.success("Deleted"); },
    onError: (e: any) => toast.error(e.message),
  });
  const [f, setF] = useState({ title: "", category: "Policy", description: "", url: "" });
  return (
    <>
      <PageHeader title="Documents" description="Policies, contracts, certificates and templates"
        actions={
          canManage ? (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" /> Add document</Button></DialogTrigger>
              <DialogContent><DialogHeader><DialogTitle>Add document</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div><Label>Title</Label><Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></div>
                  <div><Label>Category</Label><Input value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} placeholder="Policy / Contract / Certificate…" /></div>
                  <div><Label>URL</Label><Input value={f.url} onChange={(e) => setF({ ...f, url: e.target.value })} placeholder="https://…" /></div>
                  <div><Label>Description</Label><Textarea value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></div>
                </div>
                <DialogFooter><Button onClick={() => create.mutate(f)} disabled={!f.title || !f.url}>Save</Button></DialogFooter>
              </DialogContent>
            </Dialog>
          ) : undefined
        } />
      <div className="p-6"><div className="rounded-lg border bg-card"><Table>
        <TableHeader><TableRow><TableHead>Title</TableHead><TableHead>Category</TableHead><TableHead>Description</TableHead><TableHead>Added</TableHead><TableHead></TableHead></TableRow></TableHeader>
        <TableBody>
          {data.length === 0 ? <TableRow><TableCell colSpan={5}><EmptyState /></TableCell></TableRow> : data.map((d) => (
            <TableRow key={d.id}>
              <TableCell className="font-medium">{d.title}</TableCell>
              <TableCell>{d.category ?? "—"}</TableCell>
              <TableCell className="max-w-[300px] truncate">{d.description ?? "—"}</TableCell>
              <TableCell>{new Date(d.createdAt).toLocaleDateString()}</TableCell>
              <TableCell className="flex gap-2">
                <a href={d.url} target="_blank" rel="noreferrer" className="text-primary inline-flex items-center gap-1 text-sm"><ExternalLink className="h-4 w-4" /> Open</a>
                {canManage && <Button variant="ghost" size="icon" onClick={() => { if (confirm(`Delete ${d.title}?`)) remove.mutate(d.id); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table></div></div>
    </>
  );
}