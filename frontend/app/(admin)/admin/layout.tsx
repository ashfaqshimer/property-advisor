"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { AuthUser, getCurrentUser, logout } from "../../../lib/api";
import { Spinner } from "../../../components/ui/spinner";
import { Button } from "../../../components/ui/button";
import { Menu, X } from "lucide-react";
import AdminUserMenu from "../../../components/admin/AdminUserMenu";
import { ThemeToggle } from "../../../components/ThemeToggle";

const navigation: { label: string; href: string; disabled?: boolean }[] = [
  { label: "Properties", href: "/admin" },
  { label: "Contacts", href: "/admin/contacts" },
  { label: "Leads", href: "/admin/leads" },
  { label: "Prospects", href: "/admin/prospects" },
  { label: "Market Values", href: "/admin/market-values" },
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
    return (
      <main className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">
        <Spinner className="mr-2 h-4 w-4" />Checking access...
      </main>
    );
  }

  return (
    <div className="admin-workspace min-h-screen bg-background text-foreground">
      {/* Mobile Sidebar Overlay */}
      {mobileMenuOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden" 
          onClick={() => setMobileMenuOpen(false)} 
          aria-hidden="true"
        />
      )}
      
      <aside className={`fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-transform duration-300 lg:translate-x-0 ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex items-center justify-between border-b border-sidebar-border px-7 py-7">
          <div>
            <Link href="/admin" className="text-xl font-semibold tracking-tight text-sidebar-foreground">Property Advisor</Link>
            <p className="mt-1 text-xs uppercase tracking-[0.18em] text-sidebar-foreground/70">Admin workspace</p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMobileMenuOpen(false)}
            className="lg:hidden h-8 w-8 text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground cursor-pointer"
            aria-label="Close sidebar"
          >
            <X className="h-5 w-5" />
          </Button>
        </div>
        <nav aria-label="Admin navigation" className="space-y-1 px-4 py-7">
          {navigation.map((item) => item.disabled ? (
            <span key={item.label} aria-disabled="true" className="block cursor-not-allowed rounded-lg px-4 py-3 text-sm font-medium text-sidebar-foreground/35">
              {item.label}<span className="ml-2 text-[10px] uppercase tracking-wide">Disabled</span>
            </span>
          ) : (
            <Link
              key={item.label}
              href={item.href}
              className={`block rounded-lg px-4 py-3 text-sm font-medium transition ${
                pathname === item.href || (item.href === "/admin" && pathname.startsWith("/admin/properties"))
                  ? "bg-sidebar-accent text-sidebar-foreground"
                  : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground"
              }`}
            >
              {item.label}
            </Link>
          ))}
          {["root", "admin"].includes(user.role) && (
            <>
              <Link href="/admin/conversations" className={`block rounded-lg px-4 py-3 text-sm font-medium transition ${pathname.startsWith("/admin/conversations") ? "bg-sidebar-accent text-sidebar-foreground" : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground"}`}>Conversations</Link>
              <Link href="/admin/scans" className={`block rounded-lg px-4 py-3 text-sm font-medium transition ${pathname.startsWith("/admin/scans") ? "bg-sidebar-accent text-sidebar-foreground" : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground"}`}>Scanner Hub</Link>
              <Link href="/admin/assignments" className={`block rounded-lg px-4 py-3 text-sm font-medium transition ${pathname.startsWith("/admin/assignments") ? "bg-sidebar-accent text-sidebar-foreground" : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground"}`}>Assignments</Link>
              <Link href="/admin/users" className={`block rounded-lg px-4 py-3 text-sm font-medium transition ${pathname.startsWith("/admin/users") ? "bg-sidebar-accent text-sidebar-foreground" : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground"}`}>Users</Link>
              <Link href="/admin/site-configuration" className={`block rounded-lg px-4 py-3 text-sm font-medium transition ${pathname.startsWith("/admin/site-configuration") ? "bg-sidebar-accent text-sidebar-foreground" : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-foreground"}`}>Site Config</Link>
            </>
          )}
        </nav>
        <div className="mt-auto flex flex-col gap-5 border-t border-sidebar-border px-7 py-6">
          <Link href="/" className="flex items-center gap-2 text-sm font-medium text-sidebar-foreground/80 hover:text-sidebar-foreground transition group">
            <svg className="h-4 w-4 text-sidebar-foreground/70 group-hover:text-sidebar-foreground transition" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
            View Public Site
          </Link>
          <div className="text-xs text-sidebar-foreground/60">Internal tools only</div>
        </div>
      </aside>
      <div className="lg:pl-64">
        <header className="flex h-20 items-center justify-between border-b border-border bg-card px-5 sm:px-8">
          <div className="flex items-center gap-3 sm:gap-4">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="lg:hidden -ml-2 text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open sidebar"
            >
              <Menu className="h-6 w-6" />
            </Button>
            <div>
              <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Property Advisor</p>
              <h1 className="mt-0.5 sm:mt-1 text-base sm:text-lg font-semibold text-foreground">Admin workspace</h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <AdminUserMenu user={user} onSignOut={handleLogout} signingOut={signingOut} />
          </div>
        </header>
        <main className="px-5 py-8 sm:px-8">{children}</main>
      </div>
    </div>
  );
}