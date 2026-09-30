import * as React from "react";
import { cn } from "@/lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "secondary" | "outline" | "sale" | "rent";
}

export function Badge({
  className,
  variant = "default",
  ...props
}: BadgeProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold tracking-wide transition-colors",
        variant === "default" && "bg-brand text-on-brand",
        variant === "secondary" && "bg-band-strong text-ink",
        variant === "outline" && "border border-neutral-300 text-ink",
        variant === "sale" && "bg-[#2c4a3e] text-white shadow-xs",
        variant === "rent" && "bg-[#386b58] text-white shadow-xs",
        className
      )}
      {...props}
    />
  );
}
