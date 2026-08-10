import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useAuth, hasAny, ADMIN_ROLES } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/attendance")({
  head: () => ({ meta: [{ title: "Attendance" }] }),
  component: Attendance,
});

const STATUSES = ["PRESENT", "ABSENT", "LATE", "SICK", "EXCUSED"] as const;
const STATUS_COLORS: Record<string, string> = {
  PRESENT: "default",
  ABSENT: "destructive",
  LATE: "secondary",
  SICK: "secondary",
  EXCUSED: "outline",
};

function Attendance() {
  const { roles } = useAuth();
  const isAdmin = hasAny(roles, ADMIN_ROLES);
  const isTeacher = roles.includes("TEACHER") && !isAdmin;
  const qc = useQueryClient();
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [classId, setClassId] = useState<string>("");

  // For teachers: auto-load their assigned class
  const { data: myClasses = [] } = useQuery({
    queryKey: ["my-classes"],
    enabled: isTeacher,
    queryFn: () => api.classes.myClasses(),
  });

  const { data: allClasses = [] } = useQuery({
    queryKey: ["classes-att"],
    enabled: !isTeacher,
    queryFn: () => api.classes.list(),
  });

  const classes = isTeacher ? myClasses : allClasses;

  // Auto-select first class for teachers
  useEffect(() => {
    if (isTeacher && myClasses.length > 0 && !classId) {
      setClassId(myClasses[0].id);
    }
  }, [isTeacher, myClasses, classId]);

  const { data: pupils = [] } = useQuery({
    queryKey: ["pupils-att", classId],
    enabled: !!classId,
    queryFn: () => api.pupils.byClass(classId),
  });

  const { data: existing = [] } = useQuery({
    queryKey: ["att", classId, date],
    enabled: !!classId,
    queryFn: () => api.attendance.list(date, classId),
  });

  const map = new Map<string, string>(existing.map((r) => [r.pupil.id, r.status]));
  const [local, setLocal] = useState<Record<string, string>>({});
  const get = (id: string) => local[id] ?? map.get(id) ?? "PRESENT";

  // Summary counts
  const counts = STATUSES.reduce((acc, s) => {
    acc[s] = pupils.filter((p) => get(p.id) === s).length;
    return acc;
  }, {} as Record<string, number>);

  const save = useMutation({
    mutationFn: () => api.attendance.bulkCreate(
      pupils.map((p) => ({ pupilId: p.id, classId, date, status: get(p.id) }))
    ),
    onSuccess: () => {
      toast.success(`Attendance saved — ${pupils.length} pupils recorded`);
      qc.invalidateQueries({ queryKey: ["att"] });
      setLocal({});
    },
    onError: (e: any) => toast.error(e.message),
  });

  const selectedClass = classes.find((c) => c.id === classId);

  return (
    <>
      <PageHeader
        title="Daily attendance"
        description={selectedClass ? `${selectedClass.name}${selectedClass.stream ? " " + selectedClass.stream : ""} — ${date}` : `Mark attendance for ${date}`}
      />
      <div className="p-6 space-y-4">
        <div className="flex flex-wrap gap-3 items-end">
          {isTeacher && classes.length <= 1 ? (
            // Teacher with one class — show read-only label
            <div>
              <label className="text-sm text-muted-foreground">Your class</label>
              <div className="h-9 flex items-center px-3 rounded-md border bg-muted text-sm font-medium">
                {selectedClass ? `${selectedClass.name}${selectedClass.stream ? " " + selectedClass.stream : ""}` : "No class assigned"}
              </div>
            </div>
          ) : (
            <div>
              <label className="text-sm">Class</label>
              <Select value={classId} onValueChange={(v) => { setClassId(v); setLocal({}); }}>
                <SelectTrigger className="w-56"><SelectValue placeholder="Select class" /></SelectTrigger>
                <SelectContent>{classes.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}{c.stream ? " " + c.stream : ""}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}
          <div>
            <label className="text-sm">Date</label>
            <Input type="date" value={date} onChange={(e) => { setDate(e.target.value); setLocal({}); }} />
          </div>
          <Button
            variant="outline"
            onClick={() => { const next: Record<string, string> = {}; pupils.forEach((p) => (next[p.id] = "PRESENT")); setLocal(next); }}
            disabled={!classId || pupils.length === 0}
          >
            Mark all present
          </Button>
          <Button
            variant="outline"
            onClick={() => { const next: Record<string, string> = {}; pupils.forEach((p) => (next[p.id] = "ABSENT")); setLocal(next); }}
            disabled={!classId || pupils.length === 0}
          >
            Mark all absent
          </Button>
          <Button
            onClick={() => save.mutate()}
            disabled={!classId || pupils.length === 0 || save.isPending}
          >
            {save.isPending ? "Saving…" : "Submit attendance"}
          </Button>
        </div>

        {/* Summary badges */}
        {classId && pupils.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {STATUSES.map((s) => counts[s] > 0 && (
              <Badge key={s} variant={STATUS_COLORS[s] as any} className="text-xs">
                {s.charAt(0) + s.slice(1).toLowerCase()}: {counts[s]}
              </Badge>
            ))}
            <span className="text-xs text-muted-foreground self-center ml-1">Total: {pupils.length}</span>
          </div>
        )}

        {classId && (
          <div className="rounded-lg border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Admission</TableHead>
                  <TableHead>Pupil</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pupils.length === 0
                  ? <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">No pupils in this class.</TableCell></TableRow>
                  : pupils.map((p, idx) => (
                    <TableRow key={p.id} className={get(p.id) === "ABSENT" ? "bg-red-50/40 dark:bg-red-950/10" : undefined}>
                      <TableCell className="text-muted-foreground text-xs">{idx + 1}</TableCell>
                      <TableCell className="font-mono text-xs">{p.admissionNo}</TableCell>
                      <TableCell className="font-medium">{p.fullName}</TableCell>
                      <TableCell>
                        <Select value={get(p.id)} onValueChange={(v) => setLocal({ ...local, [p.id]: v })}>
                          <SelectTrigger className="w-36 h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {STATUSES.map((s) => (
                              <SelectItem key={s} value={s}>{s.charAt(0) + s.slice(1).toLowerCase()}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>
          </div>
        )}

        {isTeacher && myClasses.length === 0 && (
          <div className="rounded-lg border bg-muted/40 p-8 text-center text-sm text-muted-foreground">
            No class has been assigned to you yet. Ask an administrator to assign you as a class teacher.
          </div>
        )}
      </div>
    </>
  );
}
