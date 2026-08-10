import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, BookOpen, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/EmptyState";

export const Route = createFileRoute("/_authenticated/library")({
  head: () => ({ meta: [{ title: "Library" }] }),
  component: LibraryPage,
});

function LibraryPage() {
  return (
    <>
      <PageHeader title="Library" description="Books, borrowing and returns" />
      <div className="p-6">
        <Tabs defaultValue="books">
          <TabsList><TabsTrigger value="books">Books</TabsTrigger><TabsTrigger value="loans">Loans</TabsTrigger></TabsList>
          <TabsContent value="books"><Books /></TabsContent>
          <TabsContent value="loans"><Loans /></TabsContent>
        </Tabs>
      </div>
    </>
  );
}

function Books() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const { data = [] } = useQuery({ queryKey: ["books"], queryFn: () => api.library.books.list() });
  const create = useMutation({
    mutationFn: (f: any) => api.library.books.create(f),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["books"] }); toast.success("Book added"); setOpen(false); },
    onError: (e: any) => toast.error(e.message),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.library.books.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["books"] }); toast.success("Deleted"); },
    onError: (e: any) => toast.error(e.message),
  });
  return (
    <div className="space-y-3 mt-4">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" /> Add book</Button></DialogTrigger>
        <BookForm onSubmit={(f: any) => create.mutate(f)} />
      </Dialog>
      <div className="rounded-lg border bg-card"><Table>
        <TableHeader><TableRow><TableHead>ISBN</TableHead><TableHead>Title</TableHead><TableHead>Author</TableHead><TableHead>Category</TableHead><TableHead className="text-right">Available</TableHead><TableHead></TableHead></TableRow></TableHeader>
        <TableBody>
          {data.length === 0 ? <TableRow><TableCell colSpan={6}><EmptyState /></TableCell></TableRow> : data.map((b) => (
            <TableRow key={b.id}>
              <TableCell className="font-mono text-xs">{b.isbn ?? "—"}</TableCell>
              <TableCell className="font-medium flex items-center gap-2"><BookOpen className="h-4 w-4 text-muted-foreground" />{b.title}</TableCell>
              <TableCell>{b.author ?? "—"}</TableCell>
              <TableCell>{b.category ?? "—"}</TableCell>
              <TableCell className="text-right">{b.copiesAvailable} / {b.copiesTotal}</TableCell>
              <TableCell className="text-right"><Button variant="ghost" size="icon" onClick={() => { if (confirm(`Delete ${b.title}?`)) remove.mutate(b.id); }}><Trash2 className="h-4 w-4 text-destructive" /></Button></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table></div>
    </div>
  );
}

function BookForm({ onSubmit }: any) {
  const [f, setF] = useState({ isbn: "", title: "", author: "", category: "", shelf: "", copiesTotal: 1 });
  return (
    <DialogContent><DialogHeader><DialogTitle>New book</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div><Label>Title</Label><Input value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>ISBN</Label><Input value={f.isbn} onChange={(e) => setF({ ...f, isbn: e.target.value })} /></div>
          <div><Label>Author</Label><Input value={f.author} onChange={(e) => setF({ ...f, author: e.target.value })} /></div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div><Label>Category</Label><Input value={f.category} onChange={(e) => setF({ ...f, category: e.target.value })} /></div>
          <div><Label>Shelf</Label><Input value={f.shelf} onChange={(e) => setF({ ...f, shelf: e.target.value })} /></div>
          <div><Label>Copies</Label><Input type="number" value={f.copiesTotal} onChange={(e) => setF({ ...f, copiesTotal: Number(e.target.value) })} /></div>
        </div>
      </div>
      <DialogFooter><Button onClick={() => onSubmit(f)} disabled={!f.title}>Save</Button></DialogFooter>
    </DialogContent>
  );
}

function Loans() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const { data: books = [] } = useQuery({ queryKey: ["books-min"], queryFn: () => api.library.books.list() });
  const { data: pupils = [] } = useQuery({ queryKey: ["pupils-min"], queryFn: () => api.pupils.all() });
  const { data = [] } = useQuery({ queryKey: ["loans"], queryFn: () => api.library.loans.list() });
  const create = useMutation({
    mutationFn: (f: any) => api.library.loans.create(f),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["loans"] }); qc.invalidateQueries({ queryKey: ["books"] }); toast.success("Loan recorded"); setOpen(false); },
    onError: (e: any) => toast.error(e.message),
  });
  const ret = useMutation({
    mutationFn: (id: string) => api.library.loans.return(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["loans"] }); qc.invalidateQueries({ queryKey: ["books"] }); },
    onError: (e: any) => toast.error(e.message),
  });
  return (
    <div className="space-y-3 mt-4">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" /> New loan</Button></DialogTrigger>
        <LoanForm books={books} pupils={pupils} onSubmit={(f: any) => create.mutate(f)} />
      </Dialog>
      <div className="rounded-lg border bg-card"><Table>
        <TableHeader><TableRow><TableHead>Book</TableHead><TableHead>Pupil</TableHead><TableHead>Borrowed</TableHead><TableHead>Due</TableHead><TableHead>Status</TableHead><TableHead></TableHead></TableRow></TableHeader>
        <TableBody>
          {data.length === 0 ? <TableRow><TableCell colSpan={6}><EmptyState /></TableCell></TableRow> : data.map((l) => (
            <TableRow key={l.id}>
              <TableCell>{l.book?.title}</TableCell>
              <TableCell>{l.pupil?.fullName ?? "—"}</TableCell>
              <TableCell>{l.borrowedOn}</TableCell>
              <TableCell>{l.dueOn}</TableCell>
              <TableCell><Badge variant={l.status === "BORROWED" ? "secondary" : l.status === "OVERDUE" ? "destructive" : "default"}>{l.status.toLowerCase()}</Badge></TableCell>
              <TableCell>{l.status === "BORROWED" && <Button size="sm" variant="outline" onClick={() => ret.mutate(l.id)}><RotateCcw className="h-4 w-4 mr-1" /> Return</Button>}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table></div>
    </div>
  );
}

function LoanForm({ books, pupils, onSubmit }: any) {
  const [f, setF] = useState({ bookId: "", pupilId: "", borrowedOn: new Date().toISOString().slice(0, 10), dueOn: "" });
  return (
    <DialogContent><DialogHeader><DialogTitle>New loan</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div><Label>Book</Label>
          <Select value={f.bookId} onValueChange={(v) => setF({ ...f, bookId: v })}>
            <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
            <SelectContent>{books.filter((b: any) => b.copiesAvailable > 0).map((b: any) => <SelectItem key={b.id} value={b.id}>{b.title}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div><Label>Pupil</Label>
          <Select value={f.pupilId} onValueChange={(v) => setF({ ...f, pupilId: v })}>
            <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
            <SelectContent>{pupils.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.fullName}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Borrowed</Label><Input type="date" value={f.borrowedOn} onChange={(e) => setF({ ...f, borrowedOn: e.target.value })} /></div>
          <div><Label>Due</Label><Input type="date" value={f.dueOn} onChange={(e) => setF({ ...f, dueOn: e.target.value })} /></div>
        </div>
      </div>
      <DialogFooter><Button onClick={() => onSubmit(f)} disabled={!f.bookId || !f.pupilId || !f.dueOn}>Save</Button></DialogFooter>
    </DialogContent>
  );
}
