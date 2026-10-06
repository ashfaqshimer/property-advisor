import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import FeaturedProperties from "@/components/home/FeaturedProperties";
import * as api from "@/lib/api";

const baseRecord: api.PropertyApiRecord = {
  id: "prop-db-1",
  title: "Luxury Seaview Condo",
  description: "Stunning ocean views.",
  listing_type: "sale",
  price: 45000000,
  is_price_per_perch: false,
  is_featured: true,
  currency: "LKR",
  location: "Kollupitiya, Colombo 03",
  property_type: "apartment",
  bedrooms: 3,
  bathrooms: 2,
  land_size_perches: null,
  floor_area_sqft: 1600,
  parking_spaces: 1,
  build_year: 2022,
  road_access_ft: 30,
  furnishing_status: "furnished",
  amenities: { pool: true, gym: true },
  image_urls: ["https://example.com/condo.jpg"],
  image_alt: "Condo balcony overlooking ocean",
  status: "available",
  created_at: "2026-08-26T00:00:00Z",
  property_contact_id: null,
  property_contact: null,
};

const mockRecords: api.PropertyApiRecord[] = [
  baseRecord,
  {
    ...baseRecord,
    id: "prop-db-2",
    title: "Modern Villa with Pool",
    location: "Pelawatte, Battaramulla",
    price: 350000,
    listing_type: "rent",
    bedrooms: 4,
    bathrooms: 4,
    floor_area_sqft: 3200,
    land_size_perches: 15,
    description: "Spacious family home.",
    image_urls: [],
    image_alt: "Villa exterior",
  },
];

describe("FeaturedProperties", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("renders loading skeleton initially and populates properties from the database API", async () => {
    vi.spyOn(api, "getFeaturedProperties").mockResolvedValueOnce(mockRecords);

    render(<FeaturedProperties />);

    // Initially displays the skeleton
    expect(screen.getByTestId("featured-properties-skeleton")).toBeInTheDocument();

    // After resolving, displays the DB properties
    await waitFor(() => {
      expect(screen.getByText("Luxury Seaview Condo")).toBeInTheDocument();
    });

    expect(screen.getByText("Modern Villa with Pool")).toBeInTheDocument();
    expect(screen.getByText("LKR 45,000,000")).toBeInTheDocument();
    expect(screen.getByText("LKR 350,000 / month")).toBeInTheDocument();
    expect(screen.getByText("For Sale")).toBeInTheDocument();
    expect(screen.getByText("For Rent")).toBeInTheDocument();
  });

  it("falls back to default featured items if the database returns empty", async () => {
    vi.spyOn(api, "getFeaturedProperties").mockResolvedValueOnce([]);

    render(<FeaturedProperties />);

    await waitFor(() => {
      expect(
        screen.getByText("Modern Apartment – Colombo 03"),
      ).toBeInTheDocument();
    });
  });

  it("falls back to default featured items if the fetch fails", async () => {
    vi.spyOn(api, "getFeaturedProperties").mockRejectedValueOnce(
      new Error("Network error"),
    );

    render(<FeaturedProperties />);

    await waitFor(() => {
      expect(
        screen.getByText("Modern Apartment – Colombo 03"),
      ).toBeInTheDocument();
    });
  });

  it("prioritizes featured_image_url over image_urls[0]", async () => {
    const customImageRecord: api.PropertyApiRecord = {
      ...baseRecord,
      id: "prop-custom-img",
      title: "Penthouse with Custom Cover",
      image_urls: ["https://example.com/regular.jpg"],
      featured_image_url: "https://example.com/chosen-featured-photo.jpg",
    };
    vi.spyOn(api, "getFeaturedProperties").mockResolvedValueOnce([customImageRecord]);

    render(<FeaturedProperties />);

    await waitFor(() => {
      expect(screen.getByText("Penthouse with Custom Cover")).toBeInTheDocument();
    });

    const img = screen.getByRole("img", { name: "Condo balcony overlooking ocean" });
    expect(img).toHaveAttribute("src", "https://example.com/chosen-featured-photo.jpg");
  });
});
