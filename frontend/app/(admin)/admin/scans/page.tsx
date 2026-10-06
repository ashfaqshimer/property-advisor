"use client";

import { useEffect, useState, useCallback, Suspense } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { format, parseISO, formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import {
  Compass,
  Clock,
  Layers,
  Sparkles,
  Filter,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ChevronRight,
  ArrowLeft,
  ArrowRight,
  Plus,
  RefreshCw,
  Search,
  PhoneCall,
  Square,
  Bookmark,
  Globe,
  MapPin,
  Trash2,
  ShieldAlert,
  RotateCcw,
  Building2,
  Play,
  X,
  ChevronDown,
  ChevronUp,
  SlidersHorizontal,
  Check,
} from "lucide-react";

import {
  ScanJob,
  getScanJobs,
  stopScanJob,
  AuthUser,
  getCurrentUser,
  SiteConfiguration,
  getSiteConfiguration,
  updateSiteConfiguration,
  AutomatedScanner,
  triggerAutomatedScanner,
} from "../../../../lib/api";
import { ScanLauncherDrawer } from "../../../../components/admin/ScanLauncherDrawer";
import { SourceBadge } from "../../../../components/admin/SourceBadge";
import { IkmanIcon, LpwIcon } from "../../../../components/icons/PortalLogos";
import { Button } from "@/components/ui/button";

interface AutomatedScannerCardProps {
  scanner: AutomatedScanner;
  isRootOrAdmin: boolean;
  isExpanded: boolean;
  onToggleExpand: () => void;
  isToggling: boolean;
  onToggle: () => void;
  isRunning: boolean;
  onRunNow: () => void;
  isSaving: boolean;
  onSave: (patch: Partial<AutomatedScanner>) => void;
  onDelete: () => void;
}

function AutomatedScannerCard({
  scanner,
  isRootOrAdmin,
  isExpanded,
  onToggleExpand,
  isToggling,
  onToggle,
  isRunning,
  onRunNow,
  isSaving,
  onSave,
  onDelete,
}: AutomatedScannerCardProps) {
  const isDefault = scanner.id === "default-ikman" || scanner.id === "default-lpw";

  // Local draft state for editing
  const [frequency, setFrequency] = useState(scanner.frequency_hours);
  const [pages, setPages] = useState<number | string>(scanner.pages_to_scan);
  const [keyword, setKeyword] = useState(scanner.keyword || "");
  const [propertyTypes, setPropertyTypes] = useState<string[]>(
    scanner.property_types || ["house", "apartment"]
  );

  useEffect(() => {
    setFrequency(scanner.frequency_hours);
    setPages(scanner.pages_to_scan);
    setKeyword(scanner.keyword || "");
    setPropertyTypes(scanner.property_types || ["house", "apartment"]);
  }, [scanner]);

  const handleSaveForm = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      frequency_hours: frequency,
      pages_to_scan: Number(pages) || 1,
      keyword: keyword.trim() || null,
      property_types: propertyTypes.length > 0 ? propertyTypes : ["house", "apartment"],
    });
  };

  const handleCancelForm = () => {
    setFrequency(scanner.frequency_hours);
    setPages(scanner.pages_to_scan);
    setKeyword(scanner.keyword || "");
    setPropertyTypes(scanner.property_types || ["house", "apartment"]);
    onToggleExpand();
  };

  const renderLastRunStatus = () => {
    if (!scanner.last_run_at) {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 dark:bg-zinc-800 px-2.5 py-0.5 text-[11px] font-medium text-zinc-600 dark:text-zinc-400">
          <Clock className="h-3 w-3" /> Never executed
        </span>
      );
    }

    const runDate = parseISO(scanner.last_run_at);
    const timeAgo = formatDistanceToNow(runDate, { addSuffix: true });
    const isFailed = scanner.last_run_status === "failed";
    const isRunningState = scanner.last_run_status === "running";

    if (isRunningState) {
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 dark:bg-sky-950/60 px-2.5 py-0.5 text-[11px] font-semibold text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800 animate-pulse">
          <Loader2 className="h-3 w-3 animate-spin" /> In Progress
        </span>
      );
    }

    if (isFailed) {
      return (
        <span
          className="inline-flex items-center gap-1 rounded-full bg-rose-50 dark:bg-rose-950/60 px-2.5 py-0.5 text-[11px] font-semibold text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-900"
          title={scanner.last_run_status || "Failed"}
        >
          <AlertCircle className="h-3 w-3" /> Failed {timeAgo}
        </span>
      );
    }

    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
        <CheckCircle2 className="h-3 w-3" /> Completed {timeAgo}
      </span>
    );
  };

  return (
    <div
      className={`rounded-xl border transition shadow-2xs ${
        scanner.enabled
          ? "border-[#dce4df] dark:border-zinc-800 bg-white dark:bg-zinc-950 hover:border-[#19352b]/50"
          : "border-[#e5ebe7] dark:border-zinc-800 bg-[#fafbfa] dark:bg-zinc-900/40 opacity-85"
      }`}
    >
      {/* Top Main Row */}
      <div className="p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-start sm:items-center gap-3">
            <div
              className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition ${
                scanner.source === "lpw"
                  ? "bg-emerald-50/80 dark:bg-emerald-950/40 border-emerald-200/90 dark:border-emerald-900/50"
                  : "bg-teal-50/80 dark:bg-teal-950/40 border-teal-200/90 dark:border-teal-900/50"
              } ${!scanner.enabled ? "opacity-75" : ""}`}
            >
              {scanner.source === "lpw" ? (
                <LpwIcon className="h-6 w-6 shrink-0" />
              ) : (
                <IkmanIcon className="h-6 w-6 shrink-0 rounded-md" />
              )}
            </div>

            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm sm:text-base font-bold text-[#1a2923] dark:text-zinc-100">
                  {scanner.name}
                </h3>
                <SourceBadge source={scanner.source} />
                {scanner.keyword ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-zinc-100 dark:bg-zinc-800 text-[#19352b] dark:text-emerald-400 px-2 py-0.5 rounded-md border border-zinc-200 dark:border-zinc-700">
                    <MapPin className="h-3 w-3" />
                    <span>{scanner.keyword}</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[10px] font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 px-1.5 py-0.5 rounded">
                    Island-wide
                  </span>
                )}
                {isDefault && (
                  <span className="text-[10px] text-zinc-500 dark:text-zinc-400 font-medium hidden md:inline">
                    • Built-in
                  </span>
                )}
              </div>

              {/* Cadence & Depth Pills */}
              <div className="flex items-center gap-2 flex-wrap text-xs text-[#64736b] dark:text-zinc-400 mt-1">
                <span className="font-medium text-[#1a2923] dark:text-zinc-300">
                  Every {scanner.frequency_hours}h
                </span>
                <span>•</span>
                <span>{scanner.pages_to_scan} pages (~{scanner.pages_to_scan * 25} listings)</span>
                <span>•</span>
                <span className="capitalize">
                  {(scanner.property_types || ["house", "apartment"]).join(", ")}
                </span>
              </div>
            </div>
          </div>

          {/* Toggle Switch */}
          <div className="flex items-center gap-3 self-end sm:self-center">
            <div className="flex items-center space-x-2">
              <button
                type="button"
                role="switch"
                disabled={!isRootOrAdmin || isToggling}
                aria-checked={scanner.enabled}
                onClick={onToggle}
                className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[#19352b] disabled:opacity-50 ${
                  scanner.enabled
                    ? "bg-[#19352b] dark:bg-emerald-600"
                    : "bg-gray-300 dark:bg-zinc-700"
                }`}
                aria-label={`Toggle ${scanner.name}`}
              >
                <span
                  aria-hidden="true"
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    scanner.enabled ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
              <span className="text-xs font-semibold text-[#1a2923] dark:text-zinc-200 w-14">
                {isToggling ? (
                  <Loader2 className="h-3 w-3 animate-spin text-zinc-400" />
                ) : scanner.enabled ? (
                  <span className="text-emerald-700 dark:text-emerald-400">Active</span>
                ) : (
                  <span className="text-zinc-500 dark:text-zinc-400">Paused</span>
                )}
              </span>
            </div>
          </div>
        </div>

        {/* Live Execution Bar & Action Buttons */}
        <div className="mt-3.5 pt-3 border-t border-[#e5ebe7] dark:border-zinc-800/80 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1.5">
              <span className="text-[#718078] dark:text-zinc-400 text-[11px] font-medium">Last Run:</span>
              {renderLastRunStatus()}
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-[#718078] dark:text-zinc-400 text-[11px] font-medium">Next:</span>
              <span className="font-medium text-[#1a2923] dark:text-zinc-300 text-[11px]">
                {scanner.enabled
                  ? scanner.next_run_at
                    ? new Date(scanner.next_run_at).toLocaleString(undefined, {
                        dateStyle: "short",
                        timeStyle: "short",
                      })
                    : "On next scheduled cycle"
                  : "Paused"}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            {isRootOrAdmin && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onRunNow}
                disabled={isRunning}
                className="h-8 gap-1.5 px-3 text-xs font-semibold cursor-pointer"
              >
                {isRunning ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Play className="h-3.5 w-3.5 fill-current" />
                )}
                <span>{isRunning ? "Running..." : "Run Now"}</span>
              </Button>
            )}

            {isRootOrAdmin && (
              <Button
                type="button"
                variant={isExpanded ? "default" : "outline"}
                size="sm"
                onClick={onToggleExpand}
                className="h-8 gap-1.5 px-3 text-xs font-medium cursor-pointer"
              >
                <SlidersHorizontal className="h-3.5 w-3.5" />
                <span>{isExpanded ? "Close Config" : "Configure"}</span>
                {isExpanded ? <ChevronUp className="h-3.5 w-3.5 ml-0.5" /> : <ChevronDown className="h-3.5 w-3.5 ml-0.5" />}
              </Button>
            )}

            {!isDefault && isRootOrAdmin && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={onDelete}
                className="h-8 w-8 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 cursor-pointer"
                title="Delete this scanner"
                aria-label="Delete this scanner"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Expanded Inline Configuration Drawer */}
      {isExpanded && (
        <form
          onSubmit={handleSaveForm}
          className="border-t border-[#e5ebe7] dark:border-zinc-800 bg-[#f9faf9] dark:bg-zinc-900/60 p-4 sm:p-5 rounded-b-xl space-y-4 animate-in slide-in-from-top-2 duration-150"
        >
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#718078] dark:text-zinc-400 mb-1.5">
                Crawl Frequency
              </label>
              <select
                disabled={!isRootOrAdmin || isSaving}
                value={frequency}
                onChange={(e) => setFrequency(parseInt(e.target.value))}
                className="w-full rounded-lg border border-[#cbd8d1] dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 py-2 text-xs sm:text-sm outline-none focus:border-[#19352b] dark:focus:border-emerald-500 text-[#1a2923] dark:text-zinc-200"
              >
                <option value={6}>Every 6 Hours</option>
                <option value={12}>Every 12 Hours</option>
                <option value={18}>Every 18 Hours</option>
                <option value={24}>Every 24 Hours (Daily)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#718078] dark:text-zinc-400 mb-1.5">
                Pages to Scan (Depth)
              </label>
              <input
                type="number"
                min={1}
                max={50}
                disabled={!isRootOrAdmin || isSaving}
                value={pages}
                onChange={(e) => setPages(e.target.value === "" ? "" : parseInt(e.target.value) || "")}
                onBlur={() => {
                  if (pages === "" || Number(pages) < 1) setPages(1);
                  else if (Number(pages) > 50) setPages(50);
                }}
                className="w-full rounded-lg border border-[#cbd8d1] dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 py-2 text-xs sm:text-sm outline-none focus:border-[#19352b] dark:focus:border-emerald-500 text-[#1a2923] dark:text-zinc-200"
              />
              <span className="text-[10px] text-[#718078] dark:text-zinc-400">
                25 listings/page = ~{(Number(pages) || 0) * 25} ads
              </span>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#718078] dark:text-zinc-400 mb-1.5">
                Location Keyword (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. Colombo 7 (or empty for island-wide)"
                disabled={!isRootOrAdmin || isSaving}
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                className="w-full rounded-lg border border-[#cbd8d1] dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 py-2 text-xs sm:text-sm outline-none focus:border-[#19352b] dark:focus:border-emerald-500 text-[#1a2923] dark:text-zinc-200"
              />
            </div>
          </div>

          {/* Property Category Chips */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-[#718078] dark:text-zinc-400 mb-2">
              Property Categories
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {["house", "apartment", "land", "commercial"].map((type) => {
                const isChecked = propertyTypes.includes(type);
                return (
                  <button
                    key={type}
                    type="button"
                    disabled={!isRootOrAdmin || isSaving}
                    onClick={() => {
                      setPropertyTypes((prev) =>
                        prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
                      );
                    }}
                    className={`flex items-center justify-center gap-1.5 rounded-lg border py-2 px-2.5 text-xs font-semibold cursor-pointer transition ${
                      isChecked
                        ? "border-[#19352b] dark:border-emerald-600 bg-[#eef3f0] dark:bg-emerald-950/40 text-[#19352b] dark:text-emerald-300 font-bold"
                        : "border-[#dce4df] dark:border-zinc-800 bg-white dark:bg-zinc-900 text-[#1a2923] dark:text-zinc-300 hover:border-[#19352b]/40"
                    }`}
                  >
                    {isChecked ? (
                      <Check className="h-3.5 w-3.5 text-[#19352b] dark:text-emerald-400 stroke-[3]" />
                    ) : (
                      <span className="h-1.5 w-1.5 rounded-full bg-zinc-300 dark:bg-zinc-600" />
                    )}
                    <span className="capitalize">{type}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#e5ebe7] dark:border-zinc-800">
            <button
              type="button"
              onClick={handleCancelForm}
              disabled={isSaving}
              className="cursor-pointer rounded-lg px-3 py-1.5 text-xs font-semibold text-[#64736b] dark:text-zinc-400 hover:bg-[#eef3f0] dark:hover:bg-zinc-800 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="cursor-pointer inline-flex items-center gap-1.5 rounded-lg bg-[#19352b] dark:bg-emerald-700 px-4 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-[#132820] dark:hover:bg-emerald-600 transition disabled:opacity-50"
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Check className="h-3.5 w-3.5" />
                  <span>Save Settings</span>
                </>
              )}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

function ScanHistoryContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const tabParam = searchParams.get("tab") as "history" | "automation" | null;
  const [hubTab, setHubTab] = useState<"history" | "automation">(
    tabParam && ["history", "automation"].includes(tabParam) ? tabParam : "history"
  );

  const initialType = searchParams.get("type") || "scan";

  const [jobs, setJobs] = useState<ScanJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalJobs, setTotalJobs] = useState(0);
  const [filterType, setFilterType] = useState<string>(initialType);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isScanDrawerOpen, setIsScanDrawerOpen] = useState(false);

  const [siteConfig, setSiteConfig] = useState<SiteConfiguration | null>(null);
  const [runningScannerId, setRunningScannerId] = useState<string | null>(null);
  const [expandedScannerId, setExpandedScannerId] = useState<string | null>(null);
  const [savingScannerId, setSavingScannerId] = useState<string | null>(null);
  const [togglingScannerId, setTogglingScannerId] = useState<string | null>(null);
  const [savingRetention, setSavingRetention] = useState(false);

  const [isAddScannerModalOpen, setIsAddScannerModalOpen] = useState(false);
  const [addScannerName, setAddScannerName] = useState("");
  const [addScannerSource, setAddScannerSource] = useState("lpw");
  const [addScannerFrequency, setAddScannerFrequency] = useState(24);
  const [addScannerPages, setAddScannerPages] = useState<number | string>(5);
  const [addScannerTypes, setAddScannerTypes] = useState<string[]>(["house", "apartment"]);
  const [addScannerKeyword, setAddScannerKeyword] = useState("");
  const [addScannerEnabled, setAddScannerEnabled] = useState(true);
  const [addingScanner, setAddingScanner] = useState(false);

  const isRootOrAdmin = user?.role === "root" || user?.role === "admin";

  useEffect(() => {
    getCurrentUser()
      .then((u) => {
        if (!u || !["root", "admin"].includes(u.role)) {
          router.replace("/admin");
          return;
        }
        setUser(u);
      })
      .catch(() => {
        router.replace("/admin");
      });
    getSiteConfiguration()
      .then((cfg) => {
        if (cfg) setSiteConfig(cfg);
      })
      .catch(() => {});
  }, [router]);

  // Sync hub tab if URL param changes
  useEffect(() => {
    const currentTab = searchParams.get("tab") as "history" | "automation" | null;
    if (currentTab && ["history", "automation"].includes(currentTab)) {
      setHubTab(currentTab);
    }
  }, [searchParams]);

  const handleHubTabChange = (newTab: "history" | "automation") => {
    setHubTab(newTab);
    const params = new URLSearchParams(window.location.search);
    if (newTab === "history") {
      params.delete("tab");
    } else {
      params.set("tab", newTab);
    }
    const qs = params.toString();
    router.replace(qs ? `/admin/scans?${qs}` : "/admin/scans");
  };

  const configuredScanners: AutomatedScanner[] =
    siteConfig?.scanner_settings?.scanners && siteConfig.scanner_settings.scanners.length > 0
      ? siteConfig.scanner_settings.scanners
      : [
          {
            id: "default-ikman",
            name: "Ikman Portal Scanner",
            source: "ikman",
            enabled: siteConfig?.scanner_settings?.enabled ?? false,
            frequency_hours: siteConfig?.scanner_settings?.frequency_hours ?? 24,
            pages_to_scan: siteConfig?.scanner_settings?.pages_to_scan ?? 5,
            property_types: siteConfig?.scanner_settings?.property_types ?? ["house", "apartment"],
            last_run_at: siteConfig?.scanner_settings?.last_run_at,
            last_run_status: siteConfig?.scanner_settings?.last_run_status,
            next_run_at: siteConfig?.scanner_settings?.next_run_at,
          },
          {
            id: "default-lpw",
            name: "LankaPropertyWeb Scanner",
            source: "lpw",
            enabled: false,
            frequency_hours: 24,
            pages_to_scan: 5,
            property_types: ["house", "apartment"],
            keyword: null,
            last_run_at: null,
            last_run_status: null,
            next_run_at: null,
          },
        ];

  // Helper to persist updated scanner list directly to site configuration
  const persistScanners = async (updatedList: AutomatedScanner[], successMessage?: string) => {
    if (!siteConfig) return;
    const anyEnabled = updatedList.some((s) => s.enabled);
    const settingsToSave = {
      ...(siteConfig.scanner_settings || {
        frequency_hours: 24,
        pages_to_scan: 5,
        property_types: ["house", "apartment"],
      }),
      enabled: anyEnabled,
      scanners: updatedList,
    };
    const updated = await updateSiteConfiguration({
      scanner_settings: settingsToSave,
      prospect_retention_days: siteConfig.prospect_retention_days,
    });
    setSiteConfig(updated);
    if (successMessage) toast.success(successMessage);
  };

  const handleToggleScanner = async (scannerId: string) => {
    if (!isRootOrAdmin || !siteConfig) return;
    setTogglingScannerId(scannerId);
    const target = configuredScanners.find((sc) => sc.id === scannerId);
    const nextState = !target?.enabled;
    const updated = configuredScanners.map((sc) =>
      sc.id === scannerId ? { ...sc, enabled: nextState } : sc
    );
    try {
      await persistScanners(updated, `Scanner "${target?.name}" ${nextState ? "activated" : "paused"}`);
    } catch (err: any) {
      toast.error(err.message || "Failed to update scanner status");
    } finally {
      setTogglingScannerId(null);
    }
  };

  const handleSaveScannerCard = async (scannerId: string, patch: Partial<AutomatedScanner>) => {
    if (!isRootOrAdmin || !siteConfig) return;
    setSavingScannerId(scannerId);
    const updated = configuredScanners.map((sc) =>
      sc.id === scannerId ? { ...sc, ...patch } : sc
    );
    try {
      await persistScanners(updated, "Scanner schedule settings saved successfully!");
      setExpandedScannerId(null);
    } catch (err: any) {
      toast.error(err.message || "Failed to save scanner settings");
    } finally {
      setSavingScannerId(null);
    }
  };

  const handleDeleteScanner = async (scannerId: string) => {
    if (!isRootOrAdmin || !siteConfig) return;
    const target = configuredScanners.find((sc) => sc.id === scannerId);
    if (!window.confirm(`Delete scanner "${target?.name || scannerId}"? This will cancel its automated runs.`)) return;
    const updated = configuredScanners.filter((sc) => sc.id !== scannerId);
    try {
      await persistScanners(updated, `Scanner "${target?.name}" removed.`);
      if (expandedScannerId === scannerId) setExpandedScannerId(null);
    } catch (err: any) {
      toast.error(err.message || "Failed to remove scanner");
    }
  };

  const handleRunScannerNow = async (scannerId: string, scannerName: string) => {
    setRunningScannerId(scannerId);
    try {
      await triggerAutomatedScanner(scannerId);
      toast.success(`Started scan for "${scannerName}" in background!`, {
        action: {
          label: "View in History",
          onClick: () => handleHubTabChange("history"),
        },
      });
      fetchJobs(true);
    } catch (err: any) {
      toast.error(err.message || `Failed to run scanner "${scannerName}"`);
    } finally {
      setRunningScannerId(null);
    }
  };

  const handleAddAdditionalScanner = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addScannerName.trim()) {
      toast.error("Please enter a name for the scanner.");
      return;
    }
    setAddingScanner(true);
    const newScanner: AutomatedScanner = {
      id: `scanner-${Date.now()}`,
      name: addScannerName.trim(),
      source: addScannerSource,
      enabled: addScannerEnabled,
      frequency_hours: addScannerFrequency,
      pages_to_scan: Number(addScannerPages) || 1,
      property_types: addScannerTypes.length > 0 ? addScannerTypes : ["house", "apartment"],
      keyword: addScannerKeyword.trim() || null,
      last_run_at: null,
      last_run_status: null,
      next_run_at: null,
    };
    const currentList = configuredScanners;
    const updated = [...currentList, newScanner];
    try {
      await persistScanners(updated, `Scanner "${newScanner.name}" created and saved!`);
      setIsAddScannerModalOpen(false);
      setAddScannerName("");
      setAddScannerKeyword("");
    } catch (err: any) {
      toast.error(err.message || "Failed to create scanner");
    } finally {
      setAddingScanner(false);
    }
  };

  const handleSaveRetention = async () => {
    if (!siteConfig) return;
    setSavingRetention(true);
    try {
      const updated = await updateSiteConfiguration({
        scanner_settings: siteConfig.scanner_settings,
        prospect_retention_days: siteConfig.prospect_retention_days,
      });
      setSiteConfig(updated);
      toast.success("Retention policy updated successfully.");
    } catch (err: any) {
      toast.error(err.message || "Failed to update retention policy");
    } finally {
      setSavingRetention(false);
    }
  };





  // Open drawer if navigated with ?new=1 or ?new=true
  useEffect(() => {
    const isNew = searchParams.get("new");
    if (isNew === "true" || isNew === "1") {
      setIsScanDrawerOpen(true);
    }
  }, [searchParams]);

  // Sync state if URL param changes
  useEffect(() => {
    const typeFromUrl = searchParams.get("type");
    if (typeFromUrl && ["scan", "phone_fetch", "all"].includes(typeFromUrl)) {
      setFilterType(typeFromUrl);
    }
  }, [searchParams]);

  const handleTabChange = (newType: string) => {
    setFilterType(newType);
    setPage(1);
    const params = new URLSearchParams(window.location.search);
    if (newType === "scan") {
      params.delete("type");
    } else {
      params.set("type", newType);
    }
    const queryString = params.toString();
    router.replace(queryString ? `/admin/scans?${queryString}` : "/admin/scans");
  };

  const fetchJobs = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true);
    else setRefreshing(true);

    try {
      const typeParam = filterType === "all" ? undefined : filterType;
      const data = await getScanJobs(page, 20, typeParam);
      setJobs(data.items);
      setTotalPages(data.total_pages);
      setTotalJobs(data.total);
    } catch {
      toast.error("Failed to load scan history");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [page, filterType]);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  // Poll if any job is running
  useEffect(() => {
    const hasRunning = jobs.some((j) => j.status === "running");
    if (!hasRunning) return;

    const timer = setInterval(() => {
      fetchJobs(true);
    }, 4000);

    return () => clearInterval(timer);
  }, [jobs, fetchJobs]);

  const isPhoneTab = filterType === "phone_fetch";

  // Calculate summary metrics
  const totalRuns = totalJobs;
  const totalDiscovered = jobs.reduce((acc, j) => acc + (j.new_count || 0), 0);
  const totalFiltered = jobs.reduce((acc, j) => acc + (j.filtered_count || 0), 0);
  const totalFound = jobs.reduce((acc, j) => acc + (j.total_found || 0), 0);
  const phoneSuccessRate = totalFound > 0 ? Math.round((totalDiscovered / totalFound) * 100) : 0;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
            <CheckCircle2 className="h-3.5 w-3.5" /> Completed
          </span>
        );
      case "running":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-50 dark:bg-sky-950/60 px-2.5 py-1 text-xs font-semibold text-sky-700 dark:text-sky-400 border border-sky-200 dark:border-sky-800 animate-pulse">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> In Progress
          </span>
        );
      case "cancelled":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 dark:bg-amber-950/60 px-2.5 py-1 text-xs font-semibold text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
            <Square className="h-3 w-3 fill-current" /> Stopped
          </span>
        );
      case "failed":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 dark:bg-rose-950/60 px-2.5 py-1 text-xs font-semibold text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800">
            <AlertCircle className="h-3.5 w-3.5" /> Failed
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800 px-2.5 py-1 text-xs font-semibold text-zinc-600 dark:text-zinc-400">
            {status}
          </span>
        );
    }
  };

  const handleStopJob = async (jobId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await stopScanJob(jobId);
      toast.info("Job stop requested");
      fetchJobs(true);
    } catch (err: any) {
      toast.error(err.message || "Failed to stop job");
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Breadcrumb */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-medium text-[#64736b] dark:text-zinc-400 mb-1">
            <Link href="/admin/prospects" className="hover:text-[#19352b] dark:hover:text-emerald-400 transition flex items-center gap-1">
              <ArrowLeft className="h-3.5 w-3.5" /> Back to Prospects
            </Link>
            <span>/</span>
            <span>Scanner Hub</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-[#1a2923] dark:text-zinc-100 flex items-center gap-2">
            <Compass className="h-6 w-6 text-[#19352b] dark:text-emerald-400" />
            <span>Scanner & Automation Hub</span>
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-[#64736b] dark:text-zinc-400">
            Launch multi-source property scans, configure automated background crawler schedules, and manage search presets.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {hubTab === "history" && (
            <button
              onClick={() => fetchJobs()}
              disabled={refreshing}
              className="cursor-pointer inline-flex items-center gap-1.5 rounded-lg border border-[#dce4df] dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 py-2 text-xs font-semibold text-[#1a2923] dark:text-zinc-200 shadow-sm hover:bg-[#f4f6f4] dark:hover:bg-zinc-800 disabled:opacity-50 transition"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
              <span>Refresh</span>
            </button>
          )}

          <button
            onClick={() => setIsScanDrawerOpen(true)}
            className="cursor-pointer inline-flex items-center gap-1.5 rounded-lg bg-[#19352b] dark:bg-emerald-700 px-3.5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-[#132820] dark:hover:bg-emerald-600 transition"
          >
            <Plus className="h-4 w-4" />
            <span>New Scan</span>
          </button>
        </div>
      </div>

      {/* Top-Level Hub Navigation Tabs */}
      <div className="flex border-b border-[#dce4df] dark:border-zinc-800 space-x-1 overflow-x-auto whitespace-nowrap [&::-webkit-scrollbar]:hidden" style={{ scrollbarWidth: "none" }}>
        <button
          onClick={() => handleHubTabChange("history")}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold transition cursor-pointer ${
            hubTab === "history"
              ? "border-[#19352b] text-[#19352b] dark:border-emerald-500 dark:text-emerald-400"
              : "border-transparent text-[#64736b] dark:text-zinc-400 hover:text-[#1a2923] dark:hover:text-zinc-200"
          }`}
        >
          <Clock className="h-4 w-4" />
          <span>Run History & Audits</span>
        </button>

        <button
          onClick={() => handleHubTabChange("automation")}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold transition cursor-pointer ${
            hubTab === "automation"
              ? "border-[#19352b] text-[#19352b] dark:border-emerald-500 dark:text-emerald-400"
              : "border-transparent text-[#64736b] dark:text-zinc-400 hover:text-[#1a2923] dark:hover:text-zinc-200"
          }`}
        >
          <Sparkles className="h-4 w-4" />
          <span>Automation & Scheduler</span>
          {siteConfig?.scanner_settings?.enabled && (
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" title="Background scanner active" />
          )}
        </button>
      </div>

      {hubTab === "history" && (
        <div className="space-y-6">



      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {isPhoneTab ? (
          <>
            <div className="rounded-xl border border-[#dce4df] dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 shadow-sm">
              <div className="flex items-center justify-between text-[#64736b] dark:text-zinc-400">
                <span className="text-xs font-medium uppercase tracking-wider">Sync Runs</span>
                <PhoneCall className="h-4 w-4 text-[#19352b] dark:text-emerald-500" />
              </div>
              <div className="mt-2 text-2xl font-bold text-[#1a2923] dark:text-zinc-100">{totalRuns}</div>
              <p className="mt-1 text-[11px] text-[#64736b] dark:text-zinc-400">Recorded phone sync jobs</p>
            </div>

            <div className="rounded-xl border border-[#dce4df] dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 shadow-sm">
              <div className="flex items-center justify-between text-[#64736b] dark:text-zinc-400">
                <span className="text-xs font-medium uppercase tracking-wider">Phones Retrieved</span>
                <Sparkles className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div className="mt-2 text-2xl font-bold text-emerald-600 dark:text-emerald-400">+{totalDiscovered}</div>
              <p className="mt-1 text-[11px] text-[#64736b] dark:text-zinc-400">Owner contacts uncovered</p>
            </div>

            <div className="rounded-xl border border-[#dce4df] dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 shadow-sm">
              <div className="flex items-center justify-between text-[#64736b] dark:text-zinc-400">
                <span className="text-xs font-medium uppercase tracking-wider">Owners Evaluated</span>
                <Layers className="h-4 w-4 text-sky-600 dark:text-sky-400" />
              </div>
              <div className="mt-2 text-2xl font-bold text-sky-600 dark:text-sky-400">{totalFound}</div>
              <p className="mt-1 text-[11px] text-[#64736b] dark:text-zinc-400">Prospect ad details fetched</p>
            </div>

            <div className="rounded-xl border border-[#dce4df] dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 shadow-sm">
              <div className="flex items-center justify-between text-[#64736b] dark:text-zinc-400">
                <span className="text-xs font-medium uppercase tracking-wider">Overall Yield</span>
                <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div className="mt-2 text-2xl font-bold text-emerald-700 dark:text-emerald-400">{phoneSuccessRate}%</div>
              <p className="mt-1 text-[11px] text-[#64736b] dark:text-zinc-400">Phone success rate</p>
            </div>
          </>
        ) : (
          <>
            <div className="rounded-xl border border-[#dce4df] dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 shadow-sm">
              <div className="flex items-center justify-between text-[#64736b] dark:text-zinc-400">
                <span className="text-xs font-medium uppercase tracking-wider">Total Scans Run</span>
                <Compass className="h-4 w-4 text-[#19352b] dark:text-emerald-500" />
              </div>
              <div className="mt-2 text-2xl font-bold text-[#1a2923] dark:text-zinc-100">{totalRuns}</div>
              <p className="mt-1 text-[11px] text-[#64736b] dark:text-zinc-400">Recorded scan jobs</p>
            </div>

            <div className="rounded-xl border border-[#dce4df] dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 shadow-sm">
              <div className="flex items-center justify-between text-[#64736b] dark:text-zinc-400">
                <span className="text-xs font-medium uppercase tracking-wider">Page Yield (New)</span>
                <Sparkles className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div className="mt-2 text-2xl font-bold text-emerald-600 dark:text-emerald-400">+{totalDiscovered}</div>
              <p className="mt-1 text-[11px] text-[#64736b] dark:text-zinc-400">New prospects discovered</p>
            </div>

            <div className="rounded-xl border border-[#dce4df] dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 shadow-sm">
              <div className="flex items-center justify-between text-[#64736b] dark:text-zinc-400">
                <span className="text-xs font-medium uppercase tracking-wider">Location Discards</span>
                <Filter className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              </div>
              <div className="mt-2 text-2xl font-bold text-amber-600 dark:text-amber-400">{totalFiltered}</div>
              <p className="mt-1 text-[11px] text-[#64736b] dark:text-zinc-400">Keyword spam filtered out</p>
            </div>

            <div className="rounded-xl border border-[#dce4df] dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 shadow-sm">
              <div className="flex items-center justify-between text-[#64736b] dark:text-zinc-400">
                <span className="text-xs font-medium uppercase tracking-wider">Total Evaluated</span>
                <Layers className="h-4 w-4 text-sky-600 dark:text-sky-400" />
              </div>
              <div className="mt-2 text-2xl font-bold text-sky-600 dark:text-sky-400">{totalFound}</div>
              <p className="mt-1 text-[11px] text-[#64736b] dark:text-zinc-400">Listings processed on ikman</p>
            </div>
          </>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center justify-between border-b border-[#dce4df] dark:border-zinc-800 pb-3">
        <div className="flex items-center gap-1.5 sm:gap-2">
          <button
            onClick={() => handleTabChange("scan")}
            className={`cursor-pointer rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              filterType === "scan"
                ? "bg-[#19352b] text-white dark:bg-emerald-700"
                : "text-[#64736b] hover:bg-[#f4f6f4] dark:text-zinc-400 dark:hover:bg-zinc-800"
            }`}
          >
            Property Scans
          </button>
          <button
            onClick={() => handleTabChange("phone_fetch")}
            className={`cursor-pointer rounded-lg px-3 py-1.5 text-xs font-semibold transition flex items-center gap-1.5 ${
              filterType === "phone_fetch"
                ? "bg-[#19352b] text-white dark:bg-emerald-700"
                : "text-[#64736b] hover:bg-[#f4f6f4] dark:text-zinc-400 dark:hover:bg-zinc-800"
            }`}
          >
            <PhoneCall className="h-3 w-3" />
            <span>Phone Syncs</span>
          </button>
          <button
            onClick={() => handleTabChange("all")}
            className={`cursor-pointer rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              filterType === "all"
                ? "bg-[#19352b] text-white dark:bg-emerald-700"
                : "text-[#64736b] hover:bg-[#f4f6f4] dark:text-zinc-400 dark:hover:bg-zinc-800"
            }`}
          >
            All Activity
          </button>
        </div>

        <span className="text-xs text-[#64736b] dark:text-zinc-400 hidden sm:inline">
          Showing {jobs.length} of {totalJobs} jobs
        </span>
      </div>

      {/* Scans Listing */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-24 text-[#64736b] dark:text-zinc-400">
          <Loader2 className="h-8 w-8 animate-spin mb-3 text-[#19352b] dark:text-emerald-500" />
          <p className="text-sm font-medium">Loading {isPhoneTab ? "phone sync logs" : "scan history"}...</p>
        </div>
      ) : jobs.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[#dce4df] dark:border-zinc-800 bg-white/50 dark:bg-zinc-900/50 py-16 text-center">
          {isPhoneTab ? (
            <PhoneCall className="h-10 w-10 text-[#64736b] dark:text-zinc-500 mb-3" />
          ) : (
            <Compass className="h-10 w-10 text-[#64736b] dark:text-zinc-500 mb-3" />
          )}
          <h3 className="text-base font-semibold text-[#1a2923] dark:text-zinc-200">
            {isPhoneTab ? "No phone sync jobs found" : "No property scan jobs found"}
          </h3>
          <p className="mt-1 text-xs sm:text-sm text-[#64736b] dark:text-zinc-400 max-w-sm">
            {isPhoneTab
              ? "Trigger 'Sync Phone Numbers' from the Prospects page or inside any scan drilldown to view automated contact sync outcomes here."
              : "Launch your first scoped property scan to start seeing automated discovery outcomes and metrics here."}
          </p>
          {isPhoneTab ? (
            <Link
              href="/admin/prospects"
              className="cursor-pointer mt-4 inline-flex items-center gap-2 rounded-lg bg-[#19352b] dark:bg-emerald-700 px-4 py-2 text-xs font-semibold text-white shadow hover:bg-[#132820] dark:hover:bg-emerald-600 transition"
            >
              <PhoneCall className="h-4 w-4" /> Go to Prospects
            </Link>
          ) : (
            <button
              onClick={() => setIsScanDrawerOpen(true)}
              className="cursor-pointer mt-4 inline-flex items-center gap-2 rounded-lg bg-[#19352b] dark:bg-emerald-700 px-4 py-2 text-xs font-semibold text-white shadow hover:bg-[#132820] dark:hover:bg-emerald-600 transition"
            >
              <Plus className="h-4 w-4" /> Start New Scan
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {/* Mobile Card View (< md) */}
          <div className="grid grid-cols-1 gap-3 md:hidden">
            {jobs.map((job) => {
              const createdDate = parseISO(job.created_at);
              const isPhone = job.job_type === "phone_fetch";
              const isScoped = !!job.keyword;

              if (isPhone) {
                const yieldPct = (job.total_found || 0) > 0 ? Math.round(((job.new_count || 0) / (job.total_found || 1)) * 100) : 0;
                return (
                  <div
                    key={job.id}
                    className="block rounded-xl border border-[#dce4df] dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="inline-flex items-center gap-1 rounded bg-sky-100 dark:bg-sky-950/70 px-2 py-0.5 text-xs font-bold text-sky-800 dark:text-sky-300">
                            <PhoneCall className="h-3 w-3" /> Phone Sync
                          </span>
                          {isScoped && (
                            <span className="text-xs font-semibold text-[#19352b] dark:text-emerald-400">
                              📍 {job.keyword}
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-[11px] text-[#64736b] dark:text-zinc-400">
                          {formatDistanceToNow(createdDate, { addSuffix: true })} • by {job.created_by_name || "System"}
                        </p>
                      </div>
                      {getStatusBadge(job.status)}
                    </div>

                    {/* Phone Sync Outcome Metrics */}
                    <div className="mt-3 grid grid-cols-4 gap-2 rounded-lg bg-[#f4f6f4] dark:bg-zinc-800/60 p-2.5 text-center text-xs">
                      <div>
                        <span className="block text-[10px] uppercase text-[#64736b] dark:text-zinc-400">Evaluated</span>
                        <span className="font-semibold text-[#1a2923] dark:text-zinc-200">
                          {job.total_found || job.pages_scanned || 0}
                        </span>
                      </div>
                      <div>
                        <span className="block text-[10px] uppercase text-[#64736b] dark:text-zinc-400">Phones</span>
                        <span className="font-bold text-emerald-600 dark:text-emerald-400">
                          +{job.new_count || 0}
                        </span>
                      </div>
                      <div>
                        <span className="block text-[10px] uppercase text-[#64736b] dark:text-zinc-400">Yield</span>
                        <span className="font-bold text-[#19352b] dark:text-emerald-400">
                          {yieldPct}%
                        </span>
                      </div>
                      <div>
                        <span className="block text-[10px] uppercase text-[#64736b] dark:text-zinc-400">Duration</span>
                        <span className="font-medium text-[#1a2923] dark:text-zinc-200">
                          {job.duration_seconds ? `${job.duration_seconds}s` : "—"}
                        </span>
                      </div>
                    </div>

                    <div className="mt-2 flex items-center justify-between text-xs">
                      <span className="text-[#64736b] dark:text-zinc-400 line-clamp-1 italic">{job.progress}</span>
                      {job.status === "running" && (
                        <button
                          onClick={(e) => handleStopJob(job.id, e)}
                          className="cursor-pointer inline-flex items-center gap-1 rounded bg-rose-600 dark:bg-rose-700 px-2 py-1 text-[11px] font-semibold text-white shadow-sm hover:bg-rose-700 transition shrink-0 ml-2"
                        >
                          <Square className="h-2.5 w-2.5 fill-current" />
                          <span>Stop</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              }

              return (
                <Link
                  key={job.id}
                  href={`/admin/scans/${job.id}`}
                  className="block rounded-xl border border-[#dce4df] dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 shadow-sm hover:border-[#19352b] dark:hover:border-emerald-600 transition"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        {isScoped ? (
                          <span className="inline-flex items-center gap-1 rounded bg-[#19352b]/10 dark:bg-emerald-950 px-2 py-0.5 text-xs font-bold text-[#19352b] dark:text-emerald-400">
                            📍 {job.keyword}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 text-xs font-medium text-zinc-700 dark:text-zinc-300">
                            Broad Scan
                          </span>
                        )}
                        {job.property_category && (
                          <span className="capitalize text-xs text-[#64736b] dark:text-zinc-400">
                            • {job.property_category}
                          </span>
                        )}
                        <SourceBadge source={job.source || "ikman"} />
                      </div>
                      <p className="mt-1 text-[11px] text-[#64736b] dark:text-zinc-400">
                        {formatDistanceToNow(createdDate, { addSuffix: true })} • by {job.created_by_name || "System"}
                      </p>
                    </div>
                    {getStatusBadge(job.status)}
                  </div>

                  {/* 4-Grid Outcome Metrics */}
                  <div className="mt-3 grid grid-cols-4 gap-2 rounded-lg bg-[#f4f6f4] dark:bg-zinc-800/60 p-2.5 text-center text-xs">
                    <div>
                      <span className="block text-[10px] uppercase text-[#64736b] dark:text-zinc-400">Pages</span>
                      <span className="font-semibold text-[#1a2923] dark:text-zinc-200">
                        {job.pages_scanned}
                      </span>
                    </div>
                    <div>
                      <span className="block text-[10px] uppercase text-[#64736b] dark:text-zinc-400">New</span>
                      <span className="font-bold text-emerald-600 dark:text-emerald-400">
                        +{job.new_count}
                      </span>
                    </div>
                    <div>
                      <span className="block text-[10px] uppercase text-[#64736b] dark:text-zinc-400">Filtered</span>
                      <span className="font-medium text-amber-600 dark:text-amber-400">
                        {job.filtered_count}
                      </span>
                    </div>
                    <div>
                      <span className="block text-[10px] uppercase text-[#64736b] dark:text-zinc-400">Duration</span>
                      <span className="font-medium text-[#1a2923] dark:text-zinc-200">
                        {job.duration_seconds ? `${job.duration_seconds}s` : "—"}
                      </span>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between text-xs font-semibold text-[#19352b] dark:text-emerald-400 pt-1">
                    <span>View Prospects & Outcomes</span>
                    <div className="flex items-center gap-1.5">
                      {job.status === "running" && (
                        <button
                          onClick={(e) => handleStopJob(job.id, e)}
                          className="cursor-pointer inline-flex items-center gap-1 rounded bg-rose-600 dark:bg-rose-700 px-2 py-1 text-[11px] font-semibold text-white shadow-sm hover:bg-rose-700 transition"
                        >
                          <Square className="h-2.5 w-2.5 fill-current" />
                          <span>Stop</span>
                        </button>
                      )}
                      <ChevronRight className="h-4 w-4" />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>

          {/* Desktop Table View (>= md) */}
          <div className="hidden md:block overflow-hidden rounded-xl border border-[#dce4df] dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm">
            <table className="w-full text-left text-sm text-[#1a2923] dark:text-zinc-200">
              <thead className="bg-[#f4f6f4] dark:bg-zinc-800/50 text-[11px] font-semibold uppercase tracking-wider text-[#64736b] dark:text-zinc-400 border-b border-[#dce4df] dark:border-zinc-800">
                {isPhoneTab ? (
                  <tr>
                    <th className="px-5 py-3.5">Sync Scope & Target</th>
                    <th className="px-4 py-3.5">Status</th>
                    <th className="px-4 py-3.5">Owners Checked</th>
                    <th className="px-4 py-3.5">Phones Found</th>
                    <th className="px-4 py-3.5">Yield</th>
                    <th className="px-4 py-3.5">Duration</th>
                    <th className="px-4 py-3.5">Triggered By</th>
                    <th className="px-4 py-3.5">Date</th>
                    <th className="px-5 py-3.5">Outcome Summary</th>
                  </tr>
                ) : (
                  <tr>
                    <th className="px-5 py-3.5">Scope & Location</th>
                    <th className="px-4 py-3.5">Status</th>
                    <th className="px-4 py-3.5">Pages Scanned</th>
                    <th className="px-4 py-3.5">New Prospects</th>
                    <th className="px-4 py-3.5">Filtered</th>
                    <th className="px-4 py-3.5">Duration</th>
                    <th className="px-4 py-3.5">Triggered By</th>
                    <th className="px-4 py-3.5">Date</th>
                    <th className="px-5 py-3.5 text-right">Actions</th>
                  </tr>
                )}
              </thead>
              <tbody className="divide-y divide-[#dce4df] dark:divide-zinc-800">
                {jobs.map((job) => {
                  const createdDate = parseISO(job.created_at);
                  const isPhone = job.job_type === "phone_fetch";
                  const isScoped = !!job.keyword;

                  if (isPhone) {
                    const yieldPct = (job.total_found || 0) > 0 ? Math.round(((job.new_count || 0) / (job.total_found || 1)) * 100) : 0;
                    return (
                      <tr key={job.id} className="hover:bg-[#f9faf9] dark:hover:bg-zinc-800/40 transition">
                        <td className="px-5 py-4">
                          <div className="font-semibold text-[#1a2923] dark:text-zinc-100 flex items-center gap-1.5">
                            <PhoneCall className="h-4 w-4 text-sky-600 dark:text-sky-400" />
                            {isScoped ? (
                              <span>Scan: {job.keyword}</span>
                            ) : (
                              <span>Global Owner Sync</span>
                            )}
                          </div>
                          <div className="text-xs text-[#64736b] dark:text-zinc-400 mt-0.5">
                            {isScoped ? "Scoped to scan prospects" : "All unfetched owner prospects"}
                          </div>
                        </td>

                        <td className="px-4 py-4">{getStatusBadge(job.status)}</td>

                        <td className="px-4 py-4 font-semibold text-xs text-[#1a2923] dark:text-zinc-200">
                          {job.total_found || job.pages_scanned || 0}
                        </td>

                        <td className="px-4 py-4">
                          <span className="inline-flex items-center rounded-md bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 text-xs font-bold text-emerald-700 dark:text-emerald-400">
                            +{job.new_count || 0}
                          </span>
                        </td>

                        <td className="px-4 py-4 text-xs font-bold text-[#19352b] dark:text-emerald-400">
                          {yieldPct}%
                        </td>

                        <td className="px-4 py-4 text-xs text-[#64736b] dark:text-zinc-400">
                          {job.duration_seconds ? `${job.duration_seconds}s` : "—"}
                        </td>

                        <td className="px-4 py-4 text-xs font-medium text-[#1a2923] dark:text-zinc-300">
                          {job.created_by_name || "System"}
                        </td>

                        <td className="px-4 py-4 text-xs text-[#64736b] dark:text-zinc-400" title={format(createdDate, "yyyy-MM-dd HH:mm:ss")}>
                          {formatDistanceToNow(createdDate, { addSuffix: true })}
                        </td>

                        <td className="px-5 py-4 text-xs text-[#64736b] dark:text-zinc-400">
                          <div className="flex items-center justify-between gap-2">
                            <span className="max-w-xs truncate" title={job.progress}>{job.progress}</span>
                            {job.status === "running" && (
                              <button
                                onClick={(e) => handleStopJob(job.id, e)}
                                className="cursor-pointer inline-flex items-center gap-1 rounded border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/60 px-2 py-1 text-xs font-semibold text-rose-700 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/60 transition shrink-0"
                              >
                                <Square className="h-3 w-3 fill-current" />
                                <span>Stop</span>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  }

                  return (
                    <tr
                      key={job.id}
                      className="hover:bg-[#f9faf9] dark:hover:bg-zinc-800/40 transition group cursor-pointer"
                      onClick={() => window.location.assign(`/admin/scans/${job.id}`)}
                    >
                      <td className="px-5 py-4">
                        <div className="font-semibold text-[#1a2923] dark:text-zinc-100 flex items-center gap-1.5">
                          {isScoped ? (
                            <>
                              <span className="text-emerald-600 dark:text-emerald-400">📍</span>
                              <span>{job.keyword}</span>
                            </>
                          ) : (
                            <span className="text-zinc-600 dark:text-zinc-300">
                              Broad Category Scan
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-[#64736b] dark:text-zinc-400 capitalize mt-0.5 flex items-center gap-1.5 flex-wrap">
                          <span>{job.property_category ? `Category: ${job.property_category}` : "All Categories"}</span>
                          <span>•</span>
                          <SourceBadge source={job.source || "ikman"} />
                        </div>
                      </td>

                      <td className="px-4 py-4">{getStatusBadge(job.status)}</td>

                      <td className="px-4 py-4 font-medium text-xs">
                        {job.pages_scanned}
                        {job.total_pages > 0 && job.total_pages !== job.pages_scanned && (
                          <span className="text-[#64736b] dark:text-zinc-500"> / {job.total_pages}</span>
                        )}
                      </td>

                      <td className="px-4 py-4">
                        <span className="inline-flex items-center rounded-md bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 text-xs font-bold text-emerald-700 dark:text-emerald-400">
                          +{job.new_count}
                        </span>
                        {job.total_found > 0 && (
                          <span className="text-[11px] text-[#64736b] dark:text-zinc-400 ml-1.5">
                            ({job.total_found} found)
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-4 text-xs font-medium text-amber-600 dark:text-amber-400">
                        {job.filtered_count > 0 ? `${job.filtered_count} discards` : "0"}
                      </td>

                      <td className="px-4 py-4 text-xs text-[#64736b] dark:text-zinc-400">
                        {job.duration_seconds ? `${job.duration_seconds}s` : "—"}
                      </td>

                      <td className="px-4 py-4 text-xs font-medium text-[#1a2923] dark:text-zinc-300">
                        {job.created_by_name || "System"}
                      </td>

                      <td className="px-4 py-4 text-xs text-[#64736b] dark:text-zinc-400" title={format(createdDate, "yyyy-MM-dd HH:mm:ss")}>
                        {formatDistanceToNow(createdDate, { addSuffix: true })}
                      </td>

                      <td className="px-5 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {job.status === "running" && (
                            <button
                              onClick={(e) => handleStopJob(job.id, e)}
                              className="cursor-pointer inline-flex items-center gap-1 rounded-lg border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/60 px-2.5 py-1.5 text-xs font-semibold text-rose-700 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/60 transition"
                            >
                              <Square className="h-3 w-3 fill-current" />
                              <span>Stop</span>
                            </button>
                          )}
                          <Link
                            href={`/admin/scans/${job.id}`}
                            onClick={(e) => e.stopPropagation()}
                            className="cursor-pointer inline-flex items-center gap-1 rounded-lg border border-[#dce4df] dark:border-zinc-700 px-2.5 py-1.5 text-xs font-semibold text-[#19352b] dark:text-emerald-400 hover:bg-[#19352b] hover:text-white dark:hover:bg-emerald-600 dark:hover:text-white transition"
                          >
                            <span>Review</span>
                            <ChevronRight className="h-3.5 w-3.5" />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-[#dce4df] dark:border-zinc-800 pt-4">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="cursor-pointer inline-flex items-center gap-1 rounded-lg border border-[#dce4df] dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-[#1a2923] dark:text-zinc-200 shadow-sm hover:bg-[#f4f6f4] dark:hover:bg-zinc-800 disabled:opacity-40"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Previous
              </button>
              <span className="text-xs text-[#64736b] dark:text-zinc-400 font-medium">
                Page {page} of {totalPages}
              </span>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="cursor-pointer inline-flex items-center gap-1 rounded-lg border border-[#dce4df] dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-[#1a2923] dark:text-zinc-200 shadow-sm hover:bg-[#f4f6f4] dark:hover:bg-zinc-800 disabled:opacity-40"
              >
                Next <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )}

      {/* Hub Tab 2: Automation & Schedule */}
      {hubTab === "automation" && (
        <div className="space-y-6 max-w-4xl">
          {!isRootOrAdmin && (
            <div className="flex items-center gap-3 rounded-xl border border-amber-200 dark:border-amber-900/60 bg-amber-50 dark:bg-amber-950/20 p-4 text-xs text-amber-800 dark:text-amber-300">
              <ShieldAlert className="h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
              <span>
                Crawler automation and background schedules require Root or Administrator privileges. Viewing settings in read-only mode.
              </span>
            </div>
          )}

          {/* Section Header with Summary & Add Button */}
          <div className="rounded-xl border border-[#dce4df] dark:border-zinc-800 bg-white dark:bg-zinc-950 p-6 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-[#19352b] dark:text-emerald-400" />
                  <h2 className="text-lg font-bold text-[#1a2923] dark:text-zinc-100">
                    Automated Background Scanners & Crawlers
                  </h2>
                </div>
                <p className="mt-1 text-xs text-[#64736b] dark:text-zinc-400">
                  Configure multi-source automated crawlers for LankaPropertyWeb (LPW) and Ikman.lk with individual schedules, crawl depths, and property categories.
                </p>
              </div>

              {isRootOrAdmin && (
                <button
                  type="button"
                  onClick={() => setIsAddScannerModalOpen(true)}
                  className="cursor-pointer shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-[#19352b] dark:bg-emerald-700 px-3.5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-[#132820] dark:hover:bg-emerald-600 transition"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Set Up Additional Scanner</span>
                </button>
              )}
            </div>

            {/* Quick Metrics Bar */}
            <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="rounded-lg border border-[#e5ebe7] dark:border-zinc-800 p-3 bg-[#fbfcfb] dark:bg-zinc-900/40">
                <span className="text-[11px] font-medium text-[#718078] dark:text-zinc-400">Total Scanners</span>
                <p className="mt-0.5 text-lg font-bold text-[#1a2923] dark:text-zinc-100">{configuredScanners.length}</p>
              </div>
              <div className="rounded-lg border border-[#e5ebe7] dark:border-zinc-800 p-3 bg-[#fbfcfb] dark:bg-zinc-900/40">
                <span className="text-[11px] font-medium text-[#718078] dark:text-zinc-400">Active / Scheduled</span>
                <p className="mt-0.5 text-lg font-bold text-emerald-600 dark:text-emerald-400">
                  {configuredScanners.filter((s) => s.enabled).length}
                </p>
              </div>
              <div className="rounded-lg border border-[#e5ebe7] dark:border-zinc-800 p-3 bg-[#fbfcfb] dark:bg-zinc-900/40">
                <span className="text-[11px] font-medium text-[#718078] dark:text-zinc-400">Portals Active</span>
                <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                  {Array.from(new Set(configuredScanners.map((s) => s.source))).map((src) => (
                    <SourceBadge key={src} source={src} />
                  ))}
                </div>
              </div>
              <div className="rounded-lg border border-[#e5ebe7] dark:border-zinc-800 p-3 bg-[#fbfcfb] dark:bg-zinc-900/40">
                <span className="text-[11px] font-medium text-[#718078] dark:text-zinc-400">Next Upcoming Crawl</span>
                <p className="mt-0.5 text-xs font-semibold text-[#1a2923] dark:text-zinc-200 truncate">
                  {siteConfig?.scanner_settings?.next_run_at
                    ? new Date(siteConfig.scanner_settings.next_run_at).toLocaleString(undefined, {
                        dateStyle: "short",
                        timeStyle: "short",
                      })
                    : configuredScanners.some((s) => s.enabled)
                      ? "On next cycle"
                      : "All disabled"}
                </p>
              </div>
            </div>
          </div>

          {/* List of Configured Scanners */}
          <div className="space-y-3">
            {configuredScanners.map((scanner, index) => (
              <AutomatedScannerCard
                key={scanner.id || index}
                scanner={scanner}
                isRootOrAdmin={isRootOrAdmin}
                isExpanded={expandedScannerId === scanner.id}
                onToggleExpand={() =>
                  setExpandedScannerId((prev) => (prev === scanner.id ? null : scanner.id))
                }
                isToggling={togglingScannerId === scanner.id}
                onToggle={() => handleToggleScanner(scanner.id)}
                isRunning={runningScannerId === scanner.id}
                onRunNow={() => handleRunScannerNow(scanner.id, scanner.name)}
                isSaving={savingScannerId === scanner.id}
                onSave={(patch) => handleSaveScannerCard(scanner.id, patch)}
                onDelete={() => handleDeleteScanner(scanner.id)}
              />
            ))}
          </div>

          {/* Modal / Dialog for Adding an Additional Scanner */}
          {isAddScannerModalOpen && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4"
              role="dialog"
              aria-modal="true"
            >
              <div className="w-full max-w-lg rounded-2xl border border-[#dce4df] dark:border-zinc-800 bg-white dark:bg-zinc-950 p-6 shadow-2xl animate-in zoom-in-95 duration-150">
                <div className="flex items-center justify-between border-b border-[#e5ebe7] dark:border-zinc-800 pb-3">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-[#19352b] dark:text-emerald-400" />
                    <h3 className="text-lg font-bold text-[#1a2923] dark:text-zinc-100">
                      Set Up Additional Scanner
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsAddScannerModalOpen(false)}
                    className="cursor-pointer rounded-lg p-1.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <form onSubmit={handleAddAdditionalScanner} className="mt-4 space-y-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-[#718078] dark:text-zinc-400 mb-1.5">
                      Scanner Name
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. LankaPropertyWeb Colombo Luxury, Kandy Rentals..."
                      value={addScannerName}
                      onChange={(e) => setAddScannerName(e.target.value)}
                      className="w-full rounded-lg border border-[#cbd8d1] dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 py-2 text-sm outline-none focus:border-[#19352b] dark:focus:border-emerald-500 text-[#1a2923] dark:text-zinc-200"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-[#718078] dark:text-zinc-400 mb-1.5">
                      Target Portal / Source
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setAddScannerSource("lpw")}
                        className={`cursor-pointer rounded-xl border p-3 text-left transition flex items-center justify-between ${
                          addScannerSource === "lpw"
                            ? "border-2 border-[#19352b] dark:border-emerald-500 bg-[#f4f6f4] dark:bg-zinc-900"
                            : "border-[#dce4df] dark:border-zinc-800 bg-white dark:bg-zinc-900/50 hover:border-zinc-400"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <LpwIcon className="h-5 w-5 shrink-0" />
                          <div>
                            <span className="text-xs font-bold text-[#1a2923] dark:text-zinc-100 block">
                              LankaPropertyWeb
                            </span>
                            <span className="text-[10px] text-[#64736b] dark:text-zinc-400">
                              LPW portal scraper
                            </span>
                          </div>
                        </div>
                        {addScannerSource === "lpw" && (
                          <div className="h-2 w-2 rounded-full bg-emerald-600 dark:bg-emerald-400" />
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => setAddScannerSource("ikman")}
                        className={`cursor-pointer rounded-xl border p-3 text-left transition flex items-center justify-between ${
                          addScannerSource === "ikman"
                            ? "border-2 border-[#19352b] dark:border-emerald-500 bg-[#f4f6f4] dark:bg-zinc-900"
                            : "border-[#dce4df] dark:border-zinc-800 bg-white dark:bg-zinc-900/50 hover:border-zinc-400"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <IkmanIcon className="h-5 w-5 shrink-0 rounded-xs" />
                          <div>
                            <span className="text-xs font-bold text-[#1a2923] dark:text-zinc-100 block">
                              ikman.lk
                            </span>
                            <span className="text-[10px] text-[#64736b] dark:text-zinc-400">
                              Ikman marketplace
                            </span>
                          </div>
                        </div>
                        {addScannerSource === "ikman" && (
                          <div className="h-2 w-2 rounded-full bg-emerald-600 dark:bg-emerald-400" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-[#718078] dark:text-zinc-400 mb-1.5">
                        Crawl Frequency
                      </label>
                      <select
                        value={addScannerFrequency}
                        onChange={(e) => setAddScannerFrequency(parseInt(e.target.value))}
                        className="w-full rounded-lg border border-[#cbd8d1] dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 py-2 text-sm outline-none focus:border-[#19352b] dark:focus:border-emerald-500 text-[#1a2923] dark:text-zinc-200"
                      >
                        <option value={6}>Every 6 Hours</option>
                        <option value={12}>Every 12 Hours</option>
                        <option value={18}>Every 18 Hours</option>
                        <option value={24}>Every 24 Hours</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-[#718078] dark:text-zinc-400 mb-1.5">
                        Crawl Depth (Pages)
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={50}
                        value={addScannerPages}
                        onChange={(e) => setAddScannerPages(e.target.value === "" ? "" : parseInt(e.target.value) || "")}
                        onBlur={() => {
                          if (addScannerPages === "" || Number(addScannerPages) < 1) setAddScannerPages(1);
                          else if (Number(addScannerPages) > 50) setAddScannerPages(50);
                        }}
                        className="w-full rounded-lg border border-[#cbd8d1] dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 py-2 text-sm outline-none focus:border-[#19352b] dark:focus:border-emerald-500 text-[#1a2923] dark:text-zinc-200"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-[#718078] dark:text-zinc-400 mb-1.5">
                      Target Location / Keyword (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Colombo 7, Rajagiriya, Kandy (or leave empty for all)"
                      value={addScannerKeyword}
                      onChange={(e) => setAddScannerKeyword(e.target.value)}
                      className="w-full rounded-lg border border-[#cbd8d1] dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 py-2 text-sm outline-none focus:border-[#19352b] dark:focus:border-emerald-500 text-[#1a2923] dark:text-zinc-200"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-[#718078] dark:text-zinc-400 mb-1.5">
                      Property Categories
                    </label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {["house", "apartment", "land", "commercial"].map((type) => {
                        const isChecked = addScannerTypes.includes(type);
                        return (
                          <label
                            key={type}
                            className="flex items-center space-x-2 rounded-lg border border-[#e5ebe7] dark:border-zinc-800 p-2 bg-[#fbfcfb] dark:bg-zinc-900/40 cursor-pointer"
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => {
                                setAddScannerTypes((prev) =>
                                  e.target.checked
                                    ? [...prev, type]
                                    : prev.filter((t) => t !== type)
                                );
                              }}
                              className="h-3.5 w-3.5 rounded border-[#cbd8d1] text-[#19352b] focus:ring-[#19352b] cursor-pointer"
                            />
                            <span className="text-xs font-semibold capitalize text-[#1a2923] dark:text-zinc-200">
                              {type}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={addScannerEnabled}
                        onChange={(e) => setAddScannerEnabled(e.target.checked)}
                        className="h-4 w-4 rounded border-[#cbd8d1] text-[#19352b] focus:ring-[#19352b] cursor-pointer"
                      />
                      <span className="text-xs font-semibold text-[#1a2923] dark:text-zinc-200">
                        Enable immediately upon creation
                      </span>
                    </label>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#e5ebe7] dark:border-zinc-800">
                    <button
                      type="button"
                      disabled={addingScanner}
                      onClick={() => setIsAddScannerModalOpen(false)}
                      className="cursor-pointer rounded-lg border border-[#cbd8d1] dark:border-zinc-800 px-4 py-2 text-xs font-semibold text-[#1a2923] dark:text-zinc-200 hover:bg-[#f4f6f4] dark:hover:bg-zinc-800 transition disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={addingScanner}
                      className="cursor-pointer inline-flex items-center gap-1.5 rounded-lg bg-[#19352b] dark:bg-emerald-700 px-4 py-2 text-xs font-semibold text-white hover:bg-[#132820] dark:hover:bg-emerald-600 transition shadow-xs disabled:opacity-50"
                    >
                      {addingScanner && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                      <span>{addingScanner ? "Adding..." : "Add Scanner"}</span>
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Data Retention & Housekeeping */}
          <div className="rounded-xl border border-[#dce4df] dark:border-zinc-800 bg-white dark:bg-zinc-950 p-5 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h3 className="text-sm font-bold text-[#1a2923] dark:text-zinc-100">
                  Data Retention & Housekeeping
                </h3>
                <p className="mt-0.5 text-xs text-[#64736b] dark:text-zinc-400">
                  Control how long scraped listings stay in the prospects database before becoming eligible for automatic purge.
                </p>
              </div>

              <div className="flex items-center gap-2.5 self-start sm:self-auto">
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min={7}
                    max={365}
                    disabled={!isRootOrAdmin}
                    value={siteConfig?.prospect_retention_days ?? 30}
                    onChange={(e) =>
                      setSiteConfig((s) =>
                        s
                          ? {
                              ...s,
                              prospect_retention_days: e.target.value === "" ? ("" as any) : parseInt(e.target.value) || "",
                            }
                          : s
                      )
                    }
                    onBlur={() => {
                      setSiteConfig((s) =>
                        s && (!s.prospect_retention_days || Number(s.prospect_retention_days) < 7)
                          ? { ...s, prospect_retention_days: 30 }
                          : s
                      );
                    }}
                    className="w-20 rounded-lg border border-[#cbd8d1] dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 py-1.5 text-xs sm:text-sm font-semibold outline-none focus:border-[#19352b] dark:focus:border-emerald-500 text-[#1a2923] dark:text-zinc-200 disabled:opacity-60 text-center"
                  />
                  <span className="text-xs text-[#64736b] dark:text-zinc-400 font-medium">days</span>
                </div>

                {isRootOrAdmin && (
                  <button
                    type="button"
                    onClick={handleSaveRetention}
                    disabled={savingRetention}
                    className="cursor-pointer inline-flex items-center gap-1.5 rounded-lg bg-[#19352b] dark:bg-emerald-700 px-3.5 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-[#132820] dark:hover:bg-emerald-600 transition disabled:opacity-50"
                  >
                    {savingRetention ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Check className="h-3.5 w-3.5" />
                    )}
                    <span>{savingRetention ? "Saving..." : "Save Policy"}</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Connected Data Sources & Portals */}
          <div className="rounded-xl border border-[#dce4df] dark:border-zinc-800 bg-white dark:bg-zinc-950 p-5 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <Globe className="h-4 w-4 text-[#19352b] dark:text-emerald-400" />
              <h3 className="text-sm font-bold text-[#1a2923] dark:text-zinc-100">
                Connected Data Sources & Portals
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="rounded-xl border border-teal-200 dark:border-teal-900/60 bg-teal-50/50 dark:bg-teal-950/20 p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#009B79] text-white shadow-xs">
                      <IkmanIcon className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="text-xs sm:text-sm font-bold text-[#1a2923] dark:text-zinc-100">ikman.lk</h4>
                      <p className="text-[11px] text-[#64736b] dark:text-zinc-400">Classifieds Real Estate Portal</p>
                    </div>
                  </div>
                  <span className="inline-flex items-center rounded-full bg-emerald-100 dark:bg-emerald-900 px-2 py-0.5 text-[10px] font-semibold text-emerald-800 dark:text-emerald-200">
                    Active
                  </span>
                </div>
                <div className="mt-2.5 text-[11px] text-[#64736b] dark:text-zinc-400 space-y-1">
                  <p>• Fast search pagination & detailed ad page scraping</p>
                  <p>• Automated phone number retrieval & Gemini parsing</p>
                </div>
              </div>

              <div className="rounded-xl border border-blue-200/80 dark:border-blue-900/50 bg-blue-50/40 dark:bg-blue-950/20 p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#078F46] text-white shadow-xs">
                      <LpwIcon className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="text-xs sm:text-sm font-bold text-[#1a2923] dark:text-zinc-100">LankaPropertyWeb</h4>
                      <p className="text-[11px] text-[#64736b] dark:text-zinc-400">Dedicated Property Portal</p>
                    </div>
                  </div>
                  <span className="inline-flex items-center rounded-full bg-blue-100 dark:bg-blue-900/60 px-2 py-0.5 text-[10px] font-semibold text-blue-800 dark:text-blue-300">
                    Active
                  </span>
                </div>
                <div className="mt-2.5 text-[11px] text-[#64736b] dark:text-zinc-400 space-y-1">
                  <p>• Schema-ready adapter for dedicated listings</p>
                  <p>• Scheduled for upcoming multi-source release</p>
                </div>
              </div>
            </div>
          </div>
          </div>
        )}

      {/* Drawer */}
      <ScanLauncherDrawer
        isOpen={isScanDrawerOpen}
        onClose={() => setIsScanDrawerOpen(false)}
        onScanStarted={() => {
          fetchJobs();
        }}
      />
    </div>
  );
}

export default function ScanHistoryPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col items-center justify-center py-24 text-[#64736b] dark:text-zinc-400">
          <Loader2 className="h-8 w-8 animate-spin mb-3 text-[#19352b] dark:text-emerald-500" />
          <p className="text-sm font-medium">Loading Scanner Hub...</p>
        </div>
      }
    >
      <ScanHistoryContent />
    </Suspense>
  );
}
