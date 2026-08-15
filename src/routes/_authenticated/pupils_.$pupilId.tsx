import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { ProfileHeader, Section, Field } from "@/components/ProfileHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/EmptyState";
import { money } from "@/lib/format";
import { ArrowLeft, Users, Wallet, ClipboardCheck, Shield, Hash, School, Cake, MapPin, Stethoscope, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/pupils_/$pupilId")({
  head: () => ({ meta: [{ title: "Pupil profile" }] }),
  component: PupilDetail,
});

function PupilDetail() {
  const { pupilId } = Route.useParams();
  const navigate = useNavigate();

  const { data: pupil, isLoading } = useQuery({ queryKey: ["pupil", pupilId], queryFn: () => api.pupils.get(pupilId) });
  const { data: guardians = [] } = useQuery({ queryKey: ["pupil-guardians", pupilId], queryFn: () => api.guardians.byPupil(pupilId) });
  const { data: invoices = [] } = useQuery({ queryKey: ["pupil-invoices", pupilId], queryFn: () => api.fees.invoices.list({ pupilId }) });
  const to = new Date().toISOString().slice(0, 10);
  const from = new Date(Date.now() - 90 * 864e5).toISOString().slice(0, 10);
  const { data: attendance = [] } = useQuery({ queryKey: ["pupil-attendance", pupilId], queryFn: () => api.attendance.byPupil(pupilId, from, to) });
  const { data: health = [] } = useQuery({ queryKey: ["pupil-health", pupilId], queryFn: () => api.health.list(pupilId) });
  const { data: discipline = [] } = useQuery({ queryKey: ["pupil-discipline", pupilId], queryFn: () => api.discipline.list(pupilId) });

  if (isLoading) return <div className="p-6 text-muted-foreground">Loading…</div>;
  if (!pupil) return <div className="p-6"><EmptyState message="Pupil not found." /></div>;

  const balance = invoices.reduce((s, i) => s + (Number(i.total) - Number(i.paid)), 0);
  const presentDays = attendance.filter((a) => a.status === "PRESENT").length;
  const attendancePct = attendance.length ? Math.round((presentDays / attendance.length) * 100) : null;
  const classLabel = pupil.schoolClass ? `${pupil.schoolClass.name}${pupil.schoolClass.stream ? " " + pupil.schoolClass.stream : ""}` : "Unassigned";

  return (
    <>
      <PageHeader
        title="Pupil profile"
        actions={<Button variant="outline" onClick={() => navigate({ to: "/pupils" })}><ArrowLeft className="h-4 w-4 mr-1" /> Back to pupils</Button>}
      />
      <div className="p-6 space-y-6">
        <ProfileHeader
          photoUrl={pupil.photoUrl}
          name={pupil.fullName}
          subtitle={classLabel}
          badges={<>
            <Badge variant={pupil.status === "ACTIVE" ? "success" : "secondary"}>{pupil.status}</Badge>
            {pupil.gender && <Badge variant="outline">{pupil.gender}</Badge>}
            {pupil.bloodGroup && <Badge variant="outline">Blood {pupil.bloodGroup}</Badge>}
          </>}
          meta={[
            { icon: Hash, label: "Admission no.", value: pupil.admissionNo },
            { icon: School, label: "Class", value: classLabel },
            { icon: Cake, label: "Date of birth", value: pupil.dob ? new Date(pupil.dob).toLocaleDateString() : "—" },
            { icon: Users, label: "Guardians", value: guardians.length },
          ]}
        />

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard icon={Users} label="Guardians" value={guardians.length} />
          <StatCard icon={Wallet} label="Outstanding fees" value={money(balance)} accent={balance > 0} />
          <StatCard icon={ClipboardCheck} label="Attendance (90d)" value={attendancePct != null ? `${attendancePct}%` : "—"} />
          <StatCard icon={Shield} label="Discipline records" value={discipline.length} accent={discipline.length > 0} />
        </div>

        <Tabs defaultValue="overview">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="guardians">Guardians</TabsTrigger>
            <TabsTrigger value="fees">Fees</TabsTrigger>
            <TabsTrigger value="attendance">Attendance</TabsTrigger>
            <TabsTrigger value="health">Health</TabsTrigger>
            <TabsTrigger value="discipline">Discipline</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <Card className="mt-3"><CardContent className="pt-5 space-y-6 text-sm">
              <Section title="Personal details">
                <Field icon={Cake} label="Date of birth" value={pupil.dob ? new Date(pupil.dob).toLocaleDateString() : "—"} />
                <Field icon={School} label="Class" value={classLabel} />
                <Field icon={MapPin} label="Address" value={pupil.address ?? "—"} />
              </Section>
              <Section title="Health">
                <Field icon={AlertTriangle} label="Allergies" value={pupil.allergies ?? "—"} />
                <Field icon={Stethoscope} label="Medical info" value={pupil.medicalInfo ?? "—"} />
              </Section>
            </CardContent></Card>
          </TabsContent>

          <TabsContent value="guardians">
            <Card className="mt-3"><CardContent className="pt-5">
              {guardians.length === 0 ? <EmptyState message="No guardians linked." /> : (
                <Table>
                  <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Relationship</TableHead><TableHead>Phone</TableHead><TableHead>Email</TableHead></TableRow></TableHeader>
                  <TableBody>{guardians.map((g) => (
                    <TableRow key={g.id}>
                      <TableCell className="font-medium"><Link to="/guardians/$guardianId" params={{ guardianId: g.id }} className="hover:underline">{g.fullName}</Link></TableCell>
                      <TableCell>{g.relationship ?? "—"}</TableCell>
                      <TableCell>{g.phone ?? "—"}</TableCell>
                      <TableCell>{g.email ?? "—"}</TableCell>
                    </TableRow>
                  ))}</TableBody>
                </Table>
              )}
            </CardContent></Card>
          </TabsContent>

          <TabsContent value="fees">
            <Card className="mt-3"><CardContent className="pt-5">
              {invoices.length === 0 ? <EmptyState message="No invoices yet." /> : (
                <Table>
                  <TableHeader><TableRow><TableHead>Invoice</TableHead><TableHead>Description</TableHead><TableHead className="text-right">Total</TableHead><TableHead className="text-right">Paid</TableHead><TableHead className="text-right">Balance</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                  <TableBody>{invoices.map((i) => (
                    <TableRow key={i.id}>
                      <TableCell className="font-mono text-xs">{i.invoiceNo}</TableCell>
                      <TableCell>{i.description ?? "—"}</TableCell>
                      <TableCell className="text-right">{money(i.total)}</TableCell>
                      <TableCell className="text-right">{money(i.paid)}</TableCell>
                      <TableCell className="text-right font-medium">{money(Number(i.total) - Number(i.paid))}</TableCell>
                      <TableCell><Badge variant={i.status === "PAID" ? "default" : i.status === "PARTIAL" ? "secondary" : "destructive"}>{i.status}</Badge></TableCell>
                    </TableRow>
                  ))}</TableBody>
                </Table>
              )}
            </CardContent></Card>
          </TabsContent>

          <TabsContent value="attendance">
            <Card className="mt-3"><CardContent className="pt-5">
              {attendance.length === 0 ? <EmptyState message="No attendance records in the last 90 days." /> : (
                <Table>
                  <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Status</TableHead><TableHead>Notes</TableHead></TableRow></TableHeader>
                  <TableBody>{attendance.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell>{a.date}</TableCell>
                      <TableCell><Badge variant={a.status === "PRESENT" ? "default" : a.status === "ABSENT" ? "destructive" : "secondary"}>{a.status}</Badge></TableCell>
                      <TableCell className="text-muted-foreground">{a.notes ?? "—"}</TableCell>
                    </TableRow>
                  ))}</TableBody>
                </Table>
              )}
            </CardContent></Card>
          </TabsContent>

          <TabsContent value="health">
            <Card className="mt-3"><CardContent className="pt-5">
              {health.length === 0 ? <EmptyState message="No health records." /> : (
                <Table>
                  <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Complaint</TableHead><TableHead>Diagnosis</TableHead><TableHead>Treatment</TableHead></TableRow></TableHeader>
                  <TableBody>{health.map((h) => (
                    <TableRow key={h.id}>
                      <TableCell>{h.visitDate}</TableCell>
                      <TableCell>{h.complaint ?? "—"}</TableCell>
                      <TableCell>{h.diagnosis ?? "—"}</TableCell>
                      <TableCell>{h.treatment ?? "—"}</TableCell>
                    </TableRow>
                  ))}</TableBody>
                </Table>
              )}
            </CardContent></Card>
          </TabsContent>

          <TabsContent value="discipline">
            <Card className="mt-3"><CardContent className="pt-5">
              {discipline.length === 0 ? <EmptyState message="No discipline records." /> : (
                <Table>
                  <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Kind</TableHead><TableHead>Description</TableHead><TableHead>Action taken</TableHead></TableRow></TableHeader>
                  <TableBody>{discipline.map((d) => (
                    <TableRow key={d.id}>
                      <TableCell>{d.occurredOn}</TableCell>
                      <TableCell><Badge variant="destructive">{d.kind}</Badge></TableCell>
                      <TableCell>{d.description}</TableCell>
                      <TableCell className="text-muted-foreground">{d.actionTaken ?? "—"}</TableCell>
                    </TableRow>
                  ))}</TableBody>
                </Table>
              )}
            </CardContent></Card>
          </TabsContent>
        </Tabs>
      </div>
    </>
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
