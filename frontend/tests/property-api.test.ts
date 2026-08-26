import { afterEach, describe, expect, it, vi } from "vitest";

import { getFeaturedProperties } from "@/lib/api";
import { formatPrice, mapProperty } from "@/lib/properties";

const record = {
  id: "property-1",
  title: "Garden Villa",
  description: "A bright villa.",
  price: 185000000,
  currency: "LKR",
  location: "Colombo 7",
  property_type: "house",
  bedrooms: 3,
  bathrooms: null,
  sqft: null,
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