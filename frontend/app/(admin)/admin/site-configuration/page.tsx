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
} from "../../../../lib/api";


function ConfigField({
  label,
  id,
  type = "text",
  placeholder = "",
  value,
  onChange,
  show,
  onShowChange
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
    <>
      <span className="text-xs text-[#64736b]">Show</span>
      <button
        type="button"
        role="switch"
        aria-checked={show ?? true}
        onClick={() => onShowChange(!(show ?? true))}
        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[#19352b] focus:ring-offset-2 ${
          (show ?? true) ? 'bg-[#19352b] dark:bg-[#28513f]' : 'bg-gray-200 dark:bg-zinc-700'
        }`}
      >
        <span
          aria-hidden="true"
          className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
            (show ?? true) ? 'translate-x-4' : 'translate-x-0'
          }`}
        />
      </button>
    </>
  );

  return (
    <div className="mb-4">
      <div className="flex items-center justify-between sm:block">
        <label className="block text-sm font-medium" htmlFor={id}>{label}</label>
        <div className="flex shrink-0 items-center space-x-2 sm:hidden">
          {toggleContent}
        </div>
      </div>
      <div className="mt-2 flex items-center sm:space-x-4">
        <input
          id={id}
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full rounded-lg border border-[#cbd8d1] dark:border-zinc-800 bg-transparent dark:bg-zinc-950 px-3 py-2.5 outline-none focus:border-[#28513f] dark:focus:border-[#28513f] dark:text-zinc-200"
          placeholder={placeholder}
        />
        <div className="hidden shrink-0 items-center space-x-2 sm:flex">
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
    setSiteConfig(s => {
      const field = (s[key] as any) || { value: null, show: true };
      return { ...s, [key]: { ...field, value: value || null } };
    });
  }

  function updateStringShow(key: keyof SiteConfiguration, show: boolean) {
    setSiteConfig(s => {
      const field = (s[key] as any) || { value: null, show: true };
      return { ...s, [key]: { ...field, show } };
    });
  }

  function updateExtraSetting(key: string, value: unknown) {
    setSiteConfig(s => ({
      ...s,
      extra_settings: {
        ...(s.extra_settings || {}),
        [key]: value,
      }
    }));
  }

  useEffect(() => {
    getCurrentUser().then((user) => {
      if (!user || !["root", "admin"].includes(user.role)) {
        router.replace("/admin");
        return;
      }
      
      getSiteConfiguration().then((config) => {
        if (config) {
          setSiteConfig(config);
          setPhoneInput(config.phone_numbers?.values?.join(", ") || "");
        }
      }).catch(() => {}).finally(() => setLoading(false));
    }).catch(() => router.replace("/login"));
  }, [router]);

  async function handleUpdateSiteConfig(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setUpdatingSiteConfig(true);
    try {
      const phones = phoneInput.split(",").map(p => p.trim()).filter(Boolean);
      const updated = await updateSiteConfiguration({
        contact_email: siteConfig.contact_email,
        whatsapp: siteConfig.whatsapp,
        city: siteConfig.city,
        phone_numbers: { values: phones, show: siteConfig.phone_numbers?.show ?? true },
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
      toast.error(caught instanceof Error ? caught.message : "Failed to update site configuration.");
    } finally {
      setUpdatingSiteConfig(false);
    }
  }

  if (loading) {
    return <div className="p-8 text-sm text-[#64736b]">Loading...</div>;
  }

  return (
    <div className="max-w-2xl pb-12">
      <h1 className="text-2xl font-semibold tracking-tight">Site Configuration</h1>
      <p className="mt-2 text-sm text-[#64736b]">Manage global settings and contact information.</p>

      <div className="mt-8 rounded-xl border border-[#dce4df] dark:border-zinc-800 bg-white dark:bg-zinc-950 p-6 shadow-sm">
        <h2 className="text-lg font-medium">Contact & Socials</h2>
        <form onSubmit={handleUpdateSiteConfig} className="mt-6 max-w-md">
          
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
            onShowChange={(v) => setSiteConfig(s => ({ ...s, phone_numbers: { values: s.phone_numbers?.values || [], show: v } }))}
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



          <button
            type="submit"
            disabled={updatingSiteConfig}
            className="mt-4 rounded-lg bg-[#19352b] dark:bg-[#28513f] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#132820] dark:hover:bg-[#1f4233] disabled:cursor-wait disabled:opacity-60 cursor-pointer"
          >
            {updatingSiteConfig ? "Saving..." : "Save configuration"}
          </button>
        </form>
      </div>

      <div className="mt-8 rounded-xl border border-[#dce4df] dark:border-zinc-800 bg-[#fbfcfb] dark:bg-zinc-900/50 p-6 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Compass className="h-5 w-5 text-[#19352b] dark:text-emerald-400" />
            <h2 className="text-base font-semibold text-[#1a2923] dark:text-zinc-100">
              Real Estate Scanner & Automation
            </h2>
          </div>
          <p className="mt-1 text-xs text-[#64736b] dark:text-zinc-400 max-w-xl">
            Automated crawler scheduling, frequency, crawl depth, and search presets are now centrally managed in the dedicated Scanner & Automation Hub.
          </p>
        </div>
        <Link
          href="/admin/scans?tab=automation"
          className="shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-[#19352b] dark:bg-emerald-700 px-3.5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-[#132820] dark:hover:bg-emerald-600 transition"
        >
          <span>Open Scanner Hub →</span>
        </Link>
      </div>

      <div className="mt-8 rounded-xl border border-[#dce4df] dark:border-zinc-800 bg-white dark:bg-zinc-950 p-6 shadow-sm">
        <h2 className="text-lg font-medium">Homepage Main Section Layout</h2>
        <p className="mt-1 text-sm text-[#64736b]">
          Toggle the primary presentation next to the chat panel for all visitors.
        </p>

        <div className="mt-5 space-y-4">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="radio"
              name="homepage_layout"
              value="featured"
              checked={(siteConfig.extra_settings?.homepage_layout ?? "featured") === "featured"}
              onChange={() => updateExtraSetting("homepage_layout", "featured")}
              className="mt-1 size-4 accent-[#19352b]"
            />
            <div>
              <span className="text-sm font-medium text-ink dark:text-zinc-200">
                Featured Properties Carousel (Default)
              </span>
              <p className="text-xs text-[#64736b] mt-0.5">
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
              className="mt-1 size-4 accent-[#19352b]"
            />
            <div>
              <span className="text-sm font-medium text-ink dark:text-zinc-200">
                Curated Sourcing & Services Hub (New Layout)
              </span>
              <p className="text-xs text-[#64736b] mt-0.5">
                Always displays the Bespoke Sourcing (Market Benchmarks), Legal & Title Due Diligence, and Renovations layout (even when properties exist in the database).
              </p>
            </div>
          </label>
        </div>

        <button
          type="button"
          onClick={(e) => handleUpdateSiteConfig(e as any)}
          disabled={updatingSiteConfig}
          className="mt-5 rounded-lg bg-[#19352b] dark:bg-[#28513f] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#132820] dark:hover:bg-[#1f4233] disabled:cursor-wait disabled:opacity-60 cursor-pointer"
        >
          {updatingSiteConfig ? "Saving..." : "Save Layout Preference"}
        </button>
      </div>

      <div className="mt-8 rounded-xl border border-[#dce4df] dark:border-zinc-800 bg-white dark:bg-zinc-950 p-6 shadow-sm">
        <h2 className="text-lg font-medium">Data Retention Settings</h2>
        <div className="mt-6 max-w-md">
          <div className="mb-4">
            <label className="block text-sm font-medium" htmlFor="retention_days">Old Prospects Auto-purge (days)</label>
            <input
              id="retention_days"
              type="number"
              min="1"
              value={siteConfig.prospect_retention_days || 30}
              onChange={(e) => setSiteConfig(s => ({ ...s, prospect_retention_days: parseInt(e.target.value) || 30 }))}
              className="mt-2 w-full sm:w-32 rounded-lg border border-[#cbd8d1] dark:border-zinc-800 bg-transparent dark:bg-zinc-950 px-3 py-2.5 outline-none focus:border-[#28513f] dark:focus:border-[#28513f] dark:text-zinc-200"
            />
          </div>
          <button
            type="button"
            onClick={(e) => handleUpdateSiteConfig(e as any)}
            disabled={updatingSiteConfig}
            className="mt-4 rounded-lg bg-[#19352b] dark:bg-[#28513f] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#132820] dark:hover:bg-[#1f4233] disabled:cursor-wait disabled:opacity-60 cursor-pointer"
          >
            {updatingSiteConfig ? "Saving..." : "Save retention configuration"}
          </button>
        </div>
      </div>
    </div>
  );
}
