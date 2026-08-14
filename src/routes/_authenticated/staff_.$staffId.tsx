import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/EmptyState";
import { money } from "@/lib/format";
import { ArrowLeft, School, Wallet, FileSignature } from "lucide-react";

export const Route = createFileRoute("/_authenticated/staff_/$staffId")({
  head: () => ({ meta: [{ title: "Staff profile" }] }),
  component: StaffDetail,
});

function StaffDetail() {
  const { staffId } = Route.useParams();
  const navigate = useNavigate();

  const { data: staff, isLoading } = useQuery({ queryKey: ["staff-one", staffId], queryFn: () => api.staff.get(staffId) });
  const { data: classes = [] } = useQuery({ queryKey: ["classes-list"], queryFn: () => api.classes.list() });
  const { data: payslips = [] } = useQuery({ queryKey: ["staff-payslips", staffId], queryFn: () => api.payroll.payslips.list(undefined, staffId) });
  const { data: leave = [] } = useQuery({ queryKey: ["staff-leave", staffId], queryFn: () => api.leave.list(staffId) });

  if (isLoading) return <div className="p-6 text-muted-foreground">Loading…</div>;
  if (!staff) return <div className="p-6"><EmptyState message="Staff member not found." /></div>;

  const assignedClasses = classes.filter((c) => c.classTeacher?.id === staff.id);
  const initials = staff.fullName.split(" ").slice(0, 2).map((n) => n[0]).join("").toUpperCase();

  return (
    <>
      <PageHeader
        title={staff.fullName}
        description={`Staff #${staff.staffNo} · ${staff.roleCategory ?? (staff.isTeacher ? "Teacher" : "Staff")}`}
        actions={<Button variant="outline" onClick={() => navigate({ to: "/staff" })}><ArrowLeft className="h-4 w-4 mr-1" /> Back to staff</Button>}
      />
      <div className="p-6 space-y-6">
        <div className="flex flex-wrap items-center gap-4">
          {staff.photoUrl ? (
            <img src={staff.photoUrl} alt={staff.fullName} className="h-16 w-16 rounded-full object-cover border" />
          ) : (
            <div className="h-16 w-16 rounded-full flex items-center justify-center text-xl font-bold text-white shrink-0 bg-primary">
              {initials}
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            <Badge variant={staff.status === "ACTIVE" ? "default" : "secondary"}>{staff.status}</Badge>
            {staff.isTeacher && <Badge variant="outline">Teacher</Badge>}
            <Badge variant={staff.userId ? "default" : "secondary"}>{staff.userId ? "Login active" : "No login"}</Badge>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard icon={School} label="Assigned classes" value={assignedClasses.length} />
          <StatCard icon={Wallet} label="Basic salary" value={money(staff.basicSalary ?? 0)} />
          <StatCard icon={FileSignature} label="Leave requests" value={leave.length} />
        </div>

        <Tabs defaultValue="overview">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="classes">Classes</TabsTrigger>
            <TabsTrigger value="payroll">Payroll</TabsTrigger>
            <TabsTrigger value="leave">Leave</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <Card className="mt-3"><CardContent className="pt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 text-sm">
              <Field label="Email" value={staff.email ?? "—"} />
              <Field label="Phone" value={staff.phone ?? "—"} />
              <Field label="Gender" value={staff.gender ?? "—"} />
              <Field label="Employment type" value={staff.employmentType ?? "—"} />
              <Field label="Contract end" value={staff.contractEndDate ? new Date(staff.contractEndDate).toLocaleDateString() : "—"} />
              <Field label="Role / position" value={staff.roleCategory ?? "—"} />
            </CardContent></Card>
          </TabsContent>

          <TabsContent value="classes">
            <Card className="mt-3"><CardContent className="pt-5">
              {assignedClasses.length === 0 ? <EmptyState message="Not assigned as class teacher for any class." /> : (
                <Table>
                  <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Stream</TableHead><TableHead>Capacity</TableHead></TableRow></TableHeader>
                  <TableBody>{assignedClasses.map((c) => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{c.name}</TableCell>
                      <TableCell>{c.stream ?? "—"}</TableCell>
                      <TableCell>{c.capacity ?? "—"}</TableCell>
                    </TableRow>
                  ))}</TableBody>
                </Table>
              )}
            </CardContent></Card>
          </TabsContent>

          <TabsContent value="payroll">
            <Card className="mt-3"><CardContent className="pt-5">
              {payslips.length === 0 ? <EmptyState message="No payslips yet." /> : (
                <Table>
                  <TableHeader><TableRow><TableHead>Period</TableHead><TableHead className="text-right">Basic</TableHead><TableHead className="text-right">Allowances</TableHead><TableHead className="text-right">Deductions</TableHead><TableHead className="text-right">Net pay</TableHead></TableRow></TableHeader>
                  <TableBody>{payslips.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>{p.period?.periodLabel ?? "—"}</TableCell>
                      <TableCell className="text-right">{money(p.basic)}</TableCell>
                      <TableCell className="text-right">{money(p.allowances)}</TableCell>
                      <TableCell className="text-right">{money(p.deductions)}</TableCell>
                      <TableCell className="text-right font-semibold">{money(p.netPay)}</TableCell>
                    </TableRow>
                  ))}</TableBody>
                </Table>
              )}
            </CardContent></Card>
          </TabsContent>

          <TabsContent value="leave">
            <Card className="mt-3"><CardContent className="pt-5">
              {leave.length === 0 ? <EmptyState message="No leave requests." /> : (
                <Table>
                  <TableHeader><TableRow><TableHead>Type</TableHead><TableHead>From</TableHead><TableHead>To</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                  <TableBody>{leave.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell>{l.leaveType}</TableCell>
                      <TableCell>{l.startDate}</TableCell>
                      <TableCell>{l.endDate}</TableCell>
                      <TableCell><Badge variant={l.status === "APPROVED" ? "default" : l.status === "REJECTED" ? "destructive" : "secondary"}>{l.status}</Badge></TableCell>
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

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium">{value}</p>
    </div>
  );
}

function StatCard({ icon: Icon, label, value }: { icon: any; label: string; value: any }) {
  return (
    <Card>
      <CardContent className="p-5 flex items-center gap-4">
        <div className="rounded-xl p-3 bg-secondary text-secondary-foreground">
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
