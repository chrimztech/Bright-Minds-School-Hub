import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Send } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/EmptyState";
import { useAuth, hasPermission } from "@/lib/auth";

export const Route = createFileRoute("/_authenticated/communication")({
  head: () => ({ meta: [{ title: "Communication" }] }),
  component: CommunicationPage,
});

function CommunicationPage() {
  const qc = useQueryClient();
  const { permissions } = useAuth();
  const canManage = hasPermission(permissions, "communication:manage");
  const [f, setF] = useState({ channel: "EMAIL", subject: "", body: "", audience: "ALL_PARENTS", classId: "" });
  const { data: classes = [] } = useQuery({ queryKey: ["classes-min"], queryFn: () => api.classes.list() });
  const { data: messages = [] } = useQuery({ queryKey: ["messages"], queryFn: () => api.communication.messages.list() });
  const send = useMutation({
    mutationFn: () => api.communication.messages.send({
      channel: f.channel, audience: f.audience,
      classId: f.classId || undefined, subject: f.subject, body: f.body,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["messages"] });
      toast.success("Sent");
      setF({ ...f, subject: "", body: "" });
    },
    onError: (e: any) => toast.error(e.message),
  });
  return (
    <>
      <PageHeader title="Communication" description="Announcements, SMS, email and WhatsApp templates" />
      <div className="p-6 grid gap-6 lg:grid-cols-2">
        <Card><CardContent className="p-6 space-y-3">
          <h3 className="font-semibold">Compose</h3>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Channel</Label>
              <Select value={f.channel} onValueChange={(v) => setF({ ...f, channel: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{["EMAIL","SMS","WHATSAPP","IN_APP"].map((c) => <SelectItem key={c} value={c}>{c.toLowerCase()}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Audience</Label>
              <Select value={f.audience} onValueChange={(v) => setF({ ...f, audience: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{["ALL_PARENTS","CLASS","STAFF","INDIVIDUAL"].map((a) => <SelectItem key={a} value={a}>{a.toLowerCase()}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          </div>
          {f.audience === "CLASS" && (
            <div><Label>Class</Label>
              <Select value={f.classId} onValueChange={(v) => setF({ ...f, classId: v })}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>{classes.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}{c.stream ? " " + c.stream : ""}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}
          <div><Label>Subject</Label><Input value={f.subject} onChange={(e) => setF({ ...f, subject: e.target.value })} /></div>
          <div><Label>Message</Label><Textarea rows={6} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} /></div>
          {canManage && <Button onClick={() => send.mutate()} disabled={!f.body}><Send className="h-4 w-4 mr-1" /> Send</Button>}
        </CardContent></Card>
        <Card><CardContent className="p-6 space-y-3">
          <h3 className="font-semibold">Recent messages</h3>
          <div className="rounded-lg border"><Table>
            <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Channel</TableHead><TableHead>Subject</TableHead><TableHead className="text-right">Recipients</TableHead></TableRow></TableHeader>
            <TableBody>
              {messages.length === 0 ? <TableRow><TableCell colSpan={4}><EmptyState /></TableCell></TableRow> : messages.map((m) => (
                <TableRow key={m.id}>
                  <TableCell>{new Date(m.sentAt).toLocaleDateString()}</TableCell>
                  <TableCell><Badge variant="secondary">{m.channel.toLowerCase()}</Badge></TableCell>
                  <TableCell className="max-w-[200px] truncate">{m.subject ?? m.body.slice(0,40)}</TableCell>
                  <TableCell className="text-right">{m.recipientCount ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table></div>
        </CardContent></Card>
      </div>
    </>
  );
}