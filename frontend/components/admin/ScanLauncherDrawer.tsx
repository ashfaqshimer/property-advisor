"use client";

import { useEffect, useState, useRef } from "react";
import {
  X,
  Search,
  MapPin,
  Filter,
  Sparkles,
  Globe,
  Check,
  Loader2,
  Building2,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  PhoneCall,
} from "lucide-react";
import { toast } from "sonner";
import {
  startProspectScan,
  ScanPreset,
} from "../../lib/api";

export const QUICK_LOCATIONS = [
  "Rajagiriya",
  "Colombo 7",
  "Battaramulla",
  "Dehiwala",
  "Kollupitiya",
  "Nugegoda",
  "Negombo",
  "Mount Lavinia",
];

export const CATEGORIES = [
  { id: "land-for-sale", label: "Land for Sale", type: "sale" },
  { id: "houses-for-sale", label: "Houses for Sale", type: "sale" },
  { id: "apartments-for-sale", label: "Apartments for Sale", type: "sale" },
  { id: "house-rentals", label: "House Rentals", type: "rent" },
  { id: "apartment-rentals", label: "Apartment Rentals", type: "rent" },
];

export const DEFAULT_PRESETS: ScanPreset[] = [];

export interface ScanLauncherDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onScanStarted: (
    jobId: string,
    info?: { keyword?: string; categories?: string[]; source?: string; autoFetchPhones?: boolean }
  ) => void;
  initialPreset?: Partial<ScanPreset> | null;
  onPresetsChanged?: (presets: ScanPreset[]) => void;
}

export function ScanLauncherDrawer({
  isOpen,
  onClose,
  onScanStarted,
  initialPreset,
}: ScanLauncherDrawerProps) {
  const [scanTab, setScanTab] = useState<"scoped" | "categories">("scoped");
  const [selectedSource, setSelectedSource] = useState<string>("ikman");
  const [scanLocationKeyword, setScanLocationKeyword] = useState("");
  const [scopedCategories, setScopedCategories] = useState<string[]>([
    "houses",
    "apartments",
  ]);
  const [scanPropertyCategory, setScanPropertyCategory] = useState<
    "all" | "lands" | "apartments" | "houses" | "commercial" | string
  >("houses,apartments");
  const [scanStrictLocation, setScanStrictLocation] = useState(true);
  const [scanAllPages, setScanAllPages] = useState(true);
  const [scanCategories, setScanCategories] = useState<string[]>([
    "land-for-sale",
    "houses-for-sale",
    "apartments-for-sale",
  ]);
  const [scanPages, setScanPages] = useState(10);
  const [autoFetchPhones, setAutoFetchPhones] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);

  const drawerRef = useRef<HTMLDivElement>(null);

  // Handle initial preset if passed from outside
  useEffect(() => {
    if (initialPreset && isOpen) {
      if (initialPreset.keyword) setScanLocationKeyword(initialPreset.keyword);
      const cats =
        initialPreset.categories && initialPreset.categories.length > 0
          ? initialPreset.categories
          : initialPreset.property_category && initialPreset.property_category !== "all"
            ? initialPreset.property_category.split(",")
            : [];
      setScopedCategories(cats);
      setScanPropertyCategory(initialPreset.property_category || (cats.length > 0 ? cats.join(",") : "all"));
      if (initialPreset.strict_location !== undefined) setScanStrictLocation(initialPreset.strict_location);
      if (initialPreset.scan_all !== undefined) setScanAllPages(initialPreset.scan_all);
      if (initialPreset.source) setSelectedSource(initialPreset.source);
      setScanTab("scoped");
    }
  }, [initialPreset, isOpen]);

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen && !submitting) {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    }
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "unset";
    };
  }, [isOpen, submitting, onClose]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      if (scanTab === "scoped") {
        const kw = scanLocationKeyword.trim();
        if (!kw) {
          toast.error("Please enter a location or suburb keyword");
          setSubmitting(false);
          return;
        }

        const res = await startProspectScan({
          source: selectedSource,
          keyword: kw,
          categories: scopedCategories.length > 0 ? scopedCategories : ["property"],
          property_category:
            scopedCategories.length === 1
              ? (scopedCategories[0] as any)
              : scopedCategories.length > 1
                ? scopedCategories.join(",")
                : "all",
          strict_location: scanStrictLocation,
          scan_all: scanAllPages,
          pages_per_category: scanAllPages ? undefined : scanPages,
        });

        toast.info(`Scanner started for '${kw}' (${selectedSource})`);
        onScanStarted(res.job_id, {
          keyword: kw,
          source: selectedSource,
          autoFetchPhones,
        });
        onClose();
      } else {
        if (scanCategories.length === 0) {
          toast.error("Select at least one category to scan");
          setSubmitting(false);
          return;
        }

        const res = await startProspectScan({
          source: selectedSource,
          categories: scanCategories,
          pages_per_category: scanPages,
        });

        toast.info("Scan started in the background");
        onScanStarted(res.job_id, {
          categories: scanCategories,
          source: selectedSource,
          autoFetchPhones,
        });
        onClose();
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to start scan");
    } finally {
      setSubmitting(false);
    }
  };

  // Human-readable summary for the live scan preview badge
  const previewLocation = scanLocationKeyword.trim() || "Any location";
  const previewCategories =
    scanTab === "scoped"
      ? scopedCategories.length > 0
        ? scopedCategories.map((c) => c.charAt(0).toUpperCase() + c.slice(1)).join(", ")
        : "All property types"
      : `${scanCategories.length} categories`;
  const previewDepth = scanAllPages ? "All matching pages" : `${scanPages} pages`;

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-xs transition-opacity duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget && !submitting) onClose();
      }}
      aria-modal="true"
      role="dialog"
      aria-labelledby="scan-drawer-title"
    >
      <div
        ref={drawerRef}
        className="flex h-full w-full flex-col bg-white dark:bg-zinc-950 sm:max-w-xl shadow-2xl border-l border-[#dce4df] dark:border-zinc-800 animate-in slide-in-from-right duration-250 ease-out"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#dce4df] dark:border-zinc-800 px-5 py-4 sm:px-6 bg-[#fbfcfb] dark:bg-zinc-900/60">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#19352b] dark:bg-emerald-600 text-white shadow-xs">
              <Search className="h-4.5 w-4.5" />
            </div>
            <div>
              <h2
                id="scan-drawer-title"
                className="text-base sm:text-lg font-bold tracking-tight text-[#1a2923] dark:text-zinc-100 flex items-center gap-2"
              >
                <span>Start Real Estate Scan</span>
              </h2>
              <p className="text-xs text-[#64736b] dark:text-zinc-400">
                Discover and import new property listings from marketplace sources.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="cursor-pointer rounded-lg p-2 text-[#718078] dark:text-zinc-400 hover:bg-[#f4f6f4] dark:hover:bg-zinc-800 hover:text-[#1a2923] dark:hover:text-white transition"
            aria-label="Close drawer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form
          id="scan-launcher-form"
          onSubmit={handleSubmit}
          className="flex-1 overflow-y-auto px-5 py-5 sm:px-6 space-y-5"
        >
          {/* Section 1: Target Portal */}
          <div className="space-y-2">
            <label className="text-[11px] font-bold uppercase tracking-wider text-[#718078] dark:text-zinc-400">
              Target Marketplace Portal
            </label>

            {/* Compact Portal Toggle Pills */}
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setSelectedSource("ikman")}
                className={`relative flex items-center justify-between rounded-xl p-3 text-left transition cursor-pointer border ${
                  selectedSource === "ikman"
                    ? "border-[#19352b] dark:border-emerald-500 bg-[#eef3f0]/80 dark:bg-emerald-950/40 ring-1 ring-[#19352b] dark:ring-emerald-500"
                    : "border-[#dce4df] dark:border-zinc-800 bg-white dark:bg-zinc-900/60 hover:border-[#19352b]/40 text-[#64736b] dark:text-zinc-400"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                      selectedSource === "ikman"
                        ? "bg-[#19352b] dark:bg-emerald-600 text-white"
                        : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300"
                    }`}
                  >
                    <Globe className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-[#1a2923] dark:text-zinc-100 flex items-center gap-1.5">
                      <span>ikman.lk</span>
                    </div>
                    <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-medium">
                      Active Portal
                    </span>
                  </div>
                </div>
                {selectedSource === "ikman" && (
                  <div className="h-5 w-5 rounded-full bg-[#19352b] dark:bg-emerald-600 flex items-center justify-center text-white">
                    <Check className="h-3 w-3 stroke-[3]" />
                  </div>
                )}
              </button>

              <button
                type="button"
                onClick={() => setSelectedSource("lpw")}
                className={`relative flex items-center justify-between rounded-xl p-3 text-left transition cursor-pointer border ${
                  selectedSource === "lpw"
                    ? "border-[#19352b] dark:border-emerald-500 bg-[#eef3f0]/80 dark:bg-emerald-950/40 ring-1 ring-[#19352b] dark:ring-emerald-500"
                    : "border-[#dce4df] dark:border-zinc-800 bg-white dark:bg-zinc-900/60 hover:border-[#19352b]/40 text-[#64736b] dark:text-zinc-400"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                      selectedSource === "lpw"
                        ? "bg-[#19352b] dark:bg-emerald-600 text-white"
                        : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300"
                    }`}
                  >
                    <Building2 className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-[#1a2923] dark:text-zinc-100 flex items-center gap-1.5">
                      <span>LankaPropertyWeb</span>
                    </div>
                    <span className="text-[10px] text-blue-700 dark:text-blue-400 font-medium">
                      Dedicated
                    </span>
                  </div>
                </div>
                {selectedSource === "lpw" && (
                  <div className="h-5 w-5 rounded-full bg-[#19352b] dark:bg-emerald-600 flex items-center justify-center text-white">
                    <Check className="h-3 w-3 stroke-[3]" />
                  </div>
                )}
              </button>
            </div>
          </div>

          {/* Section 2: Strategy Switcher */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold uppercase tracking-wider text-[#718078] dark:text-zinc-400">
                Search Mode
              </label>
            </div>

            <div className="flex rounded-xl bg-[#f4f6f4] dark:bg-zinc-900 p-1 border border-[#dce4df] dark:border-zinc-800">
              <button
                type="button"
                onClick={() => setScanTab("scoped")}
                className={`flex-1 flex items-center justify-center gap-2 cursor-pointer rounded-lg py-2 text-xs font-semibold transition ${
                  scanTab === "scoped"
                    ? "bg-white dark:bg-zinc-950 text-[#19352b] dark:text-emerald-400 shadow-xs font-bold"
                    : "text-[#64736b] dark:text-zinc-400 hover:text-[#1a2923] dark:hover:text-white"
                }`}
              >
                <MapPin className="h-3.5 w-3.5" />
                <span>Scoped Location</span>
              </button>
              <button
                type="button"
                onClick={() => setScanTab("categories")}
                className={`flex-1 flex items-center justify-center gap-2 cursor-pointer rounded-lg py-2 text-xs font-semibold transition ${
                  scanTab === "categories"
                    ? "bg-white dark:bg-zinc-950 text-[#19352b] dark:text-emerald-400 shadow-xs font-bold"
                    : "text-[#64736b] dark:text-zinc-400 hover:text-[#1a2923] dark:hover:text-white"
                }`}
              >
                <Filter className="h-3.5 w-3.5" />
                <span>Broad Categories</span>
              </button>
            </div>

            {/* Mode 1: Scoped Location */}
            {scanTab === "scoped" ? (
              <div className="space-y-4 pt-1">
                {/* Location Input */}
                <div>
                  <label className="block text-xs font-semibold text-[#1a2923] dark:text-zinc-200 mb-1.5">
                    Location / Suburb Keyword <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <MapPin className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#718078] dark:text-zinc-400" />
                    <input
                      type="text"
                      required
                      value={scanLocationKeyword}
                      onChange={(e) => setScanLocationKeyword(e.target.value)}
                      placeholder="e.g. Rajagiriya, Colombo 7, Battaramulla, Kandy…"
                      className="w-full rounded-xl border border-[#cbd8d1] dark:border-zinc-700 bg-white dark:bg-zinc-900 pl-10 pr-3.5 py-2.5 text-sm outline-none focus:border-[#19352b] dark:focus:border-emerald-500 placeholder:text-[#a0aba4] dark:placeholder:text-zinc-500 text-[#1a2923] dark:text-zinc-200 transition shadow-2xs"
                    />
                  </div>

                  {/* Popular Pills */}
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] font-medium text-[#718078] dark:text-zinc-400 mr-0.5">
                      Popular:
                    </span>
                    {QUICK_LOCATIONS.map((loc) => {
                      const isMatch = scanLocationKeyword.toLowerCase() === loc.toLowerCase();
                      return (
                        <button
                          key={loc}
                          type="button"
                          onClick={() => setScanLocationKeyword(loc)}
                          className={`cursor-pointer rounded-full border px-2.5 py-0.5 text-xs transition ${
                            isMatch
                              ? "border-[#19352b] dark:border-emerald-600 bg-[#19352b] text-white dark:bg-emerald-600 font-semibold"
                              : "border-[#dce4df] dark:border-zinc-800 bg-[#f4f6f4] dark:bg-zinc-900 text-[#64736b] dark:text-zinc-400 hover:border-[#19352b] hover:text-[#1a2923] dark:hover:text-white"
                          }`}
                        >
                          {loc}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Target Property Categories */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-xs font-semibold text-[#1a2923] dark:text-zinc-200">
                      Target Property Categories
                    </label>
                    <button
                      type="button"
                      onClick={() => setScopedCategories([])}
                      className="text-[11px] text-[#64736b] dark:text-zinc-400 hover:text-[#19352b] dark:hover:text-emerald-400 cursor-pointer"
                    >
                      Reset (All)
                    </button>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {[
                      { id: "houses", label: "Houses" },
                      { id: "apartments", label: "Apartments" },
                      { id: "lands", label: "Lands" },
                      { id: "commercial", label: "Commercial" },
                    ].map((cat) => {
                      const isChecked = scopedCategories.includes(cat.id);
                      return (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => {
                            const next = isChecked
                              ? scopedCategories.filter((c) => c !== cat.id)
                              : [...scopedCategories, cat.id];
                            setScopedCategories(next);
                          }}
                          className={`flex items-center justify-center gap-1.5 rounded-xl border py-2.5 px-3 text-xs font-semibold cursor-pointer transition ${
                            isChecked
                              ? "border-[#19352b] dark:border-emerald-600 bg-[#eef3f0] dark:bg-emerald-950/40 text-[#19352b] dark:text-emerald-300 font-bold shadow-2xs"
                              : "border-[#dce4df] dark:border-zinc-800 bg-white dark:bg-zinc-900 text-[#1a2923] dark:text-zinc-300 hover:border-[#19352b]/40"
                          }`}
                        >
                          {isChecked ? (
                            <Check className="h-3.5 w-3.5 text-[#19352b] dark:text-emerald-400 stroke-[3]" />
                          ) : (
                            <span className="h-1.5 w-1.5 rounded-full bg-zinc-300 dark:bg-zinc-600" />
                          )}
                          <span>{cat.label}</span>
                        </button>
                      );
                    })}
                  </div>

                  <p className="mt-1.5 text-[11px] text-[#64736b] dark:text-zinc-400">
                    {scopedCategories.length === 0
                      ? "All property types included."
                      : `Selected: ${scopedCategories.join(" & ")}`}
                  </p>
                </div>
              </div>
            ) : (
              /* Mode 2: Broad Categories */
              <div className="space-y-4 pt-1">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-2 rounded-xl border border-[#dce4df] dark:border-zinc-800 p-3.5 bg-[#fbfcfb] dark:bg-zinc-900/40">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-[#718078] dark:text-zinc-400 mb-2">
                      For Sale
                    </div>
                    {CATEGORIES.filter((c) => c.type === "sale").map((cat) => (
                      <label key={cat.id} className="flex cursor-pointer items-center gap-2.5">
                        <input
                          type="checkbox"
                          checked={scanCategories.includes(cat.id)}
                          onChange={(e) => {
                            if (e.target.checked) setScanCategories([...scanCategories, cat.id]);
                            else setScanCategories(scanCategories.filter((c) => c !== cat.id));
                          }}
                          className="cursor-pointer rounded border-[#cbd8d1] dark:border-zinc-700 text-[#19352b] dark:text-emerald-600 focus:ring-[#19352b]"
                        />
                        <span className="text-xs font-medium text-[#1a2923] dark:text-zinc-200">
                          {cat.label.replace(" for Sale", "")}
                        </span>
                      </label>
                    ))}
                  </div>

                  <div className="space-y-2 rounded-xl border border-[#dce4df] dark:border-zinc-800 p-3.5 bg-[#fbfcfb] dark:bg-zinc-900/40">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-[#718078] dark:text-zinc-400 mb-2">
                      Rentals
                    </div>
                    {CATEGORIES.filter((c) => c.type === "rent").map((cat) => (
                      <label key={cat.id} className="flex cursor-pointer items-center gap-2.5">
                        <input
                          type="checkbox"
                          checked={scanCategories.includes(cat.id)}
                          onChange={(e) => {
                            if (e.target.checked) setScanCategories([...scanCategories, cat.id]);
                            else setScanCategories(scanCategories.filter((c) => c !== cat.id));
                          }}
                          className="cursor-pointer rounded border-[#cbd8d1] dark:border-zinc-700 text-[#19352b] dark:text-emerald-600 focus:ring-[#19352b]"
                        />
                        <span className="text-xs font-medium text-[#1a2923] dark:text-zinc-200">
                          {cat.label.replace(" Rentals", "")}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[#1a2923] dark:text-zinc-200 mb-1">
                    Pages per Category (Max 50)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    value={scanPages}
                    onChange={(e) => setScanPages(parseInt(e.target.value) || 1)}
                    className="w-full rounded-xl border border-[#cbd8d1] dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3.5 py-2 text-sm outline-none focus:border-[#19352b] dark:focus:border-emerald-500 text-[#1a2923] dark:text-zinc-200"
                  />
                  <p className="mt-1 text-[11px] text-[#718078] dark:text-zinc-400">
                    25 listings per page per selected category.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Section 3: Progressive Disclosure Accordion for Crawler & Automation Settings */}
          <div className="rounded-xl border border-[#dce4df] dark:border-zinc-800 bg-[#fbfcfb] dark:bg-zinc-900/30 overflow-hidden">
            <button
              type="button"
              onClick={() => setIsAdvancedOpen((prev) => !prev)}
              className="w-full flex items-center justify-between p-3.5 text-left cursor-pointer hover:bg-[#f4f6f4] dark:hover:bg-zinc-800/40 transition"
              aria-expanded={isAdvancedOpen}
            >
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="h-4 w-4 text-[#19352b] dark:text-emerald-400" />
                <span className="text-xs font-bold text-[#1a2923] dark:text-zinc-200">
                  Crawler & Lead Pipeline Settings
                </span>
                <span className="rounded-full bg-[#eef3f0] dark:bg-zinc-800 px-2 py-0.5 text-[10px] font-semibold text-[#19352b] dark:text-emerald-400">
                  {scanStrictLocation ? "Strict Match" : "Standard"} • {scanAllPages ? "All Pages" : `${scanPages}p`}
                  {autoFetchPhones ? " • Auto Phone" : ""}
                </span>
              </div>
              {isAdvancedOpen ? (
                <ChevronUp className="h-4 w-4 text-[#718078] dark:text-zinc-400" />
              ) : (
                <ChevronDown className="h-4 w-4 text-[#718078] dark:text-zinc-400" />
              )}
            </button>

            {isAdvancedOpen && (
              <div className="p-3.5 pt-0 space-y-3.5 border-t border-[#dce4df] dark:border-zinc-800/60 mt-1">
                {/* Strict Suburb Matching (Scoped Mode Only) */}
                {scanTab === "scoped" && (
                  <div className="pt-2">
                    <label className="flex cursor-pointer items-start gap-2.5">
                      <input
                        type="checkbox"
                        checked={scanStrictLocation}
                        onChange={(e) => setScanStrictLocation(e.target.checked)}
                        className="mt-0.5 cursor-pointer rounded border-[#cbd8d1] dark:border-zinc-700 text-[#19352b] dark:text-emerald-600 focus:ring-[#19352b]"
                      />
                      <div className="text-xs">
                        <span className="font-semibold text-[#1a2923] dark:text-zinc-200">
                          Strict Suburb Matching (Recommended)
                        </span>
                        <p className="mt-0.5 text-[#64736b] dark:text-zinc-400 leading-relaxed">
                          Verifies the target location in the ad title or registered suburb to filter out description spam from distant locations.
                        </p>
                      </div>
                    </label>
                  </div>
                )}

                {/* Scan Depth in Scoped Mode */}
                {scanTab === "scoped" && (
                  <div className="pt-2 border-t border-[#dce4df]/60 dark:border-zinc-800/40">
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-semibold text-[#1a2923] dark:text-zinc-200">
                        Scan Depth Limit
                      </label>
                      <label className="flex cursor-pointer items-center gap-1.5">
                        <input
                          type="checkbox"
                          checked={scanAllPages}
                          onChange={(e) => setScanAllPages(e.target.checked)}
                          className="cursor-pointer rounded border-[#cbd8d1] dark:border-zinc-700 text-[#19352b] dark:text-emerald-600 focus:ring-[#19352b]"
                        />
                        <span className="text-xs font-semibold text-[#19352b] dark:text-emerald-400">
                          Scan all matching pages
                        </span>
                      </label>
                    </div>

                    {scanAllPages ? (
                      <p className="text-[11px] text-[#64736b] dark:text-zinc-400">
                        Automatically discovers the total page count for this location and paginates in polite, rate-limited chunks.
                      </p>
                    ) : (
                      <div className="mt-1.5">
                        <input
                          type="number"
                          min="1"
                          max="500"
                          value={scanPages}
                          onChange={(e) => setScanPages(parseInt(e.target.value) || 1)}
                          placeholder="e.g. 10"
                          className="w-full rounded-lg border border-[#cbd8d1] dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-1.5 text-xs outline-none focus:border-[#19352b] dark:focus:border-emerald-500 text-[#1a2923] dark:text-zinc-200"
                        />
                        <p className="mt-1 text-[11px] text-[#718078] dark:text-zinc-400">
                          25 listings per page (e.g. 10 pages = up to 250 listings).
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Auto Fetch Phone Numbers */}
                <div className="pt-2 border-t border-[#dce4df]/60 dark:border-zinc-800/40">
                  <label className="flex cursor-pointer items-start gap-2.5">
                    <input
                      type="checkbox"
                      checked={autoFetchPhones}
                      onChange={(e) => setAutoFetchPhones(e.target.checked)}
                      className="mt-0.5 cursor-pointer rounded border-[#cbd8d1] dark:border-zinc-700 text-[#19352b] dark:text-emerald-600 focus:ring-[#19352b]"
                    />
                    <div className="text-xs">
                      <span className="font-semibold text-[#1a2923] dark:text-zinc-200 flex items-center gap-1.5">
                        <PhoneCall className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                        <span>Auto-fetch owner contact numbers</span>
                      </span>
                      <p className="mt-0.5 text-[#64736b] dark:text-zinc-400 leading-relaxed">
                        Automatically schedules phone enrichment sync as soon as this scan job completes.
                      </p>
                    </div>
                  </label>
                </div>
              </div>
            )}
          </div>
        </form>

        {/* Live Preview Strip & Sticky Action Footer */}
        <div className="border-t border-[#dce4df] dark:border-zinc-800 bg-[#fbfcfb] dark:bg-zinc-900/90 px-5 py-3.5 sm:px-6 space-y-2.5">
          {/* Real-time Launch Summary Pill */}
          <div className="flex items-center justify-between text-xs rounded-lg bg-[#eef3f0]/70 dark:bg-zinc-800/60 px-3 py-2 text-[#19352b] dark:text-zinc-300">
            <div className="flex items-center gap-2 truncate">
              <Sparkles className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span className="truncate">
                <span className="font-bold">{selectedSource === "ikman" ? "Ikman" : "LPW"}</span>
                {" • "}
                <span>{previewLocation}</span>
                {" • "}
                <span>{previewCategories}</span>
                {" • "}
                <span>{previewDepth}</span>
              </span>
            </div>
            {autoFetchPhones && (
              <span className="shrink-0 text-[10px] font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider ml-2">
                + Phone Sync
              </span>
            )}
          </div>

          <div className="flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="cursor-pointer rounded-xl px-4 py-2.5 text-xs font-semibold text-[#64736b] dark:text-zinc-400 hover:bg-[#f4f6f4] dark:hover:bg-zinc-800 hover:text-[#1a2923] dark:hover:text-white transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="scan-launcher-form"
              disabled={submitting}
              className="cursor-pointer inline-flex items-center justify-center gap-2 rounded-xl bg-[#19352b] dark:bg-emerald-600 px-6 py-2.5 text-xs font-semibold text-white shadow-sm hover:bg-[#132820] dark:hover:bg-emerald-500 disabled:opacity-50 transition min-w-[130px]"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Starting Scan...</span>
                </>
              ) : (
                <>
                  <Search className="h-3.5 w-3.5" />
                  <span>Launch Scan</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
