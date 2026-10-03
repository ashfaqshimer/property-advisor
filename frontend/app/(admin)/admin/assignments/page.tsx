"use client";

import { useEffect, useState } from "react";
import { formatDistanceToNow, parseISO } from "date-fns";
import { toast } from "sonner";
import { ExternalLink, RefreshCw, MessageSquare, Phone, Send } from "lucide-react";
import {
  FieldAssignment,
  PaginatedFieldAssignments,
  getFieldAssignments,
  resendFieldAssignment,
} from "../../../../lib/api";

const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; dot: string }
> = {
  pending: {
    label: "Pending",
    color: "bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800",
    dot: "bg-amber-400",
  },
  interested: {
    label: "Interested",
    color: "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800",
    dot: "bg-emerald-500",
  },
  not_interested: {
    label: "Not Interested",
    color: "bg-red-50 text-red-700 border border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800",
    dot: "bg-red-500",
  },
  no_answer: {
    label: "No Answer",
    color: "bg-zinc-100 text-zinc-600 border border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700",
    dot: "bg-zinc-400",
  },
  callback_later: {
    label: "Call Back Later",
    color: "bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800",
    dot: "bg-blue-500",
  },
};

const STATUS_FILTERS = [
  { value: "", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "interested", label: "Interested" },
  { value: "not_interested", label: "Not Interested" },
  { value: "no_answer", label: "No Answer" },
  { value: "callback_later", label: "Call Back" },
];

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? {
    label: status,
    color: "bg-zinc-100 text-zinc-600 border border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400",
    dot: "bg-zinc-400",
  };
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${cfg.color}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

export default function AssignmentsPage() {
  const [data, setData] = useState<PaginatedFieldAssignments | null>(null);
  const [loading, setLoading] = useState(true);
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState("");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;

  const handleResend = async (assignmentId: string) => {
    setResendingId(assignmentId);
    try {
      const updated = await resendFieldAssignment(assignmentId);
      toast.success("Assignment resent to Telegram agent.");
      setData((prev) =>
        prev
          ? {
              ...prev,
              items: prev.items.map((item) =>
                item.id === assignmentId ? { ...item, ...updated } : item
              ),
            }
          : null
      );
    } catch (err: any) {
      toast.error(err.message || "Failed to resend assignment.");
    } finally {
      setResendingId(null);
    }
  };

  const fetchAssignments = async () => {
    setLoading(true);
    try {
      const result = await getFieldAssignments({
        status: filterStatus || undefined,
        page,
        page_size: PAGE_SIZE,
      });
      setData(result);
    } catch (err: any) {
      toast.error(err.message || "Failed to load assignments.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssignments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterStatus, page]);

  // Reset page when filter changes
  const handleFilterChange = (status: string) => {
    setFilterStatus(status);
    setPage(1);
  };

  const totalPages = data?.total_pages ?? 1;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-[#1a2923] dark:text-zinc-100">
            Field Assignments
          </h1>
          <p className="mt-0.5 text-sm text-[#718078] dark:text-zinc-400">
            Prospects dispatched to the field agent via Telegram
          </p>
        </div>
        <button
          onClick={fetchAssignments}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-lg border border-[#dce4df] dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm font-medium text-[#1a2923] dark:text-zinc-200 hover:bg-[#f4f6f4] dark:hover:bg-zinc-800 transition disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* Status filter tabs */}
      <div className="flex flex-wrap gap-2">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => handleFilterChange(f.value)}
            className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
              filterStatus === f.value
                ? "bg-[#19352b] text-white dark:bg-emerald-700"
                : "bg-white dark:bg-zinc-800 border border-[#dce4df] dark:border-zinc-700 text-[#718078] dark:text-zinc-400 hover:border-[#1a2923] dark:hover:border-zinc-500 hover:text-[#1a2923] dark:hover:text-zinc-200"
            }`}
          >
            {f.label}
            {f.value === "" && data ? ` (${data.total})` : ""}
          </button>
        ))}
      </div>

      {/* Summary stats */}
      {data && !loading && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {[
            { status: "pending", label: "Pending" },
            { status: "interested", label: "Interested" },
            { status: "not_interested", label: "Not Interested" },
            { status: "no_answer", label: "No Answer" },
            { status: "callback_later", label: "Call Back" },
          ].map(({ status, label }) => {
            const count = data.items.filter((a) => a.status === status).length;
            const cfg = STATUS_CONFIG[status];
            return (
              <button
                key={status}
                onClick={() => handleFilterChange(status === filterStatus ? "" : status)}
                className={`rounded-xl border p-3 text-left transition hover:shadow-sm ${
                  filterStatus === status
                    ? "border-[#19352b] dark:border-emerald-600 bg-[#f0f5f2] dark:bg-emerald-900/20"
                    : "border-[#dce4df] dark:border-zinc-700 bg-white dark:bg-zinc-900"
                }`}
              >
                <p className="text-lg font-semibold text-[#1a2923] dark:text-zinc-100">{count}</p>
                <p className="text-xs text-[#718078] dark:text-zinc-400">{label}</p>
              </button>
            );
          })}
        </div>
      )}

      {/* Table */}
      <div className="rounded-xl border border-[#dce4df] dark:border-zinc-700 bg-white dark:bg-zinc-900 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <RefreshCw className="h-5 w-5 animate-spin text-[#718078] dark:text-zinc-500 mr-2" />
            <span className="text-sm text-[#718078] dark:text-zinc-400">Loading assignments…</span>
          </div>
        ) : !data || data.items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-2">
            <MessageSquare className="h-8 w-8 text-[#c5d4cc] dark:text-zinc-600" />
            <p className="text-sm text-[#718078] dark:text-zinc-400">No assignments yet.</p>
            <p className="text-xs text-[#a0b0a8] dark:text-zinc-500">
              Select prospects on the Prospects page and click &ldquo;Assign to Agent&rdquo;.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#dce4df] dark:border-zinc-700 bg-[#f4f6f4] dark:bg-zinc-800/50">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[#718078] dark:text-zinc-400">
                    Prospect
                  </th>
                  <th className="hidden sm:table-cell px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[#718078] dark:text-zinc-400">
                    Phone
                  </th>
                  <th className="hidden md:table-cell px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[#718078] dark:text-zinc-400">
                    Property
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[#718078] dark:text-zinc-400">
                    Status
                  </th>
                  <th className="hidden lg:table-cell px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[#718078] dark:text-zinc-400">
                    Notes
                  </th>
                  <th className="hidden sm:table-cell px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[#718078] dark:text-zinc-400">
                    Assigned
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-[#718078] dark:text-zinc-400">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#edf1ee] dark:divide-zinc-800">
                {data.items.map((a) => (
                  <tr
                    key={a.id}
                    className="hover:bg-[#f8faf9] dark:hover:bg-zinc-800/40 transition"
                  >
                    {/* Prospect name */}
                    <td className="px-4 py-3">
                      <p className="font-medium text-[#1a2923] dark:text-zinc-100 truncate max-w-[160px]">
                        {a.prospect_poster_name || "—"}
                      </p>
                      <p className="text-xs text-[#718078] dark:text-zinc-400 truncate max-w-[160px]">
                        {a.prospect_location || ""}
                      </p>
                      {/* Phone visible on mobile */}
                      {a.prospect_phone_number && (
                        <a
                          href={`tel:${a.prospect_phone_number}`}
                          className="sm:hidden inline-flex items-center gap-1 mt-1 text-xs text-[#19352b] dark:text-emerald-400 font-mono"
                        >
                          <Phone className="h-3 w-3" />
                          {a.prospect_phone_number}
                        </a>
                      )}
                    </td>

                    {/* Phone */}
                    <td className="hidden sm:table-cell px-4 py-3">
                      {a.prospect_phone_number ? (
                        <a
                          href={`tel:${a.prospect_phone_number}`}
                          className="font-mono text-xs text-[#1a2923] dark:text-zinc-200 hover:text-[#19352b] dark:hover:text-emerald-400 transition"
                        >
                          {a.prospect_phone_number}
                        </a>
                      ) : (
                        <span className="text-xs text-[#a0b0a8] dark:text-zinc-500">—</span>
                      )}
                    </td>

                    {/* Property */}
                    <td className="hidden md:table-cell px-4 py-3">
                      <p className="text-xs text-[#1a2923] dark:text-zinc-200 truncate max-w-[180px]">
                        {a.prospect_title || "—"}
                      </p>
                      <p className="text-xs text-[#718078] dark:text-zinc-400">
                        {a.prospect_price || ""}
                      </p>
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3 whitespace-nowrap">
                      <StatusBadge status={a.status} />
                    </td>

                    {/* Notes */}
                    <td className="hidden lg:table-cell px-4 py-3 max-w-[200px]">
                      {a.notes ? (
                        <p className="text-xs text-[#1a2923] dark:text-zinc-300 line-clamp-2">
                          {a.notes}
                        </p>
                      ) : (
                        <span className="text-xs text-[#c5d4cc] dark:text-zinc-600">—</span>
                      )}
                    </td>

                    {/* Assigned at */}
                    <td className="hidden sm:table-cell px-4 py-3 whitespace-nowrap">
                      <span className="text-xs text-[#718078] dark:text-zinc-400">
                        {formatDistanceToNow(parseISO(a.created_at), { addSuffix: true })}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-2 justify-end">
                        <button
                          onClick={() => handleResend(a.id)}
                          disabled={resendingId === a.id}
                          title="Resend to Telegram agent"
                          className="inline-flex items-center gap-1.5 rounded-lg border border-[#dce4df] dark:border-zinc-700 bg-white dark:bg-zinc-800 px-2.5 py-1 text-xs font-medium text-[#1a2923] dark:text-zinc-200 hover:bg-[#f4f6f4] dark:hover:bg-zinc-700 transition disabled:opacity-50"
                        >
                          <Send className={`h-3 w-3 ${resendingId === a.id ? "animate-pulse" : ""}`} />
                          <span>{resendingId === a.id ? "Sending…" : "Resend"}</span>
                        </button>
                        {a.prospect_ikman_url && (
                          <a
                            href={a.prospect_ikman_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1 rounded text-[#718078] dark:text-zinc-400 hover:text-[#1a2923] dark:hover:text-zinc-200 transition"
                            title="View on ikman"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-[#718078] dark:text-zinc-400">
            Page {page} of {totalPages}
          </p>
          <div className="flex gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="rounded-lg border border-[#dce4df] dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-1.5 text-xs font-medium text-[#1a2923] dark:text-zinc-200 hover:bg-[#f4f6f4] dark:hover:bg-zinc-800 disabled:opacity-40 transition"
            >
              Previous
            </button>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-lg border border-[#dce4df] dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-1.5 text-xs font-medium text-[#1a2923] dark:text-zinc-200 hover:bg-[#f4f6f4] dark:hover:bg-zinc-800 disabled:opacity-40 transition"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
