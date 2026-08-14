import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth, hasAny, ADMIN_ROLES } from "@/lib/auth";

const AUDIENCES = [
  { value: "all", label: "Everyone" },
  { value: "staff", label: "Staff only" },
  { value: "parents", label: "Parents only" },
];
function audienceLabel(v: string) {
  return AUDIENCES.find((a) => a.value === v.toLowerCase())?.label ?? v;
}

export const Route = createFileRoute("/_authenticated/announcements")({
  head: () => ({ meta: [{ title: "Announcements" }] }),
  component: Announcements,
});

function Announcements() {
  const { roles } = useAuth();
  const canManage = hasAny(roles, ADMIN_ROLES);
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ title: "", body: "", audience: "all" });
  const { data = [] } = useQuery({ queryKey: ["ann"], queryFn: () => api.announcements.list() });
  const create = useMutation({
    mutationFn: () => api.announcements.create(f),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["ann"] }); toast.success("Posted"); setOpen(false); setF({ title: "", body: "", audience: "all" }); },
    onError: (e: any) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.announcements.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["ann"] }); toast.success("Deleted"); },
    onError: (e: any) => toast.error(e.message),
  });
  return (
    <>
      <PageHeader title="Announcements" description={!canManage ? "You'll see announcements addressed to you here." : undefined} actions={
        canManage ? (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" /> New</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>New announcement</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div><Label>Title</Label><Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></div>
                <div><Label>Message</Label><Textarea rows={5} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} /></div>
                <div><Label>Audience</Label>
                  <Select value={f.audience} onValueChange={(v) => setF({ ...f, audience: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{AUDIENCES.map((a) => <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter><Button onClick={() => create.mutate()} disabled={!f.title || !f.body}>Post</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        ) : undefined
      } />
      <div className="p-6 space-y-3 max-w-3xl">
        {data.length === 0 ? <p className="text-muted-foreground">No announcements yet.</p>
          : data.map((a) => (
            <Card key={a.id}>
              <CardHeader><CardTitle className="text-base flex justify-between items-center gap-2">
                <span>{a.title}</span>
                <span className="flex items-center gap-2">
                  <span className="text-xs font-normal text-muted-foreground">{new Date(a.createdAt).toLocaleString()}</span>
                  {canManage && (
                    <Button variant="ghost" size="icon" onClick={() => { if (confirm("Delete this announcement?")) remove.mutate(a.id); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  )}
                </span>
              </CardTitle></CardHeader>
              <CardContent><p className="whitespace-pre-wrap text-sm">{a.body}</p><Badge variant="outline" className="mt-2">{audienceLabel(a.audience)}</Badge></CardContent>
            </Card>
          ))}
      </div>
    </>
  );
}
