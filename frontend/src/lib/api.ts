import { getSession } from "next-auth/react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export type EmailStatus = "pending" | "queued" | "delayed" | "sending" | "sent" | "failed";

export interface ScheduledEmail {
  id: string;
  recipient: string;
  subject: string;
  scheduledAt: string;
  status: EmailStatus;
  sender: string;
}

export interface SentEmail {
  id: string;
  recipient: string;
  subject: string;
  sentAt: string | null;
  status: EmailStatus;
  lastError: string | null;
  sender: string;
}

export interface ListResponse<T> {
  total: number;
  limit: number;
  offset: number;
  jobs: T[];
}

export interface ParsedRecipients {
  filename: string;
  count: number;
  emails: string[];
}

export interface SchedulePayload {
  senderId: string;
  recipients: string[];
  subject: string;
  body: string;
  startTime: string;
  delayBetweenMs: number;
  hourlyLimit: number;
}

export interface ScheduleResponse {
  batchId: string;
  scheduledCount: number;
  hourlyLimit: number;
  jobs: Array<{ id: string; recipient: string; scheduledAt: string }>;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const session = await getSession();
  const idToken = (session as any)?.idToken as string | undefined;

  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      ...(init?.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
      ...(idToken ? { Authorization: `Bearer ${idToken}` } : {}),
      ...init?.headers
    }
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const message =
      typeof data?.error === "string"
        ? data.error
        : data?.error
          ? JSON.stringify(data.error)
          : `Request failed with status ${response.status}`;
    throw new Error(message);
  }

  return data as T;
}

export function listScheduledEmails() {
  return request<ListResponse<ScheduledEmail>>("/api/emails/scheduled");
}

export function listSentEmails() {
  return request<ListResponse<SentEmail>>("/api/emails/sent");
}

export function parseRecipientsFile(file: File) {
  const form = new FormData();
  form.append("file", file);
  return request<ParsedRecipients>("/api/uploads/parse-recipients", {
    method: "POST",
    body: form
  });
}

export function scheduleEmails(payload: SchedulePayload) {
  return request<ScheduleResponse>("/api/schedule", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}