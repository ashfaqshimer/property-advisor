"use client";

import React, { useState } from "react";
import { Bot, MapPinOff, UserX, Home, PhoneOff, Trash2, CheckCircle2 } from "lucide-react";
import { Prospect } from "@/lib/api";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

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
    icon: <Home className="h-5 w-5 text-muted-foreground" />,
  },
  {
    id: "unreachable",
    label: "Unreachable / Invalid Contact",
    description: "Phone number is invalid, unreachable, or unresponsive.",
    icon: <PhoneOff className="h-5 w-5 text-muted-foreground" />,
  },
  {
    id: "duplicate",
    label: "Duplicate / Junk",
    description: "Duplicate submission, spam ad, or broken listing content.",
    icon: <Trash2 className="h-5 w-5 text-muted-foreground" />,
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

export interface DiscardProspectModalProps {
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

  if (!prospect) return null;

  const handleConfirm = async () => {
    if (!selectedReason) return;
    await onConfirm(prospect.id, selectedReason);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open && !loading) onClose(); }}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col p-6 gap-0">
        {/* Header */}
        <DialogHeader className="pb-3 border-b border-border text-left">
          <DialogTitle className="text-lg font-bold text-foreground">
            Discard Prospect
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
            {prospect.title}
          </DialogDescription>
        </DialogHeader>

        {/* Reason options */}
        <div className="py-4 overflow-y-auto space-y-2.5 flex-1 pr-1">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
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
                      ? "border-purple-500 bg-purple-500/10 dark:border-purple-500/80 dark:bg-purple-950/40"
                      : "border-emerald-500 bg-emerald-500/10 dark:border-emerald-500/80 dark:bg-emerald-950/40"
                    : "border-border bg-card hover:bg-muted text-card-foreground"
                }`}
              >
                <div className="shrink-0 mt-0.5">{opt.icon}</div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-sm font-semibold ${
                        isSelected
                          ? opt.isAiSignal
                            ? "text-purple-950 dark:text-purple-200"
                            : "text-emerald-950 dark:text-emerald-200"
                          : "text-foreground"
                      }`}
                    >
                      {opt.label}
                    </span>
                    {opt.isAiSignal && (
                      <span className="rounded bg-purple-100 dark:bg-purple-900/60 px-1.5 py-0.5 text-[10px] font-bold text-purple-800 dark:text-purple-300 uppercase tracking-wider">
                        Scraper Signal
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
                    {opt.description}
                  </p>
                </div>
                {isSelected && (
                  <CheckCircle2
                    className={`h-5 w-5 shrink-0 mt-0.5 ${
                      opt.isAiSignal
                        ? "text-purple-600 dark:text-purple-400"
                        : "text-emerald-600 dark:text-emerald-400"
                    }`}
                  />
                )}
              </button>
            );
          })}
        </div>

        {/* Actions */}
        <DialogFooter className="pt-3 border-t border-border flex items-center justify-end gap-2.5 sm:space-x-0">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={loading}
            className="min-h-[44px]"
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleConfirm}
            disabled={loading || !selectedReason}
            className="min-h-[44px]"
          >
            {loading ? "Discarding..." : "Confirm Discard"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
