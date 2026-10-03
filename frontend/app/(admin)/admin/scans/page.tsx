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
} from "lucide-react";

import { ScanJob, getScanJobs, stopScanJob, AuthUser, getCurrentUser } from "../../../../lib/api";

function ScanHistoryContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const initialType = searchParams.get("type") || "scan";

  const [jobs, setJobs] = useState<ScanJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalJobs, setTotalJobs] = useState(0);
  const [filterType, setFilterType] = useState<string>(initialType);
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    getCurrentUser().then(setUser).catch(() => {});
  }, []);

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
            <span>Scan History</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-[#1a2923] dark:text-zinc-100 flex items-center gap-2">
            <Compass className="h-6 w-6 text-[#19352b] dark:text-emerald-400" />
            <span>Scan Outcomes & History</span>
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-[#64736b] dark:text-zinc-400">
            Audit and review the yield, outcomes, and discovered listings from background scraping and sync jobs.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchJobs()}
            disabled={refreshing}
            className="cursor-pointer inline-flex items-center gap-1.5 rounded-lg border border-[#dce4df] dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 py-2 text-xs font-semibold text-[#1a2923] dark:text-zinc-200 shadow-sm hover:bg-[#f4f6f4] dark:hover:bg-zinc-800 disabled:opacity-50 transition"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>

          <Link
            href="/admin/prospects"
            className="cursor-pointer inline-flex items-center gap-1.5 rounded-lg bg-[#19352b] dark:bg-emerald-700 px-3.5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-[#132820] dark:hover:bg-emerald-600 transition"
          >
            <Plus className="h-4 w-4" />
            <span>New Scan</span>
          </Link>
        </div>
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
          <Link
            href="/admin/prospects"
            className="cursor-pointer mt-4 inline-flex items-center gap-2 rounded-lg bg-[#19352b] dark:bg-emerald-700 px-4 py-2 text-xs font-semibold text-white shadow hover:bg-[#132820] dark:hover:bg-emerald-600 transition"
          >
            <Plus className="h-4 w-4" /> Go to Prospects
          </Link>
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
                        <div className="text-xs text-[#64736b] dark:text-zinc-400 capitalize mt-0.5">
                          {job.property_category ? `Category: ${job.property_category}` : "All Categories"}
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
  );
}

export default function ScanHistoryPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col items-center justify-center py-24 text-[#64736b] dark:text-zinc-400">
          <Loader2 className="h-8 w-8 animate-spin mb-3 text-[#19352b] dark:text-emerald-500" />
          <p className="text-sm font-medium">Loading scan history...</p>
        </div>
      }
    >
      <ScanHistoryContent />
    </Suspense>
  );
}
