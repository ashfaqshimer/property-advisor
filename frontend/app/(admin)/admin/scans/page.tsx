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
} from "lucide-react";

import {
  ScanJob,
  getScanJobs,
  stopScanJob,
  AuthUser,
  getCurrentUser,
  getScanPresets,
  saveScanPreset,
  deleteScanPreset,
  resetScanPresets,
  ScanPreset,
  SiteConfiguration,
  getSiteConfiguration,
  updateSiteConfiguration,
} from "../../../../lib/api";
import { ScanLauncherDrawer } from "../../../../components/admin/ScanLauncherDrawer";
import { SourceBadge } from "../../../../components/admin/SourceBadge";

function ScanHistoryContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const tabParam = searchParams.get("tab") as "history" | "automation" | "presets" | null;
  const [hubTab, setHubTab] = useState<"history" | "automation" | "presets">(
    tabParam && ["history", "automation", "presets"].includes(tabParam) ? tabParam : "history"
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
  const [selectedPreset, setSelectedPreset] = useState<ScanPreset | null>(null);
  const [presets, setPresets] = useState<ScanPreset[]>([]);

  const [siteConfig, setSiteConfig] = useState<SiteConfiguration | null>(null);
  const [savingAutomation, setSavingAutomation] = useState(false);

  // New preset form in presets tab
  const [newPresetName, setNewPresetName] = useState("");
  const [newPresetKeyword, setNewPresetKeyword] = useState("");
  const [newPresetCategories, setNewPresetCategories] = useState<string[]>([
    "houses",
    "apartments",
  ]);
  const [newPresetSource, setNewPresetSource] = useState("ikman");

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
    getScanPresets()
      .then((p) => {
        if (Array.isArray(p)) setPresets(p);
      })
      .catch(() => {});
    getSiteConfiguration()
      .then((cfg) => {
        if (cfg) setSiteConfig(cfg);
      })
      .catch(() => {});
  }, [router]);

  // Sync hub tab if URL param changes
  useEffect(() => {
    const currentTab = searchParams.get("tab") as "history" | "automation" | "presets" | null;
    if (currentTab && ["history", "automation", "presets"].includes(currentTab)) {
      setHubTab(currentTab);
    }
  }, [searchParams]);

  const handleHubTabChange = (newTab: "history" | "automation" | "presets") => {
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

  const handleSaveAutomation = async () => {
    if (!siteConfig) return;
    setSavingAutomation(true);
    try {
      const updated = await updateSiteConfiguration({
        scanner_settings: siteConfig.scanner_settings,
        prospect_retention_days: siteConfig.prospect_retention_days,
      });
      setSiteConfig(updated);
      toast.success("Automation crawler settings updated successfully.");
    } catch (err: any) {
      toast.error(err.message || "Failed to update crawler settings.");
    } finally {
      setSavingAutomation(false);
    }
  };

  const handleAddPresetFromTab = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPresetName.trim() || !newPresetKeyword.trim()) {
      toast.error("Please enter both preset name and location keyword.");
      return;
    }
    const newPreset: ScanPreset = {
      id: `preset-${Date.now()}`,
      name: newPresetName.trim(),
      keyword: newPresetKeyword.trim(),
      categories: newPresetCategories.length > 0 ? newPresetCategories : ["all"],
      property_category:
        newPresetCategories.length === 1
          ? (newPresetCategories[0] as any)
          : (newPresetCategories.length > 1 ? newPresetCategories.join(",") : "all"),
      strict_location: true,
      scan_all: true,
      source: newPresetSource,
      is_default: false,
    };
    try {
      const updated = await saveScanPreset(newPreset);
      setPresets(updated);
      setNewPresetName("");
      setNewPresetKeyword("");
      toast.success(`Preset "${newPreset.name}" saved!`);
    } catch (err: any) {
      toast.error(err.message || "Failed to save preset");
    }
  };

  const handleDeletePresetFromTab = async (presetId: string) => {
    try {
      const updated = await deleteScanPreset(presetId);
      setPresets(updated);
      toast.info("Preset deleted");
    } catch (err: any) {
      toast.error(err.message || "Failed to delete preset");
    }
  };

  const handleResetPresets = async () => {
    if (!window.confirm("Reset all presets to system defaults?")) return;
    try {
      const restored = await resetScanPresets();
      setPresets(restored);
      toast.success("Restored system default presets");
    } catch (err: any) {
      toast.error(err.message || "Failed to reset presets");
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

        <button
          onClick={() => handleHubTabChange("presets")}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-sm font-semibold transition cursor-pointer ${
            hubTab === "presets"
              ? "border-[#19352b] text-[#19352b] dark:border-emerald-500 dark:text-emerald-400"
              : "border-transparent text-[#64736b] dark:text-zinc-400 hover:text-[#1a2923] dark:hover:text-zinc-200"
          }`}
        >
          <Bookmark className="h-4 w-4" />
          <span>Presets & Portals</span>
          <span className="rounded-full bg-[#f4f6f4] dark:bg-zinc-800 px-2 py-0.5 text-[11px] font-semibold text-[#19352b] dark:text-zinc-300">
            {presets.length}
          </span>
        </button>
      </div>

      {hubTab === "history" && (
        <div className="space-y-6">
          {/* Quick Presets Bar */}
          <div className="flex items-center gap-1.5 overflow-x-auto whitespace-nowrap pb-1 pt-1 text-xs [&::-webkit-scrollbar]:hidden" style={{ scrollbarWidth: "none" }}>
            <span className="font-bold text-[#718078] dark:text-zinc-400 text-[11px] uppercase tracking-wider shrink-0 flex items-center gap-1 mr-1">
              <Bookmark className="h-3 w-3 text-[#19352b] dark:text-emerald-400" /> Presets:
            </span>
            {presets.map((preset) => (
              <button
                key={preset.id}
                onClick={() => {
                  setSelectedPreset(preset);
                  setIsScanDrawerOpen(true);
                }}
                className="inline-flex items-center gap-1.5 rounded-full border border-[#dce4df] dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 py-1 text-xs font-medium text-[#1a2923] dark:text-zinc-200 hover:border-[#19352b] hover:bg-[#f4f6f4] dark:hover:bg-zinc-800 transition cursor-pointer"
              >
                <span>{preset.name}</span>
              </button>
            ))}
            <button
              onClick={() => {
                setSelectedPreset(null);
                setIsScanDrawerOpen(true);
              }}
              className="inline-flex items-center gap-1 rounded-full border border-dashed border-[#cbd8d1] dark:border-zinc-700 bg-transparent px-2.5 py-1 text-xs font-medium text-[#64736b] dark:text-zinc-400 hover:border-[#19352b] hover:text-[#19352b] dark:hover:text-zinc-200 transition cursor-pointer"
            >
              <span>+ Custom Scan</span>
            </button>
          </div>



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

          <div className="rounded-xl border border-[#dce4df] dark:border-zinc-800 bg-white dark:bg-zinc-950 p-6 shadow-sm">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-[#19352b] dark:text-emerald-400" />
                  <h2 className="text-lg font-bold text-[#1a2923] dark:text-zinc-100">
                    Background Crawler Engine
                  </h2>
                </div>
                <p className="mt-1 text-xs text-[#64736b] dark:text-zinc-400">
                  Automate scraping jobs across active property portals on a regular interval.
                </p>
              </div>

              <div className="flex items-center space-x-3">
                <button
                  type="button"
                  role="switch"
                  disabled={!isRootOrAdmin}
                  aria-checked={siteConfig?.scanner_settings?.enabled ?? false}
                  onClick={() =>
                    setSiteConfig((s) =>
                      s
                        ? {
                            ...s,
                            scanner_settings: {
                              ...(s.scanner_settings || {
                                frequency_hours: 24,
                                pages_to_scan: 5,
                                property_types: ["house", "apartment"],
                              }),
                              enabled: !(s.scanner_settings?.enabled ?? false),
                            },
                          }
                        : s
                    )
                  }
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[#19352b] disabled:opacity-50 ${
                    (siteConfig?.scanner_settings?.enabled ?? false)
                      ? "bg-[#19352b] dark:bg-emerald-600"
                      : "bg-gray-200 dark:bg-zinc-700"
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                      (siteConfig?.scanner_settings?.enabled ?? false) ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
                <span className="text-xs font-semibold text-[#1a2923] dark:text-zinc-200">
                  {(siteConfig?.scanner_settings?.enabled ?? false) ? "Enabled" : "Disabled"}
                </span>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#718078] dark:text-zinc-400 mb-2">
                  Crawl Frequency
                </label>
                <select
                  disabled={!isRootOrAdmin}
                  value={siteConfig?.scanner_settings?.frequency_hours ?? 24}
                  onChange={(e) =>
                    setSiteConfig((s) =>
                      s
                        ? {
                            ...s,
                            scanner_settings: {
                              ...(s.scanner_settings || {
                                enabled: false,
                                pages_to_scan: 5,
                                property_types: ["house", "apartment"],
                              }),
                              frequency_hours: parseInt(e.target.value),
                            },
                          }
                        : s
                    )
                  }
                  className="w-full rounded-lg border border-[#cbd8d1] dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 py-2 text-sm outline-none focus:border-[#19352b] dark:focus:border-emerald-500 text-[#1a2923] dark:text-zinc-200 disabled:opacity-60"
                >
                  <option value={6}>Every 6 Hours (High Frequency)</option>
                  <option value={12}>Every 12 Hours (Twice Daily)</option>
                  <option value={18}>Every 18 Hours</option>
                  <option value={24}>Every 24 Hours (Daily Standard)</option>
                </select>
                <p className="mt-1.5 text-[11px] text-[#64736b] dark:text-zinc-400">
                  How often the background scheduler invokes the portal crawler.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-[#718078] dark:text-zinc-400 mb-2">
                  Crawl Depth (Pages per run)
                </label>
                <input
                  type="number"
                  min={1}
                  max={50}
                  disabled={!isRootOrAdmin}
                  value={siteConfig?.scanner_settings?.pages_to_scan ?? 5}
                  onChange={(e) =>
                    setSiteConfig((s) =>
                      s
                        ? {
                            ...s,
                            scanner_settings: {
                              ...(s.scanner_settings || {
                                enabled: false,
                                frequency_hours: 24,
                                property_types: ["house", "apartment"],
                              }),
                              pages_to_scan: parseInt(e.target.value) || 1,
                            },
                          }
                        : s
                    )
                  }
                  className="w-full rounded-lg border border-[#cbd8d1] dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 py-2 text-sm outline-none focus:border-[#19352b] dark:focus:border-emerald-500 text-[#1a2923] dark:text-zinc-200 disabled:opacity-60"
                />
                <p className="mt-1.5 text-[11px] text-[#64736b] dark:text-zinc-400">
                  Number of pagination pages evaluated per run (approx ~25 listings per page).
                </p>
              </div>
            </div>

            <div className="mt-6 pt-6 border-t border-[#dce4df] dark:border-zinc-800">
              <label className="block text-xs font-bold uppercase tracking-wider text-[#718078] dark:text-zinc-400 mb-3">
                Included Property Categories
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {["house", "apartment", "land", "commercial"].map((type) => {
                  const isChecked = (
                    siteConfig?.scanner_settings?.property_types ?? ["house", "apartment"]
                  ).includes(type);
                  return (
                    <label
                      key={type}
                      className="flex items-center space-x-2.5 rounded-lg border border-[#e5ebe7] dark:border-zinc-800 p-2.5 bg-[#fbfcfb] dark:bg-zinc-900/40 cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        disabled={!isRootOrAdmin}
                        checked={isChecked}
                        onChange={(e) => {
                          const current =
                            siteConfig?.scanner_settings?.property_types ?? ["house", "apartment"];
                          const next = e.target.checked
                            ? [...current, type]
                            : current.filter((t) => t !== type);
                          setSiteConfig((s) =>
                            s
                              ? {
                                  ...s,
                                  scanner_settings: {
                                    ...(s.scanner_settings || {
                                      enabled: false,
                                      frequency_hours: 24,
                                      pages_to_scan: 5,
                                    }),
                                    property_types: next,
                                  },
                                }
                              : s
                          );
                        }}
                        className="h-4 w-4 rounded border-[#cbd8d1] text-[#19352b] focus:ring-[#19352b] cursor-pointer"
                      />
                      <span className="text-xs font-semibold capitalize text-[#1a2923] dark:text-zinc-200">
                        {type}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="mt-6 rounded-xl border border-[#dce4df] dark:border-zinc-800 bg-[#f9faf9] dark:bg-zinc-900/50 p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold uppercase tracking-wider text-[#718078] dark:text-zinc-400">
                  Scheduler Live State
                </span>
                {siteConfig?.scanner_settings?.enabled ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Active Schedule
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400">
                    <span className="h-1.5 w-1.5 rounded-full bg-zinc-400" />
                    Automation Disabled
                  </span>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-[#64736b] dark:text-zinc-400">
                <div>
                  <span className="font-semibold text-[#1a2923] dark:text-zinc-200">Next Scheduled Run:</span>{" "}
                  {siteConfig?.scanner_settings?.enabled
                    ? siteConfig.scanner_settings.next_run_at
                      ? new Date(siteConfig.scanner_settings.next_run_at).toLocaleString(undefined, {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })
                      : "Scheduled on next restart"
                    : "Not scheduled (disabled)"}
                </div>
                {siteConfig?.scanner_settings?.last_run_at && (
                  <div>
                    <span className="font-semibold text-[#1a2923] dark:text-zinc-200">Last Execution:</span>{" "}
                    {new Date(siteConfig.scanner_settings.last_run_at).toLocaleString(undefined, {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-[#dce4df] dark:border-zinc-800 bg-white dark:bg-zinc-950 p-6 shadow-sm">
            <h3 className="text-base font-bold text-[#1a2923] dark:text-zinc-100">
              Data Retention & Housekeeping
            </h3>
            <p className="mt-1 text-xs text-[#64736b] dark:text-zinc-400">
              Control how long scraped listings stay in the prospects database before becoming eligible for automatic purge.
            </p>

            <div className="mt-4 max-w-xs">
              <label className="block text-xs font-medium text-[#64736b] dark:text-zinc-400 mb-1">
                Prospect Retention Period (Days)
              </label>
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
                          prospect_retention_days: parseInt(e.target.value) || 30,
                        }
                      : s
                  )
                }
                className="w-full rounded-lg border border-[#cbd8d1] dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 py-2 text-sm outline-none focus:border-[#19352b] dark:focus:border-emerald-500 text-[#1a2923] dark:text-zinc-200 disabled:opacity-60"
              />
            </div>
          </div>

          {isRootOrAdmin && (
            <button
              type="button"
              onClick={handleSaveAutomation}
              disabled={savingAutomation}
              className="cursor-pointer inline-flex items-center gap-2 rounded-lg bg-[#19352b] dark:bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white shadow-xs hover:bg-[#132820] dark:hover:bg-emerald-600 transition disabled:opacity-60"
            >
              {savingAutomation ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              <span>{savingAutomation ? "Saving Changes..." : "Save Automation Settings"}</span>
            </button>
          )}
        </div>
      )}

      {/* Hub Tab 3: Presets & Portals */}
      {hubTab === "presets" && (
        <div className="space-y-6 max-w-4xl">
          <div className="rounded-xl border border-[#dce4df] dark:border-zinc-800 bg-white dark:bg-zinc-950 p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <Bookmark className="h-5 w-5 text-[#19352b] dark:text-emerald-400" />
                  <h2 className="text-lg font-bold text-[#1a2923] dark:text-zinc-100">
                    Scan Presets & Watchlists
                  </h2>
                </div>
                <p className="mt-1 text-xs text-[#64736b] dark:text-zinc-400">
                  Shared search configurations accessible by the entire team across the Prospects and Scan drawers.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleResetPresets}
                  className="cursor-pointer inline-flex items-center gap-1.5 rounded-lg border border-[#dce4df] dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-[#1a2923] dark:text-zinc-200 hover:bg-[#f4f6f4] dark:hover:bg-zinc-800 transition"
                  title="Restore default recommended presets"
                >
                  <RotateCcw className="h-3.5 w-3.5 text-[#64736b] dark:text-zinc-400" />
                  <span>Reset Defaults</span>
                </button>
                <span className="rounded-full bg-[#f4f6f4] dark:bg-zinc-800 px-3 py-1 text-xs font-semibold text-[#19352b] dark:text-zinc-300">
                  {presets.length} Presets
                </span>
              </div>
            </div>

            <div className="mt-6 space-y-2.5">
              {presets.length > 0 ? (
                presets.map((preset) => (
                  <div
                    key={preset.id}
                    className="flex items-center justify-between rounded-lg border border-[#e5ebe7] dark:border-zinc-800 bg-[#fbfcfb] dark:bg-zinc-900/40 p-3.5 hover:border-[#19352b]/40 transition"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#eef3f0] dark:bg-zinc-800 text-[#19352b] dark:text-emerald-400 shrink-0">
                        <MapPin className="h-4 w-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-[#1a2923] dark:text-zinc-100">
                            {preset.name}
                          </span>
                          <SourceBadge source={preset.source} />
                          {preset.is_default && (
                            <span className="rounded bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 text-[10px] font-medium text-zinc-600 dark:text-zinc-400">
                              Built-in
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 flex-wrap text-xs text-[#64736b] dark:text-zinc-400 mt-1">
                          <span>
                            Target: <span className="font-semibold text-[#1a2923] dark:text-zinc-300">"{preset.keyword}"</span>
                          </span>
                          <span>•</span>
                          <span className="font-medium">Categories:</span>
                          <div className="flex items-center gap-1 flex-wrap">
                            {(preset.categories && preset.categories.length > 0
                              ? preset.categories
                              : [preset.property_category || "all"]
                            ).map((c) => (
                              <span
                                key={c}
                                className="rounded bg-[#f4f6f4] dark:bg-zinc-800 px-1.5 py-0.5 text-[10px] font-semibold capitalize text-[#19352b] dark:text-zinc-300 border border-[#dce4df] dark:border-zinc-700"
                              >
                                {c}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedPreset(preset);
                          setIsScanDrawerOpen(true);
                        }}
                        className="cursor-pointer rounded-lg border border-[#dce4df] dark:border-zinc-800 bg-white dark:bg-zinc-900 px-2.5 py-1 text-xs font-semibold text-[#19352b] dark:text-emerald-400 hover:bg-[#f4f6f4] dark:hover:bg-zinc-800 transition"
                      >
                        Launch
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeletePresetFromTab(preset.id)}
                        className="cursor-pointer inline-flex items-center gap-1 rounded-lg border border-transparent hover:border-rose-200 dark:hover:border-rose-900/60 bg-transparent hover:bg-rose-50 dark:hover:bg-rose-950/40 px-2 py-1 text-xs font-medium text-zinc-500 hover:text-rose-600 dark:text-zinc-400 dark:hover:text-rose-400 transition"
                        title={`Delete preset "${preset.name}"`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">Delete</span>
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-xs text-[#64736b] dark:text-zinc-400 italic">No presets configured.</p>
              )}
            </div>

            <form onSubmit={handleAddPresetFromTab} className="mt-6 rounded-xl border border-dashed border-[#cbd8d1] dark:border-zinc-800 p-4 bg-[#f9faf9] dark:bg-zinc-900/30">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#718078] dark:text-zinc-400 mb-3">
                Create New Preset
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="block text-xs font-medium text-[#64736b] dark:text-zinc-400 mb-1">
                    Preset Label
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Negombo Land Sales"
                    value={newPresetName}
                    onChange={(e) => setNewPresetName(e.target.value)}
                    className="w-full rounded-lg border border-[#cbd8d1] dark:border-zinc-800 bg-white dark:bg-zinc-950 px-3 py-2 text-xs outline-none focus:border-[#19352b] dark:text-zinc-200"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#64736b] dark:text-zinc-400 mb-1">
                    Target Location
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Negombo"
                    value={newPresetKeyword}
                    onChange={(e) => setNewPresetKeyword(e.target.value)}
                    className="w-full rounded-lg border border-[#cbd8d1] dark:border-zinc-800 bg-white dark:bg-zinc-950 px-3 py-2 text-xs outline-none focus:border-[#19352b] dark:text-zinc-200"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-[#64736b] dark:text-zinc-400 mb-1.5">
                    Target Property Categories (Multi-Select)
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { id: "houses", label: "Houses" },
                      { id: "apartments", label: "Apartments" },
                      { id: "lands", label: "Lands" },
                      { id: "commercial", label: "Commercial" },
                    ].map((cat) => {
                      const isSelected = newPresetCategories.includes(cat.id);
                      return (
                        <button
                          key={cat.id}
                          type="button"
                          onClick={() => {
                            setNewPresetCategories((prev) =>
                              prev.includes(cat.id)
                                ? prev.filter((c) => c !== cat.id)
                                : [...prev, cat.id]
                            );
                          }}
                          className={`cursor-pointer rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                            isSelected
                              ? "border-[#19352b] dark:border-emerald-600 bg-[#eef3f0] dark:bg-emerald-950/40 text-[#19352b] dark:text-emerald-300"
                              : "border-[#cbd8d1] dark:border-zinc-800 bg-white dark:bg-zinc-950 text-[#1a2923] dark:text-zinc-300 hover:border-[#19352b]/50"
                          }`}
                        >
                          {cat.label}
                        </button>
                      );
                    })}
                  </div>
                  <p className="mt-1 text-[11px] text-[#64736b] dark:text-zinc-400">
                    {newPresetCategories.length === 0
                      ? "None selected — scans all property types in the area."
                      : `Selected: ${newPresetCategories.join(", ")}`}
                  </p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-[#64736b] dark:text-zinc-400 mb-1">
                    Source Portal
                  </label>
                  <select
                    value={newPresetSource}
                    onChange={(e) => setNewPresetSource(e.target.value)}
                    className="w-full rounded-lg border border-[#cbd8d1] dark:border-zinc-800 bg-white dark:bg-zinc-950 px-3 py-2 text-xs outline-none focus:border-[#19352b] dark:text-zinc-200"
                  >
                    <option value="ikman">ikman.lk</option>
                    <option value="lpw">LankaPropertyWeb (Upcoming)</option>
                  </select>
                </div>
              </div>

              <button
                type="submit"
                className="cursor-pointer inline-flex items-center gap-1.5 rounded-lg bg-[#19352b] dark:bg-emerald-700 px-3.5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-[#132820] dark:hover:bg-emerald-600 transition"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Save New Preset</span>
              </button>
            </form>
          </div>

          <div className="rounded-xl border border-[#dce4df] dark:border-zinc-800 bg-white dark:bg-zinc-950 p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <Globe className="h-5 w-5 text-[#19352b] dark:text-emerald-400" />
              <h3 className="text-base font-bold text-[#1a2923] dark:text-zinc-100">
                Connected Data Sources & Portals
              </h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/50 dark:bg-emerald-950/20 p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#19352b] dark:bg-emerald-700 text-white font-bold text-xs">
                      <Globe className="h-4 w-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-[#1a2923] dark:text-zinc-100">ikman.lk</h4>
                      <p className="text-xs text-[#64736b] dark:text-zinc-400">Classifieds Real Estate Portal</p>
                    </div>
                  </div>
                  <span className="inline-flex items-center rounded-full bg-emerald-100 dark:bg-emerald-900 px-2 py-0.5 text-[10px] font-semibold text-emerald-800 dark:text-emerald-200">
                    Active
                  </span>
                </div>
                <div className="mt-3 text-xs text-[#64736b] dark:text-zinc-400 space-y-1">
                  <p>• Fast search pagination & detailed ad page scraping</p>
                  <p>• Automated phone number retrieval & Gemini parsing</p>
                </div>
              </div>

              <div className="rounded-xl border border-dashed border-[#dce4df] dark:border-zinc-800 bg-[#fbfcfb] dark:bg-zinc-900/30 p-4 opacity-80">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-300 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-bold text-xs">
                      <Globe className="h-4 w-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-[#1a2923] dark:text-zinc-100">LankaPropertyWeb</h4>
                      <p className="text-xs text-[#64736b] dark:text-zinc-400">Dedicated Property Portal</p>
                    </div>
                  </div>
                  <span className="inline-flex items-center rounded-full bg-zinc-200 dark:bg-zinc-800 px-2 py-0.5 text-[10px] font-medium text-zinc-700 dark:text-zinc-300">
                    Upcoming
                  </span>
                </div>
                <div className="mt-3 text-xs text-[#64736b] dark:text-zinc-400 space-y-1">
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
        onClose={() => {
          setIsScanDrawerOpen(false);
          setSelectedPreset(null);
        }}
        initialPreset={selectedPreset}
        onPresetsChanged={setPresets}
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
