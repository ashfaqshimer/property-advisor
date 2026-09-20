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

  useEffect(() => {
    getCurrentUser().then((user) => {
      if (!user || user.role !== "root") {
        router.replace("/admin");
        return;
      }
      
      getSiteConfiguration().then((config) => {
        if (config) {
          setSiteConfig(config);
          setPhoneInput(config.phone_numbers.join(", "));
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
        contact_email: siteConfig.contact_email || null,
        show_contact_email: siteConfig.show_contact_email ?? true,
        city: siteConfig.city || null,
        show_city: siteConfig.show_city ?? true,
        phone_numbers: phones,
        show_phone_numbers: siteConfig.show_phone_numbers ?? true,
        instagram_link: siteConfig.instagram_link || null,
        show_instagram_link: siteConfig.show_instagram_link ?? true,
        facebook_link: siteConfig.facebook_link || null,
        show_facebook_link: siteConfig.show_facebook_link ?? true,
        x_link: siteConfig.x_link || null,
        show_x_link: siteConfig.show_x_link ?? true,
        tiktok_link: siteConfig.tiktok_link || null,
        show_tiktok_link: siteConfig.show_tiktok_link ?? true,
      });
      setSiteConfig(updated);
      setPhoneInput(updated.phone_numbers.join(", "));
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
            value={siteConfig.contact_email || ""}
            onChange={(v) => setSiteConfig(s => ({ ...s, contact_email: v }))}
            show={siteConfig.show_contact_email}
            onShowChange={(v) => setSiteConfig(s => ({ ...s, show_contact_email: v }))}
          />

          <ConfigField
            id="phone_numbers"
            label="Phone Numbers (comma separated)"
            placeholder="+94770000000, +94112222222"
            value={phoneInput}
            onChange={(v) => setPhoneInput(v)}
            show={siteConfig.show_phone_numbers}
            onShowChange={(v) => setSiteConfig(s => ({ ...s, show_phone_numbers: v }))}
          />

          <ConfigField
            id="city"
            label="City"
            placeholder="e.g. Colombo"
            value={siteConfig.city || ""}
            onChange={(v) => setSiteConfig(s => ({ ...s, city: v }))}
            show={siteConfig.show_city}
            onShowChange={(v) => setSiteConfig(s => ({ ...s, show_city: v }))}
          />

          <ConfigField
            id="facebook_link"
            label="Facebook Link"
            type="url"
            placeholder="https://facebook.com/..."
            value={siteConfig.facebook_link || ""}
            onChange={(v) => setSiteConfig(s => ({ ...s, facebook_link: v }))}
            show={siteConfig.show_facebook_link}
            onShowChange={(v) => setSiteConfig(s => ({ ...s, show_facebook_link: v }))}
          />

          <ConfigField
            id="instagram_link"
            label="Instagram Link"
            type="url"
            placeholder="https://instagram.com/..."
            value={siteConfig.instagram_link || ""}
            onChange={(v) => setSiteConfig(s => ({ ...s, instagram_link: v }))}
            show={siteConfig.show_instagram_link}
            onShowChange={(v) => setSiteConfig(s => ({ ...s, show_instagram_link: v }))}
          />

          <ConfigField
            id="x_link"
            label="X (Twitter) Link"
            type="url"
            placeholder="https://x.com/..."
            value={siteConfig.x_link || ""}
            onChange={(v) => setSiteConfig(s => ({ ...s, x_link: v }))}
            show={siteConfig.show_x_link}
            onShowChange={(v) => setSiteConfig(s => ({ ...s, show_x_link: v }))}
          />

          <ConfigField
            id="tiktok_link"
            label="TikTok Link"
            type="url"
            placeholder="https://tiktok.com/..."
            value={siteConfig.tiktok_link || ""}
            onChange={(v) => setSiteConfig(s => ({ ...s, tiktok_link: v }))}
            show={siteConfig.show_tiktok_link}
            onShowChange={(v) => setSiteConfig(s => ({ ...s, show_tiktok_link: v }))}
          />

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
