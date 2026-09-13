"use client";

import { useEffect, useRef, useState } from "react";
import type { AuthUser } from "@/lib/api";
import { Spinner } from "@/components/ui/spinner";

type AdminUserMenuProps = {
  user: AuthUser;
  onSignOut: () => void | Promise<void>;
  signingOut?: boolean;
};

export default function AdminUserMenu({
  user,
  onSignOut,
  signingOut = false,
}: AdminUserMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setOpen(false);
      buttonRef.current?.focus();
    }

    function onPointerDown(event: PointerEvent) {
      if (rootRef.current?.contains(event.target as Node)) return;
      setOpen(false);
    }

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  const displayName = user.name?.trim() || "User";
  const initial = (user.name?.trim()?.[0] || user.email?.[0] || "U").toUpperCase();

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={buttonRef}
        id="admin-user-menu-button"
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls="admin-user-menu-dropdown"
        aria-label={`User menu for ${displayName}`}
        onClick={() => setOpen((wasOpen) => !wasOpen)}
        className="flex items-center gap-3 rounded-xl border border-transparent px-3 py-1.5 text-left transition hover:border-[#dce4df] hover:bg-[#f4f6f4] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#28513f]"
      >
        <div
          className="flex size-9 shrink-0 items-center justify-center rounded-full border border-[#c2ddce] bg-[#e0f1e7] text-sm font-semibold text-[#19352b]"
          aria-hidden="true"
        >
          {initial}
        </div>
        <div className="flex flex-col text-left">
          <span className="text-xs text-[#718078]">
            Welcome, <strong className="font-semibold text-[#1a2923]">{displayName}</strong>
          </span>
          <span className="text-xs text-[#64736b]">{user.email}</span>
        </div>
        <svg
          className={`size-4 text-[#718078] transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
        </svg>
      </button>

      {open && (
        <div
          id="admin-user-menu-dropdown"
          role="menu"
          aria-orientation="vertical"
          aria-labelledby="admin-user-menu-button"
          className="absolute right-0 top-full z-50 mt-2 w-64 rounded-xl border border-[#dce4df] bg-white p-2 shadow-lg"
        >
          <div className="border-b border-[#edf0ee] px-3 py-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-[#718078]">
              Signed in as
            </p>
            <p className="mt-0.5 truncate text-sm font-semibold text-[#1a2923]">
              {displayName}
            </p>
            <p className="truncate text-xs text-[#718078]">{user.email}</p>
            <span className="mt-1.5 inline-block rounded-full bg-[#e0f1e7] px-2 py-0.5 text-[11px] font-medium uppercase tracking-wider text-[#28704b]">
              {user.role}
            </span>
          </div>
          <div className="pt-1">
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                onSignOut();
              }}
              disabled={signingOut}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-[#a34d4d] transition hover:bg-[#fdf2f2] hover:text-[#8b3535] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#a34d4d] disabled:cursor-wait disabled:opacity-60"
            >
              {signingOut ? (
                <Spinner className="mr-0.5 size-4 shrink-0 text-[#a34d4d]" />
              ) : (
                <svg
                  className="size-4 shrink-0 text-[#a34d4d]"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.75}
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75"
                  />
                </svg>
              )}
              <span>Sign out</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
