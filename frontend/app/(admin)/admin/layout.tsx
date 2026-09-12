"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { AuthUser, getCurrentUser, logout } from "../../../lib/api";

const navigation = [
  { label: "Properties", href: "/admin" },
  { label: "Leads", href: "/admin/leads" },
  { label: "Settings", href: "#", disabled: true },
];

export default function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    getCurrentUser()
      .then((currentUser) => {
        if (!currentUser) router.replace("/login");
        else setUser(currentUser);
      })
      .catch(() => router.replace("/login"))
      .finally(() => setCheckingAuth(false));
  }, [router]);

  async function handleLogout() {
    await logout();
    router.replace("/login");
  }

  if (checkingAuth || !user) {
    return <main className="flex min-h-screen items-center justify-center bg-[#f4f6f4] text-sm text-[#64736b]">Checking access...</main>;
  }

  return (
    <div className="min-h-screen bg-[#f4f6f4] text-[#1a2923]">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-[#dce4df] bg-[#19352b] text-white lg:flex lg:flex-col">
        <div className="border-b border-white/10 px-7 py-7"><Link href="/admin" className="text-xl font-semibold tracking-tight">Property Advisor</Link><p className="mt-1 text-xs uppercase tracking-[0.18em] text-[#a8c0b4]">Admin workspace</p></div>
        <nav aria-label="Admin navigation" className="space-y-1 px-4 py-7">
          {navigation.map((item) => item.disabled ? <span key={item.label} aria-disabled="true" className="block cursor-not-allowed rounded-lg px-4 py-3 text-sm font-medium text-white/35">{item.label}<span className="ml-2 text-[10px] uppercase tracking-wide">Disabled</span></span> : <Link key={item.label} href={item.href} className={`block rounded-lg px-4 py-3 text-sm font-medium transition ${pathname === item.href || (item.href === "/admin" && pathname.startsWith("/admin/properties")) ? "bg-white/12 text-white" : "text-[#b6c9c0] hover:bg-white/8 hover:text-white"}`}>{item.label}</Link>)}
        </nav>
        <div className="mt-auto border-t border-white/10 px-7 py-6 text-xs text-[#a8c0b4]">Internal tools only</div>
      </aside>
      <div className="lg:pl-64">
        <header className="flex h-20 items-center justify-between border-b border-[#dce4df] bg-white px-5 sm:px-8"><div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#718078]">Property Advisor</p><h1 className="mt-1 text-lg font-semibold">Admin workspace</h1></div><div className="flex items-center gap-4 text-sm text-[#64736b]"><span className="hidden sm:inline">{user.email}</span><button type="button" onClick={handleLogout} className="font-medium text-[#28513f] hover:underline">Sign out</button></div></header>
        <main className="px-5 py-8 sm:px-8">{children}</main>
      </div>
    </div>
  );
}