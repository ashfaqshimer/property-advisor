"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import {
  MessageSquare,
  Sparkles,
  User,
  Wrench,
  Trash2,
  ArrowLeft,
  Search,
  RefreshCw,
  Copy,
  Check,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Bot,
  Clock,
  UserCheck,
  Filter,
} from "lucide-react";

import {
  getCurrentUser,
  getAdminConversations,
  getAdminConversation,
  deleteAdminConversation,
  type AuthUser,
  type ConversationSummary,
  type ConversationDetail,
  type ConversationMessage,
} from "@/lib/api";
import { Spinner } from "@/components/ui/spinner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    return d.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return dateStr;
  }
}

function formatRelativeTime(dateStr: string): string {
  try {
    const now = new Date();
    const d = new Date(dateStr);
    const diffSec = Math.floor((now.getTime() - d.getTime()) / 1000);
    if (diffSec < 60) return "just now";
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    const diffDays = Math.floor(diffHr / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch {
    return "";
  }
}

export default function AdminConversationsPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);

  // List state
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loadingList, setLoadingList] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [leadFilter, setLeadFilter] = useState<"all" | "lead" | "no_lead">("all");

  // Selection & Detail state
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ConversationDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [showToolCalls, setShowToolCalls] = useState(false);

  // Deletion state
  const [deletingConversation, setDeletingConversation] = useState<ConversationDetail | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Clipboard copy state
  const [copiedSessionId, setCopiedSessionId] = useState(false);

  // Collapsible tool payload toggles
  const [expandedTools, setExpandedTools] = useState<Record<string, boolean>>({});

  useEffect(() => {
    getCurrentUser()
      .then((user) => {
        if (!user || !["root", "admin"].includes(user.role)) {
          router.replace("/admin");
          return;
        }
        setCurrentUser(user);
        setCheckingAuth(false);
      })
      .catch(() => {
        router.replace("/admin");
      });
  }, [router]);

  const loadConversations = async (search = searchQuery, filter = leadFilter) => {
    setLoadingList(true);
    try {
      const hasLeadParam =
        filter === "lead" ? true : filter === "no_lead" ? false : undefined;
      const res = await getAdminConversations({
        search: search.trim() || undefined,
        has_lead: hasLeadParam,
        limit: 100,
      });
      setConversations(res.items);
      setTotalCount(res.total);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load conversations");
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    if (!checkingAuth && currentUser) {
      loadConversations();
    }
  }, [checkingAuth, currentUser, leadFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadConversations(searchQuery, leadFilter);
  };

  const handleSelectConversation = async (id: string) => {
    setSelectedId(id);
    setLoadingDetail(true);
    try {
      const data = await getAdminConversation(id);
      setDetail(data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not load conversation details");
    } finally {
      setLoadingDetail(false);
    }
  };

  const copySessionId = (sessionId: string) => {
    navigator.clipboard.writeText(sessionId);
    setCopiedSessionId(true);
    toast.success("Session ID copied to clipboard");
    setTimeout(() => setCopiedSessionId(false), 2000);
  };

  const toggleToolPayload = (msgId: string) => {
    setExpandedTools((prev) => ({ ...prev, [msgId]: !prev[msgId] }));
  };

  const handleDelete = async () => {
    if (!deletingConversation) return;
    setIsDeleting(true);
    try {
      await deleteAdminConversation(deletingConversation.id);
      toast.success("Conversation deleted successfully");
      setConversations((prev) => prev.filter((c) => c.id !== deletingConversation.id));
      setTotalCount((c) => Math.max(0, c - 1));
      if (selectedId === deletingConversation.id) {
        setSelectedId(null);
        setDetail(null);
      }
      setDeletingConversation(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete conversation");
    } finally {
      setIsDeleting(false);
    }
  };

  const visibleMessages = useMemo(() => {
    if (!detail) return [];
    if (showToolCalls) return detail.messages;
    return detail.messages.filter((m) => m.role !== "tool");
  }, [detail, showToolCalls]);

  if (checkingAuth) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Spinner className="mr-2 h-6 w-6" />
        <span className="text-sm text-muted-foreground">Checking authorization...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Internal Auditing
            </span>
            <Badge variant="outline" className="text-[10px] font-mono">
              Admin &amp; Root Only
            </Badge>
          </div>
          <h1 className="mt-1 text-2xl sm:text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <MessageSquare className="h-7 w-7 text-primary" />
            Conversations
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Audit Amaya AI chats, inspect user intents, and view conversation histories.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => loadConversations()}
            disabled={loadingList}
            className="cursor-pointer gap-1.5"
          >
            <RefreshCw className={`h-4 w-4 ${loadingList ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Main Content Area: Responsive Split-Pane */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 min-h-[680px]">
        {/* Left Column: Conversation List (Full width on mobile when no selection or when back clicked) */}
        <div
          className={`lg:col-span-5 xl:col-span-4 flex flex-col rounded-xl border border-border bg-card shadow-xs overflow-hidden ${
            selectedId ? "hidden lg:flex" : "flex"
          }`}
        >
          {/* List Search & Filters Header */}
          <div className="p-4 border-b border-border space-y-3 bg-muted/20">
            <form onSubmit={handleSearchSubmit} className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search messages, session, lead..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-8 text-sm"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery("");
                    loadConversations("", leadFilter);
                  }}
                  className="absolute right-2.5 top-2.5 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  ✕
                </button>
              )}
            </form>

            {/* Quick Filter Tabs */}
            <div className="flex items-center gap-1.5 p-1 bg-muted rounded-lg text-xs font-medium">
              <button
                type="button"
                onClick={() => setLeadFilter("all")}
                className={`flex-1 py-1.5 px-2 rounded-md transition cursor-pointer text-center ${
                  leadFilter === "all"
                    ? "bg-card text-foreground shadow-xs font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                All ({totalCount})
              </button>
              <button
                type="button"
                onClick={() => setLeadFilter("lead")}
                className={`flex-1 py-1.5 px-2 rounded-md transition cursor-pointer text-center ${
                  leadFilter === "lead"
                    ? "bg-card text-foreground shadow-xs font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                With Lead
              </button>
              <button
                type="button"
                onClick={() => setLeadFilter("no_lead")}
                className={`flex-1 py-1.5 px-2 rounded-md transition cursor-pointer text-center ${
                  leadFilter === "no_lead"
                    ? "bg-card text-foreground shadow-xs font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                No Lead
              </button>
            </div>
          </div>

          {/* List Items Scroll Area */}
          <div className="flex-1 overflow-y-auto divide-y divide-border max-h-[720px]">
            {loadingList && conversations.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-12 text-center text-muted-foreground">
                <Spinner className="h-6 w-6 mb-2" />
                <p className="text-sm">Loading conversations...</p>
              </div>
            ) : conversations.length === 0 ? (
              <div className="flex flex-col items-center justify-center p-12 text-center text-muted-foreground">
                <MessageSquare className="h-10 w-10 text-muted-foreground/40 mb-3" />
                <p className="text-base font-medium text-foreground">No conversations found</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {searchQuery ? "Try a different search term" : "No chats have taken place yet"}
                </p>
              </div>
            ) : (
              conversations.map((item) => {
                const isSelected = selectedId === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleSelectConversation(item.id)}
                    className={`w-full text-left p-4 transition cursor-pointer border-l-4 ${
                      isSelected
                        ? "border-primary bg-primary/5 dark:bg-primary/10"
                        : "border-transparent hover:bg-muted/50"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <span className="font-mono text-xs text-muted-foreground font-semibold truncate max-w-[170px]" title={item.session_id}>
                        {item.session_id}
                      </span>
                      <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                        {formatRelativeTime(item.created_at)}
                      </span>
                    </div>

                    {/* Preview Snippet */}
                    <p className="text-xs text-foreground/90 line-clamp-2 leading-relaxed">
                      {item.preview || (
                        <span className="italic text-muted-foreground">No message text recorded</span>
                      )}
                    </p>

                    {/* Metadata Footer */}
                    <div className="mt-2.5 flex items-center justify-between gap-2 text-[11px]">
                      <div className="flex items-center gap-1.5">
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4.5 font-normal">
                          {item.message_count} {item.message_count === 1 ? "turn" : "turns"}
                        </Badge>
                        {item.lead && (
                          <Badge variant="success" className="text-[10px] px-1.5 py-0 h-4.5 flex items-center gap-1 font-medium">
                            <UserCheck className="h-2.5 w-2.5" />
                            {item.lead.name || "Lead"}
                          </Badge>
                        )}
                      </div>
                      <span className="text-muted-foreground text-[10px]">
                        {formatDate(item.created_at)}
                      </span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Selected Conversation Detail Pane */}
        <div
          className={`lg:col-span-7 xl:col-span-8 flex-col rounded-xl border border-border bg-card shadow-xs overflow-hidden ${
            selectedId ? "flex" : "hidden lg:flex"
          }`}
        >
          {loadingDetail ? (
            <div className="flex flex-1 flex-col items-center justify-center p-12 text-center text-muted-foreground">
              <Spinner className="h-8 w-8 mb-3" />
              <p className="text-sm">Loading transcript...</p>
            </div>
          ) : !detail ? (
            <div className="flex flex-1 flex-col items-center justify-center p-12 text-center text-muted-foreground">
              <div className="p-4 rounded-full bg-muted/60 mb-3">
                <MessageSquare className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-base font-semibold text-foreground">No conversation selected</h3>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                Select a conversation from the left pane to view its full transcript, user inquiries, tool calls, and captured lead profile.
              </p>
            </div>
          ) : (
            <div className="flex flex-col h-full">
              {/* Detail Header */}
              <div className="p-4 sm:p-5 border-b border-border bg-muted/20">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    {/* Mobile Back Button */}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        setSelectedId(null);
                        setDetail(null);
                      }}
                      className="lg:hidden h-8 w-8 -ml-1 text-muted-foreground hover:text-foreground cursor-pointer"
                      aria-label="Back to conversations list"
                    >
                      <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs text-muted-foreground font-semibold">Session ID:</span>
                        <code className="text-xs font-mono font-semibold bg-muted px-2 py-0.5 rounded text-foreground">
                          {detail.session_id}
                        </code>
                        <button
                          type="button"
                          onClick={() => copySessionId(detail.session_id)}
                          className="text-muted-foreground hover:text-foreground transition p-1 cursor-pointer"
                          title="Copy Session ID"
                        >
                          {copiedSessionId ? (
                            <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )}
                        </button>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5">
                        <Clock className="h-3 w-3" />
                        Started {formatDate(detail.created_at)} ({formatRelativeTime(detail.created_at)})
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Toggle Tool Calls */}
                    <Button
                      variant={showToolCalls ? "secondary" : "outline"}
                      size="sm"
                      onClick={() => setShowToolCalls((prev) => !prev)}
                      className="text-xs cursor-pointer gap-1.5"
                    >
                      <Wrench className="h-3.5 w-3.5" />
                      {showToolCalls ? "Hide Tools" : "Show Tools"}
                    </Button>

                    {/* Delete Conversation */}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setDeletingConversation(detail)}
                      className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive cursor-pointer"
                      title="Delete Conversation"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Lead Banner if captured */}
                {detail.lead && (
                  <div className="mt-3.5 p-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5 dark:bg-emerald-500/10 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="success" className="text-xs font-semibold">
                          Captured Lead
                        </Badge>
                        <span className="text-sm font-semibold text-foreground">
                          {detail.lead.name || "Anonymous Contact"}
                        </span>
                        {detail.lead.phone && (
                          <span className="text-xs font-mono text-muted-foreground">
                            • {detail.lead.phone}
                          </span>
                        )}
                        {detail.lead.intent && (
                          <Badge variant="outline" className="text-[10px] uppercase font-mono">
                            {detail.lead.intent}
                          </Badge>
                        )}
                      </div>
                      {detail.lead.requirements && (
                        <p className="text-xs text-muted-foreground line-clamp-1">
                          <span className="font-medium text-foreground">Requirements:</span> {detail.lead.requirements}
                        </p>
                      )}
                    </div>
                    <Link
                      href={`/admin/leads?search=${encodeURIComponent(detail.lead.phone || detail.lead.name || "")}`}
                      className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 dark:text-emerald-400 hover:underline shrink-0"
                    >
                      View in Leads
                      <ExternalLink className="h-3 w-3" />
                    </Link>
                  </div>
                )}
              </div>

              {/* Message Transcript Stream */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 max-h-[600px] bg-background/50">
                {visibleMessages.length === 0 ? (
                  <div className="py-12 text-center text-muted-foreground text-xs">
                    No visible messages in this conversation.
                  </div>
                ) : (
                  visibleMessages.map((msg) => {
                    const isUser = msg.role === "user";
                    const isTool = msg.role === "tool";
                    const isAssistant = msg.role === "assistant";

                    if (isTool) {
                      const isExpanded = !!expandedTools[msg.id];
                      const toolName = (msg.tool_payload?.name as string) || "Tool Execution";
                      return (
                        <div
                          key={msg.id}
                          className="mx-auto max-w-xl my-2 rounded-lg border border-border bg-muted/40 p-3 text-xs"
                        >
                          <div
                            onClick={() => toggleToolPayload(msg.id)}
                            className="flex items-center justify-between cursor-pointer select-none"
                          >
                            <div className="flex items-center gap-2">
                              <Wrench className="h-3.5 w-3.5 text-muted-foreground" />
                              <span className="font-mono font-semibold text-foreground">
                                {toolName}
                              </span>
                              <Badge variant="outline" className="text-[10px] px-1 py-0">
                                seq #{msg.seq}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-1 text-muted-foreground text-[11px]">
                              <span>{isExpanded ? "Collapse" : "Payload"}</span>
                              {isExpanded ? (
                                <ChevronDown className="h-3.5 w-3.5" />
                              ) : (
                                <ChevronRight className="h-3.5 w-3.5" />
                              )}
                            </div>
                          </div>

                          {isExpanded && msg.tool_payload && (
                            <pre className="mt-2.5 p-2 rounded bg-black/80 text-emerald-400 font-mono text-[11px] overflow-x-auto max-h-48 whitespace-pre-wrap">
                              {JSON.stringify(msg.tool_payload, null, 2)}
                            </pre>
                          )}
                        </div>
                      );
                    }

                    return (
                      <div
                        key={msg.id}
                        className={`flex gap-3 max-w-[85%] sm:max-w-[75%] ${
                          isUser ? "ml-auto flex-row-reverse" : "mr-auto"
                        }`}
                      >
                        {/* Avatar */}
                        <div
                          className={`flex h-8 w-8 shrink-0 select-none items-center justify-center rounded-full text-xs font-semibold ${
                            isUser
                              ? "bg-primary text-primary-foreground"
                              : "bg-emerald-600 text-white dark:bg-emerald-500"
                          }`}
                        >
                          {isUser ? <User className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
                        </div>

                        {/* Bubble */}
                        <div className="space-y-1">
                          <div className={`flex items-center gap-2 text-[10px] text-muted-foreground ${isUser ? "justify-end" : "justify-start"}`}>
                            <span className="font-medium text-foreground">
                              {isUser ? "User" : "Amaya"}
                            </span>
                            <span>•</span>
                            <span>{formatDate(msg.created_at)}</span>
                            <span className="font-mono">#{msg.seq}</span>
                          </div>

                          <div
                            className={`rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                              isUser
                                ? "bg-primary text-primary-foreground rounded-tr-xs"
                                : "bg-card border border-border text-card-foreground rounded-tl-xs shadow-xs"
                            }`}
                          >
                            {msg.content}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirmation Alert Dialog */}
      <AlertDialog
        open={deletingConversation !== null}
        onOpenChange={(open) => {
          if (!open) setDeletingConversation(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Conversation</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to permanently delete conversation{" "}
              <code className="font-mono font-semibold">{deletingConversation?.session_id}</code>?
              This will remove all associated turns and history. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting}
              className="cursor-pointer"
            >
              {isDeleting ? "Deleting..." : "Delete Permanently"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
