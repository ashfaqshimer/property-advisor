"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";
import {
  createAdminLead,
  deleteAdminLead,
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
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Bot,
  Building,
  Eye,
  MessageCircle,
  Pencil,
  Phone,
  Plus,
  Search,
  Sparkles,
  Trash2,
  Users,
} from "lucide-react";

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

function getWhatsAppUrl(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/[^0-9]/g, "");
  if (!digits) return null;
  const formatted = digits.startsWith("0") ? `94${digits.slice(1)}` : digits;
  return `https://wa.me/${formatted}`;
}

export default function AdminLeadsPage() {
  const [leads, setLeads] = useState<AdminLead[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  // Filters & search
  const [searchQuery, setSearchQuery] = useState("");
  const [filterIntent, setFilterIntent] = useState<string>("all");
  const [filterSource, setFilterSource] = useState<string>("all");
  const [filterInterest, setFilterInterest] = useState<string>("all");

  // Create lead state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [intent, setIntent] = useState<"buy" | "rent" | "sell" | "">("");
  const [interest, setInterest] = useState<LeadInterest | "">("");
  const [budgetMin, setBudgetMin] = useState("");
  const [budgetMax, setBudgetMax] = useState("");
  const [requirements, setRequirements] = useState("");
  const [remarks, setRemarks] = useState("");
  const [formError, setFormError] = useState("");

  // Edit lead state
  const [editingLead, setEditingLead] = useState<AdminLead | null>(null);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editIntent, setEditIntent] = useState<"buy" | "rent" | "sell" | "">("");
  const [editInterest, setEditInterest] = useState<LeadInterest | "">("");
  const [editBudgetMin, setEditBudgetMin] = useState("");
  const [editBudgetMax, setEditBudgetMax] = useState("");
  const [editRequirements, setEditRequirements] = useState("");
  const [editRemarks, setEditRemarks] = useState("");
  const [updating, setUpdating] = useState(false);
  const [editError, setEditError] = useState("");

  // View detail lead state
  const [viewingLead, setViewingLead] = useState<AdminLead | null>(null);

  // Delete lead state
  const [deletingLead, setDeletingLead] = useState<AdminLead | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  useEffect(() => {
    getAdminLeads()
      .then(setLeads)
      .catch((reason) => setError(reason instanceof Error ? reason.message : "Could not load leads."))
      .finally(() => setLoading(false));
  }, []);

  // Summary Metrics
  const stats = useMemo(() => {
    const total = leads.length;
    const buyers = leads.filter((l) => l.intent === "buy").length;
    const renters = leads.filter((l) => l.intent === "rent").length;
    const aiCaptured = leads.filter((l) => l.source === "ai_agent").length;
    return {
      total,
      buyers,
      renters,
      aiCaptured,
      aiPercent: total > 0 ? Math.round((aiCaptured / total) * 100) : 0,
    };
  }, [leads]);

  // Filtered Leads
  const filteredLeads = useMemo(() => {
    return leads.filter((lead) => {
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesName = lead.name?.toLowerCase().includes(query) ?? false;
        const matchesPhone = lead.phone?.toLowerCase().includes(query) ?? false;
        const matchesReqs = lead.requirements?.toLowerCase().includes(query) ?? false;
        const matchesRemarks = lead.remarks?.toLowerCase().includes(query) ?? false;
        if (!matchesName && !matchesPhone && !matchesReqs && !matchesRemarks) {
          return false;
        }
      }
      if (filterIntent !== "all" && lead.intent !== filterIntent) {
        return false;
      }
      if (filterSource !== "all" && lead.source !== filterSource) {
        return false;
      }
      if (filterInterest !== "all" && lead.interest !== filterInterest) {
        return false;
      }
      return true;
    });
  }, [leads, searchQuery, filterIntent, filterSource, filterInterest]);

  const isFiltered = searchQuery !== "" || filterIntent !== "all" || filterSource !== "all" || filterInterest !== "all";

  function resetFilters() {
    setSearchQuery("");
    setFilterIntent("all");
    setFilterSource("all");
    setFilterInterest("all");
  }

  function resetCreateForm() {
    setName("");
    setPhone("");
    setIntent("");
    setInterest("");
    setBudgetMin("");
    setBudgetMax("");
    setRequirements("");
    setRemarks("");
    setFormError("");
  }

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");
    setCreating(true);
    try {
      const lead = await createAdminLead({
        name: name || undefined,
        phone,
        intent: intent || undefined,
        budget_min: budgetMin ? Number(budgetMin) : undefined,
        budget_max: budgetMax ? Number(budgetMax) : undefined,
        requirements: requirements || undefined,
        interest: interest || undefined,
        remarks: remarks || undefined,
      });
      setLeads((current) => [lead, ...current]);
      resetCreateForm();
      setIsCreateOpen(false);
      toast.success("Lead created successfully.");
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
    setEditError("");
  }

  async function handleUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingLead) return;
    setUpdating(true);
    setEditError("");
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
      setLeads((current) => current.map((lead) => (lead.id === updated.id ? updated : lead)));
      if (viewingLead?.id === updated.id) {
        setViewingLead(updated);
      }
      setEditingLead(null);
      toast.success("Lead updated successfully.");
    } catch (reason) {
      setEditError(reason instanceof Error ? reason.message : "Could not update lead.");
    } finally {
      setUpdating(false);
    }
  }

  async function handleDelete() {
    if (!deletingLead) return;
    setDeleting(true);
    setDeleteError("");
    try {
      await deleteAdminLead(deletingLead.id);
      setLeads((current) => current.filter((lead) => lead.id !== deletingLead.id));
      if (editingLead?.id === deletingLead.id) {
        setEditingLead(null);
      }
      if (viewingLead?.id === deletingLead.id) {
        setViewingLead(null);
      }
      setDeletingLead(null);
      toast.success("Lead deleted.");
    } catch (reason) {
      setDeleteError(reason instanceof Error ? reason.message : "Could not delete lead.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <section className="mx-auto max-w-[1380px]">
      {/* Top Header */}
      <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <p className="text-sm font-medium text-muted-foreground">Relationship management</p>
          <h2 className="mt-1 text-3xl font-semibold tracking-tight text-foreground">Leads</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Review client inquiries captured by Amaya or entered manually.
          </p>
        </div>
        <Button
          type="button"
          onClick={() => {
            resetCreateForm();
            setIsCreateOpen(true);
          }}
          className="gap-2 shadow-xs shrink-0"
        >
          <Plus className="h-4 w-4" />
          Add lead
        </Button>
      </div>

      {/* KPI Overview Cards */}
      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <div className="rounded-xl border border-border bg-card p-4 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs sm:text-sm font-medium text-muted-foreground">Total Leads</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Users className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">{stats.total}</span>
            <span className="text-xs text-muted-foreground">inquiries</span>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs sm:text-sm font-medium text-muted-foreground">Buyers</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Sparkles className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">{stats.buyers}</span>
            <span className="text-xs text-muted-foreground">
              {stats.total > 0 ? Math.round((stats.buyers / stats.total) * 100) : 0}% of leads
            </span>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs sm:text-sm font-medium text-muted-foreground">Renters</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <Building className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">{stats.renters}</span>
            <span className="text-xs text-muted-foreground">
              {stats.total > 0 ? Math.round((stats.renters / stats.total) * 100) : 0}% of leads
            </span>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-4 sm:p-5 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs sm:text-sm font-medium text-muted-foreground">AI Captured</span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500/10 text-violet-600 dark:text-violet-400">
              <Bot className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">{stats.aiCaptured}</span>
            <span className="text-xs text-muted-foreground">{stats.aiPercent}% via Amaya</span>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="mb-4 flex flex-col gap-3 rounded-xl border border-border bg-card p-3.5 shadow-xs sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, phone, notes..."
            className="pl-9 h-9 text-sm bg-background"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={filterIntent}
            onChange={(e) => setFilterIntent(e.target.value)}
            className="h-9 w-auto text-xs bg-background"
          >
            <option value="all">All Intents</option>
            <option value="buy">Buy</option>
            <option value="rent">Rent</option>
            <option value="sell">Sell</option>
          </Select>
          <Select
            value={filterSource}
            onChange={(e) => setFilterSource(e.target.value)}
            className="h-9 w-auto text-xs bg-background"
          >
            <option value="all">All Sources</option>
            <option value="ai_agent">AI Agent</option>
            <option value="manual">Manual</option>
            <option value="fallback">Fallback</option>
          </Select>
          <Select
            value={filterInterest}
            onChange={(e) => setFilterInterest(e.target.value)}
            className="h-9 w-auto text-xs bg-background"
          >
            <option value="all">All Interests</option>
            {Object.entries(interestLabels).map(([val, label]) => (
              <option key={val} value={val}>
                {label}
              </option>
            ))}
          </Select>
          {isFiltered && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={resetFilters}
              className="h-9 px-2.5 text-xs text-muted-foreground hover:text-foreground"
            >
              Reset
            </Button>
          )}
        </div>
      </div>

      {error && <p className="mb-3 text-right text-sm text-destructive">{error}</p>}

      {/* Table Container */}
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-foreground">All leads</p>
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
              {filteredLeads.length} {filteredLeads.length === 1 ? "lead" : "leads"}
            </span>
          </div>
          <span className="text-xs text-muted-foreground">Live data</span>
        </div>

        {loading ? (
          <div className="flex min-h-48 items-center justify-center">
            <Spinner className="h-5 w-5 text-primary" />
          </div>
        ) : filteredLeads.length === 0 && !error ? (
          <div className="flex flex-col items-center justify-center px-5 py-16 text-center">
            <Users className="h-8 w-8 text-muted-foreground/40 mb-3" />
            <p className="text-sm font-medium text-foreground">No leads found</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {isFiltered ? "Try resetting your search filters." : "Leads captured by Amaya or entered manually will appear here."}
            </p>
            {isFiltered && (
              <Button type="button" variant="outline" size="sm" onClick={resetFilters} className="mt-4">
                Clear filters
              </Button>
            )}
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden sm:block">
              <Table className="min-w-[900px]">
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead className="px-5 py-3.5 font-semibold text-xs uppercase tracking-wider text-muted-foreground w-[220px]">
                      Contact
                    </TableHead>
                    <TableHead className="px-4 py-3.5 font-semibold text-xs uppercase tracking-wider text-muted-foreground w-[180px]">
                      Intent & Type
                    </TableHead>
                    <TableHead className="px-4 py-3.5 font-semibold text-xs uppercase tracking-wider text-muted-foreground w-[170px]">
                      Budget
                    </TableHead>
                    <TableHead className="px-4 py-3.5 font-semibold text-xs uppercase tracking-wider text-muted-foreground">
                      Requirements & Remarks
                    </TableHead>
                    <TableHead className="px-4 py-3.5 font-semibold text-xs uppercase tracking-wider text-muted-foreground w-[120px]">
                      Source
                    </TableHead>
                    <TableHead className="px-4 py-3.5 text-right font-semibold text-xs uppercase tracking-wider text-muted-foreground w-[110px]">
                      Captured
                    </TableHead>
                    <TableHead className="px-5 py-3.5 text-right font-semibold text-xs uppercase tracking-wider text-muted-foreground w-[140px]">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody className="divide-y divide-border">
                  {filteredLeads.map((lead) => (
                    <TableRow key={lead.id} className="transition hover:bg-muted/50">
                      {/* Contact */}
                      <TableCell className="px-5 py-4 align-top">
                        <div className="flex flex-col">
                          <span className="font-semibold text-foreground leading-tight">
                            {lead.name ?? "Unnamed lead"}
                          </span>
                          <div className="mt-1.5 flex items-center gap-2">
                            <span className="text-xs text-muted-foreground">{lead.phone ?? "No phone"}</span>
                            {lead.phone && (
                              <a
                                href={getWhatsAppUrl(lead.phone) ?? "#"}
                                target="_blank"
                                rel="noopener noreferrer"
                                title="Open WhatsApp chat"
                                className="inline-flex items-center text-emerald-600 hover:text-emerald-700 dark:text-emerald-400"
                              >
                                <MessageCircle className="h-3.5 w-3.5" />
                              </a>
                            )}
                          </div>
                        </div>
                      </TableCell>

                      {/* Intent & Type */}
                      <TableCell className="px-4 py-4 align-top">
                        <div className="flex flex-col items-start gap-1">
                          {lead.intent ? (
                            <Badge variant={intentVariants[lead.intent]} className="capitalize text-[11px] px-2 py-0.5">
                              {lead.intent}
                            </Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">Not specified</span>
                          )}
                          <span className="text-xs text-muted-foreground line-clamp-1">
                            {lead.interest ? interestLabels[lead.interest] : "Any property"}
                          </span>
                        </div>
                      </TableCell>

                      {/* Budget */}
                      <TableCell className="px-4 py-4 align-top">
                        <span className="text-sm font-medium text-foreground">
                          {formatBudget(lead.budget_min, lead.budget_max)}
                        </span>
                      </TableCell>

                      {/* Requirements & Remarks */}
                      <TableCell className="px-4 py-4 align-top max-w-xs xl:max-w-md">
                        <div
                          onClick={() => setViewingLead(lead)}
                          className="cursor-pointer space-y-1 text-xs text-muted-foreground hover:text-foreground transition-colors group"
                          title="Click to view full details"
                        >
                          {lead.requirements ? (
                            <p className="line-clamp-1 font-normal">
                              <span className="font-medium text-foreground/80">Req:</span> {lead.requirements}
                            </p>
                          ) : null}
                          {lead.remarks ? (
                            <p className="line-clamp-1 text-muted-foreground/80">
                              <span className="font-medium text-foreground/80">Notes:</span> {lead.remarks}
                            </p>
                          ) : null}
                          {!lead.requirements && !lead.remarks && (
                            <span className="italic text-muted-foreground/60">No notes recorded</span>
                          )}
                        </div>
                      </TableCell>

                      {/* Source */}
                      <TableCell className="px-4 py-4 align-top">
                        {lead.source === "ai_agent" ? (
                          <Badge
                            variant="outline"
                            className="border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-300 gap-1 font-medium text-[11px]"
                          >
                            <Bot className="h-3 w-3" />
                            AI agent
                          </Badge>
                        ) : lead.source ? (
                          <Badge variant="outline" className="font-normal text-muted-foreground text-[11px]">
                            {sourceLabels[lead.source]}
                          </Badge>
                        ) : (
                          <span className="text-xs text-muted-foreground">Unknown</span>
                        )}
                      </TableCell>

                      {/* Captured Date */}
                      <TableCell className="px-4 py-4 text-right align-top">
                        <span className="text-xs text-muted-foreground block">
                          {new Date(lead.created_at).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </span>
                        {lead.edited_by && (
                          <span className="text-[10px] text-muted-foreground/70" title={`Edited by ${lead.edited_by.name}`}>
                            Edited
                          </span>
                        )}
                      </TableCell>

                      {/* Actions */}
                      <TableCell className="px-5 py-4 text-right align-top">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setViewingLead(lead)}
                            className="h-8 gap-1 px-2 text-xs font-medium text-muted-foreground hover:text-foreground"
                            title="View details"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => startEditing(lead)}
                            className="h-8 gap-1 px-2 text-xs font-semibold text-primary hover:bg-primary/10 hover:text-primary"
                            title="Edit lead"
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setDeleteError("");
                              setDeletingLead(lead);
                            }}
                            className="h-8 gap-1 px-2 text-xs font-semibold text-destructive hover:bg-destructive/10 hover:text-destructive"
                            title="Delete lead"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Mobile Cards View */}
            <div className="flex flex-col divide-y divide-border sm:hidden">
              {filteredLeads.map((lead) => (
                <div key={lead.id} className="flex flex-col gap-3 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <span className="font-semibold leading-tight text-foreground">{lead.name ?? "Unnamed lead"}</span>
                      <div className="mt-1 flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">{lead.phone ?? "No phone captured"}</span>
                        {lead.phone && (
                          <a
                            href={getWhatsAppUrl(lead.phone) ?? "#"}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-emerald-600 dark:text-emerald-400"
                          >
                            <MessageCircle className="h-3.5 w-3.5" />
                          </a>
                        )}
                      </div>
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
                    <div className="text-sm text-muted-foreground space-y-1">
                      {lead.requirements && (
                        <p className="line-clamp-2">
                          <span className="font-medium text-foreground">Reqs:</span> {lead.requirements}
                        </p>
                      )}
                      {lead.remarks && (
                        <p className="line-clamp-2">
                          <span className="font-medium text-foreground">Remarks:</span> {lead.remarks}
                        </p>
                      )}
                    </div>
                  )}
                  <div className="mt-1 flex items-center justify-between border-t border-border pt-3">
                    <span className="text-xs text-muted-foreground">
                      {new Date(lead.created_at).toLocaleDateString()} &middot;{" "}
                      {lead.source ? sourceLabels[lead.source] : "Unknown"}
                    </span>
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setViewingLead(lead)}
                        className="h-8 px-2 text-xs font-semibold text-muted-foreground"
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => startEditing(lead)}
                        className="h-8 px-2 text-xs font-semibold text-primary hover:bg-primary/10 hover:text-primary"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setDeleteError("");
                          setDeletingLead(lead);
                        }}
                        className="h-8 px-2 text-xs font-semibold text-destructive hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Create Lead Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add new lead</DialogTitle>
            <DialogDescription>Capture new client details and property requirements manually.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="text-xs font-semibold text-foreground">
                Client Name
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Kasun Fernando"
                  className="mt-1.5"
                />
              </label>
              <label className="text-xs font-semibold text-foreground">
                Phone *
                <Input
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="e.g. 077 123 4567"
                  className="mt-1.5"
                />
              </label>
              <label className="text-xs font-semibold text-foreground">
                Intent
                <Select
                  value={intent}
                  onChange={(e) => setIntent(e.target.value as "buy" | "rent" | "sell" | "")}
                  className="mt-1.5 w-full"
                >
                  <option value="">Not specified</option>
                  <option value="buy">Buy</option>
                  <option value="rent">Rent</option>
                  <option value="sell">Sell</option>
                </Select>
              </label>
              <label className="text-xs font-semibold text-foreground">
                Looking for
                <Select
                  value={interest}
                  onChange={(e) => setInterest(e.target.value as LeadInterest | "")}
                  className="mt-1.5 w-full"
                >
                  <option value="">Not specified</option>
                  {Object.entries(interestLabels).map(([val, label]) => (
                    <option key={val} value={val}>
                      {label}
                    </option>
                  ))}
                </Select>
              </label>
              <label className="text-xs font-semibold text-foreground">
                Budget min (LKR)
                <Input
                  type="number"
                  min="0"
                  value={budgetMin}
                  onChange={(e) => setBudgetMin(e.target.value)}
                  placeholder="e.g. 35000000"
                  className="mt-1.5"
                />
              </label>
              <label className="text-xs font-semibold text-foreground">
                Budget max (LKR)
                <Input
                  type="number"
                  min="0"
                  value={budgetMax}
                  onChange={(e) => setBudgetMax(e.target.value)}
                  placeholder="e.g. 60000000"
                  className="mt-1.5"
                />
              </label>
            </div>
            <label className="block text-xs font-semibold text-foreground">
              Requirements
              <Textarea
                value={requirements}
                onChange={(e) => setRequirements(e.target.value)}
                placeholder="e.g. 3 BR in Colombo 03 or 07, sea view, above 12th floor"
                className="mt-1.5 min-h-[70px]"
              />
            </label>
            <label className="block text-xs font-semibold text-foreground">
              Remarks & Follow-up Notes
              <Textarea
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                placeholder="e.g. Cash buyer, pre-approved loan, requested viewing on Saturday"
                className="mt-1.5 min-h-[70px]"
              />
            </label>
            {formError && <p className="text-xs font-medium text-destructive">{formError}</p>}
            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={creating} className="gap-2">
                {creating ? <Spinner className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                {creating ? "Adding..." : "Add lead"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Lead Dialog */}
      <Dialog open={editingLead !== null} onOpenChange={(open) => !open && setEditingLead(null)}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit lead</DialogTitle>
            <DialogDescription>
              Update preferences and details for {editingLead?.name || editingLead?.phone || "this lead"}.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpdate} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="text-xs font-semibold text-foreground">
                Client Name
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="mt-1.5"
                />
              </label>
              <label className="text-xs font-semibold text-foreground">
                Phone
                <Input
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  className="mt-1.5"
                />
              </label>
              <label className="text-xs font-semibold text-foreground">
                Intent
                <Select
                  value={editIntent}
                  onChange={(e) => setEditIntent(e.target.value as "buy" | "rent" | "sell" | "")}
                  className="mt-1.5 w-full"
                >
                  <option value="">Not specified</option>
                  <option value="buy">Buy</option>
                  <option value="rent">Rent</option>
                  <option value="sell">Sell</option>
                </Select>
              </label>
              <label className="text-xs font-semibold text-foreground">
                Looking for
                <Select
                  value={editInterest}
                  onChange={(e) => setEditInterest(e.target.value as LeadInterest | "")}
                  className="mt-1.5 w-full"
                >
                  <option value="">Not specified</option>
                  {Object.entries(interestLabels).map(([val, label]) => (
                    <option key={val} value={val}>
                      {label}
                    </option>
                  ))}
                </Select>
              </label>
              <label className="text-xs font-semibold text-foreground">
                Budget min (LKR)
                <Input
                  type="number"
                  min="0"
                  value={editBudgetMin}
                  onChange={(e) => setEditBudgetMin(e.target.value)}
                  className="mt-1.5"
                />
              </label>
              <label className="text-xs font-semibold text-foreground">
                Budget max (LKR)
                <Input
                  type="number"
                  min="0"
                  value={editBudgetMax}
                  onChange={(e) => setEditBudgetMax(e.target.value)}
                  className="mt-1.5"
                />
              </label>
            </div>
            <label className="block text-xs font-semibold text-foreground">
              Requirements
              <Textarea
                value={editRequirements}
                onChange={(e) => setEditRequirements(e.target.value)}
                className="mt-1.5 min-h-[70px]"
              />
            </label>
            <label className="block text-xs font-semibold text-foreground">
              Remarks & Follow-up Notes
              <Textarea
                value={editRemarks}
                onChange={(e) => setEditRemarks(e.target.value)}
                className="mt-1.5 min-h-[70px]"
              />
            </label>
            {editError && <p className="text-xs font-medium text-destructive">{editError}</p>}
            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setEditingLead(null)}>
                Cancel
              </Button>
              <Button type="submit" disabled={updating} className="gap-2">
                {updating && <Spinner className="h-4 w-4" />}
                {updating ? "Saving..." : "Save changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* View Lead Details Dialog */}
      <Dialog open={viewingLead !== null} onOpenChange={(open) => !open && setViewingLead(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          {viewingLead && (
            <>
              <DialogHeader>
                <div className="flex items-center justify-between pr-6">
                  <div>
                    <DialogTitle className="text-xl">
                      {viewingLead.name ?? "Unnamed lead"}
                    </DialogTitle>
                    <DialogDescription className="mt-1">
                      Captured on{" "}
                      {new Date(viewingLead.created_at).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </DialogDescription>
                  </div>
                  {viewingLead.intent && (
                    <Badge variant={intentVariants[viewingLead.intent]} className="capitalize">
                      {viewingLead.intent}
                    </Badge>
                  )}
                </div>
              </DialogHeader>

              <div className="space-y-4 pt-2">
                {/* Contact Information */}
                <div className="rounded-lg border border-border bg-muted/40 p-4">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-2">
                    Contact Details
                  </span>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-foreground">{viewingLead.name ?? "No name"}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{viewingLead.phone ?? "No phone recorded"}</p>
                    </div>
                    {viewingLead.phone && (
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          asChild
                          className="h-8 gap-1.5 text-xs"
                        >
                          <a href={`tel:${viewingLead.phone}`}>
                            <Phone className="h-3.5 w-3.5 text-primary" />
                            Call
                          </a>
                        </Button>
                        {getWhatsAppUrl(viewingLead.phone) && (
                          <Button
                            variant="outline"
                            size="sm"
                            asChild
                            className="h-8 gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 hover:text-emerald-700"
                          >
                            <a
                              href={getWhatsAppUrl(viewingLead.phone)!}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <MessageCircle className="h-3.5 w-3.5" />
                              WhatsApp
                            </a>
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Property & Budget */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg border border-border p-3.5">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
                      Looking For
                    </span>
                    <p className="mt-1 text-sm font-medium text-foreground">
                      {viewingLead.interest ? interestLabels[viewingLead.interest] : "Not specified"}
                    </p>
                  </div>
                  <div className="rounded-lg border border-border p-3.5">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block">
                      Budget
                    </span>
                    <p className="mt-1 text-sm font-medium text-foreground">
                      {formatBudget(viewingLead.budget_min, viewingLead.budget_max)}
                    </p>
                  </div>
                </div>

                {/* Requirements */}
                {viewingLead.requirements && (
                  <div className="rounded-lg border border-border p-3.5">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                      Requirements
                    </span>
                    <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                      {viewingLead.requirements}
                    </p>
                  </div>
                )}

                {/* Remarks */}
                {viewingLead.remarks && (
                  <div className="rounded-lg border border-border p-3.5">
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                      Remarks & Internal Notes
                    </span>
                    <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                      {viewingLead.remarks}
                    </p>
                  </div>
                )}

                {/* Metadata */}
                <div className="flex flex-wrap items-center justify-between text-xs text-muted-foreground border-t border-border pt-3">
                  <span>
                    Source:{" "}
                    <strong className="font-medium text-foreground">
                      {viewingLead.source ? sourceLabels[viewingLead.source] : "Unknown"}
                    </strong>
                  </span>
                  {viewingLead.edited_by && (
                    <span>
                      Last edited by:{" "}
                      <strong className="font-medium text-foreground">{viewingLead.edited_by.name}</strong>
                    </span>
                  )}
                </div>
              </div>

              <DialogFooter className="mt-4 gap-2 sm:gap-0">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    const lead = viewingLead;
                    setViewingLead(null);
                    startEditing(lead);
                  }}
                  className="gap-1.5"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Edit lead
                </Button>
                <Button type="button" onClick={() => setViewingLead(null)}>
                  Close
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Alert Dialog */}
      <AlertDialog
        open={deletingLead !== null}
        onOpenChange={(open) => {
          if (!open && !deleting) {
            setDeletingLead(null);
            setDeleteError("");
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete lead</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the lead for{" "}
              <span className="font-semibold text-foreground">
                {deletingLead?.name || deletingLead?.phone || "this contact"}
              </span>
              ? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteError && <p className="text-sm text-destructive">{deleteError}</p>}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              disabled={deleting}
              onClick={handleDelete}
              className="min-h-[44px]"
            >
              {deleting ? "Deleting..." : "Delete lead"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
