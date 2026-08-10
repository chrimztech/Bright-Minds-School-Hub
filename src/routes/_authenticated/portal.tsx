import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { api, type ParentReportCard } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { money } from "@/lib/format";
import { EmptyState } from "@/components/EmptyState";
import { Megaphone, Wallet, ClipboardCheck, GraduationCap, TrendingUp, UserRound, FileText } from "lucide-react";

export const Route = createFileRoute("/_authenticated/portal")({
  head: () => ({ meta: [{ title: "Parent portal" }] }),
  component: ParentPortal,
});

function ParentPortal() {
  const { user } = useAuth();

  const { data: guardian, isLoading: guardianLoading } = useQuery({
    queryKey: ["my-guardian"],
    enabled: !!user,
    queryFn: () => api.guardians.me(),
  });

  const { data: pupils = [] } = useQuery({
    queryKey: ["my-children"],
    enabled: !!guardian,
    queryFn: () => api.guardians.myPupils(),
  });

  const { data: portalDashboard } = useQuery({
    queryKey: ["parent-dashboard"],
    enabled: !!guardian,
    queryFn: () => api.guardians.dashboard(),
  });

  const { data: invoices = [] } = useQuery({
    queryKey: ["my-invoices"],
    enabled: !!guardian,
    queryFn: () => api.guardians.myInvoices(),
  });

  const to = new Date().toISOString().slice(0, 10);
  const from = new Date(Date.now() - 90 * 864e5).toISOString().slice(0, 10);

  const { data: attendance = [] } = useQuery({
    queryKey: ["my-attendance"],
    enabled: !!guardian,
    queryFn: () => api.guardians.myAttendance(from, to),
  });

  const { data: announcements = [] } = useQuery({
    queryKey: ["my-ann"],
    queryFn: () => api.announcements.list(),
  });

  const balance = invoices.reduce((s, i) => s + (Number(i.total) - Number(i.paid)), 0);
  const presentDays = attendance.filter((a) => a.status === "PRESENT").length;
  const attendancePct = attendance.length ? Math.round((presentDays / attendance.length) * 100) : null;

  if (guardianLoading) {
    return <><PageHeader title="Parent portal" /><div className="p-6"><p className="text-muted-foreground">Loading…</p></div></>;
  }

  if (!guardian) {
    return (
      <>
        <PageHeader title="Parent portal" />
        <div className="p-6">
          <Card><CardContent className="p-10 text-center space-y-2">
            <p className="font-display text-2xl">Welcome</p>
            <p className="text-muted-foreground">We're linking your account to your child's records using <span className="font-mono text-foreground">{user?.email}</span>. Ask the school office to add this email to your guardian profile, then refresh.</p>
          </CardContent></Card>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader title={`Welcome, ${guardian.fullName}`} description="Your children's school activity at a glance" />
      <div className="p-6 space-y-6">
        {/* Stats */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard icon={GraduationCap} label="My children" value={pupils.length} />
          <StatCard icon={Wallet} label="Outstanding fees" value={money(balance)} accent={balance > 0} />
          <StatCard icon={ClipboardCheck} label="Attendance (90d)" value={attendancePct != null ? `${attendancePct}%` : "—"} />
          <StatCard icon={Megaphone} label="Notices" value={announcements.length} />
        </div>

        <Tabs defaultValue="children">
          <TabsList>
            <TabsTrigger value="children">Children</TabsTrigger>
            <TabsTrigger value="attendance">Attendance</TabsTrigger>
            <TabsTrigger value="fees">Fees</TabsTrigger>
            <TabsTrigger value="performance">Performance</TabsTrigger>
            <TabsTrigger value="notices">Notices</TabsTrigger>
          </TabsList>

          {/* ── Children ── */}
          <TabsContent value="children">
            <Card className="mt-3">
              <CardContent className="pt-5">
                {pupils.length === 0 ? <EmptyState message="No pupils linked to your account." /> : (
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {pupils.map((p) => {
                      const details = portalDashboard?.children.find((child) => child.id === p.id);
                      const classInfo = details?.schoolClass;
                      const teacher = classInfo?.classTeacher;
                      const childInvoices = invoices.filter((i) => i.pupil?.id === p.id || i.pupilId === p.id);
                      const childBalance = childInvoices.reduce((s, i) => s + (Number(i.total) - Number(i.paid)), 0);
                      const childAtt = attendance.filter((a) => a.pupil?.id === p.id || (a as any).pupilId === p.id);
                      const childPresent = childAtt.filter((a) => a.status === "PRESENT").length;
                      const childPct = childAtt.length ? Math.round((childPresent / childAtt.length) * 100) : null;
                      return (
                        <div key={p.id} className="rounded-xl border bg-card p-5 space-y-3">
                          <div className="flex items-center gap-3">
                            <div className="h-11 w-11 rounded-full flex items-center justify-center font-display text-lg text-white bg-primary">
                              {p.fullName.charAt(0)}
                            </div>
                            <div>
                              <p className="font-semibold">{p.fullName}</p>
                              <p className="text-xs text-muted-foreground">{classInfo?.name ?? p.schoolClass?.name ?? "—"} {classInfo?.stream ?? p.schoolClass?.stream ?? ""}</p>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2 text-xs">
                            <Badge variant="secondary">Adm {p.admissionNo}</Badge>
                            {p.gender && <Badge variant="outline">{p.gender}</Badge>}
                            <Badge>{p.status}</Badge>
                          </div>
                          {teacher && (
                            <div className="rounded-lg bg-muted/40 p-3 text-xs space-y-1">
                              <p className="font-medium flex items-center gap-1.5"><UserRound className="h-3.5 w-3.5" /> Class teacher: {teacher.fullName}</p>
                              <p className="text-muted-foreground">{[teacher.email, teacher.phone].filter(Boolean).join(" · ")}</p>
                            </div>
                          )}
                          <div className="grid grid-cols-3 gap-2 text-sm border-t pt-3">
                            <div>
                              <p className="text-xs text-muted-foreground">Balance</p>
                              <p className={`font-semibold ${childBalance > 0 ? "text-destructive" : "text-green-600"}`}>{money(childBalance)}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Attendance</p>
                              <p className="font-semibold">{details ? `${details.attendance.percentage.toFixed(1)}%` : childPct != null ? `${childPct}%` : "—"}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Latest grade</p>
                              <p className="font-semibold">{details?.latestPerformance?.grade ?? "—"}</p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Attendance ── */}
          <TabsContent value="attendance">
            <Card className="mt-3">
              <CardHeader>
                <CardTitle className="text-base">Attendance — last 90 days</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Child</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {attendance.length === 0
                      ? <TableRow><TableCell colSpan={3}><EmptyState message="No attendance records in the last 90 days." /></TableCell></TableRow>
                      : attendance.map((a, i) => (
                        <TableRow key={i}>
                          <TableCell>{a.date}</TableCell>
                          <TableCell>{a.pupil?.fullName ?? "—"}</TableCell>
                          <TableCell>
                            <Badge variant={a.status === "PRESENT" ? "default" : a.status === "ABSENT" ? "destructive" : "secondary"}>
                              {a.status.charAt(0) + a.status.slice(1).toLowerCase()}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Fees ── */}
          <TabsContent value="fees">
            <Card className="mt-3">
              <CardHeader><CardTitle className="text-base">Invoices & payments</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Child</TableHead>
                      <TableHead>Invoice</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="text-right">Paid</TableHead>
                      <TableHead className="text-right">Balance</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoices.length === 0
                      ? <TableRow><TableCell colSpan={7}><EmptyState message="No invoices found." /></TableCell></TableRow>
                      : invoices.map((i) => (
                        <TableRow key={i.id}>
                          <TableCell>{i.pupil?.fullName}</TableCell>
                          <TableCell className="font-mono text-xs">{i.invoiceNo}</TableCell>
                          <TableCell>{i.description ?? "—"}</TableCell>
                          <TableCell className="text-right">{money(i.total)}</TableCell>
                          <TableCell className="text-right">{money(i.paid)}</TableCell>
                          <TableCell className="text-right font-medium">{money(Number(i.total) - Number(i.paid))}</TableCell>
                          <TableCell>
                            <Badge variant={i.status === "PAID" ? "default" : i.status === "PARTIAL" ? "secondary" : "destructive"}>
                              {i.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ── Performance ── */}
          <TabsContent value="performance">
            <PerformanceTab pupils={pupils} />
          </TabsContent>

          {/* ── Notices ── */}
          <TabsContent value="notices">
            <Card className="mt-3">
              <CardContent className="pt-5">
                {announcements.length === 0 ? <EmptyState message="No announcements." /> : (
                  <ul className="space-y-4">
                    {announcements.map((a: any) => (
                      <li key={a.id} className="border-l-2 border-primary pl-4">
                        <p className="font-semibold">{a.title}</p>
                        <p className="text-sm text-muted-foreground whitespace-pre-line">{a.body}</p>
                        <p className="text-xs text-muted-foreground mt-1">{new Date(a.createdAt ?? a.created_at).toLocaleDateString()}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}

function PerformanceTab({ pupils }: { pupils: any[] }) {
  const [pupilId, setPupilId] = useState("");
  const [reportId, setReportId] = useState("");
  const selectedPupilId = pupilId || pupils[0]?.id || "";
  const { data: reportCards = [], isLoading } = useQuery({
    queryKey: ["parent-report-cards", selectedPupilId],
    enabled: !!selectedPupilId,
    queryFn: () => api.guardians.childReportCards(selectedPupilId),
  });
  const report = reportCards.find((card) => card.examId === reportId) ?? reportCards[0];

  return (
    <Card className="mt-3">
      <CardHeader>
        <div className="flex flex-wrap items-center gap-3">
          <CardTitle className="text-base flex items-center gap-2"><TrendingUp className="h-4 w-4" /> Performance & report cards</CardTitle>
          <div className="flex flex-wrap gap-2 ml-auto">
            <Select value={selectedPupilId} onValueChange={(value) => { setPupilId(value); setReportId(""); }}>
              <SelectTrigger className="w-48"><SelectValue placeholder="Select child" /></SelectTrigger>
              <SelectContent>{pupils.map((p) => <SelectItem key={p.id} value={p.id}>{p.fullName}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={report?.examId ?? ""} onValueChange={setReportId} disabled={!reportCards.length}>
              <SelectTrigger className="w-64"><SelectValue placeholder="Select current or past report" /></SelectTrigger>
              <SelectContent>{reportCards.map((card) => (
                <SelectItem key={card.examId} value={card.examId}>
                  {card.examName}{card.termName ? ` · ${card.termName}` : ""}{card.academicYearName ? ` · ${card.academicYearName}` : ""}
                </SelectItem>
              ))}</SelectContent>
            </Select>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading && <p className="text-sm text-muted-foreground py-8 text-center">Loading report cards…</p>}
        {!isLoading && !report && <EmptyState message="No report cards have been published for this child yet." />}
        {report && <ParentReportCardView report={report} />}
      </CardContent>
    </Card>
  );
}

function ParentReportCardView({ report }: { report: ParentReportCard }) {
  const teacher = report.schoolClass?.classTeacher;
  return (
    <div className="space-y-5">
      <div className="rounded-xl border bg-muted/20 p-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div><p className="text-xs text-muted-foreground">Report</p><p className="font-semibold">{report.examName}</p><p className="text-xs text-muted-foreground">{report.termName ?? ""} {report.academicYearName ?? ""}</p></div>
        <div><p className="text-xs text-muted-foreground">Grade / class</p><p className="font-semibold">{report.schoolClass?.name ?? "—"} {report.schoolClass?.stream ?? ""}</p><p className="text-xs text-muted-foreground">{report.examDate ? new Date(report.examDate).toLocaleDateString() : ""}</p></div>
        <div><p className="text-xs text-muted-foreground">Overall result</p><p className="font-semibold text-lg">{report.averagePercentage.toFixed(1)}% · Grade {report.overallGrade}</p><p className="text-xs text-muted-foreground">{report.subjects.length} subjects</p></div>
        <div><p className="text-xs text-muted-foreground">Term attendance</p><p className="font-semibold text-lg">{report.attendance.percentage.toFixed(1)}%</p><p className="text-xs text-muted-foreground">{report.attendance.present} present · {report.attendance.absent} absent · {report.attendance.late} late</p></div>
      </div>
      {teacher && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm rounded-lg border p-3">
          <UserRound className="h-4 w-4 text-primary" />
          <span><strong>Class teacher:</strong> {teacher.fullName}</span>
          {teacher.email && <span className="text-muted-foreground">{teacher.email}</span>}
          {teacher.phone && <span className="text-muted-foreground">{teacher.phone}</span>}
        </div>
      )}
      <div className="rounded-lg border overflow-hidden">
        <Table>
          <TableHeader><TableRow><TableHead>Subject</TableHead><TableHead>Score</TableHead><TableHead>Percentage</TableHead><TableHead>Grade</TableHead><TableHead>Teacher comment</TableHead></TableRow></TableHeader>
          <TableBody>{report.subjects.map((subject) => (
            <TableRow key={subject.subjectId}>
              <TableCell className="font-medium">{subject.subjectName}</TableCell>
              <TableCell>{subject.score} / {subject.outOf}</TableCell>
              <TableCell>{subject.percentage.toFixed(1)}%</TableCell>
              <TableCell><Badge variant={subject.percentage >= 75 ? "default" : subject.percentage >= 50 ? "secondary" : "destructive"}>{subject.grade}</Badge></TableCell>
              <TableCell className="text-muted-foreground">{subject.comment ?? "—"}</TableCell>
            </TableRow>
          ))}</TableBody>
        </Table>
      </div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground"><FileText className="inline h-4 w-4 mr-1" /> Historical class and teacher details are preserved after promotion.</span>
        <Button variant="outline" size="sm" onClick={() => window.print()}>Print</Button>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, accent }: { icon: any; label: string; value: any; accent?: boolean }) {
  return (
    <Card>
      <CardContent className="p-5 flex items-center gap-4">
        <div className={`rounded-xl p-3 ${accent ? "bg-destructive text-destructive-foreground" : "bg-secondary text-secondary-foreground"}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="font-display text-2xl leading-none mt-0.5">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}
