import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, MapPin, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/EmptyState";
import { useAuth, hasAny, ADMIN_ROLES } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/calendar")({
  head: () => ({ meta: [{ title: "School calendar" }] }),
  component: CalendarPage,
});

function CalendarPage() {
  const { roles } = useAuth();
  const canManage = hasAny(roles, ADMIN_ROLES);
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const { data = [] } = useQuery({ queryKey: ["events"], queryFn: () => api.events.list() });
  const create = useMutation({
    mutationFn: (f: any) => api.events.create(f),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["events"] }); toast.success("Event added"); setOpen(false); },
    onError: (e: any) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.events.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["events"] }); toast.success("Deleted"); },
    onError: (e: any) => toast.error(e.message),
  });
  return (
    <>
      <PageHeader title="School calendar" description="Term dates, events, meetings and activities"
        actions={
          canManage ? (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" /> New event</Button></DialogTrigger>
              <EventForm onSubmit={(f: any) => create.mutate(f)} />
            </Dialog>
          ) : undefined
        } />
      <div className="p-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {data.length === 0 && <div className="col-span-full"><EmptyState message="No events scheduled yet." /></div>}
        {data.map((e) => (
          <Card key={e.id}>
            <CardContent className="p-4 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-semibold">{e.title}</h3>
                <div className="flex items-center gap-1">
                  <Badge variant="secondary">{e.audience}</Badge>
                  {canManage && (
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => { if (confirm(`Delete ${e.title}?`)) remove.mutate(e.id); }}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                  )}
                </div>
              </div>
              <p className="text-xs text-muted-foreground">{new Date(e.startsAt).toLocaleString()}{e.endsAt ? ` → ${new Date(e.endsAt).toLocaleString()}` : ""}</p>
              {e.location && <p className="text-xs flex items-center gap-1"><MapPin className="h-3 w-3" />{e.location}</p>}
              {e.description && <p className="text-sm">{e.description}</p>}
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}

function EventForm({ onSubmit }: any) {
  const [f, setF] = useState({ title: "", description: "", startsAt: "", endsAt: "", location: "", audience: "all" });
  return (
    <DialogContent>
      <DialogHeader><DialogTitle>New event</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div><Label>Title</Label><Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Starts</Label><Input type="datetime-local" value={f.startsAt} onChange={(e) => setF({ ...f, startsAt: e.target.value })} /></div>
          <div><Label>Ends</Label><Input type="datetime-local" value={f.endsAt} onChange={(e) => setF({ ...f, endsAt: e.target.value })} /></div>
        </div>
        <div><Label>Location</Label><Input value={f.location} onChange={(e) => setF({ ...f, location: e.target.value })} /></div>
        <div><Label>Audience</Label>
          <Select value={f.audience} onValueChange={(v) => setF({ ...f, audience: v })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{["all","staff","parents","pupils","class"].map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div><Label>Description</Label><Textarea value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></div>
      </div>
      <DialogFooter>
        <Button
          onClick={() =>
            onSubmit({
              ...f,
              // <input type="datetime-local"> yields a bare "YYYY-MM-DDTHH:mm" with no
              // zone/offset, but the backend's Event.startsAt/endsAt are java.time.Instant —
              // Jackson rejects anything without one (400 "request body could not be read").
              // new Date(...) parses the bare string as browser-local time; toISOString()
              // gives back a proper offset-bearing instant the backend can deserialize.
              startsAt: new Date(f.startsAt).toISOString(),
              endsAt: f.endsAt ? new Date(f.endsAt).toISOString() : undefined,
            })
          }
          disabled={!f.title || !f.startsAt}
        >
          Save
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}