import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ConvertPropertyDraftModal } from "@/components/admin/ConvertPropertyDraftModal";
import * as api from "@/lib/api";

const mockContacts: api.PropertyContact[] = [
  {
    id: "contact-1",
    contact_type: "owner",
    full_name: "Kamal Perera",
    company_name: null,
    email: "kamal@example.com",
    notes: null,
    created_at: "2026-09-01T00:00:00Z",
    phones: [{ id: "phone-1", phone: "0771234567", label: "Mobile", is_whatsapp: true }],
  },
  {
    id: "contact-2",
    contact_type: "broker",
    full_name: "Sunil Brokerage",
    company_name: "Sunil Realty",
    email: "info@sunilrealty.lk",
    notes: null,
    created_at: "2026-09-02T00:00:00Z",
    phones: [{ id: "phone-2", phone: "0719876543", label: "Office", is_whatsapp: false }],
  },
];

const mockDraft = {
  title: "Modern 3 Bedroom Apartment in Colombo 03",
  price: 45000000,
  location: "Kollupitiya, Colombo 03",
  property_type: "apartment",
  listing_type: "sale",
  bedrooms: 3,
  bathrooms: 2,
  contact_name: "Kamal Perera",
  contact_phone: "0771234567",
  contact_type: "owner",
  description: "Spacious luxury unit near marine drive.",
  source_platform: "ikman.lk",
};

describe("ConvertPropertyDraftModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(api, "getCurrentUser").mockResolvedValue({
      id: "u-1",
      email: "admin@propertyadvisor.lk",
      full_name: "Admin User",
      role: "admin",
      is_active: true,
      created_at: "2026-01-01T00:00:00Z",
    });
    vi.spyOn(api, "getPropertyContacts").mockResolvedValue(mockContacts);
    vi.spyOn(api, "createProperty").mockResolvedValue({
      id: "new-prop-1",
      property_code: "PA-1050",
      title: "Modern 3 Bedroom Apartment in Colombo 03",
      description: "Spacious luxury unit near marine drive.",
      listing_type: "sale",
      price: 45000000,
      currency: "LKR",
      location: "Kollupitiya, Colombo 03",
      property_type: "apartment",
      status: "available",
      created_at: "2026-10-18T00:00:00Z",
      property_contact_id: "contact-1",
    } as any);
    vi.spyOn(api, "createPropertyContact").mockResolvedValue({
      id: "new-contact-id",
      contact_type: "owner",
      full_name: "New Owner Name",
      company_name: null,
      email: null,
      notes: null,
      created_at: "2026-10-18T00:00:00Z",
      phones: [{ id: "p-new", phone: "0775556677", label: null, is_whatsapp: true }],
    });
    vi.spyOn(api, "updateProspect").mockResolvedValue({} as any);
  });

  it("renders the draft modal and detects matching existing contact by phone", async () => {
    render(
      <ConvertPropertyDraftModal
        isOpen={true}
        draft={mockDraft}
        prospectId="prospect-123"
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />
    );

    expect(screen.getByText(/Review & Convert Listing/i)).toBeInTheDocument();
    expect(screen.getByDisplayValue(/Modern 3 Bedroom Apartment in Colombo 03/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText(/Matching contact found in directory:/i)).toBeInTheDocument();
      expect(screen.getAllByText("Kamal Perera").length).toBeGreaterThan(0);
    });
  });

  it("links matching contact to property on publish", async () => {
    const handleSuccess = vi.fn();
    render(
      <ConvertPropertyDraftModal
        isOpen={true}
        draft={mockDraft}
        prospectId="prospect-123"
        onClose={vi.fn()}
        onSuccess={handleSuccess}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/Matching contact found in directory:/i)).toBeInTheDocument();
    });

    const publishBtn = screen.getByRole("button", { name: /Approve, Save Contact & Publish/i });
    fireEvent.click(publishBtn);

    await waitFor(() => {
      expect(api.createProperty).toHaveBeenCalledWith(
        expect.objectContaining({
          property_contact_id: "contact-1",
          prospect_id: "prospect-123",
        })
      );
      expect(api.updateProspect).toHaveBeenCalledWith("prospect-123", "converted");
      expect(handleSuccess).toHaveBeenCalled();
    });
  });

  it("creates a new contact and links it when creating new contact", async () => {
    const draftWithoutMatch = {
      ...mockDraft,
      contact_name: "New Owner Name",
      contact_phone: "0775556677",
    };

    const handleSuccess = vi.fn();
    render(
      <ConvertPropertyDraftModal
        isOpen={true}
        draft={draftWithoutMatch}
        prospectId="prospect-999"
        onClose={vi.fn()}
        onSuccess={handleSuccess}
      />
    );

    await waitFor(() => {
      expect(screen.getByDisplayValue("New Owner Name")).toBeInTheDocument();
      expect(screen.getByDisplayValue("0775556677")).toBeInTheDocument();
    });

    const publishBtn = screen.getByRole("button", { name: /Approve, Save Contact & Publish/i });
    fireEvent.click(publishBtn);

    await waitFor(() => {
      expect(api.createPropertyContact).toHaveBeenCalledWith(
        expect.objectContaining({
          full_name: "New Owner Name",
          contact_type: "owner",
          phones: [{ phone: "0775556677", is_whatsapp: true }],
        })
      );
      expect(api.createProperty).toHaveBeenCalledWith(
        expect.objectContaining({
          property_contact_id: "new-contact-id",
          prospect_id: "prospect-999",
        })
      );
      expect(handleSuccess).toHaveBeenCalled();
    });
  });

  it("links an existing contact chosen from dropdown", async () => {
    const handleSuccess = vi.fn();
    render(
      <ConvertPropertyDraftModal
        isOpen={true}
        draft={mockDraft}
        prospectId="prospect-123"
        onClose={vi.fn()}
        onSuccess={handleSuccess}
      />
    );

    await waitFor(() => {
      expect(screen.getByText(/Choose Existing Contact/i)).toBeInTheDocument();
    });

    // Click Choose Existing Contact
    fireEvent.click(screen.getByText(/Choose Existing Contact/i));

    const contactSelect = screen.getByRole("combobox", { name: /select contact to link/i });
    // Select contact-2 (Sunil Brokerage)
    fireEvent.change(contactSelect, { target: { value: "contact-2" } });

    const publishBtn = screen.getByRole("button", { name: /Approve, Save Contact & Publish/i });
    fireEvent.click(publishBtn);

    await waitFor(() => {
      expect(api.createProperty).toHaveBeenCalledWith(
        expect.objectContaining({
          property_contact_id: "contact-2",
        })
      );
      expect(handleSuccess).toHaveBeenCalled();
    });
  });
});
