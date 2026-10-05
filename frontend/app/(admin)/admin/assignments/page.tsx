"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { formatDistanceToNow, parseISO } from "date-fns";
import { toast } from "sonner";
import { ExternalLink, RefreshCw, MessageSquare, Phone, Send, Trash2, Clock } from "lucide-react";
import {
  FieldAssignment,
  PaginatedFieldAssignments,
  getCurrentUser,
  getFieldAssignments,
  resendFieldAssignment,
  deleteFieldAssignment,
  processDueFieldAssignmentReminders,
} from "../../../../lib/api";
import { SourceBadge } from "../../../../components/admin/SourceBadge";

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
  const router = useRouter();
  const [data, setData] = useState<PaginatedFieldAssignments | null>(null);
  const [loading, setLoading] = useState(true);
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [deleteConfirmAssignment, setDeleteConfirmAssignment] = useState<FieldAssignment | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [processingReminders, setProcessingReminders] = useState(false);
  const [filterStatus, setFilterStatus] = useState("");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;

  useEffect(() => {
    getCurrentUser()
      .then((u) => {
        if (!u || !["root", "admin"].includes(u.role)) {
          router.replace("/admin");
        }
      })
      .catch(() => {
        router.replace("/admin");
      });
  }, [router]);

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

  const handleDelete = async (assignment: FieldAssignment) => {
    setDeletingId(assignment.id);
    try {
      await deleteFieldAssignment(assignment.id);
      toast.success("Assignment removed successfully.");
      setData((prev) =>
        prev
          ? {
              ...prev,
              items: prev.items.filter((item) => item.id !== assignment.id),
              total: Math.max(0, prev.total - 1),
            }
          : null
      );
      setDeleteConfirmAssignment(null);
    } catch (err: any) {
      toast.error(err.message || "Failed to remove assignment.");
    } finally {
      setDeletingId(null);
    }
  };

  const handleProcessReminders = async () => {
    setProcessingReminders(true);
    try {
      const res = await processDueFieldAssignmentReminders();
      if (res.count > 0) {
        toast.success(`Dispatched ${res.count} follow-up reminder(s) to Telegram.`);
      } else {
        toast.info("No follow-up reminders are currently due.");
      }
      fetchAssignments();
    } catch (err: any) {
      toast.error(err.message || "Failed to process reminders.");
    } finally {
      setProcessingReminders(false);
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
        <div className="flex items-center gap-2">
          <button
            onClick={handleProcessReminders}
            disabled={processingReminders || loading}
            title="Check and dispatch all due 10:00 AM reminders now"
            className="inline-flex items-center gap-2 rounded-lg border border-[#dce4df] dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm font-medium text-[#1a2923] dark:text-zinc-200 hover:bg-[#f4f6f4] dark:hover:bg-zinc-800 transition disabled:opacity-50 cursor-pointer"
          >
            <Clock className={`h-3.5 w-3.5 text-amber-600 dark:text-amber-400 ${processingReminders ? "animate-spin" : ""}`} />
            Check Due Reminders
          </button>
          <button
            onClick={fetchAssignments}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg border border-[#dce4df] dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-sm font-medium text-[#1a2923] dark:text-zinc-200 hover:bg-[#f4f6f4] dark:hover:bg-zinc-800 transition disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
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
                      <div className="flex flex-col gap-1 items-start">
                        <StatusBadge status={a.status} />
                        {a.status === "no_answer" && (
                          <div className="flex items-center gap-1 text-[11px]">
                            {a.remind_at ? (
                              <span className="text-amber-700 dark:text-amber-400 font-medium inline-flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                Next call: {new Date(a.remind_at).toLocaleDateString([], { month: "short", day: "numeric" })} 10:00 AM
                              </span>
                            ) : a.reminder_sent_at ? (
                              <span className="text-emerald-700 dark:text-emerald-400 inline-flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                Reminder sent (Attempt #{a.attempt_count ?? 1})
                              </span>
                            ) : (
                              <span className="text-zinc-500 dark:text-zinc-400">
                                Attempt #{a.attempt_count ?? 1}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
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
                      <div className="inline-flex items-center gap-1.5 justify-end">
                        <button
                          onClick={() => handleResend(a.id)}
                          disabled={resendingId === a.id || deletingId === a.id}
                          title="Resend to Telegram agent"
                          className="inline-flex items-center gap-1.5 rounded-lg border border-[#dce4df] dark:border-zinc-700 bg-white dark:bg-zinc-800 px-2.5 py-1 text-xs font-medium text-[#1a2923] dark:text-zinc-200 hover:bg-[#f4f6f4] dark:hover:bg-zinc-700 transition disabled:opacity-50"
                        >
                          <Send className={`h-3 w-3 ${resendingId === a.id ? "animate-pulse" : ""}`} />
                          <span>{resendingId === a.id ? "Sending…" : "Resend"}</span>
                        </button>
                        <button
                          onClick={() => setDeleteConfirmAssignment(a)}
                          disabled={deletingId === a.id || resendingId === a.id}
                          title="Remove assignment and delete from Telegram"
                          className="inline-flex items-center gap-1 rounded-lg border border-red-200 dark:border-red-900/60 bg-red-50/50 dark:bg-red-950/20 px-2.5 py-1 text-xs font-medium text-red-700 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 transition disabled:opacity-50 cursor-pointer"
                        >
                          <Trash2 className="h-3 w-3" />
                          <span>Remove</span>
                        </button>
                        {a.prospect_ikman_url && (
                          <SourceBadge
                            source={a.prospect_ikman_url.includes("lankapropertyweb") ? "lpw" : "ikman"}
                            url={a.prospect_ikman_url}
                          />
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

      {/* Delete Confirmation Modal */}
      {deleteConfirmAssignment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-[#dce4df] dark:border-zinc-800 shadow-xl w-full max-w-md p-6 transform transition-all">
            <h3 className="text-lg font-semibold text-[#1a2923] dark:text-zinc-100">
              Remove Assignment?
            </h3>
            <p className="mt-2 text-sm text-[#718078] dark:text-zinc-400">
              Are you sure you want to remove the sent assignment for{" "}
              <strong className="text-[#1a2923] dark:text-zinc-200">
                {deleteConfirmAssignment.prospect_poster_name || deleteConfirmAssignment.prospect_title || "this prospect"}
              </strong>
              ?
            </p>
            <p className="mt-2 text-xs text-[#8c9e94] dark:text-zinc-500">
              This will delete the assignment record and attempt to remove the card from the Telegram agent chat. The prospect will return to unassigned status.
            </p>
            <div className="mt-6 flex flex-col-reverse sm:flex-row justify-end gap-2.5">
              <button
                type="button"
                disabled={deletingId === deleteConfirmAssignment.id}
                onClick={() => setDeleteConfirmAssignment(null)}
                className="w-full sm:w-auto px-4 py-2 text-xs font-medium text-[#1a2923] dark:text-zinc-300 bg-white dark:bg-zinc-800 border border-[#dce4df] dark:border-zinc-700 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-700 transition cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deletingId === deleteConfirmAssignment.id}
                onClick={() => handleDelete(deleteConfirmAssignment)}
                className="w-full sm:w-auto px-4 py-2 text-xs font-medium text-white bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-600 rounded-lg transition cursor-pointer disabled:opacity-50 inline-flex items-center justify-center gap-1.5"
              >
                {deletingId === deleteConfirmAssignment.id ? (
                  <>
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                    <span>Removing…</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>Remove Assignment</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
