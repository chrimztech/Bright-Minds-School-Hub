import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Mail, MailOpen, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/EmptyState";
import { useAuth, hasPermission } from "@/lib/auth";
import { usePagination } from "@/hooks/use-pagination";
import { PaginationBar } from "@/components/PaginationBar";

export const Route = createFileRoute("/_authenticated/inquiries")({
  head: () => ({ meta: [{ title: "Inquiries" }] }),
  component: InquiriesPage,
});

function InquiriesPage() {
  const qc = useQueryClient();
  const { permissions } = useAuth();
  const canManage = hasPermission(permissions, "inquiries:manage");
  const { data = [] } = useQuery({ queryKey: ["inquiries"], queryFn: () => api.inquiries.list() });
  const { pageItems: pagedInquiries, page, setPage, totalPages, pageSize, total } = usePagination(data, 25);

  const markRead = useMutation({
    mutationFn: (id: string) => api.inquiries.markRead(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["inquiries"] }),
    onError: (e: any) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.inquiries.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["inquiries"] }); toast.success("Deleted"); },
    onError: (e: any) => toast.error(e.message),
  });

  const unreadCount = data.filter((i) => !i.read).length;

  return (
    <>
      <PageHeader
        title="Inquiries"
        description="Messages submitted through the public website's Inquiries form"
      />
      <div className="p-6 space-y-3">
        {unreadCount > 0 && (
          <p className="text-sm text-muted-foreground">
            <Badge variant="secondary" className="mr-1.5">{unreadCount}</Badge>
            unread {unreadCount === 1 ? "inquiry" : "inquiries"}
          </p>
        )}
        <div className="rounded-lg border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10" />
                <TableHead>Name</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Message</TableHead>
                <TableHead>Received</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.length === 0 ? (
                <TableRow><TableCell colSpan={6}><EmptyState message="No inquiries yet." /></TableCell></TableRow>
              ) : (
                pagedInquiries.map((i) => (
                  <TableRow key={i.id} className={!i.read ? "bg-primary/[0.03]" : undefined}>
                    <TableCell>
                      {i.read ? <MailOpen className="h-4 w-4 text-muted-foreground" /> : <Mail className="h-4 w-4 text-primary" />}
                    </TableCell>
                    <TableCell className="font-medium">{i.fullName}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {i.email && <p>{i.email}</p>}
                      {i.phone && <p>{i.phone}</p>}
                      {!i.email && !i.phone && "—"}
                    </TableCell>
                    <TableCell className="max-w-[360px] whitespace-pre-wrap text-sm">{i.message}</TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(i.createdAt).toLocaleString(undefined, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      {canManage && !i.read && (
                        <Button size="sm" variant="ghost" onClick={() => markRead.mutate(i.id)}>Mark read</Button>
                      )}
                      {canManage && (
                        <Button size="icon" variant="ghost" onClick={() => { if (confirm(`Delete this inquiry from ${i.fullName}?`)) remove.mutate(i.id); }}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
        <PaginationBar page={page} totalPages={totalPages} total={total} pageSize={pageSize} onPageChange={setPage} />
      </div>
    </>
  );
}
