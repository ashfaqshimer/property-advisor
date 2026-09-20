"use client";

import { useEffect, useState } from "react";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";
import { ExternalLink, RefreshCw, Filter, Search } from "lucide-react";

import {
  Prospect,
  getProspects,
  updateProspect,
  startProspectScan,
  getScanStatus,
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
  
  // Filters
  const [filterClass, setFilterClass] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<string>("");
  
  // Scan State
  const [isScanModalOpen, setIsScanModalOpen] = useState(false);
  const [scanCategories, setScanCategories] = useState<string[]>(["land-for-sale", "houses-for-sale", "apartments-for-sale"]);
  const [scanPages, setScanPages] = useState(3);
  const [scanPhoneThreshold, setScanPhoneThreshold] = useState(60);
  
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [scanStatus, setScanStatus] = useState<{ status: string; progress: string; error?: string } | null>(null);

  const fetchProspects = async () => {
    setLoading(true);
    try {
      const data = await getProspects({
        classification: filterClass || undefined,
        status: filterStatus || undefined,
      });
      setProspects(data);
    } catch (err) {
      toast.error("Failed to load prospects");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProspects();
  }, [filterClass, filterStatus]);

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
        phone_fetch_confidence_threshold: scanPhoneThreshold,
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

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Find Prospects</h1>
          <p className="mt-2 text-sm text-[#64736b]">Scrape property listings from ikman.lk to find new leads.</p>
        </div>
        <button
          onClick={() => setIsScanModalOpen(true)}
          disabled={activeJobId !== null}
          className="inline-flex items-center gap-2 rounded-lg bg-[#19352b] px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-[#132820] disabled:opacity-50"
        >
          <Search className="h-4 w-4" />
          {activeJobId ? "Scan Running..." : "New Scan"}
        </button>
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

      {/* Filters */}
      <div className="mt-8 flex items-center gap-4 border-b border-[#dce4df] pb-4">
        <div className="flex items-center gap-2 text-sm">
          <Filter className="h-4 w-4 text-[#718078]" />
          <span className="font-medium text-[#1a2923]">Filters</span>
        </div>
        <select
          value={filterClass}
          onChange={(e) => setFilterClass(e.target.value)}
          className="rounded-lg border border-[#cbd8d1] px-3 py-1.5 text-sm outline-none focus:border-[#28513f]"
        >
          <option value="">All Types</option>
          <option value="owner">Owner (Direct)</option>
          <option value="broker">Broker / Agent</option>
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="rounded-lg border border-[#cbd8d1] px-3 py-1.5 text-sm outline-none focus:border-[#28513f]"
        >
          <option value="">All Statuses</option>
          <option value="new">New</option>
          <option value="contacted">Contacted</option>
          <option value="ignored">Ignored</option>
          <option value="converted">Converted</option>
        </select>
      </div>

      <div className="mt-6 overflow-hidden rounded-xl border border-[#dce4df] bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full whitespace-nowrap text-left text-sm">
            <thead className="bg-[#f4f6f4] text-xs font-semibold uppercase tracking-wider text-[#718078]">
              <tr>
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4">Title / Location</th>
                <th className="px-6 py-4">Price</th>
                <th className="px-6 py-4">Classification</th>
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
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                          prospect.classification === 'owner' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                        }`}>
                          {prospect.classification.toUpperCase()}
                        </span>
                        <span className="text-xs text-[#64736b]">{prospect.confidence}%</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-[#1a2923]">{prospect.phone_number || <span className="text-gray-400 italic">Not fetched</span>}</div>
                      <div className="mt-1 text-xs text-[#64736b]">{prospect.poster_name || "-"}</div>
                    </td>
                    <td className="px-6 py-4">
                      <select
                        value={prospect.status}
                        onChange={(e) => handleUpdateStatus(prospect.id, e.target.value)}
                        className={`rounded-md border-0 py-1 pl-2 pr-6 text-xs font-medium focus:ring-2 focus:ring-[#19352b] ${
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
                <div className="mt-3 space-y-2">
                  {CATEGORIES.map(cat => (
                    <label key={cat.id} className="flex items-center gap-2">
                      <input 
                        type="checkbox" 
                        checked={scanCategories.includes(cat.id)}
                        onChange={(e) => {
                          if (e.target.checked) setScanCategories([...scanCategories, cat.id]);
                          else setScanCategories(scanCategories.filter(c => c !== cat.id));
                        }}
                        className="rounded border-[#cbd8d1] text-[#19352b] focus:ring-[#19352b]"
                      />
                      <span className="text-sm text-[#1a2923]">{cat.label}</span>
                    </label>
                  ))}
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

              <div>
                <label className="block text-sm font-medium text-[#1a2923]">Phone Fetch Threshold (%)</label>
                <p className="mt-1 text-xs text-[#64736b]">Only fetch phone numbers if owner confidence is &ge; this value.</p>
                <input 
                  type="number" 
                  min="0" 
                  max="100"
                  value={scanPhoneThreshold}
                  onChange={(e) => setScanPhoneThreshold(parseInt(e.target.value) || 0)}
                  className="mt-2 w-full rounded-lg border border-[#cbd8d1] px-3 py-2 text-sm outline-none focus:border-[#28513f]"
                />
              </div>
              
              <div className="mt-8 flex justify-end gap-3 border-t border-[#dce4df] pt-5">
                <button
                  type="button"
                  onClick={() => setIsScanModalOpen(false)}
                  className="rounded-lg px-4 py-2 text-sm font-medium text-[#718078] hover:bg-[#f4f6f4] hover:text-[#1a2923]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-[#19352b] px-4 py-2 text-sm font-semibold text-white hover:bg-[#132820]"
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
