import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import React from "react";
import { ProspectQuickViewDrawer } from "@/components/admin/ProspectQuickViewDrawer";
import { Prospect } from "@/lib/api";

const mockProspect: Prospect = {
  id: "prospect-123",
  title: "Modern 3 Bedroom House in Thalawathugoda",
  location: "Thalawathugoda",
  suburb: "Thalawathugoda",
  suburb_source: "ikman_detail",
  price: "Rs 45,000,000",
  price_numeric: 45000000,
  price_unit_rate: 4500000,
  price_unit_label: "per perch",
  market_median_unit_rate: 5000000,
  price_diff_percent: -10.0,
  price_grade: "underpriced",
  price_grade_label: "Below Market",
  property_type: "house",
  listing_type: "sale",
  ikman_url: "https://ikman.lk/en/ad/modern-3-bedroom-house-for-sale",
  source: "ikman",
  phone_number: "0771234567",
  poster_name: "Kamal Perera",
  status: "new",
  classification: "owner",
  confidence: 0.92,
  classification_reasons: ["Owner directly mentioned", "No agency terms"],
  classification_method: "heuristic_rules",
  bedrooms: 3,
  bathrooms: 2,
  land_size_perches: 10,
  floor_area_sqft: 2200,
  latitude: 6.878,
  longitude: 79.932,
  first_seen_at: "2026-10-15T10:00:00Z",
};

describe("ProspectQuickViewDrawer", () => {
  it("renders prospect details when open", () => {
    render(
      <ProspectQuickViewDrawer
        prospect={mockProspect}
        isOpen={true}
        onClose={vi.fn()}
        onConvert={vi.fn()}
        onUpdateStatus={vi.fn()}
        onDiscard={vi.fn()}
        onFetchPhone={vi.fn()}
      />
    );

    expect(screen.getByText("Modern 3 Bedroom House in Thalawathugoda")).toBeInTheDocument();
    expect(screen.getByText("Rs 45,000,000")).toBeInTheDocument();
    expect(screen.getByText("Kamal Perera")).toBeInTheDocument();
    expect(screen.getByText("0771234567")).toBeInTheDocument();
    expect(screen.getByText(/Direct Owner \(92%\)/)).toBeInTheDocument();
  });

  it("calls onConvert when Convert to Listing button is clicked", () => {
    const handleConvert = vi.fn();
    render(
      <ProspectQuickViewDrawer
        prospect={mockProspect}
        isOpen={true}
        onClose={vi.fn()}
        onConvert={handleConvert}
        onUpdateStatus={vi.fn()}
        onDiscard={vi.fn()}
        onFetchPhone={vi.fn()}
      />
    );

    const convertButtons = screen.getAllByRole("button", { name: /convert to listing/i });
    expect(convertButtons.length).toBeGreaterThan(0);
    fireEvent.click(convertButtons[0]);
    expect(handleConvert).toHaveBeenCalledWith(mockProspect);
  });

  it("calls onDiscard when Discard button is clicked", () => {
    const handleDiscard = vi.fn();
    render(
      <ProspectQuickViewDrawer
        prospect={mockProspect}
        isOpen={true}
        onClose={vi.fn()}
        onConvert={vi.fn()}
        onUpdateStatus={vi.fn()}
        onDiscard={handleDiscard}
        onFetchPhone={vi.fn()}
      />
    );

    const discardBtn = screen.getByRole("button", { name: /discard/i });
    fireEvent.click(discardBtn);
    expect(handleDiscard).toHaveBeenCalledWith(mockProspect);
  });

  it("calls onShortlistOnTelegram when Shortlist on TG button is clicked", () => {
    const handleShortlist = vi.fn();
    render(
      <ProspectQuickViewDrawer
        prospect={mockProspect}
        isOpen={true}
        onClose={vi.fn()}
        onConvert={vi.fn()}
        onUpdateStatus={vi.fn()}
        onDiscard={vi.fn()}
        onFetchPhone={vi.fn()}
        onShortlistOnTelegram={handleShortlist}
        telegramShortlistConfigured={true}
      />
    );

    const shortlistButtons = screen.getAllByRole("button", { name: /shortlist on telegram|shortlist on tg/i });
    expect(shortlistButtons.length).toBeGreaterThan(0);
    fireEvent.click(shortlistButtons[0]);
    expect(handleShortlist).toHaveBeenCalledWith("prospect-123");
  });

  it("renders Shortlisted badge when prospect status is shortlisted", () => {
    render(
      <ProspectQuickViewDrawer
        prospect={{ ...mockProspect, status: "shortlisted" }}
        isOpen={true}
        onClose={vi.fn()}
        onConvert={vi.fn()}
        onUpdateStatus={vi.fn()}
        onDiscard={vi.fn()}
        onFetchPhone={vi.fn()}
      />
    );

    expect(screen.getByText("Shortlisted")).toBeInTheDocument();
  });

  it("opens WhatsApp link when WhatsApp button is clicked", () => {
    const windowOpenSpy = vi.spyOn(window, "open").mockImplementation(() => null);
    render(
      <ProspectQuickViewDrawer
        prospect={mockProspect}
        isOpen={true}
        onClose={vi.fn()}
        onConvert={vi.fn()}
        onUpdateStatus={vi.fn()}
        onDiscard={vi.fn()}
        onFetchPhone={vi.fn()}
      />
    );

    const waButtons = screen.getAllByRole("button", { name: /whatsapp/i });
    expect(waButtons.length).toBeGreaterThan(0);
    fireEvent.click(waButtons[0]);
    expect(windowOpenSpy).toHaveBeenCalledWith(expect.stringContaining("wa.me/94771234567"), "_blank");
    windowOpenSpy.mockRestore();
  });
});
