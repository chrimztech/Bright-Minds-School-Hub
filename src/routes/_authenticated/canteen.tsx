import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
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
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, UtensilsCrossed } from "lucide-react";
import { toast } from "sonner";
import { money } from "@/lib/format";
import { EmptyState } from "@/components/EmptyState";

const CATEGORIES = ["Breakfast", "Lunch", "Snack", "Drink", "Meal", "Other"];
const METHODS = ["CASH", "MOBILE_MONEY", "ACCOUNT", "CARD"];

export const Route = createFileRoute("/_authenticated/canteen")({
  head: () => ({ meta: [{ title: "Canteen" }] }),
  component: CanteenPage,
});

function CanteenPage() {
  return (
    <>
      <PageHeader title="Canteen" description="Menu, meal plans, subscriptions and daily sales" />
      <div className="p-6 space-y-6">
        <Summary />
        <Tabs defaultValue="sales">
          <TabsList>
            <TabsTrigger value="sales">Sales</TabsTrigger>
            <TabsTrigger value="menu">Menu</TabsTrigger>
            <TabsTrigger value="plans">Meal plans</TabsTrigger>
            <TabsTrigger value="subs">Subscriptions</TabsTrigger>
          </TabsList>
          <TabsContent value="sales"><Sales /></TabsContent>
          <TabsContent value="menu"><Menu /></TabsContent>
          <TabsContent value="plans"><Plans /></TabsContent>
          <TabsContent value="subs"><Subs /></TabsContent>
        </Tabs>
      </div>
    </>
  );
}

function Summary() {
  const today = new Date().toISOString().slice(0, 10);
  const { data: allSales = [] } = useQuery({ queryKey: ["canteen-sales-all"], queryFn: () => api.canteen.sales.list() });
  const { data: allMenu = [] } = useQuery({ queryKey: ["canteen-menu-count"], queryFn: () => api.canteen.menu.list() });
  const { data: allSubs = [] } = useQuery({ queryKey: ["canteen-subs-count"], queryFn: () => api.canteen.subscriptions.list() });
  const monthPrefix = today.slice(0, 7);
  const data = {
    today: allSales.filter((s) => s.servedOn === today).reduce((a, s) => a + Number(s.total), 0),
    month: allSales.filter((s) => s.servedOn?.startsWith(monthPrefix)).reduce((a, s) => a + Number(s.total), 0),
    items: allMenu.filter((m) => m.isAvailable).length,
    subs: allSubs.filter((s) => s.status === "ACTIVE").length,
  };
  return (
    <div className="grid gap-3 sm:grid-cols-4">
      <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Sales today</p><p className="text-2xl font-semibold text-emerald-600">{money(data?.today ?? 0)}</p></CardContent></Card>
      <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Sales this month</p><p className="text-2xl font-semibold">{money(data?.month ?? 0)}</p></CardContent></Card>
      <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Available items</p><p className="text-2xl font-semibold">{data?.items ?? 0}</p></CardContent></Card>
      <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Active subscriptions</p><p className="text-2xl font-semibold">{data?.subs ?? 0}</p></CardContent></Card>
    </div>
  );
}

function Menu() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const { data = [] } = useQuery({ queryKey: ["canteen-menu"], queryFn: () => api.canteen.menu.list() });
  const create = useMutation({
    mutationFn: (f: any) => api.canteen.menu.create(f),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["canteen-menu"] }); toast.success("Item added"); setOpen(false); },
    onError: (e: any) => toast.error(e.message),
  });
  const toggle = useMutation({
    mutationFn: (r: any) => api.canteen.menu.update(r.id, { isAvailable: !r.isAvailable }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["canteen-menu"] }),
    onError: (e: any) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.canteen.menu.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["canteen-menu"] }); toast.success("Removed"); },
    onError: (e: any) => toast.error(e.message),
  });
  return (
    <div className="space-y-3 mt-4">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" /> New item</Button></DialogTrigger>
        <MenuForm onSubmit={(f: any) => create.mutate(f)} />
      </Dialog>
      <div className="rounded-lg border bg-card"><Table>
        <TableHeader><TableRow><TableHead>Item</TableHead><TableHead>Category</TableHead><TableHead className="text-right">Price</TableHead><TableHead>Status</TableHead><TableHead></TableHead></TableRow></TableHeader>
        <TableBody>
          {data.length === 0 ? <TableRow><TableCell colSpan={5}><EmptyState /></TableCell></TableRow> : data.map((r) => (
            <TableRow key={r.id}>
              <TableCell><p className="font-medium">{r.name}</p><p className="text-xs text-muted-foreground">{r.description ?? ""}</p></TableCell>
              <TableCell>{r.category}</TableCell>
              <TableCell className="text-right">{money(r.price)}</TableCell>
              <TableCell>
                <button onClick={() => toggle.mutate(r)}>
                  <Badge variant={r.isAvailable ? "default" : "secondary"}>{r.isAvailable ? "Available" : "Off"}</Badge>
                </button>
              </TableCell>
              <TableCell className="text-right">
                <Button size="icon" variant="ghost" onClick={() => { if (confirm("Delete this item?")) remove.mutate(r.id); }}><Trash2 className="h-4 w-4" /></Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table></div>
    </div>
  );
}

function MenuForm({ onSubmit }: any) {
  const [f, setF] = useState({ name: "", description: "", category: "Meal", price: 0, isAvailable: true });
  return (
    <DialogContent>
      <DialogHeader><DialogTitle>New menu item</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div><Label>Name</Label><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Category</Label>
            <Select value={f.category} onValueChange={(v) => setF({ ...f, category: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Price (ZMW)</Label><Input type="number" step="0.01" value={f.price} onChange={(e) => setF({ ...f, price: Number(e.target.value) })} /></div>
        </div>
        <div><Label>Description</Label><Textarea value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></div>
      </div>
      <DialogFooter><Button onClick={() => onSubmit(f)} disabled={!f.name}>Save</Button></DialogFooter>
    </DialogContent>
  );
}

function Plans() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const { data = [] } = useQuery({ queryKey: ["canteen-plans"], queryFn: () => api.canteen.plans.list() });
  const create = useMutation({
    mutationFn: (f: any) => api.canteen.plans.create(f),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["canteen-plans"] }); toast.success("Plan added"); setOpen(false); },
    onError: (e: any) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.canteen.plans.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["canteen-plans"] }),
    onError: (e: any) => toast.error(e.message),
  });
  const [f, setF] = useState({ name: "", description: "", pricePerTerm: 0, mealsPerDay: 1, isActive: true });
  return (
    <div className="space-y-3 mt-4">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" /> New plan</Button></DialogTrigger>
        <DialogContent>
          <DialogHeader><DialogTitle>New meal plan</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Name</Label><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Termly lunch plan" /></div>
            <div><Label>Description</Label><Textarea value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Price / term (ZMW)</Label><Input type="number" step="0.01" value={f.pricePerTerm} onChange={(e) => setF({ ...f, pricePerTerm: Number(e.target.value) })} /></div>
              <div><Label>Meals per day</Label><Input type="number" value={f.mealsPerDay} onChange={(e) => setF({ ...f, mealsPerDay: Number(e.target.value) })} /></div>
            </div>
          </div>
          <DialogFooter><Button onClick={() => create.mutate(f)} disabled={!f.name}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      <div className="rounded-lg border bg-card"><Table>
        <TableHeader><TableRow><TableHead>Plan</TableHead><TableHead>Meals/day</TableHead><TableHead className="text-right">Price/term</TableHead><TableHead></TableHead></TableRow></TableHeader>
        <TableBody>
          {data.length === 0 ? <TableRow><TableCell colSpan={4}><EmptyState /></TableCell></TableRow> : data.map((r) => (
            <TableRow key={r.id}>
              <TableCell><p className="font-medium">{r.name}</p><p className="text-xs text-muted-foreground">{r.description ?? ""}</p></TableCell>
              <TableCell>{r.mealsPerDay}</TableCell>
              <TableCell className="text-right">{money(r.pricePerTerm)}</TableCell>
              <TableCell className="text-right"><Button size="icon" variant="ghost" onClick={() => { if (confirm("Delete?")) remove.mutate(r.id); }}><Trash2 className="h-4 w-4" /></Button></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table></div>
    </div>
  );
}

function Subs() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const { data = [] } = useQuery({ queryKey: ["canteen-subs"], queryFn: () => api.canteen.subscriptions.list() });
  const { data: pupils = [] } = useQuery({ queryKey: ["pupils-mini"], queryFn: () => api.pupils.all() });
  const { data: plans = [] } = useQuery({ queryKey: ["canteen-plans"], queryFn: () => api.canteen.plans.list() });
  const create = useMutation({
    mutationFn: (f: any) => api.canteen.subscriptions.create({ pupilId: f.pupilId, planId: f.planId }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["canteen-subs"] }); toast.success("Subscribed"); setOpen(false); },
    onError: (e: any) => toast.error(e.message),
  });
  const cancel = useMutation({
    mutationFn: (id: string) => api.canteen.subscriptions.cancel(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["canteen-subs"] }),
    onError: (e: any) => toast.error(e.message),
  });
  const [f, setF] = useState<any>({ pupilId: "", planId: "", startDate: new Date().toISOString().slice(0, 10) });
  return (
    <div className="space-y-3 mt-4">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" /> Subscribe pupil</Button></DialogTrigger>
        <DialogContent>
          <DialogHeader><DialogTitle>New subscription</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Pupil</Label>
              <Select value={f.pupilId} onValueChange={(v) => setF({ ...f, pupilId: v })}>
                <SelectTrigger><SelectValue placeholder="Choose pupil" /></SelectTrigger>
                <SelectContent>{pupils.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.fullName}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Plan</Label>
              <Select value={f.planId} onValueChange={(v) => setF({ ...f, planId: v })}>
                <SelectTrigger><SelectValue placeholder="Choose plan" /></SelectTrigger>
                <SelectContent>{plans.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Start date</Label><Input type="date" value={f.startDate} onChange={(e) => setF({ ...f, startDate: e.target.value })} /></div>
          </div>
          <DialogFooter><Button onClick={() => create.mutate(f)} disabled={!f.pupilId || !f.planId}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      <div className="rounded-lg border bg-card"><Table>
        <TableHeader><TableRow><TableHead>Pupil</TableHead><TableHead>Plan</TableHead><TableHead>Start</TableHead><TableHead>Status</TableHead><TableHead></TableHead></TableRow></TableHeader>
        <TableBody>
          {data.length === 0 ? <TableRow><TableCell colSpan={5}><EmptyState /></TableCell></TableRow> : data.map((r: any) => (
            <TableRow key={r.id}>
              <TableCell>{r.pupil?.fullName ?? "—"}</TableCell>
              <TableCell>{r.plan?.name ?? "—"} <span className="text-xs text-muted-foreground ml-1">{money(r.plan?.pricePerTerm ?? 0)}</span></TableCell>
              <TableCell>{r.startDate}</TableCell>
              <TableCell><Badge variant={r.status === "ACTIVE" ? "default" : "secondary"}>{r.status}</Badge></TableCell>
              <TableCell className="text-right">{r.status === "ACTIVE" && <Button size="sm" variant="outline" onClick={() => { if (confirm("Cancel subscription?")) cancel.mutate(r.id); }}>Cancel</Button>}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table></div>
    </div>
  );
}

function Sales() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const { data = [] } = useQuery({ queryKey: ["canteen-sales"], queryFn: () => api.canteen.sales.list() });
  const { data: items = [] } = useQuery({ queryKey: ["canteen-menu-avail"], queryFn: () => api.canteen.menu.list() });
  const { data: pupils = [] } = useQuery({ queryKey: ["pupils-mini"], queryFn: () => api.pupils.all() });

  const create = useMutation({
    mutationFn: (f: any) => {
      const item = items.find((i: any) => i.id === f.itemId);
      const unit = Number(item?.price ?? 0);
      return api.canteen.sales.create({
        itemId: f.itemId,
        itemName: item?.name ?? "Item",
        pupilId: f.pupilId,
        quantity: f.quantity,
        unitPrice: unit,
        total: unit * Number(f.quantity || 0),
        paymentMethod: f.paymentMethod,
        servedOn: f.servedOn,
        notes: f.notes,
      });
    },
    onSuccess: () => { qc.invalidateQueries(); toast.success("Sale recorded"); setOpen(false); },
    onError: (e: any) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.canteen.sales.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["canteen-sales"] }),
    onError: (e: any) => toast.error(e.message),
  });

  const [f, setF] = useState<any>({ itemId: "", pupilId: "", quantity: 1, paymentMethod: "CASH", servedOn: new Date().toISOString().slice(0, 10), notes: "" });
  const selected = useMemo(() => items.find((i: any) => i.id === f.itemId), [items, f.itemId]);

  return (
    <div className="space-y-3 mt-4">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild><Button><UtensilsCrossed className="h-4 w-4 mr-1" /> Record sale</Button></DialogTrigger>
        <DialogContent>
          <DialogHeader><DialogTitle>New canteen sale</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Item</Label>
              <Select value={f.itemId} onValueChange={(v) => setF({ ...f, itemId: v })}>
                <SelectTrigger><SelectValue placeholder="Choose item" /></SelectTrigger>
                <SelectContent>{items.map((i: any) => <SelectItem key={i.id} value={i.id}>{i.name} — {money(i.price)}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Quantity</Label><Input type="number" min="1" value={f.quantity} onChange={(e) => setF({ ...f, quantity: Number(e.target.value) })} /></div>
              <div><Label>Total</Label><Input disabled value={money((selected?.price ?? 0) * Number(f.quantity || 0))} /></div>
            </div>
            <div><Label>Pupil</Label>
              <Select value={f.pupilId} onValueChange={(v) => setF({ ...f, pupilId: v })}>
                <SelectTrigger><SelectValue placeholder="Select pupil" /></SelectTrigger>
                <SelectContent>
                  {pupils.map((p: any) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.fullName}{p.schoolClass ? ` — ${p.schoolClass.name}${p.schoolClass.stream ? " " + p.schoolClass.stream : ""}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>Method</Label>
                <Select value={f.paymentMethod} onValueChange={(v) => setF({ ...f, paymentMethod: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{METHODS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Date</Label><Input type="date" value={f.servedOn} onChange={(e) => setF({ ...f, servedOn: e.target.value })} /></div>
            </div>
            <div><Label>Notes</Label><Textarea value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></div>
          </div>
          <DialogFooter><Button onClick={() => create.mutate(f)} disabled={!f.itemId || !f.quantity || !f.pupilId}>Save</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      <div className="rounded-lg border bg-card"><Table>
        <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Item</TableHead><TableHead>Pupil</TableHead><TableHead>Class</TableHead><TableHead>Qty</TableHead><TableHead>Method</TableHead><TableHead className="text-right">Total</TableHead><TableHead></TableHead></TableRow></TableHeader>
        <TableBody>
          {data.length === 0 ? <TableRow><TableCell colSpan={8}><EmptyState /></TableCell></TableRow> : data.map((r: any) => (
            <TableRow key={r.id}>
              <TableCell>{r.servedOn}</TableCell>
              <TableCell>{r.itemName}</TableCell>
              <TableCell>{r.pupil?.fullName ?? "—"}</TableCell>
              <TableCell className="text-muted-foreground text-xs">{r.pupil?.schoolClass ? `${r.pupil.schoolClass.name}${r.pupil.schoolClass.stream ? " " + r.pupil.schoolClass.stream : ""}` : "—"}</TableCell>
              <TableCell>{r.quantity}</TableCell>
              <TableCell>{r.paymentMethod}</TableCell>
              <TableCell className="text-right text-emerald-600">{money(r.total)}</TableCell>
              <TableCell className="text-right"><Button size="icon" variant="ghost" onClick={() => { if (confirm("Delete?")) remove.mutate(r.id); }}><Trash2 className="h-4 w-4" /></Button></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table></div>
    </div>
  );
}