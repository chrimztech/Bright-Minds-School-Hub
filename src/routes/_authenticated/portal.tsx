import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api, type Invoice, type ParentReportCard, type Payment } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { money } from "@/lib/format";
import { EmptyState } from "@/components/EmptyState";
import { Megaphone, Wallet, ClipboardCheck, GraduationCap, TrendingUp, UserRound, FileText, CreditCard, Download, Printer } from "lucide-react";
import { PrintOverlay, DocHeader, useSchool } from "@/components/PrintableDoc";

const GC: Record<string, string> = { A: "#16a34a", B: "#2563eb", C: "#ca8a04", D: "#ea580c", E: "#dc2626" };
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/portal")({
  head: () => ({ meta: [{ title: "Parent portal" }] }),
  component: ParentPortal,
});

function ParentPortal() {
  const { user } = useAuth();
  const { data: school } = useSchool();
  const [receiptFor, setReceiptFor] = useState<Payment | null>(null);

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

  const { data: paymentClaims = [] } = useQuery({
    queryKey: ["my-payment-claims"],
    enabled: !!guardian,
    queryFn: () => api.guardians.myPaymentClaims(),
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
                              <p className="font-semibold">
                                {details
                                  ? `${details.attendance.present}/${details.attendance.total} (${details.attendance.percentage.toFixed(0)}%)`
                                  : childAtt.length ? `${childPresent}/${childAtt.length} (${childPct}%)` : "—"}
                              </p>
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
            {pupils.length > 0 && (
              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {pupils.map((p) => {
                  const childAtt = attendance.filter((a) => a.pupil?.id === p.id || (a as any).pupilId === p.id);
                  const childPresent = childAtt.filter((a) => a.status === "PRESENT").length;
                  const childPct = childAtt.length ? Math.round((childPresent / childAtt.length) * 100) : null;
                  return (
                    <div key={p.id} className="rounded-lg border bg-card p-3">
                      <p className="text-xs text-muted-foreground">{p.fullName}</p>
                      <p className="font-semibold text-lg">{childAtt.length ? `${childPresent}/${childAtt.length}` : "—"} <span className="text-sm font-normal text-muted-foreground">{childPct != null ? `days present (${childPct}%)` : "no records"}</span></p>
                    </div>
                  );
                })}
              </div>
            )}
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
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invoices.length === 0
                      ? <TableRow><TableCell colSpan={8}><EmptyState message="No invoices found." /></TableCell></TableRow>
                      : invoices.map((i) => {
                        const bal = Number(i.total) - Number(i.paid);
                        return (
                          <TableRow key={i.id}>
                            <TableCell>{i.pupil?.fullName}</TableCell>
                            <TableCell className="font-mono text-xs">{i.invoiceNo}</TableCell>
                            <TableCell>{i.description ?? "—"}</TableCell>
                            <TableCell className="text-right">{money(i.total)}</TableCell>
                            <TableCell className="text-right">{money(i.paid)}</TableCell>
                            <TableCell className="text-right font-medium">{money(bal)}</TableCell>
                            <TableCell>
                              <Badge variant={i.status === "PAID" ? "default" : i.status === "PARTIAL" ? "secondary" : "destructive"}>
                                {i.status}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {bal > 0 && <SubmitPaymentDialog invoice={i} />}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            <Card className="mt-4">
              <CardHeader><CardTitle className="text-base">Payment history</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow><TableHead>Date</TableHead><TableHead>Child</TableHead><TableHead>Invoice</TableHead><TableHead>Method</TableHead><TableHead>Receipt</TableHead><TableHead>Recorded by</TableHead><TableHead className="text-right">Amount</TableHead><TableHead>Status</TableHead><TableHead></TableHead></TableRow>
                  </TableHeader>
                  <TableBody>
                    {paymentClaims.length === 0
                      ? <TableRow><TableCell colSpan={8}><EmptyState message="No payments recorded yet." /></TableCell></TableRow>
                      : paymentClaims.map((p) => (
                        <TableRow key={p.id}>
                          <TableCell>{p.paidOn}</TableCell>
                          <TableCell>{p.pupil?.fullName}</TableCell>
                          <TableCell className="font-mono text-xs">{p.invoice?.invoiceNo ?? "—"}</TableCell>
                          <TableCell>{p.method.replace("_", " ")}</TableCell>
                          <TableCell className="font-mono text-xs">{p.receiptNo}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{p.submittedBy ? "You" : "School office"}</TableCell>
                          <TableCell className="text-right font-medium">{money(p.amount)}</TableCell>
                          <TableCell>
                            <Badge variant={p.status === "CONFIRMED" ? "default" : p.status === "REJECTED" ? "destructive" : "secondary"}>
                              {p.status}
                            </Badge>
                            {p.status === "REJECTED" && p.rejectionReason && (
                              <p className="text-xs text-muted-foreground mt-0.5">{p.rejectionReason}</p>
                            )}
                          </TableCell>
                          <TableCell>
                            {p.status === "CONFIRMED" && (
                              <Button size="icon" variant="ghost" onClick={() => setReceiptFor(p)} title="Print receipt">
                                <Printer className="h-4 w-4" />
                              </Button>
                            )}
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
      {receiptFor && (
        <PrintOverlay onClose={() => setReceiptFor(null)}>
          <ParentReceiptPrint school={school} payment={receiptFor} />
        </PrintOverlay>
      )}
    </>
  );
}

function ParentReceiptPrint({ school, payment }: { school: any; payment: Payment }) {
  const inv = payment.invoice;
  const balance = inv ? Number(inv.total) - Number(inv.paid) : null;
  return (
    <div className="p-10 font-sans bg-white">
      <DocHeader school={{ ...school, logoUrl: school?.logoUrl ?? "/logo.png" }} title="Receipt" />
      <div className="grid grid-cols-2 gap-8 text-sm mb-8">
        <div>
          <p className="uppercase text-[10px] tracking-widest text-gray-500 mb-1">Received from</p>
          <p className="font-semibold text-lg">{payment.pupil?.fullName}</p>
          <p className="text-gray-600">Adm #: {payment.pupil?.admissionNo}</p>
        </div>
        <div className="text-right">
          <p><span className="text-gray-500">Receipt no:</span> <span className="font-mono">{payment.receiptNo}</span></p>
          <p><span className="text-gray-500">Date:</span> {payment.paidOn}</p>
          <p><span className="text-gray-500">Method:</span> {payment.method.replace("_", " ")}</p>
          {payment.reference && <p><span className="text-gray-500">Reference:</span> {payment.reference}</p>}
        </div>
      </div>
      <table className="w-full text-sm border-collapse mb-8">
        <thead><tr className="border-b-2 border-black text-left">
          <th className="py-2">Description</th>
          <th className="py-2 text-right">Amount</th>
        </tr></thead>
        <tbody>
          <tr className="border-b border-gray-200">
            <td className="py-3">{inv ? `Payment towards invoice ${inv.invoiceNo}${inv.description ? " — " + inv.description : ""}` : "School fee payment"}</td>
            <td className="py-3 text-right">{money(payment.amount)}</td>
          </tr>
        </tbody>
        {inv && (
          <tfoot>
            <tr><td className="pt-4 text-right text-gray-500">Invoice total</td><td className="pt-4 text-right">{money(inv.total)}</td></tr>
            <tr><td className="text-right text-gray-500">Total paid to date</td><td className="text-right">{money(inv.paid)}</td></tr>
            <tr className="text-lg font-bold"><td className="pt-2 text-right">Balance remaining</td><td className="pt-2 text-right">{money(balance ?? 0)}</td></tr>
          </tfoot>
        )}
      </table>
      <div className="border-t border-gray-300 pt-6 text-xs text-gray-500 flex justify-between">
        <p>Thank you for partnering with us in your child's education.</p>
        <p>Generated {new Date().toLocaleString()}</p>
      </div>
    </div>
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
  const { data: school } = useSchool();
  const [printOpen, setPrintOpen] = useState(false);
  return (
    <div className="space-y-5">
      <div className="rounded-xl border bg-muted/20 p-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div><p className="text-xs text-muted-foreground">Report</p><p className="font-semibold">{report.examName}</p><p className="text-xs text-muted-foreground">{report.termName ?? ""} {report.academicYearName ?? ""}</p></div>
        <div><p className="text-xs text-muted-foreground">Grade / class</p><p className="font-semibold">{report.schoolClass?.name ?? "—"} {report.schoolClass?.stream ?? ""}</p><p className="text-xs text-muted-foreground">{report.examDate ? new Date(report.examDate).toLocaleDateString() : ""}</p></div>
        <div><p className="text-xs text-muted-foreground">Overall result</p><p className="font-semibold text-lg">{report.averagePercentage.toFixed(1)}% · Grade {report.overallGrade}</p><p className="text-xs text-muted-foreground">{report.subjects.length} subjects</p></div>
        <div><p className="text-xs text-muted-foreground">Term attendance</p><p className="font-semibold text-lg">{report.attendance.present}/{report.attendance.total} ({report.attendance.percentage.toFixed(0)}%)</p><p className="text-xs text-muted-foreground">{report.attendance.present} present · {report.attendance.absent} absent · {report.attendance.late} late</p></div>
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
      {(report.classTeacherRemark || report.headTeacherRemark) && (
        <div className="grid gap-3 sm:grid-cols-2">
          {report.classTeacherRemark && (
            <div className="rounded-lg border p-3 text-sm">
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Class teacher's remarks</p>
              <p>{report.classTeacherRemark}</p>
            </div>
          )}
          {report.headTeacherRemark && (
            <div className="rounded-lg border p-3 text-sm">
              <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Head teacher's remarks</p>
              <p>{report.headTeacherRemark}</p>
            </div>
          )}
        </div>
      )}
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground"><FileText className="inline h-4 w-4 mr-1" /> Historical class and teacher details are preserved after promotion.</span>
        <Button variant="outline" size="sm" onClick={() => setPrintOpen(true)}><Download className="h-4 w-4 mr-1" /> Download report card</Button>
      </div>
      {printOpen && (
        <PrintOverlay onClose={() => setPrintOpen(false)}>
          <ParentReportCardPrint school={school} report={report} />
        </PrintOverlay>
      )}
    </div>
  );
}

function ParentReportCardPrint({ school, report }: { school: any; report: ParentReportCard }) {
  const att = report.attendance;
  return (
    <div className="p-10 font-sans text-black text-sm">
      <DocHeader school={{ ...school, logoUrl: school?.logoUrl ?? "/logo.png" }} title="Pupil Report Card" />

      <div className="flex justify-between text-xs text-gray-600 mb-5">
        {report.termName && <span>Term: <strong>{report.termName}</strong>{report.academicYearName ? ` · ${report.academicYearName}` : ""}</span>}
        <span>Assessment: <strong>{report.examName}{report.assessmentType ? ` (${report.assessmentType.replace("_", " ")})` : ""}</strong></span>
        {report.examDate && <span>Date: <strong>{new Date(report.examDate).toLocaleDateString()}</strong></span>}
      </div>

      <table className="w-full border border-gray-300 mb-5 text-sm">
        <tbody>
          <tr className="bg-gray-50">
            <td className="border border-gray-300 px-3 py-1.5"><span className="text-gray-500">Full name: </span><strong>{report.pupilName}</strong></td>
            <td className="border border-gray-300 px-3 py-1.5"><span className="text-gray-500">Adm No: </span><strong className="font-mono">{report.admissionNo}</strong></td>
          </tr>
          <tr>
            <td className="border border-gray-300 px-3 py-1.5" colSpan={2}><span className="text-gray-500">Class: </span><strong>{report.schoolClass?.name ?? "—"}{report.schoolClass?.stream ? " " + report.schoolClass.stream : ""}</strong></td>
          </tr>
        </tbody>
      </table>

      <p className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">Academic Performance</p>
      <table className="w-full border-collapse mb-5 text-sm">
        <thead>
          <tr className="bg-gray-100 border-b-2 border-black">
            <th className="text-left py-2 px-2">Subject</th>
            <th className="text-center py-2 px-2">Score</th>
            <th className="text-center py-2 px-2">Out of</th>
            <th className="text-center py-2 px-2">%</th>
            <th className="text-center py-2 px-2">Grade</th>
            <th className="text-left py-2 px-2">Comment</th>
          </tr>
        </thead>
        <tbody>
          {report.subjects.length === 0
            ? <tr><td colSpan={6} className="text-center py-4 text-gray-400">No marks recorded.</td></tr>
            : report.subjects.map((s, i) => (
              <tr key={s.subjectId} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                <td className="py-1.5 px-2 border-b border-gray-200">{s.subjectName}</td>
                <td className="py-1.5 px-2 border-b border-gray-200 text-center font-mono font-semibold">{s.score}</td>
                <td className="py-1.5 px-2 border-b border-gray-200 text-center text-gray-500">{s.outOf}</td>
                <td className="py-1.5 px-2 border-b border-gray-200 text-center">{s.percentage.toFixed(1)}%</td>
                <td className="py-1.5 px-2 border-b border-gray-200 text-center font-bold" style={{ color: GC[s.grade] ?? "#000" }}>{s.grade}</td>
                <td className="py-1.5 px-2 border-b border-gray-200 text-gray-600">{s.comment ?? "—"}</td>
              </tr>
            ))}
        </tbody>
      </table>

      <div className="border-2 border-gray-300 rounded p-3 grid grid-cols-3 gap-4 text-center mb-5">
        <div><p className="text-xs text-gray-500 uppercase">Total</p><p className="text-2xl font-bold">{report.totalScore}<span className="text-sm text-gray-400">/{report.totalOutOf}</span></p></div>
        <div><p className="text-xs text-gray-500 uppercase">Average</p><p className="text-2xl font-bold">{report.averagePercentage.toFixed(1)}%</p></div>
        <div><p className="text-xs text-gray-500 uppercase">Overall grade</p><p className="text-3xl font-bold" style={{ color: GC[report.overallGrade] ?? "#000" }}>{report.overallGrade}</p></div>
      </div>

      <div className="border border-gray-300 rounded p-3 grid grid-cols-4 gap-3 text-center mb-5">
        <div><p className="text-xs text-gray-500">Present</p><p className="font-bold text-green-700">{att.present}</p></div>
        <div><p className="text-xs text-gray-500">Absent</p><p className="font-bold text-red-600">{att.absent}</p></div>
        <div><p className="text-xs text-gray-500">Late</p><p className="font-bold text-orange-500">{att.late}</p></div>
        <div><p className="text-xs text-gray-500">Attendance rate</p><p className="font-bold">{att.present}/{att.total} ({att.percentage.toFixed(0)}%)</p></div>
      </div>

      {(report.classTeacherRemark || report.headTeacherRemark) && (
        <div className="grid grid-cols-2 gap-4 mb-5">
          <div className="border border-gray-300 rounded p-3 min-h-[56px]">
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Class teacher's remarks</p>
            <p className="text-sm">{report.classTeacherRemark || " "}</p>
          </div>
          <div className="border border-gray-300 rounded p-3 min-h-[56px]">
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Head teacher's remarks</p>
            <p className="text-sm">{report.headTeacherRemark || " "}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-16 mt-8">
        {[
          { title: "Class Teacher", name: report.schoolClass?.classTeacher?.fullName, signatureUrl: report.schoolClass?.classTeacher?.signatureUrl },
          { title: "Head Teacher / Principal", name: school?.headTeacher, signatureUrl: school?.headTeacherSignatureUrl },
        ].map(({ title, name, signatureUrl }) => (
          <div key={title}>
            {signatureUrl && <img src={signatureUrl} alt="" className="h-12 object-contain object-left" />}
            <div className="mt-2 border-t border-black pt-2">
              <p className="text-xs">{title}</p>
              <p className="text-xs text-gray-400 mt-1">Name: {name || "_________________________"} Sign: _____________</p>
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

function SubmitPaymentDialog({ invoice }: { invoice: Invoice }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const balance = Number(invoice.total) - Number(invoice.paid);
  const [f, setF] = useState({ amount: balance, method: "BANK", reference: "" });
  const submit = useMutation({
    mutationFn: () => api.guardians.submitPayment({ invoiceId: invoice.id, amount: f.amount, method: f.method, reference: f.reference || undefined }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-payment-claims"] });
      toast.success("Payment submitted — the school will confirm it shortly");
      setOpen(false);
    },
    onError: (e: any) => toast.error(e.message),
  });
  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (v) setF({ amount: balance, method: "BANK", reference: "" }); }}>
      <DialogTrigger asChild><Button size="sm" variant="outline"><CreditCard className="h-3.5 w-3.5 mr-1" /> I've paid</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Submit a payment</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Invoice <span className="font-mono text-foreground">{invoice.invoiceNo}</span> — balance {money(balance)}.
            Let the school know you've paid; they'll confirm it against your account.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Amount paid</Label><Input type="number" value={f.amount} onChange={(e) => setF({ ...f, amount: Number(e.target.value) })} /></div>
            <div><Label>Method</Label>
              <Select value={f.method} onValueChange={(v) => setF({ ...f, method: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{["BANK", "MOBILE_MONEY", "CASH", "CARD", "CHEQUE", "ONLINE"].map((m) => <SelectItem key={m} value={m}>{m.replace("_", " ")}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          <div><Label>Reference / transaction ID</Label><Input value={f.reference} onChange={(e) => setF({ ...f, reference: e.target.value })} placeholder="e.g. bank transfer reference or mobile money code" /></div>
        </div>
        <DialogFooter><Button onClick={() => submit.mutate()} disabled={!f.amount || f.amount <= 0 || submit.isPending}>{submit.isPending ? "Submitting…" : "Submit"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
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
