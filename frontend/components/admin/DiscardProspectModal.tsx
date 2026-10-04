"use client";

import React, { useState } from "react";
import { X, Bot, MapPinOff, UserX, Home, PhoneOff, Trash2, CheckCircle2 } from "lucide-react";
import { Prospect } from "@/lib/api";

export interface DiscardReasonOption {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  isAiSignal?: boolean;
}

export const DISCARD_REASONS: DiscardReasonOption[] = [
  {
    id: "misclassified_broker",
    label: "Actually a Broker",
    description: "Scraper misclassified as owner. Flags this ad to improve AI/heuristics.",
    icon: <Bot className="h-5 w-5 text-purple-600 dark:text-purple-400" />,
    isAiSignal: true,
  },
  {
    id: "out_of_area",
    label: "Location / Criteria Mismatch",
    description: "Outside targeted geographic area or doesn't meet listing criteria.",
    icon: <MapPinOff className="h-5 w-5 text-amber-600 dark:text-amber-400" />,
  },
  {
    id: "not_interested",
    label: "Declined / Not Interested",
    description: "Owner contacted but refused representation or co-broking.",
    icon: <UserX className="h-5 w-5 text-red-600 dark:text-red-400" />,
  },
  {
    id: "already_sold",
    label: "Already Sold / Rented",
    description: "Property is no longer on the market or agreement already signed.",
    icon: <Home className="h-5 w-5 text-zinc-600 dark:text-zinc-400" />,
  },
  {
    id: "unreachable",
    label: "Unreachable / Invalid Contact",
    description: "Phone number is invalid, unreachable, or unresponsive.",
    icon: <PhoneOff className="h-5 w-5 text-zinc-600 dark:text-zinc-400" />,
  },
  {
    id: "duplicate",
    label: "Duplicate / Junk",
    description: "Duplicate submission, spam ad, or broken listing content.",
    icon: <Trash2 className="h-5 w-5 text-zinc-600 dark:text-zinc-400" />,
  },
];

export function getDiscardReasonLabel(reason?: string | null): string {
  if (!reason) return "Discarded";
  const match = DISCARD_REASONS.find((r) => r.id === reason);
  if (match) return match.label;
  return reason.replace(/_/g, " ");
}

export function isBrokerSignalReason(reason?: string | null): boolean {
  return reason === "misclassified_broker";
}

interface DiscardProspectModalProps {
  isOpen: boolean;
  prospect: Prospect | null;
  onClose: () => void;
  onConfirm: (prospectId: string, discardReason: string) => Promise<void> | void;
  loading?: boolean;
}

export default function DiscardProspectModal({
  isOpen,
  prospect,
  onClose,
  onConfirm,
  loading = false,
}: DiscardProspectModalProps) {
  const [selectedReason, setSelectedReason] = useState<string>("misclassified_broker");

  if (!isOpen || !prospect) return null;

  const handleConfirm = async () => {
    if (!selectedReason) return;
    await onConfirm(prospect.id, selectedReason);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/50 backdrop-blur-xs transition-opacity animate-in fade-in duration-200">
      <div 
        className="w-full sm:max-w-lg rounded-t-2xl sm:rounded-2xl border border-[#cbd8d1] dark:border-zinc-800 bg-white dark:bg-zinc-950 p-5 sm:p-6 shadow-2xl flex flex-col max-h-[90vh] overflow-hidden"
        role="dialog"
        aria-modal="true"
        aria-labelledby="discard-modal-title"
      >
        {/* Header */}
        <div className="flex items-start justify-between pb-3 border-b border-[#e5ece8] dark:border-zinc-800">
          <div>
            <h3 id="discard-modal-title" className="text-lg font-bold text-[#1a2923] dark:text-zinc-100">
              Discard Prospect
            </h3>
            <p className="text-xs text-[#64736b] dark:text-zinc-400 mt-0.5 line-clamp-1">
              {prospect.title}
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            className="p-1.5 rounded-lg text-[#718078] hover:text-[#1a2923] dark:text-zinc-400 dark:hover:text-zinc-200 hover:bg-[#f4f6f4] dark:hover:bg-zinc-900 transition cursor-pointer"
            aria-label="Close modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Reason options */}
        <div className="py-4 overflow-y-auto space-y-2.5 flex-1 pr-1">
          <p className="text-xs font-semibold text-[#718078] dark:text-zinc-400 uppercase tracking-wider mb-2">
            Select a reason:
          </p>

          {DISCARD_REASONS.map((opt) => {
            const isSelected = selectedReason === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => setSelectedReason(opt.id)}
                className={`w-full text-left p-3.5 rounded-xl border transition flex items-start gap-3.5 cursor-pointer min-h-[52px] ${
                  isSelected
                    ? opt.isAiSignal
                      ? "border-purple-400 bg-purple-50/70 dark:border-purple-700 dark:bg-purple-950/30"
                      : "border-emerald-500 bg-emerald-50/60 dark:border-emerald-600 dark:bg-emerald-950/30"
                    : "border-[#e5ece8] dark:border-zinc-800 hover:bg-[#f8faf8] dark:hover:bg-zinc-900"
                }`}
              >
                <div className="shrink-0 mt-0.5">{opt.icon}</div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-semibold ${
                      isSelected
                        ? opt.isAiSignal
                          ? "text-purple-900 dark:text-purple-200"
                          : "text-emerald-950 dark:text-emerald-200"
                        : "text-[#1a2923] dark:text-zinc-200"
                    }`}>
                      {opt.label}
                    </span>
                    {opt.isAiSignal && (
                      <span className="rounded bg-purple-200/80 dark:bg-purple-900/60 px-1.5 py-0.2 text-[10px] font-bold text-purple-800 dark:text-purple-300 uppercase tracking-wider">
                        Scraper Signal
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[#64736b] dark:text-zinc-400 mt-0.5 leading-snug">
                    {opt.description}
                  </p>
                </div>
                {isSelected && (
                  <CheckCircle2 className={`h-5 w-5 shrink-0 mt-0.5 ${
                    opt.isAiSignal
                      ? "text-purple-600 dark:text-purple-400"
                      : "text-emerald-600 dark:text-emerald-400"
                  }`} />
                )}
              </button>
            );
          })}
        </div>

        {/* Actions */}
        <div className="pt-3 border-t border-[#e5ece8] dark:border-zinc-800 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2.5 rounded-xl border border-[#cbd8d1] dark:border-zinc-700 text-sm font-medium text-[#1a2923] dark:text-zinc-200 hover:bg-[#f4f6f4] dark:hover:bg-zinc-900 transition cursor-pointer min-h-[44px]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={loading || !selectedReason}
            className="px-5 py-2.5 rounded-xl bg-red-600 dark:bg-red-700 text-sm font-semibold text-white hover:bg-red-700 dark:hover:bg-red-600 shadow-sm transition disabled:opacity-50 cursor-pointer min-h-[44px]"
          >
            {loading ? "Discarding..." : "Confirm Discard"}
          </button>
        </div>
      </div>
    </div>
  );
}
