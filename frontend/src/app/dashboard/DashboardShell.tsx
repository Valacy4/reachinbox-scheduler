"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  AlignLeft,
  ArrowLeft,
  Bold,
  Calendar,
  CalendarClock,
  ChevronDown,
  Clock3,
  Filter,
  Italic,
  List,
  ListOrdered,
  LogOut,
  Paperclip,
  Quote,
  Redo2,
  RefreshCw,
  Search,
  Send,
  Strikethrough,
  Underline,
  Undo2,
  Upload
} from "lucide-react";
import { signOut, useSession } from "next-auth/react";
import { StatusBadge } from "@/components/ui/StatusBadge";
import {
  listScheduledEmails,
  listSentEmails,
  parseRecipientsFile,
  scheduleEmails,
  type ScheduledEmail,
  type SentEmail
} from "@/lib/api";
import { formatDateTime, toDateTimeLocalValue } from "@/lib/format";

type ActiveTab = "scheduled" | "sent";
type DashboardView = "list" | "compose";

interface ComposeState {
  subject: string;
  body: string;
  startTime: string;
  delayBetweenMs: number;
  hourlyLimit: number;
  recipients: string[];
  fileName: string;
}

const initialComposeState: ComposeState = {
  subject: "",
  body: "",
  startTime: toDateTimeLocalValue(),
  delayBetweenMs: 2000,
  hourlyLimit: 200,
  recipients: [],
  fileName: ""
};

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

function extractEmails(value: string) {
  const matches = value.match(EMAIL_REGEX) ?? [];
  return Array.from(new Set(matches.map((email) => email.toLowerCase())));
}

export function DashboardShell() {
  const { data: session } = useSession();
  const [view, setView] = useState<DashboardView>("list");
  const [activeTab, setActiveTab] = useState<ActiveTab>("scheduled");
  const [scheduled, setScheduled] = useState<ScheduledEmail[]>([]);
  const [sent, setSent] = useState<SentEmail[]>([]);
  const [scheduledTotal, setScheduledTotal] = useState(0);
  const [sentTotal, setSentTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [filterOpen, setFilterOpen] = useState(false);
  const [selectedEmail, setSelectedEmail] = useState<ScheduledEmail | SentEmail | null>(null);

  async function refreshData(silent = false) {
    if (silent) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError("");

    try {
      const [scheduledResponse, sentResponse] = await Promise.all([
        listScheduledEmails(),
        listSentEmails()
      ]);
      setScheduled(scheduledResponse.jobs);
      setScheduledTotal(scheduledResponse.total);
      setSent(sentResponse.jobs);
      setSentTotal(sentResponse.total);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load dashboard data");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    void refreshData();

    // Auto-poll every 4 seconds so background worker job status transitions update live on the dashboard
    const interval = setInterval(() => {
      void refreshData(true);
    }, 4000);

    return () => clearInterval(interval);
  }, []);

  const filteredScheduled = useMemo(
    () => filterMessages(scheduled, searchQuery, statusFilter),
    [scheduled, searchQuery, statusFilter]
  );
  const filteredSent = useMemo(
    () => filterMessages(sent, searchQuery, statusFilter),
    [sent, searchQuery, statusFilter]
  );

  if (view === "compose") {
    return (
      <ComposeScreen
        senderLabel={session?.user?.email ?? "oliver.brown@domain.io"}
        onBack={() => setView("list")}
        onScheduled={(count, batchId) => {
          setView("list");
          setActiveTab("scheduled");
          setNotice(`Scheduled ${count} email${count === 1 ? "" : "s"} in batch ${batchId}.`);
          void refreshData(true);
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-white text-gray-950 font-sans">
      <div className="flex min-h-screen">
        {/* Left Sidebar matching Figma design */}
        <aside className="hidden w-80 shrink-0 border-r border-gray-100 bg-white px-6 py-7 lg:block">
          <div className="mb-6 flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-white font-bold shadow-sm">
              <Send size={20} />
            </div>
            <span className="text-xl font-bold tracking-tight text-gray-900">
              Reach<span className="text-[#00B050]">Inbox</span>
            </span>
          </div>
          <UserPanel />

          <button
            type="button"
            onClick={() => setView("compose")}
            className="mt-5 flex h-11 w-full items-center justify-center rounded-full border border-[#00B050] px-5 text-base font-medium text-[#00B050] transition hover:bg-emerald-50 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            Compose
          </button>

          <div className="mt-8 px-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
            CORE
          </div>
          <nav className="mt-3 space-y-1">
            <SidebarItem
              active={activeTab === "scheduled"}
              icon={<Clock3 size={18} />}
              label="Scheduled"
              count={scheduledTotal}
              onClick={() => {
                setActiveTab("scheduled");
                setStatusFilter("all");
              }}
            />
            <SidebarItem
              active={activeTab === "sent"}
              icon={<Send size={18} />}
              label="Sent"
              count={sentTotal}
              onClick={() => {
                setActiveTab("sent");
                setStatusFilter("all");
              }}
            />
          </nav>
        </aside>

        {/* Main Content Area */}
        <main className="min-w-0 flex-1">
          {/* Top Header Navbar */}
          <div className="sticky top-0 z-10 flex h-16 items-center gap-4 border-b border-gray-100 bg-white/95 px-4 backdrop-blur sm:px-8">
            <button
              type="button"
              onClick={() => setView("compose")}
              className="flex h-9 items-center justify-center rounded-full border border-[#00B050] px-4 text-sm font-medium text-[#00B050] transition hover:bg-emerald-50 lg:hidden"
            >
              Compose
            </button>
            <div className="relative mx-auto hidden w-full max-w-3xl sm:block">
              <Search
                className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
                size={18}
              />
              <input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                className="h-10 w-full rounded-full border-0 bg-gray-100 px-11 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:bg-white focus:ring-2 focus:ring-emerald-500"
                placeholder="Search by recipient, subject, or status..."
              />
              {searchQuery ? (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-semibold text-gray-400 hover:text-gray-600"
                >
                  Clear
                </button>
              ) : null}
            </div>

            <div className="relative">
              <IconButton
                label="Filter"
                onClick={() => setFilterOpen((current) => !current)}
              >
                <Filter
                  size={18}
                  className={statusFilter !== "all" ? "text-[#00B050]" : ""}
                />
              </IconButton>

              {filterOpen ? (
                <div className="absolute right-0 top-12 z-30 w-56 rounded-xl border border-gray-100 bg-white p-3 shadow-xl">
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400 px-2">
                    Filter by Status
                  </div>
                  <div className="space-y-1">
                    {[
                      { id: "all", label: "All Statuses" },
                      { id: "pending", label: "Pending" },
                      { id: "queued", label: "Queued" },
                      { id: "delayed", label: "Delayed" },
                      { id: "sending", label: "Sending" },
                      { id: "sent", label: "Sent" },
                      { id: "failed", label: "Failed" }
                    ].map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          setStatusFilter(item.id);
                          setFilterOpen(false);
                        }}
                        className={`flex w-full items-center justify-between rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                          statusFilter === item.id
                            ? "bg-emerald-50 text-emerald-800"
                            : "text-gray-700 hover:bg-gray-50"
                        }`}
                      >
                        {item.label}
                        {statusFilter === item.id ? (
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
                        ) : null}
                      </button>
                    ))}
                  </div>
                  {statusFilter !== "all" || searchQuery ? (
                    <button
                      type="button"
                      onClick={() => {
                        setStatusFilter("all");
                        setSearchQuery("");
                        setFilterOpen(false);
                      }}
                      className="mt-2 w-full border-t border-gray-100 pt-2 text-center text-xs font-medium text-red-600 hover:text-red-700"
                    >
                      Reset All Filters
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>

            <IconButton label="Refresh" onClick={() => void refreshData(true)}>
              <RefreshCw size={18} className={refreshing ? "animate-spin" : ""} />
            </IconButton>
            <IconButton label="Logout" onClick={() => signOut({ callbackUrl: "/login" })}>
              <LogOut size={18} />
            </IconButton>
          </div>

          <div className="px-4 py-5 sm:px-8">
            <div className="mb-4 sm:hidden">
              <div className="relative">
                <Search
                  className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
                  size={18}
                />
                <input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  className="h-10 w-full rounded-full border-0 bg-gray-100 px-11 text-sm text-gray-900 outline-none focus:bg-white focus:ring-2 focus:ring-emerald-500"
                  placeholder="Search"
                />
              </div>
            </div>

            {notice ? (
              <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                {notice}
              </div>
            ) : null}

            {error ? (
              <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            ) : null}

            <div className="mb-4 flex gap-2 lg:hidden">
              <MobileTab
                active={activeTab === "scheduled"}
                label="Scheduled"
                count={scheduledTotal}
                onClick={() => setActiveTab("scheduled")}
              />
              <MobileTab
                active={activeTab === "sent"}
                label="Sent"
                count={sentTotal}
                onClick={() => setActiveTab("sent")}
              />
            </div>

            {activeTab === "scheduled" ? (
              <MessageList
                type="scheduled"
                emails={filteredScheduled}
                loading={loading}
                emptyText="No scheduled emails yet"
                onSelectEmail={(email) => setSelectedEmail(email)}
              />
            ) : (
              <MessageList
                type="sent"
                emails={filteredSent}
                loading={loading}
                emptyText="No sent emails yet"
                onSelectEmail={(email) => setSelectedEmail(email)}
              />
            )}
          </div>
        </main>
      </div>

      {selectedEmail ? (
        <EmailDetailModal
          email={selectedEmail}
          onClose={() => setSelectedEmail(null)}
        />
      ) : null}
    </div>
  );
}

function filterMessages<T extends ScheduledEmail | SentEmail>(
  emails: T[],
  query: string,
  statusFilter: string = "all"
) {
  const normalized = query.trim().toLowerCase();

  return emails.filter((email) => {
    const matchesStatus =
      statusFilter === "all" || email.status.toLowerCase() === statusFilter.toLowerCase();
    if (!matchesStatus) return false;

    if (!normalized) return true;

    return [email.recipient, email.subject, email.sender, email.status].some((value) =>
      value.toLowerCase().includes(normalized)
    );
  });
}

function UserPanel() {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return (
      <div className="flex items-center gap-3 rounded-2xl bg-gray-50 px-4 py-3 border border-gray-100 animate-pulse">
        <div className="h-10 w-10 rounded-full bg-gray-200 shrink-0" />
        <div className="min-w-0 flex-1 space-y-1.5">
          <div className="h-3.5 w-24 rounded bg-gray-200" />
          <div className="h-2.5 w-32 rounded bg-gray-200" />
        </div>
      </div>
    );
  }

  const name = session?.user?.name ?? "ReachInbox User";
  const email = session?.user?.email ?? "user@reachinbox.ai";

  return (
    <div className="flex items-center gap-3 rounded-2xl bg-gray-50 px-4 py-3 border border-gray-100">
      {session?.user?.image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={session.user.image}
          alt={name}
          className="h-10 w-10 rounded-full border border-gray-200 object-cover shrink-0"
        />
      ) : (
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-600 text-base font-semibold text-white shrink-0">
          {name.slice(0, 1).toUpperCase()}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold text-gray-900">{name}</div>
        <div className="truncate text-xs text-gray-500">{email}</div>
      </div>
      <ChevronDown size={16} className="text-gray-400 shrink-0" />
    </div>
  );
}

function SidebarItem({
  active,
  icon,
  label,
  count,
  onClick
}: {
  active: boolean;
  icon: ReactNode;
  label: string;
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex h-11 w-full items-center gap-3 rounded-2xl px-4 text-left text-sm transition ${
        active
          ? "bg-[#E9F7EF] font-semibold text-gray-900"
          : "text-gray-700 hover:bg-gray-50"
      }`}
    >
      <span className={active ? "text-emerald-700" : "text-gray-500"}>{icon}</span>
      <span className="flex-1">{label}</span>
      <span className="text-xs font-medium text-gray-400">{count}</span>
    </button>
  );
}

function MobileTab({
  active,
  label,
  count,
  onClick
}: {
  active: boolean;
  label: string;
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-9 rounded-full px-4 text-xs font-medium transition ${
        active ? "bg-emerald-50 text-emerald-700 font-semibold" : "bg-gray-100 text-gray-600"
      }`}
    >
      {label} ({count})
    </button>
  );
}

function MessageListSkeleton() {
  return (
    <div className="divide-y divide-gray-100 animate-pulse">
      {[1, 2, 3, 4, 5].map((item) => (
        <div key={item} className="flex items-center gap-4 px-6 py-4">
          <div className="h-8 w-8 rounded-full bg-gray-200/80 shrink-0" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex items-center justify-between">
              <div className="h-4 w-40 rounded bg-gray-200/80" />
              <div className="h-3 w-16 rounded bg-gray-200/60" />
            </div>
            <div className="h-3.5 w-64 rounded bg-gray-200/60" />
          </div>
          <div className="h-6 w-16 rounded-full bg-gray-200/80 shrink-0" />
        </div>
      ))}
    </div>
  );
}

function MessageList({
  type,
  emails,
  loading,
  emptyText,
  onSelectEmail
}: {
  type: ActiveTab;
  emails: Array<ScheduledEmail | SentEmail>;
  loading: boolean;
  emptyText: string;
  onSelectEmail: (email: ScheduledEmail | SentEmail) => void;
}) {
  if (loading) {
    return <MessageListSkeleton />;
  }

  if (emails.length === 0) {
    return (
      <ListState
        icon={type === "scheduled" ? <Clock3 size={20} /> : <Send size={20} />}
        text={emptyText}
      />
    );
  }

  return (
    <div className="divide-y divide-gray-100">
      {emails.map((email) => (
        <MessageRow
          key={email.id}
          type={type}
          email={email}
          onClick={() => onSelectEmail(email)}
        />
      ))}
    </div>
  );
}

function MessageRow({
  type,
  email,
  onClick
}: {
  type: ActiveTab;
  email: ScheduledEmail | SentEmail;
  onClick: () => void;
}) {
  const [starred, setStarred] = useState(false);
  const isScheduled = type === "scheduled";

  const displayTime = isScheduled
    ? formatDateTime((email as ScheduledEmail).scheduledAt)
    : formatDateTime((email as SentEmail).sentAt);

  return (
    <article
      onClick={onClick}
      className="grid cursor-pointer min-h-[64px] grid-cols-1 items-center gap-3 py-4 text-sm transition hover:bg-emerald-50/40 sm:grid-cols-[minmax(160px,220px)_auto_1fr_auto] sm:px-4 rounded-lg"
    >
      <div className="truncate font-semibold text-gray-900">To: {email.recipient}</div>
      <span
        className={`inline-flex w-fit items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${
          isScheduled
            ? "border border-amber-200 bg-amber-50 text-amber-700"
            : "border border-gray-200 bg-gray-50 text-gray-600"
        }`}
      >
        {isScheduled ? <Clock3 size={13} /> : null}
        {isScheduled ? displayTime : `Sent ${displayTime}`}
      </span>
      <div className="min-w-0 truncate text-gray-500">
        <span className="font-semibold text-gray-900">{email.subject}</span>
        <span className="mx-2 text-gray-300">-</span>
        <span>{email.body ? email.body.replace(/<[^>]*>/g, "").slice(0, 50) : "No preview"}</span>
      </div>
      <div className="flex items-center justify-between gap-3 sm:justify-end">
        <StatusBadge status={email.status} />
      </div>
    </article>
  );
}

function ListState({ icon, text }: { icon: ReactNode; text: string }) {
  return (
    <div className="flex min-h-[380px] flex-col items-center justify-center gap-3 text-center text-sm text-gray-500">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gray-100 text-gray-400">
        {icon}
      </div>
      {text}
    </div>
  );
}

function ComposeScreen({
  senderLabel,
  onBack,
  onScheduled
}: {
  senderLabel: string;
  onBack: () => void;
  onScheduled: (count: number, batchId: string) => void;
}) {
  const [form, setForm] = useState<ComposeState>(initialComposeState);
  const [recipientInput, setRecipientInput] = useState("");
  const [parsing, setParsing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [error, setError] = useState("");

  function addRecipientFromInput() {
    const extracted = extractEmails(recipientInput);
    if (extracted.length > 0) {
      setForm((current) => ({
        ...current,
        recipients: Array.from(new Set([...current.recipients, ...extracted]))
      }));
      setRecipientInput("");
    }
  }

  function removeRecipient(emailToRemove: string) {
    setForm((current) => ({
      ...current,
      recipients: current.recipients.filter((r) => r !== emailToRemove)
    }));
  }

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setParsing(true);
    setError("");

    try {
      const parsed = await parseRecipientsFile(file);
      setForm((current) => ({
        ...current,
        fileName: parsed.filename,
        recipients: Array.from(new Set([...current.recipients, ...parsed.emails]))
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to parse recipients file");
    } finally {
      setParsing(false);
    }
  }

  function applyTomorrowAt(hour: number) {
    const next = new Date();
    next.setDate(next.getDate() + 1);
    next.setHours(hour, 0, 0, 0);

    setForm((current) => ({
      ...current,
      startTime: toDateTimeLocalValue(next)
    }));
  }

  async function submit() {
    setError("");

    const senderId = process.env.NEXT_PUBLIC_DEFAULT_SENDER_ID;
    if (!senderId) {
      setError("NEXT_PUBLIC_DEFAULT_SENDER_ID is missing in frontend .env.local.");
      return;
    }

    const pendingTyped = extractEmails(recipientInput);
    const finalRecipients = Array.from(new Set([...form.recipients, ...pendingTyped]));

    if (finalRecipients.length === 0) {
      setError("Upload a CSV/text file or enter at least one email address.");
      return;
    }
    if (!form.subject.trim() || !form.body.trim()) {
      setError("Subject and body are required.");
      return;
    }

    setSubmitting(true);
    try {
      const response = await scheduleEmails({
        senderId,
        recipients: finalRecipients,
        subject: form.subject.trim(),
        body: form.body,
        startTime: new Date(form.startTime).toISOString(),
        delayBetweenMs: form.delayBetweenMs,
        hourlyLimit: form.hourlyLimit
      });
      onScheduled(response.scheduledCount, response.batchId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to schedule emails");
    } finally {
      setSubmitting(false);
    }
  }

  const [activeStyles, setActiveStyles] = useState<Record<string, boolean>>({});

  function checkActiveStyles() {
    try {
      setActiveStyles({
        bold: document.queryCommandState("bold"),
        italic: document.queryCommandState("italic"),
        underline: document.queryCommandState("underline"),
        strikeThrough: document.queryCommandState("strikeThrough"),
        insertOrderedList: document.queryCommandState("insertOrderedList"),
        insertUnorderedList: document.queryCommandState("insertUnorderedList"),
        justifyLeft: document.queryCommandState("justifyLeft")
      });
    } catch {
      // ignore
    }
  }

  const editorRef = useRef<HTMLDivElement>(null);

  function handleCommand(cmd: string, arg?: string) {
    if (editorRef.current) {
      editorRef.current.focus();
      document.execCommand(cmd, false, arg);
      setForm((current) => ({ ...current, body: editorRef.current?.innerHTML ?? "" }));
      checkActiveStyles();
    }
  }

  return (
    <div className="min-h-screen bg-white text-gray-950 font-sans">
      <header className="flex h-20 items-center justify-between border-b border-gray-100 px-5 sm:px-8">
        <button
          type="button"
          onClick={onBack}
          className="flex min-w-0 items-center gap-3 text-left text-2xl font-semibold text-gray-900 hover:text-emerald-700 transition"
        >
          <ArrowLeft size={24} className="shrink-0" />
          <span className="truncate">Compose New Email</span>
        </button>

        <div className="flex items-center gap-4">
          <label
            title={form.fileName ? `Attached list: ${form.fileName}` : "Upload lead list (.csv, .txt)"}
            className="relative cursor-pointer text-[#00B050] transition hover:text-emerald-700"
          >
            <Paperclip size={24} />
            {form.fileName ? (
              <span className="absolute -bottom-2 -right-2 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-[#00B050] px-1 text-xs font-semibold text-white border border-white shadow-xs">
                1
              </span>
            ) : null}
            <input
              type="file"
              accept=".csv,.txt,text/csv,text/plain"
              className="sr-only"
              onChange={(event) => void handleFile(event.target.files?.[0])}
            />
          </label>
          <button
            type="button"
            onClick={() => setScheduleOpen((current) => !current)}
            className="text-[#00B050] transition hover:text-emerald-700"
            aria-label="Choose send time"
          >
            <Clock3 size={24} />
          </button>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={submitting || parsing}
            className="h-10 rounded-full border border-[#00B050] px-6 text-sm font-medium text-[#00B050] transition hover:bg-emerald-50 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "Scheduling..." : "Send Later"}
          </button>
        </div>
      </header>

      <main className="relative mx-auto max-w-[1200px] px-5 py-8 sm:px-8">
        {scheduleOpen ? (
          <div className="absolute right-5 top-4 z-20 w-full max-w-sm rounded-xl border border-gray-200 bg-white p-6 shadow-2xl sm:right-8">
            <h2 className="mb-6 text-lg font-semibold text-gray-900">Send Later</h2>
            <label className="flex items-center justify-between border-b border-gray-200 pb-3 text-sm text-gray-600">
              <input
                type="datetime-local"
                className="w-full border-0 bg-transparent text-sm text-gray-800 outline-none"
                value={form.startTime}
                onChange={(event) =>
                  setForm((current) => ({ ...current, startTime: event.target.value }))
                }
              />
              <Calendar size={18} className="ml-3 shrink-0 text-gray-400" />
            </label>

            <div className="mt-5 space-y-3 text-sm text-gray-600">
              <button
                type="button"
                className="block text-left hover:text-emerald-700 transition"
                onClick={() => applyTomorrowAt(9)}
              >
                Tomorrow, 9:00 AM
              </button>
              <button
                type="button"
                className="block text-left hover:text-emerald-700 transition"
                onClick={() => applyTomorrowAt(10)}
              >
                Tomorrow, 10:00 AM
              </button>
              <button
                type="button"
                className="block text-left hover:text-emerald-700 transition"
                onClick={() => applyTomorrowAt(11)}
              >
                Tomorrow, 11:00 AM
              </button>
              <button
                type="button"
                className="block text-left hover:text-emerald-700 transition"
                onClick={() => applyTomorrowAt(15)}
              >
                Tomorrow, 3:00 PM
              </button>
            </div>

            <div className="mt-8 flex items-center justify-end gap-4">
              <button
                type="button"
                className="text-sm font-medium text-gray-600 hover:text-gray-900"
                onClick={() => setScheduleOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="h-9 rounded-full border border-[#00B050] px-6 text-sm font-medium text-[#00B050] hover:bg-emerald-50"
                onClick={() => setScheduleOpen(false)}
              >
                Done
              </button>
            </div>
          </div>
        ) : null}

        {error ? (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <div className="space-y-6">
          <ComposeRow label="From">
            <button
              type="button"
              className="inline-flex h-10 max-w-full items-center gap-2 rounded-lg bg-gray-100 px-3 text-sm text-gray-900"
            >
              <span className="truncate">{senderLabel}</span>
              <ChevronDown size={16} className="shrink-0 text-gray-400" />
            </button>
          </ComposeRow>

          <ComposeRow label="To">
            <div className="flex min-h-11 items-center gap-3 border-b border-gray-200 pb-1">
              <div className="min-w-0 flex-1 flex flex-wrap items-center gap-2">
                {form.recipients.map((recipient) => (
                  <span
                    key={recipient}
                    className="inline-flex items-center gap-1.5 max-w-[240px] truncate rounded-full border border-emerald-500 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-900"
                  >
                    <span className="truncate">{recipient}</span>
                    <button
                      type="button"
                      onClick={() => removeRecipient(recipient)}
                      className="text-emerald-700 hover:text-red-600 font-bold ml-1"
                    >
                      ×
                    </button>
                  </span>
                ))}
                <input
                  value={recipientInput}
                  onChange={(event) => setRecipientInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (["Enter", ",", " ", "Tab"].includes(event.key)) {
                      event.preventDefault();
                      addRecipientFromInput();
                    }
                  }}
                  onBlur={() => addRecipientFromInput()}
                  className="min-w-[200px] flex-1 border-0 bg-transparent px-1 text-sm outline-none placeholder:text-gray-400"
                  placeholder={
                    form.recipients.length === 0
                      ? "recipient@example.com (press Enter)"
                      : "Add recipient..."
                  }
                />
              </div>
              <label className="hidden cursor-pointer items-center gap-2 whitespace-nowrap px-2 text-sm font-medium text-[#00B050] transition hover:text-emerald-700 sm:flex">
                <Upload size={16} />
                {parsing ? "Parsing..." : "Upload List"}
                <input
                  type="file"
                  accept=".csv,.txt,text/csv,text/plain"
                  className="sr-only"
                  onChange={(event) => void handleFile(event.target.files?.[0])}
                />
              </label>
            </div>
            {form.fileName ? (
              <div className="mt-1 text-xs text-gray-500">
                {form.fileName} - {form.recipients.length} email addresses detected
              </div>
            ) : null}
          </ComposeRow>

          <ComposeRow label="Subject">
            <input
              value={form.subject}
              onChange={(event) => setForm((current) => ({ ...current, subject: event.target.value }))}
              className="h-10 w-full border-0 border-b border-gray-200 bg-transparent px-2 text-sm outline-none placeholder:text-gray-400 focus:border-emerald-500"
              placeholder="Subject"
            />
          </ComposeRow>

          <ComposeRow label="Delay between 2 emails">
            <div className="flex flex-wrap items-center gap-8 text-sm">
              <input
                type="number"
                min={0}
                step={500}
                value={form.delayBetweenMs}
                onChange={(event) =>
                  setForm((current) => ({ ...current, delayBetweenMs: Number(event.target.value) }))
                }
                className="h-10 w-24 rounded-lg border border-gray-200 px-3 text-sm text-gray-900 outline-none focus:border-emerald-500"
              />
              <label className="flex items-center gap-3 font-medium text-gray-700">
                Hourly Limit
                <input
                  type="number"
                  min={1}
                  value={form.hourlyLimit}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, hourlyLimit: Number(event.target.value) }))
                  }
                  className="h-10 w-24 rounded-lg border border-gray-200 px-3 text-sm text-gray-900 outline-none focus:border-emerald-500"
                />
              </label>
            </div>
          </ComposeRow>

          <ComposeRow label="">
            <div className="min-h-[420px] rounded-2xl bg-[#F8FAFC] p-5 border border-gray-100 flex flex-col justify-between">
              <div
                ref={editorRef}
                contentEditable
                suppressContentEditableWarning
                onKeyUp={checkActiveStyles}
                onMouseUp={checkActiveStyles}
                onInput={(event) => {
                  const target = event.currentTarget as HTMLElement | null;
                  const html = target?.innerHTML ?? "";
                  setForm((current) => ({ ...current, body: html }));
                  checkActiveStyles();
                }}
                className="min-h-[300px] w-full border-0 bg-transparent text-sm text-gray-900 outline-none focus:outline-none [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:my-2 [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:my-2 [&_h3]:text-lg [&_h3]:font-bold [&_h3]:my-2 [&_blockquote]:border-l-4 [&_blockquote]:border-[#00B050] [&_blockquote]:pl-3 [&_blockquote]:italic [&_blockquote]:my-2 [&_blockquote]:text-gray-600"
              />
              <Toolbar onAction={handleCommand} activeStyles={activeStyles} />
            </div>
          </ComposeRow>
        </div>
      </main>
    </div>
  );
}

function ComposeRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid gap-2 md:grid-cols-[200px_minmax(0,1fr)] items-start">
      <div className="pt-2 text-sm font-medium text-gray-700 md:text-right">{label}</div>
      <div>{children}</div>
    </div>
  );
}

function Toolbar({
  onAction,
  activeStyles
}: {
  onAction: (cmd: string, arg?: string) => void;
  activeStyles: Record<string, boolean>;
}) {
  const items = [
    { label: "Undo", icon: <Undo2 size={18} />, action: () => onAction("undo"), key: "undo", tooltip: "Undo (Ctrl+Z)" },
    { label: "Redo", icon: <Redo2 size={18} />, action: () => onAction("redo"), key: "redo", tooltip: "Redo (Ctrl+Y)" },
    {
      label: "Text",
      icon: <span className="text-sm font-semibold leading-none">Tt</span>,
      action: () => onAction("formatBlock", "<h3>"),
      key: "formatBlock",
      tooltip: "Heading / Large Text (Tt)"
    },
    { label: "Bold", icon: <Bold size={18} />, action: () => onAction("bold"), key: "bold", tooltip: "Bold (B)" },
    { label: "Italic", icon: <Italic size={18} />, action: () => onAction("italic"), key: "italic", tooltip: "Italic (I)" },
    {
      label: "Underline",
      icon: <Underline size={18} />,
      action: () => onAction("underline"),
      key: "underline",
      tooltip: "Underline (U)"
    },
    {
      label: "Align",
      icon: <AlignLeft size={18} />,
      action: () => onAction("justifyLeft"),
      key: "justifyLeft",
      tooltip: "Align Left"
    },
    {
      label: "Numbered list",
      icon: <ListOrdered size={18} />,
      action: () => onAction("insertOrderedList"),
      key: "insertOrderedList",
      tooltip: "Numbered List (1. 2. 3.)"
    },
    {
      label: "List",
      icon: <List size={18} />,
      action: () => onAction("insertUnorderedList"),
      key: "insertUnorderedList",
      tooltip: "Bullet List (• • •)"
    },
    {
      label: "Quote",
      icon: <Quote size={18} />,
      action: () => onAction("formatBlock", "blockquote"),
      key: "blockquote",
      tooltip: "Quote Block (\"\")"
    },
    {
      label: "Strikethrough",
      icon: <Strikethrough size={18} />,
      action: () => onAction("strikeThrough"),
      key: "strikeThrough",
      tooltip: "Strikethrough (S)"
    }
  ];

  return (
    <div className="mt-4 flex min-h-10 flex-wrap items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-gray-500 shadow-sm border border-gray-100">
      {items.map((item, index) => {
        const isActive = Boolean(activeStyles[item.key]);
        const showDivider = index === 1 || index === 2 || index === 5 || index === 8;

        return (
          <div key={item.label} className="flex items-center gap-1.5">
            <button
              type="button"
              aria-label={item.label}
              title={item.tooltip}
              onClick={item.action}
              className={`flex h-8 w-8 items-center justify-center rounded-full transition active:scale-95 shrink-0 ${
                isActive
                  ? "bg-[#00B050] text-white shadow-xs font-bold"
                  : "hover:bg-gray-100 hover:text-gray-900"
              }`}
            >
              {item.icon}
            </button>
            {showDivider ? (
              <span className="h-5 w-px bg-gray-200 mx-0.5 shrink-0" aria-hidden="true" />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}



function IconButton({
  label,
  onClick,
  children
}: {
  label: string;
  onClick?: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-gray-500 transition hover:bg-gray-100 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
    >
      {children}
    </button>
  );
}

function EmailDetailModal({
  email,
  onClose
}: {
  email: ScheduledEmail | SentEmail;
  onClose: () => void;
}) {
  const isScheduled = "scheduledAt" in email;
  const sentTime = !isScheduled ? (email as SentEmail).sentAt : null;
  const scheduledTime = isScheduled ? (email as ScheduledEmail).scheduledAt : null;
  const previewUrl = !isScheduled ? (email as SentEmail).previewUrl : null;

  const lastError = !isScheduled ? (email as SentEmail).lastError : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-950/40 p-4 backdrop-blur-xs">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl border border-gray-100">
        <div className="flex items-start justify-between border-b border-gray-100 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <StatusBadge status={email.status} />
              <span className="text-xs text-gray-400 font-mono">ID: {email.id}</span>
            </div>
            <h2 className="mt-2 text-xl font-bold text-gray-900">{email.subject}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
          >
            ✕
          </button>
        </div>

        <div className="my-5 space-y-3 text-sm">
          <div className="flex justify-between border-b border-gray-50 pb-2">
            <span className="text-gray-500 font-medium">To (Recipient)</span>
            <span className="font-semibold text-gray-900">{email.recipient}</span>
          </div>
          <div className="flex justify-between border-b border-gray-50 pb-2">
            <span className="text-gray-500 font-medium">From (Sender)</span>
            <span className="text-gray-800">{email.sender}</span>
          </div>
          {scheduledTime ? (
            <div className="flex justify-between border-b border-gray-50 pb-2">
              <span className="text-gray-500 font-medium">Scheduled Delivery</span>
              <span className="text-amber-700 font-medium">{formatDateTime(scheduledTime)}</span>
            </div>
          ) : null}
          {sentTime ? (
            <div className="flex justify-between border-b border-gray-50 pb-2">
              <span className="text-gray-500 font-medium">Sent Time</span>
              <span className="text-emerald-700 font-medium">{formatDateTime(sentTime)}</span>
            </div>
          ) : null}
          {email.batchId ? (
            <div className="flex justify-between border-b border-gray-50 pb-2">
              <span className="text-gray-500 font-medium">Batch ID</span>
              <span className="font-mono text-xs text-gray-600">{email.batchId}</span>
            </div>
          ) : null}
          {lastError ? (
            <div className="rounded-lg bg-red-50 p-3 text-xs text-red-700 border border-red-200">
              <span className="font-semibold">Error Log:</span> {lastError}
            </div>
          ) : null}
        </div>

        <div className="mt-4">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
            Email Content Preview
          </div>
          <div className="min-h-[160px] rounded-xl bg-gray-50 p-4 text-sm text-gray-800 border border-gray-100 [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:my-2 [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:my-2 [&_h3]:text-lg [&_h3]:font-bold [&_h3]:my-2 [&_blockquote]:border-l-4 [&_blockquote]:border-[#00B050] [&_blockquote]:pl-3 [&_blockquote]:italic [&_blockquote]:my-2 [&_blockquote]:text-gray-600">
            {email.body ? (
              <div dangerouslySetInnerHTML={{ __html: email.body }} />
            ) : (
              <p className="italic text-gray-400">No body content available</p>
            )}
          </div>
        </div>

        <div className="mt-6 flex items-center justify-between border-t border-gray-100 pt-4">
          {previewUrl ? (
            <a
              href={previewUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-600 hover:underline"
            >
              View on Ethereal Email ↗
            </a>
          ) : (
            <span />
          )}
          <button
            type="button"
            onClick={onClose}
            className="h-10 rounded-full border border-gray-300 px-6 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

