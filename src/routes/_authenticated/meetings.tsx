import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api, type PtcMeeting, type PtcSession } from "@/lib/api";
import { useAuth, ADMIN_ROLES, hasAny } from "@/lib/auth";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Pencil, CalendarDays, Clock, MapPin, CheckCircle2, XCircle, AlertCircle, Users } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/EmptyState";
import { usePagination } from "@/hooks/use-pagination";
import { PaginationBar } from "@/components/PaginationBar";

export const Route = createFileRoute("/_authenticated/meetings")({
  head: () => ({ meta: [{ title: "PTC Meetings" }] }),
  component: MeetingsPage,
});

// ─── Status helpers ───────────────────────────────────────────────────────────
const STATUSES = ["SCHEDULED", "CONFIRMED", "COMPLETED", "CANCELLED", "NO_SHOW"] as const;
type MeetingStatus = (typeof STATUSES)[number];

const STATUS_META: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: any }> = {
  SCHEDULED:  { label: "Scheduled",  variant: "secondary",  icon: Clock },
  CONFIRMED:  { label: "Confirmed",  variant: "default",    icon: CheckCircle2 },
  COMPLETED:  { label: "Completed",  variant: "outline",    icon: CheckCircle2 },
  CANCELLED:  { label: "Cancelled",  variant: "destructive",icon: XCircle },
  NO_SHOW:    { label: "No show",    variant: "destructive",icon: AlertCircle },
};

function StatusBadge({ status }: { status: string }) {
  const m = STATUS_META[status] ?? STATUS_META.SCHEDULED;
  return <Badge variant={m.variant}>{m.label}</Badge>;
}

// ─── Page ─────────────────────────────────────────────────────────────────────
function MeetingsPage() {
  const { roles } = useAuth();
  const isAdmin = hasAny(roles, ADMIN_ROLES);
  const isTeacher = roles.includes("TEACHER") && !isAdmin;
  const isParent = roles.includes("PARENT") && !isAdmin && !isTeacher;

  return (
    <>
      <PageHeader
        title="Parent-Teacher Meetings"
        description={isParent ? "Your scheduled appointments with teachers" : isTeacher ? "Your scheduled parent meetings" : "Manage PTC sessions and individual meeting slots"}
      />
      <div className="p-6">
        {isParent && <ParentView />}
        {isTeacher && <TeacherView />}
        {isAdmin && (
          <Tabs defaultValue="sessions">
            <TabsList className="mb-5">
              <TabsTrigger value="sessions"><CalendarDays className="h-3.5 w-3.5 mr-1.5" />PTC Sessions</TabsTrigger>
              <TabsTrigger value="meetings"><Users className="h-3.5 w-3.5 mr-1.5" />All Meetings</TabsTrigger>
            </TabsList>
            <TabsContent value="sessions"><SessionsTab /></TabsContent>
            <TabsContent value="meetings"><AdminMeetingsTab /></TabsContent>
          </Tabs>
        )}
      </div>
    </>
  );
}

// ─── Parent view ──────────────────────────────────────────────────────────────
function ParentView() {
  const { data: meetings = [], isLoading } = useQuery({
    queryKey: ["ptc-me"],
    queryFn: () => api.ptc.meetings.me(),
  });

  const upcoming = meetings.filter(m => m.meetingDate >= new Date().toISOString().slice(0, 10));
  const past = meetings.filter(m => m.meetingDate < new Date().toISOString().slice(0, 10));

  if (isLoading) return <div className="text-muted-foreground text-sm">Loading…</div>;

  return (
    <div className="space-y-6">
      {meetings.length === 0 && (
        <Card><CardContent className="p-10 text-center">
          <CalendarDays className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <p className="font-semibold">No meetings scheduled</p>
          <p className="text-sm text-muted-foreground mt-1">The school will notify you when a parent-teacher meeting is arranged for your child.</p>
        </CardContent></Card>
      )}
      {upcoming.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">Upcoming</h3>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {upcoming.map(m => <MeetingCard key={m.id} meeting={m} showPupil />)}
          </div>
        </div>
      )}
      {past.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">Past meetings</h3>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {past.map(m => <MeetingCard key={m.id} meeting={m} showPupil />)}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Teacher view ─────────────────────────────────────────────────────────────
function TeacherView() {
  const qc = useQueryClient();
  const { data: meetings = [], isLoading } = useQuery({
    queryKey: ["ptc-my"],
    queryFn: () => api.ptc.meetings.my(),
  });

  const [editId, setEditId] = useState<string | null>(null);
  const [editNotes, setEditNotes] = useState("");
  const [editStatus, setEditStatus] = useState("");

  const save = useMutation({
    mutationFn: () => api.ptc.meetings.update(editId!, { status: editStatus || undefined, teacherNotes: editNotes || undefined }),
    onSuccess: () => { toast.success("Meeting updated"); qc.invalidateQueries({ queryKey: ["ptc-my"] }); setEditId(null); },
    onError: (e: any) => toast.error(e.message),
  });

  const today = new Date().toISOString().slice(0, 10);
  const upcoming = meetings.filter(m => m.meetingDate >= today);
  const past = meetings.filter(m => m.meetingDate < today);

  if (isLoading) return <div className="text-muted-foreground text-sm">Loading…</div>;

  return (
    <div className="space-y-6">
      {meetings.length === 0 && (
        <Card><CardContent className="p-10 text-center">
          <CalendarDays className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <p className="font-semibold">No meetings assigned</p>
          <p className="text-sm text-muted-foreground mt-1">Ask an administrator to schedule parent meetings for you.</p>
        </CardContent></Card>
      )}
      {upcoming.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">Upcoming ({upcoming.length})</h3>
          <div className="rounded-lg border bg-card overflow-hidden">
            <Table>
              <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Time</TableHead><TableHead>Parent</TableHead><TableHead>Pupil</TableHead><TableHead>Venue</TableHead><TableHead>Status</TableHead><TableHead>Actions</TableHead></TableRow></TableHeader>
              <TableBody>
                {upcoming.map(m => (
                  <TableRow key={m.id}>
                    <TableCell>{m.meetingDate}</TableCell>
                    <TableCell className="font-mono text-xs">{m.startTime}{m.endTime ? `–${m.endTime}` : ""}</TableCell>
                    <TableCell className="font-medium">{m.guardian.fullName}<br /><span className="text-xs text-muted-foreground">{m.guardian.phone}</span></TableCell>
                    <TableCell>{m.pupil?.fullName ?? "—"}</TableCell>
                    <TableCell>{m.venue ?? (m.session?.venue ?? "—")}</TableCell>
                    <TableCell><StatusBadge status={m.status} /></TableCell>
                    <TableCell>
                      <Button size="sm" variant="outline" onClick={() => { setEditId(m.id); setEditNotes(m.teacherNotes ?? ""); setEditStatus(m.status); }}>
                        <Pencil className="h-3.5 w-3.5 mr-1" />Notes
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
      {past.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">Past meetings</h3>
          <div className="rounded-lg border bg-card overflow-hidden">
            <Table>
              <TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Parent</TableHead><TableHead>Pupil</TableHead><TableHead>Status</TableHead><TableHead>Notes</TableHead></TableRow></TableHeader>
              <TableBody>
                {past.map(m => (
                  <TableRow key={m.id}>
                    <TableCell>{m.meetingDate}</TableCell>
                    <TableCell className="font-medium">{m.guardian.fullName}</TableCell>
                    <TableCell>{m.pupil?.fullName ?? "—"}</TableCell>
                    <TableCell><StatusBadge status={m.status} /></TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-xs truncate">{m.teacherNotes ?? "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* Edit notes dialog */}
      <Dialog open={!!editId} onOpenChange={(o) => !o && setEditId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Update meeting</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Status</Label>
              <Select value={editStatus} onValueChange={setEditStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{STATUSES.map(s => <SelectItem key={s} value={s}>{STATUS_META[s].label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Notes from this meeting</Label>
              <Textarea rows={4} placeholder="What was discussed, follow-up actions…" value={editNotes} onChange={e => setEditNotes(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditId(null)}>Cancel</Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending}>{save.isPending ? "Saving…" : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Admin: Sessions tab ──────────────────────────────────────────────────────
function SessionsTab() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editSession, setEditSession] = useState<PtcSession | null>(null);
  const [form, setForm] = useState({ title: "", sessionDate: "", venue: "", description: "", startTime: "", endTime: "", termId: "" });

  const { data: sessions = [] } = useQuery({ queryKey: ["ptc-sessions"], queryFn: () => api.ptc.sessions.list() });
  const { data: terms = [] } = useQuery({ queryKey: ["terms-all"], queryFn: () => api.academicYears.terms.all() });

  function resetForm() { setForm({ title: "", sessionDate: "", venue: "", description: "", startTime: "", endTime: "", termId: "" }); setEditSession(null); }

  const save = useMutation({
    mutationFn: () => {
      const payload = { ...form, termId: form.termId || undefined, startTime: form.startTime || undefined, endTime: form.endTime || undefined };
      return editSession ? api.ptc.sessions.update(editSession.id, payload) : api.ptc.sessions.create(payload);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["ptc-sessions"] }); toast.success(editSession ? "Session updated" : "Session created"); setOpen(false); resetForm(); },
    onError: (e: any) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.ptc.sessions.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["ptc-sessions"] }); toast.success("Session deleted"); },
    onError: (e: any) => toast.error(e.message),
  });

  function openEdit(s: PtcSession) {
    setEditSession(s);
    setForm({ title: s.title, sessionDate: s.sessionDate, venue: s.venue ?? "", description: s.description ?? "", startTime: s.startTime ?? "", endTime: s.endTime ?? "", termId: s.term?.id ?? "" });
    setOpen(true);
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Dialog open={open} onOpenChange={(o) => { if (!o) resetForm(); setOpen(o); }}>
          <DialogTrigger asChild>
            <Button><Plus className="h-4 w-4 mr-1" />New PTC session</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>{editSession ? "Edit PTC session" : "New PTC session"}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Session title</Label>
                <Input placeholder="e.g. Term 1 Parent-Teacher Meeting 2026" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Date</Label><Input type="date" value={form.sessionDate} onChange={e => setForm({ ...form, sessionDate: e.target.value })} /></div>
                <div><Label>Term (optional)</Label>
                  <Select value={form.termId} onValueChange={v => setForm({ ...form, termId: v })}>
                    <SelectTrigger><SelectValue placeholder="No term" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">— No term —</SelectItem>
                      {terms.map(t => <SelectItem key={t.id} value={t.id}>{t.name}{t.academicYear ? ` — ${t.academicYear.name}` : ""}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Start time</Label><Input type="time" value={form.startTime} onChange={e => setForm({ ...form, startTime: e.target.value })} /></div>
                <div><Label>End time</Label><Input type="time" value={form.endTime} onChange={e => setForm({ ...form, endTime: e.target.value })} /></div>
              </div>
              <div><Label>Venue</Label><Input placeholder="Main hall, classrooms…" value={form.venue} onChange={e => setForm({ ...form, venue: e.target.value })} /></div>
              <div><Label>Description / agenda</Label><Textarea rows={3} placeholder="Overall agenda for this PTC session…" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setOpen(false); resetForm(); }}>Cancel</Button>
              <Button onClick={() => save.mutate()} disabled={!form.title || !form.sessionDate || save.isPending}>{save.isPending ? "Saving…" : "Save"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {sessions.length === 0 && <EmptyState message="No PTC sessions yet. Create one to start scheduling meetings." />}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {sessions.map(s => (
          <Card key={s.id} className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-2">
                <CardTitle className="text-base leading-snug">{s.title}</CardTitle>
                <div className="flex gap-1 shrink-0">
                  <Button size="icon" variant="ghost" onClick={() => openEdit(s)}><Pencil className="h-3.5 w-3.5" /></Button>
                  <Button size="icon" variant="ghost" onClick={() => { if (confirm(`Delete "${s.title}"?`)) remove.mutate(s.id); }}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground"><CalendarDays className="h-3.5 w-3.5 shrink-0" />{s.sessionDate}</div>
              {(s.startTime || s.endTime) && <div className="flex items-center gap-2 text-muted-foreground"><Clock className="h-3.5 w-3.5 shrink-0" />{s.startTime ?? ""}{s.startTime && s.endTime ? " – " : ""}{s.endTime ?? ""}</div>}
              {s.venue && <div className="flex items-center gap-2 text-muted-foreground"><MapPin className="h-3.5 w-3.5 shrink-0" />{s.venue}</div>}
              {s.term && <Badge variant="secondary" className="text-xs">{s.term.name}{s.term.academicYear ? ` — ${s.term.academicYear.name}` : ""}</Badge>}
              {s.description && <p className="text-xs text-muted-foreground pt-1 line-clamp-2">{s.description}</p>}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ─── Admin: All meetings tab ───────────────────────────────────────────────────
function AdminMeetingsTab() {
  const qc = useQueryClient();
  const [sessionFilter, setSessionFilter] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [editMeeting, setEditMeeting] = useState<PtcMeeting | null>(null);

  const { data: sessions = [] } = useQuery({ queryKey: ["ptc-sessions"], queryFn: () => api.ptc.sessions.list() });
  const { data: meetings = [] } = useQuery({
    queryKey: ["ptc-meetings", sessionFilter],
    queryFn: () => api.ptc.meetings.list(sessionFilter || undefined),
  });
  const { data: teachers = [] } = useQuery({ queryKey: ["staff-teachers"], queryFn: () => api.staff.teachers() });
  const { data: guardians = [] } = useQuery({ queryKey: ["guardians-all"], queryFn: () => api.guardians.list() });
  const { data: pupils = [] } = useQuery({ queryKey: ["pupils-all"], queryFn: () => api.pupils.all() });
  const { pageItems: pagedMeetings, page, setPage, totalPages, pageSize, total } = usePagination(meetings, 25, sessionFilter);

  const [f, setF] = useState({ sessionId: "", staffId: "", guardianId: "", pupilId: "", meetingDate: "", startTime: "", endTime: "", venue: "", agenda: "" });

  const create = useMutation({
    mutationFn: () => api.ptc.meetings.create({
      sessionId: f.sessionId || undefined,
      staffId: f.staffId,
      guardianId: f.guardianId,
      pupilId: f.pupilId || undefined,
      meetingDate: f.meetingDate,
      startTime: f.startTime,
      endTime: f.endTime || undefined,
      venue: f.venue || undefined,
      agenda: f.agenda || undefined,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ptc-meetings"] });
      toast.success("Meeting scheduled");
      setAddOpen(false);
      setF({ sessionId: "", staffId: "", guardianId: "", pupilId: "", meetingDate: "", startTime: "", endTime: "", venue: "", agenda: "" });
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Edit state
  const [editStatus, setEditStatus] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editAdminNotes, setEditAdminNotes] = useState("");

  const updateMeeting = useMutation({
    mutationFn: () => api.ptc.meetings.update(editMeeting!.id, {
      status: editStatus || undefined,
      teacherNotes: editNotes || undefined,
      adminNotes: editAdminNotes || undefined,
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["ptc-meetings"] }); toast.success("Meeting updated"); setEditMeeting(null); },
    onError: (e: any) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.ptc.meetings.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["ptc-meetings"] }); toast.success("Meeting removed"); },
    onError: (e: any) => toast.error(e.message),
  });

  function openEdit(m: PtcMeeting) {
    setEditMeeting(m);
    setEditStatus(m.status);
    setEditNotes(m.teacherNotes ?? "");
    setEditAdminNotes(m.adminNotes ?? "");
  }

  const counts = STATUSES.reduce((acc, s) => { acc[s] = meetings.filter(m => m.status === s).length; return acc; }, {} as Record<string, number>);

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-wrap gap-3 items-end justify-between">
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <Label className="text-xs text-muted-foreground">Filter by session</Label>
            <Select value={sessionFilter} onValueChange={setSessionFilter}>
              <SelectTrigger className="w-72"><SelectValue placeholder="All sessions" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="">All sessions</SelectItem>
                {sessions.map(s => <SelectItem key={s.id} value={s.id}>{s.title} — {s.sessionDate}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {sessionFilter && <Button variant="ghost" size="sm" onClick={() => setSessionFilter("")}>Clear</Button>}
          <span className="text-sm text-muted-foreground self-end">{meetings.length} meeting{meetings.length !== 1 ? "s" : ""}</span>
        </div>
        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" />Schedule meeting</Button></DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>Schedule a meeting</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>PTC Session (optional)</Label>
                <Select value={f.sessionId} onValueChange={v => setF({ ...f, sessionId: v })}>
                  <SelectTrigger><SelectValue placeholder="Standalone meeting" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">— Standalone —</SelectItem>
                    {sessions.map(s => <SelectItem key={s.id} value={s.id}>{s.title} — {s.sessionDate}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>Teacher</Label>
                <Select value={f.staffId} onValueChange={v => setF({ ...f, staffId: v })}>
                  <SelectTrigger><SelectValue placeholder="Select teacher" /></SelectTrigger>
                  <SelectContent>{teachers.map(s => <SelectItem key={s.id} value={s.id}>{s.fullName}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Parent / Guardian</Label>
                <Select value={f.guardianId} onValueChange={v => {
                  const g = guardians.find(x => x.id === v);
                  setF({ ...f, guardianId: v });
                }}>
                  <SelectTrigger><SelectValue placeholder="Select parent" /></SelectTrigger>
                  <SelectContent>{guardians.map(g => <SelectItem key={g.id} value={g.id}>{g.fullName}{g.phone ? ` (${g.phone})` : ""}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Pupil (optional)</Label>
                <Select value={f.pupilId} onValueChange={v => setF({ ...f, pupilId: v })}>
                  <SelectTrigger><SelectValue placeholder="Select pupil" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">— Not specified —</SelectItem>
                    {pupils.map(p => <SelectItem key={p.id} value={p.id}>{p.fullName} — {p.admissionNo}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div><Label>Date</Label><Input type="date" value={f.meetingDate} onChange={e => setF({ ...f, meetingDate: e.target.value })} /></div>
                <div><Label>Start time</Label><Input type="time" value={f.startTime} onChange={e => setF({ ...f, startTime: e.target.value })} /></div>
                <div><Label>End time</Label><Input type="time" value={f.endTime} onChange={e => setF({ ...f, endTime: e.target.value })} /></div>
              </div>
              <div><Label>Venue</Label><Input placeholder="Room 4, Headmaster's office…" value={f.venue} onChange={e => setF({ ...f, venue: e.target.value })} /></div>
              <div><Label>Agenda / notes</Label><Textarea rows={2} placeholder="Topics to be discussed…" value={f.agenda} onChange={e => setF({ ...f, agenda: e.target.value })} /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button>
              <Button onClick={() => create.mutate()} disabled={!f.staffId || !f.guardianId || !f.meetingDate || !f.startTime || create.isPending}>
                {create.isPending ? "Saving…" : "Schedule"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Status summary */}
      {meetings.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {STATUSES.map(s => counts[s] > 0 && (
            <Badge key={s} variant={STATUS_META[s].variant}>{STATUS_META[s].label}: {counts[s]}</Badge>
          ))}
        </div>
      )}

      {/* Meetings table */}
      {meetings.length === 0
        ? <EmptyState message="No meetings found. Schedule individual meeting slots or create a PTC session first." />
        : (
          <div className="rounded-lg border bg-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead>Date & time</TableHead>
                  <TableHead>Teacher</TableHead>
                  <TableHead>Parent</TableHead>
                  <TableHead>Pupil</TableHead>
                  <TableHead>Venue</TableHead>
                  <TableHead>Session</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pagedMeetings.map(m => (
                  <TableRow key={m.id}>
                    <TableCell>
                      <p className="font-medium">{m.meetingDate}</p>
                      <p className="text-xs text-muted-foreground font-mono">{m.startTime}{m.endTime ? ` – ${m.endTime}` : ""}</p>
                    </TableCell>
                    <TableCell className="font-medium">{m.staff.fullName}</TableCell>
                    <TableCell>
                      <p>{m.guardian.fullName}</p>
                      {m.guardian.phone && <p className="text-xs text-muted-foreground">{m.guardian.phone}</p>}
                    </TableCell>
                    <TableCell>{m.pupil ? <span>{m.pupil.fullName}<br /><span className="text-xs text-muted-foreground">{m.pupil.admissionNo}</span></span> : <span className="text-muted-foreground text-xs">—</span>}</TableCell>
                    <TableCell className="text-sm">{m.venue ?? (m.session?.venue ?? <span className="text-muted-foreground">—</span>)}</TableCell>
                    <TableCell className="text-xs">{m.session ? <Badge variant="secondary">{m.session.title}</Badge> : <span className="text-muted-foreground">Standalone</span>}</TableCell>
                    <TableCell><StatusBadge status={m.status} /></TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="icon" variant="ghost" onClick={() => openEdit(m)}><Pencil className="h-3.5 w-3.5" /></Button>
                        <Button size="icon" variant="ghost" onClick={() => { if (confirm("Remove this meeting?")) remove.mutate(m.id); }}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      {meetings.length > 0 && (
        <PaginationBar page={page} totalPages={totalPages} total={total} pageSize={pageSize} onPageChange={setPage} />
      )}

      {/* Edit dialog */}
      <Dialog open={!!editMeeting} onOpenChange={o => !o && setEditMeeting(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Update meeting</DialogTitle></DialogHeader>
          {editMeeting && (
            <div className="space-y-1 text-sm mb-3 border rounded-lg p-3 bg-muted/30">
              <p><span className="text-muted-foreground">Teacher: </span><strong>{editMeeting.staff.fullName}</strong></p>
              <p><span className="text-muted-foreground">Parent: </span><strong>{editMeeting.guardian.fullName}</strong></p>
              {editMeeting.pupil && <p><span className="text-muted-foreground">Pupil: </span>{editMeeting.pupil.fullName}</p>}
              <p><span className="text-muted-foreground">Date: </span>{editMeeting.meetingDate} at {editMeeting.startTime}</p>
            </div>
          )}
          <div className="space-y-3">
            <div><Label>Status</Label>
              <Select value={editStatus} onValueChange={setEditStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{STATUSES.map(s => <SelectItem key={s} value={s}>{STATUS_META[s].label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label>Teacher's notes</Label>
              <Textarea rows={3} placeholder="Discussion points, observations…" value={editNotes} onChange={e => setEditNotes(e.target.value)} />
            </div>
            <div><Label>Admin notes</Label>
              <Textarea rows={2} placeholder="Internal notes…" value={editAdminNotes} onChange={e => setEditAdminNotes(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditMeeting(null)}>Cancel</Button>
            <Button onClick={() => updateMeeting.mutate()} disabled={updateMeeting.isPending}>{updateMeeting.isPending ? "Saving…" : "Save"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Meeting card (used in parent / teacher quick views) ──────────────────────
function MeetingCard({ meeting: m, showPupil }: { meeting: PtcMeeting; showPupil?: boolean }) {
  const today = new Date().toISOString().slice(0, 10);
  const isUpcoming = m.meetingDate >= today;
  return (
    <Card className={isUpcoming ? "border-primary/30" : undefined}>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-semibold">{m.staff.fullName}</p>
            <p className="text-xs text-muted-foreground">Teacher</p>
          </div>
          <StatusBadge status={m.status} />
        </div>
        <div className="space-y-1.5 text-sm">
          <div className="flex items-center gap-2 text-muted-foreground"><CalendarDays className="h-3.5 w-3.5 shrink-0" />{m.meetingDate}</div>
          <div className="flex items-center gap-2 text-muted-foreground"><Clock className="h-3.5 w-3.5 shrink-0" />{m.startTime}{m.endTime ? ` – ${m.endTime}` : ""}</div>
          {(m.venue ?? m.session?.venue) && <div className="flex items-center gap-2 text-muted-foreground"><MapPin className="h-3.5 w-3.5 shrink-0" />{m.venue ?? m.session?.venue}</div>}
        </div>
        {showPupil && m.pupil && <div className="text-xs text-muted-foreground border-t pt-2">Regarding: <span className="font-medium text-foreground">{m.pupil.fullName}</span></div>}
        {m.session && <Badge variant="outline" className="text-xs">{m.session.title}</Badge>}
        {m.agenda && <p className="text-xs text-muted-foreground border-t pt-2 line-clamp-2">{m.agenda}</p>}
        {m.teacherNotes && <div className="text-xs border-t pt-2"><span className="text-muted-foreground">Notes: </span>{m.teacherNotes}</div>}
      </CardContent>
    </Card>
  );
}
