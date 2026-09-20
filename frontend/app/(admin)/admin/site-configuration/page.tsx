"use client";

import { FormEvent, useState, useEffect } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

import { 
  getCurrentUser,
  getSiteConfiguration,
  updateSiteConfiguration,
  type SiteConfiguration
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
          (show ?? true) ? 'bg-[#19352b]' : 'bg-gray-200'
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
          className="w-full rounded-lg border border-[#cbd8d1] px-3 py-2.5 outline-none focus:border-[#28513f]"
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

  useEffect(() => {
    getCurrentUser().then((user) => {
      if (!user || user.role !== "root") {
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

      <div className="mt-8 rounded-xl border border-[#dce4df] bg-white p-6 shadow-sm">
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

          <div className="mb-4">
            <label className="block text-sm font-medium" htmlFor="retention_days">Data Retention: Old Prospects Auto-purge (days)</label>
            <input
              id="retention_days"
              type="number"
              min="1"
              value={siteConfig.prospect_retention_days || 30}
              onChange={(e) => setSiteConfig(s => ({ ...s, prospect_retention_days: parseInt(e.target.value) || 30 }))}
              className="mt-2 w-full sm:w-32 rounded-lg border border-[#cbd8d1] px-3 py-2.5 outline-none focus:border-[#28513f]"
            />
          </div>

          <button
            type="submit"
            disabled={updatingSiteConfig}
            className="mt-4 rounded-lg bg-[#19352b] px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-wait disabled:opacity-60"
          >
            {updatingSiteConfig ? "Saving..." : "Save configuration"}
          </button>
        </form>
      </div>
    </div>
  );
}
