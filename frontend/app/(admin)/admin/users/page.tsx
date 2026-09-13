'use client';

import { FormEvent, useEffect, useState } from 'react';
import { createAgent, getStaffUsers, StaffUser, updateAgent } from '@/lib/api';
import { Spinner } from '@/components/ui/spinner';

export default function AdminUsersPage() {
  const [users, setUsers] = useState<StaffUser[]>([]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
      const user = await createAgent(email, password);
      setUsers((current) => [...current, user]);
      setEmail('');
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
      <form onSubmit={submit} className="mb-8 grid gap-4 rounded-xl border border-[#dce4df] bg-white p-6 shadow-sm sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <label className="text-sm font-medium">Agent email<input required type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="mt-2 w-full rounded-lg border border-[#d7e0da] px-3.5 py-3 text-sm" /></label>
        <label className="text-sm font-medium">Temporary password<input required minLength={8} type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="mt-2 w-full rounded-lg border border-[#d7e0da] px-3.5 py-3 text-sm" /></label>
        <button type="submit" disabled={saving} className="rounded-lg bg-[#28513f] px-5 py-3 text-sm font-semibold text-white disabled:opacity-60">{saving ? <Spinner className="mx-auto h-4 w-4" /> : 'Create agent'}</button>
      </form>
      <div className="overflow-hidden rounded-xl border border-[#dce4df] bg-white shadow-sm">
        {loading ? <div className="flex min-h-32 items-center justify-center"><Spinner className="h-5 w-5 text-[#28513f]" /></div> : <table className="w-full text-left text-sm"><thead className="bg-[#f8faf8] text-xs uppercase tracking-[0.12em] text-[#7a8780]"><tr><th className="px-5 py-4">Email</th><th className="px-4 py-4">Role</th><th className="px-4 py-4">Status</th><th className="px-5 py-4 text-right">Actions</th></tr></thead><tbody className="divide-y divide-[#edf0ee]">{users.map((user) => <tr key={user.id}><td className="px-5 py-4 font-medium">{user.email}</td><td className="px-4 py-4">{user.role}</td><td className="px-4 py-4">{user.is_active ? 'Active' : 'Inactive'}</td><td className="px-5 py-4 text-right">{user.role === 'agent' && <button type="button" onClick={() => toggleActive(user)} className="text-xs font-semibold text-[#35664f] hover:underline">{user.is_active ? 'Disable' : 'Enable'}</button>}</td></tr>)}</tbody></table>}
      </div>
    </section>
  );
}