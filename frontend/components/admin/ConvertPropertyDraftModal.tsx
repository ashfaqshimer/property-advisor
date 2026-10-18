"use client";

import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  X,
  Sparkles,
  UserCheck,
  UserPlus,
  Link2,
  Building2,
  Phone,
  User,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
} from "lucide-react";
import {
  createProperty,
  createPropertyContact,
  getPropertyContacts,
  getCurrentUser,
  updateProspect,
  type PropertyContact,
} from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";

export interface ConvertPropertyDraftModalProps {
  isOpen: boolean;
  draft: any;
  prospectId: string | null;
  onClose: () => void;
  onSuccess: () => void;
}

export function ConvertPropertyDraftModal({
  isOpen,
  draft,
  prospectId,
  onClose,
  onSuccess,
}: ConvertPropertyDraftModalProps) {
  const [contacts, setContacts] = useState<PropertyContact[]>([]);
  const [isAgent, setIsAgent] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);

  // Property form state
  const [formData, setFormData] = useState<any>(null);

  // Contact linking state
  type ContactMode = "matched" | "existing" | "new" | "none";
  const [contactMode, setContactMode] = useState<ContactMode>("new");
  const [matchedContact, setMatchedContact] = useState<PropertyContact | null>(null);
  const [selectedExistingId, setSelectedExistingId] = useState<string>("");
  const [newContactName, setNewContactName] = useState("");
  const [newContactPhone, setNewContactPhone] = useState("");
  const [newContactType, setNewContactType] = useState<"owner" | "broker">("owner");
  const [newContactCompany, setNewContactCompany] = useState("");
  const [saveAndLinkContact, setSaveAndLinkContact] = useState(true);

  // Load contacts and user role on mount or when modal opens
  useEffect(() => {
    if (!isOpen) return;

    getCurrentUser()
      .then((user) => setIsAgent(user?.role === "agent"))
      .catch(() => {});

    getPropertyContacts()
      .then((loadedContacts) => {
        setContacts(loadedContacts);
        if (draft) {
          matchAndInitContact(draft, loadedContacts);
        }
      })
      .catch(() => {});
  }, [isOpen, draft]);

  useEffect(() => {
    if (draft && isOpen) {
      setFormData({ ...draft });
      if (contacts.length > 0) {
        matchAndInitContact(draft, contacts);
      } else {
        // Default init before contacts load
        initNewContactFields(draft);
      }
    }
  }, [draft, isOpen]);

  const cleanDigits = (p?: string | null) => (p || "").replace(/\D/g, "");

  function initNewContactFields(currentDraft: any) {
    const rawName = currentDraft.contact_name?.trim() || "";
    const rawPhone = currentDraft.contact_phone?.trim() || "";
    const cType = currentDraft.contact_type === "broker" ? "broker" : "owner";

    setNewContactName(rawName || (rawPhone ? (cType === "broker" ? "Broker" : "Owner") : ""));
    setNewContactPhone(rawPhone);
    setNewContactType(cType);
    setNewContactCompany("");
    setSaveAndLinkContact(Boolean(rawPhone || rawName));
    setContactMode(rawPhone || rawName ? "new" : "none");
  }

  function matchAndInitContact(currentDraft: any, loadedContacts: PropertyContact[]) {
    const draftPhone = cleanDigits(currentDraft.contact_phone);
    const draftName = (currentDraft.contact_name || "").trim().toLowerCase();

    let foundMatch: PropertyContact | null = null;

    if (draftPhone && draftPhone.length >= 7) {
      foundMatch =
        loadedContacts.find((c) =>
          c.phones?.some((p) => {
            const pDigits = cleanDigits(p.phone);
            if (!pDigits || pDigits.length < 7) return false;
            return (
              pDigits.endsWith(draftPhone.slice(-9)) ||
              draftPhone.endsWith(pDigits.slice(-9))
            );
          }),
        ) || null;
    }

    if (!foundMatch && draftName && draftName.length >= 3) {
      foundMatch =
        loadedContacts.find(
          (c) => c.full_name.trim().toLowerCase() === draftName,
        ) || null;
    }

    if (foundMatch) {
      setMatchedContact(foundMatch);
      setSelectedExistingId(foundMatch.id);
      setContactMode("matched");
      setSaveAndLinkContact(true);
      setNewContactName(foundMatch.full_name);
      setNewContactPhone(foundMatch.phones?.[0]?.phone || currentDraft.contact_phone || "");
      setNewContactType(foundMatch.contact_type === "broker" ? "broker" : "owner");
    } else {
      setMatchedContact(null);
      initNewContactFields(currentDraft);
    }
  }

  if (!isOpen || !formData) return null;

  const handlePublish = async () => {
    setIsPublishing(true);
    try {
      let contactId: string | null = null;
      let linkedContactName = "";

      if (saveAndLinkContact) {
        if (contactMode === "matched" && matchedContact) {
          contactId = matchedContact.id;
          linkedContactName = matchedContact.full_name;
        } else if (contactMode === "existing" && selectedExistingId) {
          contactId = selectedExistingId;
          const found = contacts.find((c) => c.id === selectedExistingId);
          linkedContactName = found ? found.full_name : "";
        } else if (contactMode === "new") {
          const phoneToSave = newContactPhone.trim();
          const nameToSave =
            newContactName.trim() ||
            (phoneToSave
              ? `${newContactType === "broker" ? "Broker" : "Owner"} (${phoneToSave})`
              : "Owner");

          if (nameToSave) {
            try {
              const created = await createPropertyContact({
                full_name: nameToSave,
                contact_type: newContactType,
                company_name: newContactCompany.trim() || null,
                phones: phoneToSave ? [{ phone: phoneToSave, is_whatsapp: true }] : [],
                notes: `Auto-saved during listing conversion${
                  formData.source_platform ? ` from ${formData.source_platform}` : ""
                }.`,
              });
              contactId = created.id;
              linkedContactName = created.full_name;
            } catch (contactErr: any) {
              console.error("Failed to create property contact", contactErr);
              toast.error(
                contactErr.message ||
                  "Could not save contact, continuing with property creation...",
              );
            }
          }
        }
      }

      await createProperty({
        ...formData,
        price: formData.price ? Number(formData.price) : 0,
        bedrooms: formData.bedrooms ? Number(formData.bedrooms) : null,
        bathrooms: formData.bathrooms ? Number(formData.bathrooms) : null,
        land_size_perches: formData.land_size_perches
          ? Number(formData.land_size_perches)
          : null,
        floor_area_sqft: formData.floor_area_sqft
          ? Number(formData.floor_area_sqft)
          : null,
        parking_spaces: formData.parking_spaces
          ? Number(formData.parking_spaces)
          : null,
        build_year: formData.build_year ? Number(formData.build_year) : null,
        status: "available",
        image_urls: [],
        image_alt: formData.image_alt || formData.title || "Property",
        property_contact_id: contactId,
        prospect_id: prospectId || formData.prospect_id || undefined,
        source_platform: formData.source_platform || undefined,
        source_url: formData.source_url || undefined,
        source_id: formData.source_id || undefined,
      });

      if (prospectId) {
        await updateProspect(prospectId, "converted");
      }

      if (contactId && linkedContactName) {
        toast.success(
          `Property published and linked to contact "${linkedContactName}"!`,
        );
      } else {
        toast.success("Property published successfully!");
      }

      onSuccess();
    } catch (err: any) {
      toast.error(err.message || "Failed to publish property");
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-2 sm:p-4 backdrop-blur-xs overflow-y-auto"
    >
      <div className="w-full max-w-2xl rounded-2xl border border-border bg-card p-4 sm:p-6 shadow-2xl my-auto max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border pb-3 mb-4">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Sparkles className="h-4 w-4" />
            </span>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-foreground">
                Review &amp; Convert Listing
              </h2>
              <p className="text-xs text-muted-foreground">
                Verify specs, save the contact, and link it directly to the new property.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isPublishing}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition cursor-pointer"
            aria-label="Close draft modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto space-y-5 pr-1 text-sm text-foreground">
          {/* Contact Section */}
          <div className="rounded-xl border border-border bg-muted/20 p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UserCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                <span className="text-xs font-bold uppercase tracking-wider text-foreground">
                  Contact &amp; Ownership
                </span>
              </div>
              <label className="flex items-center gap-2 cursor-pointer text-xs">
                <input
                  type="checkbox"
                  checked={saveAndLinkContact}
                  onChange={(e) => setSaveAndLinkContact(e.target.checked)}
                  className="rounded border-border text-primary focus:ring-primary h-3.5 w-3.5"
                />
                <span className="font-medium text-foreground">Link contact to property</span>
              </label>
            </div>

            {saveAndLinkContact && (
              <div className="space-y-3">
                {/* Matched contact alert */}
                {matchedContact && (
                  <div className="rounded-lg border border-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-950/30 p-2.5 text-xs">
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <div className="font-semibold text-emerald-900 dark:text-emerald-200">
                          Matching contact found in directory:
                        </div>
                        <div className="mt-0.5 text-foreground">
                          <strong>{matchedContact.full_name}</strong>{" "}
                          <span className="capitalize text-muted-foreground">
                            ({matchedContact.contact_type})
                          </span>
                          {matchedContact.company_name && (
                            <span className="text-muted-foreground">
                              {" "}
                              • {matchedContact.company_name}
                            </span>
                          )}
                          {matchedContact.phones?.length > 0 && (
                            <span className="font-mono ml-1 text-muted-foreground">
                              [{matchedContact.phones.map((p) => p.phone).join(", ")}]
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Contact Mode Selector */}
                <div className="flex flex-wrap gap-1.5 text-xs">
                  {matchedContact && (
                    <button
                      type="button"
                      onClick={() => setContactMode("matched")}
                      className={`px-2.5 py-1 rounded-md font-medium transition cursor-pointer ${
                        contactMode === "matched"
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      Use Matched Contact
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setContactMode("new")}
                    className={`px-2.5 py-1 rounded-md font-medium transition cursor-pointer ${
                      contactMode === "new"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    + Create New Contact
                  </button>
                  <button
                    type="button"
                    onClick={() => setContactMode("existing")}
                    className={`px-2.5 py-1 rounded-md font-medium transition cursor-pointer ${
                      contactMode === "existing"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Choose Existing Contact ({contacts.length})
                  </button>
                </div>

                {/* Form for New Contact */}
                {contactMode === "new" && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-1">
                        Contact Name *
                      </label>
                      <input
                        className="w-full rounded-lg border border-input bg-background p-2 text-xs outline-none focus:border-primary text-foreground"
                        value={newContactName}
                        onChange={(e) => setNewContactName(e.target.value)}
                        placeholder="e.g. Nimal Silva"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-1">
                        Phone Number
                      </label>
                      <input
                        className="w-full rounded-lg border border-input bg-background p-2 text-xs outline-none focus:border-primary text-foreground font-mono"
                        value={newContactPhone}
                        onChange={(e) => setNewContactPhone(e.target.value)}
                        placeholder="e.g. 0771234567"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-1">
                        Type
                      </label>
                      <Select
                        className="w-full text-xs h-8.5"
                        value={newContactType}
                        onChange={(e) =>
                          setNewContactType(e.target.value as "owner" | "broker")
                        }
                      >
                        {!isAgent && <option value="owner">Owner</option>}
                        <option value="broker">Broker</option>
                      </Select>
                    </div>
                  </div>
                )}

                {/* Dropdown for Existing Contact */}
                {contactMode === "existing" && (
                  <div className="pt-1">
                    <label className="block text-xs font-medium text-muted-foreground mb-1">
                      Select Contact to Link
                    </label>
                    <Select
                      aria-label="Select Contact to Link"
                      className="w-full text-xs"
                      value={selectedExistingId}
                      onChange={(e) => setSelectedExistingId(e.target.value)}
                    >
                      <option value="">— Select a contact —</option>
                      {contacts.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.full_name} ({c.contact_type})
                          {c.company_name ? ` - ${c.company_name}` : ""}
                          {c.phones?.[0] ? ` [${c.phones[0].phone}]` : ""}
                        </option>
                      ))}
                    </Select>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Basic Property Specs */}
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Property Title *
              </label>
              <input
                className="w-full rounded-lg border border-input bg-background p-2 text-sm outline-none focus:border-primary text-foreground font-medium"
                value={formData.title || ""}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Price (Numeric LKR)
                </label>
                <input
                  type="number"
                  className="w-full rounded-lg border border-input bg-background p-2 text-sm outline-none focus:border-primary text-foreground"
                  value={formData.price ?? ""}
                  onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                  placeholder="e.g. 45000000"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Location *
                </label>
                <input
                  className="w-full rounded-lg border border-input bg-background p-2 text-sm outline-none focus:border-primary text-foreground"
                  value={formData.location || ""}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  placeholder="e.g. Colombo 03, Western"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Property Type
                </label>
                <Select
                  className="w-full text-xs"
                  value={formData.property_type || "house"}
                  onChange={(e) =>
                    setFormData({ ...formData, property_type: e.target.value })
                  }
                >
                  <option value="house">House</option>
                  <option value="apartment">Apartment</option>
                  <option value="land">Land</option>
                  <option value="commercial">Commercial</option>
                  <option value="mixed_use">Mixed Use</option>
                </Select>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Listing Type
                </label>
                <Select
                  className="w-full text-xs"
                  value={formData.listing_type || "sale"}
                  onChange={(e) =>
                    setFormData({ ...formData, listing_type: e.target.value })
                  }
                >
                  <option value="sale">For Sale</option>
                  <option value="rent">For Rent</option>
                </Select>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Bedrooms
                </label>
                <input
                  type="number"
                  className="w-full rounded-lg border border-input bg-background p-2 text-xs outline-none focus:border-primary text-foreground"
                  value={formData.bedrooms ?? ""}
                  onChange={(e) => setFormData({ ...formData, bedrooms: e.target.value })}
                  placeholder="e.g. 3"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Bathrooms
                </label>
                <input
                  type="number"
                  className="w-full rounded-lg border border-input bg-background p-2 text-xs outline-none focus:border-primary text-foreground"
                  value={formData.bathrooms ?? ""}
                  onChange={(e) => setFormData({ ...formData, bathrooms: e.target.value })}
                  placeholder="e.g. 2"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Land Size (Perches)
                </label>
                <input
                  type="number"
                  className="w-full rounded-lg border border-input bg-background p-2 text-xs outline-none focus:border-primary text-foreground"
                  value={formData.land_size_perches ?? ""}
                  onChange={(e) =>
                    setFormData({ ...formData, land_size_perches: e.target.value })
                  }
                  placeholder="e.g. 10.5"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Parking Spaces
                </label>
                <input
                  type="number"
                  className="w-full rounded-lg border border-input bg-background p-2 text-xs outline-none focus:border-primary text-foreground"
                  value={formData.parking_spaces ?? ""}
                  onChange={(e) =>
                    setFormData({ ...formData, parking_spaces: e.target.value })
                  }
                  placeholder="e.g. 2"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Build Year
                </label>
                <input
                  type="number"
                  className="w-full rounded-lg border border-input bg-background p-2 text-xs outline-none focus:border-primary text-foreground"
                  value={formData.build_year ?? ""}
                  onChange={(e) =>
                    setFormData({ ...formData, build_year: e.target.value })
                  }
                  placeholder="e.g. 2021"
                />
              </div>
            </div>

            {/* Feature Toggles */}
            <div className="flex flex-wrap gap-4 py-1 border-y border-border text-xs">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.has_maids_room || false}
                  onChange={(e) =>
                    setFormData({ ...formData, has_maids_room: e.target.checked })
                  }
                  className="rounded border-border text-primary focus:ring-primary h-3.5 w-3.5"
                />
                <span className="font-medium text-foreground">Maid's Room</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.has_maids_toilet || false}
                  onChange={(e) =>
                    setFormData({ ...formData, has_maids_toilet: e.target.checked })
                  }
                  className="rounded border-border text-primary focus:ring-primary h-3.5 w-3.5"
                />
                <span className="font-medium text-foreground">Maid's Toilet</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.is_gated_community || false}
                  onChange={(e) =>
                    setFormData({ ...formData, is_gated_community: e.target.checked })
                  }
                  className="rounded border-border text-primary focus:ring-primary h-3.5 w-3.5"
                />
                <span className="font-medium text-foreground">Gated Community</span>
              </label>
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">
                Description
              </label>
              <textarea
                className="h-24 sm:h-28 w-full rounded-lg border border-input bg-background p-2 text-xs outline-none focus:border-primary text-foreground"
                value={formData.description || ""}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
              />
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="mt-4 pt-3 border-t border-border flex flex-col-reverse sm:flex-row items-center justify-end gap-2.5">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isPublishing}
            className="w-full sm:w-auto h-9 text-xs"
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handlePublish}
            disabled={isPublishing}
            className="w-full sm:w-auto h-9 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold gap-1.5"
          >
            {isPublishing ? (
              <>
                <Spinner className="h-3.5 w-3.5" />
                <span>Publishing &amp; Linking...</span>
              </>
            ) : (
              <>
                <Sparkles className="h-3.5 w-3.5" />
                <span>
                  {saveAndLinkContact
                    ? "Approve, Save Contact & Publish"
                    : "Approve & Publish"}
                </span>
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
