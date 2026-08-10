import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { money } from "@/lib/format";
import { Users, GraduationCap, Wallet, Receipt, BookOpen, Boxes, ClipboardCheck, UserPlus, Bus, HeartPulse, Download, Printer } from "lucide-react";

export const Route = createFileRoute("/_authenticated/reports")({
  head: () => ({ meta: [{ title: "Reports" }] }),
  component: ReportsPage,
});

function ReportsPage() {
  const { data } = useQuery({
    queryKey: ["reports"],
    queryFn: () => api.reports.get(),
  });
  const outstanding = (data?.feesBilled ?? 0) - (data?.feesCollected ?? 0);
  const cards = [
    { icon: Users, label: "Pupils", value: data?.totalPupils ?? 0 },
    { icon: GraduationCap, label: "Staff", value: data?.totalStaff ?? 0 },
    { icon: ClipboardCheck, label: "Attendances (present)", value: data?.attendancePresent ?? 0 },
    { icon: UserPlus, label: "Admissions on file", value: data?.totalAdmissions ?? 0 },
    { icon: Wallet, label: "Fees collected", value: money(data?.feesCollected ?? 0) },
    { icon: Receipt, label: "Outstanding fees", value: money(outstanding) },
    { icon: Receipt, label: "Total expenses", value: money(data?.totalExpenses ?? 0) },
    { icon: BookOpen, label: "Library books", value: data?.libraryBooks ?? 0 },
    { icon: Boxes, label: "Active loans", value: data?.activeLoans ?? 0 },
    { icon: Bus, label: "Vehicles", value: data?.totalVehicles ?? 0 },
    { icon: HeartPulse, label: "Clinic visits", value: data?.clinicVisits ?? 0 },
  ];
  return (
    <>
      <PageHeader title="Reports" description="School-wide summary across every module" actions={
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => {
            const rows = [["Metric","Value"], ...cards.map((c) => [c.label, String(c.value)])];
            const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(",")).join("\n");
            const blob = new Blob([csv], { type: "text/csv" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a"); a.href = url; a.download = `school-report-${new Date().toISOString().slice(0,10)}.csv`; a.click(); URL.revokeObjectURL(url);
          }}><Download className="h-4 w-4 mr-1" /> Download CSV</Button>
          <Button onClick={() => window.print()}><Printer className="h-4 w-4 mr-1" /> Print</Button>
        </div>
      } />
      <div className="p-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <Card key={c.label}><CardContent className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">{c.label}</p>
              <c.icon className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-2xl font-semibold mt-1">{c.value}</p>
          </CardContent></Card>
        ))}
      </div>
    </>
  );
}