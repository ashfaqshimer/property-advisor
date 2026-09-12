"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import { AuthError, login } from "../../lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await login(email, password);
      router.replace("/admin");
    } catch (caught) {
      setError(caught instanceof AuthError ? caught.message : "Could not sign in.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f4f6f4] px-5 py-12 text-[#1a2923]">
      <form onSubmit={handleSubmit} className="w-full max-w-md rounded-xl border border-[#dce4df] bg-white p-8 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#718078]">Property Advisor</p>
        <h1 className="mt-3 text-2xl font-semibold">Sign in to admin</h1>
        <p className="mt-2 text-sm text-[#64736b]">Manage listings and review incoming leads.</p>
        <label className="mt-8 block text-sm font-medium" htmlFor="email">Email</label>
        <input id="email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} className="mt-2 w-full rounded-lg border border-[#cbd8d1] px-3 py-2.5 outline-none focus:border-[#28513f]" />
        <label className="mt-5 block text-sm font-medium" htmlFor="password">Password</label>
        <input id="password" type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} className="mt-2 w-full rounded-lg border border-[#cbd8d1] px-3 py-2.5 outline-none focus:border-[#28513f]" />
        {error && <p role="alert" className="mt-4 text-sm text-red-700">{error}</p>}
        <button type="submit" disabled={submitting} className="mt-7 w-full rounded-lg bg-[#19352b] px-4 py-3 text-sm font-semibold text-white disabled:cursor-wait disabled:opacity-60">
          {submitting ? "Signing in..." : "Sign in"}
        </button>
      </form>
    </main>
  );
}
