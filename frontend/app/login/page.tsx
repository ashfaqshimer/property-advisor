"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";

import { AuthError, login } from "../../lib/api";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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
    <main className="flex min-h-screen items-center justify-center bg-[#f4f6f4] dark:bg-black px-5 py-12 text-[#1a2923] dark:text-zinc-100">
      <form onSubmit={handleSubmit} className="w-full max-w-md rounded-xl border border-[#dce4df] dark:border-zinc-800 bg-white dark:bg-zinc-950 p-8 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#718078] dark:text-zinc-400">Property Advisor</p>
        <h1 className="mt-3 text-2xl font-semibold">Sign in to admin</h1>
        <p className="mt-2 text-sm text-[#64736b] dark:text-zinc-400">Manage listings and review incoming leads.</p>
        <label className="mt-8 block text-sm font-medium" htmlFor="email">Email</label>
        <input id="email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} className="mt-2 w-full rounded-lg border border-[#cbd8d1] dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2.5 outline-none focus:border-[#28513f] dark:focus:border-[#436c58]" />
        <label className="mt-5 block text-sm font-medium" htmlFor="password">Password</label>
        <div className="relative mt-2">
          <input id="password" type={showPassword ? "text" : "password"} autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} className="w-full rounded-lg border border-[#cbd8d1] dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2.5 pr-10 outline-none focus:border-[#28513f] dark:focus:border-[#436c58]" />
          <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#718078] dark:text-zinc-400 hover:text-[#1a2923] dark:hover:text-zinc-200 focus:outline-none" aria-label={showPassword ? "Hide password" : "Show password"}>
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {error && <p role="alert" className="mt-4 text-sm text-red-700">{error}</p>}
        <button type="submit" disabled={submitting} className="mt-7 w-full rounded-lg bg-[#19352b] dark:bg-zinc-100 px-4 py-3 text-sm font-semibold text-white dark:text-zinc-900 transition-colors hover:bg-[#132820] dark:hover:bg-white disabled:cursor-wait disabled:opacity-60">
          {submitting ? "Signing in..." : "Sign in"}
        </button>
      </form>
    </main>
  );
}
