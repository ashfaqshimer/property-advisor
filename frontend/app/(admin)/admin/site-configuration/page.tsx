"use client";

import { FormEvent, useState, useEffect } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Compass,
  TrendingUp,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Loader2,
} from "lucide-react";

import {
  getCurrentUser,
  getSiteConfiguration,
  updateSiteConfiguration,
  getMarketBenchmarks,
  triggerBenchmarkSync,
  type SiteConfiguration,
  type MarketBenchmark,
  type FeaturedSettings,
} from "@/lib/api";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";

function ConfigField({
  label,
  id,
  type = "text",
  placeholder = "",
  value,
  onChange,
  show,
  onShowChange,
}: {
  label: string;
  id: string;
  type?: string;
  placeholder?: string;
  value: string;
  onChange: (val: string) => void;
  show?: boolean;
  onShowChange?: (val: boolean) => void;
}) {
  const toggleContent = onShowChange !== undefined && (
    <div className="flex items-center space-x-2">
      <Label htmlFor={`${id}-toggle`} className="text-xs text-muted-foreground cursor-pointer">
        Show
      </Label>
      <Switch
        id={`${id}-toggle`}
        checked={show ?? true}
        onCheckedChange={(checked) => onShowChange(checked)}
      />
    </div>
  );

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label htmlFor={id}>{label}</Label>
        <div className="flex shrink-0 items-center sm:hidden">
          {toggleContent}
        </div>
      </div>
      <div className="flex items-center gap-3">
        <Input
          id={id}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full"
        />
        <div className="hidden shrink-0 items-center sm:flex">
          {toggleContent}
        </div>
      </div>
    </div>
  );
}

export default function SiteConfigurationPage() {
  const router = useRouter();
  const [siteConfig, setSiteConfig] = useState<Partial<SiteConfiguration>>({});
  const [updatingSiteConfig, setUpdatingSiteConfig] = useState(false);
  const [phoneInput, setPhoneInput] = useState("");
  const [loading, setLoading] = useState(true);

  const [syncingBenchmarks, setSyncingBenchmarks] = useState(false);
  const [benchmarks, setBenchmarks] = useState<MarketBenchmark[]>([]);
  const [showBenchmarksList, setShowBenchmarksList] = useState(false);
  const [loadingBenchmarks, setLoadingBenchmarks] = useState(false);

  async function loadBenchmarks() {
    setLoadingBenchmarks(true);
    try {
      const data = await getMarketBenchmarks();
      setBenchmarks(data);
    } catch {
      // ignore
    } finally {
      setLoadingBenchmarks(false);
    }
  }

  async function handleSyncBenchmarksNow() {
    setSyncingBenchmarks(true);
    try {
      const res = await triggerBenchmarkSync();
      toast.success(res.message || "Benchmark sync started.");
      setTimeout(async () => {
        const updatedCfg = await getSiteConfiguration();
        if (updatedCfg) setSiteConfig(updatedCfg);
        loadBenchmarks();
      }, 3000);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sync failed.");
    } finally {
      setSyncingBenchmarks(false);
    }
  }

  function updateStringValue(key: keyof SiteConfiguration, value: string) {
    setSiteConfig((s) => {
      const field = (s[key] as any) || { value: null, show: true };
      return { ...s, [key]: { ...field, value: value || null } };
    });
  }

  function updateStringShow(key: keyof SiteConfiguration, show: boolean) {
    setSiteConfig((s) => {
      const field = (s[key] as any) || { value: null, show: true };
      return { ...s, [key]: { ...field, show } };
    });
  }

  function updateExtraSetting(key: string, value: unknown) {
    setSiteConfig((s) => ({
      ...s,
      extra_settings: {
        ...(s.extra_settings || {}),
        [key]: value,
      },
    }));
  }

  function updateFeaturedSetting<K extends keyof FeaturedSettings>(
    key: K,
    value: FeaturedSettings[K]
  ) {
    setSiteConfig((s) => ({
      ...s,
      featured_settings: {
        visible_count: s.featured_settings?.visible_count ?? 4,
        cycle_interval_seconds: s.featured_settings?.cycle_interval_seconds ?? 6,
        auto_cycle: s.featured_settings?.auto_cycle ?? true,
        [key]: value,
      },
    }));
  }

  useEffect(() => {
    getCurrentUser()
      .then((user) => {
        if (!user || !["root", "admin"].includes(user.role)) {
          router.replace("/admin");
          return;
        }

        getSiteConfiguration()
          .then((config) => {
            if (config) {
              setSiteConfig(config);
              setPhoneInput(config.phone_numbers?.values?.join(", ") || "");
            }
          })
          .catch(() => {})
          .finally(() => setLoading(false));
      })
      .catch(() => router.replace("/login"));
  }, [router]);

  async function handleUpdateSiteConfig(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setUpdatingSiteConfig(true);
    try {
      const phones = phoneInput
        .split(",")
        .map((p) => p.trim())
        .filter(Boolean);
      const updated = await updateSiteConfiguration({
        contact_email: siteConfig.contact_email,
        whatsapp: siteConfig.whatsapp,
        city: siteConfig.city,
        phone_numbers: {
          values: phones,
          show: siteConfig.phone_numbers?.show ?? true,
        },
        instagram_link: siteConfig.instagram_link,
        facebook_link: siteConfig.facebook_link,
        x_link: siteConfig.x_link,
        tiktok_link: siteConfig.tiktok_link,
        scanner_settings: siteConfig.scanner_settings,
        benchmark_sync_settings: siteConfig.benchmark_sync_settings,
        extra_settings: siteConfig.extra_settings || {},
        prospect_retention_days: Number(siteConfig.prospect_retention_days) || 30,
      });
      setSiteConfig(updated);
      setPhoneInput(updated.phone_numbers?.values?.join(", ") || "");
      toast.success("Site configuration updated.");
    } catch (caught) {
      toast.error(
        caught instanceof Error
          ? caught.message
          : "Failed to update site configuration."
      );
    } finally {
      setUpdatingSiteConfig(false);
    }
  }

  if (loading) {
    return <div className="p-8 text-sm text-muted-foreground">Loading...</div>;
  }

  return (
    <div className="max-w-2xl pb-12">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground">
        Site Configuration
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Manage global settings and contact information.
      </p>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle className="text-lg font-medium">Contact & Socials</CardTitle>
          <CardDescription>
            Configure public-facing communication channels and social media links.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleUpdateSiteConfig} className="max-w-md space-y-4">
            <ConfigField
              id="contact_email"
              label="Contact Email"
              type="email"
              placeholder="e.g. hello@example.com"
              value={siteConfig.contact_email?.value || ""}
              onChange={(v) => updateStringValue("contact_email", v)}
              show={siteConfig.contact_email?.show ?? true}
              onShowChange={(v) => updateStringShow("contact_email", v)}
            />

            <ConfigField
              id="phone_numbers"
              label="Phone Numbers (comma separated)"
              placeholder="+94770000000, +94112222222"
              value={phoneInput}
              onChange={(v) => setPhoneInput(v)}
              show={siteConfig.phone_numbers?.show ?? true}
              onShowChange={(v) =>
                setSiteConfig((s) => ({
                  ...s,
                  phone_numbers: {
                    values: s.phone_numbers?.values || [],
                    show: v,
                  },
                }))
              }
            />

            <ConfigField
              id="whatsapp"
              label="WhatsApp Number"
              placeholder="+94770000000"
              value={siteConfig.whatsapp?.value || ""}
              onChange={(v) => updateStringValue("whatsapp", v)}
              show={siteConfig.whatsapp?.show ?? true}
              onShowChange={(v) => updateStringShow("whatsapp", v)}
            />

            <ConfigField
              id="city"
              label="City"
              placeholder="e.g. Colombo"
              value={siteConfig.city?.value || ""}
              onChange={(v) => updateStringValue("city", v)}
              show={siteConfig.city?.show ?? true}
              onShowChange={(v) => updateStringShow("city", v)}
            />

            <ConfigField
              id="facebook_link"
              label="Facebook Link"
              type="url"
              placeholder="https://facebook.com/..."
              value={siteConfig.facebook_link?.value || ""}
              onChange={(v) => updateStringValue("facebook_link", v)}
              show={siteConfig.facebook_link?.show ?? true}
              onShowChange={(v) => updateStringShow("facebook_link", v)}
            />

            <ConfigField
              id="instagram_link"
              label="Instagram Link"
              type="url"
              placeholder="https://instagram.com/..."
              value={siteConfig.instagram_link?.value || ""}
              onChange={(v) => updateStringValue("instagram_link", v)}
              show={siteConfig.instagram_link?.show ?? true}
              onShowChange={(v) => updateStringShow("instagram_link", v)}
            />

            <ConfigField
              id="x_link"
              label="X (Twitter) Link"
              type="url"
              placeholder="https://x.com/..."
              value={siteConfig.x_link?.value || ""}
              onChange={(v) => updateStringValue("x_link", v)}
              show={siteConfig.x_link?.show ?? true}
              onShowChange={(v) => updateStringShow("x_link", v)}
            />

            <ConfigField
              id="tiktok_link"
              label="TikTok Link"
              type="url"
              placeholder="https://tiktok.com/..."
              value={siteConfig.tiktok_link?.value || ""}
              onChange={(v) => updateStringValue("tiktok_link", v)}
              show={siteConfig.tiktok_link?.show ?? true}
              onShowChange={(v) => updateStringShow("tiktok_link", v)}
            />

            <Button
              type="submit"
              disabled={updatingSiteConfig}
              className="mt-2"
            >
              {updatingSiteConfig ? "Saving..." : "Save configuration"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="mt-8 bg-muted/40">
        <CardContent className="p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Compass className="h-5 w-5 text-primary" />
              <CardTitle className="text-base font-semibold">
                Real Estate Scanner & Automation
              </CardTitle>
            </div>
            <CardDescription className="mt-1 text-xs max-w-xl">
              Automated crawler scheduling, frequency, crawl depth, and search presets are now centrally managed in the dedicated Scanner & Automation Hub.
            </CardDescription>
          </div>
          <Button asChild size="sm" className="shrink-0">
            <Link href="/admin/scans?tab=automation">
              <span>Open Scanner Hub →</span>
            </Link>
          </Button>
        </CardContent>
      </Card>

      <Card className="mt-8">
        <CardHeader>
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            <CardTitle className="text-lg font-medium">Market Benchmarks & Price Valuation</CardTitle>
          </div>
          <CardDescription>
            Localized per-square-foot and per-perch pricing benchmarks used by Amaya and the lead evaluation engine.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-lg bg-muted/40 border">
            <div>
              <div className="text-sm font-medium">Automated Periodic Sync</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                Periodically refreshes pricing baselines from market indicators.
              </div>
            </div>
            <Switch
              checked={siteConfig.benchmark_sync_settings?.enabled ?? true}
              onCheckedChange={(checked) =>
                setSiteConfig((s) => ({
                  ...s,
                  benchmark_sync_settings: {
                    ...(s.benchmark_sync_settings || { frequency_days: 7 }),
                    enabled: checked,
                  },
                }))
              }
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="benchmark_frequency">Sync Frequency (Days)</Label>
            <div className="flex items-center gap-3">
              <Input
                id="benchmark_frequency"
                type="number"
                min="1"
                max="90"
                value={siteConfig.benchmark_sync_settings?.frequency_days ?? 7}
                onChange={(e) =>
                  setSiteConfig((s) => ({
                    ...s,
                    benchmark_sync_settings: {
                      ...(s.benchmark_sync_settings || { enabled: true }),
                      frequency_days: parseInt(e.target.value) || 7,
                    },
                  }))
                }
                className="w-28"
              />
              <span className="text-xs text-muted-foreground">days between scheduled updates</span>
            </div>
          </div>

          <div className="rounded-lg border p-4 bg-muted/20 text-xs space-y-1.5">
            <div className="flex items-center justify-between text-muted-foreground">
              <span>Last Sync Run:</span>
              <span className="font-medium text-foreground">
                {siteConfig.benchmark_sync_settings?.last_run_at
                  ? new Date(siteConfig.benchmark_sync_settings.last_run_at).toLocaleString()
                  : "Never"}
              </span>
            </div>
            {siteConfig.benchmark_sync_settings?.last_run_status && (
              <div className="flex items-center justify-between text-muted-foreground">
                <span>Last Result:</span>
                <span className="font-medium text-foreground">
                  {siteConfig.benchmark_sync_settings.last_run_status}
                </span>
              </div>
            )}
            <div className="flex items-center justify-between text-muted-foreground">
              <span>Next Scheduled Run:</span>
              <span className="font-medium text-foreground">
                {siteConfig.benchmark_sync_settings?.next_run_at
                  ? new Date(siteConfig.benchmark_sync_settings.next_run_at).toLocaleString()
                  : "Not scheduled"}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Button
              type="button"
              onClick={handleSyncBenchmarksNow}
              disabled={syncingBenchmarks}
              size="sm"
            >
              {syncingBenchmarks ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Syncing...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Sync Benchmarks Now
                </>
              )}
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                if (!showBenchmarksList && benchmarks.length === 0) {
                  loadBenchmarks();
                }
                setShowBenchmarksList(!showBenchmarksList);
              }}
            >
              {showBenchmarksList ? (
                <>
                  <ChevronUp className="mr-2 h-4 w-4" />
                  Hide Stored Rates
                </>
              ) : (
                <>
                  <ChevronDown className="mr-2 h-4 w-4" />
                  View Stored Rates ({benchmarks.length > 0 ? benchmarks.length : "Show"})
                </>
              )}
            </Button>

            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={(e) => handleUpdateSiteConfig(e as any)}
              disabled={updatingSiteConfig}
            >
              {updatingSiteConfig ? "Saving..." : "Save Benchmark Settings"}
            </Button>
          </div>

          {showBenchmarksList && (
            <div className="mt-4 border rounded-lg overflow-hidden">
              <div className="bg-muted/50 p-2 text-xs font-semibold border-b flex justify-between items-center">
                <span>Stored Market Benchmarks</span>
                <span className="text-muted-foreground font-normal">
                  {benchmarks.length} entries
                </span>
              </div>
              {loadingBenchmarks ? (
                <div className="p-4 text-xs text-center text-muted-foreground">Loading benchmarks...</div>
              ) : benchmarks.length === 0 ? (
                <div className="p-4 text-xs text-center text-muted-foreground">
                  No benchmarks stored yet. Click "Sync Benchmarks Now" to populate.
                </div>
              ) : (
                <div className="max-h-64 overflow-y-auto divide-y text-xs">
                  {benchmarks.map((b) => (
                    <div key={b.id} className="p-2.5 flex items-center justify-between hover:bg-muted/20">
                      <div>
                        <span className="font-medium text-foreground">{b.location}</span>
                        <span className="ml-2 text-muted-foreground uppercase text-[10px] tracking-wider">
                          {b.property_type} • {b.listing_type}
                        </span>
                      </div>
                      <div className="text-right">
                        {b.rate_per_sqft ? (
                          <div className="font-semibold text-foreground">
                            Rs. {Number(b.rate_per_sqft).toLocaleString()} <span className="text-muted-foreground text-[10px]">/sqft</span>
                          </div>
                        ) : b.rate_per_perch ? (
                          <div className="font-semibold text-foreground">
                            Rs. {Number(b.rate_per_perch).toLocaleString()} <span className="text-muted-foreground text-[10px]">/perch</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground italic text-[11px]">{b.status}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle className="text-lg font-medium">Homepage Main Section Layout</CardTitle>
          <CardDescription>
            Toggle the primary presentation next to the chat panel for all visitors.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="radio"
                name="homepage_layout"
                value="featured"
                checked={(siteConfig.extra_settings?.homepage_layout ?? "featured") === "featured"}
                onChange={() => updateExtraSetting("homepage_layout", "featured")}
                className="mt-1 size-4 accent-primary"
              />
              <div>
                <span className="text-sm font-medium text-foreground">
                  Featured Properties Carousel (Default)
                </span>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Displays active featured properties in the carousel, automatically falling back to the Services Hub if 0 listings exist.
                </p>
              </div>
            </label>

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="radio"
                name="homepage_layout"
                value="services"
                checked={siteConfig.extra_settings?.homepage_layout === "services"}
                onChange={() => updateExtraSetting("homepage_layout", "services")}
                className="mt-1 size-4 accent-primary"
              />
              <div>
                <span className="text-sm font-medium text-foreground">
                  Curated Sourcing & Services Hub (New Layout)
                </span>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Always displays the Bespoke Sourcing (Market Benchmarks), Legal & Title Due Diligence, and Renovations layout (even when properties exist in the database).
                </p>
              </div>
            </label>
          </div>

          <Button
            type="button"
            onClick={(e) => handleUpdateSiteConfig(e as any)}
            disabled={updatingSiteConfig}
            className="mt-6"
          >
            {updatingSiteConfig ? "Saving..." : "Save Layout Preference"}
          </Button>
        </CardContent>
      </Card>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle className="text-lg font-medium">Featured Listings Display</CardTitle>
          <CardDescription>
            Configure how featured properties appear and cycle on the homepage.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="max-w-md space-y-5">
            <div className="space-y-2">
              <Label htmlFor="featured_visible_count">Visible cards count</Label>
              <Input
                id="featured_visible_count"
                type="number"
                min="1"
                max="12"
                value={siteConfig.featured_settings?.visible_count ?? 4}
                onChange={(e) =>
                  updateFeaturedSetting(
                    "visible_count",
                    Math.max(1, Math.min(12, parseInt(e.target.value) || 1))
                  )
                }
                className="w-full sm:w-32"
              />
              <p className="text-xs text-muted-foreground">
                Number of featured property cards to display concurrently on the homepage (e.g. 4).
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="featured_cycle_interval">Cycle interval (seconds)</Label>
              <Input
                id="featured_cycle_interval"
                type="number"
                min="2"
                max="60"
                value={siteConfig.featured_settings?.cycle_interval_seconds ?? 6}
                onChange={(e) =>
                  updateFeaturedSetting(
                    "cycle_interval_seconds",
                    Math.max(2, Math.min(60, parseInt(e.target.value) || 2))
                  )
                }
                className="w-full sm:w-32"
              />
              <p className="text-xs text-muted-foreground">
                How often the UI fades to the next batch of featured properties (e.g. every 6 seconds).
              </p>
            </div>

            <div className="flex items-center justify-between rounded-lg border border-border p-3.5">
              <div className="space-y-0.5">
                <Label htmlFor="featured_auto_cycle" className="text-sm font-medium cursor-pointer">
                  Auto-cycle through properties
                </Label>
                <p className="text-xs text-muted-foreground">
                  Automatically cycle through all featured properties periodically.
                </p>
              </div>
              <Switch
                id="featured_auto_cycle"
                checked={siteConfig.featured_settings?.auto_cycle ?? true}
                onCheckedChange={(checked) =>
                  updateFeaturedSetting("auto_cycle", checked)
                }
              />
            </div>

            <Button
              type="button"
              onClick={(e) => handleUpdateSiteConfig(e as any)}
              disabled={updatingSiteConfig}
            >
              {updatingSiteConfig ? "Saving..." : "Save Featured Settings"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle className="text-lg font-medium">Data Retention Settings</CardTitle>
          <CardDescription>
            Configure automatic cleanup rules for stale prospects and leads.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="max-w-md space-y-4">
            <div className="space-y-2">
              <Label htmlFor="retention_days">Old Prospects Auto-purge (days)</Label>
              <Input
                id="retention_days"
                type="number"
                min="1"
                value={siteConfig.prospect_retention_days ?? 30}
                onChange={(e) =>
                  setSiteConfig((s) => ({
                    ...s,
                    prospect_retention_days: e.target.value === "" ? ("" as any) : parseInt(e.target.value) || "",
                  }))
                }
                onBlur={() => {
                  setSiteConfig((s) => ({
                    ...s,
                    prospect_retention_days:
                      !s.prospect_retention_days || Number(s.prospect_retention_days) < 1
                        ? 30
                        : Number(s.prospect_retention_days),
                  }));
                }}
                className="w-full sm:w-32"
              />
            </div>
            <Button
              type="button"
              onClick={(e) => handleUpdateSiteConfig(e as any)}
              disabled={updatingSiteConfig}
            >
              {updatingSiteConfig ? "Saving..." : "Save retention configuration"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
