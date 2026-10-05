"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { format, parseISO, formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { ExternalLink, RefreshCw, Filter, Search, PhoneCall, Clock, X, CheckCircle2, Sparkles, MapPin, Compass, Undo2, Square, CheckSquare, Send, Bookmark, Bot, Trash2 } from "lucide-react";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";

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
  createFieldAssignments,
  deleteFieldAssignment,
  deleteFieldAssignmentByProspect,
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
  const [filterPriceGrade, setFilterPriceGrade] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("default");
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const autoFetchPhonesRef = useRef(false);


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
        prev.map((p) => {
          const assignment = result.find((a) => a.prospect_id === p.id);
          if (assignment) {
            return {
              ...p,
              assignment_status: "pending",
              phone_number: assignment.prospect_phone_number || p.phone_number,
              poster_name: assignment.prospect_poster_name || p.poster_name,
              classification: assignment.prospect_classification || p.classification,
              confidence: assignment.prospect_confidence ?? p.confidence,
            };
          }
          return p;
        })
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
        const assignment = result[0];
        toast.success("Dispatched to agent on Telegram.");
        setProspects((prev) =>
          prev.map((p) =>
            p.id === prospectId
              ? {
                  ...p,
                  assignment_status: "pending",
                  phone_number: assignment.prospect_phone_number || p.phone_number,
                  poster_name: assignment.prospect_poster_name || p.poster_name,
                  classification: assignment.prospect_classification || p.classification,
                  confidence: assignment.prospect_confidence ?? p.confidence,
                }
              : p
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

  const [removingAssignmentProspectId, setRemovingAssignmentProspectId] = useState<string | null>(null);

  const handleRemoveAssignment = async (prospect: Prospect) => {
    if (!window.confirm(`Remove sent assignment for "${prospect.poster_name || prospect.title}" and delete message from Telegram?`)) {
      return;
    }
    setRemovingAssignmentProspectId(prospect.id);
    try {
      if (prospect.assignment_id) {
        await deleteFieldAssignment(prospect.assignment_id);
      } else {
        await deleteFieldAssignmentByProspect(prospect.id);
      }
      toast.success("Assignment removed.");
      setProspects((prev) =>
        prev.map((p) =>
          p.id === prospect.id
            ? { ...p, assignment_status: null, assignment_id: null }
            : p
        )
      );
    } catch (err: any) {
      toast.error(err.message || "Failed to remove assignment.");
    } finally {
      setRemovingAssignmentProspectId(null);
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
        price_grade: filterPriceGrade === "all" ? undefined : filterPriceGrade,
        sort_by: sortBy === "default" ? undefined : sortBy,
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
  }, [filterStatus, transactionType, propertyType, filterPriceGrade, sortBy, page, debouncedSearch]);

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
    // Check for active jobs on mount for admins
    if (isAdminOrRoot) {
      refreshActiveJobs();
    }
  }, [isAdminOrRoot]);

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
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            {isAdminOrRoot ? "Find Prospects" : "Assigned Prospects"}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {isAdminOrRoot
              ? "Scrape property listings from ikman.lk to find new leads."
              : "Prospects assigned to you for outreach and conversion."}
          </p>
        </div>
        {isAdminOrRoot && (
          <div className="flex flex-col items-center sm:items-end gap-1.5 w-full sm:w-auto">
            <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
              <Button
                variant="outline"
                size="sm"
                onClick={handleStartBulkPhoneFetch}
                disabled={activePhoneJobId !== null}
                className="w-full sm:w-auto gap-2"
              >
                <PhoneCall className="h-4 w-4" />
                {activePhoneJobId ? "Syncing..." : "Sync Phone Numbers"}
              </Button>
              <Button
                asChild
                variant="outline"
                size="sm"
                className="w-full sm:w-auto gap-1.5"
              >
                <Link href="/admin/scans">
                  <Compass className="h-4 w-4 text-primary" />
                  <span>Scanner Hub</span>
                </Link>
              </Button>
              <Button
                size="sm"
                onClick={() => setIsScanModalOpen(true)}
                disabled={activeJobId !== null}
                className="w-full sm:w-auto gap-2"
              >
                <Search className="h-4 w-4" />
                {activeJobId ? "Scan Running..." : "New Scan"}
              </Button>
            </div>
            {(lastScanAt || lastPhoneFetchAt) && (
              <div className="flex items-center gap-2 text-[11px] text-muted-foreground pr-1 mt-1 sm:mt-0 flex-wrap justify-center sm:justify-end">
                <button 
                  onClick={() => setShowExactTime(prev => !prev)}
                  className="flex items-center gap-1.5 cursor-pointer hover:text-foreground transition-colors underline decoration-dotted underline-offset-2 decoration-border"
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
                <span>•</span>
                <Link
                  href="/admin/scans?type=phone_fetch"
                  className="font-semibold text-primary hover:underline inline-flex items-center gap-0.5"
                >
                  <span>Sync Log →</span>
                </Link>
              </div>
            )}
          </div>
        )}
      </div>

      {isAdminOrRoot && activeJobId && scanStatus && (
        <div className="mt-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-lg border border-blue-200 dark:border-blue-900/50 bg-blue-50 dark:bg-blue-900/20 p-4">
          <div className="flex items-center gap-3">
            <RefreshCw className="h-5 w-5 animate-spin text-blue-600 dark:text-blue-400 shrink-0" />
            <div>
              <h3 className="text-sm font-medium text-blue-800 dark:text-blue-300">Scan in progress</h3>
              <p className="text-sm text-blue-600 dark:text-blue-400">{scanStatus.progress}</p>
            </div>
          </div>
          <div className="flex items-center gap-2.5 shrink-0">
            <Button
              variant="destructive"
              size="sm"
              onClick={handleStopScan}
              disabled={isStoppingScan}
              className="h-8 gap-1.5 px-3 text-xs font-semibold"
            >
              <Square className="h-3 w-3 fill-current" />
              <span>{isStoppingScan ? "Stopping..." : "Stop Scan"}</span>
            </Button>
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

      {isAdminOrRoot && activePhoneJobId && phoneJobStatus && (
        <div className="mt-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-lg border border-orange-200 dark:border-orange-900/50 bg-orange-50 dark:bg-orange-900/20 p-4">
          <div className="flex items-center gap-3">
            <RefreshCw className="h-5 w-5 animate-spin text-orange-600 dark:text-orange-400 shrink-0" />
            <div>
              <h3 className="text-sm font-medium text-orange-800 dark:text-orange-300">Bulk Phone Fetch in progress</h3>
              <p className="text-sm text-orange-600 dark:text-orange-400">{phoneJobStatus.progress}</p>
            </div>
          </div>
          <div className="flex items-center gap-2.5 shrink-0">
            <Button
              variant="destructive"
              size="sm"
              onClick={handleStopPhoneJob}
              disabled={isStoppingPhoneJob}
              className="h-8 gap-1.5 px-3 text-xs font-semibold"
            >
              <Square className="h-3 w-3 fill-current" />
              <span>{isStoppingPhoneJob ? "Stopping..." : "Stop Sync"}</span>
            </Button>
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
      <div className="mt-8 flex flex-col gap-4 border-b border-border pb-4">
        {/* Search bar */}
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search by location, title or contact name…"
            className="w-full rounded-lg border border-input bg-background pl-9 pr-9 py-2 text-sm outline-none focus:border-primary placeholder:text-muted-foreground text-foreground"
          />
          {searchQuery && (
            <button
              onClick={clearSearch}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        {/* Filter row */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex items-center gap-2 text-sm shrink-0">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium text-foreground">Filters</span>
        </div>
        <Select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="h-9 w-full sm:w-auto text-sm"
        >
          <option value="">All Statuses</option>
          <option value="new">New</option>
          <option value="contacted">Contacted</option>
          <option value="converted">Converted</option>
          <option value="discarded">Discarded</option>
        </Select>
        <Select
          value={filterSource}
          onChange={(e) => setFilterSource(e.target.value)}
          className="h-9 w-full sm:w-auto text-sm"
        >
          <option value="">All Portals</option>
          <option value="ikman">ikman.lk</option>
          <option value="lpw">LankaPropertyWeb</option>
        </Select>
        <Select
          value={filterPriceGrade}
          onChange={(e) => { setFilterPriceGrade(e.target.value); setPage(1); }}
          className="h-9 w-full sm:w-auto text-sm"
        >
          <option value="all">All Deal Grades</option>
          <option value="underpriced">🔥 Hot Deals (Below Market)</option>
          <option value="fair_market">Fair Market Value</option>
          <option value="overpriced">Overpriced (Negotiable)</option>
          <option value="unrated">Unrated</option>
        </Select>
        <Select
          value={sortBy}
          onChange={(e) => { setSortBy(e.target.value); setPage(1); }}
          className="h-9 w-full sm:w-auto text-sm"
        >
          <option value="default">Newest Seen</option>
          <option value="best_deals">🔥 Best Deals First</option>
        </Select>
        {/* Segmented Control for Transaction Type */}
        <div className="flex shrink-0 items-center rounded-lg bg-muted p-1 w-full sm:w-auto">
          <button
            onClick={() => { setTransactionType("sale"); setPropertyType("all"); setPage(1); }}
            className={`flex-1 sm:flex-none cursor-pointer rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
              transactionType === "sale" 
                ? "bg-card text-foreground shadow-xs" 
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Sales
          </button>
          <button
            onClick={() => { setTransactionType("rent"); setPropertyType("all"); setPage(1); }}
            className={`flex-1 sm:flex-none cursor-pointer rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
              transactionType === "rent" 
                ? "bg-card text-foreground shadow-xs" 
                : "text-muted-foreground hover:text-foreground"
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
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-muted-foreground hover:border-foreground hover:text-foreground"
            }`}
          >
            All
          </button>
          <button
            onClick={() => { setPropertyType("house"); setPage(1); }}
            className={`cursor-pointer rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${
              propertyType === "house"
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-muted-foreground hover:border-foreground hover:text-foreground"
            }`}
          >
            Houses
          </button>
          <button
            onClick={() => { setPropertyType("apartment"); setPage(1); }}
            className={`cursor-pointer rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${
              propertyType === "apartment"
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card text-muted-foreground hover:border-foreground hover:text-foreground"
            }`}
          >
            Apartments
          </button>
          {transactionType === "sale" && (
            <button
              onClick={() => { setPropertyType("land"); setPage(1); }}
              className={`cursor-pointer rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${
                propertyType === "land"
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card text-muted-foreground hover:border-foreground hover:text-foreground"
              }`}
            >
              Land
            </button>
          )}
        </div>
        </div>
      </div>

      <div className="mt-6 overflow-hidden rounded-xl border border-border bg-card shadow-xs">
        
        {/* Mobile Cards */}
        <div className="flex flex-col divide-y divide-border md:hidden">
          {loading ? (
            <div className="p-6 text-center text-muted-foreground">Loading prospects...</div>
          ) : prospects.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground">No prospects found.</div>
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
                      ? "bg-muted/40 opacity-70 hover:opacity-90"
                      : "hover:bg-muted/50"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 flex-wrap">
                      {isAdminOrRoot && telegramAgentConfigured && (
                        <button
                          type="button"
                          onClick={() => toggleSelectProspect(prospect.id)}
                          className="p-1 -ml-1 text-muted-foreground hover:text-foreground cursor-pointer"
                          title={isSelected ? "Deselect" : "Select for agent assignment"}
                        >
                          {isSelected ? (
                            <CheckSquare className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                          ) : (
                            <Square className="h-4 w-4" />
                          )}
                        </button>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {format(parseISO(prospect.first_seen_at), "MMM d, yyyy")}
                      </span>
                      <SourceBadge source={prospect.source} url={prospect.ikman_url} />
                      {isDiscarded && (
                        <Badge
                          variant={isBrokerSignalReason(prospect.discard_reason) ? "secondary" : "warning"}
                          className="gap-1 text-[10px] font-bold uppercase tracking-wide"
                        >
                          {isBrokerSignalReason(prospect.discard_reason) && <Bot className="h-3 w-3" />}
                          {getDiscardReasonLabel(prospect.discard_reason)}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      {isDiscarded && (
                        <Button
                          size="sm"
                          variant="default"
                          onClick={() => handleUpdateStatus(prospect.id, "new")}
                          disabled={updatingStatusId === prospect.id}
                          className="h-7 gap-1 px-2.5 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white"
                          title="Restore this prospect to active pipeline"
                        >
                          <Undo2 className="h-3 w-3" />
                          <span>Keep</span>
                        </Button>
                      )}
                      <Select
                        value={prospect.status}
                        disabled={updatingStatusId === prospect.id}
                        onChange={(e) => handleUpdateStatus(prospect.id, e.target.value)}
                        className={`h-7 w-auto py-0 pl-2 pr-6 text-xs font-medium cursor-pointer ${
                          isDiscarded
                            ? "border-amber-500/50 bg-amber-50/50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
                            : "bg-background"
                        }`}
                      >
                        <option value="new">New</option>
                        <option value="contacted">Contacted</option>
                        <option value="converted">Converted</option>
                        <option value="discarded">Discarded...</option>
                        {!["new", "contacted", "converted", "discarded"].includes(prospect.status) && (
                          <option value={prospect.status}>{prospect.status.replace(/_/g, " ")}</option>
                        )}
                      </Select>
                    </div>
                  </div>
                
                <div>
                  <div className="flex items-start gap-2">
                    <span className="font-medium text-foreground line-clamp-2">{prospect.title}</span>
                    {prospect.ikman_url && (
                      <a href={prospect.ikman_url} target="_blank" rel="noopener noreferrer" className="shrink-0 mt-1 text-blue-600 hover:text-blue-800">
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    )}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1 text-xs text-muted-foreground">
                    <span>{prospect.property_type}</span>
                    <span>•</span>
                    <span>{prospect.listing_type}</span>
                    <span>•</span>
                    <span>{prospect.location}</span>
                  </div>
                </div>

                <div className="flex flex-col gap-1">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-foreground">
                      {prospect.price || "Price not listed"}
                    </span>
                    {prospect.price_grade && prospect.price_grade !== "unrated" && (
                      <span
                        title={
                          prospect.price_unit_rate && prospect.market_median_unit_rate
                            ? `Listing: LKR ${Math.round(prospect.price_unit_rate).toLocaleString()} | Market Median: LKR ${Math.round(prospect.market_median_unit_rate).toLocaleString()}`
                            : undefined
                        }
                        className={`inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-semibold border ${
                          prospect.price_grade === "underpriced"
                            ? "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800"
                            : prospect.price_grade === "overpriced"
                            ? "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800"
                            : "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800"
                        }`}
                      >
                        {prospect.price_grade === "underpriced" && "🔥 "}
                        {prospect.price_grade_label || prospect.price_grade}
                      </span>
                    )}
                  </div>
                  {prospect.price_unit_rate && (
                    <span className="text-[11px] text-muted-foreground">
                      ≈ LKR {Math.round(prospect.price_unit_rate).toLocaleString()} {prospect.price_unit_label || ""}
                    </span>
                  )}
                </div>

                <div className="rounded-lg bg-muted/50 p-3 text-sm flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Contact</span>
                    <span className="font-medium text-foreground">{prospect.poster_name || "Unknown"}</span>
                  </div>
                  {prospect.phone_number ? (
                    <div className="font-medium text-foreground">{prospect.phone_number}</div>
                  ) : (
                    <div className="flex flex-col gap-2">
                      <span className="text-muted-foreground italic text-sm">Phone not fetched</span>
                      {prospect.classification === "owner" && (
                        <Button 
                          variant="outline"
                          size="sm"
                          onClick={() => handleFetchSinglePhone(prospect.id)}
                          disabled={fetchingPhoneId === prospect.id}
                          className="w-full h-8 text-xs gap-2"
                        >
                          {fetchingPhoneId === prospect.id && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
                          {fetchingPhoneId === prospect.id ? "Fetching..." : "Fetch Phone Number"}
                        </Button>
                      )}
                    </div>
                  )}
                  {isAdminOrRoot && telegramAgentConfigured && !isTerminal && (
                    <div className="pt-2 border-t border-border flex items-center gap-2">
                      {prospect.assignment_status === "pending" ? (
                        <div className="flex-1 flex items-center justify-between gap-1.5">
                          <Badge variant="warning" className="gap-1.5 py-1 text-xs font-medium">
                            <Clock className="h-3.5 w-3.5" />
                            <span>Assigned (Awaiting Response)</span>
                          </Badge>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => handleRemoveAssignment(prospect)}
                            disabled={removingAssignmentProspectId === prospect.id}
                            className="h-6 gap-1 px-2 text-[11px]"
                            title="Remove sent assignment from agent"
                          >
                            <Trash2 className="h-3 w-3" />
                            <span>Cancel</span>
                          </Button>
                        </div>
                      ) : prospect.assignment_status === "contacted" || prospect.assignment_status === "interested" ? (
                        <div className="flex-1 flex justify-center">
                          <Badge variant="success" className="w-full justify-center gap-1.5 py-1 text-xs font-medium">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            <span>Agent Outcome: Contacted</span>
                          </Badge>
                        </div>
                      ) : prospect.assignment_status === "not_interested" ? (
                        <div className="flex-1 flex justify-center">
                          <Badge variant="destructive" className="w-full justify-center py-1 text-xs font-medium">
                            <span>Agent Outcome: Not Interested</span>
                          </Badge>
                        </div>
                      ) : prospect.assignment_status === "no_answer" ? (
                        <div className="flex-1 flex items-center justify-between gap-2">
                          <Badge variant="secondary" className="text-xs font-medium">Outcome: No Answer</Badge>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => handleSingleAssign(prospect.id)}
                            disabled={isAssigning}
                            className="h-7 gap-1 px-3 text-xs"
                          >
                            <Send className="h-3 w-3" />
                            <span>Re-assign</span>
                          </Button>
                        </div>
                      ) : prospect.assignment_status === "callback_later" ? (
                        <div className="flex-1 flex items-center justify-between gap-2">
                          <Badge variant="info" className="text-xs font-medium">Outcome: Call Back Later</Badge>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => handleSingleAssign(prospect.id)}
                            disabled={isAssigning}
                            className="h-7 gap-1 px-3 text-xs"
                          >
                            <Send className="h-3 w-3" />
                            <span>Re-assign</span>
                          </Button>
                        </div>
                      ) : (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => handleSingleAssign(prospect.id)}
                          disabled={isAssigning}
                          className="flex-1 h-8 gap-1.5 text-xs"
                        >
                          <Send className="h-3 w-3" />
                          <span>Dispatch to Agent</span>
                        </Button>
                      )}
                    </div>
                  )}
                </div>

                {/* Mobile card quick action buttons */}
                <div className="pt-2 border-t border-border flex items-center gap-2">
                  {isDiscarded ? (
                    <Button
                      type="button"
                      variant="default"
                      onClick={() => handleUpdateStatus(prospect.id, "new")}
                      disabled={updatingStatusId === prospect.id}
                      className="flex-1 min-h-[40px] text-xs font-semibold gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                    >
                      <Undo2 className="h-3.5 w-3.5" />
                      <span>Keep / Restore to Active</span>
                    </Button>
                  ) : (
                    <>
                      {prospect.status === "new" && (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => handleUpdateStatus(prospect.id, "contacted")}
                          disabled={updatingStatusId === prospect.id}
                          className="flex-1 min-h-[40px] text-xs font-semibold gap-1.5"
                        >
                          <PhoneCall className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                          <span>Mark Contacted</span>
                        </Button>
                      )}

                      {prospect.status === "contacted" && (
                        <Button
                          type="button"
                          onClick={() => handleGenerateDraft(prospect)}
                          disabled={draftLoading === prospect.id}
                          className="flex-1 min-h-[40px] text-xs font-semibold gap-1.5"
                        >
                          {draftLoading === prospect.id ? (
                            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <>
                              <Sparkles className="h-3.5 w-3.5" />
                              <span>Convert to Listing</span>
                            </>
                          )}
                        </Button>
                      )}

                      {prospect.status === "converted" && (
                        <div className="flex-1 flex items-center justify-center min-h-[40px]">
                          <Badge variant="success" className="w-full justify-center gap-1.5 py-2 text-xs font-bold">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            <span>Converted to Listing</span>
                          </Badge>
                        </div>
                      )}

                      {!isTerminal && (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setDiscardModalProspect(prospect)}
                          disabled={updatingStatusId === prospect.id}
                          className="min-h-[40px] px-3 text-xs font-medium text-destructive border-destructive/30 hover:bg-destructive/10"
                        >
                          <span>Discard...</span>
                        </Button>
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
        <div className="hidden md:block">
          <Table className="w-full whitespace-nowrap text-left text-sm">
            <TableHeader className="bg-muted/50">
              <TableRow>
                {isAdminOrRoot && telegramAgentConfigured && (
                  <TableHead className="w-10 px-4 py-4">
                    <button
                      type="button"
                      onClick={toggleSelectAllOnPage}
                      className="flex items-center text-muted-foreground hover:text-foreground cursor-pointer"
                      title="Select or deselect all on page"
                    >
                      {prospects.length > 0 && prospects.every((p) => selectedProspectIds.has(p.id)) ? (
                        <CheckSquare className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                      ) : (
                        <Square className="h-4 w-4" />
                      )}
                    </button>
                  </TableHead>
                )}
                <TableHead className="px-6 py-4">Date</TableHead>
                <TableHead className="px-6 py-4">Title / Location</TableHead>
                <TableHead className="px-6 py-4">Price</TableHead>
                <TableHead className="px-6 py-4">Contact Info</TableHead>
                <TableHead className="px-6 py-4">Status</TableHead>
                <TableHead className="px-6 py-4 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-border">
              {loading ? (
                <TableRow>
                  <TableCell colSpan={isAdminOrRoot && telegramAgentConfigured ? 7 : 6} className="px-6 py-8 text-center text-muted-foreground">Loading prospects...</TableCell>
                </TableRow>
              ) : prospects.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={isAdminOrRoot && telegramAgentConfigured ? 7 : 6} className="px-6 py-8 text-center text-muted-foreground">No prospects found.</TableCell>
                </TableRow>
              ) : (
                prospects
                  .filter((p) => !filterSource || (p.source || "ikman").toLowerCase() === filterSource.toLowerCase())
                  .map((prospect) => {
                  const isDiscarded = prospect.status === "discarded";
                  const isTerminal = ["discarded", "converted", "unavailable", "agent_no_deal", "agent_co_broke"].includes(prospect.status);
                  const isSelected = selectedProspectIds.has(prospect.id);
                  return (
                    <TableRow
                      key={prospect.id}
                      className={`transition ${
                        isSelected
                          ? "bg-emerald-50/60 dark:bg-emerald-950/30"
                          : isDiscarded
                          ? "bg-amber-50/25 dark:bg-amber-950/15 hover:bg-amber-50/40 dark:hover:bg-amber-950/25"
                          : isTerminal
                          ? "bg-muted/40 opacity-70 hover:opacity-90"
                          : "hover:bg-muted/50"
                      }`}
                    >
                      {isAdminOrRoot && telegramAgentConfigured && (
                        <TableCell className="w-10 px-4 py-4">
                          <button
                            type="button"
                            onClick={() => toggleSelectProspect(prospect.id)}
                            className="flex items-center text-muted-foreground hover:text-foreground cursor-pointer"
                          >
                            {isSelected ? (
                              <CheckSquare className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                            ) : (
                              <Square className="h-4 w-4" />
                            )}
                          </button>
                        </TableCell>
                      )}
                      <TableCell className="px-6 py-4 text-muted-foreground">
                        <div>{format(parseISO(prospect.first_seen_at), "MMM d, yyyy")}</div>
                        <div className="mt-1">
                          <SourceBadge source={prospect.source} url={prospect.ikman_url} />
                        </div>
                      </TableCell>
                      <TableCell className="px-6 py-4">
                        <div className="flex max-w-[250px] items-center gap-2">
                          <span className="truncate font-medium text-foreground">{prospect.title}</span>
                          {prospect.ikman_url && (
                            <a href={prospect.ikman_url} target="_blank" rel="noopener noreferrer" className="shrink-0 text-blue-600 hover:text-blue-800">
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                          <span>{prospect.property_type}</span>
                          <span>•</span>
                          <span>{prospect.listing_type}</span>
                          <span>•</span>
                          {prospect.suburb ? (
                            <span
                              className="inline-flex items-center gap-1 font-medium text-foreground"
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
                                <span className="font-normal text-muted-foreground">({prospect.location})</span>
                              )}
                            </span>
                          ) : (
                            <span>{prospect.location}</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="px-6 py-4">
                        <div className="flex flex-col gap-1">
                          <span className="font-semibold text-foreground">
                            {prospect.price || "-"}
                          </span>
                          {prospect.price_grade && prospect.price_grade !== "unrated" && (
                            <span
                              title={
                                prospect.price_unit_rate && prospect.market_median_unit_rate
                                  ? `Listing: LKR ${Math.round(prospect.price_unit_rate).toLocaleString()} | Market Median: LKR ${Math.round(prospect.market_median_unit_rate).toLocaleString()}`
                                  : undefined
                              }
                              className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-semibold border w-fit ${
                                prospect.price_grade === "underpriced"
                                  ? "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-300 dark:border-emerald-800"
                                  : prospect.price_grade === "overpriced"
                                  ? "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800"
                                  : "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800"
                              }`}
                            >
                              {prospect.price_grade === "underpriced" && "🔥 "}
                              {prospect.price_grade_label || prospect.price_grade}
                            </span>
                          )}
                          {prospect.price_unit_rate && (
                            <span className="text-[11px] text-muted-foreground">
                              ≈ LKR {Math.round(prospect.price_unit_rate).toLocaleString()} {prospect.price_unit_label || ""}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="px-6 py-4">
                        {prospect.phone_number ? (
                          <div className="font-medium text-foreground">{prospect.phone_number}</div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground italic text-xs">Not fetched</span>
                            {prospect.classification === "owner" && (
                              <Button 
                                variant="outline"
                                size="sm"
                                onClick={() => handleFetchSinglePhone(prospect.id)}
                                disabled={fetchingPhoneId === prospect.id}
                                className="h-6 gap-1 px-2 text-xs"
                              >
                                {fetchingPhoneId === prospect.id && <RefreshCw className="h-3 w-3 animate-spin" />}
                                {fetchingPhoneId === prospect.id ? "Fetching..." : "Fetch"}
                              </Button>
                            )}
                          </div>
                        )}
                        <div className="mt-1 text-xs text-muted-foreground">{prospect.poster_name || "-"}</div>
                      </TableCell>
                      <TableCell className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <Select
                            value={prospect.status}
                            disabled={updatingStatusId === prospect.id}
                            onChange={(e) => handleUpdateStatus(prospect.id, e.target.value)}
                            className={`h-7 w-auto py-0 pl-2 pr-6 text-xs font-medium cursor-pointer ${
                              isDiscarded
                                ? "border-amber-500/50 bg-amber-50/50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
                                : "bg-background"
                            }`}
                          >
                            <option value="new">New</option>
                            <option value="contacted">Contacted</option>
                            <option value="converted">Converted</option>
                            <option value="discarded">Discarded...</option>
                            {!["new", "contacted", "converted", "discarded"].includes(prospect.status) && (
                              <option value={prospect.status}>{prospect.status.replace(/_/g, " ")}</option>
                            )}
                          </Select>
                          {isDiscarded && (
                            <Badge
                              variant={isBrokerSignalReason(prospect.discard_reason) ? "secondary" : "warning"}
                              className="gap-1 text-[10px] font-bold uppercase tracking-wide"
                            >
                              {isBrokerSignalReason(prospect.discard_reason) && <Bot className="h-3 w-3" />}
                              {getDiscardReasonLabel(prospect.discard_reason)}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          {isDiscarded ? (
                            <Button
                              variant="default"
                              size="sm"
                              onClick={() => handleUpdateStatus(prospect.id, "new")}
                              disabled={updatingStatusId === prospect.id}
                              className="h-8 gap-1.5 px-3 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white"
                              title="Restore this prospect to active pipeline"
                            >
                              <Undo2 className="h-3.5 w-3.5" />
                              <span>Keep</span>
                            </Button>
                          ) : !isTerminal ? (
                            <div className="flex items-center gap-1.5">
                              {isAdminOrRoot && telegramAgentConfigured && (
                                prospect.assignment_status === "pending" ? (
                                  <div className="flex items-center gap-1">
                                    <Badge
                                      variant="warning"
                                      className="gap-1 py-1 text-xs font-medium"
                                      title="Dispatched to agent — awaiting response"
                                    >
                                      <Clock className="h-3 w-3" />
                                      <span>Assigned</span>
                                    </Badge>
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleRemoveAssignment(prospect)}
                                      disabled={removingAssignmentProspectId === prospect.id}
                                      className="h-7 gap-1 px-2 text-xs"
                                      title="Remove sent assignment from agent"
                                    >
                                      <Trash2 className="h-3 w-3" />
                                      <span>Cancel</span>
                                    </Button>
                                  </div>
                                ) : prospect.assignment_status === "contacted" || prospect.assignment_status === "interested" ? (
                                  <Badge
                                    variant="success"
                                    className="gap-1 py-1 text-xs font-medium"
                                    title="Agent outcome: Contacted"
                                  >
                                    <CheckCircle2 className="h-3 w-3" />
                                    <span>Contacted</span>
                                  </Badge>
                                ) : prospect.assignment_status === "not_interested" ? (
                                  <Badge
                                    variant="destructive"
                                    className="py-1 text-xs font-medium"
                                    title="Agent outcome: Not Interested"
                                  >
                                    <span>Not Interested</span>
                                  </Badge>
                                ) : prospect.assignment_status === "no_answer" ? (
                                  <div className="flex items-center gap-1">
                                    <Badge
                                      variant="secondary"
                                      className="py-1 text-xs font-medium"
                                      title="Agent outcome: No Answer"
                                    >
                                      <span>No Answer</span>
                                    </Badge>
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleSingleAssign(prospect.id)}
                                      disabled={isAssigning}
                                      className="h-7 gap-1 px-2 text-xs"
                                      title="Re-assign to agent"
                                    >
                                      <Send className="h-3 w-3" />
                                      <span>Re-assign</span>
                                    </Button>
                                  </div>
                                ) : prospect.assignment_status === "callback_later" ? (
                                  <div className="flex items-center gap-1">
                                    <Badge
                                      variant="info"
                                      className="py-1 text-xs font-medium"
                                      title="Agent outcome: Call Back Later"
                                    >
                                      <span>Call Later</span>
                                    </Badge>
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleSingleAssign(prospect.id)}
                                      disabled={isAssigning}
                                      className="h-7 gap-1 px-2 text-xs"
                                      title="Re-assign to agent"
                                    >
                                      <Send className="h-3 w-3" />
                                      <span>Re-assign</span>
                                    </Button>
                                  </div>
                                ) : (
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleSingleAssign(prospect.id)}
                                    disabled={isAssigning}
                                    className="h-7 gap-1 px-2.5 text-xs font-medium"
                                    title="Dispatch to agent via Telegram"
                                  >
                                    <Send className="h-3 w-3" />
                                    <span>Assign</span>
                                  </Button>
                                )
                              )}
                              <Button
                                size="sm"
                                onClick={() => handleGenerateDraft(prospect)}
                                disabled={draftLoading === prospect.id}
                                className="h-7 gap-1 px-3 text-xs font-medium"
                              >
                                {draftLoading === prospect.id ? <RefreshCw className="h-3 w-3 animate-spin" /> : "Convert ⚡"}
                              </Button>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => setDiscardModalProspect(prospect)}
                                disabled={updatingStatusId === prospect.id}
                                className="h-7 gap-1 px-2.5 text-xs font-medium text-destructive border-destructive/30 hover:bg-destructive/10"
                                title="Discard prospect with a reason"
                              >
                                <span>Discard...</span>
                              </Button>
                            </div>
                          ) : null}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
        
        {/* Pagination — hidden in search mode */}
        {!debouncedSearch && totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-border px-6 py-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              Previous
            </Button>
            <span className="text-sm text-muted-foreground">
              Page {page} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
            >
              Next
            </Button>
          </div>
        )}
        {/* Search mode: show result count instead of pagination */}
        {debouncedSearch && !loading && (
          <div className="flex items-center border-t border-border px-6 py-3">
            <span className="text-xs text-muted-foreground">
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
      {isAdminOrRoot && (
        <ScanLauncherDrawer
          isOpen={isScanModalOpen}
          onClose={() => setIsScanModalOpen(false)}
          onScanStarted={(jobId, info) => {
            setActiveJobId(jobId);
            autoFetchPhonesRef.current = !!info?.autoFetchPhones;
            setScanStatus({
              status: "running",
              progress: info?.keyword ? `Starting scan for '${info.keyword}'...` : "Starting scan in background...",
            });
          }}
        />
      )}

      {/* Draft Modal */}
      {draftModalData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl rounded-xl border border-border bg-card p-6 shadow-2xl">
            <h2 className="mb-4 text-lg font-bold text-foreground">Review Property Draft</h2>
            <div className="max-h-[60vh] overflow-y-auto space-y-4 text-sm text-foreground">
              <div>
                <label className="block text-xs font-medium text-muted-foreground">Title</label>
                <input className="w-full rounded-lg border border-input bg-background p-2 outline-none focus:border-primary text-foreground" value={draftModalData.title} onChange={(e) => setDraftModalData({...draftModalData, title: e.target.value})} />
              </div>
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-muted-foreground">Price (Numeric)</label>
                  <input type="number" className="w-full rounded-lg border border-input bg-background p-2 outline-none focus:border-primary text-foreground" value={draftModalData.price} onChange={(e) => setDraftModalData({...draftModalData, price: Number(e.target.value)})} />
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-medium text-muted-foreground">Location</label>
                  <input className="w-full rounded-lg border border-input bg-background p-2 outline-none focus:border-primary text-foreground" value={draftModalData.location || ""} onChange={(e) => setDraftModalData({...draftModalData, location: e.target.value})} />
                </div>
              </div>
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-muted-foreground">Bedrooms</label>
                  <input type="number" className="w-full rounded-lg border border-input bg-background p-2 outline-none focus:border-primary text-foreground" value={draftModalData.bedrooms || ""} onChange={(e) => setDraftModalData({...draftModalData, bedrooms: Number(e.target.value)})} />
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-medium text-muted-foreground">Bathrooms</label>
                  <input type="number" className="w-full rounded-lg border border-input bg-background p-2 outline-none focus:border-primary text-foreground" value={draftModalData.bathrooms || ""} onChange={(e) => setDraftModalData({...draftModalData, bathrooms: Number(e.target.value)})} />
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-medium text-muted-foreground">Property Type</label>
                  <Select className="w-full" value={draftModalData.property_type || "house"} onChange={(e) => setDraftModalData({...draftModalData, property_type: e.target.value})}>
                    <option value="house">House</option>
                    <option value="apartment">Apartment</option>
                    <option value="land">Land</option>
                    <option value="commercial">Commercial</option>
                    <option value="mixed_use">Mixed Use</option>
                  </Select>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-muted-foreground">Contact Name</label>
                  <input className="w-full rounded-lg border border-input bg-background p-2 outline-none focus:border-primary text-foreground" value={draftModalData.contact_name || ""} onChange={(e) => setDraftModalData({...draftModalData, contact_name: e.target.value})} />
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-medium text-muted-foreground">Contact Phone</label>
                  <input className="w-full rounded-lg border border-input bg-background p-2 outline-none focus:border-primary text-foreground" value={draftModalData.contact_phone || ""} onChange={(e) => setDraftModalData({...draftModalData, contact_phone: e.target.value})} />
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-medium text-muted-foreground">Contact Type</label>
                  <Select className="w-full" value={draftModalData.contact_type || "owner"} onChange={(e) => setDraftModalData({...draftModalData, contact_type: e.target.value})}>
                    <option value="owner">Owner</option>
                    <option value="broker">Broker</option>
                  </Select>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-muted-foreground">Land Size (Perches)</label>
                  <input type="number" className="w-full rounded-lg border border-input bg-background p-2 outline-none focus:border-primary text-foreground" value={draftModalData.land_size_perches || ""} onChange={(e) => setDraftModalData({...draftModalData, land_size_perches: Number(e.target.value)})} />
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-medium text-muted-foreground">Parking Spaces</label>
                  <input type="number" className="w-full rounded-lg border border-input bg-background p-2 outline-none focus:border-primary text-foreground" value={draftModalData.parking_spaces || ""} onChange={(e) => setDraftModalData({...draftModalData, parking_spaces: Number(e.target.value)})} />
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-medium text-muted-foreground">Build Year</label>
                  <input type="number" className="w-full rounded-lg border border-input bg-background p-2 outline-none focus:border-primary text-foreground" value={draftModalData.build_year || ""} onChange={(e) => setDraftModalData({...draftModalData, build_year: Number(e.target.value)})} />
                </div>
              </div>
              <div className="flex gap-6 py-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={draftModalData.has_maids_room || false} onChange={(e) => setDraftModalData({...draftModalData, has_maids_room: e.target.checked})} className="rounded border-border text-primary" />
                  <span className="text-xs font-medium text-foreground">Maid's Room</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={draftModalData.has_maids_toilet || false} onChange={(e) => setDraftModalData({...draftModalData, has_maids_toilet: e.target.checked})} className="rounded border-border text-primary" />
                  <span className="text-xs font-medium text-foreground">Maid's Toilet</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={draftModalData.is_gated_community || false} onChange={(e) => setDraftModalData({...draftModalData, is_gated_community: e.target.checked})} className="rounded border-border text-primary" />
                  <span className="text-xs font-medium text-foreground">Gated Community</span>
                </label>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground">Description</label>
                <textarea className="h-32 w-full rounded-lg border border-input bg-background p-2 outline-none focus:border-primary text-foreground" value={draftModalData.description} onChange={(e) => setDraftModalData({...draftModalData, description: e.target.value})} />
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <Button variant="outline" onClick={() => { setDraftModalData(null); fetchProspects(); }} disabled={isPublishing}>Cancel</Button>
              <Button onClick={handlePublishDraft} disabled={isPublishing}>
                {isPublishing ? "Publishing..." : "Approve & Publish"}
              </Button>
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
