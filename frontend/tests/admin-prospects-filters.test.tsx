import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ProspectsPage from "@/app/(admin)/admin/prospects/page";
import * as api from "@/lib/api";

const mockRouterReplace = vi.fn();
let mockSearchParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useSearchParams: () => mockSearchParams,
  useRouter: () => ({
    push: vi.fn(),
    replace: mockRouterReplace,
    prefetch: vi.fn(),
  }),
  usePathname: () => "/admin/prospects",
}));

const mockProspects: api.Prospect[] = [
  {
    id: "p-1",
    source: "ikman",
    title: "Beautiful House for Sale",
    price: "Rs 45,000,000",
    location: "Kollupitiya",
    property_type: "house",
    listing_type: "sale",
    status: "new",
    classification: "owner",
    confidence: 90,
    classification_reasons: [],
    classification_method: "rule_based",
    first_seen_at: "2026-10-18T00:00:00Z",
    last_seen_at: "2026-10-18T00:00:00Z",
  },
];

describe("ProspectsPage URL filters synchronization", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    mockRouterReplace.mockClear();
    mockSearchParams = new URLSearchParams();

    vi.spyOn(api, "getCurrentUser").mockResolvedValue({
      id: "u-1",
      email: "admin@propertyadvisor.lk",
      name: "Admin User",
      role: "admin",
      created_at: "2026-01-01T00:00:00Z",
    });

    vi.spyOn(api, "getProspectMetrics").mockResolvedValue({
      total_active: 10,
      new_count: 5,
      shortlisted_count: 2,
      contacted_count: 3,
      converted_count: 0,
      discarded_count: 1,
      direct_owners_count: 4,
    });

    vi.spyOn(api, "getProspects").mockResolvedValue({
      items: mockProspects,
      total: 1,
      page: 1,
      page_size: 25,
      total_pages: 1,
      telegram_agent_configured: false,
      telegram_shortlist_configured: false,
    });
  });

  it("loads with default filters when no searchParams are present", async () => {
    render(<ProspectsPage />);

    await waitFor(() => {
      expect(api.getProspects).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "new",
          listing_type: "sale",
          property_type: undefined,
          classification: "owner",
        })
      );
    });
  });

  it("initializes filters from URL searchParams", async () => {
    mockSearchParams = new URLSearchParams("status=contacted&listing_type=rent&property_type=apartment&source=lpw&classification=all");
    render(<ProspectsPage />);

    await waitFor(() => {
      expect(api.getProspects).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "contacted",
          listing_type: "rent",
          property_type: "apartment",
          source: "lpw",
          classification: undefined, // "all" classification is sent as undefined to api
        })
      );
    });
  });

  it("updates URL when user clicks a different pipeline status tab", async () => {
    render(<ProspectsPage />);

    await waitFor(() => {
      expect(screen.getByText("Contacted")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Contacted"));

    expect(mockRouterReplace).toHaveBeenCalledWith(
      expect.stringContaining("status=contacted"),
      { scroll: false }
    );
  });

  it("updates URL when user switches to Rentals", async () => {
    render(<ProspectsPage />);

    await waitFor(() => {
      expect(screen.getByText("Rentals")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Rentals"));

    expect(mockRouterReplace).toHaveBeenCalledWith(
      expect.stringContaining("listing_type=rent"),
      { scroll: false }
    );
  });

  it("updates URL when user toggles Direct Owners filter off", async () => {
    render(<ProspectsPage />);

    await waitFor(() => {
      expect(screen.getByText("Direct Owners")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Direct Owners"));

    expect(mockRouterReplace).toHaveBeenCalledWith(
      expect.stringContaining("classification=all"),
      { scroll: false }
    );
  });

  it("updates URL when user changes page", async () => {
    vi.spyOn(api, "getProspects").mockResolvedValue({
      items: mockProspects,
      total: 50,
      page: 1,
      page_size: 25,
      total_pages: 2,
      telegram_agent_configured: false,
      telegram_shortlist_configured: false,
    });

    render(<ProspectsPage />);

    await waitFor(() => {
      expect(screen.getByText("Next")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Next"));

    expect(mockRouterReplace).toHaveBeenCalledWith(
      expect.stringContaining("page=2"),
      { scroll: false }
    );
  });
});
