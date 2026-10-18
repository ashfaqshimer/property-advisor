/**
 * Default WhatsApp outreach message template with placeholders:
 * - {name}: Poster / owner name (fallback: "there")
 * - {title}: Property title
 * - {url}: Listing link (Ikman or LPW)
 * - {area}: Suburb or location (fallback: "this area")
 */
export const DEFAULT_WHATSAPP_OUTREACH_TEMPLATE = `Hello {name},

I'm reaching out from Property Advisor (propertyadvisor.lk) regarding your property listing:
"{title}"
{url}

We currently have prospective buyers looking for properties in {area}. Would you be open to us proposing your property to them?

If so, could you please share a few photos and details with us here?

Thank you!`;

export const WHATSAPP_TEMPLATE_STORAGE_KEY = "property_advisor_whatsapp_outreach_template";

/**
 * Get the locally stored WhatsApp outreach template if present.
 */
export function getStoredWhatsAppTemplate(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(WHATSAPP_TEMPLATE_STORAGE_KEY);
  } catch {
    return null;
  }
}

/**
 * Save a custom WhatsApp outreach template to local storage.
 */
export function setStoredWhatsAppTemplate(template: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(WHATSAPP_TEMPLATE_STORAGE_KEY, template);
  } catch {
    // Ignore storage quota/permission exceptions
  }
}

/**
 * Clear the custom WhatsApp outreach template from local storage.
 */
export function clearStoredWhatsAppTemplate(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(WHATSAPP_TEMPLATE_STORAGE_KEY);
  } catch {
    // Ignore
  }
}

/**
 * Format phone number into international Sri Lankan format (e.g. 94771234567) for WhatsApp deep links.
 */
export function formatPhoneForWhatsApp(phone?: string | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (!digits) return null;
  if (digits.startsWith("0")) {
    return `94${digits.slice(1)}`;
  }
  if (!digits.startsWith("94")) {
    return `94${digits}`;
  }
  return digits;
}

export interface ProspectOutreachDetails {
  title?: string | null;
  ikman_url?: string | null;
  poster_name?: string | null;
  location?: string | null;
  suburb?: string | null;
}

/**
 * Renders any template string by replacing placeholders with prospect details.
 */
export function renderOutreachTemplate(
  template: string,
  details?: ProspectOutreachDetails | null
): string {
  const name = details?.poster_name?.trim();
  const greetingName = name || "there";
  const title = details?.title?.trim() || "your property";
  const url = details?.ikman_url?.trim() || "";
  const area = details?.suburb?.trim() || details?.location?.trim() || "this area";

  let rendered = template
    .replace(/\{name\}/g, greetingName)
    .replace(/\{title\}/g, title)
    .replace(/\{url\}/g, url)
    .replace(/\{area\}/g, area);

  // If {url} was replaced with empty string, clean up excessive line breaks
  if (!url) {
    rendered = rendered.replace(/\n\s*\n\s*\n/g, "\n\n");
  }

  return rendered.trim();
}

/**
 * Builds the outreach message for WhatsApp.
 * Uses customTemplate if provided, then locally stored template, then default template.
 */
export function buildProspectOutreachMessage(
  details?: ProspectOutreachDetails | null,
  customTemplate?: string | null
): string {
  const template =
    customTemplate?.trim() ||
    getStoredWhatsAppTemplate()?.trim() ||
    DEFAULT_WHATSAPP_OUTREACH_TEMPLATE;

  return renderOutreachTemplate(template, details);
}

/**
 * Returns the full WhatsApp Click-to-Chat deep link (https://wa.me/<number>?text=...)
 */
export function getProspectWhatsAppUrl(
  phone?: string | null,
  details?: ProspectOutreachDetails | null,
  customTemplate?: string | null
): string | null {
  const formattedPhone = formatPhoneForWhatsApp(phone);
  if (!formattedPhone) return null;

  const message = buildProspectOutreachMessage(details, customTemplate);
  return `https://wa.me/${formattedPhone}?text=${encodeURIComponent(message)}`;
}
