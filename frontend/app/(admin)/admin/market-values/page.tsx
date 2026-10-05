"use client";

import { useEffect, useState, useMemo } from "react";
import { toast } from "sonner";
import {
  TrendingUp,
  MapPin,
  Building,
  Home,
  Layers,
  Sparkles,
  RefreshCw,
  Search,
  ExternalLink,
  ShieldCheck,
  ArrowUpRight,
  Database,
  Filter,
  SlidersHorizontal,
  ChevronRight,
  Info,
  Copy,
  Check,
} from "lucide-react";

import {
  getSuburbs,
  getMarketValueEstimate,
  seedSuburbs,
  SuburbItem,
  MarketValueEstimate,
  SourcedListingItem,
  getCurrentUser,
  AuthUser,
} from "@/lib/api";
import { Spinner } from "@/components/ui/spinner";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";

function formatLKR(amount: number | null | undefined): string {
  if (amount == null) return "—";
  if (amount >= 10_000_000) {
    return `LKR ${(amount / 10_000_000).toFixed(2)} Cr`;
  }
  if (amount >= 100_000) {
    return `LKR ${(amount / 100_000).toFixed(1)} Lakhs`;
  }
  return `LKR ${Math.round(amount).toLocaleString()}`;
}

function formatRange(range: [number | null, number | null] | null | undefined): string {
  if (!range || (range[0] == null && range[1] == null)) return "—";
  const [min, max] = range;
  if (min != null && max != null) {
    return `${formatLKR(min)} – ${formatLKR(max)}`;
  }
  if (min != null) return `From ${formatLKR(min)}`;
  if (max != null) return `Up to ${formatLKR(max)}`;
  return "—";
}

export default function MarketValuesPage() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [suburbs, setSuburbs] = useState<SuburbItem[]>([]);
  const [loadingSuburbs, setLoadingSuburbs] = useState(true);
  const [seeding, setSeeding] = useState(false);

  // Active calculator parameters
  const [selectedSuburb, setSelectedSuburb] = useState<string>("Dehiwala");
  const [selectedSubArea, setSelectedSubArea] = useState<string>("all");
  const [selectedPropertyType, setSelectedPropertyType] = useState<string>("land");
  const [selectedListingType, setSelectedListingType] = useState<string>("sale");
  const [estimate, setEstimate] = useState<MarketValueEstimate | null>(null);
  const [loadingEstimate, setLoadingEstimate] = useState(false);

  // Sourced listings drawer
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [copiedAdvice, setCopiedAdvice] = useState(false);

  // Filter for Suburb Catalog Table
  const [searchFilter, setSearchFilter] = useState("");

  useEffect(() => {
    getCurrentUser().then(setUser).catch(() => {});
    loadSuburbs();
  }, []);

  async function loadSuburbs() {
    setLoadingSuburbs(true);
    try {
      const data = await getSuburbs();
      setSuburbs(data);
      if (data.length > 0 && !selectedSuburb) {
        setSelectedSuburb(data[0].name);
      }
    } catch {
      toast.error("Failed to load suburbs catalog.");
    } finally {
      setLoadingSuburbs(false);
    }
  }

  // Reload estimate when parameters change
  useEffect(() => {
    if (selectedSuburb) {
      fetchEstimate(selectedSuburb, selectedSubArea, selectedPropertyType, selectedListingType);
    }
  }, [selectedSuburb, selectedSubArea, selectedPropertyType, selectedListingType]);

  async function fetchEstimate(suburb: string, subArea: string, propType: string, listType: string) {
    setLoadingEstimate(true);
    try {
      const res = await getMarketValueEstimate(
        suburb,
        subArea === "all" ? null : subArea,
        propType,
        listType
      );
      setEstimate(res);
    } catch {
      toast.error(`Failed to estimate market values for ${suburb}.`);
    } finally {
      setLoadingEstimate(false);
    }
  }

  async function handleReseed() {
    setSeeding(true);
    try {
      const res = await seedSuburbs();
      toast.success(`Suburbs catalog refreshed (${res.seeded_count} benchmarks active).`);
      await loadSuburbs();
    } catch {
      toast.error("Failed to re-seed suburbs benchmarks.");
    } finally {
      setSeeding(false);
    }
  }

  const currentSuburbItem = useMemo(
    () => suburbs.find((s) => s.name.toLowerCase() === selectedSuburb.toLowerCase()),
    [suburbs, selectedSuburb]
  );

  // Available sub-areas combining seeded known sub-areas and dynamically detected ones
  const availableSubAreas = useMemo(() => {
    const list = new Set<string>();
    if (currentSuburbItem?.known_sub_areas) {
      currentSuburbItem.known_sub_areas.forEach((a) => list.add(a));
    }
    if (estimate?.sub_areas) {
      estimate.sub_areas.forEach((sa) => list.add(sa.name));
    }
    return Array.from(list);
  }, [currentSuburbItem, estimate]);

  const filteredSuburbs = suburbs.filter((s) => {
    const matchesSearch =
      s.name.toLowerCase().includes(searchFilter.toLowerCase()) ||
      s.district.toLowerCase().includes(searchFilter.toLowerCase()) ||
      (s.ds_division && s.ds_division.toLowerCase().includes(searchFilter.toLowerCase())) ||
      s.aliases.some((a) => a.toLowerCase().includes(searchFilter.toLowerCase()));
    return matchesSearch;
  });

  const maxSubAreaRate = useMemo(() => {
    if (!estimate?.sub_areas || estimate.sub_areas.length === 0) return 1;
    return Math.max(...estimate.sub_areas.map((sa) => sa.median_unit_rate || 0), 1);
  }, [estimate]);

  function copyAdvisoryText() {
    if (!estimate?.advisory_summary) return;
    navigator.clipboard.writeText(estimate.advisory_summary);
    setCopiedAdvice(true);
    toast.success("Amaya market advisory copied to clipboard.");
    setTimeout(() => setCopiedAdvice(false), 2000);
  }

  return (
    <div className="space-y-8 pb-16">
      {/* Top Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#19352b] text-white dark:bg-emerald-950 dark:text-emerald-400">
              <TrendingUp className="h-4 w-4" />
            </span>
            <h1 className="text-xl font-bold tracking-tight text-[#1a2923] dark:text-zinc-100 sm:text-2xl">
              Market Valuation & Sourcing Hub
            </h1>
          </div>
          <p className="mt-1 text-xs text-[#64736b] dark:text-zinc-400 sm:text-sm">
            Granular micro-area valuations, real-time scraped listing sourcing, and pricing grading intelligence.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {["root", "admin"].includes(user?.role || "") && (
            <button
              onClick={handleReseed}
              disabled={seeding}
              className="inline-flex items-center gap-2 rounded-lg border border-[#dce4df] bg-white px-3.5 py-2 text-xs font-medium text-[#1a2923] shadow-xs transition hover:bg-[#f4f6f4] disabled:opacity-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              {seeding ? <Spinner className="h-3.5 w-3.5" /> : <RefreshCw className="h-3.5 w-3.5 text-[#19352b] dark:text-emerald-400" />}
              Refresh Benchmarks
            </button>
          )}
        </div>
      </div>

      {/* Simulator Section */}
      <section className="rounded-xl border border-[#dce4df] bg-white p-4 shadow-xs dark:border-zinc-800 dark:bg-zinc-900 sm:p-6">
        {/* Controls Grid */}
        <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {/* Suburb Selector */}
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#718078] dark:text-zinc-400">
              Primary Suburb
            </label>
            <select
              value={selectedSuburb}
              onChange={(e) => {
                setSelectedSuburb(e.target.value);
                setSelectedSubArea("all");
              }}
              className="mt-1.5 block w-full rounded-lg border border-[#dce4df] bg-white px-3 py-2 text-xs font-medium text-[#1a2923] shadow-xs focus:border-[#19352b] focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 sm:text-sm"
            >
              {suburbs.map((s) => (
                <option key={s.id} value={s.name}>
                  {s.name} ({s.district})
                </option>
              ))}
            </select>
          </div>

          {/* Sub-Area Granular Drill-Down */}
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#718078] dark:text-zinc-400">
              Micro-Area / Road
            </label>
            <select
              value={selectedSubArea}
              onChange={(e) => setSelectedSubArea(e.target.value)}
              className="mt-1.5 block w-full rounded-lg border border-[#dce4df] bg-white px-3 py-2 text-xs font-medium text-[#1a2923] shadow-xs focus:border-[#19352b] focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200 sm:text-sm"
            >
              <option value="all">All {selectedSuburb} Micro-Areas</option>
              {availableSubAreas.map((area) => (
                <option key={area} value={area}>
                  {area}
                </option>
              ))}
            </select>
          </div>

          {/* Property Category */}
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#718078] dark:text-zinc-400">
              Property Category
            </label>
            <div className="mt-1.5 flex rounded-lg border border-[#dce4df] p-1 bg-[#f8faf8] dark:border-zinc-700 dark:bg-zinc-800">
              {[
                { label: "Land", val: "land", icon: Layers },
                { label: "House", val: "house", icon: Home },
                { label: "Apartment", val: "apartment", icon: Building },
              ].map(({ label, val, icon: Icon }) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setSelectedPropertyType(val)}
                  className={`flex flex-1 items-center justify-center gap-1 rounded-md py-1.5 text-xs font-medium transition ${
                    selectedPropertyType === val
                      ? "bg-white text-[#19352b] shadow-xs font-semibold dark:bg-zinc-700 dark:text-zinc-100"
                      : "text-[#64736b] hover:text-[#1a2923] dark:text-zinc-400 dark:hover:text-zinc-200"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Intent (Sale vs Rent) */}
          <div>
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-[#718078] dark:text-zinc-400">
              Listing Intent
            </label>
            <div className="mt-1.5 flex rounded-lg border border-[#dce4df] p-1 bg-[#f8faf8] dark:border-zinc-700 dark:bg-zinc-800">
              {[
                { label: "For Sale", val: "sale" },
                { label: "For Rent", val: "rent" },
              ].map(({ label, val }) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setSelectedListingType(val)}
                  className={`flex flex-1 items-center justify-center rounded-md py-1.5 text-xs font-medium transition ${
                    selectedListingType === val
                      ? "bg-white text-[#19352b] shadow-xs font-semibold dark:bg-zinc-700 dark:text-zinc-100"
                      : "text-[#64736b] hover:text-[#1a2923] dark:text-zinc-400 dark:hover:text-zinc-200"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Data Provenance Header Strip */}
        {estimate && (
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#edf2ee] bg-[#fbfcfb] px-4 py-3 dark:border-zinc-800 dark:bg-zinc-800/40">
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <span className="flex items-center gap-1.5 text-xs font-semibold text-[#1a2923] dark:text-zinc-200">
                <Database className="h-3.5 w-3.5 text-[#19352b] dark:text-emerald-400" />
                <span>{estimate.sample_summary.total_sourced} Properties Sourced</span>
              </span>
              <span className="text-zinc-300 dark:text-zinc-600">•</span>
              <span className="text-xs text-[#64736b] dark:text-zinc-400">
                Lookback: <strong className="font-medium text-[#1a2923] dark:text-zinc-300">{estimate.timeframe}</strong>
              </span>
              <span className="text-zinc-300 dark:text-zinc-600">•</span>
              <div className="flex items-center gap-1.5">
                {Object.entries(estimate.sample_summary.sources).map(([src, count]) => (
                  <span
                    key={src}
                    className="inline-flex items-center rounded-md border border-[#dce4df] bg-white px-2 py-0.5 text-[10px] font-medium text-[#46544d] dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                  >
                    {src}: {count}
                  </span>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsDrawerOpen(true)}
              className="inline-flex items-center gap-1 rounded-md border border-[#19352b]/20 bg-[#19352b]/5 px-2.5 py-1 text-xs font-semibold text-[#19352b] transition hover:bg-[#19352b]/10 dark:border-emerald-400/20 dark:bg-emerald-950/40 dark:text-emerald-400 dark:hover:bg-emerald-950/60"
            >
              Inspect Sourced Listings ({estimate.sourced_listings.length})
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* Loading / Results View */}
        {loadingEstimate ? (
          <div className="flex h-56 items-center justify-center">
            <Spinner className="h-6 w-6 text-[#19352b] dark:text-emerald-400" />
          </div>
        ) : estimate ? (
          <div className="space-y-6">
            {/* PRIMARY METRIC: Unit Rate Graphical Spectrum Card */}
            <div className="rounded-xl border border-[#edf2ee] bg-[#fbfcfb] p-4 dark:border-zinc-800 dark:bg-zinc-800/40 sm:p-5">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-[#718078] dark:text-zinc-400">
                    Primary Valuation Metric
                  </span>
                  <h3 className="text-lg font-bold text-[#1a2923] dark:text-zinc-100 sm:text-xl">
                    {estimate.unit_pricing.unit_label} Spectrum
                  </h3>
                </div>

                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <span className="text-[11px] text-[#718078] dark:text-zinc-400">Asking Median</span>
                    <p className="text-base font-bold text-[#1a2923] dark:text-zinc-100 sm:text-lg">
                      {formatLKR(estimate.unit_pricing.median_asking)}
                    </p>
                  </div>
                  <div className="h-8 w-px bg-[#dce4df] dark:bg-zinc-700" />
                  <div className="text-right">
                    <span className="text-[11px] text-emerald-700 dark:text-emerald-400 font-medium">
                      Realized Target (-10%)
                    </span>
                    <p className="text-base font-bold text-emerald-900 dark:text-emerald-300 sm:text-lg">
                      {formatLKR(estimate.unit_pricing.realized_deal_target)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Graphical Price Spectrum Bar */}
              <div className="mt-6 space-y-2">
                <div className="relative h-7 w-full overflow-hidden rounded-full bg-zinc-100 p-1 dark:bg-zinc-800">
                  {/* Interquartile Band (25% to 75%) */}
                  <div className="absolute inset-y-1 left-[20%] right-[20%] rounded-full bg-gradient-to-r from-emerald-200 via-emerald-300 to-emerald-200 dark:from-emerald-900/60 dark:via-emerald-800/80 dark:to-emerald-900/60" />
                  {/* Median Marker */}
                  <div className="absolute inset-y-0.5 left-1/2 flex -translate-x-1/2 items-center justify-center">
                    <div className="h-6 w-2.5 rounded-full bg-[#19352b] shadow-md ring-2 ring-white dark:bg-emerald-400 dark:ring-zinc-900" />
                  </div>
                </div>

                {/* Range Labels Grid */}
                <div className="grid grid-cols-5 text-center text-[11px]">
                  <div className="text-left">
                    <span className="block text-[#718078] dark:text-zinc-400">Min Entry</span>
                    <strong className="font-semibold text-[#1a2923] dark:text-zinc-200">
                      {formatLKR(estimate.unit_pricing.min)}
                    </strong>
                  </div>
                  <div>
                    <span className="block text-[#718078] dark:text-zinc-400">25% (Entry)</span>
                    <strong className="font-semibold text-[#1a2923] dark:text-zinc-200">
                      {formatLKR(estimate.unit_pricing.p25_entry)}
                    </strong>
                  </div>
                  <div>
                    <span className="block font-medium text-[#19352b] dark:text-emerald-400">Median</span>
                    <strong className="font-bold text-[#19352b] dark:text-emerald-400">
                      {formatLKR(estimate.unit_pricing.median_asking)}
                    </strong>
                  </div>
                  <div>
                    <span className="block text-[#718078] dark:text-zinc-400">75% (Premium)</span>
                    <strong className="font-semibold text-[#1a2923] dark:text-zinc-200">
                      {formatLKR(estimate.unit_pricing.p75_premium)}
                    </strong>
                  </div>
                  <div className="text-right">
                    <span className="block text-[#718078] dark:text-zinc-400">Max Outlier</span>
                    <strong className="font-semibold text-[#1a2923] dark:text-zinc-200">
                      {formatLKR(estimate.unit_pricing.max)}
                    </strong>
                  </div>
                </div>
              </div>

              {/* CBSL Benchmark indicator if available */}
              {estimate.unit_pricing.benchmark_range && (
                <div className="mt-4 flex items-center gap-2 rounded-lg bg-[#edf2ee]/80 px-3 py-2 text-xs text-[#46544d] dark:bg-zinc-800/80 dark:text-zinc-300">
                  <Info className="h-4 w-4 shrink-0 text-[#19352b] dark:text-emerald-400" />
                  <span>
                    Central Bank Divisional Benchmark:{" "}
                    <strong>{formatRange(estimate.unit_pricing.benchmark_range)}</strong> {estimate.unit_pricing.unit_label}
                  </span>
                </div>
              )}
            </div>

            {/* SECONDARY ROW: Micro-Area Comparative Bar Chart & Prospect Grading Engine */}
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              {/* Micro-Area Comparative Horizontal Bar Chart */}
              <div className="rounded-xl border border-[#edf2ee] bg-[#fbfcfb] p-4 dark:border-zinc-800 dark:bg-zinc-800/40 sm:p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-bold text-[#1a2923] dark:text-zinc-100">
                      {selectedSuburb} Micro-Areas Comparison
                    </h4>
                    <p className="text-[11px] text-[#64736b] dark:text-zinc-400">
                      Median {estimate.unit_pricing.unit_label} across detected sub-areas
                    </p>
                  </div>
                  <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-[10px] font-semibold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
                    {estimate.sub_areas.length} Areas
                  </span>
                </div>

                <div className="mt-4 space-y-3">
                  {estimate.sub_areas.length === 0 ? (
                    <p className="py-6 text-center text-xs text-[#718078] dark:text-zinc-400">
                      Insufficient micro-area data for comparative chart.
                    </p>
                  ) : (
                    estimate.sub_areas.map((sa) => {
                      const pct = Math.min(
                        100,
                        Math.max(12, Math.round(((sa.median_unit_rate || 0) / maxSubAreaRate) * 100))
                      );
                      const isSelected = selectedSubArea.toLowerCase() === sa.name.toLowerCase();

                      return (
                        <div
                          key={sa.name}
                          onClick={() => setSelectedSubArea(isSelected ? "all" : sa.name)}
                          className={`cursor-pointer rounded-lg p-2.5 transition hover:bg-white dark:hover:bg-zinc-800 ${
                            isSelected
                              ? "bg-white ring-1 ring-[#19352b] dark:bg-zinc-800 dark:ring-emerald-400"
                              : ""
                          }`}
                        >
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-semibold text-[#1a2923] dark:text-zinc-200">
                              {sa.name}
                              <span className="ml-1.5 text-[10px] font-normal text-[#718078] dark:text-zinc-400">
                                ({sa.sample_count} listings)
                              </span>
                            </span>
                            <span className="font-bold text-[#1a2923] dark:text-zinc-100">
                              {formatLKR(sa.median_unit_rate)}
                            </span>
                          </div>

                          <div className="mt-1.5 flex items-center gap-2">
                            <div className="h-2 flex-1 rounded-full bg-zinc-200 dark:bg-zinc-700">
                              <div
                                className={`h-2 rounded-full transition-all duration-500 ${
                                  isSelected
                                    ? "bg-[#19352b] dark:bg-emerald-400"
                                    : "bg-emerald-500/80 dark:bg-emerald-500/60"
                                }`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className="shrink-0 text-[10px] text-[#718078] dark:text-zinc-400">
                              {formatLKR(sa.min_unit_rate)} – {formatLKR(sa.max_unit_rate)}
                            </span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Prospect Pricing Grading Engine & Total Pricing Card */}
              <div className="space-y-4">
                {/* Grading Thresholds Card */}
                <div className="rounded-xl border border-blue-200/80 bg-blue-50/50 p-4 dark:border-blue-900/40 dark:bg-blue-950/20 sm:p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-blue-900 dark:text-blue-300">
                        Prospect Grading Engine
                      </span>
                      <h4 className="text-sm font-bold text-blue-950 dark:text-blue-100">
                        Deal Grading Bands ({estimate.grading_thresholds.metric})
                      </h4>
                    </div>
                    <span className="rounded bg-blue-200 px-2 py-0.5 text-[10px] font-semibold text-blue-900 dark:bg-blue-900 dark:text-blue-200">
                      Next Step Ready
                    </span>
                  </div>

                  <div className="mt-4 grid grid-cols-3 gap-2">
                    <div className="rounded-lg border border-emerald-300/80 bg-white/80 p-2.5 text-center dark:border-emerald-800/80 dark:bg-zinc-800/80">
                      <span className="block text-[10px] font-bold uppercase text-emerald-800 dark:text-emerald-300">
                        Underpriced Deal
                      </span>
                      <span className="mt-1 block text-xs font-bold text-emerald-950 dark:text-emerald-100">
                        &lt; {formatLKR(estimate.grading_thresholds.underpriced_max)}
                      </span>
                      <span className="mt-0.5 block text-[9px] text-emerald-700 dark:text-emerald-400">
                        &gt;15% below median
                      </span>
                    </div>

                    <div className="rounded-lg border border-blue-300/80 bg-white/80 p-2.5 text-center dark:border-blue-800/80 dark:bg-zinc-800/80">
                      <span className="block text-[10px] font-bold uppercase text-blue-800 dark:text-blue-300">
                        Fair Market
                      </span>
                      <span className="mt-1 block text-xs font-bold text-blue-950 dark:text-blue-100">
                        {formatLKR(estimate.grading_thresholds.fair_value_min)} – {formatLKR(estimate.grading_thresholds.fair_value_max)}
                      </span>
                      <span className="mt-0.5 block text-[9px] text-blue-700 dark:text-blue-400">
                        Within ±15% band
                      </span>
                    </div>

                    <div className="rounded-lg border border-amber-300/80 bg-white/80 p-2.5 text-center dark:border-amber-800/80 dark:bg-zinc-800/80">
                      <span className="block text-[10px] font-bold uppercase text-amber-800 dark:text-amber-300">
                        Overpriced
                      </span>
                      <span className="mt-1 block text-xs font-bold text-amber-950 dark:text-amber-100">
                        &gt; {formatLKR(estimate.grading_thresholds.overpriced_min)}
                      </span>
                      <span className="mt-0.5 block text-[9px] text-amber-700 dark:text-amber-400">
                        High discount needed
                      </span>
                    </div>
                  </div>
                </div>

                {/* Secondary Total Pricing Context */}
                <div className="rounded-xl border border-[#edf2ee] bg-[#fbfcfb] p-4 dark:border-zinc-800 dark:bg-zinc-800/40">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-[#718078] dark:text-zinc-400">
                    Secondary Total Price Context
                  </span>
                  <div className="mt-2 grid grid-cols-2 gap-4">
                    <div>
                      <span className="text-[11px] text-[#718078] dark:text-zinc-400">Median Listing Total</span>
                      <p className="text-base font-bold text-[#1a2923] dark:text-zinc-100">
                        {formatLKR(estimate.total_pricing.median_asking)}
                      </p>
                    </div>
                    <div>
                      <span className="text-[11px] text-emerald-700 dark:text-emerald-400 font-medium">Est. Closing Total</span>
                      <p className="text-base font-bold text-emerald-900 dark:text-emerald-300">
                        {formatLKR(estimate.total_pricing.realized_deal_target)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Amaya AI Advisory Preview Card */}
            <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/40 p-4 dark:border-emerald-900/50 dark:bg-emerald-950/20 sm:p-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[#19352b] text-white dark:bg-emerald-900 dark:text-emerald-300">
                    <Sparkles className="h-3.5 w-3.5" />
                  </span>
                  <h4 className="text-sm font-bold text-emerald-950 dark:text-emerald-100">
                    Amaya Live Market Advisory
                  </h4>
                </div>
                <button
                  type="button"
                  onClick={copyAdvisoryText}
                  className="inline-flex items-center gap-1 rounded border border-emerald-300 bg-white px-2.5 py-1 text-xs font-semibold text-emerald-900 shadow-2xs transition hover:bg-emerald-50 dark:border-emerald-800 dark:bg-zinc-900 dark:text-emerald-200 dark:hover:bg-zinc-800"
                >
                  {copiedAdvice ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  {copiedAdvice ? "Copied" : "Copy Advice"}
                </button>
              </div>

              <p className="mt-3 text-xs leading-relaxed text-emerald-900/90 dark:text-emerald-200/90 sm:text-sm">
                &ldquo;{estimate.advisory_summary}&rdquo;
              </p>
            </div>
          </div>
        ) : null}
      </section>

      {/* Sourced Listings Inspection Drawer */}
      <Sheet open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
        <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="text-lg font-bold text-[#1a2923] dark:text-zinc-100">
              Sourced Listings Explorer ({estimate?.sourced_listings.length || 0})
            </SheetTitle>
            <SheetDescription className="text-xs text-[#64736b] dark:text-zinc-400">
              Transparent drill-down of listings used to calculate current {selectedSuburb} market values.
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-3">
            {estimate?.sourced_listings.map((item) => (
              <div
                key={item.id}
                className="rounded-lg border border-[#edf2ee] bg-white p-3.5 shadow-2xs dark:border-zinc-800 dark:bg-zinc-900"
              >
                <div className="flex items-start justify-between gap-2">
                  <h5 className="text-xs font-bold text-[#1a2923] dark:text-zinc-100 line-clamp-2">
                    {item.title}
                  </h5>
                  {item.source_url && (
                    <a
                      href={item.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#19352b] hover:underline dark:text-emerald-400 shrink-0"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  )}
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[10px]">
                  <span className="rounded bg-zinc-100 px-2 py-0.5 font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 uppercase">
                    {item.source}
                  </span>
                  <span className="rounded bg-emerald-100 px-2 py-0.5 font-medium text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                    {item.sub_area}
                  </span>
                  <span className="rounded bg-zinc-100 px-2 py-0.5 font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 capitalize">
                    {item.property_type}
                  </span>
                  {item.date && (
                    <span className="text-[#718078] dark:text-zinc-500 ml-auto">
                      Seen: {item.date}
                    </span>
                  )}
                </div>

                <div className="mt-3 flex items-center justify-between border-t border-[#edf2ee] pt-2 dark:border-zinc-800/80 text-xs">
                  <div>
                    <span className="text-[10px] text-[#718078] dark:text-zinc-400">Total Price: </span>
                    <strong className="font-semibold text-[#1a2923] dark:text-zinc-200">
                      {formatLKR(item.total_price_lkr)}
                    </strong>
                  </div>
                  {item.unit_rate_lkr && (
                    <div>
                      <span className="text-[10px] text-[#718078] dark:text-zinc-400">{item.unit_label}: </span>
                      <strong className="font-bold text-[#19352b] dark:text-emerald-400">
                        {formatLKR(item.unit_rate_lkr)}
                      </strong>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </SheetContent>
      </Sheet>

      {/* Suburb Catalog & DS Division Benchmarks Table */}
      <section className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-[#1a2923] dark:text-zinc-100 sm:text-lg">
              Colombo Metro & Suburbs Catalog ({filteredSuburbs.length})
            </h2>
            <p className="text-xs text-[#64736b] dark:text-zinc-400">
              Canonical locations and Central Bank Divisional benchmark indicators.
            </p>
          </div>

          <div className="relative min-w-[240px]">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-[#718078] dark:text-zinc-400" />
            <input
              type="text"
              placeholder="Search suburb or road..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="w-full rounded-lg border border-[#dce4df] bg-white py-1.5 pl-8 pr-3 text-xs text-[#1a2923] shadow-xs focus:border-[#19352b] focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
            />
          </div>
        </div>

        {/* Responsive Table */}
        <div className="overflow-hidden rounded-xl border border-[#dce4df] bg-white shadow-xs dark:border-zinc-800 dark:bg-zinc-900">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[#edf2ee] bg-[#fbfcfb] text-[#718078] dark:border-zinc-800 dark:bg-zinc-800/60 dark:text-zinc-400">
                <tr>
                  <th className="px-4 py-3 font-semibold">Suburb / Area</th>
                  <th className="px-4 py-3 font-semibold">DS Division</th>
                  <th className="px-4 py-3 font-semibold">Known Micro-Areas</th>
                  <th className="px-4 py-3 font-semibold">Land (per perch)</th>
                  <th className="px-4 py-3 font-semibold">Apartment (per sqft)</th>
                  <th className="px-4 py-3 text-right font-semibold">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#edf2ee] dark:divide-zinc-800">
                {loadingSuburbs ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-[#718078]">
                      <Spinner className="mx-auto h-5 w-5" />
                    </td>
                  </tr>
                ) : filteredSuburbs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-[#718078] dark:text-zinc-400">
                      No suburbs found matching your filter.
                    </td>
                  </tr>
                ) : (
                  filteredSuburbs.map((sub) => (
                    <tr
                      key={sub.id}
                      className="transition hover:bg-[#f8faf8] dark:hover:bg-zinc-800/40"
                    >
                      <td className="px-4 py-3.5 font-medium text-[#1a2923] dark:text-zinc-100">
                        <div className="flex items-center gap-1.5">
                          <MapPin className="h-3.5 w-3.5 text-[#19352b] dark:text-emerald-400" />
                          <span>{sub.name}</span>
                        </div>
                        {sub.aliases.length > 0 && (
                          <p className="mt-0.5 text-[11px] text-[#718078] dark:text-zinc-500">
                            aka: {sub.aliases.slice(0, 3).join(", ")}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-[#64736b] dark:text-zinc-400">
                        {sub.ds_division || "—"}
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex flex-wrap gap-1 max-w-xs">
                          {(sub.known_sub_areas || []).slice(0, 3).map((area) => (
                            <span
                              key={area}
                              className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                            >
                              {area}
                            </span>
                          ))}
                          {(sub.known_sub_areas || []).length > 3 && (
                            <span className="text-[10px] text-[#718078] dark:text-zinc-500">
                              +{(sub.known_sub_areas || []).length - 3} more
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3.5 font-medium text-[#1a2923] dark:text-zinc-200">
                        {formatRange(sub.baseline_land_perch_range)}
                      </td>
                      <td className="px-4 py-3.5 font-medium text-[#1a2923] dark:text-zinc-200">
                        {formatRange(sub.baseline_apartment_sqft_range)}
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedSuburb(sub.name);
                            setSelectedSubArea("all");
                            window.scrollTo({ top: 0, behavior: "smooth" });
                          }}
                          className="inline-flex items-center gap-1 rounded border border-[#dce4df] bg-white px-2.5 py-1 text-[11px] font-medium text-[#19352b] shadow-2xs transition hover:bg-[#edf2ee] dark:border-zinc-700 dark:bg-zinc-800 dark:text-emerald-400 dark:hover:bg-zinc-700"
                        >
                          Simulate
                          <ArrowUpRight className="h-3 w-3" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </div>
  );
}
