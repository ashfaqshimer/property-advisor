import React from "react";
import { Globe, ExternalLink } from "lucide-react";
import { IkmanIcon, LpwIcon } from "../icons/PortalLogos";

interface SourceBadgeProps {
  source?: string | null;
  className?: string;
  url?: string | null;
}

export function SourceBadge({ source, className = "", url }: SourceBadgeProps) {
  const normalized = (source || "ikman").toLowerCase().trim();

  let label = "ikman.lk";
  let badgeClasses =
    "border-teal-200/90 dark:border-teal-900/60 bg-teal-50/80 dark:bg-teal-950/40 text-teal-950 dark:text-teal-200";
  let renderIcon = () => <IkmanIcon className="h-3 w-3 shrink-0 rounded-xs" />;

  if (normalized.includes("lpw") || normalized.includes("lankapropertyweb") || normalized.includes("lkpw")) {
    label = "LPW";
    badgeClasses =
      "border-blue-200/90 dark:border-blue-900/60 bg-blue-50/80 dark:bg-blue-950/40 text-blue-950 dark:text-blue-200";
    renderIcon = () => <LpwIcon className="h-3 w-3 shrink-0" />;
  } else if (normalized.includes("hitad")) {
    label = "HitAd";
    badgeClasses =
      "border-orange-200/90 dark:border-orange-900/60 bg-orange-50/80 dark:bg-orange-950/40 text-orange-900 dark:text-orange-300";
    renderIcon = () => <Globe className="h-3 w-3 shrink-0" />;
  }

  const badge = (
    <span
      className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[10px] font-bold tracking-tight transition ${badgeClasses} ${className}`}
    >
      {renderIcon()}
      <span>{label}</span>
      {url && <ExternalLink className="h-2.5 w-2.5 opacity-60 ml-0.5" />}
    </span>
  );

  if (url) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`View original listing on ${label}`}
        className="inline-flex items-center hover:opacity-80 transition cursor-pointer"
        title={`View original listing on ${label}`}
      >
        {badge}
      </a>
    );
  }

  return badge;
}
