import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/academic-years")({
  head: () => ({ meta: [{ title: "Academic Years" }] }),
  component: AcademicYearsPage,
});

function fmt(d?: string) {
  return d ? new Date(d).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) : "—";
}

function AcademicYearsPage() {
  const qc = useQueryClient();
  const [yearOpen, setYearOpen] = useState(false);
  const [termOpen, setTermOpen] = useState(false);

  const { data: years = [], isLoading: yearsLoading } = useQuery({
    queryKey: ["academic-years"],
    queryFn: () => api.academicYears.list(),
  });
  const { data: terms = [], isLoading: termsLoading } = useQuery({
    queryKey: ["academic-years-terms"],
    queryFn: () => api.academicYears.terms.all(),
  });

  const createYear = useMutation({
    mutationFn: (f: any) => api.academicYears.create({ name: f.name, startDate: f.startDate, endDate: f.endDate, ...({ isCurrent: f.isCurrent } as any) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["academic-years"] }); toast.success("Academic year added"); setYearOpen(false); },
    onError: (e: any) => toast.error(e.message),
  });
  const deleteYear = useMutation({
    mutationFn: (id: string) => api.academicYears.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["academic-years"] }); qc.invalidateQueries({ queryKey: ["academic-years-terms"] }); toast.success("Academic year deleted"); },
    onError: (e: any) => toast.error(e.message),
  });

  const createTerm = useMutation({
    mutationFn: (f: any) => api.academicYears.terms.create(f.yearId, { name: f.name, startDate: f.startDate, endDate: f.endDate, ...({ isCurrent: f.isCurrent } as any) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["academic-years-terms"] }); toast.success("Term added"); setTermOpen(false); },
    onError: (e: any) => toast.error(e.message),
  });
  const deleteTerm = useMutation({
    mutationFn: (id: string) => api.academicYears.terms.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["academic-years-terms"] }); toast.success("Term deleted"); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <>
      <PageHeader title="Academic years & terms" description="Manage the school calendar's years and terms" />
      <div className="p-6 space-y-8">
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Academic years</h2>
            <Dialog open={yearOpen} onOpenChange={setYearOpen}>
              <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" /> Add year</Button></DialogTrigger>
              <YearForm onSubmit={(f: any) => createYear.mutate(f)} />
            </Dialog>
          </div>
          <div className="rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow><TableHead>Name</TableHead><TableHead>Start</TableHead><TableHead>End</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow>
              </TableHeader>
              <TableBody>
                {!yearsLoading && years.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No academic years yet.</TableCell></TableRow>
                ) : (
                  years.map((y) => (
                    <TableRow key={y.id}>
                      <TableCell className="font-medium">{y.name}</TableCell>
                      <TableCell>{fmt(y.startDate)}</TableCell>
                      <TableCell>{fmt(y.endDate)}</TableCell>
                      <TableCell>{y.isCurrent && <Badge>Current</Badge>}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => { if (confirm(`Delete academic year "${y.name}"? This also removes its terms.`)) deleteYear.mutate(y.id); }}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Terms</h2>
            <Dialog open={termOpen} onOpenChange={setTermOpen}>
              <DialogTrigger asChild><Button size="sm" disabled={years.length === 0}><Plus className="h-4 w-4 mr-1" /> Add term</Button></DialogTrigger>
              <TermForm years={years} onSubmit={(f: any) => createTerm.mutate(f)} />
            </Dialog>
          </div>
          <div className="rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow><TableHead>Name</TableHead><TableHead>Academic year</TableHead><TableHead>Start</TableHead><TableHead>End</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Actions</TableHead></TableRow>
              </TableHeader>
              <TableBody>
                {!termsLoading && terms.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No terms yet.</TableCell></TableRow>
                ) : (
                  terms.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="font-medium">{t.name}</TableCell>
                      <TableCell>{t.academicYear?.name ?? "—"}</TableCell>
                      <TableCell>{fmt(t.startDate)}</TableCell>
                      <TableCell>{fmt(t.endDate)}</TableCell>
                      <TableCell>{t.isCurrent && <Badge>Current</Badge>}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => { if (confirm(`Delete term "${t.name}"?`)) deleteTerm.mutate(t.id); }}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </section>
      </div>
    </>
  );
}

function YearForm({ onSubmit }: any) {
  const [f, setF] = useState({ name: "", startDate: "", endDate: "", isCurrent: false });
  const set = (k: string, v: any) => setF({ ...f, [k]: v });
  return (
    <DialogContent>
      <DialogHeader><DialogTitle>New academic year</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div><Label>Name</Label><Input placeholder="2026" value={f.name} onChange={(e) => set("name", e.target.value)} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Start date</Label><Input type="date" value={f.startDate} onChange={(e) => set("startDate", e.target.value)} /></div>
          <div><Label>End date</Label><Input type="date" value={f.endDate} onChange={(e) => set("endDate", e.target.value)} /></div>
        </div>
        <div className="flex items-center gap-2 pt-1"><Switch checked={f.isCurrent} onCheckedChange={(v) => set("isCurrent", v)} /><Label>Set as current academic year</Label></div>
      </div>
      <DialogFooter><Button onClick={() => onSubmit(f)} disabled={!f.name || !f.startDate || !f.endDate}>Save</Button></DialogFooter>
    </DialogContent>
  );
}

function TermForm({ years, onSubmit }: any) {
  const [f, setF] = useState({ yearId: years[0]?.id ?? "", name: "", startDate: "", endDate: "", isCurrent: false });
  const set = (k: string, v: any) => setF({ ...f, [k]: v });
  return (
    <DialogContent>
      <DialogHeader><DialogTitle>New term</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div><Label>Academic year</Label>
          <Select value={f.yearId} onValueChange={(v) => set("yearId", v)}>
            <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
            <SelectContent>{years.map((y: any) => <SelectItem key={y.id} value={y.id}>{y.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div><Label>Name</Label><Input placeholder="Term 1" value={f.name} onChange={(e) => set("name", e.target.value)} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Start date</Label><Input type="date" value={f.startDate} onChange={(e) => set("startDate", e.target.value)} /></div>
          <div><Label>End date</Label><Input type="date" value={f.endDate} onChange={(e) => set("endDate", e.target.value)} /></div>
        </div>
        <div className="flex items-center gap-2 pt-1"><Switch checked={f.isCurrent} onCheckedChange={(v) => set("isCurrent", v)} /><Label>Set as current term</Label></div>
      </div>
      <DialogFooter><Button onClick={() => onSubmit(f)} disabled={!f.yearId || !f.name || !f.startDate || !f.endDate}>Save</Button></DialogFooter>
    </DialogContent>
  );
}
