"use client";

import { useEffect, useState, type FormEvent } from "react";
import { createAdminLead, getAdminLeads, updateAdminLead, type AdminLead, type LeadInterest } from "@/lib/api";
import { Spinner } from "@/components/ui/spinner";
import { Pencil } from "lucide-react";

const intentStyles = {
  buy: "bg-[#e0f1e7] dark:bg-green-950 text-[#28704b] dark:text-green-300",
  rent: "bg-[#e4ecf5] text-[#41627f]",
  sell: "bg-[#fff0d5] dark:bg-yellow-950 text-[#9a6415] dark:text-yellow-300",
} as const;

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
        <p className="text-sm font-medium text-[#75847c] dark:text-zinc-400">Relationship management</p>
        <h2 className="mt-1 text-3xl font-semibold tracking-tight">Leads</h2>
        <p className="mt-2 text-sm text-[#75847c] dark:text-zinc-400">Review people Amaya has connected with the team.</p>
      </div>
      <form onSubmit={handleCreate} className="mb-6 flex flex-col items-stretch gap-4 rounded-xl border border-[#dce4df] dark:border-zinc-800 bg-white dark:bg-zinc-950 p-5 shadow-[0_8px_24px_rgba(25,53,43,0.04)] dark:shadow-none sm:flex-row sm:flex-wrap sm:items-end sm:gap-3">
        <label className="min-w-48 flex-1 text-sm font-medium text-[#526158]">Name<input value={name} onChange={(event) => setName(event.target.value)} className="mt-2 w-full rounded-lg border border-[#dce4df] dark:border-zinc-800 px-3 py-2 font-normal outline-none focus:border-[#28513f]" /></label>
        <label className="min-w-48 flex-1 text-sm font-medium text-[#526158]">Phone<input required value={phone} onChange={(event) => setPhone(event.target.value)} className="mt-2 w-full rounded-lg border border-[#dce4df] dark:border-zinc-800 px-3 py-2 font-normal outline-none focus:border-[#28513f]" /></label>
        <label className="min-w-56 flex-1 text-sm font-medium text-[#526158]">Looking for<select value={interest} onChange={(event) => setInterest(event.target.value as LeadInterest | "")} className="mt-2 w-full rounded-lg border border-[#dce4df] dark:border-zinc-800 bg-white dark:bg-zinc-950 px-3 py-2 font-normal outline-none focus:border-[#28513f]"><option value="">Not specified</option>{Object.entries(interestLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label className="min-w-40 flex-1 text-sm font-medium text-[#526158]">Budget min<input type="number" min="0" value={budgetMin} onChange={(event) => setBudgetMin(event.target.value)} className="mt-2 w-full rounded-lg border border-[#dce4df] dark:border-zinc-800 px-3 py-2 font-normal outline-none focus:border-[#28513f]" /></label>
        <label className="min-w-40 flex-1 text-sm font-medium text-[#526158]">Budget max<input type="number" min="0" value={budgetMax} onChange={(event) => setBudgetMax(event.target.value)} className="mt-2 w-full rounded-lg border border-[#dce4df] dark:border-zinc-800 px-3 py-2 font-normal outline-none focus:border-[#28513f]" /></label>
        <label className="min-w-64 flex-[2] text-sm font-medium text-[#526158]">Requirements<input value={requirements} onChange={(event) => setRequirements(event.target.value)} className="mt-2 w-full rounded-lg border border-[#dce4df] dark:border-zinc-800 px-3 py-2 font-normal outline-none focus:border-[#28513f]" /></label>
        <label className="min-w-64 flex-[2] text-sm font-medium text-[#526158]">Remarks<input value={remarks} onChange={(event) => setRemarks(event.target.value)} className="mt-2 w-full rounded-lg border border-[#dce4df] dark:border-zinc-800 px-3 py-2 font-normal outline-none focus:border-[#28513f]" /></label>
        <button type="submit" disabled={creating} className="rounded-lg bg-[#28513f] dark:bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white dark:text-zinc-200 transition-colors hover:bg-[#1e4031] dark:hover:bg-emerald-600 disabled:opacity-60">{creating ? "Adding..." : "Add new lead"}</button>
        {formError && <p className="basis-full text-sm text-[#a34d4d] dark:text-red-400">{formError}</p>}
      </form>
      {editingLead && <form onSubmit={handleUpdate} className="mb-6 flex flex-col items-stretch gap-4 rounded-xl border border-[#cbded2] bg-[#f5faf6] p-5 sm:flex-row sm:flex-wrap sm:items-end sm:gap-3">
        <div className="basis-full flex items-center justify-between"><p className="text-sm font-semibold text-[#28513f]">Edit lead</p><button type="button" onClick={() => setEditingLead(null)} className="text-sm text-[#65736b] dark:text-zinc-300 hover:underline">Cancel</button></div>
        <label className="min-w-48 flex-1 text-sm font-medium text-[#526158]">Name<input value={editName} onChange={(event) => setEditName(event.target.value)} className="mt-2 w-full rounded-lg border border-[#dce4df] dark:border-zinc-800 bg-white dark:bg-zinc-950 px-3 py-2 font-normal outline-none focus:border-[#28513f]" /></label>
        <label className="min-w-48 flex-1 text-sm font-medium text-[#526158]">Phone<input value={editPhone} onChange={(event) => setEditPhone(event.target.value)} className="mt-2 w-full rounded-lg border border-[#dce4df] dark:border-zinc-800 bg-white dark:bg-zinc-950 px-3 py-2 font-normal outline-none focus:border-[#28513f]" /></label>
        <label className="min-w-36 flex-1 text-sm font-medium text-[#526158]">Budget min<input type="number" min="0" value={editBudgetMin} onChange={(event) => setEditBudgetMin(event.target.value)} className="mt-2 w-full rounded-lg border border-[#dce4df] dark:border-zinc-800 bg-white dark:bg-zinc-950 px-3 py-2 font-normal outline-none focus:border-[#28513f]" /></label>
        <label className="min-w-36 flex-1 text-sm font-medium text-[#526158]">Budget max<input type="number" min="0" value={editBudgetMax} onChange={(event) => setEditBudgetMax(event.target.value)} className="mt-2 w-full rounded-lg border border-[#dce4df] dark:border-zinc-800 bg-white dark:bg-zinc-950 px-3 py-2 font-normal outline-none focus:border-[#28513f]" /></label>
        <label className="min-w-32 flex-1 text-sm font-medium text-[#526158]">Intent<select value={editIntent} onChange={(event) => setEditIntent(event.target.value as "buy" | "rent" | "sell" | "")} className="mt-2 w-full rounded-lg border border-[#dce4df] dark:border-zinc-800 bg-white dark:bg-zinc-950 px-3 py-2 font-normal outline-none focus:border-[#28513f]"><option value="">Not specified</option><option value="buy">Buy</option><option value="rent">Rent</option><option value="sell">Sell</option></select></label>
        <label className="min-w-56 flex-1 text-sm font-medium text-[#526158]">Looking for<select value={editInterest} onChange={(event) => setEditInterest(event.target.value as LeadInterest | "")} className="mt-2 w-full rounded-lg border border-[#dce4df] dark:border-zinc-800 bg-white dark:bg-zinc-950 px-3 py-2 font-normal outline-none focus:border-[#28513f]"><option value="">Not specified</option>{Object.entries(interestLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label className="min-w-64 flex-[2] text-sm font-medium text-[#526158]">Requirements<input value={editRequirements} onChange={(event) => setEditRequirements(event.target.value)} className="mt-2 w-full rounded-lg border border-[#dce4df] dark:border-zinc-800 bg-white dark:bg-zinc-950 px-3 py-2 font-normal outline-none focus:border-[#28513f]" /></label>
        <label className="min-w-64 flex-[2] text-sm font-medium text-[#526158]">Remarks<input value={editRemarks} onChange={(event) => setEditRemarks(event.target.value)} className="mt-2 w-full rounded-lg border border-[#dce4df] dark:border-zinc-800 bg-white dark:bg-zinc-950 px-3 py-2 font-normal outline-none focus:border-[#28513f]" /></label>
        <button type="submit" disabled={updating} className="rounded-lg bg-[#28513f] dark:bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white dark:text-zinc-200 transition-colors hover:bg-[#1e4031] dark:hover:bg-emerald-600 disabled:opacity-60">{updating ? "Saving..." : "Save changes"}</button>
      </form>}
      {error && <p className="mb-3 text-right text-sm text-[#a34d4d] dark:text-red-400">{error}</p>}
      <div className="overflow-hidden rounded-xl border border-[#dce4df] dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-[0_8px_24px_rgba(25,53,43,0.04)] dark:shadow-none">
        <div className="flex items-center justify-between border-b border-[#e6ebe8] dark:border-zinc-800 px-5 py-4">
          <p className="text-sm font-semibold">All leads <span className="ml-1 font-normal text-[#8a968f] dark:text-zinc-400">({leads.length})</span></p>
          <span className="text-xs text-[#8a968f] dark:text-zinc-400">Live data</span>
        </div>
        {loading ? (
          <div className="flex min-h-32 items-center justify-center">
            <Spinner className="h-5 w-5 text-[#28513f]" />
          </div>
        ) : leads.length === 0 && !error ? (
          <p className="px-5 py-12 text-center text-sm text-[#75847c] dark:text-zinc-400">No leads have been captured yet.</p>
        ) : (
          <>
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead className="bg-[#f8faf8] dark:bg-zinc-900 text-xs uppercase tracking-[0.12em] text-[#7a8780] dark:text-zinc-400">
                  <tr><th className="px-5 py-4 font-semibold">Contact</th><th className="px-4 py-4 font-semibold">Source</th><th className="px-4 py-4 font-semibold">Looking for</th><th className="px-4 py-4 font-semibold">Intent</th><th className="px-4 py-4 font-semibold">Budget</th><th className="px-4 py-4 font-semibold">Requirements</th><th className="px-4 py-4 font-semibold">Remarks</th><th className="px-4 py-4 font-semibold">Edited by</th><th className="px-5 py-4 text-right font-semibold">Captured</th><th className="px-5 py-4 text-right font-semibold">Action</th></tr>
                </thead>
                <tbody className="divide-y divide-[#edf0ee] dark:divide-zinc-800">
                  {leads.map((lead) => <tr key={lead.id} className="transition hover:bg-[#fbfcfb] dark:hover:bg-zinc-900">
                    <td className="px-5 py-4"><p className="font-semibold text-[#253a30] dark:text-zinc-200">{lead.name ?? "Unnamed lead"}</p><p className="mt-1 text-[#65736b] dark:text-zinc-300">{lead.phone ?? "No phone captured"}</p></td>
                    <td className="px-4 py-4 text-[#65736b] dark:text-zinc-300">{lead.source ? sourceLabels[lead.source] : "Unknown"}</td>
                    <td className="px-4 py-4 text-[#65736b] dark:text-zinc-300">{lead.interest ? interestLabels[lead.interest] : "Not specified"}</td>
                    <td className="px-4 py-4">{lead.intent ? <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${intentStyles[lead.intent]}`}>{lead.intent}</span> : <span className="text-[#8a968f] dark:text-zinc-400">Not specified</span>}</td>
                    <td className="px-4 py-4 text-[#65736b] dark:text-zinc-300">{formatBudget(lead.budget_min, lead.budget_max)}</td>
                    <td className="max-w-sm px-4 py-4 text-[#65736b] dark:text-zinc-300">{lead.requirements ?? "No requirements captured"}</td>
                    <td className="max-w-sm px-4 py-4 text-[#65736b] dark:text-zinc-300">{lead.remarks ?? "No remarks"}</td>
                    <td className="px-4 py-4 text-[#65736b] dark:text-zinc-300">{lead.edited_by ? lead.edited_by.name : "Not edited"}</td>
                    <td className="px-5 py-4 text-right text-[#65736b] dark:text-zinc-300">{new Date(lead.created_at).toLocaleDateString()}</td>
                    <td className="px-5 py-4 text-right"><button type="button" onClick={() => startEditing(lead)} className="inline-flex items-center gap-1.5 rounded px-2.5 py-1.5 text-xs font-semibold text-[#35664f] dark:text-emerald-400 transition-colors hover:bg-[#e0f1e7] dark:hover:bg-emerald-950 cursor-pointer"><Pencil className="h-3.5 w-3.5" />Edit</button></td>
                  </tr>)}
                </tbody>
              </table>
            </div>
            <div className="flex flex-col divide-y divide-[#edf0ee] dark:divide-zinc-800 sm:hidden">
              {leads.map((lead) => (
                <div key={lead.id} className="flex flex-col gap-3 p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <span className="font-semibold leading-tight text-[#253a30] dark:text-zinc-200">{lead.name ?? "Unnamed lead"}</span>
                      <p className="mt-0.5 text-sm text-[#65736b] dark:text-zinc-300">{lead.phone ?? "No phone captured"}</p>
                    </div>
                    {lead.intent ? (
                      <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${intentStyles[lead.intent]}`}>
                        {lead.intent}
                      </span>
                    ) : (
                      <span className="shrink-0 text-xs text-[#8a968f] dark:text-zinc-400">No intent</span>
                    )}
                  </div>
                  <div className="flex items-center justify-between text-sm text-[#65736b] dark:text-zinc-300">
                    <span>{lead.interest ? interestLabels[lead.interest] : "Not specified"}</span>
                    <span className="font-semibold text-[#344b3f] dark:text-zinc-200">{formatBudget(lead.budget_min, lead.budget_max)}</span>
                  </div>
                  {(lead.requirements || lead.remarks) && (
                    <div className="text-sm text-[#65736b] dark:text-zinc-300">
                      {lead.requirements && <p className="line-clamp-2"><span className="font-medium">Reqs:</span> {lead.requirements}</p>}
                      {lead.remarks && <p className="mt-1 line-clamp-2"><span className="font-medium">Remarks:</span> {lead.remarks}</p>}
                    </div>
                  )}
                  <div className="mt-2 flex items-center justify-between border-t border-[#edf0ee] pt-4">
                    <span className="text-xs text-[#8a968f] dark:text-zinc-400">{new Date(lead.created_at).toLocaleDateString()} &middot; {lead.source ? sourceLabels[lead.source] : "Unknown"}</span>
                    <button type="button" onClick={() => startEditing(lead)} className="inline-flex items-center gap-1.5 rounded px-2.5 py-1.5 text-xs font-semibold text-[#35664f] dark:text-emerald-400 transition-colors hover:bg-[#e0f1e7] dark:hover:bg-emerald-950 cursor-pointer"><Pencil className="h-3.5 w-3.5" />Edit</button>
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
