import { approveSubmission } from "@/app/actions";

export function ApprovalForm({ entity, id, amount }: { entity: "purchase" | "expense" | "advance"; id: string; amount: number }) {
  return (
    <form action={approveSubmission} className="grid gap-2 md:grid-cols-[1fr_1fr_2fr_auto]">
      <input type="hidden" name="entity" value={entity} />
      <input type="hidden" name="id" value={id} />
      <select name="status" className="rounded-md border px-3 py-2 text-sm">
        <option value="APPROVED">Approve</option>
        <option value="PARTIALLY_APPROVED">Partial</option>
        <option value="REJECTED">Reject</option>
      </select>
      <input name="approvedAmount" type="number" step="0.01" defaultValue={amount} className="rounded-md border px-3 py-2 text-sm" />
      <input name="reason" placeholder="Reason for rejection or partial approval" className="rounded-md border px-3 py-2 text-sm" />
      <button className="rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white">Apply</button>
    </form>
  );
}
