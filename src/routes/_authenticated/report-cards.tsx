import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { api, type Mark, type Pupil } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Printer, Download, TrendingUp, School, Trophy } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid } from "recharts";
import { gradeFor, DEFAULT_BANDS } from "@/lib/grading";
import { useAuth, ADMIN_ROLES, hasAny } from "@/lib/auth";
import { PrintOverlay, DocHeader, useSchool } from "@/components/PrintableDoc";

export const Route = createFileRoute("/_authenticated/report-cards")({
  head: () => ({ meta: [{ title: "Report cards" }] }),
  component: ReportCardsPage,
});

// ─── Colour map ───────────────────────────────────────────────────────────────
const GC: Record<string, string> = { A: "#16a34a", B: "#2563eb", C: "#ca8a04", D: "#ea580c", E: "#dc2626" };

// ─── Data helpers ─────────────────────────────────────────────────────────────
function groupByPupil(marks: Mark[]) {
  const m = new Map<string, { pupil: Pupil; marks: Mark[] }>();
  for (const mk of marks) {
    if (!m.has(mk.pupil.id)) m.set(mk.pupil.id, { pupil: mk.pupil, marks: [] });
    m.get(mk.pupil.id)!.marks.push(mk);
  }
  return m;
}

function pupilAvg(marks: Mark[], outOf: number) {
  if (!marks.length) return 0;
  return (marks.reduce((s, m) => s + Number(m.score), 0) / (marks.length * outOf)) * 100;
}

function buildRanked(marks: Mark[], outOf: number) {
  return [...groupByPupil(marks).values()]
    .map(({ pupil, marks: pm }) => ({
      pupil,
      marks: pm,
      total: pm.reduce((s, m) => s + Number(m.score), 0),
      maxTotal: pm.length * outOf,
      average: pupilAvg(pm, outOf),
    }))
    .sort((a, b) => b.average - a.average)
    .map((r, i) => ({ ...r, position: i + 1 }));
}

function buildSubjectStats(marks: Mark[], outOf: number) {
  const map = new Map<string, { name: string; scores: number[] }>();
  for (const m of marks) {
    const k = m.subject?.id ?? "?";
    if (!map.has(k)) map.set(k, { name: m.subject?.name ?? "—", scores: [] });
    map.get(k)!.scores.push(Number(m.score));
  }
  return [...map.values()].map(({ name, scores }) => {
    const pcts = scores.map(s => (s / outOf) * 100);
    const a = pcts.reduce((s, x) => s + x, 0) / pcts.length;
    return { name, avg: a, highest: Math.max(...pcts), lowest: Math.min(...pcts), passRate: (pcts.filter(p => p >= 50).length / pcts.length) * 100, count: scores.length };
  }).sort((a, b) => b.avg - a.avg);
}

function gradeDist(averages: number[]) {
  return DEFAULT_BANDS.map(b => ({ grade: b.grade, label: b.label, count: averages.filter(a => a >= b.min && a <= b.max).length }));
}

function toCsv(rows: string[][], filename: string) {
  const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  a.download = filename; a.click();
}

// ─── Page ──────────────────────────────────────────────────────────────────────
function ReportCardsPage() {
  const { roles } = useAuth();
  const isAdmin = hasAny(roles, ADMIN_ROLES);
  const isParentOnly = roles.length > 0 && roles.every(r => r === "PARENT");
  const isTeacher = roles.includes("TEACHER") && !isAdmin;

  return (
    <>
      <PageHeader title="Report cards & performance analysis" />
      <div className="p-6">
        <Tabs defaultValue="report-card">
          <TabsList className="mb-5">
            <TabsTrigger value="report-card"><Printer className="h-3.5 w-3.5 mr-1.5" />Report Card</TabsTrigger>
            {!isParentOnly && <TabsTrigger value="class"><TrendingUp className="h-3.5 w-3.5 mr-1.5" />Class Analysis</TabsTrigger>}
            {(isAdmin || isTeacher) && <TabsTrigger value="school"><School className="h-3.5 w-3.5 mr-1.5" />School Analysis</TabsTrigger>}
          </TabsList>
          <TabsContent value="report-card"><ReportCardTab isParentOnly={isParentOnly} /></TabsContent>
          {!isParentOnly && <TabsContent value="class"><ClassAnalysisTab /></TabsContent>}
          {(isAdmin || isTeacher) && <TabsContent value="school"><SchoolAnalysisTab /></TabsContent>}
        </Tabs>
      </div>
    </>
  );
}

// ─── Tab 1: Individual report card ────────────────────────────────────────────
function ReportCardTab({ isParentOnly }: { isParentOnly: boolean }) {
  const [termId, setTermId] = useState("");
  const [examId, setExamId] = useState("");
  const [pupilId, setPupilId] = useState("");
  const [remarks, setRemarks] = useState("");
  const [printOpen, setPrintOpen] = useState(false);
  const [batchClassId, setBatchClassId] = useState("");
  const [batchOpen, setBatchOpen] = useState(false);

  const { data: school } = useSchool();
  const { data: terms = [] } = useQuery({ queryKey: ["terms-all"], queryFn: () => api.academicYears.terms.all() });
  const { data: exams = [] } = useQuery({ queryKey: ["exams-rc", termId], queryFn: () => api.exams.list(termId || undefined) });
  const { data: classes = [] } = useQuery({ queryKey: ["classes-rc"], enabled: !isParentOnly, queryFn: () => api.classes.list() });
  const { data: allPupils = [] } = useQuery({ queryKey: ["pupils-rc"], enabled: !isParentOnly, queryFn: () => api.pupils.all() });
  const { data: myChildren = [] } = useQuery({ queryKey: ["my-children-rc"], enabled: isParentOnly, queryFn: () => api.guardians.myPupils() });
  const pupils = isParentOnly ? myChildren : allPupils;

  const { data: allMarks = [] } = useQuery({ queryKey: ["rc-marks", examId], enabled: !!examId, queryFn: () => api.exams.marks.list(examId) });

  const selectedTerm = terms.find(t => t.id === termId);
  const exam = exams.find(e => e.id === examId);
  const pupil = pupils.find(p => p.id === pupilId);
  const myMarks = useMemo(() => allMarks.filter(m => m.pupil.id === pupilId), [allMarks, pupilId]);

  const classMarks = useMemo(() => {
    const cid = pupil?.schoolClass?.id;
    return cid ? allMarks.filter(m => m.pupil.schoolClass?.id === cid) : [];
  }, [allMarks, pupil]);
  const ranking = useMemo(() => buildRanked(classMarks, exam?.outOf ?? 100), [classMarks, exam]);
  const myRank = ranking.find(r => r.pupil.id === pupilId);

  const { data: attendance = [] } = useQuery({
    queryKey: ["att-rc", pupilId, selectedTerm?.id],
    enabled: !!pupilId && !!selectedTerm,
    queryFn: () => api.attendance.byPupil(pupilId, selectedTerm!.startDate, selectedTerm!.endDate),
  });

  const outOf = exam?.outOf ?? 100;
  const total = myMarks.reduce((s, m) => s + Number(m.score), 0);
  const maxTotal = myMarks.length * outOf;
  const avgPct = myMarks.length ? (total / maxTotal) * 100 : 0;

  function csvExport() {
    const rows = [["Subject", "Score", `Out of ${outOf}`, "%", "Grade", "Remark"]];
    myMarks.forEach(m => {
      const pct = (Number(m.score) / outOf) * 100;
      const g = gradeFor(pct);
      rows.push([m.subject?.name ?? "", String(m.score), String(outOf), pct.toFixed(1) + "%", g.grade, m.comment ?? g.label]);
    });
    toCsv(rows, `report-card-${pupil?.admissionNo}-${exam?.name}.csv`);
  }

  const batchMarks = useMemo(() =>
    batchClassId ? allMarks.filter(m => m.pupil.schoolClass?.id === batchClassId) : [],
    [allMarks, batchClassId]);
  const batchRanked = useMemo(() => buildRanked(batchMarks, outOf), [batchMarks, outOf]);

  const ready = !!pupilId && !!examId && pupil && exam;

  return (
    <div className="space-y-5">
      {/* Selectors */}
      <div className="flex flex-wrap gap-3 items-end">
        <div><Label className="text-xs text-muted-foreground">Term</Label>
          <Select value={termId} onValueChange={v => { setTermId(v); setExamId(""); }}>
            <SelectTrigger className="w-48"><SelectValue placeholder="All terms" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="">All terms</SelectItem>
              {terms.map(t => <SelectItem key={t.id} value={t.id}>{t.name}{t.academicYear ? ` — ${t.academicYear.name}` : ""}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div><Label className="text-xs text-muted-foreground">Exam / Assessment</Label>
          <Select value={examId} onValueChange={setExamId}>
            <SelectTrigger className="w-56"><SelectValue placeholder="Select exam" /></SelectTrigger>
            <SelectContent>
              {exams.map(e => <SelectItem key={e.id} value={e.id}>{e.name}{e.assessmentType ? ` (${e.assessmentType.replace("_", " ")})` : ""}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div><Label className="text-xs text-muted-foreground">Pupil</Label>
          <Select value={pupilId} onValueChange={setPupilId}>
            <SelectTrigger className="w-72"><SelectValue placeholder="Select pupil" /></SelectTrigger>
            <SelectContent>
              {pupils.map(p => <SelectItem key={p.id} value={p.id}>{p.fullName} — {p.admissionNo}{p.schoolClass ? ` (${p.schoolClass.name})` : ""}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        {ready && (
          <>
            <Button variant="outline" onClick={csvExport}><Download className="h-4 w-4 mr-1" />CSV</Button>
            <Button onClick={() => setPrintOpen(true)}><Printer className="h-4 w-4 mr-1" />Print / PDF</Button>
          </>
        )}
      </div>

      {/* Teacher remarks */}
      {ready && !isParentOnly && (
        <div className="max-w-lg">
          <Label className="text-xs text-muted-foreground">Class teacher's remarks (printed on report card)</Label>
          <Textarea rows={2} placeholder="e.g. A hardworking and focused pupil. Keep it up!" value={remarks} onChange={e => setRemarks(e.target.value)} className="mt-1" />
        </div>
      )}

      {/* Preview card */}
      {ready && (
        <Card className="max-w-3xl">
          <CardHeader className="border-b pb-4">
            <div className="flex items-center gap-4">
              <img src="/logo.png" alt="" className="h-14 w-14 object-contain" />
              <div>
                <CardTitle className="text-xl">{school?.name ?? "School"}</CardTitle>
                {school?.motto && <p className="text-xs italic text-muted-foreground">"{school.motto}"</p>}
                <p className="text-xs text-muted-foreground">Pupil Report Card — {exam.name}{exam.assessmentType ? ` (${exam.assessmentType.replace("_", " ")})` : ""}{selectedTerm ? ` · ${selectedTerm.name}` : ""}</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-4 space-y-4">
            {/* Pupil info */}
            <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm border rounded-lg p-3 bg-muted/30">
              <div><span className="text-muted-foreground">Name: </span><span className="font-semibold">{pupil.fullName}</span></div>
              <div><span className="text-muted-foreground">Adm No: </span><span className="font-mono font-semibold">{pupil.admissionNo}</span></div>
              <div><span className="text-muted-foreground">Class: </span><span className="font-semibold">{pupil.schoolClass?.name ?? "—"}{pupil.schoolClass?.stream ? " " + pupil.schoolClass.stream : ""}</span></div>
              <div><span className="text-muted-foreground">Gender: </span><span>{pupil.gender ?? "—"}</span></div>
              {exam.examDate && <div><span className="text-muted-foreground">Date: </span><span>{exam.examDate}</span></div>}
              {selectedTerm && <div><span className="text-muted-foreground">Academic Year: </span><span>{selectedTerm.academicYear?.name ?? "—"}</span></div>}
            </div>

            {/* Marks table */}
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead>Subject</TableHead>
                  <TableHead className="text-right">Score</TableHead>
                  <TableHead className="text-right">%</TableHead>
                  <TableHead>Grade</TableHead>
                  <TableHead>Remark</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {myMarks.length === 0
                  ? <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">No marks recorded for this exam.</TableCell></TableRow>
                  : myMarks.map((m, i) => {
                    const pct = (Number(m.score) / outOf) * 100;
                    const g = gradeFor(pct);
                    return (
                      <TableRow key={i}>
                        <TableCell className="font-medium">{m.subject?.name}</TableCell>
                        <TableCell className="text-right font-mono">{m.score}/{outOf}</TableCell>
                        <TableCell className="text-right">{pct.toFixed(1)}%</TableCell>
                        <TableCell><span className="font-bold text-sm" style={{ color: GC[g.grade] }}>{g.grade}</span></TableCell>
                        <TableCell className="text-muted-foreground text-sm">{m.comment ?? g.label}</TableCell>
                      </TableRow>
                    );
                  })}
              </TableBody>
            </Table>

            {/* Summary row */}
            {myMarks.length > 0 && (
              <div className="grid grid-cols-4 gap-3 border rounded-lg p-3 bg-muted/20 text-center">
                <div><p className="text-xs text-muted-foreground">Total</p><p className="text-lg font-bold">{total}/{maxTotal}</p></div>
                <div><p className="text-xs text-muted-foreground">Average</p><p className="text-lg font-bold">{avgPct.toFixed(1)}%</p></div>
                <div><p className="text-xs text-muted-foreground">Grade</p><p className="text-2xl font-bold" style={{ color: GC[gradeFor(avgPct).grade] }}>{gradeFor(avgPct).grade}</p></div>
                <div><p className="text-xs text-muted-foreground">Class position</p><p className="text-lg font-bold">{myRank ? `${myRank.position} / ${ranking.length}` : "—"}</p></div>
              </div>
            )}

            {/* Attendance */}
            {attendance.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Attendance this term</p>
                <div className="grid grid-cols-4 gap-3 border rounded-lg p-3 text-center text-sm">
                  {(["PRESENT","ABSENT","LATE","EXCUSED"] as const).map(s => (
                    <div key={s}><p className="text-xs text-muted-foreground">{s.charAt(0)+s.slice(1).toLowerCase()}</p>
                      <p className="font-bold">{attendance.filter(a => a.status === s).length}</p></div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Batch print section */}
      {!isParentOnly && examId && (
        <div className="flex items-center gap-3 pt-2 border-t">
          <span className="text-sm text-muted-foreground">Batch print:</span>
          <Select value={batchClassId} onValueChange={setBatchClassId}>
            <SelectTrigger className="w-52"><SelectValue placeholder="Select class…" /></SelectTrigger>
            <SelectContent>{classes.map(c => <SelectItem key={c.id} value={c.id}>{c.name}{c.stream ? " " + c.stream : ""}</SelectItem>)}</SelectContent>
          </Select>
          <Button variant="outline" disabled={!batchClassId || batchRanked.length === 0} onClick={() => setBatchOpen(true)}>
            <Printer className="h-4 w-4 mr-1" />Print all ({batchRanked.length} pupils)
          </Button>
        </div>
      )}

      {/* Individual print overlay */}
      {printOpen && ready && (
        <PrintOverlay onClose={() => setPrintOpen(false)}>
          <ReportCardPrint school={school} pupil={pupil} exam={exam} marks={myMarks} term={selectedTerm} attendance={attendance} position={myRank?.position ?? null} classSize={ranking.length} remarks={remarks} />
        </PrintOverlay>
      )}

      {/* Batch print overlay */}
      {batchOpen && exam && (
        <PrintOverlay onClose={() => setBatchOpen(false)}>
          {batchRanked.map(({ pupil: p, marks: pm, position, average }, i) => (
            <div key={p.id} style={{ pageBreakAfter: i < batchRanked.length - 1 ? "always" : "auto" }}>
              <ReportCardPrint school={school} pupil={p} exam={exam} marks={pm} term={selectedTerm} attendance={[]} position={position} classSize={batchRanked.length} remarks="" />
            </div>
          ))}
        </PrintOverlay>
      )}
    </div>
  );
}

// ─── Printable report card ─────────────────────────────────────────────────────
function ReportCardPrint({ school, pupil, exam, marks, term, attendance, position, classSize, remarks }: any) {
  const outOf = exam.outOf;
  const total = marks.reduce((s: number, m: Mark) => s + Number(m.score), 0);
  const maxTotal = marks.length * outOf;
  const avgPct = marks.length ? (total / maxTotal) * 100 : 0;
  const g = gradeFor(avgPct);
  const present = attendance.filter((a: any) => a.status === "PRESENT").length;
  const absent = attendance.filter((a: any) => a.status === "ABSENT").length;
  const late = attendance.filter((a: any) => a.status === "LATE").length;
  const attPct = attendance.length ? Math.round((present / attendance.length) * 100) : null;

  return (
    <div className="p-10 font-sans text-black text-sm">
      <DocHeader school={{ ...school, logoUrl: school?.logoUrl ?? "/logo.png" }} title="Pupil Report Card" />

      {/* Meta */}
      <div className="flex justify-between text-xs text-gray-600 mb-5">
        {term && <span>Term: <strong>{term.name}</strong>{term.academicYear ? ` · ${term.academicYear.name}` : ""}</span>}
        <span>Assessment: <strong>{exam.name}{exam.assessmentType ? ` (${exam.assessmentType.replace("_", " ")})` : ""}</strong></span>
        {exam.examDate && <span>Date: <strong>{exam.examDate}</strong></span>}
      </div>

      {/* Pupil info box */}
      <table className="w-full border border-gray-300 mb-5 text-sm">
        <tbody>
          <tr className="bg-gray-50">
            <td className="border border-gray-300 px-3 py-1.5"><span className="text-gray-500">Full name: </span><strong>{pupil.fullName}</strong></td>
            <td className="border border-gray-300 px-3 py-1.5"><span className="text-gray-500">Adm No: </span><strong className="font-mono">{pupil.admissionNo}</strong></td>
          </tr>
          <tr>
            <td className="border border-gray-300 px-3 py-1.5"><span className="text-gray-500">Class: </span><strong>{pupil.schoolClass?.name ?? "—"}{pupil.schoolClass?.stream ? " " + pupil.schoolClass.stream : ""}</strong></td>
            <td className="border border-gray-300 px-3 py-1.5"><span className="text-gray-500">Gender: </span>{pupil.gender ?? "—"}</td>
          </tr>
        </tbody>
      </table>

      {/* Marks table */}
      <p className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">Academic Performance</p>
      <table className="w-full border-collapse mb-5 text-sm">
        <thead>
          <tr className="bg-gray-100 border-b-2 border-black">
            <th className="text-left py-2 px-2">Subject</th>
            <th className="text-center py-2 px-2">Score</th>
            <th className="text-center py-2 px-2">Out of</th>
            <th className="text-center py-2 px-2">%</th>
            <th className="text-center py-2 px-2">Grade</th>
            <th className="text-left py-2 px-2">Remark</th>
          </tr>
        </thead>
        <tbody>
          {marks.length === 0
            ? <tr><td colSpan={6} className="text-center py-4 text-gray-400">No marks recorded.</td></tr>
            : marks.map((m: Mark, i: number) => {
              const pct = (Number(m.score) / outOf) * 100;
              const mg = gradeFor(pct);
              return (
                <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                  <td className="py-1.5 px-2 border-b border-gray-200">{m.subject?.name}</td>
                  <td className="py-1.5 px-2 border-b border-gray-200 text-center font-mono font-semibold">{m.score}</td>
                  <td className="py-1.5 px-2 border-b border-gray-200 text-center text-gray-500">{outOf}</td>
                  <td className="py-1.5 px-2 border-b border-gray-200 text-center">{pct.toFixed(1)}%</td>
                  <td className="py-1.5 px-2 border-b border-gray-200 text-center font-bold" style={{ color: GC[mg.grade] ?? "#000" }}>{mg.grade}</td>
                  <td className="py-1.5 px-2 border-b border-gray-200 text-gray-600">{m.comment ?? mg.label}</td>
                </tr>
              );
            })}
        </tbody>
      </table>

      {/* Summary */}
      <div className="border-2 border-gray-300 rounded p-3 grid grid-cols-4 gap-4 text-center mb-5">
        <div><p className="text-xs text-gray-500 uppercase">Total</p><p className="text-2xl font-bold">{total}<span className="text-sm text-gray-400">/{maxTotal}</span></p></div>
        <div><p className="text-xs text-gray-500 uppercase">Average</p><p className="text-2xl font-bold">{avgPct.toFixed(1)}%</p></div>
        <div><p className="text-xs text-gray-500 uppercase">Overall grade</p><p className="text-3xl font-bold" style={{ color: GC[g.grade] }}>{g.grade}</p><p className="text-xs text-gray-500">{g.label}</p></div>
        <div><p className="text-xs text-gray-500 uppercase">Position</p><p className="text-2xl font-bold">{position != null ? `${position}` : "—"}</p>{classSize > 0 && <p className="text-xs text-gray-400">out of {classSize}</p>}</div>
      </div>

      {/* Attendance */}
      {attendance.length > 0 && (
        <div className="border border-gray-300 rounded p-3 grid grid-cols-4 gap-3 text-center mb-5">
          <div><p className="text-xs text-gray-500">Present</p><p className="font-bold text-green-700">{present}</p></div>
          <div><p className="text-xs text-gray-500">Absent</p><p className="font-bold text-red-600">{absent}</p></div>
          <div><p className="text-xs text-gray-500">Late</p><p className="font-bold text-orange-500">{late}</p></div>
          <div><p className="text-xs text-gray-500">Attendance rate</p><p className="font-bold">{attPct != null ? `${attPct}%` : "—"}</p></div>
        </div>
      )}

      {/* Remarks */}
      <div className="border border-gray-300 rounded p-3 mb-6 min-h-[56px]">
        <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Class teacher's remarks</p>
        <p className="text-sm">{remarks || " "}</p>
      </div>

      {/* Signatures */}
      <div className="grid grid-cols-2 gap-16 mt-8">
        {[["Class Teacher", ""], ["Head Teacher / Principal", ""]].map(([title]) => (
          <div key={title}>
            <div className="mt-10 border-t border-black pt-2">
              <p className="text-xs">{title}</p>
              <p className="text-xs text-gray-400 mt-1">Name: _________________________ Sign: _____________</p>
              <p className="text-xs text-gray-400 mt-1">Date: _________________________</p>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 pt-4 border-t border-gray-200 flex justify-between text-xs text-gray-400">
        <p>Next term begins: _________________________</p>
        <p>Generated {new Date().toLocaleString()}</p>
      </div>
    </div>
  );
}

// ─── Tab 2: Class Analysis ────────────────────────────────────────────────────
function ClassAnalysisTab() {
  const [classId, setClassId] = useState("");
  const [termId, setTermId] = useState("");
  const [examId, setExamId] = useState("");
  const [printOpen, setPrintOpen] = useState(false);

  const { data: school } = useSchool();
  const { data: classes = [] } = useQuery({ queryKey: ["classes-ca"], queryFn: () => api.classes.list() });
  const { data: terms = [] } = useQuery({ queryKey: ["terms-all"], queryFn: () => api.academicYears.terms.all() });
  const { data: exams = [] } = useQuery({ queryKey: ["exams-ca", termId], queryFn: () => api.exams.list(termId || undefined) });
  const { data: allMarks = [] } = useQuery({ queryKey: ["ca-marks", examId], enabled: !!examId, queryFn: () => api.exams.marks.list(examId) });

  const exam = exams.find(e => e.id === examId);
  const cls = classes.find(c => c.id === classId);
  const outOf = exam?.outOf ?? 100;

  const classMarks = useMemo(() => classId ? allMarks.filter(m => m.pupil.schoolClass?.id === classId) : allMarks, [allMarks, classId]);
  const ranked = useMemo(() => buildRanked(classMarks, outOf), [classMarks, outOf]);
  const subStats = useMemo(() => buildSubjectStats(classMarks, outOf), [classMarks, outOf]);
  const averages = ranked.map(r => r.average);
  const gradeData = gradeDist(averages);
  const classAvg = averages.length ? averages.reduce((s, x) => s + x, 0) / averages.length : 0;
  const passRate = averages.length ? (averages.filter(a => a >= 50).length / averages.length) * 100 : 0;

  function exportCsv() {
    const rows = [["Position", "Name", "Admission", ...subStats.map(s => s.name), "Total", "Average %", "Grade"]];
    ranked.forEach(r => {
      const subScores = subStats.map(s => {
        const mk = r.marks.find(m => m.subject?.name === s.name);
        return mk ? String(mk.score) : "—";
      });
      rows.push([String(r.position), r.pupil.fullName, r.pupil.admissionNo, ...subScores, `${r.total}/${r.maxTotal}`, r.average.toFixed(1) + "%", gradeFor(r.average).grade]);
    });
    toCsv(rows, `class-analysis-${cls?.name ?? classId}-${exam?.name ?? examId}.csv`);
  }

  const hasData = ranked.length > 0;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-3 items-end">
        <div><Label className="text-xs text-muted-foreground">Term</Label>
          <Select value={termId} onValueChange={v => { setTermId(v); setExamId(""); }}>
            <SelectTrigger className="w-44"><SelectValue placeholder="All terms" /></SelectTrigger>
            <SelectContent><SelectItem value="">All terms</SelectItem>{terms.map(t => <SelectItem key={t.id} value={t.id}>{t.name}{t.academicYear ? ` — ${t.academicYear.name}` : ""}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div><Label className="text-xs text-muted-foreground">Exam</Label>
          <Select value={examId} onValueChange={setExamId}>
            <SelectTrigger className="w-52"><SelectValue placeholder="Select exam" /></SelectTrigger>
            <SelectContent>{exams.map(e => <SelectItem key={e.id} value={e.id}>{e.name}{e.assessmentType ? ` (${e.assessmentType.replace("_", " ")})` : ""}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div><Label className="text-xs text-muted-foreground">Class</Label>
          <Select value={classId} onValueChange={setClassId}>
            <SelectTrigger className="w-44"><SelectValue placeholder="All classes" /></SelectTrigger>
            <SelectContent><SelectItem value="">All classes</SelectItem>{classes.map(c => <SelectItem key={c.id} value={c.id}>{c.name}{c.stream ? " " + c.stream : ""}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        {hasData && (
          <>
            <Button variant="outline" onClick={exportCsv}><Download className="h-4 w-4 mr-1" />CSV</Button>
            <Button variant="outline" onClick={() => setPrintOpen(true)}><Printer className="h-4 w-4 mr-1" />Print analysis</Button>
          </>
        )}
      </div>

      {!examId && <div className="text-center text-muted-foreground py-16">Select an exam to see class analysis.</div>}

      {hasData && (
        <>
          {/* Summary stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Pupils examined", value: ranked.length },
              { label: "Class average", value: `${classAvg.toFixed(1)}%` },
              { label: "Pass rate (≥50%)", value: `${passRate.toFixed(1)}%` },
              { label: "Top score", value: `${ranked[0]?.average.toFixed(1) ?? "—"}%` },
            ].map(s => (
              <Card key={s.label}><CardContent className="p-4 text-center">
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className="text-2xl font-bold mt-1">{s.value}</p>
              </CardContent></Card>
            ))}
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            {/* Grade distribution chart */}
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Grade distribution</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={gradeData} margin={{ top: 0, right: 10, bottom: 0, left: -10 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="grade" tick={{ fontSize: 12 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v: any) => [`${v} pupils`, "Count"]} />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                      {gradeData.map((d, i) => <Cell key={i} fill={GC[d.grade] ?? "#94a3b8"} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                <div className="flex gap-3 flex-wrap mt-2">
                  {gradeData.map(d => (
                    <div key={d.grade} className="flex items-center gap-1.5 text-xs">
                      <div className="h-3 w-3 rounded-sm" style={{ background: GC[d.grade] }} />
                      <span>{d.grade}: <strong>{d.count}</strong> ({averages.length ? ((d.count / averages.length) * 100).toFixed(0) : 0}%)</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Subject performance chart */}
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Subject averages</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={subStats.map(s => ({ name: s.name.length > 10 ? s.name.slice(0, 10) + "…" : s.name, avg: parseFloat(s.avg.toFixed(1)), fullName: s.name }))} layout="vertical" margin={{ top: 0, right: 30, bottom: 0, left: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} tickFormatter={v => `${v}%`} />
                    <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={80} />
                    <Tooltip formatter={(v: any) => [`${v}%`, "Average"]} labelFormatter={(l, p) => p[0]?.payload?.fullName ?? l} />
                    <Bar dataKey="avg" radius={[0, 4, 4, 0]}>
                      {subStats.map((s, i) => <Cell key={i} fill={s.avg >= 75 ? GC.A : s.avg >= 60 ? GC.B : s.avg >= 50 ? GC.C : s.avg >= 40 ? GC.D : GC.E} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Ranked pupil table */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-2"><Trophy className="h-4 w-4" />Pupil ranking</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead className="w-12">#</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Adm</TableHead>
                    {subStats.map(s => <TableHead key={s.name} className="text-right text-xs">{s.name}</TableHead>)}
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Avg %</TableHead>
                    <TableHead>Grade</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ranked.map(r => {
                    const g = gradeFor(r.average);
                    return (
                      <TableRow key={r.pupil.id} className={r.position <= 3 ? "bg-yellow-50/40 dark:bg-yellow-950/10" : undefined}>
                        <TableCell className="font-bold text-center">{r.position <= 3 ? ["🥇","🥈","🥉"][r.position-1] : r.position}</TableCell>
                        <TableCell className="font-medium">{r.pupil.fullName}</TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">{r.pupil.admissionNo}</TableCell>
                        {subStats.map(s => {
                          const mk = r.marks.find(m => m.subject?.name === s.name);
                          const pct = mk ? (Number(mk.score) / outOf) * 100 : null;
                          return <TableCell key={s.name} className="text-right text-xs">{mk ? <span style={{ color: GC[gradeFor(pct!).grade] }}>{mk.score}</span> : <span className="text-muted-foreground">—</span>}</TableCell>;
                        })}
                        <TableCell className="text-right font-mono text-xs">{r.total}/{r.maxTotal}</TableCell>
                        <TableCell className="text-right font-semibold">{r.average.toFixed(1)}%</TableCell>
                        <TableCell><span className="font-bold" style={{ color: GC[g.grade] }}>{g.grade}</span></TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Subject detail table */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Subject performance detail</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader><TableRow className="bg-muted/40"><TableHead>Subject</TableHead><TableHead className="text-right">Pupils</TableHead><TableHead className="text-right">Average</TableHead><TableHead className="text-right">Highest</TableHead><TableHead className="text-right">Lowest</TableHead><TableHead className="text-right">Pass rate</TableHead></TableRow></TableHeader>
                <TableBody>
                  {subStats.map(s => (
                    <TableRow key={s.name}>
                      <TableCell className="font-medium">{s.name}</TableCell>
                      <TableCell className="text-right">{s.count}</TableCell>
                      <TableCell className="text-right font-semibold" style={{ color: GC[gradeFor(s.avg).grade] }}>{s.avg.toFixed(1)}%</TableCell>
                      <TableCell className="text-right text-green-600">{s.highest.toFixed(1)}%</TableCell>
                      <TableCell className="text-right text-red-500">{s.lowest.toFixed(1)}%</TableCell>
                      <TableCell className="text-right"><Badge variant={s.passRate >= 80 ? "default" : s.passRate >= 60 ? "secondary" : "destructive"}>{s.passRate.toFixed(0)}%</Badge></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}

      {printOpen && hasData && (
        <PrintOverlay onClose={() => setPrintOpen(false)}>
          <ClassAnalysisPrint school={school} cls={cls} exam={exam} ranked={ranked} subStats={subStats} gradeData={gradeData} classAvg={classAvg} passRate={passRate} outOf={outOf} />
        </PrintOverlay>
      )}
    </div>
  );
}

function ClassAnalysisPrint({ school, cls, exam, ranked, subStats, gradeData, classAvg, passRate, outOf }: any) {
  return (
    <div className="p-10 font-sans text-black text-sm">
      <DocHeader school={{ ...school, logoUrl: school?.logoUrl ?? "/logo.png" }} title="Class Performance Analysis" />
      <div className="flex justify-between text-xs text-gray-600 mb-6">
        <span>Class: <strong>{cls ? `${cls.name}${cls.stream ? " " + cls.stream : ""}` : "All classes"}</strong></span>
        <span>Assessment: <strong>{exam?.name}</strong></span>
        <span>Generated: {new Date().toLocaleDateString()}</span>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[{ l: "Pupils", v: ranked.length }, { l: "Class average", v: `${classAvg.toFixed(1)}%` }, { l: "Pass rate", v: `${passRate.toFixed(1)}%` }, { l: "Top score", v: `${ranked[0]?.average.toFixed(1) ?? "—"}%` }].map(s => (
          <div key={s.l} className="border rounded p-3 text-center">
            <p className="text-xs text-gray-500">{s.l}</p>
            <p className="text-2xl font-bold">{s.v}</p>
          </div>
        ))}
      </div>

      {/* Grade distribution */}
      <div className="mb-6">
        <p className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">Grade Distribution</p>
        <div className="flex gap-4">
          {gradeData.map((d: any) => (
            <div key={d.grade} className="text-center">
              <div className="h-16 w-12 flex items-end border-b-2 border-gray-300 mx-auto">
                <div className="w-full" style={{ height: `${ranked.length ? (d.count / ranked.length) * 100 : 0}%`, background: GC[d.grade], minHeight: d.count > 0 ? 4 : 0 }} />
              </div>
              <p className="text-xs font-bold mt-1" style={{ color: GC[d.grade] }}>{d.grade}</p>
              <p className="text-xs text-gray-600">{d.count}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Subject table */}
      <p className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">Subject Performance</p>
      <table className="w-full border-collapse mb-6 text-sm">
        <thead><tr className="bg-gray-100 border-b-2 border-black">
          <th className="text-left py-1.5 px-2">Subject</th>
          <th className="text-center py-1.5 px-2">Pupils</th>
          <th className="text-center py-1.5 px-2">Average</th>
          <th className="text-center py-1.5 px-2">Highest</th>
          <th className="text-center py-1.5 px-2">Lowest</th>
          <th className="text-center py-1.5 px-2">Pass rate</th>
        </tr></thead>
        <tbody>
          {subStats.map((s: any) => (
            <tr key={s.name} className="border-b border-gray-200">
              <td className="py-1.5 px-2 font-medium">{s.name}</td>
              <td className="py-1.5 px-2 text-center">{s.count}</td>
              <td className="py-1.5 px-2 text-center font-bold" style={{ color: GC[gradeFor(s.avg).grade] }}>{s.avg.toFixed(1)}%</td>
              <td className="py-1.5 px-2 text-center text-green-700">{s.highest.toFixed(1)}%</td>
              <td className="py-1.5 px-2 text-center text-red-600">{s.lowest.toFixed(1)}%</td>
              <td className="py-1.5 px-2 text-center">{s.passRate.toFixed(0)}%</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Ranking */}
      <p className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">Pupil Ranking</p>
      <table className="w-full border-collapse text-sm">
        <thead><tr className="bg-gray-100 border-b-2 border-black">
          <th className="py-1.5 px-2 text-center">#</th>
          <th className="py-1.5 px-2 text-left">Name</th>
          <th className="py-1.5 px-2 text-left">Adm</th>
          <th className="py-1.5 px-2 text-right">Total</th>
          <th className="py-1.5 px-2 text-right">Average</th>
          <th className="py-1.5 px-2 text-center">Grade</th>
        </tr></thead>
        <tbody>
          {ranked.map((r: any) => {
            const g = gradeFor(r.average);
            return (
              <tr key={r.pupil.id} className={r.position % 2 === 0 ? "bg-gray-50" : "bg-white"}>
                <td className="py-1 px-2 text-center font-bold">{r.position}</td>
                <td className="py-1 px-2">{r.pupil.fullName}</td>
                <td className="py-1 px-2 font-mono text-xs text-gray-500">{r.pupil.admissionNo}</td>
                <td className="py-1 px-2 text-right">{r.total}/{r.maxTotal}</td>
                <td className="py-1 px-2 text-right font-semibold">{r.average.toFixed(1)}%</td>
                <td className="py-1 px-2 text-center font-bold" style={{ color: GC[g.grade] }}>{g.grade}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Tab 3: School Analysis ───────────────────────────────────────────────────
function SchoolAnalysisTab() {
  const [termId, setTermId] = useState("");
  const [examId, setExamId] = useState("");
  const [printOpen, setPrintOpen] = useState(false);

  const { data: school } = useSchool();
  const { data: terms = [] } = useQuery({ queryKey: ["terms-all"], queryFn: () => api.academicYears.terms.all() });
  const { data: exams = [] } = useQuery({ queryKey: ["exams-sa", termId], queryFn: () => api.exams.list(termId || undefined) });
  const { data: allMarks = [] } = useQuery({ queryKey: ["sa-marks", examId], enabled: !!examId, queryFn: () => api.exams.marks.list(examId) });

  const exam = exams.find(e => e.id === examId);
  const outOf = exam?.outOf ?? 100;

  const allRanked = useMemo(() => buildRanked(allMarks, outOf), [allMarks, outOf]);
  const subStats = useMemo(() => buildSubjectStats(allMarks, outOf), [allMarks, outOf]);
  const averages = allRanked.map(r => r.average);
  const gradeData = gradeDist(averages);
  const schoolAvg = averages.length ? averages.reduce((s, x) => s + x, 0) / averages.length : 0;
  const passRate = averages.length ? (averages.filter(a => a >= 50).length / averages.length) * 100 : 0;

  const byClass = useMemo(() => {
    const map = new Map<string, { label: string; marks: Mark[] }>();
    for (const m of allMarks) {
      const k = m.pupil.schoolClass?.id ?? "__none";
      const label = m.pupil.schoolClass ? `${m.pupil.schoolClass.name}${m.pupil.schoolClass.stream ? " " + m.pupil.schoolClass.stream : ""}` : "No class";
      if (!map.has(k)) map.set(k, { label, marks: [] });
      map.get(k)!.marks.push(m);
    }
    return [...map.values()];
  }, [allMarks]);

  const classStats = useMemo(() =>
    byClass.map(({ label, marks }) => {
      const r = buildRanked(marks, outOf);
      const avgs = r.map(x => x.average);
      const a = avgs.length ? avgs.reduce((s, x) => s + x, 0) / avgs.length : 0;
      return { label, pupils: r.length, avg: a, passRate: avgs.length ? (avgs.filter(x => x >= 50).length / avgs.length) * 100 : 0, top: r[0] };
    }).sort((a, b) => b.avg - a.avg).map((c, i) => ({ ...c, position: i + 1 })),
    [byClass, outOf]
  );

  function exportCsv() {
    const rows = [["Position", "Class", "Pupils", "Average %", "Pass rate", "Top performer"]];
    classStats.forEach(c => rows.push([String(c.position), c.label, String(c.pupils), c.avg.toFixed(1) + "%", c.passRate.toFixed(1) + "%", c.top?.pupil.fullName ?? "—"]));
    toCsv(rows, `school-analysis-${exam?.name ?? examId}.csv`);
  }

  const hasData = allRanked.length > 0;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-3 items-end">
        <div><Label className="text-xs text-muted-foreground">Term</Label>
          <Select value={termId} onValueChange={v => { setTermId(v); setExamId(""); }}>
            <SelectTrigger className="w-44"><SelectValue placeholder="All terms" /></SelectTrigger>
            <SelectContent><SelectItem value="">All terms</SelectItem>{terms.map(t => <SelectItem key={t.id} value={t.id}>{t.name}{t.academicYear ? ` — ${t.academicYear.name}` : ""}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div><Label className="text-xs text-muted-foreground">Exam</Label>
          <Select value={examId} onValueChange={setExamId}>
            <SelectTrigger className="w-52"><SelectValue placeholder="Select exam" /></SelectTrigger>
            <SelectContent>{exams.map(e => <SelectItem key={e.id} value={e.id}>{e.name}{e.assessmentType ? ` (${e.assessmentType.replace("_", " ")})` : ""}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        {hasData && (
          <>
            <Button variant="outline" onClick={exportCsv}><Download className="h-4 w-4 mr-1" />CSV</Button>
            <Button variant="outline" onClick={() => setPrintOpen(true)}><Printer className="h-4 w-4 mr-1" />Print analysis</Button>
          </>
        )}
      </div>

      {!examId && <div className="text-center text-muted-foreground py-16">Select an exam to see school-wide analysis.</div>}

      {hasData && (
        <>
          {/* School stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Total pupils examined", value: allRanked.length },
              { label: "School average", value: `${schoolAvg.toFixed(1)}%` },
              { label: "Pass rate (≥50%)", value: `${passRate.toFixed(1)}%` },
              { label: "Classes with data", value: classStats.length },
            ].map(s => (
              <Card key={s.label}><CardContent className="p-4 text-center">
                <p className="text-xs text-muted-foreground">{s.label}</p>
                <p className="text-2xl font-bold mt-1">{s.value}</p>
              </CardContent></Card>
            ))}
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            {/* Grade distribution */}
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">School-wide grade distribution</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={gradeData} margin={{ top: 0, right: 10, bottom: 0, left: -10 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="grade" tick={{ fontSize: 12 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                    <Tooltip formatter={(v: any) => [`${v} pupils`, "Count"]} />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                      {gradeData.map((d, i) => <Cell key={i} fill={GC[d.grade] ?? "#94a3b8"} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                <div className="flex gap-3 flex-wrap mt-2">
                  {gradeData.map(d => (
                    <div key={d.grade} className="flex items-center gap-1.5 text-xs">
                      <div className="h-3 w-3 rounded-sm" style={{ background: GC[d.grade] }} />
                      <span>{d.grade} ({d.label}): <strong>{d.count}</strong></span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Class comparison */}
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Class comparison</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={classStats.map(c => ({ name: c.label, avg: parseFloat(c.avg.toFixed(1)) }))} margin={{ top: 0, right: 10, bottom: 0, left: -10 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                    <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} tickFormatter={v => `${v}%`} />
                    <Tooltip formatter={(v: any) => [`${v}%`, "Average"]} />
                    <Bar dataKey="avg" radius={[4, 4, 0, 0]}>
                      {classStats.map((c, i) => <Cell key={i} fill={c.avg >= 75 ? GC.A : c.avg >= 60 ? GC.B : c.avg >= 50 ? GC.C : c.avg >= 40 ? GC.D : GC.E} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Class ranking table */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-2"><Trophy className="h-4 w-4" />Class rankings</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader><TableRow className="bg-muted/40">
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Class</TableHead>
                  <TableHead className="text-right">Pupils</TableHead>
                  <TableHead className="text-right">Average</TableHead>
                  <TableHead className="text-right">Pass rate</TableHead>
                  <TableHead>Grade</TableHead>
                  <TableHead>Top performer</TableHead>
                </TableRow></TableHeader>
                <TableBody>
                  {classStats.map(c => (
                    <TableRow key={c.label} className={c.position <= 3 ? "bg-yellow-50/40 dark:bg-yellow-950/10" : undefined}>
                      <TableCell className="font-bold text-center">{c.position <= 3 ? ["🥇","🥈","🥉"][c.position-1] : c.position}</TableCell>
                      <TableCell className="font-medium">{c.label}</TableCell>
                      <TableCell className="text-right">{c.pupils}</TableCell>
                      <TableCell className="text-right font-semibold" style={{ color: GC[gradeFor(c.avg).grade] }}>{c.avg.toFixed(1)}%</TableCell>
                      <TableCell className="text-right"><Badge variant={c.passRate >= 80 ? "default" : c.passRate >= 60 ? "secondary" : "destructive"}>{c.passRate.toFixed(0)}%</Badge></TableCell>
                      <TableCell><span className="font-bold" style={{ color: GC[gradeFor(c.avg).grade] }}>{gradeFor(c.avg).grade}</span></TableCell>
                      <TableCell className="text-sm">{c.top?.pupil.fullName ?? "—"} {c.top ? <span className="text-muted-foreground text-xs">({c.top.average.toFixed(1)}%)</span> : null}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Subject performance school-wide */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Subject performance — school-wide</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader><TableRow className="bg-muted/40"><TableHead>Subject</TableHead><TableHead className="text-right">Pupils</TableHead><TableHead className="text-right">Average</TableHead><TableHead className="text-right">Highest</TableHead><TableHead className="text-right">Lowest</TableHead><TableHead className="text-right">Pass rate</TableHead><TableHead>Grade</TableHead></TableRow></TableHeader>
                <TableBody>
                  {subStats.map(s => (
                    <TableRow key={s.name}>
                      <TableCell className="font-medium">{s.name}</TableCell>
                      <TableCell className="text-right">{s.count}</TableCell>
                      <TableCell className="text-right font-semibold" style={{ color: GC[gradeFor(s.avg).grade] }}>{s.avg.toFixed(1)}%</TableCell>
                      <TableCell className="text-right text-green-600">{s.highest.toFixed(1)}%</TableCell>
                      <TableCell className="text-right text-red-500">{s.lowest.toFixed(1)}%</TableCell>
                      <TableCell className="text-right"><Badge variant={s.passRate >= 80 ? "default" : s.passRate >= 60 ? "secondary" : "destructive"}>{s.passRate.toFixed(0)}%</Badge></TableCell>
                      <TableCell><span className="font-bold" style={{ color: GC[gradeFor(s.avg).grade] }}>{gradeFor(s.avg).grade}</span></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Top 10 school-wide */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-2"><Trophy className="h-4 w-4 text-yellow-500" />Top 10 performers — school-wide</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader><TableRow className="bg-muted/40"><TableHead className="w-12">#</TableHead><TableHead>Name</TableHead><TableHead>Adm</TableHead><TableHead>Class</TableHead><TableHead className="text-right">Total</TableHead><TableHead className="text-right">Average</TableHead><TableHead>Grade</TableHead></TableRow></TableHeader>
                <TableBody>
                  {allRanked.slice(0, 10).map(r => {
                    const g = gradeFor(r.average);
                    return (
                      <TableRow key={r.pupil.id} className={r.position <= 3 ? "bg-yellow-50/40 dark:bg-yellow-950/10" : undefined}>
                        <TableCell className="font-bold text-center">{r.position <= 3 ? ["🥇","🥈","🥉"][r.position-1] : r.position}</TableCell>
                        <TableCell className="font-medium">{r.pupil.fullName}</TableCell>
                        <TableCell className="font-mono text-xs text-muted-foreground">{r.pupil.admissionNo}</TableCell>
                        <TableCell className="text-sm">{r.pupil.schoolClass?.name ?? "—"}{r.pupil.schoolClass?.stream ? " " + r.pupil.schoolClass.stream : ""}</TableCell>
                        <TableCell className="text-right font-mono text-xs">{r.total}/{r.maxTotal}</TableCell>
                        <TableCell className="text-right font-semibold">{r.average.toFixed(1)}%</TableCell>
                        <TableCell><span className="font-bold" style={{ color: GC[g.grade] }}>{g.grade}</span></TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}

      {printOpen && hasData && (
        <PrintOverlay onClose={() => setPrintOpen(false)}>
          <div className="p-10 font-sans text-black text-sm">
            <DocHeader school={{ ...school, logoUrl: school?.logoUrl ?? "/logo.png" }} title="School Performance Analysis" />
            <p className="text-xs text-gray-600 mb-6">Assessment: <strong>{exam?.name}</strong> · Generated: {new Date().toLocaleDateString()}</p>
            <div className="grid grid-cols-4 gap-4 mb-6">
              {[{ l: "Total pupils", v: allRanked.length }, { l: "School average", v: `${schoolAvg.toFixed(1)}%` }, { l: "Pass rate", v: `${passRate.toFixed(1)}%` }, { l: "Classes", v: classStats.length }].map(s => (
                <div key={s.l} className="border rounded p-3 text-center"><p className="text-xs text-gray-500">{s.l}</p><p className="text-2xl font-bold">{s.v}</p></div>
              ))}
            </div>
            <p className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">Class Rankings</p>
            <table className="w-full border-collapse mb-6 text-sm">
              <thead><tr className="bg-gray-100 border-b-2 border-black">
                <th className="py-1.5 px-2 text-center">#</th><th className="py-1.5 px-2 text-left">Class</th>
                <th className="py-1.5 px-2 text-right">Pupils</th><th className="py-1.5 px-2 text-right">Average</th>
                <th className="py-1.5 px-2 text-right">Pass rate</th><th className="py-1.5 px-2 text-center">Grade</th>
                <th className="py-1.5 px-2 text-left">Top performer</th>
              </tr></thead>
              <tbody>
                {classStats.map((c: any) => (
                  <tr key={c.label} className={c.position % 2 === 0 ? "bg-gray-50" : "bg-white"}>
                    <td className="py-1 px-2 text-center font-bold">{c.position}</td>
                    <td className="py-1 px-2 font-medium">{c.label}</td>
                    <td className="py-1 px-2 text-right">{c.pupils}</td>
                    <td className="py-1 px-2 text-right font-bold" style={{ color: GC[gradeFor(c.avg).grade] }}>{c.avg.toFixed(1)}%</td>
                    <td className="py-1 px-2 text-right">{c.passRate.toFixed(0)}%</td>
                    <td className="py-1 px-2 text-center font-bold" style={{ color: GC[gradeFor(c.avg).grade] }}>{gradeFor(c.avg).grade}</td>
                    <td className="py-1 px-2 text-xs">{c.top?.pupil.fullName ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">Subject Performance</p>
            <table className="w-full border-collapse text-sm">
              <thead><tr className="bg-gray-100 border-b-2 border-black">
                <th className="py-1.5 px-2 text-left">Subject</th><th className="py-1.5 px-2 text-right">Pupils</th>
                <th className="py-1.5 px-2 text-right">Average</th><th className="py-1.5 px-2 text-right">Pass rate</th>
                <th className="py-1.5 px-2 text-center">Grade</th>
              </tr></thead>
              <tbody>
                {subStats.map((s: any) => (
                  <tr key={s.name} className="border-b border-gray-200">
                    <td className="py-1 px-2 font-medium">{s.name}</td>
                    <td className="py-1 px-2 text-right">{s.count}</td>
                    <td className="py-1 px-2 text-right font-bold" style={{ color: GC[gradeFor(s.avg).grade] }}>{s.avg.toFixed(1)}%</td>
                    <td className="py-1 px-2 text-right">{s.passRate.toFixed(0)}%</td>
                    <td className="py-1 px-2 text-center font-bold" style={{ color: GC[gradeFor(s.avg).grade] }}>{gradeFor(s.avg).grade}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </PrintOverlay>
      )}
    </div>
  );
}
