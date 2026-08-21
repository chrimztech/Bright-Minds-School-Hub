import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/EmptyState";
import { ArrowUpCircle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth, hasPermission } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/promotions")({
  head: () => ({ meta: [{ title: "Pupil promotions" }] }),
  component: PromotionsPage,
});

function PromotionsPage() {
  const qc = useQueryClient();
  const { permissions } = useAuth();
  const canManage = hasPermission(permissions, "promotions:manage");
  const [sourceClassId, setSourceClassId] = useState("");
  const [targetClassId, setTargetClassId] = useState("");
  const [academicYearId, setAcademicYearId] = useState("");
  const [promotedOn, setPromotedOn] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [selected, setSelected] = useState<string[]>([]);

  const { data: classes = [] } = useQuery({ queryKey: ["classes-promotions"], queryFn: () => api.classes.list() });
  const { data: years = [] } = useQuery({ queryKey: ["years-promotions"], queryFn: () => api.academicYears.list() });
  const { data: pupils = [], isLoading } = useQuery({
    queryKey: ["promotion-pupils", sourceClassId],
    enabled: !!sourceClassId,
    queryFn: () => api.pupils.byClass(sourceClassId),
  });

  const sourceClass = classes.find((item) => item.id === sourceClassId);
  const nextLevel = useMemo(() => {
    if (!sourceClass) return null;
    const levels = classes.map((item) => item.levelOrder).filter((level) => level > sourceClass.levelOrder);
    return levels.length ? Math.min(...levels) : null;
  }, [classes, sourceClass]);
  const targetClasses = classes.filter((item) => nextLevel != null && item.levelOrder === nextLevel);

  const promote = useMutation({
    mutationFn: () => api.promotions.create({
      pupilIds: selected,
      targetClassId,
      academicYearId: academicYearId || undefined,
      promotedOn,
      notes: notes || undefined,
    }),
    onSuccess: (result) => {
      toast.success(`${result.promotedCount} pupil${result.promotedCount === 1 ? "" : "s"} promoted successfully`);
      setSelected([]);
      setTargetClassId("");
      setNotes("");
      qc.invalidateQueries({ queryKey: ["promotion-pupils"] });
      qc.invalidateQueries({ queryKey: ["pupils"] });
    },
    onError: (error: any) => toast.error(error.message),
  });

  function changeSource(value: string) {
    setSourceClassId(value);
    setTargetClassId("");
    setSelected([]);
  }

  function toggleAll(checked: boolean) {
    setSelected(checked ? pupils.filter((p) => p.status === "ACTIVE").map((p) => p.id) : []);
  }

  function togglePupil(id: string, checked: boolean) {
    setSelected((current) => checked ? [...new Set([...current, id])] : current.filter((item) => item !== id));
  }

  return (
    <>
      <PageHeader title="Pupil promotions" description="Move pupils to the next configured grade while preserving their academic history" />
      <div className="p-6 space-y-5">
        <Card>
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><ArrowUpCircle className="h-5 w-5" /> Promotion setup</CardTitle></CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div><Label>Current class</Label>
              <Select value={sourceClassId} onValueChange={changeSource}>
                <SelectTrigger><SelectValue placeholder="Select class" /></SelectTrigger>
                <SelectContent>{classes.map((item) => <SelectItem key={item.id} value={item.id}>{classLabel(item)}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Next grade / class</Label>
              <Select value={targetClassId} onValueChange={setTargetClassId} disabled={!targetClasses.length}>
                <SelectTrigger><SelectValue placeholder={sourceClass && nextLevel == null ? "Highest grade" : "Select destination"} /></SelectTrigger>
                <SelectContent>{targetClasses.map((item) => <SelectItem key={item.id} value={item.id}>{classLabel(item)}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Academic year</Label>
              <Select value={academicYearId || "__current"} onValueChange={(value) => setAcademicYearId(value === "__current" ? "" : value)}>
                <SelectTrigger><SelectValue placeholder="Current year" /></SelectTrigger>
                <SelectContent><SelectItem value="__current">Current academic year</SelectItem>{years.map((year) => <SelectItem key={year.id} value={year.id}>{year.name}{year.isCurrent ? " (current)" : ""}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Promotion date</Label><Input type="date" value={promotedOn} onChange={(event) => setPromotedOn(event.target.value)} /></div>
            <div className="md:col-span-2 lg:col-span-4"><Label>Notes</Label><Textarea rows={2} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Optional promotion notes" /></div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <div><CardTitle className="text-base">Select pupils</CardTitle><p className="text-sm text-muted-foreground mt-1">Only active pupils can be promoted.</p></div>
            <Badge variant="secondary">{selected.length} selected</Badge>
          </CardHeader>
          <CardContent>
            {!sourceClassId ? <EmptyState message="Select a current class to view its pupils." /> : isLoading ? <p className="text-center text-sm text-muted-foreground py-8">Loading pupils…</p> : pupils.length === 0 ? <EmptyState message="This class has no pupils." /> : (
              <div className="rounded-lg border overflow-hidden">
                <Table>
                  <TableHeader><TableRow><TableHead className="w-12"><Checkbox checked={selected.length > 0 && selected.length === pupils.filter((p) => p.status === "ACTIVE").length} onCheckedChange={(value) => toggleAll(value === true)} /></TableHead><TableHead>Pupil</TableHead><TableHead>Admission number</TableHead><TableHead>Status</TableHead><TableHead>Current class</TableHead></TableRow></TableHeader>
                  <TableBody>{pupils.map((pupil) => (
                    <TableRow key={pupil.id}>
                      <TableCell><Checkbox disabled={pupil.status !== "ACTIVE"} checked={selected.includes(pupil.id)} onCheckedChange={(value) => togglePupil(pupil.id, value === true)} /></TableCell>
                      <TableCell className="font-medium">{pupil.fullName}</TableCell>
                      <TableCell className="font-mono text-xs">{pupil.admissionNo}</TableCell>
                      <TableCell><Badge variant={pupil.status === "ACTIVE" ? "default" : "secondary"}>{pupil.status}</Badge></TableCell>
                      <TableCell>{sourceClass ? classLabel(sourceClass) : "—"}</TableCell>
                    </TableRow>
                  ))}</TableBody>
                </Table>
              </div>
            )}
            {canManage && (
              <div className="flex justify-end mt-4">
                <Button onClick={() => promote.mutate()} disabled={!selected.length || !targetClassId || !promotedOn || promote.isPending}>
                  <CheckCircle2 className="h-4 w-4 mr-1.5" /> {promote.isPending ? "Promoting…" : `Promote ${selected.length || "selected"}`}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function classLabel(item: { name: string; stream?: string }) {
  return `${item.name}${item.stream ? ` ${item.stream}` : ""}`;
}
