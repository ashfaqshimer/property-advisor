import { afterEach, describe, expect, it, vi } from "vitest";

import { getAdminLeads, getFeaturedProperties, type PropertyApiRecord } from "@/lib/api";
import { formatPrice, mapProperty } from "@/lib/properties";

const record: PropertyApiRecord = {
  id: "property-1",
  title: "Garden Villa",
  description: "A bright villa.",
  listing_type: "sale",
  price: 185000000,
  is_price_per_perch: false,
  is_featured: true,
  currency: "LKR",
  location: "Colombo 7",
  property_type: "house",
  bedrooms: 3,
  bathrooms: null,
  land_size_perches: null,
  floor_area_sqft: null,
  parking_spaces: null,
  build_year: null,
  road_access_ft: null,
  furnishing_status: null,
  amenities: null,
  image_urls: ["https://images.unsplash.com/photo-villa"],
  image_alt: "White villa beside a pool",
  status: "available",
  created_at: "2026-08-26T00:00:00Z",
};

const jsonResponse = (status: number, body: unknown) =>
  ({ ok: status >= 200 && status < 300, status, json: async () => body }) as Response;

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("featured property API", () => {
  it("requests the featured route and validates its response", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "http://127.0.0.1:8000/");
    const fetchSpy = vi.fn(async () => jsonResponse(200, [record]));
    vi.stubGlobal("fetch", fetchSpy);

    await expect(getFeaturedProperties()).resolves.toEqual([record]);
    expect(fetchSpy).toHaveBeenCalledWith(
      "http://127.0.0.1:8000/properties/featured",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("accepts an empty successful response", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "http://127.0.0.1:8000");
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(200, [])));

    await expect(getFeaturedProperties()).resolves.toEqual([]);
  });

  it("rejects malformed responses", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "http://127.0.0.1:8000");
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse(200, [{ ...record, price: "185000000" }])));

    await expect(getFeaturedProperties()).rejects.toThrow("unrecognised body");
  });
});

describe("admin lead API", () => {
  it("requests and validates the admin lead route", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "http://127.0.0.1:8000");
    const lead = {
      id: "lead-1",
      name: "Maya",
      phone: "0712345678",
      budget_min: 10000000,
      budget_max: 50000000,
      intent: "buy",
      preferences: "Colombo apartment",
      conversation_id: "conversation-1",
      created_at: "2026-09-12T00:00:00Z",
      updated_at: "2026-09-12T00:00:00Z",
    };
    const fetchSpy = vi.fn(async () => jsonResponse(200, [lead]));
    vi.stubGlobal("fetch", fetchSpy);

    await expect(getAdminLeads()).resolves.toEqual([lead]);
    expect(fetchSpy).toHaveBeenCalledWith(
      "http://127.0.0.1:8000/admin/leads",
      expect.objectContaining({ method: "GET" }),
    );
  });
});

describe("property mapping", () => {
  it("maps wire fields and preserves missing metadata", () => {
    expect(mapProperty(record)).toEqual({
      id: "property-1",
      title: "Garden Villa",
      description: "A bright villa.",
      location: "Colombo 7",
      priceLkr: "LKR 185M",
      beds: 3,
      baths: null,
      sqft: null,
      imageUrl: "https://images.unsplash.com/photo-villa",
      imageAlt: "White villa beside a pool",
    });
  });

  it("formats non-million prices without rounding them away", () => {
    expect(formatPrice(185500000, "LKR")).toBe("LKR 185,500,000");
  });
});