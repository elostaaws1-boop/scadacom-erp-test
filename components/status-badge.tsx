import { TranslatedText } from "@/components/translated-text";

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    APPROVED: "bg-emerald-100 text-emerald-800",
    PARTIALLY_APPROVED: "bg-amber-100 text-amber-800",
    PENDING: "bg-stone-100 text-stone-700",
    REJECTED: "bg-red-100 text-red-700",
    ACTIVE: "bg-emerald-100 text-emerald-800",
    COMPLETED: "bg-blue-100 text-blue-800",
    OVERDUE: "bg-red-100 text-red-700"
  };
  const label = status === "PENDING" ? "PENDING VERIFICATION" : status.replaceAll("_", " ");
  return <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${map[status] ?? "bg-stone-100 text-stone-700"}`}><TranslatedText text={label} /></span>;
}
