"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { format, parseISO, formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { ExternalLink, RefreshCw, Filter, Search, PhoneCall, Clock, X, CheckCircle2, Sparkles, MapPin, Compass, Undo2, Square, CheckSquare, Send, Bookmark, Bot } from "lucide-react";

import {
  Prospect,
  getProspects,
  updateProspect,
  getScanStatus,
  stopScanJob,
  fetchProspectPhone,
  startBulkPhoneFetch,
  getBulkPhoneFetchStatus,
  generatePropertyDraft,
  createProperty,
  AuthUser,
  createPropertyContact,
  getCurrentUser,
  getScanPresets,
  ScanPreset,
  createFieldAssignments,
} from "../../../../lib/api";
import { ScanLauncherDrawer } from "../../../../components/admin/ScanLauncherDrawer";
import { SourceBadge } from "../../../../components/admin/SourceBadge";
import DiscardProspectModal, { getDiscardReasonLabel, isBrokerSignalReason } from "../../../../components/admin/DiscardProspectModal";

export default function ProspectsPage() {
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filters & Pagination
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [filterSource, setFilterSource] = useState<string>("");
  const [transactionType, setTransactionType] = useState<"sale" | "rent">("sale");
  const [propertyType, setPropertyType] = useState<string>("all");
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [selectedPreset, setSelectedPreset] = useState<ScanPreset | null>(null);
  const [presets, setPresets] = useState<ScanPreset[]>([]);
  const autoFetchPhonesRef = useRef(false);

  useEffect(() => {
    getScanPresets()
      .then((p) => {
        if (Array.isArray(p)) setPresets(p);
      })
      .catch(() => {});
  }, []);


  // Search
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => setDebouncedSearch(value), 350);
  };

  const clearSearch = () => {
    setSearchQuery("");
    setDebouncedSearch("");
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
  };
  
  // Scan State
  const [isScanModalOpen, setIsScanModalOpen] = useState(false);
  
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [scanStatus, setScanStatus] = useState<{ status: string; progress: string; error?: string } | null>(null);
  const [isStoppingScan, setIsStoppingScan] = useState(false);

  const [activePhoneJobId, setActivePhoneJobId] = useState<string | null>(null);
  const [phoneJobStatus, setPhoneJobStatus] = useState<{ status: string; progress: string; error?: string } | null>(null);
  const [isStoppingPhoneJob, setIsStoppingPhoneJob] = useState(false);
  const [fetchingPhoneId, setFetchingPhoneId] = useState<string | null>(null);

  const [lastScanAt, setLastScanAt] = useState<string | null>(null);
  const [lastScanBy, setLastScanBy] = useState<string | null>(null);
  const [lastPhoneFetchAt, setLastPhoneFetchAt] = useState<string | null>(null);
  const [lastPhoneFetchBy, setLastPhoneFetchBy] = useState<string | null>(null);
  const [showExactTime, setShowExactTime] = useState(false);

  const [user, setUser] = useState<AuthUser | null>(null);
  useEffect(() => {
    getCurrentUser().then(setUser).catch(() => {});
  }, []);
  const isAdminOrRoot = user?.role === "admin" || user?.role === "root";

  const [telegramAgentConfigured, setTelegramAgentConfigured] = useState(false);
  const [selectedProspectIds, setSelectedProspectIds] = useState<Set<string>>(new Set());
  const [isAssigning, setIsAssigning] = useState(false);

  const toggleSelectProspect = (id: string) => {
    setSelectedProspectIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAllOnPage = () => {
    const visible = prospects.filter((p) => !filterSource || (p.source || "ikman").toLowerCase() === filterSource.toLowerCase());
    const allSelected = visible.length > 0 && visible.every((p) => selectedProspectIds.has(p.id));
    if (allSelected) {
      setSelectedProspectIds(new Set());
    } else {
      setSelectedProspectIds(new Set(visible.map((p) => p.id)));
    }
  };

  const handleBulkAssign = async () => {
    if (selectedProspectIds.size === 0) return;
    setIsAssigning(true);
    try {
      const ids = Array.from(selectedProspectIds);
      const result = await createFieldAssignments(ids);
      toast.success(`Dispatched ${result.length} prospect(s) to agent on Telegram.`);
      setProspects((prev) =>
        prev.map((p) =>
          selectedProspectIds.has(p.id) ? { ...p, assignment_status: "pending" } : p
        )
      );
      setSelectedProspectIds(new Set());
    } catch (err: any) {
      toast.error(err.message || "Failed to dispatch assignments to agent.");
    } finally {
      setIsAssigning(false);
    }
  };

  const handleSingleAssign = async (prospectId: string) => {
    setIsAssigning(true);
    try {
      const result = await createFieldAssignments([prospectId]);
      if (result.length > 0) {
        toast.success("Dispatched to agent on Telegram.");
        setProspects((prev) =>
          prev.map((p) =>
            p.id === prospectId ? { ...p, assignment_status: "pending" } : p
          )
        );
      } else {
        toast.info("This prospect already has an active assignment.");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to dispatch assignment to agent.");
    } finally {
      setIsAssigning(false);
    }
  };

  const [draftLoading, setDraftLoading] = useState<string | null>(null);
  const [draftModalData, setDraftModalData] = useState<any>(null);
  const [draftProspectId, setDraftProspectId] = useState<string | null>(null);
  const [isPublishing, setIsPublishing] = useState(false);
  const [updatingStatusId, setUpdatingStatusId] = useState<string | null>(null);
  const [discardModalProspect, setDiscardModalProspect] = useState<Prospect | null>(null);
  const [isDiscarding, setIsDiscarding] = useState(false);

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
        } catch (err: any) {
          toast.error("Failed to create property contact, but continuing with property creation...");
          console.error(err);
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
      toast.success("Property created successfully!");
      setDraftModalData(null);
      setDraftProspectId(null);
      fetchProspects();
    } catch (err: any) {
      toast.error(err.message || "Failed to create property");
    } finally {
      setIsPublishing(false);
    }
  };

  const fetchProspects = async () => {
    setLoading(true);

    const property_type = propertyType === "all" ? undefined : propertyType;
    const listing_type = transactionType;

    try {
      const data = await getProspects({
        status: filterStatus || undefined,
        property_type,
        listing_type,
        page,
        page_size: 25,
        q: debouncedSearch || undefined,
      });
      setProspects(data.items);
      setTotalPages(data.total_pages);
      if (typeof data.telegram_agent_configured === "boolean") {
        setTelegramAgentConfigured(data.telegram_agent_configured);
      }
    } catch (err) {
      toast.error("Failed to load prospects");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProspects();
  }, [filterStatus, transactionType, propertyType, page, debouncedSearch]);

  const refreshActiveJobs = async () => {
    try {
      const { getActiveJobs } = await import("../../../../lib/api");
      const active = await getActiveJobs();
      if (active.scan) setActiveJobId(active.scan);
      if (active.phone_fetch) setActivePhoneJobId(active.phone_fetch);
      if (active.last_scan_at) setLastScanAt(active.last_scan_at);
      if (active.last_scan_by) setLastScanBy(active.last_scan_by);
      if (active.last_phone_fetch_at) setLastPhoneFetchAt(active.last_phone_fetch_at);
      if (active.last_phone_fetch_by) setLastPhoneFetchBy(active.last_phone_fetch_by);
    } catch (err) {
      // ignore if it fails
    }
  };

  useEffect(() => {
    // Check for active jobs on mount
    refreshActiveJobs();
  }, []);

  // Polling for scan progress
  useEffect(() => {
    if (!activeJobId) return;
    
    const interval = setInterval(async () => {
      try {
        const status = await getScanStatus(activeJobId);
        setScanStatus(status);
        if (status.status === "completed" || status.status === "failed" || status.status === "cancelled") {
          setActiveJobId(null);
          fetchProspects();
          refreshActiveJobs();
          if (status.status === "completed") {
            toast.success("Scan completed successfully");
            if (autoFetchPhonesRef.current) {
              autoFetchPhonesRef.current = false;
              toast.info("Auto-initiating phone sync for discovered owners...");
              handleStartBulkPhoneFetch();
            }
          } else if (status.status === "cancelled") {
            toast.info("Scan stopped");
          } else {
            toast.error(`Scan failed: ${status.error}`);
          }
        }
      } catch (err) {
        console.error(err);
      }
    }, 2000);
    
    return () => clearInterval(interval);
  }, [activeJobId]);

  // Polling for bulk phone fetch progress
  useEffect(() => {
    if (!activePhoneJobId) return;
    
    const interval = setInterval(async () => {
      try {
        const status = await getBulkPhoneFetchStatus(activePhoneJobId);
        setPhoneJobStatus(status);
        if (status.status === "completed" || status.status === "failed" || status.status === "cancelled") {
          setActivePhoneJobId(null);
          fetchProspects();
          refreshActiveJobs();
          if (status.status === "completed") {
            toast.success("Bulk phone fetch completed");
          } else if (status.status === "cancelled") {
            toast.info("Bulk phone fetch stopped");
          } else {
            toast.error(`Bulk phone fetch failed: ${status.error}`);
          }
        }
      } catch (err) {
        console.error(err);
      }
    }, 2000);
    
    return () => clearInterval(interval);
  }, [activePhoneJobId]);


  const handleUpdateStatus = async (id: string, newStatus: string, discardReason?: string | null) => {
    if (newStatus === "discarded" && !discardReason) {
      const target = prospects.find((p) => p.id === id);
      if (target) {
        setDiscardModalProspect(target);
        return;
      }
    }

    setUpdatingStatusId(id);
    try {
      const oldProspect = prospects.find(p => p.id === id);
      const oldStatus = oldProspect?.status;
      const updated = await updateProspect(id, newStatus, discardReason);
      setProspects(prev => prev.map(p => p.id === id ? updated : p));
      if (oldStatus === "discarded" && newStatus !== "discarded") {
        toast.success(`Prospect restored to active! Status: ${newStatus}`);
      } else if (oldStatus !== "discarded" && newStatus === "discarded") {
        toast.info("Prospect moved to discarded");
      } else {
        toast.success("Status updated");
      }
    } catch (err) {
      toast.error("Failed to update status");
    } finally {
      setUpdatingStatusId(null);
    }
  };

  const handleConfirmDiscard = async (prospectId: string, discardReason: string) => {
    setIsDiscarding(true);
    try {
      await handleUpdateStatus(prospectId, "discarded", discardReason);
    } finally {
      setIsDiscarding(false);
    }
  };

  const handleStopScan = async () => {
    if (!activeJobId) return;
    setIsStoppingScan(true);
    try {
      await stopScanJob(activeJobId);
      toast.info("Scan stop requested");
    } catch (err: any) {
      toast.error(err.message || "Failed to stop scan");
    } finally {
      setIsStoppingScan(false);
    }
  };

  const handleStopPhoneJob = async () => {
    if (!activePhoneJobId) return;
    setIsStoppingPhoneJob(true);
    try {
      await stopScanJob(activePhoneJobId);
      toast.info("Phone sync stop requested");
    } catch (err: any) {
      toast.error(err.message || "Failed to stop phone sync");
    } finally {
      setIsStoppingPhoneJob(false);
    }
  };

  const handleStartBulkPhoneFetch = async () => {
    try {
      const res = await startBulkPhoneFetch();
      setActivePhoneJobId(res.job_id);
      setPhoneJobStatus({ status: "running", progress: "Starting..." });
      toast.info("Bulk phone fetch started");
    } catch (err) {
      toast.error("Failed to start bulk phone fetch");
    }
  };

  const handleFetchSinglePhone = async (id: string) => {
    setFetchingPhoneId(id);
    const loadingToast = toast.loading("Fetching phone number...");
    try {
      const updated = await fetchProspectPhone(id);
      setProspects(prev => prev.map(p => p.id === id ? updated : p));
      toast.success("Phone number fetched!", { id: loadingToast });
    } catch (err) {
      toast.error("Failed to fetch phone number", { id: loadingToast });
    } finally {
      setFetchingPhoneId(null);
    }
  };

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Find Prospects</h1>
          <p className="mt-2 text-sm text-[#64736b] dark:text-zinc-400">Scrape property listings from ikman.lk to find new leads.</p>
        </div>
        <div className="flex flex-col items-center sm:items-end gap-1.5 w-full sm:w-auto">
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
            <button
              onClick={handleStartBulkPhoneFetch}
              disabled={activePhoneJobId !== null}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-white dark:bg-zinc-950 border border-[#cbd8d1] dark:border-zinc-700 px-4 py-2 text-sm font-semibold text-[#19352b] dark:text-zinc-200 shadow-sm hover:bg-[#f4f6f4] dark:hover:bg-zinc-800 disabled:opacity-50 cursor-pointer disabled:cursor-default w-full sm:w-auto"
            >
              <PhoneCall className="h-4 w-4" />
              {activePhoneJobId ? "Syncing..." : "Sync Phone Numbers"}
            </button>
            {isAdminOrRoot && (
              <>
                <Link
                  href="/admin/scans"
                  className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-white dark:bg-zinc-950 border border-[#cbd8d1] dark:border-zinc-700 px-3.5 py-2 text-sm font-semibold text-[#19352b] dark:text-zinc-200 shadow-sm hover:bg-[#f4f6f4] dark:hover:bg-zinc-800 cursor-pointer w-full sm:w-auto"
                >
                  <Compass className="h-4 w-4 text-[#19352b] dark:text-emerald-400" />
                  <span>Scanner Hub</span>
                </Link>
                <button
                  onClick={() => setIsScanModalOpen(true)}
                  disabled={activeJobId !== null}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#19352b] dark:bg-emerald-700 px-4 py-2 text-sm font-semibold text-white dark:text-zinc-200 shadow-sm hover:bg-[#132820] dark:hover:bg-emerald-600 disabled:opacity-50 cursor-pointer disabled:cursor-default w-full sm:w-auto"
                >
                  <Search className="h-4 w-4" />
                  {activeJobId ? "Scan Running..." : "New Scan"}
                </button>
              </>
            )}
          </div>
          {(lastScanAt || lastPhoneFetchAt) && (
            <div className="flex items-center gap-2 text-[11px] text-[#64736b] dark:text-zinc-400 pr-1 mt-1 sm:mt-0 flex-wrap justify-center sm:justify-end">
              <button 
                onClick={() => setShowExactTime(prev => !prev)}
                className="flex items-center gap-1.5 cursor-pointer hover:text-[#1a2923] dark:hover:text-white transition-colors underline decoration-dotted underline-offset-2 decoration-[#cbd8d1]"
              >
                <Clock className="h-3 w-3 opacity-70" />
                <span>
                  {lastScanAt && (
                    <span title={format(parseISO(lastScanAt), "PPP p")}>
                      Scanned {showExactTime ? format(parseISO(lastScanAt), "MMM d, h:mm a") : formatDistanceToNow(parseISO(lastScanAt), { addSuffix: true })}
                      {lastScanBy && ` by ${lastScanBy}`}
                    </span>
                  )}
                  {lastScanAt && lastPhoneFetchAt && " • "}
                  {lastPhoneFetchAt && (
                    <span title={format(parseISO(lastPhoneFetchAt), "PPP p")}>
                      Synced {showExactTime ? format(parseISO(lastPhoneFetchAt), "MMM d, h:mm a") : formatDistanceToNow(parseISO(lastPhoneFetchAt), { addSuffix: true })}
                      {lastPhoneFetchBy && ` by ${lastPhoneFetchBy}`}
                    </span>
                  )}
                </span>
              </button>
              {isAdminOrRoot && (
                <>
                  <span>•</span>
                  <Link
                    href="/admin/scans?type=phone_fetch"
                    className="font-semibold text-emerald-700 dark:text-emerald-400 hover:underline inline-flex items-center gap-0.5"
                  >
                    <span>Sync Log →</span>
                  </Link>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Quick Presets Bar */}
      {isAdminOrRoot && (
        <div className="mt-3 flex items-center gap-1.5 overflow-x-auto whitespace-nowrap pb-1 pt-1 text-xs [&::-webkit-scrollbar]:hidden" style={{ scrollbarWidth: "none" }}>
          <span className="font-bold text-[#718078] dark:text-zinc-400 text-[11px] uppercase tracking-wider shrink-0 flex items-center gap-1 mr-1">
            <Bookmark className="h-3 w-3 text-[#19352b] dark:text-emerald-400" /> Presets:
          </span>
          {presets.map((preset) => (
            <button
              key={preset.id}
              onClick={() => {
                setSelectedPreset(preset);
                setIsScanModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 rounded-full border border-[#dce4df] dark:border-zinc-800 bg-white dark:bg-zinc-900 px-3 py-1 text-xs font-medium text-[#1a2923] dark:text-zinc-200 hover:border-[#19352b] hover:bg-[#f4f6f4] dark:hover:bg-zinc-800 transition cursor-pointer"
            >
              <span>{preset.name}</span>
            </button>
          ))}
          <button
            onClick={() => {
              setSelectedPreset(null);
              setIsScanModalOpen(true);
            }}
            className="inline-flex items-center gap-1 rounded-full border border-dashed border-[#cbd8d1] dark:border-zinc-700 bg-transparent px-2.5 py-1 text-xs font-medium text-[#64736b] dark:text-zinc-400 hover:border-[#19352b] hover:text-[#19352b] dark:hover:text-zinc-200 transition cursor-pointer"
          >
            <span>+ Custom Scan</span>
          </button>
        </div>
      )}
      
      {activeJobId && scanStatus && (
        <div className="mt-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-lg border border-blue-200 dark:border-blue-900/50 bg-blue-50 dark:bg-blue-900/20 p-4">
          <div className="flex items-center gap-3">
            <RefreshCw className="h-5 w-5 animate-spin text-blue-600 dark:text-blue-400 shrink-0" />
            <div>
              <h3 className="text-sm font-medium text-blue-800 dark:text-blue-300">Scan in progress</h3>
              <p className="text-sm text-blue-600 dark:text-blue-400">{scanStatus.progress}</p>
            </div>
          </div>
          <div className="flex items-center gap-2.5 shrink-0">
            <button
              onClick={handleStopScan}
              disabled={isStoppingScan}
              className="cursor-pointer inline-flex items-center gap-1.5 rounded-lg bg-rose-600 dark:bg-rose-700 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-rose-700 dark:hover:bg-rose-600 transition disabled:opacity-50"
            >
              <Square className="h-3 w-3 fill-current" />
              <span>{isStoppingScan ? "Stopping..." : "Stop Scan"}</span>
            </button>
            <Link
              href={`/admin/scans/${activeJobId}`}
              className="inline-flex items-center gap-1 text-xs font-bold text-blue-700 dark:text-blue-300 hover:underline"
            >
              <span>Track Outcomes</span>
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      )}

      {activePhoneJobId && phoneJobStatus && (
        <div className="mt-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-lg border border-orange-200 dark:border-orange-900/50 bg-orange-50 dark:bg-orange-900/20 p-4">
          <div className="flex items-center gap-3">
            <RefreshCw className="h-5 w-5 animate-spin text-orange-600 dark:text-orange-400 shrink-0" />
            <div>
              <h3 className="text-sm font-medium text-orange-800 dark:text-orange-300">Bulk Phone Fetch in progress</h3>
              <p className="text-sm text-orange-600 dark:text-orange-400">{phoneJobStatus.progress}</p>
            </div>
          </div>
          <div className="flex items-center gap-2.5 shrink-0">
            <button
              onClick={handleStopPhoneJob}
              disabled={isStoppingPhoneJob}
              className="cursor-pointer inline-flex items-center gap-1.5 rounded-lg bg-rose-600 dark:bg-rose-700 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-rose-700 dark:hover:bg-rose-600 transition disabled:opacity-50"
            >
              <Square className="h-3 w-3 fill-current" />
              <span>{isStoppingPhoneJob ? "Stopping..." : "Stop Sync"}</span>
            </button>
            <Link
              href="/admin/scans?type=phone_fetch"
              className="inline-flex items-center gap-1 text-xs font-bold text-orange-700 dark:text-orange-300 hover:underline"
            >
              <span>View Log</span>
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      )}

      {/* Filters + Search */}
      <div className="mt-8 flex flex-col gap-4 border-b border-[#dce4df] dark:border-zinc-800 pb-4">
        {/* Search bar */}
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#718078] dark:text-zinc-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search by location, title or contact name…"
            className="w-full rounded-lg border border-[#cbd8d1] dark:border-zinc-700 bg-white dark:bg-zinc-950 pl-9 pr-9 py-2 text-sm outline-none focus:border-[#28513f] dark:focus:border-emerald-600 placeholder:text-[#a0aba4] dark:placeholder:text-zinc-500"
          />
          {searchQuery && (
            <button
              onClick={clearSearch}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-[#718078] dark:text-zinc-400 hover:text-[#1a2923] dark:hover:text-white cursor-pointer transition-colors"
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Filter row */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex items-center gap-2 text-sm shrink-0">
          <Filter className="h-4 w-4 text-[#718078] dark:text-zinc-400" />
          <span className="font-medium text-[#1a2923] dark:text-zinc-200">Filters</span>
        </div>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="cursor-pointer rounded-lg border border-[#cbd8d1] dark:border-zinc-700 px-3 py-1.5 text-sm outline-none focus:border-[#28513f] w-full sm:w-auto"
        >
          <option value="">All Statuses</option>
          <option value="new">New</option>
          <option value="contacted">Contacted</option>
          <option value="converted">Converted</option>
          <option value="discarded">Discarded</option>
        </select>
        <select
          value={filterSource}
          onChange={(e) => setFilterSource(e.target.value)}
          className="cursor-pointer rounded-lg border border-[#cbd8d1] dark:border-zinc-700 px-3 py-1.5 text-sm outline-none focus:border-[#28513f] w-full sm:w-auto"
        >
          <option value="">All Portals</option>
          <option value="ikman">ikman.lk</option>
          <option value="lpw">LankaPropertyWeb</option>
        </select>
        {/* Segmented Control for Transaction Type */}
        <div className="flex shrink-0 items-center rounded-lg bg-[#f4f6f4] dark:bg-zinc-900 dark:bg-zinc-900 p-1 w-full sm:w-auto">
          <button
            onClick={() => { setTransactionType("sale"); setPropertyType("all"); setPage(1); }}
            className={`flex-1 sm:flex-none cursor-pointer rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
              transactionType === "sale" 
                ? "bg-white dark:bg-zinc-950 text-[#19352b] dark:text-zinc-200 shadow-sm" 
                : "text-[#64736b] dark:text-zinc-400 hover:text-[#1a2923] dark:hover:text-white dark:text-zinc-200 dark:text-zinc-200"
            }`}
          >
            Sales
          </button>
          <button
            onClick={() => { setTransactionType("rent"); setPropertyType("all"); setPage(1); }}
            className={`flex-1 sm:flex-none cursor-pointer rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
              transactionType === "rent" 
                ? "bg-white dark:bg-zinc-950 text-[#19352b] dark:text-zinc-200 shadow-sm" 
                : "text-[#64736b] dark:text-zinc-400 hover:text-[#1a2923] dark:hover:text-white dark:text-zinc-200 dark:text-zinc-200"
            }`}
          >
            Rentals
          </button>
        </div>

        {/* Pill Buttons for Property Type */}
        <div className="flex items-center gap-2 overflow-x-auto whitespace-nowrap w-full sm:w-auto pb-2 sm:pb-0 [&::-webkit-scrollbar]:hidden" style={{ scrollbarWidth: "none" }}>
          <button
            onClick={() => { setPropertyType("all"); setPage(1); }}
            className={`cursor-pointer rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${
              propertyType === "all"
                ? "border-[#19352b] dark:border-emerald-700 bg-[#19352b] dark:bg-emerald-700 text-white dark:text-zinc-200"
                : "border-[#cbd8d1] dark:border-zinc-700 bg-white dark:bg-zinc-950 text-[#64736b] dark:text-zinc-400 hover:border-[#1a2923] hover:text-[#1a2923] dark:hover:text-white dark:text-zinc-200 dark:text-zinc-200"
            }`}
          >
            All
          </button>
          <button
            onClick={() => { setPropertyType("house"); setPage(1); }}
            className={`cursor-pointer rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${
              propertyType === "house"
                ? "border-[#19352b] dark:border-emerald-700 bg-[#19352b] dark:bg-emerald-700 text-white dark:text-zinc-200"
                : "border-[#cbd8d1] dark:border-zinc-700 bg-white dark:bg-zinc-950 text-[#64736b] dark:text-zinc-400 hover:border-[#1a2923] hover:text-[#1a2923] dark:hover:text-white dark:text-zinc-200 dark:text-zinc-200"
            }`}
          >
            Houses
          </button>
          <button
            onClick={() => { setPropertyType("apartment"); setPage(1); }}
            className={`cursor-pointer rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${
              propertyType === "apartment"
                ? "border-[#19352b] dark:border-emerald-700 bg-[#19352b] dark:bg-emerald-700 text-white dark:text-zinc-200"
                : "border-[#cbd8d1] dark:border-zinc-700 bg-white dark:bg-zinc-950 text-[#64736b] dark:text-zinc-400 hover:border-[#1a2923] hover:text-[#1a2923] dark:hover:text-white dark:text-zinc-200 dark:text-zinc-200"
            }`}
          >
            Apartments
          </button>
          {transactionType === "sale" && (
            <button
              onClick={() => { setPropertyType("land"); setPage(1); }}
              className={`cursor-pointer rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${
                propertyType === "land"
                  ? "border-[#19352b] dark:border-emerald-700 bg-[#19352b] dark:bg-emerald-700 text-white dark:text-zinc-200"
                  : "border-[#cbd8d1] dark:border-zinc-700 bg-white dark:bg-zinc-950 text-[#64736b] dark:text-zinc-400 hover:border-[#1a2923] hover:text-[#1a2923] dark:hover:text-white dark:text-zinc-200 dark:text-zinc-200"
              }`}
            >
              Land
            </button>
          )}
        </div>
        </div>
      </div>

      <div className="mt-6 overflow-hidden rounded-xl border border-[#dce4df] dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-sm">
        
        {/* Mobile Cards */}
        <div className="flex flex-col divide-y divide-[#dce4df] dark:divide-zinc-800 md:hidden">
          {loading ? (
            <div className="p-6 text-center text-[#64736b] dark:text-zinc-400">Loading prospects...</div>
          ) : prospects.length === 0 ? (
            <div className="p-6 text-center text-[#64736b] dark:text-zinc-400">No prospects found.</div>
          ) : (
            prospects
              .filter((p) => !filterSource || (p.source || "ikman").toLowerCase() === filterSource.toLowerCase())
              .map((prospect) => {
              const isDiscarded = prospect.status === "discarded";
              const isTerminal = ["discarded", "converted", "unavailable", "agent_no_deal", "agent_co_broke"].includes(prospect.status);
              const isSelected = selectedProspectIds.has(prospect.id);
              return (
                <div
                  key={prospect.id}
                  className={`p-4 flex flex-col gap-3 ${
                    isSelected
                      ? "bg-emerald-50/60 dark:bg-emerald-950/30 ring-1 ring-emerald-500/30"
                      : isDiscarded
                      ? "bg-amber-50/25 dark:bg-amber-950/15 hover:bg-amber-50/40 dark:hover:bg-amber-950/25"
                      : isTerminal
                      ? "bg-zinc-50/50 dark:bg-zinc-900/50 opacity-70 hover:opacity-90"
                      : "hover:bg-[#f4f6f4] dark:hover:bg-zinc-800 dark:bg-zinc-900/50"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 flex-wrap">
                      {isAdminOrRoot && telegramAgentConfigured && (
                        <button
                          type="button"
                          onClick={() => toggleSelectProspect(prospect.id)}
                          className="p-1 -ml-1 text-[#64736b] hover:text-[#19352b] dark:text-zinc-400 dark:hover:text-emerald-400 cursor-pointer"
                          title={isSelected ? "Deselect" : "Select for agent assignment"}
                        >
                          {isSelected ? (
                            <CheckSquare className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                          ) : (
                            <Square className="h-4 w-4" />
                          )}
                        </button>
                      )}
                      <span className="text-xs text-[#64736b] dark:text-zinc-400">
                        {format(parseISO(prospect.first_seen_at), "MMM d, yyyy")}
                      </span>
                      <SourceBadge source={prospect.source} url={prospect.ikman_url} />
                      {isDiscarded && (
                        <span
                          className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide border ${
                            isBrokerSignalReason(prospect.discard_reason)
                              ? "bg-purple-100 dark:bg-purple-950/40 text-purple-800 dark:text-purple-300 border-purple-300 dark:border-purple-800"
                              : "bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800"
                          }`}
                        >
                          {isBrokerSignalReason(prospect.discard_reason) && <Bot className="h-3 w-3" />}
                          {getDiscardReasonLabel(prospect.discard_reason)}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      {isDiscarded && (
                        <button
                          onClick={() => handleUpdateStatus(prospect.id, "new")}
                          disabled={updatingStatusId === prospect.id}
                          className="cursor-pointer inline-flex items-center gap-1 rounded bg-emerald-600 dark:bg-emerald-700 px-2.5 py-1 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
                          title="Restore this prospect to active pipeline"
                        >
                          <Undo2 className="h-3 w-3" />
                          <span>Keep</span>
                        </button>
                      )}
                      <select
                        value={prospect.status}
                        disabled={updatingStatusId === prospect.id}
                        onChange={(e) => handleUpdateStatus(prospect.id, e.target.value)}
                        className={`cursor-pointer rounded border py-1 pl-2 pr-6 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-[#28513f] focus:border-[#28513f] disabled:opacity-50 ${
                          isDiscarded
                            ? "border-amber-300 dark:border-amber-700 bg-white dark:bg-zinc-800 text-amber-800 dark:text-amber-300"
                            : "border-[#dce4df] dark:border-zinc-800 bg-[#f8faf8] dark:bg-zinc-900"
                        }`}
                      >
                        <option value="new">New</option>
                        <option value="contacted">Contacted</option>
                        <option value="converted">Converted</option>
                        <option value="discarded">Discarded...</option>
                        {!["new", "contacted", "converted", "discarded"].includes(prospect.status) && (
                          <option value={prospect.status}>{prospect.status.replace(/_/g, " ")}</option>
                        )}
                      </select>
                    </div>
                  </div>
                
                <div>
                  <div className="flex items-start gap-2">
                    <span className="font-medium text-[#1a2923] dark:text-zinc-200 line-clamp-2 font-medium">{prospect.title}</span>
                    {prospect.ikman_url && (
                      <a href={prospect.ikman_url} target="_blank" rel="noopener noreferrer" className="shrink-0 mt-1 text-blue-600 hover:text-blue-800">
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    )}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1 text-xs text-[#64736b] dark:text-zinc-400">
                    <span>{prospect.property_type}</span>
                    <span>•</span>
                    <span>{prospect.listing_type}</span>
                    <span>•</span>
                    <span>{prospect.location}</span>
                  </div>
                </div>

                <div className="text-sm font-semibold text-[#1a2923] dark:text-zinc-200">
                  {prospect.price || "Price not listed"}
                </div>

                <div className="rounded-lg bg-[#f4f6f4] dark:bg-zinc-900 dark:bg-zinc-900 p-3 text-sm flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[#64736b] dark:text-zinc-400">Contact</span>
                    <span className="font-medium text-[#1a2923] dark:text-zinc-200">{prospect.poster_name || "Unknown"}</span>
                  </div>
                  {prospect.phone_number ? (
                    <div className="font-medium text-[#1a2923] dark:text-zinc-200">{prospect.phone_number}</div>
                  ) : (
                    <div className="flex flex-col gap-2">
                      <span className="text-gray-400 italic text-sm">Phone not fetched</span>
                      {prospect.classification === "owner" && (
                        <button 
                          onClick={() => handleFetchSinglePhone(prospect.id)}
                          disabled={fetchingPhoneId === prospect.id}
                          className="flex w-full items-center justify-center gap-2 rounded bg-white dark:bg-zinc-950 border border-[#cbd8d1] dark:border-zinc-700 px-3 py-2 text-sm font-medium text-[#19352b] dark:text-zinc-200 hover:bg-[#e0e7e3] dark:hover:bg-zinc-800 disabled:opacity-50 cursor-pointer disabled:cursor-default"
                        >
                          {fetchingPhoneId === prospect.id && <RefreshCw className="h-4 w-4 animate-spin" />}
                          {fetchingPhoneId === prospect.id ? "Fetching..." : "Fetch Phone Number"}
                        </button>
                      )}
                    </div>
                  )}
                  {isAdminOrRoot && telegramAgentConfigured && !isTerminal && (
                    <div className="pt-2 border-t border-[#dce4df] dark:border-zinc-800 flex items-center gap-2">
                      {prospect.assignment_status === "pending" ? (
                        <div className="flex-1 flex items-center justify-center gap-1.5 rounded bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 py-1.5 text-xs font-medium text-amber-800 dark:text-amber-300">
                          <Clock className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
                          <span>Assigned (Awaiting Response)</span>
                        </div>
                      ) : prospect.assignment_status === "interested" ? (
                        <div className="flex-1 flex items-center justify-center gap-1.5 rounded bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 py-1.5 text-xs font-medium text-emerald-800 dark:text-emerald-300">
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                          <span>Agent Outcome: Interested</span>
                        </div>
                      ) : prospect.assignment_status === "not_interested" ? (
                        <div className="flex-1 flex items-center justify-center gap-1.5 rounded bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 py-1.5 text-xs font-medium text-red-800 dark:text-red-300">
                          <span>Agent Outcome: Not Interested</span>
                        </div>
                      ) : prospect.assignment_status === "no_answer" ? (
                        <div className="flex-1 flex items-center justify-between gap-2">
                          <span className="text-xs text-zinc-600 dark:text-zinc-400 font-medium">Outcome: No Answer</span>
                          <button
                            type="button"
                            onClick={() => handleSingleAssign(prospect.id)}
                            disabled={isAssigning}
                            className="inline-flex items-center gap-1 rounded bg-white dark:bg-zinc-950 border border-[#cbd8d1] dark:border-zinc-700 px-3 py-1 text-xs font-medium text-[#19352b] dark:text-zinc-200 hover:bg-[#e0e7e3] dark:hover:bg-zinc-800 disabled:opacity-50 cursor-pointer"
                          >
                            <Send className="h-3 w-3" />
                            <span>Re-assign</span>
                          </button>
                        </div>
                      ) : prospect.assignment_status === "callback_later" ? (
                        <div className="flex-1 flex items-center justify-between gap-2">
                          <span className="text-xs text-blue-700 dark:text-blue-300 font-medium">Outcome: Call Back Later</span>
                          <button
                            type="button"
                            onClick={() => handleSingleAssign(prospect.id)}
                            disabled={isAssigning}
                            className="inline-flex items-center gap-1 rounded bg-white dark:bg-zinc-950 border border-[#cbd8d1] dark:border-zinc-700 px-3 py-1 text-xs font-medium text-[#19352b] dark:text-zinc-200 hover:bg-[#e0e7e3] dark:hover:bg-zinc-800 disabled:opacity-50 cursor-pointer"
                          >
                            <Send className="h-3 w-3" />
                            <span>Re-assign</span>
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleSingleAssign(prospect.id)}
                          disabled={isAssigning}
                          className="flex-1 inline-flex items-center justify-center gap-1.5 rounded bg-white dark:bg-zinc-950 border border-[#cbd8d1] dark:border-zinc-700 py-1.5 text-xs font-medium text-[#19352b] dark:text-zinc-200 hover:bg-[#e0e7e3] dark:hover:bg-zinc-800 disabled:opacity-50 cursor-pointer"
                        >
                          <Send className="h-3 w-3" />
                          <span>Dispatch to Agent</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Mobile card quick action buttons */}
                <div className="pt-2 border-t border-[#dce4df] dark:border-zinc-800 flex items-center gap-2">
                  {isDiscarded ? (
                    <button
                      type="button"
                      onClick={() => handleUpdateStatus(prospect.id, "new")}
                      disabled={updatingStatusId === prospect.id}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 dark:bg-emerald-700 py-2 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50 cursor-pointer min-h-[42px]"
                    >
                      <Undo2 className="h-3.5 w-3.5" />
                      <span>Keep / Restore to Active</span>
                    </button>
                  ) : (
                    <>
                      {prospect.status === "new" && (
                        <button
                          type="button"
                          onClick={() => handleUpdateStatus(prospect.id, "contacted")}
                          disabled={updatingStatusId === prospect.id}
                          className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg border border-[#cbd8d1] dark:border-zinc-700 bg-white dark:bg-zinc-900 py-2 text-xs font-semibold text-[#19352b] dark:text-zinc-200 hover:bg-[#e0e7e3] dark:hover:bg-zinc-800 disabled:opacity-50 cursor-pointer min-h-[42px]"
                        >
                          <PhoneCall className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                          <span>Mark Contacted</span>
                        </button>
                      )}

                      {prospect.status === "contacted" && ["root", "admin"].includes(user?.role ?? "") && (
                        <button
                          type="button"
                          onClick={() => handleGenerateDraft(prospect)}
                          disabled={draftLoading === prospect.id}
                          className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#19352b] dark:bg-emerald-700 py-2 text-xs font-semibold text-white hover:bg-[#2a4d40] dark:hover:bg-emerald-600 disabled:opacity-50 cursor-pointer min-h-[42px]"
                        >
                          {draftLoading === prospect.id ? (
                            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <>
                              <Sparkles className="h-3.5 w-3.5" />
                              <span>Convert to Listing</span>
                            </>
                          )}
                        </button>
                      )}

                      {prospect.status === "converted" && (
                        <div className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 py-2 text-xs font-bold text-emerald-800 dark:text-emerald-300 min-h-[42px]">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          <span>Converted to Listing</span>
                        </div>
                      )}

                      {!isTerminal && (
                        <button
                          type="button"
                          onClick={() => setDiscardModalProspect(prospect)}
                          disabled={updatingStatusId === prospect.id}
                          className="inline-flex items-center justify-center gap-1 rounded-lg border border-red-200 dark:border-red-900/60 bg-red-50/50 dark:bg-red-950/20 px-3 py-2 text-xs font-medium text-red-700 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-950/40 disabled:opacity-50 cursor-pointer min-h-[42px]"
                        >
                          <span>Discard...</span>
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

        {/* Desktop Table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full whitespace-nowrap text-left text-sm">
            <thead className="bg-[#f4f6f4] dark:bg-zinc-900 dark:bg-zinc-900 text-xs font-semibold uppercase tracking-wider text-[#718078] dark:text-zinc-400">
              <tr>
                {isAdminOrRoot && telegramAgentConfigured && (
                  <th className="w-10 px-4 py-4">
                    <button
                      type="button"
                      onClick={toggleSelectAllOnPage}
                      className="flex items-center text-[#718078] hover:text-[#19352b] dark:text-zinc-400 dark:hover:text-emerald-400 cursor-pointer"
                      title="Select or deselect all on page"
                    >
                      {prospects.length > 0 && prospects.every((p) => selectedProspectIds.has(p.id)) ? (
                        <CheckSquare className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                      ) : (
                        <Square className="h-4 w-4" />
                      )}
                    </button>
                  </th>
                )}
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4">Title / Location</th>
                <th className="px-6 py-4">Price</th>
                <th className="px-6 py-4">Contact Info</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#dce4df] dark:divide-zinc-800">
              {loading ? (
                <tr>
                  <td colSpan={isAdminOrRoot && telegramAgentConfigured ? 7 : 6} className="px-6 py-8 text-center text-[#64736b] dark:text-zinc-400">Loading prospects...</td>
                </tr>
              ) : prospects.length === 0 ? (
                <tr>
                  <td colSpan={isAdminOrRoot && telegramAgentConfigured ? 7 : 6} className="px-6 py-8 text-center text-[#64736b] dark:text-zinc-400">No prospects found.</td>
                </tr>
              ) : (
                prospects
                  .filter((p) => !filterSource || (p.source || "ikman").toLowerCase() === filterSource.toLowerCase())
                  .map((prospect) => {
                  const isDiscarded = prospect.status === "discarded";
                  const isTerminal = ["discarded", "converted", "unavailable", "agent_no_deal", "agent_co_broke"].includes(prospect.status);
                  const isSelected = selectedProspectIds.has(prospect.id);
                  return (
                    <tr
                      key={prospect.id}
                      className={`transition ${
                        isSelected
                          ? "bg-emerald-50/60 dark:bg-emerald-950/30"
                          : isDiscarded
                          ? "bg-amber-50/25 dark:bg-amber-950/15 hover:bg-amber-50/40 dark:hover:bg-amber-950/25"
                          : isTerminal
                          ? "bg-zinc-50/50 dark:bg-zinc-900/30 opacity-70 hover:opacity-90"
                          : "hover:bg-[#f4f6f4] dark:hover:bg-zinc-800 dark:bg-zinc-900/50"
                      }`}
                    >
                      {isAdminOrRoot && telegramAgentConfigured && (
                        <td className="w-10 px-4 py-4">
                          <button
                            type="button"
                            onClick={() => toggleSelectProspect(prospect.id)}
                            className="flex items-center text-[#64736b] hover:text-[#19352b] dark:text-zinc-400 dark:hover:text-emerald-400 cursor-pointer"
                          >
                            {isSelected ? (
                              <CheckSquare className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                            ) : (
                              <Square className="h-4 w-4" />
                            )}
                          </button>
                        </td>
                      )}
                      <td className="px-6 py-4 text-[#64736b] dark:text-zinc-400">
                        <div>{format(parseISO(prospect.first_seen_at), "MMM d, yyyy")}</div>
                        <div className="mt-1">
                          <SourceBadge source={prospect.source} url={prospect.ikman_url} />
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex max-w-[250px] items-center gap-2">
                          <span className="truncate font-medium text-[#1a2923] dark:text-zinc-200">{prospect.title}</span>
                          {prospect.ikman_url && (
                            <a href={prospect.ikman_url} target="_blank" rel="noopener noreferrer" className="shrink-0 text-blue-600 hover:text-blue-800">
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-[#64736b] dark:text-zinc-400">
                          <span>{prospect.property_type}</span>
                          <span>•</span>
                          <span>{prospect.listing_type}</span>
                          <span>•</span>
                          {prospect.suburb ? (
                            <span
                              className="inline-flex items-center gap-1 font-medium text-[#1a2923] dark:text-zinc-200"
                              title={
                                prospect.suburb_source === "ikman_detail"
                                  ? "Verified location from Ikman ad detail"
                                  : "Inferred from ad title"
                              }
                            >
                              {prospect.suburb_source === "ikman_detail" ? (
                                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                              ) : (
                                <Sparkles className="h-3 w-3 text-amber-500/80 dark:text-amber-400/80 shrink-0" />
                              )}
                              <span>{prospect.suburb}</span>
                              {prospect.location && prospect.location.toLowerCase() !== prospect.suburb.toLowerCase() && (
                                <span className="font-normal text-[#64736b] dark:text-zinc-400">({prospect.location})</span>
                              )}
                            </span>
                          ) : (
                            <span>{prospect.location}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 font-medium text-[#1a2923] dark:text-zinc-200">
                        {prospect.price || "-"}
                      </td>
                      <td className="px-6 py-4">
                        {prospect.phone_number ? (
                          <div className="font-medium text-[#1a2923] dark:text-zinc-200">{prospect.phone_number}</div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="text-gray-400 italic">Not fetched</span>
                            {prospect.classification === "owner" && (
                              <button 
                                onClick={() => handleFetchSinglePhone(prospect.id)}
                                disabled={fetchingPhoneId === prospect.id}
                                className="inline-flex items-center gap-1 rounded bg-[#f4f6f4] dark:bg-zinc-900 px-2 py-1 text-xs font-medium text-[#19352b] dark:text-zinc-200 hover:bg-[#e0e7e3] dark:hover:bg-zinc-800 disabled:opacity-50 cursor-pointer disabled:cursor-default"
                              >
                                {fetchingPhoneId === prospect.id && <RefreshCw className="h-3 w-3 animate-spin" />}
                                {fetchingPhoneId === prospect.id ? "Fetching..." : "Fetch"}
                              </button>
                            )}
                          </div>
                        )}
                        <div className="mt-1 text-xs text-[#64736b] dark:text-zinc-400">{prospect.poster_name || "-"}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <select
                            value={prospect.status}
                            disabled={updatingStatusId === prospect.id}
                            onChange={(e) => handleUpdateStatus(prospect.id, e.target.value)}
                            className={`cursor-pointer rounded border py-1 pl-2 pr-6 text-xs font-medium focus:outline-none focus:ring-1 focus:ring-[#28513f] focus:border-[#28513f] disabled:opacity-50 ${
                              isDiscarded
                                ? "border-amber-300 dark:border-amber-700 bg-white dark:bg-zinc-800 text-amber-800 dark:text-amber-300"
                                : "border-[#dce4df] dark:border-zinc-800 bg-[#f8faf8] dark:bg-zinc-900"
                            }`}
                          >
                            <option value="new">New</option>
                            <option value="contacted">Contacted</option>
                            <option value="converted">Converted</option>
                            <option value="discarded">Discarded...</option>
                            {!["new", "contacted", "converted", "discarded"].includes(prospect.status) && (
                              <option value={prospect.status}>{prospect.status.replace(/_/g, " ")}</option>
                            )}
                          </select>
                          {isDiscarded && (
                            <span
                              className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide border ${
                                isBrokerSignalReason(prospect.discard_reason)
                                  ? "bg-purple-100 dark:bg-purple-950/40 text-purple-800 dark:text-purple-300 border-purple-300 dark:border-purple-800"
                                  : "bg-amber-100 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300 border-amber-300 dark:border-amber-800"
                              }`}
                            >
                              {isBrokerSignalReason(prospect.discard_reason) && <Bot className="h-3 w-3" />}
                              {getDiscardReasonLabel(prospect.discard_reason)}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {isDiscarded ? (
                            <button
                              onClick={() => handleUpdateStatus(prospect.id, "new")}
                              disabled={updatingStatusId === prospect.id}
                              className="cursor-pointer inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 dark:bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700 dark:hover:bg-emerald-600 transition disabled:opacity-50"
                              title="Restore this prospect to active pipeline"
                            >
                              <Undo2 className="h-3.5 w-3.5" />
                              <span>Keep</span>
                            </button>
                          ) : (
                            ["root", "admin"].includes(user?.role ?? "") && !isTerminal && (
                              <div className="flex items-center gap-1.5">
                                {telegramAgentConfigured && (
                                  prospect.assignment_status === "pending" ? (
                                    <span
                                      className="inline-flex items-center gap-1 rounded border border-amber-200 dark:border-amber-800/60 bg-amber-50 dark:bg-amber-950/30 px-2.5 py-1 text-xs font-medium text-amber-800 dark:text-amber-300"
                                      title="Dispatched to agent — awaiting response"
                                    >
                                      <Clock className="h-3 w-3 text-amber-600 dark:text-amber-400" />
                                      <span>Assigned</span>
                                    </span>
                                  ) : prospect.assignment_status === "interested" ? (
                                    <span
                                      className="inline-flex items-center gap-1 rounded border border-emerald-200 dark:border-emerald-800/60 bg-emerald-50 dark:bg-emerald-950/30 px-2.5 py-1 text-xs font-medium text-emerald-800 dark:text-emerald-300"
                                      title="Agent outcome: Interested"
                                    >
                                      <CheckCircle2 className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                                      <span>Interested</span>
                                    </span>
                                  ) : prospect.assignment_status === "not_interested" ? (
                                    <span
                                      className="inline-flex items-center gap-1 rounded border border-red-200 dark:border-red-800/60 bg-red-50 dark:bg-red-950/30 px-2.5 py-1 text-xs font-medium text-red-800 dark:text-red-300"
                                      title="Agent outcome: Not Interested"
                                    >
                                      <span>Not Interested</span>
                                    </span>
                                  ) : prospect.assignment_status === "no_answer" ? (
                                    <div className="flex items-center gap-1">
                                      <span
                                        className="inline-flex items-center gap-1 rounded border border-zinc-200 dark:border-zinc-700 bg-zinc-100 dark:bg-zinc-800 px-2 py-1 text-xs font-medium text-zinc-700 dark:text-zinc-300"
                                        title="Agent outcome: No Answer"
                                      >
                                        <span>No Answer</span>
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => handleSingleAssign(prospect.id)}
                                        disabled={isAssigning}
                                        className="inline-flex items-center gap-1 rounded border border-[#cbd8d1] dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2 py-1 text-xs font-medium text-[#19352b] dark:text-zinc-200 hover:bg-[#e0e7e3] dark:hover:bg-zinc-800 disabled:opacity-50 cursor-pointer"
                                        title="Re-assign to agent"
                                      >
                                        <Send className="h-3 w-3" />
                                        <span>Re-assign</span>
                                      </button>
                                    </div>
                                  ) : prospect.assignment_status === "callback_later" ? (
                                    <div className="flex items-center gap-1">
                                      <span
                                        className="inline-flex items-center gap-1 rounded border border-blue-200 dark:border-blue-800/60 bg-blue-50 dark:bg-blue-950/30 px-2 py-1 text-xs font-medium text-blue-800 dark:text-blue-300"
                                        title="Agent outcome: Call Back Later"
                                      >
                                        <span>Call Later</span>
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => handleSingleAssign(prospect.id)}
                                        disabled={isAssigning}
                                        className="inline-flex items-center gap-1 rounded border border-[#cbd8d1] dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2 py-1 text-xs font-medium text-[#19352b] dark:text-zinc-200 hover:bg-[#e0e7e3] dark:hover:bg-zinc-800 disabled:opacity-50 cursor-pointer"
                                        title="Re-assign to agent"
                                      >
                                        <Send className="h-3 w-3" />
                                        <span>Re-assign</span>
                                      </button>
                                    </div>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => handleSingleAssign(prospect.id)}
                                      disabled={isAssigning}
                                      className="inline-flex items-center gap-1 rounded border border-[#cbd8d1] dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2.5 py-1.5 text-xs font-medium text-[#19352b] dark:text-zinc-200 hover:bg-[#e0e7e3] dark:hover:bg-zinc-800 disabled:opacity-50 cursor-pointer"
                                      title="Dispatch to agent via Telegram"
                                    >
                                      <Send className="h-3 w-3" />
                                      <span>Assign</span>
                                    </button>
                                  )
                                )}
                                <button
                                  onClick={() => handleGenerateDraft(prospect)}
                                  disabled={draftLoading === prospect.id}
                                  className="inline-flex items-center gap-1 rounded bg-[#19352b] dark:bg-emerald-700 px-3 py-1.5 text-xs font-medium text-white dark:text-zinc-200 hover:bg-[#2a4d40] dark:hover:bg-emerald-600 disabled:opacity-50 cursor-pointer disabled:cursor-default"
                                >
                                  {draftLoading === prospect.id ? <RefreshCw className="h-3 w-3 animate-spin" /> : "Convert ⚡"}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setDiscardModalProspect(prospect)}
                                  disabled={updatingStatusId === prospect.id}
                                  className="inline-flex items-center gap-1 rounded border border-red-200 dark:border-red-900/60 bg-red-50/40 dark:bg-red-950/20 px-2.5 py-1.5 text-xs font-medium text-red-700 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-950/40 disabled:opacity-50 cursor-pointer"
                                  title="Discard prospect with a reason"
                                >
                                  <span>Discard...</span>
                                </button>
                              </div>
                            )
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination — hidden in search mode */}
        {!debouncedSearch && totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-[#dce4df] dark:border-zinc-800 px-6 py-4">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="cursor-pointer rounded-lg border border-[#cbd8d1] dark:border-zinc-700 px-3 py-1.5 text-sm font-medium text-[#1a2923] dark:text-zinc-200 hover:bg-[#f4f6f4] dark:hover:bg-zinc-800 dark:bg-zinc-900 disabled:opacity-50 disabled:cursor-default"
            >
              Previous
            </button>
            <span className="text-sm text-[#64736b] dark:text-zinc-400">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="cursor-pointer rounded-lg border border-[#cbd8d1] dark:border-zinc-700 px-3 py-1.5 text-sm font-medium text-[#1a2923] dark:text-zinc-200 hover:bg-[#f4f6f4] dark:hover:bg-zinc-800 dark:bg-zinc-900 disabled:opacity-50 disabled:cursor-default"
            >
              Next
            </button>
          </div>
        )}
        {/* Search mode: show result count instead of pagination */}
        {debouncedSearch && !loading && (
          <div className="flex items-center border-t border-[#dce4df] dark:border-zinc-800 px-6 py-3">
            <span className="text-xs text-[#64736b] dark:text-zinc-400">
              {prospects.length === 0
                ? `No results for "${debouncedSearch}"`
                : `${prospects.length} result${prospects.length !== 1 ? "s" : ""} for "${debouncedSearch}"`
              }
            </span>
          </div>
        )}
      </div>

      {/* Floating Bulk Action Bar */}
      {selectedProspectIds.size > 0 && isAdminOrRoot && telegramAgentConfigured && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-30 flex items-center gap-3 sm:gap-4 rounded-2xl bg-[#19352b] dark:bg-emerald-950 border border-emerald-600/40 text-white px-4 sm:px-6 py-3 shadow-2xl backdrop-blur-md max-w-[92vw]">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-[11px] font-bold text-zinc-950">
              {selectedProspectIds.size}
            </span>
            <span className="text-xs sm:text-sm font-medium">
              selected
            </span>
          </div>
          <div className="h-4 w-px bg-white/20" />
          <button
            type="button"
            onClick={() => setSelectedProspectIds(new Set())}
            className="text-xs text-white/70 hover:text-white transition cursor-pointer"
          >
            Clear
          </button>
          <button
            type="button"
            onClick={handleBulkAssign}
            disabled={isAssigning}
            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-semibold px-3 sm:px-4 py-1.5 text-xs shadow transition disabled:opacity-50 cursor-pointer"
          >
            <Send className="h-3.5 w-3.5" />
            <span>{isAssigning ? "Sending..." : "Dispatch to Agent"}</span>
          </button>
        </div>
      )}

      {/* Scan Launcher Drawer */}
      <ScanLauncherDrawer
        isOpen={isScanModalOpen}
        onClose={() => {
          setIsScanModalOpen(false);
          setSelectedPreset(null);
        }}
        initialPreset={selectedPreset}
        onPresetsChanged={setPresets}
        onScanStarted={(jobId, info) => {
          setActiveJobId(jobId);
          autoFetchPhonesRef.current = !!info?.autoFetchPhones;
          setScanStatus({
            status: "running",
            progress: info?.keyword ? `Starting scan for '${info.keyword}'...` : "Starting scan in background...",
          });
        }}
      />

      {/* Draft Modal */}
      {draftModalData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl rounded-xl bg-white dark:bg-zinc-950 p-6 shadow-2xl">
            <h2 className="mb-4 text-lg font-bold text-[#1a2923] dark:text-zinc-200">Review Property Draft</h2>
            <div className="max-h-[60vh] overflow-y-auto space-y-4 text-sm text-[#1a2923] dark:text-zinc-200">
              <div>
                <label className="block text-xs font-medium text-[#64736b] dark:text-zinc-400">Title</label>
                <input className="w-full rounded border border-[#dce4df] dark:border-zinc-800 bg-white dark:bg-zinc-900 p-2 outline-none focus:border-[#28513f] dark:focus:border-emerald-600" value={draftModalData.title} onChange={(e) => setDraftModalData({...draftModalData, title: e.target.value})} />
              </div>
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-[#64736b] dark:text-zinc-400">Price (Numeric)</label>
                  <input type="number" className="w-full rounded border border-[#dce4df] dark:border-zinc-800 bg-white dark:bg-zinc-900 p-2 outline-none focus:border-[#28513f] dark:focus:border-emerald-600" value={draftModalData.price} onChange={(e) => setDraftModalData({...draftModalData, price: Number(e.target.value)})} />
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-medium text-[#64736b] dark:text-zinc-400">Location</label>
                  <input className="w-full rounded border border-[#dce4df] dark:border-zinc-800 bg-white dark:bg-zinc-900 p-2 outline-none focus:border-[#28513f] dark:focus:border-emerald-600" value={draftModalData.location || ""} onChange={(e) => setDraftModalData({...draftModalData, location: e.target.value})} />
                </div>
              </div>
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-[#64736b] dark:text-zinc-400">Bedrooms</label>
                  <input type="number" className="w-full rounded border border-[#dce4df] dark:border-zinc-800 bg-white dark:bg-zinc-900 p-2 outline-none focus:border-[#28513f] dark:focus:border-emerald-600" value={draftModalData.bedrooms || ""} onChange={(e) => setDraftModalData({...draftModalData, bedrooms: Number(e.target.value)})} />
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-medium text-[#64736b] dark:text-zinc-400">Bathrooms</label>
                  <input type="number" className="w-full rounded border border-[#dce4df] dark:border-zinc-800 bg-white dark:bg-zinc-900 p-2 outline-none focus:border-[#28513f] dark:focus:border-emerald-600" value={draftModalData.bathrooms || ""} onChange={(e) => setDraftModalData({...draftModalData, bathrooms: Number(e.target.value)})} />
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-medium text-[#64736b] dark:text-zinc-400">Property Type</label>
                  <select className="w-full rounded border border-[#dce4df] dark:border-zinc-800 bg-white dark:bg-zinc-900 p-2 outline-none focus:border-[#28513f] dark:focus:border-emerald-600" value={draftModalData.property_type || "house"} onChange={(e) => setDraftModalData({...draftModalData, property_type: e.target.value})}>
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
                  <input className="w-full rounded border border-[#dce4df] dark:border-zinc-800 bg-white dark:bg-zinc-900 p-2 outline-none focus:border-[#28513f] dark:focus:border-emerald-600" value={draftModalData.contact_name || ""} onChange={(e) => setDraftModalData({...draftModalData, contact_name: e.target.value})} />
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-medium text-[#64736b] dark:text-zinc-400">Contact Phone</label>
                  <input className="w-full rounded border border-[#dce4df] dark:border-zinc-800 bg-white dark:bg-zinc-900 p-2 outline-none focus:border-[#28513f] dark:focus:border-emerald-600" value={draftModalData.contact_phone || ""} onChange={(e) => setDraftModalData({...draftModalData, contact_phone: e.target.value})} />
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-medium text-[#64736b] dark:text-zinc-400">Contact Type</label>
                  <select className="w-full rounded border border-[#dce4df] dark:border-zinc-800 bg-white dark:bg-zinc-900 p-2 outline-none focus:border-[#28513f] dark:focus:border-emerald-600" value={draftModalData.contact_type || "owner"} onChange={(e) => setDraftModalData({...draftModalData, contact_type: e.target.value})}>
                    <option value="owner">Owner</option>
                    <option value="broker">Broker</option>
                  </select>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-[#64736b] dark:text-zinc-400">Land Size (Perches)</label>
                  <input type="number" className="w-full rounded border border-[#dce4df] dark:border-zinc-800 bg-white dark:bg-zinc-900 p-2 outline-none focus:border-[#28513f] dark:focus:border-emerald-600" value={draftModalData.land_size_perches || ""} onChange={(e) => setDraftModalData({...draftModalData, land_size_perches: Number(e.target.value)})} />
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-medium text-[#64736b] dark:text-zinc-400">Parking Spaces</label>
                  <input type="number" className="w-full rounded border border-[#dce4df] dark:border-zinc-800 bg-white dark:bg-zinc-900 p-2 outline-none focus:border-[#28513f] dark:focus:border-emerald-600" value={draftModalData.parking_spaces || ""} onChange={(e) => setDraftModalData({...draftModalData, parking_spaces: Number(e.target.value)})} />
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-medium text-[#64736b] dark:text-zinc-400">Build Year</label>
                  <input type="number" className="w-full rounded border border-[#dce4df] dark:border-zinc-800 bg-white dark:bg-zinc-900 p-2 outline-none focus:border-[#28513f] dark:focus:border-emerald-600" value={draftModalData.build_year || ""} onChange={(e) => setDraftModalData({...draftModalData, build_year: Number(e.target.value)})} />
                </div>
              </div>
              <div className="flex gap-6 py-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={draftModalData.has_maids_room || false} onChange={(e) => setDraftModalData({...draftModalData, has_maids_room: e.target.checked})} className="rounded border-[#cbd8d1] dark:border-zinc-700 text-[#19352b] dark:text-zinc-200" />
                  <span className="text-xs font-medium text-[#1a2923] dark:text-zinc-200">Maid's Room</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={draftModalData.has_maids_toilet || false} onChange={(e) => setDraftModalData({...draftModalData, has_maids_toilet: e.target.checked})} className="rounded border-[#cbd8d1] dark:border-zinc-700 text-[#19352b] dark:text-zinc-200" />
                  <span className="text-xs font-medium text-[#1a2923] dark:text-zinc-200">Maid's Toilet</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={draftModalData.is_gated_community || false} onChange={(e) => setDraftModalData({...draftModalData, is_gated_community: e.target.checked})} className="rounded border-[#cbd8d1] dark:border-zinc-700 text-[#19352b] dark:text-zinc-200" />
                  <span className="text-xs font-medium text-[#1a2923] dark:text-zinc-200">Gated Community</span>
                </label>
              </div>
              <div>
                <label className="block text-xs font-medium text-[#64736b] dark:text-zinc-400">Description</label>
                <textarea className="h-32 w-full rounded border border-[#dce4df] dark:border-zinc-800 bg-white dark:bg-zinc-900 p-2 outline-none focus:border-[#28513f] dark:focus:border-emerald-600" value={draftModalData.description} onChange={(e) => setDraftModalData({...draftModalData, description: e.target.value})} />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => { setDraftModalData(null); fetchProspects(); }} disabled={isPublishing} className="cursor-pointer rounded px-4 py-2 text-sm font-medium text-gray-700 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-800 disabled:opacity-50">Cancel</button>
              <button onClick={handlePublishDraft} disabled={isPublishing} className="cursor-pointer rounded bg-[#19352b] dark:bg-emerald-700 px-4 py-2 text-sm font-medium text-white dark:text-zinc-200 hover:bg-[#2a4d40] dark:hover:bg-emerald-600 disabled:cursor-wait disabled:opacity-70">
                {isPublishing ? "Publishing..." : "Approve & Publish"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Discard Reason Modal */}
      <DiscardProspectModal
        isOpen={!!discardModalProspect}
        prospect={discardModalProspect}
        onClose={() => setDiscardModalProspect(null)}
        onConfirm={handleConfirmDiscard}
        loading={isDiscarding}
      />
    </div>
  );
}
