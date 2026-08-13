"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarClock, RefreshCw, Send, Upload, X } from "lucide-react";
import { Header } from "@/components/Header";
import { Button } from "@/components/ui/Button";
import { Field, inputClasses, textareaClasses } from "@/components/ui/Field";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Tabs } from "@/components/ui/Tabs";
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

export function DashboardShell() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("scheduled");
  const [scheduled, setScheduled] = useState<ScheduledEmail[]>([]);
  const [sent, setSent] = useState<SentEmail[]>([]);
  const [scheduledTotal, setScheduledTotal] = useState(0);
  const [sentTotal, setSentTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [composeOpen, setComposeOpen] = useState(false);

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
  }, []);

  const tabs = useMemo(
    () => [
      { id: "scheduled", label: "Scheduled", count: scheduledTotal },
      { id: "sent", label: "Sent", count: sentTotal }
    ],
    [scheduledTotal, sentTotal]
  );

  return (
    <div className="min-h-screen bg-slate-50">
      <Header />

      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-gray-950">Email Scheduler</h2>
            <p className="mt-1 text-sm text-gray-500">
              Schedule outreach, monitor delayed jobs, and review completed sends.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" onClick={() => refreshData(true)} disabled={refreshing}>
              <RefreshCw size={16} className={refreshing ? "animate-spin" : ""} />
              Refresh
            </Button>
            <Button onClick={() => setComposeOpen(true)}>
              <Send size={16} />
              Compose New Email
            </Button>
          </div>
        </div>

        {notice ? (
          <div className="mb-4 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            {notice}
          </div>
        ) : null}

        {error ? (
          <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <div className="mb-4">
          <Tabs tabs={tabs} activeTab={activeTab} onChange={(id) => setActiveTab(id as ActiveTab)} />
        </div>

        <section className="rounded-lg border border-gray-200 bg-white shadow-panel">
          {activeTab === "scheduled" ? (
            <ScheduledTable emails={scheduled} loading={loading} />
          ) : (
            <SentTable emails={sent} loading={loading} />
          )}
        </section>
      </main>

      {composeOpen ? (
        <ComposeModal
          onClose={() => setComposeOpen(false)}
          onScheduled={(count, batchId) => {
            setComposeOpen(false);
            setNotice(`Scheduled ${count} email${count === 1 ? "" : "s"} in batch ${batchId}.`);
            void refreshData(true);
          }}
        />
      ) : null}
    </div>
  );
}

function ScheduledTable({ emails, loading }: { emails: ScheduledEmail[]; loading: boolean }) {
  if (loading) return <TableState icon={<CalendarClock size={18} />} text="Loading scheduled emails" />;
  if (emails.length === 0) return <TableState icon={<CalendarClock size={18} />} text="No scheduled emails yet" />;

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200 text-sm">
        <thead className="bg-gray-50">
          <tr>
            <Th>Email</Th>
            <Th>Subject</Th>
            <Th>Scheduled Time</Th>
            <Th>Status</Th>
            <Th>Sender</Th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 bg-white">
          {emails.map((email) => (
            <tr key={email.id} className="hover:bg-gray-50">
              <Td>{email.recipient}</Td>
              <Td>{email.subject}</Td>
              <Td>{formatDateTime(email.scheduledAt)}</Td>
              <Td>
                <StatusBadge status={email.status} />
              </Td>
              <Td>{email.sender}</Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SentTable({ emails, loading }: { emails: SentEmail[]; loading: boolean }) {
  if (loading) return <TableState icon={<Send size={18} />} text="Loading sent emails" />;
  if (emails.length === 0) return <TableState icon={<Send size={18} />} text="No sent emails yet" />;

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200 text-sm">
        <thead className="bg-gray-50">
          <tr>
            <Th>Email</Th>
            <Th>Subject</Th>
            <Th>Sent Time</Th>
            <Th>Status</Th>
            <Th>Sender</Th>
            <Th>Last Error</Th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 bg-white">
          {emails.map((email) => (
            <tr key={email.id} className="hover:bg-gray-50">
              <Td>{email.recipient}</Td>
              <Td>{email.subject}</Td>
              <Td>{formatDateTime(email.sentAt)}</Td>
              <Td>
                <StatusBadge status={email.status} />
              </Td>
              <Td>{email.sender}</Td>
              <Td>{email.lastError ?? "-"}</Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ComposeModal({
  onClose,
  onScheduled
}: {
  onClose: () => void;
  onScheduled: (count: number, batchId: string) => void;
}) {
  const [form, setForm] = useState<ComposeState>(initialComposeState);
  const [parsing, setParsing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setParsing(true);
    setError("");

    try {
      const parsed = await parseRecipientsFile(file);
      setForm((current) => ({
        ...current,
        fileName: parsed.filename,
        recipients: parsed.emails
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to parse recipients file");
    } finally {
      setParsing(false);
    }
  }

  async function submit() {
    setError("");

    const senderId = process.env.NEXT_PUBLIC_DEFAULT_SENDER_ID;
    if (!senderId) {
      setError("NEXT_PUBLIC_DEFAULT_SENDER_ID is missing in frontend .env.local.");
      return;
    }
    if (form.recipients.length === 0) {
      setError("Upload a CSV or text file containing at least one email address.");
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
        recipients: form.recipients,
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-950/40 px-4 py-6">
      <div className="max-h-full w-full max-w-3xl overflow-y-auto rounded-lg bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-950">Compose New Email</h3>
            <p className="text-sm text-gray-500">Create a delayed BullMQ job for each detected recipient.</p>
          </div>
          <Button variant="ghost" onClick={onClose} aria-label="Close compose modal">
            <X size={18} />
          </Button>
        </div>

        <div className="grid gap-5 px-6 py-5">
          {error ? (
            <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          <Field label="Subject" htmlFor="subject">
            <input
              id="subject"
              className={inputClasses}
              value={form.subject}
              onChange={(event) => setForm((current) => ({ ...current, subject: event.target.value }))}
              placeholder="Quick follow-up from ReachInbox"
            />
          </Field>

          <Field label="Body" htmlFor="body">
            <textarea
              id="body"
              className={textareaClasses}
              value={form.body}
              onChange={(event) => setForm((current) => ({ ...current, body: event.target.value }))}
              placeholder="<p>Hi there, wanted to share...</p>"
            />
          </Field>

          <div className="rounded-lg border border-dashed border-gray-300 bg-gray-50 p-4">
            <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-md bg-white px-4 py-6 text-center text-sm transition hover:bg-gray-50">
              <Upload className="text-gray-500" size={22} />
              <span className="font-medium text-gray-900">Upload CSV or text leads</span>
              <span className="text-xs text-gray-500">The backend will parse unique email addresses.</span>
              <input
                type="file"
                accept=".csv,.txt,text/csv,text/plain"
                className="sr-only"
                onChange={(event) => void handleFile(event.target.files?.[0])}
              />
            </label>
            <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
              <span className="rounded-full bg-brand-soft px-3 py-1 text-brand">
                {parsing ? "Parsing file..." : `${form.recipients.length} email addresses detected`}
              </span>
              {form.fileName ? <span className="text-gray-500">{form.fileName}</span> : null}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            <Field label="Start time" htmlFor="startTime">
              <input
                id="startTime"
                type="datetime-local"
                className={inputClasses}
                value={form.startTime}
                onChange={(event) => setForm((current) => ({ ...current, startTime: event.target.value }))}
              />
            </Field>

            <Field label="Delay between emails" htmlFor="delayBetweenMs" hint="Milliseconds">
              <input
                id="delayBetweenMs"
                type="number"
                min={0}
                step={500}
                className={inputClasses}
                value={form.delayBetweenMs}
                onChange={(event) =>
                  setForm((current) => ({ ...current, delayBetweenMs: Number(event.target.value) }))
                }
              />
            </Field>

            <Field label="Hourly limit" htmlFor="hourlyLimit">
              <input
                id="hourlyLimit"
                type="number"
                min={1}
                className={inputClasses}
                value={form.hourlyLimit}
                onChange={(event) => setForm((current) => ({ ...current, hourlyLimit: Number(event.target.value) }))}
              />
            </Field>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-gray-200 px-6 py-4">
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={submitting || parsing}>
            <Send size={16} />
            {submitting ? "Scheduling..." : "Schedule"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function TableState({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex min-h-64 flex-col items-center justify-center gap-3 p-8 text-center text-sm text-gray-500">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-gray-500">{icon}</div>
      {text}
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-500">{children}</th>;
}

function Td({ children }: { children: React.ReactNode }) {
  return <td className="max-w-72 truncate px-4 py-3 text-gray-700">{children}</td>;
}
