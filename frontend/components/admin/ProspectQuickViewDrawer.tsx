"use client";

import React from "react";
import { format, parseISO, formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import {
  ExternalLink,
  Phone,
  PhoneCall,
  MessageCircle,
  Copy,
  Sparkles,
  CheckCircle2,
  Bot,
  UserCheck,
  MapPin,
  Home,
  Building,
  Trees,
  Bed,
  Bath,
  Maximize2,
  TrendingDown,
  TrendingUp,
  RotateCcw,
  Trash2,
  Clock,
  Send,
  RefreshCw,
  Compass,
  Undo2,
  Pencil,
  Check,
  Layers,
  Star,
} from "lucide-react";

import { Prospect } from "@/lib/api";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SourceBadge } from "./SourceBadge";
import { getDiscardReasonLabel, isBrokerSignalReason } from "./DiscardProspectModal";

export interface ProspectQuickViewDrawerProps {
  prospect: Prospect | null;
  isOpen: boolean;
  onClose: () => void;
  onConvert: (prospect: Prospect) => void;
  onUpdateStatus: (id: string, newStatus: string, discardReason?: string | null) => void;
  onDiscard: (prospect: Prospect) => void;
  onFetchPhone: (id: string) => Promise<void> | void;
  onAssignToAgent?: (id: string) => void;
  onEditAssignment?: (prospect: Prospect) => void;
  onShortlistOnTelegram?: (id: string) => void;
  isFetchingPhone?: boolean;
  isConverting?: boolean;
  isAssigning?: boolean;
  telegramAgentConfigured?: boolean;
  telegramShortlistConfigured?: boolean;
  isAdminOrRoot?: boolean;
}

export function ProspectQuickViewDrawer({
  prospect,
  isOpen,
  onClose,
  onConvert,
  onUpdateStatus,
  onDiscard,
  onFetchPhone,
  onAssignToAgent,
  onEditAssignment,
  onShortlistOnTelegram,
  isFetchingPhone = false,
  isConverting = false,
  isAssigning = false,
  telegramAgentConfigured = false,
  telegramShortlistConfigured = false,
  isAdminOrRoot = false,
}: ProspectQuickViewDrawerProps) {
  if (!prospect) return null;

  const isOwner = prospect.classification === "owner";
  const isBroker = prospect.classification === "broker";
  const isDiscarded = prospect.status === "discarded";
  const isTerminal = ["discarded", "converted", "unavailable", "agent_no_deal", "agent_co_broke"].includes(prospect.status);
  const confidencePct =
    prospect.confidence !== null && prospect.confidence !== undefined
      ? prospect.confidence <= 1
        ? Math.round(prospect.confidence * 100)
        : Math.round(prospect.confidence)
      : null;

  const handleCopyPhone = () => {
    if (!prospect.phone_number) return;
    navigator.clipboard.writeText(prospect.phone_number);
    toast.success("Phone number copied to clipboard");
  };

  const handleOpenWhatsApp = () => {
    if (!prospect.phone_number) return;
    let cleaned = prospect.phone_number.replace(/\D/g, "");
    if (cleaned.startsWith("0")) {
      cleaned = "94" + cleaned.slice(1);
    } else if (!cleaned.startsWith("94")) {
      cleaned = "94" + cleaned;
    }
    window.open(`https://wa.me/${cleaned}`, "_blank");
  };

  const getPropertyTypeIcon = (type: string) => {
    switch (type?.toLowerCase()) {
      case "house":
        return <Home className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />;
      case "apartment":
        return <Building className="h-4 w-4 text-blue-600 dark:text-blue-400" />;
      case "land":
        return <Trees className="h-4 w-4 text-amber-600 dark:text-amber-400" />;
      default:
        return <Layers className="h-4 w-4 text-primary" />;
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-xl p-0 flex flex-col gap-0 max-h-screen overflow-hidden bg-card"
      >
        {/* Drawer Header */}
        <SheetHeader className="p-5 border-b border-border bg-muted/20 shrink-0 pr-12 text-left">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <SourceBadge source={prospect.source} url={prospect.ikman_url} />
            <span className="text-xs text-muted-foreground">
              Discovered {formatDistanceToNow(parseISO(prospect.first_seen_at), { addSuffix: true })}
            </span>
            {isDiscarded && (
              <Badge
                variant={isBrokerSignalReason(prospect.discard_reason) ? "secondary" : "warning"}
                className="gap-1 text-[10px] font-bold uppercase tracking-wide"
              >
                {isBrokerSignalReason(prospect.discard_reason) && <Bot className="h-3 w-3" />}
                {getDiscardReasonLabel(prospect.discard_reason)}
              </Badge>
            )}
            {prospect.status === "new" && (
              <Badge variant="outline" className="border-blue-500/40 bg-blue-50/50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 font-semibold text-[11px]">
                New Lead
              </Badge>
            )}
            {prospect.status === "shortlisted" && (
              <Badge variant="warning" className="border-amber-500/40 bg-amber-500/15 text-amber-700 dark:text-amber-400 gap-1 font-semibold text-[11px]">
                <Star className="h-3 w-3 fill-amber-500" />
                Shortlisted
              </Badge>
            )}
            {prospect.status === "contacted" && (
              <Badge variant="success" className="gap-1 text-[11px] font-semibold">
                <CheckCircle2 className="h-3 w-3" />
                Contacted
              </Badge>
            )}
            {prospect.status === "converted" && (
              <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white gap-1 text-[11px] font-bold">
                <CheckCircle2 className="h-3 w-3" />
                Converted
              </Badge>
            )}
          </div>
          <SheetTitle className="text-base sm:text-lg font-bold leading-snug text-foreground flex items-start gap-2">
            <span>{prospect.title}</span>
            {prospect.ikman_url && (
              <a
                href={prospect.ikman_url}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 mt-0.5 text-blue-600 hover:text-blue-800 transition-colors"
                title="View original portal ad"
              >
                <ExternalLink className="h-4 w-4" />
              </a>
            )}
          </SheetTitle>
          <SheetDescription className="text-xs text-muted-foreground flex items-center gap-1.5 flex-wrap mt-0.5">
            <span className="capitalize">{prospect.property_type}</span>
            <span>•</span>
            <span className="capitalize">{prospect.listing_type}</span>
            <span>•</span>
            <span className="inline-flex items-center gap-1 font-medium text-foreground">
              <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              {prospect.suburb ? prospect.suburb : prospect.location}
              {prospect.suburb && prospect.location && prospect.location.toLowerCase() !== prospect.suburb.toLowerCase() && (
                <span className="font-normal text-muted-foreground">({prospect.location})</span>
              )}
            </span>
          </SheetDescription>
        </SheetHeader>

        {/* Scrollable Body Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5 text-sm">
          {/* Price & Deal Intelligence Highlight Card */}
          <div className="rounded-xl border border-border bg-muted/30 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <div className="text-xs text-muted-foreground font-medium">Asking Price</div>
              <div className="text-xl font-bold tracking-tight text-foreground">
                {prospect.price || "Price not specified"}
              </div>
              {prospect.price_unit_rate && (
                <div className="text-xs text-muted-foreground mt-0.5">
                  ≈ LKR {Math.round(prospect.price_unit_rate).toLocaleString()} {prospect.price_unit_label || ""}
                </div>
              )}
            </div>

            {prospect.price_grade && prospect.price_grade !== "unrated" && (
              <div className="flex flex-col sm:items-end gap-1">
                <span
                  className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-bold border ${
                    prospect.price_grade === "underpriced"
                      ? "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800 shadow-xs"
                      : prospect.price_grade === "overpriced"
                      ? "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800"
                      : "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800"
                  }`}
                >
                  {prospect.price_grade === "underpriced" ? (
                    <>
                      <TrendingDown className="h-3.5 w-3.5" />
                      <span>🔥 {prospect.price_grade_label || "Hot Deal (Below Market)"}</span>
                    </>
                  ) : prospect.price_grade === "overpriced" ? (
                    <>
                      <TrendingUp className="h-3.5 w-3.5" />
                      <span>{prospect.price_grade_label || "Overpriced (Negotiable)"}</span>
                    </>
                  ) : (
                    <span>{prospect.price_grade_label || "Fair Market Value"}</span>
                  )}
                </span>
                {prospect.market_median_unit_rate && (
                  <span className="text-[11px] text-muted-foreground">
                    Market median: LKR {Math.round(prospect.market_median_unit_rate).toLocaleString()}
                    {prospect.price_diff_percent !== undefined && prospect.price_diff_percent !== null && (
                      <span className="ml-1 font-semibold text-foreground">
                        ({prospect.price_diff_percent > 0 ? `+${prospect.price_diff_percent.toFixed(1)}%` : `${prospect.price_diff_percent.toFixed(1)}%`})
                      </span>
                    )}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* AI Intelligence & Lead Persona Breakdown */}
          <div className="rounded-xl border border-border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                AI Classification Intelligence
              </span>
              {isOwner ? (
                <Badge variant="success" className="gap-1 text-xs font-semibold py-0.5 px-2">
                  <UserCheck className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>Direct Owner{confidencePct !== null ? ` (${confidencePct}%)` : ""}</span>
                </Badge>
              ) : isBroker ? (
                <Badge variant="secondary" className="gap-1 text-xs font-medium py-0.5 px-2 text-muted-foreground">
                  <Bot className="h-3.5 w-3.5 text-purple-600 dark:text-purple-400" />
                  <span>Broker / Agent{confidencePct !== null ? ` (${confidencePct}%)` : ""}</span>
                </Badge>
              ) : (
                <Badge variant="outline" className="text-xs">
                  {prospect.classification}{confidencePct !== null ? ` (${confidencePct}%)` : ""}
                </Badge>
              )}
            </div>

            {prospect.classification_reasons && prospect.classification_reasons.length > 0 && (
              <div>
                <span className="text-xs text-muted-foreground block mb-1.5 font-medium">Detection signals:</span>
                <ul className="space-y-1">
                  {prospect.classification_reasons.map((reason, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-xs text-foreground">
                      <span className="text-emerald-500 mt-0.5">•</span>
                      <span>{reason}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {prospect.classification_method && (
              <div className="pt-2 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
                <span>Classification Engine</span>
                <span className="font-mono uppercase text-[11px] font-semibold text-foreground">
                  {prospect.classification_method}
                </span>
              </div>
            )}
          </div>

          {/* Contact Details & 1-Click Outreach */}
          <div className="rounded-xl border border-border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Contact & Outreach
              </span>
              <span className="text-xs font-medium text-foreground">
                {prospect.poster_name || "Unknown Poster"}
              </span>
            </div>

            {prospect.phone_number ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between rounded-lg bg-muted/40 p-3">
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span className="font-mono text-base font-bold text-foreground">
                      {prospect.phone_number}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleCopyPhone}
                    className="h-7 px-2 text-xs gap-1"
                    title="Copy phone"
                  >
                    <Copy className="h-3 w-3" />
                    <span>Copy</span>
                  </Button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <Button
                    type="button"
                    variant="default"
                    onClick={handleOpenWhatsApp}
                    className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs h-9"
                  >
                    <MessageCircle className="h-4 w-4" />
                    <span>WhatsApp Chat</span>
                  </Button>

                  <Button
                    asChild
                    variant="outline"
                    className="gap-2 font-semibold text-xs h-9"
                  >
                    <a href={`tel:${prospect.phone_number}`}>
                      <PhoneCall className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                      <span>Direct Call</span>
                    </a>
                  </Button>
                </div>
              </div>
            ) : (
              <div className="rounded-lg bg-muted/40 p-3 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="text-xs text-muted-foreground italic text-center sm:text-left">
                  Phone number has not been scraped yet.
                </div>
                {isOwner && (
                  <Button
                    size="sm"
                    onClick={() => onFetchPhone(prospect.id)}
                    disabled={isFetchingPhone}
                    className="gap-1.5 text-xs font-semibold w-full sm:w-auto h-8"
                  >
                    {isFetchingPhone ? (
                      <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <PhoneCall className="h-3.5 w-3.5" />
                    )}
                    <span>{isFetchingPhone ? "Fetching..." : "Fetch Phone Number"}</span>
                  </Button>
                )}
              </div>
            )}

            {/* Field Agent Telegram Assignment Status */}
            {isAdminOrRoot && telegramAgentConfigured && (
              <div className="pt-3 border-t border-border flex items-center justify-between gap-2">
                <div className="flex flex-col gap-0.5">
                  <span className="text-[11px] text-muted-foreground font-medium">Field Outreach</span>
                  <div className="flex items-center gap-1.5">
                    {prospect.assignment_status ? (
                      <Badge
                        variant={
                          prospect.assignment_status === "contacted" || prospect.assignment_status === "interested"
                            ? "success"
                            : prospect.assignment_status === "pending"
                            ? "warning"
                            : prospect.assignment_status === "not_interested"
                            ? "destructive"
                            : "secondary"
                        }
                        className="text-xs font-semibold capitalize"
                      >
                        {prospect.assignment_status.replace(/_/g, " ")}
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground">Unassigned</span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  {prospect.assignment_id && onEditAssignment && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onEditAssignment(prospect)}
                      className="h-7 px-2 text-xs gap-1"
                    >
                      <Pencil className="h-3 w-3" />
                      <span>Edit Outcome</span>
                    </Button>
                  )}
                  {!prospect.assignment_id && !isTerminal && onAssignToAgent && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onAssignToAgent(prospect.id)}
                      disabled={isAssigning}
                      className="h-7 px-2.5 text-xs gap-1.5 font-semibold"
                    >
                      <Send className="h-3 w-3" />
                      <span>Dispatch to Agent</span>
                    </Button>
                  )}
                  {!isTerminal && onShortlistOnTelegram && telegramShortlistConfigured && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onShortlistOnTelegram(prospect.id)}
                      className="h-7 px-2.5 text-xs gap-1.5 font-semibold text-amber-700 dark:text-amber-400 border-amber-500/40 hover:bg-amber-500/10 cursor-pointer"
                    >
                      <Star className="h-3 w-3 fill-amber-500 text-amber-500" />
                      <span>Shortlist on Telegram</span>
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Property Specifications Grid */}
          <div className="rounded-xl border border-border p-4 space-y-3">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground block">
              Property Specifications
            </span>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
              <div className="rounded-lg bg-muted/40 p-2.5 flex items-center gap-2">
                {getPropertyTypeIcon(prospect.property_type)}
                <div>
                  <div className="text-muted-foreground text-[10px] uppercase font-semibold">Type</div>
                  <div className="font-semibold text-foreground capitalize">{prospect.property_type}</div>
                </div>
              </div>

              <div className="rounded-lg bg-muted/40 p-2.5 flex items-center gap-2">
                <MapPin className="h-4 w-4 text-primary shrink-0" />
                <div className="truncate">
                  <div className="text-muted-foreground text-[10px] uppercase font-semibold">Location</div>
                  <div className="font-semibold text-foreground truncate" title={prospect.suburb || prospect.location}>
                    {prospect.suburb || prospect.location}
                  </div>
                </div>
              </div>

              <div className="rounded-lg bg-muted/40 p-2.5 flex items-center gap-2">
                <Compass className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <div>
                  <div className="text-muted-foreground text-[10px] uppercase font-semibold">Transaction</div>
                  <div className="font-semibold text-foreground capitalize">{prospect.listing_type}</div>
                </div>
              </div>

              {prospect.bedrooms !== undefined && prospect.bedrooms !== null && (
                <div className="rounded-lg bg-muted/40 p-2.5 flex items-center gap-2">
                  <Bed className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0" />
                  <div>
                    <div className="text-muted-foreground text-[10px] uppercase font-semibold">Bedrooms</div>
                    <div className="font-semibold text-foreground">{prospect.bedrooms} Rooms</div>
                  </div>
                </div>
              )}

              {prospect.bathrooms !== undefined && prospect.bathrooms !== null && (
                <div className="rounded-lg bg-muted/40 p-2.5 flex items-center gap-2">
                  <Bath className="h-4 w-4 text-cyan-600 dark:text-cyan-400 shrink-0" />
                  <div>
                    <div className="text-muted-foreground text-[10px] uppercase font-semibold">Bathrooms</div>
                    <div className="font-semibold text-foreground">{prospect.bathrooms} Baths</div>
                  </div>
                </div>
              )}

              {prospect.land_size_perches !== undefined && prospect.land_size_perches !== null && (
                <div className="rounded-lg bg-muted/40 p-2.5 flex items-center gap-2">
                  <Trees className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
                  <div>
                    <div className="text-muted-foreground text-[10px] uppercase font-semibold">Land Size</div>
                    <div className="font-semibold text-foreground">{prospect.land_size_perches} Perches</div>
                  </div>
                </div>
              )}

              {prospect.floor_area_sqft !== undefined && prospect.floor_area_sqft !== null && (
                <div className="rounded-lg bg-muted/40 p-2.5 flex items-center gap-2">
                  <Maximize2 className="h-4 w-4 text-purple-600 dark:text-purple-400 shrink-0" />
                  <div>
                    <div className="text-muted-foreground text-[10px] uppercase font-semibold">Floor Area</div>
                    <div className="font-semibold text-foreground">{prospect.floor_area_sqft} sq ft</div>
                  </div>
                </div>
              )}

              {prospect.latitude && prospect.longitude && (
                <div className="rounded-lg bg-muted/40 p-2.5 col-span-2 sm:col-span-3 flex items-center justify-between">
                  <div className="text-xs text-muted-foreground">
                    GPS: {prospect.latitude.toFixed(4)}, {prospect.longitude.toFixed(4)}
                  </div>
                  <a
                    href={`https://www.google.com/maps?q=${prospect.latitude},${prospect.longitude}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline"
                  >
                    <span>View on Google Maps</span>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Drawer Sticky Footer with Core Actions */}
        <div className="p-3 sm:p-4 border-t border-border bg-card shrink-0 flex flex-wrap items-center justify-between gap-2 sm:gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {isDiscarded ? (
              <Button
                type="button"
                variant="default"
                onClick={() => {
                  onUpdateStatus(prospect.id, "new");
                  onClose();
                }}
                className="gap-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                <Undo2 className="h-3.5 w-3.5" />
                <span>Restore to Pipeline</span>
              </Button>
            ) : (
              !isTerminal && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    onDiscard(prospect);
                  }}
                  className="gap-1.5 text-xs font-medium text-destructive border-destructive/30 hover:bg-destructive/10"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Discard...</span>
                </Button>
              )
            )}

            {!isTerminal && onShortlistOnTelegram && telegramShortlistConfigured && (
              <Button
                type="button"
                variant={prospect.status === "shortlisted" ? "outline" : "default"}
                onClick={() => onShortlistOnTelegram(prospect.id)}
                className={`gap-1.5 text-xs font-semibold cursor-pointer ${
                  prospect.status === "shortlisted"
                    ? "border-amber-500/40 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10"
                    : "bg-amber-500 hover:bg-amber-400 text-zinc-950 shadow-xs"
                }`}
                title="Send prospect to Telegram shortlist topic for review"
              >
                <Star className={`h-3.5 w-3.5 ${prospect.status === "shortlisted" ? "fill-amber-500 text-amber-500" : "fill-zinc-950 text-zinc-950"}`} />
                <span>{prospect.status === "shortlisted" ? "Shortlisted" : "Shortlist on TG"}</span>
              </Button>
            )}

            {prospect.status === "new" && (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  onUpdateStatus(prospect.id, "contacted");
                }}
                className="gap-1.5 text-xs font-medium"
              >
                <PhoneCall className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                <span>Mark Contacted</span>
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              className="text-xs"
            >
              Close
            </Button>

            {prospect.status !== "converted" && (
              <Button
                type="button"
                onClick={() => {
                  onConvert(prospect);
                }}
                disabled={isConverting}
                className="gap-1.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {isConverting ? (
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5" />
                )}
                <span>Convert to Listing ⚡</span>
              </Button>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
