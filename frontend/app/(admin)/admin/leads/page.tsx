"use client";

import { useEffect, useState, type FormEvent } from "react";
import {
  createAdminLead,
  getAdminLeads,
  updateAdminLead,
  type AdminLead,
  type LeadInterest,
} from "@/lib/api";
import { Spinner } from "@/components/ui/spinner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Pencil, Plus, Save, X } from "lucide-react";

const intentVariants: Record<"buy" | "rent" | "sell", "success" | "info" | "warning"> = {
  buy: "success",
  rent: "info",
  sell: "warning",
};

const sourceLabels = {
  ai_agent: "AI agent",
  manual: "Manual",
  fallback: "Fallback",
} as const;

const interestLabels: Record<LeadInterest, string> = {
  apartment_sale: "Apartment for sale",
  apartment_rent: "Apartment to rent",
  house_sale: "House for sale",
  house_rent: "House to rent",
  land: "Land",
  selling: "Selling property",
  other: "Other",
};

function formatBudget(min: number | null, max: number | null): string {
  if (min !== null && max !== null) return `LKR ${min.toLocaleString()} - ${max.toLocaleString()}`;
  const value = max ?? min;
  return value === null ? "Not specified" : `LKR ${value.toLocaleString()}`;
}

export default function AdminLeadsPage() {
  const [leads, setLeads] = useState<AdminLead[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [budgetMin, setBudgetMin] = useState("");
  const [budgetMax, setBudgetMax] = useState("");
  const [remarks, setRemarks] = useState("");
  const [requirements, setRequirements] = useState("");
  const [interest, setInterest] = useState<LeadInterest | "">("");
  const [formError, setFormError] = useState("");
  const [editingLead, setEditingLead] = useState<AdminLead | null>(null);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editBudgetMin, setEditBudgetMin] = useState("");
  const [editBudgetMax, setEditBudgetMax] = useState("");
  const [editIntent, setEditIntent] = useState<"buy" | "rent" | "sell" | "">("");
  const [editRemarks, setEditRemarks] = useState("");
  const [editRequirements, setEditRequirements] = useState("");
  const [editInterest, setEditInterest] = useState<LeadInterest | "">("");
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    getAdminLeads()
      .then(setLeads)
      .catch((reason) => setError(reason instanceof Error ? reason.message : "Could not load leads."))
      .finally(() => setLoading(false));
  }, []);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");
    setCreating(true);
    try {
      const lead = await createAdminLead({
        name: name || undefined,
        phone,
        budget_min: budgetMin ? Number(budgetMin) : undefined,
        budget_max: budgetMax ? Number(budgetMax) : undefined,
        requirements: requirements || undefined,
        interest: interest || undefined,
        remarks: remarks || undefined,
      });
      setLeads((current) => [lead, ...current]);
      setName("");
      setPhone("");
      setBudgetMin("");
      setBudgetMax("");
      setRemarks("");
      setRequirements("");
      setInterest("");
    } catch (reason) {
      setFormError(reason instanceof Error ? reason.message : "Could not create lead.");
    } finally {
      setCreating(false);
    }
  }

  function startEditing(lead: AdminLead) {
    setEditingLead(lead);
    setEditName(lead.name ?? "");
    setEditPhone(lead.phone ?? "");
    setEditBudgetMin(lead.budget_min?.toString() ?? "");
    setEditBudgetMax(lead.budget_max?.toString() ?? "");
    setEditIntent(lead.intent ?? "");
    setEditRemarks(lead.remarks ?? "");
    setEditRequirements(lead.requirements ?? "");
    setEditInterest(lead.interest ?? "");
    setFormError("");
  }

  async function handleUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingLead) return;
    setUpdating(true);
    setFormError("");
    try {
      const updated = await updateAdminLead(editingLead.id, {
        name: editName || null,
        phone: editPhone || null,
        budget_min: editBudgetMin ? Number(editBudgetMin) : null,
        budget_max: editBudgetMax ? Number(editBudgetMax) : null,
        intent: editIntent || null,
        requirements: editRequirements || null,
        interest: editInterest || null,
        remarks: editRemarks || null,
      });
      setLeads((current) => current.map((lead) => lead.id === updated.id ? updated : lead));
      setEditingLead(null);
    } catch (reason) {
      setFormError(reason instanceof Error ? reason.message : "Could not update lead.");
    } finally {
      setUpdating(false);
    }
  }

  return (
    <section className="mx-auto max-w-[1380px]">
      <div className="mb-8">
        <p className="text-sm font-medium text-muted-foreground">Relationship management</p>
        <h2 className="mt-1 text-3xl font-semibold tracking-tight text-foreground">Leads</h2>
        <p className="mt-2 text-sm text-muted-foreground">Review people Amaya has connected with the team.</p>
      </div>

      <form onSubmit={handleCreate} className="mb-6 flex flex-col items-stretch gap-4 rounded-xl border border-border bg-card p-5 shadow-xs sm:flex-row sm:flex-wrap sm:items-end sm:gap-3">
        <label className="min-w-48 flex-1 text-sm font-medium text-foreground">
          Name
          <Input value={name} onChange={(event) => setName(event.target.value)} className="mt-1.5" />
        </label>
        <label className="min-w-48 flex-1 text-sm font-medium text-foreground">
          Phone
          <Input required value={phone} onChange={(event) => setPhone(event.target.value)} className="mt-1.5" />
        </label>
        <label className="min-w-56 flex-1 text-sm font-medium text-foreground">
          Looking for
          <Select value={interest} onChange={(event) => setInterest(event.target.value as LeadInterest | "")} className="mt-1.5">
            <option value="">Not specified</option>
            {Object.entries(interestLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </Select>
        </label>
        <label className="min-w-40 flex-1 text-sm font-medium text-foreground">
          Budget min
          <Input type="number" min="0" value={budgetMin} onChange={(event) => setBudgetMin(event.target.value)} className="mt-1.5" />
        </label>
        <label className="min-w-40 flex-1 text-sm font-medium text-foreground">
          Budget max
          <Input type="number" min="0" value={budgetMax} onChange={(event) => setBudgetMax(event.target.value)} className="mt-1.5" />
        </label>
        <label className="min-w-64 flex-[2] text-sm font-medium text-foreground">
          Requirements
          <Input value={requirements} onChange={(event) => setRequirements(event.target.value)} className="mt-1.5" />
        </label>
        <label className="min-w-64 flex-[2] text-sm font-medium text-foreground">
          Remarks
          <Input value={remarks} onChange={(event) => setRemarks(event.target.value)} className="mt-1.5" />
        </label>
        <Button type="submit" disabled={creating} className="w-full sm:w-auto gap-2">
          <Plus className="h-4 w-4" />
          {creating ? "Adding..." : "Add new lead"}
        </Button>
        {formError && <p className="basis-full text-sm text-destructive">{formError}</p>}
      </form>

      {editingLead && (
        <form onSubmit={handleUpdate} className="mb-6 flex flex-col items-stretch gap-4 rounded-xl border border-border bg-muted/30 p-5 sm:flex-row sm:flex-wrap sm:items-end sm:gap-3">
          <div className="basis-full flex items-center justify-between">
            <p className="text-sm font-semibold text-foreground">Edit lead</p>
            <Button type="button" variant="ghost" size="sm" onClick={() => setEditingLead(null)} className="gap-1.5">
              <X className="h-4 w-4" />
              Cancel
            </Button>
          </div>
          <label className="min-w-48 flex-1 text-sm font-medium text-foreground">
            Name
            <Input value={editName} onChange={(event) => setEditName(event.target.value)} className="mt-1.5 bg-background" />
          </label>
          <label className="min-w-48 flex-1 text-sm font-medium text-foreground">
            Phone
            <Input value={editPhone} onChange={(event) => setEditPhone(event.target.value)} className="mt-1.5 bg-background" />
          </label>
          <label className="min-w-36 flex-1 text-sm font-medium text-foreground">
            Budget min
            <Input type="number" min="0" value={editBudgetMin} onChange={(event) => setEditBudgetMin(event.target.value)} className="mt-1.5 bg-background" />
          </label>
          <label className="min-w-36 flex-1 text-sm font-medium text-foreground">
            Budget max
            <Input type="number" min="0" value={editBudgetMax} onChange={(event) => setEditBudgetMax(event.target.value)} className="mt-1.5 bg-background" />
          </label>
          <label className="min-w-32 flex-1 text-sm font-medium text-foreground">
            Intent
            <Select value={editIntent} onChange={(event) => setEditIntent(event.target.value as "buy" | "rent" | "sell" | "")} className="mt-1.5 bg-background">
              <option value="">Not specified</option>
              <option value="buy">Buy</option>
              <option value="rent">Rent</option>
              <option value="sell">Sell</option>
            </Select>
          </label>
          <label className="min-w-56 flex-1 text-sm font-medium text-foreground">
            Looking for
            <Select value={editInterest} onChange={(event) => setEditInterest(event.target.value as LeadInterest | "")} className="mt-1.5 bg-background">
              <option value="">Not specified</option>
              {Object.entries(interestLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </Select>
          </label>
          <label className="min-w-64 flex-[2] text-sm font-medium text-foreground">
            Requirements
            <Input value={editRequirements} onChange={(event) => setEditRequirements(event.target.value)} className="mt-1.5 bg-background" />
          </label>
          <label className="min-w-64 flex-[2] text-sm font-medium text-foreground">
            Remarks
            <Input value={editRemarks} onChange={(event) => setEditRemarks(event.target.value)} className="mt-1.5 bg-background" />
          </label>
          <Button type="submit" disabled={updating} className="w-full sm:w-auto gap-2">
            <Save className="h-4 w-4" />
            {updating ? "Saving..." : "Save changes"}
          </Button>
        </form>
      )}

      {error && <p className="mb-3 text-right text-sm text-destructive">{error}</p>}

      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <p className="text-sm font-semibold text-foreground">
            All leads <span className="ml-1 font-normal text-muted-foreground">({leads.length})</span>
          </p>
          <span className="text-xs text-muted-foreground">Live data</span>
        </div>
        {loading ? (
          <div className="flex min-h-32 items-center justify-center">
            <Spinner className="h-5 w-5 text-primary" />
          </div>
        ) : leads.length === 0 && !error ? (
          <p className="px-5 py-12 text-center text-sm text-muted-foreground">No leads have been captured yet.</p>
        ) : (
          <>
            <div className="hidden sm:block">
              <Table className="min-w-[900px]">
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead className="px-5 py-4 font-semibold">Contact</TableHead>
                    <TableHead className="px-4 py-4 font-semibold">Source</TableHead>
                    <TableHead className="px-4 py-4 font-semibold">Looking for</TableHead>
                    <TableHead className="px-4 py-4 font-semibold">Intent</TableHead>
                    <TableHead className="px-4 py-4 font-semibold">Budget</TableHead>
                    <TableHead className="px-4 py-4 font-semibold">Requirements</TableHead>
                    <TableHead className="px-4 py-4 font-semibold">Remarks</TableHead>
                    <TableHead className="px-4 py-4 font-semibold">Edited by</TableHead>
                    <TableHead className="px-5 py-4 text-right font-semibold">Captured</TableHead>
                    <TableHead className="px-5 py-4 text-right font-semibold">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-border">
                  {leads.map((lead) => (
                    <TableRow key={lead.id} className="transition hover:bg-muted/50">
                      <TableCell className="px-5 py-4">
                        <p className="font-semibold text-foreground">{lead.name ?? "Unnamed lead"}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{lead.phone ?? "No phone captured"}</p>
                      </TableCell>
                      <TableCell className="px-4 py-4 text-muted-foreground">
                        {lead.source ? (
                          <Badge variant="outline" className="font-normal">
                            {sourceLabels[lead.source]}
                          </Badge>
                        ) : (
                          "Unknown"
                        )}
                      </TableCell>
                      <TableCell className="px-4 py-4 text-muted-foreground">
                        {lead.interest ? interestLabels[lead.interest] : "Not specified"}
                      </TableCell>
                      <TableCell className="px-4 py-4">
                        {lead.intent ? (
                          <Badge variant={intentVariants[lead.intent]} className="capitalize">
                            {lead.intent}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground">Not specified</span>
                        )}
                      </TableCell>
                      <TableCell className="px-4 py-4 text-muted-foreground">{formatBudget(lead.budget_min, lead.budget_max)}</TableCell>
                      <TableCell className="max-w-sm px-4 py-4 text-muted-foreground truncate">{lead.requirements ?? "No requirements captured"}</TableCell>
                      <TableCell className="max-w-sm px-4 py-4 text-muted-foreground truncate">{lead.remarks ?? "No remarks"}</TableCell>
                      <TableCell className="px-4 py-4 text-muted-foreground">{lead.edited_by ? lead.edited_by.name : "Not edited"}</TableCell>
                      <TableCell className="px-5 py-4 text-right text-muted-foreground">{new Date(lead.created_at).toLocaleDateString()}</TableCell>
                      <TableCell className="px-5 py-4 text-right">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => startEditing(lead)}
                          className="h-8 gap-1.5 px-2.5 text-xs font-semibold text-primary hover:bg-primary/10 hover:text-primary"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                          Edit
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="flex flex-col divide-y divide-border sm:hidden">
              {leads.map((lead) => (
                <div key={lead.id} className="flex flex-col gap-3 p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <span className="font-semibold leading-tight text-foreground">{lead.name ?? "Unnamed lead"}</span>
                      <p className="mt-0.5 text-sm text-muted-foreground">{lead.phone ?? "No phone captured"}</p>
                    </div>
                    {lead.intent ? (
                      <Badge variant={intentVariants[lead.intent]} className="shrink-0 capitalize">
                        {lead.intent}
                      </Badge>
                    ) : (
                      <span className="shrink-0 text-xs text-muted-foreground">No intent</span>
                    )}
                  </div>
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span>{lead.interest ? interestLabels[lead.interest] : "Not specified"}</span>
                    <span className="font-semibold text-foreground">{formatBudget(lead.budget_min, lead.budget_max)}</span>
                  </div>
                  {(lead.requirements || lead.remarks) && (
                    <div className="text-sm text-muted-foreground">
                      {lead.requirements && <p className="line-clamp-2"><span className="font-medium text-foreground">Reqs:</span> {lead.requirements}</p>}
                      {lead.remarks && <p className="mt-1 line-clamp-2"><span className="font-medium text-foreground">Remarks:</span> {lead.remarks}</p>}
                    </div>
                  )}
                  <div className="mt-2 flex items-center justify-between border-t border-border pt-4">
                    <span className="text-xs text-muted-foreground">{new Date(lead.created_at).toLocaleDateString()} &middot; {lead.source ? sourceLabels[lead.source] : "Unknown"}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => startEditing(lead)}
                      className="h-8 gap-1.5 px-2.5 text-xs font-semibold text-primary hover:bg-primary/10 hover:text-primary"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                      Edit
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
