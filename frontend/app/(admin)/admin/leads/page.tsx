"use client";

import { useEffect, useState, type FormEvent } from "react";
import { createAdminLead, getAdminLeads, type AdminLead } from "@/lib/api";
import { Spinner } from "@/components/ui/spinner";

const intentStyles = {
  buy: "bg-[#e0f1e7] text-[#28704b]",
  rent: "bg-[#e4ecf5] text-[#41627f]",
  sell: "bg-[#fff0d5] text-[#9a6415]",
} as const;

const sourceLabels = {
  ai_agent: "AI agent",
  manual: "Manual",
  fallback: "Fallback",
} as const;

function formatBudget(value: number | null): string {
  return value === null ? "Not specified" : `LKR ${value.toLocaleString()}`;
}

export default function AdminLeadsPage() {
  const [leads, setLeads] = useState<AdminLead[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [remarks, setRemarks] = useState("");
  const [formError, setFormError] = useState("");

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
      const lead = await createAdminLead({ name: name || undefined, phone, remarks: remarks || undefined });
      setLeads((current) => [lead, ...current]);
      setName("");
      setPhone("");
      setRemarks("");
    } catch (reason) {
      setFormError(reason instanceof Error ? reason.message : "Could not create lead.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <section className="mx-auto max-w-[1380px]">
      <div className="mb-8">
        <p className="text-sm font-medium text-[#75847c]">Relationship management</p>
        <h2 className="mt-1 text-3xl font-semibold tracking-tight">Leads</h2>
        <p className="mt-2 text-sm text-[#75847c]">Review people Amaya has connected with the team.</p>
      </div>
      <form onSubmit={handleCreate} className="mb-6 flex flex-wrap items-end gap-3 rounded-xl border border-[#dce4df] bg-white p-5 shadow-[0_8px_24px_rgba(25,53,43,0.04)]">
        <label className="min-w-48 flex-1 text-sm font-medium text-[#526158]">Name<input value={name} onChange={(event) => setName(event.target.value)} className="mt-2 w-full rounded-lg border border-[#dce4df] px-3 py-2 font-normal outline-none focus:border-[#28513f]" /></label>
        <label className="min-w-48 flex-1 text-sm font-medium text-[#526158]">Phone<input required value={phone} onChange={(event) => setPhone(event.target.value)} className="mt-2 w-full rounded-lg border border-[#dce4df] px-3 py-2 font-normal outline-none focus:border-[#28513f]" /></label>
        <label className="min-w-64 flex-[2] text-sm font-medium text-[#526158]">Remarks<input value={remarks} onChange={(event) => setRemarks(event.target.value)} className="mt-2 w-full rounded-lg border border-[#dce4df] px-3 py-2 font-normal outline-none focus:border-[#28513f]" /></label>
        <button type="submit" disabled={creating} className="rounded-lg bg-[#28513f] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">{creating ? "Adding..." : "Add manual lead"}</button>
        {formError && <p className="basis-full text-sm text-[#a34d4d]">{formError}</p>}
      </form>
      {error && <p className="mb-3 text-right text-sm text-[#a34d4d]">{error}</p>}
      <div className="overflow-hidden rounded-xl border border-[#dce4df] bg-white shadow-[0_8px_24px_rgba(25,53,43,0.04)]">
        <div className="flex items-center justify-between border-b border-[#e6ebe8] px-5 py-4">
          <p className="text-sm font-semibold">All leads <span className="ml-1 font-normal text-[#8a968f]">({leads.length})</span></p>
          <span className="text-xs text-[#8a968f]">Live data</span>
        </div>
        {loading ? (
          <div className="flex min-h-32 items-center justify-center">
            <Spinner className="h-5 w-5 text-[#28513f]" />
          </div>
        ) : leads.length === 0 && !error ? (
          <p className="px-5 py-12 text-center text-sm text-[#75847c]">No leads have been captured yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="bg-[#f8faf8] text-xs uppercase tracking-[0.12em] text-[#7a8780]">
                <tr><th className="px-5 py-4 font-semibold">Contact</th><th className="px-4 py-4 font-semibold">Source</th><th className="px-4 py-4 font-semibold">Intent</th><th className="px-4 py-4 font-semibold">Budget</th><th className="px-4 py-4 font-semibold">Preferences</th><th className="px-4 py-4 font-semibold">Remarks</th><th className="px-5 py-4 text-right font-semibold">Captured</th></tr>
              </thead>
              <tbody className="divide-y divide-[#edf0ee]">
                {leads.map((lead) => <tr key={lead.id} className="transition hover:bg-[#fbfcfb]">
                  <td className="px-5 py-4"><p className="font-semibold text-[#253a30]">{lead.name ?? "Unnamed lead"}</p><p className="mt-1 text-[#65736b]">{lead.phone ?? "No phone captured"}</p></td>
                  <td className="px-4 py-4 text-[#65736b]">{lead.source ? sourceLabels[lead.source] : "Unknown"}</td>
                  <td className="px-4 py-4">{lead.intent ? <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${intentStyles[lead.intent]}`}>{lead.intent}</span> : <span className="text-[#8a968f]">Not specified</span>}</td>
                  <td className="px-4 py-4 text-[#65736b]">{formatBudget(lead.budget_max ?? lead.budget_min)}</td>
                  <td className="max-w-sm px-4 py-4 text-[#65736b]">{lead.preferences ?? "No preferences captured"}</td>
                  <td className="max-w-sm px-4 py-4 text-[#65736b]">{lead.remarks ?? "No remarks"}</td>
                  <td className="px-5 py-4 text-right text-[#65736b]">{new Date(lead.created_at).toLocaleDateString()}</td>
                </tr>)}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
