'use client';

import { FormEvent, useEffect, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { createAgent, getStaffUsers, StaffUser, updateAgent } from '@/lib/api';
import { Spinner } from '@/components/ui/spinner';

export default function AdminUsersPage() {
  const [users, setUsers] = useState<StaffUser[]>([]);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getStaffUsers().then(setUsers).catch((reason) => setError(reason instanceof Error ? reason.message : 'Could not load users.')).finally(() => setLoading(false));
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const user = await createAgent(name, email, password);
      setUsers((current) => [...current, user]);
      setEmail('');
      setName('');
      setPassword('');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not create agent.');
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
        <p className="text-sm font-medium text-[#75847c]">Access management</p>
        <h2 className="mt-1 text-3xl font-semibold tracking-tight">Users</h2>
        <p className="mt-2 text-sm text-[#75847c]">Create and manage agent access to the workspace.</p>
      </div>
      {error && <p className="mb-4 text-sm text-[#a34d4d]">{error}</p>}
      <form onSubmit={submit} className="mb-8 flex flex-col items-stretch gap-4 rounded-xl border border-[#dce4df] bg-white p-6 shadow-sm sm:flex-row sm:flex-wrap sm:items-end">
        <label className="flex-1 min-w-48 text-sm font-medium">Agent name<input required value={name} onChange={(event) => setName(event.target.value)} className="mt-2 w-full rounded-lg border border-[#d7e0da] px-3.5 py-3 text-sm" /></label>
        <label className="flex-1 min-w-48 text-sm font-medium">Agent email<input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="mt-2 w-full rounded-lg border border-[#d7e0da] px-3.5 py-3 text-sm" /></label>
        <div className="flex-1 min-w-48">
          <label className="text-sm font-medium">Temporary password</label>
          <div className="relative mt-2">
            <input required minLength={8} type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} className="w-full rounded-lg border border-[#d7e0da] px-3.5 py-3 pr-10 text-sm" />
            <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#718078] hover:text-[#1a2923] focus:outline-none" aria-label={showPassword ? "Hide password" : "Show password"}>
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>
        <button type="submit" disabled={saving} className="rounded-lg bg-[#28513f] px-5 py-3 text-sm font-semibold text-white disabled:opacity-60">{saving ? <Spinner className="mx-auto h-4 w-4" /> : 'Create agent'}</button>
      </form>
      <div className="overflow-hidden rounded-xl border border-[#dce4df] bg-white shadow-sm">
        {loading ? <div className="flex min-h-32 items-center justify-center"><Spinner className="h-5 w-5 text-[#28513f]" /></div> : (
          <>
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-[#f8faf8] text-xs uppercase tracking-[0.12em] text-[#7a8780]">
                  <tr><th className="px-5 py-4">Name</th><th className="px-4 py-4">Email</th><th className="px-4 py-4">Role</th><th className="px-4 py-4">Status</th><th className="px-5 py-4 text-right">Actions</th></tr>
                </thead>
                <tbody className="divide-y divide-[#edf0ee]">
                  {users.map((user) => <tr key={user.id}><td className="px-5 py-4 font-medium">{user.name}</td><td className="px-4 py-4">{user.email}</td><td className="px-4 py-4">{user.role}</td><td className="px-4 py-4">{user.is_active ? 'Active' : 'Inactive'}</td><td className="px-5 py-4 text-right">{user.role === 'agent' && <button type="button" onClick={() => toggleActive(user)} className="text-xs font-semibold text-[#35664f] hover:underline">{user.is_active ? 'Disable' : 'Enable'}</button>}</td></tr>)}
                </tbody>
              </table>
            </div>
            <div className="flex flex-col divide-y divide-[#edf0ee] sm:hidden">
              {users.map((user) => (
                <div key={user.id} className="flex flex-col gap-2 p-5">
                  <div className="flex items-start justify-between gap-4">
                    <span className="font-semibold leading-tight text-[#253a30]">{user.name}</span>
                    <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${user.is_active ? 'bg-[#e0f1e7] text-[#28704b]' : 'bg-[#e9e9ea] text-[#62666b]'}`}>{user.is_active ? 'Active' : 'Inactive'}</span>
                  </div>
                  <div className="text-sm text-[#65736b]">{user.email}</div>
                  <div className="mt-2 flex items-center justify-between border-t border-[#edf0ee] pt-4">
                    <span className="text-xs font-semibold uppercase tracking-wider text-[#8a968f]">{user.role}</span>
                    {user.role === 'agent' && (
                      <button type="button" onClick={() => toggleActive(user)} className="text-xs font-semibold text-[#35664f] hover:underline">
                        {user.is_active ? 'Disable' : 'Enable'}
                      </button>
                    )}
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