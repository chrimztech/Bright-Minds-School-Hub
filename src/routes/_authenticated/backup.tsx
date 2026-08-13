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
  const [sqlBusy, setSqlBusy] = useState(false);
  const [last, setLast] = useState<{ at: string; tables: number; rows: number } | null>(null);
  const [lastSql, setLastSql] = useState<string | null>(null);

  async function downloadSql() {
    setSqlBusy(true);
    try {
      const { blob, filename } = await api.admin.backupSql();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url);
      setLastSql(new Date().toLocaleString());
      toast.success("Full database backup downloaded");
    } catch (err: any) {
      toast.error(err.message ?? "Backup failed");
    } finally {
      setSqlBusy(false);
    }
  }

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
      <div className="p-6 max-w-3xl space-y-6">
        <Card>
          <CardHeader><CardTitle className="font-display text-xl flex items-center gap-2"><DatabaseBackup className="h-5 w-5" /> Full database backup</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              A complete, restorable SQL dump of the entire database — every table, not just the ones listed below.
              This is the file to keep for disaster recovery; restore it with <code className="font-mono">psql -f backup.sql</code>.
              Save it in a safe place — it contains personal information.
            </p>
            <Button onClick={downloadSql} disabled={sqlBusy}><Download className="h-4 w-4 mr-1" /> {sqlBusy ? "Preparing…" : "Download full SQL backup"}</Button>
            {lastSql && (
              <div className="rounded-lg border bg-muted/30 p-3 text-sm">
                <p className="font-medium">Last full backup</p>
                <p className="text-muted-foreground">{lastSql}</p>
              </div>
            )}
            <p className="text-xs text-muted-foreground">For best practice, schedule a weekly backup and store off-site.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="font-display text-lg">Records export</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              A human-readable export of core records (pupils, staff, classes, attendance, fees, marks, library, and more) as JSON or CSV — handy for reporting, not a substitute for the full backup above.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => download("json")} disabled={busy}><Download className="h-4 w-4 mr-1" /> {busy ? "Preparing…" : "Download JSON"}</Button>
              <Button variant="outline" onClick={() => download("csv")} disabled={busy}><Download className="h-4 w-4 mr-1" /> Download CSV</Button>
            </div>
            {last && (
              <div className="rounded-lg border bg-muted/30 p-3 text-sm">
                <p className="font-medium">Last export</p>
                <p className="text-muted-foreground">{last.at} · {last.tables} tables · {last.rows.toLocaleString()} rows</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
