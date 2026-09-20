"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { AuthUser, getCurrentUser, logout } from "../../../lib/api";
import { Spinner } from "../../../components/ui/spinner";
import AdminUserMenu from "../../../components/admin/AdminUserMenu";

const navigation: { label: string; href: string; disabled?: boolean }[] = [
  { label: "Properties", href: "/admin" },
  { label: "Contacts", href: "/admin/contacts" },
  { label: "Leads", href: "/admin/leads" },
  { label: "Settings", href: "/admin/settings" },
];

export default function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [signingOut, setSigningOut] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

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
    setSigningOut(true);
    await logout();
    router.replace("/login");
  }

  if (checkingAuth || !user) {
    return <main className="flex min-h-screen items-center justify-center bg-[#f4f6f4] text-sm text-[#64736b]"><Spinner className="mr-2 h-4 w-4" />Checking access...</main>;
  }

  return (
    <div className="min-h-screen bg-[#f4f6f4] text-[#1a2923]">
      {/* Mobile Sidebar Overlay */}
      {mobileMenuOpen && (
        <div 
          className="fixed inset-0 z-40 bg-[#1a2923]/60 backdrop-blur-sm lg:hidden" 
          onClick={() => setMobileMenuOpen(false)} 
          aria-hidden="true"
        />
      )}
      
      <aside className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-[#dce4df] bg-[#19352b] text-white transition-transform duration-300 lg:translate-x-0 ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex items-center justify-between border-b border-white/10 px-7 py-7">
          <div>
            <Link href="/admin" className="text-xl font-semibold tracking-tight">Property Advisor</Link>
            <p className="mt-1 text-xs uppercase tracking-[0.18em] text-[#a8c0b4]">Admin workspace</p>
          </div>
          <button onClick={() => setMobileMenuOpen(false)} className="lg:hidden p-1 text-[#a8c0b4] hover:text-white" aria-label="Close sidebar">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <nav aria-label="Admin navigation" className="space-y-1 px-4 py-7">
          {navigation.map((item) => item.disabled ? <span key={item.label} aria-disabled="true" className="block cursor-not-allowed rounded-lg px-4 py-3 text-sm font-medium text-white/35">{item.label}<span className="ml-2 text-[10px] uppercase tracking-wide">Disabled</span></span> : <Link key={item.label} href={item.href} className={`block rounded-lg px-4 py-3 text-sm font-medium transition ${pathname === item.href || (item.href === "/admin" && pathname.startsWith("/admin/properties")) ? "bg-white/12 text-white" : "text-[#b6c9c0] hover:bg-white/8 hover:text-white"}`}>{item.label}</Link>)}
          {user.role === "root" && (
            <>
              <Link href="/admin/users" className={`block rounded-lg px-4 py-3 text-sm font-medium transition ${pathname.startsWith("/admin/users") ? "bg-white/12 text-white" : "text-[#b6c9c0] hover:bg-white/8 hover:text-white"}`}>Users</Link>
              <Link href="/admin/site-configuration" className={`block rounded-lg px-4 py-3 text-sm font-medium transition ${pathname.startsWith("/admin/site-configuration") ? "bg-white/12 text-white" : "text-[#b6c9c0] hover:bg-white/8 hover:text-white"}`}>Site Config</Link>
            </>
          )}
        </nav>
        <div className="mt-auto border-t border-white/10 px-7 py-6 text-xs text-[#a8c0b4]">Internal tools only</div>
      </aside>
      <div className="lg:pl-64">
        <header className="flex h-20 items-center justify-between border-b border-[#dce4df] bg-white px-5 sm:px-8">
          <div className="flex items-center gap-3 sm:gap-4">
            <button
              type="button"
              className="lg:hidden -ml-2 rounded-lg p-2 text-[#718078] hover:bg-[#f4f6f4] hover:text-[#1a2923] focus:outline-none"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open sidebar"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <div>
              <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-[0.16em] text-[#718078]">Property Advisor</p>
              <h1 className="mt-0.5 sm:mt-1 text-base sm:text-lg font-semibold">Admin workspace</h1>
            </div>
          </div>
          <AdminUserMenu user={user} onSignOut={handleLogout} signingOut={signingOut} />
        </header>
        <main className="px-5 py-8 sm:px-8">{children}</main>
      </div>
    </div>
  );
}