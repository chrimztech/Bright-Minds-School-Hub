import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, DatabaseBackup } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/backup")({
  head: () => ({ meta: [{ title: "System backup" }] }),
  component: BackupPage,
});

function BackupPage() {
  const [busy, setBusy] = useState(false);
  const [last, setLast] = useState<{ at: string; tables: number; rows: number } | null>(null);

  async function download(kind: "json" | "csv") {
    setBusy(true);
    try {
      const dump = await api.admin.backup();
      const tables = dump.tables as Record<string, any[]> | undefined ?? dump as Record<string, any[]>;
      const total = Object.values(tables).reduce((s, arr) => s + (Array.isArray(arr) ? arr.length : 0), 0);
      const stamp = new Date().toISOString().replace(/[:.]/g, "-");
      if (kind === "json") {
        const blob = new Blob([JSON.stringify(dump, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a"); a.href = url; a.download = `school-backup-${stamp}.json`; a.click(); URL.revokeObjectURL(url);
      } else {
        const parts: string[] = [];
        Object.entries(tables).forEach(([t, rows]) => {
          parts.push(`## ${t}`);
          if (!Array.isArray(rows) || rows.length === 0) { parts.push(""); return; }
          const cols = Object.keys(rows[0]);
          parts.push(cols.join(","));
          rows.forEach((r: any) => parts.push(cols.map((c) => {
            const v = r[c]; const s = v == null ? "" : typeof v === "object" ? JSON.stringify(v) : String(v);
            return `"${s.replace(/"/g, '""')}"`;
          }).join(",")));
          parts.push("");
        });
        const blob = new Blob([parts.join("\n")], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a"); a.href = url; a.download = `school-backup-${stamp}.csv`; a.click(); URL.revokeObjectURL(url);
      }
      setLast({ at: new Date().toLocaleString(), tables: Object.keys(tables).length, rows: total });
      toast.success("Backup downloaded");
    } catch (err: any) {
      toast.error(err.message ?? "Backup failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader title="System backup" description="Download a snapshot of every record in the system" />
      <div className="p-6 max-w-3xl">
        <Card>
          <CardHeader><CardTitle className="font-display text-xl flex items-center gap-2"><DatabaseBackup className="h-5 w-5" /> Full database snapshot</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">Backups include pupils, staff, parents, classes, attendance, fees, payments, marks, payroll, library, transport, health, discipline, communications and more. Save backups in a safe place — they contain personal information.</p>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => download("json")} disabled={busy}><Download className="h-4 w-4 mr-1" /> {busy ? "Preparing…" : "Download JSON"}</Button>
              <Button variant="outline" onClick={() => download("csv")} disabled={busy}><Download className="h-4 w-4 mr-1" /> Download CSV</Button>
            </div>
            {last && (
              <div className="rounded-lg border bg-muted/30 p-3 text-sm">
                <p className="font-medium">Last backup</p>
                <p className="text-muted-foreground">{last.at} · {last.tables} tables · {last.rows.toLocaleString()} rows</p>
              </div>
            )}
            <p className="text-xs text-muted-foreground">For best practice, schedule a weekly backup and store off-site.</p>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
