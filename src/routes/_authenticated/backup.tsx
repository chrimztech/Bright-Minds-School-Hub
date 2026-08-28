import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Download, DatabaseBackup, Upload, TriangleAlert, History } from "lucide-react";
import { toast } from "sonner";
import { useAuth, hasPermission } from "@/lib/auth";
import { EmptyState } from "@/components/EmptyState";

export const Route = createFileRoute("/_authenticated/backup")({
  head: () => ({ meta: [{ title: "System backup" }] }),
  component: BackupPage,
});

function BackupPage() {
  const { permissions } = useAuth();
  const canRestore = hasPermission(permissions, "backup:restore");
  const [fullBusy, setFullBusy] = useState(false);
  const [sqlBusy, setSqlBusy] = useState(false);
  const [busy, setBusy] = useState(false);
  const [lastFull, setLastFull] = useState<string | null>(null);
  const [lastSql, setLastSql] = useState<string | null>(null);
  const [last, setLast] = useState<{ at: string; tables: number; rows: number } | null>(null);

  async function downloadFull() {
    setFullBusy(true);
    try {
      const { blob, filename } = await api.admin.backupFull();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      setLastFull(new Date().toLocaleString());
      toast.success("Full backup downloaded — database and every uploaded file");
    } catch (err: any) {
      toast.error(err.message ?? "Backup failed");
    } finally {
      setFullBusy(false);
    }
  }

  async function downloadSql() {
    setSqlBusy(true);
    try {
      const { blob, filename } = await api.admin.backupSql();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      setLastSql(new Date().toLocaleString());
      toast.success("Database-only SQL backup downloaded");
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
      const tables =
        (dump.tables as Record<string, any[]> | undefined) ?? (dump as Record<string, any[]>);
      const total = Object.values(tables).reduce(
        (s, arr) => s + (Array.isArray(arr) ? arr.length : 0),
        0,
      );
      const stamp = new Date().toISOString().replace(/[:.]/g, "-");
      if (kind === "json") {
        const blob = new Blob([JSON.stringify(dump, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `school-export-${stamp}.json`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        const parts: string[] = [];
        Object.entries(tables).forEach(([t, rows]) => {
          parts.push(`## ${t}`);
          if (!Array.isArray(rows) || rows.length === 0) {
            parts.push("");
            return;
          }
          const cols = Object.keys(rows[0]);
          parts.push(cols.join(","));
          rows.forEach((r: any) =>
            parts.push(
              cols
                .map((c) => {
                  const v = r[c];
                  const s = v == null ? "" : typeof v === "object" ? JSON.stringify(v) : String(v);
                  return `"${s.replace(/"/g, '""')}"`;
                })
                .join(","),
            ),
          );
          parts.push("");
        });
        const blob = new Blob([parts.join("\n")], { type: "text/csv" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `school-export-${stamp}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      }
      setLast({ at: new Date().toLocaleString(), tables: Object.keys(tables).length, rows: total });
      toast.success("Export downloaded");
    } catch (err: any) {
      toast.error(err.message ?? "Export failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        title="System backup"
        description="Back up and restore everything — database and uploaded files"
      />
      <div className="p-6 max-w-3xl space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="font-display text-xl flex items-center gap-2">
              <DatabaseBackup className="h-5 w-5" /> Full system backup
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              The one file to keep for disaster recovery — every table and record in the database,
              plus every uploaded file (staff photos and signatures, pupil documents, hero images,
              and more), bundled into a single archive. This same file can be uploaded below to
              fully restore the system. Save it somewhere safe — it contains personal information.
            </p>
            <Button onClick={downloadFull} disabled={fullBusy}>
              <Download className="h-4 w-4 mr-1" />{" "}
              {fullBusy ? "Preparing…" : "Download full backup"}
            </Button>
            {lastFull && (
              <div className="rounded-lg border bg-muted/30 p-3 text-sm">
                <p className="font-medium">Last full backup</p>
                <p className="text-muted-foreground">{lastFull}</p>
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              For best practice, schedule a weekly backup and store a copy off-site.
            </p>
          </CardContent>
        </Card>

        <ScheduledBackupsCard />

        {canRestore && <RestoreCard />}

        <Card>
          <CardHeader>
            <CardTitle className="font-display text-lg">Database-only SQL</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Just the raw database dump, without uploaded files — useful if you're restoring with
              your own
              <code className="font-mono"> psql -f backup.sql</code> command rather than the full
              backup above.
            </p>
            <Button variant="outline" onClick={downloadSql} disabled={sqlBusy}>
              <Download className="h-4 w-4 mr-1" /> {sqlBusy ? "Preparing…" : "Download SQL only"}
            </Button>
            {lastSql && (
              <div className="rounded-lg border bg-muted/30 p-3 text-sm">
                <p className="font-medium">Last SQL-only backup</p>
                <p className="text-muted-foreground">{lastSql}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-display text-lg">Records export</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              A human-readable export of core records (pupils, staff, classes, attendance, fees,
              marks, library, and more) as JSON or CSV — handy for reporting, not a substitute for
              the full backup above.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => download("json")} disabled={busy}>
                <Download className="h-4 w-4 mr-1" /> {busy ? "Preparing…" : "Download JSON"}
              </Button>
              <Button variant="outline" onClick={() => download("csv")} disabled={busy}>
                <Download className="h-4 w-4 mr-1" /> Download CSV
              </Button>
            </div>
            {last && (
              <div className="rounded-lg border bg-muted/30 p-3 text-sm">
                <p className="font-medium">Last export</p>
                <p className="text-muted-foreground">
                  {last.at} · {last.tables} tables · {last.rows.toLocaleString()} rows
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function ScheduledBackupsCard() {
  const [downloading, setDownloading] = useState<string | null>(null);
  const { data: snapshots, isLoading } = useQuery({
    queryKey: ["admin", "backup", "scheduled"],
    queryFn: api.admin.listScheduledBackups,
  });

  async function handleDownload(filename: string) {
    setDownloading(filename);
    try {
      const blob = await api.admin.downloadScheduledBackup(filename);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      toast.error(err.message ?? "Download failed");
    } finally {
      setDownloading(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-display text-lg flex items-center gap-2">
          <History className="h-5 w-5" /> Automatic backups
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Snapshots the system takes on its own — a full backup every night, plus a safety copy
          saved automatically right before any restore overwrites the system. The newest {14} are
          kept; older ones are pruned automatically.
        </p>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : !snapshots || snapshots.length === 0 ? (
          <EmptyState
            icon={History}
            message="No automatic snapshots yet"
            description="The first nightly backup runs at 02:00. A safety snapshot also appears here right before any restore."
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>File</TableHead>
                  <TableHead>Taken</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {snapshots.map((s) => (
                  <TableRow key={s.filename}>
                    <TableCell className="font-mono text-xs">
                      {s.filename}
                      {s.filename.startsWith("pre-restore") && (
                        <Badge variant="outline" className="ml-2">
                          safety net
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(s.createdAt).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatBytes(s.sizeBytes)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={downloading === s.filename}
                        onClick={() => handleDownload(s.filename)}
                      >
                        <Download className="h-3.5 w-3.5 mr-1" />
                        {downloading === s.filename ? "Preparing…" : "Download"}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

const CONFIRM_PHRASE = "RESTORE";

function RestoreCard() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [confirmText, setConfirmText] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{
    filesRestored: number;
    restoredAt: string;
    safetyBackup: string;
  } | null>(null);

  async function doRestore() {
    if (!file) return;
    setBusy(true);
    try {
      const res = await api.admin.restoreBackup(file);
      setResult(res);
      setConfirmText("");
      setFile(null);
      if (inputRef.current) inputRef.current.value = "";
      toast.success(`Restored ${res.filesRestored} file(s) — restart the backend now`, {
        duration: 10000,
      });
    } catch (err: any) {
      toast.error(err.message ?? "Restore failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="border-destructive/40">
      <CardHeader>
        <CardTitle className="font-display text-xl flex items-center gap-2 text-destructive">
          <TriangleAlert className="h-5 w-5" /> Restore from backup
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Uploads a full backup archive (from "Download full backup" above) and replaces{" "}
          <strong className="text-foreground">everything currently in the system</strong> — every
          record and every uploaded file — with what's in the archive. This cannot be undone. Take a
          fresh full backup first if there's anything since your last one you'd want to keep.
        </p>
        <div>
          <Label>Backup file (.zip)</Label>
          <input
            ref={inputRef}
            type="file"
            accept=".zip"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="mt-1.5 block w-full text-sm file:mr-3 file:rounded-md file:border file:bg-card file:px-3 file:py-1.5 file:text-sm"
          />
        </div>
        {file && (
          <div>
            <Label>
              Type <span className="font-mono font-bold">{CONFIRM_PHRASE}</span> to confirm
            </Label>
            <Input
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              className="mt-1.5"
              placeholder={CONFIRM_PHRASE}
            />
          </div>
        )}
        <Button
          variant="destructive"
          disabled={!file || confirmText !== CONFIRM_PHRASE || busy}
          onClick={doRestore}
        >
          <Upload className="h-4 w-4 mr-1" />{" "}
          {busy ? "Restoring… this can take a few minutes" : "Restore system from this file"}
        </Button>
        {result && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm">
            <p className="font-medium">
              Restore complete — {result.filesRestored.toLocaleString()} file(s) restored
            </p>
            <p className="text-muted-foreground">{new Date(result.restoredAt).toLocaleString()}</p>
            <p className="text-muted-foreground">
              Safety snapshot of what was overwritten:{" "}
              <span className="font-mono text-xs">{result.safetyBackup}</span> (under Automatic
              backups above)
            </p>
            <p className="mt-1 font-medium text-destructive">
              Restart the backend now so every service picks up the restored data cleanly.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
