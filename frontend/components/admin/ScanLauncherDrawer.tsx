"use client";

import { useEffect, useState, useRef } from "react";
import {
  X,
  Search,
  MapPin,
  Filter,
  Sparkles,
  Check,
  Loader2,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  PhoneCall,
} from "lucide-react";
import { toast } from "sonner";
import { IkmanIcon, LpwIcon } from "../icons/PortalLogos";
import {
  startProspectScan,
  ScanPreset,
} from "../../lib/api";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

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
    <Sheet open={isOpen} onOpenChange={(open) => { if (!open && !submitting) onClose(); }}>
      <SheetContent
        side="right"
        className="p-0 flex flex-col gap-0 sm:max-w-xl h-full border-l border-border bg-card [&>button.absolute]:hidden"
      >
        {/* Header */}
        <SheetHeader className="flex flex-row items-center justify-between border-b border-border px-5 py-4 sm:px-6 bg-muted/40 space-y-0 text-left">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-xs">
              <Search className="h-4.5 w-4.5" />
            </div>
            <div>
              <SheetTitle className="text-base sm:text-lg font-bold tracking-tight text-foreground flex items-center gap-2">
                <span>Start Real Estate Scan</span>
              </SheetTitle>
              <SheetDescription className="text-xs text-muted-foreground">
                Discover and import new property listings from marketplace sources.
              </SheetDescription>
            </div>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onClose}
            disabled={submitting}
            className="cursor-pointer rounded-lg h-9 w-9 text-muted-foreground hover:bg-muted hover:text-foreground transition"
            aria-label="Close drawer"
          >
            <X className="h-5 w-5" />
          </Button>
        </SheetHeader>

        {/* Scrollable Form Body */}
        <form
          id="scan-launcher-form"
          onSubmit={handleSubmit}
          className="flex-1 overflow-y-auto px-5 py-5 sm:px-6 space-y-5"
        >
          {/* Section 1: Target Portal */}
          <div className="space-y-2">
            <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              Target Marketplace Portal
            </label>

            {/* Compact Portal Toggle Pills */}
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setSelectedSource("ikman")}
                className={`relative flex items-center justify-between rounded-xl p-3 text-left transition cursor-pointer border ${
                  selectedSource === "ikman"
                    ? "border-primary bg-primary/10 ring-1 ring-primary"
                    : "border-border bg-card hover:border-primary/40 text-muted-foreground"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-lg overflow-hidden ${
                      selectedSource === "ikman"
                        ? "bg-[#009B79] text-white shadow-xs"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    <IkmanIcon className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-foreground flex items-center gap-1.5">
                      <span>ikman.lk</span>
                    </div>
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                      Active Portal
                    </span>
                  </div>
                </div>
                {selectedSource === "ikman" && (
                  <div className="h-5 w-5 rounded-full bg-primary flex items-center justify-center text-primary-foreground">
                    <Check className="h-3 w-3 stroke-[3]" />
                  </div>
                )}
              </button>

              <button
                type="button"
                onClick={() => setSelectedSource("lpw")}
                className={`relative flex items-center justify-between rounded-xl p-3 text-left transition cursor-pointer border ${
                  selectedSource === "lpw"
                    ? "border-primary bg-primary/10 ring-1 ring-primary"
                    : "border-border bg-card hover:border-primary/40 text-muted-foreground"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-lg overflow-hidden ${
                      selectedSource === "lpw"
                        ? "bg-[#078F46] text-white shadow-xs"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    <LpwIcon className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-foreground flex items-center gap-1.5">
                      <span>LankaPropertyWeb</span>
                    </div>
                    <span className="text-[10px] text-blue-600 dark:text-blue-400 font-medium">
                      Dedicated
                    </span>
                  </div>
                </div>
                {selectedSource === "lpw" && (
                  <div className="h-5 w-5 rounded-full bg-primary flex items-center justify-center text-primary-foreground">
                    <Check className="h-3 w-3 stroke-[3]" />
                  </div>
                )}
              </button>
            </div>
          </div>

          {/* Section 2: Strategy Switcher */}
          <Tabs
            value={scanTab}
            onValueChange={(val) => setScanTab(val as "scoped" | "categories")}
            className="w-full space-y-3"
          >
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                Search Mode
              </label>
            </div>

            <TabsList className="grid w-full grid-cols-2 h-10 p-1 bg-muted">
              <TabsTrigger
                value="scoped"
                role="button"
                onClick={() => setScanTab("scoped")}
                className="flex items-center justify-center gap-2 text-xs font-semibold"
              >
                <MapPin className="h-3.5 w-3.5" />
                <span>Scoped Location</span>
              </TabsTrigger>
              <TabsTrigger
                value="categories"
                role="button"
                onClick={() => setScanTab("categories")}
                className="flex items-center justify-center gap-2 text-xs font-semibold"
              >
                <Filter className="h-3.5 w-3.5" />
                <span>Broad Categories</span>
              </TabsTrigger>
            </TabsList>

            {/* Mode 1: Scoped Location */}
            <TabsContent value="scoped" className="space-y-4 pt-1 mt-0">
              {/* Location Input */}
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1.5">
                  Location / Suburb Keyword <span className="text-destructive">*</span>
                </label>
                <div className="relative">
                  <MapPin className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="text"
                    required
                    value={scanLocationKeyword}
                    onChange={(e) => setScanLocationKeyword(e.target.value)}
                    placeholder="e.g. Rajagiriya, Colombo 7, Battaramulla, Kandy…"
                    className="pl-10 h-10 bg-background border-input text-foreground placeholder:text-muted-foreground"
                  />
                </div>

                {/* Popular Pills */}
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] font-medium text-muted-foreground mr-0.5">
                    Popular:
                  </span>
                  {QUICK_LOCATIONS.map((loc) => {
                    const isMatch = scanLocationKeyword.toLowerCase() === loc.toLowerCase();
                    return (
                      <Button
                        key={loc}
                        type="button"
                        variant={isMatch ? "default" : "outline"}
                        size="sm"
                        onClick={() => setScanLocationKeyword(loc)}
                        className={`h-6 rounded-full px-2.5 text-xs font-medium cursor-pointer ${
                          isMatch
                            ? "bg-primary text-primary-foreground font-semibold"
                            : "border-border bg-muted/50 text-muted-foreground hover:border-primary hover:text-foreground"
                        }`}
                      >
                        {loc}
                      </Button>
                    );
                  })}
                </div>
              </div>

              {/* Target Property Categories */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-semibold text-foreground">
                    Target Property Categories
                  </label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setScopedCategories([])}
                    className="h-auto p-0 text-[11px] text-muted-foreground hover:text-primary hover:bg-transparent cursor-pointer"
                  >
                    Reset (All)
                  </Button>
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
                            ? "border-primary bg-primary/10 text-primary dark:text-emerald-300 font-bold shadow-2xs"
                            : "border-border bg-card text-foreground hover:border-primary/40"
                        }`}
                      >
                        {isChecked ? (
                          <Check className="h-3.5 w-3.5 text-primary dark:text-emerald-400 stroke-[3]" />
                        ) : (
                          <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40" />
                        )}
                        <span>{cat.label}</span>
                      </button>
                    );
                  })}
                </div>

                <p className="mt-1.5 text-[11px] text-muted-foreground">
                  {scopedCategories.length === 0
                    ? "All property types included."
                    : `Selected: ${scopedCategories.join(" & ")}`}
                </p>
              </div>
            </TabsContent>

            {/* Mode 2: Broad Categories */}
            <TabsContent value="categories" className="space-y-4 pt-1 mt-0">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-2 rounded-xl border border-border p-3.5 bg-muted/30">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
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
                        className="cursor-pointer rounded border-input text-primary focus:ring-primary"
                      />
                      <span className="text-xs font-medium text-foreground">
                        {cat.label.replace(" for Sale", "")}
                      </span>
                    </label>
                  ))}
                </div>

                <div className="space-y-2 rounded-xl border border-border p-3.5 bg-muted/30">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
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
                        className="cursor-pointer rounded border-input text-primary focus:ring-primary"
                      />
                      <span className="text-xs font-medium text-foreground">
                        {cat.label.replace(" Rentals", "")}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Pages per Category (Max 50)
                </label>
                <Input
                  type="number"
                  min="1"
                  max="50"
                  value={scanPages}
                  onChange={(e) => setScanPages(parseInt(e.target.value) || 1)}
                  className="bg-background border-input text-foreground"
                />
                <p className="mt-1 text-[11px] text-muted-foreground">
                  25 listings per page per selected category.
                </p>
              </div>
            </TabsContent>
          </Tabs>

          {/* Section 3: Progressive Disclosure Accordion for Crawler & Automation Settings */}
          <div className="rounded-xl border border-border bg-muted/20 overflow-hidden">
            <button
              type="button"
              onClick={() => setIsAdvancedOpen((prev) => !prev)}
              className="w-full flex items-center justify-between p-3.5 text-left cursor-pointer hover:bg-muted/40 transition"
              aria-expanded={isAdvancedOpen}
            >
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="h-4 w-4 text-primary" />
                <span className="text-xs font-bold text-foreground">
                  Crawler & Lead Pipeline Settings
                </span>
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                  {scanStrictLocation ? "Strict Match" : "Standard"} • {scanAllPages ? "All Pages" : `${scanPages}p`}
                  {autoFetchPhones ? " • Auto Phone" : ""}
                </span>
              </div>
              {isAdvancedOpen ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
            </button>

            {isAdvancedOpen && (
              <div className="p-3.5 pt-0 space-y-3.5 border-t border-border mt-1">
                {/* Strict Suburb Matching (Scoped Mode Only) */}
                {scanTab === "scoped" && (
                  <div className="pt-2">
                    <label className="flex cursor-pointer items-start gap-2.5">
                      <input
                        type="checkbox"
                        checked={scanStrictLocation}
                        onChange={(e) => setScanStrictLocation(e.target.checked)}
                        className="mt-0.5 cursor-pointer rounded border-input text-primary focus:ring-primary"
                      />
                      <div className="text-xs">
                        <span className="font-semibold text-foreground">
                          Strict Suburb Matching (Recommended)
                        </span>
                        <p className="mt-0.5 text-muted-foreground leading-relaxed">
                          Verifies the target location in the ad title or registered suburb to filter out description spam from distant locations.
                        </p>
                      </div>
                    </label>
                  </div>
                )}

                {/* Scan Depth in Scoped Mode */}
                {scanTab === "scoped" && (
                  <div className="pt-2 border-t border-border/60">
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-xs font-semibold text-foreground">
                        Scan Depth Limit
                      </label>
                      <label className="flex cursor-pointer items-center gap-1.5">
                        <input
                          type="checkbox"
                          checked={scanAllPages}
                          onChange={(e) => setScanAllPages(e.target.checked)}
                          className="cursor-pointer rounded border-input text-primary focus:ring-primary"
                        />
                        <span className="text-xs font-semibold text-primary">
                          Scan all matching pages
                        </span>
                      </label>
                    </div>

                    {scanAllPages ? (
                      <p className="text-[11px] text-muted-foreground">
                        Automatically discovers the total page count for this location and paginates in polite, rate-limited chunks.
                      </p>
                    ) : (
                      <div className="mt-1.5">
                        <Input
                          type="number"
                          min="1"
                          max="500"
                          value={scanPages}
                          onChange={(e) => setScanPages(parseInt(e.target.value) || 1)}
                          placeholder="e.g. 10"
                          className="h-8 text-xs bg-background border-input text-foreground"
                        />
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          25 listings per page (e.g. 10 pages = up to 250 listings).
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Auto Fetch Phone Numbers */}
                <div className="pt-2 border-t border-border/60">
                  <label className="flex cursor-pointer items-start gap-2.5">
                    <input
                      type="checkbox"
                      checked={autoFetchPhones}
                      onChange={(e) => setAutoFetchPhones(e.target.checked)}
                      className="mt-0.5 cursor-pointer rounded border-input text-primary focus:ring-primary"
                    />
                    <div className="text-xs">
                      <span className="font-semibold text-foreground flex items-center gap-1.5">
                        <PhoneCall className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                        <span>Auto-fetch owner contact numbers</span>
                      </span>
                      <p className="mt-0.5 text-muted-foreground leading-relaxed">
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
        <div className="border-t border-border bg-card px-5 py-3.5 sm:px-6 space-y-2.5">
          {/* Real-time Launch Summary Pill */}
          <div className="flex items-center justify-between text-xs rounded-lg bg-muted/60 px-3 py-2 text-foreground">
            <div className="flex items-center gap-2 truncate">
              <Sparkles className="h-3.5 w-3.5 text-primary shrink-0" />
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
              <span className="shrink-0 text-[10px] font-bold text-primary uppercase tracking-wider ml-2">
                + Phone Sync
              </span>
            )}
          </div>

          <div className="flex items-center justify-end gap-2.5">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={submitting}
              className="cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              form="scan-launcher-form"
              disabled={submitting}
              className="min-w-[130px] font-semibold cursor-pointer"
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
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
