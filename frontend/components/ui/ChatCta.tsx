"use client";

import { openChat } from "@/lib/chat-dialog";

const SIZES = {
  sm: "px-4 py-2 text-xs",
  md: "px-5 py-2.5 text-sm",
  lg: "px-6 py-3 text-sm",
};

export default function ChatCta({
  className = "",
  size = "md",
  label = "Talk to Amaya",
  onClick,
}: {
  className?: string;
  size?: keyof typeof SIZES;
  label?: string;
  onClick?: () => void;
}) {
  const handleClick = () => {
    openChat();
    onClick?.();
  };

  return (
    <a
      href="#chat"
      onClick={handleClick}
      aria-label="Chat with our AI Agent"
      className={`group inline-flex items-center gap-2 rounded-full bg-brand font-medium text-on-brand shadow-xs transition-all hover:bg-[#233c32] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${SIZES[size]} ${className}`}
    >
      <span>{label}</span>
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="size-4 shrink-0 transition-transform duration-200 group-hover:translate-x-0.5"
      >
        <path d="M5 12h14M12 5l7 7-7 7" />
      </svg>
    </a>
  );
}
