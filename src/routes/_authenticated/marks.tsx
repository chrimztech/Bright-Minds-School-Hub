import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { useAuth, ADMIN_ROLES, hasAny } from "@/lib/auth";
import { gradeFor } from "@/lib/grading";

export const Route = createFileRoute("/_authenticated/marks")({
  head: () => ({ meta: [{ title: "Marks entry" }] }),
  component: Marks,
});

function Marks() {
  const { roles } = useAuth();
  const isAdmin = hasAny(roles, ADMIN_ROLES);
  const isTeacher = roles.includes("TEACHER") && !isAdmin;
  const qc = useQueryClient();
  const [termId, setTermId] = useState("");
  const [examId, setExamId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [classId, setClassId] = useState("");
  const [scores, setScores] = useState<Record<string, string>>({});
  const [comments, setComments] = useState<Record<string, string>>({});

  const { data: terms = [] } = useQuery({ queryKey: ["terms-all"], queryFn: () => api.academicYears.terms.all() });
  const { data: exams = [] } = useQuery({
    queryKey: ["exams-pick", termId],
    queryFn: () => api.exams.list(termId || undefined),
  });
  const { data: allSubjects = [] } = useQuery({ queryKey: ["subjects-pick"], queryFn: () => api.subjects.list() });
  const { data: allClasses = [] } = useQuery({
    queryKey: ["classes-pick-m"],
    enabled: !isTeacher,
    queryFn: () => api.classes.list(),
  });
  const { data: myClasses = [] } = useQuery({
    queryKey: ["my-classes-marks"],
    enabled: isTeacher,
    queryFn: () => api.classes.myClasses(),
  });
  const classes = isTeacher ? myClasses : allClasses;

  useEffect(() => { if (!classId && classes.length >= 1) setClassId(classes[0].id); }, [classes, classId]);
  useEffect(() => { if (!subjectId && allSubjects.length >= 1) setSubjectId(allSubjects[0].id); }, [allSubjects, subjectId]);
  useEffect(() => { setExamId(""); }, [termId]);
  useEffect(() => { if (!examId && exams.length >= 1) setExamId(exams[0].id); }, [exams, examId]);

  const { data: pupils = [] } = useQuery({
    queryKey: ["pupils-marks", classId],
    enabled: !!classId,
    queryFn: () => api.pupils.byClass(classId),
  });
  const { data: existing = [] } = useQuery({
    queryKey: ["marks", examId, subjectId],
    enabled: !!(examId && subjectId),
    queryFn: () => api.exams.marks.list(examId),
  });

  const marksForSubject = existing.filter((m) => m.subject?.id === subjectId);
  const map = new Map<string, { score: number; comment: string | null }>(
    marksForSubject.map((m) => [m.pupil.id, { score: m.score, comment: m.comment ?? null }])
  );
  const getScore = (id: string) => scores[id] ?? (map.has(id) ? String(map.get(id)!.score) : "");
  const getComment = (id: string) => comments[id] ?? (map.get(id)?.comment ?? "");
  const exam = exams.find((e) => e.id === examId);

  const save = useMutation({
    mutationFn: async () => {
      const toSave = pupils.filter((p) => getScore(p.id) !== "");
      for (const p of toSave) {
        await api.exams.marks.save(examId, { pupilId: p.id, subjectId, score: Number(getScore(p.id)), comment: getComment(p.id) || undefined });
      }
    },
    onSuccess: () => { toast.success("Marks saved"); qc.invalidateQueries({ queryKey: ["marks"] }); setScores({}); setComments({}); },
    onError: (e: any) => toast.error(e.message),
  });

  const entered = pupils.filter((p) => getScore(p.id) !== "").length;
  const avg = entered ? pupils.reduce((s, p) => { const v = Number(getScore(p.id) || 0); return s + (v ? (v / (exam?.outOf ?? 100)) * 100 : 0); }, 0) / entered : 0;

  return (
    <>
      <PageHeader title="Marks entry" description={isAdmin ? "Enter scores for any class and subject" : "Enter scores for your assigned classes"} />
      <div className="p-6 space-y-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div><label className="text-sm">Term</label>
            <Select value={termId} onValueChange={setTermId}>
              <SelectTrigger className="w-52"><SelectValue placeholder="All terms" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="">All terms</SelectItem>
                {terms.map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.name}{t.academicYear ? ` — ${t.academicYear.name}` : ""}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div><label className="text-sm">Exam</label>
            <Select value={examId} onValueChange={setExamId}><SelectTrigger className="w-56"><SelectValue placeholder="Exam" /></SelectTrigger><SelectContent>{exams.map((e) => <SelectItem key={e.id} value={e.id}>{e.name} (/{e.outOf})</SelectItem>)}</SelectContent></Select>
          </div>
          <div><label className="text-sm">Class</label>
            {isTeacher && classes.length <= 1 ? (
              <div className="h-9 flex items-center px-3 rounded-md border bg-muted text-sm font-medium w-44">
                {classes[0] ? `${classes[0].name}${classes[0].stream ? " " + classes[0].stream : ""}` : "No class assigned"}
              </div>
            ) : (
              <Select value={classId} onValueChange={(v) => { setClassId(v); setSubjectId(""); }}>
                <SelectTrigger className="w-44"><SelectValue placeholder="Class" /></SelectTrigger>
                <SelectContent>{classes.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}{c.stream ? " " + c.stream : ""}</SelectItem>)}</SelectContent>
              </Select>
            )}
          </div>
          <div><label className="text-sm">Subject</label>
            <Select value={subjectId} onValueChange={setSubjectId}><SelectTrigger className="w-44"><SelectValue placeholder="Subject" /></SelectTrigger><SelectContent>{allSubjects.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent></Select>
          </div>
          <Button onClick={() => save.mutate()} disabled={!examId || !subjectId || !classId || save.isPending}>{save.isPending ? "Saving…" : "Save marks"}</Button>
          {examId && subjectId && classId && (
            <div className="flex gap-2 ml-auto">
              <Badge variant="secondary">{entered}/{pupils.length} entered</Badge>
              <Badge>Avg {avg.toFixed(1)}%</Badge>
            </div>
          )}
        </div>
        {examId && subjectId && classId && (
          <div className="rounded-lg border bg-card">
            <Table>
              <TableHeader><TableRow><TableHead>Adm</TableHead><TableHead>Pupil</TableHead><TableHead>Score (out of {exam?.outOf ?? 100})</TableHead><TableHead>Grade</TableHead><TableHead>Comment</TableHead></TableRow></TableHeader>
              <TableBody>
                {pupils.map((p) => {
                  const s = getScore(p.id);
                  const pct = s ? (Number(s) / (exam?.outOf ?? 100)) * 100 : null;
                  const g = pct != null ? gradeFor(pct) : null;
                  return (
                    <TableRow key={p.id}>
                      <TableCell className="font-mono text-xs">{p.admissionNo}</TableCell>
                      <TableCell className="font-medium">{p.fullName}</TableCell>
                      <TableCell><Input className="w-24" type="number" value={s} onChange={(e) => setScores({ ...scores, [p.id]: e.target.value })} /></TableCell>
                      <TableCell>{g ? `${g.grade} (${g.label})` : "—"}</TableCell>
                      <TableCell><Textarea rows={1} className="min-h-9" value={getComment(p.id)} onChange={(e) => setComments({ ...comments, [p.id]: e.target.value })} /></TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </>
  );
}
