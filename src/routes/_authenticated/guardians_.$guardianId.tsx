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
import { ArrowLeft, Users, Wallet, Mail, Phone, MapPin, Briefcase, IdCard } from "lucide-react";

export const Route = createFileRoute("/_authenticated/guardians_/$guardianId")({
  head: () => ({ meta: [{ title: "Parent profile" }] }),
  component: GuardianDetail,
});

function GuardianDetail() {
  const { guardianId } = Route.useParams();
  const navigate = useNavigate();

  const { data: guardian, isLoading } = useQuery({ queryKey: ["guardian-one", guardianId], queryFn: () => api.guardians.get(guardianId) });
  const { data: pupils = [] } = useQuery({ queryKey: ["guardian-pupils", guardianId], queryFn: () => api.guardians.pupilsFor(guardianId) });

  const invoiceQueries = useQuery({
    queryKey: ["guardian-invoices", guardianId, pupils.map((p) => p.id)],
    enabled: pupils.length > 0,
    queryFn: async () => {
      const lists = await Promise.all(pupils.map((p) => api.fees.invoices.list({ pupilId: p.id })));
      return lists.flat();
    },
  });
  const invoices = invoiceQueries.data ?? [];

  if (isLoading) return <div className="p-6 text-muted-foreground">Loading…</div>;
  if (!guardian) return <div className="p-6"><EmptyState message="Parent not found." /></div>;

  const balance = invoices.reduce((s, i) => s + (Number(i.total) - Number(i.paid)), 0);

  return (
    <>
      <PageHeader
        title="Parent profile"
        actions={<Button variant="outline" onClick={() => navigate({ to: "/guardians" })}><ArrowLeft className="h-4 w-4 mr-1" /> Back to parents</Button>}
      />
      <div className="p-6 space-y-6">
        <ProfileHeader
          name={guardian.fullName}
          subtitle={guardian.relationship ?? "Parent / guardian"}
          badges={<>
            <Badge variant={guardian.userId ? "success" : "secondary"}>{guardian.userId ? "Login active" : "No login"}</Badge>
            {guardian.relationship && <Badge variant="outline">{guardian.relationship}</Badge>}
          </>}
          meta={[
            { icon: Phone, label: "Phone", value: guardian.phone ?? "—" },
            { icon: Mail, label: "Email", value: guardian.email ?? "—" },
            { icon: Users, label: "Linked pupils", value: pupils.length },
            { icon: Wallet, label: "Outstanding fees", value: money(balance) },
          ]}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <StatCard icon={Users} label="Linked pupils" value={pupils.length} />
          <StatCard icon={Wallet} label="Outstanding fees (all children)" value={money(balance)} accent={balance > 0} />
        </div>

        <Tabs defaultValue="overview">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="pupils">Pupils</TabsTrigger>
            <TabsTrigger value="fees">Fees</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <Card className="mt-3"><CardContent className="pt-5 space-y-6 text-sm">
              <Section title="Contact">
                <Field icon={Phone} label="Phone" value={guardian.phone ?? "—"} />
                <Field icon={Mail} label="Email" value={guardian.email ?? "—"} />
                <Field icon={MapPin} label="Address" value={guardian.address ?? "—"} />
              </Section>
              <Section title="Other details">
                <Field icon={Briefcase} label="Occupation" value={guardian.occupation ?? "—"} />
                <Field icon={IdCard} label="National ID" value={guardian.nationalId ?? "—"} />
              </Section>
            </CardContent></Card>
          </TabsContent>

          <TabsContent value="pupils">
            <Card className="mt-3"><CardContent className="pt-5">
              {pupils.length === 0 ? <EmptyState message="No pupils linked." /> : (
                <Table>
                  <TableHeader><TableRow><TableHead>Name</TableHead><TableHead>Admission</TableHead><TableHead>Class</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                  <TableBody>{pupils.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="font-medium"><Link to="/pupils/$pupilId" params={{ pupilId: p.id }} className="hover:underline">{p.fullName}</Link></TableCell>
                      <TableCell className="font-mono text-xs">{p.admissionNo}</TableCell>
                      <TableCell>{p.schoolClass ? `${p.schoolClass.name}${p.schoolClass.stream ? " " + p.schoolClass.stream : ""}` : "—"}</TableCell>
                      <TableCell><Badge variant={p.status === "ACTIVE" ? "default" : "secondary"}>{p.status}</Badge></TableCell>
                    </TableRow>
                  ))}</TableBody>
                </Table>
              )}
            </CardContent></Card>
          </TabsContent>

          <TabsContent value="fees">
            <Card className="mt-3"><CardContent className="pt-5">
              {invoices.length === 0 ? <EmptyState message="No invoices for linked pupils." /> : (
                <Table>
                  <TableHeader><TableRow><TableHead>Pupil</TableHead><TableHead>Invoice</TableHead><TableHead className="text-right">Total</TableHead><TableHead className="text-right">Balance</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
                  <TableBody>{invoices.map((i) => (
                    <TableRow key={i.id}>
                      <TableCell>{i.pupil?.fullName}</TableCell>
                      <TableCell className="font-mono text-xs">{i.invoiceNo}</TableCell>
                      <TableCell className="text-right">{money(i.total)}</TableCell>
                      <TableCell className="text-right font-medium">{money(Number(i.total) - Number(i.paid))}</TableCell>
                      <TableCell><Badge variant={i.status === "PAID" ? "default" : i.status === "PARTIAL" ? "secondary" : "destructive"}>{i.status}</Badge></TableCell>
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
