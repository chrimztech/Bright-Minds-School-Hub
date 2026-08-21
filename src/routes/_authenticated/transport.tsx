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
import { Plus, Bus, Route as RouteIcon, Trash2, MapPin } from "lucide-react";
import { toast } from "sonner";
import { money } from "@/lib/format";
import { EmptyState } from "@/components/EmptyState";
import { useAuth, hasPermission } from "@/lib/auth";

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
  const { permissions } = useAuth();
  const canManage = hasPermission(permissions, "transport:manage");
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
      {canManage && (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" /> Add vehicle</Button></DialogTrigger>
          <DialogContent><DialogHeader><DialogTitle>New vehicle</DialogTitle></DialogHeader>
            <VehicleFields onSubmit={(f: any) => create.mutate(f)} />
          </DialogContent>
        </Dialog>
      )}
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
              <TableCell className="text-right">{canManage && <Button variant="ghost" size="icon" onClick={() => { if (confirm(`Delete ${v.regNo}?`)) remove.mutate(v.id); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>}</TableCell>
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
  const { permissions } = useAuth();
  const canManage = hasPermission(permissions, "transport:manage");
  const [open, setOpen] = useState(false);
  const [pointsFor, setPointsFor] = useState<any | null>(null);
  const { data = [] } = useQuery({ queryKey: ["routes"], queryFn: () => api.transport.routes.list() });
  // Only feeds the New-route dialog's vehicle picker, gated by transport:manage.
  const { data: vehicles = [] } = useQuery({ queryKey: ["vehicles-min"], enabled: canManage, queryFn: () => api.transport.vehicles.list() });
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
      {canManage && (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" /> Add route</Button></DialogTrigger>
          <DialogContent><DialogHeader><DialogTitle>New route</DialogTitle></DialogHeader>
            <RouteFields vehicles={vehicles} onSubmit={(f: any) => create.mutate(f)} />
          </DialogContent>
        </Dialog>
      )}
      <div className="rounded-lg border bg-card"><Table>
        <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Pickup points</TableHead><TableHead>Vehicle</TableHead><TableHead className="text-right">Base fee</TableHead><TableHead></TableHead></TableRow></TableHeader>
        <TableBody>
          {data.length === 0 ? <TableRow><TableCell colSpan={5}><EmptyState /></TableCell></TableRow> : data.map((r) => (
            <TableRow key={r.id}>
              <TableCell className="font-medium flex items-center gap-2"><RouteIcon className="h-4 w-4 text-muted-foreground" />{r.name}</TableCell>
              <TableCell className="max-w-[280px] truncate">{r.pickupPoints ?? "—"}</TableCell>
              <TableCell>{r.vehicle?.regNo ?? "—"}</TableCell>
              <TableCell className="text-right">{money(r.fee ?? 0)}</TableCell>
              <TableCell className="text-right whitespace-nowrap">
                {canManage && <Button variant="ghost" size="sm" onClick={() => setPointsFor(r)} title="Manage priced pickup points"><MapPin className="h-4 w-4 mr-1" /> Pickup points</Button>}
                {canManage && <Button variant="ghost" size="icon" onClick={() => { if (confirm(`Delete ${r.name}?`)) remove.mutate(r.id); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table></div>
      {pointsFor && (
        <Dialog open onOpenChange={(o) => !o && setPointsFor(null)}>
          <RoutePointsDialog route={pointsFor} />
        </Dialog>
      )}
    </div>
  );
}

function RouteFields({ vehicles, onSubmit }: any) {
  const [f, setF] = useState({ name: "", pickupPoints: "", vehicleId: "", fee: 0 });
  return (<>
    <div className="space-y-3">
      <div><Label>Name</Label><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
      <div><Label>Pickup points (comma separated, for display only)</Label><Input value={f.pickupPoints} onChange={(e) => setF({ ...f, pickupPoints: e.target.value })} /></div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label>Vehicle</Label>
          <Select value={f.vehicleId} onValueChange={(v) => setF({ ...f, vehicleId: v })}>
            <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
            <SelectContent>{vehicles.map((v: any) => <SelectItem key={v.id} value={v.id}>{v.regNo}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div><Label>Base fee</Label><Input type="number" step="0.01" value={f.fee} onChange={(e) => setF({ ...f, fee: Number(e.target.value) })} /></div>
      </div>
      <p className="text-xs text-muted-foreground">Used only for pupils assigned without picking a specific priced pickup point below (add those after saving via "Pickup points").</p>
    </div>
    <DialogFooter className="mt-4"><Button onClick={() => onSubmit(f)} disabled={!f.name}>Save</Button></DialogFooter>
  </>);
}

function RoutePointsDialog({ route }: { route: any }) {
  const qc = useQueryClient();
  const [f, setF] = useState({ name: "", fee: 0 });
  const { data: points = [] } = useQuery({ queryKey: ["route-points", route.id], queryFn: () => api.transport.points.list(route.id) });
  const create = useMutation({
    mutationFn: () => api.transport.points.create(route.id, f),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["route-points", route.id] }); setF({ name: "", fee: 0 }); toast.success("Pickup point added"); },
    onError: (e: any) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.transport.points.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["route-points", route.id] }); toast.success("Removed"); },
    onError: (e: any) => toast.error(e.message),
  });
  return (
    <DialogContent>
      <DialogHeader><DialogTitle>Pickup points — {route.name}</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <p className="text-xs text-muted-foreground">Each pickup point can have its own transport fee — pupils are billed based on the point they're assigned to, not just the route's base fee.</p>
        <div className="rounded-lg border">
          <Table>
            <TableHeader><TableRow><TableHead>Point</TableHead><TableHead className="text-right">Fee</TableHead><TableHead></TableHead></TableRow></TableHeader>
            <TableBody>
              {points.length === 0 ? <TableRow><TableCell colSpan={3}><EmptyState message="No priced pickup points yet." /></TableCell></TableRow> : points.map((p) => (
                <TableRow key={p.id}>
                  <TableCell>{p.name}</TableCell>
                  <TableCell className="text-right">{money(p.fee)}</TableCell>
                  <TableCell className="text-right"><Button variant="ghost" size="icon" onClick={() => remove.mutate(p.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <div className="flex items-end gap-2">
          <div className="flex-1"><Label>Point name</Label><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="e.g. Main gate" /></div>
          <div className="w-32"><Label>Fee</Label><Input type="number" step="0.01" value={f.fee} onChange={(e) => setF({ ...f, fee: Number(e.target.value) })} /></div>
          <Button onClick={() => create.mutate()} disabled={!f.name}><Plus className="h-4 w-4 mr-1" /> Add</Button>
        </div>
      </div>
    </DialogContent>
  );
}

function Assignments() {
  const qc = useQueryClient();
  const { permissions } = useAuth();
  const canManage = hasPermission(permissions, "transport:manage");
  const [open, setOpen] = useState(false);
  const { data = [] } = useQuery({ queryKey: ["tx-assign"], queryFn: () => api.transport.assignments.list() });
  // Only feed the Assign-pupil dialog, which never renders without transport:manage.
  const { data: pupils = [] } = useQuery({ queryKey: ["pupils-min"], enabled: canManage, queryFn: () => api.pupils.all() });
  const { data: routes = [] } = useQuery({ queryKey: ["routes-min"], enabled: canManage, queryFn: () => api.transport.routes.list() });
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
  const [f, setF] = useState({ pupilId: "", routeId: "", pickupPointId: "" });
  const { data: routePoints = [] } = useQuery({
    queryKey: ["route-points", f.routeId],
    enabled: !!f.routeId,
    queryFn: () => api.transport.points.list(f.routeId),
  });
  const selectedRoute = routes.find((r) => r.id === f.routeId);
  return (
    <div className="space-y-3 mt-4">
      {canManage && (
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
              <Select value={f.routeId} onValueChange={(v) => setF({ ...f, routeId: v, pickupPointId: "" })}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>{routes.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            {f.routeId && (
              <div>
                <Label>Pickup point</Label>
                <Select value={f.pickupPointId} onValueChange={(v) => setF({ ...f, pickupPointId: v })}>
                  <SelectTrigger><SelectValue placeholder={`Route base fee — ${money(selectedRoute?.fee ?? 0)}`} /></SelectTrigger>
                  <SelectContent>
                    {routePoints.map((p) => <SelectItem key={p.id} value={p.id}>{p.name} — {money(p.fee)}</SelectItem>)}
                  </SelectContent>
                </Select>
                {routePoints.length === 0 && <p className="text-xs text-muted-foreground mt-1">No priced pickup points set up for this route — the route's base fee will be billed. Add priced points from the Routes tab.</p>}
              </div>
            )}
          </div>
          <DialogFooter><Button onClick={() => create.mutate(f)} disabled={!f.pupilId || !f.routeId}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      )}
      <div className="rounded-lg border bg-card"><Table>
        <TableHeader><TableRow><TableHead>Pupil</TableHead><TableHead>Route</TableHead><TableHead>Pickup</TableHead><TableHead className="text-right">Fee</TableHead><TableHead></TableHead></TableRow></TableHeader>
        <TableBody>
          {data.length === 0 ? <TableRow><TableCell colSpan={5}><EmptyState /></TableCell></TableRow> : data.map((a) => (
            <TableRow key={a.id}>
              <TableCell>{a.pupil?.fullName}</TableCell>
              <TableCell>{a.route?.name}</TableCell>
              <TableCell>{a.pickupPointRef?.name ?? a.pickupPoint ?? "—"}</TableCell>
              <TableCell className="text-right">{money(a.pickupPointRef?.fee ?? a.route?.fee ?? 0)}</TableCell>
              <TableCell className="text-right">{canManage && <Button variant="ghost" size="icon" onClick={() => { if (confirm("Remove assignment?")) remove.mutate(a.id); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table></div>
    </div>
  );
}
