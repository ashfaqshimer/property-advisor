"use client";

import { useEffect, useState } from "react";
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
  CheckCircle2,
  AlertCircle,
  Percent,
  ShieldCheck,
  ArrowUpRight,
} from "lucide-react";

import {
  getSuburbs,
  getMarketValueEstimate,
  seedSuburbs,
  SuburbItem,
  MarketValueEstimate,
  getCurrentUser,
  AuthUser,
} from "@/lib/api";
import { Spinner } from "@/components/ui/spinner";

function formatLKR(amount: number | null | undefined): string {
  if (amount == null) return "—";
  if (amount >= 10_000_000) {
    return `LKR ${(amount / 10_000_000).toFixed(2)} Cr`;
  }
  if (amount >= 1_000_000) {
    return `LKR ${(amount / 1_000_000).toFixed(1)}M`;
  }
  if (amount >= 100_000) {
    return `LKR ${(amount / 100_000).toFixed(1)} Lakhs`;
  }
  return `LKR ${amount.toLocaleString()}`;
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

const TIER_COLORS: Record<string, string> = {
  "Prime Colombo": "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border-amber-200 dark:border-amber-800",
  "Inner Suburbs (Affluent)": "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800",
  "Southern Coastal": "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300 border-sky-200 dark:border-sky-800",
  "High Level / East Corridor": "bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800",
  "Rapid Growth Suburbs": "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 border-purple-200 dark:border-purple-800",
  "Outer Commuter Belt": "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 border-zinc-200 dark:border-zinc-700",
  "Gampaha Metro": "bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-300 border-teal-200 dark:border-teal-800",
  "Coastal Tourism & Hub": "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border-rose-200 dark:border-rose-800",
};

export default function MarketValuesPage() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [suburbs, setSuburbs] = useState<SuburbItem[]>([]);
  const [loadingSuburbs, setLoadingSuburbs] = useState(true);
  const [seeding, setSeeding] = useState(false);

  // Active calculator parameters
  const [selectedSuburb, setSelectedSuburb] = useState<string>("Rajagiriya");
  const [selectedPropertyType, setSelectedPropertyType] = useState<string>("land");
  const [selectedListingType, setSelectedListingType] = useState<string>("sale");
  const [estimate, setEstimate] = useState<MarketValueEstimate | null>(null);
  const [loadingEstimate, setLoadingEstimate] = useState(false);

  // Filter for Suburb Catalog Table
  const [searchFilter, setSearchFilter] = useState("");
  const [selectedTier, setSelectedTier] = useState<string>("all");

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

  useEffect(() => {
    if (selectedSuburb) {
      fetchEstimate(selectedSuburb, selectedPropertyType, selectedListingType);
    }
  }, [selectedSuburb, selectedPropertyType, selectedListingType]);

  async function fetchEstimate(suburb: string, propType: string, listType: string) {
    setLoadingEstimate(true);
    try {
      const res = await getMarketValueEstimate(suburb, propType, listType);
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

  const tiers = Array.from(new Set(suburbs.map((s) => s.tier))).filter(Boolean);

  const filteredSuburbs = suburbs.filter((s) => {
    const matchesSearch =
      s.name.toLowerCase().includes(searchFilter.toLowerCase()) ||
      s.district.toLowerCase().includes(searchFilter.toLowerCase()) ||
      (s.ds_division && s.ds_division.toLowerCase().includes(searchFilter.toLowerCase())) ||
      s.aliases.some((a) => a.toLowerCase().includes(searchFilter.toLowerCase()));
    const matchesTier = selectedTier === "all" || s.tier === selectedTier;
    return matchesSearch && matchesTier;
  });

  return (
    <div className="space-y-8 pb-12">
      {/* Top Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#19352b] text-white dark:bg-emerald-950 dark:text-emerald-400">
              <TrendingUp className="h-4 w-4" />
            </span>
            <h1 className="text-xl font-bold tracking-tight text-[#1a2923] dark:text-zinc-100 sm:text-2xl">
              Market Values & Suburbs Hub
            </h1>
          </div>
          <p className="mt-1 text-xs text-[#64736b] dark:text-zinc-400 sm:text-sm">
            Real-time suburb valuations, Central Bank DS Division benchmarks, and realization discounts.
          </p>
        </div>

        {["root", "admin"].includes(user?.role || "") && (
          <button
            onClick={handleReseed}
            disabled={seeding}
            className="inline-flex items-center gap-2 rounded-lg border border-[#dce4df] bg-white px-3.5 py-2 text-xs font-medium text-[#1a2923] shadow-sm transition hover:bg-[#f4f6f4] disabled:opacity-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            {seeding ? <Spinner className="h-3.5 w-3.5" /> : <RefreshCw className="h-3.5 w-3.5 text-[#19352b] dark:text-emerald-400" />}
            Refresh Benchmarks
          </button>
        )}
      </div>

      {/* Calculator Section */}
      <section className="rounded-xl border border-[#dce4df] bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:p-6">
        <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between border-b border-[#edf2ee] pb-4 dark:border-zinc-800/80">
          <div>
            <h2 className="text-base font-semibold text-[#1a2923] dark:text-zinc-100 sm:text-lg">
              Live Suburb Valuation Simulator
            </h2>
            <p className="text-xs text-[#64736b] dark:text-zinc-400">
              Blends internal catalog listings, scraped prospects, and CBSL macro indicators.
            </p>
          </div>
          {estimate && (
            <div className="flex items-center gap-2">
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
                  estimate.confidence === "high"
                    ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                    : estimate.confidence === "medium"
                    ? "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
                    : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                }`}
              >
                <ShieldCheck className="h-3.5 w-3.5" />
                {estimate.confidence === "high"
                  ? "High Confidence"
                  : estimate.confidence === "medium"
                  ? "Medium Confidence"
                  : "Benchmark Grounded"}
              </span>
              <span className="text-xs text-[#64736b] dark:text-zinc-400">
                ({estimate.sample_size} active listing samples)
              </span>
            </div>
          )}
        </div>

        {/* Controls Grid */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {/* Suburb Selector */}
          <div>
            <label className="block text-xs font-medium text-[#46544d] dark:text-zinc-300">
              Select Suburb / Area
            </label>
            <select
              value={selectedSuburb}
              onChange={(e) => setSelectedSuburb(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-[#dce4df] bg-white px-3 py-2 text-sm text-[#1a2923] shadow-sm focus:border-[#19352b] focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
            >
              {suburbs.map((s) => (
                <option key={s.id} value={s.name}>
                  {s.name} ({s.district})
                </option>
              ))}
            </select>
          </div>

          {/* Property Type Selector */}
          <div>
            <label className="block text-xs font-medium text-[#46544d] dark:text-zinc-300">
              Property Category
            </label>
            <div className="mt-1 flex rounded-lg border border-[#dce4df] p-1 bg-[#f8faf8] dark:border-zinc-700 dark:bg-zinc-800">
              {[
                { label: "Land", val: "land", icon: Layers },
                { label: "House", val: "house", icon: Home },
                { label: "Apartment", val: "apartment", icon: Building },
              ].map(({ label, val, icon: Icon }) => (
                <button
                  key={val}
                  type="button"
                  onClick={() => setSelectedPropertyType(val)}
                  className={`flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-medium transition ${
                    selectedPropertyType === val
                      ? "bg-white text-[#19352b] shadow-sm dark:bg-zinc-700 dark:text-zinc-100"
                      : "text-[#64736b] hover:text-[#1a2923] dark:text-zinc-400 dark:hover:text-zinc-200"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Listing Type (Sale vs Rent) */}
          <div>
            <label className="block text-xs font-medium text-[#46544d] dark:text-zinc-300">
              Intent
            </label>
            <div className="mt-1 flex rounded-lg border border-[#dce4df] p-1 bg-[#f8faf8] dark:border-zinc-700 dark:bg-zinc-800">
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
                      ? "bg-white text-[#19352b] shadow-sm dark:bg-zinc-700 dark:text-zinc-100"
                      : "text-[#64736b] hover:text-[#1a2923] dark:text-zinc-400 dark:hover:text-zinc-200"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Valuation Result Cards */}
        {loadingEstimate ? (
          <div className="flex h-44 items-center justify-center">
            <Spinner className="h-6 w-6 text-[#19352b] dark:text-emerald-400" />
          </div>
        ) : estimate ? (
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {/* Median Asking */}
            <div className="rounded-lg border border-[#edf2ee] bg-[#fbfcfb] p-4 dark:border-zinc-800 dark:bg-zinc-800/40">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#718078] dark:text-zinc-400">
                Median Asking Price
              </span>
              <p className="mt-1 text-xl font-bold text-[#1a2923] dark:text-zinc-100 sm:text-2xl">
                {formatLKR(estimate.stats.median_asking_price_lkr)}
              </p>
              <p className="mt-1 text-[11px] text-[#64736b] dark:text-zinc-400">
                Advertised listing rate
              </p>
            </div>

            {/* Estimated Realized (Discounted) */}
            <div className="rounded-lg border border-emerald-200/80 bg-emerald-50/60 p-4 dark:border-emerald-900/50 dark:bg-emerald-950/20">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                  Est. Realized Deal Price
                </span>
                <span className="rounded bg-emerald-200 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200">
                  -10% Discount
                </span>
              </div>
              <p className="mt-1 text-xl font-bold text-emerald-950 dark:text-emerald-100 sm:text-2xl">
                {formatLKR(estimate.stats.estimated_realized_price_lkr)}
              </p>
              <p className="mt-1 text-[11px] text-emerald-700/80 dark:text-emerald-400/80">
                Realistic closing price buffer
              </p>
            </div>

            {/* Land Price per Perch */}
            <div className="rounded-lg border border-[#edf2ee] bg-[#fbfcfb] p-4 dark:border-zinc-800 dark:bg-zinc-800/40">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#718078] dark:text-zinc-400">
                Land Rate (per Perch)
              </span>
              <p className="mt-1 text-xl font-bold text-[#1a2923] dark:text-zinc-100 sm:text-2xl">
                {estimate.stats.price_per_perch_lkr.asking_median
                  ? formatLKR(estimate.stats.price_per_perch_lkr.asking_median)
                  : formatRange(estimate.stats.price_per_perch_lkr.benchmark_range)}
              </p>
              <p className="mt-1 text-[11px] text-[#64736b] dark:text-zinc-400">
                {estimate.stats.price_per_perch_lkr.asking_median
                  ? `Est. deal: ${formatLKR(estimate.stats.price_per_perch_lkr.realized_estimate)}`
                  : "CBSL Divisional benchmark"}
              </p>
            </div>

            {/* Apartment / Built Rate per sqft */}
            <div className="rounded-lg border border-[#edf2ee] bg-[#fbfcfb] p-4 dark:border-zinc-800 dark:bg-zinc-800/40">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#718078] dark:text-zinc-400">
                Rate (per sq. ft.)
              </span>
              <p className="mt-1 text-xl font-bold text-[#1a2923] dark:text-zinc-100 sm:text-2xl">
                {estimate.stats.price_per_sqft_lkr.asking_median
                  ? formatLKR(estimate.stats.price_per_sqft_lkr.asking_median)
                  : formatRange(estimate.stats.price_per_sqft_lkr.benchmark_range)}
              </p>
              <p className="mt-1 text-[11px] text-[#64736b] dark:text-zinc-400">
                {estimate.stats.price_per_sqft_lkr.benchmark_range
                  ? `Band: ${formatRange(estimate.stats.price_per_sqft_lkr.benchmark_range)}`
                  : "Floor area rate"}
              </p>
            </div>
          </div>
        ) : null}
      </section>

      {/* Suburb Catalog & CBSL Benchmarks Table */}
      <section className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-[#1a2923] dark:text-zinc-100 sm:text-lg">
              Colombo Metro & Suburbs Catalog ({filteredSuburbs.length})
            </h2>
            <p className="text-xs text-[#64736b] dark:text-zinc-400">
              Canonical locations and Central Bank Land Valuation Indicator (LVI) divisional mappings.
            </p>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[200px]">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-[#718078] dark:text-zinc-400" />
              <input
                type="text"
                placeholder="Search suburb or alias..."
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                className="w-full rounded-lg border border-[#dce4df] bg-white py-1.5 pl-8 pr-3 text-xs text-[#1a2923] shadow-sm focus:border-[#19352b] focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
              />
            </div>

            <select
              value={selectedTier}
              onChange={(e) => setSelectedTier(e.target.value)}
              className="rounded-lg border border-[#dce4df] bg-white px-2.5 py-1.5 text-xs text-[#1a2923] shadow-sm focus:border-[#19352b] focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
            >
              <option value="all">All Tiers</option>
              {tiers.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Responsive Table / Cards */}
        <div className="overflow-hidden rounded-xl border border-[#dce4df] bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[#edf2ee] bg-[#fbfcfb] text-[#718078] dark:border-zinc-800 dark:bg-zinc-800/60 dark:text-zinc-400">
                <tr>
                  <th className="px-4 py-3 font-semibold">Suburb / Area</th>
                  <th className="px-4 py-3 font-semibold">DS Division</th>
                  <th className="px-4 py-3 font-semibold">Tier Category</th>
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
                        <span
                          className={`inline-block rounded-md border px-2 py-0.5 text-[10px] font-medium ${
                            TIER_COLORS[sub.tier] || "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                          }`}
                        >
                          {sub.tier}
                        </span>
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
                            window.scrollTo({ top: 0, behavior: "smooth" });
                          }}
                          className="inline-flex items-center gap-1 rounded border border-[#dce4df] bg-white px-2 py-1 text-[11px] font-medium text-[#19352b] shadow-xs transition hover:bg-[#edf2ee] dark:border-zinc-700 dark:bg-zinc-800 dark:text-emerald-400 dark:hover:bg-zinc-700"
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
