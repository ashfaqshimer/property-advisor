import { toast } from "sonner";
import { getApiBaseUrl } from "./api";

/**
 * Cleanly format a filename with proper extension.
 */
export function sanitizeFilename(name: string, fallback = "photo", ext = ".jpg"): string {
  const clean = name.replace(/[^a-zA-Z0-9_\-.]+/g, "-").replace(/^-+|-+$/g, "");
  const base = clean || fallback;
  if (!/\.(jpg|jpeg|png|webp|avif)$/i.test(base)) {
    return `${base}${ext}`;
  }
  return base;
}

/**
 * Downloads a single photo.
 * Tries direct blob fetch first. If blocked by CORS or network, falls back to the backend download-image proxy.
 */
export async function downloadPhoto(url: string, filename: string): Promise<void> {
  const safeName = sanitizeFilename(filename, "property-photo");

  // Relative URLs on the same origin (e.g., /images/hero_apartment.jpg)
  if (url.startsWith("/")) {
    const a = document.createElement("a");
    a.href = url;
    a.download = safeName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast.success(`Downloaded ${safeName}`);
    return;
  }

  // Try direct blob fetch
  try {
    const response = await fetch(url, { mode: "cors" });
    if (response.ok) {
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = safeName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
      toast.success(`Downloaded ${safeName}`);
      return;
    }
  } catch {
    // CORS or network failure — proceed to backend proxy
  }

  // Fallback to backend download-image proxy
  try {
    const base = getApiBaseUrl();
    const proxyUrl = `${base}/admin/properties/download-image?url=${encodeURIComponent(url)}&filename=${encodeURIComponent(safeName)}`;
    const response = await fetch(proxyUrl, { credentials: "include" });
    if (!response.ok) throw new Error("Failed to download image");
    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = safeName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
    toast.success(`Downloaded ${safeName}`);
    return;
  } catch {
    // As ultimate fallback, open image in new tab
    window.open(url, "_blank");
  }
}

/**
 * Downloads all photos of a property as a single ZIP archive.
 */
export async function downloadAllPhotosZip(
  propertyId: string,
  propertyTitle = "property",
  propertyCode?: string | null
): Promise<void> {
  const toastId = toast.loading("Preparing ZIP archive of property photos...");
  try {
    const base = getApiBaseUrl();
    const code = propertyCode || propertyId.slice(0, 8);
    const slug = `${code}-${propertyTitle}`.replace(/[^a-zA-Z0-9_\-]+/g, "-").replace(/^-+|-+$/g, "");
    const filename = `${slug.slice(0, 50) || "property"}-photos.zip`;

    const zipUrl = `${base}/admin/properties/${encodeURIComponent(propertyId)}/photos/zip`;
    const response = await fetch(zipUrl, { credentials: "include" });
    if (!response.ok) {
      throw new Error(`Failed to create photos zip (${response.status})`);
    }

    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);

    toast.success("Photos ZIP downloaded successfully!", { id: toastId });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Could not download photos ZIP";
    toast.error(msg, { id: toastId });
  }
}
