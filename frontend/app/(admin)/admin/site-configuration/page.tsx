"use client";

import { FormEvent, useState, useEffect } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

import { Bookmark, Plus, Trash2, MapPin } from "lucide-react";

import { 
  getCurrentUser,
  getSiteConfiguration,
  updateSiteConfiguration,
  type SiteConfiguration,
  type ScanPreset,
} from "../../../../lib/api";
import { SourceBadge } from "../../../../components/admin/SourceBadge";

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

  // New preset form state
  const [newPresetName, setNewPresetName] = useState("");
  const [newPresetKeyword, setNewPresetKeyword] = useState("");
  const [newPresetCategory, setNewPresetCategory] = useState<"all" | "lands" | "apartments" | "houses" | "commercial">("all");
  const [newPresetSource, setNewPresetSource] = useState("ikman");

  function handleAddPreset() {
    if (!newPresetName.trim() || !newPresetKeyword.trim()) {
      toast.error("Please enter both preset name and location keyword");
      return;
    }
    const newPreset: ScanPreset = {
      id: `preset-${Date.now()}`,
      name: newPresetName.trim(),
      keyword: newPresetKeyword.trim(),
      property_category: newPresetCategory,
      strict_location: true,
      scan_all: true,
      source: newPresetSource,
      is_default: false,
    };
    const current = siteConfig.scanner_settings?.presets || [];
    setSiteConfig(s => ({
      ...s,
      scanner_settings: {
        ...(s.scanner_settings || { enabled: false, frequency_hours: 24, pages_to_scan: 5, property_types: ["house", "apartment"] }),
        presets: [...current, newPreset],
      }
    }));
    setNewPresetName("");
    setNewPresetKeyword("");
    toast.success(`Preset "${newPreset.name}" added to list. Click "Save scan presets" to persist.`);
  }

  function handleRemovePreset(presetId: string) {
    const current = siteConfig.scanner_settings?.presets || [];
    const updated = current.filter(p => p.id !== presetId);
    setSiteConfig(s => ({
      ...s,
      scanner_settings: {
        ...(s.scanner_settings || { enabled: false, frequency_hours: 24, pages_to_scan: 5, property_types: ["house", "apartment"] }),
        presets: updated,
      }
    }));
    toast.info("Preset removed from list. Click save to persist.");
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

      <div className="mt-8 rounded-xl border border-[#dce4df] dark:border-zinc-800 bg-white dark:bg-zinc-950 p-6 shadow-sm">
        <h2 className="text-lg font-medium">Property Scanner Settings</h2>
        <div className="mt-6 max-w-md space-y-6">
          <div className="flex items-center space-x-3">
            <button
              type="button"
              role="switch"
              aria-checked={siteConfig.scanner_settings?.enabled ?? false}
              onClick={() => setSiteConfig(s => ({ ...s, scanner_settings: { ...(s.scanner_settings || { frequency_hours: 24, pages_to_scan: 5, property_types: ['house', 'apartment'] }), enabled: !(s.scanner_settings?.enabled ?? false) } }))}
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-[#19352b] focus:ring-offset-2 ${
                (siteConfig.scanner_settings?.enabled ?? false) ? 'bg-[#19352b] dark:bg-[#28513f]' : 'bg-gray-200 dark:bg-zinc-700'
              }`}
            >
              <span
                aria-hidden="true"
                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  (siteConfig.scanner_settings?.enabled ?? false) ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>
            <span className="text-sm font-medium">Enable Background Scanner</span>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Run Frequency</label>
            <select
              value={siteConfig.scanner_settings?.frequency_hours ?? 24}
              onChange={(e) => setSiteConfig(s => ({ ...s, scanner_settings: { ...(s.scanner_settings || { enabled: false, pages_to_scan: 5, property_types: ['house', 'apartment'] }), frequency_hours: parseInt(e.target.value) } }))}
              className="w-full rounded-lg border border-[#cbd8d1] dark:border-zinc-800 bg-transparent dark:bg-zinc-950 px-3 py-2.5 outline-none focus:border-[#28513f] dark:focus:border-[#28513f] dark:text-zinc-200"
            >
              <option value={6}>Every 6 Hours</option>
              <option value={12}>Every 12 Hours</option>
              <option value={18}>Every 18 Hours</option>
              <option value={24}>Every 24 Hours</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Pages to Scan</label>
            <input
              type="number"
              min="1"
              max="50"
              value={siteConfig.scanner_settings?.pages_to_scan ?? 5}
              onChange={(e) => setSiteConfig(s => ({ ...s, scanner_settings: { ...(s.scanner_settings || { enabled: false, frequency_hours: 24, property_types: ['house', 'apartment'] }), pages_to_scan: parseInt(e.target.value) || 1 } }))}
              className="w-full rounded-lg border border-[#cbd8d1] dark:border-zinc-800 bg-transparent dark:bg-zinc-950 px-3 py-2.5 outline-none focus:border-[#28513f] dark:focus:border-[#28513f] dark:text-zinc-200"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-3">Property Types</label>
            <div className="space-y-3">
              {['house', 'apartment', 'land', 'commercial'].map(type => {
                const isChecked = (siteConfig.scanner_settings?.property_types ?? ['house', 'apartment']).includes(type);
                return (
                  <label key={type} className="flex items-center space-x-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={(e) => {
                        const current = siteConfig.scanner_settings?.property_types ?? ['house', 'apartment'];
                        const next = e.target.checked ? [...current, type] : current.filter(t => t !== type);
                        setSiteConfig(s => ({ ...s, scanner_settings: { ...(s.scanner_settings || { enabled: false, frequency_hours: 24, pages_to_scan: 5 }), property_types: next } }));
                      }}
                      className="h-4 w-4 rounded border-[#cbd8d1] text-[#19352b] focus:ring-[#19352b] cursor-pointer"
                    />
                    <span className="text-sm capitalize">{type}</span>
                  </label>
                );
              })}
            </div>
          </div>
          
          <div className="rounded-lg bg-gray-50 dark:bg-zinc-900 p-4 border border-gray-100 dark:border-zinc-800">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-black dark:text-zinc-200">Scanner Schedule & Status</h3>
              {siteConfig.scanner_settings?.enabled ? (
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Scheduled
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400">
                  <span className="h-1.5 w-1.5 rounded-full bg-zinc-400" />
                  Disabled
                </span>
              )}
            </div>
            <div className="text-sm text-[#64736b] dark:text-zinc-400 space-y-1.5">
              <p>
                <span className="font-medium text-black dark:text-zinc-200">Next Scan:</span>{" "}
                {siteConfig.scanner_settings?.enabled
                  ? siteConfig.scanner_settings?.next_run_at
                    ? new Date(siteConfig.scanner_settings.next_run_at).toLocaleString(undefined, {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })
                    : "Scheduled on next restart"
                  : "Not scheduled (scanner disabled)"}
              </p>
              {siteConfig.scanner_settings?.last_run_at && (
                <>
                  <p>
                    <span className="font-medium text-black dark:text-zinc-200">Last Scan:</span>{" "}
                    {new Date(siteConfig.scanner_settings.last_run_at).toLocaleString(undefined, {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </p>
                  <p>
                    <span className="font-medium text-black dark:text-zinc-200">Last Status:</span>{" "}
                    {siteConfig.scanner_settings.last_run_status || "Completed"}
                  </p>
                </>
              )}
            </div>
          </div>
          
          <button
            type="button"
            onClick={(e) => handleUpdateSiteConfig(e as any)}
            disabled={updatingSiteConfig}
            className="mt-4 rounded-lg bg-[#19352b] dark:bg-[#28513f] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#132820] dark:hover:bg-[#1f4233] disabled:cursor-wait disabled:opacity-60 cursor-pointer"
          >
            {updatingSiteConfig ? "Saving..." : "Save scanner configuration"}
          </button>
        </div>
      </div>

      <div className="mt-8 rounded-xl border border-[#dce4df] dark:border-zinc-800 bg-white dark:bg-zinc-950 p-6 shadow-sm">
        <div className="flex items-center gap-2">
          <Bookmark className="h-5 w-5 text-[#19352b] dark:text-emerald-400" />
          <h2 className="text-lg font-medium">Scan Presets & Watchlists</h2>
        </div>
        <p className="mt-1 text-sm text-[#64736b] dark:text-zinc-400">
          Configure default and team search presets displayed across the Admin Prospects and Scan History drawers.
        </p>

        {/* Existing Presets List */}
        <div className="mt-6 space-y-2.5">
          {(siteConfig.scanner_settings?.presets && siteConfig.scanner_settings.presets.length > 0) ? (
            siteConfig.scanner_settings.presets.map((preset) => (
              <div
                key={preset.id}
                className="flex items-center justify-between rounded-lg border border-[#e5ebe7] dark:border-zinc-800 bg-[#fbfcfb] dark:bg-zinc-900/40 p-3"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-md bg-[#eef3f0] dark:bg-zinc-800 text-[#19352b] dark:text-emerald-400">
                    <MapPin className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-[#1a2923] dark:text-zinc-100">
                        {preset.name}
                      </span>
                      <SourceBadge source={preset.source} />
                      {preset.is_default && (
                        <span className="rounded bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 text-[10px] font-medium text-zinc-600 dark:text-zinc-400">
                          Built-in
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[#64736b] dark:text-zinc-400">
                      Keyword: <span className="font-medium text-[#1a2923] dark:text-zinc-300">"{preset.keyword}"</span> • Category: <span className="capitalize">{preset.property_category}</span>
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleRemovePreset(preset.id)}
                  className="cursor-pointer rounded p-1.5 text-zinc-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/40 dark:hover:text-rose-400 transition"
                  title="Remove preset"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))
          ) : (
            <p className="text-xs text-[#64736b] dark:text-zinc-400 italic">No presets configured.</p>
          )}
        </div>

        {/* Add Preset Form */}
        <div className="mt-6 rounded-lg border border-dashed border-[#cbd8d1] dark:border-zinc-800 p-4 bg-[#f9faf9] dark:bg-zinc-900/30">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#718078] dark:text-zinc-400 mb-3">
            Add New Preset
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-xs font-medium text-[#64736b] dark:text-zinc-400 mb-1">
                Preset Name
              </label>
              <input
                type="text"
                placeholder="e.g. Negombo Land Sales"
                value={newPresetName}
                onChange={(e) => setNewPresetName(e.target.value)}
                className="w-full rounded-lg border border-[#cbd8d1] dark:border-zinc-800 bg-white dark:bg-zinc-950 px-3 py-2 text-xs outline-none focus:border-[#19352b] dark:text-zinc-200"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#64736b] dark:text-zinc-400 mb-1">
                Location Keyword
              </label>
              <input
                type="text"
                placeholder="e.g. Negombo"
                value={newPresetKeyword}
                onChange={(e) => setNewPresetKeyword(e.target.value)}
                className="w-full rounded-lg border border-[#cbd8d1] dark:border-zinc-800 bg-white dark:bg-zinc-950 px-3 py-2 text-xs outline-none focus:border-[#19352b] dark:text-zinc-200"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#64736b] dark:text-zinc-400 mb-1">
                Category
              </label>
              <select
                value={newPresetCategory}
                onChange={(e) => setNewPresetCategory(e.target.value as any)}
                className="w-full rounded-lg border border-[#cbd8d1] dark:border-zinc-800 bg-white dark:bg-zinc-950 px-3 py-2 text-xs outline-none focus:border-[#19352b] dark:text-zinc-200"
              >
                <option value="all">All Properties</option>
                <option value="houses">Houses</option>
                <option value="apartments">Apartments</option>
                <option value="lands">Lands</option>
                <option value="commercial">Commercial</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[#64736b] dark:text-zinc-400 mb-1">
                Source Portal
              </label>
              <select
                value={newPresetSource}
                onChange={(e) => setNewPresetSource(e.target.value)}
                className="w-full rounded-lg border border-[#cbd8d1] dark:border-zinc-800 bg-white dark:bg-zinc-950 px-3 py-2 text-xs outline-none focus:border-[#19352b] dark:text-zinc-200"
              >
                <option value="ikman">ikman.lk</option>
                <option value="lpw">LankaPropertyWeb (Upcoming)</option>
              </select>
            </div>
          </div>
          <button
            type="button"
            onClick={handleAddPreset}
            className="cursor-pointer inline-flex items-center gap-1.5 rounded-lg border border-[#19352b] bg-white dark:bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-[#19352b] dark:text-emerald-400 hover:bg-[#19352b] hover:text-white dark:hover:bg-emerald-700 dark:hover:text-white transition"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Add Preset</span>
          </button>
        </div>

        <button
          type="button"
          onClick={(e) => handleUpdateSiteConfig(e as any)}
          disabled={updatingSiteConfig}
          className="mt-6 rounded-lg bg-[#19352b] dark:bg-[#28513f] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#132820] dark:hover:bg-[#1f4233] disabled:cursor-wait disabled:opacity-60 cursor-pointer"
        >
          {updatingSiteConfig ? "Saving..." : "Save scan presets"}
        </button>
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
