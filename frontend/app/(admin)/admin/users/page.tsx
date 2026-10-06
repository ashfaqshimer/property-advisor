'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Pencil, UserCheck, UserX, UserPlus, Save, X } from 'lucide-react';
import { createAgent, getStaffUsers, StaffUser, updateAgent, getCurrentUser, AuthUser } from '@/lib/api';
import { Spinner } from '@/components/ui/spinner';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export default function AdminUsersPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [users, setUsers] = useState<StaffUser[]>([]);
  const [editingUser, setEditingUser] = useState<StaffUser | null>(null);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<string>('agent');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getCurrentUser()
      .then((u) => {
        if (!u || !["root", "admin"].includes(u.role)) {
          router.replace("/admin");
          return;
        }
        setCurrentUser(u);
      })
      .catch(() => {
        router.replace("/admin");
      });
    getStaffUsers()
      .then(setUsers)
      .catch((reason) => setError(reason instanceof Error ? reason.message : 'Could not load users.'))
      .finally(() => setLoading(false));
  }, [router]);

  function startEditing(user: StaffUser) {
    setEditingUser(user);
    setName(user.name);
    setEmail(user.email);
    setRole(user.role);
    setPassword('');
  }

  function cancelEditing() {
    setEditingUser(null);
    setName('');
    setEmail('');
    setRole('agent');
    setPassword('');
    setError('');
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      if (editingUser) {
        const payload: { name?: string; email?: string; role?: "root" | "admin" | "agent"; password?: string } = {
          name,
          email,
          role: role as "root" | "admin" | "agent",
        };
        if (password) payload.password = password;
        
        const updated = await updateAgent(editingUser.id, payload);
        setUsers((current) => current.map((item) => item.id === updated.id ? updated : item));
        cancelEditing();
      } else {
        const user = await createAgent(name, email, password, role as "admin" | "agent");
        setUsers((current) => [...current, user]);
        cancelEditing();
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : `Could not ${editingUser ? 'update' : 'create'} user.`);
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(user: StaffUser) {
    try {
      const updated = await updateAgent(user.id, { is_active: !user.is_active });
      setUsers((current) => current.map((item) => item.id === updated.id ? updated : item));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not update agent.');
    }
  }

  return (
    <section className="mx-auto max-w-[1000px]">
      <div className="mb-8">
        <p className="text-sm font-medium text-muted-foreground">Access management</p>
        <h2 className="mt-1 text-3xl font-semibold tracking-tight text-foreground">Users</h2>
        <p className="mt-2 text-sm text-muted-foreground">Create and manage agent access to the workspace.</p>
      </div>
      {error && <p className="mb-4 text-sm text-destructive">{error}</p>}
      <form onSubmit={submit} className="mb-8 flex flex-col items-stretch gap-4 rounded-xl border border-border bg-card p-6 shadow-xs sm:flex-row sm:flex-wrap sm:items-end">
        <label className="flex-1 min-w-48 text-sm font-medium text-foreground">
          Name
          <Input required value={name} onChange={(event) => setName(event.target.value)} className="mt-2" />
        </label>
        <label className="flex-1 min-w-48 text-sm font-medium text-foreground">
          Email
          <Input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="mt-2" />
        </label>
        <label className="flex-1 min-w-32 text-sm font-medium text-foreground">
          Role
          <Select value={role} onChange={(event) => setRole(event.target.value)} className="mt-2" disabled={editingUser?.role === 'root'}>
            <option value="agent">Agent</option>
            <option value="admin">Admin</option>
            {editingUser?.role === 'root' && <option value="root">Root</option>}
          </Select>
        </label>
        <div className="flex-1 min-w-48">
          <label className="text-sm font-medium text-foreground">{editingUser ? 'New password (optional)' : 'Temporary password'}</label>
          <div className="relative mt-2">
            <Input required={!editingUser} minLength={8} type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} className="pr-10" placeholder={editingUser ? "Leave blank to keep current" : ""} />
            <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus:outline-none cursor-pointer" aria-label={showPassword ? "Hide password" : "Show password"}>
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>
        <div className="flex gap-2">
          {editingUser && (
            <Button type="button" variant="outline" onClick={cancelEditing} className="gap-1.5">
              <X className="h-4 w-4" />
              Cancel
            </Button>
          )}
          <Button type="submit" disabled={saving} className="gap-2">
            {saving ? (
              <Spinner className="mx-auto h-4 w-4" />
            ) : editingUser ? (
              <>
                <Save className="h-4 w-4" />
                Save changes
              </>
            ) : (
              <>
                <UserPlus className="h-4 w-4" />
                Create agent
              </>
            )}
          </Button>
        </div>
      </form>
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
        {loading ? (
          <div className="flex min-h-32 items-center justify-center">
            <Spinner className="h-5 w-5 text-primary" />
          </div>
        ) : (
          <>
            <div className="hidden sm:block overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead className="px-5 py-4 font-semibold">Name</TableHead>
                    <TableHead className="px-4 py-4 font-semibold">Email</TableHead>
                    <TableHead className="px-4 py-4 font-semibold">Role</TableHead>
                    <TableHead className="px-4 py-4 font-semibold">Status</TableHead>
                    <TableHead className="px-5 py-4 text-right font-semibold">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-border">
                  {users.map((user) => (
                    <TableRow key={user.id} className="transition hover:bg-muted/50">
                      <TableCell className="px-5 py-4 font-medium text-foreground">{user.name}</TableCell>
                      <TableCell className="px-4 py-4 text-muted-foreground">{user.email}</TableCell>
                      <TableCell className="px-4 py-4">
                        <Badge variant="outline" className="capitalize text-xs font-semibold">
                          {user.role}
                        </Badge>
                      </TableCell>
                      <TableCell className="px-4 py-4">
                        <Badge variant={user.is_active ? "success" : "secondary"} className="capitalize">
                          {user.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </TableCell>
                      <TableCell className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {currentUser?.role === 'root' && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => startEditing(user)}
                              className="h-8 gap-1.5 px-2.5 text-xs font-semibold text-primary hover:bg-primary/10 hover:text-primary cursor-pointer"
                            >
                              <Pencil className="h-3.5 w-3.5" />
                              Edit
                            </Button>
                          )}
                          {user.role !== 'root' && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => toggleActive(user)}
                              className={`h-8 gap-1.5 px-2.5 text-xs font-semibold cursor-pointer ${
                                user.is_active
                                  ? 'text-destructive hover:bg-destructive/10 hover:text-destructive'
                                  : 'text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-600 dark:hover:text-emerald-300'
                              }`}
                            >
                              {user.is_active ? (
                                <>
                                  <UserX className="h-3.5 w-3.5" />
                                  Disable
                                </>
                              ) : (
                                <>
                                  <UserCheck className="h-3.5 w-3.5" />
                                  Enable
                                </>
                              )}
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="flex flex-col divide-y divide-border sm:hidden">
              {users.map((user) => (
                <div key={user.id} className="flex flex-col gap-2 p-5">
                  <div className="flex items-start justify-between gap-4">
                    <span className="font-semibold leading-tight text-foreground">{user.name}</span>
                    <Badge variant={user.is_active ? "success" : "secondary"} className="shrink-0 capitalize">
                      {user.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                  <div className="text-sm text-muted-foreground">{user.email}</div>
                  <div className="mt-2 flex items-center justify-between border-t border-border pt-4">
                    <Badge variant="outline" className="text-xs uppercase tracking-wider font-semibold">
                      {user.role}
                    </Badge>
                    <div className="flex items-center gap-2">
                      {currentUser?.role === 'root' && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => startEditing(user)}
                          className="h-8 gap-1 px-2 text-xs font-semibold text-primary hover:bg-primary/10 hover:text-primary cursor-pointer"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          Edit
                        </Button>
                      )}
                      {user.role !== 'root' && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleActive(user)}
                          className={`h-8 gap-1 px-2 text-xs font-semibold cursor-pointer ${
                            user.is_active
                              ? 'text-destructive hover:bg-destructive/10 hover:text-destructive'
                              : 'text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-600 dark:hover:text-emerald-300'
                          }`}
                        >
                          {user.is_active ? (
                            <>
                              <UserX className="h-3.5 w-3.5" />
                              Disable
                            </>
                          ) : (
                            <>
                              <UserCheck className="h-3.5 w-3.5" />
                              Enable
                            </>
                          )}
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
}