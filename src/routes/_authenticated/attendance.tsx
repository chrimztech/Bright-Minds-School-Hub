import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { useAuth, hasAny, ADMIN_ROLES } from "@/lib/auth";
import { PrintOverlay, DocHeader, useSchool } from "@/components/PrintableDoc";
import { ClipboardList, Printer } from "lucide-react";

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
const STATUS_LETTER: Record<string, string> = { PRESENT: "P", ABSENT: "A", LATE: "L", SICK: "S", EXCUSED: "E" };
const STATUS_CELL_CLASS: Record<string, string> = {
  PRESENT: "bg-green-100 text-green-800 dark:bg-green-950/40 dark:text-green-400",
  ABSENT: "bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-400",
  LATE: "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400",
  SICK: "bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-400",
  EXCUSED: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
};

function useClassOptions() {
  const { roles } = useAuth();
  const isAdmin = hasAny(roles, ADMIN_ROLES);
  const isTeacher = roles.includes("TEACHER") && !isAdmin;
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
  return { classes, isTeacher, isAdmin };
}

function Attendance() {
  return (
    <>
      <PageHeader title="Attendance" description="Mark daily attendance or review the attendance register." />
      <div className="p-6">
        <Tabs defaultValue="daily">
          <TabsList className="mb-5">
            <TabsTrigger value="daily">Daily entry</TabsTrigger>
            <TabsTrigger value="register"><ClipboardList className="h-3.5 w-3.5 mr-1.5" />Register</TabsTrigger>
          </TabsList>
          <TabsContent value="daily"><DailyAttendanceTab /></TabsContent>
          <TabsContent value="register"><AttendanceRegisterTab /></TabsContent>
        </Tabs>
      </div>
    </>
  );
}

function DailyAttendanceTab() {
  const { classes, isTeacher } = useClassOptions();
  const qc = useQueryClient();
  const [date, setDate] = useState(todayLocalISO());
  const [classId, setClassId] = useState<string>("");

  useEffect(() => {
    if (isTeacher && classes.length > 0 && !classId) {
      setClassId(classes[0].id);
    }
  }, [isTeacher, classes, classId]);

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
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-end">
        {isTeacher && classes.length <= 1 ? (
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

      {isTeacher && classes.length === 0 && (
        <div className="rounded-lg border bg-muted/40 p-8 text-center text-sm text-muted-foreground">
          No class has been assigned to you yet. Ask an administrator to assign you as a class teacher.
        </div>
      )}
    </div>
  );
}

// Today's local calendar date as "YYYY-MM-DD" — deliberately NOT `new Date().toISOString()`,
// which reads UTC. For any timezone ahead of UTC (e.g. Zambia, UTC+2) that silently returns
// yesterday's date for the first couple of hours after local midnight.
function todayLocalISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function currentMonthLocalISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// Pure calendar-date arithmetic anchored to UTC internally so it never round-trips through the
// browser's local timezone — `new Date(y, m, 0).toISOString()` shifted every date here back by
// a full day (and sometimes into the wrong month) for any user ahead of UTC, which is exactly
// why the register looked completely empty for a Zambia-based school (UTC+2): the day labels
// being looked up never matched the actual saved dates.
function monthBounds(monthStr: string) {
  const [y, m] = monthStr.split("-").map(Number);
  const from = `${monthStr}-01`;
  const lastDay = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const to = `${monthStr}-${String(lastDay).padStart(2, "0")}`;
  return { from, to };
}

function daysInRange(from: string, to: string) {
  const days: string[] = [];
  const [fy, fm, fd] = from.split("-").map(Number);
  const [ty, tm, td] = to.split("-").map(Number);
  let cursor = Date.UTC(fy, fm - 1, fd);
  const end = Date.UTC(ty, tm - 1, td);
  while (cursor <= end) {
    const dt = new Date(cursor);
    days.push(
      `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, "0")}-${String(dt.getUTCDate()).padStart(2, "0")}`,
    );
    cursor += 86400000;
  }
  return days;
}

function AttendanceRegisterTab() {
  const { classes, isTeacher } = useClassOptions();
  const { data: school } = useSchool();
  const [classId, setClassId] = useState<string>("");
  const [month, setMonth] = useState(currentMonthLocalISO());
  const [printOpen, setPrintOpen] = useState(false);

  useEffect(() => {
    if (isTeacher && classes.length > 0 && !classId) setClassId(classes[0].id);
  }, [isTeacher, classes, classId]);

  const { from, to } = monthBounds(month);
  const days = useMemo(() => daysInRange(from, to), [from, to]);

  const { data: pupils = [] } = useQuery({
    queryKey: ["pupils-att", classId],
    enabled: !!classId,
    queryFn: () => api.pupils.byClass(classId),
  });

  const { data: records = [] } = useQuery({
    queryKey: ["att-range", classId, from, to],
    enabled: !!classId,
    queryFn: () => api.attendance.range(classId, from, to),
  });

  const byPupilDate = useMemo(() => {
    const m = new Map<string, Map<string, string>>();
    for (const r of records) {
      if (!m.has(r.pupil.id)) m.set(r.pupil.id, new Map());
      m.get(r.pupil.id)!.set(r.date, r.status);
    }
    return m;
  }, [records]);

  const rows = useMemo(() => pupils.map((p) => {
    const dateMap = byPupilDate.get(p.id) ?? new Map<string, string>();
    const counts = STATUSES.reduce((acc, s) => {
      acc[s] = days.filter((d) => dateMap.get(d) === s).length;
      return acc;
    }, {} as Record<string, number>);
    const marked = days.filter((d) => dateMap.has(d)).length;
    const pct = marked > 0 ? Math.round((counts.PRESENT / marked) * 100) : 0;
    return { pupil: p, dateMap, counts, marked, pct };
  }), [pupils, byPupilDate, days]);

  const selectedClass = classes.find((c) => c.id === classId);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-end">
        {isTeacher && classes.length <= 1 ? (
          <div>
            <label className="text-sm text-muted-foreground">Your class</label>
            <div className="h-9 flex items-center px-3 rounded-md border bg-muted text-sm font-medium">
              {selectedClass ? `${selectedClass.name}${selectedClass.stream ? " " + selectedClass.stream : ""}` : "No class assigned"}
            </div>
          </div>
        ) : (
          <div>
            <label className="text-sm">Class</label>
            <Select value={classId} onValueChange={setClassId}>
              <SelectTrigger className="w-56"><SelectValue placeholder="Select class" /></SelectTrigger>
              <SelectContent>{classes.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}{c.stream ? " " + c.stream : ""}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        )}
        <div>
          <label className="text-sm">Month</label>
          <Input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
        </div>
        <Button variant="outline" onClick={() => setPrintOpen(true)} disabled={!classId || pupils.length === 0}>
          <Printer className="h-4 w-4 mr-1.5" />Print register
        </Button>
      </div>

      {classId && (
        <div className="rounded-lg border bg-card overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="sticky left-0 bg-card w-12">#</TableHead>
                <TableHead className="sticky left-12 bg-card min-w-[160px]">Pupil</TableHead>
                {days.map((d) => (
                  <TableHead key={d} className="text-center w-8 px-1 text-xs">{d.slice(8, 10)}</TableHead>
                ))}
                <TableHead className="text-center px-2">Present %</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0
                ? <TableRow><TableCell colSpan={days.length + 3} className="text-center text-muted-foreground py-8">No pupils in this class.</TableCell></TableRow>
                : rows.map((r, idx) => (
                  <TableRow key={r.pupil.id}>
                    <TableCell className="sticky left-0 bg-card text-muted-foreground text-xs">{idx + 1}</TableCell>
                    <TableCell className="sticky left-12 bg-card font-medium text-sm">{r.pupil.fullName}</TableCell>
                    {days.map((d) => {
                      const s = r.dateMap.get(d);
                      return (
                        <TableCell key={d} className="text-center p-1">
                          {s ? (
                            <span className={`inline-flex items-center justify-center h-6 w-6 rounded text-[10px] font-semibold ${STATUS_CELL_CLASS[s]}`}>
                              {STATUS_LETTER[s]}
                            </span>
                          ) : (
                            <span className="text-muted-foreground text-xs">–</span>
                          )}
                        </TableCell>
                      );
                    })}
                    <TableCell className="text-center text-sm font-medium">{r.marked > 0 ? `${r.pct}%` : "—"}</TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </div>
      )}

      {isTeacher && classes.length === 0 && (
        <div className="rounded-lg border bg-muted/40 p-8 text-center text-sm text-muted-foreground">
          No class has been assigned to you yet. Ask an administrator to assign you as a class teacher.
        </div>
      )}

      {printOpen && (
        <PrintOverlay onClose={() => setPrintOpen(false)}>
          <AttendanceRegisterPrint school={school} schoolClass={selectedClass} month={month} days={days} rows={rows} />
        </PrintOverlay>
      )}
    </div>
  );
}

function AttendanceRegisterPrint({ school, schoolClass, month, days, rows }: any) {
  const monthLabel = new Date(month + "-01T00:00:00").toLocaleDateString("en-GB", { month: "long", year: "numeric" });
  return (
    <div className="p-8 bg-white text-black" style={{ minWidth: 900 }}>
      <DocHeader school={{ ...school, logoUrl: school?.logoUrl ?? "/logo.png" }} title="Attendance Register" />
      <p className="text-sm mb-4">
        Class: <span className="font-medium">{schoolClass ? `${schoolClass.name}${schoolClass.stream ? " " + schoolClass.stream : ""}` : "—"}</span>
        {"   "}Month: <span className="font-medium">{monthLabel}</span>
      </p>
      <table className="w-full border-collapse text-[10px]">
        <thead>
          <tr>
            <th className="border border-gray-300 p-1 w-6">#</th>
            <th className="border border-gray-300 p-1 text-left min-w-[130px]">Pupil</th>
            {days.map((d: string) => (
              <th key={d} className="border border-gray-300 p-1 w-5">{d.slice(8, 10)}</th>
            ))}
            <th className="border border-gray-300 p-1 w-10">%</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r: any, idx: number) => (
            <tr key={r.pupil.id}>
              <td className="border border-gray-300 p-1 text-center">{idx + 1}</td>
              <td className="border border-gray-300 p-1">{r.pupil.fullName}</td>
              {days.map((d: string) => (
                <td key={d} className="border border-gray-300 p-1 text-center">{STATUS_LETTER[r.dateMap.get(d)] ?? ""}</td>
              ))}
              <td className="border border-gray-300 p-1 text-center">{r.marked > 0 ? `${r.pct}%` : ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="text-[10px] text-gray-500 mt-3">P = Present, A = Absent, L = Late, S = Sick, E = Excused</p>
      <div className="grid grid-cols-2 gap-16 mt-10">
        <div className="border-t border-black pt-2"><p className="text-xs">Class Teacher signature</p></div>
        <div className="border-t border-black pt-2"><p className="text-xs">Head Teacher signature</p></div>
      </div>
    </div>
  );
}
