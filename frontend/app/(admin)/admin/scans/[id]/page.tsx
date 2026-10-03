"use client";

import { useEffect, useState, useCallback, use } from "react";
import Link from "next/link";
import { format, parseISO, formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import {
  ArrowLeft,
  Download,
  PhoneCall,
  Sparkles,
  ExternalLink,
  MapPin,
  Clock,
  Layers,
  Filter,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ChevronRight,
  User,
  ShieldCheck,
  RefreshCw,
  Undo2,
  Square,
} from "lucide-react";

import {
  ScanJob,
  Prospect,
  getScanJob,
  getScanJobProspects,
  getScanExportUrl,
  startScanPhoneFetch,
  getBulkPhoneFetchStatus,
  fetchProspectPhone,
  generatePropertyDraft,
  createProperty,
  createPropertyContact,
  updateProspect,
  stopScanJob,
} from "../../../../../lib/api";
import { SourceBadge } from "../../../../../components/admin/SourceBadge";

export default function ScanDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = use(params);
  const jobId = resolvedParams.id;

  const [job, setJob] = useState<ScanJob | null>(null);
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [loading, setLoading] = useState(true);
  const [prospectsLoading, setProspectsLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filterTab, setFilterTab] = useState<"all" | "active" | "discarded" | "has_phone" | "missing_phone">("all");

  // Phone Fetch Job tracking for this scan
  const [phoneFetchJobId, setPhoneFetchJobId] = useState<string | null>(null);
  const [phoneFetchStatus, setPhoneFetchStatus] = useState<string | null>(null);
  const [isFetchingPhones, setIsFetchingPhones] = useState(false);
  const [singleFetchingPhoneId, setSingleFetchingPhoneId] = useState<string | null>(null);

  // Draft conversion modal
  const [draftLoading, setDraftLoading] = useState<string | null>(null);
  const [draftModalData, setDraftModalData] = useState<any>(null);
  const [draftProspectId, setDraftProspectId] = useState<string | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);
  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null);

  const fetchJobData = useCallback(async () => {
    try {
      const data = await getScanJob(jobId);
      setJob(data);
    } catch {
      toast.error("Failed to load scan job details");
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  const fetchProspectsData = useCallback(async () => {
    setProspectsLoading(true);
    try {
      const data = await getScanJobProspects(jobId, page, 50);
      setProspects(data.items);
      setTotalPages(data.total_pages);
    } catch {
      toast.error("Failed to load prospects discovered in this scan");
    } finally {
      setProspectsLoading(false);
    }
  }, [jobId, page]);

  const [isStoppingScan, setIsStoppingScan] = useState(false);

  useEffect(() => {
    fetchJobData();
    fetchProspectsData();
  }, [fetchJobData, fetchProspectsData]);

  // Polling for scan progress if active
  useEffect(() => {
    if (job?.status !== "running") return;

    const interval = setInterval(() => {
      fetchJobData();
      fetchProspectsData();
    }, 3000);

    return () => clearInterval(interval);
  }, [job?.status, fetchJobData, fetchProspectsData]);

  const handleStopScan = async () => {
    setIsStoppingScan(true);
    try {
      await stopScanJob(jobId);
      toast.info("Scan stop requested");
      fetchJobData();
      fetchProspectsData();
    } catch (err: any) {
      toast.error(err.message || "Failed to stop scan");
    } finally {
      setIsStoppingScan(false);
    }
  };

  // Polling for scoped phone fetch
  useEffect(() => {
    if (!phoneFetchJobId || !isFetchingPhones) return;

    const interval = setInterval(async () => {
      try {
        const res = await getBulkPhoneFetchStatus(phoneFetchJobId);
        setPhoneFetchStatus(res.progress);
        if (res.status === "completed") {
          setIsFetchingPhones(false);
          setPhoneFetchJobId(null);
          toast.success(res.progress || "Phone numbers fetched successfully!");
          fetchProspectsData();
        } else if (res.status === "failed") {
          setIsFetchingPhones(false);
          setPhoneFetchJobId(null);
          toast.error(res.error || "Phone fetch failed");
        }
      } catch {
        setIsFetchingPhones(false);
      }
    }, 2500);

    return () => clearInterval(interval);
  }, [phoneFetchJobId, isFetchingPhones, fetchProspectsData]);

  const handleStartPhoneFetch = async () => {
    setIsFetchingPhones(true);
    try {
      const res = await startScanPhoneFetch(jobId);
      setPhoneFetchJobId(res.job_id);
      setPhoneFetchStatus("Starting phone fetch for this scan's owners...");
      toast.info("Started phone fetch for owners discovered in this scan");
    } catch (err: any) {
      toast.error(err.message || "Failed to start phone fetch");
      setIsFetchingPhones(false);
    }
  };

  const handleFetchSinglePhone = async (prospectId: string) => {
    setSingleFetchingPhoneId(prospectId);
    try {
      const updated = await fetchProspectPhone(prospectId);
      setProspects((prev) => prev.map((p) => (p.id === prospectId ? updated : p)));
      toast.success(updated.phone_number ? `Phone found: ${updated.phone_number}` : "Owner details updated");
    } catch (err: any) {
      toast.error(err.message || "Failed to fetch phone number");
    } finally {
      setSingleFetchingPhoneId(null);
    }
  };

  const handleStatusChange = async (prospectId: string, newStatus: string) => {
    setUpdatingStatusId(prospectId);
    try {
      const oldProspect = prospects.find((p) => p.id === prospectId);
      const oldStatus = oldProspect?.status;
      const updated = await updateProspect(prospectId, newStatus);
      setProspects((prev) => prev.map((p) => (p.id === prospectId ? updated : p)));

      if (oldStatus === "discarded" && newStatus !== "discarded") {
        setJob((prev) =>
          prev
            ? {
                ...prev,
                new_count: (prev.new_count || 0) + 1,
                filtered_count: Math.max(0, (prev.filtered_count || 0) - 1),
              }
            : prev
        );
        toast.success(`Prospect restored to active! Status: ${newStatus}`);
      } else if (oldStatus !== "discarded" && newStatus === "discarded") {
        setJob((prev) =>
          prev
            ? {
                ...prev,
                new_count: Math.max(0, (prev.new_count || 0) - 1),
                filtered_count: (prev.filtered_count || 0) + 1,
              }
            : prev
        );
        toast.info(`Prospect moved to discarded.`);
      } else {
        toast.success(`Prospect marked as ${newStatus}`);
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to update prospect status");
    } finally {
      setUpdatingStatusId(null);
    }
  };

  const handleGenerateDraft = async (prospect: Prospect) => {
    setDraftLoading(prospect.id);
    try {
      const draft = await generatePropertyDraft(prospect.id);
      setDraftModalData(draft);
      setDraftProspectId(prospect.id);
    } catch (err: any) {
      toast.error(err.message || "Failed to generate draft");
    } finally {
      setDraftLoading(null);
    }
  };

  const handlePublishDraft = async () => {
    if (!draftModalData || !draftProspectId) return;
    setIsPublishing(true);
    try {
      let contactId = null;
      if (draftModalData.contact_name && draftModalData.contact_phone) {
        try {
          const contact = await createPropertyContact({
            full_name: draftModalData.contact_name,
            contact_type: draftModalData.contact_type === "broker" ? "broker" : "owner",
            phones: [{ phone: draftModalData.contact_phone }],
            notes: "Auto-created from prospect conversion.",
          });
          contactId = contact.id;
        } catch {
          // ignore contact creation failure and continue
        }
      }

      await createProperty({
        ...draftModalData,
        status: "available",
        image_urls: [],
        image_alt: draftModalData.image_alt || "Property",
        property_contact_id: contactId,
      });

      await updateProspect(draftProspectId, "converted");
      toast.success("Property created and published!");
      setDraftModalData(null);
      setDraftProspectId(null);
      fetchProspectsData();
    } catch (err: any) {
      toast.error(err.message || "Failed to create property");
    } finally {
      setIsPublishing(false);
    }
  };

  const handleExportCSV = () => {
    const url = getScanExportUrl(jobId);
    window.open(url, "_blank");
  };

  // Filter visible prospects
  const activeCount = prospects.filter((p) => p.status !== "discarded").length;
  const discardedCount = prospects.filter((p) => p.status === "discarded").length;
  const withPhoneCount = prospects.filter((p) => p.status !== "discarded" && !!p.phone_number).length;
  const missingPhonesCount = prospects.filter((p) => p.status !== "discarded" && !p.phone_number).length;

  const filteredProspects = prospects.filter((p) => {
    if (filterTab === "active") return p.status !== "discarded";
    if (filterTab === "discarded") return p.status === "discarded";
    if (filterTab === "has_phone") return p.status !== "discarded" && !!p.phone_number;
    if (filterTab === "missing_phone") return p.status !== "discarded" && !p.phone_number;
    return true;
  });

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-[#64736b] dark:text-zinc-400">
        <Loader2 className="h-8 w-8 animate-spin mb-3 text-[#19352b] dark:text-emerald-500" />
        <p className="text-sm font-medium">Loading scan outcomes...</p>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
        <h3 className="font-bold">Scan job not found</h3>
        <p className="mt-1 text-sm">The requested scan job ID does not exist or has been purged.</p>
        <Link href="/admin/scans" className="mt-4 inline-block font-semibold underline">
          ← Back to Scan History
        </Link>
      </div>
    );
  }

  const createdDate = parseISO(job.created_at);
  const isScoped = !!job.keyword;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
            <CheckCircle2 className="h-3.5 w-3.5" /> Completed
          </span>
        );
      case "running":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-50 dark:bg-sky-950/60 px-2.5 py-0.5 text-xs font-semibold text-sky-700 dark:text-sky-400 border border-sky-200 dark:border-sky-800 animate-pulse">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> In Progress
          </span>
        );
      case "cancelled":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 dark:bg-amber-950/60 px-2.5 py-0.5 text-xs font-semibold text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
            <Square className="h-3 w-3 fill-current" /> Stopped
          </span>
        );
      case "failed":
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 dark:bg-rose-950/60 px-2.5 py-0.5 text-xs font-semibold text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800">
            <AlertCircle className="h-3.5 w-3.5" /> Failed
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800 px-2.5 py-0.5 text-xs font-semibold text-zinc-600 dark:text-zinc-400">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Navigation & Header */}
      <div>
        <Link
          href="/admin/scans"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#64736b] dark:text-zinc-400 hover:text-[#19352b] dark:hover:text-emerald-400 transition mb-3"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Scan History
        </Link>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-[#1a2923] dark:text-zinc-100 flex items-center gap-2">
                {isScoped ? (
                  <>
                    <span>📍 Scan:</span>
                    <span className="text-[#19352b] dark:text-emerald-400 font-extrabold">{job.keyword}</span>
                  </>
                ) : (
                  <span>Broad Property Scan</span>
                )}
              </h1>
              {job.property_category && (
                <span className="rounded-full bg-[#19352b]/10 dark:bg-emerald-950 px-2.5 py-0.5 text-xs font-bold text-[#19352b] dark:text-emerald-400 capitalize">
                  {job.property_category}
                </span>
              )}
              <SourceBadge source={job.source} />
              {getStatusBadge(job.status)}
            </div>

            <p className="mt-1 text-xs sm:text-sm text-[#64736b] dark:text-zinc-400">
              Run on {format(createdDate, "MMM d, yyyy 'at' h:mm a")} ({formatDistanceToNow(createdDate, { addSuffix: true })}) • Triggered by <strong className="font-semibold text-[#1a2923] dark:text-zinc-200">{job.created_by_name || "System"}</strong>
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            {job.status === "running" && (
              <button
                onClick={handleStopScan}
                disabled={isStoppingScan}
                className="cursor-pointer inline-flex items-center gap-1.5 rounded-lg bg-rose-600 dark:bg-rose-700 px-3.5 py-2 text-xs sm:text-sm font-semibold text-white shadow-sm hover:bg-rose-700 dark:hover:bg-rose-600 transition disabled:opacity-50"
              >
                <Square className="h-4 w-4 fill-current" />
                <span>{isStoppingScan ? "Stopping..." : "Stop Scan"}</span>
              </button>
            )}

            <button
              onClick={handleExportCSV}
              className="cursor-pointer inline-flex items-center gap-1.5 rounded-lg border border-[#dce4df] dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3.5 py-2 text-xs sm:text-sm font-semibold text-[#1a2923] dark:text-zinc-200 shadow-sm hover:bg-[#f4f6f4] dark:hover:bg-zinc-800 transition"
              title="Download results as CSV"
            >
              <Download className="h-4 w-4 text-[#19352b] dark:text-emerald-400" />
              <span>Export CSV</span>
            </button>

            {missingPhonesCount > 0 && (
              <button
                onClick={handleStartPhoneFetch}
                disabled={isFetchingPhones}
                className="cursor-pointer inline-flex items-center gap-1.5 rounded-lg bg-[#19352b] dark:bg-emerald-700 px-3.5 py-2 text-xs sm:text-sm font-semibold text-white shadow-sm hover:bg-[#132820] dark:hover:bg-emerald-600 transition disabled:opacity-60"
              >
                {isFetchingPhones ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <PhoneCall className="h-4 w-4" />
                )}
                <span>
                  {isFetchingPhones ? "Fetching..." : `Fetch Phones (${missingPhonesCount})`}
                </span>
              </button>
            )}
          </div>
        </div>

        {/* Live scan in progress banner */}
        {job.status === "running" && (
          <div className="mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-lg bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 p-3 text-xs text-blue-800 dark:text-blue-300">
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-blue-600 dark:text-blue-400 shrink-0" />
              <span className="font-medium">{job.progress || "Scan in progress..."}</span>
            </div>
            <button
              onClick={handleStopScan}
              disabled={isStoppingScan}
              className="cursor-pointer inline-flex items-center gap-1 rounded bg-rose-600 dark:bg-rose-700 px-2.5 py-1 text-xs font-semibold text-white shadow-sm hover:bg-rose-700 disabled:opacity-50 shrink-0 self-start sm:self-auto"
            >
              <Square className="h-3 w-3 fill-current" />
              <span>{isStoppingScan ? "Stopping..." : "Stop Scan"}</span>
            </button>
          </div>
        )}

        {/* Live status alert if phone fetching is in progress */}
        {isFetchingPhones && phoneFetchStatus && (
          <div className="mt-4 flex items-center gap-2 rounded-lg bg-sky-50 dark:bg-sky-950/60 border border-sky-200 dark:border-sky-800 p-3 text-xs text-sky-800 dark:text-sky-300 animate-pulse">
            <Loader2 className="h-4 w-4 animate-spin text-sky-600" />
            <span className="font-medium">{phoneFetchStatus}</span>
          </div>
        )}
      </div>

      {/* KPI Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
        <div className="rounded-xl border border-[#dce4df] dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 shadow-sm">
          <div className="flex items-center justify-between text-[#64736b] dark:text-zinc-400">
            <span className="text-xs font-medium uppercase tracking-wider">New Discovered</span>
            <Sparkles className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="mt-2 text-2xl font-extrabold text-emerald-600 dark:text-emerald-400">
            +{job.new_count}
          </div>
          <p className="mt-1 text-[11px] text-[#64736b] dark:text-zinc-400">Fresh prospects inserted</p>
        </div>

        <div className="rounded-xl border border-[#dce4df] dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 shadow-sm">
          <div className="flex items-center justify-between text-[#64736b] dark:text-zinc-400">
            <span className="text-xs font-medium uppercase tracking-wider">Location Discards</span>
            <Filter className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-amber-600 dark:text-amber-400">
            {job.filtered_count}
          </div>
          <p className="mt-1 text-[11px] text-[#64736b] dark:text-zinc-400">Title/suburb mismatched</p>
        </div>

        <div className="rounded-xl border border-[#dce4df] dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 shadow-sm">
          <div className="flex items-center justify-between text-[#64736b] dark:text-zinc-400">
            <span className="text-xs font-medium uppercase tracking-wider">Listings Evaluated</span>
            <Layers className="h-4 w-4 text-sky-600 dark:text-sky-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-[#1a2923] dark:text-zinc-100">
            {job.total_found}
          </div>
          <p className="mt-1 text-[11px] text-[#64736b] dark:text-zinc-400">{job.updated_count} already existed</p>
        </div>

        <div className="rounded-xl border border-[#dce4df] dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 shadow-sm">
          <div className="flex items-center justify-between text-[#64736b] dark:text-zinc-400">
            <span className="text-xs font-medium uppercase tracking-wider">Pages Scanned</span>
            <Clock className="h-4 w-4 text-zinc-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-[#1a2923] dark:text-zinc-100">
            {job.pages_scanned}
            {job.total_pages > 0 && (
              <span className="text-sm font-normal text-[#64736b] dark:text-zinc-400"> / {job.total_pages}</span>
            )}
          </div>
          <p className="mt-1 text-[11px] text-[#64736b] dark:text-zinc-400">Scraped pages</p>
        </div>

        <div className="col-span-2 lg:col-span-1 rounded-xl border border-[#dce4df] dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 shadow-sm">
          <div className="flex items-center justify-between text-[#64736b] dark:text-zinc-400">
            <span className="text-xs font-medium uppercase tracking-wider">Scan Duration</span>
            <Clock className="h-4 w-4 text-[#19352b] dark:text-emerald-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-[#1a2923] dark:text-zinc-100">
            {job.duration_seconds ? `${job.duration_seconds}s` : "—"}
          </div>
          <p className="mt-1 text-[11px] text-[#64736b] dark:text-zinc-400">Execution time</p>
        </div>
      </div>

      {/* Prospects Discovered Section */}
      <div className="space-y-4 pt-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#dce4df] dark:border-zinc-800 pb-3">
          <div>
            <h2 className="text-base sm:text-lg font-bold text-[#1a2923] dark:text-zinc-100">
              Discovered Prospects ({prospects.length})
            </h2>
            <p className="text-xs text-[#64736b] dark:text-zinc-400">
              Properties specifically first identified and linked to this scan run.
            </p>
          </div>

          {/* Quick Filters */}
          <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
            <button
              onClick={() => setFilterTab("all")}
              className={`cursor-pointer rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                filterTab === "all"
                  ? "bg-[#19352b] text-white dark:bg-emerald-700"
                  : "text-[#64736b] hover:bg-[#f4f6f4] dark:text-zinc-400 dark:hover:bg-zinc-800"
              }`}
            >
              All ({prospects.length})
            </button>
            <button
              onClick={() => setFilterTab("active")}
              className={`cursor-pointer rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                filterTab === "active"
                  ? "bg-[#19352b] text-white dark:bg-emerald-700"
                  : "text-[#64736b] hover:bg-[#f4f6f4] dark:text-zinc-400 dark:hover:bg-zinc-800"
              }`}
            >
              Kept ({activeCount})
            </button>
            <button
              onClick={() => setFilterTab("discarded")}
              className={`cursor-pointer rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                filterTab === "discarded"
                  ? "bg-amber-600 text-white dark:bg-amber-700"
                  : "text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40"
              }`}
            >
              Discards ({discardedCount})
            </button>
            <button
              onClick={() => setFilterTab("has_phone")}
              className={`cursor-pointer rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                filterTab === "has_phone"
                  ? "bg-[#19352b] text-white dark:bg-emerald-700"
                  : "text-[#64736b] hover:bg-[#f4f6f4] dark:text-zinc-400 dark:hover:bg-zinc-800"
              }`}
            >
              With Phone ({withPhoneCount})
            </button>
            <button
              onClick={() => setFilterTab("missing_phone")}
              className={`cursor-pointer rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                filterTab === "missing_phone"
                  ? "bg-[#19352b] text-white dark:bg-emerald-700"
                  : "text-[#64736b] hover:bg-[#f4f6f4] dark:text-zinc-400 dark:hover:bg-zinc-800"
              }`}
            >
              Missing Phone ({missingPhonesCount})
            </button>
          </div>
        </div>

        {prospectsLoading ? (
          <div className="flex flex-col items-center justify-center py-16 text-[#64736b] dark:text-zinc-400">
            <Loader2 className="h-6 w-6 animate-spin mb-2 text-[#19352b] dark:text-emerald-500" />
            <p className="text-xs font-medium">Loading prospects...</p>
          </div>
        ) : filteredProspects.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[#dce4df] dark:border-zinc-800 p-12 text-center text-[#64736b] dark:text-zinc-400">
            <p className="text-sm font-medium">No prospects match the selected filter in this scan run.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Mobile Cards (< md) */}
            <div className="grid grid-cols-1 gap-3 md:hidden">
              {filteredProspects.map((p) => {
                const isDiscarded = p.status === "discarded";

                return (
                  <div
                    key={p.id}
                    className={`rounded-xl border p-4 shadow-sm space-y-3 transition ${
                      isDiscarded
                        ? "border-amber-200 dark:border-amber-900/60 bg-amber-50/30 dark:bg-amber-950/10"
                        : "border-[#dce4df] dark:border-zinc-800 bg-white dark:bg-zinc-900"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="rounded bg-[#19352b]/10 dark:bg-emerald-950 px-2 py-0.5 text-[11px] font-bold text-[#19352b] dark:text-emerald-400 uppercase">
                            {p.property_type}
                          </span>
                          <span className="rounded bg-zinc-100 dark:bg-zinc-800 px-2 py-0.5 text-[11px] font-medium text-zinc-700 dark:text-zinc-300 uppercase">
                            {p.listing_type}
                          </span>
                          <SourceBadge source={p.source} url={p.ikman_url} />
                          {isDiscarded && (
                            <span className="inline-flex items-center gap-1 rounded bg-amber-100 dark:bg-amber-900/60 px-2 py-0.5 text-[10px] font-bold text-amber-800 dark:text-amber-300 uppercase tracking-wide">
                              <Filter className="h-3 w-3" /> Discard: {p.discard_reason ? p.discard_reason.replace("_", " ") : "location mismatch"}
                            </span>
                          )}
                        </div>
                        <a
                          href={p.ikman_url}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-1.5 block font-bold text-sm text-[#1a2923] dark:text-zinc-100 hover:text-[#19352b] dark:hover:text-emerald-400 line-clamp-2"
                        >
                          {p.title}
                        </a>
                        <p className="text-xs font-extrabold text-emerald-700 dark:text-emerald-400 mt-1">
                          {p.price}
                        </p>
                      </div>

                      <select
                        value={p.status}
                        disabled={updatingStatusId === p.id}
                        onChange={(e) => handleStatusChange(p.id, e.target.value)}
                        className={`cursor-pointer text-xs rounded border px-2 py-1 font-semibold outline-none ${
                          isDiscarded
                            ? "border-amber-300 dark:border-amber-700 bg-white dark:bg-zinc-800 text-amber-800 dark:text-amber-300"
                            : "border-[#dce4df] dark:border-zinc-700 bg-white dark:bg-zinc-800"
                        }`}
                      >
                        <option value="discarded">Discarded</option>
                        <option value="new">New</option>
                        <option value="contacted">Contacted</option>
                        <option value="ignored">Ignored</option>
                        <option value="converted">Converted</option>
                      </select>
                    </div>

                    {/* Location & Suburb */}
                    <div className="flex items-center gap-1.5 text-xs text-[#64736b] dark:text-zinc-400">
                      <MapPin className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      <span>
                        {p.suburb ? `${p.suburb}, ` : ""}
                        {p.location}
                      </span>
                    </div>

                    {/* Contact Info & Action Buttons */}
                    <div className="flex items-center justify-between border-t border-[#dce4df] dark:border-zinc-800 pt-3">
                      <div className="text-xs">
                        {p.phone_number ? (
                          <a
                            href={`tel:${p.phone_number}`}
                            className="font-bold text-[#19352b] dark:text-emerald-400 flex items-center gap-1"
                          >
                            <PhoneCall className="h-3.5 w-3.5" />
                            <span>{p.phone_number}</span>
                          </a>
                        ) : (
                          <button
                            onClick={() => handleFetchSinglePhone(p.id)}
                            disabled={singleFetchingPhoneId === p.id}
                            className="cursor-pointer text-xs font-semibold text-sky-600 hover:underline flex items-center gap-1"
                          >
                            {singleFetchingPhoneId === p.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <PhoneCall className="h-3 w-3" />
                            )}
                            <span>Fetch Phone</span>
                          </button>
                        )}
                        <p className="text-[11px] text-[#64736b] dark:text-zinc-400 mt-0.5">
                          {p.poster_name || "Owner"}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        {isDiscarded ? (
                          <button
                            onClick={() => handleStatusChange(p.id, "new")}
                            disabled={updatingStatusId === p.id}
                            className="cursor-pointer inline-flex items-center gap-1 rounded-lg bg-emerald-600 dark:bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700 dark:hover:bg-emerald-600 transition disabled:opacity-50"
                          >
                            <Undo2 className="h-3.5 w-3.5" />
                            <span>Keep</span>
                          </button>
                        ) : (
                          <button
                            onClick={() => handleGenerateDraft(p)}
                            disabled={draftLoading === p.id}
                            className="cursor-pointer inline-flex items-center gap-1 rounded-lg bg-[#19352b] dark:bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-[#132820] dark:hover:bg-emerald-600 disabled:opacity-50"
                          >
                            {draftLoading === p.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Sparkles className="h-3.5 w-3.5" />
                            )}
                            <span>Draft</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop Table View (>= md) */}
            <div className="hidden md:block overflow-hidden rounded-xl border border-[#dce4df] dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-sm">
              <table className="w-full text-left text-sm text-[#1a2923] dark:text-zinc-200">
                <thead className="bg-[#f4f6f4] dark:bg-zinc-800/50 text-[11px] font-semibold uppercase tracking-wider text-[#64736b] dark:text-zinc-400 border-b border-[#dce4df] dark:border-zinc-800">
                  <tr>
                    <th className="px-5 py-3.5">Property Listing</th>
                    <th className="px-4 py-3.5">Type & Price</th>
                    <th className="px-4 py-3.5">Location / Suburb</th>
                    <th className="px-4 py-3.5">Contact Details</th>
                    <th className="px-4 py-3.5">Status</th>
                    <th className="px-5 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#dce4df] dark:divide-zinc-800">
                  {filteredProspects.map((p) => {
                    const isDiscarded = p.status === "discarded";

                    return (
                      <tr
                        key={p.id}
                        className={`transition ${
                          isDiscarded
                            ? "bg-amber-50/20 dark:bg-amber-950/10 hover:bg-amber-50/40 dark:hover:bg-amber-950/20"
                            : "hover:bg-[#f9faf9] dark:hover:bg-zinc-800/40"
                        }`}
                      >
                        <td className="px-5 py-4 max-w-sm">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <a
                              href={p.ikman_url}
                              target="_blank"
                              rel="noreferrer"
                              className="font-semibold text-[#1a2923] dark:text-zinc-100 hover:text-[#19352b] dark:hover:text-emerald-400 flex items-center gap-1.5 group"
                            >
                              <span className="line-clamp-2">{p.title}</span>
                              <ExternalLink className="h-3.5 w-3.5 text-[#64736b] group-hover:text-[#19352b] dark:group-hover:text-emerald-400 shrink-0 opacity-60" />
                            </a>
                            <SourceBadge source={p.source} url={p.ikman_url} />
                          </div>
                          {isDiscarded && (
                            <span className="mt-1 inline-flex items-center gap-1 rounded bg-amber-100 dark:bg-amber-900/60 px-2 py-0.5 text-[10px] font-bold text-amber-800 dark:text-amber-300">
                              <Filter className="h-3 w-3" /> Filtered: {p.discard_reason ? p.discard_reason.replace("_", " ") : "location mismatch"}
                            </span>
                          )}
                        </td>

                        <td className="px-4 py-4">
                          <div className="font-bold text-emerald-700 dark:text-emerald-400">{p.price}</div>
                          <div className="text-xs text-[#64736b] dark:text-zinc-400 uppercase mt-0.5">
                            {p.property_type} • {p.listing_type}
                          </div>
                        </td>

                        <td className="px-4 py-4 text-xs">
                          <div className="font-medium text-[#1a2923] dark:text-zinc-200 flex items-center gap-1">
                            <MapPin className="h-3 w-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
                            <span>{p.suburb || p.location}</span>
                          </div>
                          {p.suburb && p.location && (
                            <div className="text-[11px] text-[#64736b] dark:text-zinc-400 ml-4">
                              District: {p.location}
                            </div>
                          )}
                        </td>

                        <td className="px-4 py-4 text-xs">
                          {p.phone_number ? (
                            <a
                              href={`tel:${p.phone_number}`}
                              className="font-bold text-[#19352b] dark:text-emerald-400 hover:underline flex items-center gap-1"
                            >
                              <PhoneCall className="h-3.5 w-3.5 text-emerald-600" />
                              <span>{p.phone_number}</span>
                            </a>
                          ) : (
                            <button
                              onClick={() => handleFetchSinglePhone(p.id)}
                              disabled={singleFetchingPhoneId === p.id}
                              className="cursor-pointer font-semibold text-sky-600 hover:underline flex items-center gap-1"
                            >
                              {singleFetchingPhoneId === p.id ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <PhoneCall className="h-3 w-3" />
                              )}
                              <span>Fetch Phone</span>
                            </button>
                          )}
                          <div className="text-[11px] text-[#64736b] dark:text-zinc-400 mt-0.5">
                            {p.poster_name || "Owner (private)"}
                          </div>
                        </td>

                        <td className="px-4 py-4">
                          <select
                            value={p.status}
                            disabled={updatingStatusId === p.id}
                            onChange={(e) => handleStatusChange(p.id, e.target.value)}
                            className={`cursor-pointer text-xs rounded border px-2 py-1 font-semibold outline-none focus:border-[#19352b] ${
                              isDiscarded
                                ? "border-amber-300 dark:border-amber-700 bg-white dark:bg-zinc-800 text-amber-800 dark:text-amber-300"
                                : "border-[#dce4df] dark:border-zinc-700 bg-white dark:bg-zinc-800"
                            }`}
                          >
                            <option value="discarded">Discarded</option>
                            <option value="new">New</option>
                            <option value="contacted">Contacted</option>
                            <option value="ignored">Ignored</option>
                            <option value="converted">Converted</option>
                          </select>
                        </td>

                        <td className="px-5 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {isDiscarded ? (
                              <button
                                onClick={() => handleStatusChange(p.id, "new")}
                                disabled={updatingStatusId === p.id}
                                className="cursor-pointer inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 dark:bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700 dark:hover:bg-emerald-600 transition disabled:opacity-50"
                                title="Restore this prospect to active pipeline"
                              >
                                <Undo2 className="h-3.5 w-3.5" />
                                <span>Keep</span>
                              </button>
                            ) : (
                              <button
                                onClick={() => handleGenerateDraft(p)}
                                disabled={draftLoading === p.id}
                                className="cursor-pointer inline-flex items-center gap-1.5 rounded-lg bg-[#19352b] dark:bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-[#132820] dark:hover:bg-emerald-600 transition disabled:opacity-50"
                              >
                                {draftLoading === p.id ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Sparkles className="h-3.5 w-3.5" />
                                )}
                                <span>Draft</span>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
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
                  Next <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Review Property Draft Modal */}
      {draftModalData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl rounded-xl bg-white dark:bg-zinc-950 p-6 shadow-2xl">
            <h2 className="mb-4 text-lg font-bold text-[#1a2923] dark:text-zinc-200">
              Review Property Draft
            </h2>
            <div className="max-h-[60vh] overflow-y-auto space-y-4 text-sm text-[#1a2923] dark:text-zinc-200">
              <div>
                <label className="block text-xs font-medium text-[#64736b] dark:text-zinc-400">Title</label>
                <input
                  className="w-full rounded border border-[#dce4df] dark:border-zinc-800 bg-white dark:bg-zinc-900 p-2 outline-none focus:border-[#28513f] dark:focus:border-emerald-600"
                  value={draftModalData.title}
                  onChange={(e) => setDraftModalData({ ...draftModalData, title: e.target.value })}
                />
              </div>
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-[#64736b] dark:text-zinc-400">Price (Numeric)</label>
                  <input
                    type="number"
                    className="w-full rounded border border-[#dce4df] dark:border-zinc-800 bg-white dark:bg-zinc-900 p-2 outline-none focus:border-[#28513f] dark:focus:border-emerald-600"
                    value={draftModalData.price}
                    onChange={(e) => setDraftModalData({ ...draftModalData, price: Number(e.target.value) })}
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-medium text-[#64736b] dark:text-zinc-400">Location</label>
                  <input
                    className="w-full rounded border border-[#dce4df] dark:border-zinc-800 bg-white dark:bg-zinc-900 p-2 outline-none focus:border-[#28513f] dark:focus:border-emerald-600"
                    value={draftModalData.location || ""}
                    onChange={(e) => setDraftModalData({ ...draftModalData, location: e.target.value })}
                  />
                </div>
              </div>
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-[#64736b] dark:text-zinc-400">Bedrooms</label>
                  <input
                    type="number"
                    className="w-full rounded border border-[#dce4df] dark:border-zinc-800 bg-white dark:bg-zinc-900 p-2 outline-none focus:border-[#28513f] dark:focus:border-emerald-600"
                    value={draftModalData.bedrooms || ""}
                    onChange={(e) => setDraftModalData({ ...draftModalData, bedrooms: Number(e.target.value) })}
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-medium text-[#64736b] dark:text-zinc-400">Bathrooms</label>
                  <input
                    type="number"
                    className="w-full rounded border border-[#dce4df] dark:border-zinc-800 bg-white dark:bg-zinc-900 p-2 outline-none focus:border-[#28513f] dark:focus:border-emerald-600"
                    value={draftModalData.bathrooms || ""}
                    onChange={(e) => setDraftModalData({ ...draftModalData, bathrooms: Number(e.target.value) })}
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-medium text-[#64736b] dark:text-zinc-400">Property Type</label>
                  <select
                    className="w-full rounded border border-[#dce4df] dark:border-zinc-800 bg-white dark:bg-zinc-900 p-2 outline-none focus:border-[#28513f] dark:focus:border-emerald-600"
                    value={draftModalData.property_type || "house"}
                    onChange={(e) => setDraftModalData({ ...draftModalData, property_type: e.target.value })}
                  >
                    <option value="house">House</option>
                    <option value="apartment">Apartment</option>
                    <option value="land">Land</option>
                    <option value="commercial">Commercial</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-[#64736b] dark:text-zinc-400">Contact Name</label>
                  <input
                    className="w-full rounded border border-[#dce4df] dark:border-zinc-800 bg-white dark:bg-zinc-900 p-2 outline-none focus:border-[#28513f] dark:focus:border-emerald-600"
                    value={draftModalData.contact_name || ""}
                    onChange={(e) => setDraftModalData({ ...draftModalData, contact_name: e.target.value })}
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-medium text-[#64736b] dark:text-zinc-400">Contact Phone</label>
                  <input
                    className="w-full rounded border border-[#dce4df] dark:border-zinc-800 bg-white dark:bg-zinc-900 p-2 outline-none focus:border-[#28513f] dark:focus:border-emerald-600"
                    value={draftModalData.contact_phone || ""}
                    onChange={(e) => setDraftModalData({ ...draftModalData, contact_phone: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-[#64736b] dark:text-zinc-400">Description</label>
                <textarea
                  className="h-32 w-full rounded border border-[#dce4df] dark:border-zinc-800 bg-white dark:bg-zinc-900 p-2 outline-none focus:border-[#28513f] dark:focus:border-emerald-600"
                  value={draftModalData.description}
                  onChange={(e) => setDraftModalData({ ...draftModalData, description: e.target.value })}
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setDraftModalData(null)}
                disabled={isPublishing}
                className="cursor-pointer rounded px-4 py-2 text-sm font-medium text-gray-700 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-800 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handlePublishDraft}
                disabled={isPublishing}
                className="cursor-pointer rounded bg-[#19352b] dark:bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-[#2a4d40] dark:hover:bg-emerald-600 disabled:cursor-wait disabled:opacity-70"
              >
                {isPublishing ? "Publishing..." : "Approve & Publish"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
