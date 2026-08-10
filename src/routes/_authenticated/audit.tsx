import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/EmptyState";
import { ChevronLeft, ChevronRight } from "lucide-react";

export const Route = createFileRoute("/_authenticated/audit")({
  head: () => ({ meta: [{ title: "Audit log" }] }),
  component: AuditPage,
});

const ENTITIES = ["", "AppUser", "Role", "FeeItem", "Invoice", "Payment", "Pupil", "Staff", "Attendance"];

const ACTION_COLORS: Record<string, string> = {
  LOGIN: "default",
  CREATE_USER: "secondary",
  DELETE_USER: "destructive",
  RESET_PASSWORD: "outline",
  UPDATE_ROLES: "secondary",
  CREATE_ROLE: "secondary",
  DELETE_ROLE: "destructive",
};

function actionBadge(action: string) {
  const variant = (ACTION_COLORS[action] ?? "outline") as any;
  return <Badge variant={variant}>{action.replace(/_/g, " ")}</Badge>;
}

function AuditPage() {
  const [page, setPage] = useState(0);
  const [entity, setEntity] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["audit", page, entity],
    queryFn: () => api.audit.list(page, 50, entity || undefined),
    placeholderData: (prev) => prev,
  });

  const logs = data?.content ?? [];
  const totalPages = data?.totalPages ?? 1;

  return (
    <>
      <PageHeader title="Audit log" description="Track every significant action performed in the system" />
      <div className="p-6 space-y-4">
        <div className="flex items-center gap-3">
          <Select value={entity} onValueChange={(v) => { setEntity(v); setPage(0); }}>
            <SelectTrigger className="w-52"><SelectValue placeholder="Filter by entity…" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="">All entities</SelectItem>
              {ENTITIES.filter(Boolean).map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}
            </SelectContent>
          </Select>
          {data && <span className="text-sm text-muted-foreground">{data.totalElements} events</span>}
        </div>

        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Entity</TableHead>
                <TableHead>Entity ID</TableHead>
                <TableHead>Details</TableHead>
                <TableHead>User ID</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Loading…</TableCell></TableRow>
              ) : logs.length === 0 ? (
                <TableRow><TableCell colSpan={6}><EmptyState message="No audit events found." /></TableCell></TableRow>
              ) : logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(log.createdAt).toLocaleString()}
                  </TableCell>
                  <TableCell>{actionBadge(log.action)}</TableCell>
                  <TableCell className="font-mono text-xs">{log.entity ?? "—"}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{log.entityId ? log.entityId.substring(0, 8) + "…" : "—"}</TableCell>
                  <TableCell className="text-xs max-w-xs truncate">{log.details ?? "—"}</TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">{log.userId ? log.userId.substring(0, 8) + "…" : "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between">
            <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
              <ChevronLeft className="h-4 w-4 mr-1" /> Previous
            </Button>
            <span className="text-sm text-muted-foreground">Page {page + 1} of {totalPages}</span>
            <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage((p) => p + 1)}>
              Next <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        )}
      </div>
    </>
  );
}
