"use client";

import { FormEvent, useState, useEffect } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Compass } from "lucide-react";

import {
  getCurrentUser,
  getSiteConfiguration,
  updateSiteConfiguration,
  type SiteConfiguration,
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
        extra_settings: siteConfig.extra_settings || {},
        prospect_retention_days: siteConfig.prospect_retention_days,
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
                value={siteConfig.prospect_retention_days || 30}
                onChange={(e) =>
                  setSiteConfig((s) => ({
                    ...s,
                    prospect_retention_days: parseInt(e.target.value) || 30,
                  }))
                }
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
