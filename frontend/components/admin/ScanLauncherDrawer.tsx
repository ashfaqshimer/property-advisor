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
  CheckCircle2,
  Lock,
} from "lucide-react";
import { toast } from "sonner";
import { startProspectScan } from "../../lib/api";

const QUICK_LOCATIONS = [
  "Rajagiriya",
  "Colombo 7",
  "Battaramulla",
  "Dehiwala",
  "Kollupitiya",
  "Nugegoda",
  "Negombo",
  "Mount Lavinia",
];

const CATEGORIES = [
  { id: "land-for-sale", label: "Land for Sale", type: "sale" },
  { id: "houses-for-sale", label: "Houses for Sale", type: "sale" },
  { id: "apartments-for-sale", label: "Apartments for Sale", type: "sale" },
  { id: "house-rentals", label: "House Rentals", type: "rent" },
  { id: "apartment-rentals", label: "Apartment Rentals", type: "rent" },
];

export interface ScanLauncherDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onScanStarted: (jobId: string, info?: { keyword?: string; categories?: string[]; source?: string }) => void;
}

export function ScanLauncherDrawer({
  isOpen,
  onClose,
  onScanStarted,
}: ScanLauncherDrawerProps) {
  const [scanTab, setScanTab] = useState<"scoped" | "categories">("scoped");
  const [selectedSource, setSelectedSource] = useState<string>("ikman");
  const [scanLocationKeyword, setScanLocationKeyword] = useState("");
  const [scanPropertyCategory, setScanPropertyCategory] = useState<
    "all" | "lands" | "apartments" | "houses" | "commercial"
  >("all");
  const [scanStrictLocation, setScanStrictLocation] = useState(true);
  const [scanAllPages, setScanAllPages] = useState(true);
  const [scanCategories, setScanCategories] = useState<string[]>([
    "land-for-sale",
    "houses-for-sale",
    "apartments-for-sale",
  ]);
  const [scanPages, setScanPages] = useState(10);
  const [submitting, setSubmitting] = useState(false);

  const drawerRef = useRef<HTMLDivElement>(null);

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
          property_category: scanPropertyCategory,
          strict_location: scanStrictLocation,
          scan_all: scanAllPages,
          pages_per_category: scanAllPages ? undefined : scanPages,
        });

        toast.info(`Scanner started for '${kw}' (${selectedSource})`);
        onScanStarted(res.job_id, { keyword: kw, source: selectedSource });
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
        onScanStarted(res.job_id, { categories: scanCategories, source: selectedSource });
        onClose();
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to start scan");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end bg-[#1a2923]/60 backdrop-blur-xs transition-opacity duration-200"
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
        <div className="flex items-center justify-between border-b border-[#dce4df] dark:border-zinc-800 px-5 py-4 sm:px-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#19352b]/10 dark:bg-emerald-950/60 text-[#19352b] dark:text-emerald-400">
              <Search className="h-5 w-5" />
            </div>
            <div>
              <h2
                id="scan-drawer-title"
                className="text-lg font-bold tracking-tight text-[#1a2923] dark:text-zinc-100"
              >
                Start Real Estate Scan
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
            className="cursor-pointer rounded-lg p-1.5 text-[#718078] dark:text-zinc-400 hover:bg-[#f4f6f4] dark:hover:bg-zinc-800 hover:text-[#1a2923] dark:hover:text-white transition"
            aria-label="Close drawer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form
          id="scan-launcher-form"
          onSubmit={handleSubmit}
          className="flex-1 overflow-y-auto px-5 py-5 sm:px-6 space-y-6"
        >
          {/* Section 1: Data Sources */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold uppercase tracking-wider text-[#718078] dark:text-zinc-400">
                1. Target Portal / Source
              </label>
              <span className="text-[11px] text-[#64736b] dark:text-zinc-400">
                Multi-source ready
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* ikman.lk Source Card */}
              <button
                type="button"
                onClick={() => setSelectedSource("ikman")}
                className={`relative flex flex-col justify-between rounded-xl p-3.5 text-left transition cursor-pointer shadow-xs ${
                  selectedSource === "ikman"
                    ? "border-2 border-[#19352b] dark:border-emerald-600 bg-[#f4f6f4]/90 dark:bg-zinc-900/90"
                    : "border border-[#dce4df] dark:border-zinc-800 bg-white dark:bg-zinc-900/40 hover:border-[#19352b]/50"
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[#19352b] dark:bg-emerald-600 text-white font-bold text-xs">
                      <Globe className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-[#1a2923] dark:text-zinc-100 flex items-center gap-1.5">
                        <span>ikman.lk</span>
                        <span className="inline-flex items-center rounded-full bg-emerald-100 dark:bg-emerald-950 px-2 py-0.5 text-[10px] font-semibold text-emerald-800 dark:text-emerald-300">
                          Active
                        </span>
                      </div>
                    </div>
                  </div>
                  {selectedSource === "ikman" && (
                    <div className="h-5 w-5 rounded-full bg-[#19352b] dark:bg-emerald-600 flex items-center justify-center text-white">
                      <Check className="h-3 w-3 stroke-[3]" />
                    </div>
                  )}
                </div>
                <p className="mt-2 text-xs text-[#64736b] dark:text-zinc-400">
                  Real-time ad scraping, owner classification & direct phone enrichment.
                </p>
              </button>

              {/* LankaPropertyWeb (Future Source Preview) */}
              <button
                type="button"
                onClick={() => {
                  toast.info("LankaPropertyWeb integration is scheduled for upcoming release! ikman.lk is currently active.");
                }}
                className="relative flex flex-col justify-between rounded-xl border border-dashed border-[#cbd8d1] dark:border-zinc-800 bg-[#fbfcfb] dark:bg-zinc-900/20 p-3.5 opacity-70 hover:opacity-100 transition cursor-pointer text-left"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex h-7 w-7 items-center justify-center rounded-md bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 font-bold text-xs">
                      <Building2 className="h-4 w-4" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-[#64736b] dark:text-zinc-400 flex items-center gap-1.5">
                        <span>LankaPropertyWeb</span>
                        <span className="inline-flex items-center rounded-full bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 text-[10px] font-semibold text-zinc-600 dark:text-zinc-400">
                          Upcoming
                        </span>
                      </div>
                    </div>
                  </div>
                  <Lock className="h-4 w-4 text-zinc-400" />
                </div>
                <p className="mt-2 text-xs text-[#718078] dark:text-zinc-500">
                  Dedicated property portal connector coming in next release. Click to learn more.
                </p>
              </button>
            </div>
          </div>

          {/* Section 2: Scan Strategy */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-bold uppercase tracking-wider text-[#718078] dark:text-zinc-400">
                2. Search Strategy
              </label>
            </div>

            {/* Mode Switcher */}
            <div className="flex rounded-lg bg-[#f4f6f4] dark:bg-zinc-900 p-1 border border-[#dce4df] dark:border-zinc-800">
              <button
                type="button"
                onClick={() => setScanTab("scoped")}
                className={`flex-1 flex items-center justify-center gap-1.5 cursor-pointer rounded-md py-2 text-xs font-semibold transition ${
                  scanTab === "scoped"
                    ? "bg-white dark:bg-zinc-950 text-[#19352b] dark:text-zinc-100 shadow-xs font-bold"
                    : "text-[#64736b] dark:text-zinc-400 hover:text-[#1a2923] dark:hover:text-white"
                }`}
              >
                <MapPin className="h-3.5 w-3.5" />
                <span>Scoped Location (Recommended)</span>
              </button>
              <button
                type="button"
                onClick={() => setScanTab("categories")}
                className={`flex-1 flex items-center justify-center gap-1.5 cursor-pointer rounded-md py-2 text-xs font-semibold transition ${
                  scanTab === "categories"
                    ? "bg-white dark:bg-zinc-950 text-[#19352b] dark:text-zinc-100 shadow-xs font-bold"
                    : "text-[#64736b] dark:text-zinc-400 hover:text-[#1a2923] dark:hover:text-white"
                }`}
              >
                <Filter className="h-3.5 w-3.5" />
                <span>Broad Categories</span>
              </button>
            </div>

            {/* Tab 1: Scoped Location Scan */}
            {scanTab === "scoped" ? (
              <div className="mt-4 space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-[#1a2923] dark:text-zinc-200">
                    Location / Suburb Keyword <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative mt-1.5">
                    <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#718078] dark:text-zinc-400" />
                    <input
                      type="text"
                      required
                      value={scanLocationKeyword}
                      onChange={(e) => setScanLocationKeyword(e.target.value)}
                      placeholder="e.g. Rajagiriya, Colombo 7, Battaramulla, Kandy…"
                      className="w-full rounded-lg border border-[#cbd8d1] dark:border-zinc-700 bg-white dark:bg-zinc-900 pl-9 pr-3 py-2 text-sm outline-none focus:border-[#19352b] dark:focus:border-emerald-500 placeholder:text-[#a0aba4] dark:placeholder:text-zinc-500 text-[#1a2923] dark:text-zinc-200 transition"
                    />
                  </div>

                  {/* Quick Pill Suggestions */}
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] text-[#718078] dark:text-zinc-400">
                      Popular:
                    </span>
                    {QUICK_LOCATIONS.map((loc) => (
                      <button
                        key={loc}
                        type="button"
                        onClick={() => setScanLocationKeyword(loc)}
                        className={`cursor-pointer rounded-full border px-2.5 py-0.5 text-xs transition ${
                          scanLocationKeyword.toLowerCase() === loc.toLowerCase()
                            ? "border-[#19352b] dark:border-emerald-600 bg-[#19352b] text-white dark:bg-emerald-600"
                            : "border-[#dce4df] dark:border-zinc-800 bg-[#f4f6f4] dark:bg-zinc-900 text-[#64736b] dark:text-zinc-400 hover:border-[#19352b] hover:text-[#1a2923] dark:hover:text-white"
                        }`}
                      >
                        {loc}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-[#1a2923] dark:text-zinc-200">
                    Property Category
                  </label>
                  <select
                    value={scanPropertyCategory}
                    onChange={(e) => setScanPropertyCategory(e.target.value as any)}
                    className="mt-1.5 w-full cursor-pointer rounded-lg border border-[#cbd8d1] dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm outline-none focus:border-[#19352b] dark:focus:border-emerald-500 text-[#1a2923] dark:text-zinc-200"
                  >
                    <option value="all">All Properties (Default)</option>
                    <option value="houses">Houses</option>
                    <option value="apartments">Apartments</option>
                    <option value="lands">Lands</option>
                    <option value="commercial">Commercial Property</option>
                  </select>
                </div>

                {/* Strict Location Matching */}
                <div className="rounded-xl border border-[#dce4df] dark:border-zinc-800 p-3 bg-[#f8faf8] dark:bg-zinc-900/50">
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
                      <p className="mt-0.5 text-[#64736b] dark:text-zinc-400">
                        Verifies the target location in the ad title or registered suburb to filter out description spam from distant locations.
                      </p>
                    </div>
                  </label>
                </div>

                {/* Scan Depth */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-sm font-semibold text-[#1a2923] dark:text-zinc-200">
                      Scan Depth
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
                    <div className="rounded-lg border border-[#dce4df] dark:border-zinc-800 bg-[#f4f6f4] dark:bg-zinc-900/50 p-2.5 text-xs text-[#64736b] dark:text-zinc-400">
                      Auto-detects the total page count for this keyword and processes them in polite, rate-limited chunks.
                    </div>
                  ) : (
                    <div>
                      <input
                        type="number"
                        min="1"
                        max="500"
                        value={scanPages}
                        onChange={(e) => setScanPages(parseInt(e.target.value) || 1)}
                        placeholder="e.g. 10"
                        className="w-full rounded-lg border border-[#cbd8d1] dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm outline-none focus:border-[#19352b] dark:focus:border-emerald-500 text-[#1a2923] dark:text-zinc-200"
                      />
                      <p className="mt-1 text-xs text-[#718078] dark:text-zinc-400">
                        25 ads per page (e.g. 10 pages = up to 250 listings).
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* Tab 2: Broad Category Sweep */
              <div className="mt-4 space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-[#1a2923] dark:text-zinc-200 mb-2">
                    Marketplace Categories
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-2 rounded-xl border border-[#dce4df] dark:border-zinc-800 p-3 bg-[#f8faf8] dark:bg-zinc-900/50">
                      <div className="text-xs font-bold uppercase tracking-wider text-[#718078] dark:text-zinc-400 mb-2">
                        For Sale
                      </div>
                      {CATEGORIES.filter((c) => c.type === "sale").map((cat) => (
                        <label key={cat.id} className="flex cursor-pointer items-center gap-2">
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

                    <div className="space-y-2 rounded-xl border border-[#dce4df] dark:border-zinc-800 p-3 bg-[#f8faf8] dark:bg-zinc-900/50">
                      <div className="text-xs font-bold uppercase tracking-wider text-[#718078] dark:text-zinc-400 mb-2">
                        Rentals
                      </div>
                      {CATEGORIES.filter((c) => c.type === "rent").map((cat) => (
                        <label key={cat.id} className="flex cursor-pointer items-center gap-2">
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
                </div>

                <div>
                  <label className="block text-sm font-semibold text-[#1a2923] dark:text-zinc-200">
                    Pages per Category (Max 50)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    value={scanPages}
                    onChange={(e) => setScanPages(parseInt(e.target.value) || 1)}
                    className="mt-1.5 w-full rounded-lg border border-[#cbd8d1] dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm outline-none focus:border-[#19352b] dark:focus:border-emerald-500 text-[#1a2923] dark:text-zinc-200"
                  />
                  <p className="mt-1 text-xs text-[#718078] dark:text-zinc-400">
                    25 listings per page per category selected.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Section 3: Automated Pipeline Info */}
          <div className="rounded-xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/50 dark:bg-emerald-950/20 p-3.5">
            <div className="flex items-start gap-2.5">
              <Sparkles className="h-4 w-4 text-emerald-700 dark:text-emerald-400 shrink-0 mt-0.5" />
              <div className="text-xs text-emerald-900 dark:text-emerald-200">
                <span className="font-bold">Automated Lead Intelligence:</span>
                <p className="mt-0.5 text-emerald-800/90 dark:text-emerald-300/90 leading-relaxed">
                  Ads are automatically classified as Direct Owner vs. Real Estate Agent/Broker. Discovered leads will appear in your Prospects Inbox in real time.
                </p>
              </div>
            </div>
          </div>
        </form>

        {/* Sticky Footer */}
        <div className="border-t border-[#dce4df] dark:border-zinc-800 bg-[#fbfcfb] dark:bg-zinc-900/80 px-5 py-3.5 sm:px-6 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="cursor-pointer rounded-lg px-4 py-2 text-xs font-semibold text-[#64736b] dark:text-zinc-400 hover:bg-[#f4f6f4] dark:hover:bg-zinc-800 hover:text-[#1a2923] dark:hover:text-white transition"
          >
            Cancel
          </button>
          <button
            type="submit"
            form="scan-launcher-form"
            disabled={submitting}
            className="cursor-pointer inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#19352b] dark:bg-emerald-600 px-5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-[#132820] dark:hover:bg-emerald-500 disabled:opacity-50 transition"
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
  );
}
