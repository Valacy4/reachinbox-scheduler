import type { EmailStatus } from "@/lib/api";

const statusClasses: Record<EmailStatus, string> = {
  pending: "bg-gray-100 text-gray-700",
  queued: "bg-blue-50 text-blue-700",
  delayed: "bg-amber-50 text-amber-700",
  sending: "bg-indigo-50 text-indigo-700",
  sent: "bg-emerald-50 text-emerald-700",
  failed: "bg-red-50 text-red-700"
};

export function StatusBadge({ status }: { status: EmailStatus }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${statusClasses[status]}`}>
      {status}
    </span>
  );
}
