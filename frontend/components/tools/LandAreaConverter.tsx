"use client";

import { useState } from "react";
import Link from "next/link";
import { openChat } from "@/lib/chat-dialog";

export const SQFT_PER_PERCH = 272.25;
export const SQM_PER_PERCH = 25.2928526;
export const PERCHES_PER_ACRE = 160;
export const PERCHES_PER_ROOD = 40;

export default function LandAreaConverter() {
  const [perches, setPerches] = useState<string>("10");
  const [pricePerPerch, setPricePerPerch] = useState<string>("2500000");

  const perchNum = parseFloat(perches) || 0;
  const priceNum = parseFloat(pricePerPerch) || 0;

  const sqft = perchNum * SQFT_PER_PERCH;
  const sqm = perchNum * SQM_PER_PERCH;
  const acres = perchNum / PERCHES_PER_ACRE;
  const roods = perchNum / PERCHES_PER_ROOD;

  const totalPrice = perchNum * priceNum;
  const pricePerSqFt = sqft > 0 ? priceNum / SQFT_PER_PERCH : 0;

  const handlePerchPreset = (val: number) => {
    setPerches(val.toString());
  };

  return (
    <div className="space-y-8">
      {/* Main Converter Card */}
      <div className="rounded-3xl border border-neutral-200/80 bg-white p-6 sm:p-10 shadow-xs space-y-6">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-ink">
            Land Area Measurement Converter
          </h2>
          <p className="mt-1 text-sm text-neutral-600">
            Enter land size in perches or click a common preset to view conversions across all units.
          </p>
        </div>

        {/* Input & Presets */}
        <div className="space-y-3">
          <label htmlFor="perch-input" className="block text-sm font-semibold text-neutral-800">
            Land Size (Perches)
          </label>
          <div className="relative max-w-md">
            <input
              id="perch-input"
              type="number"
              min="0"
              step="0.01"
              value={perches}
              onChange={(e) => setPerches(e.target.value)}
              className="w-full rounded-xl border border-neutral-300 bg-neutral-50/50 px-4 py-3 text-lg font-bold text-ink focus:border-brand focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand/20 transition-all"
              placeholder="e.g. 10"
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-neutral-400 uppercase">
              Perches
            </span>
          </div>

          {/* Quick presets */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="text-xs text-neutral-500 font-medium">Quick presets:</span>
            {[6, 8, 10, 15, 20, 40, 80, 160].map((val) => (
              <button
                key={val}
                type="button"
                onClick={() => handlePerchPreset(val)}
                className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-all cursor-pointer ${
                  perchNum === val
                    ? "bg-brand text-white shadow-2xs font-semibold"
                    : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
                }`}
              >
                {val}P
              </button>
            ))}
          </div>
        </div>

        {/* Live Conversion Results Grid */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 pt-4 border-t border-neutral-100">
          <div className="rounded-2xl border border-neutral-200/80 bg-neutral-50/50 p-4 sm:p-5">
            <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
              Square Feet (Sq Ft)
            </span>
            <p className="mt-1 text-xl sm:text-2xl font-bold text-ink">
              {sqft.toLocaleString("en-US", { maximumFractionDigits: 1 })}
            </p>
            <p className="mt-0.5 text-[11px] text-neutral-400">1 Perch = 272.25 sq ft</p>
          </div>

          <div className="rounded-2xl border border-neutral-200/80 bg-neutral-50/50 p-4 sm:p-5">
            <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
              Acres
            </span>
            <p className="mt-1 text-xl sm:text-2xl font-bold text-ink">
              {acres.toLocaleString("en-US", { maximumFractionDigits: 4 })}
            </p>
            <p className="mt-0.5 text-[11px] text-neutral-400">160 Perches = 1 Acre</p>
          </div>

          <div className="rounded-2xl border border-neutral-200/80 bg-neutral-50/50 p-4 sm:p-5">
            <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
              Roods
            </span>
            <p className="mt-1 text-xl sm:text-2xl font-bold text-ink">
              {roods.toLocaleString("en-US", { maximumFractionDigits: 3 })}
            </p>
            <p className="mt-0.5 text-[11px] text-neutral-400">40 Perches = 1 Rood</p>
          </div>

          <div className="rounded-2xl border border-neutral-200/80 bg-neutral-50/50 p-4 sm:p-5">
            <span className="text-xs font-semibold uppercase tracking-wider text-neutral-500">
              Square Meters (m²)
            </span>
            <p className="mt-1 text-xl sm:text-2xl font-bold text-ink">
              {sqm.toLocaleString("en-US", { maximumFractionDigits: 1 })}
            </p>
            <p className="mt-0.5 text-[11px] text-neutral-400">1 Perch ≈ 25.29 m²</p>
          </div>
        </div>
      </div>

      {/* Price Calculator Card */}
      <div className="rounded-3xl border border-neutral-200/80 bg-white p-6 sm:p-10 shadow-xs space-y-6">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-ink">
            Land Value &amp; Price Rate Calculator
          </h2>
          <p className="mt-1 text-sm text-neutral-600">
            Calculate total investment cost and effective price per square foot based on per-perch pricing.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div>
            <label htmlFor="price-input" className="block text-sm font-semibold text-neutral-800">
              Price per Perch (LKR)
            </label>
            <div className="relative mt-2">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-neutral-500">
                LKR
              </span>
              <input
                id="price-input"
                type="number"
                min="0"
                step="50000"
                value={pricePerPerch}
                onChange={(e) => setPricePerPerch(e.target.value)}
                className="w-full rounded-xl border border-neutral-300 bg-neutral-50/50 py-3 pl-14 pr-4 text-base font-bold text-ink focus:border-brand focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand/20 transition-all"
                placeholder="2,500,000"
              />
            </div>
            {priceNum > 0 && (
              <p className="mt-1.5 text-xs text-neutral-500">
                ≈ {(priceNum / 100000).toLocaleString()} Laksha (LKR {(priceNum / 1000000).toFixed(2)}M) per perch
              </p>
            )}
          </div>

          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-5 space-y-3 dark:bg-zinc-900/60 dark:border-zinc-800">
            <span className="text-xs font-semibold uppercase tracking-wider text-neutral-600 dark:text-zinc-400">
              Total Estimated Land Value
            </span>
            <p className="text-2xl sm:text-3xl font-extrabold text-brand dark:text-emerald-400">
              LKR {totalPrice.toLocaleString("en-US")}
            </p>
            <div className="pt-2 border-t border-emerald-200/60 text-xs text-neutral-600 dark:text-zinc-400 space-y-1">
              <p>
                Effective Rate: <span className="font-semibold text-ink dark:text-zinc-200">LKR {Math.round(pricePerSqFt).toLocaleString()}</span> per sq ft
              </p>
              <p>
                Total Area: <span className="font-semibold text-ink dark:text-zinc-200">{perchNum} Perches</span> ({sqft.toLocaleString()} sq ft)
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* AI Assistant CTA */}
      <div className="rounded-3xl border border-neutral-200/80 bg-neutral-900 p-8 text-white sm:p-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/20 px-3 py-1 text-xs font-semibold text-emerald-300">
            Amaya AI Valuation
          </span>
          <h3 className="mt-3 text-xl sm:text-2xl font-bold">
            Wondering if a land price is fair for its location?
          </h3>
          <p className="mt-1 text-sm text-neutral-300 max-w-lg">
            Amaya grades land and house rates against real Colombo and suburb median market records.
          </p>
        </div>

        <button
          type="button"
          onClick={() => openChat("Can you check the current land price benchmarks for Colombo and its suburbs?")}
          className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-6 py-3.5 text-sm font-semibold text-neutral-900 transition-all hover:bg-neutral-100 cursor-pointer shrink-0"
        >
          <span>Ask Amaya for Benchmark Rates</span>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-4">
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Quick Links Back to Properties */}
      <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-neutral-200/80 text-sm">
        <Link href="/properties" className="text-brand font-semibold hover:underline inline-flex items-center gap-1">
          <span>← Browse all verified properties in Sri Lanka</span>
        </Link>
        <Link href="/locations/colombo" className="text-neutral-600 hover:text-brand transition-colors">
          Explore Colombo Real Estate →
        </Link>
      </div>
    </div>
  );
}
