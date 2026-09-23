"use client";

import { useEffect, useState } from "react";
import { format, parseISO, formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { ExternalLink, RefreshCw, Filter, Search, PhoneCall, Clock } from "lucide-react";

import {
  Prospect,
  getProspects,
  updateProspect,
  startProspectScan,
  getScanStatus,
  fetchProspectPhone,
  startBulkPhoneFetch,
  getBulkPhoneFetchStatus,
} from "../../../../lib/api";

const CATEGORIES = [
  { id: "land-for-sale", label: "Land for Sale" },
  { id: "houses-for-sale", label: "Houses for Sale" },
  { id: "apartments-for-sale", label: "Apartments for Sale" },
  { id: "house-rentals", label: "House Rentals" },
  { id: "apartment-rentals", label: "Apartment Rentals" },
  { id: "room-annex-rentals", label: "Room & Annex Rentals" },
];

export default function ProspectsPage() {
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filters & Pagination
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [transactionType, setTransactionType] = useState<"sale" | "rent">("sale");
  const [propertyType, setPropertyType] = useState<string>("all");
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  
  // Scan State
  const [isScanModalOpen, setIsScanModalOpen] = useState(false);
  const [scanCategories, setScanCategories] = useState<string[]>(["land-for-sale", "houses-for-sale", "apartments-for-sale"]);
  const [scanPages, setScanPages] = useState(3);
  
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [scanStatus, setScanStatus] = useState<{ status: string; progress: string; error?: string } | null>(null);

  const [activePhoneJobId, setActivePhoneJobId] = useState<string | null>(null);
  const [phoneJobStatus, setPhoneJobStatus] = useState<{ status: string; progress: string; error?: string } | null>(null);
  const [fetchingPhoneId, setFetchingPhoneId] = useState<string | null>(null);

  const [lastScanAt, setLastScanAt] = useState<string | null>(null);
  const [lastPhoneFetchAt, setLastPhoneFetchAt] = useState<string | null>(null);

  const fetchProspects = async () => {
    setLoading(true);
    
    let property_type = propertyType === "all" ? undefined : propertyType;
    let listing_type = transactionType;

    try {
      const data = await getProspects({
        status: filterStatus || undefined,
        property_type,
        listing_type,
        page,
        page_size: 25
      });
      setProspects(data.items);
      setTotalPages(data.total_pages);
    } catch (err) {
      toast.error("Failed to load prospects");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProspects();
  }, [filterStatus, transactionType, propertyType, page]);

  useEffect(() => {
    // Check for active jobs on mount
    import("../../../../lib/api").then(({ getActiveJobs }) => {
      getActiveJobs().then((active) => {
        if (active.scan) setActiveJobId(active.scan);
        if (active.phone_fetch) setActivePhoneJobId(active.phone_fetch);
        if (active.last_scan_at) setLastScanAt(active.last_scan_at);
        if (active.last_phone_fetch_at) setLastPhoneFetchAt(active.last_phone_fetch_at);
      }).catch(() => {}); // ignore if it fails
    });
  }, []);

  // Polling for scan progress
  useEffect(() => {
    if (!activeJobId) return;
    
    const interval = setInterval(async () => {
      try {
        const status = await getScanStatus(activeJobId);
        setScanStatus(status);
        if (status.status === "completed" || status.status === "failed") {
          setActiveJobId(null);
          fetchProspects();
          if (status.status === "completed") {
            toast.success("Scan completed successfully");
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
        if (status.status === "completed" || status.status === "failed") {
          setActivePhoneJobId(null);
          fetchProspects();
          if (status.status === "completed") {
            toast.success("Bulk phone fetch completed");
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

  const handleStartScan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (scanCategories.length === 0) {
      toast.error("Select at least one category");
      return;
    }
    
    try {
      const res = await startProspectScan({
        categories: scanCategories,
        pages_per_category: scanPages,
      });
      setActiveJobId(res.job_id);
      setIsScanModalOpen(false);
      setScanStatus({ status: "running", progress: "Starting..." });
      toast.info("Scan started in the background");
    } catch (err) {
      toast.error("Failed to start scan");
    }
  };

  const handleUpdateStatus = async (id: string, newStatus: string) => {
    try {
      const updated = await updateProspect(id, newStatus);
      setProspects(prev => prev.map(p => p.id === id ? updated : p));
      toast.success("Status updated");
    } catch (err) {
      toast.error("Failed to update status");
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
          <p className="mt-2 text-sm text-[#64736b]">Scrape property listings from ikman.lk to find new leads.</p>
        </div>
        <div className="flex flex-col items-center sm:items-end gap-1.5 w-full sm:w-auto">
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
            <button
              onClick={handleStartBulkPhoneFetch}
              disabled={activePhoneJobId !== null}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-white border border-[#cbd8d1] px-4 py-2 text-sm font-semibold text-[#19352b] shadow-sm hover:bg-[#f4f6f4] disabled:opacity-50 cursor-pointer disabled:cursor-default w-full sm:w-auto"
            >
              <PhoneCall className="h-4 w-4" />
              {activePhoneJobId ? "Syncing..." : "Sync Phone Numbers"}
            </button>
            <button
              onClick={() => setIsScanModalOpen(true)}
              disabled={activeJobId !== null}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#19352b] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#132820] disabled:opacity-50 cursor-pointer disabled:cursor-default w-full sm:w-auto"
            >
              <Search className="h-4 w-4" />
              {activeJobId ? "Scan Running..." : "New Scan"}
            </button>
          </div>
          {(lastScanAt || lastPhoneFetchAt) && (
            <div className="flex items-center gap-1.5 text-[11px] text-[#64736b] pr-1 mt-1 sm:mt-0">
              <Clock className="h-3 w-3 opacity-70" />
              <span>
                {lastScanAt && <span title={format(parseISO(lastScanAt), "PPP p")}>Scanned {formatDistanceToNow(parseISO(lastScanAt), { addSuffix: true })}</span>}
                {lastScanAt && lastPhoneFetchAt && " • "}
                {lastPhoneFetchAt && <span title={format(parseISO(lastPhoneFetchAt), "PPP p")}>Synced {formatDistanceToNow(parseISO(lastPhoneFetchAt), { addSuffix: true })}</span>}
              </span>
            </div>
          )}
        </div>
      </div>
      
      {activeJobId && scanStatus && (
        <div className="mt-6 rounded-lg border border-blue-200 bg-blue-50 p-4">
          <div className="flex items-center gap-3">
            <RefreshCw className="h-5 w-5 animate-spin text-blue-600" />
            <div>
              <h3 className="text-sm font-medium text-blue-800">Scan in progress</h3>
              <p className="text-sm text-blue-600">{scanStatus.progress}</p>
            </div>
          </div>
        </div>
      )}

      {activePhoneJobId && phoneJobStatus && (
        <div className="mt-6 rounded-lg border border-orange-200 bg-orange-50 p-4">
          <div className="flex items-center gap-3">
            <RefreshCw className="h-5 w-5 animate-spin text-orange-600" />
            <div>
              <h3 className="text-sm font-medium text-orange-800">Bulk Phone Fetch in progress</h3>
              <p className="text-sm text-orange-600">{phoneJobStatus.progress}</p>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="mt-8 flex flex-col sm:flex-row sm:items-center gap-4 border-b border-[#dce4df] pb-4">
        <div className="flex items-center gap-2 text-sm shrink-0">
          <Filter className="h-4 w-4 text-[#718078]" />
          <span className="font-medium text-[#1a2923]">Filters</span>
        </div>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="cursor-pointer rounded-lg border border-[#cbd8d1] px-3 py-1.5 text-sm outline-none focus:border-[#28513f] w-full sm:w-auto"
        >
          <option value="">All Statuses</option>
          <option value="new">New</option>
          <option value="contacted">Contacted</option>
          <option value="ignored">Ignored</option>
          <option value="converted">Converted</option>
        </select>
        {/* Segmented Control for Transaction Type */}
        <div className="flex shrink-0 items-center rounded-lg bg-[#f4f6f4] p-1 w-full sm:w-auto">
          <button
            onClick={() => { setTransactionType("sale"); setPropertyType("all"); setPage(1); }}
            className={`flex-1 sm:flex-none cursor-pointer rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
              transactionType === "sale" 
                ? "bg-white text-[#19352b] shadow-sm" 
                : "text-[#64736b] hover:text-[#1a2923]"
            }`}
          >
            Sales
          </button>
          <button
            onClick={() => { setTransactionType("rent"); setPropertyType("all"); setPage(1); }}
            className={`flex-1 sm:flex-none cursor-pointer rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
              transactionType === "rent" 
                ? "bg-white text-[#19352b] shadow-sm" 
                : "text-[#64736b] hover:text-[#1a2923]"
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
                ? "border-[#19352b] bg-[#19352b] text-white"
                : "border-[#cbd8d1] bg-white text-[#64736b] hover:border-[#1a2923] hover:text-[#1a2923]"
            }`}
          >
            All
          </button>
          <button
            onClick={() => { setPropertyType("house"); setPage(1); }}
            className={`cursor-pointer rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${
              propertyType === "house"
                ? "border-[#19352b] bg-[#19352b] text-white"
                : "border-[#cbd8d1] bg-white text-[#64736b] hover:border-[#1a2923] hover:text-[#1a2923]"
            }`}
          >
            Houses
          </button>
          <button
            onClick={() => { setPropertyType("apartment"); setPage(1); }}
            className={`cursor-pointer rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${
              propertyType === "apartment"
                ? "border-[#19352b] bg-[#19352b] text-white"
                : "border-[#cbd8d1] bg-white text-[#64736b] hover:border-[#1a2923] hover:text-[#1a2923]"
            }`}
          >
            Apartments
          </button>
          {transactionType === "sale" ? (
            <button
              onClick={() => { setPropertyType("land"); setPage(1); }}
              className={`cursor-pointer rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${
                propertyType === "land"
                  ? "border-[#19352b] bg-[#19352b] text-white"
                  : "border-[#cbd8d1] bg-white text-[#64736b] hover:border-[#1a2923] hover:text-[#1a2923]"
              }`}
            >
              Land
            </button>
          ) : (
            <button
              onClick={() => { setPropertyType("property"); setPage(1); }}
              className={`cursor-pointer rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${
                propertyType === "property"
                  ? "border-[#19352b] bg-[#19352b] text-white"
                  : "border-[#cbd8d1] bg-white text-[#64736b] hover:border-[#1a2923] hover:text-[#1a2923]"
              }`}
            >
              Rooms & Annexes
            </button>
          )}
        </div>
      </div>

      <div className="mt-6 overflow-hidden rounded-xl border border-[#dce4df] bg-white shadow-sm">
        
        {/* Mobile Cards */}
        <div className="flex flex-col divide-y divide-[#dce4df] md:hidden">
          {loading ? (
            <div className="p-6 text-center text-[#64736b]">Loading prospects...</div>
          ) : prospects.length === 0 ? (
            <div className="p-6 text-center text-[#64736b]">No prospects found.</div>
          ) : (
            prospects.map((prospect) => (
              <div key={prospect.id} className="p-4 flex flex-col gap-3 hover:bg-[#f4f6f4]/50">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[#64736b]">
                    {format(parseISO(prospect.first_seen_at), "MMM d, yyyy")}
                  </span>
                  <select
                    value={prospect.status}
                    onChange={(e) => handleUpdateStatus(prospect.id, e.target.value)}
                    className={`cursor-pointer rounded-md border-0 py-1 pl-2 pr-6 text-xs font-medium focus:ring-2 focus:ring-[#19352b] ${
                      prospect.status === 'new' ? 'bg-yellow-50 text-yellow-700' :
                      prospect.status === 'contacted' ? 'bg-blue-50 text-blue-700' :
                      prospect.status === 'ignored' ? 'bg-gray-100 text-gray-500' :
                      'bg-green-50 text-green-700'
                    }`}
                  >
                    <option value="new">New</option>
                    <option value="contacted">Contacted</option>
                    <option value="ignored">Ignored</option>
                    <option value="converted">Converted</option>
                  </select>
                </div>
                
                <div>
                  <div className="flex items-start gap-2">
                    <span className="font-medium text-[#1a2923] line-clamp-2">{prospect.title}</span>
                    {prospect.ikman_url && (
                      <a href={prospect.ikman_url} target="_blank" rel="noopener noreferrer" className="shrink-0 mt-1 text-blue-600 hover:text-blue-800">
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    )}
                  </div>
                  <div className="mt-1 flex flex-wrap gap-1 text-xs text-[#64736b]">
                    <span>{prospect.property_type}</span>
                    <span>•</span>
                    <span>{prospect.listing_type}</span>
                    <span>•</span>
                    <span>{prospect.location}</span>
                  </div>
                </div>

                <div className="text-sm font-semibold text-[#1a2923]">
                  {prospect.price || "Price not listed"}
                </div>

                <div className="rounded-lg bg-[#f4f6f4] p-3 text-sm flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[#64736b]">Contact</span>
                    <span className="font-medium text-[#1a2923]">{prospect.poster_name || "Unknown"}</span>
                  </div>
                  {prospect.phone_number ? (
                    <div className="font-medium text-[#1a2923]">{prospect.phone_number}</div>
                  ) : (
                    <div className="flex flex-col gap-2">
                      <span className="text-gray-400 italic text-sm">Phone not fetched</span>
                      {prospect.classification === "owner" && (
                        <button 
                          onClick={() => handleFetchSinglePhone(prospect.id)}
                          disabled={fetchingPhoneId === prospect.id}
                          className="flex w-full items-center justify-center gap-2 rounded bg-white border border-[#cbd8d1] px-3 py-2 text-sm font-medium text-[#19352b] hover:bg-[#e0e7e3] disabled:opacity-50 cursor-pointer disabled:cursor-default"
                        >
                          {fetchingPhoneId === prospect.id && <RefreshCw className="h-4 w-4 animate-spin" />}
                          {fetchingPhoneId === prospect.id ? "Fetching..." : "Fetch Phone Number"}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Desktop Table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full whitespace-nowrap text-left text-sm">
            <thead className="bg-[#f4f6f4] text-xs font-semibold uppercase tracking-wider text-[#718078]">
              <tr>
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4">Title / Location</th>
                <th className="px-6 py-4">Price</th>
                <th className="px-6 py-4">Contact Info</th>
                <th className="px-6 py-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#dce4df]">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-[#64736b]">Loading prospects...</td>
                </tr>
              ) : prospects.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-[#64736b]">No prospects found.</td>
                </tr>
              ) : (
                prospects.map((prospect) => (
                  <tr key={prospect.id} className="hover:bg-[#f4f6f4]/50">
                    <td className="px-6 py-4 text-[#64736b]">
                      {format(parseISO(prospect.first_seen_at), "MMM d, yyyy")}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex max-w-[250px] items-center gap-2">
                        <span className="truncate font-medium text-[#1a2923]">{prospect.title}</span>
                        {prospect.ikman_url && (
                          <a href={prospect.ikman_url} target="_blank" rel="noopener noreferrer" className="shrink-0 text-blue-600 hover:text-blue-800">
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                      <div className="mt-1 text-xs text-[#64736b]">
                        {prospect.property_type} • {prospect.listing_type} • {prospect.location}
                      </div>
                    </td>
                    <td className="px-6 py-4 font-medium text-[#1a2923]">
                      {prospect.price || "-"}
                    </td>
                    <td className="px-6 py-4">
                      {prospect.phone_number ? (
                        <div className="font-medium text-[#1a2923]">{prospect.phone_number}</div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="text-gray-400 italic">Not fetched</span>
                          {prospect.classification === "owner" && (
                            <button 
                              onClick={() => handleFetchSinglePhone(prospect.id)}
                              disabled={fetchingPhoneId === prospect.id}
                              className="inline-flex items-center gap-1 rounded bg-[#f4f6f4] px-2 py-1 text-xs font-medium text-[#19352b] hover:bg-[#e0e7e3] disabled:opacity-50 cursor-pointer disabled:cursor-default"
                            >
                              {fetchingPhoneId === prospect.id && <RefreshCw className="h-3 w-3 animate-spin" />}
                              {fetchingPhoneId === prospect.id ? "Fetching..." : "Fetch"}
                            </button>
                          )}
                        </div>
                      )}
                      <div className="mt-1 text-xs text-[#64736b]">{prospect.poster_name || "-"}</div>
                    </td>
                    <td className="px-6 py-4">
                      <select
                        value={prospect.status}
                        onChange={(e) => handleUpdateStatus(prospect.id, e.target.value)}
                        className={`cursor-pointer rounded-md border-0 py-1 pl-2 pr-6 text-xs font-medium focus:ring-2 focus:ring-[#19352b] ${
                          prospect.status === 'new' ? 'bg-yellow-50 text-yellow-700' :
                          prospect.status === 'contacted' ? 'bg-blue-50 text-blue-700' :
                          prospect.status === 'ignored' ? 'bg-gray-100 text-gray-500' :
                          'bg-green-50 text-green-700'
                        }`}
                      >
                        <option value="new">New</option>
                        <option value="contacted">Contacted</option>
                        <option value="ignored">Ignored</option>
                        <option value="converted">Converted</option>
                      </select>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between border-t border-[#dce4df] px-6 py-4">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="cursor-pointer rounded-lg border border-[#cbd8d1] px-3 py-1.5 text-sm font-medium text-[#1a2923] hover:bg-[#f4f6f4] disabled:opacity-50 disabled:cursor-default"
            >
              Previous
            </button>
            <span className="text-sm text-[#64736b]">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="cursor-pointer rounded-lg border border-[#cbd8d1] px-3 py-1.5 text-sm font-medium text-[#1a2923] hover:bg-[#f4f6f4] disabled:opacity-50 disabled:cursor-default"
            >
              Next
            </button>
          </div>
        )}
      </div>

      {/* Scan Modal */}
      {isScanModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1a2923]/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="text-xl font-semibold text-[#1a2923]">Start New Scan</h2>
            <p className="mt-2 text-sm text-[#64736b]">Configure scan parameters for ikman.lk</p>
            
            <form onSubmit={handleStartScan} className="mt-6 space-y-5">
              <div>
                <label className="block text-sm font-medium text-[#1a2923]">Categories</label>
                <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2 rounded-lg border border-[#dce4df] p-3 bg-[#f4f6f4]/50">
                    <div className="text-xs font-semibold uppercase tracking-wider text-[#718078] mb-3">Sales</div>
                    {CATEGORIES.filter(c => c.id.includes('sale')).map(cat => (
                      <label key={cat.id} className="flex cursor-pointer items-center gap-2">
                        <input 
                          type="checkbox" 
                          checked={scanCategories.includes(cat.id)}
                          onChange={(e) => {
                            if (e.target.checked) setScanCategories([...scanCategories, cat.id]);
                            else setScanCategories(scanCategories.filter(c => c !== cat.id));
                          }}
                          className="cursor-pointer rounded border-[#cbd8d1] text-[#19352b] focus:ring-[#19352b]"
                        />
                        <span className="text-sm text-[#1a2923]">{cat.label.replace(' for Sale', '')}</span>
                      </label>
                    ))}
                  </div>
                  
                  <div className="space-y-2 rounded-lg border border-[#dce4df] p-3 bg-[#f4f6f4]/50">
                    <div className="text-xs font-semibold uppercase tracking-wider text-[#718078] mb-3">Rentals</div>
                    {CATEGORIES.filter(c => c.id.includes('rental')).map(cat => (
                      <label key={cat.id} className="flex cursor-pointer items-center gap-2">
                        <input 
                          type="checkbox" 
                          checked={scanCategories.includes(cat.id)}
                          onChange={(e) => {
                            if (e.target.checked) setScanCategories([...scanCategories, cat.id]);
                            else setScanCategories(scanCategories.filter(c => c !== cat.id));
                          }}
                          className="cursor-pointer rounded border-[#cbd8d1] text-[#19352b] focus:ring-[#19352b]"
                        />
                        <span className="text-sm text-[#1a2923]">{cat.label.replace(' Rentals', '')}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-[#1a2923]">Pages per Category (Max 50)</label>
                <input 
                  type="number" 
                  min="1" 
                  max="50"
                  value={scanPages}
                  onChange={(e) => setScanPages(parseInt(e.target.value) || 1)}
                  className="mt-2 w-full rounded-lg border border-[#cbd8d1] px-3 py-2 text-sm outline-none focus:border-[#28513f]"
                />
              </div>
              
              <div className="mt-8 flex flex-col-reverse sm:flex-row justify-end gap-3 border-t border-[#dce4df] pt-5">
                <button
                  type="button"
                  onClick={() => setIsScanModalOpen(false)}
                  className="cursor-pointer rounded-lg px-4 py-2 text-sm font-medium text-[#718078] hover:bg-[#f4f6f4] hover:text-[#1a2923] w-full sm:w-auto text-center"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="cursor-pointer rounded-lg bg-[#19352b] px-4 py-2 text-sm font-semibold text-white hover:bg-[#132820] w-full sm:w-auto text-center"
                >
                  Start Scan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
