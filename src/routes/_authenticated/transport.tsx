import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Bus, Route as RouteIcon, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { money } from "@/lib/format";
import { EmptyState } from "@/components/EmptyState";

export const Route = createFileRoute("/_authenticated/transport")({
  head: () => ({ meta: [{ title: "Transport" }] }),
  component: TransportPage,
});

function TransportPage() {
  return (
    <>
      <PageHeader title="Transport" description="Vehicles, routes and pupil assignments" />
      <div className="p-6">
        <Tabs defaultValue="vehicles">
          <TabsList>
            <TabsTrigger value="vehicles">Vehicles</TabsTrigger>
            <TabsTrigger value="routes">Routes</TabsTrigger>
            <TabsTrigger value="assignments">Assignments</TabsTrigger>
          </TabsList>
          <TabsContent value="vehicles"><Vehicles /></TabsContent>
          <TabsContent value="routes"><Routes /></TabsContent>
          <TabsContent value="assignments"><Assignments /></TabsContent>
        </Tabs>
      </div>
    </>
  );
}

function Vehicles() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const { data = [] } = useQuery({ queryKey: ["vehicles"], queryFn: () => api.transport.vehicles.list() });
  const create = useMutation({
    mutationFn: (f: any) => api.transport.vehicles.create(f),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["vehicles"] }); toast.success("Vehicle added"); setOpen(false); },
    onError: (e: any) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.transport.vehicles.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["vehicles"] }); toast.success("Deleted"); },
    onError: (e: any) => toast.error(e.message),
  });
  return (
    <div className="space-y-3 mt-4">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" /> Add vehicle</Button></DialogTrigger>
        <DialogContent><DialogHeader><DialogTitle>New vehicle</DialogTitle></DialogHeader>
          <VehicleFields onSubmit={(f: any) => create.mutate(f)} />
        </DialogContent>
      </Dialog>
      <div className="rounded-lg border bg-card"><Table>
        <TableHeader><TableRow><TableHead>Reg</TableHead><TableHead>Model</TableHead><TableHead>Capacity</TableHead><TableHead>Driver</TableHead><TableHead>Phone</TableHead><TableHead></TableHead></TableRow></TableHeader>
        <TableBody>
          {data.length === 0 ? <TableRow><TableCell colSpan={6}><EmptyState /></TableCell></TableRow> : data.map((v) => (
            <TableRow key={v.id}>
              <TableCell className="font-medium flex items-center gap-2"><Bus className="h-4 w-4 text-muted-foreground" />{v.regNo}</TableCell>
              <TableCell>{v.model ?? "—"}</TableCell>
              <TableCell>{v.capacity ?? "—"}</TableCell>
              <TableCell>{v.driverName ?? "—"}</TableCell>
              <TableCell>{v.driverPhone ?? "—"}</TableCell>
              <TableCell className="text-right"><Button variant="ghost" size="icon" onClick={() => { if (confirm(`Delete ${v.regNo}?`)) remove.mutate(v.id); }}><Trash2 className="h-4 w-4 text-destructive" /></Button></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table></div>
    </div>
  );
}

function VehicleFields({ onSubmit }: any) {
  const [f, setF] = useState({ regNo: "", model: "", capacity: 0, driverName: "", driverPhone: "" });
  return (<>
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Reg no</Label><Input value={f.regNo} onChange={(e) => setF({ ...f, regNo: e.target.value })} /></div>
        <div><Label>Model</Label><Input value={f.model} onChange={(e) => setF({ ...f, model: e.target.value })} /></div>
      </div>
      <div><Label>Capacity</Label><Input type="number" value={f.capacity} onChange={(e) => setF({ ...f, capacity: Number(e.target.value) })} /></div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Driver</Label><Input value={f.driverName} onChange={(e) => setF({ ...f, driverName: e.target.value })} /></div>
        <div><Label>Driver phone</Label><Input value={f.driverPhone} onChange={(e) => setF({ ...f, driverPhone: e.target.value })} /></div>
      </div>
    </div>
    <DialogFooter className="mt-4"><Button onClick={() => onSubmit(f)} disabled={!f.regNo}>Save</Button></DialogFooter>
  </>);
}

function Routes() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const { data = [] } = useQuery({ queryKey: ["routes"], queryFn: () => api.transport.routes.list() });
  const { data: vehicles = [] } = useQuery({ queryKey: ["vehicles-min"], queryFn: () => api.transport.vehicles.list() });
  const create = useMutation({
    mutationFn: (f: any) => api.transport.routes.create(f),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["routes"] }); toast.success("Route added"); setOpen(false); },
    onError: (e: any) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.transport.routes.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["routes"] }); toast.success("Deleted"); },
    onError: (e: any) => toast.error(e.message),
  });
  return (
    <div className="space-y-3 mt-4">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" /> Add route</Button></DialogTrigger>
        <DialogContent><DialogHeader><DialogTitle>New route</DialogTitle></DialogHeader>
          <RouteFields vehicles={vehicles} onSubmit={(f: any) => create.mutate(f)} />
        </DialogContent>
      </Dialog>
      <div className="rounded-lg border bg-card"><Table>
        <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Pickup points</TableHead><TableHead>Vehicle</TableHead><TableHead className="text-right">Fee</TableHead><TableHead></TableHead></TableRow></TableHeader>
        <TableBody>
          {data.length === 0 ? <TableRow><TableCell colSpan={5}><EmptyState /></TableCell></TableRow> : data.map((r) => (
            <TableRow key={r.id}>
              <TableCell className="font-medium flex items-center gap-2"><RouteIcon className="h-4 w-4 text-muted-foreground" />{r.name}</TableCell>
              <TableCell className="max-w-[280px] truncate">{r.pickupPoints ?? "—"}</TableCell>
              <TableCell>{r.vehicle?.regNo ?? "—"}</TableCell>
              <TableCell className="text-right">{money(r.fee ?? 0)}</TableCell>
              <TableCell className="text-right"><Button variant="ghost" size="icon" onClick={() => { if (confirm(`Delete ${r.name}?`)) remove.mutate(r.id); }}><Trash2 className="h-4 w-4 text-destructive" /></Button></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table></div>
    </div>
  );
}

function RouteFields({ vehicles, onSubmit }: any) {
  const [f, setF] = useState({ name: "", pickupPoints: "", vehicleId: "", fee: 0 });
  return (<>
    <div className="space-y-3">
      <div><Label>Name</Label><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
      <div><Label>Pickup points (comma separated)</Label><Input value={f.pickupPoints} onChange={(e) => setF({ ...f, pickupPoints: e.target.value })} /></div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Vehicle</Label>
          <Select value={f.vehicleId} onValueChange={(v) => setF({ ...f, vehicleId: v })}>
            <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
            <SelectContent>{vehicles.map((v: any) => <SelectItem key={v.id} value={v.id}>{v.regNo}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div><Label>Fee</Label><Input type="number" step="0.01" value={f.fee} onChange={(e) => setF({ ...f, fee: Number(e.target.value) })} /></div>
      </div>
    </div>
    <DialogFooter className="mt-4"><Button onClick={() => onSubmit(f)} disabled={!f.name}>Save</Button></DialogFooter>
  </>);
}

function Assignments() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const { data = [] } = useQuery({ queryKey: ["tx-assign"], queryFn: () => api.transport.assignments.list() });
  const { data: pupils = [] } = useQuery({ queryKey: ["pupils-min"], queryFn: () => api.pupils.all() });
  const { data: routes = [] } = useQuery({ queryKey: ["routes-min"], queryFn: () => api.transport.routes.list() });
  const create = useMutation({
    mutationFn: (f: any) => api.transport.assignments.create(f),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["tx-assign"] }); toast.success("Assigned"); setOpen(false); },
    onError: (e: any) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.transport.assignments.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["tx-assign"] }); toast.success("Removed"); },
    onError: (e: any) => toast.error(e.message),
  });
  const [f, setF] = useState({ pupilId: "", routeId: "", pickupPoint: "" });
  return (
    <div className="space-y-3 mt-4">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" /> Assign pupil</Button></DialogTrigger>
        <DialogContent><DialogHeader><DialogTitle>Assign pupil to route</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Pupil</Label>
              <Select value={f.pupilId} onValueChange={(v) => setF({ ...f, pupilId: v })}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>{pupils.map((p) => <SelectItem key={p.id} value={p.id}>{p.fullName}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Route</Label>
              <Select value={f.routeId} onValueChange={(v) => setF({ ...f, routeId: v })}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>{routes.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Pickup point</Label><Input value={f.pickupPoint} onChange={(e) => setF({ ...f, pickupPoint: e.target.value })} /></div>
          </div>
          <DialogFooter><Button onClick={() => create.mutate(f)} disabled={!f.pupilId || !f.routeId}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      <div className="rounded-lg border bg-card"><Table>
        <TableHeader><TableRow><TableHead>Pupil</TableHead><TableHead>Route</TableHead><TableHead>Pickup</TableHead><TableHead></TableHead></TableRow></TableHeader>
        <TableBody>
          {data.length === 0 ? <TableRow><TableCell colSpan={4}><EmptyState /></TableCell></TableRow> : data.map((a) => (
            <TableRow key={a.id}>
              <TableCell>{a.pupil?.fullName}</TableCell>
              <TableCell>{a.route?.name}</TableCell>
              <TableCell>{a.pickupPoint ?? "—"}</TableCell>
              <TableCell className="text-right"><Button variant="ghost" size="icon" onClick={() => { if (confirm("Remove assignment?")) remove.mutate(a.id); }}><Trash2 className="h-4 w-4 text-destructive" /></Button></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table></div>
    </div>
  );
}
