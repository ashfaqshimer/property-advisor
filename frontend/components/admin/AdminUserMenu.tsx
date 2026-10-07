"use client";

import { useRef } from "react";
import type { AuthUser } from "@/lib/api";
import { Spinner } from "@/components/ui/spinner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
  const buttonRef = useRef<HTMLButtonElement>(null);
  const displayName = user.name?.trim() || "User";
  const initial = (user.name?.trim()?.[0] || user.email?.[0] || "U").toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          ref={buttonRef}
          id="admin-user-menu-button"
          type="button"
          aria-label={`User menu for ${displayName}`}
          className="group flex items-center gap-3 rounded-xl border border-transparent px-3 py-1.5 text-left transition hover:border-border hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary cursor-pointer"
        >
          <div
            className="flex size-9 shrink-0 items-center justify-center rounded-full border border-border bg-accent text-sm font-semibold text-accent-foreground"
            aria-hidden="true"
          >
            {initial}
          </div>
          <div className="hidden flex-col text-left sm:flex">
            <span className="text-xs text-muted-foreground">
              Welcome, <strong className="font-semibold text-foreground">{displayName}</strong>
            </span>
            <span className="text-xs text-muted-foreground">{user.email}</span>
          </div>
          <svg
            className="size-4 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
          </svg>
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        id="admin-user-menu-dropdown"
        align="end"
        className="w-64 border-border bg-popover p-2 text-popover-foreground shadow-lg"
        onCloseAutoFocus={(e) => {
          e.preventDefault();
          buttonRef.current?.focus();
        }}
      >
        <DropdownMenuLabel className="border-b border-border px-3 py-2 font-normal">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Signed in as
          </p>
          <p className="mt-0.5 truncate text-sm font-semibold text-foreground">
            {displayName}
          </p>
          <p className="truncate text-xs text-muted-foreground">{user.email}</p>
          <span className="mt-1.5 inline-block rounded-full bg-accent px-2 py-0.5 text-[11px] font-medium uppercase tracking-wider text-accent-foreground">
            {user.role}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <div className="pt-1">
          <DropdownMenuItem
            asChild
            disabled={signingOut}
          >
            <button
              type="button"
              onClick={() => onSignOut()}
              disabled={signingOut}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-destructive transition hover:bg-destructive/10 hover:text-destructive focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-destructive disabled:cursor-wait disabled:opacity-60 cursor-pointer"
            >
              {signingOut ? (
                <Spinner className="mr-0.5 size-4 shrink-0 text-destructive" />
              ) : (
                <svg
                  className="size-4 shrink-0 text-destructive"
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
          </DropdownMenuItem>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
