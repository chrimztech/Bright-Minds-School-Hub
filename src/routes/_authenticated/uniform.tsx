import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Shirt, Pencil } from "lucide-react";
import { toast } from "sonner";
import { money } from "@/lib/format";
import { EmptyState } from "@/components/EmptyState";
import { useAuth, hasPermission } from "@/lib/auth";
import { usePagination } from "@/hooks/use-pagination";
import { PaginationBar } from "@/components/PaginationBar";

export const Route = createFileRoute("/_authenticated/uniform")({
  head: () => ({ meta: [{ title: "Uniform" }] }),
  component: UniformPage,
});

function UniformPage() {
  return (
    <>
      <PageHeader
        title="Uniform"
        description="Uniform, P.E. attire and other school-wear — sold and invoiced to a pupil's account"
      />
      <div className="p-6 space-y-6">
        <Tabs defaultValue="sales">
          <TabsList>
            <TabsTrigger value="sales">Sales</TabsTrigger>
            <TabsTrigger value="catalog">Catalog</TabsTrigger>
          </TabsList>
          <TabsContent value="sales">
            <Sales />
          </TabsContent>
          <TabsContent value="catalog">
            <Catalog />
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}

function Catalog() {
  const qc = useQueryClient();
  const { permissions } = useAuth();
  const canManage = hasPermission(permissions, "uniform:manage");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const { data: items = [] } = useQuery({
    queryKey: ["uniform-items"],
    queryFn: () => api.uniform.items.list(),
  });

  const create = useMutation({
    mutationFn: (f: { name: string; price: number }) => api.uniform.items.create(f),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["uniform-items"] });
      toast.success("Item added");
      setOpen(false);
    },
    onError: (e: any) => toast.error(e.message),
  });
  const update = useMutation({
    mutationFn: (f: { name: string; price: number }) => api.uniform.items.update(editing.id, f),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["uniform-items"] });
      toast.success("Item updated");
      setEditing(null);
    },
    onError: (e: any) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.uniform.items.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["uniform-items"] });
      toast.success("Item removed");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const [f, setF] = useState({ name: "", price: "" });

  return (
    <div className="space-y-3 mt-4">
      {canManage && (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => setF({ name: "", price: "" })}>
              <Plus className="h-4 w-4 mr-1" /> Add item
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New uniform item</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Name</Label>
                <Input
                  value={f.name}
                  onChange={(e) => setF({ ...f, name: e.target.value })}
                  placeholder="e.g. Jersey"
                />
              </div>
              <div>
                <Label>Price</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={f.price}
                  onChange={(e) => setF({ ...f, price: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                disabled={!f.name || create.isPending}
                onClick={() => create.mutate({ name: f.name, price: Number(f.price || 0) })}
              >
                {create.isPending ? "Adding…" : "Add item"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {editing && (
        <Dialog open onOpenChange={(o) => !o && setEditing(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit uniform item</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Name</Label>
                <Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
              </div>
              <div>
                <Label>Price</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={f.price}
                  onChange={(e) => setF({ ...f, price: e.target.value })}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                disabled={!f.name || update.isPending}
                onClick={() => update.mutate({ name: f.name, price: Number(f.price || 0) })}
              >
                {update.isPending ? "Saving…" : "Save"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      <Card>
        <CardContent className="p-0">
          {items.length === 0 ? (
            <EmptyState message="No uniform items yet." />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead>Price</TableHead>
                  {canManage && <TableHead className="w-24"></TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((i) => (
                  <TableRow key={i.id}>
                    <TableCell className="font-medium">{i.name}</TableCell>
                    <TableCell>{money(i.amount)}</TableCell>
                    {canManage && (
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => {
                              setEditing(i);
                              setF({ name: i.name, price: String(i.amount) });
                            }}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => {
                              if (confirm(`Remove "${i.name}" from the catalog?`))
                                remove.mutate(i.id);
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Sales() {
  const qc = useQueryClient();
  const { permissions } = useAuth();
  const canManage = hasPermission(permissions, "uniform:manage");
  const [open, setOpen] = useState(false);
  const { data = [] } = useQuery({
    queryKey: ["uniform-sales"],
    queryFn: () => api.uniform.sales.list(),
  });
  const {
    pageItems: pagedSales,
    page,
    setPage,
    totalPages,
    pageSize,
    total,
  } = usePagination(data, 25);
  // Only feeds the Sell dialog, which never renders without uniform:manage.
  const { data: items = [] } = useQuery({
    queryKey: ["uniform-items-avail"],
    enabled: canManage,
    queryFn: () => api.uniform.items.list(),
  });
  const { data: pupils = [] } = useQuery({
    queryKey: ["pupils-mini-uniform"],
    enabled: canManage,
    queryFn: () => api.pupils.all(),
  });

  const create = useMutation({
    mutationFn: (f: any) =>
      api.uniform.sales.create({
        pupilId: f.pupilId,
        itemId: f.itemId,
        quantity: Number(f.quantity || 1),
        notes: f.notes || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["uniform-sales"] });
      toast.success("Sale invoiced — collect via Fees & Payments");
      setOpen(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const [f, setF] = useState<any>({ itemId: "", pupilId: "", quantity: 1, notes: "" });
  const selected = useMemo(() => items.find((i) => i.id === f.itemId), [items, f.itemId]);

  return (
    <div className="space-y-3 mt-4">
      {canManage && (
        <Dialog
          open={open}
          onOpenChange={(o) => {
            setOpen(o);
            if (o) setF({ itemId: "", pupilId: "", quantity: 1, notes: "" });
          }}
        >
          <DialogTrigger asChild>
            <Button>
              <Shirt className="h-4 w-4 mr-1" /> Sell item
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New uniform sale</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label>Item</Label>
                <Select value={f.itemId} onValueChange={(v) => setF({ ...f, itemId: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose item" />
                  </SelectTrigger>
                  <SelectContent>
                    {items.map((i) => (
                      <SelectItem key={i.id} value={i.id}>
                        {i.name} — {money(i.amount)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Pupil</Label>
                <Select value={f.pupilId} onValueChange={(v) => setF({ ...f, pupilId: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose pupil" />
                  </SelectTrigger>
                  <SelectContent>
                    {pupils.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.fullName}
                        {p.schoolClass
                          ? ` — ${p.schoolClass.name}${p.schoolClass.stream ? " " + p.schoolClass.stream : ""}`
                          : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Quantity</Label>
                  <Input
                    type="number"
                    min="1"
                    value={f.quantity}
                    onChange={(e) => setF({ ...f, quantity: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Total</Label>
                  <Input
                    disabled
                    value={money((selected?.amount ?? 0) * Number(f.quantity || 0))}
                  />
                </div>
              </div>
              <div>
                <Label>Notes (optional)</Label>
                <Input
                  value={f.notes}
                  onChange={(e) => setF({ ...f, notes: e.target.value })}
                  placeholder="e.g. Size 32"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                This creates an invoice on the pupil's account — collect payment as usual via Fees &
                Payments.
              </p>
            </div>
            <DialogFooter>
              <Button
                disabled={!f.itemId || !f.pupilId || create.isPending}
                onClick={() => create.mutate(f)}
              >
                {create.isPending ? "Recording…" : "Record sale"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      <Card>
        <CardContent className="p-0">
          {data.length === 0 ? (
            <EmptyState message="No uniform sales recorded yet." />
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Pupil</TableHead>
                    <TableHead>Item</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagedSales.map((inv) => (
                    <TableRow key={inv.id}>
                      <TableCell>
                        {inv.createdAt ? new Date(inv.createdAt).toLocaleDateString() : "—"}
                      </TableCell>
                      <TableCell>{inv.pupil?.fullName ?? "—"}</TableCell>
                      <TableCell>{inv.description ?? inv.feeItem?.name ?? "—"}</TableCell>
                      <TableCell>{money(inv.total)}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            inv.status === "PAID"
                              ? "default"
                              : inv.status === "PARTIAL"
                                ? "secondary"
                                : "outline"
                          }
                        >
                          {inv.status}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <PaginationBar
                page={page}
                totalPages={totalPages}
                total={total}
                pageSize={pageSize}
                onPageChange={setPage}
              />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
