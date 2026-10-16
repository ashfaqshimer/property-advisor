import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import AdminPropertiesPage from "@/app/(admin)/admin/page";
import * as api from "@/lib/api";
import * as downloadModule from "@/lib/download";

const mockProperties: api.PropertyApiRecord[] = [
  {
    id: "prop-1",
    property_code: "PA-1001",
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
    amenities: { pool: true },
    image_urls: ["https://images.unsplash.com/photo-1"],
    image_alt: "Condo balcony",
    status: "available",
    created_at: "2026-08-26T00:00:00Z",
    property_contact_id: null,
    property_contact: null,
  },
  {
    id: "prop-2",
    property_code: "PA-1002",
    title: "Modern Villa with Pool",
    description: "Spacious family home.",
    listing_type: "rent",
    price: 350000,
    is_price_per_perch: false,
    is_featured: false,
    currency: "LKR",
    location: "Pelawatte, Battaramulla",
    property_type: "house",
    bedrooms: 4,
    bathrooms: 4,
    land_size_perches: 15,
    floor_area_sqft: 3200,
    parking_spaces: 2,
    build_year: 2020,
    road_access_ft: 20,
    furnishing_status: "semi_furnished",
    amenities: {},
    image_urls: [],
    image_alt: "Villa exterior",
    status: "available",
    created_at: "2026-08-26T00:00:00Z",
    property_contact_id: null,
    property_contact: null,
  },
];

describe("AdminPropertiesPage - Property Code display", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(api, "getCurrentUser").mockResolvedValue({
      id: "u-1",
      email: "admin@propertyadvisor.lk",
      full_name: "Admin User",
      role: "admin",
      is_active: true,
      created_at: "2026-01-01T00:00:00Z",
      phone: null,
      notes: null,
      last_login_at: null,
    });
    vi.spyOn(api, "getPropertyContacts").mockResolvedValue([]);
    vi.spyOn(api, "getAdminProperties").mockResolvedValue(mockProperties);

    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });
  });

  it("renders property codes and dedicated column header", async () => {
    render(<AdminPropertiesPage />);

    await waitFor(() => {
      expect(screen.getAllByText("PA-1001").length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText("PA-1002").length).toBeGreaterThanOrEqual(1);
    });

    expect(screen.getByRole("columnheader", { name: "Code" })).toBeInTheDocument();
  });

  it("copies property code to clipboard when copy button is clicked", async () => {
    render(<AdminPropertiesPage />);

    await waitFor(() => {
      expect(screen.getAllByText("PA-1001").length).toBeGreaterThanOrEqual(1);
    });

    const copyButtons = screen.getAllByLabelText("Copy property code PA-1001");
    expect(copyButtons.length).toBeGreaterThan(0);
    fireEvent.click(copyButtons[0]);

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith("PA-1001");
  });

  it("filters properties when searching by property code", async () => {
    render(<AdminPropertiesPage />);

    await waitFor(() => {
      expect(screen.getAllByText("Luxury Seaview Condo").length).toBeGreaterThanOrEqual(1);
      expect(screen.getAllByText("Modern Villa with Pool").length).toBeGreaterThanOrEqual(1);
    });

    const searchInput = screen.getByPlaceholderText(/search by code/i);
    fireEvent.change(searchInput, { target: { value: "PA-1002" } });

    expect(screen.queryByText("Luxury Seaview Condo")).not.toBeInTheDocument();
    expect(screen.getAllByText("Modern Villa with Pool").length).toBeGreaterThanOrEqual(1);
  });

  it("shows download buttons for admin/root users and allows downloading photos", async () => {
    const downloadZipSpy = vi.spyOn(downloadModule, "downloadAllPhotosZip").mockResolvedValue();

    render(<AdminPropertiesPage />);

    await waitFor(() => {
      expect(screen.getAllByText("Luxury Seaview Condo").length).toBeGreaterThanOrEqual(1);
    });

    const photoButton = screen.getAllByLabelText("Select featured photo for Luxury Seaview Condo")[0];
    fireEvent.click(photoButton);

    const downloadZipBtn = screen.getByRole("button", { name: /Download All \(\.zip\)/i });
    expect(downloadZipBtn).toBeInTheDocument();

    fireEvent.click(downloadZipBtn);
    expect(downloadZipSpy).toHaveBeenCalledWith("prop-1", "Luxury Seaview Condo", "PA-1001");
  });

  it("hides photo download buttons for agent users", async () => {
    vi.spyOn(api, "getCurrentUser").mockResolvedValue({
      id: "u-2",
      email: "agent@propertyadvisor.lk",
      full_name: "Agent User",
      role: "agent",
      is_active: true,
      created_at: "2026-01-01T00:00:00Z",
      phone: null,
      notes: null,
      last_login_at: null,
    });

    render(<AdminPropertiesPage />);

    await waitFor(() => {
      expect(screen.getAllByText("Luxury Seaview Condo").length).toBeGreaterThanOrEqual(1);
    });

    const photoButton = screen.getAllByLabelText("Select featured photo for Luxury Seaview Condo")[0];
    fireEvent.click(photoButton);

    expect(screen.queryByRole("button", { name: /Download All \(\.zip\)/i })).not.toBeInTheDocument();
  });
});
