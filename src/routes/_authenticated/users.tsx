import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api, type SystemRole, type SystemPermission } from "@/lib/api";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Trash2, UserPlus, Eye, EyeOff, KeyRound, Plus, ShieldCheck, Lock } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/EmptyState";
import { useAuth, hasPermission } from "@/lib/auth";

const SYSTEM_ROLES = [
  "SUPER_ADMIN","HEAD_TEACHER","DEPUTY_HEAD","ADMIN",
  "ACCOUNTANT","TEACHER","CLASS_TEACHER","PARENT",
  "LIBRARIAN","STORE_OFFICER","TRANSPORT_OFFICER","NURSE","SECURITY",
];

function displayRole(r: string) {
  return r.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

export const Route = createFileRoute("/_authenticated/users")({
  head: () => ({ meta: [{ title: "Users, roles & permissions" }] }),
  component: UsersPage,
});

function UsersPage() {
  return (
    <>
      <PageHeader title="Users, roles & permissions" description="Manage user accounts, assign roles, configure permissions" />
      <div className="p-6">
        <Tabs defaultValue="users">
          <TabsList>
            <TabsTrigger value="users">Users</TabsTrigger>
            <TabsTrigger value="roles">Roles & Permissions</TabsTrigger>
          </TabsList>
          <TabsContent value="users"><UsersTab /></TabsContent>
          <TabsContent value="roles"><RolesTab /></TabsContent>
        </Tabs>
      </div>
    </>
  );
}

// ─── Users Tab ────────────────────────────────────────────────────────────────

function UsersTab() {
  const qc = useQueryClient();
  const { permissions } = useAuth();
  const canManage = hasPermission(permissions, "users:manage");
  const [open, setOpen] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [form, setForm] = useState({ fullName: "", email: "", password: "", role: "TEACHER" });
  const [resetting, setResetting] = useState<{ id: string; email: string } | null>(null);
  const [resetPw, setResetPw] = useState("");
  const [showResetPw, setShowResetPw] = useState(false);

  const { data: users = [] } = useQuery({ queryKey: ["users"], queryFn: () => api.users.list() });
  const { data: dbRoles = [] } = useQuery({ queryKey: ["roles"], queryFn: () => api.roles.list() });
  const allRoles = dbRoles.length > 0 ? dbRoles.map((r) => r.name) : SYSTEM_ROLES;

  const createUser = useMutation({
    mutationFn: () => api.users.create({ email: form.email, password: form.password, fullName: form.fullName, roles: [form.role] }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users"] });
      toast.success("User created — they will be prompted to change password on first login");
      setForm({ fullName: "", email: "", password: "", role: "TEACHER" });
      setOpen(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteUser = useMutation({
    mutationFn: (id: string) => api.users.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["users"] }); toast.success("User deleted"); },
    onError: (e: any) => toast.error(e.message),
  });

  const addRole = useMutation({
    mutationFn: ({ id, role, currentRoles }: { id: string; role: string; currentRoles: string[] }) =>
      api.users.updateRoles(id, [...new Set([...currentRoles, role])]),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["users"] }); toast.success("Role assigned"); },
    onError: (e: any) => toast.error(e.message),
  });

  const removeRole = useMutation({
    mutationFn: ({ id, role, currentRoles }: { id: string; role: string; currentRoles: string[] }) =>
      api.users.updateRoles(id, currentRoles.filter((r) => r !== role)),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["users"] }); toast.success("Role removed"); },
    onError: (e: any) => toast.error(e.message),
  });

  const resetPassword = useMutation({
    mutationFn: () => api.users.resetPassword(resetting!.id, resetPw),
    onSuccess: () => {
      toast.success("Password reset — user will be prompted to change it on next login.");
      setResetting(null); setResetPw(""); setShowResetPw(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-4 pt-4">
      {canManage && (
      <div className="flex justify-end">
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><UserPlus className="h-4 w-4 mr-1" /> New user</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Create user account</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>Full name</Label><Input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} /></div>
              <div><Label>Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
              <div>
                <Label>Temporary password</Label>
                <div className="relative">
                  <Input type={showPw ? "text" : "password"} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="pr-10" minLength={6} />
                  <button type="button" onClick={() => setShowPw((s) => !s)} className="absolute inset-y-0 right-0 px-3 text-muted-foreground hover:text-foreground">
                    {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div><Label>Initial role</Label>
                <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{allRoles.map((r) => <SelectItem key={r} value={r}>{displayRole(r)}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <Button className="w-full" disabled={!form.email || !form.password || !form.fullName || createUser.isPending} onClick={() => createUser.mutate()}>
                {createUser.isPending ? "Creating…" : "Create user"}
              </Button>
              <div className="rounded-lg border border-dashed bg-muted/40 p-3 text-xs flex gap-2">
                <Lock className="h-4 w-4 shrink-0 text-muted-foreground mt-0.5" />
                <p className="text-muted-foreground">The user will be prompted to set their own password on first login. Share the temporary password and email securely.</p>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
      )}

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Roles</TableHead>
              <TableHead>Add role</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.length === 0 ? <TableRow><TableCell colSpan={6}><EmptyState /></TableCell></TableRow> : users.map((u) => (
              <TableRow key={u.id}>
                <TableCell className="font-medium">{u.fullName ?? "—"}</TableCell>
                <TableCell>{u.email}</TableCell>
                <TableCell>
                  {u.mustChangePassword && <Badge variant="outline" className="text-amber-600 border-amber-400">Password change required</Badge>}
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {u.roles.length === 0
                      ? <span className="text-xs text-muted-foreground">No roles</span>
                      : u.roles.map((r) => (
                        <Badge key={r} variant="secondary" className="gap-1">
                          {displayRole(r)}
                          {canManage && (
                            <button onClick={() => removeRole.mutate({ id: u.id, role: r, currentRoles: u.roles })} className="hover:text-destructive ml-1">
                              <Trash2 className="h-3 w-3" />
                            </button>
                          )}
                        </Badge>
                      ))}
                  </div>
                </TableCell>
                <TableCell>
                  {canManage && (
                    <Select onValueChange={(v) => addRole.mutate({ id: u.id, role: v, currentRoles: u.roles })}>
                      <SelectTrigger className="h-8 w-44"><SelectValue placeholder="Assign role…" /></SelectTrigger>
                      <SelectContent>{allRoles.filter((r) => !u.roles.includes(r)).map((r) => <SelectItem key={r} value={r}>{displayRole(r)}</SelectItem>)}</SelectContent>
                    </Select>
                  )}
                </TableCell>
                <TableCell className="text-right flex gap-1 justify-end">
                  {canManage && (
                    <>
                      <Button size="icon" variant="ghost" onClick={() => { setResetting({ id: u.id, email: u.email }); setResetPw(""); }} title="Reset password">
                        <KeyRound className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => { if (confirm(`Delete ${u.email}? This cannot be undone.`)) deleteUser.mutate(u.id); }}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!resetting} onOpenChange={(o) => { if (!o) { setResetting(null); setResetPw(""); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reset password — {resetting?.email}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>New temporary password</Label>
              <div className="relative">
                <Input type={showResetPw ? "text" : "password"} value={resetPw} onChange={(e) => setResetPw(e.target.value)} className="pr-10" minLength={6} />
                <button type="button" onClick={() => setShowResetPw((s) => !s)} className="absolute inset-y-0 right-0 px-3 text-muted-foreground hover:text-foreground">
                  {showResetPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <Button className="w-full" disabled={resetPw.length < 6 || resetPassword.isPending} onClick={() => resetPassword.mutate()}>
              {resetPassword.isPending ? "Resetting…" : "Reset password"}
            </Button>
            <p className="text-xs text-muted-foreground">The user will be prompted to change this password on their next login.</p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Roles & Permissions Tab ──────────────────────────────────────────────────

function RolesTab() {
  const qc = useQueryClient();
  const { permissions: myPermissions } = useAuth();
  const canManage = hasPermission(myPermissions, "roles:manage");
  const [selectedRole, setSelectedRole] = useState<SystemRole | null>(null);
  const [newRoleName, setNewRoleName] = useState("");
  const [newRoleDesc, setNewRoleDesc] = useState("");
  const [newPermName, setNewPermName] = useState("");
  const [newPermModule, setNewPermModule] = useState("GENERAL");
  const [newPermDesc, setNewPermDesc] = useState("");

  const { data: roles = [] } = useQuery({ queryKey: ["roles"], queryFn: () => api.roles.list() });
  const { data: permissions = [] } = useQuery({ queryKey: ["permissions"], queryFn: () => api.roles.permissions.list() });

  const createRole = useMutation({
    mutationFn: () => api.roles.create({ name: newRoleName.toUpperCase().replace(/\s+/g, "_"), description: newRoleDesc }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["roles"] }); toast.success("Role created"); setNewRoleName(""); setNewRoleDesc(""); },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteRole = useMutation({
    mutationFn: (id: string) => api.roles.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["roles"] }); if (selectedRole) setSelectedRole(null); toast.success("Role deleted"); },
    onError: (e: any) => toast.error(e.message),
  });

  const createPermission = useMutation({
    mutationFn: () => api.roles.permissions.create({ name: newPermName, description: newPermDesc, module: newPermModule }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["permissions"] }); toast.success("Permission created"); setNewPermName(""); setNewPermDesc(""); },
    onError: (e: any) => toast.error(e.message),
  });

  const deletePermission = useMutation({
    mutationFn: (id: string) => api.roles.permissions.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["permissions"] }),
    onError: (e: any) => toast.error(e.message),
  });

  const setRolePerms = useMutation({
    mutationFn: ({ roleId, permIds }: { roleId: string; permIds: string[] }) =>
      api.roles.setPermissions(roleId, permIds),
    onSuccess: (updated) => {
      qc.invalidateQueries({ queryKey: ["roles"] });
      setSelectedRole(updated);
      toast.success("Permissions updated");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const permModules = [...new Set(permissions.map((p) => p.module))].sort();
  const rolePerms = new Set(selectedRole?.permissions.map((p) => p.id) ?? []);

  function togglePerm(permId: string) {
    if (!selectedRole) return;
    const next = rolePerms.has(permId)
      ? [...rolePerms].filter((x) => x !== permId)
      : [...rolePerms, permId];
    setRolePerms.mutate({ roleId: selectedRole.id, permIds: next });
  }

  return (
    <div className="grid lg:grid-cols-3 gap-6 pt-4">
      {/* Left: roles list */}
      <div className="space-y-3">
        <div className="rounded-lg border bg-card">
          <div className="p-3 border-b flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium text-sm">Roles</span>
          </div>
          <div className="divide-y">
            {roles.map((r) => (
              <div key={r.id}
                className={`flex items-center justify-between px-3 py-2.5 cursor-pointer hover:bg-muted/50 ${selectedRole?.id === r.id ? "bg-muted" : ""}`}
                onClick={() => setSelectedRole(r)}>
                <div>
                  <p className="text-sm font-medium">{displayRole(r.name)}</p>
                  {r.description && <p className="text-xs text-muted-foreground">{r.description}</p>}
                </div>
                <div className="flex items-center gap-2">
                  {r.isSystem && <Badge variant="outline" className="text-[10px] py-0">System</Badge>}
                  {!r.isSystem && canManage && (
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); if (confirm(`Delete role "${r.name}"?`)) deleteRole.mutate(r.id); }}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
          {canManage && (
            <div className="p-3 border-t space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Create custom role</p>
              <Input placeholder="Role name (e.g. LIBRARIAN_SENIOR)" value={newRoleName} onChange={(e) => setNewRoleName(e.target.value)} className="h-8 text-sm" />
              <Input placeholder="Description (optional)" value={newRoleDesc} onChange={(e) => setNewRoleDesc(e.target.value)} className="h-8 text-sm" />
              <Button size="sm" className="w-full" disabled={!newRoleName || createRole.isPending} onClick={() => createRole.mutate()}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Create role
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Middle: permissions for selected role */}
      <div className="space-y-3">
        {selectedRole ? (
          <div className="rounded-lg border bg-card">
            <div className="p-3 border-b">
              <p className="font-medium text-sm">{displayRole(selectedRole.name)} — permissions</p>
              <p className="text-xs text-muted-foreground mt-0.5">Check permissions to grant access. Changes save immediately.</p>
            </div>
            <div className="divide-y max-h-[60vh] overflow-auto">
              {permModules.map((mod) => (
                <div key={mod}>
                  <p className="px-3 py-1.5 text-[10px] uppercase tracking-widest text-muted-foreground bg-muted/40 font-medium">{mod}</p>
                  {permissions.filter((p) => p.module === mod).map((p) => (
                    <label key={p.id} className="flex items-start gap-3 px-3 py-2 hover:bg-muted/50 cursor-pointer">
                      <Checkbox
                        checked={rolePerms.has(p.id)}
                        onCheckedChange={() => togglePerm(p.id)}
                        disabled={!canManage || setRolePerms.isPending}
                        className="mt-0.5"
                      />
                      <div>
                        <p className="text-sm font-mono">{p.name}</p>
                        {p.description && <p className="text-xs text-muted-foreground">{p.description}</p>}
                      </div>
                    </label>
                  ))}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">
            Select a role on the left to manage its permissions.
          </div>
        )}
      </div>

      {/* Right: permissions registry */}
      <div className="space-y-3">
        <div className="rounded-lg border bg-card">
          <div className="p-3 border-b flex items-center gap-2">
            <Lock className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium text-sm">All permissions</span>
          </div>
          <div className="divide-y max-h-96 overflow-auto">
            {permModules.map((mod) => (
              <div key={mod}>
                <p className="px-3 py-1 text-[10px] uppercase tracking-widest text-muted-foreground bg-muted/40">{mod}</p>
                {permissions.filter((p) => p.module === mod).map((p) => (
                  <div key={p.id} className="flex items-center justify-between px-3 py-2 hover:bg-muted/50">
                    <div>
                      <p className="text-xs font-mono">{p.name}</p>
                      {p.description && <p className="text-[11px] text-muted-foreground">{p.description}</p>}
                    </div>
                    {canManage && (
                      <Button size="icon" variant="ghost" className="h-6 w-6 shrink-0"
                        onClick={() => { if (confirm(`Delete permission "${p.name}"?`)) deletePermission.mutate(p.id); }}>
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>
          {canManage && (
            <div className="p-3 border-t space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Add custom permission</p>
              <Input placeholder="module:action (e.g. canteen:manage)" value={newPermName} onChange={(e) => setNewPermName(e.target.value)} className="h-8 text-sm font-mono" />
              <Input placeholder="Description" value={newPermDesc} onChange={(e) => setNewPermDesc(e.target.value)} className="h-8 text-sm" />
              <Select value={newPermModule} onValueChange={setNewPermModule}>
                <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[...permModules, "GENERAL"].filter((v, i, a) => a.indexOf(v) === i).sort().map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                  <SelectItem value="CUSTOM">CUSTOM</SelectItem>
                </SelectContent>
              </Select>
              <Button size="sm" className="w-full" disabled={!newPermName || createPermission.isPending} onClick={() => createPermission.mutate()}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Add permission
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
