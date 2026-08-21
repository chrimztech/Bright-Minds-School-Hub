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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, AlertTriangle, ArrowUpDown, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { money } from "@/lib/format";
import { EmptyState } from "@/components/EmptyState";
import { useAuth, hasPermission } from "@/lib/auth";

const CATS = ["Stationery","Textbooks","Exercise books","Uniforms","Cleaning","Sports","Furniture","Computers","Kitchen","Medical","Office","Other"];

export const Route = createFileRoute("/_authenticated/inventory")({
  head: () => ({ meta: [{ title: "Inventory" }] }),
  component: InventoryPage,
});

function InventoryPage() {
  const qc = useQueryClient();
  const { permissions } = useAuth();
  const canManage = hasPermission(permissions, "inventory:manage");
  const [openI, setOpenI] = useState(false);
  const [openT, setOpenT] = useState<any>(null);
  const { data = [] } = useQuery({ queryKey: ["inv"], queryFn: () => api.inventory.items.list() });
  const create = useMutation({
    mutationFn: (f: any) => api.inventory.items.create(f),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["inv"] }); toast.success("Item added"); setOpenI(false); },
    onError: (e: any) => toast.error(e.message),
  });
  const move = useMutation({
    mutationFn: (f: any) => api.inventory.transactions.create(f),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["inv"] }); toast.success("Stock updated"); setOpenT(null); },
    onError: (e: any) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.inventory.items.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["inv"] }); toast.success("Deleted"); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <>
      <PageHeader title="Inventory" description="School stores and stock control"
        actions={
          canManage ? (
            <Dialog open={openI} onOpenChange={setOpenI}>
              <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" /> Add item</Button></DialogTrigger>
              <ItemForm onSubmit={(f: any) => create.mutate(f)} />
            </Dialog>
          ) : undefined
        } />
      <div className="p-6"><div className="rounded-lg border bg-card"><Table>
        <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Category</TableHead><TableHead className="text-right">Qty</TableHead><TableHead className="text-right">Reorder</TableHead><TableHead className="text-right">Unit cost</TableHead><TableHead></TableHead></TableRow></TableHeader>
        <TableBody>
          {data.length === 0 ? <TableRow><TableCell colSpan={6}><EmptyState /></TableCell></TableRow> : data.map((i) => (
            <TableRow key={i.id}>
              <TableCell className="font-medium">{i.name}</TableCell>
              <TableCell>{i.category ?? "—"}</TableCell>
              <TableCell className="text-right">
                {Number(i.quantity) <= Number(i.reorderLevel ?? 0) ? <Badge variant="destructive" className="gap-1"><AlertTriangle className="h-3 w-3" />{i.quantity}</Badge> : i.quantity}
              </TableCell>
              <TableCell className="text-right">{i.reorderLevel}</TableCell>
              <TableCell className="text-right">{money(i.unitCost ?? 0)}</TableCell>
              <TableCell className="flex gap-1 justify-end">
                {canManage && <Button size="sm" variant="outline" onClick={() => setOpenT(i)}><ArrowUpDown className="h-4 w-4 mr-1" /> Move</Button>}
                {canManage && <Button variant="ghost" size="icon" onClick={() => { if (confirm(`Delete ${i.name}?`)) remove.mutate(i.id); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table></div></div>
      <Dialog open={!!openT} onOpenChange={(o) => !o && setOpenT(null)}>
        {openT && <TxnForm item={openT} onSubmit={(f: any) => move.mutate(f)} />}
      </Dialog>
    </>
  );
}

function ItemForm({ onSubmit }: any) {
  const [f, setF] = useState({ name: "", category: "Stationery", sku: "", unit: "pcs", quantity: 0, reorderLevel: 0, unitCost: 0, location: "" });
  return (
    <DialogContent><DialogHeader><DialogTitle>New item</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Name</Label><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
          <div><Label>SKU / Code</Label><Input value={f.sku} onChange={(e) => setF({ ...f, sku: e.target.value })} /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Category</Label>
            <Select value={f.category} onValueChange={(v) => setF({ ...f, category: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{CATS.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Unit</Label><Input value={f.unit} onChange={(e) => setF({ ...f, unit: e.target.value })} /></div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div><Label>Opening qty</Label><Input type="number" value={f.quantity} onChange={(e) => setF({ ...f, quantity: Number(e.target.value) })} /></div>
          <div><Label>Reorder lvl</Label><Input type="number" value={f.reorderLevel} onChange={(e) => setF({ ...f, reorderLevel: Number(e.target.value) })} /></div>
          <div><Label>Unit cost</Label><Input type="number" step="0.01" value={f.unitCost} onChange={(e) => setF({ ...f, unitCost: Number(e.target.value) })} /></div>
        </div>
        <div><Label>Location</Label><Input value={f.location} onChange={(e) => setF({ ...f, location: e.target.value })} /></div>
      </div>
      <DialogFooter><Button onClick={() => onSubmit(f)} disabled={!f.name}>Save</Button></DialogFooter>
    </DialogContent>
  );
}

function TxnForm({ item, onSubmit }: any) {
  const [f, setF] = useState({ itemId: item.id, direction: "IN", quantity: 1, reason: "" });
  return (
    <DialogContent><DialogHeader><DialogTitle>Move: {item.name}</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Direction</Label>
            <Select value={f.direction} onValueChange={(v) => setF({ ...f, direction: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{["IN","OUT","ADJUST","DAMAGE","LOST"].map((d) => <SelectItem key={d} value={d}>{d.toLowerCase()}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Quantity</Label><Input type="number" value={f.quantity} onChange={(e) => setF({ ...f, quantity: Number(e.target.value) })} /></div>
        </div>
        <div><Label>Reason</Label><Input value={f.reason} onChange={(e) => setF({ ...f, reason: e.target.value })} /></div>
      </div>
      <DialogFooter><Button onClick={() => onSubmit(f)}>Save</Button></DialogFooter>
    </DialogContent>
  );
}
