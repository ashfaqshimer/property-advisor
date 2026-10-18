import { describe, it, expect, beforeEach } from "vitest";
import {
  formatPhoneForWhatsApp,
  buildProspectOutreachMessage,
  getProspectWhatsAppUrl,
  renderOutreachTemplate,
  getStoredWhatsAppTemplate,
  setStoredWhatsAppTemplate,
  clearStoredWhatsAppTemplate,
  DEFAULT_WHATSAPP_OUTREACH_TEMPLATE,
} from "@/lib/whatsapp";

describe("whatsapp utils", () => {
  beforeEach(() => {
    clearStoredWhatsAppTemplate();
  });

  describe("formatPhoneForWhatsApp", () => {
    it("formats local 10-digit Sri Lankan phone number starting with 0", () => {
      expect(formatPhoneForWhatsApp("0771234567")).toBe("94771234567");
    });

    it("formats phone number with spaces, dashes, and + prefix", () => {
      expect(formatPhoneForWhatsApp("+94 77-123-4567")).toBe("94771234567");
    });

    it("preserves number already starting with 94", () => {
      expect(formatPhoneForWhatsApp("94771234567")).toBe("94771234567");
    });

    it("prepends 94 to 9-digit numbers missing country code", () => {
      expect(formatPhoneForWhatsApp("771234567")).toBe("94771234567");
    });

    it("returns null for empty or null input", () => {
      expect(formatPhoneForWhatsApp(null)).toBeNull();
      expect(formatPhoneForWhatsApp("")).toBeNull();
      expect(formatPhoneForWhatsApp("   ")).toBeNull();
    });
  });

  describe("buildProspectOutreachMessage", () => {
    it("builds polite outreach message with prospect details", () => {
      const msg = buildProspectOutreachMessage({
        poster_name: "Kamal Perera",
        title: "Modern 3 Bedroom House in Thalawathugoda",
        ikman_url: "https://ikman.lk/en/ad/modern-3-bedroom-house-for-sale",
        suburb: "Thalawathugoda",
      });

      expect(msg).toContain("Hello Kamal Perera,");
      expect(msg).toContain("Property Advisor (propertyadvisor.lk)");
      expect(msg).toContain('"Modern 3 Bedroom House in Thalawathugoda"');
      expect(msg).toContain("https://ikman.lk/en/ad/modern-3-bedroom-house-for-sale");
      expect(msg).toContain("We currently have prospective buyers looking for properties in Thalawathugoda");
      expect(msg).toContain("Would you be open to us proposing your property to them?");
      expect(msg).toContain("could you please share a few photos and details with us here?");
    });

    it("falls back gracefully when name or suburb is missing", () => {
      const msg = buildProspectOutreachMessage({
        title: "Land for Sale in Kaduwela",
        ikman_url: "https://www.lankapropertyweb.com/land/123",
      });

      expect(msg).toContain("Hello there,");
      expect(msg).toContain("looking for properties in this area");
      expect(msg).toContain("https://www.lankapropertyweb.com/land/123");
    });

    it("supports custom template overriding default", () => {
      const customTemplate = "Ayubowan {name}! Is your property '{title}' in {area} still available? Link: {url}";
      const msg = buildProspectOutreachMessage(
        {
          poster_name: "Sunil",
          title: "Luxury Villa",
          suburb: "Battaramulla",
          ikman_url: "https://ikman.lk/ad/villa",
        },
        customTemplate
      );

      expect(msg).toBe("Ayubowan Sunil! Is your property 'Luxury Villa' in Battaramulla still available? Link: https://ikman.lk/ad/villa");
    });

    it("reads custom template from localStorage if set", () => {
      setStoredWhatsAppTemplate("Hi {name}, checking {title} at {url}");
      const msg = buildProspectOutreachMessage({
        poster_name: "Ruwan",
        title: "Land",
        ikman_url: "https://ikman.lk/ad/2",
      });

      expect(msg).toBe("Hi Ruwan, checking Land at https://ikman.lk/ad/2");
    });
  });

  describe("renderOutreachTemplate", () => {
    it("correctly replaces all placeholders", () => {
      const rendered = renderOutreachTemplate("Owner: {name}, Ad: {title}, Location: {area}, Link: {url}", {
        poster_name: "Nimal",
        title: "2-Story House",
        location: "Rajagiriya",
        ikman_url: "https://ikman.lk/ad/house",
      });

      expect(rendered).toBe("Owner: Nimal, Ad: 2-Story House, Location: Rajagiriya, Link: https://ikman.lk/ad/house");
    });
  });

  describe("getProspectWhatsAppUrl", () => {
    it("generates wa.me deep link with encoded message", () => {
      const url = getProspectWhatsAppUrl("0771234567", {
        poster_name: "Kamal",
        title: "House for Sale",
        ikman_url: "https://ikman.lk/ad/1",
        suburb: "Nugegoda",
      });

      expect(url).not.toBeNull();
      expect(url).toContain("https://wa.me/94771234567?text=");
      const decodedText = decodeURIComponent(url!.split("?text=")[1]);
      expect(decodedText).toContain("Hello Kamal,");
      expect(decodedText).toContain("https://ikman.lk/ad/1");
      expect(decodedText).toContain("prospective buyers looking for properties in Nugegoda");
    });

    it("returns null if phone is empty or invalid", () => {
      expect(getProspectWhatsAppUrl(null)).toBeNull();
    });
  });
});
