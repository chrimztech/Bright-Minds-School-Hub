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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, PackageCheck, X } from "lucide-react";
import { toast } from "sonner";
import { money } from "@/lib/format";
import { EmptyState } from "@/components/EmptyState";
import { useAuth, hasPermission } from "@/lib/auth";

// RECEIVED is intentionally excluded — it's only reachable via the dedicated "Receive"
// action, which is what actually credits inventory stock (see ProcurementController).
const PO_STATUSES = ["DRAFT","SENT","CANCELLED","PAID"];

export const Route = createFileRoute("/_authenticated/procurement")({
  head: () => ({ meta: [{ title: "Procurement" }] }),
  component: ProcurementPage,
});

function ProcurementPage() {
  return (
    <>
      <PageHeader title="Procurement" description="Suppliers and purchase orders" />
      <div className="p-6">
        <Tabs defaultValue="po">
          <TabsList><TabsTrigger value="po">Purchase orders</TabsTrigger><TabsTrigger value="suppliers">Suppliers</TabsTrigger></TabsList>
          <TabsContent value="po"><POs /></TabsContent>
          <TabsContent value="suppliers"><Suppliers /></TabsContent>
        </Tabs>
      </div>
    </>
  );
}

function Suppliers() {
  const qc = useQueryClient();
  const { permissions } = useAuth();
  const canManage = hasPermission(permissions, "procurement:manage");
  const [open, setOpen] = useState(false);
  const { data = [] } = useQuery({ queryKey: ["sups"], queryFn: () => api.procurement.suppliers.list() });
  const create = useMutation({
    mutationFn: (f: any) => api.procurement.suppliers.create(f),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["sups"] }); toast.success("Supplier added"); setOpen(false); },
    onError: (e: any) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.procurement.suppliers.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["sups"] }); toast.success("Deleted"); },
    onError: (e: any) => toast.error(e.message),
  });
  const [f, setF] = useState({ name: "", contactPerson: "", phone: "", email: "", address: "", taxNo: "", notes: "" });
  return (
    <div className="space-y-3 mt-4">
      {canManage && (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" /> Add supplier</Button></DialogTrigger>
          <DialogContent><DialogHeader><DialogTitle>New supplier</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Name</Label><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Contact</Label><Input value={f.contactPerson} onChange={(e) => setF({ ...f, contactPerson: e.target.value })} /></div>
                <div><Label>Phone</Label><Input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} /></div>
              </div>
              <div><Label>Email</Label><Input value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Tax no. (TPIN)</Label><Input value={f.taxNo} onChange={(e) => setF({ ...f, taxNo: e.target.value })} /></div>
                <div><Label>Address</Label><Input value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} /></div>
              </div>
              <div><Label>Notes</Label><Textarea value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></div>
            </div>
            <DialogFooter><Button onClick={() => create.mutate(f)} disabled={!f.name}>Save</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      )}
      <div className="rounded-lg border bg-card"><Table>
        <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Contact</TableHead><TableHead>Phone</TableHead><TableHead>Email</TableHead><TableHead></TableHead></TableRow></TableHeader>
        <TableBody>
          {data.length === 0 ? <TableRow><TableCell colSpan={5}><EmptyState /></TableCell></TableRow> : data.map((s) => (
            <TableRow key={s.id}><TableCell className="font-medium">{s.name}</TableCell><TableCell>{s.contactPerson ?? "—"}</TableCell><TableCell>{s.phone ?? "—"}</TableCell><TableCell>{s.email ?? "—"}</TableCell><TableCell className="text-right">{canManage && <Button variant="ghost" size="icon" onClick={() => { if (confirm(`Delete ${s.name}?`)) remove.mutate(s.id); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>}</TableCell></TableRow>
          ))}
        </TableBody>
      </Table></div>
    </div>
  );
}

function POs() {
  const qc = useQueryClient();
  const { permissions } = useAuth();
  const canManage = hasPermission(permissions, "procurement:manage");
  const [open, setOpen] = useState(false);
  // Only feed the New-PO dialog, which never renders without procurement:manage.
  const { data: sups = [] } = useQuery({ queryKey: ["sups-min"], enabled: canManage, queryFn: () => api.procurement.suppliers.list() });
  const { data: invItems = [] } = useQuery({ queryKey: ["inventory-min"], enabled: canManage, queryFn: () => api.inventory.items.list() });
  const { data = [] } = useQuery({ queryKey: ["pos"], queryFn: () => api.procurement.orders.list() });
  const create = useMutation({
    mutationFn: (f: any) => api.procurement.orders.create(f),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["pos"] }); toast.success("PO created"); setOpen(false); },
    onError: (e: any) => toast.error(e.message),
  });
  const setStatus = useMutation({
    mutationFn: ({ id, status }: any) => api.procurement.orders.updateStatus(id, status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pos"] }),
    onError: (e: any) => toast.error(e.message),
  });
  // Actually credits inventory stock for each line item (previously "Received" was just a
  // status label with no connection to inventory at all).
  const receive = useMutation({
    mutationFn: (id: string) => api.procurement.orders.receive(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["pos"] }); qc.invalidateQueries({ queryKey: ["inventory-min"] }); toast.success("Order received — stock updated"); },
    onError: (e: any) => toast.error(e.message),
  });
  const removePo = useMutation({
    mutationFn: (id: string) => api.procurement.orders.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["pos"] }); toast.success("Deleted"); },
    onError: (e: any) => toast.error(e.message),
  });
  const [f, setF] = useState<any>({ supplierId: "", orderDate: new Date().toISOString().slice(0,10), total: 0, notes: "", items: [] as { itemId: string; quantity: number; unitCost: number }[] });

  function addLine() { setF({ ...f, items: [...f.items, { itemId: "", quantity: 1, unitCost: 0 }] }); }
  function updateLine(i: number, patch: any) {
    const items = f.items.slice();
    items[i] = { ...items[i], ...patch };
    if (patch.itemId) {
      const item = invItems.find((x) => x.id === patch.itemId);
      if (item?.unitCost != null) items[i].unitCost = item.unitCost;
    }
    setF({ ...f, items });
  }
  function removeLine(i: number) { setF({ ...f, items: f.items.filter((_: any, idx: number) => idx !== i) }); }
  const lineTotal = f.items.reduce((a: number, it: any) => a + (Number(it.quantity) || 0) * (Number(it.unitCost) || 0), 0);

  return (
    <div className="space-y-3 mt-4">
      {canManage && (
      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (o) setF({ supplierId: "", orderDate: new Date().toISOString().slice(0,10), total: 0, notes: "", items: [] }); }}>
        <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" /> New PO</Button></DialogTrigger>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>New purchase order</DialogTitle></DialogHeader>
          <div className="space-y-3 max-h-[65vh] overflow-y-auto pr-1">
            <div><Label>Supplier</Label>
              <Select value={f.supplierId} onValueChange={(v) => setF({ ...f, supplierId: v })}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>{sups.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Date</Label><Input type="date" value={f.orderDate} onChange={(e) => setF({ ...f, orderDate: e.target.value })} /></div>
              {f.items.length === 0 && <div><Label>Total</Label><Input type="number" step="0.01" value={f.total} onChange={(e) => setF({ ...f, total: Number(e.target.value) })} /></div>}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Items ordered (enables receiving into stock)</Label>
                <Button type="button" size="sm" variant="outline" onClick={addLine}><Plus className="h-3.5 w-3.5 mr-1" /> Add item</Button>
              </div>
              {f.items.length === 0 && <p className="text-xs text-muted-foreground">No items added — this PO will be a plain record with a manual total and can't be received into stock. Add items to enable that.</p>}
              {f.items.map((line: any, i: number) => (
                <div key={i} className="flex items-end gap-2">
                  <div className="flex-1"><Label className="text-xs">Item</Label>
                    <Select value={line.itemId} onValueChange={(v) => updateLine(i, { itemId: v })}>
                      <SelectTrigger><SelectValue placeholder="Select inventory item" /></SelectTrigger>
                      <SelectContent>{invItems.map((it) => <SelectItem key={it.id} value={it.id}>{it.name}{it.unit ? ` (${it.unit})` : ""}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="w-20"><Label className="text-xs">Qty</Label><Input type="number" value={line.quantity} onChange={(e) => updateLine(i, { quantity: Number(e.target.value) })} /></div>
                  <div className="w-28"><Label className="text-xs">Unit cost</Label><Input type="number" step="0.01" value={line.unitCost} onChange={(e) => updateLine(i, { unitCost: Number(e.target.value) })} /></div>
                  <Button type="button" size="icon" variant="ghost" onClick={() => removeLine(i)}><X className="h-4 w-4 text-destructive" /></Button>
                </div>
              ))}
              {f.items.length > 0 && <p className="text-sm text-right font-medium">Total: {money(lineTotal)}</p>}
            </div>

            <div><Label>Notes</Label><Textarea value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></div>
          </div>
          <DialogFooter><Button onClick={() => create.mutate(f)} disabled={!f.supplierId || f.items.some((it: any) => !it.itemId || !it.quantity)}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      )}
      <div className="rounded-lg border bg-card"><Table>
        <TableHeader><TableRow><TableHead>PO no</TableHead><TableHead>Supplier</TableHead><TableHead>Date</TableHead><TableHead className="text-right">Total</TableHead><TableHead>Status</TableHead><TableHead></TableHead></TableRow></TableHeader>
        <TableBody>
          {data.length === 0 ? <TableRow><TableCell colSpan={6}><EmptyState /></TableCell></TableRow> : data.map((p) => (
            <TableRow key={p.id}>
              <TableCell className="font-mono text-xs">{p.poNo}</TableCell>
              <TableCell>{p.supplier?.name ?? "—"}</TableCell>
              <TableCell>{p.orderDate}</TableCell>
              <TableCell className="text-right">{money(p.total)}</TableCell>
              <TableCell>
                {p.receivedAt ? (
                  <Badge>Received</Badge>
                ) : canManage ? (
                  <Select value={p.status} onValueChange={(v) => setStatus.mutate({ id: p.id, status: v })}>
                    <SelectTrigger className="h-8 w-32"><SelectValue /></SelectTrigger>
                    <SelectContent>{PO_STATUSES.map((s) => <SelectItem key={s} value={s}>{s.toLowerCase()}</SelectItem>)}</SelectContent>
                  </Select>
                ) : <Badge variant="secondary">{p.status.toLowerCase()}</Badge>}
              </TableCell>
              <TableCell className="text-right whitespace-nowrap">
                {canManage && !p.receivedAt && p.status !== "CANCELLED" && (
                  <Button size="sm" variant="secondary" onClick={() => receive.mutate(p.id)} disabled={receive.isPending} title="Credit ordered quantities to inventory stock">
                    <PackageCheck className="h-3.5 w-3.5 mr-1" /> Receive
                  </Button>
                )}
                {canManage && <Button variant="ghost" size="icon" onClick={() => { if (confirm(`Delete ${p.poNo}?`)) removePo.mutate(p.id); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table></div>
    </div>
  );
}