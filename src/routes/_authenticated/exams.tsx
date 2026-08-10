import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api, type AssessmentType } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

const ASSESSMENT_LABELS: Record<string, string> = {
  MID_TERM: "Mid Term",
  END_OF_TERM: "End of Term",
  MOCK: "Mock",
  OPENER: "Opener",
  OTHER: "Other",
};

export const Route = createFileRoute("/_authenticated/exams")({
  head: () => ({ meta: [{ title: "Exams" }] }),
  component: Exams,
});

function Exams() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [termFilter, setTermFilter] = useState("");
  const [f, setF] = useState({ name: "", termId: "", assessmentType: "" as AssessmentType | "", examDate: "", outOf: 100, weight: 1 });

  const { data: terms = [] } = useQuery({ queryKey: ["terms-all"], queryFn: () => api.academicYears.terms.all() });
  const { data = [] } = useQuery({
    queryKey: ["exams", termFilter],
    queryFn: () => api.exams.list(termFilter || undefined),
  });

  const create = useMutation({
    mutationFn: () => api.exams.create({
      name: f.name,
      termId: f.termId || undefined,
      assessmentType: f.assessmentType || undefined,
      examDate: f.examDate || undefined,
      outOf: f.outOf,
      weight: f.weight,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["exams"] });
      toast.success("Exam added");
      setOpen(false);
      setF({ name: "", termId: "", assessmentType: "", examDate: "", outOf: 100, weight: 1 });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.exams.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["exams"] }); toast.success("Deleted"); },
    onError: (e: any) => toast.error(e.message),
  });

  const termLabel = (termId: string) => {
    const t = terms.find((t) => t.id === termId);
    return t ? `${t.name}${t.academicYear ? ` — ${t.academicYear.name}` : ""}` : "—";
  };

  return (
    <>
      <PageHeader title="Exams & assessments" actions={
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" /> Add exam</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>New exam</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Name</Label><Input placeholder="Mid-term Term 1" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Term</Label>
                  <Select value={f.termId} onValueChange={(v) => setF({ ...f, termId: v })}>
                    <SelectTrigger><SelectValue placeholder="Select term" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">— No term —</SelectItem>
                      {terms.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.name}{t.academicYear ? ` — ${t.academicYear.name}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div><Label>Assessment type</Label>
                  <Select value={f.assessmentType} onValueChange={(v) => setF({ ...f, assessmentType: v as AssessmentType })}>
                    <SelectTrigger><SelectValue placeholder="— Type —" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">— None —</SelectItem>
                      <SelectItem value="MID_TERM">Mid Term</SelectItem>
                      <SelectItem value="END_OF_TERM">End of Term</SelectItem>
                      <SelectItem value="MOCK">Mock</SelectItem>
                      <SelectItem value="OPENER">Opener</SelectItem>
                      <SelectItem value="OTHER">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div><Label>Date</Label><Input type="date" value={f.examDate} onChange={(e) => setF({ ...f, examDate: e.target.value })} /></div>
                <div><Label>Out of</Label><Input type="number" value={f.outOf} onChange={(e) => setF({ ...f, outOf: Number(e.target.value) })} /></div>
                <div><Label>Weight</Label><Input type="number" step="0.1" value={f.weight} onChange={(e) => setF({ ...f, weight: Number(e.target.value) })} /></div>
              </div>
            </div>
            <DialogFooter><Button onClick={() => create.mutate()} disabled={!f.name}>Save</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      } />
      <div className="p-6 space-y-4">
        {/* Term filter */}
        <div className="flex items-center gap-3">
          <Label className="shrink-0">Filter by term:</Label>
          <Select value={termFilter} onValueChange={setTermFilter}>
            <SelectTrigger className="w-72"><SelectValue placeholder="All terms / years" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="">All terms</SelectItem>
              {terms.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name}{t.academicYear ? ` — ${t.academicYear.name}` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {termFilter && (
            <Button variant="ghost" size="sm" onClick={() => setTermFilter("")}>Clear</Button>
          )}
          <span className="text-sm text-muted-foreground ml-auto">{data.length} exam{data.length !== 1 ? "s" : ""}</span>
        </div>

        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Term / Year</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Out of</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.length === 0
                ? <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">No exams found.</TableCell></TableRow>
                : data.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell className="font-medium">{e.name}</TableCell>
                    <TableCell>
                      {e.assessmentType
                        ? <Badge variant="outline">{ASSESSMENT_LABELS[e.assessmentType] ?? e.assessmentType}</Badge>
                        : <span className="text-muted-foreground text-xs">—</span>}
                    </TableCell>
                    <TableCell>
                      {e.termId ? <Badge variant="secondary">{termLabel(e.termId)}</Badge> : <span className="text-muted-foreground text-xs">—</span>}
                    </TableCell>
                    <TableCell>{e.examDate ?? "—"}</TableCell>
                    <TableCell>{e.outOf}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => { if (confirm(`Delete ${e.name}?`)) remove.mutate(e.id); }}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </>
  );
}
